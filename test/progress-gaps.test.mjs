// THE PROGRESS FEATURE'S REMAINING GAPS, REPRODUCED AND CLOSED (2026-10-06).
//
// The owner, after Codex reproduced the first of them: *"a standalone partial
// result being displayed as fully finished … Derive the displayed state and
// model-written summary from the actual outcome across Edit and Add-on,
// covering partial results, clarification, handoffs and unverified outcomes;
// unverified must not select a sentence saying the requested change is
// actively happening … Close the documented race where a failed or timed-out
// progress close lets a writer commit after its last job-state check and after
// finalization … Fix makeProgress dropping a milestone when JOB_PROGRESS
// fails: retain its identity and retry automatically while appropriate …
// prevent duplicates when the first delivery landed but its response was
// lost."*
//
// Every case runs the real Worker on the stateful platform
// (`test/fixtures/request-flow.mjs`) and, where a page reads the answer, the
// real functions of public/chat.js in a VM (`test/fixtures/browser-page.mjs`)
// answered by that same Worker — so what the card shows is read off what the
// server really served, never off a body the case wrote.
//
//   OUTCOME   the card of a job found from another device, and a request
//             part, named by the job's real outcome: partial, waiting for an
//             answer, handed over, unverified, finished, not done, stopped;
//   RACE      a line committed after the job's end — its close failed — is
//             never served: not by the poll, a request's view, the list, a
//             reload or another device; a line committed while the job ran is
//             shown at once, and one whose confirmation was lost is confirmed
//             later while the job still runs;
//   RECORDER  a milestone whose delivery fails is kept, with its number, and
//             sent again on its own — no other milestone, no page — until it
//             is answered; one that landed and whose answer was lost is
//             recorded once; a refusal is not sent again; order is kept.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. Every model answer is supplied: nothing here
// shows what a real model writes, how long it takes or what it costs.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, pump, tick, call, settle, deliver, browserBody, T, USER } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import util from "node:util";
import * as NU from "../scripts/narration-usage.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { page as openPage } from "./fixtures/browser-page.mjs";
import { gatewayKey, signJobToken } from "../builder/job-gateway.mjs";
import { makeContainerEnv } from "../builder/container-env.mjs";
import { progressKey, TASK_BATCH } from "../builder/site-progress.mjs";
import { editJobOutcome } from "../builder/request.mjs";
import { readFileSync } from "node:fs";

const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const GATE_MS = 20_000;
const gate = () => {
  let open, reach, timer;
  const g = { opened: new Promise((r) => { open = r; }) };
  g.reached = new Promise((r, no) => { reach = r; timer = setTimeout(() => no(new Error("the case's gate was never reached")), GATE_MS); timer.unref(); });
  g.reached.catch(() => {});
  g.open = open;
  g.reach = () => { clearTimeout(timer); reach(); };
  return g;
};
const slugOf = (k) => "pg-" + k + "-" + Math.random().toString(16).slice(2, 8);
const settleMs = (ms = 20) => new Promise((r) => setTimeout(r, ms));
let platformNow = null;
const anyTask = (m) => !!(m && m.body && m.body.kind === "edit-progress");
const isTask = (m) => anyTask(m) && !!platformNow && platformNow.jobs.has(m.body.id);
const takeTask = (P) => { const i = P.queue.findIndex((m) => anyTask(m) && P.jobs.has(m.body.id)); assert.ok(i >= 0, "no progress task was queued"); return P.queue.splice(i, 1)[0]; };
const jobMsg = (P) => { const i = P.queue.findIndex((m) => m.body && m.body.kind === "site-edit"); assert.ok(i >= 0, "no job was filed"); return P.queue.splice(i, 1)[0]; };

async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  platformNow = P;
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); platformNow = null; }
}

// ── THE PAGE, ON ANOTHER DEVICE, ANSWERED BY THE REAL WORKER ─────────────────

/** A page load that knows nothing of the site's work, every request answered by the platform's own Worker. */
function device(P, { polls = true } = {}) {
  return openPage({
    site: { id: "origin-1", slug: P.slug, react: true, name: "Harbour Loaf", url: "https://" + P.slug + ".gofarther.app/", pages: [{ path: "/" }], msgs: [] },
    timers: true,
    answer: (url, method, body) => {
      // A POLL THAT NEVER ANSWERS (`polls: false`): the card as the list alone drew it.
      if (!polls && url.startsWith("/api/site/edit/")) return null;
      return call(P, method, url, body).then((r) => ({ status: r.status, body: r.body, headers: r.headers ? Object.fromEntries(r.headers) : {} }));
    },
  });
}
const pageSettle = async (p, until, rounds = 200) => { for (let i = 0; i < rounds && !until(); i++) await settleMs(5); };
const unesc = (t) => String(t == null ? "" : t).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
/** A found job's card as the page draws it: its line (or words), its fixed label, its lines. */
function cardOf(p, job) {
  const html = p.ctx.siteJobCardHTML({ jobCard: job }, p.s);
  return {
    html,
    words: unesc((html.match(/<span class="st-req-words">(.*?)<\/span>/) || [])[1]),
    label: unesc((html.match(/<span class="st-req-status">(.*?)<\/span>/) || [])[1]),
    lines: [...html.matchAll(/<span class="at">[^<]*<\/span>([^<]*)/g)].map((m) => unesc(m[1])),
  };
}
/** A request's card, part by part: each one's line (or words) and its fixed label. */
function partsOf(p, key) {
  const html = p.ctx.siteRequestHTML({ request: key }, p.s);
  return [...html.matchAll(/<li class="st-req-part[^"]*"><span class="st-req-words">(.*?)<\/span><span class="st-req-status">(.*?)<\/span>/g)].map((m) => ({ words: unesc(m[1]), label: unesc(m[2]) }));
}

/** What the page posts for a decision, filed as the page files it, under a key of its own. */
async function filePage(P, d, instruction, idem) {
  const site = { slug: P.slug, name: "Harbour Loaf", react: true, pages: [{ path: "/" }, { path: "/visit" }], msgs: [] };
  const posted = browserBody(site, d, instruction);
  const filed = await call(P, "POST", posted.url, { ...posted.body, idem });
  assert.ok([200, 202].includes(filed.status), JSON.stringify(filed.body));
  assert.ok(filed.body && typeof filed.body.job === "string", "the page's post filed no job: " + JSON.stringify(filed.body));
  return filed.body.job;
}

// A MENU ON TWO PAGES, for the add-on that sets a menu link aside (request-flow's M4).
const NAV = (items) => "<SiteHeader links={[" + items.map(([l, h]) => "{ label: \"" + l + "\", href: \"" + h + "\" }").join(", ") + "]} />";
const NAV_PAGES = [
  { path: "index.tsx", source: pageSrc("/", NAV([["Home", "/"], ["Visit", "/visit"]]) + "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour.</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", NAV([["Home", "/"], ["Visit", "/visit"]]) + "<section className=\"come\"><h1>Come to the bakery</h1><p>The street.</p></section>") },
];
const GALLERY_LINK = "Add a gallery page and put a link to it in the menu";
const DESC = "Change the site description to say we bake overnight sourdough";
const QD = { text: "Which word should lead — overnight or slow?", options: ["Overnight", "Slow"] };
const OPEN = "Change the opening line on the home page to say we open at 8";
const LINE_FROM = "Bread from the harbour, every morning.";
const textAnswer = (to) => (args) => {
  const lines = String(args.messages[0].content).split("\n");
  const at = lines.find((l) => l.includes("[index.tsx] " + LINE_FROM));
  return { edits: [{ id: Number(String(at || "-1.").split(".")[0]), to }] };
};
/** The supplied task-lines writer's line for a state, as the fixture marks it. */
const said = (state, words) => "(" + state + ") " + words;

// ─────────────────────────────────────────────────────────────────────────────
// OUTCOME — THE CARD SAYS WHAT REALLY HAPPENED
// ─────────────────────────────────────────────────────────────────────────────

test("OUTCOME 0 — THE RULE, ONE ROW AT A TIME: held for review before anything else; queued or running from the row; stopped from the row or the answer; no answer is not done; a hand-over is a hand-over; a success that asked is waiting, one that named work left undone or put a part off is partial; a question or a refusal that asks is waiting; anything else not done", () => {
  const row = (state, body, x = {}) => ({ state, billing: "finalized", result: body === undefined ? null : { status: x.status || 200, body: JSON.stringify(body) }, ...x });
  const cases = [
    [row("failed", { ok: true }, { needs_review: true }), "edit", "unverified"],
    [row("editing", undefined, { needs_review: true }), "edit", "unverified"],
    [row("queued"), "edit", "queued"],
    [row("editing"), "edit", "running"],
    [row("publishing"), "addon", "running"],
    [row("cancelled"), "edit", "cancelled"],
    [row("failed", { ok: false, error: "cancelled" }), "edit", "cancelled"],
    [row("failed", { ok: false, error: "x", detail: "cancelled" }), "edit", "cancelled"],
    [row("lost", undefined, { billing: "refunded" }), "edit", "failed"],
    [row("failed", { ok: false, error: "stale" }, { billing: "refunded" }), "edit", "failed"],
    [row("done", undefined), "edit", "done"],
    [row("done", { ok: false, escalate: true, layer: "text" }), "edit", "handoff"],
    [row("done", { ok: false, escalate: true }), "addon", "handoff"],
    [row("done", { ok: true, recovered: true }), "edit", "done"],
    [row("done", { ok: true, clarify: { id: "q1", text: "Which one?" } }), "edit", "waiting"],
    [row("done", { ok: true, partial: [{ page: "/visit", layer: "picture", error: "no-photo" }] }), "edit", "partial"],
    [row("done", { ok: true, deferred: ["make the footer darker"] }), "edit", "partial"],
    [row("done", { ok: true, notAdded: [{ name: "Gallery link", why: "left-out" }] }), "addon", "partial"],
    [row("done", { ok: true, notAdded: [{ name: "Gallery link", why: "left-out" }] }), "edit", "done"],
    [row("done", { ok: true }), "addon", "done"],
    [row("failed", { ok: false, error: "clarify", clarify: { id: "q2", text: "Which page?" } }), "edit", "waiting"],
    [row("failed", { ok: false, error: "no-match", clarify: { id: "q3", text: "Did you mean the hour lesson?" } }), "edit", "waiting"],
    [row("failed", { ok: false, error: "no-match", msg: "No such row." }), "edit", "failed"],
    [row("failed", { ok: true }, { status: 503 }), "edit", "failed"],
  ];
  for (const [r, op, want] of cases) assert.equal(editJobOutcome(r, op), want, JSON.stringify({ state: r.state, review: r.needs_review, op, body: r.result && r.result.body }));
  for (const bad of [null, undefined, "done", {}, { state: 7 }, { state: "mystery" }]) assert.equal(editJobOutcome(bad, "edit"), null, JSON.stringify(bad));
});

test("OUTCOME 1 — CODEX'S REPRODUCTION: a page-filed add-on that did only part of what was asked (its menu link set aside) answers ok:true; the server serves its outcome as partial, and another device's card says Partly done with the model's own line for that — never Finished, never the done line", async () => {
  await withPlatform({
    slug: slugOf("oc1"), pages: NAV_PAGES, replies: true, progress: true,
    answers: { [T.adds]: { kinds: ["page", "frame"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } },
  }, async (P) => {
    const id = await filePage(P, { intent: "addon" }, GALLERY_LINK, "a".repeat(32));
    await pump(P);
    assert.equal(P.jobs.get(id).state, "done", "the add-on did not finish");
    const answer = P.answerOf(P.jobs.get(id));
    assert.equal(answer.ok, true, "the case needs the ok:true answer Codex reproduced with");
    // THE SERVER'S OWN READING: the poll and the list.
    const poll = await call(P, "GET", "/api/site/edit/" + id);
    assert.equal(poll.body.outcome, "partial", "the poll did not serve the job's real outcome: " + JSON.stringify({ outcome: poll.body.outcome }));
    const list = await call(P, "GET", "/api/site/requests/" + P.slug);
    assert.equal(list.body.jobs[0].outcome, "partial", "the list did not serve the job's real outcome");
    // ANOTHER DEVICE: the card drawn from the list, then followed to the end.
    const p = device(P);
    p.ctx.siteRequestsCheck(p.s);
    await pageSettle(p, () => !!(p.s.jobCards && p.s.jobCards[id] && p.s.jobCards[id].closed));
    const card = cardOf(p, id);
    assert.equal(card.label, "Partly done", "the card's label: " + card.label);
    assert.equal(card.words, said("partial", GALLERY_LINK), "the card's line: " + card.words);
    assert.doesNotMatch(card.html, /Finished|\(done\)/, "the partial job was shown as finished");
    // AND THE CARD AS THE LIST ALONE DRAWS IT, before any poll answers.
    const q = device(P, { polls: false });
    q.ctx.siteRequestsCheck(q.s);
    await pageSettle(q, () => !!(q.s.jobCards && q.s.jobCards[id]));
    assert.equal(cardOf(q, id).label, "Partly done", "the list's own drawing called the partial job finished");
  });
});

test("OUTCOME 2 — A QUESTION, A HAND-OVER: a page-filed edit whose step asked the customer something is Waiting for your answer, with the model's waiting line; one whose step handed the change on to another is Handed over, with the line that it is still to be made — neither is called Not done", async () => {
  await withPlatform({
    slug: slugOf("oc2"), replies: true, progress: true,
    answers: { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": { question: QD }, [T.text]: textAnswer("Open from 8 every morning.") },
  }, async (P) => {
    const asked = await filePage(P, { intent: "edit", layer: "look" }, DESC, "b".repeat(32));
    await pump(P);
    assert.equal(P.answerOf(P.jobs.get(asked)).error, "clarify", "the case needs the step's question");
    const handed = await filePage(P, { intent: "edit", layer: "data" }, OPEN, "c".repeat(32));
    await pump(P);
    assert.equal(P.answerOf(P.jobs.get(handed)).escalate, true, "the case needs the step's hand-over");
    assert.equal((await call(P, "GET", "/api/site/edit/" + asked)).body.outcome, "waiting");
    assert.equal((await call(P, "GET", "/api/site/edit/" + handed)).body.outcome, "handoff");
    const p = device(P);
    p.ctx.siteRequestsCheck(p.s);
    await pageSettle(p, () => [asked, handed].every((j) => p.s.jobCards && p.s.jobCards[j] && p.s.jobCards[j].closed));
    const a = cardOf(p, asked);
    assert.equal(a.label, "Waiting for your answer");
    assert.equal(a.words, said("waiting", DESC));
    const h = cardOf(p, handed);
    assert.equal(h.label, "Handed over");
    assert.equal(h.words, said("planned", OPEN));
    for (const c of [a, h]) assert.doesNotMatch(c.html, /Not done|\(notdone\)/, "a question or a hand-over was called not done");
  });
});

test("OUTCOME 3 — UNVERIFIED NEVER READS AS HAPPENING NOW: a job held for review after it began publishing — its answer stored ok, or its row still running — is Checking it published, with the model's unconfirmed line; never the doing line, never Finished or Not done", async () => {
  // A STORED ANSWER, the row then routed to review as the refund RPC routes a death mid-publish.
  await withPlatform({
    slug: slugOf("oc3a"), replies: true, progress: true,
    answers: { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } },
  }, async (P) => {
    const id = await filePage(P, { intent: "addon" }, "add a gallery page", "d".repeat(32));
    await pump(P);
    assert.equal(P.answerOf(P.jobs.get(id)).ok, true);
    Object.assign(P.jobs.get(id), { state: "failed", needs_review: true });
    assert.equal((await call(P, "GET", "/api/site/edit/" + id)).body.outcome, "unverified");
    const p = device(P);
    p.ctx.siteRequestsCheck(p.s);
    await pageSettle(p, () => !!(p.s.jobCards && p.s.jobCards[id] && p.s.jobCards[id].closed));
    const c = cardOf(p, id);
    assert.equal(c.label, "Checking it published");
    assert.equal(c.words, said("unconfirmed", "add a gallery page"));
    assert.doesNotMatch(c.html, /\(doing\)|Finished|Not done/);
  });
  // A ROW STILL RUNNING, parked for review by the sweep: the poll's own answer says so.
  const g = gate();
  await withPlatform({
    slug: slugOf("oc3b"), replies: true, progress: true,
    answers: { [T.adds]: { kinds: ["page"] }, "add:page": async () => { g.reach(); await g.opened; return { page: [PAGE("/gallery", "Gallery")] }; }, [T.pages]: { pages: [writtenPage("/gallery")] } },
  }, async (P) => {
    const id = await filePage(P, { intent: "addon" }, "add a gallery page", "e".repeat(32));
    const running = deliver(P, jobMsg(P));
    await g.reached;
    for (let n = 0; n < 50 && !P.queue.some(isTask); n++) await settleMs(5);
    await deliver(P, takeTask(P));
    P.jobs.get(id).needs_review = true;
    const poll = await call(P, "GET", "/api/site/edit/" + id);
    assert.equal(poll.body.outcome, "unverified");
    const p = device(P);
    p.ctx.siteRequestsCheck(p.s);
    await pageSettle(p, () => !!(p.s.jobCards && p.s.jobCards[id] && p.s.jobCards[id].closed));
    const c = cardOf(p, id);
    assert.equal(c.label, "Checking it published");
    assert.equal(c.words, said("unconfirmed", "add a gallery page"));
    assert.doesNotMatch(c.html, /\(doing\)|Not done/);
    P.jobs.get(id).needs_review = false;
    g.open();
    await running;
  });
});

test("OUTCOME 4 — THE CONTROLS: a job that did everything is Finished with the done line; one that failed is Not done; one the customer stopped while it ran is Stopped — each from the server's outcome", async () => {
  await withPlatform({
    slug: slugOf("oc4"), replies: true, progress: true,
    answers: { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } },
  }, async (P) => {
    const done = await filePage(P, { intent: "addon" }, "add a gallery page", "f".repeat(32));
    await pump(P);
    assert.equal((await call(P, "GET", "/api/site/edit/" + done)).body.outcome, "done");
    const p = device(P);
    p.ctx.siteRequestsCheck(p.s);
    await pageSettle(p, () => !!(p.s.jobCards && p.s.jobCards[done] && p.s.jobCards[done].closed));
    assert.deepEqual([cardOf(p, done).label, cardOf(p, done).words], ["Finished", said("done", "add a gallery page")]);
  });
  // STOPPED: the customer's stop, caught at the job's next gate (request-flow's own way).
  const g = gate();
  await withPlatform({
    slug: slugOf("oc4c"), replies: true, progress: true,
    answers: { [T.adds]: { kinds: ["page"] }, "add:page": async () => { g.reach(); await g.opened; return { page: [PAGE("/gallery", "Gallery")] }; }, [T.pages]: { pages: [writtenPage("/gallery")] } },
  }, async (P) => {
    const stopped = await filePage(P, { intent: "addon" }, "add a gallery page", "9".repeat(32));
    const running = deliver(P, jobMsg(P));
    await g.reached;
    assert.equal((await call(P, "DELETE", "/api/site/edit/" + stopped)).status, 200);
    g.open();
    await running;
    await pump(P);
    assert.equal((await call(P, "GET", "/api/site/edit/" + stopped)).body.outcome, "cancelled", "the stopped job's answer: " + JSON.stringify(P.answerOf(P.jobs.get(stopped))).slice(0, 200));
    const p = device(P);
    p.ctx.siteRequestsCheck(p.s);
    await pageSettle(p, () => !!(p.s.jobCards && p.s.jobCards[stopped] && p.s.jobCards[stopped].closed));
    assert.deepEqual([cardOf(p, stopped).label, cardOf(p, stopped).words], ["Stopped", said("notdone", "add a gallery page")]);
  });
  await withPlatform({
    slug: slugOf("oc4f"), replies: true, progress: true,
    // NO PAGE WRITER'S ANSWER: the add-on fails.
    answers: { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] } },
  }, async (P) => {
    const failed = await filePage(P, { intent: "addon" }, "add a gallery page", "8".repeat(32));
    await pump(P);
    assert.equal((await call(P, "GET", "/api/site/edit/" + failed)).body.outcome, "failed");
    const p = device(P);
    p.ctx.siteRequestsCheck(p.s);
    await pageSettle(p, () => !!(p.s.jobCards && p.s.jobCards[failed] && p.s.jobCards[failed].closed));
    assert.deepEqual([cardOf(p, failed).label, cardOf(p, failed).words], ["Not done", said("notdone", "add a gallery page")]);
  });
});

test("OUTCOME 5 — A REQUEST'S PART, BY ITS STATUS: one held for review shows the model's unconfirmed line, never its doing line; one that did only part of its work shows the partial line; one that asked a question shows the waiting line", async () => {
  // UNVERIFIED: the part's job running, then held for review.
  const g = gate();
  await withPlatform({
    slug: slugOf("oc5a"), replies: true, progress: true,
    answers: { route: [{ intent: "addon" }], [T.adds]: { kinds: ["page"] }, "add:page": async () => { g.reach(); await g.opened; return { page: [PAGE("/gallery", "Gallery")] }; }, [T.pages]: { pages: [writtenPage("/gallery")] } },
  }, async (P) => {
    const r = await sendMessage(P, { message: "add a gallery page" });
    const narration = P.queue.findIndex((m) => anyTask(m) && !P.jobs.has(m.body.id));
    await deliver(P, P.queue.splice(narration, 1)[0]);
    const running = deliver(P, jobMsg(P));
    await g.reached;
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    job.needs_review = true;
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.equal(view.body.request.parts[0].status, "unverified");
    const p = device(P);
    p.ctx.siteReqState("origin-1", r.key, view.body.request);
    const [part] = partsOf(p, r.key);
    assert.equal(part.label, "Checking it published");
    assert.equal(part.words, said("unconfirmed", "add a gallery page"), "an unverified part was named by its doing line");
    job.needs_review = false;
    g.open();
    await running;
  });
  // PARTIAL AND WAITING: request-flow's M4 (a set-aside link) and a step's question.
  await withPlatform({
    slug: slugOf("oc5b"), pages: NAV_PAGES, replies: true, progress: true,
    answers: { route: [{ intent: "addon" }], [T.adds]: { kinds: ["page", "frame"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } },
  }, async (P) => {
    const r = await sendMessage(P, { message: GALLERY_LINK });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "partial");
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    const p = device(P);
    p.ctx.siteReqState("origin-1", r.key, view.body.request);
    const [part] = partsOf(p, r.key);
    assert.equal(part.label, "Partly done");
    assert.equal(part.words, said("partial", GALLERY_LINK), "a partial part was named by its not-done line");
  });
  await withPlatform({
    slug: slugOf("oc5c"), replies: true, progress: true,
    answers: { route: [{ intent: "edit", layer: "look" }], [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": { question: QD } },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "waiting");
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    const p = device(P);
    p.ctx.siteReqState("origin-1", r.key, view.body.request);
    const [part] = partsOf(p, r.key);
    assert.equal(part.label, "Waiting for your answer");
    assert.equal(part.words, said("waiting", DESC), "a part waiting for its answer was named by its planned line");
  });
});

test("OUTCOME 6 — A JOB WHOSE RECORD CANNOT BE READ still gets its outcome, its kind read off its own row", async () => {
  await withPlatform({
    slug: slugOf("oc6"), pages: NAV_PAGES, replies: true, progress: true,
    answers: { [T.adds]: { kinds: ["page", "frame"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } },
  }, async (P) => {
    const id = await filePage(P, { intent: "addon" }, GALLERY_LINK, "c".repeat(31) + "1");
    await pump(P);
    P.objects.delete(progressKey(id));
    const poll = await call(P, "GET", "/api/site/edit/" + id);
    assert.equal(poll.body.outcome, "partial", "an addition's outcome was read without its kind, or not at all");
  });
});

test("OUTCOME 7 — THE READS ASK FOR WHAT THE OUTCOME IS READ FROM: the list's read of the job table names the stored answer, its billing and its review, and the row read names the job's kind. Read from the source, landmark to landmark: the test platform answers every column whatever is asked", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const between = (from, to) => { const a = src.indexOf(from); assert.ok(a > 0, from + " is gone"); const b = src.indexOf(to, a); assert.ok(b > a, to + " is gone"); return src.slice(a, b); };
  const list = between("async function standaloneJobsFor(env, uid, slug) {", "if (!Array.isArray(rows)) return [];");
  const sel = (/select=([a-z_,]+)&/.exec(list) || [])[1] || "";
  for (const col of ["needs_review", "billing", "result", "op", "state"]) assert.ok(sel.split(",").includes(col), "the list's read does not ask for " + col + ": " + sel);
  const row = between("async function jobRowForProgress(env, job) {", "if (!r.ok) return undefined;");
  const rsel = (/select=([a-z_,]+)&/.exec(row) || [])[1] || "";
  for (const col of ["op", "state", "needs_review", "lease_owner"]) assert.ok(rsel.split(",").includes(col), "the row read does not ask for " + col + ": " + rsel);
});

// ─────────────────────────────────────────────────────────────────────────────
// RACE — NO LINE AFTER THE FINAL REPLY, EVEN WHEN THE JOB'S CLOSE FAILS
// ─────────────────────────────────────────────────────────────────────────────

/** An add-on whose page designer waits on `g`: the job holds there, its first milestone recorded. */
const heldAddon = (g) => ({
  route: [{ intent: "addon" }], [T.adds]: { kinds: ["page"] },
  "add:page": async () => { g.reach(); await g.opened; return { page: [PAGE("/gallery", "Gallery")] }; },
  [T.pages]: { pages: [writtenPage("/gallery")] },
});
const isClose = (job) => (k, body) => k === progressKey(job) && (() => { try { return JSON.parse(String(body)).closed !== null; } catch { return false; } })();

test("RACE 1 — AT THE BOUNDARY: the writer passes its last row check; the job's own close then fails (the store refuses every try) and the job finalizes; only then does the writer's commit land. The line is on the record and served nowhere — not the poll, the request's view, the list, a reload or another device — and the cron never confirms it", async () => {
  const g = gate();
  const w = gate();
  await withPlatform({ slug: slugOf("race1"), replies: true, progress: true, answers: heldAddon(g), progressWith: async () => { w.reach(); await w.opened; } }, async (P) => {
    const r = await sendMessage(P, { message: "add a gallery page" });
    const running = deliver(P, jobMsg(P));
    await g.reached;
    for (let n = 0; n < 50 && !P.queue.some(isTask); n++) await settleMs(5);
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    const writer = deliver(P, takeTask(P));
    await w.reached;
    // THE NEXT WRITE TO THE RECORD IS THE WRITER'S COMMIT (its two row checks
    // are behind it): just before it lands, the job runs to its end with its
    // close refused by the store on every try.
    let atCommit = null;
    P.beforePut((k) => k === progressKey(job.id), async () => {
      for (let i = 0; i < 6; i++) P.failPut(isClose(job.id));
      g.open();
      await running;
      atCommit = { state: P.jobs.get(job.id).state, result: !!P.jobs.get(job.id).result, closed: P.progressOf(job.id).closed, lines: P.progressOf(job.id).lines.length };
    });
    w.open();
    await writer;
    assert.ok(atCommit, "the case never reached the writer's commit");
    assert.ok(["done", "failed"].includes(atCommit.state) && atCommit.result, "the job had not finalized before the commit: " + JSON.stringify(atCommit));
    assert.equal(atCommit.closed, null, "the job's close landed — the case did not fail it");
    const rec = P.progressOf(job.id);
    assert.equal(rec.lines.length, 1, "the case did not land the late commit (the race was not reached)");
    assert.notEqual(rec.lines[0].confirmed, true, "a line committed after the job's end was confirmed");
    await settle(P, r.key);
    // EVERY READER: the poll, the request's view, the list.
    const fin = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(fin.body.progress, undefined, "the finished job's answer carries the line committed after its end");
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.equal(view.body.request.parts[0].progress, undefined, "the request's view carries the line committed after the job's end");
    const list = await call(P, "GET", "/api/site/requests/" + P.slug);
    assert.equal(list.body.requests[0].parts[0].progress, undefined, "the list carries the line committed after the job's end");
    // THE CRON: the job has ended, so nothing confirms the line.
    await tick(P);
    assert.notEqual(P.progressOf(job.id).lines[0].confirmed, true, "the cron confirmed a line committed after the job's end");
    // ANOTHER DEVICE, OR A RELOAD: the request's card as the server lists it.
    const p = device(P);
    p.ctx.siteRequestsCheck(p.s);
    await pageSettle(p, () => !!(p.s.requests && p.s.requests[r.key]));
    assert.ok(p.s.requests && p.s.requests[r.key], "the other device did not find the request");
    assert.doesNotMatch(p.ctx.siteRequestHTML({ request: r.key }, p.s), /st-req-prog/, "another device drew the line committed after the job's end");
  });
});

test("RACE 2 — THE SAME BOUNDARY ON A PAGE-FILED JOB: the poll and the list a reload or another device reads never carry the late line", async () => {
  const g = gate();
  const w = gate();
  await withPlatform({ slug: slugOf("race2"), replies: true, progress: true, answers: heldAddon(g), progressWith: async () => { w.reach(); await w.opened; } }, async (P) => {
    const id = await filePage(P, { intent: "addon" }, "add a gallery page", "7".repeat(32));
    const running = deliver(P, jobMsg(P));
    await g.reached;
    for (let n = 0; n < 50 && !P.queue.some(isTask); n++) await settleMs(5);
    // ONE WRITER: the task's own lines first (they carry no state), then the
    // milestone's line, its call held — the next write to the record is its commit.
    const writer = deliver(P, takeTask(P));
    await w.reached;
    assert.ok(P.progressOf(id).tasks, "the task's lines were not written before the milestone's call");
    let atCommit = null;
    P.beforePut((k) => k === progressKey(id), async () => {
      for (let i = 0; i < 6; i++) P.failPut(isClose(id));
      g.open();
      await running;
      atCommit = { state: P.jobs.get(id).state, closed: P.progressOf(id).closed };
    });
    w.open();
    await writer;
    await pump(P);
    assert.ok(atCommit && atCommit.closed === null, "the case did not reach the late commit with the close failed: " + JSON.stringify(atCommit));
    assert.equal(P.progressOf(id).lines.length, 1, "the late commit did not land");
    const fin = await call(P, "GET", "/api/site/edit/" + id);
    assert.equal(fin.body.progress, undefined, "the poll carries the line committed after the job's end");
    const list = await call(P, "GET", "/api/site/requests/" + P.slug);
    assert.deepEqual(list.body.jobs[0].progress, [], "the list carries the line committed after the job's end");
    const p = device(P);
    p.ctx.siteRequestsCheck(p.s);
    await pageSettle(p, () => !!(p.s.jobCards && p.s.jobCards[id] && p.s.jobCards[id].closed));
    assert.deepEqual(cardOf(p, id).lines, [], "another device drew the line committed after the job's end");
  });
});

test("RACE 3 — THE ORDINARY LINE: committed while the job runs, it is confirmed at once and shown by the poll while the job still runs; one whose confirmation was lost (the row unreadable after the commit) stays unshown until the cron, finding the job still running, confirms it", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("race3"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const r = await sendMessage(P, { message: "add a gallery page" });
    const running = deliver(P, jobMsg(P));
    await g.reached;
    for (let n = 0; n < 50 && !P.queue.some(isTask); n++) await settleMs(5);
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    // THE WRITER'S THIRD READ OF THE ROW — the one after its commit — fails once.
    let reads = 0;
    P.failRead((url) => url.includes("select=id,uid,state,lease_owner") && ++reads === 3);
    await deliver(P, takeTask(P));
    assert.equal(reads, 3, "the writer did not read the row after its commit");
    const rec = P.progressOf(job.id);
    assert.equal(rec.lines.length, 1);
    assert.notEqual(rec.lines[0].confirmed, true, "the case did not lose the confirmation");
    assert.equal((await call(P, "GET", "/api/site/edit/" + job.id)).body.progress, undefined, "an unconfirmed line was served");
    await tick(P);
    assert.equal(P.progressOf(job.id).lines[0].confirmed, true, "the cron did not confirm the line of a job still running");
    const poll = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.deepEqual((poll.body.progress || []).map((l) => l.text), [rec.lines[0].text], "the confirmed line is not served");
    g.open();
    await running;
    await settle(P, r.key);
    const fin = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.deepEqual((fin.body.progress || []).map((l) => l.text), [rec.lines[0].text], "the finished answer lost the line confirmed while the job ran");
  });
});

test("RACE 4 — THE NEXT WRITER CONFIRMS: a line whose own confirmation was lost is confirmed by the next writer's first read of the row, with no cron — even when that writer's own call fails and it commits nothing; and a job whose lease ran out (its runner gone) never has such a line confirmed by the cron", async () => {
  const g = gate();
  // THE SECOND CALL FAILS: the next writer commits no line, so only its first read can confirm the first.
  await withPlatform({ slug: slugOf("race4"), replies: true, progress: true, answers: heldAddon(g), progressWith: async ({ n }) => (n >= 1 ? { status: 503 } : undefined) }, async (P) => {
    P.env.SITE_SECRETS_KEY = "platform-secret";
    const gk = await gatewayKey("platform-secret");
    await sendMessage(P, { message: "add a gallery page" });
    const running = deliver(P, jobMsg(P));
    await g.reached;
    for (let n = 0; n < 50 && !P.queue.some(isTask); n++) await settleMs(5);
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    let reads = 0;
    P.failRead((url) => url.includes("select=id,uid,state,lease_owner") && ++reads === 3);
    await deliver(P, takeTask(P));
    assert.notEqual(P.progressOf(job.id).lines[0].confirmed, true, "the case did not lose the confirmation");
    // THE JOB RECORDS ITS NEXT MILESTONE; ITS WRITER'S FIRST READ CONFIRMS THE LINE.
    const tok = await signJobToken({ id: job.id, slug: P.slug, uid: USER.id, exp: Math.floor(Date.now() / 1000) + 600 }, gk);
    const res = await call(P, "POST", "/api/job/" + job.id + "/progress", { op: "mark", run: P.progressOf(job.id).run, stage: "extra", facts: [{ state: "doing", text: "Designing the page now." }], seq: 50 }, "Bearer " + tok);
    assert.equal(res.status, 200);
    await deliver(P, takeTask(P));
    const rec = P.progressOf(job.id);
    assert.equal(rec.lines.length, 1, "the next writer committed a line though its call failed");
    assert.equal(rec.lines[0].confirmed, true, "the next writer's first read did not confirm the line whose confirmation was lost");
    assert.deepEqual((await call(P, "GET", "/api/site/edit/" + job.id)).body.progress.map((l) => l.n), [0]);
    g.open();
    await running;
  });
  const g2 = gate();
  await withPlatform({ slug: slugOf("race4b"), replies: true, progress: true, answers: heldAddon(g2) }, async (P) => {
    await sendMessage(P, { message: "add a gallery page" });
    const running = deliver(P, jobMsg(P));
    await g2.reached;
    for (let n = 0; n < 50 && !P.queue.some(isTask); n++) await settleMs(5);
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    let reads = 0;
    P.failRead((url) => url.includes("select=id,uid,state,lease_owner") && ++reads === 3);
    await deliver(P, takeTask(P));
    assert.notEqual(P.progressOf(job.id).lines[0].confirmed, true);
    const live = P.jobs.get(job.id).lease_expires_at;
    P.jobs.get(job.id).lease_expires_at = P.now() - 1;
    await tick(P);
    assert.notEqual(P.progressOf(job.id).lines[0].confirmed, true, "the cron confirmed a line of a job whose runner is gone");
    assert.equal((await call(P, "GET", "/api/site/edit/" + job.id)).body.progress, undefined);
    P.jobs.get(job.id).lease_expires_at = live + 90000;
    g2.open();
    await running;
  });
});

test("NAMES 9 — A LONG REQUEST'S LINES ARE WRITTEN A FEW TASKS AT A TIME: with every task written in seven states, each call writes at most TASK_BATCH of them, and the rest are written by the next call at once — none waits for the cron", async () => {
  const MORE = Array.from({ length: TASK_BATCH + 1 }, (_, i) => "add a line about loaf " + (i + 1) + " to the menu page");
  await withPlatform({ slug: slugOf("names9"), replies: true, progress: true, answers: { route: [{ intent: "addon", alsoAsked: MORE }] } }, async (P) => {
    const r = await sendMessage(P, { message: "add a gallery page, and " + MORE.join(", and ") });
    assert.ok(P.record(r.key), "the request was not taken on: " + JSON.stringify(r.body).slice(0, 200));
    const parts = P.record(r.key).parts.length;
    assert.ok(parts > TASK_BATCH, "the case needs more parts than one call writes: " + parts);
    for (let i = 0; i < 6 && P.queue.some((m) => anyTask(m) && !P.jobs.has(m.body.id)); i++) {
      const at = P.queue.findIndex((m) => anyTask(m) && !P.jobs.has(m.body.id));
      await deliver(P, P.queue.splice(at, 1)[0]);
    }
    const sizes = P.tasksLog.map((t) => t.length);
    assert.ok(sizes.every((n) => n <= TASK_BATCH), "a call wrote more than TASK_BATCH tasks: " + sizes.join(","));
    assert.equal(sizes.reduce((a, b) => a + b, 0), parts, "not every part got its lines: " + sizes.join(","));
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.ok(view.body.request.parts.every((p) => p.said && typeof p.said.planned === "string"), "a part was left without its lines");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RECORDER — A MILESTONE WHOSE DELIVERY FAILS IS KEPT AND SENT AGAIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE JOB RUN AS THE CONTAINER RUNS IT: its recorder writes through the
 * gateway's /progress under the job's own token (`makeContainerEnv`), and
 * `fault(body, n)` decides what the network does with each call — `throw`
 * before it reaches the Worker, `lose` its answer after the Worker took it,
 * or answer with a status of its own.
 */
async function viaContainer(P, job, fault) {
  P.env.SITE_SECRETS_KEY = "platform-secret";
  const gk = await gatewayKey("platform-secret");
  const tok = await signJobToken({ id: job, slug: P.slug, uid: USER.id, exp: Math.floor(Date.now() / 1000) + 600 }, gk);
  const sent = [];
  const env = makeContainerEnv({
    gateway: { url: "https://gofarther.dev/api/job/" + job, token: tok },
    fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      const n = sent.filter((b) => b.op === body.op && b.seq === body.seq).length;
      sent.push(body);
      const how = fault(body, n);
      if (how === "throw") throw new TypeError("fetch failed");
      if (Number.isInteger(how)) return new Response(JSON.stringify({ error: "x" }), { status: how });
      const res = await call(P, "POST", new URL(url).pathname, body, init.headers.authorization);
      if (how === "lose") throw new TypeError("network connection lost");
      return new Response(JSON.stringify(res.body || {}), { status: res.status });
    },
  });
  P.env.JOB_PROGRESS = env.JOB_PROGRESS;
  return sent;
}
const until = async (cond, ms = 6000) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await settleMs(10); return cond(); };

test("RECORDER 1 — FROM THE CONTAINER, THE NETWORK DOWN: the first milestone's call fails before it reaches the Worker, twice; the recorder keeps it, with its number, and sends it again on its own — with no other milestone and no page — and it is recorded once and gets its line", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("rec1"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const id = await filePage(P, { intent: "addon" }, "add a gallery page", "6".repeat(32));
    const sent = await viaContainer(P, id, (b, n) => (b.op === "mark" && n < 2 ? "throw" : null));
    const running = deliver(P, jobMsg(P));
    await g.reached;
    // NOTHING ELSE HAPPENS: the job holds at its designer; no page polls.
    assert.ok(await until(() => (P.progressOf(id) || { marks: [] }).marks.length > 0), "the milestone whose delivery failed was dropped: " + JSON.stringify(sent.map((b) => b.op)));
    const marks = sent.filter((b) => b.op === "mark");
    assert.equal(marks.length, 3, "the milestone was not sent again until it was answered");
    assert.ok(marks.every((b) => b.seq === marks[0].seq && JSON.stringify(b.facts) === JSON.stringify(marks[0].facts)), "a retry did not keep the milestone's identity");
    assert.deepEqual(P.progressOf(id).marks.map((m) => m.stage), ["picked"]);
    for (let n = 0; n < 50 && !P.queue.some(isTask); n++) await settleMs(5);
    while (P.queue.some(isTask)) await deliver(P, takeTask(P));
    assert.equal(P.progressOf(id).lines.length, 1, "the retried milestone got no line");
    delete P.env.JOB_PROGRESS;
    g.open();
    await running;
  });
});

test("RECORDER 2 — LANDED, ITS ANSWER LOST: the first milestone reaches the Worker and is recorded, but its answer never comes back; it is sent again under the same number and recorded once, not twice", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("rec2"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const id = await filePage(P, { intent: "addon" }, "add a gallery page", "5".repeat(32));
    const sent = await viaContainer(P, id, (b, n) => (b.op === "mark" && n === 0 ? "lose" : null));
    const running = deliver(P, jobMsg(P));
    await g.reached;
    assert.ok(await until(() => sent.filter((b) => b.op === "mark").length >= 2), "a milestone whose answer was lost was not sent again");
    await settleMs(50);
    const marks = sent.filter((b) => b.op === "mark");
    assert.equal(marks[1].seq, marks[0].seq, "the retry carried another number");
    assert.deepEqual(P.progressOf(id).marks.map((m) => m.stage), ["picked"], "a milestone that landed and was sent again was recorded twice");
    delete P.env.JOB_PROGRESS;
    g.open();
    await running;
  });
});

test("RECORDER 3 — THE WORKER'S STORE DOWN: the gateway answers that it could not record (503), and the milestone is sent again and recorded; a REFUSAL (409: a closed record, another run's) is never sent again", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("rec3"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const id = await filePage(P, { intent: "addon" }, "add a gallery page", "4".repeat(32));
    const sent = await viaContainer(P, id, () => null);
    // THE STORE'S READ FOR THE FIRST MILESTONE FAILS, ONCE: the Worker could not record it.
    let armed = false;
    P.failGet((k) => { if (!armed && k === progressKey(id) && sent.some((b) => b.op === "mark")) { armed = true; return true; } return false; });
    const running = deliver(P, jobMsg(P));
    await g.reached;
    assert.ok(await until(() => (P.progressOf(id) || { marks: [] }).marks.length > 0), "a milestone the store could not take was dropped");
    assert.ok(sent.filter((b) => b.op === "mark").length >= 2, "the milestone was not sent again");
    delete P.env.JOB_PROGRESS;
    g.open();
    await running;
  });
  const g2 = gate();
  await withPlatform({ slug: slugOf("rec3b"), replies: true, progress: true, answers: heldAddon(g2) }, async (P) => {
    const id = await filePage(P, { intent: "addon" }, "add a gallery page", "3".repeat(32));
    const sent = await viaContainer(P, id, (b) => (b.op === "mark" ? 409 : null));
    const running = deliver(P, jobMsg(P));
    await g2.reached;
    await settleMs(1200);
    assert.equal(sent.filter((b) => b.op === "mark").length, 1, "a refused milestone was sent again");
    delete P.env.JOB_PROGRESS;
    g2.open();
    await running;
  });
});

test("RECORDER 4 — ORDER IS KEPT, AND THE JOB'S END IS THE LAST TRY: a job that runs straight through records three more milestones while its first waits to be sent again; the first lands before them, on the last try the job's end allows, so the record's last milestone is still the newest. One whose every try fails up to the job's end is given up, and the rest keep their order", async () => {
  const run = async (failures) => {
    let out = null;
    await withPlatform({
      slug: slugOf("rec4"), replies: true, progress: true,
      answers: { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } },
    }, async (P) => {
      const id = await filePage(P, { intent: "addon" }, "add a gallery page", "2".repeat(32));
      const sent = await viaContainer(P, id, (b, n) => (b.op === "mark" && b.seq === 0 && n < failures ? "throw" : null));
      await deliver(P, jobMsg(P));
      out = { stages: P.progressOf(id).marks.map((m) => m.stage), sent: sent.map((b) => b.op + ":" + (b.seq ?? "")), closed: P.progressOf(id).closed };
      delete P.env.JOB_PROGRESS;
    });
    return out;
  };
  const once = await run(1);
  assert.deepEqual(once.stages, ["picked", "designed", "pages", "publish"], "the milestones are not recorded in their order: " + JSON.stringify(once));
  assert.deepEqual(once.sent, ["begin:", "mark:0", "mark:0", "mark:1", "mark:2", "mark:3", "close:"], "the first milestone was not sent again before the rest: " + JSON.stringify(once.sent));
  assert.ok(once.closed, "the job's end did not close its record");
  const always = await run(99);
  assert.deepEqual(always.stages, ["designed", "pages", "publish"], "a milestone undeliverable to the job's end was not given up, or the rest lost their order: " + JSON.stringify(always));
  assert.equal(always.sent.filter((x) => x === "mark:0").length, 2, "the job's end allowed other than one last try: " + JSON.stringify(always.sent));
  assert.ok(always.closed, "the job's end did not close its record");
});

test("RECORDER 7 — WHAT THE RECORDER PRINTS WHEN IT GIVES A DELIVERY UP IS WHAT THE USAGE STEP READS (2026-10-06, Codex's review: its reader expected one token where the recorder writes \"milestone 0\"): a milestone and an opening that never land, each read back by parseEvent from the recorder's own output, as console.log formats it, and kept by usageOf under the job's id", async () => {
  // THE RECORDER'S OWN OUTPUT: every console.log line it prints in the run,
  // formatted exactly as console.log formats its arguments.
  const printed = async (fault) => {
    const lines = [];
    const was = console.log;
    console.log = (...args) => { const t = util.format(...args); if (t.startsWith("progress:")) lines.push(t); else was(...args); };
    let id = "";
    try {
      await withPlatform({
        slug: slugOf("rec7"), replies: true, progress: true,
        answers: { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } },
      }, async (P) => {
        id = await filePage(P, { intent: "addon" }, "add a gallery page", "7".repeat(32));
        await viaContainer(P, id, fault);
        await deliver(P, jobMsg(P));
        delete P.env.JOB_PROGRESS;
      });
    } finally { console.log = was; }
    return { id, lines };
  };
  // A MILESTONE THAT NEVER LANDS: tried, then tried once more at the job's end.
  const mark = await printed((b) => (b.op === "mark" && b.seq === 0 ? "throw" : null));
  const undelivered = mark.lines.filter((l) => l.includes(" not delivered after "));
  assert.ok(undelivered.length >= 1, "the recorder printed no give-up line: " + JSON.stringify(mark.lines));
  assert.deepEqual(undelivered.map((l) => NU.parseEvent(l)), [{ what: "not delivered", id: mark.id, step: "milestone 0", tries: 2 }], "the usage step does not read the recorder's line: " + JSON.stringify(undelivered));
  assert.equal(undelivered[0], `progress: ${mark.id} milestone 0 not delivered after 2 tries`);
  // AN OPENING THAT NEVER LANDS: every milestone after it tries the opening again.
  const open = await printed((b) => (b.op === "begin" ? "throw" : null));
  const openings = open.lines.filter((l) => l.includes(" not delivered after "));
  assert.ok(openings.length >= 1, "the recorder printed no give-up line for its opening: " + JSON.stringify(open.lines));
  for (const l of openings) {
    const e = NU.parseEvent(l);
    assert.ok(e && e.what === "not delivered" && e.id === open.id && e.step === "opening" && Number.isInteger(e.tries) && e.tries >= 1, "the usage step does not read the recorder's line: " + l);
  }
  // EVERY "progress:" LINE THE RECORDER PRINTED IS READ, NONE DROPPED; and the
  // usage step keeps them under the job's id, with no call — so it measures
  // nothing, and says so (narration-usage's own case).
  for (const l of [...mark.lines, ...open.lines]) assert.ok(NU.parseEvent(l) || NU.parseCall(l), "a line the recorder printed is read by neither parser: " + l);
  const u = NU.usageOf(mark.lines.map((l, i) => ({ timestamp: i + 1, $metadata: { message: l } })), new Set([mark.id]));
  assert.deepEqual([u.calls.length, u.events.map((e) => e.step)], [0, ["milestone 0"]]);
});

test("RECORDER 6 — AN OPENING THAT DID NOT LAND IS MADE AGAIN BEFORE THE NEXT MILESTONE: the first opening refused outright, never resent on its own; the job's first milestone opens the record again, and is recorded", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("rec6"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const id = await filePage(P, { intent: "addon" }, "add a gallery page", "6".repeat(31) + "0");
    const sent = await viaContainer(P, id, (b, n) => (b.op === "begin" && n === 0 ? 409 : null));
    const running = deliver(P, jobMsg(P));
    await g.reached;
    assert.ok(await until(() => (P.progressOf(id) || { marks: [] }).marks.length > 0), "the job's first milestone did not open the record again: " + JSON.stringify(sent.map((b) => b.op)));
    assert.deepEqual(sent.map((b) => b.op).slice(0, 3), ["begin", "begin", "mark"], "the opening was not made again just before the milestone");
    assert.deepEqual(P.progressOf(id).marks.map((m) => m.stage), ["picked"]);
    delete P.env.JOB_PROGRESS;
    g.open();
    await running;
  });
});

test("RECORDER 5 — IN THE WORKER, THE STORE DOWN FOR ONE READ: the milestone the store could not take is sent again and recorded, where it used to be dropped", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("rec5"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const id = await filePage(P, { intent: "addon" }, "add a gallery page", "1".repeat(32));
    // THE OPENING LANDS AND ASKS FOR ITS WRITER (`asked`); THE NEXT READ OF
    // THE RECORD — THE FIRST MILESTONE'S — FAILS, ONCE.
    let fired = false;
    P.failGet((k) => { if (fired || k !== progressKey(id) || !((P.progressOf(id) || {}).asked > 0)) return false; fired = true; return true; });
    const running = deliver(P, jobMsg(P));
    await g.reached;
    assert.ok(await until(() => (P.progressOf(id) || { marks: [] }).marks.length > 0), "the milestone the store could not take was dropped");
    assert.ok(fired, "the case's fault never fired");
    assert.deepEqual(P.progressOf(id).marks.map((m) => m.stage), ["picked"]);
    g.open();
    await running;
  });
  // AND THE STORE'S WRITES REFUSED, ALL SIX OF ONE DELIVERY'S: the milestone is sent again and recorded.
  const g2 = gate();
  await withPlatform({ slug: slugOf("rec5b"), replies: true, progress: true, answers: heldAddon(g2) }, async (P) => {
    const id = await filePage(P, { intent: "addon" }, "add a gallery page", "0".repeat(31) + "1");
    const picked = (k, body) => k === progressKey(id) && String(body).includes('"stage":"picked"');
    for (let i = 0; i < 6; i++) P.failPut(picked);
    const running = deliver(P, jobMsg(P));
    await g2.reached;
    assert.ok(await until(() => (P.progressOf(id) || { marks: [] }).marks.length > 0), "a milestone whose six writes the store refused was dropped");
    assert.deepEqual(P.progressOf(id).marks.map((m) => m.stage), ["picked"]);
    g2.open();
    await running;
  });
});
