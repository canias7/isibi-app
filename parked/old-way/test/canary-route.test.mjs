// PARKED (2026-11-03, park-old-way): the old-way half of test/canary-route.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The route a paid canary press expects (Batch 1, 2026-09-29).
//
// THE PARSER is driven directly: a malformed box must refuse before anything is
// spent, and naming the router's own fields is the only way to write one.
//
// THE VERDICT is judged on the Worker's OWN routing replies, never on objects
// typed here: each case supplies the router's tool answer on the wire and takes
// what `/api/site/route` sends back, which is exactly what the canary receives
// as `rt.json`. A fixture comes from its real producer (run 47).
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { ASK_TOOL, EDIT_LAYERS } from "../../../builder/route-shared.mjs";
import { readExpectRoute, routeVerdict, expectSaid, mismatchSaid } from "../../../scripts/canary-route.mjs";

/** Batch 1's two expectations, exactly as the owner's form will carry them. */
const A = "intent=edit layer=page page=/gallery remove=true alsoAsked=none";
const B = "intent=edit layer=data alsoAsked=none";
const BAND = "on the Visit page only, put the \"Order a collection so we hold a loaf\" band above \"Come to the bakery\"";

const USER = { id: "u-canary-route-1", email: "owner@example.com" };
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

/** What `/api/site/route` answers when the router's model gives `answer`. */
async function routed(answer) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/get_credits")) return json(50);
    if (url.includes("/rpc/use_credits")) {
      let want = 0;
      try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      return json(want);
    }
    if (url.includes("/v1/messages")) {
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: ASK_TOOL.name, input: answer }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    const message = "Remove the gallery page.";
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer some-token" },
      body: JSON.stringify({ message, site: { name: "fold-lane-bakery", url: "https://fold-lane-bakery.gofarther.app", pages: ["/", "/gallery", "/order", "/starter", "/visit"], tables: [] },
        picker: "sonnet", firstBuild: false, brief: message, qa: [], answering: false, attached: false, slug: "fold-lane-bakery", hasSite: true }),
    }), { ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key" }, makeCtx());
    assert.equal(res.status, 200, "the route did not answer");
    return await res.json();
  } finally {
    globalThis.fetch = real;
  }
}

const expectOf = (text) => {
  const r = readExpectRoute(text);
  assert.ok(r.ok, "the expectation did not parse: " + r.msg);
  return r.expect;
};

test("A's expectation accepts the router's removal of /gallery and nothing near it", async () => {
  const want = expectOf(A);
  const removal = await routed({ intent: "edit", layer: "page", page: "/gallery", remove: true });
  assert.equal(removal.remove, true, "the route no longer carries the removal it was given");
  assert.deepEqual(routeVerdict(want, removal), { ok: true, diffs: [] });

  // Run 63's real shape: the menu layer with the band held back.
  const run63 = await routed({ intent: "edit", layer: "nav", remove: true, alsoAsked: BAND });
  const v63 = routeVerdict(want, run63);
  assert.equal(v63.ok, false);
  assert.deepEqual(v63.diffs.map((d) => d.key).sort(), ["alsoAsked", "layer", "page"]);
  assert.match(mismatchSaid(v63), /layer: expected page, the router answered nav/);

  const cases = {
    "an edit of the gallery page, not a removal": [{ intent: "edit", layer: "page", page: "/gallery" }, ["remove"]],
    "another page removed": [{ intent: "edit", layer: "page", page: "/visit", remove: true }, ["page"]],
    "the gallery moved instead": [{ intent: "edit", layer: "page", page: "/gallery", rename: "/photos" }, ["remove"]],
    "the removal with a part held back": [{ intent: "edit", layer: "page", page: "/gallery", remove: true, alsoAsked: BAND }, ["alsoAsked"]],
    "the add-on step": [{ intent: "addon" }, ["intent", "layer", "page", "remove"]],
  };
  for (const [name, [answer, keys]] of Object.entries(cases)) {
    const v = routeVerdict(want, await routed(answer));
    assert.equal(v.ok, false, name + " was accepted");
    assert.deepEqual(v.diffs.map((d) => d.key).sort(), keys.slice().sort(), name);
  }
});

test("B's expectation accepts the router's data answer with nothing held back, and only that", async () => {
  const want = expectOf(B);
  assert.deepEqual(routeVerdict(want, await routed({ intent: "edit", layer: "data" })), { ok: true, diffs: [] });
  const cases = {
    "data with a part held back": [{ intent: "edit", layer: "data", alsoAsked: BAND }, ["alsoAsked"]],
    "the words rung": [{ intent: "edit", layer: "text" }, ["layer"]],
    "the look door": [{ intent: "edit", layer: "look" }, ["layer"]],
    "the add-on step": [{ intent: "addon" }, ["intent", "layer"]],
  };
  for (const [name, [answer, keys]] of Object.entries(cases)) {
    const v = routeVerdict(want, await routed(answer));
    assert.equal(v.ok, false, name + " was accepted");
    assert.deepEqual(v.diffs.map((d) => d.key).sort(), keys.slice().sort(), name);
  }
});
