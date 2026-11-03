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
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { ASK_TOOL, EDIT_LAYERS } from "../builder/route-shared.mjs";
import { readExpectRoute, routeVerdict, expectSaid, mismatchSaid } from "../scripts/canary-route.mjs";

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

test("Batch 1's two expectations read as exactly the fields they name", () => {
  assert.deepEqual(expectOf(A), { intent: "edit", layer: "page", page: "/gallery", remove: true, alsoAsked: null });
  assert.deepEqual(expectOf(B), { intent: "edit", layer: "data", alsoAsked: null });
  // Spelled back the way the form spells it, so the log shows what was asked.
  assert.equal(expectSaid(expectOf(A)), A);
  assert.equal(expectSaid(expectOf(B)), B);
});

test("a blank box is no expectation, and anything else must be the router's own fields", () => {
  for (const blank of [undefined, null, "", "   ", "\n"]) assert.deepEqual(readExpectRoute(blank), { ok: true, expect: null });
  // Every intent and layer the router can answer is accepted, from its own lists.
  for (const intent of ASK_TOOL.input_schema.properties.intent.enum) assert.ok(readExpectRoute("intent=" + intent).ok, intent);
  for (const layer of EDIT_LAYERS) assert.ok(readExpectRoute("layer=" + layer).ok, layer);
  const refused = {
    "layer=dta": "layer",                      // a typo refuses before the routing call it could never match
    "intent=none": "intent",                   // an answer with no intent never reaches this check
    "layer=none": "layer",
    "page=gallery": "page",                    // a path, not a heading
    "rename=photos": "rename",
    "remove=yes": "remove",
    "tab=1": "tab",
    "alsoAsked=menu": "alsoAsked",             // only "nothing held back" can be asked for
    "colour=red": "colour",
    "layer=page layer=page": "layer",
    "layer page": "layer",
    "layer=": "layer=",
  };
  for (const [text, named] of Object.entries(refused)) {
    const r = readExpectRoute(text);
    assert.equal(r.ok, false, `"${text}" was accepted`);
    assert.ok(r.msg.includes(named), `"${text}" refused without naming ${named}: ${r.msg}`);
  }
  // A KEY THE ROUTER DOES NOT ANSWER IS REFUSED AS ONE, whatever its value — a
  // value that would pass a later check (a path, `none`) must not carry it through,
  // and the keys are the router's own spelling.
  for (const text of ["colour=/red", "colour=none", "Layer=page", "alsoasked=none", "held=none"]) {
    const r = readExpectRoute(text);
    assert.equal(r.ok, false, `"${text}" was accepted`);
    assert.match(r.msg, /is not a field the router answers/, `"${text}" was refused for another reason: ${r.msg}`);
  }
  // CANNOT-TELL IS A REFUSAL: a box that is not text is not read as one.
  assert.equal(readExpectRoute(["layer=page"]).ok, false);
  assert.equal(readExpectRoute(5).ok, false);
});

test("only the named fields are judged, and cannot-tell is a mismatch, never a value", () => {
  // A field the expectation does not name is not judged: B says nothing about a page.
  assert.equal(routeVerdict(expectOf(B), { intent: "edit", layer: "data", page: "/prices" }).ok, true);
  // A flag that is not a boolean, and a path that is not a string, are unreadable.
  const odd = routeVerdict(expectOf(A), { intent: "edit", layer: "page", page: ["/gallery"], remove: "true" });
  assert.equal(odd.ok, false);
  assert.deepEqual(odd.diffs.map((d) => [d.key, d.readable]), [["page", false], ["remove", false]]);
  assert.match(mismatchSaid(odd), /cannot be read as one/);
  // A body that is not an answer at all matches nothing it names.
  for (const body of [null, [], "edit", 7]) assert.equal(routeVerdict(expectOf(A), body).ok, false);
  // An absent flag is false, and an empty text is absent, the way the edit POST
  // reads them: `remove: rd.remove === true`, and an empty page or held-back part
  // is not posted at all.
  assert.equal(routeVerdict(expectOf("remove=false"), { intent: "edit", layer: "data" }).ok, true);
  assert.equal(routeVerdict(expectOf("page=none alsoAsked=none"), { page: "", alsoAsked: "" }).ok, true);
  assert.equal(routeVerdict(expectOf("alsoAsked=none"), { alsoAsked: " " }).ok, false, "a held-back part that is only a space still counts");
});

// NO ROUTER (2026-11-02, agent-only): the route's agent answer never passes an expectation.
test("CR-AO the route's agent answer (no router) is a mismatch for any expectation, said as such; a blank box is no check", () => {
  const v = routeVerdict({ layer: "page" }, { ok: true, intent: "edit", layer: "page", page: "/", agent: true });
  assert.equal(v.ok, false);
  assert.match(mismatchSaid(v), /router: expected a router's answer, the router answered none \(the site agent takes the whole message/);
  assert.equal(routeVerdict({ layer: "page" }, { ok: true, intent: "edit", layer: "page" }).ok, true, "the check is alive for a router answer");
  assert.equal(routeVerdict({}, { agent: true }).ok, true);
});
