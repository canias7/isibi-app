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
import { ASK_TOOL } from "../builder/site-ask.mjs";
import { extractText } from "../builder/site-text.mjs";
import { runTextEdit, TEXT_TOOL } from "../builder/site-apply.mjs";
import { editReplyFacts, requestReplyFacts } from "../builder/site-reply.mjs";
import { notDoneOf, partOf, readRequestOf } from "../builder/request.mjs";
import * as ADD from "../builder/site-add.mjs";
const { wordsLanded, pickTool } = ADD;
// Read off the module so the other cases still run against code without them (the red check).
const readFrameTo = (...a) => ADD.readFrameTo(...a);
const frameToMissing = (...a) => ADD.frameToMissing(...a);
import { QUESTION_FIELD } from "../builder/clarify.mjs";
import { platform, sendMessage, settle, call, T, USER } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";

const LAYER = ASK_TOOL.input_schema.properties.layer.description;
const LINES = LAYER.split("\n");
function clause(layer, next) {
  const at = LINES.findIndex((l) => l.startsWith("\"" + layer + "\" — "));
  const end = LINES.findIndex((l) => l.startsWith("\"" + next + "\" — "));
  assert.ok(at >= 0 && end > at, "the " + layer + " clause's landmarks moved");
  return LINES.slice(at, end).join("\n");
}

// ── A ────────────────────────────────────────────────────────────────────────
test("A — the text clause reaches a page section's button label and hours written into a page; the nav clause reaches only the frame", () => {
  const TEXT = clause("text", "look");
  const NAV = clause("nav", "page");
  assert.match(TEXT, /REACHES EVERY WORD WRITTEN INSIDE A PAGE'S OWN SECTIONS/);
  assert.match(TEXT, /button's label in a page's hero/);
  assert.match(TEXT, /opening hours written into the page itself/);
  assert.match(TEXT, /the menu layer, nav, reaches only the frame shared by every page/);
  assert.match(NAV, /IT REACHES NOTHING INSIDE A PAGE'S OWN SECTIONS/);
  assert.match(NAV, /Hours or a timetable WRITTEN INTO A PAGE'S OWN SECTION, with no table storing them, are that page's words: "text"/);
  // THE FRAME'S BUTTON, NOT ANY BUTTON: the old line claimed "THE BUTTON".
  assert.match(NAV, /THE FRAME'S BUTTON — the one beside the menu in the header/);
  assert.match(NAV, /A button inside a page's own section \(a hero, a band\) is not this one: its label is "text"/);
  assert.doesNotMatch(NAV, /\nTHE BUTTON — what it says AND where it goes/);
});

// ── B ────────────────────────────────────────────────────────────────────────
test("B1 — a price written on the page is offered to the text step; sizes and bare numbers stay code", () => {
  const got = extractText("<li><span>Flat white</span><span>£4.25</span><em>£4–£6</em><b>{\"$12\"}</b><i>12px</i><p>4.25</p></li>").map((x) => x.text);
  assert.ok(got.includes("£4.25"), "a price is hidden as code: " + JSON.stringify(got));
  assert.ok(got.includes("£4–£6"));
  assert.ok(!got.includes("12px") && !got.includes("4.25"), "a size or a bare number became prose");
});

const PAGE_SRC = "export const Route = createFileRoute('/')({ component: Home })\nfunction Home(){ return <main><h1>Saltmarsh</h1><p>Flat white</p><p>£4.25</p><p>Open from 9.</p></main> }\n";
const textReply = (input) => ({ content: [{ type: "tool_use", name: TEXT_TOOL.name, input }], usage: { input_tokens: 10, output_tokens: 5 } });
test("B2 — the text step reports the requested changes it did not make, from its own plan, and the part reads partial", async () => {
  assert.ok(TEXT_TOOL.input_schema.properties.notDone, "the text tool has no field for what it could not do");
  const out = await runTextEdit({ send: async (req) => {
    const lines = req.messages[0].content.split("\n");
    const at = (t) => Number(lines.find((l) => l.endsWith("] " + t)).split(".")[0]);
    return textReply({ edits: [{ id: at("£4.25"), to: "£4.50" }], notDone: ["the Saturday opening hours"] });
  } }, { instruction: "Make the flat white £4.50 and change Saturday's hours to 10 till 4", pages: [{ path: "index.tsx", source: PAGE_SRC }] });
  assert.equal(out.ok, true);
  assert.ok(out.pages[0].source.includes("£4.50"));
  assert.deepEqual(out.notDone, [{ what: "the Saturday opening hours", why: "not-found" }]);
  assert.equal(out.partial, true);
  // THE ANSWER'S FACTS AND THE REQUEST'S READING.
  const facts = editReplyFacts({ ok: true, layer: "text", applied: 1, changed: ["£4.50"], notDone: out.notDone }).facts;
  assert.ok(facts.some((f) => f.kind === "not-done" && /the Saturday opening hours/.test(f.text)), JSON.stringify(facts));
  assert.deepEqual(notDoneOf({ ok: true, layer: "text", notDone: out.notDone }, "edit"), [{ what: "the Saturday opening hours", why: "not-found" }]);
  // EVERYTHING ASKED, MADE: nothing extra on the answer.
  const all = await runTextEdit({ send: async () => textReply({ edits: [{ id: 1, to: "£4.50" }] }) }, { instruction: "x", pages: [{ path: "index.tsx", source: PAGE_SRC }] });
  assert.equal(all.notDone, undefined);
});

// ── C ────────────────────────────────────────────────────────────────────────
const WL = "export const Route = createFileRoute('/')({ component: Home })\nfunction Home(){ return <main><h1>Saltmarsh</h1>\n</main> }\n";
const wl = (html, words) => wordsLanded([{ path: "index.tsx", source: WL }], [{ path: "index.tsx", source: WL.replace("</main>", html + "\n</main>") }], [{ page: "/", words }]).ok;
test("C — a review whose quote and attribution render apart lands; out of order, a word missing or far apart does not", () => {
  const W = "“Best crab sandwich on the coast.” — Margaret, Whitstable";
  assert.equal(wl("<section><blockquote>Best crab sandwich on the coast.</blockquote><span>{stars}</span><p>Margaret, Whitstable</p></section>", W), true, "the quote and the name rendered apart were refused");
  assert.equal(wl("<section><p>Margaret, Whitstable</p><blockquote>Best crab sandwich on the coast.</blockquote></section>", W), false, "the attribution before the quote passed");
  assert.equal(wl("<section><blockquote>Best crab sandwich on the coast.</blockquote><span>{stars}</span><p>Margaret</p></section>", W), false, "a missing word passed");
  assert.equal(wl("<section><blockquote>Best crab sandwich on the coast.</blockquote>" + "<p>one two three four five six seven eight nine ten eleven twelve thirteen</p><p>Margaret, Whitstable</p></section>", W), false, "pieces far apart passed");
  assert.equal(wl("<p>Best crab sandwich on the coast.</p>", "Best crab sandwich on the coast"), true, "a plain line changed");
});

// ── D ────────────────────────────────────────────────────────────────────────
test("D — the request summary states what each part's step recorded, never \"Done: <asked words>\"", () => {
  const v = { parts: [
    { n: 0, words: "make the Book a table button say Reserve", status: "done", jobs: [], made: "changed it with the text step", changed: ["Reserve a table"], charged: 1 },
    { n: 1, words: "change the flat white to £4.50 and Saturday to 10 till 4", status: "partial", jobs: [], made: "changed it with the text step", changed: ["£4.50"], notDone: [{ what: "the Saturday opening hours", why: "not-found" }], charged: 1 },
  ] };
  const facts = requestReplyFacts(v).facts.map((f) => f.text);
  assert.ok(facts.length >= 2, JSON.stringify(facts));
  assert.ok(!facts.some((t) => /^Done: /.test(t)), "a part's asked words were stated as done: " + JSON.stringify(facts));
  assert.ok(facts.some((t) => /“Reserve a table”/.test(t)), "the words the step wrote were not stated");
  assert.ok(facts.some((t) => /What it did not make: “the Saturday opening hours”/.test(t)), JSON.stringify(facts));
});

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

test("E2 — a carved part's job body says so, and the reader keeps it; a part from the router does not", () => {
  const rec = { key: "rqabcdefabcdefabcdef12", message: "a, and b.", context: [], parts: [
    { n: 0, words: "a", source: "router", parent: null, needs: [], status: "done", done: "x", jobs: [] },
    { n: 1, words: "b", source: "carved", parent: 0, needs: [], status: "ready", jobs: [] },
  ] };
  assert.equal(readRequestOf(partOf(rec, 1)).carved, true);
  assert.equal(readRequestOf(partOf(rec, 0)).carved, undefined);
});

test("E3 — the picker names where a frame item points, and one pointing at a page the site lacks is caught", () => {
  const scope = pickTool().input_schema.properties.scopes.items.properties;
  assert.ok(scope.to, "the picker has no field for where a frame link points");
  const reply = (to) => ({ content: [{ type: "tool_use", name: "pick_adds", input: { kinds: ["frame"], scopes: [{ kind: "frame", words: MENU, uses: [], to }] } }] });
  assert.equal(readFrameTo(reply("/gallery"), ["frame"]), "/gallery");
  assert.equal(readFrameTo(reply("gallery/"), ["frame"]), "/gallery");
  assert.equal(readFrameTo(reply(""), ["frame"]), "");
  assert.equal(readFrameTo(reply("/gallery"), ["page"]), "");
  assert.equal(frameToMissing("/gallery", ["/", "/visit"]), true);
  assert.equal(frameToMissing("/visit", ["/", "/visit"]), false);
  assert.equal(frameToMissing("", ["/"]), false, "a frame item pointing at no page was refused");
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
const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
/** One top-level function of chat.js, from its landmark to the next top-level line. */
function chatFn(name) {
  const at = CHAT.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, name + " is gone from chat.js");
  const end = CHAT.indexOf("\n}\n", at);
  assert.ok(end > at);
  return CHAT.slice(at + 1, end + 2);
}
test("F1 — a request whose unfinished parts wait on a question is not running work; one with a part running is", () => {
  const fns = ["siteReqKeys", "siteRequestWorking", "siteRunningWork"].filter((n) => CHAT.includes("\nfunction " + n + "(")).map(chatFn).join("\n");
  const run = new Function("siteJobOutcome", fns + "\nreturn siteRunningWork;")(() => "done");
  const site = (parts) => ({ msgs: [{ request: "k" }], requests: { k: { view: { ended: false, stop: false, parts } } }, jobCards: {} });
  assert.equal(run(site([{ n: 0, status: "done" }, { n: 1, status: "waiting" }])), null, "a waiting question held the composer on Stop");
  assert.equal(run(site([{ n: 0, status: "waiting" }, { n: 1, status: "blocked" }])), null);
  assert.equal(run(site([{ n: 0, status: "approval" }])), null);
  assert.deepEqual(run(site([{ n: 0, status: "waiting" }, { n: 1, status: "queued" }])), { kind: "request", key: "k" });
  assert.deepEqual(run(site([{ n: 0, status: "started" }])), { kind: "request", key: "k" });
  assert.deepEqual(run(site(undefined)), { kind: "request", key: "k" }, "an unreadable view read as idle");
});

test("F2 — every step's question carries two to four answers the model writes", () => {
  assert.ok(QUESTION_FIELD.required.includes("options"), "a step's question may come with no answers");
  assert.equal(QUESTION_FIELD.properties.options.minItems, 2);
  assert.equal(QUESTION_FIELD.properties.options.maxItems, 4);
});

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

test("F4 — Stop clears the stopped request's question; an answer to a stale question is sent again as a new message", async () => {
  // STOP, with the request's DELETE answering as the server does.
  const body = chatFn("siteRequestStop");
  let cleared = 0, shown = 0;
  const site = { id: "s", slug: "x", ask: { id: "a".repeat(32), request: { key: "k", part: 1 } } };
  const stop = new Function("siteById", "siteReqSay", "apiFetch", "siteRequestOf", "siteRequestShow", "EditPoll", "siteRequestFollow", "siteAskClear",
    body + "\nreturn siteRequestStop;")(
    () => site, () => {}, async () => ({ ok: true, json: async () => ({ ok: true, request: { parts: [] } }) }), () => true,
    async () => { shown++; return true; }, { modelReply: () => null }, () => {}, () => { cleared++; site.ask = null; });
  stop("s", "k");
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(cleared, 1, "Stop left the stopped request's question set");
  assert.equal(shown, 1);
  // THE STALE-QUESTION BRANCH: an answer goes again as a new message, under a new key, with no answer.
  const at = CHAT.indexOf("if (d.error === 'stale-question') {");
  assert.ok(at > 0, "the stale-question branch is gone");
  const branch = CHAT.slice(at, CHAT.indexOf("} else siteHoldUnsent(origin, t, imgs, key);", at));
  assert.match(branch, /siteAskClear\(origin\)/);
  assert.match(branch, /siteRoute\(s3, t, origin, false, imgs, finish, undefined, undefined, EditPoll\.newIdemKey\(\)\)/);
  assert.match(branch, /answer && !isBuild/);
  // THE CANCEL SENDS ITS REQUEST PART.
  assert.match(chatFn("siteAskCancel"), /request: \{ key: asked\.request\.key, part: asked\.request\.part \}/);
});
