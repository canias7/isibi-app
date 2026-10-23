// EVERY ADDED COMPONENT MUST BE FOUND ITSELF; WHAT THE FIRST LOAD DID NOT SHOW
// IS NOT A CLAIM ABOUT ANY CLICK; A PRE-SEND CONSOLE ERROR IS NAMED BY ITS
// TIMING (2026-10-13, Codex's review of 73772b23).
//
// Codex reproduced a false success: a request for only a booking form on
// /visit, a writer that merely changed a heading to "Visit us this Friday",
// and componentEvidence → requirementReport → the reply model's facts said
// the booking form was added and seen. The attribution guard ran only when
// several components shared a page. Now every component — alone, beside
// others, or repeated — needs its own new instance, resolved by the module its
// tag is imported from, and only the texts inside that instance count.
// Something added that cannot be tied to it is unknown: never success, never
// absence.
//
// The cases here check the stored outcome and the facts the reply model is
// actually given, with a positive control beside every refusal.
import test from "node:test";
import assert from "node:assert/strict";
import { tweakParser } from "../builder/site-tweak.mjs";
import { addedByRoute, renderedTexts, componentEvidence, sourceIs } from "../builder/content-evidence.mjs";
import { requirementReport, requirementOutcomes, toldNote, readContent, readAdditions } from "../builder/site-requirements.mjs";
import { addonReplyFacts, toldEntries } from "../builder/site-reply.mjs";
import { consoleLine, historicalRead } from "../scripts/canary-ui.mjs";
import { addon, addedTo, storedPage, storedAnswer } from "./fixtures/addon-route.mjs";

const parse = await tweakParser();
assert.ok(parse, "the TypeScript parser is not installed — every case below would read `unread`");

// THE READING WITHOUT ITS PER-ADDITION OBSERVATIONS (2026-10-13), which the
// cases that are about them assert on their own.
const core = (c) => { if (!c || typeof c !== "object") return c; const { additions, ...rest } = c; return rest; };

const RT = "import { createFileRoute } from '@tanstack/react-router'\n";
const VISIT = RT + "export const Route = createFileRoute('/visit')({ component: Page })\nfunction Page(){ return <main><h1>Visit us</h1><p>Open from 8.</p></main> }\n";
const page = (source, route = "/visit") => ({ path: route.slice(1) + ".tsx", source, routes: [route], maybeRoutes: [] });
const render = (text, complete = true, route = "/visit") => renderedTexts({ texts: [{ route, text, complete }] });
const design = (name, route = "/visit", n = 1) => [{ kind: "component", value: Array.from({ length: n }, () => ({ page: route, does: "a " + name, components: [name] })) }];
const REQ = (item) => ({
  need: "The Visit page has a " + item + " visitors can use", status: "covered", from: "component", kind: "component", item, by: "the " + item, basis: "asked", words: "a " + item,
  judged: { follows: "asked", carried: "yes", by: ["component:" + item], reason: "the case's verdict" },
});
const reportOf = (item, content) => requirementReport([REQ(item)], { judged: true, reportable: ["component"], content });
const factsOf = (told) => addonReplyFacts({ ok: true, kinds: ["component"], changed: ["visit.tsx"], requirementsTold: told, coverNote: toldNote(told) }).facts.map((f) => f.text);
const evidence = (answers, before, after, rendered) => componentEvidence({ answers, added: addedByRoute({ before, after, parse }), rendered });
const withImport = (src, line) => src.replace(RT, RT + line + "\n");
const FORM = "<BookingForm title=\"Book a table\" submitLabel=\"Send booking\" />";

// ─── CODEX'S REPRODUCTION ───────────────────────────────────────────────────

test("AT 1 — CODEX'S FALSE SUCCESS: only a booking form asked for on /visit; the writer only changed the heading to 'Visit us this Friday' — the form is unknown, never added or seen; the reply model is never told it was added", () => {
  const after = VISIT.replace("<h1>Visit us</h1>", "<h1>Visit us this Friday</h1>");
  const ev = evidence(design("booking-form"), [page(VISIT)], [page(after)], render("Visit us this Friday Open from 8."));
  assert.deepEqual(core(readContent(ev["booking-form"])), { stored: "unread" }, JSON.stringify(ev));
  const r = reportOf("booking-form", ev);
  assert.equal(r.told[0].told, "unseen", JSON.stringify(r.told));
  assert.notEqual(r.told[0].state, "unverified");
  const facts = factsOf(r.told);
  assert.ok(!facts.some((t) => /^Added/.test(t) || /seen on the published page/.test(t)), "the form was told as added: " + JSON.stringify(facts));
  assert.ok(facts.some((t) => /Nothing here can see whether this is in place, so it is not known either way — neither done nor not done: The Visit page has a booking-form/.test(t)), JSON.stringify(facts));
  // NOR ABSENT ON A GUESS: something was added, so it is not "still to do".
  assert.ok(!facts.some((t) => /^Not done: The Visit page/.test(t)));
});

test("AT 1 control — THE FORM ITSELF WRITTEN: imported from its own module and rendered with its words — added, and seen as far as the page shows it", () => {
  const after = withImport(VISIT, "import { BookingForm } from '@/components/booking-form'").replace("</main>", FORM + "</main>");
  const ev = evidence(design("booking-form"), [page(VISIT)], [page(after)], render("Visit us Open from 8. Book a table Send booking"));
  assert.deepEqual(core(readContent(ev["booking-form"])), { stored: "added", shown: "all" });
  const r = reportOf("booking-form", ev);
  assert.equal(r.told[0].told, "shown");
  const facts = factsOf(r.told);
  assert.ok(facts.some((t) => /^What this change added for it: a new booking-form on \/visit whose own words are “Book a table”, “Send booking”\. The built page showed those words as it first loaded\. Whether what was added is what was asked for is not checked here: The Visit page has a booking-form/.test(t)), JSON.stringify(facts));
  assert.ok(facts.some((t) => /^Not verified: whether anything a visitor does/.test(t)), "seen was told without the untried behaviour beside it");
});

// THROUGH THE REAL ADD-ON ROUTE: the stored record and the reply model's facts.
// The route takes only kit components, so its form is the kit's contact form.
const MSG = "add a contact form to the home page";
const ROUTE_REQ = { need: "The home page has a contact form visitors can send", status: "covered", by: "the contact form", item: "contact-form", kind: "component", basis: "asked", words: "a contact form" };
const KIT_FORM = "<ContactForm title=\"Book a table\" submitLabel=\"Send booking\" />";
const viaRoute = (slug, written, text) => addon(slug, MSG, {
  kinds: ["component"], publishes: true, storedPages: [storedPage("/")],
  answers: { component: { component: [{ page: "/", does: "a contact form", components: ["contact-form"] }], requirements: [ROUTE_REQ] } },
  written,
  judge: ({ entries, step }) => ({ verdicts: entries.map((e) => (step ? { id: e.id, follows: "asked", carried: "unsure", reason: "before" } : { id: e.id, follows: "asked", carried: "yes", by: ["component:contact-form"], reason: "the form carries it" })) }),
  render: { ok: true, checked: 1, pages: 1, findings: [], texts: [{ route: "/", text, complete: true }] },
});

test("AT 2 — THROUGH THE ADD-ON ROUTE, CODEX'S SHAPE: the writer added only a heading — the answer, the stored record and the reply model's facts never say the form was added or seen", async () => {
  const r = await viaRoute("at-heading", [addedTo("/", "<h2>Visit us this Friday</h2>")], "Visit us this Friday");
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  assert.equal(r.body.requirementsTold[0].told, "unseen", JSON.stringify(r.body.requirementsTold));
  const kept = storedAnswer(r, "at-heading");
  const o = kept.coverage.requirements.find((x) => x.item === "contact-form");
  assert.ok(o, JSON.stringify(kept.coverage).slice(0, 400));
  assert.notEqual(o.implementation, "found", "the stored record says the form was found: " + JSON.stringify(o));
  assert.equal(o.content, undefined, "the stored record carries a content reading for it: " + JSON.stringify(o));
  assert.equal(o.state, "unknown", JSON.stringify(o));
  const facts = addonReplyFacts(r.body).facts.map((f) => f.text);
  assert.ok(!facts.some((t) => /^Added/.test(t)), JSON.stringify(facts));
  assert.ok(facts.some((t) => /Nothing here can see whether this is in place/.test(t)), JSON.stringify(facts));
});

test("AT 2 control — THROUGH THE ROUTE, THE FORM WRITTEN WITH ITS IMPORT: shown, stored as added, and the reply model told so with the behaviour untried", async () => {
  const p = addedTo("/", KIT_FORM);
  const r = await viaRoute("at-form", [{ ...p, source: "import { ContactForm } from '@/components/ui/contact-form'\n" + p.source }], "Book a table Send booking");
  assert.equal(r.body.requirementsTold[0].told, "shown", JSON.stringify(r.body.requirementsTold));
  const o = storedAnswer(r, "at-form").coverage.requirements.find((x) => x.item === "contact-form");
  assert.equal(o.implementation, "found", JSON.stringify(o));
  // THE STORED RECORD KEEPS THE OBSERVATION ADDITION BY ADDITION (2026-10-13).
  assert.deepEqual(o.content, { shown: "all", additions: [{ name: "contact-form", route: "/", words: [{ text: "Book a table", seen: true }, { text: "Send booking", seen: true }] }] }, JSON.stringify(o));
  assert.equal(o.state, "unverified", "a form found is never verified to work");
  const facts = addonReplyFacts(r.body).facts.map((f) => f.text);
  assert.ok(facts.some((t) => /^What this change added for it: a new contact-form on \/ whose own words are .*Whether what was added is what was asked for is not checked here: The home page has a contact form/.test(t)), JSON.stringify(facts));
  assert.ok(facts.some((t) => /^Not verified: whether anything a visitor does/.test(t)), JSON.stringify(facts));
});

// ─── ATTRIBUTION FOR A SINGLE COMPONENT ─────────────────────────────────────

test("AT 3 — A SINGLE COMPONENT'S TEXTS ARE ONLY THOSE INSIDE ITS OWN NEW INSTANCE: a heading changed beside it is not the form's, so it is never judged as hidden or shown for it", () => {
  const after = withImport(VISIT, "import { BookingForm } from '@/components/booking-form'")
    .replace("<h1>Visit us</h1>", "<h1>Visit us this Friday</h1>").replace("</main>", FORM + "</main>");
  // The page showed the heading and not the form's words.
  const ev = evidence(design("booking-form"), [page(VISIT)], [page(after)], render("Visit us this Friday Open from 8."));
  assert.equal(ev["booking-form"].stored, "added");
  assert.equal(ev["booking-form"].texts, 2, "the heading was counted as the form's text");
  assert.equal(ev["booking-form"].shown, "none");
  assert.deepEqual(ev["booking-form"].hidden.map((h) => h.text), ["Book a table", "Send booking"]);
});

test("AT 4 — MATCHING TEXT ELSEWHERE IS NOT DELIVERY: the form's own 'Visit us' and the page's heading 'Visit us' — one copy on the page proves nothing about the form's (unread); two copies do", () => {
  const after = withImport(VISIT, "import { BookingForm } from '@/components/booking-form'").replace("</main>", "<BookingForm title=\"Visit us\" /></main>");
  let ev = evidence(design("booking-form"), [page(VISIT)], [page(after)], render("Visit us Open from 8."));
  assert.equal(ev["booking-form"].stored, "added");
  assert.equal(ev["booking-form"].shown, "unread", "the heading's copy was taken for the form's");
  assert.equal(reportOf("booking-form", ev).told[0].told, "in-code");
  // CONTROL: both copies on the page.
  ev = evidence(design("booking-form"), [page(VISIT)], [page(after)], render("Visit us Open from 8. Visit us"));
  assert.equal(ev["booking-form"].shown, "all");
  // AND THE PAGE'S OWN TEXT NEVER STANDS IN FOR THE FORM: no form tag, the
  // same words added elsewhere — unread.
  const elsewhere = VISIT.replace("</main>", "<p>Book a table</p></main>");
  ev = evidence(design("booking-form"), [page(VISIT)], [page(elsewhere)], render("Visit us Open from 8. Book a table"));
  assert.equal(ev["booking-form"].stored, "unread");
});

// ─── REPEATED INSTANCES OF ONE COMPONENT TYPE ───────────────────────────────

test("AT 5 — REPEATED INSTANCES: two cards designed for /visit need two new cards — one is unknown, two are added; text added inside a card the page already had, with no new card, is unknown", () => {
  const CARD = "import { Card } from '@/components/ui/card'";
  const one = withImport(VISIT, CARD).replace("</main>", "<Card><p>Free parking.</p></Card></main>");
  const two = withImport(VISIT, CARD).replace("</main>", "<Card><p>Free parking.</p></Card><Card><p>Dogs welcome.</p></Card></main>");
  assert.equal(evidence(design("card", "/visit", 2), [page(VISIT)], [page(one)], render("Free parking.")).card.stored, "unread", "one card vouched for two");
  assert.deepEqual(core(readContent(evidence(design("card", "/visit", 2), [page(VISIT)], [page(two)], render("Visit us Free parking. Dogs welcome.")).card)), { stored: "added", shown: "all" });
  // AN EXISTING CARD, EDITED: no new card.
  const had = withImport(VISIT, CARD).replace("</main>", "<Card><p>Free parking.</p></Card></main>");
  const edited = had.replace("<p>Free parking.</p>", "<p>Free parking.</p><p>Dogs welcome.</p>");
  assert.equal(evidence(design("card"), [page(had)], [page(edited)], render("Free parking. Dogs welcome.")).card.stored, "unread");
  // CONTROL: a new card beside the existing one.
  const added = had.replace("</main>", "<Card><p>Dogs welcome.</p></Card></main>");
  const ev = evidence(design("card"), [page(had)], [page(added)], render("Free parking. Dogs welcome."));
  assert.deepEqual(core(readContent(ev.card)), { stored: "added", shown: "all" });
  assert.equal(ev.card.texts, 1, "the existing card's text was counted as the new one's");
  // THE SAME WORDS IN A NEW CARD PLACED BEFORE THE OLD ONE: the new card's copy
  // is its text (found the sweep's one survivor, S4) — and shown only when the
  // page shows both copies.
  // (The old card says more, so the two instances differ in source.)
  const had2 = withImport(VISIT, CARD).replace("</main>", "<Card><p>Free parking.</p><p>Bikes welcome.</p></Card></main>");
  const again = had2.replace("<main>", "<main><Card><p>Free parking.</p></Card>");
  const twice = evidence(design("card"), [page(had2)], [page(again)], render("Free parking. Visit us Open from 8. Free parking. Bikes welcome."));
  assert.equal(twice.card.stored, "added");
  assert.equal(twice.card.texts, 1, "the new card's copy of a repeated text was not taken as its own");
  assert.equal(twice.card.shown, "all");
  assert.equal(evidence(design("card"), [page(had2)], [page(again)], render("Free parking. Visit us Open from 8. Bikes welcome.")).card.shown, "unread", "one copy on the page was taken for the new card's");
});

// ─── SOURCE IDENTITY, NOT SPELLING ──────────────────────────────────────────

test("AT 6 — SOURCE IDENTITY: an aliased import and a namespace member are the component; a same-named tag from another module, a tag nothing imports, and a barrel import are not — they read unknown, never added", () => {
  const add = (imp, tag) => evidence(design("faq"), [page(VISIT)], [page((imp ? withImport(VISIT, imp) : VISIT).replace("</main>", tag + "</main>"))], render("Visit us Open from 8. Do you deliver?")).faq;
  assert.equal(add("import { Faq as Questions } from '@/components/ui/faq'", "<Questions items={[{ question: \"Do you deliver?\" }]} />").stored, "added");
  assert.equal(add("import * as Kit from '@/components/kit'", "<Kit.Faq items={[{ question: \"Do you deliver?\" }]} />").stored, "added");
  assert.equal(add("import { Faq } from '@/components/price-table'", "<Faq items={[{ question: \"Do you deliver?\" }]} />").stored, "unread", "a same-named tag from another module was taken for it");
  assert.equal(add(null, "<Faq items={[{ question: \"Do you deliver?\" }]} />").stored, "unread", "a tag nothing imports was taken for it");
  assert.equal(add("import { Faq } from '@/components/ui'", "<Faq items={[{ question: \"Do you deliver?\" }]} />").stored, "unread", "a barrel was taken to name it");
  // The rule itself.
  assert.equal(sourceIs("@/components/ui/faq", "faq"), true);
  assert.equal(sourceIs("./booking-form.tsx", "booking-form"), true);
  assert.equal(sourceIs("@/components/kit#BookingForm", "booking-form"), true);
  assert.equal(sourceIs("@/components/ui", "faq"), false);
  assert.equal(sourceIs(null, "faq"), false);
});

test("AT 7 — NOTHING ADDED AT ALL is still absent ('still to do'); an unchanged page and a page changed only in a class name — the read is whole and nothing was added", () => {
  let ev = evidence(design("booking-form"), [page(VISIT)], [page(VISIT)], render("Visit us"));
  assert.equal(ev["booking-form"].stored, "none");
  assert.equal(reportOf("booking-form", ev).told[0].told, "still-to-do");
  ev = evidence(design("booking-form"), [page(VISIT)], [page(VISIT.replace("<main>", "<main className=\"mt-8\">"))], render("Visit us"));
  assert.equal(ev["booking-form"].stored, "none");
});

// ─── OBSERVATIONS APART FROM INTERACTIONS ───────────────────────────────────

test("AT 8 — NOT ON FIRST LOAD, OR HANDED AS A PROP, IS NOT A CLICK: the note and the reply model's facts say what was seen and where it sits, and — as a separate fact — that no interaction was identified or tried", () => {
  const after = withImport(VISIT, "import { Faq } from '@/components/ui/faq'").replace("</main>", "<Faq items={[{ question: \"Do you deliver?\", answer: \"Yes, on Fridays.\" }]} /></main>");
  const ev = evidence(design("faq"), [page(VISIT)], [page(after)], render("Visit us Open from 8. Do you deliver?"));
  assert.equal(ev.faq.shown, "some");
  const r = reportOf("faq", ev);
  assert.equal(r.told[0].told, "behind");
  const note = toldNote(r.told);
  assert.doesNotMatch(note, /waits behind|opens|open it/, "the note said a visitor action reveals it");
  assert.match(note, /I haven't checked whether anything a visitor does brings it up/);
  const facts = factsOf(r.told);
  const seen = facts.find((t) => /^What this change added for it: a new faq on \/visit .*Not all of it was on the built page as it first loaded/.test(t));
  assert.ok(seen, JSON.stringify(facts));
  assert.match(seen, /passed as a value to a component on the page, which decides where and when to draw it/);
  assert.match(seen, /“Yes, on Fridays\.”/);
  assert.doesNotMatch(seen.slice(seen.indexOf("In the code it sits"), seen.indexOf("The words the first load")), /visitor|open|click|chooses|reveal/i, "the observation claimed an interaction");
  const untried = facts.filter((t) => /^Not verified: whether anything a visitor does/.test(t));
  assert.equal(untried.length, 1, "the behaviour was not its own fact, once");
  assert.match(untried[0], /No such interaction was identified or tried/);
});

// ─── THE CONSOLE LINE, BY TIMING; HISTORY ONLY ON EVIDENCE ──────────────────

test("AT 9 — A PRE-SEND CONSOLE ERROR IS NAMED BY ITS TIMING; it is called an earlier job's re-read only when exactly one recorded final read of a job, with that status and at that moment, establishes it", () => {
  const LINE = "Failed to load resource: the server responded with a status of 422 ()";
  const read = (o = {}) => ({ ms: 28420, method: "GET", path: "/api/site/edit/594ebe450933acebca91467d7e54e3f5", status: 422, final: true, ...o });
  const rec = (network, extra = {}) => ({ consoleErrors: [LINE], consoleAt: [28442], firstSendMs: 30000, network, ...extra });
  // NO EVIDENCE: timing only, nothing claimed about what it was.
  assert.equal(consoleLine(rec([])), "console errors 1 (1 logged before the first message was sent)");
  assert.doesNotMatch(consoleLine(rec([])), /earlier|history|not this press/);
  // THE EVIDENCE (run 144's shape): one final read of an earlier job, served 422, at that moment.
  assert.equal(consoleLine(rec([read()])), "console errors 1 (1 logged before the first message was sent; 1 of them the browser's line for the app re-reading earlier job 594ebe45 (stored answer served 422))");
  // NOT ENOUGH: another status, not a final answer, another moment, another path, two candidates, or this press's own job.
  for (const [why, net, extra] of [
    ["another status", [read({ status: 500 })]],
    ["not a stored final answer", [read({ final: undefined })]],
    ["another moment", [read({ ms: 20000 })]],
    ["not a job read", [read({ path: "/api/site/list" })]],
    ["two candidates", [read(), read({ path: "/api/site/edit/aaaabbbbccccdddd", ms: 28500 })]],
    ["this press's own job", [read()], { ownJobs: ["594ebe450933acebca91467d7e54e3f5"] }],
  ]) assert.equal(consoleLine(rec(net, extra)), "console errors 1 (1 logged before the first message was sent)", why);
  assert.equal(historicalRead("some other error", 28442, [read()]), null, "a line naming no status was matched");
  // AFTER THE FIRST SEND, OR WITH NO TIMES: counted whole, as before.
  assert.equal(consoleLine({ consoleErrors: [LINE], consoleAt: [31000], firstSendMs: 30000, network: [read({ ms: 31000 })] }), "console errors 1");
  assert.equal(consoleLine({ consoleErrors: [LINE], consoleAt: [100], firstSendMs: null }), "console errors 1");
});

// ─── PRESENCE IS NOT FULFILMENT (2026-10-13, Codex at d0e76bdf) ─────────────
//
// Two cards designed for /visit, one for free parking and one for dogs being
// welcome; the writer rendered "Free parking." twice. The component read
// "card shown: all", and both requests were told "Added, and seen…" — the
// dogs one included, whose words never appeared. Now each addition is told by
// itself with its own words, and whether that is what was asked is said to be
// unchecked: the reply model compares; nothing here decides by keyword.
const CARD_IMPORT = "import { Card } from '@/components/ui/card'";
const PARKING = { need: "The Visit page tells people about free parking", item: "card" };
const DOGS = { need: "The Visit page tells people that dogs are welcome inside", item: "card" };
const cardReq = (r) => ({ ...REQ("card"), need: r.need });
const cards = (...words) => withImport(VISIT, CARD_IMPORT).replace("</main>", words.map((w) => "<Card><p>" + w + "</p></Card>").join("") + "</main>");
const outcomesOf = (reqs, content) => requirementOutcomes(reqs, { judged: true, reportable: ["component"], content });
const reportOfAll = (reqs, content) => requirementReport(reqs, { judged: true, reportable: ["component"], content });
const factsFor = (told, need) => factsOf(told).filter((t) => t.includes(need));

test("AT 10 — CODEX'S TWO CARDS, ONE SAYING NOTHING ASKED: two cards designed (parking, dogs), the writer put \"Free parking.\" in both — the component is present, but neither request is told met; each request's facts list what each new card actually says, and say its fulfilment is not checked; no fact claims the dogs words were seen", () => {
  const ev = evidence(design("card", "/visit", 2), [page(VISIT)], [page(cards("Free parking.", "Free parking."))], render("Visit us Open from 8. Free parking. Free parking."));
  assert.equal(ev.card.stored, "added");
  assert.deepEqual(ev.card.additions, [
    { name: "card", route: "/visit", words: [{ text: "Free parking.", seen: true }] },
    { name: "card", route: "/visit", words: [{ text: "Free parking.", seen: true }] },
  ], "the observation was pooled, not kept addition by addition");
  // THE STORED OUTCOMES: present (found), never delivered; the observation kept with each.
  const outs = outcomesOf([cardReq(PARKING), cardReq(DOGS)], ev);
  for (const o of outs) {
    assert.equal(o.state, "unverified", "a request was recorded as met: " + JSON.stringify(o));
    assert.deepEqual(o.content.additions.map((a) => a.words.map((w) => w.text)), [["Free parking."], ["Free parking."]]);
  }
  // THE REPLY MODEL'S FACTS.
  const r = reportOfAll([cardReq(PARKING), cardReq(DOGS)], ev);
  const all = factsOf(r.told);
  assert.ok(!all.some((t) => /^Added, and seen/.test(t)), "a request was told as added and seen: " + JSON.stringify(all));
  const dogs = factsFor(r.told, DOGS.need);
  assert.ok(dogs.some((t) => t.startsWith("What this change added for it: a new card on /visit whose own words are “Free parking.”; a new card on /visit whose own words are “Free parking.”.")
    && t.includes("Whether what was added is what was asked for is not checked here: " + DOGS.need)), JSON.stringify(dogs));
  assert.ok(!all.some((t) => /“[^”]*[Dd]ogs[^”]*”/.test(t)), "a fact quoted dogs words that the page never had");
  assert.doesNotMatch(toldNote(r.told), /I've added that,/, "the note told a request met");
});

test("AT 11 — ONE CARD, THE WRONG WORDS: a card designed for the dogs request, the writer wrote \"Free parking.\" — present, the request recorded unverified, its facts quote what was really added and leave the match unchecked", () => {
  const ev = evidence(design("card"), [page(VISIT)], [page(cards("Free parking."))], render("Visit us Free parking."));
  assert.deepEqual(core(readContent(ev.card)), { stored: "added", shown: "all" });
  const [o] = outcomesOf([cardReq(DOGS)], ev);
  assert.equal(o.state, "unverified");
  const facts = factsFor(reportOfAll([cardReq(DOGS)], ev).told, DOGS.need);
  assert.ok(facts.some((t) => t.startsWith("What this change added for it: a new card on /visit whose own words are “Free parking.”.") && t.includes("is not checked here")), JSON.stringify(facts));
  assert.ok(!facts.some((t) => /^Added, and seen/.test(t)));
});

test("AT 12 — TWO CARDS DESIGNED, ONE OMITTED: only one new card — unknown for both requests, never added, never seen, never missing", () => {
  const ev = evidence(design("card", "/visit", 2), [page(VISIT)], [page(cards("Free parking."))], render("Visit us Free parking."));
  assert.equal(ev.card.stored, "unread");
  const r = reportOfAll([cardReq(PARKING), cardReq(DOGS)], ev);
  assert.deepEqual(r.told.map((t) => t.told), ["unseen", "unseen"]);
  assert.ok(!factsOf(r.told).some((t) => /^What this change added|^Added/.test(t)));
});

test("AT 13 — POSITIVE CONTROL: two cards, one per request, each with its own words — both present and shown, each request's facts list both additions and their words for the reply model to compare; fulfilment still unchecked here, by design", () => {
  const ev = evidence(design("card", "/visit", 2), [page(VISIT)], [page(cards("Free parking.", "Dogs are welcome inside."))], render("Visit us Free parking. Dogs are welcome inside."));
  assert.deepEqual(ev.card.additions.map((a) => a.words), [[{ text: "Free parking.", seen: true }], [{ text: "Dogs are welcome inside.", seen: true }]]);
  const outs = outcomesOf([cardReq(PARKING), cardReq(DOGS)], ev);
  assert.deepEqual(outs.map((o) => o.state), ["unverified", "unverified"]);
  const r = reportOfAll([cardReq(PARKING), cardReq(DOGS)], ev);
  assert.deepEqual(r.told.map((t) => t.told), ["shown", "shown"]);
  const dogs = factsFor(r.told, DOGS.need);
  assert.ok(dogs.some((t) => t.includes("a new card on /visit whose own words are “Dogs are welcome inside.”") && t.includes("The built page showed those words as it first loaded")), JSON.stringify(dogs));
});

test("AT 15 — ONE ADDITION IS ITS OUTERMOST NEW INSTANCE, AND A NEW INSTANCE WITH NO WORDS OF ITS OWN IS STILL LISTED: a card nested inside the new card is part of that one addition; of two new cards, one whose copy is computed is listed with no words, and the facts say so", () => {
  // NESTED: one design, one new outer card holding a card of its own — one addition, both texts its own.
  const nested = withImport(VISIT, CARD_IMPORT).replace("</main>", "<Card><p>Free parking.</p><Card><p>Ask at the counter.</p></Card></Card></main>");
  const ev = evidence(design("card"), [page(VISIT)], [page(nested)], render("Visit us Free parking. Ask at the counter."));
  assert.equal(ev.card.stored, "added");
  assert.deepEqual(ev.card.additions, [{ name: "card", route: "/visit", words: [{ text: "Free parking.", seen: true }, { text: "Ask at the counter.", seen: true }] }], "the nested card was taken for an addition of its own");
  // BARE: two designs, two new cards, the second drawing only a computed value.
  const bare = withImport(VISIT, CARD_IMPORT).replace("</main>", "<Card><p>Free parking.</p></Card><Card>{note}</Card></main>");
  const ev2 = evidence(design("card", "/visit", 2), [page(VISIT)], [page(bare)], render("Visit us Free parking."));
  assert.equal(ev2.card.stored, "added");
  assert.deepEqual(ev2.card.additions, [
    { name: "card", route: "/visit", words: [{ text: "Free parking.", seen: true }] },
    { name: "card", route: "/visit", words: [] },
  ], "a new card with no words of its own went unlisted");
  const dogs = factsFor(reportOfAll([cardReq(PARKING), cardReq(DOGS)], ev2).told, DOGS.need);
  assert.ok(dogs.some((t) => t.includes("a new card on /visit with no words of its own that could be read") && t.includes("is not checked here")), JSON.stringify(dogs));
});

test("AT 16 — THE OBSERVED ADDITIONS ARE READ STRICTLY: every entry reads or the list is dropped whole — a `seen` that is not true, false or null, an empty word, a missing page or name; never shortened, never coerced", () => {
  const ok = [{ name: "card", route: "/visit", words: [{ text: "Free parking.", seen: true }, { text: "Ask inside.", seen: false }, { text: "Open late.", seen: null }] }, { name: "card", route: "/visit", words: [] }];
  assert.deepEqual(readAdditions(ok), ok);
  for (const [why, bad] of [
    ["seen as a string", [{ ...ok[0], words: [{ text: "Free parking.", seen: "yes" }] }]],
    ["seen missing", [{ ...ok[0], words: [{ text: "Free parking." }] }]],
    ["seen as a number", [{ ...ok[0], words: [{ text: "Free parking.", seen: 1 }] }]],
    ["an empty word", [{ ...ok[0], words: [{ text: "", seen: true }] }]],
    ["no page", [{ name: "card", words: [] }]],
    ["no name", [{ route: "/visit", words: [] }]],
    ["words not a list", [{ name: "card", route: "/visit", words: "Free parking." }]],
  ]) {
    assert.equal(readAdditions([ok[1], ...bad]), null, why);
    assert.equal(Object.hasOwn(readContent({ stored: "added", shown: "all", additions: [ok[1], ...bad] }), "additions"), false, why + ": a malformed list reached the stored content");
  }
  assert.equal(readAdditions([]), null);
  assert.equal(readAdditions("card"), null);
});

test("AT 17 — THE REPLY'S READER TAKES ADDITIONS ONLY BESIDE AN OBSERVATION: on shown, behind or in-code they read; beside unseen, still to do, set up or already there the whole list of told entries is refused, never told; malformed additions are refused too", () => {
  const add = [{ name: "card", route: "/visit", words: [{ text: "Free parking.", seen: true }] }];
  const need = "The Visit page tells people that dogs are welcome inside";
  for (const told of ["shown", "in-code"]) assert.ok(Array.isArray(toldEntries({ requirementsTold: [{ need, told, additions: add }] })), told);
  assert.ok(Array.isArray(toldEntries({ requirementsTold: [{ need, told: "behind", additions: add, hidden: [{ text: "Ask inside.", placement: ["conditional"] }] }] })), "behind");
  for (const told of ["unseen", "still-to-do", "set-up", "already-there"]) {
    // THE OBSERVER IS ALIVE: the same entry without additions reads.
    assert.ok(Array.isArray(toldEntries({ requirementsTold: [{ need, told }] })), `${told} alone did not read`);
    const v = toldEntries({ requirementsTold: [{ need, told, additions: add }] });
    assert.equal(v, null, `additions beside ${told} were read as an observation`);
  }
  assert.equal(toldEntries({ requirementsTold: [{ need, told: "shown", additions: [{ name: "card", route: "/visit", words: [{ text: "Free parking.", seen: "yes" }] }] }] }), null, "a malformed seen was read");
  assert.equal(toldEntries({ requirementsTold: [{ need, told: "shown", additions: [] }] }), null, "an empty list was read");
});

// THROUGH THE REAL ADD-ON ROUTE: Codex's shape, the stored record and the reply facts.
const TWO_CARDS = { component: [
  { page: "/", does: "a card about free parking", components: ["card"] },
  { page: "/", does: "a card saying dogs are welcome", components: ["card"] },
], requirements: [
  { need: "The home page tells people about free parking", status: "covered", by: "the parking card", item: "card", kind: "component", basis: "asked", words: "free parking" },
  { need: "The home page tells people that dogs are welcome inside", status: "covered", by: "the dogs card", item: "card", kind: "component", basis: "asked", words: "dogs are welcome" },
] };
const cardsRoute = (slug, words, text) => {
  const p = addedTo("/", words.map((w) => "<Card><p>" + w + "</p></Card>").join(""));
  return addon(slug, "add a card about free parking and a card saying dogs are welcome to the home page", {
    kinds: ["component"], publishes: true, storedPages: [storedPage("/")],
    answers: { component: TWO_CARDS },
    written: [{ ...p, source: CARD_IMPORT + "\n" + p.source }],
    judge: ({ entries, step }) => ({ verdicts: entries.map((e) => (step ? { id: e.id, follows: "asked", carried: "unsure", reason: "before" } : { id: e.id, follows: "asked", carried: "yes", by: ["component:card"], reason: "the cards carry it" })) }),
    render: { ok: true, checked: 1, pages: 1, findings: [], texts: [{ route: "/", text, complete: true }] },
  });
};

test("AT 14 — THROUGH THE ADD-ON ROUTE, CODEX'S SHAPE: \"Free parking.\" twice — the stored record keeps each addition's own words with both requests unverified, and the reply model is never told the dogs request was added and seen; control: one card each", async () => {
  const r = await cardsRoute("at-cards", ["Free parking.", "Free parking."], "Free parking. Free parking.");
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  const kept = storedAnswer(r, "at-cards").coverage.requirements;
  assert.equal(kept.length, 2);
  for (const o of kept) {
    assert.equal(o.state, "unverified", JSON.stringify(o));
    assert.deepEqual(o.content.additions.map((a) => a.words.map((w) => w.text)), [["Free parking."], ["Free parking."]], JSON.stringify(o));
  }
  const facts = addonReplyFacts(r.body).facts.map((f) => f.text);
  assert.ok(!facts.some((t) => /^Added, and seen/.test(t)), JSON.stringify(facts));
  assert.ok(facts.some((t) => t.includes("“Free parking.”; a new card on / whose own words are “Free parking.”") && t.includes("not checked here: The home page tells people that dogs are welcome inside")), JSON.stringify(facts));
  // CONTROL.
  const ok = await cardsRoute("at-cards-ok", ["Free parking.", "Dogs are welcome inside."], "Free parking. Dogs are welcome inside.");
  const keptOk = storedAnswer(ok, "at-cards-ok").coverage.requirements;
  assert.deepEqual(keptOk[1].content.additions.map((a) => a.words.map((w) => w.text)), [["Free parking."], ["Dogs are welcome inside."]]);
  assert.ok(addonReplyFacts(ok.body).facts.some((f) => f.text.includes("“Dogs are welcome inside.”")));
});
