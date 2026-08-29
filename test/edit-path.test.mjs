// THE EDIT PATH REALLY RUNS, AND THE BUILD PATH REALLY DOES NOT — on the wire.
//
// Owner, 2026-08-29: "it should be 2 separated path tho, idk why you are mixing
// the build with the edit path", and on what the edit path is: "customer says
// edit this, and booom you go edit it".
//
// `test/edit-lanes.test.mjs` asserts the MODULE: seventeen lanes, one property
// each, no build wording. That is the whole feature and it can still ship dead,
// which is this repo's most expensive recorded shape — twelve-plus features with
// the module perfectly correct and one hop cut, where "the model did not answer"
// and "we never sent it" are the same `undefined` from outside.
//
// So this drives `worker.fetch` at the real route and reads the REQUESTS that
// come off it. What is asserted is the chain, end to end:
//
//   the customer's sentence  →  pick_lanes (cheap model)
//                            →  edit_site, one property, carrying THE SITE'S
//                               OWN STORED VALUE and their words
//                            →  one publish, however many lanes ran
//
// and the negative that gives the split its meaning: `design_schema` never
// appears, so no edit can be answered by the site designer again.
//
// NOTHING HERE REACHES A MODEL OR SPENDS ANYTHING. Every outbound call is
// answered by a stub that reads which tool was asked for and replies in that
// tool's own shape.

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { LANE_FIELDS, ACTING_LANES, laneElsewhere } from "../builder/site-lanes.mjs";

const USER = { id: "u-editpath-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";

// DERIVED FROM THE REAL PRODUCERS: the source key and `CONFIG_KEY` are what
// `publishPages` and the config store actually write. A hand-typed key is a
// second copy of what a path looks like, and two copies drift silently.
const PAGES = [{ path: "src/routes/index.tsx", source: "export default function Home(){return null}" }];
const STORED_CSS = ":root{--background:oklch(100% 0 0)}\nfooter{background-color:#000}";
const STORED_LOOK = { brand: "Paperless", theme: "broadsheet", favicon: "<svg viewBox='0 0 32 32'></svg>" };

function bucket(slug) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(PAGES)],
    [CONFIG_KEY(slug), JSON.stringify({ look: { ...STORED_LOOK }, css: STORED_CSS })],
  ]);
  // EVERY WRITE, IN ORDER, because the final state is not the evidence. The
  // lane stores the change and only THEN publishes, and a failed publish rolls
  // the store back — so by the time a test can look, a correct edit and a
  // never-attempted one hold identical bytes. What the lanes actually merged is
  // visible in the write, and nowhere else.
  const writes = [];
  return {
    store, writes,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v }; },
    async put(k, v) { writes.push([k, String(v)]); store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

/**
 * Every model request this edit made, in order, with the tool it asked for.
 *
 * `answers` maps a tool name to what that tool should return. A tool asked for
 * with no answer here is REFUSED rather than given a plausible one: a stub more
 * capable than the real thing hides bugs exactly like one that is less, and this
 * file's whole job is to see which calls really happen.
 */
function withWire(answers, run, { owned = true } = {}) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_project")) {
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_backends")) {
      return new Response(JSON.stringify(owned ? [{ uid: USER.id, brief: "" }] : []),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/v1/messages")) {
      let body = {};
      try { body = JSON.parse(String(init && init.body) || "{}"); } catch { body = {}; }
      const tool = body.tool_choice?.name || "";
      calls.push({ tool, body });
      if (!Object.hasOwn(answers, tool)) {
        return new Response("no stub for tool " + tool, { status: 503 });
      }
      return new Response(JSON.stringify({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", name: tool, input: answers[tool] }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("unavailable", { status: 503 });
  };
  return (async () => {
    try { return await run(calls); } finally { globalThis.fetch = real; }
  })();
}

async function edit(slug, instruction, { store = null, layer = "look" } = {}) {
  const worker = await loadWorker();
  const req = new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: TOKEN },
    body: JSON.stringify({ layer, page: "", remove: false, rename: "", tab: false, instruction, picker: "sonnet" }),
  });
  const res = await worker.fetch(req, { SITES_BUCKET: store || bucket(slug), ANTHROPIC_API_KEY: "test-key" }, makeCtx());
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** The tools an edit asked for, in the order it asked. */
const toolsOf = (calls) => calls.map((c) => c.tool);

test("one ask: the router runs, then one lane, and nothing else", async () => {
  await withWire(
    { pick_lanes: { fields: ["css"] }, edit_site: { css: "footer{background-color:#0b3d2e}" } },
    async (calls) => {
      await edit("wire-one", "make the footer dark green");

      // THE CHAIN, IN ORDER. An empty list passes every `every()` written over
      // it, so the shape is asserted before anything is read out of it.
      assert.deepEqual(toolsOf(calls), ["pick_lanes", "edit_site"],
        "the edit path did not run router-then-lane: " + JSON.stringify(toolsOf(calls)));

      // THE BUILD PATH IS NOT ON THIS WIRE. This is the separation itself, and
      // it is the assertion that would have caught the old code instantly: the
      // look lane called `designSiteSchema`, so `design_schema` rode on every
      // colour change with all nineteen of its properties.
      for (const c of calls) {
        assert.notEqual(c.tool, "design_schema", "an edit was answered by the site designer");
        const names = (c.body.tools || []).map((t) => t.name);
        assert.ok(!names.includes("design_schema"), "the build tool is on the edit path's wire: " + names.join(","));
      }

      const [router, lane] = calls;
      // THE ROUTER IS THE CHEAP HALF, or the split costs more than it saves.
      assert.match(String(router.body.model), /haiku/i, "the lane router is not on the cheap model: " + router.body.model);
      // …AND IT OFFERS EVERY LANE, so a customer cannot ask about a part of
      // their site the router has no name for.
      const offered = router.body.tools[0].input_schema.properties.fields.items.enum;
      assert.deepEqual([...offered].sort(), [...LANE_FIELDS].sort(), "the router does not offer every lane");

      // THE ACTING CALL IS ONE PROPERTY — the wall, on the wire rather than in
      // the module. A lane that can reach a second field is one that can rename
      // a site while changing a colour.
      const props = Object.keys(lane.body.tools[0].input_schema.properties);
      assert.deepEqual(props, ["css"], "the acting lane carries more than its own field: " + props.join(","));
      assert.deepEqual(lane.body.tools[0].input_schema.required, [], "the acting lane requires an answer");

      // AND IT IS HANDED THE SITE'S OWN STYLESHEET AND THEIR OWN WORDS. This is
      // the hop that has been cut twelve times here: a value read, computed,
      // and never put on the wire. Asserted against the STORED bytes, so a lane
      // handed an empty string or a fresh design fails.
      const sent = JSON.stringify(lane.body.messages);
      assert.ok(sent.includes("footer{background-color:#000}"), "the css lane was not shown the site's stored stylesheet");
      assert.ok(sent.includes("make the footer dark green"), "the css lane was not shown what the customer asked for");
    },
  );
});

test("two asks: both lanes run in turn, and the site publishes once", async () => {
  // Owner's call, asked which way a two-part message should go: "run both lanes
  // in turn". Two acting calls, one reply, one publish.
  await withWire(
    { pick_lanes: { fields: ["brand", "css"] }, edit_site: { brand: "Northwind", css: "footer{color:#fff}" } },
    async (calls) => {
      const store = bucket("wire-two");
      const { body } = await edit("wire-two", "call us Northwind and make the footer text white", { store });

      assert.deepEqual(toolsOf(calls), ["pick_lanes", "edit_site", "edit_site"],
        "two asks did not run two lanes: " + JSON.stringify(toolsOf(calls)));

      // EACH LANE GETS ITS OWN FIELD AND ITS OWN STORED VALUE — never the
      // other's. Two lanes sharing one prompt is the whole confusion the split
      // removes, and from outside it looks identical to this.
      const acting = calls.filter((c) => c.tool === "edit_site");
      const fields = acting.map((c) => Object.keys(c.body.tools[0].input_schema.properties)[0]);
      assert.deepEqual(fields, ["css", "brand"],
        "the lanes did not each carry exactly one distinct field, in the caller's order: " + fields.join(","));
      const brandCall = acting[fields.indexOf("brand")];
      assert.ok(JSON.stringify(brandCall.body.messages).includes("Paperless"),
        "the brand lane was not shown the name the site currently has");
      assert.ok(!JSON.stringify(brandCall.body.messages).includes("--background"),
        "the brand lane was handed the stylesheet, which is not its field to see");

      // ONE PUBLISH FOR THE WHOLE MESSAGE, not one per lane. Two acting calls
      // and exactly one attempt at the container: a lane that published as it
      // went would leave two version entries and two archived builds for one
      // sentence, and the customer would watch their site change twice.
      //
      // COUNTED OFF THE REPLY, WHICH IS SINGULAR BY CONSTRUCTION — a second
      // publish would have to return a second response, and a route returns
      // one. What this really pins is that the loop above does not `return`
      // inside itself: `lanes` naming BOTH is only reachable from the single
      // exit below the loop.
      assert.deepEqual(body && body.lanes, ["css", "brand"], "the reply does not name the lanes that ran: " + JSON.stringify(body));

      // ── EACH ANSWER LANDS ON ITS OWN FIELD ────────────────────────────────
      //
      // FOUND BY A SURVIVING MUTANT, 2026-08-29. Filing every lane's answer
      // under `picked.fields[0]` is invisible on a one-lane edit — the only
      // field IS the first — and on two lanes it puts the new NAME into the
      // stylesheet and leaves the name unchanged. Everything above still
      // passes: the right calls go out carrying the right values, and the reply
      // still names both lanes. Only the merge is wrong, and only the write
      // shows it.
      const written = (store.writes.find(([k]) => k === CONFIG_KEY("wire-two")) || [])[1];
      assert.ok(written, "the lanes' answers were never stored at all");
      const saved = JSON.parse(written);
      assert.equal(saved.look.brand, "Northwind", "the brand lane's answer did not land on the brand");
      assert.equal(saved.css, "footer{color:#fff}", "the css lane's answer did not land on the stylesheet");
    },
  );
});

test("every call in the message is on one bill", async () => {
  // FOUND BY A SURVIVING MUTANT, 2026-08-29 — and it is the one that costs
  // money rather than correctness: dropping the acting lane's usage bills the
  // customer for the router alone. Nothing else in this file would notice,
  // because the site still changes and the reply still reads right.
  //
  // THE "ALREADY LOOKS LIKE THAT" REPLY IS THE OBSERVABLE ONE. It is the only
  // path here that returns `usage` without needing a container: hand back the
  // stylesheet unchanged and the lane answers `lookNote` rather than
  // publishing. Two calls went out, so two usages must be on the bill —
  // `eCharge` unwraps `langUsage` into `pageCredits`, which rounds once.
  await withWire(
    { pick_lanes: { fields: ["css"] }, edit_site: { css: STORED_CSS } },
    async (calls) => {
      const { body } = await edit("wire-bill", "make it exactly how it already is");
      assert.equal(calls.length, 2, "the run under test did not make two calls: " + JSON.stringify(toolsOf(calls)));
      assert.ok(body && body.lookNote, "this run did not reach the already-like-that reply: " + JSON.stringify(body));
      const parts = (body.usage && body.usage.langUsage) || [];
      assert.equal(parts.length, 2,
        "not every model call reached the bill — " + parts.length + " of 2: " + JSON.stringify(body.usage));
      // AND EACH PART CARRIES ITS OWN MODEL, or `pageCredits` prices the
      // acting call at the router's rate. Priced from one table, per part.
      for (const p of parts) assert.ok(p && p.model, "a billed part has no model to price it at: " + JSON.stringify(p));
      assert.ok(new Set(parts.map((p) => p.model)).size === 2,
        "both calls were billed at the same model — the router is haiku and the lane is not");
    },
  );
});

test("a part this rung cannot change is refused before a single call is bought", async () => {
  // A plan axis is an input to page GENERATION and nothing downstream of a
  // cheap edit reads one — the container is handed the pages, the theme and the
  // stylesheet, never the plan. Storing a new one changes nothing a visitor can
  // see while reporting success. `needsPages` is the same refusal one layer
  // down and arrives only AFTER a model call has been paid for.
  await withWire(
    { pick_lanes: { fields: ["shape"] }, edit_site: { css: "never{used:1}" } },
    async (calls) => {
      const { body } = await edit("wire-rung", "move the gallery above the prices");
      assert.equal(body && body.reason, "wrong-rung", "a plan-axis ask was not refused by name: " + JSON.stringify(body));
      assert.equal(body && body.cost, 0, "a free refusal charged for something");
      assert.deepEqual(toolsOf(calls), ["pick_lanes"], "an acting call was bought for a lane that cannot act");
      // AND IT SAYS WHICH RUNG CAN. A failure that cannot name itself is seven-
      // plus recorded instances here; the last one cost two live runs.
      assert.equal(body.rung, laneElsewhere("shape"), "the refusal does not name the rung that can do the work");
    },
  );
});

test("a router that names nothing escalates rather than guessing", async () => {
  await withWire(
    { pick_lanes: { fields: [] }, edit_site: { css: "never{used:1}" } },
    async (calls) => {
      const { body } = await edit("wire-none", "asdfgh");
      assert.equal(body && body.reason, "no-lane", "an unroutable message did not escalate by name: " + JSON.stringify(body));
      // NEVER A FALLBACK TO EVERYTHING. Answering "we could not tell" by running
      // all seventeen lanes is the most expensive possible reading of it.
      assert.deepEqual(toolsOf(calls), ["pick_lanes"], "lanes ran for a message the router could not place");
    },
  );
});

test("every acting lane can actually be reached through the route", async () => {
  // A LANE THAT EXISTS AND IS UNREACHABLE IS A DEAD FEATURE, and this repo's
  // record is that they ship silently: the module is right, one hop is cut, and
  // from outside it looks like the model declining. So each of the eight is
  // driven for real, through `worker.fetch`, rather than trusted because its
  // tool builds.
  assert.ok(ACTING_LANES.length >= 8, "fewer acting lanes than there were — this loop may be scanning almost nothing");
  for (const field of ACTING_LANES) {
    // A value of the field's own shape. `langs` is the one list among them.
    const value = field === "langs" ? ["cy"] : "x";
    await withWire(
      { pick_lanes: { fields: [field] }, edit_site: { [field]: value } },
      async (calls) => {
        await edit("wire-reach-" + field, "change the " + field);
        const acting = calls.filter((c) => c.tool === "edit_site");
        assert.equal(acting.length, 1, "the " + field + " lane was never called: " + JSON.stringify(toolsOf(calls)));
        assert.deepEqual(Object.keys(acting[0].body.tools[0].input_schema.properties), [field],
          "the " + field + " lane was called with somebody else's field");
      },
    );
  }
});
