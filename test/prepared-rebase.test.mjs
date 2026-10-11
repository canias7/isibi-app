// THE RE-BASE RULES, ONE BY ONE (2026-10-11): a prepared text or data answer
// is carried onto a site changed only outside its declared scope, and refused
// on every other difference. Pure: the requests are built by the steps' own
// builders (`textRequest`, `dataRequest`).
import test from "node:test";
import assert from "node:assert/strict";
import { textRequest, dataRequest } from "../builder/site-apply.mjs";
import { rebaseText, rebaseData, rebaserFor, fileOfPagePath } from "../builder/prepared-rebase.mjs";
import { decidingOf, replayer, recorder } from "../builder/prepared.mjs";

const items = (rows) => rows.map(([path, text]) => ({ path, text }));
const SITE = [["index.tsx", "Harbour Loaf"], ["visit.tsx", "Come to the bakery"], ["visit.tsx", "We are on Harbour Street."], ["about.tsx", "Our story"], ["about.tsx", "Open from 9 on weekdays."]];
const ASK = "on the About page say we open from 8 on weekdays";
const tq = (rows, instruction = ASK) => decidingOf(textRequest({ instruction, items: items(rows) }));
const textReply = (edits, extra = {}) => ({ stop_reason: "tool_use", usage: { input_tokens: 9, output_tokens: 3 }, content: [{ type: "tool_use", id: "t", name: "write_text_edits", input: { edits, ...extra } }] });
const ABOUT = ["about.tsx"];

test("text: another page's line changed and the list grew — the answer is re-pointed at the same About line", () => {
  const was = tq(SITE);
  const now = tq([["index.tsx", "Harbour Loaf"], ["visit.tsx", "Come to the harbour bakery"], ["visit.tsx", "Fresh every day"], ["visit.tsx", "We are on Harbour Street."], ["about.tsx", "Our story"], ["about.tsx", "Open from 9 on weekdays."]]);
  const out = rebaseText(was, textReply([{ id: 4, to: "Open from 8 on weekdays." }]), now, ABOUT);
  assert.ok(out, "refused a change that touched only another page");
  assert.deepEqual(out.content[0].input.edits, [{ id: 5, to: "Open from 8 on weekdays." }]);
  assert.equal(out.usage.input_tokens, 9, "the answer's usage was not kept for the job's bill");
});

test("text: every refusal — the scoped page changed, an edit outside the scope, a question, other words, another frame, a clash, no scope", () => {
  const was = tq(SITE);
  const ok = textReply([{ id: 4, to: "Open from 8 on weekdays." }]);
  const swap = (i, t) => SITE.map((r, k) => (k === i ? [r[0], t] : r));
  assert.equal(rebaseText(was, ok, tq(swap(3, "Our long story")), ABOUT), null, "the scoped page changed");
  assert.equal(rebaseText(was, textReply([{ id: 1, to: "x" }]), tq(swap(0, "Loaf")), ABOUT), null, "an edit outside the scope");
  assert.equal(rebaseText(was, textReply([{ id: 4, to: "y" }], { question: "which?" }), tq(swap(0, "Loaf")), ABOUT), null, "a question");
  assert.equal(rebaseText(was, ok, tq(swap(0, "Loaf"), "something else"), ABOUT), null, "other words");
  const other = { ...tq(swap(0, "Loaf")), max_tokens: 1 };
  assert.equal(rebaseText(was, ok, other, ABOUT), null, "another frame");
  assert.equal(rebaseText(was, ok, tq(swap(1, "Open from 9 on weekdays — come by")), ABOUT), null, "a change elsewhere carrying the words it changes");
  assert.equal(rebaseText(was, ok, tq(swap(1, "Open from 8 on weekdays")), ABOUT), null, "a change elsewhere carrying the words it writes");
  assert.equal(rebaseText(was, ok, tq(swap(0, "Loaf")), []), null, "no scope");
  assert.ok(rebaseText(was, ok, tq(swap(0, "Loaf")), ABOUT), "CONTROL: an unrelated change elsewhere re-bases");
});

const tables = (opens, price) => [
  { name: "hours", columns: ["day", "opens"], rows: [{ id: 1, day: "Monday", opens }] },
  { name: "loaves", columns: ["name", "price"], rows: [{ id: 2, name: "Dark Rye", price }] },
];
const dq = (t, instruction = "make the Dark Rye £5.50") => decidingOf(dataRequest({ instruction, tables: t, recent: [], lists: [] }));
const dataReply = (changes, extra = {}) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "d", name: "write_row_changes", input: { changes, ...extra } }] });

test("data: another table changed — the answer is the same answer; every refusal held", () => {
  const was = dq(tables("09:00", 5.2));
  const rye = dataReply([{ table: "loaves", id: 2, values: { price: 5.5 } }]);
  assert.equal(rebaseData(was, rye, dq(tables("08:00", 5.2)), ["loaves"]), rye, "refused a change to another table");
  assert.equal(rebaseData(was, rye, dq(tables("09:00", 5.3)), ["loaves"]), null, "the scoped table changed");
  assert.equal(rebaseData(was, dataReply([{ table: "hours", id: 1, values: { opens: "07:00" } }]), dq(tables("08:00", 5.2)), ["loaves"]), null, "an answer outside the scope");
  assert.equal(rebaseData(was, { ...rye, stop_reason: "max_tokens" }, dq(tables("08:00", 5.2)), ["loaves"]), null, "an answer cut at its limit");
  assert.equal(rebaseData(was, rye, dq(tables("08:00", 5.2), "other words"), ["loaves"]), null, "other words");
  assert.equal(rebaseData(was, dataReply([{ table: "loaves", id: 2, values: { name: "Monday Rye" } }]), dq(tables("Monday Rye", 5.2)), ["loaves"]), null, "a change elsewhere carrying what it writes");
  assert.equal(rebaseData(was, dataReply([{ table: "loaves", id: 2, values: { price: 5.5 } }], { question: "?" }), dq(tables("08:00", 5.2)), ["loaves"]), null, "a question");
});

test("rebaserFor and the replayer: a scope picks the step's rule; an exact match wins first; a re-base is counted apart; no scope, no re-base", async () => {
  assert.equal(fileOfPagePath("/"), "index.tsx");
  assert.equal(fileOfPagePath("/about/team"), "about.team.tsx");
  assert.equal(rebaserFor(null), null);
  assert.equal(rebaserFor({ pages: [], tables: [] }), null);
  const rec = recorder();
  const answer = textReply([{ id: 4, to: "Open from 8 on weekdays." }]);
  await rec.wrap(async () => answer)(textRequest({ instruction: ASK, items: items(SITE) }));
  const stored = JSON.parse(JSON.stringify({ calls: rec.calls, images: [] }));
  assert.ok(stored.calls[0].q, "the recorded call does not keep its request");
  let live = 0;
  const send = async () => { live++; return textReply([]); };
  const changed = textRequest({ instruction: ASK, items: items([["index.tsx", "Loaf"], ...SITE.slice(1)]) });
  const scoped = replayer(stored, { rebase: rebaserFor({ pages: ["/about"] }) });
  const got = await scoped.wrap(send)(changed);
  assert.equal(live, 0, "a re-basable answer was asked of the model");
  assert.deepEqual(got.content[0].input.edits, [{ id: 4, to: "Open from 8 on weekdays." }]);
  assert.deepEqual(scoped.used(), { calls: 0, rebased: 1, images: 0, missed: 0 });
  const plain = replayer(stored);
  await plain.wrap(send)(changed);
  assert.equal(live, 1, "without a scope the job must ask");
  assert.deepEqual(plain.used(), { calls: 0, rebased: 0, images: 0, missed: 1 });
});

test("prepScope: a text step's named pages and a data step's named tables — and null whenever the reach is not declared that narrowly", async () => {
  const { prepScope, stepInputs } = await import("../builder/request-plan.mjs");
  const part = (layer, writes, page, extra = {}) => ({ n: 1, needs: [], phase: "run", status: "ready", route: { intent: "edit", layer, ...(page ? { page } : {}) }, targets: { writes, reads: [] }, ...extra });
  assert.deepEqual(prepScope(part("text", ["page:/about"], "/about")), { pages: ["/about"] });
  assert.deepEqual(stepInputs(part("text", ["page:/about"], "/about")), ["page:/about"]);
  assert.deepEqual(prepScope(part("data", ["data:loaves"])), { tables: ["loaves"] });
  assert.equal(prepScope(part("text", ["page:/about"], "/visit")), null, "a route naming another page than its targets");
  assert.equal(prepScope(part("text", ["page:/about", "header"], "/about")), null, "a write beyond pages");
  assert.equal(prepScope(part("text", [], "/about")), null, "nothing named");
  assert.deepEqual(stepInputs(part("text", [], "/about")), ["pages"]);
  assert.equal(prepScope(part("data", ["data:loaves", "menu"])), null, "a write beyond tables");
  assert.equal(prepScope(part("rules", ["data:loaves"])), null, "rules are never narrowed");
  assert.equal(prepScope(part("look", ["identity"])), null);
  assert.equal(prepScope({ ...part("text", ["page:/about"], "/about"), phase: "route" }), null, "a part still to be routed");
});
