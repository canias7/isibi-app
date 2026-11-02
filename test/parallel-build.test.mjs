// FOUR CHANGES (owner-approved, 2026-11-02, after northline-climbing on deploy
// 2302: a new message "Text my customers a reminder the day before their
// class" was filed as part p3 of an older request whose part p2 was paused for
// credits; the agent's answer never reached the page).
//   J  a new message never joins a request with a part paused, waiting or ended;
//   R  a paused part does not hold the one reply back, and a later finish owes a follow-up;
//   A  the agent asks with ask_owner (buttons), from a part too, and the answer resumes that part;
//   B  a first build: the foundation first, then the pages in parallel (helpers), shown as tasks.
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer is supplied. Nothing is spent.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as RQ from "../builder/request.mjs";
import * as O from "../builder/one-reply.mjs";
import { runSiteAgent, toolsFor, firstBuildSplitRefusal, MAX_HELPERS, SERVER_RULES } from "../builder/site-agent.mjs";
import { buildPartsOf } from "../builder/site-progress.mjs";
import { platform, sendMessage, settle, call, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";

const NOW = 1_800_000_000_000;
const KA = "a".repeat(20), KB = "b".repeat(20);
const part = (n, status, extra = {}) => ({ n, words: "w" + n, at: n, needs: [], held: [], putOff: [], status, jobs: [], targets: null, ...extra });
const rec = (parts) => RQ.settleState({ key: KA, uid: "u1", slug: "northline-climbing", message: "one", ended: false, stop: false, joined: [], parts }, NOW);

// ── J ──────────────────────────────────────────────────────────────────────
test("J1 the live shape: a request with a part paused for credits takes no new message (its own request instead)", () => {
  const live = rec([part(0, "done"), part(1, "done"), part(2, "credits", { why: "insufficient" })]);
  assert.equal(live.ended, false);
  assert.equal(live.state, "credits");
  assert.equal(RQ.joinableRequest(live), false);
  const r = RQ.appendParts(live, { key: KB, message: "Text my customers a reminder the day before their class", routed: { intent: "edit", layer: "look" } });
  assert.deepEqual([r.ok, r.why], [false, "not-running"]);
});

test("J2 waiting on a question, a go-ahead, or any part ended: no join; every part running: joins (the designed case)", () => {
  for (const s of ["waiting", "approval", "uncertain", "done", "failed", "cancelled"]) {
    assert.equal(RQ.joinableRequest(rec([part(0, "started"), part(1, s)])), false, s);
  }
  const running = rec([part(0, "started"), part(1, "blocked", { needs: [0] })]);
  assert.equal(RQ.joinableRequest(running), true);
  const r = RQ.appendParts(running, { key: KB, message: "make the buttons rounder", routed: { intent: "edit", layer: "look" } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.parts, [2]);
});

const DESC = "Change the site description to say we bake overnight sourdough";
const ADD = "add an events page";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });

test("J3 through the real routes: a request paused for credits; the next message is a request of its own, and the paused one keeps its parts", async () => {
  const compiler = installCompiler();
  const hold = {};
  const P = platform({ slug: "pb-j3-" + Math.random().toString(16).slice(2, 8), answers: {
    route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }, { intent: "edit", layer: "look" }],
    [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": "Overnight sourdough.",
    [T.adds]: () => { if (!hold.done) { hold.done = true; P.credits.balance = 0; } return { kinds: ["page"] }; }, "add:page": { page: [PAGE("/events", "Events")] }, [T.pages]: { pages: [writtenPage("/events")] },
  } });
  try {
    const a = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    await settle(P, a.key, { rounds: 10 });
    const before = P.record(a.key);
    assert.ok(before.parts.some((p) => p.status === "credits"), JSON.stringify(before.parts.map((p) => p.status)));
    P.credits.balance = 40; // topped up, as live (the new message's agent ran and charged); no tick has resumed the pause yet
    const b = await sendMessage(P, { message: "Text my customers a reminder the day before their class" });
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.equal(b.body.joined, undefined, "the new message joined the paused request");
    assert.equal(P.record(a.key).parts.length, before.parts.length, "the paused request took new parts");
    assert.ok(P.record(b.key), "the new message is not a request of its own: " + JSON.stringify(b.body).slice(0, 600));
    assert.equal(b.body.request.key, b.key);
  } finally { P.close(); compiler.uninstall(); }
});

// ── R ──────────────────────────────────────────────────────────────────────
test("R1 one part done and one paused for credits: the one reply is owed now, and the done part's words are in it", (t) => {
  // THE ONE REPLY IS IN FORCE (as production; the suite's GF_OLD_LANES stands it aside).
  const was = process.env.GF_OLD_LANES; delete process.env.GF_OLD_LANES; t.after(() => { if (was !== undefined) process.env.GF_OLD_LANES = was; });
  const r = rec([part(0, "done", { words: "Text my customers a reminder the day before their class", work: null }), part(1, "credits", { words: "add an events page", why: "insufficient" })]);
  const round = O.replyRound(r);
  assert.match(round, /^paused:/);
  assert.equal(O.oneReplyNext(r).act, "claim");
  const f = O.requestFacts(RQ.requestView(r));
  assert.deepEqual(f.parts.map((p) => p.ending), ["done", "paused for credits"]);
  const text = O.fallbackReply(f);
  assert.match(text, /Done: “Text my customers a reminder the day before their class”/);
  assert.match(text, /Paused for credits: “add an events page”/);
  // STORED, THE VIEW CARRIES IT TO THE PAGE.
  const stored = { ...r, oneReply: { for: round, state: "written", text, source: "fallback", at: NOW } };
  assert.equal(RQ.requestView(stored).reply.text, text);
});

test("R2 a part waiting on the owner with another done is owed a reply too; questions alone are not (their cards say them); work still going owes none", () => {
  assert.match(O.replyRound(rec([part(0, "done"), part(1, "waiting")])), /^paused:/);
  assert.equal(O.replyRound(rec([part(0, "waiting")])), "", "a question alone got a reply beside its card");
  assert.equal(O.replyRound(rec([part(0, "done"), part(1, "started")])), "");
  assert.equal(O.replyRound(rec([part(0, "done"), part(1, "blocked", { needs: [0] })])), "", "a part about to run counted as paused");
  assert.match(O.replyRound(rec([part(0, "credits"), part(1, "blocked", { needs: [0] })])), /^paused:/, "a part waiting on a paused one");
});

test("R3 the paused part finishes later: a follow-up reply is owed (a new round), never the old one served again", () => {
  const paused = rec([part(0, "done"), part(1, "credits", { why: "insufficient" })]);
  const r1 = O.replyRound(paused);
  const written = { ...paused, oneReply: { for: r1, state: "written", text: "x", source: "fallback", at: NOW } };
  assert.equal(O.oneReplyNext(written).act, "serve");
  const resumed = RQ.resumeCredits(written, NOW + 10);
  assert.equal(O.oneReplyNext(resumed).act, "none", "a reply while it runs again");
  const finished = RQ.settleState({ ...resumed, parts: resumed.parts.map((p) => (p.n === 1 ? { ...p, status: "done" } : p)) }, NOW + 20);
  const r2 = O.replyRound(finished);
  assert.match(r2, /^end:/);
  assert.notEqual(r2, r1);
  assert.equal(O.oneReplyNext(finished).act, "claim");
});

// ── A ──────────────────────────────────────────────────────────────────────
test("A1 the rules: ask with ask_owner, never in finish; WHICH SERVICE kept", () => {
  const r = SERVER_RULES.replace(/\s+/g, " ");
  assert.match(r, /Never choose the provider yourself/);
  assert.match(r, /CALL ask_owner to ask which one they use/);
  assert.match(r, /ASK WITH ask_owner, NEVER IN finish/);
  assert.ok(toolsFor({ canAsk: () => true }).some((t) => t.name === "ask_owner"), "offered where the caller can keep a question");
  assert.ok(!toolsFor({}).some((t) => t.name === "ask_owner"), "offered where it cannot");
});

test("A2 a supplied agent answer calling ask_owner ends the run with the question and its buttons", async () => {
  const out = await runSiteAgent({ canAsk: () => true, build: async () => ({ ok: true }), send: async () => ({ content: [{ type: "tool_use", id: "t1", name: "ask_owner", input: { question: "Which text message service do you use?", options: ["Twilio", "Vonage"] } }], usage: { input_tokens: 10, output_tokens: 5 } }) },
    { request: "Text my customers a reminder the day before their class", pages: [{ path: "index.tsx", source: "x" }], parts: [], model: "claude-sonnet-5" });
  assert.equal(out.ask.text, "Which text message service do you use?");
  assert.deepEqual(out.ask.options, ["Twilio", "Vonage"]);
  assert.deepEqual(out.changed, []);
});

test("A3 a part's job answering with the agent's question (stage agent): the part waits with the buttons on the view, and the answer resumes that part", () => {
  const msg = "Make the header green, and text my customers a reminder the day before their class";
  const planned = RQ.planParts(msg, { intent: "edit", layer: "look", alsoAsked: ["text my customers a reminder the day before their class"] });
  assert.equal(planned.ok, true);
  let r = RQ.newRequest({ key: KA, uid: "u1", slug: "northline-climbing", message: msg, picker: "sonnet", accepted: { intent: "edit", layer: "look" }, parts: planned.parts, at: NOW });
  const rows = {};
  let seq = 0, asked = false;
  const Q = { id: "q".repeat(20), text: "Which text message service do you use?", options: ["Twilio", "Vonage"], request: "text my customers a reminder the day before their class", stage: "agent", round: 1, queued: false };
  for (let i = 0; i < 12; i++) {
    const st = RQ.nextStep(r, rows, NOW + i);
    r = st.record;
    for (const f of st.files || []) {
      const id = (++seq).toString(16).padStart(32, "0");
      r = RQ.noteJobId(r, f.key, id);
      const body = f.kind === "route" ? { ok: true, intent: "edit", layer: "look" }
        : f.n === 1 ? (asked = true, { ok: false, error: "clarify", layer: "agent", cost: 1, unchanged: true, clarify: Q, msg: Q.text, deferred: [] })
        : { ok: true, layer: "agent", cost: 2, agent: { changed: ["src/components/site-header.tsx"], removed: [] } };
      rows[id] = { ok: true, state: "done", billing: "finalized", cost: body.cost || 1, needs_review: false, result: { status: 200, body: JSON.stringify(body) } };
    }
  }
  assert.ok(asked, "part 1 never ran");
  const p1 = r.parts[1];
  assert.equal(p1.status, "waiting", JSON.stringify(r.parts.map((p) => [p.status, p.why])));
  const v = RQ.requestView(r).parts[1];
  assert.deepEqual([v.question.text, v.question.options], [Q.text, Q.options]);
  const answered = RQ.answerPart(r, 1, { routed: { intent: "edit", layer: "look" }, resume: Q.request, context: [{ q: Q.text, a: "Twilio" }], round: 1, now: NOW + 50 });
  assert.equal(answered.parts[1].status, "ready");
  assert.equal(answered.parts[1].phase, "run");
  assert.equal(answered.parts[0].status, r.parts[0].status, "the answer touched another part");
});

test("A4 the page: a part's question is drawn as a card with its buttons (the request's question slot)", () => {
  const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const show = CHAT.slice(CHAT.indexOf("\nasync function siteRequestShow("), CHAT.indexOf("\n/** One part's reply from its job"));
  assert.match(show, /p\.status === 'waiting' && p\.question/);
  assert.match(show, /siteAskKeep\(origin, \{ \.\.\.q, request: \{ key, part: p\.n \} \}/);
});

// ── B ──────────────────────────────────────────────────────────────────────
const tsx = (route, h) => "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('" + route + "')({ component: P })\nfunction P(){return <main><h1>" + h + "</h1></main>}\n";
const use = (id, name, input) => ({ type: "tool_use", id, name, input });
const said = (content) => ({ content, usage: { input_tokens: 100, output_tokens: 50 } });

/** A first build's agent, answers supplied: the main agent by its round, each helper by the file it was handed. */
function firstBuild(mainRounds) {
  const calls = { main: 0, helpers: [], progress: [], builds: 0, concurrent: 0, peak: 0 };
  const send = async (req) => {
    const first = JSON.stringify(req.messages[0].content);
    const m = /has handed you ONE file to write: ([a-z-]+\.tsx)/.exec(first);
    if (m) {
      const file = m[1];
      const turn = req.messages.length;
      if (turn === 1) {
        calls.concurrent++; calls.peak = Math.max(calls.peak, calls.concurrent);
        await new Promise((ok) => setTimeout(ok, 5));
        calls.concurrent--;
        calls.helpers.push(file);
        return said([use("w" + file, "write_file", { file, source: tsx("/" + file.replace(".tsx", ""), file) })]);
      }
      return said([use("f" + file, "finish", { summary: file + " written" })]);
    }
    const r = mainRounds[calls.main++];
    return said(r || [use("fin", "finish", { summary: "done" })]);
  };
  return { calls, deps: { send, build: async () => { calls.builds++; return { ok: true }; }, progress: (stage, facts) => calls.progress.push([stage, facts]) } };
}
const DESC6 = "A climbing gym: home, classes, prices, team, events, contact";
const FOUNDATION = [use("h", "write_file", { file: "-parts/site-header", source: "export function SiteHeader(){return <nav>Home Classes Prices Team Events Contact</nav>}\n" }), use("i", "write_file", { file: "index.tsx", source: tsx("/", "Northline") })];

test("B1 a six-page description: the foundation first, built; then five parts in parallel, each writing only its page; all saved; one finish", async () => {
  const pages = ["classes", "prices", "team", "events", "contact"];
  const { calls, deps } = firstBuild([
    FOUNDATION,
    [use("b1", "build", {})],
    [use("hp", "helpers", { tasks: pages.map((p) => ({ file: p + ".tsx", brief: "the " + p + " page" })) })],
    [use("b2", "build", {})],
    [use("fin", "finish", { summary: "Built six pages." })],
  ]);
  const out = await runSiteAgent(deps, { request: DESC6, pages: [], parts: [], model: "claude-sonnet-5", ownParts: true, helpers: true, foundationFirst: true });
  assert.equal(out.ok, true, out.stopped);
  assert.deepEqual(calls.helpers.sort(), pages.map((p) => p + ".tsx").sort());
  assert.ok(calls.peak >= 2, "the parts did not run at the same time: peak " + calls.peak);
  for (const p of ["index.tsx", ...pages.map((x) => x + ".tsx")]) assert.ok(out.pages.some((x) => x.path === p), p + " not saved");
  assert.equal(calls.builds, 2, "the foundation's build and the joined build");
  // THE TASK BOX: each part is an `agent-part` mark, read back as a task.
  const marks = calls.progress.map(([stage, facts], n) => ({ n, stage, facts }));
  const tasks = buildPartsOf({ marks });
  assert.equal(tasks.length, 5);
  assert.ok(tasks.every((t) => t.state === "done"), JSON.stringify(tasks));
  assert.deepEqual(tasks.map((t) => t.title).sort(), pages.map((p) => p.charAt(0).toUpperCase() + p.slice(1) + " page").sort());
});

test("B2 the foundation comes first: helpers before a passing build with a home page are refused", async () => {
  const { calls, deps } = firstBuild([
    [use("hp", "helpers", { tasks: [{ file: "a.tsx", brief: "a" }, { file: "b.tsx", brief: "b" }] })],
    FOUNDATION, [use("b1", "build", {})], [use("fin", "finish", { summary: "x" })],
  ]);
  const out = await runSiteAgent(deps, { request: DESC6, pages: [], parts: [], model: "claude-sonnet-5", ownParts: true, helpers: true, foundationFirst: true });
  assert.equal(out.ok, true);
  assert.equal(calls.helpers.length, 0, "a helper ran before the foundation");
});

test("B3 a one-page description: one agent, no helpers; and the split's bounds (2 to " + MAX_HELPERS + ")", async () => {
  const { calls, deps } = firstBuild([[use("i", "write_file", { file: "index.tsx", source: tsx("/", "Solo") })], [use("b1", "build", {})], [use("fin", "finish", { summary: "One page." })]]);
  const out = await runSiteAgent(deps, { request: "A one-page site for my dog walking", pages: [], parts: [], model: "claude-sonnet-5", ownParts: true, helpers: true, foundationFirst: true });
  assert.equal(out.ok, true);
  assert.equal(calls.helpers.length, 0);
  assert.deepEqual(buildPartsOf({ marks: calls.progress.map(([stage, facts], n) => ({ n, stage, facts })) }), []);
  const ws = { has: (k) => k === "index.tsx" };
  const st = { built: true, dirty: false, ws };
  // THE WIRING: the first build asks for it.
  assert.match(readFileSync(new URL("../worker.js", import.meta.url), "utf8"), /helpers: !revise && !priorPages,\n(?:\s*\/\/.*\n)*\s*foundationFirst: !revise && !priorPages,/);
  assert.match(firstBuildSplitRefusal([{ file: "a.tsx" }], st), /write it yourself/);
  assert.match(firstBuildSplitRefusal(Array.from({ length: MAX_HELPERS + 1 }, (_, i) => ({ file: i + ".tsx" })), st), /at most/);
  assert.equal(firstBuildSplitRefusal([{ file: "a.tsx" }, { file: "b.tsx" }], st), "");
  assert.match(firstBuildSplitRefusal([{ file: "a.tsx" }, { file: "b.tsx" }], { ...st, dirty: true }), /foundation first/);
});

test("B4 the page: a build's parts are rows in the task box beside the build", () => {
  const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const cut = (h) => { const o = CHAT.indexOf("\n" + h); assert.ok(o > 0, h); return CHAT.slice(o, CHAT.indexOf("\n}\n", o) + 3); };
  const src = ["siteBuildJobItem", "siteBgItems", "siteReqKeys", "siteBuildJobParts"].map((n) => cut("function " + n + "(")).join("\n");
  const site = { id: "s1", msgs: [], requests: {}, buildJob: { job: "j1", state: "run", progress: [{ text: "Building Northline" }] } };
  let paints = 0;
  const ctx = vm.createContext({ SITE_BG_KEEP_MS: 60000, siteById: () => site, sitesSave: () => {}, siteOpenId: "s1", siteBgPaint: () => { paints++; }, siteParState: () => "run" });
  vm.runInContext(src, ctx);
  ctx.siteBuildJobParts("s1", [{ title: "/classes page", state: "run" }, { title: "/prices page", state: "done" }, { title: "x", state: "nope" }]);
  assert.equal(paints, 1);
  const items = ctx.siteBgItems(site, NOW);
  // THE WIRING: the build's poll carries the parts (worker) and the page keeps them (its poll).
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(W, /parts: at\.rec\.op === "build" \? buildPartsOf\(at\.rec\) : \[\]/);
  assert.match(W, /if \(pv\.lines\.length\) pend\.progress = pv\.lines;\n\s*if \(pv\.parts\.length\) pend\.parts = pv\.parts;/);
  assert.match(CHAT, /if \(Array\.isArray\(p\.progress\)\) setBuildProgress\(origin, p\.progress\);\n(?:\s*\/\/.*\n)*\s*if \(Array\.isArray\(p\.parts\)\) siteBuildJobParts\(origin, p\.parts\);/);
  assert.equal(JSON.stringify(items.map((i) => [i.title, i.state])), JSON.stringify([["Building Northline", "run"], ["/classes page", "run"], ["/prices page", "done"]]));
});
