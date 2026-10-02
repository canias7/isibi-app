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
  QUESTION_FIELD, ASK_TTL_MS, QUESTION_KEY, MAX_ASKED, ASK_ANSWER_ROOM, askOf, answeredRequest, newAskId,
  packAsk, readAskRecord, askLive, loadAsk, storeAsk, closeAsk, replaceAsk, withQuestion, askRepeat, askRoom, askedList,
  answerLines, askedIn,
} from "../builder/clarify.mjs";
import { allowedJobKey } from "../builder/job-gateway.mjs";
import { routeMessage, readRouting, readAsk, askRequest, ASK_TOOL, LIVE_ASK_TOOL, MAX_MESSAGE } from "../builder/site-ask.mjs";
import { pickTool as lanePickTool, pickLanes, editTool, LANE_FIELDS, OWN_LANES, takeOffTool, runLane, runTakeOff } from "../builder/site-lanes.mjs";
import { TEXT_TOOL, DATA_TOOL, runTextEdit, runDataEdit } from "../builder/site-apply.mjs";
import { RULES_TOOL, runRulesEdit } from "../builder/site-rules.mjs";
import { PICTURE_TOOL, runPictureEdit } from "../builder/site-picture.mjs";
import { NAV_TOOL, runNavEdit } from "../builder/site-nav.mjs";
import { TWEAK_TOOL, runTweak } from "../builder/site-tweak.mjs";
import { pickTool as addPickTool, pickAdds, addTool, runAdd } from "../builder/site-add.mjs";
import { SITE_PAGES_TOOL, SITE_PAGES_TOOL_ASK, pagesRequest, generateSitePages } from "../builder/page-gen.mjs";
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
    ["round", 0], ["round", 1.5], ["round", "3"], ["question", { text: "" }], ["question", "Which?"],
    ["request", ""], ["request", "x".repeat(MAX_MESSAGE + 1)], ["held", [3]], ["held", "x".repeat(5000)],
    ["at", "now"], ["status", "open"], ["attached", "yes"], ["attached", 1],
    // EVERY QUESTION THE REQUEST HAS ASKED, THIS ONE LAST (2026-10-02): a list
    // that is anything else makes no question at all, never a shorter list.
    ["asked", []], ["asked", ["Which one?"]], ["asked", [Q.text, "Which one?"]], ["asked", [3, Q.text]],
    ["asked", ["", Q.text]], ["asked", ["x".repeat(241), Q.text]], ["asked", Q.text],
    ["asked", [...Array.from({ length: MAX_ASKED }, (_, i) => "Q" + i + "?"), Q.text]],
  ]) {
    assert.equal(rec({ [field]: bad }), null, field + " = " + JSON.stringify(bad) + " was accepted");
  }
  // NO COUNT OF QUESTIONS: a request's tenth question is a question like its first.
  assert.equal(rec({ round: 10, asked: [...Array.from({ length: 9 }, (_, i) => "Q" + i + "?"), Q.text] }).round, 10);
  assert.deepEqual(good.asked, [Q.text], "a question with no earlier ones does not name itself as asked");
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
// `canAsk` IS THE ROUTE'S WORD THAT A QUESTION CAN BE KEPT (2026-10-02): a
// site that exists, with an address and a store. Every case here has one
// unless it says otherwise.
async function liveRoute(input, opts = {}) {
  let sent = null;
  const r = await routeMessage({ send: async (req) => { sent = req; return said(input); } },
    { message: "Change the heading", site: LIVE_SITE, hasSite: true, firstBuild: false, model: "test-model", canAsk: true, ...opts });
  return { r, sent };
}

test("A LIVE SITE'S ROUTER IS OFFERED A QUESTION WHEREVER ONE CAN BE KEPT — with no count of them — and is told what this request has already asked", async () => {
  const fresh = await liveRoute({ intent: "edit", layer: "text" });
  assert.equal(fresh.sent.tools[0], LIVE_ASK_TOOL, "a live site was not sent the live tool");
  const props = LIVE_ASK_TOOL.input_schema.properties;
  assert.ok(props.question && props.answered, "the live tool has no question or no answered field");
  assert.deepEqual(props.question.required, ["text"], "a question must carry answers to be asked");
  const told = String(fresh.sent.messages[0].content);
  assert.match(told, /A QUESTION MAY BE ASKED/);
  assert.doesNotMatch(told, /more questions? about this request/, "the router was told a count, so a later question could be words nobody can answer");
  assert.doesNotMatch(told, /THEIR LAST REQUEST IS WAITING/, "a fresh message was told a request is waiting");
  assert.doesNotMatch(told, /ALREADY ASKED/, "a fresh request was told it had asked something");
  // A REQUEST THAT HAS ASKED: every question named, never to be asked again.
  const asked = ["Which heading?", "On which page?", "Bigger by how much?"];
  const later = await liveRoute({ intent: "edit", layer: "text" }, { asked, pending: { request: "Change the heading", question: { text: asked[2], options: [] } } });
  const laterTold = String(later.sent.messages[0].content);
  assert.match(laterTold, /A QUESTION MAY BE ASKED/, "a third question was closed off");
  assert.match(laterTold, /WHAT THIS REQUEST HAS ALREADY ASKED THEM — never ask any of these again/);
  for (const q of asked) assert.ok(laterTold.includes("- " + q), "the router was not told it asked: " + q);
  // WHERE NONE CAN BE KEPT, NONE MAY BE ASKED.
  const closed = await liveRoute({ intent: "edit", layer: "text" }, { canAsk: false });
  assert.match(String(closed.sent.messages[0].content), /Questions are closed for this message — never answer "clarify"/);
});

test("THE ROUTER ASKS: a readable question is the answer; an unreadable one, or one where none can be kept, is a technical failure that charges nothing — never words nobody can answer", async () => {
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
  const nowhere = await liveRoute({ intent: "clarify", question: Q }, { canAsk: false });
  assert.equal(nowhere.r.failed, true, "a question nothing can keep was used: " + JSON.stringify(nowhere.r));
  assert.equal(nowhere.r.usage, null, "a question nothing can keep was charged");
  assert.notEqual(nowhere.r.intent, "ask", "a question nothing can keep was said as words");
  assert.ok(nowhere.r.decision.reasons.includes("clarify-unkeepable"));
});

test("A MESSAGE BESIDE A WAITING QUESTION: the router says whether it answers it — a pressed answer always does — and a reply that says neither is a technical failure", async () => {
  const pending = { request: "Change the heading", question: Q, chosen: false };
  const yes = await liveRoute({ intent: "edit", layer: "text", answered: true }, { pending });
  assert.equal(yes.r.answered, true);
  const told = String(yes.sent.messages[0].content);
  assert.match(told, /THEIR LAST REQUEST IS WAITING ON AN ANSWER/);
  assert.ok(told.includes("Change the heading") && told.includes(Q.text) && told.includes("Visit"), "the router was not shown the waiting request, its question and its answers");
  const no = await liveRoute({ intent: "addon", answered: false }, { pending });
  assert.equal(no.r.answered, false, "a changed request was read as an answer");
  const chosen = await liveRoute({ intent: "edit", layer: "text", answered: false }, { pending: { ...pending, chosen: true } });
  assert.equal(chosen.r.answered, true, "a pressed answer was read as a changed request");
  assert.match(String(chosen.sent.messages[0].content), /They picked one of those answers/);
  for (const answered of [undefined, "yes", 1, null]) {
    const unread = await liveRoute({ intent: "edit", layer: "text", ...(answered === undefined ? {} : { answered }) }, { pending });
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

test("THE QUESTION FIELD IS ONE FIELD, ON EVERY STEP'S TOOL: the pickers, text, data, rules, picture, menu, the quick and the full page writer, every lane, the removal picker and every add-on designer", () => {
  const tools = {
    look: lanePickTool(), door: lanePickTool(LANE_FIELDS, { routed: true }), text: TEXT_TOOL, data: DATA_TOOL,
    rules: RULES_TOOL, picture: PICTURE_TOOL, nav: NAV_TOOL, page: TWEAK_TOOL, addon: addPickTool(),
    // AND THE MODELS THAT COULD NOT ASK (2026-10-02, the owner's review: *"the
    // edit models and add-on designers that currently cannot ask when missing
    // details become apparent after picking the path"*).
    "full page writer (one-page edit)": SITE_PAGES_TOOL_ASK, "removal picker": takeOffTool("qr"),
  };
  for (const f of OWN_LANES) tools["lane " + f] = editTool(f);
  for (const k of ["page", "table", "component", "qr"]) tools["designer " + k] = addTool(k);
  for (const [name, tool] of Object.entries(tools)) {
    const q = tool.input_schema.properties.question;
    assert.equal(q, QUESTION_FIELD, name + ": the step does not carry the one question field");
    assert.ok(!(tool.input_schema.required || []).includes("question"), name + ": the question is required, so every answer asks");
  }
  // ONLY WHERE SOMEBODY CAN BE ASKED: the correction round re-aims selectors the
  // change already made, and the first build's page writer is the first build's.
  assert.equal(editTool("css", { ask: false }).input_schema.properties.question, undefined, "the correction round can ask");
  assert.equal(SITE_PAGES_TOOL.input_schema.properties.question, undefined, "the first build's page writer gained a question");
  assert.throws(() => withQuestion(TEXT_TOOL), /already has a question field/, "a second question field could replace the first");
  // DESCRIBED BY PURPOSE, never by a customer's words or a site's names.
  const d = QUESTION_FIELD.description;
  assert.match(d, /ONLY WHEN YOU CANNOT DO THIS WITHOUT ONE DETAIL THEY LEFT OUT/);
  assert.match(d, /nothing is changed until they reply/);
  assert.match(d, /never\s+what they were already asked/, "a step is not told never to ask again what was answered");
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
  for (const askRound of [0, -1, 1.5, "1", 65, null]) {
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

// ─────────────────────────────────────────────────────────────────────────────
// FINISHING THE FEATURE (2026-10-02, the owner's review): no question its
// answer cannot resume, a repeat never asked, an answered question replaced in
// one write, every model that decides a change able to ask, and the prompts
// that told a model to guess beside a field that tells it to ask reconciled.
// ─────────────────────────────────────────────────────────────────────────────

test("A QUESTION ALREADY ASKED IS RECOGNISED HOWEVER IT IS SPELLED — case, accents, spacing and punctuation set aside — and a different question is not", () => {
  const asked = ["Which band — the one on Home, or on Visit?"];
  for (const again of ["which band the one on home or on visit", "WHICH BAND — THE ONE ON HOME, OR ON VISIT ?", "Which  band, the one on Home or on Visit"]) {
    assert.equal(askRepeat(asked, { text: again }), true, again + " was not read as the same question");
  }
  assert.equal(askRepeat(["Café hours?"], { text: "cafe hours" }), true, "an accent made a repeat a new question");
  for (const other of ["Which band should move?", "Which page — Home or Visit?", "Which band — the one on Home, or on Order?"]) {
    assert.equal(askRepeat(asked, { text: other }), false, other + " was read as the question already asked");
  }
  // AN UNREADABLE LIST PROTECTS AGAINST NOTHING, AND REFUSES NOTHING.
  for (const bad of [null, undefined, "Which band?", [3], [""], Array.from({ length: MAX_ASKED + 1 }, () => "q")]) {
    assert.deepEqual(askedList(bad), [], JSON.stringify(bad));
    assert.equal(askRepeat(bad, { text: "Which band?" }), false, JSON.stringify(bad));
  }
  assert.equal(askRepeat(asked, { text: "" }), false, "an empty question was a repeat");
});

test("THE ANSWERS A RESUMED REQUEST CARRIES are read from the line that asked its first question to the end, exactly as `answeredRequest` composed them; the questions a request still answers are those it holds the lines for", () => {
  const q1 = "Which band — the one on Home, or on Visit?";
  const q2 = "Above which heading?";
  const once = answeredRequest("Move the order band up", q1, "Visit");
  const twice = answeredRequest(once, q2, "Come to the bakery");
  assert.equal(answerLines(once, [q1]), "They were asked: " + q1 + "\nThey answered: Visit");
  assert.equal(answerLines(twice, [q1, q2]), "They were asked: " + q1 + "\nThey answered: Visit\n\nThey were asked: " + q2 + "\nThey answered: Come to the bakery");
  // A FRESH REQUEST CARRIES NONE; NOR ONE WHOSE LINES ARE NOT THERE; NOR AN UNREADABLE LIST.
  assert.equal(answerLines("Move the order band up", []), "");
  assert.equal(answerLines("Move the order band up", [q1]), "");
  assert.equal(answerLines("They were asked: " + q1 + "\nThey answered: Visit", [q1]), "", "lines at the very start are the customer's own words, never our appended answers");
  for (const bad of [null, "Which band?", [3]]) assert.equal(answerLines(once, bad), "", JSON.stringify(bad));
  assert.equal(answerLines(null, [q1]), "");
  // THE QUESTIONS IT STILL ANSWERS.
  assert.deepEqual(askedIn(twice, [q1, q2]), [q1, q2]);
  assert.deepEqual(askedIn("Move the order band up\n\nThey were asked: " + q2 + "\nThey answered: Come to the bakery", [q1, q2]), [q2]);
  assert.deepEqual(askedIn("Move the order band up", [q1, q2]), []);
  assert.deepEqual(askedIn("Asked " + q1 + " before", [q1]), [], "a question's words alone are not its answer");
  assert.deepEqual(askedIn(twice, null), []);
});

test("A QUESTION IS ASKED ONLY WHERE AN ANSWER CAN STILL RESUME ITS REQUEST: the request, the question and an answer as long as its longest option (never under a short typed one) fit one message", () => {
  const q = { text: "Which page?", options: ["Home", "Visit"] };
  const fits = (n, question = q) => askRoom("x".repeat(n), question);
  // THE BOUNDARY, measured with the request an answer would really resume.
  const overhead = answeredRequest("x", q.text, "y".repeat(ASK_ANSWER_ROOM)).length - 1;
  assert.equal(fits(MAX_MESSAGE - overhead), true, "a request with exactly room for an answer was refused");
  assert.equal(fits(MAX_MESSAGE - overhead + 1), false, "a request with no room for an answer was asked about");
  // A LONG OPTION NEEDS ITS OWN ROOM: offered, it must be an answer that fits.
  // (As it is shown: an option is cut to a button's length first, `readAsk`.)
  const long = { text: "Which?", options: ["o".repeat(60), "Visit"] };
  const shown = readAsk(long).options[0];
  assert.ok(shown.length > ASK_ANSWER_ROOM, "the case does not exercise an option longer than a short answer");
  const longOverhead = answeredRequest("x", long.text, shown).length - 1;
  assert.equal(askRoom("x".repeat(MAX_MESSAGE - longOverhead), long), true);
  assert.equal(askRoom("x".repeat(MAX_MESSAGE - longOverhead + 1), long), false, "an offered answer that could not fit was offered");
  assert.equal(askRoom("Move the band", { text: "" }), false, "an unreadable question had room");
});

test("THE NEXT QUESTION REPLACES THE ANSWERED ONE IN ONE WRITE: a write that fails or loses leaves the answered question waiting, and a closed one is never replaced", async () => {
  const b = bucket();
  const first = rec();
  await storeAsk(b, first);
  const next = rec({ round: 2, question: { text: "Above which heading?" }, request: "Change the heading\n\nThey were asked: " + Q.text + "\nThey answered: Visit", asked: [Q.text, "Above which heading?"] });
  // A WRITE THAT THROWS: the answered question is still the live one.
  const realPut = b.put.bind(b);
  b.put = async () => { throw new Error("r2 down"); };
  await assert.rejects(replaceAsk(b, { slug: SLUG, id: first.id, uid: UID, next }), /r2 down/);
  b.put = realPut;
  let st = await loadAsk(b, SLUG);
  assert.equal(st.record.id, first.id, "a failed replace lost the answered question");
  assert.equal(st.record.status, "pending", "a failed replace used up the answer");
  // A WRITE THAT LOSES THE RACE: another writer moved the record first.
  const realGet = b.get.bind(b);
  b.get = async (k) => { const o = await realGet(k); await realPut(k, JSON.stringify({ ...first, status: "cancelled" })); return o; };
  assert.deepEqual(await replaceAsk(b, { slug: SLUG, id: first.id, uid: UID, next }), { ok: false, why: "raced" });
  b.get = realGet;
  st = await loadAsk(b, SLUG);
  assert.equal(st.record.status, "cancelled", "a lost replace wrote over the winner");
  // A CLOSED QUESTION IS NEVER REPLACED, and the next is never written.
  assert.deepEqual(await replaceAsk(b, { slug: SLUG, id: first.id, uid: UID, next }), { ok: false, why: "closed" });
  // AND THE ONE THAT WINS writes the next question whole, over the answered one.
  const fresh = rec();
  await storeAsk(b, fresh);
  const won = await replaceAsk(b, { slug: SLUG, id: fresh.id, uid: UID, next });
  assert.equal(won.ok, true);
  assert.equal(won.record.id, fresh.id);
  st = await loadAsk(b, SLUG);
  assert.equal(st.record.id, next.id);
  assert.deepEqual(st.record.asked, [Q.text, "Above which heading?"]);
  // A NEXT QUESTION FOR ANOTHER OWNER, ANOTHER SITE, OR NOT PENDING IS REFUSED BEFORE ANY READ.
  for (const bad of [{ ...next, uid: OTHER }, { ...next, slug: "fretwork-1" }, { ...next, status: "answered" }, null]) {
    await assert.rejects(replaceAsk(b, { slug: SLUG, id: next.id, uid: UID, next: bad }), /not a next question/);
  }
});

test("EVERY MODEL THAT COULD NOT ASK NOW ASKS, AND WHAT IT WROTE BESIDE THE QUESTION IS NEVER READ: each lane, the removal picker, the full page writer and each add-on designer", async () => {
  const withQ = (name, input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name, input: { ...input, question: Q } }], usage: { input_tokens: 50, output_tokens: 10 } });
  const lane = await runLane({ send: async () => withQ("edit_site", { description: "A guess." }) }, { field: "description", message: "Change the description", value: "Old.", model: "m" });
  assert.deepEqual(json(lane.ask), Q);
  assert.equal(lane.value, undefined, "a lane that asked had its guess read");
  assert.ok(lane.usage, "the lane's call was not accounted");
  // THE CORRECTION ROUND HAS NOBODY TO ASK: a question there is not one.
  const fix = await runLane({ send: async () => withQ("edit_site", { css: "a{}" }) }, { field: "css", message: "x", value: "", model: "m", ask: false });
  assert.equal(fix.ask, undefined);
  assert.equal(fix.value, "a{}");
  const off = await runTakeOff({ send: async () => withQ("take_off", { targets: ["menu"] }) },
    { field: "qr", message: "Take the code off", value: [{ name: "menu", label: "Our menu", points: "/menu" }, { name: "wifi", label: "Wifi", points: "/wifi" }], model: "m" });
  assert.deepEqual(json(off.ask), Q);
  assert.equal(off.ok, false, "a removal that asked reported names to take off");
  assert.deepEqual(off.targets, [], "a removal that asked named entries");
  const designed = await runAdd({ send: async () => withQ("add_to_site", { page: [{ path: "/gallery", name: "Gallery" }] }) }, { kind: "page", message: "Add a gallery", site: {}, model: "m" });
  assert.deepEqual(json(designed.ask), Q);
  assert.equal(designed.value, undefined, "a designer that asked had its design read");
  assert.ok(designed.raw, "the designer's raw reply was not kept for the record");
  // THE FULL PAGE WRITER, IN THE ONE-PAGE EDIT ONLY.
  const asks = await generateSitePages({}, "Move the band", { tables: [] }, "Fold Lane", [], "m", [{ path: "index.tsx", source: "x" }], "page", "index.tsx", null,
    async () => withQ("write_pages", { pages: [] }));
  assert.deepEqual(json(asks.ask), Q);
  assert.equal(asks.input, null, "the page writer's answer beside its question was read");
  // A BUILD'S WRITER IS NOT OFFERED ONE, SO A QUESTION FIELD IN ITS ANSWER IS NOT ONE.
  const build = await generateSitePages({}, "A bakery", { tables: [] }, "Fold Lane", [], "m", [], undefined, undefined, null,
    async () => withQ("write_pages", { pages: [{ path: "index.tsx", source: "x" }] }));
  assert.equal(build.ask, undefined, "a first build's page writer asked");
  assert.ok(build.input && build.input.pages, "a first build's pages were not read");
});

test("THE FIRST BUILD'S PAGE WRITER IS UNCHANGED, BYTE FOR BYTE — and so are a revise's and an add-on's; only the one-page edit is offered the question", () => {
  const h16 = (v) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
  const SPEC = { tables: [] };
  const prior = [{ path: "index.tsx", source: "export default function P(){return <main/>}" }];
  // MEASURED AT 22184a46, the commit before this change, with the same inputs.
  const pinned = { build: "5f88c5a2f738b9eb", revise: "66e12434e0bde0a2", addon: "f58a2d99f8705356" };
  assert.equal(h16(pagesRequest({ brief: "A bakery in Leeds", spec: SPEC, brand: "Fold Lane", model: "test-model" })), pinned.build, "the first build's page request changed");
  assert.equal(h16(pagesRequest({ brief: "Make it warmer", spec: SPEC, brand: "Fold Lane", model: "test-model", priorPages: prior, mode: "revise" })), pinned.revise, "a revise's page request changed");
  assert.equal(h16(pagesRequest({ brief: "Add a gallery page", spec: SPEC, brand: "Fold Lane", model: "test-model", priorPages: prior, mode: "addon" })), pinned.addon, "an add-on's page request changed");
  const edit = pagesRequest({ brief: "Move the band", spec: SPEC, brand: "Fold Lane", model: "test-model", priorPages: prior, mode: "page", target: "index.tsx" });
  assert.equal(edit.tools[0], SITE_PAGES_TOOL_ASK, "the one-page edit was not offered the question");
});

test("NO PROMPT TELLS A MODEL THAT CANNOT TELL TO GUESS BESIDE A FIELD THAT TELLS IT TO ASK: the add-on picker, the look picker and its door, the removal and page-verb flags, the picture step and the router's tie-break", () => {
  const addKinds = addPickTool().input_schema.properties.kinds;
  assert.doesNotMatch(addKinds.description, /closest/i, "the add-on picker still names the closest kind when it cannot tell");
  assert.match(addKinds.description, /ask them \(`question`\) instead of guessing/);
  assert.equal(addKinds.minItems, undefined, "the add-on picker must name a kind beside its question");
  const look = lanePickTool().input_schema.properties;
  assert.doesNotMatch(look.fields.description, /closest/i, "the look picker still names the closest part when it cannot tell");
  assert.match(look.fields.description, /ask them \(`question`\) instead of guessing/);
  assert.equal(look.fields.minItems, undefined, "the look picker must name a part beside its question");
  const door = lanePickTool(LANE_FIELDS, { routed: true }).input_schema.properties;
  assert.doesNotMatch(door.additional.description, /closest/i, "the door's picker still names the closest part");
  assert.match(look.removes.description, /never take it off on a guess: ask them \(`question`\)/);
  assert.doesNotMatch(look.removes.description, /IF YOU CANNOT TELL, LEAVE IT OUT/);
  assert.match(look.pageVerb.description, /ask them \(`question`\)/);
  assert.doesNotMatch(look.pageVerb.description, /LEAVE THIS OUT IF YOU CANNOT TELL/);
  const pic = PICTURE_TOOL.input_schema.properties.needsPlace.description;
  assert.doesNotMatch(pic, /honest no/, "the picture step still declines when it cannot tell which slot");
  assert.match(pic, /ask them which instead \(`question`\)/);
  // THE ROUTER: where a question may be asked, not being able to tell is what
  // the question is for; the first build's tool keeps its own tie-break.
  const live = LIVE_ASK_TOOL.input_schema.properties.intent.description;
  assert.doesNotMatch(live, /WHEN YOU CANNOT TELL, ANSWER "addon"/, "the live router is still told to answer addon when it cannot tell");
  assert.match(live, /WHEN YOU CANNOT TELL WHETHER IT IS A CHANGE OR AN ADDITION, ASK THEM \("clarify"\)/);
  assert.match(ASK_TOOL.input_schema.properties.intent.description, /WHEN YOU CANNOT TELL, ANSWER "addon"/, "the first build's tie-break moved");
  // AND THE DESIGNER'S COVERAGE LIST DOES NOT DEMAND AN ANSWER BESIDE A QUESTION.
  assert.match(addTool("page").input_schema.properties.requirements.description, /question back to them: then leave this out too/);
});

test("THE PICTURE STEP IS TOLD TO ASK WHICH, NOT TO RETURN NOTHING, when two slots fit", async () => {
  const { pictureRequest } = await import("../builder/site-picture.mjs");
  const req = pictureRequest({ instruction: "Swap the photo", slots: [], library: [] });
  const sys = req.system.map((b) => b.text).join("\n");
  assert.match(sys, /When two could fit and only one was asked for, change neither and ask them which \(`question`\)/);
  assert.doesNotMatch(sys, /they will say which/, "the picture step still returns nothing for the customer to say which");
});

test("A HAND-OVER AND A JOB RECORD CARRY THE QUESTIONS A REQUEST HAS ASKED, and a count past nine is still a count", () => {
  const asked = ["Which band?", "Above which heading?"];
  const hop = EditPoll.handOver({ layer: "text", asked, askRound: 12 }, { layer: "nav" }, {});
  assert.deepEqual(hop.asked, asked, "a hop forgot what the request has asked");
  assert.equal(hop.askRound, 12, "a request's twelfth question lost its count");
  assert.equal(EditPoll.handOver({ layer: "text", asked: [3] }, { layer: "nav" }, {}).asked, undefined, "an unreadable list was carried");
  assert.deepEqual(EditPoll.askedOf(undefined), []);
  assert.equal(EditPoll.askedOf("Which band?"), null);
  assert.equal(EditPoll.askedWire([]), undefined);
  const store = { data: {}, getItem(k) { return this.data[k] || null; }, setItem(k, v) { this.data[k] = v; } };
  EditPoll.rememberJob(SLUG, "job-3", store, { ask: "x", op: "edit", asked, askRound: 3 });
  const back = EditPoll.resumableRecord(SLUG, Date.now(), store);
  assert.deepEqual(back.asked, asked, "a resumed watch forgot what the request has asked");
  assert.equal(back.askRound, 3);
});
