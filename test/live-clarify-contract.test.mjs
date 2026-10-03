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
  QUESTION_FIELD, ASK_TTL_MS, QUESTION_KEY, MAX_ASKED, MAX_HISTORY, MAX_SAME_ASK, MAX_ANSWER_CHARS, CONTEXT_HEADING, askOf, newAskId,
  packAsk, readAskRecord, askLive, loadAsk, storeAsk, closeAsk, replaceAsk, withQuestion, readContext, shownContext,
  repeatOf, contextBlock, withContext, reuseNote, againNote, appendAnswer, clarifyTransport, clarifyCall,
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
    // WHAT THEY ALREADY TOLD US (2026-10-02, the owner's second review): `{ q, a }`
    // pairs beside the request, up to `MAX_HISTORY` of them — the request's
    // whole history, never a window of its latest answers (2026-10-03, the
    // owner's fourth review). Anything else makes no question at all, never a
    // shorter list — and so does a note that is not one short line.
    ["context", "Visit"], ["context", [3]], ["context", [{ q: "Which?" }]], ["context", [{ q: "", a: "Visit" }]],
    ["context", [{ q: "Which?", a: "  " }]], ["context", [{ q: "x".repeat(241), a: "Visit" }]],
    ["context", [{ q: "Which?", a: "x".repeat(MAX_ANSWER_CHARS + 1) }]], ["context", [{ q: "Which?", a: "Visit", handled: "yes" }]],
    ["context", Array.from({ length: MAX_HISTORY + 1 }, (_, i) => ({ q: "Q" + i + "?", a: "A" + i }))],
    ["note", ""], ["note", 3], ["note", "x".repeat(301)],
  ]) {
    assert.equal(rec({ [field]: bad }), null, field + " = " + JSON.stringify(bad) + " was accepted");
  }
  // A REQUEST CARRYING ITS TWELFTH ANSWER STILL KEEPS ITS QUESTION (2026-10-03),
  // AND ONE PAST THE TOTAL-ANSWER LIMIT KEEPS EVERY ANSWER, up to the history's
  // own bound (the owner's fourth review): the limit is never a reason to drop
  // a question, nor an answer.
  const twelve = Array.from({ length: MAX_ASKED }, (_, i) => ({ q: "Q" + i + "?", a: "A" + i }));
  assert.equal(rec({ round: 13, context: twelve }).context.length, MAX_ASKED, "a question on a full list of answers was dropped");
  const thirteen = [...twelve, { q: "Q12?", a: "A12" }];
  assert.deepEqual(rec({ round: 14, context: thirteen }).context, thirteen, "a stored question kept twelve of thirteen answers");
  const history = Array.from({ length: MAX_HISTORY }, (_, i) => ({ q: "Q" + i + "?", a: "A" + i }));
  assert.deepEqual(rec({ round: MAX_HISTORY + 1, context: history }).context, history, "a stored question did not keep the whole history");
  assert.deepEqual(good.context, [], "a first question carries answers");
  assert.equal(Object.hasOwn(good, "note"), false, "a first asking carries a note");
  assert.equal(Object.hasOwn(good, "asked"), false, "the old list of questions is still written");
  const noted = rec({ context: [{ q: Q.text, a: "the top one" }], note: "  Your answer didn't settle this.  " });
  assert.equal(noted.note, "Your answer didn't settle this.");
  assert.deepEqual(readAskRecord(JSON.stringify(noted)), noted, "a note does not read back as it was written");
  assert.deepEqual(rec({ context: [{ q: " Which? ", a: " Visit ", handled: true }] }).context, [{ q: "Which?", a: "Visit", handled: true }]);
  assert.equal(readAskRecord("{not json"), null);
  assert.equal(readAskRecord(JSON.stringify({ ...good, v: 1 })), null, "a record of the old version was read");
  assert.equal(readAskRecord(JSON.stringify({ ...good, v: 3 })), null, "a record of another version was read");
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

test("WHAT THEY ALREADY TOLD US IS A LIST BESIDE THE REQUEST, READ STRICTLY, AND SHOWN TO A MODEL AS A SECTION OF ITS OWN — never as words of the request", () => {
  assert.deepEqual(readContext(undefined), []);
  assert.deepEqual(readContext(null), []);
  assert.deepEqual(readContext([{ q: " Which? ", a: " Visit ", other: 1 }]), [{ q: "Which?", a: "Visit" }]);
  for (const bad of ["Visit", 3, {}, [null], [[]], [{ q: "Which?" }], [{ q: 3, a: "x" }], [{ q: "Which?", a: "x", handled: false }],
    Array.from({ length: MAX_HISTORY + 1 }, () => ({ q: "q", a: "a" }))]) {
    assert.equal(readContext(bad), null, JSON.stringify(bad) + " was read as a list of answers");
  }
  // PAST THE TOTAL-ANSWER LIMIT THE LIST IS STILL READ WHOLE (2026-10-03, the
  // owner's fourth review): that limit stops our re-asking, never the history.
  for (const n of [MAX_ASKED + 1, MAX_HISTORY]) {
    const long = Array.from({ length: n }, (_, i) => ({ q: "Q" + i + "?", a: "A" + i }));
    assert.deepEqual(readContext(long), long, n + " answers were not read whole");
  }
  const ctx = [{ q: Q.text, a: "Visit" }, { q: "Which photo?", a: "the shop front", handled: true }, { q: "How big?", a: "twice" }];
  assert.deepEqual(shownContext(ctx), [ctx[0], ctx[2]], "a handled answer was shown, or one still for the request hidden");
  const block = contextBlock(ctx);
  assert.ok(block.startsWith(CONTEXT_HEADING), "the section does not open with its heading");
  assert.match(block, /never a change of their own: do only what the request asks/);
  assert.ok(block.includes("1. Asked: \u201c" + Q.text + "\u201d\n   They answered: \u201cVisit\u201d"), "the first answer is not numbered 1, under its question");
  assert.ok(block.includes("2. Asked: \u201cHow big?\u201d\n   They answered: \u201ctwice\u201d"), "the numbers skip a handled answer's place");
  assert.doesNotMatch(block, /shop front/, "a handled answer was shown");
  assert.equal(contextBlock([]), "");
  assert.equal(contextBlock([{ q: "x", a: "y", handled: true }]), "", "a section of handled answers alone was shown");
  // AFTER EVERYTHING ELSE THE REQUEST HOLDS, in its last user message — words or blocks — and never in place.
  const req = { model: "m", messages: [{ role: "user", content: "What they asked for:\nChange the heading" }] };
  const shown = withContext(req, ctx);
  assert.equal(shown.messages[0].content, "What they asked for:\nChange the heading\n\n" + block);
  assert.equal(req.messages[0].content, "What they asked for:\nChange the heading", "the request handed in was changed");
  const blocks = withContext({ messages: [{ role: "user", content: [{ type: "text", text: "a" }] }, { role: "assistant", content: "b" }] }, ctx);
  assert.deepEqual(blocks.messages[0].content.at(-1), { type: "text", text: block }, "a request of blocks did not get the section as its last block");
  assert.equal(withContext(req, []), req, "a request with nothing to show was rebuilt");
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

test("A LIVE SITE'S ROUTER IS OFFERED A QUESTION WHEREVER ONE CAN BE KEPT, and is shown what they already told us about the waiting request — however many answers it carries", async () => {
  const fresh = await liveRoute({ intent: "edit", layer: "text" });
  assert.equal(fresh.sent.tools[0], LIVE_ASK_TOOL, "a live site was not sent the live tool");
  const props = LIVE_ASK_TOOL.input_schema.properties;
  assert.ok(props.question && props.answered, "the live tool has no question or no answered field");
  assert.deepEqual(props.question.required, ["text"], "a question must carry answers to be asked");
  const told = String(fresh.sent.messages[0].content);
  assert.match(told, /A QUESTION MAY BE ASKED/);
  assert.doesNotMatch(told, /more questions? about this request/, "the router was told a count, so a later question could be words nobody can answer");
  assert.doesNotMatch(told, /THEIR LAST REQUEST IS WAITING/, "a fresh message was told a request is waiting");
  assert.doesNotMatch(told, /ALREADY ASKED|WHAT THEY ALREADY TOLD YOU/, "a fresh request was told it had asked something");
  // A REQUEST THAT HAS BEEN ANSWERED: what they told us, under the waiting request, never asked again.
  const context = [{ q: "Which heading?", a: "The top one" }, { q: "On which page?", a: "Visit" }];
  const pending = { request: "Change the heading", question: { text: "Bigger by how much?", options: [] } };
  const later = await liveRoute({ intent: "edit", layer: "text" }, { context, pending });
  const laterTold = String(later.sent.messages[0].content);
  assert.match(laterTold, /A QUESTION MAY BE ASKED/, "a third question was closed off");
  assert.ok(laterTold.includes(contextBlock(context)), "the router was not shown what they already told us");
  assert.match(laterTold, /Never ask what they already answered under WHAT THEY ALREADY TOLD YOU\./);
  assert.ok(laterTold.indexOf("They asked: Change the heading") < laterTold.indexOf(CONTEXT_HEADING), "the answers are not shown under the request they belong to");
  assert.match(laterTold, /when it does not settle what you asked, ask them a more specific question that names exactly what it left open/);
  // A FRESH MESSAGE is shown no answers, whatever a caller sends.
  const stray = await liveRoute({ intent: "edit", layer: "text" }, { context });
  assert.doesNotMatch(String(stray.sent.messages[0].content), /WHAT THEY ALREADY TOLD YOU/, "a fresh message was shown answers of a request it does not resume");
  // AT THE TOTAL-ANSWER LIMIT A QUESTION IS STILL OFFERED (2026-10-03, the owner's
  // third review): closing questions there told the router to act on a guess.
  for (const n of [MAX_ASKED - 1, MAX_ASKED]) {
    const full = Array.from({ length: n }, (_, i) => ({ q: "Q" + i + "?", a: "A" + i }));
    const atLimit = String((await liveRoute({ intent: "edit", layer: "text" }, { context: full, pending })).sent.messages[0].content);
    assert.match(atLimit, /A QUESTION MAY BE ASKED/, "a request carrying " + n + " answers was not offered a question");
    assert.doesNotMatch(atLimit, /Questions are closed/, "a request carrying " + n + " answers was told questions are closed — permission to act on a guess");
  }
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
  // RE-ANCHORED 2026-10-02 (the owner's second review): the answers are in
  // their own section, by its heading, and an answer that left the detail open
  // is a reason for a MORE SPECIFIC question, never for the same one again.
  assert.match(d, /never\s+what they already answered \(/, "a step is not told never to ask again what was answered");
  assert.ok(d.includes("answered (" + CONTEXT_HEADING + ");"), "a step is not told where the answers are");
  assert.match(d, /if that left it open, ask a more specific\s+question naming what is open/, "a step is not told to ask a more specific question when an answer left the detail open");
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

test("A QUESTION ALREADY ANSWERED IS RECOGNISED HOWEVER IT IS SPELLED — case, accents, spacing and punctuation set aside — and every answer to it is found, handled ones too", () => {
  const ctx = [{ q: "Which band — Visit or Order?", a: "Visit" }, { q: "Café hours?", a: "9 to 5", handled: true }, { q: "which band visit or order", a: "the top one" }];
  for (const again of ["Which band — Visit or Order?", "which band visit or order", "  WHICH BAND, Visit or Order!!  "]) {
    assert.deepEqual(repeatOf(ctx, { text: again }), [ctx[0], ctx[2]], again + " was not read as the same question");
  }
  assert.deepEqual(repeatOf(ctx, { text: "cafe hours" }), [ctx[1]], "an accent made a repeat a new question, or a handled answer was not found");
  for (const other of ["Which band — Order or Contact?", "Which photo?"]) assert.deepEqual(repeatOf(ctx, { text: other }), [], other + " was read as a question already answered");
  for (const bad of [null, undefined, "Which band?", [3]]) assert.deepEqual(repeatOf(bad, { text: "Which band?" }), [], JSON.stringify(bad));
  assert.deepEqual(repeatOf(ctx, { text: "" }), [], "an empty question was a repeat");
  assert.deepEqual(repeatOf(ctx, null), []);
});

test("THE OLD READERS ARE GONE: no answer is ever folded into a request, so nothing measures one against it", async () => {
  const mod = await import("../builder/clarify.mjs");
  for (const name of ["answeredRequest", "askRepeat", "askRoom", "askedList", "answerLines", "askedIn", "ASK_ANSWER_ROOM"]) {
    assert.equal(Object.hasOwn(mod, name), false, name + " is still exported");
  }
});

test("THE NEXT QUESTION REPLACES THE ANSWERED ONE IN ONE WRITE: a write that fails or loses leaves the answered question waiting, and a closed one is never replaced", async () => {
  const b = bucket();
  const first = rec();
  await storeAsk(b, first);
  const next = rec({ round: 2, question: { text: "Above which heading?" }, request: "Change the heading", context: [{ q: Q.text, a: "Visit" }] });
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
  assert.equal(st.record.request, "Change the heading", "the request grew when the next question replaced the answered one");
  assert.deepEqual(st.record.context, [{ q: Q.text, a: "Visit" }]);
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

test("A HAND-OVER AND A JOB RECORD CARRY WHAT THEY ALREADY TOLD US, as it came — a list that does not read is carried for the route to refuse, never turned into none", () => {
  const context = [{ q: "Which band?", a: "Visit" }, { q: "Above which heading?", a: "Come to the bakery", handled: true }];
  const hop = EditPoll.handOver({ layer: "text", context, askRound: 12 }, { layer: "nav" }, {});
  assert.deepEqual(hop.context, context, "a hop forgot what they told us");
  assert.equal(hop.askRound, 12, "a request's twelfth question lost its count");
  assert.equal(Object.hasOwn(EditPoll.handOver({ layer: "text" }, { layer: "nav" }, {}), "context"), false, "a hop with no answers named some");
  assert.deepEqual(EditPoll.handOver({ layer: "text", context: [3] }, { layer: "nav" }, {}).context, [3], "an unreadable list was dropped, so the step would run as if nothing was answered");
  assert.deepEqual(EditPoll.contextOf(undefined), []);
  assert.equal(EditPoll.contextOf("Which band?"), null);
  assert.equal(EditPoll.contextOf([{ q: "Which band?", a: "x".repeat(501) }]), null, "an answer longer than the server keeps was read");
  assert.equal(EditPoll.contextOf(Array.from({ length: MAX_HISTORY + 1 }, () => ({ q: "q", a: "a" }))), null, "a list longer than the server keeps was read");
  // THE BROWSER CARRIES THE WHOLE HISTORY THE SERVER KEEPS (2026-10-03, the
  // owner's fourth review): past the total-answer limit a reload, a resumed
  // job and a hand-over still carry every answer.
  for (const n of [MAX_ASKED + 1, MAX_HISTORY]) {
    const long = Array.from({ length: n }, (_, i) => ({ q: "Q" + i + "?", a: "A" + i }));
    assert.deepEqual(EditPoll.contextOf(long), long, "the browser did not read " + n + " answers whole");
    assert.deepEqual(EditPoll.handOver({ layer: "text", context: long }, { layer: "nav" }, {}).context, long, "a hop did not carry " + n + " answers");
  }
  assert.equal(EditPoll.contextWire([]), undefined);
  assert.deepEqual(EditPoll.contextWire([{ q: " q ", a: " a " }]), [{ q: "q", a: "a" }]);
  const store = { data: {}, getItem(k) { return this.data[k] || null; }, setItem(k, v) { this.data[k] = v; } };
  EditPoll.rememberJob(SLUG, "job-3", store, { ask: "x", op: "edit", context, askRound: 3 });
  const back = EditPoll.resumableRecord(SLUG, Date.now(), store);
  assert.deepEqual(back.context, context, "a resumed watch forgot what they told us");
  assert.equal(back.askRound, 3);
  EditPoll.rememberJob(SLUG, "job-4", store, { ask: "x", op: "edit", context: "broken" });
  assert.equal(EditPoll.resumableRecord(SLUG, Date.now(), store).context, "broken", "a broken list was dropped on the way through the store");
  EditPoll.rememberJob(SLUG, "job-5", store, { ask: "x", op: "edit", context: [] });
  assert.equal(Object.hasOwn(EditPoll.resumableRecord(SLUG, Date.now(), store), "context"), false, "an empty list was stored as answers");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTINUITY (2026-10-02, the owner's second review): the answers ride beside
// the request, every deciding model is shown the ones its change needs, and a
// question already answered is sent back with its answer — never an ending.
// ─────────────────────────────────────────────────────────────────────────────

const toolOf = () => withQuestion({ name: "t", input_schema: { type: "object", properties: { value: { type: "string" } } } });
const asking = (text) => ({ content: [{ type: "tool_use", name: "t", input: { value: "guessed", question: { text } } }], usage: { input_tokens: 9, output_tokens: 1 } });
const acting = (value = "x") => ({ content: [{ type: "tool_use", name: "t", input: { value } }], usage: { input_tokens: 5, output_tokens: 2 } });
const stepReq = () => ({ tools: [toolOf()], messages: [{ role: "user", content: "What they asked for:\nChange the photo" }] });

test("EVERY CALL A STEP MAKES IS SHOWN ITS ANSWERS; A QUESTION ALREADY ANSWERED IS SENT BACK WITH ITS ANSWER AND NEVER PUT TO THE CUSTOMER — and the call asked again is ours", async () => {
  const ctx = [{ q: "Which photo?", a: "The one on the Contact page" }, { q: "Which heading?", a: "The top one", handled: true }];
  const run = async (replies, shown, closed) => {
    const sent = [];
    const heard = [];
    const send = clarifyTransport(async (r) => { sent.push(r); return replies.shift(); }, { shown: () => shown, all: () => ctx, onReuse: (h) => heard.push(h.length) });
    return { got: await send(stepReq()), sent, heard };
  };
  // A REPEAT OF AN ANSWER IT WAS SHOWN: sent once more with that answer in front of it.
  const done = acting();
  let r = await run([asking("Which photo?"), done], [ctx[0]]);
  assert.equal(r.got, done, "the reply used is not the one given after the answer");
  assert.equal(r.sent.length, 2);
  assert.ok(r.sent[0].messages[0].content.endsWith(contextBlock([ctx[0]])), "the step was not shown its answer, after everything else");
  assert.ok(r.sent[1].messages[0].content.endsWith(reuseNote([ctx[0]])), "the second call was not sent the answer to the question it asked");
  assert.match(r.sent[1].messages[0].content, /ask them a MORE SPECIFIC question that names exactly what their answer left open/);
  assert.ok(r.sent[1].tools[0].input_schema.properties.question, "a first repeat was sent back with no question offered");
  assert.deepEqual(r.heard, [1]);
  // A HANDLED ANSWER IS NEVER SHOWN, BUT IS STILL THE ANSWER TO ITS QUESTION.
  r = await run([asking("which heading"), done], [ctx[0]]);
  assert.doesNotMatch(r.sent[0].messages[0].content, /The top one/, "a handled answer was shown as context");
  assert.match(r.sent[1].messages[0].content, /Asked: “Which heading\?” — they answered: “The top one”/, "a handled answer was not reused");
  // A NEW QUESTION, OR NONE: one call, the reply as it came.
  const fresh = asking("Is it the logo?");
  r = await run([fresh], [ctx[0]]);
  assert.equal(r.got, fresh);
  assert.equal(r.sent.length, 1, "a new question was sent back");
  r = await run([done], []);
  assert.equal(r.sent.length, 1);
  assert.equal(r.sent[0].messages[0].content, "What they asked for:\nChange the photo", "a step shown no answers was sent a section anyway");
});

// AT THE REPEATED-QUESTION THRESHOLD AND PAST THE TOTAL-ANSWER LIMIT (2026-10-03,
// the owner's third review: *"clarifyTransport currently strips question
// fields at the limit and dropQuestion removes an unresolved question while
// retaining proposed edits. Never treat a question limit or repeated question
// as permission to act"*): every call is offered its question, the model is
// never sent again on our own, and its reply comes back exactly as it came —
// question and all — so the step asks it and does nothing proposed beside it.
const asksAndProposes = (text) => ({ content: [{ type: "tool_use", name: "t", input: { value: "guessed", question: { text } } }], usage: { input_tokens: 9, output_tokens: 1 } });
const runTransport = async (all, replies) => {
  const sent = [];
  const heard = [];
  const send = clarifyTransport(async (r) => { sent.push(r); return replies.shift(); }, { shown: () => all, all: () => all, onReuse: (h) => heard.push(h.length) });
  return { got: await send(stepReq()), sent, heard };
};
const offersQuestion = (req) => Object.hasOwn(req.tools[0].input_schema.properties, "question");

test("AT THE REPEATED-QUESTION THRESHOLD A STEP'S MODEL IS NEVER SENT AGAIN, AND ITS QUESTION COMES BACK WITH IT — never taken out while the change it proposed beside it is kept", async () => {
  assert.equal(MAX_SAME_ASK, 2);
  const twice = [{ q: "Which photo?", a: "the nice one" }, { q: "which photo", a: "the big one" }];
  const reply = asksAndProposes("Which photo?");
  const r = await runTransport(twice, [reply, acting("acted on a guess")]);
  assert.equal(r.sent.length, 1, "the model was sent again at the threshold");
  assert.ok(offersQuestion(r.sent[0]), "the call was not offered its question");
  assert.equal(r.got, reply, "the reply was not returned exactly as it came");
  assert.deepEqual(askOf(r.got), { text: "Which photo?", options: [] }, "the question was taken out of the reply");
  assert.deepEqual(r.heard, [], "a call nobody sent again was traced as one");
  // ASKED THE THIRD TIME AND MORE, the same.
  const thrice = [...twice, { q: "Which photo?", a: "the one I said" }];
  const r3 = await runTransport(thrice, [asksAndProposes("Which photo?"), acting()]);
  assert.equal(r3.sent.length, 1);
  assert.ok(askOf(r3.got), "the question was taken out of the reply");
  // ONE ANSWER BELOW THE THRESHOLD, the answer is still given back once, the question still offered.
  const once = await runTransport(twice.slice(0, 1), [asksAndProposes("Which photo?"), acting()]);
  assert.equal(once.sent.length, 2, "below the threshold the model was not sent its answer back");
  assert.ok(offersQuestion(once.sent[1]), "the call sent again was offered no question — permission to act on a guess");
  assert.match(once.sent[1].messages[0].content, /YOU ASKED THEM THIS ALREADY/);
});

test("PAST THE TOTAL-ANSWER LIMIT EVERY CALL IS STILL OFFERED ITS QUESTION, A NEW QUESTION COMES BACK AS IT CAME, AND ONE ALREADY ANSWERED IS NEVER SENT AGAIN", async () => {
  const full = Array.from({ length: MAX_ASKED }, (_, i) => ({ q: "Q" + i + "?", a: "A" + i }));
  // A NEW QUESTION.
  const fresh = asksAndProposes("Anything else?");
  const r = await runTransport(full, [fresh, acting()]);
  assert.equal(r.sent.length, 1);
  assert.ok(offersQuestion(r.sent[0]), "a request at the limit was offered no question");
  assert.equal(r.got, fresh);
  assert.ok(askOf(r.got), "a question at the limit was taken out of the reply");
  // ONE IT ALREADY HAS AN ANSWER TO, ONCE: never sent again past the limit.
  const again = asksAndProposes("Q3?");
  const r2 = await runTransport(full, [again, acting()]);
  assert.equal(r2.sent.length, 1, "the model was sent again past the total-answer limit");
  assert.equal(r2.got, again);
  assert.deepEqual(r2.heard, []);
  // ONE BELOW THE LIMIT, the answer is given back once.
  const r3 = await runTransport(full.slice(1), [asksAndProposes("Q3?"), acting()]);
  assert.equal(r3.sent.length, 2, "below the limit the model was not sent its answer back");
  assert.deepEqual(r3.heard, [1]);
  // A REPLY WITH NO QUESTION, untouched.
  const done = acting();
  const r4 = await runTransport(full, [done]);
  assert.equal(r4.got, done);
  assert.equal(r4.sent.length, 1);
});

test("ONE MORE ANSWER JOINS THE REQUEST'S HISTORY AND NONE STILL NEEDED IS LET GO — not for its age, not because its question was answered again; only at the history's own bound may a handled answer make room, and when every answer is still needed none is (2026-10-03, the owner's fourth review)", () => {
  const A = (i, extra = {}) => ({ q: "Q" + i + "?", a: "A" + i, ...extra });
  assert.ok(MAX_HISTORY > MAX_ASKED, "the history is no larger than the question limit — a window again");
  assert.deepEqual(appendAnswer([A(0)], A(1)), [A(0), A(1)]);
  assert.deepEqual(appendAnswer([], A(0)), [A(0)]);
  // PAST THE TOTAL-ANSWER LIMIT EVERY ANSWER STAYS, THE OLDEST INCLUDED.
  const twelve = Array.from({ length: MAX_ASKED }, (_, i) => A(i));
  assert.deepEqual(appendAnswer(twelve, A(99)), [...twelve, A(99)], "an answer was let go because twelve already existed");
  // A QUESTION ANSWERED AGAIN KEEPS EVERY ANSWER TO IT, spelled however: the
  // later one is never taken to replace the details of the earlier.
  const repeated = Array.from({ length: MAX_ASKED }, (_, i) => (i === 9 ? { q: "q2", a: "and keep the awning" } : A(i)));
  assert.deepEqual(appendAnswer(repeated, A(99)), [...repeated, A(99)], "the earlier answer to a question answered again was let go");
  assert.deepEqual(appendAnswer(twelve, { q: "Q5?", a: "a good deal more" }), [...twelve, { q: "Q5?", a: "a good deal more" }], "an answer was let go because its own question was answered again");
  // A HANDLED ANSWER STAYS TOO, below the history's bound: never shown again,
  // but there to answer the same question if it comes back.
  const withHandled = Array.from({ length: MAX_ASKED }, (_, i) => A(i, i === 4 || i === 7 ? { handled: true } : {}));
  assert.deepEqual(appendAnswer(withHandled, A(99)), [...withHandled, A(99)], "a handled answer was let go below the history's bound");
  // AT THE HISTORY'S OWN BOUND, THE FIRST HANDLED ANSWER — AND ONLY IT — MAKES ROOM.
  const fullHandled = Array.from({ length: MAX_HISTORY }, (_, i) => A(i, i === 30 || i === 50 ? { handled: true } : {}));
  const roomed = appendAnswer(fullHandled, A(999));
  assert.equal(roomed.length, MAX_HISTORY);
  assert.deepEqual(roomed, [...fullHandled.filter((_, i) => i !== 30), A(999)], "room was not made by the first handled answer alone");
  // EVERY ANSWER STILL NEEDED: NONE IS LET GO, and the list given is untouched.
  const fullNeeded = Array.from({ length: MAX_HISTORY }, (_, i) => A(i));
  const before = JSON.stringify(fullNeeded);
  assert.equal(appendAnswer(fullNeeded, A(999)), null, "an answer still needed was let go to make room");
  assert.equal(JSON.stringify(fullNeeded), before, "the list given was changed");
  // A LONG RUN OF ANSWERS, MANY TO THE SAME FEW QUESTIONS: each keeps every answer before it, to the bound.
  let list = [];
  for (let i = 0; i < MAX_HISTORY; i++) {
    const prev = list;
    list = appendAnswer(list, A(i % 7, { a: "answer " + i }));
    assert.deepEqual(list, [...prev, { q: "Q" + (i % 7) + "?", a: "answer " + i }], "answer " + i + " cost an earlier one its place");
  }
  assert.equal(appendAnswer(list, A(1)), null);
  // CANNOT-TELL IS NULL, NEVER A SHORTER LIST.
  assert.equal(appendAnswer("nope", A(1)), null);
  assert.equal(appendAnswer(Array.from({ length: MAX_HISTORY + 1 }, (_, i) => A(i)), A(99)), null, "a list no reader keeps was made to fit");
  assert.equal(appendAnswer([A(0)], { q: "Q?", a: "x".repeat(MAX_ANSWER_CHARS + 1) }), null, "an answer too long to keep was kept");
  assert.equal(appendAnswer([A(0)], { q: "", a: "x" }), null);
  assert.equal(appendAnswer([A(0)], { q: "Q?", a: "x", handled: true }), null, "a new answer arrived already handled");
});

test("THE PAGE WRITER'S CALL GOES THROUGH THE SAME TRANSPORT, with its keys and its clock passed through untouched", async () => {
  const ctx = [{ q: "Which section?", a: "Our story" }];
  const calls = [];
  const call = clarifyCall(async (keys, req, budget) => { calls.push({ keys, req, budget }); return calls.length === 1 ? asking("Which section?") : acting(); }, { shown: () => ctx, all: () => ctx });
  const keys = { k: 1 };
  const budget = { b: 1 };
  const got = await call(keys, stepReq(), budget);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((c) => c.keys === keys && c.budget === budget), "the keys or the clock were not passed through");
  assert.ok(calls[0].req.messages[0].content.endsWith(contextBlock(ctx)));
  assert.equal(askOf(got), null);
});

test("THE NOTE A QUESTION ASKED ONCE MORE IS SHOWN UNDER names the answer that did not settle it, in the customer's own words, cut to fit", () => {
  assert.equal(againNote([{ q: "Which photo?", a: "the nice one" }]), "Your answer \u2014 \u201cthe nice one\u201d \u2014 didn\u2019t settle this, so I need to ask once more.");
  assert.match(againNote([{ q: "q", a: "first" }, { q: "q", a: "second" }]), /second/, "the note named an earlier answer, not the last");
  const long = againNote([{ q: "q", a: "word ".repeat(80).trim() }]);
  assert.ok(long.length <= 300 && long.includes("\u2026"), "a long answer was not cut to fit");
  assert.equal(againNote([]), "Your answer didn\u2019t settle this, so I need to ask once more.");
  // AT THE REPEATED-QUESTION THRESHOLD (2026-10-03): the last two answers, and both
  // ways on — answer once more, or cancel — never a claim that nothing changed.
  const at = againNote([{ q: "Which photo?", a: "the nice one" }, { q: "which photo", a: "the big one" }]);
  assert.equal(at, "I\u2019ve asked this before, and your answers \u2014 \u201cthe nice one\u201d, then \u201cthe big one\u201d \u2014 haven\u2019t settled it. Answer once more, or cancel this request and nothing more will be done for it.");
  const three = againNote([{ q: "q", a: "first" }, { q: "q", a: "second" }, { q: "q", a: "third" }]);
  assert.ok(three.includes("\u201csecond\u201d, then \u201cthird\u201d") && !three.includes("first"), "the note did not name the last two answers");
  const longs = againNote([{ q: "q", a: "word ".repeat(100).trim() }, { q: "q", a: "other ".repeat(80).trim() }]);
  assert.ok(longs.length <= 300, "the note does not fit: " + longs.length);
  assert.ok(longs.endsWith("nothing more will be done for it."), "the ways on were cut off a long note");
  assert.equal((longs.match(/\u2026/g) || []).length, 2, "each long answer was not cut to fit");
  for (const note of [at, three, longs]) assert.doesNotMatch(note, /nothing (has )?changed/i);
});
