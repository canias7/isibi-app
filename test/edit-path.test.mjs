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
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { LANE_FIELDS, OWN_LANES, UNBUILT_LANES, laneLayer, laneUnbuilt, laneEscalate } from "../builder/site-lanes.mjs";
// THE PAGE LAYER'S TOOL NAME, TAKEN FROM THE MODULE THAT DEFINES IT. Typed by
// hand it was wrong, the stub never matched, the call 503d, and the billing
// assertion below "failed" for a reason that had nothing to do with billing.
// A hand-typed constant is a second copy of a name, and two copies drift.
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { modelsFor, BUILD_MODELS } from "../builder/build-models.mjs";

const USER = { id: "u-editpath-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";

// DERIVED FROM THE REAL PRODUCERS: the source key and `CONFIG_KEY` are what
// `publishPages` and the config store actually write. A hand-typed key is a
// second copy of what a path looks like, and two copies drift silently.
const PAGES = [{ path: "src/routes/index.tsx", source: "export default function Home(){return null}" }];
const STORED_CSS = ":root{--background:oklch(100% 0 0)}\nfooter{background-color:#000}";
// WITH A STORED CODE, because the `qr` lane EDITS one the site has: a site
// without one sends "add a QR code" to the addon step (owner, 2026-09-02:
// "add will always go in addon"), and the reachability loop below drives the
// lane as an edit of what is stored. The wall's own case is further down.
const STORED_LOOK = { brand: "Paperless", theme: "broadsheet", favicon: "<svg viewBox='0 0 32 32'></svg>", qr: { points: "tel:+441144960123", label: "Scan to call" } };

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
  const res = await worker.fetch(req, { SITES_BUCKET: store || bucket(slug), ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key" }, makeCtx());
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
      // THE ROUTER AND THE LANE ARE ON THE SAME MODEL — the customer's picked one.
      //
      // Pinned to /haiku/i until run 93, when a billing refusal at that one
      // provider took down the router, every lane and the whole cheap ladder at
      // once while builds on Grok carried on. Owner's call: the picked model does
      // everything.
      //
      // COMPARED TO THE LANE, NOT TO `modelsFor().quick` — that is the DEFAULT
      // picker's model, and this fixture drives a different one, so asserting
      // against it would pass only while the two happened to agree. What matters
      // is that no call on this path is left behind on a model of its own, which
      // is exactly the state that caused the outage.
      assert.equal(String(router.body.model), String(lane.body.model),
        "the router and the lane are on different models — one of them is not following the picker: " +
        router.body.model + " vs " + lane.body.model);
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

      // ── THE MERGE DECIDES A KEY; A RUNG MAY NOT OVERWRITE IT ─────────────
      //
      // The merge copies through anything a rung reports that it does not
      // model itself, so a lane's own diagnostics are not silently lost. That
      // copy is guarded by `Object.hasOwn(merged, k)` — without it the LAST
      // rung's value wins over the merge's, so `cost` would become one step's
      // bill instead of the sum, and `layer` would name one rung instead of the
      // run. A sweep dropped that guard and nothing noticed.
      //
      // `renamed` IS THE OBSERVABLE ONE and needs no container: this rung
      // reports `renamed: 0`, the merge computes `0 || undefined`, and JSON
      // omits an undefined key. So the field's PRESENCE is exactly the bug.
      assert.ok(!Object.hasOwn(body, "renamed"),
        "a rung's own value overwrote one the merge had already decided — `renamed` came back as "
          + JSON.stringify(body.renamed));
      // ONE MODEL ACROSS BOTH CALLS, WHICH IS THE REVERSE OF WHAT THIS SAID.
      // It asserted TWO — the router on Haiku and the lane on the picker's — and
      // that split is precisely what run 93 died of: a billing refusal at the
      // router's provider took down every lane behind it while builds carried
      // on. What still matters is the thing the line above measures, that each
      // part carries a model at all; what changed is that they now agree.
      assert.equal(new Set(parts.map((p) => p.model)).size, 1,
        "the router and the lane were billed at different models — one is not following the picker: " +
        JSON.stringify(parts.map((p) => p.model)));
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
  // WINDOWED ON `billParts` (2026-08-29). The parts list moved out of `eCharge`
  // when the reply had to report the SAME list it bills: the look lane was
  // seeding `pickUsage` into its own `usage` while `eCharge` prepended it too,
  // so the router's call was billed twice on every look edit. One list now, two
  // readers — the charge and the reply — which is what makes them agree by
  // construction rather than by both being written correctly.
  const at = src.indexOf("const billParts = (usage, ...more) => {");
  assert.ok(at > 0, "billParts is gone or was renamed — this scan has no subject");
  const block = src.slice(at, src.indexOf("\n            };", at));
  assert.ok(block.length > 100, "the billParts window closed immediately — rescope this");
  assert.match(block, /for \(const p of \[pickUsage,/,
    "the router's call is not in the billed parts, so a dispatched layer bills the work and not the routing");
  // AND IT IS ADDED EXACTLY ONCE. Seeding it into a lane's own usage as well
  // double-charged every look edit — the shape a sweep found and no test did,
  // because each place looked right on its own.
  assert.equal((src.match(/pickUsage \? \[pickUsage\]/g) || []).length, 0,
    "a lane seeds the router's usage into its own list as well, so it is billed twice");
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
  // ONLY `slug` NOW (2026-08-29). `kind` escalates to the BUILD rung — a
  // rebuild is what it is, and the capability exists — and `pages` acts through
  // its three verbs. Both are covered by their own cases; leaving them in this
  // loop would assert they are still missing, which is the guard going red for
  // the change rather than for a bug.
  for (const field of UNBUILT_LANES) {
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
  assert.ok(OWN_LANES.length >= 8, "fewer acting lanes than there were — this loop may be scanning almost nothing");
  for (const field of OWN_LANES) {
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

test("a stylesheet ask BESIDE a dispatched ask — both run, neither is dropped", async () => {
  // Owner, 2026-08-29: "if a customer wants CSS to be changed and also wants
  // another of the seventeen one being changed, it could do it too… it could do
  // two steps at the same time, or three or four, depending on how many the user
  // wants."
  //
  // THE BUG THIS REPLACES. The front door took the FIRST dispatched lane and
  // repointed the whole route at it:
  //
  //     const send = pickedFields.map(laneLayer).find(Boolean);
  //     if (send) eLayer = send;
  //
  // So "darker footer and swap the shop photo" ran the photo and the STYLESHEET
  // ASK VANISHED — silently, with the customer told the change was made. Doing
  // less than they asked and reporting success is worse than publishing twice,
  // which was the cost the old shape was avoiding.
  await withWire(
    {
      pick_lanes: { fields: ["css", "images"] },
      edit_site: { css: "footer{background-color:#0b3d2e}" },
      pick_picture: { alt: "the shop front", action: "reframe", focus: "center" },
    },
    async (calls) => {
      const { body } = await edit("wire-both", "darker footer and show more of the shop photo");
      const tools = toolsOf(calls);

      // BOTH RUNGS RAN. The router first, then the stylesheet editor, then
      // whatever the picture rung asks for — asserted as "the acting call
      // happened AND something after it did", because the picture rung's own
      // tool is its business and not this test's.
      assert.equal(tools[0], "pick_lanes", "the front door did not route first: " + JSON.stringify(tools));
      assert.ok(tools.includes("edit_site"),
        "the stylesheet ask was DROPPED when a dispatched lane was named alongside it: " + JSON.stringify(tools));
      // THE SECOND RUNG RAN TOO — but not every rung makes a model call (the
      // picture rung matches on alt text and can answer without one), so the
      // evidence is the REPLY, not the call count. Asserting `tools.length >= 3`
      // measured a rung's implementation rather than whether it was reached.
      assert.ok(Array.isArray(body && body.lanes) && body.lanes.includes("images"),
        "the photograph ask was never attempted — only the stylesheet ran: " + JSON.stringify(body));

      // AND THE REPLY SAYS BOTH. A customer who asked for two things and is
      // told about one cannot tell whether the other was done, refused, or
      // never understood — which is the same as it having been dropped.
      assert.ok(Array.isArray(body && body.lanes), "the reply names no lanes at all: " + JSON.stringify(body));
      assert.ok(body.lanes.includes("css"), "the reply does not report the stylesheet lane: " + JSON.stringify(body.lanes));
      assert.ok(body.lanes.includes("images"), "the reply does not report the photograph lane: " + JSON.stringify(body.lanes));
    },
  );
});

test("a DISPATCHED ask does not sink the ask that runs here", async () => {
  // ── REWRITTEN 2026-08-29, BECAUSE ITS PREMISE WENT AWAY ───────────────────
  //
  // This drove `["css", "slug"]` when `slug` was the one unbuilt lane, and
  // asserted the reply named it in `notBuilt`. `slug` is a real rename now and
  // NOTHING is unbuilt, so the old assertion could only ever fail — and a test
  // kept alive by relaxing it would be asserting a state the platform can no
  // longer reach.
  //
  // WHAT SURVIVES IS THE PROPERTY IT WAS ACTUALLY FOR: a message naming two
  // lanes must not let one of them swallow the other. That was the dropped-ask
  // failure then and it is the same failure now — only the second lane has been
  // promoted from "cannot" to "elsewhere", which is a stronger version of the
  // same shape, because a dispatched lane really does move the request onto
  // another rung.
  await withWire(
    { pick_lanes: { fields: ["css", "slug"] }, edit_site: { css: "footer{color:#fff}" } },
    async (calls) => {
      const { body } = await edit("wire-mixed", "darker footer, and move us to a new address");
      assert.notEqual(body && body.reason, "unbuilt",
        "a dispatched lane escalated the whole message as unbuilt: " + JSON.stringify(body));
      assert.ok(toolsOf(calls).includes("edit_site"), "the stylesheet ask never ran: " + JSON.stringify(toolsOf(calls)));
      // AND BOTH LANES ARE STILL NAMED IN THE REPLY. Whatever became of the
      // second ask, silence about it is indistinguishable from not having
      // understood it — which is the half this test has always been about.
      assert.ok(Array.isArray(body && body.lanes) && body.lanes.includes("slug"),
        "the reply does not name the second ask at all: " + JSON.stringify(body));
      assert.ok(body.lanes.includes("css"), "the reply lost the ask that ran here: " + JSON.stringify(body));
    },
  );
});

/* ── ONE ACT, ONE PUBLISH ────────────────────────────────────────────────── */

test("two asks in one message compile and publish ONCE", async () => {
  // Owner, 2026-08-29: "for the publish is per act — if the act was 2 things
  // then 1 publish; if the act was 2 things but one thing first then the other,
  // then is 2 publish". One message is one act.
  //
  // Every rung ends by calling the publish path, and several rungs run for one
  // message now — so a two-part ask compiled twice, wrote two version entries,
  // archived two builds, and the customer watched their site change twice for
  // one sentence.
  //
  // THIS NEEDS A PUBLISH THAT SUCCEEDS, which is why the container fixture grew
  // an opt-in compiler. Counting compiles is the only way to see the difference:
  // one publish and two publishes both end with the site correct, and only the
  // build history says which happened.
  const c = installCompiler();
  try {
    await withWire(
      { pick_lanes: { fields: ["brand", "css"] }, edit_site: { brand: "Northwind", css: "footer{color:#fff}" } },
      async (calls) => {
        const { body } = await edit("pub-one", "call us Northwind and make the footer text white");
        assert.equal(body && body.ok, true, "the message did not go through: " + JSON.stringify(body));
        // TWO ACTING CALLS, ONE COMPILE. The lanes really did both run — without
        // that this would pass by doing half the work once.
        assert.equal(calls.filter((x) => x.tool === "edit_site").length, 2,
          "both lanes did not run: " + JSON.stringify(toolsOf(calls)));
        assert.equal(c.calls.length, 1,
          "one message compiled " + c.calls.length + " times — the act published more than once");
        assert.deepEqual([...body.lanes].sort(), ["brand", "css"], "the reply does not name both lanes: " + JSON.stringify(body.lanes));
      },
    );
  } finally { c.uninstall(); }
});

test("a stylesheet ask and a photo ask — two rungs, still ONE publish", async () => {
  // The harder half: two DIFFERENT rungs, not two lanes on one rung. Each rung
  // has its own publish call, so this is where "one publish per act" is really
  // decided.
  const c = installCompiler();
  try {
    await withWire(
      { pick_lanes: { fields: ["css", "images"] }, edit_site: { css: "footer{color:#0b3d2e}" } },
      async () => {
        await edit("pub-two", "darker footer and show more of the shop photo");
        assert.ok(c.calls.length <= 1,
          "two rungs compiled " + c.calls.length + " times for one message — the act published more than once");
      },
    );
  } finally { c.uninstall(); }
});

test("the second rung sees what the first one wrote", async () => {
  // ONE PUBLISH IS ONLY CORRECT IF THE SOURCE CARRIES FORWARD. Each rung
  // computes its pages from the stored source; if the second starts from the
  // ORIGINAL rather than from what the first produced, the single publish ships
  // whichever step happened to run last and the other is silently lost — which
  // is the dropped-ask bug again, arriving through the fix for it.
  const c = installCompiler();
  try {
    await withWire(
      { pick_lanes: { fields: ["brand"] }, edit_site: { brand: "Northwind" } },
      async () => {
        await edit("pub-carry", "call us Northwind");
        assert.equal(c.calls.length, 1, "expected exactly one compile");
        const sent = c.calls[0].body || {};
        // FILES ARE A PATH->SOURCE MAP, which is what the spine really sends.
        assert.ok(sent.files && Object.keys(sent.files).length,
          "the compile was handed no files at all: " + JSON.stringify(sent).slice(0, 200));
        // AND THE RUNG'S CHANGE IS IN IT. The brand lane stored "Northwind"
        // before handing its pages over; the single publish must carry that
        // rather than the name the site had when the message arrived — which is
        // exactly what breaks if the deferred publish keeps the original state.
        assert.equal(sent.title, "Northwind",
          "the one publish did not carry the rung's change: title was " + JSON.stringify(sent.title));
      },
    );
  } finally { c.uninstall(); }
});

test("the billing is per MESSAGE, not per rung — measured against the ledger", async () => {
  // The survivor a sweep found and nothing watched: `pick_lanes` runs before any
  // layer is chosen and every rung folds it into its own bill, so a two-lane
  // message charged for the routing call twice. Watched here against what was
  // actually asked of the ledger, because a reply's `cost` is our own arithmetic
  // and this is the number the customer's balance moves by.
  const c = installCompiler();
  const billed = [];
  try {
    await withWire(
      { pick_lanes: { fields: ["brand", "css"] }, edit_site: { brand: "Northwind", css: "footer{color:#fff}" } },
      async () => {
        const { body } = await edit("pub-bill", "call us Northwind and make the footer white");
        assert.equal(body && body.ok, true, "the message did not go through: " + JSON.stringify(body));
        // ONE CHARGE FOR ONE MESSAGE. Several would mean several roundings, and
        // `pageCredits` has a floor of 1 — so two charges is two credits for a
        // message that costs one.
        assert.equal(billed.length, 1,
          "one message hit the ledger " + billed.length + " times: " + JSON.stringify(billed));
        // AND THE ROUTING CALL IS IN IT EXACTLY ONCE. Three parts on the bill —
        // the router plus the two lanes — not four.
        const parts = (body.usage && body.usage.langUsage) || [];
        assert.equal(parts.length, 3,
          "the bill carries " + parts.length + " calls; expected the router plus two lanes: " + JSON.stringify(parts));
        // THE MODEL CAN NO LONGER TELL THE ROUTER FROM A LANE, and that is the
        // point rather than a loss. This filtered for `claude-haiku-4-5` and
        // worked only because the router was on a DIFFERENT provider from the
        // lanes — the exact split that took the cheap ladder down on run 93 when
        // that provider refused on billing. Everything on this path follows the
        // customer's picker now, so the count above is what catches a
        // double-counted router: three parts, not four.
        //
        // What replaces it is the invariant the change exists for — no call on
        // this path is left behind on a model of its own.
        assert.equal(new Set(parts.map((p) => p.model)).size, 1,
          "the bill spans more than one model, so some call is not following the picker: " + JSON.stringify(parts));
        // A MODEL THE TABLE REALLY OFFERS, not a hardcoded name and not the
        // DEFAULT picker's — this fixture drives a different picker, so pinning
        // `modelsFor().quick` would pass only while the two happened to agree.
        // (I wrote it that way first and this assertion caught it.)
        const quicks = Object.keys(BUILD_MODELS).map((k) => modelsFor(k).quick);
        assert.ok(quicks.includes(parts[0].model),
          "the bill is on a model no picker resolves to: " + parts[0].model + " not in " + JSON.stringify(quicks));
      },
      { billed },
    );
  } finally { c.uninstall(); }
});

test("`kind` escalates to the rung that rebuilds — it is not reported as missing", async () => {
  // A rebuild is what `kind` IS: shopfront and tool are different sites, every
  // planning answer follows from the choice, and the capability exists one rung
  // up. Reporting it as "not built" was wrong twice — the work exists, and an
  // escalation is how the ladder reaches it.
  await withWire(
    { pick_lanes: { fields: ["kind"] }, edit_site: { css: "never{used:1}" } },
    async (calls) => {
      const { body } = await edit("wire-kind", "this should be a working tool, not a shopfront");
      assert.equal(body && body.reason, laneEscalate("kind"),
        "`kind` does not escalate to the rung that rebuilds: " + JSON.stringify(body));
      assert.notEqual(body && body.reason, "unbuilt", "`kind` is still reported as missing, but the build rung does this");
      assert.equal(body && body.cost, 0, "a free escalation charged for something");
      assert.deepEqual(toolsOf(calls), ["pick_lanes"], "work was bought for a lane that escalates");
    },
  );
});

test("a code or a scene the site does not have is the addon step's, by the addon's own layer; one it has is edited here", async () => {
  // Owner, 2026-09-02: "add will always go in addon". Driven through the
  // route with the picker naming the field, twice: once against a stored
  // look WITHOUT the field, once with it. The wall sits at the picker, so it
  // must fire for the dispatched `three` as well as the acting `qr`.
  for (const field of ["qr", "three"]) {
    const slug = "wire-add-" + field;
    const bare = bucket(slug);
    const look = { ...STORED_LOOK }; delete look[field];
    bare.store.set(CONFIG_KEY(slug), JSON.stringify({ look, css: STORED_CSS }));
    await withWire(
      { pick_lanes: { fields: [field] }, edit_site: { [field]: "never used" } },
      async (calls) => {
        const { body } = await edit(slug, "add a " + field + " to the page", { store: bare });
        assert.equal(body && body.escalate, true, field + " on a site without one did not escalate: " + JSON.stringify(body));
        assert.equal(body && body.reason, "addon", field + " did not escalate to the addon step: " + JSON.stringify(body));
        assert.equal(body && body.layer, "addon", field + " did not name the addon's own layer, so the client would fall to the revise");
        assert.equal(body && body.field, field, "the escalate does not say which field it refused to create");
        assert.equal(body && body.cost, 0, "a free escalation charged for something");
        assert.deepEqual(toolsOf(calls), ["pick_lanes"], "work was bought for an ask the addon step owns");
      },
    );
  }
  // WITH THE CODE STORED, the same ask about `qr` is an edit and the lane runs
  // (the reachability loop above drives every acting lane the same way).
  await withWire(
    { pick_lanes: { fields: ["qr"] }, edit_site: { qr: { points: "tel:+441144960123", label: "Scan to ring" } } },
    async (calls) => {
      const { body } = await edit("wire-edit-qr", "change the QR caption to Scan to ring");
      assert.notEqual(body && body.reason, "addon", "a code the site has was sent to the addon step: " + JSON.stringify(body));
      assert.ok(toolsOf(calls).includes("edit_site"), "the qr lane did not run on a site that has a code: " + JSON.stringify(toolsOf(calls)));
    },
  );
});

test("`pages` acts — remove and move reach the page rung, add reaches addon", async () => {
  // Three capabilities behind one field, each already built and each on a
  // different rung. What was missing was a second word saying WHICH, so the lane
  // escalated under one name for three different jobs.
  const cases = [
    { verb: "remove", input: { pageVerb: "remove", pageName: "/" }, expect: "ran" },
    { verb: "move", input: { pageVerb: "move", pageName: "/", pageTo: "/home" }, expect: "ran" },
    { verb: "add", input: { pageVerb: "add", pageName: "/blog" }, expect: "addon" },
  ];
  for (const c of cases) {
    await withWire(
      { pick_lanes: { fields: ["pages"], ...c.input }, [TWEAK_TOOL.name]: { source: "export default function Home(){return null}" } },
      async (calls) => {
        const { body } = await edit("wire-pages-" + c.verb, c.verb + " that page");
        assert.notEqual(body && body.reason, "unbuilt", "`pages` " + c.verb + " is still reported as missing");
        assert.notEqual(body && body.reason, "page-verb", "the verb was read back as unreadable: " + JSON.stringify(body));
        if (c.expect === "addon") {
          // ADDING IS THE ADDON ROUTE, which this route cannot run — it
          // publishes a site that exists rather than adding to it. Named, so
          // the ladder climbs to the rung that really does it.
          assert.equal(body && body.reason, "addon", "adding a page does not reach the addon rung: " + JSON.stringify(body));
          assert.deepEqual(toolsOf(calls), ["pick_lanes"], "work was bought before escalating to addon");
        } else {
          assert.notEqual(body && body.reason, "addon", c.verb + " was sent to the addon rung");
        }
      },
    );
  }
});

test("a `pages` ask with no readable verb refuses rather than guessing", async () => {
  // THE ONE PLACE THE BIAS INVERTS. Everywhere else in the edit path an unclear
  // answer resolves to work, because a wrong action costs a change the customer
  // can see and undo. Here a wrong guess can take a page off their site.
  await withWire(
    { pick_lanes: { fields: ["pages"] }, [TWEAK_TOOL.name]: { source: "x" } },
    async (calls) => {
      const { body } = await edit("wire-pages-noverb", "do something about the pages");
      assert.equal(body && body.reason, "page-verb", "a verbless `pages` ask was given a verb: " + JSON.stringify(body));
      assert.deepEqual(toolsOf(calls), ["pick_lanes"], "work was bought for an ask nobody could read");
    },
  );
});

/* ── THE VERB TAKES EFFECT, not merely routes ────────────────────────────── */

/** A two-page site: the home page cannot be removed or moved, by design. */
function twoPageBucket(slug) {
  const pages = [
    { path: "src/routes/index.tsx", source: "export default function Home(){return null}" },
    { path: "src/routes/gallery.tsx", source: "export default function Gallery(){return null}" },
  ];
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(pages)],
    [CONFIG_KEY(slug), JSON.stringify({ look: { ...STORED_LOOK }, css: STORED_CSS })],
  ]);
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

test("`pages` remove really deletes the page — not just routes to the rung", async () => {
  // A SWEEP FOUND THIS ONE. Cutting `if (pv.verb === "remove") eRemove = true;`
  // survived the whole suite: every guard checked that the ask ROUTED to the
  // page rung and none checked that the page went. That is a guard watching the
  // layer below the break — the plumbing asserted, the connection not.
  //
  // WHAT THE CUSTOMER ASKED FOR IS THE ASSERTION: the page is gone from what
  // gets published. Read off the ONE compile, which is the last thing that
  // happens and the only place the answer really exists.
  const c = installCompiler();
  try {
    await withWire(
      { pick_lanes: { fields: ["pages"], pageVerb: "remove", pageName: "/gallery" } },
      async (calls) => {
        const { body } = await edit("verb-remove", "delete the gallery page", { store: twoPageBucket("verb-remove") });
        assert.equal(body && body.ok, true, "the removal did not go through: " + JSON.stringify(body));
        assert.equal(c.calls.length, 1, "expected exactly one compile, got " + c.calls.length);
        const files = Object.keys((c.calls[0].body && c.calls[0].body.files) || {});
        assert.ok(files.length, "the compile was handed no files at all");
        assert.ok(!files.some((f) => /gallery/.test(f)),
          "the gallery page was still published — the removal routed but never happened: " + JSON.stringify(files));
        assert.ok(files.some((f) => /index/.test(f)), "the home page went too — the removal took more than it was asked for");
        // AND IT COSTS NOTHING. A deletion needs no page generation at all,
        // which is the whole reason it belongs on this rung.
        assert.equal(toolsOf(calls).filter((t) => t === TWEAK_TOOL.name).length, 0,
          "a deletion bought a page-generation call: " + JSON.stringify(toolsOf(calls)));
      },
    );
  } finally { c.uninstall(); }
});

test("`pages` move really changes the address", async () => {
  // The mirror of the case above, and it survived the same sweep for the same
  // reason: `eRename` was set and nothing asserted the page had actually moved.
  const c = installCompiler();
  try {
    await withWire(
      { pick_lanes: { fields: ["pages"], pageVerb: "move", pageName: "/gallery", pageTo: "/work" } },
      async () => {
        const { body } = await edit("verb-move", "move the gallery to /work", { store: twoPageBucket("verb-move") });
        assert.equal(body && body.ok, true, "the move did not go through: " + JSON.stringify(body));
        assert.equal(c.calls.length, 1, "expected exactly one compile, got " + c.calls.length);
        const files = Object.keys((c.calls[0].body && c.calls[0].body.files) || {});
        assert.ok(files.some((f) => /work/.test(f)),
          "nothing was published at the new address — the move routed but never happened: " + JSON.stringify(files));
        assert.ok(!files.some((f) => /gallery/.test(f)),
          "the page is published at BOTH addresses — a move left the old one behind: " + JSON.stringify(files));
      },
    );
  } finally { c.uninstall(); }
});

test("a verb aimed at a page the site does not have is refused, not honoured", async () => {
  // ALSO FOUND BY A SWEEP. Cutting the check against the real route list
  // survived: nothing asked what happens when the router names a page nobody
  // has. It is not a hypothetical — the router reads a customer's sentence, and
  // "delete the old pricing page" on a site with no pricing page is an ordinary
  // Tuesday.
  //
  // WHY IT MATTERS MOST FOR `remove`: unchecked, the verb reaches the page rung
  // with a target it cannot find. The rung answers "nothing to change" and the
  // customer is told their deletion happened — the report-success-having-done-
  // nothing failure, on the one verb where the customer will not go back and
  // check.
  //
  // AND IT IS AN ADDON, correctly identified without asking a model twice: a
  // page that does not exist cannot be edited, and the rung above can make one.
  const c = installCompiler();
  try {
    for (const verb of ["remove", "move"]) {
      await withWire(
        { pick_lanes: { fields: ["pages"], pageVerb: verb, pageName: "/nope", pageTo: "/work" } },
        async (calls) => {
          const { body } = await edit("verb-ghost-" + verb, verb + " the pricing page", { store: twoPageBucket("verb-ghost-" + verb) });
          assert.equal(body && body.reason, "no-page",
            "a " + verb + " aimed at a page the site does not have was not refused: " + JSON.stringify(body));
          assert.equal(body && body.page, "/nope", "the refusal does not name the page it could not find");
          assert.equal(body && body.cost, 0, "a free refusal charged for something");
          assert.deepEqual(toolsOf(calls), ["pick_lanes"], "work was bought for a page nobody has");
          // AND NOTHING WAS PUBLISHED. A refusal that still compiles has already
          // touched the site, whatever it says.
          assert.equal(c.calls.length, 0, "a refused verb still published: " + c.calls.length + " compiles");
        },
      );
    }
  } finally { c.uninstall(); }
});

// ── A RULE THAT SELECTS NOTHING DOES NOT PUBLISH (2026-08-31, owner's call) ──
//
// "If an intended selector matches zero elements, do not publish yet. Give the
// model the actual landmark map and ask it to correct the selector."
//
// DRIVEN, AND THE SWEEP IS WHY. The first version of these guards read
// worker.js for the gate's own text and asserted it sat above the publish call.
// A sweep replacing the condition with `if (false)` SURVIVED all of it — the
// text is still there, in the right order, doing nothing. Four separate
// mutations survived that way. Source order is not behaviour.
//
// So the container fixture answers with a real `render` report and these count
// what actually happened: how many builds ran, whether the site was published,
// and whether the model was asked again with the map in front of it.

const DEAD_RENDER = {
  ok: true, checked: 2, pages: 1, findings: [],
  deadSelectors: ["header button"],
  selectorsLooked: 2,
  landmarks: [
    { name: "header-button", selector: '[data-slot="site-link"]', tag: "a", section: "header",
      role: "button", text: "Get your first lesson free", route: "/" },
  ],
};

test("a dead selector withholds the publish and buys exactly one correction", async () => {
  // DEAD ON THE FIRST BUILD, CLEAN ON THE SECOND — which is the whole shape of
  // the feature. A static report would make "it published after the fix"
  // indistinguishable from "it never checked again".
  const c = installCompiler({ render: (n) => (n === 1 ? DEAD_RENDER : { ok: true, checked: 2, pages: 1, findings: [] }) });
  try {
    await withWire(
      { pick_lanes: { fields: ["css"] }, edit_site: { css: "header button{background-color:#014421}" } },
      async (calls) => {
        const { body } = await edit("dead-1", "make the button in the header forest green");
        // TWO BUILDS: the one that found the dead rule, and the one after the
        // correction. One build means the gate never fired; three means the
        // round is not bounded and a stubborn model loops on the customer.
        assert.equal(c.calls.length, 2,
          "expected exactly two builds (find, then re-check) — got " + c.calls.length);
        // AND THE MODEL WAS ASKED AGAIN, with the dead selector named and the
        // map in front of it. Without this the second build is just a retry of
        // the same answer.
        const laneCalls = calls.filter((x) => x.tool === "edit_site");
        assert.equal(laneCalls.length, 2,
          "the css lane ran " + laneCalls.length + " times — no correction was asked for");
        const retry = JSON.stringify(laneCalls[1]);
        assert.match(retry, /DID NOT REACH THE PAGE/, "the correction round does not tell the model what failed");
        assert.match(retry, /header button/, "the correction round does not name the dead selector");
        assert.ok(retry.includes('[data-slot=\\"site-link\\"]') || retry.includes('[data-slot="site-link"]'),
          "the correction round does not hand over the landmark map: " + retry.slice(0, 300));
        // AND IT SHIPPED IN THE END. Refusing outright would throw away every
        // other lane's work in the same message to punish one selector.
        assert.equal(body && body.ok, true, "the corrected edit never published: " + JSON.stringify(body));
      },
    );
  } finally { c.uninstall(); }
});

test("…and a clean build is never asked to correct anything", async () => {
  // THE CONTROL, and without it every assertion above is satisfied by a gate
  // that fires on every edit — which would double the cost of the whole cheap
  // ladder and buy a second model call per colour change.
  const c = installCompiler({ render: { ok: true, checked: 2, pages: 1, findings: [] } });
  try {
    await withWire(
      { pick_lanes: { fields: ["css"] }, edit_site: { css: '[data-slot="site-link"]{background-color:#014421}' } },
      async (calls) => {
        const { body } = await edit("dead-2", "make the button in the header forest green");
        assert.equal(body && body.ok, true, "a clean edit did not publish: " + JSON.stringify(body));
        assert.equal(c.calls.length, 1, "a clean edit compiled " + c.calls.length + " times");
        assert.equal(calls.filter((x) => x.tool === "edit_site").length, 1,
          "a clean edit was sent back to the model for a correction it did not need");
      },
    );
  } finally { c.uninstall(); }
});

test("verification is asked for on a stylesheet edit and NOT on a text one", async () => {
  // THE GATE IS OPT-IN, and the bound matters both ways: unasked, a dead rule
  // ships silently; asked on every rung, a typo fix buys a second build to check
  // a stylesheet nobody touched.
  //
  // READ OFF THE BUILD COUNT rather than off an internal flag: with a dead
  // report standing, a rung that ASKED sees it and builds twice, and a rung that
  // did not builds once. That is the flag's only observable consequence, which
  // is what makes this a behaviour test rather than a restatement.
  const c = installCompiler({ render: (n) => (n === 1 ? DEAD_RENDER : { ok: true, checked: 2, pages: 1, findings: [] }) });
  try {
    await withWire(
      { pick_lanes: { fields: ["brand"] }, edit_site: { brand: "Northwind" } },
      async () => {
        const { body } = await edit("dead-3", "call us Northwind from now on");
        // THE OUTCOME FIRST. Counting builds alone is satisfied by a CRASH —
        // one build, then a throw — which is exactly what a sweep making the
        // gate unconditional produced: `cssCtx` is null on a brand edit and the
        // correction round dereferenced it. The build count said "1" and the
        // guard passed on code that 500s.
        assert.equal(body && body.ok, true,
          "a brand edit did not go through: " + JSON.stringify(body));
        assert.equal(c.calls.length, 1,
          "an edit that wrote no stylesheet still verified selectors and built " + c.calls.length + " times");
      },
    );
  } finally { c.uninstall(); }
});

test("the landmark map is STORED after a publish, or the next edit is blind again", async () => {
  // THE HOP THE SWEEP FOUND UNGUARDED. Deleting `saveLandmarks` entirely
  // survived the whole suite: the map was captured, carried, and dropped on the
  // floor — the wiring trap, in the change written to close a wiring trap.
  const c = installCompiler({ render: { ok: true, checked: 2, pages: 1, findings: [], landmarks: DEAD_RENDER.landmarks } });
  try {
    await withWire(
      { pick_lanes: { fields: ["css"] }, edit_site: { css: '[data-slot="site-link"]{color:#014421}' } },
      async () => {
        // OUR OWN BUCKET, so the writes are inspectable. `withWire` yields the
        // model calls; the store is made inside `edit` unless one is passed.
        const b = bucket("marks-store");
        const { body } = await edit("marks-store", "make the header button green", { store: b });
        const store = b.store;
        assert.equal(body && body.ok, true, "the edit did not publish: " + JSON.stringify(body));
        const key = [...store.keys()].find((k) => k.endsWith("/landmarks.json"));
        assert.ok(key, "no landmark map was stored — the next edit on this site aims blind: "
          + JSON.stringify([...store.keys()].slice(0, 8)));
        const saved = JSON.parse(store.get(key));
        assert.equal(saved.marks[0].selector, '[data-slot="site-link"]',
          "the stored map lost the selector, which is the only column that has to be right");
      },
    );
  } finally { c.uninstall(); }
});
