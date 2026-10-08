// NOT RUN IS NOT ABSENT (2026-10-08, run 107).
//
// Run 107's add-on put the new Allergens page in every menu by code
// (`menu-links:ok`), and its own reply then told the customer the menu link —
// the request's next part — "was not tried this time … still waiting". The
// part ran next and found the link already on every page. The owner: *"Fix the
// real reply inconsistency universally: queued or deferred task status is not
// proof that its requested effect is absent from the site … give the model
// consistent facts about what actually happened, what another part still needs
// to check and what remains unfinished. Keep ordinary wording model-generated,
// without menu-specific exceptions or canned sentences."*
//
// So: the add-on's answer carries every menu link its own step put in and the
// published pages still hold (`linked`, read by `menuLinksKept`); the reply's
// facts say them; a part of the same request still to come is told as not run
// yet — never as missing — whatever it asks for; and the rules the model writes
// under say a status is no evidence about the site. Covered here: an earlier
// part that already satisfies a later one (through the real add-on route), a
// genuinely pending part, a partly satisfied one, a failed step, a part left
// for later outside any request (which keeps its "not tried"), and the
// request-level facts.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { addon, writtenPage, compiledPages } from "./fixtures/addon-route.mjs";
import { menuLinksKept } from "../builder/site-nav.mjs";
import { addonReplyFacts, editReplyFacts, requestReplyFacts, replyRequest } from "../builder/site-reply.mjs";

const BAKERY = ["index", "order", "starter", "visit", "gallery"].map((f) => ({ path: f + ".tsx", source: fs.readFileSync(new URL("./fixtures/run47/" + f + ".before.tsx", import.meta.url), "utf8") }));
const LINK_PART = "Put a link to the new Allergens page in the menu";
const TIKTOK_PART = "add a link to our TikTok in the footer";
const texts = (r) => r.facts.map((f) => f.kind + ": " + f.text);
const NOT_TRIED = /not tried|was not done|is missing/i;

// A PAGE AS THE KIT WRITES ONE: a shared menu (`CHROME.links`) and a body.
const page = (path, { menu = ["/", "/order"], body = "<p>Come in.</p>", extra = "" } = {}) => ({
  path,
  source: "import { SiteChrome } from \"@/components/ui/site-chrome\";\n" + extra +
    "const CHROME = { brand: \"Harbour Loaf\", links: [" + menu.map((h) => "{ label: \"" + (h === "/" ? "Home" : h.slice(1)) + "\", href: \"" + h + "\" }").join(", ") + "] };\n" +
    "export default function Page() { return <SiteChrome {...CHROME}><main>" + body + "</main></SiteChrome>; }\n",
});
const ADDED = (paths) => new Map(paths.map((p) => [p, { source: "(after the link)", to: ["/allergens"] }]));
const factsFor = (pages, paths) => {
  const r = menuLinksKept({ pages, linked: ADDED(paths) });
  const f = texts(addonReplyFacts({ ok: true, kinds: ["page"], added: ["allergens.tsx"], changed: paths, linked: r.kept, linkedUnsure: r.unsure, deferred: LINK_PART }, { inRequest: true }));
  return { r, f };
};

test("HELD 1 — only a link the published MENU carries is told as there: comments, stray strings, body links and links taken out later are not; an unreadable menu is told as not known", () => {
  // A GENUINE MENU LINK, on both pages.
  let { r, f } = factsFor([page("index.tsx", { menu: ["/", "/order", "/allergens"] }), page("order.tsx", { menu: ["/", "/order", "/allergens"] })], ["index.tsx", "order.tsx"]);
  assert.deepEqual(r, { kept: [{ path: "index.tsx", to: ["/allergens"] }, { path: "order.tsx", to: ["/allergens"] }], unsure: [] });
  assert.ok(f.includes("changed: The menu on / and /order now links to /allergens."), JSON.stringify(f));
  // CODEX'S TWO REPRODUCTIONS, and their kin: the address only in a comment,
  // only in an unrelated string, only in a link in the page's body, or gone
  // from the menu after a later change. None is a menu link; none is told.
  const cases = [
    ["a comment", page("index.tsx", { extra: "// the new page lives at \"/allergens\"\n" })],
    ["an unrelated string", page("index.tsx", { extra: "const NOTE = '/allergens';\n" })],
    ["a body-only link", page("index.tsx", { body: "<a href=\"/allergens\">Allergens</a>" })],
    ["a link removed by a later change", page("index.tsx", { menu: ["/", "/order"] })],
  ];
  for (const [what, pg] of cases) {
    ({ r, f } = factsFor([pg], ["index.tsx"]));
    assert.deepEqual(r, { kept: [], unsure: [] }, what + ": " + JSON.stringify(r));
    assert.ok(!f.some((t) => /now links to \/allergens/.test(t)), what + " is told as a menu link: " + JSON.stringify(f));
    assert.ok(!f.some((t) => /could not be read/.test(t)), what + ": a readable menu is told as unknown");
  }
  // NO MENU CAN BE READ (the page has none in a shape the reader knows, or the
  // page is not among the published ones): nothing is claimed either way.
  ({ r, f } = factsFor([{ path: "index.tsx", source: "export default () => <Layout>/allergens</Layout>;" }], ["index.tsx", "visit.tsx"]));
  assert.deepEqual(r, { kept: [], unsure: [{ path: "index.tsx", to: ["/allergens"] }, { path: "visit.tsx", to: ["/allergens"] }] });
  assert.ok(!f.some((t) => /now links to/.test(t)), JSON.stringify(f));
  assert.ok(f.includes("note: A link to /allergens was put in the menu on /, but whether the published menu there still carries it could not be read, so it is not known either way."), JSON.stringify(f));
  // CANNOT-TELL NEVER READS AS A LINK.
  assert.deepEqual(menuLinksKept({}), { kept: [], unsure: [] });
  assert.deepEqual(menuLinksKept({ pages: [page("index.tsx", { menu: ["/", "/allergens"] })], linked: { "index.tsx": { to: ["/allergens"] } } }), { kept: [], unsure: [] });
});

test("HELD 2 — through the real add-on route: an earlier part already satisfies a later one, and the facts say what the site holds, not that the later part is missing", async () => {
  const r = await addon("fw-held-allergens", "add an Allergens page saying every loaf is baked in one kitchen that also handles nuts", {
    kinds: ["page"], publishes: true, storedPages: BAKERY,
    answers: { page: { page: [{ path: "/allergens", name: "Allergens", purpose: "what the kitchen handles", sections: ["a band"], components: ["section-header"], link: { in: "menu" } }] } },
    written: [writtenPage("/allergens")],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 500));
  // THE WIRING: the answer leaving the Worker carries the links, each one in the published page.
  const out = compiledPages(r);
  assert.ok(Array.isArray(r.body.linked) && r.body.linked.length >= 1, "the answer carries no menu links: " + JSON.stringify(r.body.linked));
  for (const l of r.body.linked) {
    const pg = out.find((p) => p.path === l.path);
    assert.ok(pg && pg.source.includes("\"/allergens\""), l.path + " is said to link /allergens but the compiled page does not");
    assert.deepEqual(l.to, ["/allergens"]);
  }
  // THE FACTS, AS RUN 107'S PART RECEIVED THEM: its own work, plus the next part of the same request.
  const f = texts(addonReplyFacts({ ...r.body, deferred: LINK_PART }, { inRequest: true }));
  const menu = f.find((t) => /^changed: The menu on .* now links to \/allergens\.$/.test(t));
  assert.ok(menu, "no fact says which menus now link the new page: " + JSON.stringify(f));
  for (const l of r.body.linked) assert.ok(menu.includes(l.path === "index.tsx" ? "/" : "/" + l.path.replace(/\.tsx$/, "")), menu);
  const held = f.find((t) => t.startsWith("pending: ") && t.includes("“" + LINK_PART + "”"));
  assert.ok(held, "the next part is not named: " + JSON.stringify(f));
  assert.match(held, /has not run yet, which says nothing about whether the site already has what it asks for/);
  assert.match(held, /what this step did may already cover some or all of it/);
  assert.ok(!f.some((t) => NOT_TRIED.test(t)), "a fact still says not tried / missing: " + JSON.stringify(f));
});

test("HELD 3 — genuinely pending: the heading is done, the footer link comes next, and nothing claims the link is there or missing", () => {
  const f = texts(editReplyFacts({ ok: true, layer: "text", changed: ["Choose your loaf and a collection time"], applied: 1, deferred: TIKTOK_PART }, { inRequest: true }));
  assert.ok(f.some((t) => t.startsWith("changed: ")), JSON.stringify(f));
  const held = f.find((t) => t.startsWith("pending: ") && t.includes("“" + TIKTOK_PART + "”"));
  assert.ok(held, JSON.stringify(f));
  assert.match(held, /has not run yet/);
  assert.ok(!f.some((t) => /tiktok/i.test(t) && t.startsWith("changed: ")), "the footer link is told as made: " + JSON.stringify(f));
  assert.ok(!f.some((t) => NOT_TRIED.test(t)), JSON.stringify(f));
});

test("HELD 4 — partly satisfied: only the menus that really carry the link are named, and the part that asks for it is still told as coming next", () => {
  const body = {
    ok: true, kinds: ["page"], added: ["allergens.tsx"], changed: ["index.tsx", "order.tsx", "visit.tsx"],
    linked: [{ path: "index.tsx", to: ["/allergens"] }, { path: "order.tsx", to: ["/allergens"] }],
    deferred: LINK_PART,
  };
  const f = texts(addonReplyFacts(body, { inRequest: true }));
  const menu = f.find((t) => t.startsWith("changed: The menu on "));
  assert.equal(menu, "changed: The menu on / and /order now links to /allergens.", JSON.stringify(f));
  assert.ok(!menu.includes("/visit"), "a page whose menu did not get the link is named");
  assert.ok(f.some((t) => t.startsWith("pending: ") && t.includes("“" + LINK_PART + "”") && /has not run yet/.test(t)), JSON.stringify(f));
  // A PAGE WHOSE ONLY CHANGE IS THE LINK keeps its own fact, and is not named twice.
  const f2 = texts(addonReplyFacts({ ...body, restored: [{ path: "visit.tsx", to: ["/allergens"] }], linked: [...body.linked, { path: "visit.tsx", to: ["/allergens"] }] }, { inRequest: true }));
  assert.ok(f2.some((t) => /On \/visit, the only change is the link to \/allergens/.test(t)), JSON.stringify(f2));
  assert.equal(f2.filter((t) => t.includes("/visit") && /links? to \/allergens/.test(t)).length, 1, JSON.stringify(f2));
});

test("HELD 5 — a failed step: what failed is said, the next part is still only not run yet, and no link is claimed from a failed answer", () => {
  const f = texts(addonReplyFacts({ ok: false, error: "compile", cost: 0, msg: "the page did not compile", deferred: LINK_PART, linked: [{ path: "index.tsx", to: ["/allergens"] }] }, { inRequest: true }));
  assert.ok(f.some((t) => t.startsWith("not-done: ") || t.startsWith("nothing: ")), JSON.stringify(f));
  assert.ok(!f.some((t) => /now links to/.test(t)), "a failed answer's links are told as made: " + JSON.stringify(f));
  assert.ok(f.some((t) => t.startsWith("pending: ") && /has not run yet/.test(t)), JSON.stringify(f));
});

test("HELD 6 — outside any request a part left for later is still not tried, and nothing runs it, so the reply still says so", () => {
  const f = texts(editReplyFacts({ ok: true, layer: "text", changed: ["x"], applied: 1, deferred: TIKTOK_PART }, {}));
  assert.ok(f.some((t) => t === "pending: Left for later, so not tried this time (they can send it next): “" + TIKTOK_PART + "”"), JSON.stringify(f));
});

test("HELD 7 — the request's own facts and the rules the model writes under: a queued part is not run yet, and a status is never evidence about the site", () => {
  const v = { parts: [
    { n: 0, words: "add an Allergens page", status: "done", jobs: ["a"] },
    { n: 1, words: LINK_PART, status: "queued", jobs: [] },
  ] };
  const f = texts(requestReplyFacts(v));
  assert.ok(f.some((t) => t === "pending: Queued, not started yet: “" + LINK_PART + "”."), JSON.stringify(f));
  assert.ok(!f.some((t) => NOT_TRIED.test(t)), JSON.stringify(f));
  const req = replyRequest({ facts: requestReplyFacts(v).facts, context: "", model: "grok-4.6" });
  const sys = JSON.stringify(req);
  assert.match(sys, /A part that is queued, waiting or still to come has only not run yet/);
  assert.match(sys, /never evidence that their site lacks what it asks for/);
  // NO WORDING FOR ONE KIND OF THING: the rules name no menu, link or footer.
  const rules = sys.slice(sys.indexOf("RULES"), sys.indexOf("Never put a fact"));
  assert.ok(rules.length > 100, "the rules were not found");
  assert.doesNotMatch(rules, /\bmenu\b|\bfooter\b|\blink\b/i);
});

test("HELD 8 — the Worker hands both readings to the reply: the menu links the published menus carry, and those whose menu could not be read", () => {
  // THROUGH THE ROUTE an unreadable menu cannot be made: the menu step links
  // only pages whose menus it reads. So the hand-off is held here, landmark to
  // landmark, and the facts' side of it in HELD 1.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("const aKept = menuLinksKept({ pages: aMerge.pages, linked: aLinked });");
  assert.ok(at > 0, "the Worker no longer reads the menus it published");
  const next = src.indexOf("})(),", at);
  const body = src.slice(at, next);
  assert.ok(next > at && body.includes("{ linked: aKept.kept }") && body.includes("{ linkedUnsure: aKept.unsure }"), body);
  assert.ok(src.includes('import { runNavEdit, applyAdditions, menuLinksKept } from "./builder/site-nav.mjs";'));
});
