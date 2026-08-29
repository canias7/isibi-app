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
import fs from "node:fs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { LANE_FIELDS, ACTING_LANES, laneLayer, laneUnbuilt } from "../builder/site-lanes.mjs";
// THE PAGE LAYER'S TOOL NAME, TAKEN FROM THE MODULE THAT DEFINES IT. Typed by
// hand it was wrong, the stub never matched, the call 503d, and the billing
// assertion below "failed" for a reason that had nothing to do with billing.
// A hand-typed constant is a second copy of a name, and two copies drift.
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";

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
function withWire(answers, run, { owned = true, usage = null, billed = null } = {}) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } });
    }
    // THE LEDGER, WHEN A TEST IS WATCHING IT. Left unstubbed this 503s,
    // `eCharge` swallows it and every reply reads `cost: 0` — so a bill can be
    // wrong by a whole call and no test here would see it. `billed` collects
    // what was actually asked for.
    if (billed && url.includes("/rpc/use_credits")) {
      let want = 0;
      try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      billed.push(want);
      return new Response(String(want), { status: 200, headers: { "content-type": "application/json" } });
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
        // SIZED BY THE TEST WHEN IT CARES. The default is deliberately tiny;
        // `pageCredits` has a floor of 1, so at this size one call and two
        // round to the same credit and a bill missing a whole call is
        // invisible. A test about billing has to spend enough to cross the
        // boundary — see the dispatched-bill case.
        usage: (usage && usage[tool]) || { input_tokens: 10, output_tokens: 5 },
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

test("a lane whose work lives on another layer DISPATCHES there — it is not refused", async () => {
  // Owner, 2026-08-29: "i need all the 17 lanes acting".
  //
  // `shape` was refused here: named, priced at zero, sent up the ladder. That
  // was honest about what this module edits and wrong about the customer, who
  // asked to move a section and got a fall-through — while the `page` layer,
  // which really does move sections with a minimal patch, had been shipping for
  // weeks one branch away. Nothing was missing but the wire.
  //
  // WHAT PROVES IT IS THE TOOL ON THE SECOND CALL. A dispatch that silently did
  // nothing and a dispatch that worked both answer "not an escalation" from
  // outside; the page layer asks for its OWN tool, so seeing that tool go out
  // is seeing the work begin.
  await withWire(
    { pick_lanes: { fields: ["shape"] }, [TWEAK_TOOL.name]: { source: "export default function Home(){return null}" } },
    async (calls) => {
      const { body } = await edit("wire-dispatch", "move the gallery above the prices");
      assert.notEqual(body && body.reason, "wrong-rung", "a dispatched lane is still being refused: " + JSON.stringify(body));
      assert.notEqual(body && body.reason, "unbuilt", "`shape` is being reported as not built, but the page layer does this");
      const tools = toolsOf(calls);
      assert.equal(tools[0], "pick_lanes", "the front door did not route first: " + JSON.stringify(tools));
      assert.ok(tools.length >= 2,
        "the shape lane was routed and then nothing ran — the dispatch reaches no layer: " + JSON.stringify(tools));
      // AND IT IS NOT THIS MODULE'S OWN TOOL. Repointing at a layer that then
      // falls through to the acting lane would look like success and edit the
      // wrong thing.
      assert.ok(!tools.includes("edit_site"), "a dispatched lane was answered by the css/brand editor: " + JSON.stringify(tools));
    },
  );
});

test("the router's call is billed on the layer it dispatched to", async () => {
  // FOUND BY A SURVIVING MUTANT, 2026-08-29, and it is the one that costs money.
  //
  // `pick_lanes` runs at the door, BEFORE the layer is chosen, so the layer that
  // ends up doing the work never sees that call — it prices `eCharge(out.usage,
  // pub)` and nothing else. On the acting lane the router's usage is also seeded
  // into `dUsage`, so dropping it from `eCharge` changes nothing there; on a
  // DISPATCHED layer it is the only thing carrying it, and the customer is
  // billed for the work but not for the routing.
  //
  // THE FLOOR OF 1 CREDIT IS WHY THIS NEEDS BIG NUMBERS. At the default stub
  // size one call and two both round to 1, so the missing call is invisible —
  // which is exactly why the mutant survived a suite that already had billing
  // tests. Each call here is sized to be worth more than a credit on its own.
  // ── WHY THIS ONE IS READ AND NOT DRIVEN, WHICH IS A CONCESSION ───────────
  //
  // Every other check in this file drives `worker.fetch`. This one cannot, and
  // the reason is worth stating rather than hiding: a bill is only observable
  // where a lane REACHES one, and every dispatched layer reaches its bill after
  // a publish (the container) or a schema read (a real Neon connection). A
  // routing test has neither, so each of them answers `cost: 0` on an
  // escalation long before `eCharge` is called.
  //
  // AND THE FLOOR HIDES IT EVEN THEN: `pageCredits` rounds up from 1, so at any
  // usage a stub produces, one call and two bill the same credit. That is
  // exactly why the mutant survived a suite that already had two billing tests.
  //
  // So the property is asserted at the one place it is decidable — that the
  // router's usage is in `eCharge`'s parts, which is what makes it reach a
  // dispatched layer at all. Anchored on `pickUsage` being IN the list rather
  // than on the list's exact spelling, and paired below with the fact that
  // nothing else could carry it.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8")
    .replace(/^\s*\/\/[^\n]*$/gm, (m) => " ".repeat(m.length));
  const at = src.indexOf("const eCharge = async (usage, ...more) => {");
  assert.ok(at > 0, "eCharge is gone or was renamed — this scan has no subject");
  const block = src.slice(at, src.indexOf("\n            };", at));
  assert.ok(block.length > 100, "the eCharge window closed immediately — rescope this");
  assert.match(block, /for \(const p of \[pickUsage,/,
    "the router's call is not in eCharge's parts, so a dispatched layer bills the work and not the routing");
  // AND NOTHING ELSE CARRIES IT THERE. `dUsage` seeds `pickUsage` too, which is
  // what keeps the ACTING lane's reported usage and its cost in step — but that
  // object exists only inside the look lane, so it cannot reach `nav`,
  // `picture`, `rules` or `page`. If that ever became the only carrier, this
  // check would still pass while every dispatched edit under-billed.
  assert.ok(!/dUsage/.test(block), "eCharge now depends on the look lane's own usage object, which no dispatched layer has");
});

test("a lane that is genuinely not built yet says WHICH job is missing", async () => {
  // THREE JOBS, THREE NAMES. `kind` is a rebuild by definition, `pages` is three
  // capabilities behind one field, `slug` is an address move. One word for all
  // three is the failure-that-cannot-name-itself shape this repo has recorded
  // seven times over — the last one cost two live runs.
  for (const field of ["kind", "pages", "slug"]) {
    await withWire(
      { pick_lanes: { fields: [field] }, edit_site: { css: "never{used:1}" } },
      async (calls) => {
        const { body } = await edit("wire-unbuilt-" + field, "change the " + field);
        assert.equal(body && body.reason, "unbuilt", field + " did not escalate as unbuilt: " + JSON.stringify(body));
        assert.equal(body && body.field, field, "the escalation does not name which lane is missing");
        assert.equal(body && body.needs, laneUnbuilt(field), "the escalation does not name the job that is missing");
        assert.equal(body && body.cost, 0, "a free escalation charged for something");
        assert.deepEqual(toolsOf(calls), ["pick_lanes"], "work was bought for a lane that cannot run");
      },
    );
  }
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
