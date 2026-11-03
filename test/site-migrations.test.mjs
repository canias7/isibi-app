// THE SCHEMA AFTER THE COMPILE, UNDER A MIGRATION RECORD (stage 8, 2026-09-05,
// owner: "keep going").
//
// An addition that touched the site's database applied its schema BEFORE the
// page call and the compile, and a publish that then failed kept the tables and
// said "your site is untouched": run 33 left `waiting_list` on fretwork-1 with
// no page showing it and no record saying which job made it. Now the apply is
// the last thing before the spine's publish gate (the page path, inside the
// seam, after the repair round's reserve and the reservation check) or the one
// thing on the pageless path, under a record at `source/<slug>/migrations.json`:
// `pending` before the first statement, `applied` once the page is live,
// `applied_without_page` when the publish after it failed, `failed` when the
// apply refused — which the seam answers as a refusal, before staging.
//
// DRIVEN where a drive can reach: the record module with literal shapes and
// the engine's own report names, the spec union, the owner's route through the
// real router against a fake bucket, and the reconcile settling a pending
// record through the real module. READ where it cannot — the addon route has
// no driven harness — anchored on ORDER and ABSENCE, with the comments blanked.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hit, loadWorkerModule } from "./fixtures/worker-harness.mjs";
import {
  MIGRATIONS_KEY, MAX_MIGRATIONS, MIGRATION_STATES, readMigrations, newMigration, withApplied,
  upsertMigration, markMigration, pendingMigration, jobMigration, reconciledMigration, migrationNote, migrationSummary,
} from "../builder/site-migrations.mjs";
import { unionSpec } from "../builder/site-add.mjs";
import { allowedJobKey } from "../builder/job-gateway.mjs";
import { POINTER_KEY, buildPrefix, MANIFEST_FILE, SERVER_FILE } from "../site-builds.mjs";
import { versionId } from "../site-versions.mjs";

const RAW = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const MIG = fs.readFileSync(new URL("../builder/site-migrations.mjs", import.meta.url), "utf8");
const ENGINE = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
const DOCKER = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");

/** JS comments blanked, length preserved and string-aware — the recorded "prose contains the thing it forbids" trap. */
function blankJs(src) {
  let out = ""; let i = 0; let inBlock = false; let quote = "";
  while (i < src.length) {
    const c = src[i]; const nx = src[i + 1];
    if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
    if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    out += c; i++;
  }
  return out;
}
const W = blankJs(RAW);
assert.equal(W.length, RAW.length, "the blanker changed worker.js's length");

/** Index of a landmark that MUST exist — `indexOf` answering -1 gives `slice(-1, -1)`, which passes everything inside it. */
const at = (src, needle, what, from = 0) => { const i = src.indexOf(needle, from); assert.ok(i >= 0, "landmark missing: " + (what || needle)); return i; };
/** The text between two landmarks, both required. */
const between = (src, a, b, what) => { const i = at(src, a, what + " (start)"); const j = at(src, b, what + " (end)", i + a.length); return src.slice(i, j); };
/** The body of the block whose opening brace is the first `{` at or after `from`, by brace depth. */
function blockFrom(src, from) {
  const open = src.indexOf("{", from);
  assert.ok(open >= 0, "no block opens after " + from);
  let d = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (d === 0) return src.slice(open, k + 1); }
  }
  assert.fail("the block never closes");
}

const ID = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const ID0 = "00b2c3d4e5f60718293a4b5c6d7e8f90";
const USER = { id: "11111111-2222-4333-8444-555555555555", email: "owner@example.test" };
const ENV_KEYS = { SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test" };
const SLUG = "mig-lane";
const V1 = versionId(1000, "aaaaaa");
const V2 = versionId(2000, "bbbbbb");

// ── THE RECORD MODULE, DRIVEN ────────────────────────────────────────────────

test("the key is the site's own source object, under the gateway wall for that site and refused for another", () => {
  assert.equal(MIGRATIONS_KEY("Fold-Lane"), "source/fold-lane/migrations.json");
  assert.equal(allowedJobKey("fold-lane", ID, MIGRATIONS_KEY("fold-lane")), true, "the container's runner could not write the record");
  assert.equal(allowedJobKey("other-site", ID, MIGRATIONS_KEY("fold-lane")), false, "another site's runner could write this site's record");
  // `discarded` (2026-10-16): a schema held under draft-first whose save failed — nothing applied.
  assert.deepEqual(MIGRATION_STATES, ["pending", "applied", "applied_without_page", "failed", "discarded"]);
  assert.ok(MAX_MIGRATIONS >= 20 && MAX_MIGRATIONS <= 200, "the cap is not a bounded log");
});

test("readMigrations tolerates anything that is not a list of records: junk, a bare object, records with no job", () => {
  assert.deepEqual(readMigrations(null), []);
  assert.deepEqual(readMigrations("not json"), []);
  assert.deepEqual(readMigrations("{}"), []);
  assert.deepEqual(readMigrations(JSON.stringify([{ job: ID }, { nope: 1 }, "x", null, { job: 7 }])), [{ job: ID }]);
  assert.deepEqual(readMigrations(JSON.stringify({ at: "t", migrations: [{ job: ID0 }] })), [{ job: ID0 }]);
  assert.deepEqual(readMigrations([{ job: ID }]), [{ job: ID }], "an already-parsed list is not read");
});

test("newMigration: pending, the names lowercased and bounded, the altered tables as names, the version only when it is a string, provisioned only when true", () => {
  const m = newMigration({ job: ID, slug: "Mig-Lane", at: "2026-09-05T00:00:00.000Z", version: V2, added: ["Gear", { name: "Waiting_List" }], altered: ["bookings"], functions: [{ name: "bookings_on_day" }], apis: [{ name: "gbp_eur" }], jobs: [{ name: "remind_tomorrow" }], provisioned: true });
  assert.deepEqual(m, {
    job: ID, slug: "mig-lane", at: "2026-09-05T00:00:00.000Z", version: V2, status: "pending", provisioned: true,
    tables: { added: ["gear", "waiting_list"], altered: ["bookings"], applied: [], refused: [] },
    functions: { designed: ["bookings_on_day"], made: [], errors: [] },
    apis: ["gbp_eur"], jobs: ["remind_tomorrow"], seeded: null, publish: null,
  });
  const bare = newMigration({ job: ID, slug: SLUG, version: 42, provisioned: "yes" });
  assert.equal(bare.version, null, "a version that is not a string is kept");
  assert.equal(bare.provisioned, false, "provisioned is not a boolean");
  assert.match(bare.at, /^\d{4}-\d{2}-\d{2}T/, "the time is not ISO");
  assert.equal(newMigration({ job: ID, slug: SLUG, added: Array.from({ length: 60 }, (_, i) => "t" + i) }).tables.added.length, 40, "the names are unbounded");
});

test("withApplied reads the engine's report by the names the engine writes — derived from site-schema.mjs, so a new report field is folded or named here", () => {
  // THE PRODUCER'S NAMES: every `made.<name> =` the engine writes. The grants
  // are the one deliberate omission — which member table may read which is a
  // fact about access, not about what this addition made.
  const written = [...new Set([...ENGINE.matchAll(/\bmade\.(\w+)\s*=/g)].map((x) => x[1]))];
  assert.ok(written.length >= 3, "the engine no longer reports on `made` — rescope this guard: " + written.join(","));
  const OMITTED = ["authGrants"];
  const fold = between(MIG, "export function withApplied(", "export function upsertMigration(", "withApplied");
  for (const name of written) {
    if (OMITTED.includes(name)) continue;
    assert.match(fold, new RegExp("made\\." + name + "\\b"), "the record does not fold the engine's `made." + name + "`");
  }
  // DRIVEN with a report shaped as the engine answers: an array of table names
  // carrying its properties.
  const made = Object.assign(["Gear", "waiting_list"], {
    functions: ["bookings_on_day"],
    functionErrors: [{ name: "broken_fn", error: "x".repeat(400) }],
    refusedRules: [{ table: "gear", feature: "unique", rule: "unique(sku)", why: "already has rows that repeat" }],
    authGrants: [{ table: "gear", grant: "read" }],
  });
  const entry = newMigration({ job: ID, slug: SLUG, added: ["gear", "waiting_list"], functions: ["bookings_on_day", "broken_fn"] });
  const out = withApplied(entry, made, { seeded: { seeded: { gear: 3 }, skipped: [] } });
  assert.deepEqual(out.tables.applied, ["gear", "waiting_list"]);
  assert.deepEqual(out.tables.refused, [{ table: "gear", feature: "unique", rule: "unique(sku)", why: "already has rows that repeat" }]);
  assert.deepEqual(out.functions, { designed: ["bookings_on_day", "broken_fn"], made: ["bookings_on_day"], errors: [{ name: "broken_fn", error: "x".repeat(160) }] });
  assert.deepEqual(out.seeded, { seeded: { gear: 3 }, skipped: [] });
  assert.equal(out.status, "pending", "folding the report moved the state — the page has not come yet");
  assert.equal("authGrants" in out, false);
  // A report with nothing on it, and a seed that is not an object, leave the record honest.
  const none = withApplied(entry, null);
  assert.deepEqual([none.tables.applied, none.tables.refused, none.functions.made, none.functions.errors, none.seeded], [[], [], [], [], null]);
  assert.equal(withApplied({ ...entry, seeded: { kept: true } }, [], { seeded: "no" }).seeded.kept, true, "a non-object seed report overwrote the record's");
});

test("upsertMigration puts the record in front, replaces its job's earlier record, and cuts to the cap", () => {
  const a = newMigration({ job: ID, slug: SLUG });
  const b = newMigration({ job: ID0, slug: SLUG });
  const one = upsertMigration([], a);
  assert.deepEqual(one.map((m) => m.job), [ID]);
  const two = upsertMigration(one, b);
  assert.deepEqual(two.map((m) => m.job), [ID0, ID], "the newest is not in front");
  const again = upsertMigration(two, { ...a, status: "applied" });
  assert.deepEqual(again.map((m) => [m.job, m.status]), [[ID, "applied"], [ID0, "pending"]], "the same job's record was duplicated rather than replaced");
  let list = [];
  for (let i = 0; i < MAX_MIGRATIONS + 5; i++) list = upsertMigration(list, newMigration({ job: "j" + i, slug: SLUG }));
  assert.equal(list.length, MAX_MIGRATIONS, "the list is unbounded");
  assert.equal(list[0].job, "j" + (MAX_MIGRATIONS + 4), "the cap cut the newest");
  assert.deepEqual(upsertMigration("junk", a).map((m) => m.job), [ID], "a junk store is not read as empty");
});

test("markMigration refuses a word that is not a state, answers null for a job with no record, and moves one record with the patch and a settled time; pendingMigration finds only a pending one", () => {
  assert.throws(() => markMigration([], ID, "done"), /not a migration state/);
  const none = markMigration([newMigration({ job: ID0, slug: SLUG })], ID, "applied");
  assert.equal(none.entry, null);
  assert.deepEqual(none.list.map((m) => m.job), [ID0], "a missing job changed the list");
  const list = [newMigration({ job: ID, slug: SLUG }), newMigration({ job: ID0, slug: SLUG })];
  const moved = markMigration(list, ID, "applied_without_page", { publish: { ok: false, error: "not-granted" } });
  assert.equal(moved.entry.status, "applied_without_page");
  assert.deepEqual(moved.entry.publish, { ok: false, error: "not-granted" });
  assert.match(moved.entry.settledAt, /^\d{4}-/);
  assert.equal(moved.list[1].status, "pending", "the other job's record moved");
  assert.equal(list[0].status, "pending", "the input list was mutated");
  assert.equal(pendingMigration(moved.list, ID), null, "a settled record reads as pending");
  assert.equal(pendingMigration(moved.list, ID0).job, ID0);
  assert.equal(pendingMigration("junk", ID0), null);
});

test("migrationNote speaks only for a record whose page never came, naming what stands; migrationSummary is the reply's shape", () => {
  const base = withApplied(newMigration({ job: ID, slug: SLUG, added: ["gear"], functions: ["bookings_on_day"], jobs: ["remind_tomorrow"] }),
    Object.assign(["gear"], { functions: ["bookings_on_day"] }));
  assert.equal(migrationNote(base), "", "a pending record has a sentence");
  assert.equal(migrationNote({ ...base, status: "applied" }), "", "an applied record has a sentence");
  assert.equal(migrationNote({ ...base, status: "failed" }), "", "a failed apply claims the changes were made");
  const note = migrationNote({ ...base, status: "applied_without_page" });
  assert.match(note, /^The database changes for this were made — now storing gear, the function bookings_on_day, the scheduled job remind_tomorrow — but the page didn't publish, so the site is showing what it showed before\. Ask again and I'll add the page without making the tables twice\.$/);
  assert.equal(migrationNote({ ...newMigration({ job: ID, slug: SLUG }), status: "applied_without_page" }),
    "The database changes for this were made but the page didn't publish, so the site is showing what it showed before. Ask again and I'll add the page without making the tables twice.");
  assert.equal(migrationNote(null), "");
  assert.equal(migrationSummary(null), undefined);
  assert.deepEqual(migrationSummary({ ...base, status: "applied", version: V2 }), {
    job: ID, status: "applied", version: V2, tables: ["gear"], refused: [], functions: ["bookings_on_day"], functionErrors: [], apis: [], jobs: ["remind_tomorrow"],
  });
});

test("unionSpec: the merged tables whole, the merged functions first and the stored ones they do not name after, the rest of the stored spec kept", () => {
  const stored = { tables: [{ name: "bookings" }], functions: [{ name: "old_fn", internal: true }, { name: "Shared" }], apis: [{ name: "rates" }], jobs: [], version: 3 };
  const merged = { tables: [{ name: "bookings" }, { name: "gear" }], functions: [{ name: "shared", sql: "new" }, { name: "new_fn" }], jobs: [{ name: "nightly" }] };
  const u = unionSpec(stored, merged);
  assert.deepEqual(u.tables.map((t) => t.name), ["bookings", "gear"], "the tables are not the merged set");
  assert.deepEqual(u.functions.map((f) => f.name), ["shared", "new_fn", "old_fn"], "the merged functions do not come first, or the stored ones they do not name are dropped");
  assert.equal(u.functions[0].sql, "new", "the stored copy of a re-declared function won");
  // The prebuilt jobs and connections went on 2026-10-29: a merge's are not
  // carried, and the stored spec's rest (old sites' entries included) is kept as it was.
  assert.deepEqual(u.apis.map((a) => a.name), ["rates"], "the rest of the stored spec lost an entry");
  assert.deepEqual(u.jobs, [], "a merge's jobs were carried");
  assert.equal(u.version, 3, "the rest of the stored spec was dropped");
  assert.deepEqual(unionSpec(null, null), { tables: [], functions: [] });
  assert.deepEqual(unionSpec({ tables: [{ name: "a" }] }, {}).tables.map((t) => t.name), ["a"], "a merge with no tables lost the stored ones");
});

// ── THE SEAM, READ ───────────────────────────────────────────────────────────

test("the seam hands the hook the version and reads a refusal — after the hook's own catch, before the build is replaced, still after the compile verdict and the dead-css refusal, before the third reservation ask, the staging and the gate", () => {
  const spine = between(W, "async function recompileAndPublish(", "\nasync function ", "the spine");
  const seam = between(spine, 'tm("seam", "start");', 'tm("seam", "ok", { replaced });', "the seam");
  const call = between(seam, "seamOut = await afterCompile({", "});", "the hook call");
  for (const needle of ["built, pages, langs: siteLangs, job,", "version,", "recompile: async (list) => { files = filesFor(list); return compile(); },"]) {
    assert.ok(call.includes(needle), "the hook is not handed: " + needle);
  }
  const caught = at(seam, "seamOut = null;", "the catch's reset");
  const refuse = at(seam, "if (seamOut && typeof seamOut === \"object\" && seamOut.refuse && typeof seamOut.refuse === \"object\" && seamOut.refuse.error) {", "the refusal read");
  const replaced = at(seam, "const replaced = !!(seamOut && seamOut.built", "the replacement");
  assert.ok(caught < refuse && refuse < replaced, "the refusal is not read after the catch and before the build is replaced");
  const refusal = seam.slice(refuse, replaced);
  assert.match(refusal, /return \{ ok: false, error: String\(seamOut\.refuse\.error\), ours: seamOut\.refuse\.ours !== false, detail: String\(seamOut\.refuse\.detail \|\| ""\)\.slice\(0, 200\) \};/,
    "a refusal is not answered as the spine's own failure, ours unless the hook says otherwise, the detail clipped");
  assert.match(refusal, /tm\("seam", "refused"/, "a refusal leaves no mark");
  // READ ONCE, AND NEVER AFTER THE SWAP. A refusal read after `replaced` would
  // refuse a publish whose build the hook already replaced — and a second,
  // looser read (`seamOut.refuse` without its `error`) would turn a malformed
  // answer into a refusal the first read rightly ignored. The sweep's W28
  // added exactly that line and survived the order checks above, which see
  // only the first read.
  assert.equal((seam.slice(replaced).match(/seamOut\.refuse/g) || []).length, 0, "the refusal is read again after the build is replaced");
  // The CONDITION's own spelling, counted — the return line names
  // `seamOut.refuse.error` too, so the field is not the thing to count.
  assert.equal((seam.match(/&& seamOut\.refuse &&/g) || []).length, 1, "the refusal is asked more than once");
  // ORDER IN THE SPINE: the compile verdict and the dead-css refusal come
  // first, then the seam, then the third ask, the staging and the gate.
  const deadCss = at(spine, 'error: "dead-css"', "the dead-css refusal");
  const seamAt = at(spine, 'tm("seam", "start");', "the seam");
  const thirdAsk = at(spine, "{ const u = unbilled(); if (u) return u; }", "the third ask", seamAt);
  const stage = at(spine, "staged = await stageBuild(", "the staging");
  const gate = at(spine, 'editRpc(env, "edit_may_publish"', "the gate");
  assert.ok(deadCss < seamAt && seamAt < thirdAsk && thirdAsk < stage && stage < gate, "the seam is not between the dead-css refusal and the third ask, the staging and the gate");
  assert.equal((spine.slice(0, seamAt).match(/stageBuild\(/g) || []).length, 0, "something is staged before the seam");
});

// ── THE ADDON ROUTE, READ ────────────────────────────────────────────────────

const route = () => between(W, "const aBackend = backendDesigned(aDesigned);", "\n          if (tx) {", "the addon route from its backend block");

test("THE RECORD A VERDICT SETTLES (2026-10-07): live — applied, correcting a record the route's failure answer had marked without its page; not live — without its page only where the engine reported what it applied, failed where the apply never reported; another state is left as it was", () => {
  const pending = newMigration({ job: ID, slug: SLUG, added: ["gear"] });
  const reported = withApplied(pending, ["gear"]);
  assert.equal(reconciledMigration(reported, true), "applied");
  assert.equal(reconciledMigration(pending, true), "applied");
  assert.equal(reconciledMigration({ ...reported, status: "applied_without_page" }, true), "applied", "a live page's record stayed without its page");
  assert.equal(reconciledMigration(reported, false), "applied_without_page");
  assert.equal(reconciledMigration(pending, false), "failed", "a table was claimed with no report of it from the engine");
  for (const status of ["applied", "failed"]) {
    assert.equal(reconciledMigration({ ...reported, status }, true), null);
    assert.equal(reconciledMigration({ ...reported, status }, false), null);
  }
  assert.equal(reconciledMigration({ ...reported, status: "applied_without_page" }, false), null);
  assert.equal(reconciledMigration(null, true), null);
  assert.deepEqual(jobMigration([reported, { ...pending, job: ID0, status: "applied" }], ID0).status, "applied");
  assert.equal(jobMigration([reported], "nope"), null);
});

test("the owner's route is read-only and gated as the answer route is; the image carries the module", () => {
  const r = between(W, 'if (url.pathname === "/api/site/migrations" && request.method === "GET") {', "\n    }\n", "the migrations route");
  assert.ok(at(r, "const mu = await authUser(request);") < at(r, "const mown = await siteOwnerBySlug(mslug, env);"), "the route reads the owner before the caller");
  assert.match(r, /if \(!mown \|\| mown !== mu\.id\) return Response\.json\(\{ ok: false, error: "not found" \}, \{ status: 404 \}\);/, "a stranger is not refused as not-found");
  assert.match(r, /return Response\.json\(\{ ok: true, slug: mslug, migrations: await readSiteMigrations\(env, mslug\) \}\);/);
  assert.ok(!/SITES_BUCKET\.put|settleSiteMigration|recordSiteMigration/.test(r), "the route writes");
  assert.match(DOCKER, /builder\/site-migrations\.mjs/, "the image does not carry the module — the runner's import would die at startup");
});

// ── DRIVEN: THE ROUTE AND THE RECONCILE ──────────────────────────────────────

/** A bucket that lists by prefix, honours onlyIf, and remembers writes. */
function bucket(entries = {}) {
  const store = new Map(Object.entries(entries));
  const puts = [];
  return {
    store, puts,
    async get(k) { return store.has(k) ? { key: k, etag: "e-" + k, httpMetadata: {}, async text() { return store.get(k); }, async json() { return JSON.parse(store.get(k)); } } : null; },
    async put(k, v, opts) { if (opts && opts.onlyIf && opts.onlyIf.etagMatches && opts.onlyIf.etagMatches !== "e-" + k) return null; puts.push(k); store.set(k, typeof v === "string" ? v : String(v)); return { key: k, etag: "e-" + k }; },
    async delete(k) { store.delete(k); },
    async head(k) { return store.has(k) ? { key: k, size: 1 } : null; },
    async list({ prefix = "" } = {}) { return { objects: [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, size: 1 })), truncated: false }; },
  };
}
/** A site laid out as staged builds under a pointer — the shape stage 7 writes. */
function site({ slug = SLUG, pointer = null, builds = [], extra = {} } = {}) {
  const entries = { ...extra };
  for (const b of builds) {
    entries[buildPrefix(slug, b.id) + MANIFEST_FILE] = JSON.stringify({ version: b.id, kind: "build", build: b.build || "", parent: b.parent || "", job: b.job || null, files: ["index.js"], worker: true, at: 1, label: "Build" });
    entries[buildPrefix(slug, b.id) + "client/index.js"] = "// js";
    entries[buildPrefix(slug, b.id) + SERVER_FILE] = "export default {}; // " + b.id;
  }
  if (pointer) entries[POINTER_KEY(slug)] = JSON.stringify({ version: pointer.version, build: pointer.build || "", parent: pointer.parent || "", job: pointer.job || null, activatedAt: "2026-09-05T00:00:00Z" });
  return bucket(entries);
}
/** A dispatch namespace whose one script answers the given stamps. */
const namespace = (now) => ({ get() { return { async fetch() { return new Response("", { status: 404, headers: { "x-site-build": now.build, "x-site-version": now.version } }); } }; } });
/** Stub every fetch the Worker makes: GoTrue, the RPCs by name, the owner lookup. */
function stubFetch({ rpcAnswers = {}, owner = USER.id } = {}, log = []) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json(USER);
    const m = u.match(/\/rest\/v1\/rpc\/(edit_\w+|rebuild_claim|credit_reverse|deploy_gate_\w+)/);
    if (m) {
      let args = {};
      try { args = JSON.parse(String(init && init.body) || "{}"); } catch { args = {}; }
      log.push({ fn: m[1], args });
      const a = rpcAnswers[m[1]];
      if (a === undefined) return json({ ok: false, error: "no stub for " + m[1] }, 500);
      return json(typeof a === "function" ? a(args) : a);
    }
    if (u.includes("/rest/v1/site_backends?")) return json(owner ? [{ uid: owner }] : []);
    if (u.includes("/rest/v1/")) return json([]);
    return new Response("unavailable", { status: 503 });
  };
  return () => { globalThis.fetch = real; };
}
const row = (over = {}) => ({
  id: ID, uid: USER.id, slug: SLUG, op: "addon", state: "failed", phase: "publishing", cost: 12, billing: "reserved",
  needs_review: true, review_note: "edit did not ship", artifact_build: "", worker_status: null,
  publish_started_at: "2026-09-05T00:00:00Z", published_at: null, result: null, updated_at: "2026-09-05T00:00:01Z", ...over,
});
const RPC_OK = {
  edit_reconcile: (a) => ({ ok: true, outcome: a.p_committed ? "kept" : "refunded", refunded: a.p_committed ? 0 : 12 }),
  edit_finalize: { ok: true },
};
const pendingFor = (job, version = null) => withApplied(newMigration({ job, slug: SLUG, version, added: ["gear"] }), ["gear"]);

test("DRIVEN — the owner's route: signed out is 401, no slug is 400, a stranger's site is 404, the owner reads the record newest first, a site with no record reads empty, junk reads empty", async () => {
  const stored = [pendingFor(ID, V2), { ...pendingFor(ID0, V1), status: "applied" }];
  const b = bucket({ [MIGRATIONS_KEY(SLUG)]: JSON.stringify({ at: "t", slug: SLUG, migrations: stored }) });
  const env = { ...ENV_KEYS, SITES_BUCKET: b };
  const auth = { authorization: "Bearer t" };
  let restore = stubFetch({});
  try {
    assert.equal((await hit("/api/site/migrations?slug=" + SLUG, { env })).status, 401);
    assert.equal((await hit("/api/site/migrations", { env, headers: auth })).status, 400);
    const got = await hit("/api/site/migrations?slug=" + SLUG, { env, headers: auth });
    assert.equal(got.status, 200, got.text);
    assert.deepEqual(got.json.migrations.map((m) => [m.job, m.status, m.version]), [[ID, "pending", V2], [ID0, "applied", V1]]);
    assert.deepEqual(got.json.migrations[0].tables.applied, ["gear"]);
    assert.equal(b.puts.length, 0, "a read wrote");
    const none = await hit("/api/site/migrations?slug=mig-lane-empty", { env, headers: auth });
    assert.deepEqual([none.status, none.json.migrations], [200, []]);
    b.store.set(MIGRATIONS_KEY("mig-lane-junk"), "{not json");
    const junk = await hit("/api/site/migrations?slug=mig-lane-junk", { env, headers: auth });
    assert.deepEqual([junk.status, junk.json.migrations], [200, []]);
  } finally { restore(); }
  // ITS OWN SLUG: the owner lookup memoizes per slug for five minutes.
  restore = stubFetch({ owner: "33333333-2222-4333-8444-555555555555" });
  try { assert.equal((await hit("/api/site/migrations?slug=mig-lane-stranger", { env, headers: auth })).status, 404); } finally { restore(); }
});

test("DRIVEN — the reconcile settles a pending record by its verdict: kept marks it applied with the job's own version, refunded marks it applied_without_page, another job's record and a settled one are left alone", async () => {
  const mod = await loadWorkerModule();
  const builds = [{ id: V1, parent: "", job: ID0, build: "b1" }, { id: V2, parent: V1, job: ID, build: "b2" }];
  const stored = [pendingFor(ID), { ...pendingFor(ID0, V1), status: "applied" }, pendingFor("bbbbc3d4e5f60718293a4b5c6d7e8f90")];
  // KEPT: the live script is ours.
  {
    const b = site({ pointer: { version: V2, build: "b2", parent: V1, job: ID }, builds, extra: { [MIGRATIONS_KEY(SLUG)]: JSON.stringify(stored) } });
    const rpc = [];
    const restore = stubFetch({ rpcAnswers: RPC_OK }, rpc);
    try {
      const out = await mod.reconcileEditJob({ ...ENV_KEYS, SITES_BUCKET: b, SITE_WORKERS: namespace({ build: "b2", version: V2 }) }, ID, row());
      assert.deepEqual([out.verdict, out.applied], ["kept", true]);
      const after = readMigrations(b.store.get(MIGRATIONS_KEY(SLUG)));
      const mine = after.find((m) => m.job === ID);
      assert.deepEqual([mine.status, mine.version, mine.publish], ["applied", V2, { ok: true, reconciled: "landed" }]);
      assert.match(mine.settledAt, /^\d{4}-/);
      assert.deepEqual(after.filter((m) => m.job !== ID).map((m) => [m.job, m.status]), [[ID0, "applied"], ["bbbbc3d4e5f60718293a4b5c6d7e8f90", "pending"]], "another job's record moved");
      assert.deepEqual(rpc.map((x) => x.fn), ["edit_reconcile", "edit_finalize"], "the record moved the money");
    } finally { restore(); }
  }
  // REFUNDED, WITH NO REPORT FROM THE ENGINE ON THE RECORD: the apply is not
  // known to have run, so the record fails rather than claim a table.
  {
    const unreported = [newMigration({ job: ID, slug: SLUG, added: ["gear"] })];
    const b = site({ pointer: null, builds, extra: { [MIGRATIONS_KEY(SLUG)]: JSON.stringify(unreported) } });
    const restore = stubFetch({ rpcAnswers: RPC_OK });
    try {
      await mod.reconcileEditJob({ ...ENV_KEYS, SITES_BUCKET: b, SITE_WORKERS: namespace({ build: "b1", version: V1 }) }, ID, row());
      const mine = readMigrations(b.store.get(MIGRATIONS_KEY(SLUG))).find((m) => m.job === ID);
      assert.equal(mine.status, "failed", "a table was claimed with no report of it from the engine");
    } finally { restore(); }
  }
  // REFUNDED: the site has no pointer, so this version was never activated.
  {
    const b = site({ pointer: null, builds, extra: { [MIGRATIONS_KEY(SLUG)]: JSON.stringify(stored) } });
    const restore = stubFetch({ rpcAnswers: RPC_OK });
    try {
      const out = await mod.reconcileEditJob({ ...ENV_KEYS, SITES_BUCKET: b, SITE_WORKERS: namespace({ build: "b1", version: V1 }) }, ID, row());
      assert.deepEqual([out.verdict, out.kind], ["refunded", "never-activated"]);
      const mine = readMigrations(b.store.get(MIGRATIONS_KEY(SLUG))).find((m) => m.job === ID);
      assert.deepEqual([mine.status, mine.version, mine.publish], ["applied_without_page", V2, { ok: false, reconciled: "never-activated" }]);
    } finally { restore(); }
  }
  // A RECORD THE ROUTE'S FAILURE MARKED WITHOUT ITS PAGE IS CORRECTED WHEN
  // THE VERDICT FINDS THE PAGE LIVE (2026-10-07); one already applied is left
  // alone, and a site with no record writes none.
  {
    const settled = [{ ...pendingFor(ID, V2), status: "applied_without_page", settledAt: "earlier" }];
    const b = site({ pointer: { version: V2, build: "b2", parent: V1, job: ID }, builds, extra: { [MIGRATIONS_KEY(SLUG)]: JSON.stringify(settled) } });
    const restore = stubFetch({ rpcAnswers: RPC_OK });
    try {
      const out = await mod.reconcileEditJob({ ...ENV_KEYS, SITES_BUCKET: b, SITE_WORKERS: namespace({ build: "b2", version: V2 }) }, ID, row());
      assert.equal(out.verdict, "kept");
      const fixed = readMigrations(b.store.get(MIGRATIONS_KEY(SLUG))).find((m) => m.job === ID);
      assert.deepEqual([fixed.status, fixed.version], ["applied", V2], "a live page's record stayed without its page");
      const done = [{ ...pendingFor(ID, V2), status: "applied", settledAt: "earlier" }];
      const b3 = site({ pointer: { version: V2, build: "b2", parent: V1, job: ID }, builds, extra: { [MIGRATIONS_KEY(SLUG)]: JSON.stringify(done) } });
      await mod.reconcileEditJob({ ...ENV_KEYS, SITES_BUCKET: b3, SITE_WORKERS: namespace({ build: "b2", version: V2 }) }, ID, row());
      assert.equal(b3.puts.filter((k) => k === MIGRATIONS_KEY(SLUG)).length, 0, "an applied record was written again");
      const b2 = site({ pointer: { version: V2, build: "b2", parent: V1, job: ID }, builds });
      await mod.reconcileEditJob({ ...ENV_KEYS, SITES_BUCKET: b2, SITE_WORKERS: namespace({ build: "b2", version: V2 }) }, ID, row());
      assert.equal(b2.store.has(MIGRATIONS_KEY(SLUG)), false, "a site with no record got one");
    } finally { restore(); }
  }
});

// ── WHAT A VERDICT STORES FOR THE CUSTOMER (2026-10-07) ────────────────────
//
// After the publish gate, a route that failed is refunded or kept by the
// reconcile, and the reply it stores replaced the route's own answer whole:
// a refunded one dropped the outcome (tables made, live), the requirement
// outcomes and the context its reply is written from, so the customer read
// a fixed "never went live" sentence beside tables that had gone in; a kept
// one left the route's ok:false answer on a row it had made published.

const FAILED_AFTER_TABLES = {
  ok: false, error: "compile", msg: "The page didn't publish.",
  outcome: { state: "partial", published: false, database: "applied", tables: ["gear"] },
  requirementsTold: [{ text: "keep a list of gear", told: "set-up" }], warningsTold: [],
  replyFor: { kind: "addon", request: "Add a gear list", answers: [], slug: SLUG, pages: ["/"] },
};
const storedOf = (body) => ({ status: 409, type: "application/json", body: JSON.stringify(body) });
const finalOf = (rpc) => { const f = rpc.filter((x) => x.fn === "edit_finalize"); return f.length ? JSON.parse(f[f.length - 1].args.p_result.body) : null; };

test("VERDICT 1 — REFUNDED AFTER THE TABLES WENT IN: the stored reply keeps the route's outcome, its requirement outcomes and its reply context, and carries the record the verdict settled — the customer is told what stands, by the model, never only that nothing went live", async () => {
  const mod = await loadWorkerModule();
  const builds = [{ id: V2, parent: V1, job: ID, build: "b2" }];
  const b = site({ pointer: null, builds, extra: { [MIGRATIONS_KEY(SLUG)]: JSON.stringify([pendingFor(ID)]) } });
  const rpc = [];
  const restore = stubFetch({ rpcAnswers: RPC_OK }, rpc);
  try {
    const out = await mod.reconcileEditJob({ ...ENV_KEYS, SITES_BUCKET: b, SITE_WORKERS: namespace({ build: "b1", version: V1 }) }, ID, row({ result: storedOf(FAILED_AFTER_TABLES) }));
    assert.equal(out.verdict, "refunded");
    const body = finalOf(rpc);
    assert.deepEqual([body.ok, body.error, body.kind], [false, "reconciled", "never-activated"]);
    assert.deepEqual(body.outcome, FAILED_AFTER_TABLES.outcome, "the route's outcome was dropped");
    assert.deepEqual(body.requirementsTold, FAILED_AFTER_TABLES.requirementsTold);
    assert.deepEqual(body.replyFor, FAILED_AFTER_TABLES.replyFor, "the context the reply is written from was dropped");
    assert.deepEqual([body.migration.status, body.migration.tables], ["applied_without_page", ["gear"]]);
    assert.doesNotMatch(body.msg, /still serving what it served before/, "the fixed sentence still says the whole site is as it was");
    // THE REPLY'S OWN READER SEES WHAT STANDS.
    const { outcomeOf } = await import("../builder/site-reply.mjs");
    assert.equal(outcomeOf(body).database, "applied");
  } finally { restore(); }
});

test("VERDICT 2 — KEPT OVER A FAILURE ANSWER: the change is live, so the route's ok:false answer is replaced by the recovered reply, and the record its failure marked without the page is corrected to applied", async () => {
  const mod = await loadWorkerModule();
  const builds = [{ id: V1, parent: "", job: ID0, build: "b1" }, { id: V2, parent: V1, job: ID, build: "b2" }];
  const b = site({ pointer: { version: V2, build: "b2", parent: V1, job: ID }, builds, extra: { [MIGRATIONS_KEY(SLUG)]: JSON.stringify([{ ...pendingFor(ID, V2), status: "applied_without_page" }]) } });
  const rpc = [];
  const restore = stubFetch({ rpcAnswers: RPC_OK }, rpc);
  try {
    const out = await mod.reconcileEditJob({ ...ENV_KEYS, SITES_BUCKET: b, SITE_WORKERS: namespace({ build: "b2", version: V2 }) }, ID, row({ result: storedOf(FAILED_AFTER_TABLES) }));
    assert.equal(out.verdict, "kept");
    const body = finalOf(rpc);
    assert.ok(body, "the failure answer was left on a row the verdict made published");
    assert.deepEqual([body.ok, body.recovered, body.reconciled], [true, true, "landed"]);
    assert.equal(body.migration.status, "applied");
    assert.equal(readMigrations(b.store.get(MIGRATIONS_KEY(SLUG))).find((m) => m.job === ID).status, "applied");
  } finally { restore(); }
});

test("VERDICT 3 — KEPT OVER A SUCCESS ANSWER keeps it, byte for byte; REFUNDED OVER A SUCCESS ANSWER keeps none of its claims, only its reply context and the settled record", async () => {
  const mod = await loadWorkerModule();
  const SUCCESS = { ok: true, kinds: ["table"], tables: ["gear"], requirementsTold: [{ text: "keep a list of gear", told: "set-up" }], replyFor: FAILED_AFTER_TABLES.replyFor };
  const builds = [{ id: V1, parent: "", job: ID0, build: "b1" }, { id: V2, parent: V1, job: ID, build: "b2" }];
  {
    const b = site({ pointer: { version: V2, build: "b2", parent: V1, job: ID }, builds, extra: { [MIGRATIONS_KEY(SLUG)]: JSON.stringify([pendingFor(ID, V2)]) } });
    const rpc = [];
    const restore = stubFetch({ rpcAnswers: RPC_OK }, rpc);
    try {
      await mod.reconcileEditJob({ ...ENV_KEYS, SITES_BUCKET: b, SITE_WORKERS: namespace({ build: "b2", version: V2 }) }, ID, row({ result: storedOf(SUCCESS) }));
      assert.equal(finalOf(rpc), null, "a kept success answer was replaced");
      assert.equal(readMigrations(b.store.get(MIGRATIONS_KEY(SLUG))).find((m) => m.job === ID).status, "applied");
    } finally { restore(); }
  }
  {
    const b = site({ pointer: null, builds, extra: { [MIGRATIONS_KEY(SLUG)]: JSON.stringify([pendingFor(ID)]) } });
    const rpc = [];
    const restore = stubFetch({ rpcAnswers: RPC_OK }, rpc);
    try {
      await mod.reconcileEditJob({ ...ENV_KEYS, SITES_BUCKET: b, SITE_WORKERS: namespace({ build: "b1", version: V1 }) }, ID, row({ result: storedOf(SUCCESS) }));
      const body = finalOf(rpc);
      assert.deepEqual([body.ok, body.error], [false, "reconciled"]);
      assert.equal(Object.hasOwn(body, "requirementsTold"), false, "a success answer's requirement outcomes were kept on a refund");
      assert.equal(Object.hasOwn(body, "outcome"), false);
      assert.deepEqual(body.replyFor, SUCCESS.replyFor);
      assert.equal(body.migration.status, "applied_without_page");
    } finally { restore(); }
  }
});
