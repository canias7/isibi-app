// HOW FULL THE MODEL'S CONTEXT WINDOW GETS, AND WHAT FILLS IT (2026-09-13).
//
// Owner, holding up Claude Code's own context panel — a bar reading
// `527.1k / 1M (53%)` over a breakdown by part: "KINDA WANT SOMETHING LIKE THIS
// THAT TRACKS THE CONTEXT WINDOW THING."
//
// What these guards hold:
//
//   • the TOTAL is exact and the PARTS are estimated, and the report says which
//     — one number in two accuracies is how a panel becomes the SEO tab;
//   • the parts SUM to the exact total when there is one, so the percentages are
//     sound even though no single part's absolute count is;
//   • three states for an output limit stay three, and an unknown window is a
//     missing percentage rather than a percentage of a guessed denominator;
//   • the panel's bar is scaled to the WINDOW, not to the call — the defect the
//     render caught, where every row drew 100% full beside a figure saying 2.2%;
//   • the route is owner-gated with the 404 its neighbours use, derives its
//     model list from BUILD_MODELS, and survives both of its best-effort reads
//     failing.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import {
  CHARS_PER_TOKEN,
  contextReport,
  contextSummary,
  exactInputTokens,
  requestParts,
} from "../builder/context-report.mjs";
import { BUILD_MODELS, contextWindow } from "../builder/build-models.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(HERE, p), "utf8");
const CHAT = read("../public/chat.js");
const CSS = read("../public/styles.css");
const WORKER = read("../worker.js");

// Whole-line comments blanked, LENGTH PRESERVED. This change's own comments name
// `st-ctx-bar`, `designRequest` and "estimated" while explaining each — the
// recorded "prose contains the thing it forbids".
const bare = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");
const BARE_CHAT = bare(CHAT);
const BARE_WORKER = bare(WORKER);
assert.ok(BARE_CHAT.includes("function ctxBar("), "the blanker ate ctxBar");
assert.ok(BARE_WORKER.includes("function designRequest("), "the blanker ate designRequest");

// ── THE MODULE ──────────────────────────────────────────────────────────────

test("the parts are weighed off the request object, in both message shapes", () => {
  // A plain string when nothing is attached, blocks when something is —
  // `designRequest` keeps both deliberately, because an attachment folded into
  // the cached prefix is a cache miss on every build.
  const plain = requestParts({
    tools: [{ name: "t", input_schema: { a: 1 } }],
    system: [{ type: "text", text: "rules" }],
    messages: [{ role: "user", content: "brief" }],
  });
  assert.equal(plain.system, 5);
  assert.equal(plain.message, 5);
  assert.equal(plain.attachments, 0);
  assert.ok(plain.tools > 10, "the tool was not weighed");

  const withFiles = requestParts({
    system: "rules",
    messages: [{ role: "user", content: [{ type: "image", source: { data: "AAAA" } }, { type: "text", text: "brief" }] }],
  });
  assert.equal(withFiles.system, 5, "a string system block is weighed too");
  assert.equal(withFiles.message, 5, "the text block is the message");
  assert.ok(withFiles.attachments > 0, "the image was not counted apart");

  // AN ABSENT PART IS 0 AND IS KEPT. A panel that omits an empty row cannot say
  // "this build attached nothing", which is a different statement from "this
  // build was not measured".
  const empty = requestParts({});
  assert.deepEqual(Object.keys(empty).sort(), ["attachments", "message", "system", "tools"]);
  assert.equal(empty.tools + empty.system + empty.message + empty.attachments, 0);
  // And a non-object is refused rather than thrown on.
  assert.deepEqual(requestParts(null), empty);
});

test("the exact total sums all three input kinds, and an absence is null and never zero", () => {
  // All three count toward the WINDOW. Billing prices them apart — a cached read
  // is a tenth — but the window does not care what anything cost, only how much
  // the model had to hold.
  assert.equal(exactInputTokens({ input_tokens: 100, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 }), 1000);
  assert.equal(exactInputTokens({ input_tokens: 5 }), 5);
  // A usage object carrying none of the three is an ABSENCE, not a measurement
  // of zero — the recorded "cannot-tell must never read as nothing-there".
  assert.equal(exactInputTokens({ output_tokens: 40 }), null);
  assert.equal(exactInputTokens(null), null);
  assert.equal(exactInputTokens("nope"), null);
  // A real zero is still zero when it is stated.
  assert.equal(exactInputTokens({ input_tokens: 0 }), 0);
});

test("with usage the parts sum to the exact total; without it they are the 3:1 estimate", () => {
  const req = {
    system: [{ type: "text", text: "s".repeat(300) }],
    messages: [{ role: "user", content: "m".repeat(600) }],
  };
  const exact = contextReport({
    model: "grok-4.6", window: 500000, req,
    usage: { input_tokens: 1000, cache_read_input_tokens: 3000, cache_creation_input_tokens: 0 },
  });
  assert.equal(exact.exact, true);
  assert.equal(exact.tokens, 4000);
  // THE RECONCILIATION — the whole point of the module.
  assert.equal(exact.parts.reduce((s, p) => s + p.tokens, 0), 4000, "the parts must sum to what the provider charged for");
  assert.ok(Math.abs(exact.used - 4000 / 500000) < 1e-9);

  const est = contextReport({ model: "grok-4.6", window: 500000, req });
  assert.equal(est.exact, false, "a report with no usage must not claim to be exact");
  assert.equal(est.tokens, Math.round(900 / CHARS_PER_TOKEN));
  // The SHARES are identical either way — that is what makes the percentages
  // trustworthy when the absolute counts are not.
  for (let i = 0; i < est.parts.length; i += 1) {
    assert.ok(Math.abs(est.parts[i].share - exact.parts[i].share) < 1e-9, est.parts[i].name + " share moved with the scale");
  }
});

test("an unknown model has no percentage — never a percentage of a guessed window", () => {
  const req = { messages: [{ role: "user", content: "hello" }] };
  const r = contextReport({ model: "gpt-5", window: contextWindow("gpt-5"), req });
  assert.equal(r.window, null);
  assert.equal(r.used, null, "used must be null, not 0 — a bar at zero says nothing was sent");
  assert.ok(r.tokens > 0, "the token count still stands without a denominator");
  // A nonsense window is refused the same way rather than dividing by it.
  for (const w of [0, -1, NaN, Infinity, "1M", null]) {
    assert.equal(contextReport({ model: "x", window: w, req }).used, null, "window " + String(w) + " must not produce a percentage");
  }
});

test("the summary headlines the FULLEST call, and is only as exact as its weakest", () => {
  const calls = [
    { name: "design", tokens: 20000, used: 0.04, exact: true },
    { name: "pages", tokens: 90000, used: 0.18, exact: true },
    { name: "lane", tokens: 3000, used: 0.006, exact: true },
  ];
  const s = contextSummary(calls);
  assert.equal(s.fullest.name, "pages", "the fullest call is the headline, never an average");
  assert.equal(s.tokens, 113000);
  assert.equal(s.exact, true);

  // ONE ESTIMATED CALL MAKES THE WHOLE RECORD AN ESTIMATE. Saying otherwise puts
  // a measured-looking number over a guess.
  assert.equal(contextSummary([...calls, { name: "x", tokens: 1, used: 0.001, exact: false }]).exact, false);

  // With no usable percentage anywhere, the largest by raw tokens is still the
  // right call to show.
  const noPct = contextSummary([{ name: "a", tokens: 5 }, { name: "b", tokens: 50 }]);
  assert.equal(noPct.fullest.name, "b");
  assert.equal(contextSummary([]).fullest, null);
  assert.equal(contextSummary("nope").fullest, null);
});

// ── THE PANEL ───────────────────────────────────────────────────────────────

// The real renderer, carried out of chat.js rather than retyped.
const cut = (name) => {
  const i = CHAT.indexOf("function " + name + "(");
  assert.ok(i > 0, "missing " + name);
  return CHAT.slice(i, CHAT.indexOf("\n}\n", i) + 3);
};
const konst = (name) => {
  const i = CHAT.indexOf("const " + name + " =");
  assert.ok(i > 0, "missing const " + name);
  return CHAT.slice(i, CHAT.indexOf("\n", CHAT.indexOf("];", i)));
};
const lift = (name, extra = "") => eval([
  "const esc = (s) => String(s).replace(/[&<>\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));",
  konst("CTX_PARTS") + ";",
  cut("ctxNum"), cut("ctxCap"), cut("ctxBar"),
  extra,
  name,
].join("\n"));

test("THE BAR IS SCALED TO THE WINDOW, not to the call", () => {
  // THE DEFECT THE RENDER CAUGHT. Drawn as composition alone, every row is 100%
  // full whatever the model — so three rows reading 2.2%, 2.2% and 4.4% looked
  // identical and brim-full, and the picture contradicted the figure beside it.
  // No markup assertion could see it: the code was correct about the thing it
  // computed and wrong about what a reader would take it to mean.
  const ctxBar = lift("ctxBar");
  const parts = [
    { name: "tools", share: 0.9 },
    { name: "system", share: 0.1 },
    { name: "message", share: 0 },
    { name: "attachments", share: 0 },
  ];
  const widths = (html) => [...html.matchAll(/width:([\d.]+)%/g)].map((m) => Number(m[1]));

  const tenth = widths(ctxBar(parts, 0.1));
  assert.ok(Math.abs(tenth.reduce((a, b) => a + b, 0) - 10) < 0.01,
    "the bands must fill a TENTH of the bar at used=0.1, not the whole of it — got " + tenth.reduce((a, b) => a + b, 0));
  // And twice as full at twice the usage, which is the comparison the panel is
  // for: one model's window being half the other's has to be visible.
  const fifth = widths(ctxBar(parts, 0.2));
  assert.ok(Math.abs(fifth.reduce((a, b) => a + b, 0) - 20) < 0.01, "the fill must track `used`");

  // An unknown window (`used: null`) draws NOTHING rather than a full bar.
  assert.equal(widths(ctxBar(parts, null)).length, 0, "no denominator must draw no ink, never a full bar");
  assert.equal(widths(ctxBar(parts, 0)).length, 0);
  // Over-full is clamped rather than overflowing its track.
  assert.ok(widths(ctxBar(parts, 4)).reduce((a, b) => a + b, 0) <= 100.01, "a call over the window must clamp at the track");
});

test("the legend is derived from CTX_PARTS, and an empty part keeps its row", () => {
  const CTX_PARTS_LIVE = lift("CTX_PARTS");
  assert.equal(CTX_PARTS_LIVE.length, 4, "the four parts the report answers");
  assert.deepEqual(CTX_PARTS_LIVE.map((p) => p[0]), ["tools", "system", "message", "attachments"],
    "the legend's keys must be the report's own part names, or a band is drawn for a part that does not exist");
  // A FIXED ORDER, never sorted by size: the chart is read against itself across
  // two shapes, and bands that reorder when one grows cannot be compared.
  const fromModule = contextReport({ req: {} }).parts.map((p) => p.name);
  assert.deepEqual(CTX_PARTS_LIVE.map((p) => p[0]), fromModule,
    "the panel's order and the module's order must be the same list");
});

test("the numbers read as counts, and the window as a headline", () => {
  const ctxNum = lift("ctxNum");
  const ctxCap = lift("ctxCap");
  assert.equal(ctxNum(31915), "31,915");
  assert.equal(ctxNum(0), "0");
  assert.equal(ctxNum(1000000), "1,000,000");
  assert.equal(ctxCap(500000), "500K");
  assert.equal(ctxCap(1000000), "1M");
  assert.equal(ctxCap(200000), "200K");
  // A window we do not know must not render as "0" — the panel shows an em dash
  // for the percentage, and this is the other half of the same honesty.
  assert.equal(ctxCap(0), "0");
});

test("the panel says it is estimated, and says something rather than nothing with no slug", () => {
  // A panel that presents an estimate as a measurement is this repository's own
  // SEO-tab finding, where three hardcoded claims about a customer's business
  // read as facts.
  const i = BARE_CHAT.indexOf("function moreContext(");
  assert.ok(i > 0, "moreContext moved");
  const fn = BARE_CHAT.slice(i, BARE_CHAT.indexOf("\n}\n", i));
  assert.match(fn, /Estimated from what we send/, "the panel must say the numbers are estimated");
  assert.match(fn, /three per token/, "and say what the estimate is");
  assert.match(fn, /Build your site/, "a site with no slug must be told what to do, not shown an empty panel");
  // The tab is wired into the nav and the dispatch — a renderer nothing reaches
  // is this repository's most repeated defect.
  assert.match(BARE_CHAT, /\['context', 'gauge', 'Model context'\]/, "the tab is not in the More nav");
  assert.match(BARE_CHAT, /siteMoreTab === 'context' \? moreContext\(site\)/, "the tab is drawn by nothing");
});

test("every band and the track are real ink on this paper", () => {
  // The SEO card painted a surface with `--panel` — 5.5% ink on cream — and the
  // rows behind it read straight through. A rule that exists is not a rule that
  // paints, so these are read BY VALUE.
  for (const tone of ["a", "b", "c", "d"]) {
    const rule = (CSS.match(new RegExp("\\.st-ctx-" + tone + " \\{[^}]*\\}")) || [""])[0];
    assert.ok(rule, ".st-ctx-" + tone + " has no rule");
    assert.match(rule, /background: var\(--(graphite|graphite-2|graphite-3|line-2)\)/,
      ".st-ctx-" + tone + " must paint a real ink token: " + rule);
  }
  const bar = (CSS.match(/\.st-ctx-bar \{[^}]*\}/) || [""])[0];
  assert.match(bar, /overflow: hidden/, "the bands must be clipped to the track");
  assert.match(bar, /min-width: 0/, "a flex bar without this refuses to shrink below its content");
});

// ── THE ROUTE ───────────────────────────────────────────────────────────────

// A SLUG PER CASE BY DEFAULT. `siteOwnerBySlug` memoizes per slug for five
// minutes, so a case that establishes a stranger poisons every later case that
// reuses the name — the recorded "a memoized reader in a driven test needs its
// own key per case", which cost this file three red cases on its first run.
let askN = 0;
async function ask({ slug = "ctx-site-" + (askN += 1), user = { id: "u1" }, owner = "u1", stored, bucketFails = false } = {}) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return user ? json(user) : new Response("no", { status: 401 });
    if (u.includes("/rest/v1/site_backends")) return json(owner ? [{ uid: owner, brief: "a guitar school" }] : []);
    return new Response("unavailable", { status: 503 });
  };
  const SITES_BUCKET = {
    async get(key) {
      if (bucketFails) throw new Error("r2 down");
      if (key.endsWith("/context.json") && stored !== undefined) return { text: async () => JSON.stringify(stored) };
      return null;
    },
  };
  try {
    const req = new Request("https://gofarther.dev/api/site/context?slug=" + encodeURIComponent(slug), {
      headers: user ? { Authorization: "Bearer t" } : {},
    });
    const res = await worker.fetch(req, { SUPABASE_SERVICE_KEY: "svc", SITES_BUCKET }, makeCtx());
    return { status: res.status, body: await res.json().catch(() => null) };
  } finally { globalThis.fetch = real; }
}

test("the route is owner-gated, and a stranger gets the 404 a missing site gets", async () => {
  assert.equal((await ask({ user: null })).status, 401);
  // NOT a 403: a distinct refusal would say the slug is taken, which is the one
  // thing an owner-gated read must not leak. Its neighbours make the same call.
  assert.equal((await ask({ owner: "someone-else" })).status, 404);
  assert.equal((await ask({ owner: null })).status, 404);
  assert.equal((await ask({ slug: " " })).status, 400);
});

test("the route answers both shapes, every model, and marks itself estimated", async () => {
  const { status, body } = await ask();
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.estimated, true, "a projection has no usage to scale against and must say so");
  assert.deepEqual(body.shapes.map((s) => s.name), ["first build", "revise"]);

  // EVERY MODEL A PICKER CAN REACH, DERIVED — a typed list here would be a
  // second copy of BUILD_MODELS with nothing between them.
  const expect = [...new Set(Object.values(BUILD_MODELS).map((m) => m.design))];
  for (const s of body.shapes) {
    assert.deepEqual(s.models.map((m) => m.model), expect, s.name + " does not report every model");
    for (const m of s.models) {
      assert.equal(m.window, contextWindow(m.model), m.model + ": the window is not the table's");
      assert.ok(m.tokens > 0, m.model + ": nothing was weighed");
      assert.ok(m.used > 0 && m.used < 1, m.model + ": used reads " + m.used);
    }
    assert.deepEqual(s.parts.map((p) => p.name), ["tools", "system", "message", "attachments"]);
  }

  // A FIRST BUILD IS SMALLER THAN A REVISE, which is the whole reason both are
  // reported: it drops the `backend` property and carries no stored state.
  const [first, revise] = body.shapes;
  assert.ok(first.models[0].tokens < revise.models[0].tokens,
    "a first build must weigh less than a revise — " + first.models[0].tokens + " vs " + revise.models[0].tokens);
});

test("the route ships no prompt text — a weight, never the tool itself", async () => {
  const { body } = await ask();
  const wire = JSON.stringify(body);
  // The design tool is 96,130 characters. Shipping it to draw a bar would be the
  // mistake `/api/site/source` already taught: the panel needs a few numbers.
  assert.ok(wire.length < 4000, "the answer is " + wire.length + " bytes — it is carrying content, not counts");
  assert.doesNotMatch(wire, /input_schema|design_schema/, "the tool reached the wire");
});

test("both best-effort reads can fail and the route still answers", async () => {
  // A bucket blip must cost the measured record and the stored-state accuracy,
  // never the route — the same call the SEO route makes about its two reads.
  const { status, body } = await ask({ bucketFails: true });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.measured, null, "an unreadable record is null, which is not an error and not a zero");
  assert.ok(body.shapes[0].models[0].tokens > 0, "the projection stands without the bucket");
});

test("a stored measurement is handed back, and absent is null", async () => {
  assert.equal((await ask()).body.measured, null);
  const rec = { tokens: 48210, exact: true, calls: [] };
  assert.deepEqual((await ask({ stored: rec })).body.measured, rec);
});

test("the route reads the REAL request builder, not a second copy of it", () => {
  // A projection that assembled its own approximation would drift in the
  // direction that reads as fine: forget the stored-state note and the bar is
  // merely optimistic, with nothing to show that it is wrong.
  const i = BARE_WORKER.indexOf('url.pathname === "/api/site/context"');
  assert.ok(i > 0, "the context route moved");
  const block = BARE_WORKER.slice(i, i + 4000);
  assert.match(block, /designRequest\(cBrief, modelsFor\(\)\.design, null, \[\], true\)/, "the first-build shape is not built from designRequest");
  assert.match(block, /designRequest\(cBrief, modelsFor\(\)\.design, cLook, \[\], false\)/, "the revise shape is not built from designRequest");
  // And the model list is derived rather than typed.
  assert.match(block, /Object\.values\(BUILD_MODELS\)/, "the model list is not derived from BUILD_MODELS");
  assert.doesNotMatch(block, /"grok-4\.6"|"claude-sonnet-5"|"claude-opus-5"/, "a model id is typed into the route");
});
