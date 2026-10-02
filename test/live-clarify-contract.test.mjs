// QUESTIONS BACK ON A SITE THAT EXISTS — THE CONTRACT (2026-10-02).
//
// Owner: *"Implement model-driven clarification for existing-site edit and
// add-on requests only; preserve current first-build behavior. … intent and
// questions must come from the model without customer-keyword or site-specific
// hardcoding."*
//
// This file holds the pieces below the routes: the stored question
// (`builder/clarify.mjs`) — one live question per site, closed once —, the
// router's reading of a live site's answer (`builder/site-ask.mjs`), the
// question field every step's tool carries and every step's own return when
// its model asks, the first build's routing pinned byte for byte to the commit
// before this change, and the hand-over pieces that carry a resumed request's
// facts (`builder/hand-over.mjs`, `public/edit-poll.js`). The routes are driven
// in `live-clarify-route.test.mjs`, the browser in `live-clarify-browser.test.mjs`.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import {
  QUESTION_FIELD, ASK_TTL_MS, QUESTION_KEY, MAX_ASK_ROUNDS, askOf, answeredRequest, newAskId,
  packAsk, readAskRecord, askLive, loadAsk, storeAsk, closeAsk, withQuestion,
} from "../builder/clarify.mjs";
import { allowedJobKey } from "../builder/job-gateway.mjs";
import { routeMessage, readRouting, readAsk, askRequest, ASK_TOOL, LIVE_ASK_TOOL, MAX_MESSAGE } from "../builder/site-ask.mjs";
import { pickTool as lanePickTool, pickLanes, editTool, LANE_FIELDS } from "../builder/site-lanes.mjs";
import { TEXT_TOOL, DATA_TOOL, runTextEdit, runDataEdit } from "../builder/site-apply.mjs";
import { RULES_TOOL, runRulesEdit } from "../builder/site-rules.mjs";
import { PICTURE_TOOL, runPictureEdit } from "../builder/site-picture.mjs";
import { NAV_TOOL, runNavEdit } from "../builder/site-nav.mjs";
import { TWEAK_TOOL, runTweak } from "../builder/site-tweak.mjs";
import { pickTool as addPickTool, pickAdds } from "../builder/site-add.mjs";
import { heldReport } from "../builder/hand-over.mjs";

const require = createRequire(import.meta.url);
const EditPoll = require("../public/edit-poll.js");

const UID = "33333333-3333-3333-3333-333333333333";
const OTHER = "44444444-4444-4444-4444-444444444444";
const SLUG = "fold-lane-bakery";
const Q = { text: "Which heading do you mean — the one on Home or on Visit?", options: ["Home", "Visit"] };
const json = (v) => JSON.parse(JSON.stringify(v));

/** An R2 bucket as the binding behaves: etags, and a conditional put that answers null when it does not hold. */
function bucket() {
  const store = new Map();
  let n = 0;
  const writes = [];
  return {
    store, writes,
    async get(key) {
      const o = store.get(key);
      return o ? { etag: o.etag, text: async () => o.body } : null;
    },
    async put(key, body, opts = {}) {
      const cur = store.get(key);
      if (opts.onlyIf && opts.onlyIf.etagMatches != null && (!cur || cur.etag !== String(opts.onlyIf.etagMatches))) {
        writes.push({ key, refused: true });
        return null;
      }
      const etag = "e" + (++n);
      store.set(key, { body: String(body), etag });
      writes.push({ key, body: String(body) });
      return { etag };
    },
  };
}
const rec = (over = {}) => packAsk({
  id: newAskId(), uid: UID, slug: SLUG, stage: "route", round: 1, question: Q,
  request: "Change the heading", held: [], at: Date.now(), ...over,
});

// ── THE STORED QUESTION ─────────────────────────────────────────────────────

test("A STORED QUESTION IS EVERY FIELD CHECKED, and one field wrong makes it no question at all", () => {
  const good = rec();
  assert.ok(good, "a well-formed question was refused");
  assert.equal(good.status, "pending");
  assert.equal(good.attached, false);
  assert.deepEqual(readAskRecord(JSON.stringify(good)), good, "a stored question does not read back as it was written");
  for (const [field, bad] of [
    ["id", "nope"], ["id", 7], ["uid", ""], ["slug", "Not A Slug"], ["stage", "build"], ["stage", 3],
    ["round", 0], ["round", MAX_ASK_ROUNDS + 1], ["round", 1.5], ["question", { text: "" }], ["question", "Which?"],
    ["request", ""], ["request", "x".repeat(MAX_MESSAGE + 1)], ["held", [3]], ["held", "x".repeat(5000)],
    ["at", "now"], ["status", "open"], ["attached", "yes"], ["attached", 1],
  ]) {
    assert.equal(rec({ [field]: bad }), null, field + " = " + JSON.stringify(bad) + " was accepted");
  }
  assert.equal(readAskRecord("{not json"), null);
  assert.equal(readAskRecord(JSON.stringify({ ...good, v: 2 })), null, "a record of another version was read");
  // EVERY STEP THAT CAN ASK, AND THE ROUTER, IS A STAGE; nothing else is.
  for (const stage of ["route", "data", "text", "look", "page", "rules", "picture", "logo", "nav", "rename", "addon"]) {
    assert.ok(rec({ stage }), stage + " is not a stage a question can come from");
  }
});

test("A QUESTION IS LIVE FOR ITS OWN OWNER, ON ITS OWN SITE, WHILE PENDING, FOR A DAY", () => {
  const r = rec();
  assert.deepEqual(askLive(r, { id: r.id, uid: UID, slug: SLUG }), { ok: true });
  assert.deepEqual(askLive(null, { id: r.id, uid: UID, slug: SLUG }), { ok: false, why: "missing" });
  assert.deepEqual(askLive(r, { id: newAskId(), uid: UID, slug: SLUG }), { ok: false, why: "other" });
  assert.deepEqual(askLive(r, { id: r.id, uid: OTHER, slug: SLUG }), { ok: false, why: "other" }, "another owner can answer it");
  assert.deepEqual(askLive(r, { id: r.id, uid: UID, slug: "fretwork-1" }), { ok: false, why: "other" }, "another site can answer it");
  for (const status of ["answered", "cancelled", "superseded"]) {
    assert.deepEqual(askLive({ ...r, status }, { id: r.id, uid: UID, slug: SLUG }), { ok: false, why: "closed" }, status);
  }
  assert.deepEqual(askLive(r, { id: r.id, uid: UID, slug: SLUG, now: r.at + ASK_TTL_MS - 1 }), { ok: true });
  assert.deepEqual(askLive(r, { id: r.id, uid: UID, slug: SLUG, now: r.at + ASK_TTL_MS }), { ok: false, why: "expired" });
});

test("A QUESTION CLOSES ONCE: of two answers to it only one wins, and the loser is told it raced", async () => {
  const b = bucket();
  const r = rec();
  await storeAsk(b, r);
  assert.equal(b.writes[0].key, QUESTION_KEY(SLUG));
  // WHERE A JOB MAY WRITE IT: a step's question can be asked inside a queued
  // job, and the gateway's wall (`allowedJobKey`) refuses every key outside
  // the site's own prefixes — another site's included.
  assert.equal(allowedJobKey(SLUG, "job-1234", QUESTION_KEY(SLUG)), true, "a job could not keep a question it asked");
  assert.equal(allowedJobKey("fretwork-1", "job-1234", QUESTION_KEY(SLUG)), false, "another site's job could write this site's question");
  // Two closers read the same etag; the first write moves it, the second's put is refused.
  const realGet = b.get.bind(b);
  let reads = 0;
  const gate = [];
  b.get = async (k) => { const o = await realGet(k); reads++; if (reads <= 2) await new Promise((res) => gate.push(res)); return o; };
  const one = closeAsk(b, { slug: SLUG, id: r.id, uid: UID, status: "answered" });
  const two = closeAsk(b, { slug: SLUG, id: r.id, uid: UID, status: "answered" });
  while (gate.length < 2) await new Promise((res) => setImmediate(res));
  gate.forEach((g) => g());
  const outs = await Promise.all([one, two]);
  assert.equal(outs.filter((o) => o.ok).length, 1, "both answers acted: " + JSON.stringify(outs));
  assert.deepEqual(outs.find((o) => !o.ok), { ok: false, why: "raced" });
  b.get = realGet;
  const after = (await loadAsk(b, SLUG)).record;
  assert.equal(after.status, "answered");
  // And once closed, every later close is refused as closed — an answer, a cancel or a replacement alike.
  for (const status of ["answered", "cancelled", "superseded"]) {
    assert.deepEqual(await closeAsk(b, { slug: SLUG, id: r.id, uid: UID, status }), { ok: false, why: "closed" }, status);
  }
  await assert.rejects(closeAsk(b, { slug: SLUG, id: r.id, uid: UID, status: "pending" }), /not a closing status/);
});

test("A DAMAGED RECORD IS NO QUESTION ANYBODY CAN ANSWER", async () => {
  const b = bucket();
  await b.put(QUESTION_KEY(SLUG), "{\"v\":1,\"id\":\"x\"}");
  const st = await loadAsk(b, SLUG);
  assert.equal(st.record, null);
  assert.deepEqual(await closeAsk(b, { slug: SLUG, id: "a".repeat(32), uid: UID, status: "cancelled" }), { ok: false, why: "missing" });
});

test("THE REQUEST AN ANSWER RESUMES is what was waiting, then the question and the answer in the customer's words — or nothing, past one message", () => {
  assert.equal(answeredRequest("Change the heading", Q.text, "Visit"),
    "Change the heading\n\nThey were asked: " + Q.text + "\nThey answered: Visit");
  assert.equal(answeredRequest("", Q.text, "Visit"), null);
  assert.equal(answeredRequest("x", "", "Visit"), null);
  assert.equal(answeredRequest("x", Q.text, "  "), null);
  const long = "y".repeat(MAX_MESSAGE - 50);
  assert.equal(answeredRequest(long, Q.text, "Visit"), null, "an answer that would be cut off was resumed whole");
  assert.ok(answeredRequest("y".repeat(MAX_MESSAGE - 200), "Q?", "A").length <= MAX_MESSAGE);
});

test("A QUESTION THE SCREEN CAN SHOW: words, and none or up to four answers — a lone answer is no choice, so it is dropped", () => {
  assert.deepEqual(readAsk({ text: "Which one?" }), { text: "Which one?", options: [] });
  assert.deepEqual(readAsk({ text: "Which one?", options: ["A", "B"] }), { text: "Which one?", options: ["A", "B"] });
  assert.deepEqual(readAsk({ text: "Which one?", options: ["Only"] }), { text: "Which one?", options: [] });
  assert.equal(readAsk({ text: "" }), null);
  assert.equal(readAsk("Which?"), null);
  assert.equal(readAsk(null), null);
  const many = readAsk({ text: "Which?", options: ["A", "B", "C", "D", "E"] });
  assert.ok(many && many.options.length <= 4, "more than four answers reach the screen");
});

// ── THE FIRST BUILD, UNCHANGED ──────────────────────────────────────────────
//
// MEASURED AT THE BASE COMMIT, a8ed6b73, and at this change, with the same
// script: the request the router is sent and what it reads each answer as, for
// every way a project with no site yet reaches the router — a first build, its
// answers, an attachment, a spent budget, a record with no site, and a first
// build flagged as having one. Every pair was identical. Pinned here so a later
// change to the live path that reaches a first build fails by name.
const FIRST_BUILD = {
  "first build | build": "aba5f6bcd5f8c929 875974b02cc063f2",
  "first build | clarify": "aba5f6bcd5f8c929 fa014374291facb7",
  "first build | clarifyBad": "aba5f6bcd5f8c929 7c9d619b5fd0f627",
  "first build | ask": "aba5f6bcd5f8c929 ec78522e2e36025a",
  "first build | edit": "aba5f6bcd5f8c929 0c80f6990c5f97f6",
  "first build | addon": "aba5f6bcd5f8c929 fdea739e65345892",
  "first build | junk": "aba5f6bcd5f8c929 4c7fd34810bd49f2",
  "first build, answering | build": "7df10f8219a1fbd3 875974b02cc063f2",
  "first build, answering | clarify": "7df10f8219a1fbd3 fa014374291facb7",
  "first build, answering | clarifyBad": "7df10f8219a1fbd3 7c9d619b5fd0f627",
  "first build, answering | ask": "7df10f8219a1fbd3 b7033089ed1c2c1d",
  "first build, answering | edit": "7df10f8219a1fbd3 0c80f6990c5f97f6",
  "first build, answering | addon": "7df10f8219a1fbd3 fdea739e65345892",
  "first build, answering | junk": "7df10f8219a1fbd3 4c7fd34810bd49f2",
  "first build, attached | build": "fec2278a7df5844e 875974b02cc063f2",
  "first build, attached | clarify": "fec2278a7df5844e fa014374291facb7",
  "first build, attached | clarifyBad": "fec2278a7df5844e 7c9d619b5fd0f627",
  "first build, attached | ask": "fec2278a7df5844e 9833f6b5aaba66d5",
  "first build, attached | edit": "fec2278a7df5844e 0c80f6990c5f97f6",
  "first build, attached | addon": "fec2278a7df5844e fdea739e65345892",
  "first build, attached | junk": "fec2278a7df5844e 4c7fd34810bd49f2",
  "first build, budget spent | build": "4dca5647ef6af7b2 875974b02cc063f2",
  "first build, budget spent | clarify": "4dca5647ef6af7b2 f42a4d323c559e7e",
  "first build, budget spent | clarifyBad": "4dca5647ef6af7b2 f42a4d323c559e7e",
  "first build, budget spent | ask": "4dca5647ef6af7b2 b7033089ed1c2c1d",
  "first build, budget spent | edit": "4dca5647ef6af7b2 0c80f6990c5f97f6",
  "first build, budget spent | addon": "4dca5647ef6af7b2 fdea739e65345892",
  "first build, budget spent | junk": "4dca5647ef6af7b2 4c7fd34810bd49f2",
  "no site, not first | build": "e3592231040b918a 875974b02cc063f2",
  "no site, not first | clarify": "e3592231040b918a f42a4d323c559e7e",
  "no site, not first | clarifyBad": "e3592231040b918a f42a4d323c559e7e",
  "no site, not first | ask": "e3592231040b918a ec78522e2e36025a",
  "no site, not first | edit": "e3592231040b918a 0c80f6990c5f97f6",
  "no site, not first | addon": "e3592231040b918a fdea739e65345892",
  "no site, not first | junk": "e3592231040b918a 4c7fd34810bd49f2",
  "first build with hasSite | build": "36d80a07eec9d56a 875974b02cc063f2",
  "first build with hasSite | clarify": "36d80a07eec9d56a fa014374291facb7",
  "first build with hasSite | clarifyBad": "36d80a07eec9d56a 023fd0f1d16fa6a7",
  "first build with hasSite | ask": "36d80a07eec9d56a ec78522e2e36025a",
  "first build with hasSite | edit": "36d80a07eec9d56a e0554fbabf9529e2",
  "first build with hasSite | addon": "36d80a07eec9d56a 046b4d324d467648",
  "first build with hasSite | junk": "36d80a07eec9d56a 46a5bf52463d745e",
};
const SITE0 = { name: "", url: "", pages: [], tables: [] };
const FB_CASES = [
  { name: "first build", in: { message: "A bakery in Leeds", site: SITE0, firstBuild: true, brief: "A bakery in Leeds", qa: [] } },
  { name: "first build, answering", in: { message: "Order online", site: SITE0, firstBuild: true, brief: "A bakery in Leeds", qa: [{ q: "What should visitors do?", a: "Order online" }], answering: true } },
  { name: "first build, attached", in: { message: "Use this logo", site: SITE0, firstBuild: true, brief: "Use this logo", qa: [], attached: true } },
  { name: "first build, budget spent", in: { message: "x", site: SITE0, firstBuild: true, brief: "b", qa: [{ q: "a", a: "b" }, { q: "c", a: "d" }, { q: "e", a: "f" }], answering: true } },
  { name: "no site, not first", in: { message: "Make it blue", site: SITE0, firstBuild: false, brief: "Make it blue", qa: [] } },
  { name: "first build with hasSite", in: { message: "A cafe", site: { name: "Cafe", url: "https://cafe.gofarther.app", pages: ["/"], tables: [] }, firstBuild: true, hasSite: true, brief: "A cafe", qa: [] } },
];
const FB_REPLIES = {
  build: { intent: "build" },
  clarify: { intent: "clarify", question: { text: "What should visitors do?", options: ["Book", "Order"] } },
  clarifyBad: { intent: "clarify", question: { text: "", options: [] } },
  ask: { intent: "ask", answer: "Yes, I can." },
  edit: { intent: "edit", layer: "look" },
  addon: { intent: "addon" },
  junk: { intent: "nonsense" },
};
const h16 = (v) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);

test("THE FIRST BUILD IS UNCHANGED, BYTE FOR BYTE: the router's request and its reading of every answer match the commit before this change", async () => {
  let n = 0;
  for (const c of FB_CASES) {
    for (const [rn, input] of Object.entries(FB_REPLIES)) {
      let sent = null;
      const send = async (req) => { sent = req; return { stop_reason: "tool_use", content: [{ type: "tool_use", name: ASK_TOOL.name, input }], usage: { input_tokens: 10, output_tokens: 5 } }; };
      const r = await routeMessage({ send }, { ...c.in, model: "test-model" });
      const key = c.name + " | " + rn;
      assert.equal(h16(sent) + " " + h16(r), FIRST_BUILD[key], key + ": the first build's routing changed");
      assert.equal(sent.tools[0], ASK_TOOL, key + ": a project with no site was sent the live tool");
      n++;
    }
  }
  assert.equal(n, Object.keys(FIRST_BUILD).length, "the pin and the cases drifted apart");
});

// ── THE ROUTER ON A SITE THAT EXISTS ────────────────────────────────────────

const LIVE_SITE = { name: "Fold Lane", url: "https://fold-lane-bakery.gofarther.app", pages: ["/", "/visit"], tables: ["loaves"] };
const said = (input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: LIVE_ASK_TOOL.name, input }], usage: { input_tokens: 10, output_tokens: 5 } });
async function liveRoute(input, opts = {}) {
  let sent = null;
  const r = await routeMessage({ send: async (req) => { sent = req; return said(input); } },
    { message: "Change the heading", site: LIVE_SITE, hasSite: true, firstBuild: false, model: "test-model", ...opts });
  return { r, sent };
}

test("A LIVE SITE'S ROUTER IS OFFERED A QUESTION, TOLD ITS BUDGET, AND TOLD WHEN IT IS SPENT — in the model's terms, never a word list", async () => {
  const fresh = await liveRoute({ intent: "edit", layer: "text" });
  assert.equal(fresh.sent.tools[0], LIVE_ASK_TOOL, "a live site was not sent the live tool");
  const props = LIVE_ASK_TOOL.input_schema.properties;
  assert.ok(props.question && props.answered, "the live tool has no question or no answered field");
  assert.deepEqual(props.question.required, ["text"], "a question must carry answers to be asked");
  const told = String(fresh.sent.messages[0].content);
  assert.match(told, /A QUESTION MAY BE ASKED/);
  assert.match(told, /You may ask 2 more questions about this request/);
  assert.doesNotMatch(told, /THEIR LAST REQUEST IS WAITING/, "a fresh message was told a request is waiting");
  const one = await liveRoute({ intent: "edit", layer: "text" }, { askRound: 1 });
  assert.match(String(one.sent.messages[0].content), /You may ask 1 more question about this request/);
  const spent = await liveRoute({ intent: "edit", layer: "text" }, { askRound: 2 });
  assert.match(String(spent.sent.messages[0].content), /Questions are closed for this message — never answer "clarify"/);
});

test("THE ROUTER ASKS: a readable question is the answer; an unreadable one is a technical failure that charges nothing; past the budget it is said as words", async () => {
  const asks = await liveRoute({ intent: "clarify", question: Q });
  assert.equal(asks.r.intent, "clarify");
  assert.deepEqual(json(asks.r.question), Q);
  assert.ok(asks.r.usage, "the routing call that asked was not billed like any other");
  assert.notEqual(asks.r.failed, true);
  for (const question of [{ text: "" }, { options: ["A", "B"] }, "Which?", null, undefined]) {
    const bad = await liveRoute({ intent: "clarify", question });
    assert.equal(bad.r.failed, true, JSON.stringify(question) + ": an unusable question was acted on");
    assert.equal(bad.r.usage, null, JSON.stringify(question) + ": an unusable question was charged");
    assert.equal(bad.r.failure && bad.r.failure.kind, "answer");
  }
  const spent = await liveRoute({ intent: "clarify", question: Q }, { askRound: MAX_ASK_ROUNDS });
  assert.equal(spent.r.intent, "ask", "a question past the budget was kept as a question");
  assert.equal(spent.r.answer, Q.text);
});

test("A MESSAGE BESIDE A WAITING QUESTION: the router says whether it answers it — a pressed answer always does — and a reply that says neither is a technical failure", async () => {
  const pending = { request: "Change the heading", question: Q, chosen: false };
  const yes = await liveRoute({ intent: "edit", layer: "text", answered: true }, { askRound: 1, pending });
  assert.equal(yes.r.answered, true);
  const told = String(yes.sent.messages[0].content);
  assert.match(told, /THEIR LAST REQUEST IS WAITING ON AN ANSWER/);
  assert.ok(told.includes("Change the heading") && told.includes(Q.text) && told.includes("Visit"), "the router was not shown the waiting request, its question and its answers");
  const no = await liveRoute({ intent: "addon", answered: false }, { askRound: 1, pending });
  assert.equal(no.r.answered, false, "a changed request was read as an answer");
  const chosen = await liveRoute({ intent: "edit", layer: "text", answered: false }, { askRound: 1, pending: { ...pending, chosen: true } });
  assert.equal(chosen.r.answered, true, "a pressed answer was read as a changed request");
  assert.match(String(chosen.sent.messages[0].content), /They picked one of those answers/);
  for (const answered of [undefined, "yes", 1, null]) {
    const unread = await liveRoute({ intent: "edit", layer: "text", ...(answered === undefined ? {} : { answered }) }, { askRound: 1, pending });
    assert.equal(unread.r.failed, true, JSON.stringify(answered) + ": an answer the router did not settle was acted on");
    assert.equal(unread.r.usage, null, JSON.stringify(answered) + ": it was charged");
  }
});

test("A CLEAR REQUEST GOES STRAIGHT THROUGH, with nothing about questions on its answer", async () => {
  const r = (await liveRoute({ intent: "edit", layer: "text" })).r;
  assert.equal(r.intent, "edit");
  assert.equal(r.layer, "text");
  assert.equal(r.answered, undefined);
  assert.equal(r.question, undefined);
  assert.notEqual(r.failed, true);
});

test("A LIVE SITE'S QUESTION IS NEVER TURNED INTO ADD-ON WORK — the first build's clarify-closed answer is the live tool's question", async () => {
  // Before this change a live site's clarify was closed and read as an add-on
  // (`clarify-closed` → addon): the question became paid work. Now it is asked.
  const r = (await liveRoute({ intent: "clarify", question: { text: "Which footer?" } })).r;
  assert.equal(r.intent, "clarify");
  assert.notEqual(r.intent, "addon");
  const reasons = r.decision ? r.decision.reasons : [];
  assert.ok(!reasons.includes("clarify-closed"), "a live question was closed into an add-on");
});

// ── EVERY STEP CAN ASK, AND A STEP THAT ASKS CHANGES NOTHING ────────────────

test("THE QUESTION FIELD IS ONE FIELD, ON EVERY STEP'S TOOL: the look picker and its door, text, data, rules, picture, menu, the page writer and the add-on picker", () => {
  const tools = {
    look: lanePickTool(), door: lanePickTool(LANE_FIELDS, { routed: true }), text: TEXT_TOOL, data: DATA_TOOL,
    rules: RULES_TOOL, picture: PICTURE_TOOL, nav: NAV_TOOL, page: TWEAK_TOOL, addon: addPickTool(),
  };
  for (const [name, tool] of Object.entries(tools)) {
    const q = tool.input_schema.properties.question;
    assert.equal(q, QUESTION_FIELD, name + ": the step does not carry the one question field");
    assert.ok(!(tool.input_schema.required || []).includes("question"), name + ": the question is required, so every answer asks");
  }
  // A LANE'S OWN CALL DOES NOT ASK (it acts on one field it was picked for).
  for (const f of LANE_FIELDS.slice(0, 3)) assert.equal(editTool(f).input_schema.properties.question, undefined, f);
  assert.throws(() => withQuestion(TEXT_TOOL), /already has a question field/, "a second question field could replace the first");
  // DESCRIBED BY PURPOSE, never by a customer's words or a site's names.
  const d = QUESTION_FIELD.description;
  assert.match(d, /ONLY WHEN YOU CANNOT DO THIS WITHOUT ONE DETAIL THEY LEFT OUT/);
  assert.match(d, /nothing is changed until they reply/);
  assert.doesNotMatch(d, /bakery|gallery|footer|heading|menu|photo/i, "the question field names a site's own things");
});

const asked = (name, extra = {}) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name, input: { ...extra, question: Q } }], usage: { input_tokens: 100, output_tokens: 20 } });
const HOME = { path: "src/routes/index.tsx", source: "export default function Home() {\n  return (\n    <main>\n      <h1>Fold Lane Bakery</h1>\n      <p>Open Wednesday to Saturday</p>\n      <img src=\"/u/s/c.jpg\" alt=\"The shopfront\" />\n    </main>\n  );\n}" };
const CHROME_HOME = { path: "index.tsx", source: "import { SiteChrome } from \"@/components/ui/site-chrome\";\nconst CHROME = { name: \"Harbour Loaf\", links: [{ label: \"Home\", href: \"/\" }, { label: \"Visit\", href: \"/visit\" }] };\nexport default function P() { return <SiteChrome {...CHROME}><p>Bread.</p></SiteChrome>; }" };
const LOAVES = [{ name: "loaves", columns: [{ name: "id" }, { name: "name" }, { name: "price" }], rows: [{ id: 1, name: "Rye", price: 4 }, { id: 2, name: "Spelt", price: 5 }] }];
const RULE_TABLES = [{ name: "bookings", access: "collect", columns: [{ name: "customer", type: "text" }, { name: "start_min", type: "integer" }] }];

test("EACH STEP'S MODEL ASKS INSTEAD OF GUESSING: the step answers its question, writes nothing, and keeps its usage for the record", async () => {
  const cases = [
    ["text", () => runTextEdit({ send: async () => asked(TEXT_TOOL.name, { edits: [{ id: 0, text: "x" }] }) }, { instruction: "Change the heading", pages: [HOME] })],
    ["data", () => runDataEdit({ send: async () => asked(DATA_TOOL.name, { changes: [{ table: "loaves", id: 1, set: { price: 9 } }] }), apply: async () => { throw new Error("a row was written"); } }, { instruction: "Change the price", tables: LOAVES })],
    ["rules", () => runRulesEdit({ send: async () => asked(RULES_TOOL.name, { tables: [] }), apply: async () => { throw new Error("a rule was applied"); } }, { instruction: "Close it", tables: RULE_TABLES })],
    ["picture", () => runPictureEdit({ send: async () => asked(PICTURE_TOOL.name, { pictures: [{ page: "src/routes/index.tsx", alt: "The shopfront", remove: true }] }) }, { instruction: "Take the photo off", pages: [HOME] })],
    ["nav", () => runNavEdit({ send: async () => asked(NAV_TOOL.name, { links: [] }) }, { instruction: "Change the menu", pages: [CHROME_HOME], routes: ["/", "/visit"] })],
    ["page", () => runTweak({ instruction: "Move the band", path: "index.tsx", source: HOME.source, send: async () => asked(TWEAK_TOOL.name, { source: "export default function X() { return null; }" }), inPart: false })],
  ];
  for (const [name, run] of cases) {
    const out = await run();
    assert.equal(out.ok, false, name + ": a step that asked reported success");
    assert.equal(out.reason, "ask", name + ": the question is not the step's answer");
    assert.deepEqual(json(out.ask), Q, name + ": the question did not come back as the model wrote it");
    assert.ok(out.usage, name + ": the call that asked was not accounted");
    assert.notEqual(out.escalate, true, name + ": a question climbed the ladder");
    for (const k of ["pages", "files", "applied", "source", "changes"]) assert.equal(out[k], undefined, name + ": a step that asked carried a change (" + k + ")");
  }
});

test("THE LOOK PICKER AND THE ADD-ON PICKER ASK BEFORE ANYTHING IS PICKED TO RUN", async () => {
  const lane = await pickLanes({ send: async () => asked("pick_lanes", { fields: ["copy"] }) }, { message: "Make it nicer" });
  assert.deepEqual(json(lane.ask), Q);
  assert.equal(lane.failed, false);
  const door = await pickLanes({ send: async () => asked("pick_lanes", { routed: ["images"], additional: [] }) },
    { message: "Take the photo off", routed: { layer: "picture", remove: true } });
  assert.deepEqual(json(door.ask), Q, "the door's picker cannot ask");
  const add = await pickAdds({ send: async () => asked("pick_adds", { page: { path: "/x" } }) }, { message: "Add a page" });
  assert.deepEqual(json(add.ask), Q);
  // AND A PICKER THAT DOES NOT ASK HAS NO QUESTION.
  const plain = await pickLanes({ send: async () => ({ content: [{ type: "tool_use", name: "pick_lanes", input: { fields: ["copy"] } }] }) }, { message: "Make it nicer" });
  assert.equal(plain.ask, undefined);
  assert.equal(askOf({ content: [{ type: "tool_use", input: { question: { text: "" } } }] }), null, "an empty question was read as one");
});

// ── WHAT A RESUMED REQUEST CARRIES ─────────────────────────────────────────

test("EVERY ENDING NAMES WHAT A QUESTION'S REQUEST PUT OFF BEFORE IT, apart from what this turn put off — and adds nothing to a reply that says it", async () => {
  const res = () => Response.json({ ok: true, layer: "text" });
  const both = await (await heldReport(res(), ["make the footer blue"], ["add a gallery"])).json();
  assert.equal(both.deferred, "make the footer blue");
  assert.equal(both.putOff, "add a gallery");
  const earlierOnly = await (await heldReport(res(), [], ["add a gallery", "change the hours"])).json();
  assert.equal(earlierOnly.deferred, undefined);
  assert.deepEqual(earlierOnly.putOff, ["add a gallery", "change the hours"]);
  const said = Response.json({ ok: true, deferred: "x", putOff: "y" });
  assert.equal(await heldReport(said, ["x"], ["y"]), said, "a reply that already says both was copied");
  const none = res();
  assert.equal(await heldReport(none, [], []), none);
});

test("A HAND-OVER CARRIES A RESUMED REQUEST'S TWO FACTS, AND A JOB RECORD KEEPS THEM FOR A REFRESH", () => {
  const d = { layer: "text", alsoAsked: "make it blue", putOff: ["add a gallery"], askRound: 1 };
  const hop = EditPoll.handOver(d, { layer: "nav" }, { from: "text", reply: { reason: "addon" } });
  assert.deepEqual(hop.putOff, "add a gallery");
  assert.equal(hop.askRound, 1);
  // The step's own reply wins when it names the earlier parts, as with `deferred`.
  const said = EditPoll.handOver(d, { layer: "nav" }, { from: "text", reply: { putOff: ["add a gallery", "x"] } });
  assert.deepEqual(said.putOff, ["add a gallery", "x"]);
  for (const askRound of [0, -1, 1.5, "1", 10, null]) {
    assert.equal(EditPoll.handOver({ ...d, askRound }, { layer: "nav" }, {}).askRound, undefined, JSON.stringify(askRound) + " was carried as a count");
  }
  const store = { data: {}, getItem(k) { return this.data[k] || null; }, setItem(k, v) { this.data[k] = v; } };
  EditPoll.rememberJob(SLUG, "job-1", store, { ask: "Change the heading", op: "edit", putOff: ["add a gallery"], askRound: 2 });
  const back = EditPoll.resumableRecord(SLUG, Date.now(), store);
  assert.deepEqual(back.putOff, ["add a gallery"]);
  assert.equal(back.askRound, 2);
  EditPoll.rememberJob(SLUG, "job-2", store, { ask: "x", op: "edit", putOff: "one part", askRound: "2" });
  const again = EditPoll.resumableRecord(SLUG, Date.now(), store);
  assert.equal(again.putOff, "one part");
  assert.equal(again.askRound, undefined, "a count spelled as text was stored");
});
