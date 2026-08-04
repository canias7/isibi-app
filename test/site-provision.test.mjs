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
  const calls = { createProject: 0, dropProject: [], saveProject: [], createDatabase: [], saveBackend: [], lookupSite: 0, enableAuth: [] };
  const base = {
    lookupSite: async () => null,
    lookupProject: async () => PROJ,
    createProject: async () => ({ projectId: "p1", branchId: "br-1", roleName: "owner", conn: PROJ.neon_conn }),
    dropProject: async () => {},
    saveProject: async () => ({ ok: true }),
    enableAuth: async () => ({ enabled: true }),
    // THE HARNESS DID NOT HAVE THIS AT ALL, so `if (deps.enableData)` was false
    // in every unit test and the Data API branch — the site's entire backend
    // since our row routes were deleted — ran in none of them. A fake less
    // capable than the real thing hides bugs exactly the way one that is MORE
    // capable does; the real worker always injects it.
    enableData: async () => ({ enabled: true }),
    createDatabase: async (_p, slug) => "site_" + slug.replace(/-/g, "_"),
    saveBackend: async () => ({ ok: true }),
  };
  calls.marks = [];
  calls.enableData = [];
  const pick = (k) => over[k] || base[k];
  const deps = {
    lookupSite: (s) => { calls.lookupSite++; return pick("lookupSite")(s); },
    lookupProject: (u) => pick("lookupProject")(u),
    createProject: (u) => { calls.createProject++; return pick("createProject")(u); },
    dropProject: (id) => { calls.dropProject.push(id); return pick("dropProject")(id); },
    saveProject: (s2, u, p) => { calls.saveProject.push({ s: s2, u, p }); return pick("saveProject")(s2, u, p); },
    // BOTH arguments forwarded. This wrapper took only `(p)` when enableAuth
    // took one argument, and kept dropping the second after it grew a database
    // name — so the override saw `undefined` and the test could not tell
    // which database auth was being installed into, which is the entire
    // thing it exists to check.
    enableAuth: (p, db) => { calls.enableAuth.push({ project: p && p.neon_project, db }); return pick("enableAuth")(p, db); },
    enableData: (p, db) => { calls.enableData.push({ project: p && p.neon_project, db }); return pick("enableData")(p, db); },
    createDatabase: (p, s) => { calls.createDatabase.push(s); return pick("createDatabase")(p, s); },
    saveBackend: (s, u, db) => { calls.saveBackend.push({ s, u, db }); return pick("saveBackend")(s, u, db); },
    // Recorded so the build trace's account of provisioning can be asserted.
    // Deliberately NOT in `base`: it is an OPTIONAL dep, and a test below runs
    // with it absent to prove the module does not require it.
    mark: (n) => calls.marks.push(n),
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

// -------------------------------------------------- Neon Auth is the identity
//
// The whole backend is Neon as of 2026-07-30, so a site with auth off is a site
// whose member pages return nothing. These pin the two things that are easy to
// get wrong and impossible to notice: enabling it only when the project is NEW,
// and letting a failure pass as success.

test("auth is enabled on a REUSED project, not only a new one", async () => {
  // The trap. A project can exist with auth off — the create succeeded and the
  // enable failed, or it predates the change — and a retried build reuses the
  // project. Enabled only at creation, that site is permanently without identity
  // while every retry reports success.
  const { deps, calls } = harness();               // lookupProject returns an existing PROJ
  await run(deps);
  assert.equal(calls.createProject, 0, "this is the reuse path");
  assert.deepEqual(calls.enableAuth, [{ project: "p1", db: "site_cafe" }], "auth must be ensured on reuse too");
});

test("auth is enabled on a freshly created project", async () => {
  const { deps, calls } = harness({ lookupProject: async () => null });
  await run(deps);
  assert.equal(calls.createProject, 1);
  assert.equal(calls.enableAuth.length, 1);
});

test("a build whose auth could not be enabled FAILS, and says which stage", async () => {
  // Not best-effort. A caller can retry a failure and cannot retry a success, so
  // a build that quietly produced a site nobody can sign in to is the worse
  // outcome.
  const { deps } = harness({ enableAuth: async () => { throw Object.assign(new Error("nope"), { detail: "neon says no" }); } });
  await assert.rejects(run(deps), (e) => {
    assert.equal(e.stage, "enable_auth");
    assert.match(String(e.message), /Neon Auth/);
    assert.match(String(e.detail), /neon says no/);
    return true;
  });
});

test("auth is enabled after the database exists, and before this returns", async () => {
  // The order changed on 2026-07-30 and both halves matter.
  //
  // AFTER the database: the enable call has to NAME which database to install
  // into, because a site's project holds two — Neon's default and the one this
  // repo creates — and Neon refuses to guess. Measured against a real project.
  //
  // BEFORE returning: the caller applies the schema with the connection this
  // hands back, and a table cannot reference `neon_auth` before it exists.
  const order = [];
  const { deps } = harness({
    lookupProject: async () => null,
    createDatabase: async () => { order.push("db"); return "site_cafe"; },
    enableAuth: async (_p, dbName) => { order.push("auth:" + dbName); },
    saveBackend: async () => { order.push("record"); return { ok: true }; },
  });
  await run(deps);
  assert.deepEqual(order, ["db", "auth:site_cafe", "record"],
    "auth must be enabled against the site's OWN database, after it exists and before this returns");
});

test("the database name is passed to the enable call, not left to Neon to guess", async () => {
  // Omitting it does not default — it errors when the branch has more than one
  // database, which a site's project always does. And if Neon ever did guess, it
  // could guess the unused default, which nothing would notice until a member
  // tried to sign in.
  let named = "__never__";
  const { deps } = harness({ enableAuth: async (_p, dbName) => { named = dbName; } });
  await run(deps);
  assert.equal(named, "site_cafe");
  const src = fs.readFileSync(new URL("../site-db.mjs", import.meta.url), "utf8");
  const fn = src.match(/export async function enableNeonAuth[\s\S]*?\n\}/);
  assert.match(fn[0], /database_name: dbName/, "the request body must name the database");
  assert.match(fn[0], /if \(!dbName\) throw/, "…and a missing name must be refused here, not by Neon");
});

test("enableNeonAuth treats an already-enabled project as done", async () => {
  // A no-op, not a failure — otherwise every retried build of an existing site
  // fails on the one call that was always going to conflict.
  const src = fs.readFileSync(new URL("../site-db.mjs", import.meta.url), "utf8");
  const fn = src.match(/export async function enableNeonAuth[\s\S]*?\n\}/);
  assert.ok(fn, "enableNeonAuth was not found");
  assert.match(fn[0], /e\.status === 409 \|\| \/already\/i\.test/, "a conflict must read as already-enabled");
  assert.match(fn[0], /if \(!already\) throw e;/, "…and anything else must still throw");
  assert.match(fn[0], /auth_provider: "better_auth"/);
  // The wait, for the same reason every other Neon step has one.
  assert.match(fn[0], /await waitForProject\(env, projectId\)/, "enabling auth is an async project operation");
});

// EVERY DEP THE PROVISIONER READS MUST BE ONE worker.js SUPPLIES.
//
// This is the guard that was missing, and its absence had a cost. `enableDataApi`
// was written, documented "FATAL, like enableNeonAuth", covered by its own source
// test above — and never called, because worker.js's deps object simply had no
// `enableData` key. site-provision.mjs guards each optional step with
// `if (deps.enableData)`, so the whole Data API block was skipped SILENTLY on
// every build: no error, no log, a green build, and a published site whose every
// list and every form answered 501 because nothing ever wrote `_meta.data_api`.
//
// DERIVED AT BOTH ENDS, deliberately. A hand-written list of dep names would have
// to be remembered on the day somebody adds the next optional step, which is the
// same failure one level up. So: scan the provisioner for what it READS, scan the
// worker's call site for what it SUPPLIES, and diff.
test("worker.js supplies every dep site-provision.mjs reads", () => {
  const prov = fs.readFileSync(new URL("../site-provision.mjs", import.meta.url), "utf8");
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

  // Comments describe deps that do not exist yet; only real reads count.
  const body = prov.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const read = new Set([...body.matchAll(/\bdeps\.(\w+)/g)].map((m) => m[1]));
  assert.ok(read.size >= 10, `only found ${read.size} deps — the scan stopped working`);

  // The one call site, taken as a balanced brace region so a later object cannot
  // leak into it and make a missing key look supplied.
  const at = worker.indexOf("ensureSiteBackendPure({");
  assert.ok(at > 0, "worker.js no longer calls ensureSiteBackendPure — retarget this test");
  let depth = 0, end = at;
  for (let i = worker.indexOf("{", at); i < worker.length; i++) {
    if (worker[i] === "{") depth++;
    else if (worker[i] === "}" && --depth === 0) { end = i; break; }
  }
  const site = worker.slice(at, end);
  // `name:` AND shorthand `name,` — both are a supplied dep. Matching only the
  // colon form made a correct change look like a missing dep: `lookupProject`
  // was hoisted to a real binding (it was being called as a bare identifier
  // inside this literal, which is a ReferenceError) and passed by shorthand,
  // and this went red on code that supplies it perfectly well.
  const supplied = new Set([
    ...[...site.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]),
    ...[...site.matchAll(/^\s*(\w+),\s*$/gm)].map((m) => m[1]),
  ]);

  const missing = [...read].filter((d) => !supplied.has(d));
  assert.deepEqual(missing, [], `site-provision reads deps worker.js never supplies: ${missing.join(", ")}`);
});

// The key is spelled in two files and they have to agree, or the build writes a
// row the reader never looks at. Exactly the shape of the original bug, one layer
// down: `saveDataInfo` could store `_meta.data_api_url` and every check above
// would still pass while every site stayed dead.
test("what provisioning WRITES is what the proxy READS", () => {
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  for (const key of ["auth_info", "data_api"]) {
    assert.match(worker, new RegExp(`VALUES \\('${key}',`), `nothing writes _meta.${key}`);
    assert.match(worker, new RegExp(`siteServiceBase\\(db, "${key}"\\)`), `nothing reads _meta.${key}`);
  }
});

// -------------------------------------------------- what the build trace sees

test("a WARM provision reports one step and a COLD one reports every call", async () => {
  // These were one number in the build trace, and they differ by tens of
  // seconds: a cold provision creates a Neon project, polls until it exists,
  // creates a database, polls again, then enables auth and the Data API. A warm
  // one is a single Supabase lookup. "Provisioning took 38 seconds" is only
  // actionable once you know which of the six calls it was.
  const warm = harness({ lookupSite: async () => ({ conn: "postgres://u:p@h/site_cafe", uid: "u1" }) });
  await run(warm.deps);
  assert.deepEqual(warm.calls.marks, ["reuse"], "a rebuild should not look like a fresh provision");

  const cold = harness({ lookupSite: async () => null, lookupProject: async () => null });
  await run(cold.deps);
  assert.deepEqual(cold.calls.marks, ["project", "database", "auth", "data_api", "record"]);
});

test("mark is OPTIONAL — provisioning must not require a tracer", async () => {
  // The whole point of injecting it is that a caller who does not want a trace
  // passes nothing. If that path throws, adding a measurement broke the build.
  const { deps } = harness({ lookupSite: async () => null, lookupProject: async () => null });
  delete deps.mark;
  assert.ok(await run(deps));
});

test("a mark that THROWS cannot fail a build", async () => {
  // A tracer is a diagnostic. A build that dies because its own logging threw is
  // the worst possible trade — the same reason every method of makeTrace
  // swallows, including (after a mutation caught it) its constructor.
  const { deps } = harness({ lookupSite: async () => null, lookupProject: async () => null });
  deps.mark = () => { throw new Error("tracer exploded"); };
  assert.ok(await run(deps));
});

test("the Data API is enabled for the same database auth was", async () => {
  // Now reachable at all, because the harness has the dep. It is FATAL by
  // design: with our own row routes gone this IS the site's backend, so a build
  // that could not enable it publishes a site whose every list is empty.
  const { deps, calls } = harness({ lookupSite: async () => null, lookupProject: async () => null });
  await run(deps, "cafe");
  assert.deepEqual(calls.enableData, [{ project: "p1", db: "site_cafe" }]);
  assert.equal(calls.enableAuth[0].db, calls.enableData[0].db, "auth and the Data API disagreed about the database");
});

test("a failed Data API enable FAILS the build and names its stage", async () => {
  const { deps } = harness({
    lookupSite: async () => null,
    lookupProject: async () => null,
    enableData: async () => { throw Object.assign(new Error("nope"), { status: 404, detail: "this route does not exist" }); },
  });
  // The exact shape of the 2026-08-04 outage: a wrong path answered 404 and the
  // failure could not name which of the two enable endpoints it was.
  await assert.rejects(run(deps), (e) => e.stage === "enable_data_api" && e.status === 404);
});
