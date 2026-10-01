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
// THE NEW MODULE IS IMPORTED WHERE IT IS USED, so the script runs below also
// load on the canary before it — the red check reads them against the old one.
const ca = () => import("../scripts/canary-addon.mjs");

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASK = "Add one loaf to today's loaves: Rye & Caraway at £5.00, described as \"A light rye with toasted caraway.\"";
const SAVED = { table: "loaves", id: 12, label: "Rye & Caraway", row: { id: 12, name: "Rye & Caraway", description: "A light rye with toasted caraway.", price: 5, photo: null, created_at: "2026-10-01T03:00:00+00:00" } };
const ROW_REPLY = { ok: true, kinds: ["row"], rows: [SAVED], added: [], changed: [], removed: [], moved: [], cost: 2 };
const REFUSED = { ok: false, error: "add", kind: "row", reason: "row-no-table", cost: 0, msg: "This site doesn't store a list by that name, so that entry had nowhere to go. Nothing was added." };

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

test("the verdict: only an ok answer passes, and it says what was saved", async () => {
  const { addonVerdict } = await ca();
  assert.deepEqual(addonVerdict(ROW_REPLY), { pass: true, line: "CANARY PASSED: the add-on step answered ok — saved loaves #12 “Rye & Caraway”; no page published; cost=2" });
  assert.equal(addonVerdict(REFUSED).pass, false);
  assert.match(addonVerdict(REFUSED).line, /^CANARY FAILED: the add-on step answered "add" — This site doesn't store/);
  assert.equal(addonVerdict(null).pass, false);
  assert.match(addonVerdict({ ...ROW_REPLY, repeat: true }).line, /a repeat of a request already saved/);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE REAL SCRIPT
// ─────────────────────────────────────────────────────────────────────────────

function runCanary(name, { route, box = "", addon = null, addonStatus = 200 } = {}) {
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
