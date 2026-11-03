// PARKED (2026-11-03, park-old-way): the old-way half of test/request-findings.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE TWO FINDINGS OF RUN 95's R1, REPRODUCED AND FIXED (found 2026-10-04 on
// the owner's word: *"yes look into both problems"*; fixed the same day on
// their word: *"Proceed with fixing both findings on the current branch"*).
// Free: the product's own functions, run on what run 95 recorded
// (test/fixtures/run95-r1.json — the bakery's six stored pages after R1, and
// the three job results the page read for R1's parts), with supplied model
// answers. Until the fix these cases asserted the behaviour as it was (FOUND);
// each now asserts what replaced it.
//
// F1. A menu link handed from the add-on step to the menu step was refused
//     `no-menu`. Two layers: the add-on's page step linked a new page from ONE
//     page ("Link it from the header menu: return that page too"), while every
//     page in this kit carries its own menu; and the menu step, shown one menu
//     (the union of every page's), read an item any page carried as present
//     everywhere, so an addition found nothing new. NOW: an addition names its
//     items and their scope (`add`), and code puts each into every list in that
//     scope that lacks it — each page keeping its own items, order and
//     differences; a new page's placement is carried explicitly (`link.in`),
//     a menu placement added to the menus by code; and an addition already
//     true everywhere it was asked for ends as already done.
//
//     Run 95's site has SIX pages and FIVE menus: /starter has none, and
//     nothing here gives it one.
//
// F2. R1's parts got no model-written reply. The reply was written while the
//     page waited, inside the poll, under a 12 s ceiling per call that a cut
//     call could not retry — and every read with a reply to write took about
//     12 s longer than one without. The cause stays STRONGLY INFERRED from those
//     timings (the Worker's own log lines were not read). NOW: the reply is
//     written on the queue after the job's outcome and money are final, with
//     its own budgets and bounded retries, and no read ever calls the model.
//     What that path does is in `test/reply-background.test.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runNavEdit, navSlots, chromeListSlots, frameNow, actionSlots, contactSlots, NAV_ADD_TOOL, applyAdditions, additionOutcome, additionReply } from "../../../builder/site-nav.mjs";
import { addDirective, placementOf, menuLinkAdds } from "../../../builder/site-add.mjs";
import { routeOf } from "../../../builder/site-addon.mjs";
import {
  editReplyFacts, addonReplyFacts, writeReply, withReplyText, REPLY_TOOL, REPLY_CALL_MS, REPLY_DEADLINE_MS,
  REPLY_BG_CALL_MS, REPLY_BG_DEADLINE_MS, REPLY_BG_ATTEMPTS, REPLY_BG_RETRY_S,
} from "../../../builder/site-reply.mjs";
import { callBuilderModel } from "../../../builder/build-call.mjs";

const ROOT = new URL("../../../", import.meta.url).pathname;
const F = JSON.parse(fs.readFileSync(ROOT + "test/fixtures/run95-r1.json", "utf8"));
const PAGES = F.pages.map((p) => ({ path: "src/routes/" + p.path, source: p.source }));
const ROUTES = [...new Set(PAGES.map((p) => routeOf(p.path)).filter(Boolean))];
const menuIn = (pages, file) => { const s = navSlots(pages).find((x) => x.page === "src/routes/" + file); return s ? s.items.map((i) => i.href) : null; };
const menuOf = (file) => menuIn(PAGES, file);
const sourceOf = (pages, file) => pages.find((p) => p.path === "src/routes/" + file).source;
/** The menu step's answer to an addition, as its model gives it (`add`). */
const addAnswer = (input) => async () => ({ content: [{ type: "tool_use", name: NAV_ADD_TOOL.name, input }], usage: { input_tokens: 100, output_tokens: 20 }, stop_reason: "tool_use" });
const CLASSES = { to: "menu", label: "Classes", href: "/classes" };
const addClasses = (pages, add = [CLASSES]) => runNavEdit({ send: addAnswer({ add }) }, { instruction: "put a link to the new Classes page in the menu", pages, routes: ROUTES, addition: true });

// ── THE OWNER'S REVIEW OF THE FIX: EVERY NAMED PAGE IS ACCOUNTED FOR ─────
//
// (2026-10-04.) A footer addition naming its pages excluded, silently, a
// named page whose frame had no such list whenever another named page had
// one — and, when that other page already had the entry, answered satisfied
// with nothing changed. The owner's reproduction is the first case. Now a
// named page with a frame is given the list; a named page with no footer is
// told, by name, and nothing is satisfied while it stands; an addition nobody
// scoped keeps its default (the list goes where the site has one).
const footer = (pages, file, prop) => { const sl = chromeListSlots([{ path: "src/routes/" + file, source: sourceOf(pages, file) }], prop)[0]; return sl ? sl.items : undefined; };
const LEGAL_CLASSES = { to: "legal", label: "Classes", href: "/classes" };
const addFooter = (pages, add) => runNavEdit({ send: addAnswer({ add }) }, { instruction: "add it to the footer", pages, routes: ROUTES, addition: true });
/** The run-95 site with the Classes link in the home page's small print only. */
async function legalOnHome() {
  const out = await addFooter(PAGES, [{ ...LEGAL_CLASSES, pages: ["/"] }]);
  assert.deepEqual(out.changed, ["src/routes/index.tsx"], JSON.stringify(out));
  assert.deepEqual(footer(out.pages, "index.tsx", "legal"), [{ label: "Classes", href: "/classes" }]);
  for (const f of ["order.tsx", "visit.tsx", "gallery.tsx", "classes.tsx"]) assert.equal(footer(out.pages, f, "legal"), null, f + " already has small print");
  assert.equal(footer(out.pages, "starter.tsx", "legal"), undefined, "the starter page has a footer after all");
  return out.pages;
}

// ── F2 ────────────────────────────────────────────────────────────────────

const factsOf = (r) => (Array.isArray(r.body.kinds) ? addonReplyFacts(r.body, { routedCost: 3, inRequest: true }) : editReplyFacts(r.body, { routedCost: 3, inRequest: true }));

test("FIXED (F2): a read never calls the model — the job poll and the request read hand back what the background writer stored, or say it is still being written", () => {
  const W = fs.readFileSync(ROOT + "worker.js", "utf8");
  for (const name of ["async function servedModelReply(", "async function requestReply("]) {
    const at = W.indexOf(name);
    assert.ok(at >= 0, name + " moved");
    const body = W.slice(at, W.indexOf("\n}\n", at));
    assert.ok(body.length > 200, name + ": its body was not found");
    for (const call of ["writeReply(", "composeModelReply(", "writeModelReply(", "quickSend("]) assert.ok(!body.includes(call), name + " calls " + call);
  }
});
