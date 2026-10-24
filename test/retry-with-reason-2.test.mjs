// RETRY WITH THE CHECK'S OWN REASON, ROUND 2 (owner, 2026-10-24): "a task must
// never fail completely without at least one retry" — small AI imperfections
// are fine; a whole failed task is not.
//
// Each newly covered check, through its real entry point with supplied
// answers: the first answer fails → one retry, the SAME request (same model,
// same effort, same tools) with the model's answer and the reason appended,
// and the retry's answer is used; fail twice → the existing refusal; pass →
// no retry. And the charging rule: a step that still ends refused after its
// retry charges no more than it did before retries (its first call only).
// The route-level cases are in `edit-removal-door.test.mjs` ("ROUND 2"),
// `addon-route.test.mjs` ("RETRY") and `addon-judgment.test.mjs` (JUDGE 6/13).
import test from "node:test";
import assert from "node:assert/strict";
import { withReasonRetry, recordCall, retryRequest } from "../builder/retry-reason.mjs";
import { pickLanes, pickScopeReason, runLane, reaskLane, LOOK_DECLINED_REASON } from "../builder/site-lanes.mjs";
import { runNavEdit } from "../builder/site-nav.mjs";
import { runJudge } from "../builder/site-add.mjs";
import { publishPages, pageCredits } from "../builder/publish-pages.mjs";
import { toXaiRequest } from "../builder/model-xai.mjs";

function sameButTurns(first, second) {
  const { messages: m1, ...rest1 } = first;
  const { messages: m2, ...rest2 } = second;
  assert.deepEqual(rest2, rest1, "the retry changed something other than the messages (model, effort, tools)");
  assert.equal(m2.length, m1.length + 2, "not exactly the previous answer and the reason appended");
  assert.deepEqual(m2.slice(0, m1.length), m1, "the first request's turns were not kept");
  assert.equal(m2[m1.length].role, "assistant");
  assert.equal(m2[m1.length + 1].role, "user");
  return (m2[m1.length + 1].content || []).map((b) => (b && (b.content || b.text)) || "").join(" ");
}

// ── THE CHARGING RULE ────────────────────────────────────────────────────────

test("CHARGE: a step still refused after its retry carries its first call's usage only; one that passes carries both", async () => {
  const run = async (d) => { const r = await d.send({ model: "m", effort: "low", messages: [] }); return r; };
  const replies = (xs) => { const l = xs.slice(); return { send: async () => l.shift() }; };
  const refused = await withReasonRetry({ step: "s", deps: replies([{ ok: false, usage: { in: 5 } }, { ok: false, usage: { in: 7 } }]), run, reasonOf: (r) => (r.ok ? null : { code: "c", text: "t" }) });
  assert.deepEqual(refused.usage, { in: 5 }, "a refused step was charged for its retry");
  assert.deepEqual(refused.retryUsage, { in: 7 });
  // PASSES THE CHECK BUT THE STEP STILL ENDS REFUSED (another refusal): first only.
  const other = await withReasonRetry({ step: "s", deps: replies([{ ok: false, why: "a", usage: { in: 5 } }, { ok: false, why: "b", usage: { in: 7 } }]), run, reasonOf: (r) => (r.why === "a" ? { code: "a", text: "t" } : null) });
  assert.deepEqual(other.usage, { in: 5 });
  const passed = await withReasonRetry({ step: "s", deps: replies([{ ok: false, usage: { in: 5 } }, { ok: true, usage: { in: 7 } }]), run, reasonOf: (r) => (r.ok ? null : { code: "c", text: "t" }) });
  assert.deepEqual(passed.usage, { in: 12 }, "a step that worked was not billed for both calls");
});

test("CHARGE: the menu step refused twice is billed as one call, exactly as before retries (menu 2, not 3)", async () => {
  const src = `import { SiteChrome } from "@/components/ui/site-chrome";\nexport default function P() { return (<SiteChrome name="F" links={[{ label: "Gallery", href: "/gallery" }]}><h1>x</h1></SiteChrome>); }\n`;
  const sent = [];
  const r = await runNavEdit({ send: async (req) => { sent.push(req); return { content: [{ type: "tool_use", id: "n", input: {} }], usage: { input_tokens: 100, output_tokens: 10 } }; } },
    { instruction: "Put Visit first", pages: [{ path: "index.tsx", source: src }], routes: ["/", "/gallery"] });
  assert.equal(sent.length, 2, "not retried once");
  assert.equal(r.ok, false);
  assert.equal(r.usage.in, 100, "the refused menu step's usage carries its retry");
  assert.equal(r.retryUsage.in, 100);
});

// ── THE PICKER'S SCOPE (picker/scope-unread, picker/addition-mixed) ──────────

const MSG = "Make the buttons rounder and change the description to Fresh bread daily.";
const pickReply = (input) => ({ content: [{ type: "tool_use", id: "p1", name: "pick_lanes", input }], usage: { input_tokens: 50, output_tokens: 5 } });
async function pick(answers, { routed = null, isAddition = null } = {}) {
  const sent = [];
  const left = answers.slice();
  const r = await pickLanes({ send: async (req) => { sent.push(req); return pickReply(left.shift()); }, isAddition }, { message: MSG, current: "pages: /", routed });
  return { r, sent };
}
const GOOD = { fields: ["css", "description"], scopes: [{ part: "css", words: "Make the buttons rounder" }, { part: "description", words: "change the description to Fresh bread daily." }] };
const BAD_WORDS = { fields: ["css", "description"], scopes: [{ part: "css", words: "make every button round" }, { part: "description", words: "change the description to Fresh bread daily." }] };

test("SCOPE: words not in the message are retried once with that reason; the retry's scopes are used", async () => {
  const fixed = await pick([BAD_WORDS, GOOD]);
  assert.equal(fixed.sent.length, 2);
  assert.match(sameButTurns(fixed.sent[0], fixed.sent[1]), /the words for css are not found word for word/);
  assert.equal(await pickScopeReason(fixed.r), null);
  assert.deepEqual(fixed.r.retryReason, { step: "pick_lanes", reason: "scope-unread", ok: true });
  assert.equal(fixed.r.usage.in, 100, "both calls are on a pick that then passed");
});

test("SCOPE: a retry still misquoting ends as today's withholding (the route's scope-unread), billed as one call; a passing pick is never retried", async () => {
  const twice = await pick([BAD_WORDS, BAD_WORDS]);
  assert.equal(twice.sent.length, 2);
  assert.ok(twice.r.scopes.some((op) => op.invalid === "words"), "the second answer is not the one read");
  assert.deepEqual(twice.r.retryReason, { step: "pick_lanes", reason: "scope-unread", ok: false });
  assert.equal(twice.r.usage.in, 50, "a pick still refused was billed for its retry");
  const once = await pick([GOOD]);
  assert.equal(once.sent.length, 1);
});

test("SCOPE: a page that is not a path, and a picked lane no scope places, are each retried with their own words", async () => {
  const page = await pick([{ fields: ["css"], scopes: [{ part: "css", page: ["/visit"], words: "Make the buttons rounder" }] }, { fields: ["css"], scopes: [{ part: "css", words: "Make the buttons rounder" }] }]);
  assert.equal(page.sent.length, 2);
  assert.match(sameButTurns(page.sent[0], page.sent[1]), /names a page that is not a path/);
  const unplaced = await pick([{ fields: ["css", "description"], scopes: [{ part: "css", words: "Make the buttons rounder" }] }, GOOD]);
  assert.equal(unplaced.sent.length, 2);
  assert.match(sameButTurns(unplaced.sent[0], unplaced.sent[1]), /the lane description was picked but no scope places it/);
});

test("SCOPE: an addition beside other work on an answer with no scopes is retried (addition-mixed); alone, or not an addition, it is not", async () => {
  const isAddition = async (f) => f === "qr";
  const mixed = await pick([{ fields: ["qr", "css"] }, { fields: ["qr", "css"], scopes: [{ part: "qr", words: "change the description to Fresh bread daily." }, { part: "css", words: "Make the buttons rounder" }] }], { isAddition });
  assert.equal(mixed.sent.length, 2);
  assert.match(sameButTurns(mixed.sent[0], mixed.sent[1]), /names something new to add \(qr\) beside other work/);
  assert.equal(mixed.r.scoped, true);
  const alone = await pick([{ fields: ["qr"] }], { isAddition });
  assert.equal(alone.sent.length, 1, "an addition alone (handed on whole) was retried");
  const notAdd = await pick([{ fields: ["qr", "css"] }], { isAddition: async () => false });
  assert.equal(notAdd.sent.length, 1, "an edit of an existing code was retried");
  // A NEW PAGE beside other work, read off the answer itself.
  assert.equal((await pickScopeReason({ fields: ["pages", "css"], scoped: false, page: { verb: "add", layer: "addon" } })).code, "addition-mixed");
  // A look the route could not read answers "not an addition": no retry.
  assert.equal(await pickScopeReason({ fields: ["qr", "css"], scoped: false }, { isAddition: async () => { throw new Error("unreadable"); } }), null);
});

// ── THE LOOK STEP: EVERY PART DECLINED (look/no-change) ──────────────────────

test("LOOK: a declining lane re-asked with the fact is the SAME request with its answer and the reason; its new value is read as the first was", async () => {
  const sent = [];
  const replies = [{ content: [{ type: "tool_use", id: "e1", name: "edit_site", input: {} }], usage: { input_tokens: 9, output_tokens: 1 } },
    { content: [{ type: "tool_use", id: "e2", name: "edit_site", input: { description: "Fresh bread daily." } }], usage: { input_tokens: 9, output_tokens: 2 } }];
  const deps = { send: async (req) => { sent.push(req); return replies.shift(); } };
  const args = { field: "description", message: "change the description to Fresh bread daily.", value: "Old", model: "claude-sonnet-x" };
  const first = await runLane(deps, args);
  assert.equal(first.value, undefined);
  const again = await reaskLane(deps, args, first, LOOK_DECLINED_REASON);
  assert.equal(again.value, "Fresh bread daily.");
  assert.match(sameButTurns(sent[0], sent[1]), /every part picked for this request answered no change/);
});

// ── THE REQUIREMENTS JUDGE: A CUT-OFF ANSWER ─────────────────────────────────

test("JUDGE: a cut-off first answer is asked once more with that fact; the retry's verdicts finish the judgment; a whole first answer is never re-asked", async () => {
  const entries = [{ id: "table#0", need: "a", status: "covered" }];
  const reply = (input, extra = {}) => ({ content: [{ type: "tool_use", id: "j", name: "judge_requirements", input }], usage: { input_tokens: 9, output_tokens: 3 }, ...extra });
  const A = { id: "table#0", follows: "asked", carried: "no", reason: "r" };
  const sent = [];
  const answers = [reply({ verdicts: [] }, { stop_reason: "max_tokens" }), reply({ verdicts: [A] })];
  const j = await runJudge({ send: async (req) => { sent.push(req); return answers.shift(); } }, { entries });
  assert.equal(sent.length, 2);
  assert.equal(j.failed, false, JSON.stringify(j));
  assert.ok(j.verdicts.has("table#0"));
  assert.match(sameButTurns(sent[0], sent[1]), /cut off before it finished/);
  assert.equal(j.usage.out, 3, "the judgment's billed call is not its first");
  const sent1 = [];
  await runJudge({ send: async (req) => { sent1.push(req); return reply({ verdicts: [A] }); } }, { entries });
  assert.equal(sent1.length, 1);
});

// ── THE BUILD'S PAGE WRITER: NO USABLE PAGE, NO HOME PAGE ────────────────────

const SPEC = { tables: [] };
const HOME = { path: "index.tsx", source: `import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/")({ component: Page });\nfunction Page() { return <div>Hi</div>; }` };
const ABOUT = { path: "about.tsx", source: HOME.source.replace('"/"', '"/about"') };
const USAGE = { in: 100000, out: 100000, cacheRead: 0, cacheWrite: 0 };
function harness({ first, again = undefined }) {
  const calls = { generate: 0, regenerate: [], charges: [], publish: 0 };
  const deps = {
    generate: async () => { calls.generate++; return first; },
    compile: async () => ({ ok: true, files: { "index.html": { t: "<b>" } } }),
    publish: async () => { calls.publish++; },
    readCredits: async () => 50000,
    useCredits: async (n) => { calls.charges.push(n); return n; },
  };
  if (again !== undefined) deps.regenerate = async (reason) => { calls.regenerate.push(reason); return typeof again === "function" ? again() : again; };
  return { deps, calls };
}

test("BUILD: a writer that returned no usable page is asked once more with the reason; the retry's pages publish, billed as both calls", async () => {
  const { deps, calls } = harness({ first: { input: { pages: [] }, usage: { ...USAGE } }, again: { input: { pages: [HOME] }, usage: { ...USAGE } } });
  const out = await publishPages(deps, { spec: SPEC, slug: "s" });
  assert.equal(calls.regenerate.length, 1);
  assert.match(calls.regenerate[0], /carried no pages through the tool/);
  assert.equal(calls.publish, 1, "the retry's pages did not publish");
  assert.deepEqual(out.retryReason, { step: "pages", reason: "validate", ok: true });
  assert.equal(calls.charges.reduce((a, b) => a + b, 0), pageCredits({ in: 200000, out: 200000, cacheRead: 0, cacheWrite: 0 }), "the working build was not billed for both calls");
});

test("BUILD: a home page left out is retried with that reason; a retry no better is today's exit, charged exactly as without the retry", async () => {
  const fixed = harness({ first: { input: { pages: [ABOUT] }, usage: { ...USAGE } }, again: { input: { pages: [HOME, ABOUT] }, usage: { ...USAGE } } });
  await publishPages(fixed.deps, { spec: SPEC, slug: "s" });
  assert.match(fixed.calls.regenerate[0], /no home page \(index\.tsx\)/);
  assert.equal(fixed.calls.publish, 1);
  const twice = harness({ first: { input: { pages: [ABOUT] }, usage: { ...USAGE } }, again: { input: { pages: [ABOUT] }, usage: { ...USAGE } } });
  const out = await publishPages(twice.deps, { spec: SPEC, slug: "s" });
  const without = harness({ first: { input: { pages: [ABOUT] }, usage: { ...USAGE } } });
  const base = await publishPages(without.deps, { spec: SPEC, slug: "s" });
  assert.equal(out.stage, "home");
  assert.equal(base.stage, "home");
  assert.deepEqual(twice.calls.charges, without.calls.charges, "a refused build was charged more for its retry");
  assert.deepEqual(out.retryReason, { step: "pages", reason: "home", ok: false });
});

test("BUILD: a writer whose first answer passes is never asked again; a caller with no `regenerate` behaves as before", async () => {
  const ok = harness({ first: { input: { pages: [HOME] }, usage: { ...USAGE } }, again: () => { throw new Error("must not run"); } });
  await publishPages(ok.deps, { spec: SPEC, slug: "s" });
  assert.equal(ok.calls.regenerate.length, 0);
  const none = harness({ first: { input: { pages: [] }, usage: { ...USAGE } } });
  const out = await publishPages(none.deps, { spec: SPEC, slug: "s" });
  assert.equal(out.stage, "validate");
});

// ── THE RECORDING CALL AND GROK'S SHAPE ──────────────────────────────────────

test("recordCall: `again(reason)` sends the remembered request with its answer and the reason, whatever request it is handed", async () => {
  const sent = [];
  const call = async (keys, req) => { sent.push(req); return { content: [{ type: "tool_use", id: "w", name: "write_pages", input: { pages: [] } }] }; };
  const rec = recordCall(call);
  await rec.call("k", { model: "m", effort: "low", tools: [{ name: "write_pages" }], messages: [{ role: "user", content: "x" }] }, null);
  await rec.again("THE REASON")("k", { model: "other", messages: [] }, null);
  assert.equal(sameButTurns(sent[0], sent[1]), "THE REASON");
});

test("GROK: a retry's assistant tool call and its is_error tool_result reach xAI as tool_calls and a tool message, never dropped", () => {
  const first = { model: "grok-x", effort: "low", tools: [{ name: "write_pages", input_schema: { type: "object" } }], tool_choice: { type: "tool", name: "write_pages" }, messages: [{ role: "user", content: "write it" }] };
  const reply = { content: [{ type: "tool_use", name: "write_pages", input: { pages: [] } }] };
  const x = toXaiRequest(retryRequest(first, reply, "THE REASON")).body;
  const roles = x.messages.map((m) => m.role);
  assert.deepEqual(roles, ["user", "assistant", "tool"]);
  const a = x.messages[1];
  assert.equal(a.tool_calls.length, 1);
  assert.equal(a.tool_calls[0].function.name, "write_pages");
  assert.deepEqual(JSON.parse(a.tool_calls[0].function.arguments), { pages: [] });
  assert.equal(x.messages[2].tool_call_id, a.tool_calls[0].id);
  assert.equal(x.messages[2].content, "THE REASON");
  assert.equal(x.reasoning_effort, "low", "the retry changed the effort");
  // A PLAIN TEXT REASON (no tool answer) is an ordinary user turn, as before.
  const t = toXaiRequest(retryRequest(first, { content: [{ type: "text", text: "hm" }] }, "WHY")).body;
  assert.deepEqual(t.messages.map((m) => [m.role, m.content]), [["user", "write it"], ["assistant", "hm"], ["user", "WHY"]]);
});

test("BUILD: `pagesAgain` re-sends the writer's last request through the caller with its answer and the reason, read as the first", async () => {
  const { generateSitePages, pagesAgain } = await import("../builder/page-gen.mjs");
  const sent = [];
  const call = async (k, req) => { sent.push(req); return { stop_reason: "tool_use", content: [{ type: "tool_use", id: "w", name: req.tools[0].name, input: { pages: sent.length > 1 ? [HOME] : [] } }], usage: { input_tokens: 1, output_tokens: 1 } }; };
  const first = await generateSitePages({}, "a bakery", SPEC, "Loaf", [], "claude-sonnet-x", undefined, undefined, undefined, null, call, "", []);
  assert.deepEqual(first.input.pages, []);
  const again = await pagesAgain(call, "THE REASON", call);
  assert.deepEqual(again.input.pages, [HOME]);
  assert.equal(sameButTurns(sent[0], sent[1]), "THE REASON");
});

test("CHARGE: a tweak still refused after its retry carries its first call's usage only", async () => {
  const { runTweak, TWEAK_TOOL } = await import("../builder/site-tweak.mjs");
  const source = 'import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/")({ component: Page });\nfunction Page() {\n  return (\n    <main className="p-4">\n      <h1 className="text-2xl">Fold Lane</h1>\n    </main>\n  );\n}\n';
  const sent = [];
  const miss = { content: [{ type: "tool_use", id: "t", name: TWEAK_TOOL.name, input: { edits: [{ old: "NOT IN THE FILE", new: "x" }] } }], usage: { input_tokens: 300, output_tokens: 30 } };
  const r = await runTweak({ instruction: "make the heading bigger", path: "index.tsx", source, send: async (req) => { sent.push(req); return miss; } });
  assert.equal(sent.length, 2, "not retried once");
  assert.equal(r.ok, false);
  assert.equal(r.usage.in, 300, "a refused tweak was billed for its retry");
  assert.equal(r.retryUsage.in, 300);
});
