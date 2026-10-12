// IMAGE-FREE ADD-ON ACCEPTANCE (2026-10-12, prepared, not pressed).
//
// The owner, closing the repair batch on 358dff0a: *"Update the existing
// acceptance plan with image-free Add-on scenarios so that testing independent
// additions does not depend on buying photographs; include independent tasks
// within one Add-on and across separate request parts … Specify the evidence
// needed for actual execution overlap, correct final results, dependency
// ordering, reuse and no duplicate charges."*
//
// What is new here and checked here:
//   - the four scenarios (`acc-addon-inner`, `acc-addon-edit`,
//     `acc-addon-pair` and, after P1, `acc-addon-kinds`) carry the same guards as A1–A5 and
//     buy nothing;
//   - `sections`, the outcome check for a section added to a page that exists;
//   - `addonDesignOverlap`, the free read of whether one Add-on's designers ran
//     together, claimed only when the trace can only be that job's.
// The offline runs of the same shapes are PI 32 and PI 33
// (test/parallel-addon-independent.test.mjs). Nothing here routes, edits or
// buys anything.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { UI_SCENARIOS, ACCEPTANCE_CAP } from "../scripts/canary-ui.mjs";
import { outcomeChecks, routeOfPage, requestBatchVerdict, COVERAGE, openReadRoutes } from "../scripts/canary-requests.mjs";
import { addonDesignOverlap, readJobRecords, describeJob, SIBLING_READ_LIMIT } from "../scripts/canary-read-job.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const SLUG = "fold-lane-bakery";
const NEW = ["acc-addon-inner", "acc-addon-edit", "acc-addon-pair", "acc-addon-kinds", "acc-addon-two-parts"];
// THE MESSAGES P1 (run 128) ROUTED, in acceptance-split-1; acc-addon-kinds was
// written after it and is probed alone, in acceptance-split-2.
const P1_PROBED = ["acc-addon-inner", "acc-addon-edit", "acc-addon-pair"];

// ── THE SCENARIOS ───────────────────────────────────────────────────────────

test("THE IMAGE-FREE ADD-ON SCENARIOS: each buys no image, is bound by the acceptance cap, sends nothing unless the balance covers its estimate, opens the add-on step, and asks for no photograph, form or table", () => {
  for (const k of NEW) {
    const sc = UI_SCENARIOS[k];
    assert.ok(sc, `no ${k}`);
    assert.equal(sc.images, "none", k);
    assert.equal(sc.cap, ACCEPTANCE_CAP, k);
    assert.equal(sc.fundsFirst, true, k);
    assert.equal(sc.addon, true, k);
    assert.equal(sc.site, SLUG, k);
    assert.equal(sc.request, true, k);
    assert.ok(Number.isInteger(sc.budget) && sc.budget > 0 && sc.budget <= ACCEPTANCE_CAP, k);
    assert.equal(sc.steps.length, 1, k);
    assert.doesNotMatch(sc.steps[0].say, /\b(a|an|some) (photo|photograph|picture|image)s?\b|\bform\b|\btable\b|sign.?up/i, `${k} asks for something that buys or stores`);
    assert.ok(Array.isArray(sc.expect.sections) && sc.expect.sections.length > 0, `${k} names no section to judge`);
  }
});

test("WHAT EACH ONE DEMANDS (after P1, run 128): the one written for one Add-on of two kinds reads its overlap from its job and never demands it of the request; across an Add-on and an Edit part, overlap and exact reuse are demanded; two sections of one kind record the router's shape and demand no concurrency; the page-and-section message is left as it was reviewed", () => {
  const kinds = UI_SCENARIOS["acc-addon-kinds"].expect;
  assert.equal(kinds.inner, true);
  assert.equal(kinds.overlap, undefined, "the request-level overlap is demanded of what may be one job");
  assert.equal(kinds.shape, true);
  assert.deepEqual(kinds.sections.map((x) => x.route), ["/visit", "/order"]);
  assert.ok(UI_SCENARIOS["acc-addon-kinds"].covers.includes("addon-inner"));
  const inner = UI_SCENARIOS["acc-addon-inner"].expect;
  assert.equal(inner.inner, true);
  assert.equal(inner.overlap, undefined);
  assert.equal(inner.shape, true);
  assert.deepEqual({ ...inner.menu }, { page: 0 });
  const edit = UI_SCENARIOS["acc-addon-edit"].expect;
  assert.equal(edit.overlap, true);
  assert.deepEqual({ ...edit.reuse }, { exact: 1, overlapped: true });
  assert.ok(UI_SCENARIOS["acc-addon-edit"].covers.includes("edit-and-addon"));
  const pair = UI_SCENARIOS["acc-addon-pair"].expect;
  assert.equal(pair.overlap, undefined);
  assert.equal(pair.inner, undefined, "two sections are one kind: one designer, nothing inside the job to run beside");
  assert.equal(pair.shape, true);
  assert.equal(pair.sections.length, 2);
  assert.ok(Object.hasOwn(COVERAGE, "addon-inner"), "the inside-one-Add-on coverage has no reader");
});

test("EACH MESSAGE IS PROBED FIRST: acceptance-split-1 routes every new scenario's own words, recorded and unjudged", () => {
  const b = JSON.parse(fs.readFileSync(ROOT + "scripts/router-probes/acceptance-split-1.json", "utf8"));
  for (const k of P1_PROBED) {
    const p = b.probes.find((x) => x.message === UI_SCENARIOS[k].steps[0].say);
    assert.ok(p, `${k}'s message is not probed`);
    assert.equal(p.intended, null);
    assert.equal(p.site, SLUG);
  }
  assert.equal(new Set(b.probes.map((p) => p.id)).size, b.probes.length);
});

// ── `sections`: A SECTION ADDED TO A PAGE THAT EXISTS ───────────────────────

const PAGES = ["index", "visit", "order", "gallery", "starter"].map((n) => ({ path: n + ".tsx", source: fs.readFileSync(ROOT + "test/fixtures/run47/" + n + ".before.tsx", "utf8") }));
const TABLES = { ok: true, names: [], tables: {} };
const SPEC = { expect: { sections: [{ route: "/visit", says: ["dogs", "welcome"] }] } };
const SECTION = '<section className="faq"><h2>Questions</h2><p>Can I bring my dog? Dogs are welcome inside.</p></section>';
const PART = { path: "visit-faq.tsx", source: 'export function VisitFaq(){ return <section><h2>Questions</h2><p>Can I bring my dog? Dogs are welcome inside.</p></section> }\n' };
function read(pages, parts = [], mainOf = {}) {
  const served = {}, render = {};
  for (const p of pages) {
    const r = routeOfPage(p.source);
    served[r] = `<!doctype html><html><body><header><a href="/"><img src="/u/${SLUG}/logo.png" alt="logo"/></a></header><main><h1>page</h1>${mainOf[r] || ""}</main></body></html>`;
    render[r] = { status: 200, headings: ["page"] };
  }
  return { inv: { complete: true, source: { pages, parts }, render, stored: { ok: true, description: "" } }, served };
}
const withSection = (pages, html) => pages.map((p) => (p.path === "visit.tsx" ? { ...p, source: p.source.replace("</SiteChrome>", html + "\n    </SiteChrome>") } : p));
const judge = (b, a, spec = SPEC) => outcomeChecks({ spec, before: b.inv, after: a.inv, served: a.served, beforeServed: b.served, tables: { before: TABLES, after: TABLES }, slug: SLUG }).checks;
const bad = (checks) => checks.filter((c) => !c.ok).map((c) => c.name);

test("SECTIONS: a section written into the page, everything else kept, the served page saying it — every check passes; the same section in a component file the press added passes too", () => {
  const b = read(PAGES);
  assert.ok(PAGES.find((p) => p.path === "visit.tsx").source.includes("</SiteChrome>"), "the fixture's landmark is gone");
  const a = read(withSection(PAGES, SECTION), [], { "/visit": SECTION });
  const c = judge(b, a);
  assert.ok(c.some((x) => /\/visit gained a section saying "dogs" and "welcome"/.test(x.name)), "the observer is alive: the section check ran");
  assert.deepEqual(bad(c), []);
  const a2 = read(withSection(PAGES, "<VisitFaq />"), [PART], { "/visit": SECTION });
  assert.deepEqual(bad(judge(b, a2)), []);
});

test("SECTIONS, NEGATIVE: words lost from the page, words it already said, a served page not saying them, another page changed, or an unasked component — each fails by name", () => {
  const b = read(PAGES);
  // lost words
  const lost = withSection(PAGES, SECTION).map((p) => (p.path === "visit.tsx" ? { ...p, source: p.source.replace("The shutters and the street", "The street") } : p));
  assert.ok(bad(judge(b, read(lost, [], { "/visit": SECTION }))).includes("/visit still says everything it said"));
  // already said before: the page gains nothing new for these words
  const said = withSection(PAGES, SECTION);
  assert.ok(bad(judge(read(said, [], { "/visit": SECTION }), read(withSection(said, "<p>More.</p>"), [], { "/visit": SECTION }))).some((n) => /gained a section saying/.test(n)));
  // not served
  assert.ok(bad(judge(b, read(withSection(PAGES, SECTION)))).includes("the served /visit says it"));
  // another page changed
  const other = withSection(PAGES, SECTION).map((p) => (p.path === "order.tsx" ? { ...p, source: p.source + "\n// changed\n" } : p));
  assert.ok(bad(judge(b, read(other, [], { "/visit": SECTION }))).includes("every stored page is byte for byte as it was, apart from the named changes"));
  // with no section asked, a new component is still refused
  assert.ok(bad(judge(b, read(PAGES, [PART]), { expect: {} })).some((n) => /^no component was added/.test(n)));
});

// ── EVERY FACT ASKED FOR (round 17, after Codex's controls on 3869478b) ────
//
// "£50 a head, cheese included" passed a section asked to say "£25 a head,
// cheese included". Each case below is a section or page as a press would
// read it, judged through `outcomeChecks` with the scenario's own expectation.
const factNames = (checks) => checks.filter((c) => !c.ok).map((c) => c.name);
const sectionAt = (scenario, route) => UI_SCENARIOS[scenario].expect.sections.find((x) => x.route === route);
const withWords = (pages, path, html) => pages.map((p) => (p.path === path ? { ...p, source: p.source.replace("</SiteChrome>", html + "\n    </SiteChrome>") } : p));
const judgeSection = (scenario, route, path, html) => {
  const spec = { expect: { sections: [sectionAt(scenario, route)] } };
  const b = read(PAGES);
  const a = read(withWords(PAGES, path, html), [], { [route]: html });
  return factNames(judge(b, a, spec));
};
const START = "/starter", VISIT = "/visit";

test("FACTS, acc-addon-inner's section: £25 a head with the cheese included passes, in other words too; £50 (Codex's control), no amount, a second amount beside £25, or cheese not included each fails by name", () => {
  // The bakery's fixture pages here are run 47's; the tasting page is played by /visit's file, which is what `judge` compares.
  const s = { ...sectionAt("acc-addon-inner", "/tasting-evenings"), route: VISIT };
  const run = (html) => {
    const b = read(PAGES), a = read(withWords(PAGES, "visit.tsx", html), [], { [VISIT]: html });
    return factNames(judge(b, a, { expect: { sections: [s] } }));
  };
  const q = (ans) => `<section><h2>How much is an evening?</h2><p>${ans}</p></section>`;
  assert.deepEqual(run(q("£25 a head, cheese included.")), []);
  assert.deepEqual(run(q("It is £25 per person, including cheese.")), [], "equivalent wording is refused");
  const fifty = run(q("£50 a head, cheese included."));
  assert.ok(fifty.some((n) => /states "£25 a head"/.test(n)) && fifty.some((n) => /states no amount but 25/.test(n)), "Codex's control passed: " + JSON.stringify(fifty));
  assert.ok(run(q("A set price a head, cheese included.")).some((n) => /states "£25 a head"/.test(n)), "a missing amount passed");
  assert.ok(run(q("£25 a head, cheese included. Private evenings are £50 a head.")).some((n) => /states no amount but 25/.test(n)), "a contradicting second amount passed");
  // STORED RIGHT, SERVED WRONG: the served page is judged on its own words too.
  const servedWrong = (() => { const b = read(PAGES), a = read(withWords(PAGES, "visit.tsx", q("£25 a head, cheese included.")), [], { [VISIT]: q("£50 a head.") }); return factNames(judge(b, a, { expect: { sections: [s] } })); })();
  assert.ok(servedWrong.some((n) => /^the section served on \/visit/.test(n)), "a served page that says otherwise passed: " + JSON.stringify(servedWrong));
  const extra = run(q("£25 a head, cheese not included."));
  assert.ok(extra.some((n) => /states "cheese included"/.test(n)) && extra.some((n) => /does not claim "cheese not included"/.test(n)), JSON.stringify(extra));
});

test("FACTS, acc-addon-inner's page: Clifton, Redland and Montpelier on weekday mornings passes, also as Monday to Friday; a missing place, a weekend day or an afternoon fails by name", () => {
  const want = UI_SCENARIOS["acc-addon-inner"].expect.pages[0];
  const pageAt = (words) => ({ path: "delivery.tsx", source: `import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/delivery")({ component: P });\nfunction P() { return <main><h1>Delivery</h1><p>${words}</p></main>; }\n` });
  const run = (words) => {
    const b = read(PAGES), after = [...PAGES, pageAt(words)];
    const a = read(after, [], { "/delivery": `<h1>Delivery</h1><p>${words}</p>` });
    return factNames(judge(b, a, { expect: { pages: [want] } })).filter((n) => !/menu/.test(n));
  };
  assert.deepEqual(run("We deliver to Clifton, Redland and Montpelier on weekday mornings."), []);
  assert.deepEqual(run("Deliveries reach Clifton, Redland and Montpelier, Monday to Friday mornings."), []);
  assert.ok(run("We deliver to Clifton and Montpelier on weekday mornings.").some((n) => /states "Redland"/.test(n)), "a missing place passed");
  assert.ok(run("We deliver to Clifton, Redland and Montpelier on weekday mornings and Saturdays.").some((n) => /states no day but/.test(n)), "a weekend day passed");
  assert.ok(run("We deliver to Clifton, Redland and Montpelier on weekday mornings and at weekends.").some((n) => /states no day but/.test(n)), "\"at weekends\" passed");
  assert.ok(run("We deliver to Clifton, Redland and Montpelier on weekday afternoons.").some((n) => /states "in the morning"|states no time of day but morning/.test(n)), "an afternoon passed");
});

test("FACTS, acc-addon-edit's section: every Monday morning passes; Tuesday, Monday and Thursday, or Monday evening fails by name", () => {
  const run = (ans) => judgeSection("acc-addon-edit", "/bake-list", "order.tsx", `<section><h2>When is the list updated?</h2><p>${ans}</p></section>`);
  const s = sectionAt("acc-addon-edit", "/bake-list");
  assert.ok(s && s.only && s.facts.length >= 3);
  // /bake-list is not in run 47's fixture: the same expectation is judged on /order's file.
  const on = (ans) => { const t = { ...s, route: "/order" }; const html = `<section><h2>When is the list updated?</h2><p>${ans}</p></section>`; const b = read(PAGES); const a = read(withWords(PAGES, "order.tsx", html), [], { "/order": html }); return factNames(judge(b, a, { expect: { sections: [t] } })); };
  assert.deepEqual(on("Every Monday morning."), []);
  assert.deepEqual(on("We refresh it on Mondays, first thing in the morning."), []);
  assert.ok(on("Every Tuesday morning.").some((n) => /states "every Monday"|states no day but monday/.test(n)), "a wrong day passed");
  assert.ok(on("Every Monday and Thursday morning.").some((n) => /states no day but monday/.test(n)), "a second day passed");
  assert.ok(on("Every Monday evening.").some((n) => /states "in the morning"|states no time of day but morning/.test(n)), "an evening passed");
  assert.equal(typeof run, "function");
});

test("FACTS, acc-addon-pair's sections: dogs welcome inside passes; dogs not welcome, or outside only, fails; a starter made with rye flour that is not gluten-free passes, said with \"No,\" or plainly; one claimed gluten-free, or not said to be made with rye flour, fails", () => {
  const dogs = (ans) => judgeSection("acc-addon-pair", VISIT, "visit.tsx", `<section><h2>Can I bring my dog?</h2><p>${ans}</p></section>`);
  assert.deepEqual(dogs("Dogs are welcome inside."), []);
  assert.deepEqual(dogs("Yes, dogs are very welcome indoors."), []);
  assert.ok(dogs("Dogs are not welcome inside.").some((n) => /states "dogs are welcome"|states what was asked/.test(n)), "a refusal passed");
  assert.ok(dogs("Dogs are welcome outside only.").some((n) => /states "inside"|does not claim "outside only"/.test(n)), "outside only passed");
  const st = { ...sectionAt("acc-addon-pair", START), route: "/order" };
  const starter = (ans) => { const html = `<section><h2>Is the starter gluten-free?</h2><p>${ans}</p></section>`; const b = read(PAGES); const a = read(withWords(PAGES, "order.tsx", html), [], { "/order": html }); return factNames(judge(b, a, { expect: { sections: [st] } })); };
  assert.deepEqual(starter("No, it is made with rye flour."), [], "the asked-for answer failed");
  assert.deepEqual(starter("It is not gluten-free: it is made from rye flour."), []);
  const yes = starter("Yes, it is gluten-free and made with rye flour.");
  assert.ok(yes.some((n) => /does not claim "gluten-free"/.test(n)), "a gluten-free claim passed: " + JSON.stringify(yes));
  assert.ok(starter("No, it is made with wheat flour.").some((n) => /states "made with rye flour"/.test(n)), "the wrong flour passed");
  assert.ok(starter("It is not made with rye flour.").some((n) => /states "made with rye flour"|states what was asked/.test(n)), "a denied flour passed");
});

// ── ROUND 18: THE WHOLE CHECK ON THE ASKED SECTION, STORED AND SERVED ───────
//
// Codex on 2015cc0c: a section stored with "£25 a head, cheese included" and
// served with "The price is £50 a head." added passed every check. Each case
// builds the page before and after (stored and served), runs `outcomeChecks`
// with a scenario's own expectation, and names which output failed.
const want = (scenario, route) => ({ ...sectionAt(scenario, route) });
const UNRELATED = '<section><h2>Gift vouchers</h2><p>Vouchers from £50.</p><p>Open Tuesday to Sunday, 8am to 2pm, and on Saturday evenings for tastings.</p></section>';
/**
 * One press, judged: `pre` already on the page (stored and served), `stored`
 * and `served` what the press added after it, `lead` (stored and served) what
 * it added before `pre`, so the two additions are separate sections.
 */
function press({ expect, route = VISIT, path = "visit.tsx", pre = "", stored = "", served = stored, lead = "", servedLead = lead, parts = [] }) {
  const put = (pages, html) => pages.map((p) => (p.path === path ? { ...p, source: p.source.replace("</SiteChrome>", html + "\n    </SiteChrome>") } : p));
  const bPages = pre ? put(PAGES, pre) : PAGES;
  let aPages = put(bPages, stored);
  if (lead) aPages = aPages.map((p) => (p.path === path ? { ...p, source: pre ? p.source.replace(pre, lead + pre) : p.source.replace("</SiteChrome>", lead + "\n    </SiteChrome>") } : p));
  const b = read(bPages, [], { [route]: pre });
  const a = read(aPages, parts, { [route]: servedLead + pre + served });
  return factNames(judge(b, a, { expect: { sections: [{ ...expect, route }] } }));
}
const on = (names, side) => names.filter((n) => n.startsWith(`the section ${side} on`));
const Q = (q, ans) => `<section><h2>${q}</h2><p>${ans}</p></section>`;
const PRICE = (ans) => Q("How much is an evening?", ans);

test("ROUND 18, CODEX'S CONTROL: stored \"£25 a head, cheese included\", served with \"The price is £50 a head.\" added — the served section fails on the amount, the stored one passes; £25 on both passes", () => {
  const expect = want("acc-addon-inner", "/tasting-evenings");
  const r = press({ expect, stored: PRICE("£25 a head, cheese included."), served: PRICE("£25 a head, cheese included.") + "<p>The price is £50 a head.</p>" });
  assert.ok(on(r, "served").some((n) => /states no amount but 25/.test(n)), "Codex's control passed: " + JSON.stringify(r));
  assert.deepEqual(on(r, "stored"), [], "the stored section was failed for what only the served one says");
  assert.deepEqual(press({ expect, stored: PRICE("£25 a head, cheese included.") }), []);
  const back = press({ expect, stored: PRICE("£25 a head, cheese included. The price is £50 a head."), served: PRICE("£25 a head, cheese included.") });
  assert.ok(on(back, "stored").some((n) => /states no amount but 25/.test(n)) && !on(back, "served").length, "stored and served disagreement the other way: " + JSON.stringify(back));
});

test("ROUND 18, SURROUNDING CONTENT: the page's own older prices, days and evenings never count against the asked section, stored or served; the asked section alone is judged", () => {
  assert.deepEqual(press({ expect: want("acc-addon-inner", "/tasting-evenings"), pre: UNRELATED, stored: PRICE("£25 a head, cheese included.") }), []);
  assert.deepEqual(press({ expect: want("acc-addon-edit", "/bake-list"), pre: UNRELATED, stored: Q("When is the list updated?", "Every Monday morning.") }), []);
  assert.deepEqual(press({ expect: want("acc-addon-pair", "/starter"), pre: '<section><p>Some of our cakes are gluten-free.</p></section>', stored: Q("Is the starter gluten-free?", "No, it is made with rye flour.") }), [], "an older line on the page counted as a claim in the section");
});

test("ROUND 18, MULTIPLE SECTIONS: another section the press added cannot supply a missing fact, and its contradicting amount, day or denied claim fails; an unrelated added section with none of them does not", () => {
  const expect = want("acc-addon-inner", "/tasting-evenings");
  const split = press({ expect, pre: UNRELATED, stored: PRICE("£25 a head."), lead: '<section><h2>Cheese</h2><p>Cheese included.</p></section>' });
  assert.ok(on(split, "stored").some((n) => /exactly one section the press added states what was asked|states "cheese included"/.test(n)), "a fact was supplied by another section: " + JSON.stringify(split));
  const other = press({ expect, pre: UNRELATED, stored: PRICE("£25 a head, cheese included."), lead: '<section><h2>Private hire</h2><p>Private hire is £50 a head.</p></section>' });
  assert.ok(on(other, "stored").some((n) => /another section the press added\) states no amount but 25/.test(n)) && on(other, "served").some((n) => /another section the press added\) states no amount but 25/.test(n)), JSON.stringify(other));
  assert.deepEqual(press({ expect, pre: UNRELATED, stored: PRICE("£25 a head, cheese included."), lead: '<section><h2>Our bench</h2><p>There is a new bench outside.</p></section>' }), [], "an unrelated added section was failed");
  const gf = press({ expect: want("acc-addon-pair", "/starter"), pre: UNRELATED, stored: Q("Is the starter gluten-free?", "No, it is made with rye flour."), lead: '<section><p>Our starter is gluten-free.</p></section>' });
  assert.ok(gf.some((n) => /another section the press added\) does not claim "gluten-free"/.test(n)), JSON.stringify(gf));
});

test("ROUND 18, COMPONENTS: a component file the press added supplies the section only where the page uses it", () => {
  const expect = want("acc-addon-inner", "/tasting-evenings");
  const part = { path: "tasting-faq.tsx", source: 'export function TastingFaq(){ return <section><h2>How much is an evening?</h2><p>£25 a head, cheese included.</p></section> }\n' };
  const shown = PRICE("£25 a head, cheese included.");
  assert.deepEqual(press({ expect, stored: "<TastingFaq />", served: shown, parts: [part] }), []);
  const unused = press({ expect, stored: PRICE("Ask at the counter."), served: PRICE("Ask at the counter."), parts: [part] });
  assert.ok(on(unused, "stored").some((n) => /exactly one section the press added states what was asked/.test(n)), "an unreferenced component supplied the facts: " + JSON.stringify(unused));
});

test("ROUND 18, DAYS, TIMES, PLACES AND NO: a served Thursday, a served evening, a place stated and denied, and a served gluten-free claim each fail on the output that says it; the correct text passes on both", () => {
  const edit = want("acc-addon-edit", "/bake-list");
  const mon = Q("When is the list updated?", "Every Monday morning.");
  assert.deepEqual(press({ expect: edit, stored: mon }), []);
  const thu = press({ expect: edit, stored: mon, served: Q("When is the list updated?", "Every Monday morning. Also on Thursdays.") });
  assert.ok(on(thu, "served").some((n) => /states no day but monday/.test(n)) && !on(thu, "stored").length, JSON.stringify(thu));
  const eve = press({ expect: edit, stored: mon, served: Q("When is the list updated?", "Every Monday morning, and again in the evening.") });
  assert.ok(on(eve, "served").some((n) => /states no time of day but morning/.test(n)), JSON.stringify(eve));
  const starter = want("acc-addon-pair", "/starter");
  const no = Q("Is the starter gluten-free?", "No, it is made with rye flour.");
  assert.deepEqual(press({ expect: starter, stored: no }), []);
  const yes = press({ expect: starter, stored: no, served: Q("Is the starter gluten-free?", "No, it is made with rye flour. Our starter is gluten-free.") });
  assert.ok(on(yes, "served").some((n) => /does not claim "gluten-free"/.test(n)) && !on(yes, "stored").length, JSON.stringify(yes));
  // A PLACE STATED AND DENIED, on the new page, stored and served.
  const page = UI_SCENARIOS["acc-addon-inner"].expect.pages[0];
  const pageRun = (storedWords, servedWords = storedWords) => {
    const file = { path: "delivery.tsx", source: `import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/delivery")({ component: P });\nconst CHROME = { links: [{ label: "Tasting Evenings", href: "/tasting-evenings" }] };\nfunction P() { return <SiteChrome {...CHROME}><main><h1>Delivery</h1><p>${storedWords}</p></main></SiteChrome>; }\n` };
    const b = read(PAGES), a = read([...PAGES, file], [], { "/delivery": `<h1>Delivery</h1><p>${servedWords}</p>` });
    return factNames(judge(b, a, { expect: { pages: [page] } })).filter((n) => !/menu/.test(n));
  };
  const ok = "We deliver to Clifton, Redland and Montpelier on weekday mornings.";
  assert.deepEqual(pageRun(ok), [], "the stored page's frame (\"Tasting Evenings\") counted as the page's words");
  const denied = pageRun(ok + " Sorry, we don't deliver to Redland.");
  assert.ok(denied.some((n) => /^the stored \/delivery does not also deny "Redland"/.test(n)) && denied.some((n) => /^the served \/delivery does not also deny "Redland"/.test(n)), JSON.stringify(denied));
  const disagree = pageRun(ok, "We deliver to Clifton and Montpelier on weekday mornings.");
  assert.ok(disagree.some((n) => /^the served \/delivery states "Redland"/.test(n)) && !disagree.some((n) => /^the stored \/delivery/.test(n)), JSON.stringify(disagree));
});

test("ROUND 18, CONTEXT AND SCOPE: a heading with no full stop stays its own sentence (\"No reservations needed\" does not deny the answer); text outside <main> (a footer offer) never counts; a served page with no earlier reading is never judged as all new; a new page's served-only contradiction fails", () => {
  const dogs = want("acc-addon-pair", "/visit");
  assert.deepEqual(press({ expect: dogs, stored: '<section><h2>No reservations needed</h2><p>Dogs are welcome inside.</p></section>' }), [], "a heading ran into the answer and denied it");
  // A FOOTER OFFER THAT CHANGED OUTSIDE <main>.
  const expect = want("acc-addon-inner", "/tasting-evenings");
  const html = PRICE("£25 a head, cheese included.");
  const b = read(PAGES), a = read(withWords(PAGES, "visit.tsx", html), [], { [VISIT]: html });
  a.served[VISIT] = a.served[VISIT].replace("</body>", "<footer><p>Gift vouchers from £50.</p></footer></body>");
  assert.deepEqual(factNames(judge(b, a, { expect: { sections: [{ ...expect, route: VISIT }] } })), [], "a footer outside <main> was judged as the section");
  // NO EARLIER READING OF THE SERVED PAGE.
  const blind = factNames(outcomeChecks({ spec: { expect: { sections: [{ ...expect, route: VISIT }] } }, before: b.inv, after: a.inv, served: a.served, beforeServed: {}, tables: { before: TABLES, after: TABLES }, slug: SLUG }).checks);
  assert.ok(blind.includes(`the served ${VISIT} was read before the message`), JSON.stringify(blind));
  // A NEW PAGE, RIGHT WHEN STORED AND CONTRADICTED WHEN SERVED.
  const page = UI_SCENARIOS["acc-addon-inner"].expect.pages[0];
  const ok = "We deliver to Clifton, Redland and Montpelier on weekday mornings.";
  const file = { path: "delivery.tsx", source: `import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/delivery")({ component: P });\nfunction P() { return <main><h1>Delivery</h1><p>${ok}</p></main>; }\n` };
  const nb = read(PAGES), na = read([...PAGES, file], [], { "/delivery": `<h1>Delivery</h1><p>${ok} Also on Saturdays.</p>` });
  const sat = factNames(judge(nb, na, { expect: { pages: [page] } })).filter((n) => !/menu/.test(n));
  assert.ok(sat.some((n) => /^the served \/delivery states no day but/.test(n)) && !sat.some((n) => /^the stored \/delivery/.test(n)), JSON.stringify(sat));
});

test("EVERY NEW SCENARIO NAMES ITS FACTS: each section and page carries `facts`, every amount asked for is held to `only.money`, and the asked-for days and times are held to `only`", () => {
  for (const k of NEW) {
    const e = UI_SCENARIOS[k].expect;
    for (const x of [...(e.sections || []), ...(e.pages || [])]) assert.ok(Array.isArray(x.facts) && x.facts.length > 0, `${k} ${x.route || "page"} names no facts`);
  }
  assert.deepEqual([...UI_SCENARIOS["acc-addon-inner"].expect.sections[0].only.money], ["25"]);
  assert.deepEqual([...UI_SCENARIOS["acc-addon-edit"].expect.sections[0].only.days], ["monday"]);
  assert.deepEqual([...UI_SCENARIOS["acc-addon-inner"].expect.pages[0].only.parts], ["morning"]);
  assert.ok(UI_SCENARIOS["acc-addon-pair"].expect.sections.find((x) => x.route === START).denies.includes("gluten-free"));
});

// ── `addonDesignOverlap`: WHETHER ONE ADD-ON'S DESIGNERS RAN TOGETHER ───────
//
// Attribution corrected in round 17 after Codex's control: jobs are chosen by
// what they ran, and a trace is a job's only when it ran inside that job's
// own run and no other job ran beside it.
const JOB = "11111111-2222-3333-4444-555555555555";
const OLD = "99999999-8888-7777-6666-555555555555";
const ROW = { id: JOB, slug: SLUG, op: "addon", state: "done", created_at: "2026-10-12T10:00:00Z", updated_at: "2026-10-12T10:05:00Z" };
const job = (id, created_at, updated_at, state = "done") => ({ id, state, created_at, updated_at });
const ev = (p, s, ms) => ({ p, s, ms });
const trace = (events, ended_at, ms, cid = "c1") => ({ cid, ended_at, ms, events });
const CROSS = [ev("add:page", "start", 100), ev("add:component", "start", 150), ev("add:page", "ok", 900), ev("add:component", "ok", 950)];
const APART = [ev("add:page", "start", 100), ev("add:page", "ok", 500), ev("add:component", "start", 600), ev("add:component", "ok", 900)];
// The target's own trace: began 10:00:10, ended 10:04:40.
const MINE = (events) => trace(events, "2026-10-12T10:04:40Z", 270_000, "mine");
// Codex's case: a job created at 08:00 that ended at 10:04 — its trace began at 08:00.
const OLDER = (events) => trace(events, "2026-10-12T10:04:00Z", 7_440_000, "older");
const rec = (traces, jobs = [job(JOB, ROW.created_at, ROW.updated_at)], extra = {}) => ({ job: JOB, row: ROW, traces, siblings: { ok: true, complete: true, ids: jobs.map((j) => j.id), jobs }, notes: [], ...extra });

test("DESIGNERS, GENUINE AND SEQUENTIAL: the target alone, its own trace inside its run — crossing designers are overlapped, named; one after the other, not overlapped; the row step is no designer", () => {
  const together = addonDesignOverlap(rec([MINE(CROSS)]));
  assert.equal(together.verdict, "overlapped", JSON.stringify(together));
  assert.deepEqual(together.meets, ["page and component"]);
  assert.equal(addonDesignOverlap(rec([MINE(APART)])).verdict, "not-overlapped");
  assert.equal(addonDesignOverlap(rec([MINE([ev("add:page", "start", 100), ev("add:component", "start", 600), ev("add:component", "ok", 900)])])).verdict, "overlapped", "a designer still open at the end runs beside one started after it");
  assert.equal(addonDesignOverlap(rec([MINE([ev("add:row", "start", 100), ev("add:page", "start", 150), ev("add:row", "ok", 900), ev("add:page", "ok", 950)])])).verdict, "unknown");
});

test("DESIGNERS, CODEX'S OLDER JOB: a job created at 08:00 that ended at 10:04, its trace the only one returned — never the 10:00 job's (unknown: the target's own trace is missing); with both traces, the target's is beside the older job's run — candidate-only", () => {
  const older = job(OLD, "2026-10-12T08:00:00Z", "2026-10-12T10:04:05Z");
  const onlyOld = addonDesignOverlap(rec([OLDER(CROSS)], [older, job(JOB, ROW.created_at, ROW.updated_at)]));
  assert.equal(onlyOld.verdict, "unknown", JSON.stringify(onlyOld));
  assert.match(onlyOld.why, /no trace ran inside this job's own run/);
  // The same, with the older job not even read (the old 30-minute lookback): still never this job's.
  assert.equal(addonDesignOverlap(rec([OLDER(CROSS)])).verdict, "unknown");
  const both = addonDesignOverlap(rec([OLDER(CROSS), MINE(APART)], [older, job(JOB, ROW.created_at, ROW.updated_at)]));
  assert.equal(both.verdict, "candidate-only", JSON.stringify(both));
  assert.match(both.why, new RegExp(OLD));
});

test("DESIGNERS, MISSING AND AMBIGUOUS: no trace, a trace from before the job existed, two traces inside its run, or another job running beside its trace — never a verdict on overlap", () => {
  assert.equal(addonDesignOverlap(rec([])).verdict, "unknown");
  assert.equal(addonDesignOverlap(rec([trace(CROSS, "2026-10-12T09:59:00Z", 60_000, "before")])).verdict, "unknown", "a trace from before the job counted");
  assert.equal(addonDesignOverlap(rec([MINE(CROSS), trace(APART, "2026-10-12T10:03:00Z", 60_000, "twin")])).verdict, "candidate-only");
  const beside = job("aaaaaaaa-0000-0000-0000-000000000000", "2026-10-12T10:02:00Z", "2026-10-12T10:03:00Z");
  assert.equal(addonDesignOverlap(rec([MINE(CROSS)], [job(JOB, ROW.created_at, ROW.updated_at), beside])).verdict, "candidate-only");
  const running = job("bbbbbbbb-0000-0000-0000-000000000000", "2026-10-12T09:00:00Z", null, "running");
  assert.equal(addonDesignOverlap(rec([MINE(CROSS)], [job(JOB, ROW.created_at, ROW.updated_at), running])).verdict, "candidate-only", "a job with no end was not counted as still running");
  const after = job("cccccccc-0000-0000-0000-000000000000", "2026-10-12T10:10:00Z", "2026-10-12T10:12:00Z");
  assert.equal(addonDesignOverlap(rec([MINE(CROSS)], [job(JOB, ROW.created_at, ROW.updated_at), after])).verdict, "overlapped", "a job well after the trace was counted against it");
});

test("DESIGNERS, INCOMPLETE READS ARE UNKNOWN: a failed or cut jobs read, the target missing from it, an unfinished target, a target without times, a trace without times or with dropped events", () => {
  const base = rec([MINE(CROSS)]);
  assert.equal(addonDesignOverlap({ ...base, siblings: { ok: false, why: "edit_jobs read for the window failed (500)" } }).verdict, "unknown");
  assert.equal(addonDesignOverlap({ ...base, siblings: { ...base.siblings, complete: false, why: "the jobs read for the window reached its limit of 200" } }).verdict, "unknown");
  assert.equal(addonDesignOverlap(rec([MINE(CROSS)], [job(OLD, "2026-10-12T08:00:00Z", "2026-10-12T08:10:00Z")])).verdict, "unknown", "a read without the target counted");
  assert.equal(addonDesignOverlap({ ...base, row: { ...ROW, state: "running" } }).verdict, "unknown");
  assert.equal(addonDesignOverlap({ ...base, row: { ...ROW, updated_at: null } }).verdict, "unknown");
  assert.equal(addonDesignOverlap(rec([{ cid: "x", events: CROSS }])).verdict, "unknown");
  assert.equal(addonDesignOverlap(rec([MINE([...CROSS, { p: "…", s: "?", ms: 999, d: { dropped: 3 } }])])).verdict, "unknown");
  assert.equal(addonDesignOverlap({ job: JOB, row: null }).verdict, "unknown");
});

test("THE READ-JOB BOX READS EVERY JOB WHOSE RUN TOUCHES THE WINDOW: through the real lookup with a stubbed store — chosen by last update since the earliest trace began, never by a creation lookback; a full page is incomplete; the DESIGNERS line follows", async () => {
  const asked = [];
  const older = job(OLD, "2026-10-12T08:00:00Z", "2026-10-12T10:04:05Z");
  const store = (jobsRows, traces) => async (p) => {
    asked.push(p);
    if (p.startsWith("edit_jobs?id=eq.")) return { status: 200, rows: [ROW] };
    if (p.startsWith("edit_jobs?slug=eq.")) return { status: 200, rows: jobsRows };
    if (p.startsWith("credit_events")) return { status: 200, rows: [] };
    if (p.startsWith("edit_traces")) return { status: 200, rows: traces };
    return { status: 404, rows: null };
  };
  const r = await readJobRecords({ job: JOB, sb: store([older, job(JOB, ROW.created_at, ROW.updated_at)], [OLDER(CROSS), MINE(CROSS)]) });
  const q = asked.find((p) => p.startsWith("edit_jobs?slug=eq."));
  assert.ok(q, "the window's jobs were not read");
  assert.doesNotMatch(q, /created_at=gte\./, "jobs are still chosen by a creation lookback");
  assert.match(q, /created_at=lte\./);
  assert.match(q, /or=\(updated_at\.gte\.2026-10-12T08:00:00\.000Z|or=\(updated_at\.gte\.2026-10-12T07:59:00\.000Z/, "the lower bound is not the earliest trace's start: " + q);
  assert.match(q, /updated_at\.is\.null/);
  assert.equal(r.siblings.complete, true);
  assert.deepEqual(r.siblings.ids.sort(), [JOB, OLD].sort());
  assert.match(describeJob(r), /DESIGNERS {3}candidate-only/);
  const solo = await readJobRecords({ job: JOB, sb: store([job(JOB, ROW.created_at, ROW.updated_at)], [MINE(CROSS)]) });
  assert.match(describeJob(solo), /DESIGNERS {3}overlapped \(page and component\)/);
  const full = await readJobRecords({ job: JOB, sb: store(Array.from({ length: SIBLING_READ_LIMIT }, (_, i) => job(i === 0 ? JOB : "j" + i, ROW.created_at, ROW.updated_at)), [MINE(CROSS)]) });
  assert.equal(full.siblings.complete, false);
  assert.match(describeJob(full), /DESIGNERS {3}unknown — the jobs read for the window reached its limit/);
  const failed = await readJobRecords({ job: JOB, sb: async (p) => (p.startsWith("edit_jobs?slug=eq.") ? { status: 500, rows: null } : store([], [MINE(CROSS)])(p)) });
  assert.match(describeJob(failed), /DESIGNERS {3}unknown — edit_jobs read for the window failed \(500\)/);
});

test("THE PRESS RECORDS WHAT IT CANNOT SEE: a scenario that asks for the inside-one-Add-on reading names it as unverified, pointing at the read-job box; one that does not, does not", () => {
  const v = requestBatchVerdict({ spec: UI_SCENARIOS["acc-addon-kinds"], steps: [], before: read(PAGES).inv, after: read(PAGES).inv, served: {}, tables: { before: TABLES, after: TABLES }, slug: SLUG });
  assert.ok(v.unverified.some((u) => /designers ran at the same time .*read-job box .*addonDesignOverlap/.test(u)), JSON.stringify(v.unverified));
  for (const k of ["acc-addon-edit", "acc-addon-pair"]) {
    const w = requestBatchVerdict({ spec: UI_SCENARIOS[k], steps: [], before: read(PAGES).inv, after: read(PAGES).inv, served: {}, tables: { before: TABLES, after: TABLES }, slug: SLUG });
    assert.ok(!w.unverified.some((u) => /designers ran at the same time/.test(u)), k);
  }
});

// ── AFTER P1 (run 128): THE INSIDE-ONE-ADD-ON CASE, OF TWO KINDS ────────────
//
// The owner, after P1 and P2 closed: *"Account for P1's actual routing
// results: S7 split into parts, so it cannot prove concurrency inside one
// Add-on; S9 batched, which by itself proves no concurrency. Identify a
// suitable request for substantive overlap inside one Add-on and one for
// overlap across independent Add-on parts … Do not force routing or hardcode a
// special case."* `acc-addon-kinds` asks for a section (`component`) and one
// line (`words`) in one message; across parts, `acc-addon-edit` (S8, which P1
// saw as parts). S7's page and section are dependent as parts (PI 35).

test("AFTER P1 — acc-addon-kinds's line on the Order page: the asked line passes, in other words too, beside the page's own older words; no morning, a night-before claim or an evening fails by name", () => {
  const expect = want("acc-addon-kinds", "/order");
  const line = (w) => `<p>${w}</p>`;
  assert.deepEqual(press({ expect, stored: line("Every loaf is baked the morning you collect it.") }), []);
  assert.deepEqual(press({ expect, stored: line("All our loaves are baked on the morning you collect.") }), []);
  assert.deepEqual(press({ expect, pre: UNRELATED, stored: line("Every loaf is baked the morning you collect it.") }), [], "the page's own evenings counted against the line");
  assert.ok(press({ expect, stored: line("Every loaf is baked fresh.") }).some((n) => /states "the morning you collect it"/.test(n)), "a line with no morning passed");
  const night = press({ expect, stored: line("Every loaf is baked the morning you collect it, or baked the night before.") });
  assert.ok(night.some((n) => /does not claim "baked the night before"/.test(n)), JSON.stringify(night));
  const eve = press({ expect, stored: line("Every loaf is baked the morning you collect it, and again in the evening.") });
  assert.ok(eve.some((n) => /states no time of day but morning/.test(n)), JSON.stringify(eve));
});

test("AFTER P1 — acc-addon-kinds's section on the Visit page is judged as acc-addon-pair's is: dogs welcome inside passes; outside only fails", () => {
  const expect = want("acc-addon-kinds", "/visit");
  assert.deepEqual(press({ expect, stored: Q("Can I bring my dog?", "Dogs are welcome inside.") }), []);
  assert.ok(press({ expect, stored: Q("Can I bring my dog?", "Dogs are welcome outside only.") }).some((n) => /states "inside"|does not claim "outside only"/.test(n)));
});

test("AFTER P1 — acc-addon-kinds is probed alone, first, by acceptance-split-2: one acceptance probe of its exact words, unjudged; P1's committed batch is left exactly as it ran", () => {
  const two = JSON.parse(fs.readFileSync(ROOT + "scripts/router-probes/acceptance-split-2.json", "utf8"));
  assert.equal(two.batch, "acceptance-split-2");
  assert.equal(two.acceptance, true);
  assert.equal(two.probes.length, 1);
  assert.equal(two.probes[0].message, UI_SCENARIOS["acc-addon-kinds"].steps[0].say);
  assert.equal(two.probes[0].intended, null);
  assert.equal(two.probes[0].site, SLUG);
  const one = JSON.parse(fs.readFileSync(ROOT + "scripts/router-probes/acceptance-split-1.json", "utf8"));
  assert.ok(!one.probes.some((p) => p.message === UI_SCENARIOS["acc-addon-kinds"].steps[0].say), "the P1 batch was edited after it ran");
  assert.equal(one.probes.length, 9);
});

test("AFTER P1 — acc-addon-kinds asks for two kinds whose designers wait for nothing, whatever the picker says they use: neither a section nor a line changes what the other is shown", async () => {
  const { designWaits } = await import("../builder/site-add.mjs");
  assert.deepEqual(designWaits(["component", "words"]), { component: [], words: [] });
  assert.deepEqual(designWaits(["component", "words"], { uses: { component: ["words"], words: ["component"] } }), { component: [], words: [] });
  // CONTROL: a page does change what a section is shown, so S7's shape waits unless told otherwise.
  assert.deepEqual(designWaits(["page", "component"]), { page: [], component: ["page"] });
});

// ── TWO INDEPENDENT ADD-ON PARTS (2026-10-12, the open planning gap) ────────
//
// The owner: *"propose a natural image-free request that could exercise two
// independent Add-on parts, explain from their actual read/write dependencies
// why they can overlap, and state what routing result would make the case
// eligible. Do not force routing or change product behavior to fit the test;
// … Keep this separate from the existing Add-on-plus-Edit case."*
// `acc-addon-two-parts`: the Bakers heading, a questions section on Tasting
// Evenings and a note on Classes. Eligible only if the real router answers
// the heading and holds back the two additions as two entries (probed first,
// `acceptance-split-3`); the offline run of that shape is PI 36.

test("TWO ADD-ON PARTS — acc-addon-two-parts demands overlap BETWEEN TWO ADD-ON PARTS and exact reuse by both, records the router's shape, reads nothing inside one job, and is not acc-addon-edit", () => {
  const sc = UI_SCENARIOS["acc-addon-two-parts"];
  const e = sc.expect;
  assert.equal(e.overlap, "addon-parts");
  assert.deepEqual({ ...e.reuse }, { exact: 2, overlapped: "addon-parts" });
  assert.equal(e.shape, true);
  assert.equal(e.inner, undefined, "one Add-on's designers are not what this case is about");
  assert.deepEqual(e.sections.map((x) => x.route), ["/tasting-evenings", "/classes"]);
  assert.deepEqual(e.headings.map((h) => ({ ...h })), [{ route: "/bakers", from: "Who mixes while Bristol sleeps", to: "Who mixes while the city sleeps" }]);
  assert.ok(sc.covers.includes("addon-parts"));
  assert.ok(Object.hasOwn(COVERAGE, "addon-parts"), "the two-Add-on-parts coverage has no reader");
  const edit = UI_SCENARIOS["acc-addon-edit"];
  assert.notEqual(sc.steps[0].say, edit.steps[0].say);
  const pages = (s) => [...(s.expect.sections || []).map((x) => x.route), ...(s.expect.headings || []).map((x) => x.route)];
  for (const k of ["acc-addon-edit", "acc-addon-kinds"]) assert.ok(!pages(UI_SCENARIOS[k]).some((r) => pages(sc).includes(r)), `${k} shares a page with acc-addon-two-parts`);
  assert.ok(sc.steps[0].ms <= 30 * 60_000);
});

test("TWO ADD-ON PARTS — the Classes note: ages 12 and up passes, in other words too; all ages, or no age, fails by name", () => {
  const expect = want("acc-addon-two-parts", "/classes");
  const note = (w) => `<aside><p>${w}</p></aside>`;
  assert.deepEqual(press({ expect, stored: note("Classes are for ages 12 and up.") }), []);
  assert.deepEqual(press({ expect, stored: note("Open to anyone aged 12 or over.") }), []);
  assert.ok(press({ expect, stored: note("Classes are for all ages, 12 and up.") }).some((n) => /does not claim "all ages"/.test(n)), "all ages passed");
  assert.ok(press({ expect, stored: note("Classes are for everyone.") }).some((n) => /says|states/.test(n)), "a note with no age passed");
});

test("TWO ADD-ON PARTS — the Tasting Evenings section is judged as acc-addon-inner's is: £25 a head with cheese passes; another amount, or cheese extra, fails", () => {
  const expect = want("acc-addon-two-parts", "/tasting-evenings");
  assert.deepEqual(press({ expect, stored: PRICE("£25 a head, cheese included.") }), []);
  assert.ok(press({ expect, stored: PRICE("£30 a head, cheese included.") }).length > 0, "another amount passed");
  assert.ok(press({ expect, stored: PRICE("£25 a head; cheese is extra.") }).some((n) => /cheese/.test(n)), "cheese extra passed");
  // THE DENIAL ON ITS OWN: every asked fact stated, and the denied claim beside it.
  const both = press({ expect, stored: PRICE("£25 a head, cheese included. Cheese is extra on Fridays.") });
  assert.ok(both.some((n) => /does not claim "cheese is extra"/.test(n)), "a denied claim beside the asked facts passed: " + JSON.stringify(both));
});

test("TWO ADD-ON PARTS — probed alone, first, by acceptance-split-3: one acceptance probe of its exact words, unjudged; acceptance-split-1 and -2 are left exactly as they were", () => {
  const three = JSON.parse(fs.readFileSync(ROOT + "scripts/router-probes/acceptance-split-3.json", "utf8"));
  assert.equal(three.batch, "acceptance-split-3");
  assert.equal(three.acceptance, true);
  assert.equal(three.probes.length, 1);
  assert.equal(three.probes[0].message, UI_SCENARIOS["acc-addon-two-parts"].steps[0].say);
  assert.equal(three.probes[0].intended, null);
  assert.equal(three.probes[0].site, SLUG);
  const one = JSON.parse(fs.readFileSync(ROOT + "scripts/router-probes/acceptance-split-1.json", "utf8"));
  assert.equal(one.probes.length, 9);
  const two = JSON.parse(fs.readFileSync(ROOT + "scripts/router-probes/acceptance-split-2.json", "utf8"));
  assert.deepEqual(two.probes.map((p) => p.message), [UI_SCENARIOS["acc-addon-kinds"].steps[0].say]);
});

test("TWO ADD-ON PARTS — from the read/write rules: each held addition, scoped to its own page, reads the page list, the look and its page; neither waits for the other or for the heading's text job; the same new component named for both, or a new page, makes it wait", async () => {
  const { clearToPrepare, stepInputs } = await import("../builder/request-plan.mjs");
  const part = (n, writes, route) => ({ n, at: n, needs: [], status: "ready", phase: "run", route: route || { op: "addon", intent: "addon" }, targets: { writes, reads: [] } });
  const heading = part(0, ["page:/bakers"], { op: "edit", intent: "edit", layer: "text" });
  const tasting = part(1, ["page:/tasting-evenings", "new-component:tasting-questions"]);
  const classes = part(2, ["page:/classes", "new-component:classes-note"]);
  assert.deepEqual(stepInputs(tasting).sort(), ["page:/tasting-evenings", "pagelist", "theme"].sort());
  const live = () => false;
  assert.equal(clearToPrepare([heading, tasting, classes], 1, live), true, "the section waited for the heading");
  assert.equal(clearToPrepare([heading, tasting, classes], 2, live), true, "the note waited for the section or the heading");
  assert.equal(clearToPrepare([heading, tasting, part(2, ["page:/classes"])], 2, live), true, "no component named: clear");
  // CONTROLS: what would make it ineligible.
  assert.equal(clearToPrepare([heading, tasting, part(2, ["page:/classes", "new-component:tasting-questions"])], 2, live), false, "one new component named for both did not wait");
  assert.equal(clearToPrepare([heading, part(1, ["new-page:/delivery", "menu"]), classes], 2, live), false, "a new page did not hold the note");
});

test("TWO ADD-ON PARTS — the overlap counted is only between parts routed addon: an Add-on part beside the Edit part's job is not two Add-on parts at once; two Add-on steps together are; fewer than two Add-on parts is missing evidence", async () => {
  const { overlapVerdict, reuseVerdict } = await import("../scripts/canary-requests.mjs");
  const T = 1_000_000;
  const steps = (parts) => [{ sent: true, request: { key: "k", final: { key: "k", at: T, parts } } }];
  const use = (job) => [{ job, known: true, staged: "yes", replayed: 2, rebased: 0, fresh: 0 }];
  const text = { n: 1, route: "text", runs: [{ job: "j1", from: T + 1000, to: T + 20_000 }], prepUse: [{ job: "j1", known: true, staged: "no", replayed: 0, rebased: 0, fresh: 1 }] };
  const add = (n, step, run) => ({ n, route: "addon", prepRun: { from: step[0] - 100, to: step[1] + 100, outcome: "prepared", step: { from: step[0], to: step[1], calls: 2 } }, runs: [{ job: "j" + n, from: run[0], to: run[1] }], prepUse: use("j" + n) });
  // Each Add-on step beside the heading's job only, one after the other, each job after both steps.
  const apart = steps([text, add(2, [T + 2000, T + 6000], [T + 30_000, T + 31_000]), add(3, [T + 7000, T + 11_000], [T + 32_000, T + 33_000])]);
  assert.equal(overlapVerdict(apart).ok, true, "CONTROL: beside the Edit part's job is overlap at the request level");
  const strict = overlapVerdict(apart, { route: "addon" });
  assert.equal(strict.ok, false, "an Add-on part beside the Edit part's job counted as two Add-on parts at once");
  assert.equal(reuseVerdict(apart, { exact: 2, overlapped: true }).ok, true);
  assert.equal(reuseVerdict(apart, { exact: 2, overlapped: "addon-parts" }).ok, false);
  // The two Add-on steps together.
  const together = steps([text, add(2, [T + 2000, T + 9000], [T + 30_000, T + 31_000]), add(3, [T + 3000, T + 11_000], [T + 32_000, T + 33_000])]);
  const v = overlapVerdict(together, { route: "addon" });
  assert.equal(v.ok, true, v.why);
  assert.deepEqual(v.together[0].parts, [2, 3]);
  assert.equal(reuseVerdict(together, { exact: 2, overlapped: "addon-parts" }).ok, true);
  // One Add-on step beside the other Add-on part's job.
  const beside = steps([text, add(2, [T + 2000, T + 4000], [T + 5000, T + 15_000]), add(3, [T + 6000, T + 12_000], [T + 30_000, T + 31_000])]);
  assert.equal(overlapVerdict(beside, { route: "addon" }).ok, true);
  // Batched: one Add-on part.
  const one = overlapVerdict(steps([text, add(2, [T + 2000, T + 9000], [T + 30_000, T + 31_000])]), { route: "addon" });
  assert.equal(one.ok, false);
  assert.match(one.why, /missing evidence: 1 part\(s\) routed addon/);
});

test("TWO ADD-ON PARTS — the press checks it by name: requestBatchVerdict asks for the Add-on-parts overlap and the exact reuse beside another Add-on part, and never the request-level overlap alone", () => {
  const v = requestBatchVerdict({ spec: UI_SCENARIOS["acc-addon-two-parts"], steps: [{ sent: false }], before: read(PAGES).inv, after: read(PAGES).inv, served: {}, tables: { before: TABLES, after: TABLES }, slug: SLUG });
  const names = v.checks.map((c) => c.name);
  assert.ok(names.some((n) => /an Add-on part's prepared step ran while another Add-on part's job or prepared step/.test(n)), JSON.stringify(names));
  assert.ok(names.some((n) => /at least 2 answered exactly from work prepared beside another Add-on part/.test(n)), JSON.stringify(names));
  assert.ok(!names.some((n) => /^message 1: a part's prepared step ran while another part's/.test(n)), "the request-level overlap stood in for the Add-on one");
  assert.equal(v.ok, false);
});

test("TWO ADD-ON PARTS — the coverage reads two finished Add-on parts: one Add-on, an unfinished one, or an Edit part beside one Add-on is not covered", () => {
  const cov = (parts) => COVERAGE["addon-parts"]([{ sent: true, request: { key: "k", final: { key: "k", parts } } }]).covered;
  const p = (n, route, status = "done") => ({ n, route, status });
  assert.equal(cov([p(1, "text"), p(2, "addon"), p(3, "addon")]), true);
  assert.equal(cov([p(1, "text"), p(2, "addon")]), false, "one Add-on part covered two");
  assert.equal(cov([p(1, "text"), p(2, "addon"), p(3, "addon", "failed")]), false, "an unfinished Add-on part covered");
});

// ── THE REUSE COUNT TIED TO OVERLAP (2026-10-12, the owner's reproduction) ──
//
// The owner: overlapping Add-on parts 2 and 3, exact reuse by Edit part 1 and
// Add-on part 2, and fresh execution by Add-on part 3 passed `{ exact: 2,
// overlapped: "addon-parts" }`: the count was taken over every route and the
// overlap asked of only one exact part. Now the count is of distinct parts
// that both answered exactly and overlapped the work asked for.

const R = 1_000_000;
const rsteps = (parts) => [{ sent: true, request: { key: "k", final: { key: "k", at: R, parts } } }];
const exactUse = (job) => ({ job, known: true, staged: "yes", replayed: 2, rebased: 0, fresh: 0 });
const freshUse = (job) => ({ job, known: true, staged: "yes", replayed: 1, rebased: 0, fresh: 1 });
const rpart = (n, route, step, run, use) => ({ n, route, ...(step ? { prepRun: { from: step[0] - 100, to: step[1] + 100, outcome: "prepared", step: { from: step[0], to: step[1], calls: 2 } } } : {}), runs: [{ job: "j" + n, from: run[0], to: run[1] }], prepUse: [use("j" + n)] });
// Parts 2 and 3's steps run together; part 1 (the Edit part) has its own prepared step beside part 2's.
const EDIT = (use = exactUse) => rpart(1, "text", [R + 2500, R + 4000], [R + 30_000, R + 31_000], use);
const A2 = (use = exactUse) => rpart(2, "addon", [R + 2000, R + 9000], [R + 32_000, R + 33_000], use);
const A3 = (use = exactUse) => rpart(3, "addon", [R + 3000, R + 11_000], [R + 34_000, R + 35_000], use);

test("REUSE TIED TO OVERLAP — THE OWNER'S REPRODUCTION: exact reuse by the Edit part and one Add-on part, the other Add-on part fresh, fails { exact: 2, overlapped: \"addon-parts\" }", async () => {
  const { reuseVerdict, overlapVerdict } = await import("../scripts/canary-requests.mjs");
  const s = rsteps([EDIT(), A2(), A3(freshUse)]);
  assert.equal(overlapVerdict(s, { route: "addon" }).ok, true, "CONTROL: the two Add-on parts did overlap");
  const v = reuseVerdict(s, { exact: 2, overlapped: "addon-parts" });
  assert.equal(v.ok, false, "the Edit part's reuse stood in for an Add-on part's");
  assert.match(v.why, /1 part\(s\) answered exactly AND overlapped another Add-on part's work; 2 required/);
  assert.deepEqual(v.qualifying, [2]);
});

test("REUSE TIED TO OVERLAP — UNRELATED-ROUTE REUSE NEVER COUNTS: the Edit part answering exactly beside an Add-on part is not Add-on reuse, even when it is the only exact one", async () => {
  const { reuseVerdict } = await import("../scripts/canary-requests.mjs");
  const v = reuseVerdict(rsteps([EDIT(), A2(freshUse), A3(freshUse)]), { exact: 1, overlapped: "addon-parts" });
  assert.equal(v.ok, false);
  assert.deepEqual(v.qualifying, []);
  // CONTROL: by the general rule the Edit part's step did overlap other work, so it qualifies there.
  assert.equal(reuseVerdict(rsteps([EDIT(), A2(freshUse), A3(freshUse)]), { exact: 1, overlapped: true }).ok, true);
});

test("REUSE TIED TO OVERLAP — INSUFFICIENT QUALIFYING REUSE: exact reuse by a part that overlapped nothing does not make up the count; one qualifying part never stands for two, under either rule", async () => {
  const { reuseVerdict } = await import("../scripts/canary-requests.mjs");
  // Part 3's own step ran before anything else began: exact, but beside
  // nothing. Its job then ran while part 2's step was working, so part 2
  // qualifies and part 3 does not.
  const late = rpart(3, "addon", [R + 1000, R + 1500], [R + 5000, R + 8000], exactUse);
  const v = reuseVerdict(rsteps([EDIT(freshUse), A2(), late]), { exact: 2, overlapped: "addon-parts" });
  assert.equal(v.ok, false);
  assert.equal(v.exact.length, 2, "CONTROL: two jobs did answer exactly");
  assert.deepEqual(v.qualifying, [2]);
  const g = reuseVerdict(rsteps([EDIT(freshUse), A2(), late]), { exact: 2, overlapped: true });
  assert.equal(g.ok, false, "the general rule let one overlapping part stand for two");
});

test("REUSE TIED TO OVERLAP — DUPLICATE EVIDENCE NEVER INFLATES THE COUNT: the same job listed twice is one; listed twice with different counts, or under two parts, does not read", async () => {
  const { reuseVerdict } = await import("../scripts/canary-requests.mjs");
  const dup = { ...A2(), prepUse: [exactUse("j2"), exactUse("j2")] };
  const v = reuseVerdict(rsteps([EDIT(freshUse), dup, A3(freshUse)]), { exact: 2, overlapped: "addon-parts" });
  assert.equal(v.ok, false, "one job listed twice counted as two");
  assert.equal(v.exact.length, 1);
  assert.equal(reuseVerdict(rsteps([EDIT(freshUse), dup, A3(freshUse)]), { exact: 2 }).ok, false, "the plain count was inflated");
  const clash = { ...A2(), prepUse: [exactUse("j2"), freshUse("j2")] };
  assert.match(reuseVerdict(rsteps([EDIT(), clash, A3()]), {}).why, /listed more than once with different evidence/);
  // ONE PART, TWO JOBS (a retry): two exact jobs are still one qualifying part.
  const twice = { ...A2(), runs: [{ job: "j2", from: R + 32_000, to: R + 33_000 }, { job: "j2b", from: R + 33_500, to: R + 34_000 }], prepUse: [exactUse("j2"), exactUse("j2b")] };
  const t = reuseVerdict(rsteps([EDIT(freshUse), twice, A3(freshUse)]), { exact: 2, overlapped: "addon-parts" });
  assert.equal(t.ok, false, "one part's two jobs counted as two qualifying parts");
  assert.deepEqual(t.qualifying, [2]);
  const borrowed = { ...A3(), prepUse: [exactUse("j3"), { ...exactUse("j2") }] };
  assert.match(reuseVerdict(rsteps([EDIT(), A2(), borrowed]), {}).why, /listed more than once with different evidence/, "a job claimed by two parts counted for both");
});

test("REUSE TIED TO OVERLAP — POSITIVE CONTROL: both Add-on parts answered exactly and each overlapped the other's work: { exact: 2, overlapped: \"addon-parts\" } passes, and the press's check with it", async () => {
  const { reuseVerdict } = await import("../scripts/canary-requests.mjs");
  const v = reuseVerdict(rsteps([EDIT(freshUse), A2(), A3()]), { exact: 2, overlapped: "addon-parts" });
  assert.equal(v.ok, true, v.why);
  assert.deepEqual(v.qualifying.sort(), [2, 3]);
  assert.match(v.said, /beside other work: \[2,3\]/);
});

test("EVERY ACCEPTANCE PROBE FILE READS THROUGH THE REAL READER (2026-10-12, run 132: acceptance-split-3's basis was over 200 characters and the press refused before the sign-in)", async () => {
  const { readProbeBatch } = await import("../scripts/canary-probes.mjs");
  for (const b of ["acceptance-split-1", "acceptance-split-2", "acceptance-split-3"]) {
    const r = readProbeBatch(fs.readFileSync(ROOT + "scripts/router-probes/" + b + ".json", "utf8"), b);
    assert.equal(r.ok, true, `${b}: ${r.why || r.msg || JSON.stringify(r)}`);
  }
});

// ── WHAT A VISITOR SEES: RENDER BRANCHES AND CLOSED ANSWERS (2026-10-12) ────
//
// M (run 138) stored its questions section in both branches of the Tasting
// Evenings page — the waiting-list form and the "You're on the list" panel a
// visitor sees after signing up, never together — and the stored check read
// "2 added sections". K (run 135) and M served their answers in an accordion,
// closed, so the served HTML held the question and not the answer. Both were
// verified free in a browser on 2026-10-12 (the answers open to what was
// asked; each page shows the section once). Here: the same shapes, judged
// through `outcomeChecks`, and the genuine failures still refused.
const TASTE = () => ({ ...sectionAt("acc-addon-two-parts", "/tasting-evenings"), route: VISIT });
const FAQ = (ans = "£25 a head, cheese included.") => `<section className="faq"><h2>How much is an evening?</h2><p>${ans}</p></section>`;
const BRANCHY = ({ sent = "", form = "", tern = null, top = "" } = {}) => `import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
export const Route = createFileRoute('/visit')({ component: Page })
function Page() {
  const [sent, setSent] = useState(false)
  if (sent) {
    return (
      <main><h1>You're on the list</h1><p>We will write when the next evening has a date.</p>${sent}</main>
    )
  }
  return (
    <main><h1>Come and see us</h1>${top}<p>The shutters and the street.</p><form><button type="submit">Join</button></form>${form}${tern === null ? "" : tern}</main>
  )
}
`;
const withVisit = (src) => PAGES.map((p) => (p.path === "visit.tsx" ? { ...p, source: src } : p));
const judgeOpen = (b, a, spec, open = {}) => outcomeChecks({ spec, before: b.inv, after: a.inv, served: a.served, beforeServed: b.served, servedOpen: open.after, beforeServedOpen: open.before, tables: { before: TABLES, after: TABLES }, slug: SLUG }).checks;
const branchCase = (after) => {
  const spec = { expect: { sections: [TASTE()] } };
  const b = read(withVisit(BRANCHY()));
  const a = read(withVisit(after), [], { [VISIT]: FAQ() });
  return factNames(judgeOpen(b, a, spec));
};

test("BRANCHES 1 — THE SAME SECTION IN TWO RENDER BRANCHES A VISITOR NEVER SEES TOGETHER (M's run 138 shape) is one section: the stored check passes, as it does with the section in one branch, or in either arm of a `? :`", () => {
  assert.deepEqual(branchCase(BRANCHY({ sent: FAQ(), form: FAQ() })), []);
  assert.deepEqual(branchCase(BRANCHY({ form: FAQ() })), []);
  assert.deepEqual(branchCase(BRANCHY({ tern: `{sent ? ${FAQ()} : ${FAQ()}}` })), []);
  // `if … else`, each branch returning.
  const ELSE = BRANCHY({ sent: FAQ(), form: FAQ() }).replace("  }\n  return (", "  } else {\n  return (").replace("  )\n}\n", "  )\n  }\n}\n");
  assert.match(ELSE, /\} else \{\n  return \(/, "the else fixture did not form");
  assert.deepEqual(branchCase(ELSE), []);
});

test("BRANCHES 2 — STILL REFUSED: the section twice where a visitor sees both copies (one branch, or `cond && …` beside it), a wrong amount in the other branch, or no answer in any branch", () => {
  const twice = branchCase(BRANCHY({ sent: FAQ(), form: FAQ() + FAQ() }));
  const DUP = (ns) => ns.some((n) => n === "the section stored on /visit: exactly one section the press added states what was asked" || n === "the section stored on /visit states what was asked once");
  assert.ok(DUP(twice), "a genuine duplicate passed: " + JSON.stringify(twice));
  const both = branchCase(BRANCHY({ tern: `{sent && ${FAQ()}}${FAQ()}` }));
  assert.ok(DUP(both), "`&&` was read as a branch: " + JSON.stringify(both));
  // TWO COPIES WITH NEW WORDS BETWEEN THEM, in one branch: still refused.
  assert.ok(DUP(branchCase(BRANCHY({ form: FAQ() + "<p>The shutters open at 8.</p>" + FAQ() }))));
  // TWO COPIES IN ONE BRANCH WITH THE PAGE'S OWN WORDS BETWEEN THEM: two sections.
  assert.ok(branchCase(BRANCHY({ top: FAQ(), form: FAQ() })).includes("the section stored on /visit: exactly one section the press added states what was asked"), "two separate copies in one branch passed");
  for (const [sent, form] of [[FAQ("£50 a head, cheese included."), FAQ()], [FAQ(), FAQ("£50 a head, cheese included.")]]) {
    const wrong = branchCase(BRANCHY({ sent, form }));
    assert.ok(wrong.some((n) => /^the section stored on \/visit/.test(n)), "a wrong amount in one branch passed: " + JSON.stringify(wrong));
  }
  const none = branchCase(BRANCHY({ sent: FAQ("Ask us at the counter."), form: FAQ("Ask us at the counter.") }));
  assert.ok(none.includes("the section stored on /visit: exactly one section the press added states what was asked"), "a section with no answer passed: " + JSON.stringify(none));
});

test("OPENED 1 — AN ANSWER SERVED CLOSED IN AN ACCORDION (K's run 135, M's run 138): the served HTML holds only the question and fails, as it did live; read opened, before and after, it passes; opened, a wrong answer or no answer still fails; with only one opened read, the served HTML is judged", () => {
  const spec = { expect: { sections: [TASTE()] } };
  const QONLY = '<section class="faq"><h2>How much is an evening?</h2><button aria-expanded="false">How much is an evening?</button></section>';
  const b = read(withVisit(BRANCHY()));
  const a = read(withVisit(BRANCHY({ form: FAQ() })), [], { [VISIT]: QONLY });
  const page = (inner) => `<main><h1>page</h1>${inner}</main>`;
  const served = factNames(judgeOpen(b, a, spec));
  assert.ok(served.includes("the section served on /visit: exactly one section the press added states what was asked"), "the closed answer passed on the served HTML: " + JSON.stringify(served));
  const opened = (inner, before = page("")) => factNames(judgeOpen(b, a, spec, { before: { [VISIT]: before }, after: { [VISIT]: page(inner) } }));
  assert.deepEqual(opened(FAQ()), []);
  assert.ok(opened(FAQ("£50 a head, cheese included.")).some((n) => /^the section served on \/visit/.test(n)), "a wrong opened answer passed");
  assert.ok(opened(QONLY).some((n) => /^the section served on \/visit/.test(n)), "an opened page with no answer passed");
  assert.ok(opened(FAQ() + FAQ()).some((n) => /^the section served on \/visit/.test(n)), "the answer shown twice passed");
  assert.ok(factNames(judgeOpen(b, a, spec, { after: { [VISIT]: page(FAQ()) } })).some((n) => /^the section served on \/visit/.test(n)), "half the opened evidence passed");
});

test("OPENED 2 — THE CANARY READS A SECTION'S PAGE OPENED, BEFORE AND AFTER: exactly the routes a scenario expects a section on, none for a scenario with none; the inventory writes each opened read beside the served HTML and records how it went", () => {
  assert.deepEqual(openReadRoutes(UI_SCENARIOS["acc-addon-two-parts"]), UI_SCENARIOS["acc-addon-two-parts"].expect.sections.map((x) => x.route));
  assert.deepEqual(openReadRoutes(UI_SCENARIOS["acc-addon-pair"]), ["/visit", "/starter"]);
  assert.deepEqual(openReadRoutes({ expect: {} }), []);
  assert.deepEqual(openReadRoutes(null), []);
  const src = fs.readFileSync(ROOT + "scripts/edit-canary.mjs", "utf8");
  const inv = src.slice(src.indexOf("async function inventory("), src.indexOf("const inv = {", src.indexOf("async function inventory(")));
  assert.ok(inv.length > 100, "the inventory's landmarks are gone");
  assert.match(inv, /const openRoutes = openReadRoutes\(UI_ASK && UI_ASK\.scenario\)/);
  assert.match(inv, /readOpenedPage\(browser, \{ url: origin \+ r \}\)/);
  assert.match(inv, /writeFileSync\(`\$\{EVID\}\/\$\{label\}\/route\$\{file\}\.open\.html`, o\.html\)/);
  assert.match(inv, /render\[r\]\.open = /);
});
