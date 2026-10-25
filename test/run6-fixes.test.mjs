// Run 6's root causes (2026-10-25, driftwood-and-daughters-5, 21:11–21:35 UTC),
// fixed in code. Supplied answers only: no model call, no network, no write.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Namespace imports, so each case fails on its own against code without the fix (the red check).
import * as AE from "../builder/addon-existing.mjs";
import * as RQ from "../builder/request.mjs";
import * as HO from "../builder/hand-over.mjs";
import { wordsIn } from "../builder/site-ask.mjs";
import * as SA from "../builder/site-add.mjs";
import { addonReplyFacts, editReplyFacts } from "../builder/site-reply.mjs";
import * as SR from "../builder/site-rules.mjs";
const { accessShortfalls, accessHandTo, readHandTo } = AE;
const { newRequest, planParts, carveParts, handCarved, jobBody, readRun } = RQ;
const { heldReport } = HO;
const { rowRequired, liveRequired, requiredColumns, LIVE_REQUIRED_SQL, rowWriteOutcome } = SA;
const { runRulesEdit, splitAlready } = SR;

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const between = (src, a, b) => {
  const i = src.indexOf(a);
  assert.ok(i >= 0, "landmark missing: " + a);
  const j = src.indexOf(b, i + a.length);
  assert.ok(j > i, "landmark missing: " + b);
  return src.slice(i, j);
};

// ── 1. an unmet need on an existing table goes to the rules step ─────────────
const MSG = "Add a Lessons page with group lessons, each bookable online with date, time and number of people, and a switch so I can mark a day closed for bad weather and no one can book it.";
const TABLES = [
  { name: "lesson_bookings", access: "collect", read: "none", write: "none", columns: [{ name: "id" }, { name: "name", notnull: true }] },
  { name: "closed_days", access: "display", columns: [{ name: "id" }, { name: "day" }] },
  { name: "lessons", access: "display", columns: [{ name: "id" }] },
];
// The live run's own two requirements (edit_jobs b133151c…, `requirements`).
const REQ = [
  { id: "component#1", status: "covered", need: "A lessons list", words: "group lessons" },
  { id: "component#3", status: "unsupported", need: "A visitor’s lesson booking is actually saved", why: "lesson_bookings is not open for visitors to write, so the form cannot store a booking until that table accepts public submissions.", words: "each bookable online with date, time and number of people" },
  { id: "component#4", status: "unsupported", need: "Closing a day for bad weather is actually saved", why: "closed_days can be shown but not written, so the bad-weather switch cannot store a closed day until that table accepts the owner’s update.", words: "a switch so I can mark a day closed for bad weather and no one can book it" },
];

test("each unsupported need naming an existing table is handed to rules, scoped to it, in the customer's own words", () => {
  const out = accessHandTo([], REQ, MSG, wordsIn, { tables: TABLES });
  assert.deepEqual(out.handTo.map((h) => [h.table, h.layer, h.words]), [
    ["lesson_bookings", "rules", "each bookable online with date, time and number of people"],
    ["closed_days", "rules", "a switch so I can mark a day closed for bad weather and no one can book it"],
  ]);
  for (const h of out.handTo) assert.ok(MSG.includes(h.words));
  assert.deepEqual(out.told, []);
});

test("a covered need, a need naming no table, and words that are the whole message are not handed on", () => {
  assert.deepEqual(accessHandTo([], [REQ[0]], MSG, wordsIn, TABLES).handTo, []);
  const noTable = [{ status: "unsupported", need: "Online payment", why: "the site takes no payment", words: "each bookable online with date, time and number of people" }];
  assert.deepEqual(accessHandTo([], noTable, MSG, wordsIn, TABLES).handTo, []);
  const whole = [{ ...REQ[1], words: MSG }];
  assert.deepEqual(accessHandTo([], whole, MSG, wordsIn, TABLES).handTo, []);
  // a table the site does not have is never named
  const other = [{ ...REQ[1], why: "bookings_x is closed" }];
  assert.deepEqual(accessHandTo([], other, MSG, wordsIn, TABLES).handTo, []);
});

test("a level the designer put on an existing table is a shortfall, read through resolveAccess", () => {
  const gaps = accessShortfalls(TABLES, [{ name: "lesson_bookings", write: "anyone" }, { name: "lessons", access: "display" }, { name: "brand_new", write: "anyone" }]);
  assert.deepEqual(gaps, [{ table: "lesson_bookings", write: "anyone" }]);
  // carried on the handed part, with one unnamed requirement as its words
  const unnamed = [{ status: "unsupported", need: "Bookings are saved", why: "the form cannot store them", words: "each bookable online with date, time and number of people" }];
  const out = accessHandTo(gaps, unnamed, MSG, wordsIn, TABLES);
  assert.deepEqual(out.handTo, [{ words: "each bookable online with date, time and number of people", layer: "rules", table: "lesson_bookings", write: "anyone" }]);
  // with no words of theirs it is told, never dropped
  assert.deepEqual(accessHandTo(gaps, [], MSG, wordsIn, TABLES), { handTo: [], told: gaps });
});

test("the request carves the handed words and runs them on rules with the table as scope, no routing", async () => {
  const rec = newRequest({ key: "rqrun6handto000000", uid: "u1", slug: "driftwood-and-daughters-5", message: MSG, accepted: { ok: true, intent: "addon" }, parts: planParts(MSG, { intent: "addon" }).parts });
  assert.ok(rec, "request made");
  const { handTo } = accessHandTo([], REQ, MSG, wordsIn, TABLES);
  // the add-on's answer, as `heldReport` writes it
  const res = await heldReport(Response.json({ ok: true, kinds: ["component"] }), handTo.map((h) => h.words), [], handTo);
  const body = await res.json();
  assert.deepEqual(readHandTo(body.handTo).map((h) => h.table), ["lesson_bookings", "closed_days"]);
  const read = readRun({ status: 200, body });
  assert.equal(read.handTo.length, 2);
  carveParts(rec, 0, read.deferred);
  handCarved(rec, 0, read.handTo);
  const handed = rec.parts.filter((p) => p.route && p.route.layer === "rules");
  assert.equal(handed.length, 2);
  for (const p of handed) {
    assert.equal(p.phase, "run");
    const jb = jobBody(rec, p.n, "run", "k" + p.n);
    assert.equal(jb.body.layer, "rules");
    assert.equal(jb.body.instruction, p.words);
    assert.deepEqual(jb.body.scope, { tables: [p.need.table] });
  }
});

test("a handTo entry whose words are not deferred, or malformed, is never read", () => {
  assert.deepEqual(readRun({ status: 200, body: { ok: true, handTo: [{ words: "x", layer: "rules", table: "t" }] } }).handTo || [], []);
  assert.deepEqual(readHandTo([{ words: "a", layer: "page", table: "t" }, { words: "a", layer: "rules", table: "bad name" }, "x"]), []);
});

test("the worker hands the shortfalls on at the success ending, through the held report", () => {
  const block = between(worker, "A LEVEL THE ADDITION NEEDED ON A TABLE IT CANNOT MOVE", "return Response.json({");
  assert.match(block, /accessHandTo\(accessShortfalls\(aSpec, aAccessDesigned\), aReq, aInstruction, wordsIn, aSpec\)/);
  assert.match(block, /aHeldOut\.parts\.push\(h\.words\)/);
  assert.match(worker, /aHeldOut\.parts, aHeldOut\.earlier, aHeldOut\.handTo\), \{/);
});

// ── 2. the columns an entry must fill come from the live table ───────────────
test("rowRequired counts truthy NOT NULL flags, as the engine writes them", () => {
  const spec = { tables: [{ name: "lessons", access: "display", columns: [{ name: "id", pk: true }, { name: "title", notnull: "yes" }, { name: "price", required: 1 }, { name: "note" }] }] };
  assert.deepEqual(rowRequired(spec).get("lessons"), ["title", "price"]);
});

test("the live catalogue decides when it answers; the spec only when it cannot be read", async () => {
  const lists = new Map([["lessons", ["id", "title", "level"]]]);
  const spec = { tables: [{ name: "lessons", access: "display", columns: [{ name: "id" }, { name: "title", notnull: true }, { name: "level" }] }] };
  let asked = "";
  const live = await requiredColumns(async (sql) => { asked = sql; return [{ table_name: "lessons", column_name: "id" }, { table_name: "lessons", column_name: "level" }, { table_name: "other", column_name: "x" }]; }, spec, lists);
  assert.equal(asked, LIVE_REQUIRED_SQL);
  assert.match(LIVE_REQUIRED_SQL, /is_nullable = 'NO'/);
  assert.match(LIVE_REQUIRED_SQL, /column_default IS NULL/);
  assert.match(LIVE_REQUIRED_SQL, /is_identity = 'NO'/);
  assert.match(LIVE_REQUIRED_SQL, /is_generated = 'NEVER'/);
  assert.deepEqual(live, { source: "live", required: new Map([["lessons", ["level"]]]) });
  const down = await requiredColumns(async () => { throw new Error("down"); }, spec, lists);
  assert.deepEqual(down, { source: "spec", required: new Map([["lessons", ["title"]]]) });
  const junk = await requiredColumns(async () => [{ table_name: 1 }], spec, lists);
  assert.equal(junk.source, "spec");
  assert.equal(liveRequired("nope", lists), null);
});

test("the worker reads the live columns on the owner connection before cleanAdd, and says Postgres's column", () => {
  const block = between(worker, "const aRowLists = adb ? rowTables(aSpec) : new Map();", "const aRowKey");
  assert.match(block, /requiredColumns\(\(q, p\) => sqlQuery\(adb, q, p\), aSpec, aRowLists\)/);
  assert.deepEqual(rowWriteOutcome({ code: "23502", column: "level" }), { outcome: "refused", code: "23502", column: "level" });
  assert.deepEqual(rowWriteOutcome({ code: "23502", column: "bad name;" }), { outcome: "refused", code: "23502" });
  assert.match(worker, /column: thrown\.column \|\| undefined,/);
});

// ── 3. the add-on reply's pages come from what changed ───────────────────────
test("pages the site already had and this addition did not touch are a fact of their own, never additions", () => {
  const body = { ok: true, kinds: ["component"], added: [], changed: ["lessons.tsx"], removed: [], cost: 29 };
  const { facts } = addonReplyFacts(body, { sitePages: ["/", "/lessons", "/board-shop", "/cafe"] });
  const text = facts.map((f) => f.text).join("\n");
  assert.match(text, /Updated \/lessons\./);
  assert.match(text, /Already on the site before this and not changed by it: \/, \/board-shop and \/cafe\./);
  assert.doesNotMatch(text, /Added \/board-shop|Updated \/board-shop|Updated \/cafe/);
  // no page list, no fact (the observer is alive above)
  assert.doesNotMatch(addonReplyFacts(body).facts.map((f) => f.text).join("\n"), /Already on the site/);
  assert.match(worker, /sitePages: Array\.isArray\(ask\.pages\) \? ask\.pages : null/);
});

// ── 4. rules: already so is done at no cost; a no-match is never billed ──────
const said = (input) => ({ content: [{ type: "tool_use", name: "write_table_rules", input }], usage: { input_tokens: 100, output_tokens: 10 } });
const RT = [{ name: "bookings", access: "collect", columns: [{ name: "id" }, { name: "name" }] }];

test("a requested level equal to the current one is satisfied, applies nothing and is never billed", async () => {
  let before = 0, applied = 0, sent = 0;
  const out = await runRulesEdit({
    send: async () => { sent++; return said({ tables: [{ table: "bookings", read: "none" }] }); },
    before: async () => { before++; return true; },
    apply: async () => { applied++; return {}; },
  }, { instruction: "Only I should see bookings", tables: RT });
  assert.equal(out.ok, true);
  assert.equal(out.satisfied, true);
  assert.deepEqual(out.already, [{ table: "bookings", fields: ["read"], read: "none" }]);
  assert.equal(before, 0);
  assert.equal(applied, 0);
  assert.equal(sent, 1);
  const { facts } = editReplyFacts({ ok: true, satisfied: true, layer: "rules", applied: [], already: out.already, cost: 0 });
  const text = facts.map((f) => f.text).join("\n");
  assert.match(text, /Already so on bookings/);
  assert.match(text, /only the owner/);
});

test("a real change beside an already-true one applies only the change", () => {
  const { changes, already } = splitAlready([{ table: "bookings", read: "none", write: "members" }], RT);
  assert.deepEqual(changes, [{ table: "bookings", write: "members" }]);
  assert.deepEqual(already, [{ table: "bookings", fields: ["read"], read: "none" }]);
});

test("the rules route answers satisfied at cost 0 and never bills a no-match", () => {
  const block = between(worker, "const rOut = await runRulesEdit({", 'if (eLayer === "rename")');
  assert.match(block, /rOut\.ok && rOut\.satisfied === true[\s\S]{0,400}cost: 0/);
  assert.match(block, /rOut\.reason === "no-match" \? 0 : await eCharge\(rOut\.usage\)/);
});

test("a refunded reserve is said as given back, from the ledger's answer", () => {
  const { facts } = editReplyFacts({ ok: false, error: "no-match", cost: 0, refunded: 2, msg: "Nothing there was a rule I could change." });
  const text = facts.map((f) => f.text).join("\n");
  assert.match(text, /This change cost them nothing\./);
  assert.match(text, /Given back: (2|two) credits held for this change\./);
});
