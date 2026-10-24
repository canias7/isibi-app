// THE FULL REWRITE, KEPT ONLY WHERE THE OWNER KEPT IT (2026-10-24).
//
// Owner's decision: keep the "revise" (the rewrite of every page) only for
//   (1) a full new site description sent on a site that already exists, and
//   (4) the customer clearly asking to start over — and then only after a
//       confirmation question ("this replaces your whole site, OK?"), with the
//       old version kept as a saved version they can restore.
// Remove it as an automatic fallback:
//   (2) an edit or an addition too big for the smaller steps never falls back
//       to a whole-site rewrite: it is said, and asked for in smaller changes;
//   (3) a broken first build (a placeholder, no pages) is never offered a
//       rewrite: the build is offered again.
//
// EVERY CASE RUNS THE REAL WORKER (the routing route, the queue consumer, the
// edit and add-on routes, the request's driver, the go-ahead and the existing
// queued build) against `test/fixtures/request-flow.mjs`.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. Every model answer — the router's, the
// picker's, the add-on's, the designer's and the page writer's — is supplied
// by the case. Nothing here is evidence of what a real model answers.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, readWritten, call, T, newKey } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { VISIT, page as pageSrc } from "./fixtures/live-ask.mjs";
import * as siteAsk from "../builder/site-ask.mjs";

// WHO ASKED THE START-OVER QUESTION, as the stored question records it. Read
// off the module, and checked against its one spelling in the first case, so
// this file still loads (and goes red, case by case) against code without it.
const START_OVER_BY = "route:startover";

const slugOf = (k) => "rs-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}
const statuses = (rec) => rec.parts.map((p) => p.status);
const builds = (P) => [...P.jobs.values()].filter((j) => j.op === "build");
const designs = (P) => P.modelLog.filter((m) => m.tool === "design_schema").length;
const buildable = (P) => { P.env.NEON_API_KEY = "neon-test"; P.env.SITE_BUILD_CONTAINER = {}; };
const approve = (P, key, part = 0, auth) => call(P, "POST", "/api/site/request/" + P.slug + "/" + key + "/approve", { part }, auth);
const REQ = (P, key) => "/api/site/request/" + P.slug + "/" + key;
const toldIn = (P, v) => {
  const f = P.factsOf(v && v.body && v.body.reply);
  assert.ok(f, "no reply was handed back: " + JSON.stringify(v && v.body && { replyState: v.body.replyState, reply: v.body.reply }));
  return f.map((x) => x.text).join(" | ");
};
const WARM = pageSrc("/", "<section><p>A brand new site, written from the start.</p></section>");
const DESIGN = (slug) => ({ brand: "Harbour Loaf", slug, description: "a bakery", kind: "shopfront", purpose: "visit", pages: [{ path: "/", name: "Home" }, { path: "/visit", name: "Visit" }], components: [], css: "" });
const MANY = Array.from({ length: 610 }, (_, i) => "<p>Line " + (i + 1) + " of our story.</p>").join("");
const BIG = [{ path: "index.tsx", source: pageSrc("/", "<section>" + MANY + "</section>") }, { path: "visit.tsx", source: VISIT }];

// ─────────────────────────────────────────────────────────────────────────────
// (2) TOO BIG FOR THE SMALLER STEPS: NEVER THE REWRITE
// ─────────────────────────────────────────────────────────────────────────────

test("(2) an edit too big for the smaller steps is not offered the full rewrite: the part ends, said, with nothing to press, and no build is filed", async () => {
  // ⚠ RE-ANCHORED 2026-10-24 (auto-split): the part splits itself up to
  // SPLIT_MAX times (routed again each time) before it ends too big.
  const TEXT = { intent: "edit", layer: "text" };
  await withPlatform({ slug: slugOf("big"), pages: BIG, replies: true, answers: { route: [TEXT, TEXT, TEXT] } }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: "Reword every line to sound warmer." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual([statuses(rec)[0], rec.parts[0].why], ["failed", "too-big"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[0].approvalAt, undefined, "the full rewrite was offered");
    assert.deepEqual(builds(P), [], "a build was filed");
    assert.equal(designs(P), 0);
    assert.equal(P.page("index.tsx"), BIG[0].source, "the site changed");
    // NOTHING TO PRESS: a press is refused, and still files nothing.
    const pressed = await approve(P, r.key);
    assert.equal(pressed.status, 409, JSON.stringify(pressed.body));
    assert.deepEqual(builds(P), []);
    const v = await readWritten(P, REQ(P, r.key));
    assert.equal(v.body.request.parts[0].ask, undefined, "the page is handed a go-ahead to show");
    const facts = toldIn(P, v);
    assert.match(facts, /send it as smaller changes, one at a time/);
    assert.doesNotMatch(facts, /17 credits|go-ahead button|only the full rewrite/);
  });
});

test("(2) an addition the add-on cannot make on a site without its saved design is not the rewrite either: ended, said as a start-over they confirm", async () => {
  await withPlatform({ slug: slugOf("nodesign"), replies: true, answers: { route: [{ intent: "addon" }] } }, async (P) => {
    // NO STORED LOOK: the add-on's verified-reconstruction climb (`no-meta`).
    P.objects.delete("config/" + P.slug + ".json");
    P.env.NEON_API_KEY = "neon-test";
    const r = await sendMessage(P, { message: "Add a gallery page." });
    const { rec } = await settle(P, r.key);
    const p0 = rec.parts[0];
    assert.deepEqual([p0.status, p0.why, p0.splitReason], ["failed", "too-big", "no-meta"], "not the add-on's own climb, ended: " + JSON.stringify(p0));
    assert.equal(p0.approvalAt, undefined, "a go-ahead for the rewrite was offered");
    assert.deepEqual(builds(P), []);
    assert.equal(designs(P), 0);
    const facts = toldIn(P, await readWritten(P, REQ(P, r.key)));
    assert.match(facts, /only when they ask to start over and confirm it/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (3) A PLACEHOLDER SITE: THE BUILD TRIED AGAIN, NEVER A REWRITE
// ─────────────────────────────────────────────────────────────────────────────

test("(3) an addition on a site whose first build never finished offers the build tried again — its button, its sentence — and the press runs the build route, not the revise", async () => {
  const slug = slugOf("placeholder");
  const answers = {
    route: [{ intent: "addon" }],
    design_schema: DESIGN(slug),
    [T.pages]: { pages: [{ path: "src/routes/index.tsx", source: WARM }], notes: "Wrote the home page." },
  };
  // NO PAGES AT ALL: what a failed first build leaves (its placeholder stands at the address).
  await withPlatform({ slug, pages: [], replies: true, answers }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: "Add a booking page for our classes." });
    let { rec } = await settle(P, r.key);
    assert.deepEqual([rec.parts[0].status, rec.parts[0].why, rec.parts[0].retry], ["approval", "retry-build", true], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(builds(P), [], "the retry started before it was pressed");
    // THE FACTS: the build tried again, never the full rewrite or its 17 credits.
    const g = await readWritten(P, REQ(P, r.key));
    assert.equal(g.body.request.parts[0].retry, true);
    const facts = toldIn(P, g);
    assert.match(facts, /first build did not finish, so it has no pages yet/);
    assert.match(facts, /the build tried again/);
    assert.doesNotMatch(facts, /full rewrite|17 credits/);
    // THE PRESS: the build route, told it is a retry, with the customer's words.
    const a = await approve(P, r.key);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(builds(P).length, 1);
    const job = JSON.parse(P.objects.get("jobs/" + builds(P)[0].id + ".json").body);
    assert.match(job.url, /\/api\/site\/react-build$/, "the retry was filed as the revise");
    const jb = JSON.parse(job.body);
    assert.equal(jb.retry, true);
    assert.equal(jb.slug, P.slug);
    assert.equal(jb.instruction, rec.parts[0].words);
    // THE SERVER RUNS IT, AND THE SITE HAS PAGES AT LAST.
    ({ rec } = await settle(P, r.key));
    assert.equal(designs(P), 1);
    assert.equal(P.page("index.tsx"), WARM, "the build tried again did not publish its page");
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (1) A FULL NEW DESCRIPTION ON A SITE THAT EXISTS: STILL THE REWRITE
// ─────────────────────────────────────────────────────────────────────────────

test("(1) a full new description sent on a site that exists is still the rewrite: the routing answer is `build`, with no question first and no start-over flag", async () => {
  await withPlatform({ slug: slugOf("newdesc"), answers: { route: [{ intent: "build" }] } }, async (P) => {
    const r = await sendMessage(P, { message: "A ceramics studio in Leith: weekly wheel classes, a shop for our mugs, and a page about the studio." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.intent, "build", JSON.stringify(r.body));
    assert.equal(r.body.startOver, undefined);
    assert.equal(r.body.confirmed, undefined);
    // NOT TAKEN ON AS A REQUEST, AND NOTHING ASKED: the page runs the revise on it.
    assert.equal(r.body.request, undefined);
    assert.equal(r.body.question, undefined);
    assert.equal(P.question(), null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (4) "START OVER": ASKED FIRST, REWRITTEN ONLY AFTER YES, THE OLD VERSION KEPT
// ─────────────────────────────────────────────────────────────────────────────

const SURE = { text: "This replaces your whole site: every page is written again, and the site as it is now is kept as a saved version you can restore. Go ahead?", options: ["Yes, start over", "No, keep my site"] };

test("(4) \"start over\" on its own is asked first: the model's own question is stored and shown, and nothing is built or charged beyond the routing call", async () => {
  assert.equal(siteAsk.START_OVER_BY, START_OVER_BY, "the start-over asker's tag moved");
  await withPlatform({ slug: slugOf("ask"), answers: { route: [{ intent: "build", startOver: true, question: SURE }] } }, async (P) => {
    buildable(P);
    const before = P.spent();
    const r = await sendMessage(P, { message: "Scrap it all and start again." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.intent, "clarify", JSON.stringify(r.body));
    assert.equal(r.body.question.text, SURE.text);
    assert.deepEqual(r.body.question.options, SURE.options);
    const q = P.question();
    assert.equal(q.status, "pending");
    assert.equal(q.by, START_OVER_BY, "the question was not kept as the start-over one");
    assert.deepEqual(builds(P), []);
    assert.equal(designs(P), 0);
    assert.equal(P.spent() - before, 1, "more than the routing call was charged");
    assert.ok(r.body.decision.reasons.includes("startover-asked"));
  });
});

test("(4) a start-over with no question the model wrote is never the rewrite: the call fails, nothing is built", async () => {
  await withPlatform({ slug: slugOf("noq"), answers: { route: [{ intent: "build", startOver: true }] } }, async (P) => {
    const r = await sendMessage(P, { message: "Start over." });
    assert.notEqual(r.body.intent, "build", JSON.stringify(r.body));
    assert.deepEqual(builds(P), []);
    assert.equal(P.question(), null);
  });
});

test("(4) only a yes to that question is the rewrite: the answer comes back `build` and confirmed; any other routing of the answer is not", async () => {
  await withPlatform({ slug: slugOf("yes"), answers: { route: [{ intent: "build", startOver: true, question: SURE }, { intent: "build", startOver: true, answered: true }] } }, async (P) => {
    await sendMessage(P, { message: "Scrap it all and start again." });
    const q = P.question();
    const a = await sendMessage(P, { message: "Yes, start over", ask: { id: q.id, chosen: true } });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(a.body.intent, "build");
    assert.equal(a.body.startOver, true);
    assert.equal(a.body.confirmed, true);
    assert.ok(a.body.decision.reasons.includes("startover-confirmed"));
    assert.equal(P.question().status, "answered");
  });
  // A START-OVER ANSWER TO SOME OTHER QUESTION: asked again, never confirmed.
  const OTHER = { text: "Which photos should the gallery show?", options: ["Loaves", "The bakery"] };
  await withPlatform({ slug: slugOf("other"), answers: { route: [{ intent: "clarify", question: OTHER }, { intent: "build", startOver: true, answered: true, question: SURE }] } }, async (P) => {
    await sendMessage(P, { message: "Add a gallery." });
    const q = P.question();
    const a = await sendMessage(P, { message: "Actually, start over", ask: { id: q.id } });
    assert.notEqual(a.body.confirmed, true, JSON.stringify(a.body));
    assert.equal(a.body.intent, "clarify", "a start-over answering another question was not asked first");
  });
});

test("(4) a part that asks to start over waits on the question; the yes is the go-ahead, the rewrite runs once on it, and the version before it stays saved and restorable", async () => {
  const slug = slugOf("part");
  const DESC = "Change the site description to say we bake overnight sourdough";
  const OVER = "then start over with a whole new design";
  const answers = {
    route: [
      { intent: "edit", layer: "look", alsoAsked: [OVER] },
      { intent: "build", startOver: true, question: SURE },
      { intent: "build", startOver: true, answered: true },
    ],
    [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] },
    "lane:description": "Overnight sourdough from a Bristol side street.",
    design_schema: DESIGN(slug),
    [T.pages]: { pages: [{ path: "src/routes/index.tsx", source: WARM }], notes: "Wrote the site again." },
  };
  await withPlatform({ slug, replies: true, answers }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: DESC + ", " + OVER + "." });
    let { rec } = await settle(P, r.key);
    // PART 0 PUBLISHED A VERSION; PART 1 ASKED, AND WAITS ON ITS QUESTION.
    assert.deepEqual(statuses(rec), ["done", "waiting"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const kept = P.liveScript();
    assert.ok(kept, "part 0 published no version to keep");
    assert.deepEqual(builds(P), [], "the rewrite ran before the question was answered");
    const q = P.question();
    assert.equal(q.by, START_OVER_BY);
    assert.equal(q.part, 1);
    const oldHome = P.page("index.tsx");
    // THE YES: the go-ahead, recorded at once under the answering session.
    const a = await sendMessage(P, { message: "Yes, start over", ask: { id: q.id, chosen: true } });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.deepEqual(a.body.resumed, { key: r.key, part: 1 });
    rec = P.record(r.key);
    assert.equal(rec.parts[1].why === "start-over" || rec.parts[1].approval !== undefined, true, JSON.stringify(rec.parts[1]));
    assert.ok(rec.parts[1].approval && rec.parts[1].approval.job, "the yes was not recorded as the go-ahead");
    assert.equal(builds(P).length, 1, "not one rewrite filed");
    const job = JSON.parse(P.objects.get("jobs/" + builds(P)[0].id + ".json").body);
    assert.match(job.url, /\/api\/site\/react-revise$/);
    ({ rec } = await settle(P, r.key));
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(designs(P), 1, "the rewrite did not run exactly once");
    assert.equal(P.page("index.tsx"), WARM);
    assert.notEqual(oldHome, WARM);
    // THE VERSION BEFORE IT IS STILL SAVED, AND CAN BE PUT BACK.
    const now = P.liveScript();
    assert.notEqual(now, kept, "the rewrite published nothing new");
    const list = await call(P, "GET", "/api/site/" + P.slug + "/versions");
    assert.equal(list.status, 200, JSON.stringify(list.body));
    const ids = (list.body.versions || []).map((v) => v.id || v.version);
    assert.ok(ids.includes(kept), "the version before the rewrite is not in the saved versions: " + JSON.stringify(ids));
  });
});

test("(4) a \"no\" to the start-over question rewrites nothing: the question keeps waiting for a real answer or its Cancel, and no build is filed", async () => {
  await withPlatform({ slug: slugOf("no"), answers: { route: [{ intent: "build", startOver: true, question: SURE }, { intent: "ask", answer: "Keeping your site as it is.", answered: true }] } }, async (P) => {
    buildable(P);
    await sendMessage(P, { message: "Scrap it all and start again." });
    const q = P.question();
    const a = await sendMessage(P, { message: "No, keep my site", ask: { id: q.id, chosen: true }, key: newKey() });
    assert.notEqual(a.body.intent, "build", JSON.stringify(a.body));
    assert.deepEqual(builds(P), []);
    assert.equal(designs(P), 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE NEWER MACHINERY, NOW THE REWRITE'S TOO (the parity audit, 2026-10-24)
// ─────────────────────────────────────────────────────────────────────────────

import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { buildBucket, GOOD_DESIGN } from "./fixtures/build-route.mjs";
import { pagesRequest, reviseSent, priorPagesBlock, SITE_PAGES_TOOL, SITE_PAGES_TOOL_ASK, MAX_PRIOR_CHARS } from "../builder/page-gen.mjs";
import { publishPages } from "../builder/publish-pages.mjs";

const jsonResp = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const stubFetch = (answer) => {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => { const bd = JSON.parse(String((init && init.body) || "{}")); calls.push(bd); return answer(calls.length - 1, bd); };
  return { calls, restore: () => { globalThis.fetch = real; } };
};
const designAnswer = (input) => jsonResp({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t", name: "design_schema", input }], usage: { input_tokens: 5, output_tokens: 5 } });
const ENV = (b) => ({ SITES_BUCKET: b, ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k" });

test("parity — the design correction round runs on a rewrite: a call that gave no design is corrected, shown the same site; a partial revise answer is whole and never 'repaired'", async () => {
  const { recoverDesign } = await loadWorkerModule();
  // A REVISE ANSWER NAMING ONLY WHAT CHANGES: whole, no corrective call.
  const f0 = stubFetch(() => designAnswer(GOOD_DESIGN));
  try {
    const kept = await recoverDesign(ENV(buildBucket()), { dz: { input: { css: "h1{color:green}" }, usage: { in: 1, out: 1 } }, jobId: "rv0", brief: "b", model: "claude-sonnet-4-5", revise: true, editState: { brand: "Harbour Loaf", tables: [] } });
    assert.equal(kept.ok, true);
    assert.equal(f0.calls.length, 0, "a partial revise answer was sent for repair");
  } finally { f0.restore(); }
  // THE SAME ANSWER ON A FIRST BUILD IS NOT A DESIGN: the control.
  const f1 = stubFetch(() => designAnswer(GOOD_DESIGN));
  try {
    const first = await recoverDesign(ENV(buildBucket()), { dz: { input: { css: "h1{color:green}" }, usage: { in: 1, out: 1 } }, jobId: "rv1", brief: "b", model: "claude-sonnet-4-5" });
    assert.equal(first.ok, true);
    assert.equal(f1.calls.length, 1, "a first build's partial design was not corrected");
  } finally { f1.restore(); }
  // A REVISE CALL THAT GAVE NO DESIGN AT ALL: corrected once, and shown the same site.
  const f2 = stubFetch(() => designAnswer({ css: "h1{color:green}" }));
  try {
    const fixed = await recoverDesign(ENV(buildBucket()), { dz: { input: null, shape: { tool: false }, usage: { in: 1, out: 1 } }, jobId: "rv2", brief: "b", model: "claude-sonnet-4-5", revise: true, editState: { brand: "Harbour Loaf", tables: ["loaves"] } });
    assert.equal(fixed.ok, true, JSON.stringify(fixed).slice(0, 300));
    assert.equal(f2.calls.length, 1);
    assert.match(JSON.stringify(f2.calls[0]), /Harbour Loaf/, "the corrective call was not shown the site it revises");
  } finally { f2.restore(); }
});

test("parity — the build and rewrite page writer can ask when its caller can carry the question; otherwise its tool is unchanged", () => {
  const base = { brief: "b", spec: { tables: [] }, brand: "B", priorPages: null };
  assert.equal(pagesRequest({ ...base }).tools[0], SITE_PAGES_TOOL, "the writer's tool changed with no caller asking");
  assert.equal(pagesRequest({ ...base, ask: true }).tools[0], SITE_PAGES_TOOL_ASK);
  assert.equal(pagesRequest({ ...base, mode: "addon" }).tools[0], SITE_PAGES_TOOL_ASK, "the add-on's writer lost its question");
});

test("parity — a writer's question stops the publish before anything is written or charged, and is handed back", async () => {
  const ask = { text: "Should the menu show prices?", options: ["Yes", "No"] };
  let compiled = 0, settled = 0;
  const out = await publishPages({
    readCredits: async () => 500,
    generate: async () => ({ input: null, ask, usage: { in: 10, out: 5, model: "claude-sonnet-4-5" } }),
    compile: async () => { compiled++; return { ok: true }; },
    settle: async () => { settled++; return { ok: true }; },
  }, { spec: { tables: [] }, slug: "rs-ask", priorPages: [{ path: "index.tsx", source: "x" }] }).catch((e) => ({ threw: String(e && e.message) }));
  assert.equal(out.threw, undefined, out.threw);
  assert.deepEqual(out.ask, ask);
  assert.equal(out.charged, false);
  assert.equal(out.stage, "pages");
  assert.equal(compiled, 0);
  assert.equal(settled, 0);
});

test("parity — the file picker's choice narrows what a big site's rewrite is shown: picked pages shown, the rest named and never returnable", () => {
  const big = (n) => ({ path: "p" + n + ".tsx", source: "x".repeat(Math.ceil(MAX_PRIOR_CHARS / 3)) });
  const pages = [big(1), big(2), big(3), big(4)];
  const all = reviseSent(pages);
  const picked = reviseSent(pages, { only: ["p3.tsx"] });
  const names = (sel) => sel.shown.map((p) => p.path);
  assert.deepEqual(names(picked), ["p3.tsx"], JSON.stringify(picked.withheld));
  assert.ok(picked.withheld.includes("p1.tsx") && picked.withheld.includes("p2.tsx"));
  assert.notDeepEqual(names(all), names(picked), "the pick changed nothing");
  const block = priorPagesBlock(pages, "revise", "", { only: ["p3.tsx"] });
  assert.match(block, /--- p3\.tsx ---/);
  assert.doesNotMatch(block, /--- p1\.tsx ---/);
});

// ── THE PAGE'S HALF ──────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const EditPollMod = createRequire(import.meta.url)("../public/edit-poll.js");
const CHAT_SRC = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function chatFn(head) {
  const open = CHAT_SRC.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const shut = CHAT_SRC.indexOf("\n}\n", open);
  return CHAT_SRC.slice(open, shut + 3);
}

test("page — a climb the page reads is said by its reason, names every part put off, and never names a rewrite as something done", () => {
  const ho = (reason, extra) => EditPollMod.handOver({ alsoAsked: "add a map" }, {}, { from: "look", reply: { reason, ...(extra || {}) } });
  assert.match(EditPollMod.climbSaid(ho("no-source")), /^Your site’s first build didn’t finish/);
  assert.match(EditPollMod.climbSaid(ho("build")), /ask me to start over and I’ll check with you first/);
  assert.match(EditPollMod.climbSaid(ho("no-look")), /saved design/);
  assert.match(EditPollMod.climbSaid(ho("too-much-text")), /Send it as smaller changes/);
  for (const r of ["no-source", "build", "no-look", "too-much-text", ""]) {
    const s = EditPollMod.climbSaid(ho(r));
    assert.match(s, /\nI left “add a map” for later/, r + ": the part put off is not named");
  }
  assert.equal(EditPollMod.climbSaid(null).includes("I left"), false);
});

test("page — a rewrite's own question (the designer's or the page writer's) opens the same round as a first build's", () => {
  const ctx = vm.createContext({});
  vm.runInContext(chatFn("function designQuestion("), ctx);
  const q = { text: "Should the menu show prices?", options: ["Yes", "No"] };
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.designQuestion({ intent: "clarify", stage: "pages", question: q }))), q);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.designQuestion({ intent: "clarify", stage: "design", question: q }))), q);
  assert.equal(ctx.designQuestion({ intent: "clarify", stage: "route", question: q }), null);
  // AND THE ROUND ON A REWRITE RUNS THE REWRITE AGAIN WITH THE ANSWER, never a router call.
  const send = chatFn("function reactSend(");
  assert.match(send, /\(mode === 'build' \|\| mode === 'revise'\) \? designQuestion\(d\)/, "a rewrite's question is not read");
  assert.match(send, /mode === 'revise' \? \{ revise: true \}/, "a rewrite's round is not marked as one");
  const answer = chatFn("function siteAnswer(");
  assert.match(answer, /if \(live && round\.revise === true\) \{[^}]*reactSend\(site, round\.brief, origin, 'revise', imgs, finish, round\.qa\);/, "a rewrite's answered round does not run the rewrite with its answers");
});

test("parity — the build route hands the design correction a rewrite as a rewrite: its stored site and `revise`", () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const calls = [...W.matchAll(/await recoverDesign\(env, \{[^\n]*\}\)/g)].map((m) => m[0]);
  assert.ok(calls.length >= 1, "the build route no longer calls the design correction");
  assert.ok(calls.some((c) => /editState: firstBuild \? null : editState, revise: !firstBuild \}/.test(c)),
    "a rewrite's design correction is not told it is a rewrite: " + calls.join(" | "));
});
