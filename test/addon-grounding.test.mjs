// A REQUIREMENT IS GROUNDED IN WHAT THE CUSTOMER WROTE (2026-10-05, run 101).
//
// The owner: *"Trace the invented confirmation-email requirement back through
// planning and requirement reporting; ground requirements in the user's request
// and necessary dependencies, keep optional suggestions distinct, and ask a
// natural clarification when a meaningful choice needs the user. Do not add
// email functionality to satisfy an invented requirement or introduce keyword
// bans, site-specific exceptions or hardcoded customer replies."*
//
// THE TRACE (run 101, `docs/history/2026-10-05-grounding.md`): a designer —
// told to read requirements off "what they asked for, including what the ask
// IMPLIES" — declared "The person who joins gets an email confirming they are
// on the list" and claimed it covered by something this change made; the
// outcome could only be "unverified", and the cover note told the customer
// "I've set that up, but I can't confirm from here that … they then get an
// email confirming they're on the list". Nothing sends one.
//
// NOW: each requirement says where it comes from — asked, or what the ask
// cannot work without — in the customer's own words, which the route checks
// against what they wrote (the message and their answers to its questions).
// What their words do not hold up is set aside (recorded, never counted or
// reported); a designer's extras are suggestions, kept apart and offered; a
// choice only the customer can make is asked. Through the real route with
// supplied answers, on four different sites, one of them in Spanish — the rule
// is about whether their words are where the designer says, never about which
// words.
import test from "node:test";
import assert from "node:assert/strict";
import { addon, writtenPage, storedAnswer } from "./fixtures/addon-route.mjs";
import { REQUIREMENT_ITEM, BASES, groundRequirements, cleanSuggestions, cleanRequirements } from "../builder/site-requirements.mjs";
import { addTool, REQUIREMENT_ADDS } from "../builder/site-add.mjs";
import { addonReplyFacts } from "../builder/site-reply.mjs";
import { addonReply } from "../builder/site-addon.mjs";
import { browserReply } from "../scripts/addon-sweep.mjs";

const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const collectTable = (name, columns) => ({ table: { name, access: "collect", columns: columns.map((c) => ({ name: c, type: "text" })) } });
const facts = (body) => (addonReplyFacts(body).facts || []).map((f) => f.kind + ": " + f.text);
const browserText = (body) => { const b = browserReply(body, true); assert.ok(b.ok, "the browser's composer could not run: " + b.why); return b.text; };
const coverOf = (r) => String(r.body.coverNote || "");

test("GROUND 1 — the rule itself: words found in what they wrote ground an entry (any case or punctuation, any language); words that are not, a missing basis or a missing quote do not; an answer to a kept hand-off is held to that hand-off", () => {
  const asked = ["Add a Bake List page where people can join our weekly bake list by leaving their name and email address", "Just their name, please — no phone"];
  const g = groundRequirements([
    { id: "table#0", need: "Joins are kept", status: "covered", basis: "needed", words: "join our weekly bake list" },
    { id: "table#1", need: "A confirmation goes out", status: "covered", basis: "needed", words: "gets an email confirming they are on the list" },
    { id: "page#0", need: "The form asks for their name", status: "covered", basis: "asked", words: "LEAVING their name, and email" },
    { id: "page#1", need: "Only a name is asked for", status: "covered", basis: "asked", words: "just their name" },
    { id: "page#2", need: "Something", status: "covered", words: "bake list" },
    { id: "page#3", need: "Something else", status: "covered", basis: "asked" },
    { id: "page#4", need: "The page shows joins kept", status: "covered", answers: "table#0" },
    { id: "page#5", need: "An answer to a set-aside one", status: "covered", answers: "table#1" },
    { id: "page#6", need: "Half a word", status: "covered", basis: "asked", words: "ake li" },
  ], { asked });
  assert.deepEqual(g.list.map((r) => r.id), ["table#0", "page#0", "page#1", "page#4"]);
  assert.deepEqual(g.ungrounded.map((r) => r.why), ["not-in-request", "no-basis", "no-words", "no-basis", "not-in-request"]);
  // ANY LANGUAGE, the same rule: their words, wherever they are, never a list of words.
  const es = groundRequirements([{ id: "page#0", need: "x", status: "covered", basis: "asked", words: "dejar su nombre y su correo" },
    { id: "page#1", need: "y", status: "covered", basis: "needed", words: "recibe un correo de confirmación" }],
  { asked: ["Añade una página de contacto donde la gente pueda dejar su nombre y su correo"] });
  assert.deepEqual([es.list.length, es.ungrounded.length], [1, 1]);
  // A BASIS THE RULE DOES NOT KNOW grounds nothing, its words found or not — and the cleaner never keeps one.
  const made = groundRequirements([{ id: "page#0", need: "x", status: "covered", basis: "implied", words: "join our weekly bake list" }], { asked });
  assert.deepEqual([made.list.length, made.ungrounded.map((u) => u.why)], [0, ["no-basis"]]);
  const cleaned = cleanRequirements([{ need: "x", status: "covered", basis: "implied", words: "join" }, { need: "y", status: "covered", basis: "Needed", words: "join" }], "page").list;
  assert.deepEqual(cleaned.map((r) => r.basis), [undefined, "needed"], "the cleaner kept a basis the rule does not know, or lost one it does");
  // THE SUGGESTIONS: strings only, distinct whatever their case, at most three.
  assert.deepEqual(cleanSuggestions([" Send a thank-you email ", "send a thank-you EMAIL", 7, "", "a reminder", "a calendar", "a fourth"]), ["Send a thank-you email", "a reminder", "a calendar"]);
});

test("GROUND 2 — the tool asks for it: every requirement's basis and words are required, the basis offered is the constant the route grounds by, extras have their own place, and the old 'what the ask implies' wording is gone", () => {
  assert.deepEqual(REQUIREMENT_ITEM.required, ["need", "status", "basis", "words"]);
  assert.equal(REQUIREMENT_ITEM.properties.basis.enum, BASES);
  const need = REQUIREMENT_ITEM.properties.need.description;
  assert.doesNotMatch(need, /IMPLIES/i, "the requirement still invites what the ask 'implies'");
  assert.match(need, /cannot work without/, "the requirement no longer says what a dependency is");
  assert.match(need, /suggestions/, "an extra is no longer pointed at the suggestions");
  for (const kind of REQUIREMENT_ADDS) {
    const props = addTool(kind).input_schema.properties;
    assert.equal(props.requirements.items, REQUIREMENT_ITEM, kind);
    assert.ok(props.suggestions, kind + "'s tool has no place for an extra, so one becomes a requirement");
    assert.match(props.suggestions.description, /Nothing is designed or built for any of them/, kind);
    assert.match(props.suggestions.description, /ask them that one thing instead/, kind + ": a choice only they can make is not sent to the question");
    assert.ok(props.question, kind + "'s tool cannot ask");
  }
});

test("GROUND 3 — run 101's bake list on the bakery: the invented confirmation email is set aside and offered as an idea; nothing that sends mail is made; the cover note and every reply speak only of what they asked", async () => {
  const MSG = "Add a Bake List page where people can join our weekly bake list by leaving their name and email address";
  const r = await addon("fw-ground-bake", MSG, {
    kinds: ["table", "page"], publishes: true, written: [writtenPage("/bake-list")],
    answers: {
      table: {
        table: [collectTable("bake_list", ["name", "email"])],
        requirements: [
          { need: "Joins are kept for the bakery", status: "covered", by: "bake_list stores each join", item: "bake_list", kind: "table", basis: "needed", words: "join our weekly bake list" },
          { need: "The person who joins gets an email confirming they are on the list", status: "covered", by: "bake_list stores the email", item: "bake_list", kind: "table", basis: "needed", words: "gets an email confirming they are on the list" },
          { need: "A Bake List page where people can join", status: "elsewhere", step: "page", item: "/bake-list", basis: "asked", words: "Add a Bake List page where people can join" },
        ],
        suggestions: ["send each person who joins a confirmation email"],
      },
      page: {
        page: [{ ...PAGE("/bake-list", "Bake List"), link: { in: "menu" } }],
        requirements: [{ need: "A visitor can join by leaving their name and email address", status: "covered", by: "the form on /bake-list", item: "/bake-list", kind: "page", basis: "asked", words: "leaving their name and email address", answers: "table#2" }],
      },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  assert.deepEqual(r.body.kinds.slice().sort(), ["page", "table"], "something beyond the table and the page was made");
  assert.equal(r.body.functions, undefined, "a function was made for an email nobody asked for");
  // THE COVER NOTE: what they asked, never the email.
  assert.match(coverOf(r), /leaving their name and email address/i, "a grounded requirement went missing: " + coverOf(r));
  assert.doesNotMatch(coverOf(r), /confirm(ing|ation)? (they are|that they)|email confirming/i, "the invented email is still reported: " + coverOf(r));
  // THE COUNTS AND THE RECORD: set aside, with why; the idea apart from both.
  assert.equal(r.body.coverage.total, 3, "the set-aside entry was still counted: " + JSON.stringify(r.body.coverage));
  const rec = storedAnswer(r, "fw-ground-bake").coverage;
  assert.deepEqual(rec.ungrounded.map((u) => [u.need, u.why]), [["The person who joins gets an email confirming they are on the list", "not-in-request"]]);
  assert.ok(!rec.requirements.some((q) => /email confirming/.test(q.need)), "the invented requirement reached the outcomes");
  assert.deepEqual(rec.suggestions, ["send each person who joins a confirmation email"]);
  assert.deepEqual(r.body.suggestions, ["send each person who joins a confirmation email"]);
  // THE FACTS THE REPLY MODEL IS GIVEN: the idea once, as an idea — never done, never not done.
  const f = facts(r.body);
  const idea = f.filter((x) => /confirmation email/.test(x));
  assert.deepEqual(idea, ["note: Something they did not ask for, so nothing was made for it, which they could ask for if they want: “send each person who joins a confirmation email”."], JSON.stringify(f));
  assert.ok(!f.some((x) => /^(changed|not-done): .*email confirming/.test(x)), JSON.stringify(f));
  // AND THE TWO COMPOSED REPLIES OFFER IT, CLAIMING NOTHING.
  for (const text of [addonReply(r.body), browserText(r.body)]) {
    assert.match(text, /You didn.t ask for this, so I didn.t add it: send each person who joins a confirmation email/, text);
    assert.doesNotMatch(text, /set that up[^.]*email confirming/, text);
  }
});

test("GROUND 4 — a teacher's booking page: a real dependency stays a requirement and is reported; an SMS reminder 'asked' in words they never wrote is set aside", async () => {
  const r = await addon("fw-ground-teach", "Add a page where students can book a lesson by choosing a day and a time", {
    kinds: ["table", "page"], publishes: true, written: [writtenPage("/book")],
    answers: {
      table: {
        table: [collectTable("lesson_bookings", ["student", "day", "time"])],
        requirements: [
          { need: "Each booking is kept so the teacher can see it", status: "covered", by: "lesson_bookings keeps each booking", item: "lesson_bookings", kind: "table", basis: "needed", words: "book a lesson" },
          { need: "Students get an SMS reminder the day before", status: "unsupported", why: "text messages cannot be sent from here", basis: "asked", words: "an SMS reminder the day before" },
        ],
      },
      page: { page: [{ ...PAGE("/book", "Book"), link: { in: "menu" } }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  assert.match(coverOf(r), /kept so the teacher can see it/i, "a necessary dependency was dropped with the invented one: " + coverOf(r));
  assert.doesNotMatch(coverOf(r) + JSON.stringify(facts(r.body)), /SMS|text message/i, "they are told about a text message they never asked for");
  const rec = storedAnswer(r, "fw-ground-teach").coverage;
  assert.deepEqual(rec.ungrounded.map((u) => u.why), ["not-in-request"]);
});

test("GROUND 5 — a Spanish café's contact page, and an answer they gave: their words in their language ground it, the invented confirmation in Spanish is set aside, and words from their answer to a question count as theirs", async () => {
  const r = await addon("fw-ground-cafe", "Añade una página de contacto donde la gente pueda dejar su nombre y su teléfono", {
    kinds: ["table", "page"], publishes: true, written: [writtenPage("/contacto")],
    context: [{ q: "¿Quieres que también dejen un mensaje?", a: "Sí, un mensaje corto" }],
    answers: {
      table: {
        table: [collectTable("contactos", ["nombre", "telefono", "mensaje"])],
        requirements: [
          { need: "Se guarda cada contacto", status: "covered", by: "contactos guarda cada uno", item: "contactos", kind: "table", basis: "needed", words: "dejar su nombre y su teléfono" },
          { need: "Pueden dejar un mensaje", status: "covered", by: "contactos.mensaje", item: "contactos", kind: "table", basis: "asked", words: "un mensaje corto" },
          { need: "Reciben un correo de confirmación", status: "covered", by: "contactos guarda el teléfono", item: "contactos", kind: "table", basis: "needed", words: "reciben un correo de confirmación" },
        ],
      },
      page: { page: [{ ...PAGE("/contacto", "Contacto"), link: { in: "menu" } }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  const rec = storedAnswer(r, "fw-ground-cafe").coverage;
  assert.deepEqual(rec.requirements.map((q) => q.need).sort(), ["Pueden dejar un mensaje", "Se guarda cada contacto"]);
  assert.deepEqual(rec.ungrounded.map((u) => [u.need, u.why]), [["Reciben un correo de confirmación", "not-in-request"]]);
  assert.doesNotMatch(coverOf(r), /correo/i, coverOf(r));
});

test("GROUND 6 — a meaningful choice only they can make is asked, in plain words: a yoga studio's class booking, paid or reserved — nothing designed, applied or charged until they answer", async () => {
  const r = await addon("fw-ground-yoga", "Add a page where people can sign up for Saturday classes", {
    kinds: ["page"],
    answers: { page: { question: { text: "Should people pay for a class when they sign up, or only reserve a place and pay at the studio?", options: ["Pay when they sign up", "Reserve now, pay at the studio"] } } },
  });
  assert.equal(r.body.error, "clarify", JSON.stringify(r.body).slice(0, 400));
  assert.equal(r.body.cost, 0);
  assert.equal(r.body.unchanged, true);
  // THE LIVE QUESTION THE PAGE SHOWS THEM, with its answers to choose from.
  assert.equal(r.body.clarify.text, "Should people pay for a class when they sign up, or only reserve a place and pay at the studio?");
  assert.deepEqual(r.body.clarify.options, ["Pay when they sign up", "Reserve now, pay at the studio"]);
  assert.ok(typeof r.body.clarify.id === "string" && r.body.clarify.id, "the question was not kept to be answered");
});
