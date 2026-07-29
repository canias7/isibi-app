// Getting a user their Neon backend — the step whose failures are not fixed by
// retrying.
//
// A Neon project is a capped, billed resource whose only record is a Supabase
// row. Create one and fail to write the row and it is invisible: the next build
// finds no row, creates another, and the orphan bills forever. The original code
// awaited both writes without checking either, which is very likely how the two
// loose projects in the handoff notes appeared. Everything below exists to keep
// that from happening again.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureSiteBackend } from "../site-provision.mjs";

const PROJ = { neon_project: "p1", neon_branch: "br-1", neon_role: "owner", neon_conn: "postgres://u:p@h/neondb" };

// Records every effect so a test can assert on what was NOT done — the project
// that should have been cleaned up, the database never created.
function harness(over = {}) {
  const calls = { createProject: 0, dropProject: [], saveProject: [], createDatabase: [], saveBackend: [], lookupSite: 0 };
  const base = {
    lookupSite: async () => null,
    lookupProject: async () => PROJ,
    createProject: async () => ({ projectId: "p1", branchId: "br-1", roleName: "owner", conn: PROJ.neon_conn }),
    dropProject: async () => {},
    saveProject: async () => ({ ok: true }),
    createDatabase: async (_p, slug) => "site_" + slug.replace(/-/g, "_"),
    saveBackend: async () => ({ ok: true }),
  };
  const pick = (k) => over[k] || base[k];
  const deps = {
    lookupSite: (s) => { calls.lookupSite++; return pick("lookupSite")(s); },
    lookupProject: (u) => pick("lookupProject")(u),
    createProject: (u) => { calls.createProject++; return pick("createProject")(u); },
    dropProject: (id) => { calls.dropProject.push(id); return pick("dropProject")(id); },
    saveProject: (s2, u, p) => { calls.saveProject.push({ s: s2, u, p }); return pick("saveProject")(s2, u, p); },
    createDatabase: (p, s) => { calls.createDatabase.push(s); return pick("createDatabase")(p, s); },
    saveBackend: (s, u, db) => { calls.saveBackend.push({ s, u, db }); return pick("saveBackend")(s, u, db); },
    connFor: (conn, db) => conn.replace(/\/[^/]*$/, "/" + db),
    dbNameFor: (s) => "site_" + s.replace(/-/g, "_"),
  };
  return { deps, calls };
}

const run = (deps, slug = "cafe", uid = "u1") => ensureSiteBackend(deps, { slug, uid });

test("an existing site is reused, nothing is provisioned", async () => {
  const { deps, calls } = harness({ lookupSite: async () => ({ conn: "postgres://u:p@h/site_cafe", uid: "u1" }) });
  assert.equal(await run(deps), "postgres://u:p@h/site_cafe");
  assert.equal(calls.createProject, 0);
  assert.deepEqual(calls.createDatabase, [], "a rebuild must not re-provision");
});

// -------------------------------------------------- the cross-account write

test("someone else's slug is refused, not adopted", async () => {
  // The route's own ownership check was wrapped in `catch {}` and failed OPEN,
  // so one Supabase timeout during a build let the caller take over an existing
  // site: the lookup handed back the CURRENT owner's connection and the schema
  // apply, the seed and the publish all landed on their database and their R2
  // prefix. Ownership belongs in the layer that returns the connection.
  const { deps, calls } = harness({ lookupSite: async () => ({ conn: "postgres://u:p@h/site_cafe", uid: "someone-else" }) });
  const e = await run(deps).catch((x) => x);
  assert.match(String(e.message), /that name is taken/);
  assert.equal(e.conflict, true, "the route turns this into a 409, not a 502");
  assert.deepEqual(calls.createDatabase, [], "nothing may be written to another account's site");
  assert.deepEqual(calls.saveBackend, [], "and their ownership row must not be overwritten");
});

test("a claimed slug with no connection recorded is still not ours", async () => {
  // A half-finished build by another user leaves the row without a usable
  // connection. Treating that as free would let the slug be stolen mid-build —
  // and saveBackend upserts, so it would overwrite their ownership row.
  const { deps, calls } = harness({ lookupSite: async () => ({ conn: null, uid: "someone-else" }) });
  await assert.rejects(run(deps), /that name is taken/);
  assert.deepEqual(calls.saveBackend, []);
});

test("a claimed slug with no connection IS ours to finish", async () => {
  // Same shape, same user: a retried build after a failed provision must be
  // able to complete rather than being locked out of its own slug.
  const { deps, calls } = harness({ lookupSite: async () => ({ conn: null, uid: "u1" }) });
  assert.equal(await run(deps), "postgres://u:p@h/site_cafe");
  assert.deepEqual(calls.createDatabase, ["cafe"]);
});

test("a RETRIED build reuses the project that slug already has", async () => {
  // The per-site version of the leak this module exists to stop. Keyed by slug,
  // so a retry finds the project the last attempt made; keyed by anything else,
  // every retry creates another one and burns the cap.
  const { deps, calls } = harness();
  assert.equal(await run(deps), "postgres://u:p@h/site_cafe");
  assert.equal(calls.createProject, 0, "an existing project for this slug must be reused, not duplicated");
  assert.deepEqual(calls.createDatabase, ["cafe"]);
  assert.deepEqual(calls.saveBackend, [{ s: "cafe", u: "u1", db: "site_cafe" }]);
});

test("the project is looked up by SLUG, not by owner", async () => {
  // One project per SITE (2026-07-29). If this were keyed by uid, a user's
  // second site would find the first site's project and be provisioned INSIDE
  // it — which is precisely the isolation the change was made to get.
  const seen = [];
  const { deps } = harness({ lookupProject: async (k) => { seen.push(k); return null; } });
  await run(deps);
  assert.deepEqual(seen, ["cafe"], "looked up by " + JSON.stringify(seen) + " — must be the slug");
});

test("a first build gets a project, recorded before anything else", async () => {
  const { deps, calls } = harness({ lookupProject: async () => null });
  await run(deps);
  assert.equal(calls.createProject, 1);
  assert.deepEqual(calls.saveProject[0].p, PROJ);
  // Recorded against BOTH the slug and the owner: the slug is how a retry finds
  // it, the owner is how account deletion can ever find it.
  assert.equal(calls.saveProject[0].s, "cafe");
  assert.equal(calls.saveProject[0].u, "u1");
  assert.deepEqual(calls.dropProject, [], "a recorded project is not dropped");
});

test("the project is named per site, so two sites cannot collide", async () => {
  // createProject receives the slug, and Neon project names are what an operator
  // reads in the console. `isibi-user-<uid>` for every site would make seven
  // sites seven identically-named projects.
  const got = [];
  const { deps } = harness({
    lookupProject: async () => null,
    createProject: async (k) => { got.push(k); return { projectId: "p9", branchId: "b", roleName: "o", conn: PROJ.neon_conn }; },
  });
  await run(deps);
  assert.deepEqual(got, ["cafe"]);
});

// ---------------------------------------------------- the leak this prevents

test("a project that cannot be recorded is DESTROYED, not left behind", async () => {
  // The whole reason this module exists. An unrecorded project is invisible:
  // the next build finds no row, creates another, and the orphan bills forever
  // against a capped quota.
  const { deps, calls } = harness({
    lookupProject: async () => null,
    saveProject: async () => ({ ok: false, detail: "supabase 503" }),
  });
  await assert.rejects(run(deps), /could not record the Neon project/);
  assert.deepEqual(calls.dropProject, ["p1"], "the orphan must be cleaned up");
  assert.deepEqual(calls.createDatabase, [], "and nothing built on top of it");
});

test("a saveProject that THROWS is treated the same as one that fails", async () => {
  // A network error and a 503 leave exactly the same orphan.
  const { deps, calls } = harness({
    lookupProject: async () => null,
    saveProject: async () => { throw new Error("fetch failed"); },
  });
  await assert.rejects(run(deps), /could not record the Neon project/);
  assert.deepEqual(calls.dropProject, ["p1"]);
});

test("a saveProject returning nothing is not mistaken for success", async () => {
  for (const bad of [undefined, null, {}, { ok: false }, "ok", 1]) {
    const { deps, calls } = harness({ lookupProject: async () => null, saveProject: async () => bad });
    await assert.rejects(run(deps), /could not record the Neon project/, JSON.stringify(bad));
    assert.deepEqual(calls.dropProject, ["p1"], JSON.stringify(bad));
  }
});

test("a failed cleanup does not hide the original failure", async () => {
  // If the drop also fails the project really is orphaned — but the caller must
  // still be told the build did not work, not get a cleanup error instead.
  const { deps } = harness({
    lookupProject: async () => null,
    saveProject: async () => ({ ok: false }),
    dropProject: async () => { throw new Error("neon delete failed"); },
  });
  await assert.rejects(run(deps), /could not record the Neon project/);
});

test("the failure says which step broke", async () => {
  const { deps } = harness({ lookupProject: async () => null, saveProject: async () => ({ ok: false, detail: "supabase 503" }) });
  const e = await run(deps).catch((x) => x);
  assert.equal(e.stage, "save_project");
  assert.match(e.detail, /supabase 503/);
});

// ------------------------------------------------- the unreachable-site case

test("a database that cannot be recorded fails the build", async () => {
  // Without the row the slug stays unclaimed and every read 404s. Reporting a
  // successful build for a site nobody can reach is worse than failing.
  const { deps } = harness({ saveBackend: async () => ({ ok: false, detail: "supabase 503" }) });
  const e = await run(deps).catch((x) => x);
  assert.match(String(e.message), /could not record the site's database/);
  assert.equal(e.stage, "save_backend");
});

test("a saveBackend that throws also fails the build", async () => {
  const { deps } = harness({ saveBackend: async () => { throw new Error("fetch failed"); } });
  await assert.rejects(run(deps), /could not record the site's database/);
});

test("the project is NOT dropped when only the backend row fails", async () => {
  // The project is legitimately recorded and may already hold other sites.
  const { deps, calls } = harness({ saveBackend: async () => ({ ok: false }) });
  await assert.rejects(run(deps));
  assert.deepEqual(calls.dropProject, []);
});

// ------------------------------------------------------------- retried build

test("an already-existing database is success, not failure", async () => {
  // A build retried after a timeout hits a database it created last time. The
  // schema apply that follows is additive and idempotent.
  const { deps } = harness({
    createDatabase: async () => { throw Object.assign(new Error("neon api POST failed"), { detail: 'database "site_cafe" already exists' }); },
  });
  assert.equal(await run(deps), "postgres://u:p@h/site_cafe");
});

test("any OTHER database error still fails", async () => {
  // "already exists" is the one recoverable case; quota, auth and network are not.
  for (const detail of ["quota exceeded", "unauthorized", "branch not found", ""]) {
    const { deps, calls } = harness({
      createDatabase: async () => { throw Object.assign(new Error("neon api POST failed"), { detail }); },
    });
    await assert.rejects(run(deps), /neon api POST failed/, detail);
    assert.deepEqual(calls.saveBackend, [], "nothing is recorded for a database that was not created");
  }
});

test("the existing check reads fresh, every time", async () => {
  // On the request path the slug lookup is cached for five minutes. Here it must
  // not be: a cached connection for a slug another isolate deleted would send
  // the schema apply at a dropped database.
  const { deps, calls } = harness();
  await run(deps);
  assert.equal(calls.lookupSite, 1);
});

test("the returned connection points at the site's own database", async () => {
  // Every database in a project shares one host and role, so the site's
  // connection is the project's with a different path. Getting this wrong sends
  // one site's queries to another site's data.
  const { deps } = harness();
  assert.equal(await run(deps, "my-shop"), "postgres://u:p@h/site_my_shop");
});

// ------------------------------------------- the wiring, and the credential
//
// One project per SITE means the connection string moved from a per-user row to
// a per-slug one, and a connection URI carries a PASSWORD. `site_backends` has
// an own-read RLS policy — a signed-in user can read their own rows over the
// REST API — so the conn landing there would hand every owner a credential.
// These read worker.js, because that is where the choice of table lives.
import fs from "node:fs";
const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("the connection string is never selected from, or written to, site_backends", () => {
  // Both directions. Reading it back would expose it; writing it there is how it
  // would come to be readable in the first place.
  for (const m of WORKER.matchAll(/site_backends\?[^`"']*select=([^&`"']*)/g)) {
    assert.ok(!/conn/.test(m[1]), "site_backends is client-readable — it must not carry a connection string: " + m[1]);
  }
  const writes = [...WORKER.matchAll(/write\("site_backends",\s*\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(writes.length > 0, "the site_backends write was not found");
  for (const w of writes) assert.ok(!/conn/.test(w), "a connection string is being written to a client-readable table: " + w);
});

test("the per-site project is read by SLUG and only with the service key", () => {
  const fn = WORKER.match(/async function siteNeonProject\(env, slug\)[\s\S]*?\n\}/);
  assert.ok(fn, "siteNeonProject was not found");
  assert.match(fn[0], /site_project\?slug=eq\./, "keyed by slug, or a user's second site resolves to their first site's project");
  assert.match(fn[0], /svcHeaders\(env\)/, "this table is policy-less: only the service key can read it");
  // Throwing rather than answering null is load-bearing on the write path: a
  // Supabase hiccup reading as "no project" makes the next build create another.
  assert.match(fn[0], /throw Object\.assign\(new Error\("site project lookup failed"\)/);
});

test("deleting a site drops its PROJECT", () => {
  const i = WORKER.indexOf("let projectDropped = false;");
  assert.ok(i > 0, "the project drop was not found in the delete path");
  const block = WORKER.slice(i, i + 2600);
  assert.match(block, /dropUserProject\(env, proj\.neon_project\)/, "the project itself must be dropped");
  assert.match(block, /site_project\?slug=eq\./, "…and the per-slug record must go with it");
  // Legacy sites still have a database inside a shared per-user project.
  assert.match(block, /dropSiteDatabase\(env, legacy\.neon_project/, "a pre-change site must still have its database dropped");
});

test("the project record can never be lost, and the QUEUE is what guarantees it", () => {
  // This rule changed on purpose, so it is worth writing down why. The first
  // version gated the row deletion on the inline drop having worked, because
  // there was nowhere to hand a failure to — which left the site half-deleted
  // and needed an operator.
  //
  // The trigger is strictly better: deleting the row ENQUEUES the project, so the
  // record survives as a queue entry and the cron finishes the job. The invariant
  // is no longer "keep the row on failure" but "something is always still
  // holding this project", and the sweeper is that something.
  assert.match(WORKER, /ctx\.waitUntil\(runNeonTeardown\(env\)\)/, "the sweeper must be on the cron, or the queue never drains");
  const fn = WORKER.match(/async function runNeonTeardown\(env\)[\s\S]*?\n\}/);
  assert.ok(fn, "runNeonTeardown was not found");
  assert.match(fn[0], /drainTeardown\(/, "the decisions belong in site-teardown.mjs, not inline here");
  assert.match(fn[0], /neon_teardown\?next_try_at=lte\./, "it must respect the backoff, not retry every tick");
  // The status has to reach the verdict: 404 and 403 mean opposite things, and
  // collapsing them to ok/not-ok is what would delete a live project's record.
  assert.match(fn[0], /return \{ ok: r\.ok, status: r\.status \}/, "the verdict turns on the status — it must be passed through");
  assert.match(fn[0], /if \(!env\.NEON_API_KEY/, "no key means do nothing, not fail every row");
});

test("nothing provisions a project keyed by the owner any more", () => {
  // `createUserProject` survives for the legacy rows, but nothing on the build
  // path may call it — that is what would put a second site inside the first
  // one's project and quietly undo the isolation.
  const deps = WORKER.slice(WORKER.indexOf("const conn = await ensureSiteBackendPure({"), WORKER.indexOf("}, { slug, uid });"));
  assert.ok(deps.length > 200, "the dep wiring was not found");
  assert.match(deps, /createProject: \(s2\) => createSiteProject\(env, s2\)/);
  assert.ok(!/createUserProject/.test(deps), "the build path must not create a per-user project");
  assert.ok(!/userSiteProject/.test(deps), "the build path must not resolve a project by owner");
});
