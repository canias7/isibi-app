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
  upsertMigration, markMigration, pendingMigration, migrationNote, migrationSummary,
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
  assert.deepEqual(MIGRATION_STATES, ["pending", "applied", "applied_without_page", "failed"]);
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

test("unionSpec: the merged tables whole, the merged functions, connections and jobs first and the stored ones they do not name after, the rest of the stored spec kept", () => {
  const stored = { tables: [{ name: "bookings" }], functions: [{ name: "old_fn", internal: true }, { name: "Shared" }], apis: [{ name: "rates" }], jobs: [], version: 3 };
  const merged = { tables: [{ name: "bookings" }, { name: "gear" }], functions: [{ name: "shared", sql: "new" }, { name: "new_fn" }], jobs: [{ name: "nightly" }] };
  const u = unionSpec(stored, merged);
  assert.deepEqual(u.tables.map((t) => t.name), ["bookings", "gear"], "the tables are not the merged set");
  assert.deepEqual(u.functions.map((f) => f.name), ["shared", "new_fn", "old_fn"], "the merged functions do not come first, or the stored ones they do not name are dropped");
  assert.equal(u.functions[0].sql, "new", "the stored copy of a re-declared function won");
  assert.deepEqual(u.apis.map((a) => a.name), ["rates"], "a tier the merge did not touch lost the stored entries");
  assert.deepEqual(u.jobs.map((j) => j.name), ["nightly"]);
  assert.equal(u.version, 3, "the rest of the stored spec was dropped");
  assert.deepEqual(unionSpec(null, null), { tables: [], functions: [], apis: [], jobs: [] });
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

test("the apply is a closure built inside the backend block and called exactly twice — the pageless path and the seam hook — never inline; the page call reads the union of the stored spec and the merged one", () => {
  const r = route();
  const block = blockFrom(r, at(r, "if (aBackend.length) {", "the backend gate"));
  assert.ok(!/\bapplySiteSchema\(/.test(r.slice(0, at(r, "aApplyBackend = async (version) => {", "the closure"))), "the schema is still applied inline, before the closure");
  const closure = blockFrom(block, at(block, "aApplyBackend = async (version) => {", "the closure"));
  assert.match(closure, /aMade = await applySiteSchema\(adb, merged\);/, "the closure does not apply the schema");
  assert.match(closure, /await persistSiteJobs\(env, ou\.id, ownerSlug, merged\.jobs\);/, "the closure does not register the jobs");
  assert.match(closure, /aSeeded = await seedSiteRows\(adb, merged, aSeed\);/, "the closure does not seed the rows");
  assert.match(closure, /aSecrets = \[\.\.\.new Set\(/, "the closure does not read the secrets a connection needs");
  // The union precedes the closure, and the page call reads `aSpec`.
  const union = at(block, "aSpec = unionSpec(aSpec, merged);", "the union");
  assert.ok(union < at(block, "aApplyBackend = async (version) => {"), "the union is not before the closure");
  assert.ok(at(r, "aGen = await generateSitePages(", "the page call") > at(r, "if (aBackend.length) {"), "the page call is not after the backend block");
  assert.match(r.slice(at(r, "aGen = await generateSitePages("), at(r, "aPagesMs = Date.now() - aPagesT0;")), /\}\), aSpec, /, "the page call does not read aSpec");
  assert.match(W, /import \{[^}]*\bunionSpec\b[^}]*\} from "\.\/builder\/site-add\.mjs"/, "unionSpec is not imported from the add step's module");
  // Called twice: the pageless path with no version, the hook with the publish's.
  const calls = [...r.matchAll(/await aApplyBackend\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(calls, ["null", "version"], "the closure is not called exactly from the pageless path (no version) and the hook (the publish's version)");
  assert.equal((r.match(/aApplyBackend = async/g) || []).length, 1);
  assert.match(r, /let aApplyBackend = null;/, "the closure is not null for an addition that designed no backend");
  assert.match(r, /const aMigJob = aJob \? String\(aJob\.id\) : "sync:" \+ String\(\(editTrace && editTrace\.cid\) \|\| Date\.now\(\)\);/, "the record's job id is not the queue's id under a job, nor the trace's synchronously");
});

test("inside the closure: the record is filed pending before the first statement, a refused apply marks it failed and answers the detail, a landed one folds the engine's report and answers ok — with the reserve (#1) and its refusal still before the closure", () => {
  const r = route();
  const block = blockFrom(r, at(r, "if (aBackend.length) {", "the backend gate"));
  const closure = blockFrom(block, at(block, "aApplyBackend = async (version) => {", "the closure"));
  const filed = at(closure, "aMigration = await recordSiteMigration(env, ownerSlug, newMigration({", "the pending record");
  const apply = at(closure, "aMade = await applySiteSchema(adb, merged);", "the apply");
  assert.ok(filed < apply, "the record is not filed before the apply");
  const filing = closure.slice(filed, apply);
  for (const needle of ["job: aMigJob, slug: ownerSlug, version,", "added: folded.added, altered: folded.altered.map((a) => a && a.table),", 'functions: aNamed("functions"), apis: aNamed("apis"), jobs: aNamed("jobs"),', "provisioned: aProvisioned,"]) {
    assert.ok(filing.includes(needle), "the record is not filed with: " + needle);
  }
  const fail = between(closure, "} catch (e) {", "}\n", "the apply's catch");
  assert.match(fail, /settleSiteMigration\(env, ownerSlug, aMigJob, "failed", \{ error: detail\.slice\(0, 200\) \}\)/, "a refused apply does not mark the record failed with the error");
  assert.match(fail, /return \{ ok: false, detail \};/, "a refused apply does not answer the detail");
  assert.match(fail, /const detail = scrubSecrets\(/, "the detail is not scrubbed");
  assert.match(fail, /aMark\("schema", "fail"/, "a refused apply leaves no mark");
  const fold = at(closure, "aMigration = await recordSiteMigration(env, ownerSlug, withApplied(aMigration, aMade, { seeded: aSeeded }));", "the report folded");
  assert.ok(fold > at(closure, "aSeeded = await seedSiteRows(") && fold < closure.lastIndexOf("return { ok: true };"), "the engine's report is not folded after the seeding and before the ok");
  assert.match(closure, /aTables = folded\.added;/, "the reply names what was named, not what was created");
  assert.match(closure, /aFunctions = aNamed\("functions"\)\.filter\(\(n\) => aMadeFns\.includes\(n\)\);/, "the reply names functions the engine did not make");
  // THE RESERVE PRECEDES THE CLOSURE — and so the DDL, on both paths.
  const first = at(block, "aFirst = await aCharge(pageCredits(...aDesignUsage, aSeedUsage));", "sequence #1");
  assert.ok(first < at(block, "aApplyBackend = async (version) => {"), "sequence #1 is not placed before the closure is built");
  assert.match(block.slice(first, at(block, "aApplyBackend = async (version) => {")), /if \(aCharges\.refused\(\) > 0\) return unbilledReply\(aCharges\);/, "a refused #1 does not stop before the closure");
});

test("the pageless path applies directly, answers a refused apply as ours at 502 with the record, marks a landed one applied, and carries the record on its answer", () => {
  const r = route();
  const pl = between(r, "if (pageless(aAnswers)) {", "aGen = await generateSitePages(", "the pageless path");
  const call = at(pl, "const ap = await aApplyBackend(null);", "the direct apply");
  const cost = at(pl, "const aCostNow = aFirstPlaced ? aFirst : await aCharge(", "the pageless charge");
  assert.ok(call < cost, "the pageless path takes its money before the apply");
  assert.match(pl, /if \(!ap\.ok\) return Response\.json\(\{ ok: false, error: "schema", cost: 0, ours: true, msg: ADDON_SCHEMA_FAIL_MSG, detail: ap\.detail, migration: migrationSummary\(aMigration\) \}, \{ status: 502 \}\);/,
    "a refused apply on the pageless path is not answered as ours, at 502, with the record");
  assert.match(pl, /aMigration = \(await settleSiteMigration\(env, ownerSlug, aMigJob, "applied", \{ publish: \{ ok: true, pageless: true \} \}\)\) \|\| aMigration;/, "a landed pageless apply is not marked applied");
  assert.ok(at(pl, 'settleSiteMigration(env, ownerSlug, aMigJob, "applied"') < cost, "the mark is not before the charge");
  assert.match(pl, /migration: migrationSummary\(aMigration\),\s*cost: aCostNow,/, "the pageless answer does not carry the record");
  assert.match(pl, /if \(aApplyBackend\) \{/, "the pageless path applies when nothing was designed");
});

test("the hook applies last: after the round's reserve, after the swap is formed, skipped when the ledger refused, refused as the seam's refusal when the database refused, the round's build returned otherwise", () => {
  const r = route();
  const hook = between(r, "const aAfterCompile = async ({ built, pages, langs, recompile, job, version }) => {", 'aMark("publish:1", "start"', "the hook");
  const charge = at(hook, "aRepairRound.charged = Number(await aCharge(pageCredits(...aRepairRound.usage), 2)) || 0;", "reserve #2");
  const swap = at(hook, "const aSwap = aRepairRound.ran && aRepairRound.built ? { built: aRepairRound.built, pages: aRepairRound.pages } : null;", "the swap");
  const gate = at(hook, "if (aApplyBackend) {", "the apply gate");
  const skip = at(hook, 'if (aCharges.refused() > 0) { aMark("schema", "skip", { why: "unbilled" }); return aSwap; }', "the ledger skip");
  const apply = at(hook, "const ap = await aApplyBackend(version);", "the apply");
  const refuse = at(hook, 'if (!ap.ok) return { refuse: { error: "schema", detail: ap.detail, ours: true } };', "the refusal");
  const last = hook.lastIndexOf("return aSwap;");
  assert.ok(charge < swap && swap < gate && gate < skip && skip < apply && apply < refuse && refuse < last, "the hook's order is not: reserve #2, the swap, the gate, the ledger skip, the apply, the refusal, the swap returned");
  assert.ok(!/\bthrow\b/.test(hook), "the hook throws — the spine would log and publish over it");
  assert.equal((hook.match(/await aApplyBackend\(/g) || []).length, 1);
});

test("after the publish: a refused apply is the schema sentence at 502 and ours; a publish that failed after the apply marks the record applied_without_page and leads with its sentence; a publish that landed marks it applied with the version; the reply carries the record", () => {
  const r = route();
  // THE BRANCH BY ITS BRACES, not to the next landmark: the applied mark sits
  // right after the branch closes, and a window to `aRepairUsage` swallows it.
  const failAt = at(r, "if (!aPub.ok) {", "the failure branch");
  const fail = blockFrom(r, failAt);
  assert.match(fail, /const aSchemaFail = aPub\.error === "schema";/);
  assert.match(fail, /if \(aMigration && !aSchemaFail && aMigration\.status === "pending"\) \{\s*aMigration = \(await settleSiteMigration\(env, ownerSlug, aMigJob, "applied_without_page", \{ publish: \{ ok: false, error: String\(aPub\.error \|\| ""\), detail: String\(aPub\.detail \|\| ""\)\.slice\(0, 200\) \} \}\)\) \|\| aMigration;/,
    "a publish that failed after the apply does not mark the record applied_without_page — or marks a refused apply so, or a settled record again");
  assert.match(fail, /error: aSchemaFail \? "schema" : "compile", cost: 0,/, "a refused apply wears the compile's name");
  assert.match(fail, /\.\.\.\(aSchemaFail \? \{ ours: true \} : \{\}\),/, "a refused apply is not said to be ours");
  assert.match(fail, /msg: aSchemaFail\s*\? ADDON_SCHEMA_FAIL_MSG\s*: \[migrationNote\(aMigration\), compileMsg\(aPub, "That addition didn't compile, so your site is untouched — try describing it differently\."\)\]\.filter\(Boolean\)\.join\(" "\),/,
    "the customer is not told what stands in the database before the compile sentence, or a refused apply is not the schema sentence");
  assert.match(fail, /migration: migrationSummary\(aMigration\),/, "the failure reply does not carry the record");
  assert.match(fail, /\{ status: aSchemaFail \? 502 : 422 \}/, "a refused apply is not a 502");
  // The revert of the look still comes first.
  assert.ok(at(fail, "patchSiteConfig(env, ownerSlug, adb, { look: aLook, css: aCss })", "the look revert") < at(fail, "const aSchemaFail", "the schema test"), "the look is not put back before the record is read");
  // The applied mark sits AFTER the failure branch (a failed publish never
  // reaches it) and BEFORE the success reply (which carries it).
  assert.ok(!fail.includes('"applied",'), "the applied mark sits inside the failure branch");
  const applied = at(r, 'aMigration = (await settleSiteMigration(env, ownerSlug, aMigJob, "applied", { version: aPub.version || aMigration.version || null, publish: { ok: true, files: aPub.files } })) || aMigration;', "the applied mark");
  const failEnd = failAt + fail.length;
  const okReply = at(r, "return Response.json({\n              ok: true,", "the success reply");
  assert.ok(applied > failEnd && applied < okReply, "the applied mark is not after the failure branch closes and before the success reply");
  assert.match(r.slice(applied - 80, applied), /if \(aMigration && aMigration\.status === "pending"\) \{\s*$/, "a settled record is marked applied again, or a record that was never filed is");
  const reply = between(r, "return Response.json({\n              ok: true,", "cost: aCost,\n            });", "the success reply");
  assert.match(reply, /migration: migrationSummary\(aMigration\),/, "the success reply does not carry the record");
  // The old sentence is gone from the route: nothing says "untouched" for a
  // schema failure without the constant that keeps it true.
  assert.match(W, /const ADDON_SCHEMA_FAIL_MSG = "That change needed the site's database and it couldn't be applied — this is on us, and your site is untouched\. Try again in a few minutes\.";/);
});

test("the store: read and write are best-effort under the answer store's key, a fresh record replaces its job's, a settle answers null for a job with no record; the reconcile settles a pending record after the money, inside its own try", () => {
  const helpers = between(W, "const readSiteMigrations = async (env, slug) => {", "\nasync function ", "the store helpers");
  assert.match(helpers, /SITES_BUCKET\.get\(MIGRATIONS_KEY\(slug\)\)/, "the read is not under the module's key");
  assert.match(helpers, /SITES_BUCKET\.put\(MIGRATIONS_KEY\(slug\), JSON\.stringify\(\{ at: new Date\(\)\.toISOString\(\), slug, migrations: list \}\)/, "the write is not the list under the module's key");
  assert.equal((helpers.match(/\} catch \(e\) \{ console\.error\("migrations (?:read|write) failed:"/g) || []).length, 2, "a read or a write that fails is not caught and said");
  assert.match(helpers, /return o \? readMigrations\(await o\.text\(\)\) : \[\];/, "a missing store is not read as empty");
  const settle = between(W, "async function settleSiteMigration(", "\n}\n", "settleSiteMigration");
  assert.match(settle, /if \(!moved\.entry\) return null;/, "a job with no record is written anyway, or answers a record");
  assert.match(settle, /await writeSiteMigrations\(env, slug, moved\.list\);/);
  const record = between(W, "async function recordSiteMigration(", "\n}\n", "recordSiteMigration");
  assert.match(record, /upsertMigration\(await readSiteMigrations\(env, slug\), entry\)/);
  assert.match(W, /import \{ MIGRATIONS_KEY, readMigrations, newMigration, withApplied, upsertMigration, markMigration, pendingMigration, migrationNote, migrationSummary \} from "\.\/builder\/site-migrations\.mjs";/);
  // THE RECONCILE (stage 3b) settles a pending record by the verdict, after
  // the money moved and the reply was stored, never throwing out of it.
  const rec = between(W, "async function applyReconcile(", "\n}\n", "applyReconcile");
  const finalize = at(rec, 'await editRpc(env, "edit_finalize"', "the finalize");
  const mig = at(rec, "const mig = pendingMigration(await readSiteMigrations(env, row.slug), id);", "the record read");
  assert.ok(finalize < mig, "the record is settled before the reply is stored");
  assert.match(rec, /await settleSiteMigration\(env, row\.slug, id, out\.verdict === "kept" \? "applied" : "applied_without_page",\s*\{ version: \(out\.mine && out\.mine\.version\) \|\| mig\.version \|\| null, publish: \{ ok: out\.verdict === "kept", reconciled: out\.kind \} \}\);/,
    "the verdict does not decide the record's state, or the version is not the job's own");
  assert.match(rec.slice(mig - 40, mig), /try \{\s*$/, "the record's settle is not inside its own try");
  assert.ok(rec.indexOf("catch (e) { console.error(\"reconcile: migration record\"", mig) > mig, "a record that cannot be written throws out of the verdict");
  assert.ok(mig < at(rec, 'console.log("reconcile:", id, out.verdict', "the verdict log"), "the record is settled after the verdict is logged");
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
  // A SETTLED RECORD IS LEFT ALONE, and a site with no record writes none.
  {
    const settled = [{ ...pendingFor(ID, V2), status: "applied_without_page", settledAt: "earlier" }];
    const b = site({ pointer: { version: V2, build: "b2", parent: V1, job: ID }, builds, extra: { [MIGRATIONS_KEY(SLUG)]: JSON.stringify(settled) } });
    const restore = stubFetch({ rpcAnswers: RPC_OK });
    try {
      const out = await mod.reconcileEditJob({ ...ENV_KEYS, SITES_BUCKET: b, SITE_WORKERS: namespace({ build: "b2", version: V2 }) }, ID, row());
      assert.equal(out.verdict, "kept");
      assert.equal(b.puts.filter((k) => k === MIGRATIONS_KEY(SLUG)).length, 0, "a settled record was written again");
      const b2 = site({ pointer: { version: V2, build: "b2", parent: V1, job: ID }, builds });
      await mod.reconcileEditJob({ ...ENV_KEYS, SITES_BUCKET: b2, SITE_WORKERS: namespace({ build: "b2", version: V2 }) }, ID, row());
      assert.equal(b2.store.has(MIGRATIONS_KEY(SLUG)), false, "a site with no record got one");
    } finally { restore(); }
  }
});
