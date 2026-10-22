// decide-3a (2026-10-22, audit A04-3, the owner's option A): an add-on whose
// database changes are held in the draft tries them first on a short-lived
// Neon branch, and its answer leaves out what the copy refused. No network:
// every Neon step and the schema apply are stand-ins.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rehearseHeldSchema, heldFromRehearsal, addonDryRunOn, connParts } from "../builder/addon-rehearse.mjs";
import { createRehearsalBranch, deleteRehearsalBranch, staleRehearsalBranches, REHEARSAL_STALE_MS } from "../site-db.mjs";

const CONN = "postgresql://site_owner:pw@ep-x.us-east-1.aws.neon.tech/neondb?sslmode=require";
const ENV = { NEON_API_KEY: "k", DRAFT_FIRST: "on" };
const SPEC = {
  tables: [{ name: "signups", columns: [{ name: "email", type: "text" }] }],
  functions: [{ name: "weekly_count", body: "select 1" }, { name: "good_fn", body: "select 2" }],
  jobs: [{ name: "count_weekly", fn: "weekly_count", everyMinutes: 10080 }, { name: "good_job", fn: "good_fn", everyMinutes: 60 }],
};
/** Today's held answer (worker.js `heldMade`), restated for the comparison. */
function heldMade(spec) {
  const made = (spec.tables || []).map((t) => t.name);
  made.functions = (spec.functions || []).map((f) => f.name.toLowerCase());
  made.held = true;
  return made;
}

function stubDeps({ apply, create, del, stale } = {}) {
  const calls = [];
  let t = 1000;
  const deps = {
    clock: () => (t += 250),
    project: async (_e, slug) => { calls.push(["project", slug]); return { neon_project: "proj-1", neon_branch: "br-main" }; },
    stale: stale || (async () => { calls.push(["stale"]); return []; }),
    create: create || (async (_e, p, parent) => { calls.push(["create", p, parent]); return { branchId: "br-rh" }; }),
    connFor: async (_e, p, b, db, role) => { calls.push(["conn", p, b, db, role]); return "postgresql://copy/" + db; },
    apply: apply || (async (conn) => { calls.push(["apply", conn]); const m = ["signups"]; m.functions = ["weekly_count", "good_fn"]; return m; }),
    del: del || (async (_e, p, b) => { calls.push(["del", p, b]); }),
  };
  return { deps, calls };
}
const refusesFn = async () => { const m = ["signups"]; m.functions = ["good_fn"]; m.functionErrors = [{ name: "weekly_count", error: "syntax error at or near \"selec\"" }]; return m; };

test("a function the copy refuses is left out by name, its job with it, and nothing claims it made", async () => {
  const { deps, calls } = stubDeps({ apply: refusesFn });
  const r = await rehearseHeldSchema({ env: ENV, slug: "s1", conn: CONN, spec: SPEC, deps });
  assert.equal(r.ran, true);
  assert.equal(r.deleted, true);
  assert.ok(Number.isFinite(r.ms) && r.ms > 0, "the round trip is not timed");
  assert.deepEqual(calls.find((c) => c[0] === "conn"), ["conn", "proj-1", "br-rh", "neondb", "site_owner"]);
  const { spec, made } = heldFromRehearsal(SPEC, heldMade(SPEC), r);
  assert.deepEqual(made.functions, ["good_fn"], "a refused function is still called made");
  assert.deepEqual(made.functionErrors.map((e) => e.name), ["weekly_count"]);
  assert.deepEqual(spec.functions.map((f) => f.name), ["good_fn"], "the refused function is still held");
  assert.deepEqual(spec.jobs.map((j) => j.name), ["good_job"], "a job on the refused function is still held");
  assert.deepEqual([...made], ["signups"]);
  assert.equal(made.held, true);
});

test("accepted changes are held whole, as today", async () => {
  const { deps } = stubDeps();
  const r = await rehearseHeldSchema({ env: ENV, slug: "s1", conn: CONN, spec: SPEC, deps });
  const { spec, made } = heldFromRehearsal(SPEC, heldMade(SPEC), r);
  assert.equal(spec, SPEC);
  assert.deepEqual(made.functions, ["weekly_count", "good_fn"]);
  assert.equal(made.functionErrors, undefined);
});

for (const [label, err] of [["a Postgres refusal", Object.assign(new Error("relation exists"), { code: "42P07" })], ["the copy unreachable", new Error("fetch failed")]]) {
  test("the temporary branch is deleted when the apply throws (" + label + ")", async () => {
    const { deps, calls } = stubDeps({ apply: async () => { throw err; } });
    const r = await rehearseHeldSchema({ env: ENV, slug: "s1", conn: CONN, spec: SPEC, deps });
    assert.deepEqual(calls.filter((c) => c[0] === "del"), [["del", "proj-1", "br-rh"]]);
    assert.equal(r.deleted, true);
    if (err.code) {
      assert.equal(r.refused.code, "42P07");
      assert.throws(() => heldFromRehearsal(SPEC, heldMade(SPEC), r), /refused/);
    } else {
      assert.equal(r.ran, false);
      assert.equal(r.why, "copy-unreachable");
      const kept = heldFromRehearsal(SPEC, heldMade(SPEC), r);
      assert.equal(kept.spec, SPEC);
    }
  });
}

test("a branch-create failure falls back to today's hold and does not fail the add-on; a half-made branch is deleted", async () => {
  for (const branchId of [undefined, "br-half"]) {
    const { deps, calls } = stubDeps({ create: async () => { throw Object.assign(new Error("neon api POST failed: 402"), branchId ? { branchId } : {}); } });
    const r = await rehearseHeldSchema({ env: ENV, slug: "s1", conn: CONN, spec: SPEC, deps });
    assert.equal(r.ran, false);
    assert.equal(r.why, "branch-create-failed");
    assert.ok(!calls.some((c) => c[0] === "apply"));
    if (branchId) assert.deepEqual(calls.filter((c) => c[0] === "del"), [["del", "proj-1", "br-half"]]);
    const held = heldMade(SPEC);
    const kept = heldFromRehearsal(SPEC, held, r);
    assert.equal(kept.spec, SPEC); assert.equal(kept.made, held);
  }
});

test("switch off, no key, no project: today's behaviour exactly, and no Neon call", async () => {
  const cases = [
    [{ ...ENV, ADDON_DRY_RUN: "off" }, "switched-off", null],
    [{ DRAFT_FIRST: "on" }, "no-neon-key", null],
    [ENV, "no-project", async () => null],
  ];
  for (const [env, why, project] of cases) {
    const { deps, calls } = stubDeps();
    if (project) deps.project = project;
    const r = await rehearseHeldSchema({ env, slug: "s1", conn: CONN, spec: SPEC, deps });
    assert.equal(r.why, why);
    assert.ok(!calls.some((c) => ["create", "apply", "del", "stale"].includes(c[0])), why + ": a Neon step ran");
    const held = heldMade(SPEC);
    const kept = heldFromRehearsal(SPEC, held, r);
    assert.equal(kept.spec, SPEC); assert.equal(kept.made, held);
  }
  assert.equal(addonDryRunOn({}), true);
  assert.equal(addonDryRunOn({ ADDON_DRY_RUN: " OFF " }), false);
  assert.deepEqual(connParts(CONN), { db: "neondb", role: "site_owner" });
});

test("an orphaned rehearsal branch is swept by the next rehearsal, bounded, never the default", async () => {
  const realFetch = globalThis.fetch;
  const seen = [];
  const now = 1_800_000_000_000;
  const old = now - REHEARSAL_STALE_MS - 1;
  globalThis.fetch = async (url, init) => {
    seen.push([(init && init.method) || "GET", String(url)]);
    return new Response(JSON.stringify({ branches: [
      { id: "b1", name: "rehearse-" + old }, { id: "b2", name: "rehearse-" + (now - 1000) },
      { id: "b3", name: "rehearse-" + old, default: true }, { id: "b4", name: "main" },
      { id: "b5", name: "rehearse-" + old }, { id: "b6", name: "rehearse-" + old }, { id: "b7", name: "rehearse-" + old },
    ] }), { status: 200 });
  };
  try {
    assert.deepEqual(await staleRehearsalBranches({ NEON_API_KEY: "k" }, "proj-1", now), ["b1", "b5", "b6"]);
    await deleteRehearsalBranch({ NEON_API_KEY: "k" }, "proj-1", "b1");
    assert.deepEqual(seen.at(-1), ["DELETE", "https://console.neon.tech/api/v2/projects/proj-1/branches/b1"]);
  } finally { globalThis.fetch = realFetch; }
});

test("createRehearsalBranch posts a named branch with its own compute off the site's branch", async () => {
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push([(init && init.method) || "GET", String(url), init && init.body]);
    if (String(url).endsWith("/branches")) return new Response(JSON.stringify({ branch: { id: "br-new" } }), { status: 201 });
    return new Response(JSON.stringify({ operations: [] }), { status: 200 });
  };
  try {
    assert.deepEqual(await createRehearsalBranch({ NEON_API_KEY: "k" }, "proj-1", "br-main", 1234567890123), { branchId: "br-new" });
    const body = JSON.parse(seen[0][2]);
    assert.deepEqual(body, { branch: { name: "rehearse-1234567890123", parent_id: "br-main" }, endpoints: [{ type: "read_write" }] });
  } finally { globalThis.fetch = realFetch; }
});

test("wiring: the held schema goes through the rehearsal before it is held, and only the add-on asks", () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = W.indexOf("async function backendWriter(env, slug, { rehearse = null } = {})");
  assert.ok(a > 0, "backendWriter's landmark is gone");
  const body = W.slice(a, W.indexOf("w.calls = {", a));
  const reh = body.indexOf("rehearseHeldSchema({ env, slug, conn, spec: schemaSpec, deps: REHEARSE_DEPS })");
  const kept = body.indexOf("heldFromRehearsal(schemaSpec, heldMade(schemaSpec), r)");
  const add = body.indexOf('hold.add({ kind: "schema", spec: kept.spec })');
  assert.ok(reh > 0 && kept > reh && add > kept, "the rehearsal does not precede the hold");
  assert.equal(W.split("{ rehearse: { mark:").length - 1, 1, "not exactly one caller asks for the rehearsal");
  assert.match(W, /const aWriter = await backendWriter\(env, ownerSlug, \{ rehearse: \{ mark: \(r\) => aMark\("dryrun"/);
  const J = readFileSync(new URL("../builder/edit-job.mjs", import.meta.url), "utf8");
  assert.match(J, /"ADDON_DRY_RUN"/);
  const D = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  assert.match(D, /ADDON_DRY_RUN: \$\{\{ secrets\.ADDON_DRY_RUN \|\| 'on' \}\}/);
});
