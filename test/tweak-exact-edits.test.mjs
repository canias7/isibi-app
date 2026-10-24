// THE TWEAK RUNG ANSWERS WITH EXACT EDITS (2026-10-23, idea #18).
//
// Until now `write_tweak` returned the WHOLE file and the guards compared it
// with the original. Now the tool returns `{old, new}` replacements; each
// `old` must occur exactly once in the file; they apply in order; a miss is
// refused with its reason, told back to the model for ONE retry turn; and the
// existing guards (prose, route, syntax, parts, lint) read the applied file.
// The helper is the visual review's own apply loop, shared, not copied.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TWEAK_TOOL, TWEAK_RULES, TWEAK_MAX_TOKENS, tweakRequest, readTweak, runTweak } from "../builder/site-tweak.mjs";
import { applyExactEdits } from "../builder/exact-edits.mjs";
import { readReview } from "../builder/visual-review.mjs";

const PAGE = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n"
  + "function Home(){return <main>\n"
  + "  <h1 className=\"text-3xl\">Ravenscroft Bakery</h1>\n"
  + "  <section className=\"py-8\"><h2>Opening hours</h2><p>Nine until five.</p></section>\n"
  + "  <section className=\"py-8\"><h2>Find us</h2><p>Mill Lane.</p></section>\n"
  + "</main>}\n";

const answer = (input, usage = { input_tokens: 100, output_tokens: 20 }) => ({ content: [{ type: "tool_use", id: "tu1", name: TWEAK_TOOL.name, input }], usage });
const sender = (...answers) => {
  const sent = [];
  return { sent, send: async (req) => { sent.push(req); return answers[Math.min(sent.length - 1, answers.length - 1)]; } };
};

test("the request asks for edits, not the whole file, with a smaller output ceiling", () => {
  const props = TWEAK_TOOL.input_schema.properties;
  assert.ok(props.edits && props.edits.type === "array", "the tool has no edits list");
  assert.deepEqual(props.edits.items.required, ["old", "new"]);
  assert.equal(Object.hasOwn(props, "source"), false, "the tool still asks for the whole file");
  assert.ok(Object.hasOwn(props, "cannot") && Object.hasOwn(props, "question"), "cannot and question kept");
  const req = tweakRequest({ instruction: "make the heading bigger", path: "index.tsx", source: PAGE });
  assert.ok(req.max_tokens < 16000 && req.max_tokens === TWEAK_MAX_TOKENS, "the output ceiling is still the whole-page one: " + req.max_tokens);
  assert.match(TWEAK_RULES, /exact edits/);
  assert.match(TWEAK_RULES, /Do not send the whole file/);
});

test("exact edits are applied in order, and nothing outside the edited spans changes", async () => {
  const { send, sent } = sender(answer({ edits: [
    { old: "className=\"text-3xl\"", new: "className=\"text-5xl\"" },
    { old: "<section className=\"py-8\"><h2>Find", new: "<section className=\"py-4\"><h2>Find" },
  ] }));
  const r = await runTweak({ instruction: "bigger heading, tighter map", path: "index.tsx", source: PAGE, send });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(sent.length, 1);
  const want = PAGE.replace("text-3xl", "text-5xl").replace("<section className=\"py-8\"><h2>Find", "<section className=\"py-4\"><h2>Find");
  assert.equal(r.source, want);
  // Outside the two spans, byte for byte.
  const a = PAGE.indexOf("text-3xl"), b = PAGE.indexOf("py-8\"><h2>Find");
  assert.equal(r.source.slice(0, a), PAGE.slice(0, a));
  assert.equal(r.source.slice(a + 8, b), PAGE.slice(a + 8, b));
  assert.equal(r.source.slice(b + 4), PAGE.slice(b + 4));
  // In order: the second edit sees the first's result.
  const chained = applyExactEdits("a b", [{ old: "a", new: "c" }, { old: "c b", new: "d" }]);
  assert.deepEqual(chained, { ok: true, source: "d" });
});

test("an `old` that is missing is refused with its reason, fed back once, and the retry's edits land", async () => {
  const { send, sent } = sender(
    answer({ edits: [{ old: "className=\"text-4xl\"", new: "className=\"text-5xl\"" }] }),
    answer({ edits: [{ old: "className=\"text-3xl\"", new: "className=\"text-5xl\"" }] }, { input_tokens: 150, output_tokens: 30 }),
  );
  const r = await runTweak({ instruction: "bigger heading", path: "index.tsx", source: PAGE, send });
  assert.equal(sent.length, 2, "not exactly one retry turn");
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.retried, true);
  assert.equal(r.source, PAGE.replace("text-3xl", "text-5xl"));
  const turn = sent[1].messages;
  assert.equal(turn.length, 3);
  assert.equal(turn[1].role, "assistant");
  const fed = turn[2].content[0];
  assert.equal(fed.type, "tool_result");
  assert.equal(fed.tool_use_id, "tu1");
  assert.equal(fed.is_error, true);
  assert.match(fed.content, /edit 1/);
  assert.match(fed.content, /does not occur in the file/);
  assert.deepEqual([r.usage.in, r.usage.out], [250, 50], "the retry's usage was not added");
});

test("a second miss is a refusal (one retry, never a loop), with the reason named", async () => {
  const bad = answer({ edits: [{ old: "nowhere in the file", new: "x" }] });
  const { send, sent } = sender(bad, bad, bad);
  const r = await runTweak({ instruction: "x", path: "index.tsx", source: PAGE, send });
  assert.equal(sent.length, 2);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "edits");
  assert.equal(r.edit, "old-missing");
});

test("an `old` that is not unique is refused, and so said back", async () => {
  const r = readTweak(answer({ edits: [{ old: "<section className=\"py-8\">", new: "<section className=\"py-2\">" }] }), { source: PAGE });
  assert.deepEqual([r.ok, r.reason, r.edit, r.index], [false, "edits", "old-not-unique", 0]);
  const { send, sent } = sender(answer({ edits: [{ old: "className=\"py-8\"", new: "className=\"py-2\"" }] }), answer({ cannot: "no" }));
  const out = await runTweak({ instruction: "x", path: "index.tsx", source: PAGE, send });
  assert.equal(sent.length, 2);
  assert.match(sent[1].messages[2].content[0].content, /occurs more than once/);
  assert.equal(out.reason, "cannot");
});

test("the guards still read the applied file: an edit that drops content is refused", () => {
  const drop = readTweak(answer({ edits: [{ old: "<p>Nine until five.</p>", new: "" }] }), { source: PAGE });
  assert.equal(drop.ok, false);
  assert.equal(drop.reason, "reworded");
  const route = readTweak(answer({ edits: [{ old: "createFileRoute('/')", new: "createFileRoute('/home')" }] }), { source: PAGE });
  assert.equal(route.reason, "moved-route");
  const same = readTweak(answer({ edits: [{ old: "text-3xl", new: "text-3xl" }] }), { source: PAGE });
  assert.equal(same.reason, "no-change");
  assert.equal(readTweak(answer({ edits: [] }), { source: PAGE }).reason, "cannot");
  assert.equal(readTweak(answer({ source: PAGE.replace("text-3xl", "text-5xl") }), { source: PAGE }).reason, "cannot", "a whole file is not an answer any more");
});

test("one helper: the visual review and the tweak rung apply edits through applyExactEdits", () => {
  const vr = fs.readFileSync(new URL("../builder/visual-review.mjs", import.meta.url), "utf8");
  const tw = fs.readFileSync(new URL("../builder/site-tweak.mjs", import.meta.url), "utf8");
  assert.match(vr, /import \{ applyExactEdits \} from "\.\/exact-edits\.mjs"/);
  assert.match(tw, /import \{ applyExactEdits \} from "\.\/exact-edits\.mjs"/);
  assert.doesNotMatch(vr, /function occurrences\(/, "a second copy of the loop is still in the visual review");
  // And the review still refuses what it refused.
  const pages = [{ path: "index.tsx", source: PAGE }];
  const rv = (edits) => readReview({ content: [{ type: "tool_use", input: { problems: [{ route: "/", problem: "p", edits }] } }] }, { pages, reviewed: ["/"] });
  assert.equal(rv([{ old: "className=\"py-8\"", new: "x" }]).refused[0].reason, "old-not-unique");
  assert.equal(rv([{ old: "absent", new: "x" }]).refused[0].reason, "old-missing");
  assert.equal(rv([{ old: "text-3xl", new: "text-4xl" }]).pages[0].source, PAGE.replace("text-3xl", "text-4xl"));
});
