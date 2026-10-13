// CONTENT A CHANGE PUT ON A PAGE: STORED, SHOWN ON LOAD, AND NEVER EXERCISED
// (2026-10-13, after run 144).
//
// Runs 135, 137, 141 and 144 each told the customer "I can't see from here
// whether …" about a questions section that was stored and served: a section
// the Add-on adds is a `component`, `component` is opaque, and every
// requirement it carried read `unknown`. The fix reads three facts apart —
// the text the change added to the stored code (syntax tree, before against
// after), whether the published page showed it as it first loaded (the render
// check's own browser), and behaviour, which nothing here exercises — and
// tells each in its own sentence, to the deterministic note and to the reply
// model's facts alike.
//
// The cases: content initially collapsed; content shown on load; content in
// one of a page's mutually exclusive views; content genuinely missing; reads
// that are incomplete or failed (no parser, a file that does not parse, a
// route the browser never reached, a read the cap cut, a part reached only
// maybe, a new component with no words of its own). Then the same through the
// real Add-on route, down to the facts the reply model is handed.
import test from "node:test";
import assert from "node:assert/strict";
import { tweakParser } from "../builder/site-tweak.mjs";
import { visibleTexts, addedByRoute, renderedTexts, routeEvidence, componentEvidence, foldText } from "../builder/content-evidence.mjs";
import { requirementReport, toldNote, readContent, TOLD } from "../builder/site-requirements.mjs";
import { addonReplyFacts, toldEntries, toldAs } from "../builder/site-reply.mjs";
import { renderReport, textProbe } from "../builder/site-render.mjs";
import { addon, addedTo, storedPage } from "./fixtures/addon-route.mjs";

const parse = await tweakParser();
assert.ok(parse, "the TypeScript parser is not installed — every case below would be reading `unread`");

const HEAD = "import { createFileRoute } from '@tanstack/react-router'\nimport { Faq } from '@/components/ui/faq'\nexport const Route = createFileRoute('/bake-list')({ component: Page })\n";
const BEFORE = HEAD + "function Page(){ return <main><h1>Bake List</h1><p>Leave your name and email.</p></main> }\n";
const FAQ = '<Faq items={[{ question: "Can I leave the list?", answer: "Yes, reply STOP to any note." }]} />';
const AFTER_FAQ = BEFORE.replace("</main>", FAQ + "</main>");
// TWO VIEWS: the form, and what shows once it is sent. The sentence is added
// to the sent view only.
const VIEWS_BEFORE = HEAD + "function Page(){ const [sent] = useState(false);\n  if (sent) { return <main><h1>You're on the list</h1></main>; }\n  return <main><h1>Bake List</h1><p>Leave your name and email.</p></main>;\n}\n";
const VIEWS_AFTER = VIEWS_BEFORE.replace("<h1>You're on the list</h1>", "<h1>You're on the list</h1><p>We write every Friday.</p>");

const page = (source, routes = ["/bake-list"], extra = {}) => ({ path: "bake-list.tsx", source, routes, maybeRoutes: [], ...extra });
const ANSWERS = [{ kind: "component", value: [{ page: "/bake-list", does: "a short questions section", components: ["faq"] }] }];
const render = (text, complete = true, route = "/bake-list") => renderedTexts({ texts: [{ route, text, complete }] });
const REQ = (extra = {}) => ({
  need: "The Bake List page has a short questions section answering whether someone can leave the list",
  status: "covered", from: "component", kind: "component", item: "faq", by: "the questions section answers it", basis: "asked", words: "a questions section",
  judged: { follows: "asked", carried: "yes", by: ["component:faq"], reason: "the case's verdict" }, ...extra,
});
const report = (content) => requirementReport([REQ()], { judged: true, reportable: ["component"], content });
const factsOf = (told) => addonReplyFacts({ ok: true, kinds: ["component"], changed: ["bake-list.tsx"], requirementsTold: told, coverNote: toldNote(told) }).facts;

// ─── THE READER ON ITS OWN ───────────────────────────────────────────────────

test("CE 1 — visibleTexts reads what a visitor could read, with where it sits, and nothing technical", () => {
  const t = visibleTexts(AFTER_FAQ, parse);
  const words = t.map((x) => x.text);
  assert.ok(words.includes("Can I leave the list?") && words.includes("Yes, reply STOP to any note."), JSON.stringify(t));
  assert.ok(words.includes("Bake List") && words.includes("Leave your name and email."));
  for (const junk of ["@tanstack/react-router", "@/components/ui/faq", "/bake-list"]) assert.ok(!words.includes(junk), "read as text: " + junk);
  assert.deepEqual(t.find((x) => x.text === "Yes, reply STOP to any note.").placement, ["handed"]);
  assert.deepEqual(t.find((x) => x.text === "Leave your name and email.").placement, ["direct"]);
  // A CONDITIONAL VIEW: both returns are one view of several.
  const v = visibleTexts(VIEWS_AFTER, parse);
  assert.deepEqual(v.find((x) => x.text === "We write every Friday.").placement, ["conditional"]);
  assert.deepEqual(v.find((x) => x.text === "Leave your name and email.").placement, ["conditional"]);
  // NO PARSER, OR A FILE THAT DOES NOT PARSE: null, never a guess.
  assert.equal(visibleTexts(AFTER_FAQ, null), null);
  assert.equal(visibleTexts("function Page( { return <main>", parse), null);
});

test("CE 2 — addedByRoute is before against after: only what this change added, per route, repeats counted", () => {
  const a = addedByRoute({ before: [page(BEFORE)], after: [page(AFTER_FAQ)], parse });
  assert.deepEqual(a.get("/bake-list").added.map((x) => x.text), ["Can I leave the list?", "Yes, reply STOP to any note."]);
  assert.equal(a.get("/bake-list").read, true);
  // An unchanged page adds nothing and reaches no route.
  assert.equal(addedByRoute({ before: [page(BEFORE)], after: [page(BEFORE)], parse }).size, 0);
  // A sentence the page already said, said a second time, is added once.
  const twice = BEFORE.replace("</main>", "<p>Leave your name and email.</p></main>");
  assert.deepEqual(addedByRoute({ before: [page(BEFORE)], after: [page(twice)], parse }).get("/bake-list").added.map((x) => x.text), ["Leave your name and email."]);
  assert.equal(addedByRoute({ before: [page(BEFORE)], after: [page(AFTER_FAQ)], parse: null }), null, "with no parser nothing can be told");
});

// ─── THE FOUR KINDS OF OUTCOME, AND WHAT THE CUSTOMER IS TOLD ────────────────

test("CE 3 — INITIALLY COLLAPSED (run 144's shape): stored, not shown on first load, opening it never tried — said as exactly that, to the note and to the reply model", () => {
  const ev = componentEvidence({ answers: ANSWERS, added: addedByRoute({ before: [page(BEFORE)], after: [page(AFTER_FAQ)], parse }), rendered: render("Bake List\nLeave your name and email.\nCan I leave the list?") });
  assert.deepEqual(readContent(ev.faq), { stored: "added", shown: "some", hidden: [{ text: "Yes, reply STOP to any note.", placement: ["handed"], route: "/bake-list" }] });
  const r = report(ev);
  assert.equal(r.told.length, 1);
  assert.equal(r.told[0].told, "behind");
  assert.equal(r.told[0].state, "unverified", "the content is there; nothing exercised it");
  assert.deepEqual(r.told[0].hidden, [{ text: "Yes, reply STOP to any note.", placement: ["handed"] }]);
  const note = toldNote(r.told);
  assert.match(note, /doesn't show when the page first loads/);
  assert.match(note, /I haven't tried that from here/);
  assert.doesNotMatch(note, /can't see from here whether/, "the old 'unseen' sentence came back");
  // THE REPLY MODEL'S FACTS: present in code, not shown on load, interaction unverified, by its own words.
  const facts = factsOf(r.told);
  const f = facts.find((x) => /first loads/.test(x.text));
  assert.ok(f, JSON.stringify(facts));
  assert.equal(f.kind, "note");
  assert.match(f.text, /Added to the page's code, and not shown when the published page first loads/);
  assert.match(f.text, /a question that opens to its answer/);
  assert.match(f.text, /Nothing here opened, switched or sent anything, so whether it appears when a visitor does is not checked/);
  assert.match(f.text, /“Yes, reply STOP to any note\.”/);
  assert.ok(!facts.some((x) => /can see whether this is in place/.test(x.text)), "the reply model was still told nothing could be seen");
  assert.ok(!facts.some((x) => /\bworks\b/.test(x.text) && !/can check that it works/.test(x.text)), "a fact claimed the interaction works");
});

test("CE 4 — SHOWN ON LOAD: every added text on the first-load page — 'seen', and still no claim about anything a visitor does", () => {
  const ev = componentEvidence({ answers: ANSWERS, added: addedByRoute({ before: [page(BEFORE)], after: [page(AFTER_FAQ)], parse }), rendered: render("Bake List Can I leave the list? Yes, reply STOP to any note.") });
  assert.equal(ev.faq.shown, "all");
  const r = report(ev);
  assert.equal(r.told[0].told, "shown");
  assert.equal(r.told[0].hidden, undefined);
  assert.match(toldNote(r.told), /it shows on the published page as it first loads/);
  const f = factsOf(r.told).find((x) => /first loads/.test(x.text));
  assert.match(f.text, /^Added, and seen on the published page as it first loads \(nothing a visitor might do with it was tried\)/);
  // FOLDING: curly quotes, dashes and spacing do not make a shown text hidden.
  const curly = BEFORE.replace("</main>", "<p>We’re open — come in.</p></main>");
  const e2 = routeEvidence("/bake-list", addedByRoute({ before: [page(BEFORE)], after: [page(curly)], parse }), render("We're  open - come in."));
  assert.equal(e2.shown, "all");
  assert.equal(foldText("We’re — OPEN"), "we're - open");
});

test("CE 5 — MUTUALLY EXCLUSIVE VIEWS: a sentence added to the view the page is not in on load is in the code, not shown, placed in an alternative view; the same added to both views is shown where the page is", () => {
  const ev = componentEvidence({
    answers: ANSWERS,
    added: addedByRoute({ before: [page(VIEWS_BEFORE)], after: [page(VIEWS_AFTER)], parse }),
    rendered: render("Bake List\nLeave your name and email."),
  });
  assert.equal(ev.faq.shown, "none");
  assert.deepEqual(ev.faq.hidden.map((h) => h.placement), [["conditional"]]);
  const r = report(ev);
  assert.equal(r.told[0].told, "behind");
  const f = factsOf(r.told).find((x) => /first loads/.test(x.text));
  assert.match(f.text, /in one of the page's alternative views/);
  assert.doesNotMatch(f.text, /a question that opens/, "a placement the code does not have was named");
  // BOTH VIEWS GET IT: the load shows its copy; one hidden copy is still a hidden text.
  const both = VIEWS_AFTER.replace("<p>Leave your name and email.</p>", "<p>Leave your name and email.</p><p>We write every Friday.</p>");
  const e2 = routeEvidence("/bake-list", addedByRoute({ before: [page(VIEWS_BEFORE)], after: [page(both)], parse }), render("Bake List Leave your name and email. We write every Friday."));
  assert.equal(e2.shown, "all", "a text shown on load counts as shown, wherever its other copy sits");
});

test("CE 6 — GENUINELY MISSING: the component's page was read whole and nothing was added there — 'still to do', never 'set up'", () => {
  // Nothing changed on the page at all.
  let ev = componentEvidence({ answers: ANSWERS, added: addedByRoute({ before: [page(BEFORE)], after: [page(BEFORE)], parse }), rendered: render("Bake List") });
  assert.deepEqual(ev.faq, { stored: "none", routes: ["/bake-list"] });
  let r = report(ev);
  assert.equal(r.told[0].told, "still-to-do");
  assert.equal(r.told[0].state, "missing");
  assert.match(toldNote(r.told), /Still to do: The Bake List page has a short questions section/);
  assert.ok(factsOf(r.told).some((x) => x.kind === "not-done" && /^Not done: The Bake List page/.test(x.text)));
  // The page changed, and only in a class name: no text, no component — still nothing added.
  const cls = BEFORE.replace("<main>", '<main className="mt-10">');
  ev = componentEvidence({ answers: ANSWERS, added: addedByRoute({ before: [page(BEFORE)], after: [page(cls)], parse }), rendered: render("Bake List") });
  assert.equal(ev.faq.stored, "none");
  assert.equal(report(ev).told[0].told, "still-to-do");
});

test("CE 7 — INCOMPLETE OR FAILED READS are never read as present or absent", () => {
  const added = addedByRoute({ before: [page(BEFORE)], after: [page(AFTER_FAQ)], parse });
  // (a) NO PARSER: unread → the old 'unseen', unchanged.
  let ev = componentEvidence({ answers: ANSWERS, added: addedByRoute({ before: [page(BEFORE)], after: [page(AFTER_FAQ)], parse: null }), rendered: render("x") });
  assert.equal(ev.faq.stored, "unread");
  assert.equal(report(ev).told[0].told, "unseen");
  // (b) THE NEW FILE DOES NOT PARSE: unread.
  ev = componentEvidence({ answers: ANSWERS, added: addedByRoute({ before: [page(BEFORE)], after: [page(AFTER_FAQ.replace("</main>", "</main"))], parse }), rendered: render("x") });
  assert.equal(ev.faq.stored, "unread");
  assert.equal(report(ev).told[0].told, "unseen");
  // (c) THE BROWSER NEVER REACHED THE ROUTE: in the code, page unread → 'in-code'.
  ev = componentEvidence({ answers: ANSWERS, added, rendered: new Map() });
  assert.equal(ev.faq.shown, "unread");
  let r = report(ev);
  assert.equal(r.told[0].told, "in-code");
  assert.match(toldNote(r.told), /couldn't read the published page to see it/);
  assert.match(factsOf(r.told).find((x) => /could not be read/.test(x.text)).text, /^Added to the page's code; the published page could not be read, so whether it shows is not known/);
  // (d) THE READ THE CAP CUT: a text not found there is unread, never hidden…
  ev = componentEvidence({ answers: ANSWERS, added, rendered: render("Bake List Can I leave the list?", false) });
  assert.equal(ev.faq.shown, "unread");
  assert.equal(report(ev).told[0].told, "in-code");
  // …and a text found there still counts as shown.
  assert.equal(componentEvidence({ answers: ANSWERS, added, rendered: render("Can I leave the list? Yes, reply STOP to any note.", false) }).faq.shown, "all");
  // (e) A PART REACHED ONLY MAYBE: unread.
  const part = { path: "src/routes/-parts/faq-band.tsx", name: "faq-band", source: "export default function F(){ return <section><p>Yes, reply STOP to any note.</p></section> }", routes: [], maybeRoutes: ["/bake-list"] };
  ev = componentEvidence({ answers: ANSWERS, added: addedByRoute({ before: [], after: [part], parse }), rendered: render("x") });
  assert.equal(ev.faq.stored, "unread");
  // (f) A NEW COMPONENT WITH NO WORDS OF ITS OWN: added, content unread — 'in-code', never 'still to do'.
  const tagOnly = BEFORE.replace("</main>", "<OpeningHours />" + "</main>");
  ev = componentEvidence({ answers: ANSWERS, added: addedByRoute({ before: [page(BEFORE)], after: [page(tagOnly)], parse }), rendered: render("Bake List Open Mon–Fri") });
  assert.deepEqual(readContent(ev.faq), { stored: "added", shown: "unread" });
  assert.equal(report(ev).told[0].told, "in-code");
  // (g) NO EVIDENCE AT ALL (a failure exit, or a record written before this): the old reading, exactly.
  assert.equal(report(null).told[0].told, "unseen");
  assert.equal(report({ faq: { stored: "added", shown: "maybe" } }).told[0].told, "unseen", "a malformed reading was trusted");
});

test("CE 8 — an existing part a page newly renders brings its text to that route; one already there adds nothing", () => {
  const partSrc = "export default function F(){ return <section><p>Yes, reply STOP to any note.</p></section> }";
  const was = { path: "src/routes/-parts/faq-band.tsx", name: "faq-band", source: partSrc, routes: ["/visit"], maybeRoutes: [] };
  const now = { ...was, routes: ["/visit", "/bake-list"] };
  const a = addedByRoute({ before: [page(BEFORE), was], after: [page(BEFORE.replace("</main>", "<FaqBand /></main>")), now], parse });
  assert.deepEqual(a.get("/bake-list").added.map((x) => x.text), ["Yes, reply STOP to any note."]);
  assert.equal(a.has("/visit"), false, "a route the part already reached was told something was added there");
});

test("CE 9 — the reply's facts read strictly: hidden words only beside 'behind', placements only from the known set; anything else falls back to the whole note", () => {
  const ok = [{ need: "N", told: "behind", state: "unverified", hidden: [{ text: "T", placement: ["handed"] }] }];
  assert.ok(toldEntries({ requirementsTold: ok }));
  assert.equal(toldEntries({ requirementsTold: [{ ...ok[0], told: "shown" }] }), null, "hidden words were accepted beside 'shown'");
  assert.equal(toldEntries({ requirementsTold: [{ ...ok[0], hidden: [{ text: "T", placement: ["clicked"] }] }] }), null);
  assert.equal(toldEntries({ requirementsTold: [{ ...ok[0], hidden: [] }] }), null);
  for (const t of ["shown", "behind", "in-code"]) assert.ok(TOLD.includes(t), t + " is not in the note's order");
  // UNDER A FAILURE THAT APPLIED NOTHING, content read off a published page was not this change's.
  assert.equal(toldAs({ told: "shown" }, { database: "none" }), "already-there");
  assert.equal(toldAs({ told: "behind" }, { database: "unknown" }), "unseen");
  assert.equal(toldAs({ told: "behind" }, { database: "applied" }), "behind");
});

test("CE 10 — the render check's first-load text: innerText as the page loaded, whitespace folded, `complete` false only when cut; carried on the report, absent when empty", () => {
  const was = globalThis.document;
  try {
    globalThis.document = { body: { innerText: "  Bake List \n\n  Can I leave the list?\t\t\n" } };
    assert.deepEqual(textProbe({ route: "/bake-list", cap: 100 }), { route: "/bake-list", text: "Bake List\nCan I leave the list?", complete: true });
    assert.deepEqual(textProbe({ route: "/bake-list", cap: 5 }), { route: "/bake-list", text: "Bake ", complete: false });
  } finally { globalThis.document = was; }
  const texts = [{ route: "/", text: "Hi", complete: true }];
  assert.deepEqual(renderReport([], { texts }).texts, texts);
  assert.equal("texts" in renderReport([], {}), false, "an empty text list changed every report");
  assert.deepEqual([...renderedTexts({ texts: [...texts, { route: 4, text: "x" }, { route: "/a" }] })], [["/", { complete: true, text: "Hi" }]]);
});

// ─── THROUGH THE REAL ADD-ON ROUTE ───────────────────────────────────────────

const MSG = "add a questions section to the home page answering 'Can I leave the list?' with 'Yes, reply STOP to any note.'";
const HOME_FAQ = '<Faq items={[{ question: "Can I leave the list?", answer: "Yes, reply STOP to any note." }]} />';
const ROUTE_REQ = { need: "The home page has a short questions section answering whether someone can leave the list", status: "covered", by: "the questions section answers it", item: "faq", kind: "component", basis: "asked", words: "a questions section" };
const viaRoute = (slug, { text, complete = true, written = [addedTo("/", HOME_FAQ)], reached = true, stored = [storedPage("/")] } = {}) => addon(slug, MSG, {
  kinds: ["component"], publishes: true, storedPages: stored,
  answers: { component: { component: [{ page: "/", does: "a short questions section", components: ["faq"] }], requirements: [ROUTE_REQ] } },
  written,
  judge: ({ entries, step }) => ({ verdicts: entries.map((e) => (step ? { id: e.id, follows: "asked", carried: "unsure", reason: "before" } : { id: e.id, follows: "asked", carried: "yes", by: ["component:faq"], reason: "the faq carries it" })) }),
  render: { ok: true, checked: 1, pages: 1, findings: [], ...(reached ? { texts: [{ route: "/", text, complete }] } : {}) },
});

test("CE 11 — THROUGH THE ROUTE, COLLAPSED: the answer, the stored record and the reply model's facts all say in the code, not shown on load, opening untried", async () => {
  const r = await viaRoute("ce-collapsed", { text: "index\nWords for index.\nCan I leave the list?" });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 800));
  assert.equal(r.body.requirementsTold.length, 1, JSON.stringify(r.body.requirementsTold));
  assert.equal(r.body.requirementsTold[0].told, "behind", JSON.stringify(r.body.requirementsTold));
  assert.deepEqual(r.body.requirementsTold[0].hidden, [{ text: "Yes, reply STOP to any note.", placement: ["handed"] }]);
  assert.match(r.body.coverNote, /doesn't show when the page first loads/);
  assert.doesNotMatch(r.body.coverNote, /can't see from here whether/);
  // THE STORED RECORD SAYS THE SAME (the last write, after the pages shipped).
  const rec = r.meta && r.meta();
  const stored = rec && rec.coverage ? rec.coverage : null;
  if (stored && Array.isArray(stored.requirements)) {
    const o = stored.requirements.find((x) => x.item === "faq");
    assert.ok(o && o.state === "unverified" && o.content && o.content.shown === "some", JSON.stringify(o));
  }
  const facts = addonReplyFacts(r.body).facts;
  assert.ok(facts.some((x) => /not shown when the published page first loads/.test(x.text) && /not checked/.test(x.text)), JSON.stringify(facts));
  assert.ok(!facts.some((x) => /can see whether this is in place/.test(x.text)));
});

test("CE 12 — THROUGH THE ROUTE: shown on load; the page left without the section is still to do; a route the browser never reached is in the code, unread", async () => {
  const shown = await viaRoute("ce-shown", { text: "index Words for index. Can I leave the list? Yes, reply STOP to any note." });
  assert.equal(shown.body.requirementsTold[0].told, "shown", JSON.stringify(shown.body.requirementsTold));
  // THE WRITER CHANGED ANOTHER PAGE AND LEFT THE HOME PAGE WITHOUT THE SECTION.
  const missing = await viaRoute("ce-missing", { text: "index Words for index.", stored: [storedPage("/"), storedPage("/visit")], written: [addedTo("/visit", "<p>Open late on Fridays.</p>")] });
  assert.equal(missing.body.ok, true, JSON.stringify(missing.body).slice(0, 600));
  assert.equal(missing.body.requirementsTold[0].told, "still-to-do", JSON.stringify(missing.body.requirementsTold));
  assert.ok(addonReplyFacts(missing.body).facts.some((x) => x.kind === "not-done" && /^Not done: The home page/.test(x.text)));
  const unread = await viaRoute("ce-unread", { reached: false });
  assert.equal(unread.body.requirementsTold[0].told, "in-code", JSON.stringify(unread.body.requirementsTold));
});
