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
    saveProject: (u, p) => { calls.saveProject.push({ u, p }); return pick("saveProject")(u, p); },
    createDatabase: (p, s) => { calls.createDatabase.push(s); return pick("createDatabase")(p, s); },
    saveBackend: (s, u, db) => { calls.saveBackend.push({ s, u, db }); return pick("saveBackend")(s, u, db); },
    connFor: (conn, db) => conn.replace(/\/[^/]*$/, "/" + db),
    dbNameFor: (s) => "site_" + s.replace(/-/g, "_"),
  };
  return { deps, calls };
}

const run = (deps, slug = "cafe", uid = "u1") => ensureSiteBackend(deps, { slug, uid });

test("an existing site is reused, nothing is provisioned", async () => {
  const { deps, calls } = harness({ lookupSite: async () => "postgres://u:p@h/site_cafe" });
  assert.equal(await run(deps), "postgres://u:p@h/site_cafe");
  assert.equal(calls.createProject, 0);
  assert.deepEqual(calls.createDatabase, [], "a rebuild must not re-provision");
});

test("a user with a project gets only a new database", async () => {
  const { deps, calls } = harness();
  assert.equal(await run(deps), "postgres://u:p@h/site_cafe");
  assert.equal(calls.createProject, 0, "one Neon project per user, not per site");
  assert.deepEqual(calls.createDatabase, ["cafe"]);
  assert.deepEqual(calls.saveBackend, [{ s: "cafe", u: "u1", db: "site_cafe" }]);
});

test("a first-time user gets a project, recorded before anything else", async () => {
  const { deps, calls } = harness({ lookupProject: async () => null });
  await run(deps);
  assert.equal(calls.createProject, 1);
  assert.deepEqual(calls.saveProject[0].p, PROJ);
  assert.deepEqual(calls.dropProject, [], "a recorded project is not dropped");
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
