// NO ROUTER: EVERY MESSAGE GOES TO THE SITE AGENT (2026-11-02, agent-only; the
// owner: "get rid of [the router] completely, just put it in the big agent").
//
// These cases run the REAL Worker (the routing route, the request, the queue,
// the edit route, the agent) against `test/fixtures/request-flow.mjs`, and read
// the model log: no case may make a routing model call (`T.route`).
//
//   AO1  "hey" on a site: one agent call, no router, the agent's own words, cheap.
//   AO2  "hey" on a new project: one agent call, no router, the words are the reply.
//   AO3  payments + emails: the agent asks which service (buttons); the answer resumes it.
//   AO4  three changes on three pages: split_work, three parts side by side, one request.
//   AO5  a new project's description: start_build (the build runs foundation-first).
//   AO6  split_work's own rules (2-6 parts, one page per part, before any change).
//   AO7  a split part never splits again; parts from a split carry their pages.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer is the case's. Nothing here
// says what a real model would answer.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, T, TOKEN } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { PAGES } from "./fixtures/live-ask.mjs";

delete process.env.GF_OLD_LANES;
const A = await import("../builder/site-agent.mjs");
const RQ = await import("../builder/request.mjs");
const O = await import("../builder/one-reply.mjs");

const use = (name, input) => ({ type: "tool_use", id: "t" + Math.random().toString(16).slice(2, 10), name, input });
const isAgent = (args) => (args.tools || []).some((t) => t.name === "finish");
const said = (args) => JSON.stringify(args.messages && args.messages[0] && args.messages[0].content);
const ORDER = "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/order')({ component: Page })\nfunction Page(){ return <main><h1>Order</h1></main> }\n";
const THREE = [...PAGES, { path: "order.tsx", source: ORDER }];

/** The "" answer: `pick(args, log)` for an agent call; anything else is counted as a stray call. */
function model(pick, log) {
  return (args) => {
    if (!isAgent(args)) { log.other++; return { __raw: { stop_reason: "end_turn", content: [{ type: "text", text: "NOT THE AGENT" }] } }; }
    log.agent++;
    log.tools.push((args.tools || []).map((t) => t.name));
    const r = pick(args, (args.messages || []).filter((m) => m.role === "assistant").length);
    return { __raw: { stop_reason: r.stop || "tool_use", content: r.content } };
  };
}

async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform({ slug: "ao-" + Math.random().toString(16).slice(2, 8), beside: true, balance: 400, ...opts });
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}
const noRouter = (P) => assert.equal(P.modelLog.filter((m) => m.tool === T.route).length, 0, "a routing model call was made: " + JSON.stringify(P.modelLog.map((m) => m.tool)));

async function newProject(P, message, extra = {}) {
  const worker = await loadWorker();
  return P.run(async () => {
    const ctx = makeCtx();
    const out = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
      method: "POST", headers: { "content-type": "application/json", Authorization: TOKEN },
      body: JSON.stringify({ message, picker: "sonnet", brief: message, qa: [], firstBuild: true, hasSite: false, slug: "", site: { name: "", url: "", pages: [], tables: [] }, ...extra }),
    }), P.env, ctx);
    await Promise.allSettled(ctx.pending);
    return { status: out.status, body: await out.json() };
  });
}

test("AO1 \"hey\" on a site: one agent call, no routing call, the agent's own words are the part's reply, cheap, nothing changed", async () => {
  const log = { agent: 0, other: 0, tools: [] };
  const HI = "Hi! I'm here. Tell me what you'd like to change on Harbour Loaf.";
  await withPlatform({ answers: { "": model(() => ({ stop: "end_turn", content: [{ type: "text", text: HI }] }), log) } }, async (P) => {
    const before = P.page("index.tsx");
    const r = await sendMessage(P, { message: "hey" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.cost, 0, "the message was charged before the agent ran: " + JSON.stringify(r.body));
    assert.equal(r.body.request.parts.length, 1, JSON.stringify(r.body.request));
    const { rec } = await settle(P, r.key, { rounds: 20 });
    noRouter(P);
    assert.equal(log.agent, 1, "one agent call");
    assert.equal(log.other, 0, "another model was asked");
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts[0]));
    const jobs = P.jobsOf(r.key).filter((j) => j.op === "edit");
    assert.equal(jobs.length, 1);
    const body = JSON.parse(jobs[0].result.body);
    assert.ok(body.msg.startsWith(HI), body.msg);
    assert.ok(Number(jobs[0].cost) <= 2, "not cheap: " + jobs[0].cost);
    assert.equal(P.page("index.tsx"), before);
    // THE AGENT IS OFFERED split_work AS A REQUEST'S OWN PART.
    assert.ok(log.tools[0].includes("split_work"), "split_work not offered: " + log.tools[0]);
  });
});

test("AO2 \"hey\" on a new project: one agent call (new-project tools only), no routing call, its words are the reply, no build", async () => {
  const log = { agent: 0, other: 0, tools: [] };
  const HI = "Hello! Tell me about your business and I'll build its site.";
  await withPlatform({ answers: { "": model(() => ({ stop: "end_turn", content: [{ type: "text", text: HI }] }), log) } }, async (P) => {
    const r = await newProject(P, "hey");
    assert.equal(r.status, 200, JSON.stringify(r.body));
    noRouter(P);
    assert.equal(r.body.intent, "ask", JSON.stringify(r.body));
    assert.equal(r.body.answer, HI);
    assert.equal(r.body.agent, true);
    assert.equal(log.agent, 1);
    assert.deepEqual([...log.tools[0]].sort(), [...A.NEW_PROJECT_TOOLS].sort());
    assert.ok(r.body.cost >= 0 && r.body.cost <= 2, "cost " + r.body.cost);
  });
});

test("AO3 payments and emails: the agent asks which service with buttons, the part waits, and the answer resumes that part (no routing call)", async () => {
  const log = { agent: 0, other: 0, tools: [] };
  const Q = { question: "Which payment service do you use?", options: ["Stripe", "PayPal", "Square"] };
  const seen = [];
  await withPlatform({
    answers: { "": model((args, round) => {
      const t = said(args);
      seen.push(t);
      if (/PayPal/.test(t) && /Which payment service/.test(t)) return { content: [use("finish", { summary: "Noted PayPal; card payments and confirmation emails are set to go through PayPal." })] };
      return { content: [use("ask_owner", Q)] };
    }, log) },
  }, async (P) => {
    const r = await sendMessage(P, { message: "When someone books a class, take payment by card and email them a confirmation" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    let { rec } = await settle(P, r.key, { rounds: 20 });
    noRouter(P);
    assert.equal(rec.parts[0].status, "waiting", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const v = RQ.requestView(rec).parts[0];
    assert.equal(v.question.text, Q.question);
    assert.deepEqual(v.question.options, Q.options, "the card's buttons");
    // THE ANSWER: the page posts it with the question's id.
    const a = await sendMessage(P, { message: "PayPal", ask: { id: v.question.id, chosen: true } });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    ({ rec } = await settle(P, r.key, { rounds: 20 }));
    noRouter(P);
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(log.agent, 2, "asked once, resumed once");
    assert.match(seen[1], /PayPal/, "the resumed agent was not shown the answer");
  });
});

test("AO4 three changes on three pages: the agent calls split_work, three parts run side by side as agent jobs, one request, no routing call", async () => {
  const log = { agent: 0, other: 0, tools: [] };
  const MSG = "Make the home heading say Fresh Bread Daily, put opening hours on the visit page, and add a price list to the order page";
  const SPLIT = [
    { instruction: "On the home page, change the main heading to: Fresh Bread Daily", pages: ["/"] },
    { instruction: "On the visit page, add our opening hours: Mon-Sat 7am-3pm", pages: ["/visit"] },
    { instruction: "On the order page, add a price list: sourdough £5, rye £4", pages: ["/order"] },
  ];
  const FILE = { "/": ["index.tsx", "Fresh Bread Daily"], "/visit": ["visit.tsx", "Mon-Sat 7am-3pm"], "/order": ["order.tsx", "sourdough £5"] };
  let live = 0, most = 0;
  const childOf = (t) => SPLIT.findIndex((s) => t.includes(s.instruction));
  await withPlatform({
    pages: THREE,
    answers: { "": model((args, round) => {
      const t = said(args);
      const k = childOf(t);
      if (k < 0) return { content: [use("split_work", { parts: SPLIT })] };
      const [file, words] = FILE[SPLIT[k].pages[0]];
      if (round === 0) { live++; most = Math.max(most, live); return { content: [use("read_files", { files: [file] })] }; }
      if (round === 1) {
        const src = THREE.find((p) => p.path === file).source.replace("</main>", "<p>" + words + "</p></main>");
        return { content: [use("write_file", { file, source: src })] };
      }
      if (round === 2) return { content: [use("build", {})] };
      live--;
      return { content: [use("finish", { summary: "Added " + words + " to " + SPLIT[k].pages[0] + "." })] };
    }, log) },
  }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const { rec } = await settle(P, r.key, { rounds: 40 });
    noRouter(P);
    assert.equal(rec.parts.length, 4, JSON.stringify(rec.parts.map((p) => [p.n, p.source, p.status])));
    assert.equal(rec.parts[0].status, "done");
    assert.equal(rec.parts[0].outcome.kind, "split-work");
    assert.deepEqual(rec.parts.slice(1).map((p) => p.source), ["agent", "agent", "agent"]);
    assert.deepEqual(rec.parts.slice(1).map((p) => p.words), SPLIT.map((s) => s.instruction));
    assert.deepEqual(rec.parts.slice(1).map((p) => p.targets.writes), [["page:/"], ["page:/visit"], ["page:/order"]]);
    assert.deepEqual(rec.parts.slice(1).map((p) => p.status), ["done", "done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.ended, true);
    // EACH PART IS ITS OWN AGENT JOB, BILLED ON ITS OWN.
    const jobs = P.jobsOf(r.key).filter((j) => j.op === "edit");
    assert.equal(jobs.length, 4, JSON.stringify(jobs.map((j) => j.idem_key)));
    // AND ITS WORK LANDED.
    assert.match(P.page("index.tsx"), /Fresh Bread Daily/);
    assert.match(P.page("visit.tsx"), /Mon-Sat 7am-3pm/);
    assert.match(P.page("order.tsx"), /sourdough £5/);
    // THE SPLIT PARTS WERE NOT OFFERED split_work AGAIN.
    const childTools = log.tools.slice(1);
    assert.ok(childTools.length >= 3 && childTools.every((t) => !t.includes("split_work")), "a split part was offered split_work");
    // ONE REPLY FOR THE MESSAGE: the view counts four parts, every one ended.
    const view = RQ.requestView(rec);
    assert.equal(view.parts.length, 4);
    // THE ONE REPLY (`one-reply.mjs`) IS OWED ONCE, NOW, with every part's ending in its facts.
    assert.equal(O.oneReplyNext(rec).act, "claim");
    assert.deepEqual(O.requestFacts(view).parts.map((p) => p.ending), ["done", "done", "done", "done"]);
    // SIDE BY SIDE: all three parts' jobs were filed together, before any of
    // them ended (the harness's queue then delivers them one at a time).
    const kids = jobs.slice(1);
    const lastFiled = Math.max(...kids.map((j) => j.created_at));
    const firstEnded = Math.min(...kids.map((j) => j.updated_at));
    assert.ok(lastFiled <= firstEnded, "a part was filed only after another ended: " + JSON.stringify(kids.map((j) => [j.created_at, j.updated_at])));
    void most;
  });
});

test("AO5 a new project's description: the agent calls start_build, and the route answers build (no routing call)", async () => {
  const log = { agent: 0, other: 0, tools: [] };
  await withPlatform({ answers: { "": model(() => ({ content: [use("start_build", { brief: "A climbing gym in Leeds with classes and a café" })] }), log) } }, async (P) => {
    const r = await newProject(P, "I run a climbing gym in Leeds with kids' classes and a café. Make me a site.");
    assert.equal(r.status, 200, JSON.stringify(r.body));
    noRouter(P);
    assert.equal(r.body.intent, "build", JSON.stringify(r.body));
    assert.equal(log.agent, 1);
  });
});

test("AO5b a new project the agent must ask about: the card with buttons (clarify), no routing call", async () => {
  const log = { agent: 0, other: 0, tools: [] };
  await withPlatform({ answers: { "": model(() => ({ content: [use("ask_owner", { question: "Is it a shop or a booking site?", options: ["Shop", "Bookings"] })] }), log) } }, async (P) => {
    const r = await newProject(P, "make me a site for my studio");
    noRouter(P);
    assert.equal(r.body.intent, "clarify", JSON.stringify(r.body));
    assert.deepEqual(r.body.question.options, ["Shop", "Bookings"]);
  });
});

test("AO6 split_work's own rules: 2 to 6 parts, one part per page, only before any change, only where offered", async () => {
  assert.ok(A.readSplitWork([{ instruction: "a", pages: ["/"] }]).error);
  assert.ok(A.readSplitWork(Array.from({ length: 7 }, (_, i) => ({ instruction: "x" + i, pages: ["/p" + i] }))).error);
  assert.match(A.readSplitWork([{ instruction: "a", pages: ["/x"] }, { instruction: "b", pages: ["/x/"] }]).error, /both change \/x/);
  assert.ok(A.readSplitWork([{ instruction: "", pages: [] }, { instruction: "b", pages: [] }]).error);
  assert.ok(A.readSplitWork([{ instruction: "a", pages: ["about"] }, { instruction: "b", pages: [] }]).error, "a page that is not an address");
  assert.deepEqual(A.readSplitWork([{ instruction: "a", pages: ["/"] }, { instruction: "b", pages: [] }]).parts.length, 2);
  assert.ok(!A.toolsFor({}).some((t) => t.name === "split_work"), "offered with no request to split into");
  assert.ok(A.toolsFor({ split: () => true }).some((t) => t.name === "split_work"));
  // AFTER A WRITE: refused, so nothing written is ever dropped by a split.
  let n = 0;
  const out = await A.runSiteAgent({ split: () => true, build: async () => ({ ok: true }), send: async () => {
    n++;
    if (n === 1) return { content: [use("write_file", { file: "index.tsx", source: PAGES[0].source + "\n" }), use("split_work", { parts: [{ instruction: "a", pages: ["/"] }, { instruction: "b", pages: ["/visit"] }] })], usage: { input_tokens: 1, output_tokens: 1 } };
    return { content: [use("build", {})], usage: { input_tokens: 1, output_tokens: 1 } };
  } }, { request: "x", pages: PAGES, parts: [], model: "m", maxRounds: 2 });
  assert.equal(out.split, null, "a split after a write was taken");
});

test("AO7 the request: a split's parts are routed already (no routing job), carry their pages, wait for nothing but their parent, and never split again", () => {
  const msg = "Three changes on three pages";
  const planned = RQ.planParts(msg, { intent: "edit", layer: "page", page: "/" });
  let rec = RQ.newRequest({ key: "rqagentonly00000001", uid: "u1", slug: "fretwork-1", message: msg, picker: "sonnet", accepted: { intent: "edit" }, parts: planned.parts, at: 1 });
  const made = RQ.splitParts(rec, 0, [{ instruction: "one", pages: ["/"] }, { instruction: "two", pages: ["/a"] }, { instruction: "three", pages: [] }]);
  assert.deepEqual(made, [1, 2, 3]);
  assert.deepEqual(rec.parts.slice(1).map((p) => [p.phase, p.route && p.route.op, p.parent, p.needs.length]), [["run", "edit", 0, 0], ["run", "edit", 0, 0], ["run", "edit", 0, 0]]);
  assert.equal(rec.parts[3].targets, null);
  assert.equal(RQ.partOf(rec, 1).splitChild, true);
  assert.equal(RQ.partOf(rec, 0).splitChild, undefined);
  assert.equal(RQ.readRequestOf(RQ.partOf(rec, 1)).splitChild, true, "the flag survives the job's wire");
  assert.deepEqual(RQ.splitParts(rec, 1, [{ instruction: "x", pages: [] }, { instruction: "y", pages: [] }]), [], "a split part split again");
  assert.deepEqual(RQ.splitParts(rec, 0, [{ instruction: "x", pages: [] }]), [], "one part is not a split");
});

// AO8: A NEW SITE'S BUILD, through the real `POST /api/site/react-build`: the
// agent writes the foundation (shared header and footer, the home page) and
// builds it, then hands the other pages to helpers that write at the same time
// (the build's own `helpers`, one job, one bill), and the build publishes them
// all. No routing call is made anywhere on the way.
test("AO8 a new site's build: the foundation first, built, then the other pages written in parallel by helpers; all stored; no routing call", async () => {
  const { driveBuild, GOOD_DESIGN, BRIEF } = await import("./fixtures/build-route.mjs");
  const HEADER = "export default function SiteHeader(){return <header>Harbour Loaf <a href=\"/menu\">Menu</a> <a href=\"/visit\">Visit</a></header>}\n";
  const FOOTER = "export default function SiteFooter(){return <footer>Leeds</footer>}\n";
  const pg = (route, name, body) => "import { createFileRoute } from '@tanstack/react-router'\nimport SiteHeader from './-parts/site-header'\nimport SiteFooter from './-parts/site-footer'\n" +
    "export const Route = createFileRoute('" + route + "')({ component: " + name + " })\nfunction " + name + "(){return <main><SiteHeader /><h1>" + body + "</h1><SiteFooter /></main>}\n";
  const lead = [];
  const helpers = [];
  let live = 0, most = 0;
  const r = await driveBuild({
    design: { input: GOOD_DESIGN },
    body: { brief: BRIEF },
    onFetch: async (url, init) => {
      if (!url.includes("/v1/messages")) return null;
      const b = JSON.parse(String((init && init.body) || "{}"));
      if (!(Array.isArray(b.tools) && b.tools.some((t) => t.name === "finish"))) return null;
      const first = String(b.messages[0].content[0].text || "");
      const reply = (content) => new Response(JSON.stringify({ stop_reason: "tool_use", content, usage: { input_tokens: 200, output_tokens: 90 } }), { headers: { "content-type": "application/json" } });
      if (/YOU ARE A HELPER/.test(first)) {
        const file = /ONE file to write: menu\.tsx/.test(first) ? "menu.tsx" : "visit.tsx";
        const round = b.messages.filter((m) => m.role === "assistant").length;
        if (round === 0) {
          helpers.push(file); live++; most = Math.max(most, live);
          await new Promise((ok) => setTimeout(ok, 30));
          return reply([use("write_file", { file, source: file === "menu.tsx" ? pg("/menu", "Menu", "Our loaves") : pg("/visit", "Visit", "Find us") })]);
        }
        live--;
        return reply([use("finish", { summary: "Wrote " + file + "." })]);
      }
      lead.push(b);
      const rounds = [
        [use("write_file", { file: "index.tsx", source: pg("/", "Home", "Harbour Loaf") }), use("write_file", { file: "-parts/site-header", source: HEADER }), use("write_file", { file: "-parts/site-footer", source: FOOTER })],
        [use("build", {})],
        [use("helpers", { tasks: [{ file: "menu.tsx", brief: "The menu page: our loaves." }, { file: "visit.tsx", brief: "The visit page: find us." }] })],
        [use("build", {})],
        [use("finish", { summary: "Built Home, Menu and Visit." })],
      ];
      return reply(rounds[Math.min(lead.length - 1, rounds.length - 1)]);
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r.reply).slice(0, 400));
  assert.ok(r.seen.tools.length > 0, "the observer saw no call");
  assert.ok(!r.seen.tools.includes(T.route), "a routing call was made: " + r.seen.tools.join(","));
  assert.ok((lead[0].tools || []).some((t) => t.name === "helpers"), "a new site's agent was not offered helpers");
  assert.deepEqual(helpers.slice().sort(), ["menu.tsx", "visit.tsx"]);
  assert.ok(most >= 2, "the helpers ran one at a time");
  const stored = [...r.store.entries()].find(([k]) => /^source\/[^/]+\/pages\.json$/.test(k));
  assert.ok(stored, "no pages stored: " + JSON.stringify(r.reply).slice(0, 400));
  assert.deepEqual(JSON.parse(stored[1]).map((p) => p.path).sort(), ["index.tsx", "menu.tsx", "visit.tsx"]);
});
