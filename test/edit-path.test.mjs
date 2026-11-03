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
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { LANE_FIELDS, OWN_LANES, UNBUILT_LANES, laneLayer, laneUnbuilt, laneEscalate } from "../builder/site-lanes.mjs";
import { QUESTION_FIELD } from "../builder/clarify.mjs";
// THE PAGE LAYER'S TOOL NAME, TAKEN FROM THE MODULE THAT DEFINES IT. Typed by
// hand it was wrong, the stub never matched, the call 503d, and the billing
// assertion below "failed" for a reason that had nothing to do with billing.
// A hand-typed constant is a second copy of a name, and two copies drift.
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { modelsFor, BUILD_MODELS } from "../builder/build-models.mjs";
// THE TRANSLATION'S OWN TOOL AND READER, for the bilingual case: the stub
// answers by tool name and the answer has to be exactly as long as what the
// spine asks about, so both come from the module that defines them.
import { collectStrings, TRANSLATE_TOOL, missingFrom } from "../builder/site-translate.mjs";

const USER = { id: "u-editpath-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";

// DERIVED FROM THE REAL PRODUCERS: the source key and `CONFIG_KEY` are what
// `publishPages` and the config store actually write. A hand-typed key is a
// second copy of what a path looks like, and two copies drift silently.
const PAGES = [{ path: "src/routes/index.tsx", source: "export default function Home(){return null}" }];
// A PAGE WITH WORDS ON IT, for the bilingual case: the spine translates what
// `collectStrings` finds, and a page that says nothing asks for nothing.
const BILINGUAL_PAGES = [{ path: "src/routes/index.tsx", source: "export default function Home(){return <main><h1>Fresh bread every morning</h1><p>Baked before six, gone by ten.</p></main>}" }];
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
    // THE LEDGER ANSWERS, ALWAYS. This was stubbed only when a test was
    // watching it (`billed`), and a silent ledger 503'd: `eCharge` swallowed
    // that and every reply read `cost: 0`, so a bill could be wrong by a whole
    // call and no test here would see it. Since 2026-09-05 (stage 1a-iii) a
    // ledger that does not answer is a REFUSAL and the publish stops — the
    // right answer to a dead ledger, and the wrong fixture for a test about
    // lanes. So a healthy ledger is the default; `billed`, when handed in,
    // collects what was actually asked for; a test about a dead or short
    // ledger stubs its own (see test/edit-reserve-refused.test.mjs).
    if (url.includes("/rpc/use_credits")) {
      let want = 0;
      try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      if (billed) billed.push(want);
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
      // A FUNCTION ANSWERS EACH CALL IN TURN (2026-10-23, #196): its argument
      // is how many calls to that tool came before.
      const given = typeof answers[tool] === "function" ? answers[tool](calls.filter((c) => c.tool === tool).length - 1) : answers[tool];
      return new Response(JSON.stringify({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", name: tool, input: given }],
        // SIZED BY THE TEST WHEN IT CARES. The default is deliberately tiny;
        // `pageCredits` has a floor of 1, so at this size one call and two
        // round to the same credit and a bill missing a whole call is
        // invisible. A test about billing has to spend enough to cross the
        // boundary — see the dispatched-bill case.
        usage: (usage && usage[tool]) || { input_tokens: 10, output_tokens: 5 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    // THE SCRIPT UPLOAD (2026-09-06). A publish whose script does not land
    // is a FAILED activation now, so a driven publish has to reach the
    // dispatch API — and answering it here is what makes these cases
    // exercise the leg they never did.
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  return (async () => {
    try { return await run(calls); } finally { globalThis.fetch = real; }
  })();
}

async function edit(slug, instruction, { store = null, layer = "look", page = "" } = {}) {
  const worker = await loadWorker();
  const req = new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: TOKEN },
    body: JSON.stringify({ layer, page, remove: false, rename: "", tab: false, instruction, picker: "sonnet" }),
  });
  const res = await worker.fetch(req, { SITES_BUCKET: store || bucket(slug), ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", ...dispatchEnv() }, makeCtx());
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** The tools an edit asked for, in the order it asked. */
const toolsOf = (calls) => calls.map((c) => c.tool);

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


// ── AUDIT #195 / A32-2 (2026-10-23, the owner's choice): a translation too big
// for one answer goes in batches; a round refused for its size is charged
// nothing and remembered, and is not asked again until its words change.
// Driven end to end through the edit route, with the translation calls
// answered here (`translateOver`), so each call's strings and stop are the test's.
const MANY = (n, tag = "") => [{ path: "src/routes/index.tsx", source: "export default function Home(){return <main>" + Array.from({ length: n }, (_, i) => "<p>Fresh loaf number " + i + tag + " baked this morning</p>").join("") + "</main>}" }];
function translateOver(answerFor) {
  const inner = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/v1/messages")) {
      let body = {};
      try { body = JSON.parse(String((init && init.body) || "{}")); } catch { body = {}; }
      if (body.tool_choice && body.tool_choice.name === TRANSLATE_TOOL.name) {
        const text = String(body.messages[0].content);
        const strings = JSON.parse(text.slice(text.indexOf("Strings:\n") + "Strings:\n".length));
        asked.push(strings);
        return new Response(JSON.stringify(answerFor(strings, asked.length)), { status: 200, headers: { "content-type": "application/json" } });
      }
    }
    return inner(input, init);
  };
  return { asked, restore: () => { globalThis.fetch = inner; } };
}
const okAnswer = (strings) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: TRANSLATE_TOOL.name, input: { strings: strings.map((s) => "ES " + s) } }], usage: { input_tokens: 10, output_tokens: 5 } });
const cutOff = () => ({ stop_reason: "max_tokens", content: [], usage: { input_tokens: 4000, output_tokens: 8000 } });

// ── #196 (audit A32-3), the owner's choice 2026-10-23: TRANSLATED PAGES ARE
// EDITABLE. An edit aimed at /es/... is stored as that language's own override,
// keyed by the English it came from, and laid over the cache on every publish;
// when that English changes the override is kept, flagged and said.
const ES = (s) => "ES " + s;
function bilingual(slug, extra = {}) {
  const b = bucket(slug);
  const { strings } = collectStrings(BILINGUAL_PAGES);
  b.store.set("source/" + slug + "/pages.json", JSON.stringify(BILINGUAL_PAGES));
  b.store.set(CONFIG_KEY(slug), JSON.stringify({
    look: { ...STORED_LOOK, langs: ["es"] }, css: STORED_CSS,
    langStrings: { es: Object.fromEntries(strings.map((x) => [x, ES(x)])) }, ...extra,
  }));
  return { b, strings };
}
const lastConfig = (b, slug) => JSON.parse((b.writes.filter(([k]) => k === CONFIG_KEY(slug)).pop() || [null, "{}"])[1]);
const compiledEs = (c) => {
  const files = (c.calls.filter((x) => x.body && x.body.files).pop() || { body: { files: {} } }).body.files || {};
  return Object.entries(files).filter(([k]) => /(^|\/)es\//.test(k)).map(([, v]) => String(v)).join("\n");
};

test("#196 CONTROL: an English wording edit on a bilingual site changes the English page and stores no override", async () => {
  const c = installCompiler();
  const slug = "lang-own-5";
  const { b } = bilingual(slug);
  try {
    await withWire({ write_text_edits: { edits: [{ id: 0, to: "Fresh bread all day" }] }, [TRANSLATE_TOOL.name]: { strings: ["ES Fresh bread all day"] } }, async () => {
      const { body } = await edit(slug, "change the heading to Fresh bread all day", { store: b, layer: "text" });
      assert.equal(body && body.ok, true, JSON.stringify(body));
      assert.ok(!lastConfig(b, slug).langOverrides, "an English edit stored a translated override");
      assert.equal(body.langOverride, undefined);
    });
  } finally { c.uninstall(); }
});
