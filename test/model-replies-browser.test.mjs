// THE CUSTOMER'S REPLY, WRITTEN BY A MODEL — THE PAGE'S OWN RULES (2026-10-03).
//
// What the page does with an answer that carries a reply, decided on the page
// and nowhere else: it shows a reply only when the server says a model wrote
// it, whole and within its bound, with the question's card under it when one
// was kept — and with nothing of its own beside it; a stop that is not an
// ordinary outcome keeps the page's fixed sentence whatever it carries; an
// escalate walks on. The routes that write the replies, and the page drawing
// what the real Worker answered, are `test/model-replies-routes.test.mjs`.
//
// Every server answer here is SUPPLIED, in the shapes `worker.js` answers.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { page, settle, copy } from "./fixtures/browser-page.mjs";

const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
const SLUG = "harbour-loaf";
const LIVE = { id: "origin-1", slug: SLUG, react: true, name: "Harbour Loaf", url: "https://" + SLUG + ".gofarther.app/", pages: [{ path: "/" }, { path: "/visit" }], msgs: [] };
const ROUTE = "/api/site/route";
const EDIT = "/api/site/" + SLUG + "/edit";
const ADDON = "/api/site/" + SLUG + "/addon";
const QID = "a".repeat(32);
const QID2 = "b".repeat(32);
const Q = { id: QID, text: "Which page should the band move on — Home or Visit?", options: ["Home", "Visit"] };
const STEP_Q = { id: QID2, text: "Which band is the order band — the one on Visit?", options: ["Yes", "No"] };
const REPLY = "I've changed your site's description. Adding a gallery page was left for your next message, so I haven't started on it.";
const model = (body, reply = REPLY) => ({ ...body, reply, replySource: "model" });
const routed = (over = {}) => ({ ok: true, intent: "edit", layer: "look", cost: 2, ...over });

test("THE PAGE USES A REPLY ONLY WHEN THE SERVER SAYS A MODEL WROTE IT: a string, trimmed, inside its bound — anything else is no reply", () => {
  assert.equal(EditPoll.modelReply({ reply: "  " + REPLY + "\n", replySource: "model" }), REPLY);
  // THE BOUND IS THE SERVER'S (`REPLY_MAX_CHARS`; 4,000 since 2026-10-03): at it, shown; past it, no reply.
  const MAX = EditPoll.MODEL_REPLY_MAX;
  assert.ok(MAX >= 4000, "the page refuses a reply long enough to tell a long outcome: " + MAX);
  assert.equal(EditPoll.modelReply({ reply: "x".repeat(MAX), replySource: "model" }), "x".repeat(MAX));
  for (const body of [
    null, "text", [], {},
    { reply: REPLY },
    { reply: REPLY, replySource: "server" },
    { reply: REPLY, replySource: "Model" },
    { reply: "   ", replySource: "model" },
    { reply: ["a"], replySource: "model" },
    { reply: 7, replySource: "model" },
    { reply: "x".repeat(MAX + 1), replySource: "model" },
  ]) assert.equal(EditPoll.modelReply(body), null, JSON.stringify(body).slice(0, 80));
});

test("AN EDIT'S REPLY IS THE WHOLE MESSAGE: a success shows it alone — no headline, tail or money of the page's own — and still does what a success does; a success with a step's question shows the question under it, with its card", async () => {
  {
    const reply = model({ ok: true, layer: "look", lanes: ["description"], moved: ["description"], cost: 1, deferred: ["add a gallery page"] });
    const p = page({ site: LIVE, answer: (url) => (url === ROUTE ? { body: routed({ alsoAsked: "add a gallery page" }) } : url === EDIT ? { body: reply } : null) });
    p.ctx.siteSend("Change the description, then add a gallery page");
    await settle();
    assert.deepEqual(p.last(), { r: "a", t: REPLY });
    assert.equal(p.busy(), false);
  }
  {
    const reply = model({ ok: true, layer: "look", lanes: ["description"], moved: ["description"], cost: 1, partial: [{ layer: "page", ok: false, error: "clarify", msg: STEP_Q.text }], clarify: STEP_Q }, "I've changed the description; one thing about the band first.");
    const p = page({ site: LIVE, answer: (url) => (url === ROUTE ? { body: routed() } : url === EDIT ? { body: reply } : null) });
    p.ctx.siteSend("Change the description, then move the band");
    await settle();
    assert.deepEqual(p.last(), { r: "a", t: "I've changed the description; one thing about the band first.\n" + STEP_Q.text, q: STEP_Q.text, opts: STEP_Q.options, ask: QID2 });
    assert.equal(p.ask().id, QID2, "the step's question did not become the live card");
  }
});

test("A STEP'S QUESTION WITH PARTS LEFT FOR LATER: nothing ran, so the reply only leads into the question — edit and add-on alike — and the page draws the question under it, with its card", async () => {
  for (const [name, url, routedAs] of [["edit", EDIT, routed()], ["add-on", ADDON, routed({ intent: "addon", layer: undefined })]]) {
    const reply = model({ ok: false, error: "clarify", cost: 0, unchanged: true, msg: STEP_Q.text, clarify: STEP_Q, putOff: ["add a gallery page"] }, "Nothing's changed yet, and the gallery page is still waiting for later — first, one question.");
    const p = page({ site: LIVE, answer: (u) => (u === ROUTE ? { body: routedAs } : u === url ? { status: 422, body: reply } : null) });
    p.ctx.siteSend("Move the band, and add a gallery page later");
    await settle();
    assert.deepEqual(p.last(), { r: "a", t: "Nothing's changed yet, and the gallery page is still waiting for later — first, one question.\n" + STEP_Q.text, q: STEP_Q.text, opts: STEP_Q.options, ask: QID2 }, name);
    assert.equal(p.ask().id, QID2, name + ": the question did not become the live card");
  }
});

test("AN EDIT REFUSED, WITH A REPLY: shown whole, never with the page's own warning, sentence or money beside it — and what a question that could not be kept left to do still goes back to the message box", async () => {
  const unkeptRest = "put the order band above the other one";
  const reply = model({ ok: false, error: "withheld", unchanged: true, cost: 0, msg: "There's no Gallery page on your site.", resume: unkeptRest }, "There's no Gallery page on your site, so nothing changed and it cost you nothing.");
  const p = page({ site: LIVE, answer: (url) => (url === ROUTE ? { body: routed() } : url === EDIT ? { status: 422, body: reply } : null) });
  p.ctx.siteSend("Make the gallery heading bigger");
  await settle();
  assert.deepEqual(p.last(), { r: "a", t: "There's no Gallery page on your site, so nothing changed and it cost you nothing." });
  assert.deepEqual(copy(p.s.unsent), [{ t: unkeptRest, imgs: [] }], "what was left to do did not go back to the box");
});

test("A STOP THAT IS NOT AN ORDINARY OUTCOME KEEPS THE PAGE'S OWN SENTENCE, WHATEVER IT CARRIES: a site under review is said as one and takes no more edits; an escalate walks on to the step it names", async () => {
  {
    const reply = model({ ok: false, error: "needs-review", msg: "under review" }, "Something went wrong but it's fine.");
    const p = page({ site: LIVE, answer: (url) => (url === ROUTE ? { body: routed() } : url === EDIT ? { status: 409, body: reply } : null) });
    p.ctx.siteSend("Make the footer blue");
    await settle();
    // THE PAGE'S OWN SENTENCE, by its kind (the harness stands `outcomeMessage` in as "outcome:<kind>").
    assert.equal(p.last().t, "⚠️ outcome:needs_review", "a reply beside a site under review was shown");
    assert.ok(p.ctx.editBlocked.has(SLUG), "the site under review was not blocked from more edits");
  }
  {
    let edits = 0;
    const p = page({ site: LIVE, answer: (url, method, body) => {
      if (url === ROUTE) return { body: routed() };
      if (url === EDIT) { edits++; return edits === 1 ? { body: model({ ok: false, escalate: true, layer: "page", reason: "needs-page" }, "Escalating!") } : null; }
      return null;
    } });
    p.ctx.siteSend("Make the visit page longer");
    await settle();
    assert.equal(edits, 2, "the escalate did not walk on to the step it names");
    assert.ok(!p.said().some((m) => m.t === "Escalating!"), "a reply on an escalate was shown");
  }
});

test("AN ADD-ON'S REPLY IS THE WHOLE MESSAGE TOO: a success alone, a success with its question under it, a refusal without the page's warning or tail", async () => {
  for (const [name, body, status, want] of [
    ["success", model({ ok: true, added: ["gallery.tsx"], cost: 4, deferred: ["change the footer"] }, "Your new Gallery page is live. Changing the footer is for next time."), 200,
      { r: "a", t: "Your new Gallery page is live. Changing the footer is for next time." }],
    ["success with a question", model({ ok: true, added: ["gallery.tsx"], cost: 4, clarify: STEP_Q }, "Your Gallery page is up; one question about the band."), 200,
      { r: "a", t: "Your Gallery page is up; one question about the band.\n" + STEP_Q.text, q: STEP_Q.text, opts: STEP_Q.options, ask: QID2 }],
    ["refusal", model({ ok: false, error: "declined", cost: 0, msg: "That needs a payment provider." }, "Taking deposits needs a payment provider first, so nothing was added."), 422,
      { r: "a", t: "Taking deposits needs a payment provider first, so nothing was added." }],
  ]) {
    const p = page({ site: LIVE, answer: (url) => (url === ROUTE ? { body: routed({ intent: "addon", layer: undefined }) } : url === ADDON ? { status, body } : null) });
    p.ctx.siteSend("Add a gallery page");
    await settle();
    assert.deepEqual(p.last(), want, name);
  }
});

test("A REPLACEMENT THAT LOST A RACE, WITH A REPLY: shown whole, the message back in the box to send again, the card off — and nothing sent", async () => {
  const reply = { ok: false, error: "question-busy", cost: 0, msg: "busy", reply: "Your last question was being answered elsewhere just then, so I didn't act on this. Send it again and I'll pick it up.", replySource: "model" };
  const p = page({ site: { ...LIVE, ask: { id: QID, text: Q.text, options: Q.options, attached: false }, msgs: [{ r: "u", t: "Move the band" }, { r: "a", t: Q.text, q: Q.text, opts: Q.options, ask: QID }] }, answer: (url) => (url === ROUTE ? { status: 409, body: reply } : null) });
  p.ctx.siteSend("Actually, make the footer blue");
  await settle();
  assert.equal(p.calls.length, 1, "work was sent after the replacement lost its race");
  assert.deepEqual(p.last(), { r: "a", t: reply.reply });
  assert.deepEqual(copy(p.s.unsent), [{ t: "Actually, make the footer blue", imgs: [] }]);
  assert.equal(p.ask(), null);
});
