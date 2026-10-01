// The canary's add-on press (2026-10-01): it posts the router's `addon` answer
// to the add-on route only when the press's expected route says
// `intent=addon`, and every other press is refused or posted exactly as before.
//
// THE REAL SCRIPT, END TO END, under the in-process network stub
// (`fixtures/canary-stub.mjs`): which calls were made is read off the wire
// log, never off the script's own words. The add-on job's stored reply is the
// shape the add-on route really returns for an entry it saved
// (`test/addon-row.test.mjs` drives the route itself).
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readExpectRoute, routeVerdict } from "../scripts/canary-route.mjs";
import { rowUncertainBody } from "../builder/site-add.mjs";
// THE NEW MODULE IS IMPORTED WHERE IT IS USED, so the script runs below also
// load on the canary before it — the red check reads them against the old one.
const ca = () => import("../scripts/canary-addon.mjs");

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASK = "Add one loaf to today's loaves: Rye & Caraway at £5.00, described as \"A light rye with toasted caraway.\"";
const SAVED = { table: "loaves", id: 12, label: "Rye & Caraway", row: { id: 12, name: "Rye & Caraway", description: "A light rye with toasted caraway.", price: 5, photo: null, created_at: "2026-10-01T03:00:00+00:00" } };
const ROW_REPLY = { ok: true, kinds: ["row"], rows: [SAVED], added: [], changed: [], removed: [], moved: [], cost: 2 };
const REFUSED = { ok: false, error: "add", kind: "row", reason: "row-no-table", cost: 0, msg: "This site doesn't store a list by that name, so that entry had nowhere to go. Nothing was added." };
// NOT KNOWING, FROM ITS REAL PRODUCER (the step's own body): queued, so the job
// is under review; inline, nothing charged.
const UNSURE = rowUncertainBody({ why: "lost", review: true });
const UNSURE_INLINE = rowUncertainBody({ why: "unread" });

// ─────────────────────────────────────────────────────────────────────────────
// THE PIECES
// ─────────────────────────────────────────────────────────────────────────────

test("only the route box's own `intent=addon` asks for the add-on press", async () => {
  const { expectsAddon } = await ca();
  assert.equal(expectsAddon(readExpectRoute("intent=addon").expect), true);
  assert.equal(expectsAddon(readExpectRoute("intent=addon alsoAsked=none").expect), true);
  assert.equal(expectsAddon(readExpectRoute("intent=edit layer=data").expect), false);
  assert.equal(expectsAddon(readExpectRoute("").expect), false, "a blank box asked for an addition");
  assert.equal(expectsAddon(null), false);
  assert.equal(expectsAddon({ intent: ["addon"] }), false, "a non-string intent was read as the add-on step");
  // AND THE ROUTER'S ANSWER IS STILL HELD TO THE BOX: an edit is a mismatch.
  assert.equal(routeVerdict(readExpectRoute("intent=addon").expect, { intent: "edit", layer: "data" }).ok, false);
  assert.equal(routeVerdict(readExpectRoute("intent=addon").expect, { intent: "addon" }).ok, true);
});

test("the add-on POST is the browser's: instruction, retry key, zone, what was held back — no layer, no model", async () => {
  const { addonBody } = await ca();
  const b = addonBody({ instruction: ASK, idem: "k".repeat(32), tz: "UTC", alsoAsked: "" });
  assert.deepEqual(Object.keys(b).filter((k) => b[k] !== undefined), ["instruction", "idem", "tz"]);
  assert.equal(addonBody({ instruction: ASK, idem: "x", alsoAsked: "and the band" }).alsoAsked, "and the band");
  // THE BROWSER'S OWN BODY, cut from chat.js, carries the same keys (its
  // `picker` is the customer's chosen model, which the canary leaves to the
  // platform default exactly as its edit POST does).
  const chat = readFileSync(path.join(REPO, "public/chat.js"), "utf8");
  const at = chat.indexOf("function siteAddon(");
  const body = chat.slice(at, chat.indexOf("\n}\n", at));
  for (const k of ["instruction", "idem", "tz", "alsoAsked"]) assert.match(body, new RegExp("\\b" + k + ":"), "the browser's add-on body no longer sends " + k);
});

test("an entry-only addition publishes nothing; a page it wrote does", async () => {
  const { addonPages, addonPublished, savedSaid } = await ca();
  assert.deepEqual(addonPages(ROW_REPLY), []);
  assert.equal(addonPublished(ROW_REPLY), false);
  assert.equal(addonPublished({ ok: true, added: [], changed: ["order.tsx"] }), true);
  assert.equal(addonPublished({ ok: false, changed: ["order.tsx"] }), false, "a refusal counted as a publish");
  assert.equal(savedSaid(ROW_REPLY), "loaves #12 “Rye & Caraway”");
  assert.equal(savedSaid({ rows: [{ table: "menu", id: null, label: "" }] }), "menu");
});

const VERIFIED = { verified: true, sentence: "VERIFIED — the edit did not publish, and every page still reports 01790404806543-kk6qsh, the version the before-read saw" };
const UNVERIFIED = { verified: false, sentence: "UNVERIFIED — the site moved on to 01790404906543-zzzzzz, a later version than this job's 01790404806543-kk6qsh, so this job's pages could not be read" };
const PAGELESS = { ok: true, kinds: ["job"], skipped: [], added: [], changed: [], removed: [], moved: [], functions: [], jobs: [{ name: "daily_reminder", everyMinutes: 1440 }], cost: 3 };

test("the verdict: an ok answer passes only with a verified after-read, and says what was saved", async () => {
  const { addonVerdict } = await ca();
  assert.deepEqual(addonVerdict(ROW_REPLY, VERIFIED), { pass: true, line: "CANARY PASSED: the add-on step answered ok — saved loaves #12 “Rye & Caraway”; no page published; cost=2" });
  assert.equal(addonVerdict(REFUSED, VERIFIED).pass, false);
  assert.match(addonVerdict(REFUSED, VERIFIED).line, /^CANARY FAILED: the add-on step answered "add" — This site doesn't store/);
  assert.equal(addonVerdict(null, VERIFIED).pass, false);
  assert.match(addonVerdict({ ...ROW_REPLY, repeat: true }, VERIFIED).line, /a repeat of a request already saved/);
  // THE AFTER-READ DECIDES WITH THE ANSWER (the review of f6532d66).
  const off = addonVerdict(ROW_REPLY, UNVERIFIED);
  assert.equal(off.pass, false, "an unverified after-read passed");
  assert.match(off.line, /^CANARY FAILED: the add-on step answered ok — saved loaves #12 “Rye & Caraway”; no page published; cost=2 — but the after-read did not verify: UNVERIFIED — the site moved on/);
  for (const missing of [undefined, null, {}, { verified: "true" }, { verified: 1 }]) {
    assert.equal(addonVerdict(ROW_REPLY, missing).pass, false, "an after-read of " + JSON.stringify(missing) + " passed");
  }
  assert.match(addonVerdict(ROW_REPLY).line, /UNVERIFIED — no after-read verdict was given/);
  // A PAGELESS ADDITION THAT VERIFIED PASSES AS BEFORE; UNVERIFIED, IT DOES NOT.
  assert.deepEqual(addonVerdict(PAGELESS, VERIFIED), { pass: true, line: "CANARY PASSED: the add-on step answered ok — no entry saved; no page published; cost=3" });
  assert.equal(addonVerdict(PAGELESS, UNVERIFIED).pass, false);
});

test("an answer that could not tell whether it saved fails, and is never called a round trip that added nothing", async () => {
  const { addonVerdict } = await ca();
  // THE REVIEW OF 31741f6f: the line for every terminal answer said "a
  // completed round trip that added nothing" — false for an entry whose save
  // the step could not confirm.
  for (const [body, paused] of [[UNSURE, true], [UNSURE_INLINE, false]]) {
    const v = addonVerdict(body, VERIFIED);
    assert.equal(v.pass, false);
    assert.doesNotMatch(v.line, /added nothing/, v.line);
    assert.match(v.line, /^CANARY FAILED: the add-on step answered "row-uncertain" — /);
    assert.match(v.line, /could not tell whether its change was saved, so it may be on the site/);
    assert.equal(/takes no new change until the review settles it/.test(v.line), paused, v.line);
    assert.match(v.line, /Read the site before anything else is pressed; do not read it as a pass\.$/);
  }
  // ANY JOB PARKED FOR REVIEW IS THE SAME KIND OF ANSWER, whatever its error.
  const parked = addonVerdict({ ok: false, error: "stopped", review: true, msg: "That edit stopped while it was publishing." }, VERIFIED);
  assert.equal(parked.pass, false);
  assert.doesNotMatch(parked.line, /added nothing/);
  // A REFUSAL STILL IS ONE: nothing added, and said so.
  assert.match(addonVerdict(REFUSED, VERIFIED).line, /This is a completed round trip that added nothing\./);
  assert.match(addonVerdict({ ok: false, error: "row-unprotected", msg: "nothing was added" }, VERIFIED).line, /added nothing/);
});

test("an entries-only success that shows no saved entry fails, whatever the after-read says", async () => {
  const { addonVerdict, entriesOnly, savedEntries } = await ca();
  assert.equal(entriesOnly(ROW_REPLY), true);
  assert.equal(entriesOnly(PAGELESS), false);
  assert.equal(entriesOnly({ ...ROW_REPLY, kinds: ["row", "job"] }), false);
  assert.equal(savedEntries(ROW_REPLY), true);
  for (const [why, body] of [
    ["an empty list", { ...ROW_REPLY, rows: [] }],
    ["no list", (({ rows, ...rest }) => rest)(ROW_REPLY)],
    ["a list that is not one", { ...ROW_REPLY, rows: "loaves #12" }],
    ["an entry with no table", { ...ROW_REPLY, rows: [{ ...SAVED, table: "" }] }],
    ["an entry with no saved row", { ...ROW_REPLY, rows: [{ ...SAVED, row: null }] }],
    ["one good entry beside one that is not", { ...ROW_REPLY, rows: [SAVED, { table: "loaves", id: 13 }] }],
  ]) {
    assert.equal(savedEntries(body), false, why);
    const v = addonVerdict(body, VERIFIED);
    assert.equal(v.pass, false, why + " passed");
    assert.match(v.line, /^CANARY FAILED: the add-on step answered ok for an entry and reported no saved entry it can show/, why);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// THE REAL SCRIPT
// ─────────────────────────────────────────────────────────────────────────────

function runCanary(name, { route, box = "", addon = null, addonStatus = 200, afterVersion = "" } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "canary-addon-" + name + "-"));
  const logFile = path.join(dir, "wire.jsonl");
  writeFileSync(logFile, "");
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME,
    OWNER_EMAIL: "owner@example.com", SUPABASE_SERVICE_KEY: "stub-key", SUPABASE_URL: "https://stub.supabase.test",
    OWNER_BASE_URL: "https://stub.worker.test", CANARY_SLUG: "stub-site", CONTROL_SLUG: "",
    CANARY_SPEND: "1", CANARY_INSTRUCTION: ASK, CANARY_EXPECT_ROUTE: box,
    CANARY_EVIDENCE_DIR: path.join(dir, "evidence"),
    STUB_LOG: logFile, STUB_ROUTE: JSON.stringify(route),
    ...(addon ? { STUB_ADDON: JSON.stringify(addon), STUB_ADDON_STATUS: String(addonStatus) } : {}),
    ...(afterVersion ? { STUB_AFTER_VERSION: afterVersion } : {}),
  };
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["--import", path.join(REPO, "test/fixtures/canary-stub.mjs"), "scripts/edit-canary.mjs"], { cwd: REPO, env });
    let out = "", err = "";
    const kill = setTimeout(() => p.kill("SIGKILL"), 120_000);
    p.stdout.on("data", (c) => { out += c; });
    p.stderr.on("data", (c) => { err += c; });
    p.on("close", (code) => {
      clearTimeout(kill);
      const wire = readFileSync(logFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
      const ev = (f) => (existsSync(path.join(dir, "evidence", f)) ? readFileSync(path.join(dir, "evidence", f), "utf8") : null);
      resolve({
        code, out, err, wire,
        unknown: wire.filter((w) => w.status === 599),
        addonPosts: wire.filter((w) => w.method === "POST" && w.path === "/api/site/stub-site/addon"),
        paidEdits: wire.filter((w) => w.path === "/api/site/stub-site/edit" && w.body && JSON.parse(w.body).instruction),
        routing: wire.filter((w) => w.path === "/api/site/route").length,
        compare: ev("compare.json") ? JSON.parse(ev("compare.json")) : null,
        customer: ev("customer-reply.txt"),
      });
    });
  });
}

test("expecting `intent=addon`: the router's addon answer is posted to the add-on route, watched, read and judged", { timeout: 150_000 }, async () => {
  const r = await runCanary("pass", { route: { ok: true, intent: "addon", cost: 2 }, box: "intent=addon alsoAsked=none", addon: ROW_REPLY });
  assert.equal(r.unknown.length, 0, "the stub was asked something it has no answer for: " + JSON.stringify(r.unknown));
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.routing, 1);
  assert.equal(r.addonPosts.length, 1, "the add-on route was not posted exactly once");
  const sent = JSON.parse(r.addonPosts[0].body);
  assert.equal(sent.instruction, ASK);
  assert.match(sent.idem, /^[0-9a-f]{32}$/);
  assert.equal(sent.layer, undefined, "the add-on POST carried an edit layer");
  assert.equal(r.paidEdits.length, 0, "a paid edit was posted beside the addition");
  assert.match(r.out, /the route matches the expectation \(intent=addon alsoAsked=none\)/);
  assert.match(r.out, /WHAT THE CUSTOMER READS\n  ✅ Done — added “Rye & Caraway” to loaves \(entry 12\)\./);
  assert.equal(r.customer, "✅ Done — added “Rye & Caraway” to loaves (entry 12).");
  assert.match(r.out, /saved       loaves #12 “Rye & Caraway”/);
  // NOTHING WAS PUBLISHED, AND THE AFTER-READ SAYS SO OF EVERY PAGE.
  assert.match(r.out, /VERIFIED — the edit did not publish, and every page still reports 01790404806543-kk6qsh/);
  assert.equal(r.compare.step, "addon");
  assert.equal(r.compare.comparison.verified, true);
  assert.ok("stored" in r.compare, "the stored description was not compared");
  assert.match(r.out, /CANARY PASSED: the add-on step answered ok — saved loaves #12 “Rye & Caraway”; no page published; cost=2/);
});

test("without `intent=addon` in the box, an addon answer is refused as before: no add-on POST, no edit", { timeout: 150_000 }, async () => {
  const r = await runCanary("unasked", { route: { ok: true, intent: "addon", cost: 2 }, box: "", addon: ROW_REPLY });
  assert.equal(r.code, 1, r.out + r.err);
  assert.match(r.err, /REFUSING TO SPEND: the router did not name an edit layer/);
  assert.doesNotMatch(r.err, /Nor did it answer the add-on step/);
  assert.equal(r.addonPosts.length, 0, "an unasked-for addition was posted");
  assert.equal(r.paidEdits.length, 0);
});

test("expecting `intent=addon` and answered an edit: refused by the route check, nothing posted", { timeout: 150_000 }, async () => {
  const r = await runCanary("edit-answer", { route: { ok: true, intent: "edit", layer: "data", cost: 2 }, box: "intent=addon", addon: ROW_REPLY });
  assert.equal(r.code, 1, r.out + r.err);
  assert.match(r.err, /REFUSING TO POST THE EDIT: not the route this press expected — intent: expected addon, the router answered edit/);
  assert.equal(r.addonPosts.length, 0);
  assert.equal(r.paidEdits.length, 0, "an edit was posted on a press that expected an addition");
});

test("expecting `intent=addon` and answered neither: refused, and the refusal names the add-on step", { timeout: 150_000 }, async () => {
  const r = await runCanary("ask-answer", { route: { ok: true, intent: "ask", answer: "Yes.", cost: 2 }, box: "intent=addon", addon: ROW_REPLY });
  assert.equal(r.code, 1, r.out + r.err);
  assert.match(r.err, /REFUSING TO SPEND: the router did not name an edit layer[\s\S]*Nor did it answer the add-on step this press expects\./);
  assert.equal(r.addonPosts.length, 0);
  assert.equal(r.paidEdits.length, 0);
});

test("an addition the step refused is a failed press, read through the add route's own composer", { timeout: 150_000 }, async () => {
  const r = await runCanary("refused", { route: { ok: true, intent: "addon", cost: 2 }, box: "intent=addon", addon: REFUSED, addonStatus: 422 });
  assert.equal(r.code, 1, r.out + r.err);
  assert.equal(r.addonPosts.length, 1);
  assert.equal(r.customer, "⚠️ " + REFUSED.msg);
  assert.match(r.err, /CANARY FAILED: the add-on step answered "add"/);
});

test("an addition whose save could not be confirmed fails and exits 1, and its line says it may be on the site", { timeout: 150_000 }, async () => {
  const r = await runCanary("unsure", { route: { ok: true, intent: "addon", cost: 2 }, box: "intent=addon", addon: UNSURE, addonStatus: 409 });
  assert.equal(r.unknown.length, 0, JSON.stringify(r.unknown));
  assert.equal(r.addonPosts.length, 1);
  assert.equal(r.code, 1, r.out + r.err);
  assert.equal(r.customer, "⚠️ " + UNSURE.msg);
  assert.match(r.err, /CANARY FAILED: the add-on step answered "row-uncertain" — I couldn't tell whether that entry was saved/);
  assert.match(r.err, /so it may be on the site, and the site takes no new change until the review settles it/);
  assert.doesNotMatch(r.out + r.err, /added nothing|CANARY PASSED/);
});

// ── THE AFTER-READ AND THE SAVED ENTRIES DECIDE THE PRESS (2026-10-01) ──────
//
// The review of f6532d66: in the add-on branch the after-read's verdict was
// printed and then ignored — the press exited 0 on any ok answer — and an ok
// answer for an entry that carried no saved entry passed. Both now fail the
// press, through the real script, and a pageless addition that verified still
// passes.

test("an add-on press whose after-read does not verify fails and exits 1", { timeout: 150_000 }, async () => {
  // A PUBLISH LANDS UNDER THE PRESS: every page reports a later version than
  // the before-read's, which an addition that published nothing cannot explain.
  const r = await runCanary("after-unverified", { route: { ok: true, intent: "addon", cost: 2 }, box: "intent=addon", addon: ROW_REPLY, afterVersion: "01790404906543-zzzzzz" });
  assert.equal(r.unknown.length, 0, JSON.stringify(r.unknown));
  assert.equal(r.addonPosts.length, 1);
  assert.equal(r.paidEdits.length, 0);
  assert.equal(r.compare.comparison.verified, false);
  assert.equal(r.compare.comparison.why, "superseded");
  assert.match(r.out, /comparison  UNVERIFIED — the site moved on to 01790404906543-zzzzzz/);
  assert.equal(r.code, 1, "an unverified add-on press exited " + r.code + "\n" + r.out + r.err);
  assert.match(r.err, /CANARY FAILED: the add-on step answered ok — saved loaves #12 “Rye & Caraway”; no page published; cost=2 — but the after-read did not verify: UNVERIFIED — the site moved on to 01790404906543-zzzzzz/);
  assert.doesNotMatch(r.out + r.err, /CANARY PASSED/);
});

test("an entries-only success with no saved entry fails and exits 1, though the after-read verified", { timeout: 150_000 }, async () => {
  const r = await runCanary("no-rows", { route: { ok: true, intent: "addon", cost: 2 }, box: "intent=addon", addon: { ...ROW_REPLY, rows: [] } });
  assert.equal(r.unknown.length, 0, JSON.stringify(r.unknown));
  assert.equal(r.addonPosts.length, 1);
  assert.equal(r.compare.comparison.verified, true, "this case needs a verified after-read to test the entries alone");
  assert.equal(r.code, 1, "a success with no saved entry exited " + r.code + "\n" + r.out + r.err);
  assert.match(r.err, /CANARY FAILED: the add-on step answered ok for an entry and reported no saved entry it can show — no entry saved; no page published; cost=2/);
  assert.doesNotMatch(r.out + r.err, /CANARY PASSED/);
});

test("a pageless addition that verified still passes: no entry, no page, exit 0", { timeout: 150_000 }, async () => {
  const r = await runCanary("pageless", { route: { ok: true, intent: "addon", cost: 2 }, box: "intent=addon", addon: PAGELESS });
  assert.equal(r.unknown.length, 0, JSON.stringify(r.unknown));
  assert.equal(r.addonPosts.length, 1);
  assert.equal(r.paidEdits.length, 0);
  assert.equal(r.compare.comparison.verified, true);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /CANARY PASSED: the add-on step answered ok — no entry saved; no page published; cost=3/);
  assert.ok(r.customer && !/^could not compose/.test(r.customer), "the customer's screen was not composed: " + r.customer);
});
