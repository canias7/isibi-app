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

// `uid` is on the fixture because it is on the ROW: site_project.uid is NOT NULL
// (measured against the live schema 2026-08-21). A project row is an ownership
// record and the module now reads it — a fixture without one would be a shape
// Supabase cannot produce, which is how a harness comes to be less capable than
// the thing it stands in for.
const PROJ = { uid: "u1", neon_project: "p1", neon_branch: "br-1", neon_role: "owner", neon_conn: "postgres://u:p@h/neondb" };

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
  // An old dep set — no missingServices — is exactly the pre-heal behaviour:
  // no enables, no heal mark. The heal is opt-in by supplying the reader.
  assert.equal(calls.enableAuth.length, 0);
  assert.equal(calls.enableData.length, 0);
  assert.ok(!calls.marks.includes("heal"));
});

// -------------------------------------------------- the reuse-path heal
//
// `auth_info` and `data_api` are written exactly once each, on the non-reuse
// path, best-effort — so one transient blip during a first build used to be a
// site whose every visitor read, form and sign-in answers 501 FOREVER: the
// reuse path called zero deps, no rebuild ever re-ran the enables, and the
// 501's own copy falsely promised a rebuild would fix it (2026-08-14 audit).

const REUSED = { conn: "postgres://u:p@h/site_cafe", uid: "u1" };

test("A REUSED SITE MISSING ITS ENDPOINTS IS HEALED — both enables run, both saves land", async () => {
  const { deps, calls } = harness({ lookupSite: async () => REUSED });
  const saved = { auth: [], data: [] };
  const d2 = {
    ...deps,
    missingServices: async (conn) => { assert.equal(conn, REUSED.conn, "the reader must be asked about THIS site"); return ["auth", "data"]; },
    enableAuth: async (p, db) => { calls.enableAuth.push({ project: p && p.neon_project, db }); return { enabled: true, already: true, info: { url: "https://a" } }; },
    enableData: async (p, db) => { calls.enableData.push({ project: p && p.neon_project, db }); return { enabled: true, already: true, info: { url: "https://d" } }; },
    saveAuthInfo: async (db, info) => saved.auth.push({ db, info }),
    saveDataInfo: async (db, info) => saved.data.push({ db, info }),
  };
  assert.equal(await ensureSiteBackend(d2, { slug: "cafe", uid: "u1" }), REUSED.conn, "the heal must not change what is returned");
  assert.deepEqual(calls.enableAuth, [{ project: "p1", db: "site_cafe" }]);
  assert.deepEqual(calls.enableData, [{ project: "p1", db: "site_cafe" }]);
  assert.deepEqual(saved.auth, [{ db: "site_cafe", info: { url: "https://a" } }]);
  assert.deepEqual(saved.data, [{ db: "site_cafe", info: { url: "https://d" } }]);
  assert.ok(calls.marks.includes("heal"), "a heal that happened must be visible in the trace");
});

test("only the missing half is healed", async () => {
  const { deps, calls } = harness({ lookupSite: async () => REUSED });
  const d2 = { ...deps, missingServices: async () => ["data"], saveAuthInfo: async () => { throw new Error("must not run"); }, saveDataInfo: async () => {} };
  await ensureSiteBackend(d2, { slug: "cafe", uid: "u1" });
  assert.equal(calls.enableAuth.length, 0, "auth was healthy and was healed anyway");
  assert.equal(calls.enableData.length, 1);
});

test("a healthy reused site does no extra work — one question, no project lookup", async () => {
  // The warm path is every revise of every healthy site; the heal must cost it
  // exactly one read of the site's own _meta and nothing else.
  const { deps, calls } = harness({ lookupSite: async () => REUSED });
  let asked = 0, projLookups = 0;
  const d2 = { ...deps, missingServices: async () => { asked++; return []; }, lookupProject: async () => { projLookups++; return PROJ; } };
  assert.equal(await ensureSiteBackend(d2, { slug: "cafe", uid: "u1" }), REUSED.conn);
  assert.equal(asked, 1);
  assert.equal(projLookups, 0, "a healthy site must not cost a project lookup per build");
  assert.equal(calls.enableAuth.length + calls.enableData.length, 0);
  assert.ok(!calls.marks.includes("heal"));
});

test("a reader that cannot tell heals nothing — a blip must not read as missing", async () => {
  const { deps, calls } = harness({ lookupSite: async () => REUSED });
  const d2 = { ...deps, missingServices: async () => { throw new Error("db blip"); } };
  assert.equal(await ensureSiteBackend(d2, { slug: "cafe", uid: "u1" }), REUSED.conn);
  assert.equal(calls.enableAuth.length + calls.enableData.length, 0);
});

test("a failing heal never fails the reuse — warned, and the next build retries", async () => {
  const warned = [];
  const { deps } = harness({ lookupSite: async () => REUSED });
  const d2 = { ...deps, warn: (m) => warned.push(m), missingServices: async () => ["auth"], enableAuth: async () => { throw new Error("neon down"); } };
  assert.equal(await ensureSiteBackend(d2, { slug: "cafe", uid: "u1" }), REUSED.conn,
    "a text edit that never needed the endpoint must not fail over the heal");
  assert.ok(warned.some((m) => /heal/.test(m)), "a swallowed heal failure is the original bug again");
});

test("an enable answering info:null saves nothing — no null overwrite", async () => {
  const { deps } = harness({ lookupSite: async () => REUSED });
  let saves = 0;
  const d2 = { ...deps, missingServices: async () => ["auth"], enableAuth: async () => ({ enabled: true, already: true, info: null }), saveAuthInfo: async () => { saves++; } };
  assert.equal(await ensureSiteBackend(d2, { slug: "cafe", uid: "u1" }), REUSED.conn);
  assert.equal(saves, 0, "a null endpoint must never be written over a stored one");
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
  // The four Neon fields, not the whole fixture: the owner is a separate
  // argument (the worker spreads both into one row), so comparing against a
  // fixture that also carries `uid` would be a test about the fixture.
  const { uid: _fixtureOwner, ...neonFields } = PROJ;
  assert.deepEqual(calls.saveProject[0].p, neonFields);
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
  // BOTH VERBS. The write became an atomic claim() when the slug race was
  // fixed (2026-08-13), and this guard was pinned to the verb rather than the
  // property — the property is that no connection string reaches a
  // client-readable table, however the row gets there.
  const writes = [...WORKER.matchAll(/(?:write|claim)\("site_backends",\s*\{([^}]*)\}/g)].map((m) => m[1]);
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
  // TO A LANDMARK, NOT A BYTE COUNT. This was `slice(i, i + 2600)` and stopped
  // covering the record deletion the moment anything was inserted between the
  // two — which is exactly what happened when the delete path grew a version
  // sweep. A window sized in bytes silently shrinks its own subject.
  const end = WORKER.indexOf("domainsReleased = 0;", i);
  assert.ok(end > i, "the end of the delete path moved — re-point this guard");
  const block = WORKER.slice(i, end);
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

// ─────────────────────────────────────────────────────────────────────────────
// THE SLUG RACE (2026-08-13 audit). Both slug-keyed writes used to be UPSERTS,
// so two overlapping first builds of one free name both "succeeded": the second
// saveProject overwrote the winner's connection row (the winner's live site
// then pointed at the loser's project), and the loser's project was orphaned
// with no teardown entry — the queue trigger is BEFORE DELETE, and an upsert
// UPDATE never fires it. The deps are atomic claims now: claimed:false means
// the row already existed, and the module decides what losing means at each of
// the two sites — CONVERGE at the project, REFUSE at the slug.

// The same owner's other build — two tabs, or a retry that overlapped. A racer
// from a DIFFERENT account is its own case further down: converging onto that
// project is the cross-account state the ownership check now refuses.
const WINNER = { uid: "u1", neon_project: "p-winner", neon_branch: "br-w", neon_role: "owner", neon_conn: "postgres://w:w@win/neondb" };

test("losing the PROJECT claim converges on the winner's project, orphaning nothing", async () => {
  let lookups = 0;
  const { deps, calls } = harness({
    // First lookup: nothing (we are first, we create). Second lookup, after the
    // lost claim: the winner's row is there.
    lookupProject: async () => (++lookups === 1 ? null : WINNER),
    saveProject: async () => ({ ok: true, claimed: false }),
  });
  const conn = await run(deps);
  // The loser's own project is destroyed — the orphan that billed forever.
  assert.deepEqual(calls.dropProject, ["p1"], "the losing racer's project was not cleaned up");
  // And the build CONTINUES on the winner's project rather than failing: the
  // database create is idempotent, so both racers land on one project and the
  // customer still gets a site.
  assert.equal(lookups, 2, "the winner's project was never read back");
  assert.match(conn, /@win\//, "the build did not continue on the winner's connection");
});

test("losing the project claim with no winner readable is a save_project failure", async () => {
  let lookups = 0;
  const { deps, calls } = harness({
    lookupProject: async () => (++lookups === 1 ? null : null),
    saveProject: async () => ({ ok: true, claimed: false }),
  });
  await assert.rejects(run(deps), (e) => e.stage === "save_project" && /could not be read back/.test(e.detail));
  assert.deepEqual(calls.dropProject, ["p1"], "the loser's project must still be destroyed on this path");
});

test("losing the SLUG claim is the same 409 as a name taken before the build", async () => {
  const { deps, calls } = harness({
    saveBackend: async () => ({ ok: true, claimed: false }),
  });
  // conflict:true is what the route maps to 409-with-refund; anything else here
  // and the loser's customer sees a 502 "provision failed" for a name problem.
  await assert.rejects(run(deps), (e) => e.conflict === true && /taken/.test(e.message));
  // Nothing is dropped on this path: the project is recorded and the claim
  // above converged both racers onto one project — it is the winner's now.
  assert.deepEqual(calls.dropProject, [], "refusing the slug must not destroy the shared project");
});

test("a dep that cannot say `claimed` behaves exactly as before", async () => {
  // Strictly === false. Every fake above this block returns bare {ok:true},
  // and every pre-existing test in this file passing IS the compat proof —
  // this one just states the contract where somebody will read it.
  const { deps } = harness({ saveProject: async () => ({ ok: true }), saveBackend: async () => ({ ok: true }) });
  await assert.doesNotReject(run(deps));
});

test("the worker's two slug-keyed writes are CLAIMS, not upserts", () => {
  // The module fix is nothing if the real deps still upsert — the wiring
  // layer, as always. Both must go through claim(), and claim() must send
  // ignore-duplicates with a representation to read the answer from.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /saveProject: \(s2, u, proj\) => claim\("site_project"/,
    "saveProject went back to the upserting write() — the slug race is silent again");
  assert.match(w, /saveBackend: \(s2, u, db\) => claim\("site_backends"/,
    "saveBackend went back to the upserting write()");
  const at = w.indexOf("const claim = async (table, body)");
  assert.ok(at > 0, "the claim helper is gone");
  const body = w.slice(at, at + 900);
  assert.match(body, /ignore-duplicates,return=representation/,
    "claim() no longer sends ignore-duplicates + representation — it cannot tell winning from losing");
  assert.match(body, /claimed: Array\.isArray\(rows\) && rows\.length > 0/,
    "claim() no longer derives `claimed` from the representation");
});

// ═════════════════════════════════════════════════════════════════════════════
// THE LEAK THE CLEANUP COULD NOT REACH, AND THE OWNERSHIP NOBODY READ
// (2026-08-21 audit). Both are about a Neon project: a capped, billed resource
// whose only record is a Supabase row.

test("A PROJECT CREATED BY A CREATE THAT THREW IS DESTROYED, not left behind", async () => {
  // Neon creates the project when the POST returns, and `createSiteProject` then
  // runs a response-shape guard and `waitForProject` — either can throw. The
  // record-it-or-destroy-it rule below was keyed on that call having RETURNED,
  // so this project had no row, no `neon_teardown` entry (the queue's trigger is
  // a row DELETE and no row was ever written) and nothing anywhere pointing at
  // it. The next build of the slug creates another.
  const { deps, calls } = harness({
    lookupProject: async () => null,
    createProject: async () => { throw Object.assign(new Error("neon operation setup failed"), { projectId: "p-leaked" }); },
  });
  const e = await run(deps).catch((x) => x);
  assert.match(String(e.message), /setup failed/, "the original diagnosis must survive — it is the useful part");
  assert.equal(e.stage, "create_project", "a failure here used to be reported as whatever ran before it");
  assert.deepEqual(calls.dropProject, ["p-leaked"], "the project Neon had already made was left billing forever");
  assert.deepEqual(calls.createDatabase, [], "and nothing may be built on top of a failed create");
});

test("a create that failed with nothing to drop makes no cleanup call", async () => {
  // A POST refused at the door creates nothing, and calling Neon to delete
  // `undefined` would be a second failure reported over the first.
  const { deps, calls } = harness({
    lookupProject: async () => null,
    createProject: async () => { throw Object.assign(new Error("neon api POST /projects failed: 422"), { status: 422 }); },
  });
  await assert.rejects(run(deps), /422/);
  assert.deepEqual(calls.dropProject, []);
});

test("ANOTHER ACCOUNT'S PROJECT IS NEVER BUILT INTO", async () => {
  // `lookupSite` decides ownership for site_backends and throws `conflict` when
  // the uid differs. `lookupProject` is the parallel slug-keyed lookup and had
  // no such check — so when site_project holds a row and site_backends does not
  // (which is what ANY failure between the two writes leaves behind), a
  // different account building that slug was handed the first account's project.
  // Measured 2026-08-21: B's database was created inside A's project and B's
  // returned connection string was A's host, role and PASSWORD. A deleting their
  // account cascades site_project, which enqueues that project for teardown and
  // destroys B's live site.
  const OTHERS = { uid: "account-A", neon_project: "p-A", neon_branch: "br-A", neon_role: "owner", neon_conn: "postgres://a:a@hostA/neondb" };
  const { deps, calls } = harness({ lookupSite: async () => null, lookupProject: async () => OTHERS });
  const e = await ensureSiteBackend(deps, { slug: "cafe", uid: "account-B" }).catch((x) => x);
  assert.equal(e.conflict, true, "the route must turn this into the 409 it gives any taken name");
  assert.deepEqual(calls.createDatabase, [], "a database was created inside another account's project");
  assert.deepEqual(calls.saveBackend, [], "and the slug was claimed on top of it");
  assert.equal(calls.createProject, 0, "nothing should be created on the way to refusing");
});

test("a project row read WITHOUT its owner is refused loudly, not adopted", async () => {
  // site_project.uid is NOT NULL (live schema, 2026-08-21), so a row can never
  // lack an owner — an absent KEY means the dep's SELECT did not ask for it,
  // i.e. our own wiring. Failing open there is the bug above and it is silent;
  // this fails closed, names the dep and the column, and is NOT a conflict —
  // telling a customer their name is taken would be a lie about our own mistake.
  const { deps, calls } = harness({
    lookupSite: async () => null,
    lookupProject: async () => ({ neon_project: "p1", neon_branch: "b", neon_role: "o", neon_conn: "postgres://u:p@h/neondb" }),
  });
  const e = await run(deps).catch((x) => x);
  assert.equal(e.stage, "project_owner");
  assert.ok(!e.conflict, "our wiring being wrong is not the customer's name being taken");
  assert.match(String(e.detail), /uid/, "the failure must name what is missing, or it is one more 502");
  assert.deepEqual(calls.createDatabase, []);
});

test("losing the project race to ANOTHER ACCOUNT refuses instead of converging", async () => {
  // The second door onto the same cross-account state, and the converge opened
  // it by design: the loser adopted the winner's project unconditionally, so two
  // different accounts racing one free slug put B's database inside A's project.
  let lookups = 0;
  const OTHERS = { uid: "account-A", neon_project: "p-A", neon_branch: "br-A", neon_role: "owner", neon_conn: "postgres://a:a@hostA/neondb" };
  const { deps, calls } = harness({
    lookupSite: async () => null,
    lookupProject: async () => (++lookups === 1 ? null : OTHERS),
    saveProject: async () => ({ ok: true, claimed: false }),
  });
  const e = await ensureSiteBackend(deps, { slug: "cafe", uid: "account-B" }).catch((x) => x);
  assert.equal(e.conflict, true);
  assert.deepEqual(calls.dropProject, ["p1"], "the loser's own project must still be destroyed — refusing must not orphan");
  assert.deepEqual(calls.createDatabase, [], "nothing may be created inside the winner's project");
});

// ────────────────────────────────── the caller's own row is not somebody else's

test("THE OWNER'S OWN ROW IS NOT 'TAKEN BY ANOTHER ACCOUNT'", async () => {
  // `claimed === false` says only that a row exists, and by that point the reuse
  // branch has established that any existing row is THIS uid's. The second cause
  // is the caller's own row, skipped at the top because `existing.conn` was null
  // — which `siteBackendRowFresh` answers whenever the site_project row cannot
  // be resolved, exactly what a half-failed delete leaves behind. Measured
  // 2026-08-21: the owner rebuilding their own slug was told the name belonged
  // to another account, every retry repeated it, and each attempt created and
  // recorded a brand-new billed Neon project no site would ever use.
  let reads = 0;
  const { deps, calls } = harness({
    lookupSite: async () => { reads++; return { conn: null, uid: "u1", brief: "" }; },
    lookupProject: async () => null,
    saveBackend: async () => ({ ok: true, claimed: false }),
  });
  const conn = await run(deps);
  assert.equal(conn, "postgres://u:p@h/site_cafe", "the owner's own site must heal, not 409 forever");
  assert.equal(reads, 2, "the winner was never asked about — the answer was inferred");
  assert.ok(calls.marks.includes("reclaim"), "re-adopting an existing row is not the same as recording a fresh one");
});

test("…but a genuine racer still gets the 409", async () => {
  // The property the claim was introduced for. Losing the slug to another
  // account must stay the same refusal, or this fix is the race silently back.
  let reads = 0;
  const { deps, calls } = harness({
    lookupSite: async () => (++reads === 1 ? null : { conn: "postgres://x:x@h/site_cafe", uid: "someone-else" }),
    saveBackend: async () => ({ ok: true, claimed: false }),
  });
  await assert.rejects(run(deps), (e) => e.conflict === true && e.stage === "save_backend");
  assert.deepEqual(calls.dropProject, [], "refusing the slug must not destroy the shared project");
});

test("a read-back that cannot answer refuses", async () => {
  // Fail-closed is the cheap direction: refusing costs the customer a retry,
  // while adopting a slug we cannot prove is ours writes a schema, seeds rows
  // and publishes over another account's site.
  for (const bad of [async () => { throw new Error("supabase down"); }, async () => null, async () => ({ conn: null, uid: null })]) {
    let reads = 0;
    const { deps } = harness({
      lookupSite: async (s) => (++reads === 1 ? null : bad(s)),
      saveBackend: async () => ({ ok: true, claimed: false }),
    });
    await assert.rejects(run(deps), (e) => e.conflict === true, "an unprovable slug was adopted");
  }
});

// ───────────────────────────────────── the one event this module exists to show

test("A CLEANUP THAT FAILED IS SAID OUT LOUD, at every site that drops one", async () => {
  // Both cleanups swallowed the rejection under a comment saying the caller
  // logged it — and the caller logs only the ATTEMPT, before making the call. So
  // a successful cleanup and a failed one emitted byte-identical output, and the
  // failed one is the single event this module exists to make visible: a billed
  // project we could not record and could not remove. Nothing else holds it —
  // `neon_teardown` is fired by a trigger on the row that was never written.
  const cases = {
    "the create threw": { lookupProject: async () => null, createProject: async () => { throw Object.assign(new Error("boom"), { projectId: "p-leaked" }); } },
    "the record failed": { lookupProject: async () => null, saveProject: async () => ({ ok: false }) },
    "the slug race was lost": { lookupProject: async () => null, saveProject: async () => ({ ok: true, claimed: false }) },
  };
  for (const [why, over] of Object.entries(cases)) {
    const warned = [];
    const { deps } = harness({ ...over, dropProject: async () => { throw new Error("neon 503"); } });
    deps.warn = (m) => warned.push(m);
    await run(deps).catch(() => {});
    assert.ok(warned.some((m) => /p-leaked|p1/.test(m) && /orphan/i.test(m)),
      why + ": a project we could not drop left no trace — " + JSON.stringify(warned));
  }
});

test("a cleanup that WORKED says nothing — the log means what it says", async () => {
  // The mirror. A warning on every successful cleanup is a warning nobody reads,
  // which is how the failed one goes unnoticed again.
  const warned = [];
  const { deps } = harness({ lookupProject: async () => null, saveProject: async () => ({ ok: false }) });
  deps.warn = (m) => warned.push(m);
  await run(deps).catch(() => {});
  assert.deepEqual(warned, []);
});

test("the project row is read WITH its owner, or the check above cannot work", () => {
  // The wiring layer, where this repo has recorded a dozen dead features. The
  // module refuses a row it cannot prove is ours; that refusal is a permanent
  // 502 on the retry path unless the SELECT actually fetches the column.
  const fn = WORKER.match(/async function siteNeonProject\(env, slug\)[\s\S]*?\n\}/);
  assert.ok(fn, "siteNeonProject was not found");
  const select = fn[0].match(/select=([^&`"'\s]+)/);
  assert.ok(select, "the select list was not found");
  assert.ok(select[1].split(",").includes("uid"),
    "site_project is read without its owner, so ensureSiteBackend cannot tell whose project it is: " + select[1]);
});
