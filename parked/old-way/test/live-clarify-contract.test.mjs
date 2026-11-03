// PARKED (2026-11-03, park-old-way): the old-way half of test/live-clarify-contract.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
} from "../../../builder/clarify.mjs";
import { allowedJobKey } from "../../../builder/job-gateway.mjs";
import { routeMessage, readRouting, readAsk, askRequest, ASK_TOOL, LIVE_ASK_TOOL, MAX_MESSAGE } from "../builder/site-ask.mjs";
import { MAX_INPUT_CHARS } from "../../../builder/input-budget.mjs";
import { pickTool as lanePickTool, pickLanes, editTool, LANE_FIELDS, OWN_LANES, takeOffTool, runLane, runTakeOff } from "../../../builder/site-lanes.mjs";
import { TEXT_TOOL, DATA_TOOL, runTextEdit, runDataEdit } from "../../../builder/site-apply.mjs";
import { RULES_TOOL, runRulesEdit } from "../../../builder/site-rules.mjs";
import { PICTURE_TOOL, runPictureEdit } from "../../../builder/site-picture.mjs";
import { NAV_TOOL, runNavEdit } from "../../../builder/site-nav.mjs";
import { TWEAK_TOOL, runTweak } from "../../../builder/site-tweak.mjs";
import { pickTool as addPickTool, pickAdds, addTool, runAdd } from "../../../builder/site-add.mjs";
import { SITE_PAGES_TOOL, SITE_PAGES_TOOL_ASK, pagesRequest, generateSitePages } from "../../../builder/page-gen.mjs";
import { heldReport } from "../../../builder/hand-over.mjs";

const require = createRequire(import.meta.url);
const EditPoll = require("../../../public/edit-poll.js");

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

// ── THE FIRST BUILD, UNCHANGED ──────────────────────────────────────────────
//
// MEASURED AT THE BASE COMMIT, a8ed6b73, and at this change, with the same
// script: the request the router is sent and what it reads each answer as, for
// every way a project with no site yet reaches the router — a first build, its
// answers, an attachment, a spent budget, a record with no site, and a first
// build flagged as having one. Every pair was identical. Pinned here so a later
// change to the live path that reaches a first build fails by name.
// RE-PINNED ON PURPOSE 2026-10-13 (the owner's no-emoji rule): the reply's
// description now says no emoji unless asked, so every request half moved;
// every reading half was measured unchanged.
// RE-PINNED ON PURPOSE 2026-10-14 (the owner's conversation batch): the
// router is told conversation is not work, given the capability guidance and
// written only a reply's gist, so every request half moved. Exactly three
// reading halves moved, all "ask": a TYPED reply under a first build's question
// ("answering", twice) and a message with a file ("attached") are no longer
// turned into a build — they stay conversation, as the owner asked. A PRESSED
// answer still is (`picked`, test/site-ask.test.mjs). Every other reading half
// was measured unchanged.
// RE-PINNED ON PURPOSE 2026-10-15 (Codex's review of `7ca339d1`): the router
// is told never to write `resolved` from a part of the conversation marked as
// not shown, and to ask instead. Every request half moved; with those two
// strings taken back out of each request, all 42 old request halves were
// reproduced, and all 42 reading halves were measured unchanged.
// RE-PINNED ON PURPOSE 2026-10-15 (the conversation batch): the router is told
// that thinking a plan through is conversation and a plain go-ahead is work
// ("THINKING IT THROUGH, THEN DOING IT"), `resolved` is told how to write the
// common follow-ups, and an optional `unclear` field is offered on "ask". A
// project with no site yet plans in conversation too, so the change reaches a
// first build on purpose. Every request half moved; with those three additions
// taken back out of each request, all 42 old request halves were reproduced,
// and all 42 reading halves were measured unchanged.
// RE-PINNED 2026-10-22 (ideas #25/#26): the first build's tool gained
// `importSite`; every request half moved, every reading half is unchanged.
// RE-PINNED 2026-10-23 (fix-edit-flow): the shared `layer` field now says what
// the text and nav editors reach (a page section's button label and hours
// written into a page are "text"). Every request half moved; all 42 reading
// halves were measured unchanged.
// RE-PINNED 2026-10-28 (owner: "the model should be able to write everything"):
// the `addon` intent says that something the site DOES and does not do yet is
// an addition (its own server code is written for it). Every request half
// moved; all 42 reading halves were measured unchanged.
// 2026-11-02 (owner): the capabilities list left the router's prompt; every
// request half moved, every reading half was measured unchanged.
const FIRST_BUILD = {
  "first build | build": "3ec01a1782f8de11 875974b02cc063f2",
  "first build | clarify": "3ec01a1782f8de11 fa014374291facb7",
  "first build | clarifyBad": "3ec01a1782f8de11 7c9d619b5fd0f627",
  "first build | ask": "3ec01a1782f8de11 ec78522e2e36025a",
  "first build | edit": "3ec01a1782f8de11 0c80f6990c5f97f6",
  "first build | addon": "3ec01a1782f8de11 fdea739e65345892",
  "first build | junk": "3ec01a1782f8de11 4c7fd34810bd49f2",
  "first build, answering | build": "edd9ad2fb09d9e61 875974b02cc063f2",
  "first build, answering | clarify": "edd9ad2fb09d9e61 fa014374291facb7",
  "first build, answering | clarifyBad": "edd9ad2fb09d9e61 7c9d619b5fd0f627",
  "first build, answering | ask": "edd9ad2fb09d9e61 ec78522e2e36025a",
  "first build, answering | edit": "edd9ad2fb09d9e61 0c80f6990c5f97f6",
  "first build, answering | addon": "edd9ad2fb09d9e61 fdea739e65345892",
  "first build, answering | junk": "edd9ad2fb09d9e61 4c7fd34810bd49f2",
  "first build, attached | build": "83bcc0d44d723a6e 875974b02cc063f2",
  "first build, attached | clarify": "83bcc0d44d723a6e fa014374291facb7",
  "first build, attached | clarifyBad": "83bcc0d44d723a6e 7c9d619b5fd0f627",
  "first build, attached | ask": "83bcc0d44d723a6e ec78522e2e36025a",
  "first build, attached | edit": "83bcc0d44d723a6e 0c80f6990c5f97f6",
  "first build, attached | addon": "83bcc0d44d723a6e fdea739e65345892",
  "first build, attached | junk": "83bcc0d44d723a6e 4c7fd34810bd49f2",
  "first build, budget spent | build": "8b5ca607364e0a2a 875974b02cc063f2",
  "first build, budget spent | clarify": "8b5ca607364e0a2a f42a4d323c559e7e",
  "first build, budget spent | clarifyBad": "8b5ca607364e0a2a f42a4d323c559e7e",
  "first build, budget spent | ask": "8b5ca607364e0a2a ec78522e2e36025a",
  "first build, budget spent | edit": "8b5ca607364e0a2a 0c80f6990c5f97f6",
  "first build, budget spent | addon": "8b5ca607364e0a2a fdea739e65345892",
  "first build, budget spent | junk": "8b5ca607364e0a2a 4c7fd34810bd49f2",
  "no site, not first | build": "e46c8ea3859a5234 875974b02cc063f2",
  "no site, not first | clarify": "e46c8ea3859a5234 f42a4d323c559e7e",
  "no site, not first | clarifyBad": "e46c8ea3859a5234 f42a4d323c559e7e",
  "no site, not first | ask": "e46c8ea3859a5234 ec78522e2e36025a",
  "no site, not first | edit": "e46c8ea3859a5234 0c80f6990c5f97f6",
  "no site, not first | addon": "e46c8ea3859a5234 fdea739e65345892",
  "no site, not first | junk": "e46c8ea3859a5234 4c7fd34810bd49f2",
  "first build with hasSite | build": "e509c511d096da79 875974b02cc063f2",
  "first build with hasSite | clarify": "e509c511d096da79 fa014374291facb7",
  "first build with hasSite | clarifyBad": "e509c511d096da79 023fd0f1d16fa6a7",
  "first build with hasSite | ask": "e509c511d096da79 ec78522e2e36025a",
  "first build with hasSite | edit": "e509c511d096da79 e0554fbabf9529e2",
  "first build with hasSite | addon": "e509c511d096da79 046b4d324d467648",
  "first build with hasSite | junk": "e509c511d096da79 46a5bf52463d745e",
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

// A QUESTION ABOUT THE SITE IS NOT AN ANSWER (2026-10-23, audit A35-5): an
// `ask` reply the router marks answered:true closed the waiting question and,
// for a request part, marked the part done without its work.
test("A35-5 a side question read as answered:true is a side question: the waiting question is not answered by it", async () => {
  const pending = { request: "Add our Instagram link to the footer", question: Q, chosen: false };
  const side = await liveRoute({ intent: "ask", answered: true, answer: "Yes, that format works." }, { pending });
  assert.notEqual(side.r.failed, true, JSON.stringify(side.r));
  assert.equal(side.r.intent, "ask");
  assert.equal(side.r.answered, false, "a question about the site answered the waiting question");
  // The control: an edit that answers still answers.
  const yes = await liveRoute({ intent: "edit", layer: "text", answered: true }, { pending });
  assert.equal(yes.r.answered, true);
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

const asked = (name, extra = {}) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name, input: { ...extra, question: Q } }], usage: { input_tokens: 100, output_tokens: 20 } });
const HOME = { path: "src/routes/index.tsx", source: "export default function Home() {\n  return (\n    <main>\n      <h1>Fold Lane Bakery</h1>\n      <p>Open Wednesday to Saturday</p>\n      <img src=\"/u/s/c.jpg\" alt=\"The shopfront\" />\n    </main>\n  );\n}" };
const CHROME_HOME = { path: "index.tsx", source: "import { SiteChrome } from \"@/components/ui/site-chrome\";\nconst CHROME = { name: \"Harbour Loaf\", links: [{ label: \"Home\", href: \"/\" }, { label: \"Visit\", href: \"/visit\" }] };\nexport default function P() { return <SiteChrome {...CHROME}><p>Bread.</p></SiteChrome>; }" };
const LOAVES = [{ name: "loaves", columns: [{ name: "id" }, { name: "name" }, { name: "price" }], rows: [{ id: 1, name: "Rye", price: 4 }, { id: 2, name: "Spelt", price: 5 }] }];
const RULE_TABLES = [{ name: "bookings", access: "collect", columns: [{ name: "customer", type: "text" }, { name: "start_min", type: "integer" }] }];

// ─────────────────────────────────────────────────────────────────────────────
// CONTINUITY (2026-10-02, the owner's second review): the answers ride beside
// the request, every deciding model is shown the ones its change needs, and a
// question already answered is sent back with its answer — never an ending.
// ─────────────────────────────────────────────────────────────────────────────

const toolOf = () => withQuestion({ name: "t", input_schema: { type: "object", properties: { value: { type: "string" } } } });
const asking = (text) => ({ content: [{ type: "tool_use", name: "t", input: { value: "guessed", question: { text } } }], usage: { input_tokens: 9, output_tokens: 1 } });
const acting = (value = "x") => ({ content: [{ type: "tool_use", name: "t", input: { value } }], usage: { input_tokens: 5, output_tokens: 2 } });
const stepReq = () => ({ tools: [toolOf()], messages: [{ role: "user", content: "What they asked for:\nChange the photo" }] });

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
