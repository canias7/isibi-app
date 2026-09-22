// The canary's restore mode — `scripts/canary-restore.mjs`, and the hop that
// wires it into `scripts/edit-canary.mjs` and `.github/workflows/edit-canary.yml`.
//
// ── WHY IT IS GUARDED ─────────────────────────────────────────────────────
//
// It is the one mode of the canary that WRITES to a live site. The places-left
// replay (2026-09-22) needs fretwork-1 back on the exact version run 17 started
// from, and the restore route is owner-gated, so the only way a session can
// have it done is a dispatch of this workflow. What it may post, when it stops
// and what counts as "it took" are therefore worth driving rather than trusting:
// a restore of the wrong version, or a restore read as done when the site still
// serves the old one, produces a replay against the wrong starting source —
// complete, plausible, and about a different site.
//
// THE DECISIONS ARE DRIVEN over injected readers; the WIRING is a source read,
// because the canary signs in and spends money at import.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readRestoreId, restoreFlow, describeRestore, mintedAt } from "../scripts/canary-restore.mjs";
import { isVersionId } from "../site-versions.mjs";

const RUN11 = "01789972018761-6tng48";   // the version run 17 started from
const RUN17 = "01790040384165-wl5it5";   // what run 17 published

/** Comments blanked, length preserved, string-aware — edit-canary.test.mjs's own. */
function blankComments(src) {
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
const MOD = blankComments(readFileSync(new URL("../scripts/canary-restore.mjs", import.meta.url), "utf8"));
const CANARY = blankComments(readFileSync(new URL("../scripts/edit-canary.mjs", import.meta.url), "utf8"));
const FLOW = readFileSync(new URL("../.github/workflows/edit-canary.yml", import.meta.url), "utf8");

/** A version list as the route answers it — `mergeVersions` over `listBuilds`, newest first. */
const LISTED = [
  { id: RUN17, at: 1, label: "The \"Space on a preferred day\" box counts bookings.", parent: RUN11, job: "j17", layout: "build", files: 37 },
  { id: RUN11, at: 1, label: "The home page shows nine beginner quotes in three stacked…", parent: "01789969800000-aaaaaa", job: "j11", layout: "build", files: 37 },
];

/**
 * Readers that RECORD, so a case can say what was and was not posted. `after`
 * is what the live header reads once the restore has been posted — the site
 * serving the restored build — and `before` is what it read until then.
 */
function world({ list = { status: 200, json: { ok: true, versions: LISTED } }, post, before = RUN17, after = RUN11 } = {}) {
  const w = { posts: [], liveReads: 0, sleeps: 0, posted: false };
  w.listVersions = async () => list;
  w.postRestore = async (id) => {
    w.posts.push(id); w.posted = true;
    return post ? post(id) : { status: 200, json: { ok: true, id, files: 37, swept: 0, worker: true, url: "/s/fretwork-1/" } };
  };
  w.readLive = async () => { w.liveReads++; return w.posted ? after : before; };
  w.sleep = async () => { w.sleeps++; };
  return w;
}
const run = (w, extra = {}) => restoreFlow({ id: RUN11, listVersions: w.listVersions, postRestore: w.postRestore, readLive: w.readLive, sleep: w.sleep, polls: 5, gapMs: 1, ...extra });

// ── THE ID ────────────────────────────────────────────────────────────────

test("the id is the platform's own shape, and nothing is repaired into one", () => {
  assert.deepEqual(readRestoreId(RUN11), { ok: true, id: RUN11 });
  assert.deepEqual(readRestoreId("  " + RUN11 + "\n"), { ok: true, id: RUN11 }, "surrounding whitespace is not part of an id");
  // REFUSED, NEVER COERCED — `String(["a"])` is `"a"`, this repo's thrice-shipped trap.
  assert.equal(readRestoreId([RUN11]).ok, false, "an array holding the id was coerced into it");
  assert.equal(readRestoreId(undefined).ok, false);
  assert.equal(readRestoreId("").why, "blank");
  assert.equal(readRestoreId("   ").why, "blank");
  // NOT A NEAR MISS: a restore of "roughly that one" is the approximate-
  // timestamp mistake this mode exists to close.
  for (const bad of [RUN11.toUpperCase(), "0178997201876-6tng48", RUN11 + "x", RUN11 + "/", "01789972018761-6tng48a", "01789972018761_6tng48", "06:26 UTC"]) {
    const r = readRestoreId(bad);
    assert.equal(r.ok, false, `${JSON.stringify(bad)} was accepted`);
    assert.equal(r.why, "shape");
    assert.ok(r.msg && r.msg.length > 20, "a refusal must say why");
  }
});

test("the shape rule is the platform's own, never a second copy", () => {
  // The module asks `isVersionId`; a regex of its own here would be the copy
  // that drifts.
  assert.match(MOD, /import \{ isVersionId \} from "\.\.\/site-versions\.mjs"/);
  assert.match(MOD, /isVersionId\(id\)/);
  assert.doesNotMatch(MOD, /\[0-9\]\{14\}/, "the module carries its own copy of the id shape");
  // AND THE TWO READERS AGREE on the cases above, so the import is the rule.
  for (const s of [RUN11, RUN17, RUN11.toUpperCase(), "0178997201876-6tng48"]) {
    assert.equal(readRestoreId(s).ok, isVersionId(s), s);
  }
});

test("a version's mint time is read off its own id", () => {
  assert.equal(mintedAt(RUN11), "2026-09-21T06:26:58.761Z");
  assert.equal(mintedAt(RUN17), "2026-09-22T01:26:24.165Z");
  assert.equal(mintedAt("nonsense"), "");
});

// ── WHAT IT POSTS, AND WHEN IT IS DONE ─────────────────────────────────────

test("a listed version is posted once, and it is done only when the SITE reports it", async () => {
  const w = world();
  const r = await run(w);
  assert.deepEqual(w.posts, [RUN11], "the requested version was not posted exactly once");
  assert.equal(r.ok, true);
  assert.equal(r.why, "restored");
  assert.equal(r.liveBefore, RUN17);
  assert.equal(r.liveAfter, RUN11);
  // ROW 1 IS "LIVE NOW", so the requested one is the row right under it.
  assert.equal(r.row.number, 2);
  assert.equal(r.row.parent, "01789969800000-aaaaaa");
  // THE LIST IS KEPT WHOLE for the evidence, parents included — that column is
  // what says whether anything was published between the two runs.
  assert.deepEqual(r.versions.map((v) => [v.id, v.parent]), [[RUN17, RUN11], [RUN11, "01789969800000-aaaaaa"]]);
});

test("a site already on the version gets NO post", async () => {
  const w = world({ before: RUN11 });
  const r = await run(w);
  assert.deepEqual(w.posts, [], "a restore was posted to a site already serving that version");
  assert.equal(r.ok, true);
  assert.equal(r.why, "already-live");
});

test("an unreadable version list is a refusal, never a go-ahead — in all three shapes", async () => {
  const shapes = [
    // ⚠ THE STATUS IS LOAD-BEARING: this one carries a perfectly good list and
    // only the 503 says not to trust it.
    { status: 503, json: { ok: true, versions: LISTED } },
    // PostgREST-style: an error OBJECT at 200 wears no list at all.
    { status: 200, json: { error: "storage not configured" } },
    null,
  ];
  for (const list of shapes) {
    const w = world({ list });
    const r = await run(w);
    assert.deepEqual(w.posts, [], `posted on an unreadable list ${JSON.stringify(list)}`);
    assert.equal(r.ok, false);
    assert.equal(r.why, "list-unreadable");
  }
});

test("an id the list does not carry is never posted", async () => {
  const w = world({ list: { status: 200, json: { ok: true, versions: [LISTED[0]] } } });
  const r = await run(w);
  assert.deepEqual(w.posts, []);
  assert.equal(r.why, "not-listed");
  assert.equal(r.ok, false);
});

test("a version saved without its script is refused before the post", async () => {
  const w = world({ list: { status: 200, json: { ok: true, versions: [LISTED[0], { ...LISTED[1], restorable: false }] } } });
  const r = await run(w);
  assert.deepEqual(w.posts, []);
  assert.equal(r.why, "not-restorable");
});

test("a refusal from the route is a refusal, whatever the status says", async () => {
  for (const post of [
    () => ({ status: 409, json: { ok: false, error: "the site changed while that version was being put back — try again" } }),
    () => ({ status: 200, json: { ok: false, error: "rollback failed" } }),
    () => ({ status: 500, json: null }),
  ]) {
    const w = world({ post });
    const r = await run(w);
    assert.equal(r.ok, false);
    assert.equal(r.why, "refused");
    assert.equal(w.liveReads, 1, "the header was polled after a refused restore — only the before reading may run");
  }
});

test("an answer about a different version is not this one being done", async () => {
  const w = world({ post: () => ({ status: 200, json: { ok: true, id: RUN17, worker: true } }) });
  const r = await run(w);
  assert.equal(r.ok, false);
  assert.equal(r.why, "wrong-id");
});

test("files back without the script is its own outcome, never 'unmoved'", async () => {
  // The route answers ok with `worker: false` when the script did not go up —
  // and then the site genuinely has not moved, so without its own reason this
  // would read as a slow roll.
  const w = world({ post: (id) => ({ status: 200, json: { ok: true, id, files: 37, worker: false } }), after: RUN17 });
  const r = await run(w);
  assert.equal(r.ok, false);
  assert.equal(r.why, "script");
});

test("a route that answers ok while the site still serves the old version is NOT restored", async () => {
  const w = world({ after: RUN17 });
  const r = await run(w);
  assert.equal(r.ok, false);
  assert.equal(r.why, "live-unmoved");
  assert.equal(r.reads, 5, "the header was not read the full number of times");
  assert.equal(w.sleeps, 4, "it waited after the last read, or not between reads");
  assert.equal(r.liveAfter, RUN17);
});

test("an unreadable before-header does not stop a restore, and cannot pass one", async () => {
  const ok = world({ before: "" });
  assert.equal((await run(ok)).ok, true);
  assert.deepEqual(ok.posts, [RUN11]);
  const dark = world({ before: "", after: "" });
  const r = await run(dark);
  assert.equal(r.ok, false, "an unreadable after-header was read as the restore taking");
  assert.equal(r.why, "live-unmoved");
});

// ── THE ACCOUNT ────────────────────────────────────────────────────────────

test("the account says RESTORED only when it was, and names every other outcome", async () => {
  const seen = new Map();
  const cases = {
    "restored": world(),
    "already-live": world({ before: RUN11 }),
    "list-unreadable": world({ list: { status: 503, json: null } }),
    "not-listed": world({ list: { status: 200, json: { ok: true, versions: [LISTED[0]] } } }),
    "not-restorable": world({ list: { status: 200, json: { ok: true, versions: [LISTED[0], { ...LISTED[1], restorable: false }] } } }),
    "refused": world({ post: () => ({ status: 409, json: { ok: false, error: "nope" } }) }),
    "wrong-id": world({ post: () => ({ status: 200, json: { ok: true, id: RUN17 } }) }),
    "script": world({ post: (id) => ({ status: 200, json: { ok: true, id, worker: false } }) }),
    "live-unmoved": world({ after: RUN17 }),
  };
  for (const [why, w] of Object.entries(cases)) {
    const r = await run(w);
    assert.equal(r.why, why);
    const told = describeRestore(r, "fretwork-1");
    const last = told.trim().split("\n").pop();
    assert.ok(last.startsWith(r.ok ? "RESTORED — " : "NOT RESTORED — "), `${why}: ${last}`);
    assert.doesNotMatch(last, /unrecognised outcome/, `${why} has no sentence of its own`);
    seen.set(last.replace(/^(NOT )?RESTORED — /, ""), why);
  }
  assert.equal(seen.size, Object.keys(cases).length, "two outcomes share one sentence");
  // THE LIST IS PRINTED WITH ITS PARENTS, the one column that settles whether a
  // publish landed between the two runs.
  const told = describeRestore(await run(world()), "fretwork-1");
  assert.match(told, new RegExp(`${RUN17}\\s+2026-09-22T01:26:24\\.165Z\\s+parent ${RUN11}`));
  assert.match(told, /asked for\s+row 2/);
});

test("the module holds no transport of its own", () => {
  // IT IS HANDED ITS READERS, so the one write it can make is the one the
  // caller bound — asserted over blanked comments, because the header prose
  // names the route it is about.
  assert.doesNotMatch(MOD, /\bfetch\s*\(/);
  assert.doesNotMatch(MOD, /node:https?\b/);
  assert.doesNotMatch(MOD, /["'`](POST|PUT|PATCH|DELETE)["'`]/);
  assert.match(MOD, /export async function restoreFlow/, "the scan is not looking at the module");
});

// ── THE WIRING ─────────────────────────────────────────────────────────────

test("a malformed version refuses before anything is signed in", () => {
  const ask = CANARY.indexOf("readRestoreId(RESTORE)");
  const signIn = CANARY.indexOf("auth/v1/admin/generate_link");
  assert.ok(ask > 0, "the canary no longer reads the version through readRestoreId");
  assert.ok(signIn > 0, "the sign-in landmark is gone — the ordering below asserts nothing");
  assert.ok(ask < signIn, "the version is checked after the sign-in");
  const win = CANARY.slice(ask, signIn);
  assert.match(win, /process\.exit\(2\)/, "a malformed version does not stop the run");
  assert.match(CANARY, /const RESTORE = String\(process\.env\.CANARY_RESTORE/);
});

test("the restore sits below the free checks and above the inventory, and stops on a miss", () => {
  const at = CANARY.indexOf("if (RESTORE_ASK) {");
  const free = CANARY.indexOf("ALL FREE CHECKS PASSED");
  const inv = CANARY.indexOf("INVENTORY — before", at);
  assert.ok(at > 0, "the restore branch is gone");
  assert.ok(free > 0 && free < at, "the restore runs before the free checks have finished");
  assert.ok(inv > at, "the restore no longer sits above the inventory");
  const win = CANARY.slice(at, inv);
  // A FAILED FREE CHECK REFUSES THE RESTORE, and before anything is posted.
  const refuse = win.indexOf("if (failed)");
  const flow = win.indexOf("restoreFlow(");
  assert.ok(refuse > 0 && flow > refuse, "a failed free check does not refuse the restore before it runs");
  assert.match(win.slice(refuse, flow), /process\.exit\(1\)/);
  // THE APP'S OWN CALL, and the site's own header as the proof.
  assert.match(win, /"GET", `\/api\/site\/\$\{encodeURIComponent\(CANARY\)\}\/versions`/);
  assert.match(win, /"POST", `\/api\/site\/\$\{encodeURIComponent\(CANARY\)\}\/versions\/restore`, \{ body: \{ id \} \}/);
  assert.match(win, /headers\.get\("x-site-version"\)/);
  // A RESTORE THAT DID NOT TAKE STOPS THE RUN, above the inventory, so the
  // source read is never a record of the wrong site.
  assert.match(win, /if \(!rs\.ok\) process\.exit\(1\)/);
  assert.match(win, /restore\.json/);
});

test("the restore mode never reaches the paid half, whatever `spend` says", () => {
  const branch = CANARY.indexOf("if (RESTORE_ASK) {");
  const stop = CANARY.indexOf("if (RESTORE_ASK) {", branch + 1);
  const gate = CANARY.indexOf("if (!SPEND)");
  const paid = CANARY.indexOf("PAID CANARY EDIT");
  assert.ok(stop > branch, "the restore mode's stop is gone");
  assert.ok(gate > stop, "the stop sits below the spend gate");
  assert.ok(paid > gate, "the paid half's landmark moved above the gate");
  assert.match(CANARY.slice(stop, gate), /process\.exit\(/, "the restore mode's stop does not exit");
});

test("the workflow carries the mode, and a named version turns spending off", () => {
  assert.match(FLOW, /\n {6}restore_version:\n/, "the workflow has no restore_version input");
  assert.match(FLOW, /CANARY_RESTORE:\s*\$\{\{\s*github\.event\.inputs\.restore_version\s*\}\}/);
  const spend = FLOW.match(/CANARY_SPEND:.*/);
  assert.ok(spend, "CANARY_SPEND is gone from the workflow");
  assert.match(spend[0], /inputs\.restore_version == ''/, "a restore dispatch can still arm the paid half");
  assert.match(spend[0], /inputs\.read_job == ''/, "the read mode lost its own wall");
});
