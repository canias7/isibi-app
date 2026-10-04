// ONE MESSAGE, SEVERAL PARTS, FINISHED ON THE SERVER — THE GROUPED FREE TESTS
// (2026-10-03, the owner's order: *"Verify the actual flow with grouped free
// tests covering both route orders, multiple operations, prerequisites
// mentioned later, clarification and resume, attachments, closed-tab
// continuation, existing handoffs, partial failure, cancellation, duplicate
// delivery and crashes around publication and charging; check final site
// changes, stored statuses, customer-visible facts and ledger outcomes."*)
//
// EVERY CASE RUNS THE REAL WORKER: the routing route that accepts the message,
// the queue consumer that runs each part's job, the edit and add-on routes the
// job replays, the request's driver, the two-minute sweep, and the owner
// routes the page reads — against `test/fixtures/request-flow.mjs`, whose
// `edit_jobs`, ledger, bucket and queue keep state the way the real ones do.
// What each case checks is what happened: the site's stored pages and look,
// the request record and each job row, what the reply writer was told (the
// customer-visible facts), and every ledger row.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. Every model answer — the router's, the
// picker's, each lane's, the add-on's, the page writer's and the reply
// writer's — is supplied by the case. Nothing here is evidence of what a real
// model answers for these messages; the real-model batch is separate and not
// run (it would be paid).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { platform, sendMessage, pump, tick, call, settle, readWritten, browserBody, T, USER, newKey } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { PAGES, HOME, VISIT, VISIT_MOVED, OLD_DESC, page as pageSrc } from "./fixtures/live-ask.mjs";
import { PART_HEADING } from "../builder/site-ask.mjs";
import { jobBody, handOff, HOPS_MAX } from "../builder/request.mjs";
import { gatewayHandler, gatewayKey, signJobToken, verifyJobToken, preScopeSlug } from "../builder/job-gateway.mjs";
import { makeContainerEnv } from "../builder/container-env.mjs";
import { navSlots } from "../builder/site-nav.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";

const DESC = "Change the site description to say we bake overnight sourdough";
const NEW_DESC = "Overnight sourdough from a Bristol side street.";
const ADD = "add a gallery page";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const GALLERY = { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } };
const DESCRIBE = { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": NEW_DESC };
const slugOf = (k) => "rq-" + k + "-" + Math.random().toString(16).slice(2, 8);

/** One case: a platform and the compiler, closed whatever happens. */
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}
const statuses = (rec) => rec.parts.map((p) => p.status);
const jobLine = (P, key) => P.jobsOf(key).map((j) => j.op + ":" + j.state);
/** The ledger rows of one kind, as numbers. */
const rows = (P, reason) => P.ledger.filter((e) => e.reason === reason).map((e) => e.delta);
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);
/**
 * WHAT A READ'S REPLY TOLD THE CUSTOMER, before the wording: the facts behind
 * the reply it handed back (replies are written in the background, 2026-10-04,
 * so the writer's last call need not be this one), joined. No reply is a failure.
 */
const toldIn = (P, v) => {
  const f = P.factsOf(v && v.body && v.body.reply);
  assert.ok(f, "no reply was handed back: " + JSON.stringify(v && v.body && { replyState: v.body.replyState, reply: v.body.reply }));
  return f.map((x) => x.text).join(" | ");
};
const REQ = (P, key) => "/api/site/request/" + P.slug + "/" + key;

// ─────────────────────────────────────────────────────────────────────────────
// A. BOTH ROUTE ORDERS, AND SEVERAL OPERATIONS IN ONE MESSAGE
// ─────────────────────────────────────────────────────────────────────────────

test("A1 — an edit then an addition: both land, in order, each through its own route, each part charged once, the routing call once", async () => {
  await withPlatform({ slug: slugOf("a1"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    assert.equal(r.status, 200);
    // ACCEPTED: the page is handed the request, and is not told to run anything itself.
    assert.equal(r.body.request.key, r.key);
    assert.deepEqual(r.body.request.parts.map((p) => p.status), ["queued", "ready"]);
    const { rec } = await settle(P, r.key);
    assert.equal(rec.state, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(statuses(rec), ["done", "done"]);
    // THE SITE: the description changed and the gallery page added; nothing else moved.
    assert.equal(P.look().description, NEW_DESC);
    assert.deepEqual(P.pages(), ["index.tsx", "visit.tsx", "gallery.tsx"]);
    assert.equal(P.page("index.tsx"), HOME);
    assert.equal(P.page("visit.tsx"), VISIT);
    // THE JOBS, in order: part 0's edit, part 1's routing, part 1's addition.
    assert.deepEqual(jobLine(P, r.key), ["edit:done", "route:done", "addon:done"]);
    // THE MONEY: the routing call once under the message's key, and one reserve per job.
    assert.deepEqual(rows(P, "route"), [-1]);
    assert.equal(P.ledger.find((e) => e.reason === "route").ref, "route:" + P.slug + ":" + r.key);
    for (const j of P.jobsOf(r.key)) assert.deepEqual(reserveOf(P, j.id), [1], j.op + " was not charged once");
    assert.deepEqual(rows(P, "refund"), []);
    assert.equal(P.spent(), 4);
  });
});

test("A2 — an addition then an edit (the other order): the addition runs as the answered part, the edit is routed after it", async () => {
  await withPlatform({ slug: slugOf("a2"), answers: { route: [{ intent: "addon", alsoAsked: [DESC] }, { intent: "edit", layer: "look" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ADD + ", and " + DESC.charAt(0).toLowerCase() + DESC.slice(1) + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(jobLine(P, r.key), ["addon:done", "route:done", "edit:done"]);
    assert.equal(P.look().description, NEW_DESC);
    assert.ok(P.pages().includes("gallery.tsx"));
    assert.equal(P.spent(), 4);
  });
});

test("A3 — three operations in one message, two edits and an addition: each part is its own job, run one at a time against the site as it then is", async () => {
  const MOVE = "on the Visit page put the band above the heading";
  const MOVED = VISIT_MOVED;
  await withPlatform({
    slug: slugOf("a3"),
    answers: {
      route: [{ intent: "edit", layer: "look", alsoAsked: [MOVE, ADD] }, { intent: "edit", layer: "look", page: "/visit" }, { intent: "addon" }],
      [T.pick]: [{ fields: ["description"], scopes: [{ part: "description", words: DESC }] }, { fields: ["shape"], scopes: [{ part: "shape", page: "/visit", words: MOVE }] }],
      "lane:description": NEW_DESC,
      [T.tweak]: { source: MOVED },
      ...{ [T.adds]: GALLERY[T.adds], "add:page": GALLERY["add:page"], [T.pages]: GALLERY[T.pages] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", " + MOVE + ", and " + ADD + "." });
    assert.deepEqual(r.body.request.parts.map((p) => p.words), [DESC + ", , and .", MOVE, ADD].map((w, i) => (i === 0 ? r.body.request.parts[0].words : w)));
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(jobLine(P, r.key), ["edit:done", "route:done", "edit:done", "route:done", "addon:done"]);
    assert.equal(P.look().description, NEW_DESC);
    assert.equal(P.page("visit.tsx"), MOVED);
    assert.ok(P.pages().includes("gallery.tsx"));
    // ONE JOB AT A TIME: no job of the request was filed while another was live.
    const js = P.jobsOf(r.key);
    for (let i = 1; i < js.length; i++) assert.ok(js[i].created_at >= js[i - 1].updated_at - 1, "a job was filed while the one before it was still running");
    // EACH LATER PART WAS SHOWN THE WHOLE REQUEST AND WHAT THE PARTS BEFORE IT DID.
    const routed = P.modelLog.filter((m) => m.tool === T.route);
    assert.equal(routed.length, 3);
    assert.ok(routed[1].text.includes(PART_HEADING) && routed[1].text.includes(DESC), "the second part's routing was not shown the whole request");
    assert.ok(routed[2].text.includes(PART_HEADING) && routed[2].text.includes(MOVE), "the third part's routing was not shown the parts before it");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. A PREREQUISITE MENTIONED LATER, AND ONE THAT FAILS
// ─────────────────────────────────────────────────────────────────────────────

test("B1 — a change that needs something the message asks for later waits for it: the later part runs first, and the earlier one is routed again against the site it made", async () => {
  const NEEDS = "Change the site description to mention our gallery page";
  await withPlatform({
    slug: slugOf("b1"),
    answers: {
      route: [
        { intent: "edit", layer: "look", alsoAsked: [ADD], dependsOn: [{ change: 0, after: [1] }] },
        { intent: "addon" },
        { intent: "edit", layer: "look" },
      ],
      [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: NEEDS }] }, "lane:description": "Sourdough, and a gallery of our loaves.",
      ...GALLERY,
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: NEEDS + ", and " + ADD + "." });
    // THE ANSWERED PART WAITS: it needs part 1, which nothing has made yet.
    assert.deepEqual(r.body.request.parts.map((p) => p.status), ["blocked", "queued"]);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    // THE ORDER THE MODEL GAVE, NOT THE ORDER OF THE WORDS.
    assert.deepEqual(jobLine(P, r.key), ["route:done", "addon:done", "route:done", "edit:done"]);
    // AND PART 0 WAS ROUTED AGAIN AFTER THE GALLERY EXISTED: its routing call saw /gallery.
    const third = P.modelLog.filter((m) => m.tool === T.route)[2];
    assert.ok(third.text.includes("/gallery"), "the re-routed part was not shown the page the earlier part made");
    assert.equal(P.look().description, "Sourdough, and a gallery of our loaves.");
  });
});

test("B2 — a prerequisite that fails: the part that needed it is not run and says which, an independent part still goes ahead, and nothing is charged for the part not run", async () => {
  const LINK = "put a link to the new gallery on the Visit page";
  await withPlatform({
    slug: slugOf("b2"), replies: true,
    answers: {
      route: [{ intent: "edit", layer: "look", alsoAsked: [LINK, ADD], dependsOn: [{ change: 1, after: [2] }] }, { intent: "addon" }],
      ...DESCRIBE,
      // THE ADDITION FAILS: the add-on step finds nothing it can add.
      [T.adds]: { kinds: [] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", " + LINK + ", and " + ADD + "." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "done", "the independent part did not go ahead");
    assert.equal(rec.parts[2].status, "failed", JSON.stringify(rec.parts[2]));
    assert.equal(rec.parts[1].status, "not-run");
    assert.equal(rec.parts[1].why, "needs:2");
    assert.equal(rec.state, "partial");
    // PART 1 NEVER RAN: no job of its own, nothing charged for it.
    assert.equal(rec.parts[1].jobs.length, 0);
    assert.equal(P.look().description, NEW_DESC);
    assert.ok(!P.pages().includes("gallery.tsx"));
    // WHAT THE CUSTOMER IS TOLD, from the request's own facts (the reply writer's input).
    const v = await readWritten(P, REQ(P, r.key));
    assert.equal(v.status, 200);
    const facts = toldIn(P, v);
    assert.match(facts, /Not started: “put a link to the new gallery on the Visit page”, because it needed “add a gallery page” done first/);
    assert.ok(typeof v.body.reply === "string" && v.body.replySource === "model", "the request's reply was not handed back");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. A PART ASKS, IS ANSWERED, AND RESUMES — WHILE THE REST GOES ON
// ─────────────────────────────────────────────────────────────────────────────

const Q = { text: "Which photos should the gallery show?", options: ["Loaves", "The bakery"] };

test("C1 — a part's routing asks: the part waits on the site's question, the answer resumes it on the server, and the same answer sent again is handed back without a second routing call", async () => {
  await withPlatform({
    slug: slugOf("c1"),
    answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "clarify", question: Q }, { intent: "addon", answered: true }], ...DESCRIBE, ...GALLERY },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + " for it." });
    const s1 = await settle(P, r.key);
    assert.deepEqual(statuses(s1.rec), ["done", "waiting"]);
    assert.equal(s1.rec.state, "waiting");
    // THE QUESTION IS THE SITE'S LIVE ONE, AND NAMES ITS PART.
    const q = P.question();
    assert.equal(q.status, "pending");
    assert.equal(q.requestKey, r.key);
    assert.equal(q.part, 1);
    assert.equal(s1.rec.parts[1].question.id, q.id);
    // "IT" STILL MEANS WHAT IT MEANT: the part's routing was shown the whole message.
    assert.ok(P.modelLog.filter((m) => m.tool === T.route)[1].text.includes(DESC + ", and " + ADD + " for it."));
    // THE ANSWER, AS THE PAGE SENDS IT.
    const before = P.spent();
    const a = await sendMessage(P, { message: "Loaves", ask: { id: q.id, chosen: true } });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.deepEqual(a.body.resumed, { key: r.key, part: 1 });
    assert.equal(a.body.request.key, r.key);
    assert.equal(P.question().status, "answered");
    const s2 = await settle(P, r.key);
    assert.deepEqual(statuses(s2.rec), ["done", "done"]);
    assert.ok(P.pages().includes("gallery.tsx"));
    assert.deepEqual(s2.rec.context, [{ q: Q.text, a: "Loaves" }]);
    // THE ANSWER'S ROUTING WAS CHARGED ONCE, UNDER ITS OWN KEY.
    assert.deepEqual(P.ledger.filter((e) => e.ref === "route:" + P.slug + ":" + a.key).map((e) => e.delta), [-1]);
    // THE SAME ANSWER AGAIN (a lost response): no model asked, nothing charged.
    const calls = P.modelLog.length;
    const spent = P.spent();
    const again = await sendMessage(P, { message: "Loaves", ask: { id: q.id, chosen: true }, key: a.key });
    assert.equal(again.body.duplicate, true);
    assert.deepEqual(again.body.resumed, { key: r.key, part: 1 });
    assert.equal(P.modelLog.length, calls, "a second routing call was made for the same answer");
    assert.equal(P.spent(), spent);
    assert.ok(spent > before);
  });
});

test("C2 — a step asks while an independent part continues; a part that needs the asking one waits, and runs once the answer has resumed it", async () => {
  const LINE = "add a line about the new wording to the Visit page";
  const QD = { text: "Which word should lead — overnight or slow?", options: ["Overnight", "Slow"] };
  await withPlatform({
    slug: slugOf("c2"),
    answers: {
      route: [{ intent: "edit", layer: "look", alsoAsked: [ADD, LINE], dependsOn: [{ change: 2, after: [0] }] }, { intent: "addon" }, { intent: "edit", layer: "look", answered: true }, { intent: "edit", layer: "look", page: "/visit" }],
      [T.pick]: [
        { fields: ["description"], scopes: [{ part: "description", words: DESC }] },
        { fields: ["description"], scopes: [{ part: "description", words: DESC }] },
        { fields: ["shape"], scopes: [{ part: "shape", page: "/visit", words: LINE }] },
      ],
      "lane:description": (args, n) => (n === 0 ? { question: QD } : NEW_DESC),
      [T.tweak]: { source: VISIT_MOVED },
      ...{ [T.adds]: GALLERY[T.adds], "add:page": GALLERY["add:page"], [T.pages]: GALLERY[T.pages] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", " + ADD + ", and " + LINE + "." });
    const s1 = await settle(P, r.key);
    // PART 0 ASKED; PART 1 IS INDEPENDENT AND WENT AHEAD; PART 2 NEEDS PART 0 AND WAITS.
    assert.deepEqual(statuses(s1.rec), ["waiting", "done", "blocked"], JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.pages().includes("gallery.tsx"));
    assert.equal(P.look().description, OLD_DESC, "the asking part changed something before its answer");
    const q = P.question();
    assert.equal(q.part, 0);
    assert.equal(q.stage, "look");
    // THE ANSWER RESUMES PART 0, AND PART 2 FOLLOWS.
    await sendMessage(P, { message: "Overnight", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.deepEqual(statuses(s2.rec), ["done", "done", "done"], JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why])));
    assert.equal(P.look().description, NEW_DESC);
    assert.equal(P.page("visit.tsx"), VISIT_MOVED);
  });
});

test("C3 — a part's question never replaces one the customer is answering: it waits its turn on the part, and is put in the slot once that one is settled", async () => {
  await withPlatform({
    slug: slugOf("c3"),
    answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "clarify", question: Q }], ...DESCRIBE, ...GALLERY },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    // ANOTHER QUESTION GOES LIVE ON THE SITE MEANWHILE (another tab's message).
    const other = { v: 2, id: "f".repeat(32), uid: USER.id, slug: P.slug, stage: "route", round: 1, question: { text: "Something else?", options: [] }, request: "Something else", held: [], at: P.now(), status: "pending", attached: false, context: [] };
    await P.bucket.put("source/" + P.slug + "/question.json", JSON.stringify(other));
    const s1 = await settle(P, r.key);
    assert.deepEqual(statuses(s1.rec), ["done", "waiting"]);
    assert.equal(s1.rec.parts[1].question.queued, true, "the part's question did not wait its turn");
    assert.equal(P.question().id, other.id, "the part's question replaced the one waiting on the customer");
    // THE OTHER IS CANCELLED: the part's question is offered on the next look.
    const c = await call(P, "POST", "/api/site/" + P.slug + "/question", { id: other.id, cancel: true });
    assert.equal(c.body.cancelled, true);
    await tick(P);
    const live = P.question();
    assert.equal(live.requestKey, r.key);
    assert.equal(live.status, "pending");
    assert.equal(P.record(r.key).parts[1].question.queued, false);
  });
});

test("C4 — cancelling a part's question ends that part: what needed it is not run, the rest goes ahead, and the acknowledgement says only that part is cancelled", async () => {
  const LINE = "add a line about the new wording to the Visit page";
  const QD = { text: "Which word should lead — overnight or slow?", options: ["Overnight", "Slow"] };
  await withPlatform({
    slug: slugOf("c4"), replies: true,
    answers: {
      route: [{ intent: "edit", layer: "look", alsoAsked: [ADD, LINE], dependsOn: [{ change: 2, after: [0] }] }, { intent: "addon" }],
      ...DESCRIBE, "lane:description": { question: QD }, ...GALLERY,
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", " + ADD + ", and " + LINE + "." });
    await settle(P, r.key);
    const q = P.question();
    // AS THE PAGE SENDS IT, with the picked model the acknowledgement is written by.
    const c = await call(P, "POST", "/api/site/" + P.slug + "/question", { id: q.id, cancel: true, picker: "sonnet" });
    assert.equal(c.body.cancelled, true);
    const rec = P.record(r.key);
    assert.deepEqual(statuses(rec), ["cancelled", "done", "not-run"]);
    assert.equal(rec.parts[0].why, "question-cancelled");
    assert.equal(rec.parts[2].why, "needs:0");
    assert.equal(rec.state, "partial");
    assert.equal(P.look().description, OLD_DESC);
    // THE ACKNOWLEDGEMENT'S FACTS: only that part, the rest as it stands.
    const facts = toldIn(P, c);
    assert.match(facts, /The part of their request that asked this question is cancelled/);
    assert.match(facts, /Not started, because it needed the cancelled part: “add a line about the new wording to the Visit page”/);
    assert.match(facts, /Already done before this, and unchanged by it: “add a gallery page”/);
  });
});

test("C5 — a part's question nobody answers for a day expires, as the question does, and what needed it is not run", async () => {
  await withPlatform({
    slug: slugOf("c5"),
    answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "clarify", question: Q }], ...DESCRIBE, ...GALLERY },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    await settle(P, r.key);
    P.advance(24 * 60 * 60 * 1000 + 1000);
    await tick(P);
    const rec = P.record(r.key);
    assert.deepEqual(statuses(rec), ["done", "expired"]);
    assert.equal(rec.state, "partial");
    assert.equal(rec.ended, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D. ATTACHMENTS KEPT ON THE SERVER FOR THE PART THAT READS THEM
// ─────────────────────────────────────────────────────────────────────────────

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const LOGO = "Use the attached picture as the logo";

test("D1 — a message's file is kept on the server under its request, reaches the step that reads it whenever that step runs, and is let go when the request ends", async () => {
  await withPlatform({ slug: slugOf("d1"), answers: { route: [{ intent: "edit", layer: "logo", alsoAsked: [ADD] }, { intent: "addon" }], ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: LOGO + ", and " + ADD + ".", images: [{ name: "logo.png", data: PNG }] });
    // KEPT BEFORE ANYTHING RAN: one durable copy, by content, under the
    // acceptance that wrote it (2026-10-03: `<when>-<tail>/`).
    const rec0 = P.record(r.key);
    assert.equal(rec0.files.length, 1);
    assert.match(rec0.files[0].key, new RegExp("^requests/" + P.slug + "/" + r.key + "/files/" + rec0.attempt + "/[0-9a-f]{64}\\.png$"));
    assert.match(rec0.attempt, /^[0-9a-z]+-[0-9a-f]{12}$/);
    assert.ok(P.objects.has(rec0.files[0].key));
    assert.equal(rec0.attached, true);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    // THE LOGO STEP WAS SENT THE FILE, AS THE PAGE SENDS IT; THE ADDITION WAS NOT.
    const [logoJob, , addJob] = P.jobsOf(r.key);
    const lb = P.bodyOf(logoJob.id).body;
    assert.deepEqual(lb.images, [{ data: PNG, name: "logo.png" }]);
    assert.equal(lb.attached, true);
    assert.equal(P.bodyOf(addJob.id).body.images, undefined);
    assert.notEqual((P.look().wordmark || {}).form, "text", "the logo did not reach the site");
    // THE LOGO STEP IS FREE, as it always was: no reserve for it.
    assert.deepEqual(reserveOf(P, logoJob.id), []);
    // AND THE COPY GOES WHEN THE REQUEST HAS ENDED.
    assert.ok(!P.objects.has(rec0.files[0].key), "the request's file outlived it");
  });
});

test("D2 — an answer to a part's question may bring a file: it joins the request's; past one request's files nothing is sent, the question stays and nothing is charged", async () => {
  await withPlatform({
    slug: slugOf("d2"),
    answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "clarify", question: Q }, { intent: "addon", answered: true }], ...DESCRIBE, ...GALLERY },
  }, async (P) => {
    const three = [1, 2, 3].map((n) => ({ name: "p" + n + ".png", data: PNG }));
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + ".", images: three });
    await settle(P, r.key);
    const q = P.question();
    assert.equal(q.part, 1);
    const spent = P.spent();
    const calls = P.modelLog.length;
    // A FOURTH FILE WITH THE ANSWER: refused before any model is asked.
    const over = await sendMessage(P, { message: "Use this one too", ask: { id: q.id, chosen: false }, images: [{ name: "p4.png", data: PNG }] });
    assert.equal(over.status, 422);
    assert.equal(over.body.error, "answer-files-full");
    assert.equal(P.question().status, "pending", "the question did not stay open");
    assert.equal(P.spent(), spent);
    assert.equal(P.modelLog.length, calls);
    // WITHOUT IT, THE ANSWER GOES THROUGH.
    await sendMessage(P, { message: "Loaves", ask: { id: q.id, chosen: true } });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E. NO PAGE NEEDED: CLOSED TABS, AND A PAGE OPENED LATER ON ANOTHER DEVICE
// ─────────────────────────────────────────────────────────────────────────────

test("E1 — after the routing call nothing from the page is needed: a job's end that is lost is picked up by the two-minute sweep, and every part finishes", async () => {
  await withPlatform({ slug: slugOf("e1"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    // THE TAB CLOSES HERE. Part 0's job runs, and the step after it is lost:
    // the invocation dies writing the request's next step.
    let n = 0;
    P.hangPut((k) => k === "requests/" + P.slug + "/" + r.key + ".json" && ++n === 1);
    const first = await pump(P);
    assert.match(String(first.hung), /^put:requests\//);
    P.recover();
    assert.equal(P.look().description, NEW_DESC, "part 0 did not land before the crash");
    // ONLY THE CRON FROM HERE ON.
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.pages().includes("gallery.tsx"));
    // ONE ROUTING CALL FROM THE PAGE, AND NOTHING ELSE OF ITS.
    assert.deepEqual(rows(P, "route"), [-1]);
    assert.equal(P.spent(), 4);
  });
});

test("E2 — a page opened later, or on another device, finds the request, its parts and its question; an ended one stays listed for a day and is then let go", async () => {
  await withPlatform({
    slug: slugOf("e2"),
    answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "clarify", question: Q }, { intent: "addon", answered: true }], ...DESCRIBE, ...GALLERY },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    await settle(P, r.key);
    const list = await call(P, "GET", "/api/site/requests/" + P.slug);
    assert.equal(list.status, 200);
    assert.equal(list.body.requests.length, 1);
    const v = list.body.requests[0];
    assert.equal(v.key, r.key);
    assert.deepEqual(v.parts.map((p) => p.status), ["done", "waiting"]);
    assert.equal(v.parts[1].question.text, Q.text);
    // THE QUESTION ROUTE NAMES ITS PART, so the other device's card answers it there.
    const qd = await call(P, "GET", "/api/site/" + P.slug + "/question");
    assert.deepEqual(qd.body.question.request, { key: r.key, part: 1 });
    // NOTHING PRIVATE: no owner id, no file keys.
    assert.equal(JSON.stringify(list.body).includes(USER.id), false);
    // ANSWERED, ENDED, STILL LISTED; A DAY ON, LET GO.
    await sendMessage(P, { message: "Loaves", ask: { id: P.question().id, chosen: true } });
    await settle(P, r.key);
    assert.equal((await call(P, "GET", "/api/site/requests/" + P.slug)).body.requests[0].ended, true);
    P.advance(24 * 60 * 60 * 1000 + 5 * 60 * 1000);
    await tick(P);
    assert.deepEqual((await call(P, "GET", "/api/site/requests/" + P.slug)).body.requests, []);
    // ANOTHER OWNER'S LOOK IS REFUSED AS IF IT WERE NOT THERE.
    assert.equal((await call(P, "GET", "/api/site/request/" + P.slug + "/" + newKey())).status, 404);
  });
});

test("E3 — the sweep reaches every page of markers in turn: a request whose marker sorts past the first page is still moved on", async () => {
  await withPlatform({ slug: slugOf("e3"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    // PART 0 RUNS, AND THE STEP AFTER IT IS LOST, as in E1.
    let n = 0;
    P.hangPut((k) => k === "requests/" + P.slug + "/" + r.key + ".json" && ++n === 1);
    assert.match(String((await pump(P)).hung), /^put:requests\//);
    P.recover();
    // A HUNDRED MARKERS OF REQUESTS THAT ENDED TODAY SORT BEFORE THIS ONE'S:
    // a full first page with nothing to move on.
    for (let i = 0; i < 100; i++) {
      await P.bucket.put("requests-live/a0-ended/" + "k".repeat(14) + String(i).padStart(4, "0"), JSON.stringify({ at: P.now(), endedAt: P.now() }));
    }
    const stuck = JSON.stringify(P.record(r.key));
    await tick(P);
    assert.equal(JSON.stringify(P.record(r.key)), stuck, "the first page held only ended markers, and this request moved anyway");
    await tick(P);
    assert.notEqual(JSON.stringify(P.record(r.key)), stuck, "the sweep never got past the first page of markers");
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.pages().includes("gallery.tsx"));
    assert.deepEqual(rows(P, "route"), [-1]);
  });
});

test("E4 — deleting a site takes its requests with it: the markers first, so the sweep moves nothing on for a site that is gone, then the records and files, before the row a retry needs", () => {
  // THE SITE DELETE'S OWN SHAPE, as every by-slug cleanup there is guarded
  // (backups, config, versions): anchors proven first, then the order.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const del = w.indexOf("async function deleteSiteFor");
  assert.ok(del > 0, "deleteSiteFor moved — rescope this");
  const body = w.slice(del, w.indexOf("\n}", w.indexOf("domainsReleased", del)));
  const markers = body.indexOf("REQUEST_LIVE_ROOT + dslug + \"/\"");
  const records = body.indexOf("REQUEST_ROOT + dslug + \"/\"");
  const row = body.indexOf('site_backends?slug=eq.${encodeURIComponent(dslug)}`, { method: "DELETE"');
  assert.ok(markers > 0, "a deleted site's request markers outlive it — the sweep would route its parts for a site that is gone");
  assert.ok(records > 0, "a deleted site's request records and files outlive it");
  assert.ok(row > 0, "the registration delete moved — rescope this");
  assert.ok(markers < records, "the records go before the markers, so a sweep between the two moves a request it can no longer read");
  assert.ok(records < row, "the requests are wiped after the row delete — a failure there is unretryable");
  assert.match(body, /rqCursor = \(got && got\.truncated\) \? got\.cursor : undefined/, "the requests wipe does not follow the cursor — it can leave objects behind");
});

test("E5 — a part's job that ended in the site's container moves its request on through the gateway's /next, bound to that job's own token: the Worker checks the request names the job, and nothing else moves it", async () => {
  const JOB = "1".repeat(8) + "-2222-3333-4444-" + "5".repeat(12);
  const KEY = "k".repeat(20);
  // ── THE CONTAINER'S SIDE: the key, posted to the job's own gateway with its token.
  const posts = [];
  const jobEnv = makeContainerEnv({
    gateway: { url: "https://gofarther.dev/api/job/" + JOB, token: "the-job-token" },
    fetch: async (url, init) => { posts.push({ url: String(url), init }); return new Response("{}", { status: 200 }); },
  });
  assert.equal(typeof jobEnv.JOB_NEXT, "function", "a site job in the container has no way to move its request on");
  assert.equal(await jobEnv.JOB_NEXT({ key: KEY }), true);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, "https://gofarther.dev/api/job/" + JOB + "/next");
  assert.equal(posts[0].init.method, "POST");
  assert.equal(new Headers(posts[0].init.headers).get("authorization"), "Bearer the-job-token");
  assert.deepEqual(JSON.parse(posts[0].init.body), { key: KEY });
  // A pre-scoped build has no request to move.
  assert.equal(makeContainerEnv({ gateway: { url: "https://gofarther.dev/api/job/" + JOB, token: "t" }, pre: true, fetch: async () => new Response("{}") }).JOB_NEXT, undefined);

  // ── THE GATEWAY: the token's own id, site and owner, and a key that reads; nothing else.
  const gk = await gatewayKey("platform-secret");
  const asked = [];
  const handle = gatewayHandler({
    bucket: { async get() { return null; } }, verify: (t) => verifyJobToken(t, gk, Date.now()),
    next: async (a) => { asked.push(a); return a.key === KEY; },
  });
  const exp = Math.floor(Date.now() / 1000) + 600;
  const tok = await signJobToken({ id: JOB, slug: "fold-lane", uid: USER.id, exp }, gk);
  const post = (token, body, h = handle) => h(new Request("https://gofarther.dev/api/job/" + JOB + "/next", {
    method: "POST", headers: { ...(token ? { authorization: "Bearer " + token } : {}), "content-type": "application/json" }, body: JSON.stringify(body),
  }), JOB);
  assert.equal((await post(tok, { key: KEY })).status, 200);
  assert.deepEqual(asked, [{ id: JOB, slug: "fold-lane", uid: USER.id, key: KEY }], "the Worker was not asked with the token's own job, site and owner");
  assert.equal((await post(tok, { key: "q".repeat(20) })).status, 404, "a request that does not name this job was moved");
  for (const bad of [{ key: "short" }, { key: 42 }, {}]) assert.equal((await post(tok, bad)).status, 400, JSON.stringify(bad));
  assert.equal((await post(null, { key: KEY })).status, 401);
  assert.equal((await post(await signJobToken({ id: JOB, slug: preScopeSlug(JOB), uid: USER.id, exp, pre: true }, gk), { key: KEY })).status, 403, "a pre-scoped build moved a request");
  assert.equal((await post(tok, { key: KEY }, gatewayHandler({ bucket: { async get() { return null; } }, verify: (t) => verifyJobToken(t, gk, Date.now()) }))).status, 503);
  assert.equal(asked.length, 2, "a refused call still reached the Worker's step");

  // ── THE WORKER'S STEP, through its own gateway mount: the request moves only
  // for a job it names, under the request's own owner and site.
  await withPlatform({ slug: slugOf("e5"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    // PART 0'S JOB RUNS, AND ITS OWN STEP AFTER IT IS LOST (as in E1).
    let n = 0;
    P.hangPut((k) => k === "requests/" + P.slug + "/" + r.key + ".json" && ++n === 1);
    await pump(P);
    P.recover();
    P.env.SITE_SECRETS_KEY = "platform-secret";
    const job0 = P.record(r.key).parts[0].jobs[0].id;
    const stuck = JSON.stringify(P.record(r.key));
    const sign = (p) => signJobToken({ exp, ...p }, gk);
    const next = async (p, key = r.key) => call(P, "POST", "/api/job/" + p.id + "/next", { key }, "Bearer " + await sign(p));
    // ANOTHER JOB'S TOKEN, ANOTHER OWNER'S, ANOTHER SITE'S: refused, nothing moved.
    assert.equal((await next({ id: "9".repeat(8) + "-2222-3333-4444-" + "5".repeat(12), slug: P.slug, uid: USER.id })).status, 404);
    assert.equal((await next({ id: job0, slug: P.slug, uid: "someone-else" })).status, 404);
    assert.equal((await next({ id: job0, slug: "another-site", uid: USER.id })).status, 404);
    assert.equal(JSON.stringify(P.record(r.key)), stuck, "a token that is not this request's job moved it");
    // THE JOB'S OWN TOKEN: the request moves on, and the next part is filed.
    const ok = await next({ id: job0, slug: P.slug, uid: USER.id });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const moved = P.record(r.key);
    assert.equal(moved.parts[0].status, "done");
    assert.equal(moved.parts[1].jobs.length, 1, "the next part was not filed");
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
  });
});

test("E6 — a look at a request whose job is still running writes nothing; another owner's request is not found, whether read, stopped or listed", async () => {
  await withPlatform({ slug: slugOf("e6"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    const at = "requests/" + P.slug + "/" + r.key + ".json";
    const etag = P.objects.get(at).etag;
    // TWO LOOKS WHILE PART 0'S JOB WAITS IN THE QUEUE: read, never written,
    // so a page that polls never takes the write a real step needs.
    for (let i = 0; i < 2; i++) assert.equal((await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key)).status, 200);
    assert.equal(P.objects.get(at).etag, etag, "a look wrote the request though nothing had moved");
    // ANOTHER OWNER'S REQUEST ON THIS SITE (a slug that changed hands): its own record, its marker.
    const theirs = newKey();
    const other = { ...P.record(r.key), key: theirs, uid: "someone-else" };
    await P.bucket.put("requests/" + P.slug + "/" + theirs + ".json", JSON.stringify(other));
    await P.bucket.put("requests-live/" + P.slug + "/" + theirs, JSON.stringify({ at: P.now(), endedAt: null }));
    const before = JSON.stringify(P.record(theirs));
    assert.equal((await call(P, "GET", "/api/site/request/" + P.slug + "/" + theirs)).status, 404, "another owner's request was read");
    assert.equal((await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + theirs)).status, 404, "another owner's request was stopped");
    assert.equal(JSON.stringify(P.record(theirs)), before, "another owner's request was changed");
    const list = await call(P, "GET", "/api/site/requests/" + P.slug);
    assert.deepEqual(list.body.requests.map((v) => v.key), [r.key], "another owner's request was listed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F. THE HAND-OVERS THE PAGE USED TO MAKE, MADE ON THE SERVER
// ─────────────────────────────────────────────────────────────────────────────

const LINE_FROM = "Bread from the harbour, every morning.";
const textAnswer = (to) => (args) => {
  const lines = String(args.messages[0].content).split("\n");
  const at = lines.find((l) => l.includes("[index.tsx] " + LINE_FROM));
  return { edits: [{ id: Number(String(at || "-1.").split(".")[0]), to }] };
};

test("F1 — a step that hands on to another edit step: the server files the next step with the same words, marked a hand-over, and the other part still runs", async () => {
  const OPEN = "Change the opening line on the home page to say we open at 8";
  await withPlatform({
    slug: slugOf("f1"),
    answers: { route: [{ intent: "edit", layer: "data", alsoAsked: [ADD] }, { intent: "addon" }], [T.text]: textAnswer("Open from 8 every morning."), ...GALLERY },
  }, async (P) => {
    const r = await sendMessage(P, { message: OPEN + ", and " + ADD + "." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const [dataJob, textJob] = P.jobsOf(r.key);
    // THE DATA STEP HANDED ON (the site has no database): its answer is the escalate.
    assert.equal(P.answerOf(dataJob).escalate, true);
    assert.equal(P.answerOf(dataJob).layer, "text");
    // THE NEXT STEP: the text layer, the same words, marked a hand-over, saying from where and why.
    const b = P.bodyOf(textJob.id).body;
    assert.equal(b.layer, "text");
    assert.equal(b.handedOff, true);
    assert.deepEqual(b.handOver, { from: "data", reason: "no-backend" });
    assert.equal(b.instruction, P.bodyOf(dataJob.id).body.instruction);
    assert.ok(P.page("index.tsx").includes("Open from 8 every morning."));
    assert.ok(P.pages().includes("gallery.tsx"));
    // THE PART'S JOBS FOR THE PAGE: only the step that answered, never the hand-over.
    const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.deepEqual(v.body.request.parts[0].jobs, [textJob.id]);
  });
});

test("F2 — an edit step that names the add-on hands the part there, with why: the addition is made, as the page's own hand-over made it", async () => {
  await withPlatform({
    slug: slugOf("f2"),
    answers: {
      route: [{ intent: "edit", layer: "look" }],
      [T.pick]: { fields: ["pages"], pageVerb: "add", pageName: "/gallery", scopes: [{ part: "pages", words: "Add a gallery page" }] },
      ...GALLERY,
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Add a gallery page." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const [lookJob, addJob] = P.jobsOf(r.key);
    assert.equal(lookJob.op, "edit");
    assert.equal(addJob.op, "addon");
    const b = P.bodyOf(addJob.id).body;
    assert.equal(b.instruction, "Add a gallery page.");
    assert.deepEqual(b.handOver, { from: "look", reason: "addon", field: "pages" });
    assert.ok(P.pages().includes("gallery.tsx"));
  });
});

test("F3 — a step that can only be done by the full rewrite is not started: the part waits for a go-ahead, the rest still runs, and the customer is told the measured cost", async () => {
  // A SITE WITH MORE WORDING THAN THE TEXT STEP REWRITES ONE AT A TIME: that
  // step climbs (`too-much-text`) with no model call — the designed climb.
  const many = Array.from({ length: 610 }, (_, i) => "<p>Line " + (i + 1) + " of our story.</p>").join("");
  const BIG = [{ path: "index.tsx", source: pageSrc("/", "<section>" + many + "</section>") }, { path: "visit.tsx", source: VISIT }];
  await withPlatform({ slug: slugOf("f3"), pages: BIG, replies: true, answers: { route: [{ intent: "edit", layer: "text", alsoAsked: [ADD] }, { intent: "addon" }], ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: "Reword every line to sound warmer, and " + ADD + "." });
    const { rec } = await settle(P, r.key);
    // WAITING FOR THE GO-AHEAD (the owner's review, 2026-10-03): the part is
    // not ended, so the request is not over and keeps what it holds.
    assert.deepEqual(statuses(rec), ["approval", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[0].why, "climb");
    assert.equal(rec.state, "waiting");
    assert.equal(rec.ended, false);
    // NOTHING STARTED THE REWRITE: no build job, nothing charged for part 0.
    assert.equal([...P.jobs.values()].some((j) => j.op === "build"), false);
    assert.deepEqual(reserveOf(P, P.jobsOf(r.key)[0].id), []);
    assert.equal(P.page("index.tsx"), BIG[0].source);
    // THE CUSTOMER'S FACTS NAME THE GO-AHEAD AND ITS MEASURED COST, in a reply
    // of its own, named for this go-ahead so a page shows it once.
    const g = await readWritten(P, REQ(P, r.key));
    assert.equal(g.body.replyFor, "approval:0:" + (rec.parts[0].seq + 1));
    assert.equal(g.body.request.parts[0].ask, rec.parts[0].words);
    const facts = toldIn(P, g);
    assert.match(facts, /Waiting for their go-ahead/);
    assert.match(facts, /only the full rewrite of every page can \(a full rewrite of the same site was measured at 17 credits\)/);
    assert.match(facts, /go-ahead button shown under this part/);
    // ASKED AGAIN, THE SAME REPLY: no second reply call, and nothing asked of the queue.
    const calls = P.replyLog.length;
    const g2 = await call(P, "GET", REQ(P, r.key));
    assert.equal(g2.body.reply, g.body.reply);
    assert.equal(P.queue.length, 0, "a read of a written reply asked for another");
    assert.equal(P.replyLog.length, calls);
  });
});

test("F4 — the hand-overs are bounded as the page bounded them: a second edit hand-over, a loop back to the add-on, or a long chain goes to the go-ahead, never round again", () => {
  const edit = { op: "edit", layer: "look", handedOff: false, fromAddon: false, hops: 0 };
  assert.deepEqual(handOff({ act: "hop", layer: "text" }, edit).act, "hop");
  assert.deepEqual(handOff({ act: "hop", layer: "text" }, { ...edit, handedOff: true }), { act: "rewrite", why: "handed-off" });
  assert.deepEqual(handOff({ act: "hop", layer: "look" }, edit), { act: "rewrite", why: "same-layer" });
  assert.deepEqual(handOff({ act: "hop", layer: "addon" }, { ...edit, fromAddon: true }), { act: "stop" });
  assert.deepEqual(handOff({ act: "hop", layer: "text" }, { ...edit, hops: HOPS_MAX }), { act: "rewrite", why: "hops" });
  assert.deepEqual(handOff({ act: "climb" }, edit), { act: "rewrite", why: "climb" });
  const addon = { op: "addon", layer: "", hops: 0 };
  assert.deepEqual(handOff({ act: "hop", layer: "nav", page: "" }, addon), { act: "hop", op: "edit", layer: "nav", page: "", fromAddon: true, handedOff: true });
  assert.deepEqual(handOff({ act: "hop", layer: "made-up" }, addon), { act: "unknown" });
});

test("F5 — every part's job posts exactly what the page posts for the same decision, field for field: the same route, gates, publish and charging", async () => {
  const site = { slug: "rq-parity", name: "Harbour Loaf", react: true, pages: [{ path: "/" }, { path: "/visit" }], msgs: [], undoRows: [{ table: "loaves", was: { id: 1 } }] };
  const MSG = DESC + ", and " + ADD + ".";
  const cases = [
    { intent: "edit", layer: "look", alsoAsked: [ADD], cost: 2 },
    { intent: "edit", layer: "data", page: "/visit", alsoAsked: ADD, cost: 1 },
    { intent: "edit", layer: "page", page: "/visit", remove: true, cost: 1 },
    { intent: "addon", alsoAsked: [ADD], cost: 2 },
  ];
  const { planParts, newRequest } = await import("../builder/request.mjs");
  for (const d of cases) {
    const planned = planParts(MSG, d);
    assert.equal(planned.ok, true);
    const rec = newRequest({ key: "rqparity0000000000", uid: USER.id, slug: site.slug, message: MSG, picker: "sonnet", tz: "Europe/London", recent: site.undoRows, accepted: d, routedCost: d.cost, parts: planned.parts });
    const ours = jobBody(rec, 0, "run", "rqparity0000000000-p0-1", { files: [] });
    const page = browserBody(site, d, MSG);
    assert.equal(ours.url, page.url, "a part posts to another route than the page: " + d.intent + "/" + d.layer);
    const strip = (b) => { const o = JSON.parse(JSON.stringify(b)); delete o.idem; delete o.request; return o; };
    assert.deepEqual(strip(ours.body), strip(page.body), "a part's body differs from the page's for " + d.intent + "/" + (d.layer || ""));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// N. THE FULL REWRITE'S GO-AHEAD, KEPT ON THE REQUEST (2026-10-03, the owner's
// review: *"Preserve a waiting approval state and attachments, record the
// approval durably, and use the existing rewrite executor without changing
// first Build; settle its result back into the request and resume eligible
// dependents. Verify approval after reload or from another device, duplicate
// approval, failure and cancellation."*). The rewrite each case runs is the
// existing queued build — its row, its consumer, its design call, its page
// writer, its compile, its publish and its charging — not a stand-in.
// ─────────────────────────────────────────────────────────────────────────────

const MANY = Array.from({ length: 610 }, (_, i) => "<p>Line " + (i + 1) + " of our story.</p>").join("");
const BIG = [{ path: "index.tsx", source: pageSrc("/", "<section>" + MANY + "</section>") }, { path: "visit.tsx", source: VISIT }];
const WARM = pageSrc("/", "<section><p>A warmer story, line by line.</p></section>");
const REWORD = "Reword every line to sound warmer";
/** The rewrite's own two model calls (its designer, its page writer), beside a message's routing; `gallery` when the add-on's page writer runs first. */
function rewriteAnswers(slug, { route, gallery = false, extra = {} } = {}) {
  return {
    route, ...(gallery ? GALLERY : {}), ...extra,
    design_schema: { brand: "Harbour Loaf", slug, description: "a bakery", kind: "shopfront", purpose: "visit", pages: [{ path: "/", name: "Home" }, { path: "/visit", name: "Visit" }], components: [], css: "" },
    [T.pages]: (args, n) => (gallery && n === 0 ? { pages: [writtenPage("/gallery")] } : { pages: [{ path: "src/routes/index.tsx", source: WARM }], notes: "Rewrote the home page." }),
  };
}
/** The existing build's own bindings: its database check and its compile container. */
const buildable = (P) => { P.env.NEON_API_KEY = "neon-test"; P.env.SITE_BUILD_CONTAINER = {}; };
const approve = (P, key, part = 0, auth) => call(P, "POST", "/api/site/request/" + P.slug + "/" + key + "/approve", { part }, auth);
const builds = (P) => [...P.jobs.values()].filter((j) => j.op === "build");
const designs = (P) => P.modelLog.filter((m) => m.tool === "design_schema").length;
/** Ledger rows the build path wrote (its own refs), as numbers. */
const buildRows = (P) => P.ledger.filter((e) => e.ref.startsWith("build:")).map((e) => e.delta);
/** The request's record, where a press writes the go-ahead. */
const recordOf = (P, key) => "requests/" + P.slug + "/" + key + ".json";
/** The id part 0's go-ahead is filed under, as the server derives it (`rewriteJobId`). */
async function nextRewriteId(P, key) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update("request-rewrite:" + key + ":0:" + (P.record(key).parts[0].seq + 1)).digest("hex").slice(0, 32);
}
/**
 * ONE REWRITE, CHARGED ONCE: one build row, under the go-ahead's id; one
 * design; every build ledger row under that id, adding up to what the build
 * said it cost; and one rewrite job on the part, settled at that cost.
 */
function oneRewrite(P, rec, id) {
  assert.deepEqual(builds(P).map((b) => b.id), [id], "not one build, under the go-ahead's id");
  assert.equal(designs(P), 1, "the rewrite did not run exactly once");
  const rows = P.ledger.filter((e) => e.ref.startsWith("build:"));
  assert.ok(rows.length > 0, "the rewrite charged nothing");
  assert.ok(rows.every((e) => e.ref.startsWith("build:" + id + ":")), "a build charge under another id: " + rows.map((e) => e.ref).join(", "));
  const cost = JSON.parse(JSON.parse(P.objects.get("jobs/" + id + ".result.json").body).body).cost;
  assert.equal(-rows.reduce((n, e) => n + e.delta, 0), cost);
  const rw = rec.parts[0].jobs.filter((j) => j.kind === "rewrite");
  assert.deepEqual(rw.map((j) => [j.id, j.end && j.end.cost]), [[id, cost]]);
}
// PART 0 CLIMBS TO THE REWRITE (too much wording for the text step, no model
// call); PART 1 NEEDS IT; PART 2 IS INDEPENDENT AND RUNS WHILE PART 0 WAITS.
const WAITING_ROUTE = [
  { intent: "edit", layer: "text", alsoAsked: [DESC, ADD], dependsOn: [{ change: 1, after: [0] }] },
  { intent: "addon" },
  { intent: "edit", layer: "look" },
];
const WAITING_MSG = REWORD + ", then " + DESC + ", and " + ADD + ".";

test("N1 — the go-ahead is kept on the request: the part waits with its files, the press runs the existing rewrite with them, its result settles back into the part, and the part that needed it runs after", async () => {
  const slug = slugOf("n1");
  await withPlatform({ slug, pages: BIG, replies: true, answers: rewriteAnswers(slug, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: WAITING_MSG, images: [{ name: "story.png", data: PNG }] });
    let { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["approval", "blocked", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.ended, false);
    // ITS FILES ARE KEPT WHILE IT WAITS (a request lets them go only when it ends).
    assert.equal(rec.files.length, 1);
    assert.ok(P.objects.has(rec.files[0].key), "the request's file was let go while a part waits on it");
    assert.deepEqual(builds(P), []);
    // THE PRESS: recorded on the part, filed through the existing queued build.
    const a = await approve(P, r.key);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(a.body.request.parts[0].status, "queued");
    assert.ok(Number.isFinite(a.body.request.parts[0].approved.at));
    rec = P.record(r.key);
    assert.equal(rec.parts[0].approval.job, builds(P)[0].id);
    assert.equal(builds(P).length, 1);
    // THE REWRITE'S STORED JOB: the revise the page posts, with the part's words and the request's file.
    const job = JSON.parse(P.objects.get("jobs/" + builds(P)[0].id + ".json").body);
    assert.match(job.url, /\/api\/site\/react-revise$/);
    const jb = JSON.parse(job.body);
    assert.equal(jb.instruction, rec.parts[0].words);
    assert.equal(jb.slug, P.slug);
    assert.deepEqual(jb.images.map((i) => i.data), [PNG]);
    assert.deepEqual(jb.request, { key: r.key, part: 0 });
    // THE SERVER RUNS IT: the existing consumer, design, pages, compile, publish.
    ({ rec } = await settle(P, r.key));
    assert.equal(designs(P), 1);
    assert.equal(P.page("index.tsx"), WARM, "the rewrite did not publish its page");
    assert.equal(builds(P)[0].state, "done");
    // SETTLED BACK, AND THE PART THAT NEEDED IT RAN AFTER IT.
    assert.deepEqual(statuses(rec), ["done", "done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.ended, true);
    assert.equal(P.look().description, NEW_DESC);
    const order = rec.parts.map((p) => ({ n: p.n, at: Math.max(...p.jobs.filter((j) => j.end).map((j) => j.end.at)) }));
    assert.ok(order[1].at >= order[0].at, "the part that needed the rewrite ran before it settled");
    // WHAT IT COST, AS THE BUILD ITSELF SAID — and the ledger's own build rows agree.
    const cost = JSON.parse(JSON.parse(P.objects.get("jobs/" + builds(P)[0].id + ".result.json").body).body).cost;
    assert.ok(Number.isInteger(cost) && cost > 0);
    assert.equal(rec.parts[0].jobs.find((j) => j.kind === "rewrite").end.cost, cost);
    assert.equal(-buildRows(P).reduce((n, d) => n + d, 0), cost);
    // THE FILES ARE LET GO NOW THE REQUEST HAS ENDED.
    assert.equal(P.objects.has(rec.files[0].key), false);
    // THE CUSTOMER'S FACTS: made by the rewrite on their go-ahead, and its cost.
    const v = await readWritten(P, REQ(P, r.key));
    assert.equal(v.body.replyFor, "end");
    const facts = toldIn(P, v);
    assert.match(facts, /by the full rewrite of every page, on their go-ahead/);
    assert.match(facts, new RegExp("Everything done for it was charged " + cost + " credit"));
  });
});

test("N2 — pressed twice, or from another device, or delivered again: one rewrite, run once, charged once; a stray second delivery after it ended runs nothing", async () => {
  const slug = slugOf("n2");
  await withPlatform({ slug, pages: BIG, answers: rewriteAnswers(slug, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: WAITING_MSG });
    await settle(P, r.key);
    // TWO DEVICES AT ONCE, EACH ITS OWN SESSION: both answered with the one
    // go-ahead; then a third press, after it is recorded.
    const [first, second] = await Promise.all([approve(P, r.key), approve(P, r.key, 0, "Bearer another-device")]);
    const third = await approve(P, r.key);
    assert.deepEqual([first.status, second.status, third.status], [200, 200, 200]);
    assert.equal(second.body.request.parts[0].approved.at, first.body.request.parts[0].approved.at);
    assert.equal(builds(P).length, 1, "a second press filed a second rewrite");
    assert.equal(P.record(r.key).parts[0].jobs.filter((j) => j.kind === "rewrite").length, 1);
    // THE JOB THE PRESSES STORED, kept to play back as a stray later.
    const storedJob = P.objects.get("jobs/" + builds(P)[0].id + ".json");
    assert.ok(storedJob, "the rewrite's job was not stored");
    // EVERY MESSAGE DELIVERED TWICE: the rewrite runs once.
    await pump(P, { twice: true });
    const { rec } = await settle(P, r.key);
    assert.equal(designs(P), 1, "the rewrite ran more than once");
    assert.equal(rec.parts[0].status, "done");
    const spent = buildRows(P).slice();
    // A STRAY DELIVERY AFTER IT ENDED (its job written back, its message sent
    // again, as a press racing the consumer could leave it): the claim is
    // refused, and a request's rewrite never runs without its row's lease.
    // THE VERY JOB THE PRESSES STORED, written back after the consumer read it.
    const id = builds(P)[0].id;
    P.objects.set("jobs/" + id + ".json", { ...storedJob, etag: "stray" });
    P.queue.push({ body: { kind: "site-build", id }, delaySeconds: 0 });
    await pump(P);
    assert.equal(designs(P), 1, "a stray delivery ran the rewrite again");
    assert.deepEqual(buildRows(P), spent, "a stray delivery charged again");
    // A PRESS'S COPY OF THE JOB WRITTEN AFTER THE BUILD READ THE FIRST, with
    // nothing left to send it: let go when the request is next read.
    P.objects.set("jobs/" + id + ".json", { ...storedJob, etag: "late" });
    // A RELOAD READS IT GIVEN: the request as the server has it, and listed for another device.
    const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.ok(v.body.request.parts[0].approved);
    assert.equal(P.objects.has("jobs/" + id + ".json"), false, "a late copy of the job, with its session, outlived the request");
    const listed = await call(P, "GET", "/api/site/requests/" + P.slug);
    assert.ok(listed.body.requests.find((q) => q.key === r.key).parts[0].approved);
  });
});

test("N3 — a rewrite that fails is said so on its part: what needed it is not run, the site stays as it was, and its cost is the build's own; a press whose job cannot be stored is answered 503 and the part still waits for a press that can", async () => {
  const slug = slugOf("n3");
  await withPlatform({ slug, pages: BIG, replies: true, answers: rewriteAnswers(slug, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    // NO COMPILE CONTAINER: the existing build designs, cannot write the pages,
    // and answers its placeholder — on a site already live, it publishes nothing.
    P.env.NEON_API_KEY = "neon-test";
    const r = await sendMessage(P, { message: WAITING_MSG });
    await settle(P, r.key);
    // THE PRESS CANNOT STORE THE BUILD'S JOB: 503, and no go-ahead is written.
    P.failPut((k) => /^jobs\/[0-9a-f]{32}\.json$/.test(k));
    const refused = await approve(P, r.key);
    assert.equal(refused.status, 503, JSON.stringify(refused.body));
    assert.equal(refused.body.request.parts[0].status, "approval");
    const look = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.equal(look.body.request.parts[0].status, "approval");
    assert.deepEqual(builds(P), []);
    // PRESSED AGAIN, IT IS GIVEN, AND RUNS.
    const ok = await approve(P, r.key);
    assert.equal(ok.status, 200);
    assert.equal(builds(P).length, 1);
    const { rec } = await settle(P, r.key);
    assert.equal(designs(P), 1);
    assert.deepEqual(statuses(rec), ["failed", "not-run", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[0].why, "rewrite-not-written");
    assert.equal(rec.parts[1].why, "needs:0");
    assert.equal(P.page("index.tsx"), BIG[0].source, "a failed rewrite changed the site");
    assert.notEqual(P.look().description, NEW_DESC, "the part that needed the rewrite ran");
    const cost = rec.parts[0].jobs.find((j) => j.kind === "rewrite").end.cost;
    assert.equal(-buildRows(P).reduce((n, d) => n + d, 0), cost);
    const facts = toldIn(P, await readWritten(P, REQ(P, r.key)));
    assert.match(facts, /ran, but its pages could not be written, so their site stayed exactly as it was/);
    assert.match(facts, new RegExp("charged " + cost + " credit"));
    assert.match(facts, /because it needed .* done first/);
  });
});

test("N4 — Stop: while it waits, the go-ahead is gone and a press is refused; after the press, the rewrite ends at its gate before it designs or spends; a press that read the request before the Stop is refused and takes its stored job back", async () => {
  const slug = slugOf("n4");
  // (a) STOPPED WHILE IT WAITS.
  await withPlatform({ slug, pages: BIG, answers: rewriteAnswers(slug, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: WAITING_MSG });
    await settle(P, r.key);
    const stop = await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + r.key);
    assert.equal(stop.status, 200);
    assert.deepEqual(statuses(P.record(r.key)), ["cancelled", "cancelled", "done"]);
    const late = await approve(P, r.key);
    assert.equal(late.status, 409);
    assert.equal(late.body.error, "not-waiting");
    assert.deepEqual(builds(P), []);
    assert.equal(P.page("index.tsx"), BIG[0].source);
  });
  // (b) STOPPED AFTER THE PRESS, BEFORE THE REWRITE RAN.
  const slug2 = slugOf("n4b");
  await withPlatform({ slug: slug2, pages: BIG, answers: rewriteAnswers(slug2, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: WAITING_MSG });
    await settle(P, r.key);
    assert.equal((await approve(P, r.key)).status, 200);
    const stop = await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + r.key);
    assert.equal(stop.status, 200);
    assert.ok(builds(P)[0].cancel_requested_at, "the stop did not reach the rewrite's row");
    const { rec } = await settle(P, r.key);
    assert.equal(designs(P), 0, "a stopped rewrite designed");
    assert.deepEqual(buildRows(P), [], "a stopped rewrite was charged");
    assert.equal(builds(P)[0].state, "cancelled");
    assert.deepEqual(statuses(rec), ["cancelled", "cancelled", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[0].why, "stopped");
    assert.equal(rec.parts[0].jobs.find((j) => j.kind === "rewrite").end.cost, 0);
    assert.equal(P.page("index.tsx"), BIG[0].source);
  });
  // (c) A PRESS THAT READ THE REQUEST BEFORE THE STOP: the Stop lands, and
  // ends the request, before the press stores its job — so only the press
  // itself can take that job back — and its go-ahead's write meets the Stop.
  const slug3 = slugOf("n4c");
  await withPlatform({ slug: slug3, pages: BIG, answers: rewriteAnswers(slug3, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: WAITING_MSG });
    await settle(P, r.key);
    const id = await nextRewriteId(P, r.key);
    P.beforePut((k) => k === "jobs/" + id + ".json", async () => {
      assert.equal((await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + r.key)).status, 200);
      assert.equal(P.record(r.key).ended, true);
    });
    const late = await approve(P, r.key);
    assert.equal(late.status, 409, JSON.stringify(late.body));
    assert.equal(late.body.error, "not-waiting");
    assert.equal(P.objects.has("jobs/" + id + ".json"), false, "a refused press left its job, with its session, behind");
    const rec = P.record(r.key);
    assert.deepEqual(statuses(rec), ["cancelled", "cancelled", "done"]);
    assert.equal(rec.parts[0].approval, undefined);
    assert.deepEqual(builds(P), []);
    assert.equal(designs(P), 0);
    assert.deepEqual(buildRows(P), []);
    assert.equal(P.page("index.tsx"), BIG[0].source);
  });
});

test("N5 — the go-ahead is kept from the moment it is written: a press cut off at any later step — before the row, after the row, after the message, or whose message the queue refused — is finished by the server alone, with no second press, no resend and no page open, as one rewrite charged once", async () => {
  const cases = [
    {
      name: "the go-ahead written, the press gone before anything else",
      cut: (P, key) => P.hangPut((k) => k === recordOf(P, key)),
      left: (P) => assert.deepEqual(builds(P), [], "a row was filed before the press died"),
    },
    {
      name: "the row filed, the press gone before its message",
      cut: (P) => P.hang("edit_create", (a) => a.p_op === "build"),
      left: (P, id) => { assert.deepEqual(builds(P).map((b) => [b.id, b.state]), [[id, "queued"]]); assert.equal(P.queue.length, 0, "the message was sent"); },
    },
    {
      name: "the queue refused the message: the press is answered, the go-ahead kept",
      cut: (P) => { P.env.__dropSends = 1; },
      answered: 200,
      left: (P, id) => { assert.deepEqual(builds(P).map((b) => [b.id, b.state]), [[id, "queued"]]); assert.equal(P.queue.length, 0, "the message was sent"); },
    },
    {
      name: "the message sent, the press gone before it recorded the row",
      cut: (P) => P.hangSend(),
      left: (P, id, key) => {
        assert.deepEqual(P.queue.map((m) => m.body), [{ kind: "site-build", id }]);
        assert.equal(P.record(key).parts[0].jobs.find((j) => j.kind === "rewrite").id, null, "the row's id was recorded");
      },
    },
    {
      name: "the message sent, the press gone before it recorded the row, and the build ending before any sweep",
      cut: (P) => P.hangSend(),
      left: (P, id) => assert.deepEqual(P.queue.map((m) => m.body), [{ kind: "site-build", id }]),
      // THE BUILD'S OWN END records its row and moves the request on: no sweep at all.
      bare: true,
    },
  ];
  for (const [i, c] of cases.entries()) {
    const slug = slugOf("n5" + "abcde"[i]);
    await withPlatform({ slug, pages: BIG, answers: rewriteAnswers(slug, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
      buildable(P);
      const r = await sendMessage(P, { message: WAITING_MSG });
      await settle(P, r.key);
      const id = await nextRewriteId(P, r.key);
      c.cut(P, r.key);
      const press = await approve(P, r.key);
      assert.equal(press.status, c.answered || 0, c.name + ": " + JSON.stringify(press.body));
      P.recover();
      // WHAT THE PRESS LEFT: the go-ahead on the record, the build's job stored.
      assert.equal(P.record(r.key).parts[0].approval.job, id, c.name);
      assert.ok(P.objects.has("jobs/" + id + ".json"), c.name + ": the go-ahead was written without its job");
      c.left(P, id, r.key);
      // FROM HERE NO PRESS, NO RESEND, NO PAGE: the two-minute sweep and the
      // queue. The sweep's step files the go-ahead's one row and sends it —
      // again, where the press had sent it already.
      let rec;
      if (c.bare) {
        await pump(P);
        rec = P.record(r.key);
        assert.equal(rec.ended, true, c.name + ": the build's end did not finish the request");
        assert.deepEqual(P.sent.filter((m) => m.body.kind === "site-build").map((m) => m.body.id), [id], c.name + ": sent again after it ran");
      } else {
        await tick(P);
        assert.deepEqual(builds(P).map((b) => b.id), [id], c.name + ": not the go-ahead's one row");
        assert.equal(P.record(r.key).parts[0].jobs.find((j) => j.kind === "rewrite").id, id, c.name);
        assert.ok(P.queue.some((m) => m.body.kind === "site-build" && m.body.id === id), c.name + ": nothing sent to run it");
        ({ rec } = await settle(P, r.key));
      }
      assert.deepEqual(statuses(rec), ["done", "done", "done"], c.name + ": " + JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.equal(P.page("index.tsx"), WARM, c.name);
      assert.equal(P.look().description, NEW_DESC, c.name);
      oneRewrite(P, rec, id);
      assert.equal(P.objects.has("jobs/" + id + ".json"), false, c.name + ": the build's job outlived it");
    });
  }
});

test("N6 — a go-ahead nobody gives in a day lapses as a question does: what needed it is not run, the request ends and lets its files go, and the customer is told why", async () => {
  const slug = slugOf("n6");
  await withPlatform({ slug, pages: BIG, replies: true, answers: rewriteAnswers(slug, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: WAITING_MSG, images: [{ name: "story.png", data: PNG }] });
    let { rec } = await settle(P, r.key);
    const file = rec.files[0].key;
    P.advance(24 * 60 * 60 * 1000 + 1000);
    await tick(P);
    rec = P.record(r.key);
    assert.deepEqual(statuses(rec), ["expired", "not-run", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[0].why, "unapproved");
    assert.equal(rec.ended, true);
    assert.equal(P.objects.has(file), false, "a lapsed request kept its files");
    assert.equal((await approve(P, r.key)).status, 409);
    assert.deepEqual(builds(P), []);
    const facts = toldIn(P, await readWritten(P, REQ(P, r.key)));
    assert.match(facts, /not given the go-ahead within a day, so it was never started/);
  });
});

test("N7 — a rewrite that ended where its request's step was lost moves the request on through the gateway's /next under its own build's token, as a container-run job does; another build's token moves nothing", async () => {
  const slug = slugOf("n7");
  await withPlatform({ slug, pages: BIG, answers: rewriteAnswers(slug, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: WAITING_MSG });
    await settle(P, r.key);
    assert.equal((await approve(P, r.key)).status, 200);
    // THE REWRITE RUNS; THE STEP IT ASKS FOR RECORDS ITS NEXT JOB AND DIES BEFORE FILING IT.
    let n = 0;
    P.hangPut((k) => k === "requests/" + P.slug + "/" + r.key + ".json" && ++n === 1);
    await pump(P);
    P.recover();
    assert.equal(designs(P), 1);
    const id = builds(P)[0].id;
    const stuck = P.record(r.key);
    assert.equal(stuck.parts[1].jobs.length, 1);
    assert.equal(stuck.parts[1].jobs[0].id, null, "the next part's job was filed before the step died");
    P.env.SITE_SECRETS_KEY = "platform-secret";
    const gk = await gatewayKey("platform-secret");
    const exp = Math.floor(Date.now() / 1000) + 600;
    const next = async (p) => call(P, "POST", "/api/job/" + p.id + "/next", { key: r.key }, "Bearer " + await signJobToken({ exp, ...p }, gk));
    assert.equal((await next({ id: "f".repeat(32), slug: P.slug, uid: USER.id })).status, 404, "another build's token moved the request");
    const ok = await next({ id, slug: P.slug, uid: USER.id });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.ok(P.record(r.key).parts[1].jobs[0].id, "the next part was not filed");
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done", "done"]);
  });
});

test("N8 — a press that wrote no go-ahead gave none, and the job it stored is let go when the request ends: one cut off after storing it (the part waits; a Stop), one whose write failed and could not be read back (503; the part waits; the go-ahead lapses); and a write that landed with its answer lost is an uncertain press the sweep finishes as one rewrite", async () => {
  // (a) CUT OFF AFTER STORING THE BUILD'S JOB, BEFORE THE GO-AHEAD'S WRITE.
  const s1 = slugOf("n8a");
  await withPlatform({ slug: s1, pages: BIG, answers: rewriteAnswers(s1, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: WAITING_MSG });
    await settle(P, r.key);
    const id = await nextRewriteId(P, r.key);
    P.hangPut((k) => k === "jobs/" + id + ".json");
    assert.equal((await approve(P, r.key)).status, 0);
    P.recover();
    assert.ok(P.objects.has("jobs/" + id + ".json"));
    await tick(P);
    assert.equal(P.record(r.key).parts[0].status, "approval", "a go-ahead never written was counted given");
    assert.deepEqual(builds(P), []);
    assert.equal((await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + r.key)).status, 200);
    const rec = P.record(r.key);
    assert.deepEqual(statuses(rec), ["cancelled", "cancelled", "done"]);
    assert.equal(P.objects.has("jobs/" + id + ".json"), false, "a stopped request kept a press's job, with its session");
    assert.deepEqual(builds(P), []);
    assert.deepEqual(buildRows(P), []);
  });
  // (b) THE GO-AHEAD'S WRITE FAILS, AND READING IT BACK FAILS TOO: 503, its
  // job kept while another press of the same go-ahead might still write it.
  const s2 = slugOf("n8b");
  await withPlatform({ slug: s2, pages: BIG, answers: rewriteAnswers(s2, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: WAITING_MSG });
    await settle(P, r.key);
    const id = await nextRewriteId(P, r.key);
    P.beforePut((k) => k === recordOf(P, r.key), () => P.failGet((k) => k === recordOf(P, r.key)));
    P.failPut((k) => k === recordOf(P, r.key));
    const failed = await approve(P, r.key);
    assert.equal(failed.status, 503, JSON.stringify(failed.body));
    assert.equal(P.record(r.key).parts[0].status, "approval");
    assert.ok(P.objects.has("jobs/" + id + ".json"), "the job was taken back while a press might still write its go-ahead");
    await tick(P);
    assert.equal(P.record(r.key).parts[0].status, "approval");
    assert.deepEqual(builds(P), []);
    P.advance(24 * 60 * 60 * 1000 + 1000);
    await tick(P);
    const rec = P.record(r.key);
    assert.deepEqual(statuses(rec), ["expired", "not-run", "done"]);
    assert.equal(P.objects.has("jobs/" + id + ".json"), false, "a lapsed go-ahead kept a press's job, with its session");
    assert.deepEqual(builds(P), []);
  });
  // (c) THE GO-AHEAD'S WRITE LANDS, ITS ANSWER IS LOST, AND READING IT BACK
  // FAILS: the press cannot tell, and says so; the go-ahead is written, so the
  // sweep files it — no press, no page — and a press after is answered with it.
  const s3 = slugOf("n8c");
  await withPlatform({ slug: s3, pages: BIG, answers: rewriteAnswers(s3, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: WAITING_MSG });
    await settle(P, r.key);
    const id = await nextRewriteId(P, r.key);
    P.losePut((k) => k === recordOf(P, r.key), () => P.failGet((k) => k === recordOf(P, r.key)));
    const unsure = await approve(P, r.key);
    assert.equal(unsure.status, 503, JSON.stringify(unsure.body));
    assert.equal(P.record(r.key).parts[0].approval.job, id);
    assert.deepEqual(builds(P), []);
    await tick(P);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    oneRewrite(P, rec, id);
    const after = await approve(P, r.key);
    assert.equal(after.status, 200);
    assert.ok(after.body.request.parts[0].approved);
    assert.equal(builds(P).length, 1);
  });
});

test("N9 — a Stop after the go-ahead was written ends its rewrite before it designs: through the build's own read of its request when no cancel reached the row; through the row, by the id it is filed under, when the step that filed it died before recording it; and a build no go-ahead recorded runs nothing", async () => {
  // (a) THE PRESS CUT OFF AFTER THE GO-AHEAD; THE STOP'S CANCELS DO NOT LAND.
  const s1 = slugOf("n9a");
  await withPlatform({ slug: s1, pages: BIG, answers: rewriteAnswers(s1, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: WAITING_MSG });
    await settle(P, r.key);
    const id = await nextRewriteId(P, r.key);
    P.hangPut((k) => k === recordOf(P, r.key));
    assert.equal((await approve(P, r.key)).status, 0);
    P.recover();
    // THE STOP'S OWN CANCEL, AND ITS STEP'S CANCEL OF THE ROW IT FILES.
    P.failRpc("edit_cancel", (a) => a.p_id === id);
    P.failRpc("edit_cancel", (a) => a.p_id === id);
    assert.equal((await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + r.key)).status, 200);
    assert.deepEqual(builds(P).map((b) => [b.id, b.cancel_requested_at]), [[id, null]], "this case does not isolate the build's read of its request");
    const { rec } = await settle(P, r.key);
    assert.equal(designs(P), 0, "a stopped request's rewrite designed");
    assert.deepEqual(buildRows(P), []);
    assert.equal(builds(P)[0].state, "cancelled");
    assert.deepEqual(statuses(rec), ["cancelled", "cancelled", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[0].why, "stopped");
    assert.equal(rec.parts[0].jobs.find((j) => j.kind === "rewrite").end.cost, 0);
    assert.equal(P.page("index.tsx"), BIG[0].source);
  });
  // (b) A ROW, JOB AND MESSAGE UNDER THE ID THE NEXT GO-AHEAD WOULD TAKE, THAT
  // NO GO-AHEAD RECORDED: the part does not name it, so it is no part's build.
  const s2 = slugOf("n9b");
  await withPlatform({ slug: s2, pages: BIG, answers: rewriteAnswers(s2, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: WAITING_MSG });
    await settle(P, r.key);
    const id = await nextRewriteId(P, r.key);
    const { packJob } = await import("../builder/build-job.mjs");
    P.rpc("edit_create", { p_id: id, p_uid: USER.id, p_slug: P.slug, p_op: "build", p_idem: id });
    P.objects.set("jobs/" + id + ".json", { body: JSON.stringify(packJob({ url: "https://gofarther.dev/api/site/react-revise", auth: "Bearer t", body: JSON.stringify({ slug: P.slug, instruction: REWORD, request: { key: r.key, part: 0 } }), uid: USER.id, at: Date.now() })), etag: "stray", at: Date.now() });
    P.queue.push({ body: { kind: "site-build", id }, delaySeconds: 0 });
    await pump(P);
    assert.equal(P.jobs.get(id).state, "cancelled");
    assert.equal(designs(P), 0, "a build no go-ahead recorded designed");
    assert.deepEqual(buildRows(P), []);
    assert.equal(P.record(r.key).parts[0].status, "approval");
    assert.equal(P.page("index.tsx"), BIG[0].source);
  });
  // (c) THE ROW FILED AND SENT, THE PRESS GONE BEFORE IT RECORDED THE ROW, AND
  // THE STOP'S OWN STEP UNABLE TO FILE IT AGAIN: the Stop reaches the row
  // itself, by the id the go-ahead files it under.
  const s3 = slugOf("n9c");
  await withPlatform({ slug: s3, pages: BIG, answers: rewriteAnswers(s3, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    buildable(P);
    const r = await sendMessage(P, { message: WAITING_MSG });
    await settle(P, r.key);
    const id = await nextRewriteId(P, r.key);
    P.hangSend();
    assert.equal((await approve(P, r.key)).status, 0);
    P.recover();
    assert.equal(P.record(r.key).parts[0].jobs.find((j) => j.kind === "rewrite").id, null);
    P.failRpc("edit_create", (a) => a.p_id === id);
    assert.equal((await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + r.key)).status, 200);
    assert.ok(builds(P)[0].cancel_requested_at, "the Stop did not reach the row its go-ahead's step filed");
    const { rec } = await settle(P, r.key);
    assert.equal(designs(P), 0, "a stopped request's rewrite designed");
    assert.deepEqual(buildRows(P), []);
    assert.deepEqual(statuses(rec), ["cancelled", "cancelled", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[0].jobs.find((j) => j.kind === "rewrite").end.cost, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G. PARTIAL FAILURE: WHAT FINISHED STAYS FINISHED, AND EVERY OTHER PART SAYS WHY
// ─────────────────────────────────────────────────────────────────────────────

test("G1 — a part whose routing fails on our side is asked once more, then ends failed with that reason; nothing is charged for a routing call that failed, and the finished part stays finished", async () => {
  await withPlatform({
    slug: slugOf("g1"), replies: true,
    // THE ROUTER IS DOWN for part 1's routing, twice: no answer to give.
    answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, null, null], ...DESCRIBE, ...GALLERY },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "failed"]);
    assert.equal(rec.parts[1].why, "routing-failed");
    assert.equal(rec.state, "partial");
    const routeJobs = P.jobsOf(r.key).filter((j) => j.op === "route");
    assert.equal(routeJobs.length, 2, "the failed routing was not asked exactly once more");
    for (const j of routeJobs) {
      assert.equal(P.answerOf(j).failed, true);
      assert.deepEqual(reserveOf(P, j.id), [], "a routing call that failed was charged");
    }
    assert.equal(P.look().description, NEW_DESC, "the finished part was undone");
    const facts = toldIn(P, await readWritten(P, REQ(P, r.key)));
    // "NOTHING WAS CHARGED" IS READ FROM ITS JOBS' ROWS, which say so above.
    assert.match(facts, /Not done: “add a gallery page” — working out what it needed failed on our side\. Nothing was charged for it\./);
    assert.match(facts, /Done: “Change the site description/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// H. STOP THE REST — THROUGH THE JOBS' OWN CANCEL
// ─────────────────────────────────────────────────────────────────────────────

test("H1 — Stop before anything ran: the queued step ends cancelled with its money back, nothing else starts, and the site is as it was", async () => {
  await withPlatform({ slug: slugOf("h1"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    const s = await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + r.key);
    assert.equal(s.status, 200);
    assert.equal(s.body.request.stop, true);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["cancelled", "cancelled"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.state, "stopped");
    assert.equal(P.look().description, OLD_DESC);
    assert.equal(P.jobsOf(r.key).length, 1, "a job was filed after the stop");
    // THE STEP'S OWN CANCEL, AS IT HAS ALWAYS BEEN CAUGHT: at the publish gate,
    // the money given back (the job runner then marks the row failed; its
    // answer says why).
    const j = P.jobsOf(r.key)[0];
    assert.equal(P.answerOf(j).detail, "cancelled");
    assert.equal(j.billing, "refunded");
    // ONLY THE ROUTING CALL STAYS CHARGED: whatever the step reserved came back.
    assert.equal(P.spent(), 1);
  });
});

test("H2 — Stop after a part finished: it stays done, and a part's routing job still waiting ends at its gate before any model is asked", async () => {
  await withPlatform({ slug: slugOf("h2"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    // PART 0'S JOB RUNS; PART 1'S ROUTING JOB IS FILED AND WAITS IN THE QUEUE.
    const m0 = P.queue.shift();
    P.queue.unshift(m0);
    await pump(P, { max: 1 });
    assert.equal(P.record(r.key).parts[0].status, "done");
    assert.equal(P.queue.length, 1, "part 1's routing job was not waiting");
    const routed = P.modelLog.filter((m) => m.tool === T.route).length;
    await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + r.key);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "cancelled"]);
    assert.equal(rec.state, "partial");
    assert.equal(P.modelLog.filter((m) => m.tool === T.route).length, routed, "the stopped routing job asked the router");
    const routeJob = P.jobsOf(r.key).find((j) => j.op === "route");
    assert.equal(P.answerOf(routeJob).error, "cancelled");
    assert.deepEqual(reserveOf(P, routeJob.id), []);
    assert.equal(P.look().description, NEW_DESC);
    assert.ok(!P.pages().includes("gallery.tsx"));
  });
});

test("H3 — Stop pressed while a step is publishing comes too late for it: that part is done, and only what had not started is stopped", async () => {
  await withPlatform({ slug: slugOf("h3"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    let stop = null;
    P.after("edit_committed", async () => { stop = await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + r.key); });
    const { rec } = await settle(P, r.key);
    assert.ok(stop && stop.status === 200, "the stop was not pressed mid-publish");
    assert.deepEqual(statuses(rec), ["done", "cancelled"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(P.look().description, NEW_DESC);
    assert.equal(P.jobsOf(r.key).length, 1, "a job was filed after the stop");
  });
});

test("H4 — Stop pressed after a step was chosen but before its filing was confirmed: the job is filed under its own key only to be cancelled at once, and nothing it would have done is done", async () => {
  await withPlatform({ slug: slugOf("h4"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const key = newKey();
    // THE ACCEPTING CALL DIES JUST AFTER THE ROW: the record names part 0's
    // job with no id, and no stored request or message was ever sent for it.
    P.hang("edit_create");
    assert.equal((await sendMessage(P, { message: DESC + ", and " + ADD + ".", key })).hung, "edit_create");
    P.recover();
    assert.equal(P.record(key).parts[0].jobs[0].id, null);
    const s = await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + key);
    assert.equal(s.status, 200);
    const { rec } = await settle(P, key);
    assert.deepEqual(statuses(rec), ["cancelled", "cancelled"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(P.look().description, OLD_DESC, "the step chosen before the stop ran after it");
    const j = P.jobsOf(key);
    assert.equal(j.length, 1, "a second job was filed");
    assert.equal(P.answerOf(j[0]).detail, "cancelled");
    assert.notEqual(j[0].billing, "finalized", "the stopped step was charged");
    assert.equal(P.spent(), 1, "more than the routing call stayed charged");
  });
});

test("H5 — a Stop that lands while another step is being taken is never lost: the step that read the request before it loses the write, reads again, sees the stop and files nothing", async () => {
  await withPlatform({ slug: slugOf("h5"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    const job0 = P.record(r.key).parts[0].jobs[0].id;
    // PART 0'S JOB ENDS, AND ITS STEP READS THE REQUEST AND THE JOB'S ROW; AT
    // THAT VERY MOMENT THE CUSTOMER PRESSES STOP IN ANOTHER TAB.
    let pressed = null;
    P.after("edit_get", async () => { pressed = await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + r.key); }, (a, out) => a.p_id === job0 && out && out.state === "done");
    const { rec } = await settle(P, r.key);
    assert.ok(pressed, "the stop was never pressed mid-step — the case did not happen");
    assert.equal(pressed.status, 200);
    assert.equal(rec.stop, true, "the stop was overwritten by the step that read the request before it");
    assert.deepEqual(statuses(rec), ["done", "cancelled"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(P.jobsOf(r.key).length, 1, "a job was filed after the stop");
    assert.ok(!P.pages().includes("gallery.tsx"), "the part stopped was made anyway");
  });
});

test("H6 — the request's own reply says what each part that did not finish was charged, as its jobs' rows say: a part stopped after its own routing ran says what that cost; the message's routing cost is said once — by part 0's own reply when it has one, else by the request's", async () => {
  // A. STOPPED AFTER PART 1'S ROUTING RAN (charged through its reserve) AND BEFORE ITS STEP DID ANYTHING.
  await withPlatform({ slug: slugOf("h6a"), replies: true, answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    await pump(P, { max: 1 });
    await pump(P, { max: 1 });
    const routeJob = P.jobsOf(r.key).find((j) => j.op === "route");
    assert.ok(routeJob && routeJob.state === "done", "part 1 was not routed before the stop");
    const paid = reserveOf(P, routeJob.id).reduce((a, c) => a + c, 0);
    assert.ok(paid > 0, "part 1's routing was not charged — the case did not happen");
    assert.equal((await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + r.key)).status, 200);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "cancelled"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.ok(!P.pages().includes("gallery.tsx"), "the stopped part was made");
    const facts = toldIn(P, await readWritten(P, REQ(P, r.key)));
    assert.match(facts, new RegExp("Stopped at their request before it changed anything: “add a gallery page”\\. The steps it had already taken were charged " + (paid === 1 ? "one credit" : paid + " credits") + "\\."), facts);
    assert.doesNotMatch(facts, /add a gallery page”\. Nothing was charged/, "a part whose routing was charged was said to cost nothing");
    // PART 0 RAN ON THE ANSWER THAT ACCEPTED THE MESSAGE, and its own reply said that cost.
    assert.doesNotMatch(facts, /Reading their message cost/);
  });
  // B. PART 0 NEVER RAN (the part it needed failed): no part's own reply says
  // what reading the message cost, so the request's reply does.
  await withPlatform({
    slug: slugOf("h6b"), replies: true,
    answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD], dependsOn: [{ change: 0, after: [1] }] }, { intent: "addon" }], ...DESCRIBE, [T.adds]: { kinds: [] } },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["not-run", "failed"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[0].jobs.length, 0);
    const facts = toldIn(P, await readWritten(P, REQ(P, r.key)));
    assert.deepEqual(rows(P, "route"), [-1]);
    assert.match(facts, /Not started: “Change the site description[^”]*”, because it needed “add a gallery page” done first, and that did not finish\. Nothing was charged for it\./, facts);
    assert.match(facts, /Reading their message cost one credit\./, facts);
  });
  // C. STOPPED BEFORE ANYTHING RAN: part 0's step ended at its gate, and its own
  // reply (the job's, through the job poll) says what reading the message cost —
  // so the request's reply does not say it twice.
  await withPlatform({ slug: slugOf("h6c"), replies: true, answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + r.key);
    await settle(P, r.key);
    const job0 = P.record(r.key).parts[0].jobs[0].id;
    assert.match(toldIn(P, await readWritten(P, "/api/site/edit/" + job0)), /Reading their message cost one credit\./, "the stopped step's own reply did not say what reading the message cost");
    const facts = toldIn(P, await readWritten(P, REQ(P, r.key)));
    assert.doesNotMatch(facts, /Reading their message cost/, facts);
    assert.equal((facts.match(/Stopped at their request before it changed anything: [^|]*Nothing was charged for it\./g) || []).length, 2, facts);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// I. DUPLICATE DELIVERY: THE SAME MESSAGE, ANOTHER TAB, A REDELIVERED JOB
// ─────────────────────────────────────────────────────────────────────────────

test("I1 — the same message sent again (a lost response) is answered from what was accepted: no second routing call, no second charge, no second request", async () => {
  await withPlatform({ slug: slugOf("i1"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    const again = await sendMessage(P, { message: DESC + ", and " + ADD + ".", key: r.key });
    assert.equal(again.body.duplicate, true);
    assert.equal(again.body.request.key, r.key);
    assert.equal(P.modelLog.filter((m) => m.tool === T.route).length, 1);
    assert.deepEqual(rows(P, "route"), [-1]);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
    assert.equal(P.jobsOf(r.key).length, 3);
  });
});

test("I2 — two tabs sending the same message at once make one request: one routing charge, one set of jobs, both tabs following the same request", async () => {
  await withPlatform({ slug: slugOf("i2"), answers: { route: (args, n) => (n < 2 ? { intent: "edit", layer: "look", alsoAsked: [ADD] } : { intent: "addon" }), ...DESCRIBE, ...GALLERY } }, async (P) => {
    const key = newKey();
    const msg = DESC + ", and " + ADD + ".";
    const [a, b] = await Promise.all([sendMessage(P, { message: msg, key }), sendMessage(P, { message: msg, key })]);
    assert.equal(a.body.request.key, key);
    assert.equal(b.body.request.key, key);
    assert.equal([a.body.duplicate, b.body.duplicate].filter((x) => x === true).length, 1, "neither or both were told they were the second");
    // BOTH REACHED THE MODEL — ours to absorb — and the ledger took one charge.
    assert.deepEqual(rows(P, "route"), [-1]);
    const { rec } = await settle(P, key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
    assert.deepEqual(jobLine(P, key), ["edit:done", "route:done", "addon:done"]);
  });
});

test("I3 — every job delivered twice runs once: the second delivery finds the claim taken, nothing is charged twice and nothing is published twice", async () => {
  await withPlatform({ slug: slugOf("i3"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    for (let i = 0; i < 8 && !(P.record(r.key) || {}).ended; i++) await pump(P, { twice: true });
    const rec = P.record(r.key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
    for (const j of P.jobsOf(r.key)) assert.deepEqual(reserveOf(P, j.id), [1]);
    assert.equal(P.jobsOf(r.key).length, 3);
    assert.equal(P.rpcLog.filter((c) => c.fn === "edit_committed" && c.out.ok).length, 2, "a step published twice");
  });
});

test("I4 — an answer sent again under a new key finds its question already answered: nothing runs twice", async () => {
  await withPlatform({
    slug: slugOf("i4"),
    answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "clarify", question: Q }, { intent: "addon", answered: true }], ...DESCRIBE, ...GALLERY },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    await settle(P, r.key);
    const q = P.question();
    await sendMessage(P, { message: "Loaves", ask: { id: q.id, chosen: true } });
    const spent = P.spent();
    const second = await sendMessage(P, { message: "Loaves", ask: { id: q.id, chosen: true } });
    assert.equal(second.body.error, "stale-question");
    assert.equal(P.spent(), spent);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
    assert.equal(P.jobsOf(r.key).filter((j) => j.op === "addon").length, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// J. CRASHES AROUND CHARGING AND PUBLICATION
//
// A crash here is an invocation that stops dead after a call LANDED and before
// its caller heard back — no catch, no finally, its heartbeat gone — and the
// platform's own sweeps meet what it left: the lease runs out (90 s) and, past
// the grace (60 s), `edit_sweep_lost` settles the row; the request's sweep then
// moves the request on. The job runner's recovery is the existing one; what
// these show is that the REQUEST comes out right on top of it.
// ─────────────────────────────────────────────────────────────────────────────

const PAST_LEASE = (90 + 60 + 15) * 1000;
// A PUBLISH HOLDS ITS LEASE LONGER (`PUBLISH_LEASE_S`, 300 s) than a step does.
const PAST_PUBLISH = (300 + 60 + 15) * 1000;
const TWO = [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }];

test("J1 — a step that dies just after its charge: the sweep gives the money back, the part is run once more, and in the end it is charged once", async () => {
  await withPlatform({ slug: slugOf("j1"), answers: { route: TWO, ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    P.hang("edit_reserve", (a, out) => !!out && out.ok === true && out.charged > 0);
    assert.equal((await pump(P)).hung, "edit_reserve");
    P.recover();
    P.advance(PAST_LEASE);
    await tick(P);
    await tick(P);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const [first, second] = P.jobsOf(r.key).filter((j) => j.op === "edit");
    assert.equal(first.state, "lost");
    assert.equal(first.billing, "refunded");
    assert.deepEqual(reserveOf(P, first.id), [1]);
    assert.deepEqual(P.ledger.filter((e) => e.ref === first.id && e.reason === "refund").map((e) => e.delta), [1]);
    assert.deepEqual(reserveOf(P, second.id), [1]);
    assert.equal(P.look().description, NEW_DESC);
    assert.equal(P.spent(), 4, "the part was charged more than once in the end");
  });
});

test("J2 — a step that dies just after it published: the sweep keeps it (it is live) without a refund, the part is done, and the next part runs", async () => {
  await withPlatform({ slug: slugOf("j2"), replies: true, answers: { route: TWO, ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    P.hang("edit_committed", (a, out) => !!out && out.ok === true);
    assert.equal((await pump(P)).hung, "edit_committed");
    P.recover();
    P.advance(PAST_PUBLISH);
    await tick(P);
    await tick(P);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[0].why, "unrecorded");
    const job = P.jobsOf(r.key)[0];
    assert.equal(P.answerOf(job).recovered, true);
    assert.equal(job.billing, "finalized");
    assert.deepEqual(reserveOf(P, job.id), [1]);
    assert.deepEqual(P.ledger.filter((e) => e.ref === job.id && e.reason === "refund"), []);
    assert.equal(P.jobsOf(r.key).filter((j) => j.op === "edit").length, 1, "a published step was run again");
    assert.equal(P.look().description, NEW_DESC);
    assert.ok(P.pages().includes("gallery.tsx"));
  });
});

test("J3 — a step that dies mid-publish is held for review: the request waits on it and starts nothing else; once it is settled the request goes on", async () => {
  await withPlatform({ slug: slugOf("j3"), answers: { route: TWO, ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    P.hang("edit_may_publish", (a, out) => !!out && out.granted === true);
    assert.equal((await pump(P)).hung, "edit_may_publish");
    P.recover();
    P.advance(PAST_PUBLISH);
    await tick(P);
    await tick(P);
    const job = P.jobsOf(r.key)[0];
    if (job.needs_review) {
      // THE REVIEW COULD NOT DECIDE ON ITS OWN: the part says so and nothing else runs.
      const held = P.record(r.key);
      assert.equal(held.parts[0].status, "unverified");
      assert.equal(held.state, "review");
      assert.equal(P.jobsOf(r.key).length, 1, "a job was filed while one waited on review");
      // A PERSON SETTLES IT: it never went live, and the money goes back.
      P.reconcile(job.id, false);
      await tick(P);
    }
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const edits = P.jobsOf(r.key).filter((j) => j.op === "edit");
    assert.equal(edits.length, 2, "the part was not run once more after the review gave its money back");
    assert.equal(edits[0].billing, "refunded");
    assert.equal(P.spent(), 4);
  });
});

test("J4 — the routing call dies just after its charge: the same message sent again routes once more but is not charged again, and one request is made", async () => {
  await withPlatform({ slug: slugOf("j4"), answers: { route: (args, n) => (n < 2 ? TWO[0] : TWO[1]), ...DESCRIBE, ...GALLERY } }, async (P) => {
    const key = newKey();
    P.hang("credit_debit");
    const first = await sendMessage(P, { message: DESC + ", and " + ADD + ".", key });
    assert.equal(first.hung, "credit_debit");
    P.recover();
    assert.equal(P.record(key), null, "a request was made by the call that died");
    const again = await sendMessage(P, { message: DESC + ", and " + ADD + ".", key });
    assert.equal(again.body.request.key, key);
    assert.deepEqual(rows(P, "route"), [-1], "the routing call was charged twice");
    const { rec } = await settle(P, key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
    assert.equal(P.spent(), 4);
  });
});

test("J5 — the routing call dies just after the request is written: with no browser, no resend and no look at the request, the two-minute sweep alone finds it and finishes it, charged once", async () => {
  await withPlatform({ slug: slugOf("j5"), answers: { route: TWO, ...DESCRIBE, ...GALLERY } }, async (P) => {
    const key = newKey();
    P.hangPut((k) => k === "requests/" + P.slug + "/" + key + ".json");
    const first = await sendMessage(P, { message: DESC + ", and " + ADD + ".", key });
    assert.match(String(first.hung), /^put:requests\//);
    P.recover();
    assert.ok(P.record(key), "the request was not written before the crash");
    assert.equal(P.jobsOf(key).length, 0, "a job was filed before the crash");
    // THE MARKER WAS WRITTEN BEFORE THE RECORD: the sweep can find it.
    assert.ok(P.objects.has("requests-live/" + P.slug + "/" + key), "the saved request has no marker for the sweep");
    // ONLY THE QUEUE AND THE CRON FROM HERE: no resend, no GET of the request.
    const { rec } = await settle(P, key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(P.look().description, NEW_DESC);
    assert.ok(P.pages().includes("gallery.tsx"));
    assert.deepEqual(rows(P, "route"), [-1]);
    assert.equal(P.modelLog.filter((m) => m.tool === T.route).length, 2, "the message was routed again, or part 1 not routed once");
  });
});

test("J5b — a resend after that crash is answered from the saved acceptance, nothing routed or charged twice", async () => {
  await withPlatform({ slug: slugOf("j5b"), answers: { route: TWO, ...DESCRIBE, ...GALLERY } }, async (P) => {
    const key = newKey();
    P.hangPut((k) => k === "requests/" + P.slug + "/" + key + ".json");
    await sendMessage(P, { message: DESC + ", and " + ADD + ".", key });
    P.recover();
    const again = await sendMessage(P, { message: DESC + ", and " + ADD + ".", key });
    assert.equal(again.body.duplicate, true);
    const { rec } = await settle(P, key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
    assert.deepEqual(rows(P, "route"), [-1]);
  });
});

test("J8 — the marker write fails outright: nothing is saved, nothing is filed, the message is held for sending again, and the routing charge stays one", async () => {
  await withPlatform({ slug: slugOf("j8"), answers: { route: TWO, ...DESCRIBE, ...GALLERY } }, async (P) => {
    const key = newKey();
    P.failPut((k) => k === "requests-live/" + P.slug + "/" + key);
    const first = await sendMessage(P, { message: DESC + ", and " + ADD + ".", key, images: [{ name: "a.png", data: "data:image/png;base64,iVBORw0KGgo=" }] });
    assert.equal(first.body.failed, true, JSON.stringify(first.body));
    assert.equal(P.record(key), null, "a request was saved with no marker");
    assert.equal(P.jobsOf(key).length, 0);
    assert.deepEqual([...P.objects.keys()].filter((k) => k.startsWith("requests/" + P.slug + "/" + key)), [], "the failed acceptance left files behind");
    await tick(P);
    assert.equal(P.jobsOf(key).length, 0, "the sweep started something no acceptance saved");
    assert.deepEqual(rows(P, "route"), [-1]);
  });
});

test("J9 — the marker write lands and the invocation dies before the record: nothing was accepted, and the sweep clears the lone marker once it is old enough", async () => {
  await withPlatform({ slug: slugOf("j9"), answers: { route: TWO, ...DESCRIBE, ...GALLERY } }, async (P) => {
    const key = newKey();
    const marker = "requests-live/" + P.slug + "/" + key;
    P.hangPut((k) => k === marker);
    const first = await sendMessage(P, { message: DESC + ", and " + ADD + ".", key });
    assert.equal(first.hung, "put:" + marker);
    P.recover();
    assert.equal(P.record(key), null);
    assert.ok(P.objects.has(marker));
    // STILL INSIDE THE WINDOW AN ACCEPTANCE MIGHT BE WRITING ITS RECORD: kept.
    await tick(P);
    assert.ok(P.objects.has(marker), "a marker was cleared while its record could still be on its way");
    P.advance(16 * 60 * 1000);
    await tick(P);
    assert.ok(!P.objects.has(marker), "a marker whose record never landed is read on every tick for ever");
    assert.equal(P.jobsOf(key).length, 0);
  });
});

// ── A WRITE WHOSE ANSWER IS LOST IS AN OUTCOME NOT KNOWN (2026-10-03, the
// owner's review: *"Treat a lost write response as an uncertain outcome;
// preserve files while acceptance or another concurrent acceptance may
// reference them, recover using the same request key, and clean up only when
// non-use is established."*). The step that reads the file is the logo step:
// its job's stored request carries the bytes read back from the request's own
// copy, and the site's logo is what it made of them.

const LOGO_ROUTE = { intent: "edit", layer: "logo", alsoAsked: [ADD] };
const filesOf = (P, key) => [...P.objects.keys()].filter((k) => k.startsWith("requests/" + P.slug + "/" + key + "/files/"));
/** The logo step was sent the very bytes the message carried, and made the logo of them. */
function logoGotTheFile(P, key) {
  const logoJob = P.jobsOf(key).find((j) => j.op === "edit" && P.bodyOf(j.id) && P.bodyOf(j.id).body.layer === "logo");
  assert.ok(logoJob, "no logo step ran");
  assert.deepEqual(P.bodyOf(logoJob.id).body.images, [{ data: PNG, name: "logo.png" }], "the logo step was not sent the message's own bytes");
  assert.notEqual((P.look().wordmark || {}).form, "text", "the logo did not reach the site");
}

test("J10 — the record write lands and its answer is lost: nothing is deleted, the acceptance reads the record back under the same key and goes on, and the logo step gets the file's bytes", async () => {
  await withPlatform({ slug: slugOf("j10"), answers: { route: [LOGO_ROUTE, { intent: "addon" }], ...GALLERY } }, async (P) => {
    const key = newKey();
    const record = "requests/" + P.slug + "/" + key + ".json";
    P.losePut((k) => k === record);
    const r = await sendMessage(P, { message: LOGO + ", and " + ADD + ".", key, images: [{ name: "logo.png", data: PNG }] });
    // TAKEN ON, AS IT WAS: the answer names the request the record holds.
    assert.equal(r.status, 200);
    assert.equal(r.body.request && r.body.request.key, key, JSON.stringify(r.body));
    const rec0 = P.record(key);
    assert.equal(rec0.files.length, 1);
    assert.ok(P.objects.has(rec0.files[0].key), "the file the saved request names was deleted");
    assert.deepEqual(filesOf(P, key), [rec0.files[0].key], "a copy no record names was left, or the named one went");
    const { rec } = await settle(P, key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    logoGotTheFile(P, key);
    assert.deepEqual(rows(P, "route"), [-1], "the message was routed and charged twice");
    // LET GO ONLY ONCE THE REQUEST HAS ENDED.
    assert.deepEqual(filesOf(P, key), []);
  });
});

test("J11 — two acceptances of one message at once, the first's record write landing with its answer lost: one request, its copy of the file kept, the other's own copy let go, and the logo step gets the bytes", async () => {
  await withPlatform({ slug: slugOf("j11"), answers: { route: (args, n) => (n < 2 ? LOGO_ROUTE : { intent: "addon" }), ...GALLERY } }, async (P) => {
    const key = newKey();
    const record = "requests/" + P.slug + "/" + key + ".json";
    P.losePut((k) => k === record);
    const msg = LOGO + ", and " + ADD + ".";
    const img = [{ name: "logo.png", data: PNG }];
    const [a, b] = await Promise.all([sendMessage(P, { message: msg, key, images: img }), sendMessage(P, { message: msg, key, images: img })]);
    assert.equal(a.body.request && a.body.request.key, key, JSON.stringify(a.body));
    assert.equal(b.body.request && b.body.request.key, key, JSON.stringify(b.body));
    // BOTH REACHED THE FILE STORE: two copies were written, one is named.
    const rec0 = P.record(key);
    assert.equal(rec0.files.length, 1);
    assert.ok(P.objects.has(rec0.files[0].key), "the file the saved request names was deleted");
    assert.deepEqual(filesOf(P, key), [rec0.files[0].key], "the losing acceptance's own copy was left behind, or the named one went");
    assert.deepEqual(rows(P, "route"), [-1]);
    const { rec } = await settle(P, key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    logoGotTheFile(P, key);
  });
});

test("J12 — the record write lands, its answer is lost and reading it back fails too: the acceptance keeps everything and says it could not, nobody sends again, and the sweep finishes the request with the file's bytes", async () => {
  await withPlatform({ slug: slugOf("j12"), answers: { route: [LOGO_ROUTE, { intent: "addon" }], ...GALLERY } }, async (P) => {
    const key = newKey();
    const record = "requests/" + P.slug + "/" + key + ".json";
    P.losePut((k) => k === record, () => P.failGet((k) => k === record));
    const first = await sendMessage(P, { message: LOGO + ", and " + ADD + ".", key, images: [{ name: "logo.png", data: PNG }] });
    // NOT KNOWN, SO NOT CLAIMED EITHER WAY: the page would hold the message.
    assert.equal(first.body.failed, true, JSON.stringify(first.body));
    const rec0 = P.record(key);
    assert.ok(rec0, "the record did not land");
    assert.ok(P.objects.has(rec0.files[0].key), "the file the saved request names was deleted");
    assert.equal(P.jobsOf(key).length, 0);
    // THE BROWSER IS CLOSED: no resend, no look. The two-minute sweep alone.
    await tick(P);
    const { rec } = await settle(P, key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    logoGotTheFile(P, key);
    assert.deepEqual(rows(P, "route"), [-1]);
  });
});

test("J13 — the record write fails outright: reading back finds nothing under the key, so it is written again under the same key, and the request goes on with its file", async () => {
  await withPlatform({ slug: slugOf("j13"), answers: { route: [LOGO_ROUTE, { intent: "addon" }], ...GALLERY } }, async (P) => {
    const key = newKey();
    const record = "requests/" + P.slug + "/" + key + ".json";
    P.failPut((k) => k === record);
    const r = await sendMessage(P, { message: LOGO + ", and " + ADD + ".", key, images: [{ name: "logo.png", data: PNG }] });
    assert.equal(r.body.request && r.body.request.key, key, JSON.stringify(r.body));
    assert.equal(r.body.duplicate, undefined, "our own retried acceptance was called a duplicate");
    const rec0 = P.record(key);
    assert.deepEqual(filesOf(P, key), [rec0.files[0].key]);
    const { rec } = await settle(P, key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
    logoGotTheFile(P, key);
    assert.deepEqual(rows(P, "route"), [-1]);
  });
});

test("J14 — copies are let go only once no record can name them: an acceptance whose record never lands keeps its copy while one still might; the sweep clears it after; and a day after a request ends, whatever an acceptance that lost left goes too", async () => {
  await withPlatform({ slug: slugOf("j14"), answers: { route: (args, n) => (n < 2 ? LOGO_ROUTE : { intent: "addon" }), ...GALLERY } }, async (P) => {
    const key = newKey();
    const record = "requests/" + P.slug + "/" + key + ".json";
    for (let i = 0; i < 4; i++) P.failPut((k) => k === record);
    const msg = LOGO + ", and " + ADD + ".";
    const img = [{ name: "logo.png", data: PNG }];
    const first = await sendMessage(P, { message: msg, key, images: img });
    assert.equal(first.body.failed, true, JSON.stringify(first.body));
    assert.equal(P.record(key), null);
    const kept = filesOf(P, key);
    assert.equal(kept.length, 1, "a copy was let go while a record might still have named it");
    // INSIDE THE WINDOW AN ACCEPTANCE MIGHT STILL BE WRITING: kept.
    await tick(P);
    assert.deepEqual(filesOf(P, key), kept);
    // PAST IT, AND NO RECORD: the marker and the copy go.
    P.advance(16 * 60 * 1000);
    await tick(P);
    assert.deepEqual(filesOf(P, key), [], "a copy no record can name outlived the window");
    assert.ok(!P.objects.has("requests-live/" + P.slug + "/" + key));
    // SENT AGAIN UNDER THE SAME KEY: taken on, with its own copy, and it runs.
    const again = await sendMessage(P, { message: msg, key, images: img });
    assert.equal(again.body.request && again.body.request.key, key, JSON.stringify(again.body));
    const { rec } = await settle(P, key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
    logoGotTheFile(P, key);
    // A COPY NO RECORD NAMES, left by an acceptance that never knew it lost,
    // goes with the marker a day after the request ended — not before.
    const stray = "requests/" + P.slug + "/" + key + "/files/" + "abc-0123456789ab/stray.png";
    P.objects.set(stray, { body: "x", etag: "s", at: P.now() });
    await tick(P);
    assert.ok(P.objects.has(stray), "a copy went before the request's marker did");
    P.advance(25 * 60 * 60 * 1000);
    await tick(P);
    assert.deepEqual(filesOf(P, key), []);
  });
});

test("J15 — while the sweep clears a marker whose record never landed, a copy newer than the window — an acceptance of the same message still writing — is kept, and a record that lands as the marker goes gets its marker back and runs", async () => {
  await withPlatform({ slug: slugOf("j15"), answers: { route: (args, n) => (n < 2 ? LOGO_ROUTE : { intent: "addon" }), ...GALLERY } }, async (P) => {
    const key = newKey();
    const record = "requests/" + P.slug + "/" + key + ".json";
    const marker = "requests-live/" + P.slug + "/" + key;
    for (let i = 0; i < 4; i++) P.failPut((k) => k === record);
    const msg = LOGO + ", and " + ADD + ".";
    const img = [{ name: "logo.png", data: PNG }];
    assert.equal((await sendMessage(P, { message: msg, key, images: img })).body.failed, true);
    const old = filesOf(P, key);
    assert.equal(old.length, 1);
    P.advance(16 * 60 * 1000);
    // AN ACCEPTANCE STILL WRITING: its copy, under an id from now.
    const { attemptId } = await import("../builder/request.mjs");
    const fresh = "requests/" + P.slug + "/" + key + "/files/" + attemptId(P.now(), "0123456789ab") + "/" + "f".repeat(64) + ".png";
    P.objects.set(fresh, { body: "x", etag: "w", at: P.now() });
    // AND ONE THAT LANDS ITS RECORD JUST AS THE SWEEP TAKES THE MARKER AWAY.
    P.beforeDelete((k) => k === marker, async () => {
      const r = await sendMessage(P, { message: msg, key, images: img });
      assert.equal(r.body.request && r.body.request.key, key, JSON.stringify(r.body));
    });
    await tick(P);
    assert.ok(P.record(key), "the acceptance during the sweep did not land");
    assert.ok(P.objects.has(marker), "a record was left with no marker");
    assert.ok(!P.objects.has(old[0]), "the copy older than the window was kept");
    assert.ok(P.objects.has(fresh), "a copy newer than the window was let go");
    const { rec } = await settle(P, key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    logoGotTheFile(P, key);
  });
});

test("J16 — copies whose store failed part-way are let go at once, since no record was written to name them, and the message is held for sending again", async () => {
  await withPlatform({ slug: slugOf("j16"), answers: { route: (args, n) => (n < 2 ? LOGO_ROUTE : { intent: "addon" }), ...GALLERY } }, async (P) => {
    const key = newKey();
    let n = 0;
    P.failPut((k) => k.includes("/" + key + "/files/") && ++n === 2);
    const msg = LOGO + ", and " + ADD + ".";
    const first = await sendMessage(P, { message: msg, key, images: [{ name: "logo.png", data: PNG }, { name: "two.png", data: "data:image/png;base64,AAECAw==" }] });
    assert.equal(first.body.failed, true, JSON.stringify(first.body));
    assert.equal(P.record(key), null);
    assert.deepEqual(filesOf(P, key), [], "a copy no record will ever name was kept");
    const again = await sendMessage(P, { message: msg, key, images: [{ name: "logo.png", data: PNG }] });
    assert.equal(again.body.request && again.body.request.key, key, JSON.stringify(again.body));
    const { rec } = await settle(P, key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
    logoGotTheFile(P, key);
  });
});

test("J6 — a job filed whose stored request failed to write is repaired on the next step under the same key: one job, run once", async () => {
  await withPlatform({ slug: slugOf("j6"), answers: { route: TWO, ...DESCRIBE, ...GALLERY } }, async (P) => {
    P.failPut((k) => k.startsWith("jobs/edit/"));
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    assert.equal(r.status, 200);
    assert.equal(P.jobsOf(r.key).length, 1);
    assert.equal(P.queue.length, 0, "a message was sent for a job with no stored request");
    await tick(P);
    assert.equal(P.queue.length, 1, "the next step did not repair the job");
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
    assert.equal(P.jobsOf(r.key).filter((j) => j.op === "edit").length, 1);
  });
});

test("J7 — the routing call dies just after filing the first job's row: the same message sent again files it under the same key — one row — and it runs", async () => {
  await withPlatform({ slug: slugOf("j7"), answers: { route: TWO, ...DESCRIBE, ...GALLERY } }, async (P) => {
    const key = newKey();
    P.hang("edit_create");
    const first = await sendMessage(P, { message: DESC + ", and " + ADD + ".", key });
    assert.equal(first.hung, "edit_create");
    P.recover();
    assert.equal(P.jobsOf(key).length, 1, "the row was not created before the crash");
    await sendMessage(P, { message: DESC + ", and " + ADD + ".", key });
    const { rec } = await settle(P, key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(P.jobsOf(key).filter((j) => j.op === "edit").length, 1, "the first job was filed twice");
    assert.equal(P.spent(), 4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// M. AN ADDITION SET ASIDE BESIDE OTHERS GOES ON AS A PART OF ITS OWN
// ─────────────────────────────────────────────────────────────────────────────
//
// The owner's review: the add-on step sets a menu link (`frame`) or a list
// entry (`row`) aside when other kinds come with it, and named it only by its
// kind, so a request marked the part done and ran what depended on the
// missing link. The picker now names each kind's own words; a kind set aside
// with its words is left for later (`deferred`) and becomes a part of the
// request; without them it is a part of this one not done.

const NAV = (items) => "<SiteHeader links={[" + items.map(([l, h]) => "{ label: \"" + l + "\", href: \"" + h + "\" }").join(", ") + "]} />";
const MENU = [["Home", "/"], ["Visit", "/visit"]];
const NAV_PAGES = [
  { path: "index.tsx", source: pageSrc("/", NAV(MENU) + "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", NAV(MENU) + "<section className=\"come\"><h1>Come to the bakery</h1><p>The shutters and the street.</p></section>") },
];
/** Every menu on every stored page, as `label href` lines. */
const menus = (P) => navSlots(P.pages().map((path) => ({ path, source: P.page(path) }))).map((m) => m.page + ": " + m.items.map((i) => i.label + " " + i.href).join(" | "));
const LINK = "put a link to it in the menu";
const GALLERY_WITH_LINK = "Add a gallery page and " + LINK + ".";
const NAV_WITH = (extra) => ({ links: [...MENU, ...extra].map(([label, href]) => ({ label, href })) });
// A NEW PAGE LINKED FROM ONE PAGE'S BAND, not the menu (2026-10-04): its link in
// the menu is then the set-aside part's to make, by name (`add`).
const GALLERY_ON_HOME = { ...PAGE("/gallery", "Gallery"), link: { in: "page", page: "/", where: "a button in the hero band" } };
const ADD_GALLERY = { add: [{ to: "menu", label: "Gallery", href: "/gallery" }] };

test("M1 — a page and a menu link from one message: the link the add-on step sets aside goes on as its own part, in the customer's words, and is made by the menu step", async () => {
  await withPlatform({
    slug: slugOf("m1"), pages: NAV_PAGES,
    answers: {
      route: [{ intent: "addon" }, { intent: "edit", layer: "nav" }],
      [T.adds]: { kinds: ["page", "frame"], scopes: [{ kind: "page", words: "Add a gallery page" }, { kind: "frame", words: LINK }] },
      "add:page": { page: [GALLERY_ON_HOME] }, [T.pages]: { pages: [writtenPage("/gallery")] },
      write_nav: ADD_GALLERY,
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: GALLERY_WITH_LINK });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.words, p.status, p.why])));
    // THE LINK IS A PART IN THE CUSTOMER'S OWN WORDS, carved from the addition, routed by the router.
    assert.equal(rec.parts[1].words, LINK);
    assert.equal(rec.parts[1].parent, 0);
    assert.equal(rec.parts[1].route.layer, "nav");
    assert.deepEqual(jobLine(P, r.key), ["addon:done", "route:done", "edit:done"]);
    // THE ADDITION'S ANSWER CARRIED IT ON, and no longer says to ask for it alone.
    const addon = P.answerOf(P.jobsOf(r.key)[0]);
    assert.deepEqual([].concat(addon.deferred), [LINK]);
    assert.deepEqual(addon.setAside, [{ kind: "frame", words: LINK }]);
    assert.ok(!(addon.skipped || []).includes("frame"), "the link was still said as set aside");
    // THE SITE: the page, and the link on every page's menu.
    assert.ok(P.pages().includes("gallery.tsx"));
    for (const m of menus(P)) assert.match(m, /Gallery \/gallery/, m);
  });
});

test("M2 — additions and a list entry from one message: the entry set aside beside the page goes on as its own part and is written as a row", async () => {
  const ENTRY_WORDS = "add Rye & Caraway at £5.00 to the loaves";
  const SPEC = { tables: [{ name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" }] };
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify(SPEC) } });
  await withPlatform({
    slug: slugOf("m2"), db,
    answers: {
      route: [{ intent: "addon" }, { intent: "addon" }],
      [T.adds]: [
        { kinds: ["page", "row"], scopes: [{ kind: "page", words: "Add a gallery page" }, { kind: "row", words: ENTRY_WORDS }] },
        { kinds: ["row"], scopes: [{ kind: "row", words: ENTRY_WORDS }] },
      ],
      "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] },
      "add:row": { row: [{ table: "loaves", values: { name: "Rye & Caraway", price: 5, description: "A light rye with toasted caraway." } }] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Add a gallery page and " + ENTRY_WORDS + "." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.words, p.status, p.why])));
    assert.equal(rec.parts[1].words, ENTRY_WORDS);
    const first = P.answerOf(P.jobsOf(r.key)[0]);
    assert.ok(!(first.notAdded || []).some((n) => n.why === "row-alone"), "the entry was still refused as needing a message of its own");
    assert.deepEqual([].concat(first.deferred), [ENTRY_WORDS]);
    // THE SITE: the page, and the one new row (its id the database's own).
    assert.ok(P.pages().includes("gallery.tsx"));
    const loaves = db.rows("loaves");
    assert.equal(loaves.length, BAKERY_LOAVES.length + 1);
    assert.deepEqual(loaves.filter((l) => l.name === "Rye & Caraway").map((l) => [l.id, l.price]), [[12, 5]]);
  });
});

test("M3 — work that needs the set-aside link waits for it: the link's own part runs first, then the dependent part, against the menu the link made", async () => {
  const RENAME = "make the menu's Gallery link say Our photos";
  await withPlatform({
    slug: slugOf("m3"), pages: NAV_PAGES,
    answers: {
      route: [
        { intent: "addon", alsoAsked: [RENAME], dependsOn: [{ change: 1, after: [0] }] },
        { intent: "edit", layer: "nav" },
        { intent: "edit", layer: "nav" },
      ],
      [T.adds]: { kinds: ["page", "frame"], scopes: [{ kind: "page", words: "Add a gallery page" }, { kind: "frame", words: LINK }] },
      "add:page": { page: [GALLERY_ON_HOME] }, [T.pages]: { pages: [writtenPage("/gallery")] },
      write_nav: (args, n) => [ADD_GALLERY, NAV_WITH([["Our photos", "/gallery"]])][n],
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: GALLERY_WITH_LINK.replace(/\.$/, "") + ", then " + RENAME + "." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done", "done"], JSON.stringify(rec.parts.map((p) => [p.words, p.status, p.why])));
    const link = rec.parts.find((p) => p.words === LINK);
    const rename = rec.parts.find((p) => p.words === RENAME);
    assert.ok(link && rename);
    // THE ORDER: the addition, the link carved from it, and only then the rename that needed both.
    const order = P.jobsOf(r.key).map((j) => j.idem_key.replace(r.key + "-", "") + ":" + j.op);
    assert.deepEqual(order.map((o) => o.split("-")[0]), ["p0", "p" + link.n, "p" + link.n, "p" + rename.n, "p" + rename.n], order.join(" "));
    for (const m of menus(P)) assert.match(m, /Our photos \/gallery/, m);
  });
});

test("M4 — with no words for the set-aside link, the addition is done only in part: what needs it is not run, the request says so, and nothing is charged for what never ran", async () => {
  const RENAME = "make the menu's Gallery link say Our photos";
  await withPlatform({
    slug: slugOf("m4"), pages: NAV_PAGES, replies: true,
    answers: {
      route: [{ intent: "addon", alsoAsked: [RENAME], dependsOn: [{ change: 1, after: [0] }] }],
      // THE PICKER NAMED THE KINDS AND NO WORDS: the link cannot be carried.
      [T.adds]: { kinds: ["page", "frame"] },
      "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: GALLERY_WITH_LINK.replace(/\.$/, "") + ", then " + RENAME + "." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["partial", "not-run"], JSON.stringify(rec.parts.map((p) => [p.words, p.status, p.why])));
    assert.equal(rec.parts[1].why, "needs:0");
    assert.deepEqual(rec.parts[0].notDone, [{ what: "frame", why: "set-aside" }]);
    assert.equal(rec.state, "partial");
    // THE PAGE STANDS, IN EVERY MENU BY ITS OWN DESIGN (its placement is the
    // menu, the default, and the builder puts it there: 2026-10-04); THE
    // RENAME THAT NEEDED THE SET-ASIDE PART NEVER RAN; ONLY ONE JOB EVER RAN.
    assert.ok(P.pages().includes("gallery.tsx"));
    for (const m of menus(P)) { assert.match(m, /Gallery \/gallery/, m); assert.doesNotMatch(m, /Our photos/, m); }
    assert.deepEqual(jobLine(P, r.key), ["addon:done"]);
    const facts = toldIn(P, await readWritten(P, REQ(P, r.key)));
    assert.match(facts, /Done only in part: “Add a gallery page and put a link to it in the menu[^”]*” — its own reply above says what was made and what was not\./, facts);
    assert.match(facts, /Not started: “make the menu's Gallery link say Our photos”, because it needed “[^”]+” done first, and that was only partly done\. Nothing was charged for it\./, facts);
  });
});

test("M5 — run 95's R1 shape: the new page's own placement puts its link in every menu, so the link's own part finds it already done — nothing published, its step not charged, its routing charge kept — and the part that needed it runs", async () => {
  const RENAME = "make the menu's Gallery link say Our photos";
  await withPlatform({
    slug: slugOf("m5"), pages: NAV_PAGES, replies: true,
    answers: {
      route: [
        { intent: "addon", alsoAsked: [RENAME], dependsOn: [{ change: 1, after: [0] }] },
        { intent: "edit", layer: "nav" },
        { intent: "edit", layer: "nav" },
      ],
      [T.adds]: { kinds: ["page", "frame"], scopes: [{ kind: "page", words: "Add a gallery page" }, { kind: "frame", words: LINK }] },
      // THE PAGE'S PLACEMENT IS THE MENU (the default): the builder puts its link in every menu.
      "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] },
      // THE LINK'S OWN PART NAMES THE LINK (`add`); THE RENAME WRITES THE MENU IT MAKES.
      write_nav: (args, n) => [ADD_GALLERY, NAV_WITH([["Our photos", "/gallery"]])][n],
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: GALLERY_WITH_LINK.replace(/\.$/, "") + ", then " + RENAME + "." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done", "done"], JSON.stringify(rec.parts.map((p) => [p.words, p.status, p.why])));
    assert.equal(rec.state, "done");
    const link = rec.parts.find((p) => p.words === LINK);
    const rename = rec.parts.find((p) => p.words === RENAME);
    assert.ok(link && rename);
    // THE LINK'S PART: its step found it done, published nothing, and took no reserve.
    const linkJobs = P.jobsOf(r.key).filter((j) => j.idem_key.startsWith(r.key + "-p" + link.n));
    const linkEdit = linkJobs.find((j) => j.op === "edit");
    const linkRoute = linkJobs.find((j) => j.op === "route");
    assert.ok(linkEdit && linkRoute, linkJobs.map((j) => j.op).join(","));
    const said = P.answerOf(linkEdit);
    assert.deepEqual([said.ok, said.satisfied, said.changed, said.cost], [true, true, [], 0], JSON.stringify(said));
    assert.deepEqual([linkEdit.state, linkEdit.publish_started_at || null, linkEdit.published_at || null], ["done", null, null], "the part already done was published");
    assert.deepEqual(reserveOf(P, linkEdit.id), [], "the step that changed nothing was charged");
    assert.ok(reserveOf(P, linkRoute.id).reduce((a, c) => a + c, 0) > 0, "the link part's routing was not charged — the case did not happen");
    // THE PART THAT NEEDED IT RAN AFTER IT, against the menu the page's placement made.
    const order = P.jobsOf(r.key).map((j) => j.idem_key.replace(r.key + "-", "").split("-")[0]);
    assert.ok(order.lastIndexOf("p" + link.n) < order.indexOf("p" + rename.n), order.join(" "));
    for (const m of menus(P)) { assert.match(m, /Our photos \/gallery$/, m); assert.equal((m.match(/\/gallery/g) || []).length, 1, m); }
    // ITS OWN REPLY SAYS NOTHING NEEDED CHANGING — written from what the step
    // really did, as a fact of the kind "nothing changed" (x), never "done"
    // (c): the step's own sentence is quoted inside it, so its words alone
    // would read the same either way.
    const linkRead = await readWritten(P, "/api/site/edit/" + linkEdit.id);
    const told = toldIn(P, linkRead);
    assert.match(told, /Nothing needed changing/, told);
    const kinds = P.factsOf(linkRead.body.reply).map((f) => f.id.replace(/\d+$/, ""));
    assert.ok(kinds.includes("x") && !kinds.includes("c"), "the part already done was told as a change: " + JSON.stringify(kinds));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// K. WHAT A PART'S OWN REPLY TELLS THE CUSTOMER ABOUT THE OTHER PARTS
// ─────────────────────────────────────────────────────────────────────────────

test("K1 — a part's own reply says the other parts are done next by the same request, never that the customer should send them again", async () => {
  await withPlatform({ slug: slugOf("k1"), replies: true, answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    await settle(P, r.key);
    const job = P.jobsOf(r.key)[0];
    const polled = await readWritten(P, "/api/site/edit/" + job.id);
    assert.equal(polled.body.replySource, "model");
    const facts = toldIn(P, polled);
    assert.match(facts, /its own part of the same request, done separately after this one without them sending it again: “add a gallery page”/);
    assert.doesNotMatch(facts, /they can send it next/);
    // THE CONTROL: the same held part on a message sent the old way (no request) keeps its sentence.
    const { editReplyFacts } = await import("../builder/site-reply.mjs");
    const old = editReplyFacts({ ok: true, layer: "look", deferred: ADD }, {}).facts.map((f) => f.text).join(" | ");
    assert.match(old, /they can send it next/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// L. THE SWITCH, AND THE PATHS IT LEAVES AS THEY WERE
// ─────────────────────────────────────────────────────────────────────────────

test("L1 — with the switch off, or edits not queued for this owner, a message with its key is answered as before: no request, nothing filed, the page drives its steps", async () => {
  for (const off of [{ REQUEST_FLOW: "off" }, { REQUEST_FLOW: undefined }, { EDIT_ASYNC: "off" }]) {
    await withPlatform({ slug: slugOf("l1"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }], ...DESCRIBE } }, async (P) => {
      Object.assign(P.env, off);
      const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
      assert.equal(r.status, 200);
      assert.equal(r.body.intent, "edit");
      assert.equal(Object.hasOwn(r.body, "request"), false, JSON.stringify(off) + ": a request was made");
      assert.equal(P.record(r.key), null);
      assert.equal(P.jobs.size, 0, "a job was filed for a message the page drives");
      // AND IT IS CHARGED AS IT ALWAYS WAS, not under the message's key.
      assert.equal(P.ledger.some((e) => e.reason === "route"), false);
    });
  }
});

test("L2 — a first build, and a question about the site, are never taken on as requests", async () => {
  await withPlatform({ slug: slugOf("l2"), answers: { route: [{ intent: "ask", answer: "We open at eight." }, { intent: "build" }] } }, async (P) => {
    const r = await sendMessage(P, { message: "When do you open?" });
    assert.equal(r.body.intent, "ask");
    assert.equal(Object.hasOwn(r.body, "request"), false);
    assert.equal(P.record(r.key), null);
    // A FIRST BUILD, KEY AND ALL: the build path, untouched.
    const key = newKey();
    const b = await call(P, "POST", "/api/site/route", { message: "A bakery in Bristol", site: { name: "", pages: [], tables: [] }, picker: "sonnet", firstBuild: true, brief: "A bakery in Bristol", qa: [], answering: false, attached: false, slug: "", hasSite: false, idem: key });
    assert.equal(b.status, 200);
    assert.equal(Object.hasOwn(b.body, "request"), false);
    assert.equal(P.record(key), null);
    assert.equal(P.jobs.size, 0);
  });
  const { requestFlowOn } = await import("../builder/request.mjs");
  assert.equal(requestFlowOn({ REQUEST_FLOW: "on" }), true);
  assert.equal(requestFlowOn({ REQUEST_FLOW: " YES " }), true);
  for (const v of [undefined, "", "off", "0", true, 1, ["on"]]) assert.equal(requestFlowOn({ REQUEST_FLOW: v }), false, String(v));
});
