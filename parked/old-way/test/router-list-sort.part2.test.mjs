// PARKED (2026-11-03, park-old-way): the old-way half of test/router-list-sort.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// A LIST SORTED ACROSS THE WHOLE SITE IS `data`; ON ONE NAMED PAGE IT IS
// `page`; ON A SELECTION OF PAGES IT IS NEVER WIDENED (2026-09-30, decision 2b;
// the scope corrected 2026-10-01).
//
// A list's order is written in PAGE CODE: the `{ order, dir }` of the page's
// `useRows` call, which the Data API sorts by. The data step's sort lane
// (`DATA_TOOL`'s `order` → `applySort`) rewrites that call on every page that
// reads the table, and the `page` rung edits the one file it is given. The
// router's tool pointed at neither: `data` named rows, `page` named "lay a list
// out differently", and the same sentence could land on either.
//
// The owner: *"Use the existing data-sort lane for site-wide sorting by an
// existing column. Requests limited to one page should use the existing page
// editor while the data sorter remains site-wide. Do not add the proposed
// 'whatever page they saw it' rule. Different pages may intentionally use
// different orders. Implement the general routing rule, preserving the existing
// whole-message handling and other edit routes."*
//
// AND THE CORRECTION (2026-10-01): *"'not limited to one page' does not mean
// 'site-wide.' Use data-sort when the requested change applies across the site.
// Keep a one-page request on the page editor. A request limited to a selected
// group of pages must preserve that selection; never expand it to every page
// showing the table."* The first wording sent every sort "not limited to one
// page" to `data` — two pages of three included — and the sort lane has no page
// scope, so the page left out was re-sorted too (shown with a supplied answer in
// `test/edit-list-sort.test.mjs`).
//
// THREE KINDS OF CASE, NAMED IN EACH TITLE, AND NONE OF THEM IS A REAL MODEL:
//   instructions:     what the router is TOLD — the tool as defined, and the
//                     request the real `POST /api/site/route` sends. Proves the
//                     rule is stated, never that a model follows it.
//   structure:        a fact about the code the instructions rely on.
//   supplied answers: a router answer is GIVEN and the real route's handling of
//                     it is read. Proves what the route does with each answer,
//                     never which answer a real model gives.
// Which answer a real router gives is measured only by a live press after a
// merge and a deploy, and none has been made for this rule. What each answer
// then does on the edit route is `test/edit-list-sort.test.mjs`, supplied
// answers too.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { ASK_TOOL, LIVE_ASK_TOOL, EDIT_LAYERS } from "../../../builder/route-shared.mjs";
import { LANE_FIELDS, laneLayer } from "../../../builder/site-lanes.mjs";
import { readExpectRoute, routeVerdict } from "../../../scripts/canary-route.mjs";

const P = ASK_TOOL.input_schema.properties;
const LAYER = P.layer.description;
const ALSO = P.alsoAsked.description;
const LINES = LAYER.split("\n");

/** A layer's clause: its opening line and every line after it, up to the next layer's. */
function clause(layer, next) {
  const at = LINES.findIndex((l) => l.startsWith("\"" + layer + "\" — "));
  const end = LINES.findIndex((l) => l.startsWith("\"" + next + "\" — "));
  assert.ok(at >= 0 && end > at, "the " + layer + " clause's landmarks moved");
  return LINES.slice(at, end);
}
/** The one line of `lines` matching `re`, and where it is. */
function oneLine(lines, re, what) {
  const hits = lines.map((l, i) => [l, i]).filter(([l]) => re.test(l));
  assert.equal(hits.length, 1, what + ": expected exactly one line, found " + hits.length);
  return { line: hits[0][0], at: hits[0][1] };
}

const DATA = clause("data", "text");
const PAGE = clause("page", "rename");
// The two sentences, found positively before anything is asserted about what
// they must not say. Read inside each case, so a wording without one fails the
// cases that need it and no others.
const siteWide = () => oneLine(DATA, /^SORTING ONE OF THOSE LISTS ACROSS THE WHOLE SITE IS THIS LAYER TOO:/, "the data clause's site-wide sort");
const onePage = () => oneLine(PAGE, /^THE ORDER OF A LIST ON ONE PAGE THEY NAME IS THIS LAYER TOO/, "the page clause's one-page sort");

// ─────────────────────────────────────────────────────────────────────────────
// THROUGH THE REAL ROUTING ROUTE. The router's answer is SUPPLIED; what is read
// is the request it was sent and what the route hands on.

const OWNER = { id: "66666666-6666-6666-6666-666666666666", email: "owner@example.com" };
// Test 10's request, as the owner wrote it (2026-09-30).
const TEST10 = "Across the site, list the loaves from cheapest to most expensive.";
// The owner's three-page case: two pages named, the third excluded.
const SELECTED = "On the home page and the menu page, but not the order page, list the loaves from cheapest to most expensive.";
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

async function route(answer, message = TEST10) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  const router = [];
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (u.includes("/auth/v1/user")) return json(OWNER);
    if (u.includes("/rpc/get_credits")) return json(50);
    if (u.includes("/rpc/use_credits")) return json(1);
    if (u.includes("/rest/v1/")) return json([]);
    if (u.startsWith("https://api.anthropic.com/")) {
      router.push(JSON.parse(String((init && init.body) || "{}")));
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: ASK_TOOL.name, input: answer }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    // A browser that built the site sends its pages and tables: the same list
    // is read on three of them.
    const site = { name: "list-sort", url: "https://list-sort.gofarther.app", pages: ["/", "/menu", "/order"], tables: ["loaves", "orders"] };
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ message, site, picker: "sonnet", firstBuild: false, brief: message, qa: [], answering: false, attached: false, slug: "list-sort", hasSite: true }),
    }), { ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    return { status: res.status, body: JSON.parse(await res.text()), router };
  } finally {
    globalThis.fetch = real;
  }
}
// Test 10's paid press enforces this route (the canary's route box).
const PRESS = readExpectRoute("layer=data alsoAsked=none");

test("instructions: the router is sent both sentences, with the pages and tables they point at", async () => {
  const r = await route({ intent: "edit", layer: "data" });
  assert.equal(r.status, 200);
  assert.equal(r.router.length, 1, "the router was not asked exactly once");
  const tool = (r.router[0].tools || []).find((t) => t && t.name === ASK_TOOL.name);
  assert.ok(tool, "the routing tool is not in the request");
  // THE REQUEST AS IT LEFT, not the module's constant.
  const layer = tool.input_schema.properties.layer.description;
  // THE LIVE TOOL'S SORT RULE (2026-10-25, router-b1), said once in `data`.
  assert.equal(layer, LIVE_ASK_TOOL.input_schema.properties.layer.description);
  assert.match(layer, /sorts a list by something every entry has \(cheapest first, A to Z\) ACROSS THE WHOLE SITE, when they say so or name no page\. It cannot leave a page out: a sort on one page they name is "page", and on several pages they name the closing rule decides\./, "the sort rule is not in the request");
  assert.match(layer, /"page" — [^\n]*a list's order on that page alone/, "the one-page sort is not in the request");
  assert.doesNotMatch(JSON.stringify(r.router[0]), /limit(?:ed)? it to one page|not limited to one page/i, "a broad phrase left in the request");
  // "Those lists" and "the pages" have referents in the same request.
  const content = String(r.router[0].messages[0].content);
  assert.match(content, /Its database tables are: loaves, orders\./);
  assert.match(content, /Its pages are: \/, \/menu, \/order\./);
});

test("supplied answers: a page answer for Test 10's request is refused by its press before anything is posted", async () => {
  const r = await route({ intent: "edit", layer: "page", page: "/order" });
  assert.equal(r.body.layer, "page");
  const v = routeVerdict(PRESS.expect, r.body);
  assert.equal(v.ok, false, "the press would post a page answer for a site-wide sort");
  assert.deepEqual(v.diffs.map((d) => d.key), ["layer"]);
});

test("supplied answers: two pages named and the third excluded — a `look` answer goes on with no page and nothing held back; a press expecting it refuses `data`", async () => {
  // THE ANSWER THE INSTRUCTIONS LEAD TO, given here: `data` cannot leave a page
  // out, `page` edits one, and the closing rule gives changes on several pages
  // to `look`. Whether a real router gives it is not measured.
  const look = await route({ intent: "edit", layer: "look" }, SELECTED);
  assert.equal(look.status, 200);
  assert.equal(look.body.intent, "edit");
  assert.equal(look.body.layer, "look");
  assert.ok(!look.body.page, "a page was kept for a change on two pages");
  assert.ok(!look.body.alsoAsked, "part of the selection was held back");
  const press = readExpectRoute("layer=look alsoAsked=none");
  assert.ok(press.ok);
  assert.deepEqual(routeVerdict(press.expect, look.body), { ok: true, diffs: [] });
  // THE ROUTE ITSELF DOES NOT STOP A `data` ANSWER: it reads no page out of
  // the message. Only the router's instructions keep a selection from the
  // sorter — and, on a press, a route box stating the expected answer.
  const data = await route({ intent: "edit", layer: "data" }, SELECTED);
  assert.equal(data.body.layer, "data", "the route changed a data answer by itself");
  assert.deepEqual(routeVerdict(press.expect, data.body).diffs.map((d) => d.key), ["layer"]);
});
