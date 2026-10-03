// THE CUSTOMER'S REPLY, WRITTEN BY A MODEL FROM WHAT REALLY HAPPENED — THE
// MODULE (2026-10-03).
//
// Owner: *"Make normal customer-facing messages throughout edit and add-on
// model-written … Code must supply structured, verified facts about what
// changed, what failed, what remains pending, and whether input is needed; the
// model should explain those facts naturally … without inventing outcomes or
// changing execution decisions. Keep fixed messages only for genuine technical
// failures … an HTTP status alone must not turn a normal product outcome into
// that exception … A reply-generation failure must never rerun completed
// work."*
//
// WHAT THIS FILE HOLDS: builder/site-reply.mjs on its own — which facts each
// kind of ending yields, which endings get none (and why), what one call
// sends, what makes an answer usable, and how a call that fails, times out or
// leaves a fact out comes back. The routes that use it, the poll that writes a
// queued job's reply once, and what the page then shows are driven in
// `test/model-replies-routes.test.mjs`.
import test from "node:test";
import assert from "node:assert/strict";
import {
  repliesOn, REPLY_SOURCE, REPLY_MAX_CHARS, REPLY_TOOL, REPLY_SYSTEM, TECHNICAL, technicalAnswer, pathOf,
  editReplyFacts, addonReplyFacts, routeReplyFacts, cancelReplyFacts, repeatNoteFacts,
  replyContext, replyRequest, readReply, writeReply, withReplyText,
} from "../builder/site-reply.mjs";
import { MAX_NOTE_CHARS } from "../builder/clarify.mjs";
import { createRequire } from "node:module";

const kinds = (r) => r.facts.map((f) => f.kind);
const texts = (r) => r.facts.map((f) => f.text);
const ids = (r) => r.facts.map((f) => f.id);
/** A model's answer through the forced tool, in the provider's own shape. */
const said = (input, usage = { input_tokens: 40, output_tokens: 20 }) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: REPLY_TOOL.name, input }], usage });
/** The facts one reply request showed, read off its own user message. */
const shownIn = (req) => [...String(req.messages[0].content).matchAll(/^\[([a-z]\d+)\] (.+)$/gm)].map((m) => ({ id: m[1], text: m[2] }));

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE SWITCH, AND WHAT COUNTS AS OURS
// ─────────────────────────────────────────────────────────────────────────────

test("THE SWITCH IS `MODEL_REPLIES` = \"on\" AND NOTHING ELSE: unset, off, a boolean or a number keeps every reply as it was", () => {
  for (const v of ["on", " ON ", "On"]) assert.equal(repliesOn({ MODEL_REPLIES: v }), true, JSON.stringify(v));
  for (const v of [undefined, "", "off", "true", "yes", true, 1, null]) assert.equal(repliesOn({ MODEL_REPLIES: v }), false, JSON.stringify(v));
  assert.equal(repliesOn(undefined), false);
  assert.equal(repliesOn({}), false);
  assert.equal(REPLY_SOURCE, "model");
});

test("A FAILURE OF OURS IS DECIDED BY WHAT THE ANSWER SAYS, NEVER BY ITS STATUS: `ours`, a platform stop, an unbilled charge that is not the balance, a reason on the fixed list — and nothing else", () => {
  for (const body of [
    { ok: false, ours: true, error: "clarify-unkept" },
    { ok: false, error: "send" },
    { ok: false, error: "store" },
    { ok: false, error: "needs-review" },
    { ok: false, review: true, error: "cancelled" },
    { ok: false, error: "unbilled" },
    { ok: false, error: "unbilled", detail: "ledger" },
    { failed: true, intent: "addon" },
  ]) assert.equal(technicalAnswer(body), true, JSON.stringify(body));
  // ORDINARY OUTCOMES, whatever status they were sent with: a page the site does
  // not have, a change already in place, a cancel, a compile that did not come
  // together, a refusal to add, an empty balance.
  for (const body of [
    { ok: false, error: "no-page", status: 503 },
    { ok: false, error: "withheld", unchanged: true },
    { ok: false, error: "cancelled", status: 503 },
    { ok: false, error: "compile" },
    { ok: false, error: "declined" },
    { ok: false, error: "add", kind: "row" },
    { ok: false, error: "unbilled", detail: "insufficient" },
    { ok: false, error: "stale-question" },
    { ok: true, layer: "text" },
  ]) assert.equal(technicalAnswer(body), false, JSON.stringify(body));
  // THE LIST NAMES REASONS, AND EVERY ONE IS A FAILURE OF OURS: a store, a
  // provider, a service, a state we cannot read.
  for (const ordinary of ["no-page", "withheld", "cancelled", "compile", "declined", "clarify", "add", "already", "take-off", "not-removable", "rename", "qr", "stale-question", "answer-too-long", "answers-full", "question-busy"]) {
    assert.equal(TECHNICAL.has(ordinary), false, ordinary + " is an ordinary outcome and is on the technical list");
  }
  // ONE REASON, TWO OUTCOMES, AND `ours` DECIDES: the page-keep check's
  // `withheld` is ordinary when the check found content the change would lose
  // (409), and ours when the check could not be made (503, `ours: true`).
  assert.equal(editReplyFacts({ ok: false, error: "withheld", cost: 0, msg: "That would take out the opening hours, so I left the page alone." }).skip, null);
  assert.equal(editReplyFacts({ ok: false, error: "withheld", cost: 0, ours: true, msg: "I couldn't check what that change would keep, so I left the page alone." }).skip, "technical");
  assert.equal(TECHNICAL.has("withheld"), false);
  // AND AN EDIT'S FACTS FOLLOW IT: a technical answer is skipped, an ordinary refusal at a 503 is not.
  assert.equal(editReplyFacts({ ok: false, error: "send", msg: "The builder could not be reached." }).skip, "technical");
  assert.equal(editReplyFacts({ ok: false, error: "cancelled", msg: "I stopped that edit before anything was published.", cost: 0 }).skip, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE FACTS OF AN EDIT
// ─────────────────────────────────────────────────────────────────────────────

test("COMPLETE SUCCESS: each layer's own result is a fact — the new wording, the entries, the page, the look, a step's own account — and the render sentence, the undo and a photograph lost are facts too", () => {
  const text = editReplyFacts({ ok: true, layer: "text", applied: 2, changed: ["Fresh bread daily"], cost: 1 });
  assert.equal(text.skip, null);
  assert.deepEqual(text.facts, [{ id: "c1", kind: "changed", text: "Changed the wording in 2 places; it now reads “Fresh bread daily”." }]);

  const data = editReplyFacts({ ok: true, layer: "data", applied: [
    { table: "loaves", id: 4, column: "price" },
    { table: "loaves", removed: true, was: { id: 7, name: "Rye", price: 5 } },
  ] });
  assert.deepEqual(kinds(data), ["changed", "changed", "undo"]);
  assert.match(texts(data)[0], /^Updated one entry in loaves\.$/);
  assert.match(texts(data)[1], /Removed an entry from loaves \(name Rye, price 5\)/);
  assert.match(texts(data)[2], /put Rye back/);

  const removed = editReplyFacts({ ok: true, layer: "page", removed: ["src/routes/gallery.tsx"], cost: 0 });
  assert.deepEqual(texts(removed), ["Took /gallery off the site.", "Every published version is kept, so a page taken off can be put back if they ask."]);

  const look = editReplyFacts({ ok: true, layer: "look", moved: ["description", "brand"], renamed: 3, pageOps: [{ page: "/visit" }], renderNote: "The page drew, but one heading is hard to read on its background." });
  assert.deepEqual(kinds(look), ["changed", "changed", "changed", "note"]);
  assert.match(texts(look)[0], /^Changed the description and the name\.$/);
  assert.equal(texts(look)[1], "Updated /visit.");
  assert.equal(texts(look)[2], "Changed the name in 3 places on the pages too.");
  assert.equal(texts(look)[3], "The page drew, but one heading is hard to read on its background.", "the render sentence is not a fact the reply must cover");

  const nav = editReplyFacts({ ok: true, layer: "nav", msg: "✅ Took Gallery out of the menu on every page." });
  assert.deepEqual(texts(nav), ["What the builder reports it did: “Took Gallery out of the menu on every page.”"]);
  const rules = editReplyFacts({ ok: true, layer: "rules", msg: "Bookings are closed." });
  assert.deepEqual(kinds(rules), ["changed", "note"]);

  const photo = editReplyFacts({ ok: true, layer: "look", lookNote: "Took the photo off the Visit page.", photosRemoved: 1, photosTakenOff: 1 });
  assert.deepEqual(kinds(photo), ["changed", "changed", "undo"]);
  assert.match(texts(photo)[2], /Cloud → Versions/);
});

test("PARTIAL COMPLETION: what ran, then each part that did not and the builder's own reason for it — a part that gave none is named — what those parts still cost, and what was left for later", () => {
  const r = editReplyFacts({
    ok: true, layer: "look", moved: ["description"], cost: 3,
    partial: [{ layer: "page", msg: "There's no Gallery page on your site, so I left that part alone.", cost: 0 }, { layer: "nav", cost: 2 }],
    deferred: ["add a gallery page"],
  });
  assert.equal(r.skip, null);
  assert.deepEqual(kinds(r), ["changed", "not-done", "not-done", "money", "pending"]);
  // EACH NAMED BY ITS TARGET SINCE 2026-10-03 (the mixed-work fixes: *"Do not
  // replace missing targets with a vague count."*) — here the only one these
  // parts carry, their layer.
  assert.match(texts(r)[1], /^This part was not done: a page\. The builder's own reason: “There's no Gallery page on your site, so I left that part alone\.”/);
  assert.equal(texts(r)[2], "This part was not done: the menu or the header button. No reason was recorded; asking for it again on its own will say why.");
  assert.equal(texts(r)[3], "That part still cost 2 credits.");
  assert.match(texts(r)[4], /^Left for later, so not tried this time \(they can send it next\): “add a gallery page”$/);
  // EACH ID ONCE, BY KIND, IN ORDER: what a reply's `covers` is held to.
  assert.deepEqual(ids(r), ["c1", "f1", "f2", "m1", "p1"]);
});

test("A STEP'S QUESTION: alone, it is the reply (the model's own words, drawn with its card) and no call is made; beside work done, a part left for later or a refusal, the reply leads into it", () => {
  const alone = editReplyFacts({ ok: false, error: "clarify", cost: 0, unchanged: true, clarify: { id: "a".repeat(32), text: "Which band?", options: ["Top", "Bottom"] } });
  assert.deepEqual(alone, { skip: "question-only", facts: [] });
  const held = editReplyFacts({ ok: false, error: "clarify", cost: 0, clarify: { id: "a".repeat(32), text: "Which band?" }, putOff: ["add a gallery page"] });
  assert.equal(held.skip, null);
  assert.deepEqual(kinds(held), ["nothing", "pending", "question"]);
  assert.match(texts(held)[1], /^Left for later, so not tried: “add a gallery page”$/);
  const beside = editReplyFacts({ ok: true, layer: "look", moved: ["description"], clarify: { id: "b".repeat(32), text: "Which band is the order band?" }, partial: [{ layer: "page", error: "clarify" }] });
  assert.deepEqual(kinds(beside), ["changed", "question"], "the step that asked was counted as a part that failed");
  assert.match(texts(beside)[1], /will be shown right under your reply[^]*“Which band is the order band\?”[^]*do not repeat or answer it/);
});

test("AN ORDINARY REFUSAL: the builder's own reason, whether the site changed, what the change cost and what reading the message cost — each a fact", () => {
  const r = editReplyFacts({ ok: false, error: "no-page", msg: "There's no page called Gallery on your site.", unchanged: true, cost: 0 }, { routedCost: 2 });
  assert.equal(r.skip, null);
  assert.deepEqual(kinds(r), ["not-done", "nothing", "money", "money"]);
  assert.deepEqual(texts(r).slice(1), ["Nothing on their site changed.", "This change cost them nothing.", "Reading their message cost 2 credits."]);
  // A COST THE ROW DOES NOT SETTLE SAYS NOTHING ABOUT MONEY, rather than calling it free.
  assert.deepEqual(kinds(editReplyFacts({ ok: false, error: "compile", msg: "The page did not compile." })), ["not-done"]);
  // EVERY STEP REFUSED, NONE WITH A SENTENCE AT THE TOP: each part's own.
  const parts = editReplyFacts({ ok: false, error: "withheld", unchanged: true, cost: 0, partial: [{ layer: "page", msg: "No such page." }, { layer: "nav", msg: "The menu has no Gallery link." }] });
  assert.deepEqual(kinds(parts), ["not-done", "not-done", "nothing", "money"]);
});

test("NOT AN ENDING, OR NOT READABLE: an escalate, a queued receipt, a recovered job and an answer with no `ok` get no reply", () => {
  assert.deepEqual(editReplyFacts({ ok: false, escalate: true, layer: "page" }), { skip: "escalate", facts: [] });
  assert.deepEqual(editReplyFacts({ ok: true, job: "a".repeat(32), poll: "/api/site/edit/x" }), { skip: "receipt", facts: [] });
  assert.deepEqual(editReplyFacts({ ok: true, recovered: true }), { skip: "recovered", facts: [] });
  for (const v of [null, "ok", [], { error: "not found" }, { ok: "true" }]) assert.equal(editReplyFacts(v).skip, "unreadable", JSON.stringify(v));
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE FACTS OF AN ADD-ON, A ROUTING STOP, A CANCEL, A QUESTION ASKED AGAIN
// ─────────────────────────────────────────────────────────────────────────────

test("AN ADD-ON: what was added, scheduled and stored; what was left out and why; a refusal's reason and what reading cost; a question alone is no call", () => {
  const ok = addonReplyFacts({ ok: true, added: ["gallery.tsx"], tables: ["bookings"], jobs: [{ name: "daily_reminder", everyMinutes: 1440, at: "09:00" }],
    notAdded: [{ kind: "row", name: "Rye", msg: "That loaf is already on the list." }], kept: [{ path: "index.tsx", why: "home" }], needsSecrets: ["STRIPE_KEY"] });
  assert.equal(ok.skip, null);
  assert.deepEqual(kinds(ok), ["changed", "changed", "changed", "note", "not-done", "not-done"]);
  assert.ok(texts(ok).includes("Added /gallery to the site."));
  assert.ok(texts(ok).includes("The site now stores bookings."));
  assert.ok(texts(ok).includes("Scheduled daily_reminder (every day at 09:00)."));
  assert.ok(texts(ok).some((t) => /Left out “Rye”\. The builder's own reason: “That loaf is already on the list\.”/.test(t)));
  assert.ok(texts(ok).some((t) => /no front door/.test(t)));
  assert.ok(texts(ok).includes("To switch it on, they add STRIPE_KEY under Cloud → Secrets."));
  const no = addonReplyFacts({ ok: false, error: "declined", msg: "That needs a payment provider I can't set up.", cost: 0 }, { routedCost: 1 });
  assert.deepEqual(kinds(no), ["not-done", "money"]);
  assert.match(texts(no)[0], /^Nothing was added\. The builder's own reason/);
  assert.deepEqual(addonReplyFacts({ ok: false, error: "clarify", clarify: { id: "c".repeat(32), text: "Every loaf, or today's bake?" } }), { skip: "question-only", facts: [] });
  assert.equal(addonReplyFacts({ ok: false, error: "provision", msg: "The database could not be made." }).skip, "technical");
});

test("A ROUTING ANSWER THAT ENDS THE TURN: stale, busy, too long, answers full — each said with whether anything changed or is still waiting; a failed routing call is ours; anything else is not an ending", () => {
  const stale = routeReplyFacts({ ok: false, error: "stale-question", why: "closed", cost: 0 });
  assert.deepEqual(kinds(stale), ["not-done", "nothing", "note"]);
  assert.match(texts(stale)[0], /already been answered or set aside/);
  assert.match(texts(routeReplyFacts({ ok: false, error: "stale-question", why: "expired" }))[0], /had expired/);
  assert.deepEqual(kinds(routeReplyFacts({ ok: false, error: "question-busy" })), ["not-done", "nothing", "note"]);
  // THE REAL CONSTRAINT, WITH ITS NUMBERS (2026-10-03, the size policy): one
  // message, or what one request carries with its answers.
  const long = routeReplyFacts({ ok: false, error: "answer-too-long", chars: 16001, max: 16000 });
  assert.deepEqual(kinds(long), ["not-done", "pending", "nothing"]);
  assert.match(texts(long)[0], /16,001 characters, longer than one message can hold \(16,000 characters\)/);
  assert.match(texts(routeReplyFacts({ ok: false, error: "answer-too-long" }))[0], /longer than one message can hold \(16,000 characters\)/, "with no numbers on the answer, the bound is still said");
  const carried = routeReplyFacts({ ok: false, error: "answer-too-long", carried: true, chars: 300, max: 48000 });
  assert.match(texts(carried)[0], /with their request and the answers already beside it, is more than the 48,000 characters one request can carry/);
  const msgLong = routeReplyFacts({ ok: false, error: "message-too-long", chars: 16500, max: 16000 });
  assert.deepEqual(kinds(msgLong), ["not-done", "nothing", "note"]);
  assert.match(texts(msgLong)[0], /16,500 characters, longer than one message can hold \(16,000 characters/);
  assert.match(texts(msgLong)[2], /kept in the message box/);
  const full = routeReplyFacts({ ok: false, error: "answers-full" });
  assert.deepEqual(kinds(full), ["not-done", "nothing", "pending"]);
  assert.match(texts(full)[2], /pressing Cancel/);
  assert.deepEqual(routeReplyFacts({ ok: false, failed: true, intent: "addon" }), { skip: "technical", facts: [] });
  for (const d of [{ ok: true, intent: "edit", layer: "look" }, { ok: true, intent: "clarify", question: { text: "Which?" } }, { ok: false, error: "unbilled" }]) {
    assert.equal(routeReplyFacts(d).skip, "not-an-ending", JSON.stringify(d));
  }
});

test("A CANCEL: the request is cancelled, nothing changed because of it, and each part it had put off is named as not done; nothing to cancel says why", () => {
  const c = cancelReplyFacts({ ok: true, cancelled: true, putOff: ["add a gallery page", "change the footer"] });
  assert.deepEqual(kinds(c), ["changed", "nothing", "pending", "pending"]);
  assert.match(texts(c)[2], /“add a gallery page”$/);
  assert.match(texts(cancelReplyFacts({ ok: true, cancelled: false, why: "expired" }))[0], /already expired/);
  assert.match(texts(cancelReplyFacts({ ok: true, cancelled: false, why: "missing" }))[0], /no question is waiting/);
  assert.match(texts(cancelReplyFacts({ ok: true, cancelled: false, why: "closed" }))[0], /going ahead as answered/);
  assert.equal(cancelReplyFacts({ ok: true }).skip, "unreadable");
});

test("A QUESTION ASKED AGAIN: the answers that did not settle it, the question under the note, and whether only their answer or a cancel moves it now", () => {
  const r = repeatNoteFacts({ question: { text: "Which page?" }, earlier: [{ q: "Which page?", a: "The first one" }, { q: "which page", a: "Visit, I think" }], atLimit: true });
  assert.deepEqual(kinds(r), ["note", "question", "pending"]);
  assert.match(texts(r)[0], /their answers, “The first one” and “Visit, I think”, did not settle it/);
  assert.match(texts(r)[2], /until they answer once more or cancel/);
  assert.match(texts(repeatNoteFacts({ question: { text: "Which page?" }, earlier: [{ a: "Visit" }] }))[2], /waiting for this one answer/);
  assert.equal(repeatNoteFacts({ question: { text: "Which page?" }, earlier: [] }).skip, "unreadable");
});

test("A PAGE FILE IS SAID AS ITS ADDRESS: the browser's own reading of a route file", () => {
  assert.equal(pathOf("src/routes/gallery.tsx"), "/gallery");
  assert.equal(pathOf("index.tsx"), "/");
  assert.equal(pathOf("menu.index.tsx"), "/menu");
  assert.equal(pathOf("/visit"), "/visit");
  assert.equal(pathOf("_layout.tsx"), "");
  assert.equal(pathOf(42), "");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE CALL, AND WHAT MAKES ITS ANSWER USABLE
// ─────────────────────────────────────────────────────────────────────────────

test("ONE FORCED CALL: the reply tool, the rules, their site, their words and their answers, then every fact by its id, however many", () => {
  const facts = editReplyFacts({ ok: true, layer: "text", applied: 1, changed: ["Fresh bread"], deferred: ["add a gallery page"] }).facts;
  const context = replyContext({ request: "Change the heading to Fresh bread, then add a gallery page", answers: [{ q: "Which heading?", a: "The first" }], site: { name: "Harbour Loaf", slug: "harbour-loaf", pages: ["/", "/visit", "nope"] } });
  const req = replyRequest({ facts, context, model: "claude-test" });
  assert.equal(req.model, "claude-test");
  assert.deepEqual(req.tool_choice, { type: "tool", name: "write_reply" });
  assert.deepEqual(req.tools, [REPLY_TOOL]);
  assert.equal(req.system[0].text, REPLY_SYSTEM);
  for (const rule of [/Say only what the facts say/, /Explain every fact, and list its id in covers/, /Do not ask it yourself/, /left for later, say plainly that it was not tried/, /Never mention steps, tools, layers, files, code, models or error codes/, /language they wrote their message in/, /Never put a fact's id in the reply itself/]) {
    assert.match(REPLY_SYSTEM, rule);
  }
  const body = req.messages[0].content;
  assert.match(body, /THEIR SITE: Harbour Loaf \(harbour-loaf\)/);
  assert.match(body, /ITS PAGES: \/, \/visit\n/, "a page that is not an address was shown");
  assert.match(body, /WHAT THEY ASKED FOR:\nChange the heading to Fresh bread, then add a gallery page/);
  assert.match(body, /- “Which heading\?” → “The first”/);
  assert.deepEqual(shownIn(req).map((f) => f.id), ["c1", "p1"]);
  // EVERY FACT, HOWEVER MANY (2026-10-03: past 24 they were cut and the model told not to mention them).
  const many = Array.from({ length: 60 }, (_, i) => ({ id: "n" + (i + 1), kind: "note", text: "note " + i }));
  const all = replyRequest({ facts: many, model: "m" });
  assert.equal(shownIn(all).length, 60);
  assert.doesNotMatch(all.messages[0].content, /not listed|do not mention/);
});

test("A USABLE ANSWER: the forced tool's reply, inside the length bound, with no fact id in its text, covering every fact — anything less is refused, and a fact left out is named", () => {
  const facts = [{ id: "c1", kind: "changed", text: "a" }, { id: "p1", kind: "pending", text: "b" }];
  assert.deepEqual(readReply(said({ reply: "  Done, and the gallery is next.\r\n", covers: ["c1", "p1"] }), facts), { ok: true, text: "Done, and the gallery is next.", missing: [] });
  assert.deepEqual(readReply(said({ reply: "Done.", covers: ["c1"] }), facts), { ok: false, text: "Done.", missing: ["p1"] });
  assert.deepEqual(readReply(said({ reply: "Done [c1].", covers: ["c1", "p1"] }), facts), { ok: false, text: "", missing: [] }, "a reply carrying a fact id was used");
  assert.deepEqual(readReply(said({ reply: "x".repeat(REPLY_MAX_CHARS + 1), covers: ["c1", "p1"] }), facts), { ok: false, text: "", missing: [] });
  assert.equal(readReply(said({ reply: "x".repeat(REPLY_MAX_CHARS), covers: ["c1", "p1"] }), facts).ok, true);
  assert.equal(readReply(said({ reply: "x".repeat(MAX_NOTE_CHARS + 1), covers: ["c1", "p1"] }), facts, MAX_NOTE_CHARS).ok, false, "a note past its bound was used");
  for (const bad of [
    null, {}, { content: [] },
    { content: [{ type: "text", text: "Done." }] },
    { content: [{ type: "tool_use", name: "other_tool", input: { reply: "Done.", covers: ["c1", "p1"] } }] },
    said({ reply: "Done." }), said({ covers: ["c1", "p1"] }), said({ reply: "   ", covers: ["c1", "p1"] }), said({ reply: 7, covers: ["c1", "p1"] }),
  ]) assert.deepEqual(readReply(bad, facts), { ok: false, text: "", missing: [] }, JSON.stringify(bad));
});

test("ONE REPLY, AT MOST TWO CALLS: a first answer that left a fact out is asked once more, naming what it missed; a second miss, a failed call, a timeout or an unreadable answer is no reply — and it never throws", async () => {
  const facts = [{ id: "c1", kind: "changed", text: "Changed the heading." }, { id: "p1", kind: "pending", text: "Left for later: “add a gallery page”" }];
  {
    const sent = [];
    const out = await writeReply({ send: async (req) => { sent.push(req); return sent.length === 1 ? said({ reply: "Done.", covers: ["c1"] }) : said({ reply: "Done; the gallery page is for next time.", covers: ["c1", "p1"] }); } }, { facts, model: "m" });
    assert.deepEqual({ ok: out.ok, text: out.text, attempts: out.attempts }, { ok: true, text: "Done; the gallery page is for next time.", attempts: 2 });
    assert.equal(sent.length, 2);
    assert.doesNotMatch(sent[0].messages[0].content, /LEFT OUT/);
    assert.match(sent[1].messages[0].content, /YOUR LAST REPLY LEFT OUT p1\. Explain every fact this time\./);
    assert.equal(out.usage.length, 2, "the second call's usage was not kept");
    assert.deepEqual(out.usage[0], { in: 40, out: 20, cacheRead: 0, cacheWrite: 0, model: "m" });
  }
  {
    let n = 0;
    const out = await writeReply({ send: async () => { n++; return said({ reply: "Done.", covers: ["c1"] }); } }, { facts, model: "m" });
    assert.deepEqual({ ok: out.ok, why: out.why, attempts: out.attempts }, { ok: false, why: "uncovered", attempts: 2 });
    assert.equal(n, 2, "a reply that kept leaving a fact out was asked more than twice");
  }
  {
    const out = await writeReply({ send: async () => { throw new Error("provider down"); } }, { facts, model: "m" });
    assert.deepEqual({ ok: out.ok, why: out.why, attempts: out.attempts }, { ok: false, why: "send", attempts: 1 });
  }
  {
    let n = 0;
    const out = await writeReply({ send: async () => { n++; return { content: [{ type: "text", text: "Done." }] }; } }, { facts, model: "m" });
    assert.deepEqual({ ok: out.ok, why: out.why, attempts: out.attempts }, { ok: false, why: "unreadable", attempts: 1 });
    assert.equal(n, 1, "an unreadable answer was asked again");
  }
  {
    const t0 = Date.now();
    const out = await writeReply({ send: () => new Promise(() => {}) }, { facts, model: "m", deadlineMs: 40 });
    assert.deepEqual({ ok: out.ok, why: out.why }, { ok: false, why: "deadline" });
    assert.ok(Date.now() - t0 < 2000, "the deadline did not stop the wait");
  }
  {
    // THE DEADLINE IS BOTH ATTEMPTS TOGETHER: a first answer that ate the whole
    // budget leaves no second call.
    let clock = 0;
    let n = 0;
    const out = await writeReply({ send: async () => { n++; clock += 50; return said({ reply: "Done.", covers: ["c1"] }); } }, { facts, model: "m", deadlineMs: 40, now: () => clock });
    assert.deepEqual({ ok: out.ok, why: out.why, attempts: out.attempts }, { ok: false, why: "deadline", attempts: 1 });
    assert.equal(n, 1);
  }
  {
    let n = 0;
    const none = await writeReply({ send: async () => { n++; } }, { facts: [], model: "m" });
    assert.deepEqual({ ok: none.ok, why: none.why, attempts: none.attempts }, { ok: false, why: "no-facts", attempts: 0 });
    assert.equal(n, 0, "a call was made with nothing to explain");
    assert.equal((await writeReply(null, { facts, model: "m" })).why, "send");
    assert.equal((await writeReply({ send: () => { throw new Error("sync throw"); } }, { facts, model: "m" })).why, "send", "a send that throws before its promise escaped");
  }
});

test("THE REPLY GOES ON THE ANSWER AS TWO NEW FIELDS: everything the route said is kept, and the answer it was read from is not touched", () => {
  const body = { ok: false, error: "no-page", msg: "No such page.", cost: 0, deferred: ["x"] };
  const out = withReplyText(body, "There's no Gallery page yet, so nothing changed.");
  assert.deepEqual(out, { ...body, reply: "There's no Gallery page yet, so nothing changed.", replySource: "model" });
  assert.equal(body.reply, undefined, "the route's own answer was changed in place");
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. NOTHING IS CUT (2026-10-03, the owner's review of the replies)
// ─────────────────────────────────────────────────────────────────────────────
//
// Owner: *"Fix the reply information loss in builder/site-reply.mjs: stop
// cutting off pending requests, failed additions, and facts after arbitrary
// limits. Pass the complete outcome to the model and clearly instruct it to
// explain what succeeded, what failed, what remains pending, and what needs
// an answer—without claiming unfinished work is complete."* Each case is an
// omission the first version made: a list cut at a count, a sentence cut at a
// length, a whole list dropped because it failed a validator, or every fact
// past the 24th never sent. Each now reaches the request whole.

const long = (tag, n) => { let s = tag; for (let i = 0; s.length < n; i++) s += " word" + i; return s; };
const sent = (facts) => replyRequest({ facts, model: "m" }).messages[0].content;
function wholeIn(facts, parts, label) {
  const body = sent(facts);
  for (const p of parts) assert.ok(body.includes(p), label + ": not sent whole: " + p.slice(0, 60) + "…");
  assert.doesNotMatch(body, /…/, label + ": something was cut short");
  assert.doesNotMatch(body, /not listed|do not mention/, label + ": facts were left out of the request");
}

test("EVERY PART LEFT FOR LATER REACHES THE REPLY WHOLE — this turn's and earlier ones', however many and however long; a list longer than one hand-over carries is still read, never dropped", () => {
  const now = [1, 2, 3, 4].map((i) => long("this turn's part " + i + ":", 450));
  const earlier = [5, 6, 7, 8, 9].map((i) => long("an earlier part " + i + ":", 450));
  const r = editReplyFacts({ ok: true, layer: "look", moved: ["description"], deferred: now, putOff: earlier });
  const pending = r.facts.filter((f) => f.kind === "pending");
  assert.equal(pending.length, 9, "parts left for later were dropped: " + pending.length + " of 9");
  for (const p of [...now, ...earlier]) assert.ok(pending.some((f) => f.text.includes(p)), "a part was cut: " + p.slice(0, 40));
  wholeIn(r.facts, [...now, ...earlier], "pending");
  const one = editReplyFacts({ ok: false, error: "clarify", clarify: { id: "a".repeat(32), text: "Which?" }, putOff: "add a gallery page" });
  assert.equal(one.facts.filter((f) => f.kind === "pending").length, 1, "one part, as the route sends it, was not read");
});

test("EVERY ADDITION THAT FAILED IS IN THE REPLY WITH ITS WHOLE REASON — beside a success and in a refusal — and every function, job and page left as it was", () => {
  const reasons = [1, 2, 3, 4, 5, 6].map((i) => long("the builder's reason " + i + ":", 520));
  const notAdded = reasons.map((msg, i) => ({ kind: "row", name: "Entry " + (i + 1), msg }));
  const fnErr = [1, 2, 3, 4, 5].map((i) => ({ name: "fn_" + i, error: long("function error " + i + ":", 300) }));
  const jobErr = [1, 2, 3, 4, 5].map((i) => ({ name: "job_" + i, error: long("job error " + i + ":", 300) }));
  const kept = ["a.tsx", "b.tsx", "c.tsx", "d.tsx", "e.tsx"].map((path) => ({ path, from: ["index.tsx"] }));
  const ok = addonReplyFacts({ ok: true, added: ["gallery.tsx"], notAdded, functionErrors: fnErr, jobErrors: jobErr, kept, reverted: ["f.tsx", "g.tsx", "h.tsx", "i.tsx", "j.tsx"] });
  const notDone = ok.facts.filter((f) => f.kind === "not-done");
  assert.equal(notDone.filter((f) => /^Left out/.test(f.text)).length, 6, "failed additions were dropped");
  assert.equal(notDone.filter((f) => /^The function /.test(f.text)).length, 5, "failed functions were dropped");
  assert.equal(notDone.filter((f) => /^The scheduled job /.test(f.text)).length, 5, "failed jobs were dropped");
  assert.equal(notDone.filter((f) => /still links to it/.test(f.text)).length, 5, "pages kept were dropped");
  const back = ok.facts.find((f) => /as they were: nothing there needed to change/.test(f.text));
  for (const p of ["/f", "/g", "/h", "/i", "/j"]) assert.ok(back && back.text.includes(p), "a page left as it was was not named: " + p);
  wholeIn(ok.facts, [...reasons, ...fnErr.map((e) => e.error), ...jobErr.map((e) => e.error)], "add-on success");
  const no = addonReplyFacts({ ok: false, error: "declined", msg: long("Nothing was added because", 700), notAdded, cost: 0 });
  assert.equal(no.facts.filter((f) => /^Left out/.test(f.text)).length, 6, "failed additions were dropped from a refusal");
  wholeIn(no.facts, [long("Nothing was added because", 700), ...reasons], "add-on refusal");
});

test("NO FACT IS LEFT OUT FOR ITS COUNT: forty entries added are forty facts, every one sent, and every one required in `covers`", () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ table: "loaves", label: "Loaf number " + (i + 1), id: i + 1 }));
  const r = addonReplyFacts({ ok: true, rows });
  assert.equal(r.facts.filter((f) => /^Added “Loaf number \d+” to loaves/.test(f.text)).length, 40, "entries were folded into a count");
  assert.ok(!r.facts.some((f) => /more entr/.test(f.text)), "a count stood in for entries");
  const body = sent(r.facts);
  for (let i = 1; i <= 40; i++) assert.ok(body.includes("“Loaf number " + i + "”"), "entry " + i + " was not sent");
  assert.equal(shownIn(replyRequest({ facts: r.facts, model: "m" })).length, r.facts.length, "facts past a cap were not sent");
  assert.doesNotMatch(body, /not listed|do not mention/, "the model was told to leave facts out");
  const read = readReply(said({ reply: "Done.", covers: r.facts.slice(0, 24).map((f) => f.id) }), r.facts);
  assert.equal(read.ok, false, "a reply that explained only the first 24 facts was used");
  assert.deepEqual(read.missing, r.facts.slice(24).map((f) => f.id));
});

test("A REASON, A QUESTION, A PART'S OWN SENTENCE OR A STEP'S OWN ACCOUNT IS NEVER CUT SHORT", () => {
  const reason = long("There's no Gallery page on your site:", 900);
  wholeIn(editReplyFacts({ ok: false, error: "no-page", msg: reason, unchanged: true, cost: 0 }).facts, [reason], "refusal");
  const question = long("Which band do you mean —", 420);
  wholeIn(editReplyFacts({ ok: true, layer: "look", moved: ["description"], clarify: { id: "b".repeat(32), text: question } }).facts, [question], "question");
  const partMsg = long("I couldn't move it:", 700);
  wholeIn(editReplyFacts({ ok: true, layer: "look", moved: ["description"], partial: [{ layer: "page", msg: partMsg }] }).facts, [partMsg], "partial");
  const account = long("Took these links out of the menu:", 800);
  wholeIn(editReplyFacts({ ok: true, layer: "nav", msg: account }).facts, [account], "a step's own account");
});

test("EVERY ENTRY TAKEN OFF A LIST IS NAMED WITH EVERY FIELD, AND EACH CAN BE PUT BACK", () => {
  const was = (i) => ({ id: i, name: "Rye " + i, price: 4 + i, description: long("a dense dark loaf " + i + ":", 260), baked: "daily", size: "large" });
  const r = editReplyFacts({ ok: true, layer: "data", applied: [1, 2, 3, 4, 5].map((i) => ({ table: "loaves", removed: true, was: was(i) })) });
  const removed = r.facts.filter((f) => /^Removed an entry from loaves/.test(f.text));
  assert.equal(removed.length, 5, "removed entries were folded into a count");
  assert.ok(!r.facts.some((f) => /more entr/.test(f.text)));
  removed.forEach((f, i) => {
    for (const v of [was(i + 1).name, String(was(i + 1).price), was(i + 1).description, "daily", "large"]) assert.ok(f.text.includes(v), "entry " + (i + 1) + " lost a field: " + v.slice(0, 30));
  });
  assert.equal(r.facts.filter((f) => f.kind === "undo").length, 5, "an entry could not be put back");
  // TWO ENTRIES THAT READ THE SAME ARE STILL TWO: taken off, added, or left out.
  const twin = { id: 9, name: "Rye", price: 5 };
  const offTwice = editReplyFacts({ ok: true, layer: "data", applied: [{ table: "loaves", removed: true, was: twin }, { table: "loaves", removed: true, was: { ...twin, id: 10 } }] });
  assert.equal(offTwice.facts.filter((f) => /^Removed an entry from loaves/.test(f.text)).length, 2, "two identical entries taken off were told as one");
  const inTwice = addonReplyFacts({ ok: true, rows: [{ table: "loaves", label: "Rye" }, { table: "loaves", label: "Rye" }] });
  assert.equal(inTwice.facts.filter((f) => /^Added “Rye” to loaves/.test(f.text)).length, 2, "two identical entries added were told as one");
  const outTwice = addonReplyFacts({ ok: false, error: "add", msg: "Nothing added.", notAdded: [{ kind: "row", name: "Rye", msg: "Already listed." }, { kind: "row", name: "Rye", msg: "Already listed." }] });
  assert.equal(outTwice.facts.filter((f) => /^Left out “Rye”/.test(f.text)).length, 2, "two identical additions left out were told as one");
});

test("EVERY NEW WORDING AND EVERY LINK LEFT POINTING THE OLD WAY IS IN THE REPLY", () => {
  const wordings = Array.from({ length: 8 }, (_, i) => long("New words " + (i + 1) + ":", 150));
  const r = editReplyFacts({ ok: true, layer: "text", applied: 8, changed: wordings, staleTel: [{ href: "tel:+441132000000" }, { href: "mailto:old@example.com" }, { href: "tel:+441132000001" }] });
  wholeIn(r.facts, wordings, "wordings");
  const stale = r.facts.filter((f) => f.kind === "not-done");
  assert.equal(stale.length, 3, "only the first link left pointing the old way was said");
  for (const v of ["+441132000000", "old@example.com", "+441132000001"]) assert.ok(stale.some((f) => f.text.includes(v)), v);
});

test("EVERY PART OF A LOOK CHANGE IS LISTED", () => {
  const tokens = ["primary", "accent", "radius", "spacing", "shadow", "border"];
  const style = ["header", "footer", "buttons", "cards", "links", "hero"];
  const r = editReplyFacts({ ok: true, layer: "look", moved: ["lang", "brand", "description", "theme", "favicon", "wordmark", "font", "palette"], tokens, style, renamed: 2 });
  const changed = r.facts.find((f) => /^Changed /.test(f.text)).text;
  for (const w of ["the language", "the logo", "font", "palette", ...tokens, ...style]) assert.ok(changed.includes(w), "a part of the look was left out: " + w);
});

test("A CANCEL NAMES EVERY PART IT HAD PUT OFF, WHOLE, HOWEVER MANY", () => {
  const parts = Array.from({ length: 7 }, (_, i) => long("put off " + (i + 1) + ":", 300));
  const r = cancelReplyFacts({ ok: true, cancelled: true, putOff: parts });
  assert.equal(r.facts.filter((f) => f.kind === "pending").length, 7, "parts put off were dropped");
  wholeIn(r.facts, parts, "cancel");
});

test("A QUESTION ASKED AGAIN IS TOLD EVERY ANSWER THAT DID NOT SETTLE IT, WHOLE", () => {
  const answers = Array.from({ length: 5 }, (_, i) => ({ q: "Which page?", a: long("answer " + (i + 1) + ":", 300) }));
  const q = long("Which page should the band move on", 230);
  const r = repeatNoteFacts({ question: { text: q }, earlier: answers, atLimit: true });
  wholeIn(r.facts, [q, ...answers.map((p) => p.a)], "repeat");
});

test("THE MODEL IS SHOWN THEIR WHOLE REQUEST, EVERY ANSWER THEY GAVE AND EVERY PAGE", () => {
  const request = long("Please change", 3000);
  const answers = Array.from({ length: 20 }, (_, i) => ({ q: long("Question " + (i + 1) + "?", 230), a: long("Answer " + (i + 1) + ":", 480) }));
  const pages = Array.from({ length: 45 }, (_, i) => "/page-" + (i + 1));
  const name = long("Harbour Loaf", 120);
  const ctx = replyContext({ request, answers, site: { name, slug: "harbour-loaf", pages } });
  assert.ok(ctx.includes(request), "their words were cut");
  assert.ok(ctx.includes(name), "the site's name was cut");
  for (const p of answers) {
    assert.ok(ctx.includes(p.q), "a question was cut or dropped: " + p.q.slice(0, 20));
    assert.ok(ctx.includes(p.a), "an answer was cut or dropped: " + p.a.slice(0, 20));
  }
  assert.ok(ctx.includes("ITS PAGES: " + pages.join(", ") + "\n"), "a page was dropped");
  assert.doesNotMatch(ctx, /…/);
});

test("THE MODEL IS TOLD TO SAY WHAT WAS DONE, WHAT WAS NOT, WHAT WAITS AND WHAT NEEDS AN ANSWER — never to call unfinished work done — and to summarize without dropping anything", () => {
  for (const rule of [
    /what was done, what was not done and why, what is still waiting, and what you need from them/i,
    /never say or suggest that something not done, or still waiting, was done/i,
    /when only part of what they asked for was done, say which part/i,
    /summari[sz]e/i,
    /never drop/i,
  ]) assert.match(REPLY_SYSTEM, rule);
  // WHAT AN ID SAYS A FACT IS, and the model is told how to read it.
  assert.match(REPLY_SYSTEM, /c: done\. f: not done[^\n]*\. p: still waiting[^\n]*\. q: needs their answer/i);
  assert.doesNotMatch(REPLY_TOOL.input_schema.properties.reply.description, /one to three short sentences/i, "the reply is still told to be a few sentences whatever happened");
});

test("A LONG OUTCOME'S REPLY IS NOT REFUSED FOR ITS LENGTH, AND THE PAGE SHOWS WHAT THE SERVER ACCEPTS", () => {
  const facts = Array.from({ length: 30 }, (_, i) => ({ id: "c" + (i + 1), kind: "changed", text: "x" }));
  const text = long("Here is everything:", 3000);
  assert.equal(readReply(said({ reply: text, covers: facts.map((f) => f.id) }), facts).ok, true, "a 3,000-character reply covering every fact was refused");
  const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
  assert.equal(EditPoll.MODEL_REPLY_MAX, REPLY_MAX_CHARS, "the page and the server disagree on the longest reply");
  assert.equal(EditPoll.modelReply({ reply: text, replySource: "model" }), text);
});
