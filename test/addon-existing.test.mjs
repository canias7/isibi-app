// An add-on about what the site already has, a lone entry with a required
// column left out, and a question asked after the request was paid for
// (2026-10-24, addon-existing). Traced live at main 7956740c4: parts about
// `page:/shop`, `page:/cafe` and `data:lessons` were routed `addon`, found
// nothing new (or wrote a partial `lessons` row, Postgres 23502), and ended
// with routing charged; a part could still be answered with `clarify`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addonOnExisting, routeOnExisting, partClarifyChoice, rowUnmet, sitePages, siteTables } from "../builder/addon-existing.mjs";
// A NAMESPACE, so a missing export fails its own cases, not the whole file.
import * as SA from "../builder/site-add.mjs";
const { rowBrief, cleanAdd, addRefusal } = SA;
const rowRequired = (...a) => SA.rowRequired(...a);
import { addonFailure } from "../builder/site-addon.mjs";
import { readRun, handOff } from "../builder/request.mjs";
import { readHandOver, HAND_REASONS } from "../builder/hand-over.mjs";
import { ROUTE_REASONS, wordsIn } from "../builder/site-ask.mjs";

const site = { pages: ["/", "/shop", { path: "/cafe" }, "/lessons-info"], tables: ["lessons", { name: "Products" }] };
const addon = (writes, reads = []) => ({ intent: "addon", targets: [{ change: 0, writes, reads }], decision: { source: "model", reasons: [] } });

test("the site's pages and tables are read from either shape", () => {
  assert.deepEqual(sitePages(site), ["/", "/shop", "/cafe", "/lessons-info"]);
  assert.deepEqual(siteTables(site), ["lessons", "products"]);
});

test("an add-on whose every target exists goes to the page step on that page", () => {
  assert.deepEqual(addonOnExisting(addon(["page:/shop"]), site), { act: "edit", page: "/shop" });
  assert.deepEqual(addonOnExisting(addon(["data:lessons", "page:/cafe"]), site), { act: "edit", page: "/cafe" });
  // A `new-page` the site already has is that page.
  assert.deepEqual(addonOnExisting(addon(["new-page:/shop"]), site), { act: "edit", page: "/shop" });
});

test("an add-on that makes something new stays an add-on", () => {
  assert.deepEqual(addonOnExisting(addon(["new-page:/lessons", "data:lessons"]), site), { act: "page-asked", page: "" });
  // A table created beside a page the site has is a feature on that page (2026-10-25, feature-existing).
  assert.deepEqual(addonOnExisting(addon(["page:/shop", "new-data:orders"]), site), { act: "feature", page: "/shop" });
  assert.deepEqual(addonOnExisting(addon(["page:/shop", "component:cart"]), site), { act: "page-asked", page: "/shop" });
  // Lists only: one more entry is the add-on's, unchanged.
  assert.equal(addonOnExisting(addon(["data:lessons"]), site), null);
  // No targets, unknown pages, or not an add-on: unchanged.
  assert.equal(addonOnExisting(addon([]), site), null);
  assert.equal(addonOnExisting(addon(["page:/shop"]), { pages: [] }), null);
  assert.equal(addonOnExisting({ ...addon(["page:/shop"]), intent: "edit" }, site), null);
  // Only change 0 is this answer's.
  assert.equal(addonOnExisting({ intent: "addon", targets: [{ change: 1, writes: ["page:/shop"] }] }, site), null);
});

test("the router's answer is rewritten to the page step, with its reason", () => {
  const r = routeOnExisting({ ...addon(["page:/shop"]), handOver: { from: "route", reason: "page-unknown" }, model3d: { x: 1 } }, site, { reason: "addon-existing" });
  assert.equal(r.intent, "edit");
  assert.equal(r.layer, "page");
  assert.equal(r.page, "/shop");
  assert.equal(r.remove, false);
  // The add-on's own hand-over is dropped; the page step is told why it got
  // the change (2026-10-25, frame-parallel: `existing`, so no no-change retry).
  assert.deepEqual(r.handOver, { from: "route", reason: "existing", page: "/shop" });
  assert.equal(r.model3d, undefined);
  assert.deepEqual(r.decision.reasons, ["addon-existing"]);
  assert.ok(Object.hasOwn(ROUTE_REASONS, "addon-existing"));
});

test("a page-asked add-on carries a hand-over the add-on step reads, never over one it has", () => {
  const r = routeOnExisting(addon(["new-page:/lessons", "data:lessons"]), site, { reason: "addon-existing" });
  assert.equal(r.intent, "addon");
  assert.deepEqual(r.handOver, { from: "route", reason: "page-asked", field: "page" });
  assert.deepEqual(readHandOver(r.handOver, { pages: sitePages(site) }), { from: "route", reason: "page-asked", field: "page" });
  assert.ok(Object.hasOwn(HAND_REASONS, "page-asked"));
  const had = { from: "route", reason: "page-unknown", page: "/x" };
  assert.equal(routeOnExisting({ ...addon(["new-page:/x"]), handOver: had }, site).handOver, had);
  const plain = addon(["data:lessons"]);
  assert.equal(routeOnExisting(plain, site), plain);
});

test("a question for a paid part becomes the obvious choice", () => {
  const q = { intent: "clarify", question: { text: "Which page?", options: ["a", "b"] }, targets: [{ change: 0, writes: [], reads: ["page:/cafe"] }], decision: { source: "model", reasons: [] } };
  const r = partClarifyChoice(q, site, { reason: "clarify-part" });
  assert.equal(r.intent, "edit");
  assert.equal(r.layer, "page");
  assert.equal(r.page, "/cafe");
  assert.equal(r.question, undefined);
  assert.deepEqual(r.decision.reasons, ["clarify-part"]);
  assert.ok(Object.hasOwn(ROUTE_REASONS, "clarify-part"));
  // No page it names exists: the add-on step decides, nothing asked.
  const n = partClarifyChoice({ ...q, targets: [{ change: 0, writes: ["new-page:/new"] }] }, site);
  assert.equal(n.intent, "addon");
  assert.equal(n.question, undefined);
  // The start-over confirmation is never converted; nor is a non-question.
  const so = { ...q, confirm: "rewrite" };
  assert.equal(partClarifyChoice(so, site), so);
  const ed = { intent: "edit", layer: "text" };
  assert.equal(partClarifyChoice(ed, site), ed);
});

test("NOT NULL columns without a default are an entry's required columns", () => {
  const spec = { tables: [
    { name: "lessons", access: "display", columns: [{ name: "id", pk: true, notnull: true }, { name: "title", notnull: true }, { name: "price", required: true, default: 0 }, { name: "teacher", notnull: true }, { name: "note" }, { name: "created_at", notnull: true }] },
    { name: "signups", access: "public-submit", columns: [{ name: "email", notnull: true }] },
  ] };
  const req = rowRequired(spec);
  assert.deepEqual([...req.entries()], [["lessons", ["title", "teacher"]]]);
  const brief = rowBrief(new Map([["lessons", ["id", "title", "price", "teacher", "note"]]]), req);
  assert.match(brief, /- lessons \(title, price, teacher, note; must fill: title, teacher\)/);
  // Unchanged without the second argument.
  assert.doesNotMatch(rowBrief(new Map([["lessons", ["title"]]])), /must fill/);
});

test("cleanAdd refuses an entry missing a required column, before any write", () => {
  const ctx = { tables: ["lessons"], rowTables: new Map([["lessons", ["title", "teacher", "note"]]]), rowRequired: new Map([["lessons", ["title", "teacher"]]]) };
  const bad = cleanAdd("row", { table: "lessons", values: { title: "Saturday", note: "x" } }, ctx);
  assert.equal(bad.ok, false);
  assert.equal(bad.why, "row-missing-required");
  const blank = cleanAdd("row", { table: "lessons", values: { title: "Saturday", teacher: "  " } }, ctx);
  assert.equal(blank.ok, false);
  const good = cleanAdd("row", { table: "lessons", values: { title: "Saturday", teacher: "Ann" } }, ctx);
  assert.equal(good.ok, true);
  assert.deepEqual(good.value, [{ table: "lessons", values: { title: "Saturday", teacher: "Ann" } }]);
  // One good, one short: the short one is named, the good one kept.
  const mixed = cleanAdd("row", [{ table: "lessons", values: { title: "A", teacher: "B" } }, { table: "lessons", values: { title: "C" } }], ctx);
  assert.equal(mixed.ok, true);
  assert.equal(mixed.value.length, 1);
  assert.equal(mixed.skipped[0].why, "row-missing-required");
  assert.match(addRefusal("row-missing-required", "row"), /needs/);
});

test("the add-on's hand-over to the page step is a hop the request follows", () => {
  const f = addonFailure("existing", { layer: "page", page: "/shop" });
  assert.deepEqual(f, { ok: false, reason: "existing", cost: 0, escalate: true, layer: "page", page: "/shop" });
  const read = readRun({ status: 200, body: f });
  assert.equal(read.act, "hop");
  assert.equal(read.layer, "page");
  assert.equal(read.page, "/shop");
  const to = handOff(read, { op: "addon", intent: "addon", layer: "", page: "", hops: 0 });
  assert.deepEqual({ act: to.act, op: to.op, layer: to.layer, page: to.page, fromAddon: to.fromAddon }, { act: "hop", op: "edit", layer: "page", page: "/shop", fromAddon: true });
  assert.ok(Object.hasOwn(HAND_REASONS, "existing"));
  // Without a page, or to another step, it is no hop.
  assert.notEqual(addonFailure("existing", { layer: "page" }).escalate, true);
  assert.notEqual(addonFailure("existing", { layer: "look", page: "/shop" }).escalate, true);
});

// ── THE WIRING, in worker.js: landmarks read in order ────────────────────────
const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const at = (s, from = 0) => { const i = W.indexOf(s, from); assert.ok(i >= 0, "landmark missing: " + s); return i; };

test("the router's answer is read against the site before anything uses it", () => {
  const route = at("let routed = await rRoute(rDigest);");
  const conv = at("routed = routeOnExisting(routed, rDigest.site, { reason: \"addon-existing\" });", route);
  const prep = at("if (rJob && rJob.prepare === true) {", route);
  const asking = at("const asking = routed.intent === \"clarify\" && rLive;", route);
  assert.ok(conv < prep && prep < asking);
  // The question half is wired (owner, 2026-10-25): a part's routing job and an
  // answer resuming a paid request, before the add-on conversion and the preparation.
  const clar = at("routed = partClarifyChoice(routed, rDigest.site, { reason: \"clarify-part\" });", route);
  assert.ok(clar < conv);
  const gate = W.lastIndexOf("if (routed.failed !== true && (rPart || (rWaiting && rWaiting.requestKey && routed.answered === true))) {", clar);
  assert.ok(gate > route && clar - gate < 200);
});

test("an answer resuming a paid request is not charged routing again", () => {
  const set = at("if (rWaiting.requestKey) rPaidResume = true;");
  const resumedAt = W.lastIndexOf("rInstruction = rWaiting.request;", set);
  assert.ok(resumedAt > 0 && set - resumedAt < 80);
  const bill = at("if (rPaidResume) rCost = 0;", set);
  const usage = W.lastIndexOf("if (routed.usage) {", bill);
  assert.ok(usage > set && bill - usage < 3000);
});

test("the add-on step hands nothing-new to the page step, and a page request never takes the lone-entry path", () => {
  const pick = at("const aPicked = await pickAdds(");
  const noAdd = at("if (!aPicked.kinds.length) return (aOnPage && !aFeature) ? aToPage(\"no-add\") : aFailure(\"no-add\");", pick);
  const asked = at("if (aPageAsked && aPicked.kinds.length === 1 && aPicked.kinds[0] === \"row\") {", noAdd);
  const rowPath = at("if (aPicked.kinds.length === 1 && aPicked.kinds[0] === \"row\") {", asked);
  assert.ok(noAdd < asked && asked < rowPath);
  assert.match(W.slice(asked, rowPath), /if \(aOnPage\) return aToPage\("page-asked"\);[\s\S]*aPicked\.kinds = \["page"\];/);
  assert.match(W.slice(at("const aToPage = "), noAdd), /aFailure\("existing", \{ layer: "page", page: aOnPage \}\)/);
  // The required columns reach the designer and the cleaner.
  const row = W.slice(rowPath, rowPath + 2500);
  assert.match(row, /rowBrief\(aRowLists, aRowRequired\)/);
  assert.match(row, /rowRequired: aRowRequired \}/);
});

test("a lone entry's unmet requirements are told and, unless they are the whole message, handed on", () => {
  const msg = "Add a Jazz lesson to the lessons and let people book one.";
  const out = rowUnmet([
    { need: "Jazz is on the list", words: "Add a Jazz lesson", status: "covered" },
    { need: "a visitor can book a lesson", words: "let people book one", status: "unsupported" },
    { need: "made up", words: "words not there", status: "elsewhere" },
    { need: "", words: "let people book one", status: "elsewhere" },
    null,
  ], msg, wordsIn);
  assert.deepEqual(out.told, [{ need: "a visitor can book a lesson", status: "unsupported" }]);
  assert.deepEqual(out.carry, ["let people book one"]);
  // THE WHOLE MESSAGE IS TOLD, NEVER HANDED ON (it would come straight back here).
  const whole = rowUnmet([{ need: "bookings", words: msg, status: "elsewhere", step: "table" }], msg, wordsIn);
  assert.deepEqual(whole.told, [{ need: "bookings", status: "elsewhere", step: "table" }]);
  assert.deepEqual(whole.carry, []);
  assert.deepEqual(rowUnmet(undefined, msg, wordsIn), { told: [], carry: [] });
});

test("the row path tells what its entries do not do before it charges or writes", () => {
  const lone = at("if (aPicked.kinds.length === 1 && aPicked.kinds[0] === \"row\") {");
  const clean = at("const rowClean = cleanAdd(\"row\", rowRan.value", lone);
  const unmet = at("const rowUnmetOut = rowUnmet(rowRan.requirements, aInstruction, wordsIn);", clean);
  const carry = at("for (const w of rowUnmetOut.carry) if (!aHeldOut.parts.includes(w)) aHeldOut.parts.push(w);", unmet);
  const bill = at("const rowBill = pageCredits(...aDesignUsage);", carry);
  assert.ok(clean < unmet && unmet < carry && carry < bill);
  assert.ok(SA.REQUIREMENT_ADDS.includes("row"));
});
