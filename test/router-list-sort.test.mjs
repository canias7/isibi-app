// A LIST SORTED ACROSS THE SITE IS `data`; ON ONE NAMED PAGE IT IS `page`
// (2026-09-30, decision 2b).
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
// WHAT THIS ESTABLISHES, AND WHAT IT CANNOT. The first cases read what the
// router is TOLD: the tool as defined, and the request the real
// `POST /api/site/route` sends. The route cases supply the router's answer and
// read what the route does with it. None of it shows which answer a real model
// chooses; only a live press after a merge and a deploy can. What each answer
// then does on the edit route is `test/edit-list-sort.test.mjs`.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { ASK_TOOL, EDIT_LAYERS, readEdit } from "../builder/site-ask.mjs";
import { readExpectRoute, routeVerdict } from "../scripts/canary-route.mjs";

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
// The two new sentences, found positively before anything is asserted about
// what they must not say. Read inside each case, so a wording without one fails
// the cases that need it and no others.
const siteWide = () => oneLine(DATA, /^SORTING ONE OF THOSE LISTS ACROSS THE SITE IS THIS LAYER TOO:/, "the data clause's site-wide sort");
const onePage = () => oneLine(PAGE, /^THE ORDER OF A LIST ON ONE PAGE THEY NAME IS THIS LAYER TOO/, "the page clause's one-page sort");

test("a sort not limited to one page is `data`, said in the data clause after the row sentence", () => {
  const { line: s, at } = siteWide();
  // WHAT IT CLAIMS: a sort by something every entry already has, which is
  // what the sort lane can do (a column), and it names no page.
  assert.match(s, /in order of something every entry already has/);
  assert.match(s, /and do not limit it to one page/);
  // THE TARGETS: the lane rewrites the read on every page that shows the list.
  assert.match(s, /it is re-sorted on every page that shows it\./);
  // AFTER THE ROW SENTENCE, which keeps its place as the clause's second line.
  assert.match(DATA[1], /^TAKING AN EXISTING ROW OFF ONE OF THOSE LISTS IS THIS LAYER TOO/);
  assert.equal(at, 2, "the sort sentence is not the data clause's third line");
  assert.match(DATA[0], /The tables it has are named above\./);
});

test("a sort limited to one page they name is `page`, and only that page changes", () => {
  const { line: s, at } = onePage();
  assert.match(s, /only that page's list is re-sorted/);
  assert.match(s, /every other page that shows the same list keeps its own order/);
  // WHERE IT SITS: under the layer's own opening line, and before "ONE PAGE,
  // AND ONLY ONE", which reads for a change meant to land on several pages.
  assert.match(PAGE[0], /^"page" — the arrangement of ONE existing page/);
  const several = oneLine(PAGE, /^ONE PAGE, AND ONLY ONE\./, "the several-pages paragraph");
  assert.equal(at, 1, "the one-page sort is not the page clause's second line");
  assert.ok(at < several.at, "the one-page sort is not before the several-pages paragraph");
});

test("no 'whatever page they saw it' rule: naming one page never sends a sort site-wide", () => {
  // THE CORRECTION ITSELF, both ways round: the data clause hands a sort
  // limited to one named page to `page`, and the page clause hands every other
  // sort to `data`. So a page is never read as where the list was merely seen.
  const d = siteWide().line;
  assert.match(d, /When they limit it to ONE page they name, it is "page" instead, and only that page changes/);
  assert.match(d, /different pages may show the same list in different orders/, "the reason, in the owner's terms");
  assert.match(onePage().line, /Not limited to one page, the same sort is "data"\.$/);
  // Absent everywhere the router reads, prose and all.
  for (const text of [LAYER, ALSO, P.page.description]) {
    assert.doesNotMatch(text, /whatever page they saw|on whatever page|wherever they saw/i, "a seen-on-this-page rule is back");
  }
});

test("a hand-placed entry is no sort, and the new sentences route it nowhere", () => {
  const d = siteWide().line;
  assert.match(d, /Placing one entry by hand \("put that one first"\) is not a sort\.$/);
  // The sentence ends there: it names no layer for a hand-placed order.
  const tail = d.slice(d.indexOf("Placing one entry by hand"));
  const quoted = [...tail.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(quoted, ["put that one first"], "a layer is named for a hand-placed order");
});

test("the rule is universal: it quotes layers or examples only and names no site, table or test request", () => {
  const added = [siteWide().line, onePage().line];
  const examples = ["put that one first", "on the services page, show the cheapest first"];
  for (const s of added) {
    for (const q of [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1])) {
      assert.ok(EDIT_LAYERS.includes(q) || examples.includes(q), "a new sentence quotes something that is neither a layer nor its example: " + q);
    }
    // No fixture: the demo sites, their tables, their loaves, or the words of
    // the prepared request ("… list the loaves from cheapest to most expensive").
    assert.doesNotMatch(s, /fold-lane|bakery|loaves|focaccia|levain|fretwork|lesson|lido|menu_items|most expensive/i, "a new sentence names a fixture: " + s);
  }
});

test("the whole-message rule, alsoAsked and every other clause are as they were: only the two new lines speak of sorting", () => {
  // THE CLOSING RULE is still the field's last word, and silent about order.
  const last = LINES[LINES.length - 1];
  assert.match(last, /^ONE ANSWER FOR THE WHOLE MESSAGE/);
  assert.match(last, /A layer other than "look" is the answer when it can make all of them, on every page each one is on\./);
  assert.doesNotMatch(last, /sort|order/i, "the whole-message rule itself was reworded");
  // `alsoAsked` holds nothing new, and a data change beside a change of
  // another kind is still its legitimate hold.
  assert.doesNotMatch(ALSO, /\bsort/i, "alsoAsked now speaks about sorting");
  assert.match(ALSO, /a change to what the site's lists hold \("data"\)[^.]*beside a change of another kind/);
  // THE ONLY LINES THAT SAY "sort" ARE THE TWO NEW ONES. The observer is alive:
  // both are found before the scan, and the scan counts them.
  const sorting = LINES.filter((l) => /\bsort|re-sorted/i.test(l));
  assert.deepEqual(sorting, [siteWide().line, onePage().line], "another clause now speaks about sorting");
  // `nav` still owns the menu's order, untouched.
  assert.match(LAYER, /THE MENU — which items are in it, what order they come in, taking one out\./);
});

// ─────────────────────────────────────────────────────────────────────────────
// THROUGH THE REAL ROUTING ROUTE. The router's answer is SUPPLIED; what is read
// is the request it was sent and what the route hands on.

const OWNER = { id: "66666666-6666-6666-6666-666666666666", email: "owner@example.com" };
// Test 10's request, as the owner wrote it (2026-09-30).
const TEST10 = "Across the site, list the loaves from cheapest to most expensive.";
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
    // A browser that built the site sends its pages and tables.
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

test("the router is sent both sentences, with the tables they point at", async () => {
  const r = await route({ intent: "edit", layer: "data" });
  assert.equal(r.status, 200);
  assert.equal(r.router.length, 1, "the router was not asked exactly once");
  const tool = (r.router[0].tools || []).find((t) => t && t.name === ASK_TOOL.name);
  assert.ok(tool, "the routing tool is not in the request");
  // THE REQUEST AS IT LEFT, not the module's constant.
  const layer = tool.input_schema.properties.layer.description;
  assert.ok(layer.includes(siteWide().line), "the site-wide sort sentence is not in the request");
  assert.ok(layer.includes(onePage().line), "the one-page sort sentence is not in the request");
  // "Those lists" have a referent in the same request.
  assert.match(String(r.router[0].messages[0].content), /Its database tables are: loaves, orders\./);
});

test("a site-wide sort goes on as a data edit with no page, and Test 10's press would post it", async () => {
  const r = await route({ intent: "edit", layer: "data" });
  assert.equal(r.body.intent, "edit");
  assert.equal(r.body.layer, "data");
  assert.ok(!r.body.alsoAsked, "a single sort was held back");
  assert.ok(PRESS.ok);
  assert.deepEqual(routeVerdict(PRESS.expect, r.body), { ok: true, diffs: [] });
  // A DATA ANSWER CARRIES NO PAGE, whatever the model adds: the sorter is
  // site-wide, so there is no page for it to be limited to.
  assert.deepEqual(readEdit({ layer: "data", page: "/menu" }, ["/", "/menu"]), { intent: "edit", answer: "", layer: "data" });
});

test("a page answer for Test 10's request is refused by its press before anything is posted", async () => {
  const r = await route({ intent: "edit", layer: "page", page: "/order" });
  assert.equal(r.body.layer, "page");
  const v = routeVerdict(PRESS.expect, r.body);
  assert.equal(v.ok, false, "the press would post a page answer for a site-wide sort");
  assert.deepEqual(v.diffs.map((d) => d.key), ["layer"]);
});

test("a sort limited to one page keeps that page all the way to the edit route", async () => {
  const r = await route({ intent: "edit", layer: "page", page: "/menu" }, "On the menu page, list the loaves from cheapest to most expensive.");
  assert.equal(r.body.layer, "page");
  assert.equal(r.body.page, "/menu");
  // And a page the site does not have is not guessed at.
  assert.equal(readEdit({ layer: "page", page: "/nowhere" }, ["/", "/menu"]).intent, "addon");
});
