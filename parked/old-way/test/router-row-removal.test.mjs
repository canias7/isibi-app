// PARKED (2026-11-03, park-old-way): the old-way half of test/router-row-removal.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// A ROW THE SITE STORES, TAKEN OFF ITS LIST, IS THE `data` ANSWER (2026-09-30).
//
// Found while preparing Lane 4's delete: the router's tool gave "take that
// entry off the list" two answers. `look`'s removal clause claimed EVERY
// removal ("TAKING SOMETHING OFF THE SITE IS THIS LAYER, whatever the something
// is"), a whole page its one exception, and `data`'s clause claimed one row of
// something the site lists. On the look door no lane deletes a row (`backend`
// is the rules rung), while the data step deletes one itself. And look's reach
// under `alsoAsked`, which the closing whole-message rule reads, said "taking
// something off" with no exception at all.
//
// The owner: *"Removing an existing stored database row must reach the data
// route. Preserve whole-page deletion and existing handling of other removals.
// Preserve the whole-message rule based on what each route can execute across
// its targets. Do not decide or change add-row routing, reordering, or the
// other pending product decisions. Use a universal rule, with no fixture names
// or keyword shortcuts."*
//
// WHAT THIS ESTABLISHES, AND WHAT IT CANNOT. The first cases read what the
// router is TOLD: the tool as defined, and the request the real
// `POST /api/site/route` sends. The route cases supply the router's answer and
// read what the route does with it. None of it shows which answer a real model
// chooses; only a live press after a merge and a deploy can.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { ASK_TOOL, LIVE_ASK_TOOL, EDIT_LAYERS, REMOVABLE_LAYERS, readEdit } from "../builder/site-ask.mjs";
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
const LOOK = clause("look", "rules");
const REACH = ALSO.split("\n").find((l) => l.startsWith("SEVERAL CHANGES ARE ONE TURN"));
// The three new sentences, found positively before anything is asserted about
// what they must not say. Read inside each case, so a wording without them
// fails the cases that need them and no others.
const dataRow = () => oneLine(DATA, /^TAKING AN EXISTING ROW OFF/, "the data clause's row removal");
const lookRow = () => oneLine(LOOK, /^THE SECOND IS A ROW THE SITE STORES\./, "look's stored-row exception");
function reachRow() {
  assert.ok(REACH, "look's reach under alsoAsked could not be found");
  const m = /taking something off \(but not a row the site stores: that is "data"\)/.exec(REACH);
  assert.ok(m, "look's reach still claims every removal, a stored row's included: " + REACH);
  return m[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// THROUGH THE REAL ROUTING ROUTE. The router's answer is SUPPLIED; what is read
// is the request it was sent and what the route hands on.

const OWNER = { id: "55555555-5555-5555-5555-555555555555", email: "owner@example.com" };
const MESSAGE = "We don't run the evening workshop any more, please take it off the list.";
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

async function route(answer) {
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
    // A browser that built the site sends its tables, so nothing is looked up.
    const site = { name: "row-removal", url: "https://row-removal.gofarther.app", pages: ["/", "/workshops"], tables: ["workshops", "bookings"] };
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ message: MESSAGE, site, picker: "sonnet", firstBuild: false, brief: MESSAGE, qa: [], answering: false, attached: false, slug: "row-removal", hasSite: true }),
    }), { ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    return { status: res.status, body: JSON.parse(await res.text()), router };
  } finally {
    globalThis.fetch = real;
  }
}
const PRESS = readExpectRoute("intent=edit layer=data alsoAsked=none");

test("the answer the rule asks for goes on as a data edit, and the prepared press would post it", async () => {
  const r = await route({ intent: "edit", layer: "data" });
  assert.equal(r.body.intent, "edit");
  assert.equal(r.body.layer, "data");
  assert.ok(!r.body.remove, "a data answer carries the page removal flag");
  assert.ok(!r.body.alsoAsked, "a single row removal was held back");
  assert.ok(PRESS.ok);
  assert.deepEqual(routeVerdict(PRESS.expect, r.body), { ok: true, diffs: [] });
  // A removal flag the model sets anyway is dropped for `data`: the data step
  // decides which row goes, never a flag on the routing answer.
  assert.deepEqual(readEdit({ layer: "data", remove: true }, ["/"]), { intent: "edit", answer: "", layer: "data" });
});

test("controls: a whole page and every other removal keep their answers", () => {
  // A whole page is still `page` with its flag.
  assert.deepEqual(readEdit({ layer: "page", page: "/workshops", remove: true }, ["/", "/workshops"]).remove, true);
  // A removal on a door layer still carries its flag to the lane door.
  for (const layer of ["picture", "nav", "logo"]) {
    assert.equal(readEdit({ layer, remove: true }, ["/"]).remove, true, layer + " lost its removal flag");
  }
});
