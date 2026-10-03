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
  replyContext, replyRequest, readReply, writeReply, withReplyText, MAX_FACTS,
} from "../builder/site-reply.mjs";
import { MAX_NOTE_CHARS } from "../builder/clarify.mjs";

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

test("PARTIAL COMPLETION: what ran, then each part that did not and the builder's own reason for it — a part that gave none is counted — what those parts still cost, and what was left for later", () => {
  const r = editReplyFacts({
    ok: true, layer: "look", moved: ["description"], cost: 3,
    partial: [{ layer: "page", msg: "There's no Gallery page on your site, so I left that part alone.", cost: 0 }, { layer: "nav", cost: 2 }],
    deferred: ["add a gallery page"],
  });
  assert.equal(r.skip, null);
  assert.deepEqual(kinds(r), ["changed", "not-done", "not-done", "money", "pending"]);
  assert.match(texts(r)[1], /The builder's own reason: “There's no Gallery page on your site, so I left that part alone\.”/);
  assert.match(texts(r)[2], /^one more part of the request did not go through, with no reason recorded/);
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
  const long = routeReplyFacts({ ok: false, error: "answer-too-long" });
  assert.deepEqual(kinds(long), ["not-done", "pending", "nothing"]);
  assert.match(texts(long)[0], /at most \d+ characters/);
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

test("ONE FORCED CALL: the reply tool, the rules, their site, their words and their answers, then every fact by its id — and a list past the cap says it was cut", () => {
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
  const many = Array.from({ length: MAX_FACTS + 3 }, (_, i) => ({ id: "n" + (i + 1), kind: "note", text: "note " + i }));
  const cut = replyRequest({ facts: many, model: "m" });
  assert.equal(shownIn(cut).length, MAX_FACTS);
  assert.match(cut.messages[0].content, /\(3 smaller details are not listed; do not mention them\.\)/);
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
