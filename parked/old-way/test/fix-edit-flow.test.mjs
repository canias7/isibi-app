// PARKED (2026-11-03, park-old-way): the old-way half of test/fix-edit-flow.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE EDIT FLOW'S LIVE FAULTS, FIXED (2026-10-23, fix-edit-flow).
//
// Found by the live tests on `saltmarsh-and-sparrow` (2026-10-23). One guard
// per item, each red on the code before this branch:
//
//   A  the router's layer field says what each editor REACHES: a page
//      section's button label and a timetable written into a page are the
//      text step's; the menu editor reaches only the frame.
//   B  a price ("£4.25") is words the text step can see; a requested change
//      the text step did not make is reported (`notDone`), the part partial.
//   C  an added review whose quote and attribution render apart is landed.
//   D  the request's summary states what each part's step recorded doing,
//      never "Done: <the words they asked with>".
//   E  a carved part waits for the page its parent creates and is not run
//      when that broke; its own routing is not charged again; a frame link to
//      a page the site lacks is refused before the menu editor.
//   F  a question waiting on the customer is not running work (Send shows);
//      every step's question carries answers; "Cancel this request" ends the
//      card's part whatever the site's one slot holds; Stop clears the
//      question, and an answer to a stale question goes as a new message.
//
// WHAT THIS CANNOT SHOW: which answer a real model gives. The router and step
// answers here are supplied, in the shape each tool tells the model to give.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ASK_TOOL } from "../../../builder/route-shared.mjs";
import { extractText } from "../../../builder/site-text.mjs";
import { runTextEdit, TEXT_TOOL } from "../../../builder/site-apply.mjs";
import { editReplyFacts, requestReplyFacts } from "../../../builder/site-reply.mjs";
import { notDoneOf, partOf, readRequestOf } from "../../../builder/request.mjs";
import * as ADD from "../../../builder/site-add.mjs";
const { wordsLanded, pickTool } = ADD;
// Read off the module so the other cases still run against code without them (the red check).
const readFrameTo = (...a) => ADD.readFrameTo(...a);
const frameToMissing = (...a) => ADD.frameToMissing(...a);
import { QUESTION_FIELD } from "../../../builder/clarify.mjs";
import { platform, sendMessage, settle, call, T, USER } from "../../../test/fixtures/request-flow.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";

const LAYER = ASK_TOOL.input_schema.properties.layer.description;
const LINES = LAYER.split("\n");
function clause(layer, next) {
  const at = LINES.findIndex((l) => l.startsWith("\"" + layer + "\" — "));
  const end = LINES.findIndex((l) => l.startsWith("\"" + next + "\" — "));
  assert.ok(at >= 0 && end > at, "the " + layer + " clause's landmarks moved");
  return LINES.slice(at, end).join("\n");
}

const PAGE_SRC = "export const Route = createFileRoute('/')({ component: Home })\nfunction Home(){ return <main><h1>Saltmarsh</h1><p>Flat white</p><p>£4.25</p><p>Open from 9.</p></main> }\n";
const textReply = (input) => ({ content: [{ type: "tool_use", name: TEXT_TOOL.name, input }], usage: { input_tokens: 10, output_tokens: 5 } });

// ── C ────────────────────────────────────────────────────────────────────────
const WL = "export const Route = createFileRoute('/')({ component: Home })\nfunction Home(){ return <main><h1>Saltmarsh</h1>\n</main> }\n";
const wl = (html, words) => wordsLanded([{ path: "index.tsx", source: WL }], [{ path: "index.tsx", source: WL.replace("</main>", html + "\n</main>") }], [{ page: "/", words }]).ok;

// ── E ────────────────────────────────────────────────────────────────────────
const GALLERY_ADD = "add a gallery page";
const MENU = "put Gallery in the menu";
const DARK = "make the menu bar dark";
test("E1+E2 — a carved part that reads the page its parent was to create is not run when the parent failed, and its routing is not charged", async () => {
  const compiler = installCompiler();
  const P = platform({
    slug: "rq-e1-" + Math.random().toString(16).slice(2, 8),
    answers: {
      route: [
        { intent: "addon", alsoAsked: [MENU + " and " + DARK], targets: [{ change: 0, writes: ["new-page:/gallery"] }] },
        // PART 1'S OWN ROUTING CARVES PART 2 FROM ITS WORDS (`carveParts`).
        { intent: "edit", layer: "nav", alsoAsked: [DARK], targets: [{ change: 0, writes: ["menu"], reads: ["page:/gallery"] }] },
        { intent: "edit", layer: "look" },
      ],
      // THE PAGE DESIGNER HAS NO ANSWER: the addition fails.
      [T.adds]: { kinds: ["page"] },
    },
  });
  try {
    const r = await sendMessage(P, { message: GALLERY_ADD + ", and " + MENU + " and " + DARK + "." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "failed", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[1].status, "not-run", "the menu link ran without the page it needed: " + JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[1].why, "needs:0");
    // THE CARVED PART'S ROUTING JOB WAS NOT CHARGED; the held part's still is.
    assert.equal(rec.parts[2].source, "carved");
    const routeOf = (n) => P.jobsOf(r.key).find((j) => j.op === "route" && rec.parts[n].jobs.some((x) => x.id === j.id));
    const reserve = (j) => P.ledger.filter((e) => e.ref.startsWith(j.id + "#") && e.reason === "reserve").map((e) => e.delta);
    assert.ok(routeOf(2), "the carved part was never routed: " + JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(reserve(routeOf(2)), [], "a carved part's routing was charged again");
    assert.deepEqual(reserve(routeOf(1)), [-1]);
  } finally { P.close(); compiler.uninstall(); }
});

test("E1 — with nothing carved after it, a part's own routing naming what it reads makes it wait for the page another part creates (not run when that broke)", async () => {
  const compiler = installCompiler();
  const P = platform({
    slug: "rq-e1b-" + Math.random().toString(16).slice(2, 8),
    answers: {
      route: [
        { intent: "addon", alsoAsked: [MENU], targets: [{ change: 0, writes: ["new-page:/gallery"] }] },
        { intent: "edit", layer: "nav", targets: [{ change: 0, writes: ["menu"], reads: ["page:/gallery"] }] },
      ],
      [T.adds]: { kinds: ["page"] },
    },
  });
  try {
    const r = await sendMessage(P, { message: GALLERY_ADD + ", and " + MENU + "." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(rec.parts.map((p) => [p.status, p.why]), [["failed", rec.parts[0].why], ["not-run", "needs:0"]]);
  } finally { P.close(); compiler.uninstall(); }
});

test("E3 — the add-on route refuses a lone frame link to a page the site lacks, at no cost, before the menu editor", async () => {
  const compiler = installCompiler();
  const P = platform({
    slug: "rq-e3-" + Math.random().toString(16).slice(2, 8),
    answers: {
      route: [{ intent: "addon" }],
      [T.adds]: { kinds: ["frame"], scopes: [{ kind: "frame", words: MENU, uses: [], to: "/gallery" }] },
    },
  });
  try {
    const r = await sendMessage(P, { message: MENU + "." });
    const { rec } = await settle(P, r.key);
    const jobs = P.jobsOf(r.key);
    assert.ok(!jobs.some((j) => j.op === "edit"), "the link was handed to the menu editor: " + jobs.map((j) => j.op).join(","));
    const a = P.answerOf(jobs.find((j) => j.op === "addon"));
    assert.equal(a.reason, "frame-no-page", JSON.stringify(a));
    assert.equal(a.cost, 0);
    assert.notEqual(rec.parts[0].status, "done");
  } finally { P.close(); compiler.uninstall(); }
});

// ── F ────────────────────────────────────────────────────────────────────────
const CHAT = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
/** One top-level function of chat.js, from its landmark to the next top-level line. */
function chatFn(name) {
  const at = CHAT.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, name + " is gone from chat.js");
  const end = CHAT.indexOf("\n}\n", at);
  assert.ok(end > at);
  return CHAT.slice(at + 1, end + 2);
}

test("F3 — cancelling a request part's question ends that part even when the site's slot holds another question, and the slot is left as it is", async () => {
  const ADD = "add a gallery page";
  const Q = { text: "Which word should lead — overnight or slow?", options: ["Overnight", "Slow"] };
  const DESC = "Change the site description to say we bake overnight sourdough";
  const compiler = installCompiler();
  const P = platform({
    slug: "rq-f3-" + Math.random().toString(16).slice(2, 8),
    answers: {
      // A part's routing never asks after the charge (owner, 2026-10-25): part 0's step asks.
      route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }],
      [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": (args, n) => (n === 0 ? { question: Q } : "Overnight sourdough."),
    },
  });
  try {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    const other = { v: 2, id: "f".repeat(32), uid: USER.id, slug: P.slug, stage: "route", round: 1, question: { text: "Something else?", options: ["Yes", "No"] }, request: "Something else", held: [], at: P.now(), status: "pending", attached: false, context: [] };
    await P.bucket.put("source/" + P.slug + "/question.json", JSON.stringify(other));
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting");
    const qid = s1.rec.parts[0].question.id;
    assert.notEqual(qid, other.id);
    // AS THE CARD SENDS IT: its own question id and its request part.
    const c = await call(P, "POST", "/api/site/" + P.slug + "/question", { id: qid, cancel: true, request: { key: r.key, part: 0 } });
    assert.equal(c.body.cancelled, true, "the card's part was not cancelled: " + JSON.stringify(c.body));
    assert.equal(P.record(r.key).parts[0].status, "cancelled");
    assert.equal(P.question().id, other.id);
    assert.equal(P.question().status, "pending", "another question in the slot was closed");
    // A WRONG QUESTION ID FOR THAT PART ENDS NOTHING.
    const P2rec = P.record(r.key);
    assert.notEqual(P2rec.parts[1].status, "cancelled");
  } finally { P.close(); compiler.uninstall(); }
});
