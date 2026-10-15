// A MENU LINK THE PUBLISHED MENUS COULD NOT BE READ FOR IS UNVERIFIED, NEVER
// MISSING (2026-10-15, after run 38649153034's add-on).
//
// The add-on added /bulk-orders and put a link to it in every menu; eight menus
// were read back carrying it, three could not be read. Its requirement judgment
// could not name a menu link as the thing that does "a visitor can open the
// page from the menu" (no such item was listed), answered "no", and the
// requirement became "Still to do" — so the part ended partial and the reply
// said the menus link and, a sentence later, that opening the page from the
// menu "is not done".
//
// The correction: the judgment is shown the link it can name (`link:/path`,
// `judgeItems`); what it rests on is read after the menu step from the
// published menus (`linkEvidence`, `carriersReading`) — carried by one read
// back, set up; only unreadable menus, unknown; read and not carried, missing
// — and a requirement nothing could look at reaches the reply as its own kind
// (`v`, unverified), never "not done".
import test from "node:test";
import assert from "node:assert/strict";
import { requirementReport, linkEvidence, carrierOf, ITEM_KINDS } from "../builder/site-requirements.mjs";
import { judgeItems } from "../builder/site-add.mjs";
import { addonReplyFacts, replyOutcomeOf, REPLY_SYSTEM } from "../builder/site-reply.mjs";
import { notDoneOf } from "../builder/request.mjs";

const NEED = "A visitor can open the page from the menu";
const PAGE_NEED = "The site has a Bulk Orders page for cafés";
const J = (carried, by = []) => ({ follows: "asked", carried, by, reason: "r" });
let seq = 0;
const E = (o) => ({ basis: "asked", words: "w", id: "page#" + seq++, ...o });
const viaLink = () => E({ need: NEED, status: "covered", from: "page", item: "/bulk-orders", kind: "page", judged: J("yes", ["link:/bulk-orders"]) });
const viaNothing = () => E({ need: NEED, status: "covered", from: "page", item: "/bulk-orders", kind: "page", judged: J("no") });
const thePage = () => E({ need: PAGE_NEED, status: "covered", from: "page", item: "/bulk-orders", kind: "page", judged: J("yes", ["page:/bulk-orders"]) });
const MADE = [{ kind: "page", name: "/bulk-orders" }];
const OPTS = { made: MADE, reportable: ["page", "component", "edit"], judged: true };
// run 38649153034's reading: eight menus carry the link, three could not be read
const PRESS_B = {
  kept: ["index.tsx", "visit.tsx", "gallery.tsx", "classes.tsx", "wholesale.tsx", "faq.tsx", "allergens.tsx", "bakers.tsx"].map((path) => ({ path, to: ["/bulk-orders"] })),
  unsure: ["order.tsx", "bake-list.tsx", "tasting-evenings.tsx"].map((path) => ({ path, to: ["/bulk-orders"] })),
};
const told = (links, list = [viaLink()]) => requirementReport(list, { ...OPTS, links }).told.map((t) => [t.told, t.need]);
const bodyOf = (report, extra = {}) => ({ ok: true, changed: ["src/routes/bulk-orders.tsx"], added: ["src/routes/bulk-orders.tsx"], cost: 16, requirementsTold: report.told, ...extra });

test("LINK 1 — the judgment is shown the menu link a page is planned to get, and may name it; never for a page with no menu placement", () => {
  assert.ok(ITEM_KINDS.includes("link"));
  assert.deepEqual(carrierOf("link:/bulk-orders"), { kind: "link", name: "/bulk-orders" });
  const items = judgeItems({ answers: [{ kind: "page", value: { path: "/bulk-orders", name: "Bulk Orders", purpose: "orders for cafés", link: { in: "menu" } } }] });
  const link = items.find((i) => i.id === "link:/bulk-orders");
  assert.ok(link, JSON.stringify(items));
  assert.match(link.text, /menu/);
  assert.match(link.text, /read after the change runs/);
  const none = judgeItems({ answers: [{ kind: "page", value: { path: "/bulk-orders", name: "Bulk Orders" } }] });
  assert.ok(!none.some((i) => i.id.startsWith("link:")), "a page with no menu placement was offered a link");
});

test("LINK 2 — the published menus' reading, by the page each link opens: carried by any read menu is kept; only unreadable menus is unsure; nothing read is null", () => {
  assert.deepEqual(linkEvidence(PRESS_B), { "/bulk-orders": "kept" });
  assert.deepEqual(linkEvidence({ kept: [], unsure: PRESS_B.unsure }), { "/bulk-orders": "unsure" });
  assert.deepEqual(linkEvidence({ kept: [], unsure: [] }), {});
  assert.equal(linkEvidence(null), null);
});

test("LINK 3 — PRESS B: links carried on eight menus and unreadable on three — the requirement is set up (not still to do), the part is not partial for it, and no 'not done' fact is told", () => {
  const r = requirementReport([thePage(), viaLink()], { ...OPTS, links: linkEvidence(PRESS_B) });
  assert.deepEqual(r.told.map((t) => [t.told, t.need]), [["set-up", PAGE_NEED], ["set-up", NEED]]);
  const body = bodyOf(r, { linked: PRESS_B.kept, linkedUnsure: PRESS_B.unsure });
  assert.deepEqual(notDoneOf(body, "addon"), [], "the part would end partial over a link it put in");
  const facts = addonReplyFacts(body).facts;
  assert.deepEqual(facts.filter((f) => f.kind === "not-done"), [], JSON.stringify(facts));
  // the reading of the menus is still told, both halves, beside it
  assert.ok(facts.some((f) => /The menu on .* now links to/.test(f.text) || /now link/.test(f.text)), JSON.stringify(facts.map((f) => f.text)));
  assert.ok(facts.some((f) => /could not be read, so it is not known either way/.test(f.text)), JSON.stringify(facts.map((f) => f.text)));
  assert.equal(replyOutcomeOf({ facts }), "done");
});

test("LINK 4 — every menu it went into unreadable: UNVERIFIED — told as nobody could see, its own fact kind, never 'not done', never 'done'; the part is not partial", () => {
  const r = requirementReport([viaLink()], { ...OPTS, links: linkEvidence({ kept: [], unsure: PRESS_B.unsure }) });
  assert.deepEqual(r.told.map((t) => [t.told, t.need]), [["unseen", NEED]]);
  const body = bodyOf(r, { linkedUnsure: PRESS_B.unsure });
  assert.deepEqual(notDoneOf(body, "addon"), []);
  const facts = addonReplyFacts(body).facts;
  const mine = facts.filter((f) => f.text.includes(NEED));
  assert.deepEqual(mine.map((f) => f.kind), ["unverified"]);
  assert.match(mine[0].id, /^v\d+$/);
  assert.match(mine[0].text, /neither done nor not done/);
  assert.ok(!facts.some((f) => f.kind === "not-done"), JSON.stringify(facts));
  assert.equal(replyOutcomeOf({ facts }), "partly", "what nobody could see was called done");
  // and the reply writer is told what a v fact is
  assert.match(REPLY_SYSTEM, /v: not verified/);
  assert.match(REPLY_SYSTEM, /never say it was done and never say it was not done/);
});

test("LINK 5 controls — a link the menus were read for and do not carry is STILL TO DO; with no reading at all it is unknown; a judgment that named nothing is still to do, as before", () => {
  assert.deepEqual(told({}), [["still-to-do", NEED]], "a link read as absent was not told as still to do");
  assert.deepEqual(told(null), [["unseen", NEED]], "with no reading the link was decided");
  assert.deepEqual(told(linkEvidence(PRESS_B), [viaNothing()]), [["still-to-do", NEED]]);
  // and the part is partial for a link really missing
  const r = requirementReport([viaLink()], { ...OPTS, links: {} });
  assert.deepEqual(notDoneOf(bodyOf(r), "addon").length, 1);
});
