// PARKED (2026-11-03, park-old-way): the old-way half of test/site-migrations.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { hit, loadWorkerModule } from "../../../test/fixtures/worker-harness.mjs";
import {
  MIGRATIONS_KEY, MAX_MIGRATIONS, MIGRATION_STATES, readMigrations, newMigration, withApplied,
  upsertMigration, markMigration, pendingMigration, jobMigration, reconciledMigration, migrationNote, migrationSummary,
} from "../../../builder/site-migrations.mjs";
import { unionSpec } from "../../../builder/site-add.mjs";
import { allowedJobKey } from "../../../builder/job-gateway.mjs";
import { POINTER_KEY, buildPrefix, MANIFEST_FILE, SERVER_FILE } from "../../../site-builds.mjs";
import { versionId } from "../../../site-versions.mjs";

const RAW = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const MIG = fs.readFileSync(new URL("../../../builder/site-migrations.mjs", import.meta.url), "utf8");
const ENGINE = fs.readFileSync(new URL("../../../site-schema.mjs", import.meta.url), "utf8");
const DOCKER = fs.readFileSync(new URL("../../../Dockerfile", import.meta.url), "utf8");

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

// ── THE ADDON ROUTE, READ ────────────────────────────────────────────────────

const route = () => between(W, "const aBackend = backendDesigned(aDesigned);", "\n          if (tx) {", "the addon route from its backend block");

test("the apply is a closure built inside the backend block and called exactly twice — the pageless path and the seam hook — never inline; the page call reads the union of the stored spec and the merged one", () => {
  const r = route();
  const block = blockFrom(r, at(r, "if (aBackend.length) {", "the backend gate"));
  assert.ok(!/\bapplySiteSchema\(/.test(r.slice(0, at(r, "aApplyBackend = async (version) => {", "the closure"))), "the schema is still applied inline, before the closure");
  const closure = blockFrom(block, at(block, "aApplyBackend = async (version) => {", "the closure"));
  assert.match(closure, /aMade = await applySiteSchema\(adb, merged\);/, "the closure does not apply the schema");
  assert.doesNotMatch(closure, /persistSiteJobs/, "the closure still registers prebuilt jobs");
  assert.match(closure, /aSeeded = await seedSiteRows\(adb, merged, aSeed\);/, "the closure does not seed the rows");
  assert.doesNotMatch(closure, /aSecrets = /, "the closure still reads the secrets a prebuilt connection needed");
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
  for (const needle of ["job: aMigJob, slug: ownerSlug, version,", "added: folded.added, altered: folded.altered.map((a) => a && a.table),", 'functions: aNamed("functions"),', "provisioned: aProvisioned,"]) {
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
  // RE-ANCHORED 2026-10-06: the refusal is `unbilledReply`'s answer through the
  // route's failure door (`aFail`), which adds what the failure left behind.
  assert.match(block.slice(first, at(block, "aApplyBackend = async (version) => {")), /if \(aCharges\.refused\(\) > 0\) \{ const u = unbilledBody\(aCharges\); return aFail\(u\.body, u\.status\); \}/, "a refused #1 does not stop before the closure");
});

test("the pageless path applies directly, answers a refused apply as ours at 502 with the record, marks a landed one applied, and carries the record on its answer", () => {
  const r = route();
  const pl = between(r, "if (pageless(aAnswers)) {", "aGen = await generateSitePages(", "the pageless path");
  const call = at(pl, "const ap = await aApplyBackend(null);", "the direct apply");
  const cost = at(pl, "const aCostNow = aFirstPlaced ? aFirst : await aCharge(", "the pageless charge");
  assert.ok(call < cost, "the pageless path takes its money before the apply");
  // RE-ANCHORED 2026-10-06: through the failure door, and an apply that stopped
  // part-way is one whose database outcome is not known.
  assert.match(pl, /if \(!ap\.ok\) return aFail\(\{ ok: false, error: "schema", cost: 0, ours: true, msg: ADDON_SCHEMA_FAIL_MSG, detail: ap\.detail, migration: migrationSummary\(aMigration\) \}, 502, \{ database: "unknown" \}\);/,
    "a refused apply on the pageless path is not answered as ours, at 502, with the record and an unknown database");
  assert.match(pl, /aMigration = \(await settleSiteMigration\(env, ownerSlug, aMigJob, "applied", \{ publish: \{ ok: true, pageless: true \} \}\)\) \|\| aMigration;/, "a landed pageless apply is not marked applied");
  assert.ok(at(pl, 'settleSiteMigration(env, ownerSlug, aMigJob, "applied"') < cost, "the mark is not before the charge");
  assert.match(pl, /migration: migrationSummary\(aMigration\),\s*cost: aCostNow,/, "the pageless answer does not carry the record");
  assert.match(pl, /if \(aApplyBackend\) \{/, "the pageless path applies when nothing was designed");
});

test("the hook applies last: after the round's reserve, after the swap is formed, skipped when the ledger refused, refused as the seam's refusal when the database refused, the round's build returned otherwise", () => {
  const r = route();
  const hook = between(r, "const aAfterCompile = async ({ built, pages, langs, recompile, job, version }) => {", 'aMark("publish:1", "start"', "the hook");
  const charge = at(hook, "aRepairRound.charged = Number(await aCharge(pageCredits(...aRepairRound.usage), 2)) || 0;", "reserve #2");
  // RE-ANCHORED 2026-10-25 (feature-verify): the swap prefers the requirement retry round's build, then the repair round's.
  const swap = at(hook, "const aSwap = aReqRetry && aReqRetry.built ? { built: aReqRetry.built, pages: aReqRetry.pages }\n                : aRepairRound.ran && aRepairRound.built ? { built: aRepairRound.built, pages: aRepairRound.pages } : null;", "the swap");
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
  // RE-ANCHORED 2026-10-16: a schema only HELD (draft-first on a published
  // site) is `discarded` when its save fails — nothing reached the database.
  assert.match(fail, /const aHeldOnly = !!\(aWriter && aWriter\.holding\);/, "the failure branch does not tell a held schema from an applied one");
  assert.match(fail, /if \(aMigration && !aSchemaFail && aMigration\.status === "pending"\) \{\s*aMigration = \(await settleSiteMigration\(env, ownerSlug, aMigJob, aHeldOnly \? "discarded" : "applied_without_page", \{ publish: \{ ok: false, error: String\(aPub\.error \|\| ""\), detail: String\(aPub\.detail \|\| ""\)\.slice\(0, 200\) \} \}\)\) \|\| aMigration;/,
    "a publish that failed after the apply does not mark the record applied_without_page — or marks a refused apply so, or a settled record again");
  // 2026-10-16: an overlap with another part of the request keeps its own code (`lostOr`).
  assert.match(fail, /error: aSchemaFail \? "schema" : lostOr\(aPub, "compile"\), cost: 0,/, "a refused apply wears the compile's name");
  assert.match(fail, /\.\.\.\(aSchemaFail \? \{ ours: true \} : \{\}\),/, "a refused apply is not said to be ours");
  // RE-ANCHORED 2026-09-26, when a revert that failed began to be said: the
  // message is still the schema sentence on a refused apply and the database's
  // record before the compile sentence otherwise — and both arms now read
  // whether the look went back (`aKept`), the untouched wording only when it did.
  const msgAt = at(fail, "msg: aSchemaFail", "the failure sentence");
  const msg = fail.slice(msgAt, at(fail, "migration: migrationSummary(aMigration),", "the record on the reply"));
  // RE-ANCHORED 2026-10-06 (the owner, on 08b9a657: *"ok:false alone must
  // never establish that nothing changed"*): the schema sentence no longer
  // calls the database untouched, so one sentence serves both arms with the
  // kept note beside it; and the compile arm says "untouched" only when nothing
  // outside the publish changed (`aLanded`), which `compileMsg` is told too.
  assert.match(msg, /^msg: aSchemaFail\s*\? ADDON_SCHEMA_FAIL_MSG \+ \(aKept \? KEPT_CHANGE_NOTE : ""\)\s*:/,
    "a refused apply is not the schema sentence, or a revert that failed is not said on it");
  assert.match(msg, /: \[migrationNote\(aMigration\), compileMsg\(aPub, aKept\s*\? "[^"]+"\s*: aLanded\s*\? "That addition didn't compile, so it wasn't published — try describing it differently\."\s*: "That addition didn't compile, so your site is untouched — try describing it differently\.", aLanded, aKept\)\]\.filter\(Boolean\)\.join\(" "\),/,
    "the customer is not told what stands in the database before the compile sentence, or the revert's result or what landed does not reach it");
  // WHAT IT LEFT BEHIND IS READ OFF THE APPLY'S OWN FLAG, never the record alone.
  // …AND A SCHEMA ONLY HELD (2026-10-16) left nothing: `none`, whatever the apply's flag says.
  assert.match(fail, /const aDb = aHeldOnly \? "none" : aApplied \? "applied" : aMigration \? "unknown" : "none";/, "the database's outcome is not read off the apply's own flag");
  assert.match(fail, /const aLanded = aDb !== "none" \|\| aProvisioned;/, "a database made for the site does not count as something that changed");
  assert.ok(at(fail, "const aDb =", "the outcome") > at(fail, "const aSchemaFail", "the schema test"), "the outcome is read before the record is settled");
  assert.ok(at(fail, "if (!back.ok) { aKept = true;", "the revert's result") < msgAt, "the revert's result is not known before the sentence is composed");
  assert.match(fail, /migration: migrationSummary\(aMigration\),/, "the failure reply does not carry the record");
  assert.match(fail, /\}, aSchemaFail \? 502 : 422, \{ database: aDb, saved: aKept, photos: \(aPhotos && aPhotos\.made\) \|\| 0 \}\);/, "a refused apply is not a 502, or the failure door is not told what the publish left behind");
  // The revert of the look still comes first.
  assert.ok(at(fail, "patchSiteConfig(env, ownerSlug, adb, { look: aLook, css: aCss }, jobFence(env, aJob))", "the look revert") < at(fail, "const aSchemaFail", "the schema test"), "the look is not put back before the record is read");
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
  // THE SCHEMA SENTENCE IS ONE CONSTANT, and it no longer calls the site
  // untouched (2026-10-06): the engine applies one statement at a time, so
  // what went in before a refusal is not known.
  assert.match(W, /const ADDON_SCHEMA_FAIL_MSG = "That change needed the site's database and it couldn't be applied — this is on us\. Your live pages weren't changed, but some of the database change may already have gone in before it stopped; asking again won't make anything twice\. Try again in a few minutes\.";/);
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
  assert.match(W, /import \{ MIGRATIONS_KEY, readMigrations, newMigration, withApplied, upsertMigration, markMigration, pendingMigration, jobMigration, reconciledMigration, migrationNote, migrationSummary \} from "\.\/builder\/site-migrations\.mjs";/);
  // THE RECONCILE (stage 3b) settles the job's record by the verdict, after
  // the money moved — and, since 2026-10-07, BEFORE the reply is stored, so
  // the reply carries what stands — never throwing out of it.
  const rec = between(W, "async function applyReconcile(", "\n}\n", "applyReconcile");
  const money = at(rec, 'await editRpc(env, "edit_reconcile"', "the verdict's money");
  const finalize = at(rec, 'await editRpc(env, "edit_finalize"', "the finalize");
  const mig = at(rec, "const entry = jobMigration(await readSiteMigrations(env, row.slug), id);", "the record read");
  assert.ok(money < mig && mig < finalize, "the record is not settled between the money and the reply");
  assert.match(rec, /const to = reconciledMigration\(entry, out\.verdict === "kept"(, \{ saved: out\.kind === "draft-saved" \})?\);/, "the verdict and the record's own evidence do not decide the record's state");
  assert.match(rec, /await settleSiteMigration\(env, row\.slug, id, to,\s*\{ version: \(out\.mine && out\.mine\.version\) \|\| entry\.version \|\| null, publish: \{ ok: out\.verdict === "kept", reconciled: out\.kind \} \}\)/,
    "the version is not the job's own");
  assert.match(rec, /reconcileReply\(out, row, refunded, \{ prior, migration: migrationSummary\(mig\) \}\)/, "the reply is not given the settled record");
  assert.match(rec.slice(mig - 40, mig), /try \{\s*$/, "the record's settle is not inside its own try");
  assert.ok(rec.indexOf("catch (e) { console.error(\"reconcile: migration record\"", mig) > mig, "a record that cannot be written throws out of the verdict");
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
