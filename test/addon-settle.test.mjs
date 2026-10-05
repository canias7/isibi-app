// WHAT AN ADD-ON PUT BACK, SETTLED ONCE EVERY STEP HAS RUN (2026-10-05, run 101).
//
// The owner: *"Reconcile reverted and changed outcomes after all operations
// finish so the reply model receives accurate final facts: restoring an
// unrelated content change and later adding a navigation link must not become
// contradictory whole-page claims."*
//
// Run 101's add-on: the page writer also changed the Visit page, which its
// part never named; the merge put that change back (`reverted`); then the code
// put the new page's link in every menu, the Visit page's included (`changed`).
// The reply said both: "updated … Visit" and "The Visit page was left as it
// was". Here, through the real route with supplied answers, on two sites built
// two ways (the bakery's shared `CHROME.links`, a teacher's `links={[…]}`):
// the answer, the facts the reply model is given, the server's own composed
// reply and the browser's, and the page the compiler was handed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { addon, writtenPage, compiledPages } from "./fixtures/addon-route.mjs";
import { settleReverted, addonReply } from "../builder/site-addon.mjs";
import { addonReplyFacts } from "../builder/site-reply.mjs";
import { browserReply } from "../scripts/addon-sweep.mjs";
import { navSlots } from "../builder/site-nav.mjs";

const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const BAKERY = ["index", "order", "starter", "visit", "gallery"].map((f) => ({ path: f + ".tsx", source: fs.readFileSync(new URL("./fixtures/run47/" + f + ".before.tsx", import.meta.url), "utf8") }));
const menuHrefs = (pages, file) => { const pg = pages.find((x) => x.path === file); const s = pg && navSlots([pg])[0]; return s ? s.items.map((i) => i.href) : null; };
// A SECOND SITE, its menu written the other way the kit writes one: a header's own `links={[…]}`.
const teacher = (route, heading, words) => ({
  path: (route === "/" ? "index" : route.slice(1)) + ".tsx",
  source: "import { createFileRoute } from \"@tanstack/react-router\";\n" +
    "import { SiteChrome } from \"@/components/ui/site-chrome\";\n" +
    "export const Route = createFileRoute(\"" + route + "\")({ component: Page });\n" +
    "function Page() {\n  return (\n    <SiteChrome brand=\"Fretwork\" links={[{ label: \"Home\", href: \"/\" }, { label: \"Lessons\", href: \"/lessons\" }, { label: \"Prices\", href: \"/prices\" }]}>\n" +
    "      <main><h1>" + heading + "</h1><p>" + words + "</p></main>\n    </SiteChrome>\n  );\n}\n",
});
const TEACHER = [teacher("/", "Guitar lessons in Leeds", "One-to-one lessons for every level."), teacher("/lessons", "Lessons", "Half an hour or an hour."), teacher("/prices", "Prices", "£30 for an hour.")];
/** The page writer's answer for a page the site already has, with an extra change nobody asked for. */
const meddled = (pages, file, from, to) => { const p = pages.find((x) => x.path === file); assert.ok(p.source.includes(from), file + " no longer says " + from); return { path: file, source: p.source.replace(from, to) }; };
const factsOf = (body) => { const f = addonReplyFacts(body); assert.ok(Array.isArray(f.facts) && f.facts.length, "no facts: " + JSON.stringify(f)); return f.facts; };
const browserText = (body) => { const b = browserReply(body, true); assert.ok(b.ok, "the browser's composer could not run: " + b.why); return b.text; };

test("SETTLE 1 — settled against the final sources: a page byte for byte as stored stays reverted; one whose only change is the menu link is restored, naming the link; one changed otherwise is neither", () => {
  const stored = [{ path: "visit.tsx", source: "V0" }, { path: "about.tsx", source: "A0" }, { path: "prices.tsx", source: "P0" }];
  const pages = [{ path: "visit.tsx", source: "V0+link" }, { path: "about.tsx", source: "A0" }, { path: "prices.tsx", source: "P0+link+photo" }];
  const linked = new Map([["visit.tsx", { source: "V0+link", to: ["/bake-list"] }], ["prices.tsx", { source: "P0+link", to: ["/faq"] }]]);
  assert.deepEqual(settleReverted({ reverted: ["visit.tsx", "about.tsx", "prices.tsx"], stored, pages, linked }), {
    reverted: ["about.tsx"],
    restored: [{ path: "visit.tsx", to: ["/bake-list"] }],
  });
  // A PAGE NOBODY PUT BACK is none of this function's business, linked or not.
  assert.deepEqual(settleReverted({ reverted: [], stored, pages, linked }), { reverted: [], restored: [] });
  // CANNOT-TELL NEVER READS AS A VALUE: a page missing either way, a link with no address, junk.
  assert.deepEqual(settleReverted({ reverted: ["gone.tsx", 7, null], stored, pages, linked }), { reverted: [], restored: [] });
  assert.deepEqual(settleReverted({ reverted: ["visit.tsx"], stored, pages, linked: new Map([["visit.tsx", { source: "V0+link", to: [] }]]) }), { reverted: [], restored: [] });
  assert.deepEqual(settleReverted({}), { reverted: [], restored: [] });
});

test("SETTLE 2 — run 101's shape on the bakery: the writer's change to Visit is put back, the menu link goes in, and every reply says only the link was added there — never 'updated' and 'left as it was' of one page", async () => {
  const r = await addon("fw-settle-bake", "Add a Bake List page where people can join our weekly bake list by leaving their name and email address", {
    kinds: ["page"], publishes: true, storedPages: BAKERY,
    answers: { page: { page: [{ ...PAGE("/bake-list", "Bake List"), link: { in: "menu" } }] } },
    written: [writtenPage("/bake-list"), meddled(BAKERY, "visit.tsx", "The shutters and the street", "Find us on the street")],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 500));
  // THE PAGE AS PUBLISHED: its own content as stored, the link at the end of its menu, nothing else.
  const out = compiledPages(r);
  const visit = out.find((p) => p.path === "visit.tsx");
  assert.ok(visit && !visit.source.includes("Find us on the street"), "the change nobody asked for reached the compiler");
  assert.deepEqual(menuHrefs(out, "visit.tsx"), [...menuHrefs(BAKERY, "visit.tsx"), "/bake-list"]);
  // THE ANSWER: Visit is not "left as it was"; it is restored, with the link it gained.
  assert.deepEqual(r.body.reverted, [], "a page that gained a link is still said to be left as it was: " + JSON.stringify(r.body.reverted));
  assert.deepEqual(r.body.restored, [{ path: "visit.tsx", to: ["/bake-list"] }]);
  assert.ok(r.body.changed.includes("visit.tsx"), "the page that was published changed is no longer in `changed`");
  // THE FACTS THE REPLY MODEL IS GIVEN.
  const facts = factsOf(r.body).map((f) => f.text);
  assert.ok(facts.includes("On /visit, the only change is the link to /bake-list in its menu; nothing else there needed to change for this."), JSON.stringify(facts));
  const updated = facts.find((t) => /^Updated /.test(t)) || "";
  assert.ok(updated && !updated.includes("/visit"), "the whole Visit page is still said to be updated: " + updated);
  assert.ok(!facts.some((t) => /Left \/visit as it was/.test(t)), "the Visit page is still said to be left as it was: " + JSON.stringify(facts));
  // THE SERVER'S OWN COMPOSED REPLY, AND THE BROWSER'S.
  for (const [who, text] of [["server", addonReply(r.body)], ["browser", browserText(r.body)]]) {
    assert.match(text, /On \/visit I only added the link to \/bake-list/, who + ": " + text);
    assert.doesNotMatch(text, /I left \/visit as it was/, who + " still says the Visit page was left as it was: " + text);
    assert.doesNotMatch(text, /updated [^.]*\/visit/, who + " still says the whole Visit page was updated: " + text);
  }
});

test("SETTLE 3 — a teacher's site written the other way, two new pages: the page the writer meddled with is restored with both links; the facts and both composed replies say exactly that", async () => {
  const r = await addon("fw-settle-teach", "add a FAQ page and a gallery of my students playing", {
    kinds: ["page"], publishes: true, storedPages: TEACHER,
    answers: { page: { page: [{ ...PAGE("/faq", "FAQ"), link: { in: "menu" } }, { ...PAGE("/gallery", "Gallery"), link: { in: "menu" } }] } },
    written: [writtenPage("/faq"), writtenPage("/gallery"), meddled(TEACHER, "prices.tsx", "£30 for an hour.", "£35 for an hour.")],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 500));
  const out = compiledPages(r);
  assert.ok(!out.find((p) => p.path === "prices.tsx").source.includes("£35"), "the price change nobody asked for was published");
  assert.deepEqual(menuHrefs(out, "prices.tsx"), ["/", "/lessons", "/prices", "/faq", "/gallery"]);
  assert.deepEqual(r.body.reverted, []);
  assert.deepEqual(r.body.restored, [{ path: "prices.tsx", to: ["/faq", "/gallery"] }]);
  const facts = factsOf(r.body).map((f) => f.text);
  assert.ok(facts.includes("On /prices, the only change is the link to /faq and /gallery in its menu; nothing else there needed to change for this."), JSON.stringify(facts));
  assert.ok(!facts.some((t) => /^Updated [^.]*\/prices/.test(t)), JSON.stringify(facts));
  for (const text of [addonReply(r.body), browserText(r.body)]) {
    assert.match(text, /On \/prices I only added the link to \/faq, \/gallery/, text);
    assert.doesNotMatch(text, /I left \/prices as it was/, text);
  }
});

test("SETTLE 4 — a page put back that gained nothing afterwards is still left as it was, and said so: the bakery's page with no menu, and a page the new page links from by a button instead", async () => {
  // THE PAGE WITH NO MENU: the menu link step leaves it alone, so "left as it was" stays true.
  const a = await addon("fw-settle-nomenu", "add a classes page", {
    kinds: ["page"], publishes: true, storedPages: BAKERY,
    answers: { page: { page: [{ ...PAGE("/classes", "Classes"), link: { in: "menu" } }] } },
    written: [writtenPage("/classes"), meddled(BAKERY, "starter.tsx", "This page isn", "This page is not")],
  });
  assert.equal(a.body.ok, true, JSON.stringify(a.body).slice(0, 500));
  assert.deepEqual(a.body.reverted, ["starter.tsx"]);
  assert.equal(a.body.restored, undefined, "a page that gained nothing was said to have gained a link");
  assert.ok(factsOf(a.body).some((f) => f.text === "Left /starter as it was: nothing there needed to change for this."));
  assert.match(addonReply(a.body), /I left \/starter as it was/);
  // A PAGE PLACEMENT, NOT THE MENU: no menu link goes in anywhere, so the meddled page is simply put back.
  const b = await addon("fw-settle-button", "add a wholesale page with a button to it on the order page", {
    kinds: ["page"], publishes: true, storedPages: BAKERY,
    answers: { page: { page: [{ ...PAGE("/wholesale", "Wholesale"), link: { in: "page", page: "/order", where: "under the order form" } }] } },
    written: [writtenPage("/wholesale"), meddled(BAKERY, "visit.tsx", "The shutters and the street", "Find us on the street")],
  });
  assert.equal(b.body.ok, true, JSON.stringify(b.body).slice(0, 500));
  assert.deepEqual(b.body.reverted, ["visit.tsx"]);
  assert.equal(b.body.restored, undefined);
});
