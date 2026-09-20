// THE EDIT PATH'S PAGE RUNG, DRIVEN THROUGH THE REAL ROUTE.
//
// `test/edit-parts.test.mjs` guards this rung by READING its source — the
// landmark-to-landmark scan this repository reaches for when a route cannot be
// driven. It can be driven: `test/edit-path.test.mjs` has posted at
// `/api/site/<slug>/edit` with a stubbed wire and an opt-in compiler since
// 2026-08-29, and that is what this file does.
//
// THE DIFFERENCE IS NOT STYLE. A source scan is asserted one layer BELOW the
// break — it can say `loadSiteParts` is called and `mergeParts` is called after
// it, and it cannot say what the compiler was handed or what the store held
// afterwards. All three defects below were invisible to it and every one is
// visible here, in the payload and in the write.
//
// WHAT IS ASSERTED, FOR EACH CASE:
//
//   1. the DESIGNER'S OWN INPUT — the prompt that really went out
//   2. the COMPILER PAYLOAD — the files the publish spine really sent
//   3. the STORED INVENTORY — what `source/<slug>/parts.json` really holds
//   4. the CUSTOMER'S SENTENCE — composed by the browser's own `addonAnswer`
//
// NOTHING HERE REACHES A MODEL OR SPENDS ANYTHING. Every outbound call is
// answered by a stub that reads which tool was asked for and replies in that
// tool's own shape; the container is the opt-in compiler, which echoes the
// files it was handed.

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
// THE TOOL NAMES COME FROM THE MODULES THAT DEFINE THEM. A hand-typed name is
// a second copy, the stub never matches, the call 503s, and the assertion
// "fails" for a reason that has nothing to do with its subject — recorded in
// `edit-path.test.mjs`'s own header after it happened there.
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { TEXT_TOOL } from "../builder/site-apply.mjs";
// THE CUSTOMER'S OWN SENTENCE. `browserReply` loads `public/chat.js` and runs
// its real `addonAnswer` — the SELECTION, not one composer — so what is
// asserted is what the screen said rather than a second copy of it written
// here. `httpOk` is `Response.ok` and is not derivable from the body.
import { browserReply } from "../scripts/addon-sweep.mjs";
import { SITE_PAGES_TOOL, partsDirective, tsxDirective, partsSent, siteComponentApi, MAX_PART_CHARS } from "../builder/page-gen.mjs";

const USER = { id: "u-editctx-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";

const PARTS_KEY = (slug) => "source/" + String(slug).toLowerCase() + "/parts.json";
const SOURCE_KEY = (slug) => "source/" + String(slug).toLowerCase() + "/pages.json";

// A PAGE THAT REALLY IMPORTS BOTH COMPONENTS, because the rung's own readers
// walk imports and a page that names neither is a site where losing a component
// costs nothing visible.
//
// ⚠ IT EXPORTS A ROUTE, and that is not decoration: `validatePages` refuses a
// page without `createFileRoute(`, so a hand-spelled page in any other shape
// reads to this rung as the model declining and escalates `no-page-back` —
// the fixture-in-a-different-shape trap, met head-on while writing this file.
//
// ⚠ AND THE STORED PATH IS BARE. `cleanPath` strips `src/routes/` on the way
// in, so a page a model writes at `src/routes/index.tsx` is STORED at
// `index.tsx` — and the rung matches what came back against `target.path` by
// equality. A stored page wearing the prefix can never be matched.
const ROUTE_HEAD = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n";
const HOME = ROUTE_HEAD
  + 'import CardA from "./-parts/card-a"\n'
  + 'import CardB from "./-parts/card-b"\n'
  + "function Home(){return <main><h1>Ravenscroft</h1><CardA /><CardB /></main>}\n";

// WHAT THE WRITER HANDS BACK. It differs from `HOME`, and that is required
// rather than decorative: the rung refuses `no-change` when the returned page
// is byte-identical and no component moved — and with the store unreadable
// `partMoved` is false by construction, so an unchanged page would take the
// refusal branch and the reproduction would never reach the merge it is about.
const HOME_EDITED = HOME.replace("<h1>Ravenscroft</h1>", "<h1>Ravenscroft &amp; Fyne</h1>");

const A_OLD = "export default function CardA(){return <section data-slot=\"card\"><h2>Opening hours</h2><p>Nine until five, Tuesday to Saturday.</p></section>}";
const B_OLD = "export default function CardB(){return <section data-slot=\"card\"><h2>Where to find us</h2><p>Eleven Bridge Street, by the weir.</p></section>}";
const A_NEW = "export default function CardA(){return <section data-slot=\"card\"><h2>Opening hours</h2><p>Nine until six, Tuesday to Saturday.</p></section>}";
const B_NEW = "export default function CardB(){return <section data-slot=\"card\"><h2>Where to find us</h2><p>Eleven Bridge Street, beside the weir.</p></section>}";

const STORED_CSS = ":root{--background:oklch(100% 0 0)}\nfooter{background-color:#0b3d2e}";
const STORED_LOOK = {
  brand: "Ravenscroft",
  theme: "broadsheet",
  // THE DECLARATIONS, which is what this rung has always sent. Both name
  // components the site really HAS — which is the whole of defect 3: sent on
  // their own they read as components to BUILD.
  tsx: [
    { name: "card-a", does: "the opening hours card", props: "none" },
    { name: "card-b", does: "the address card", props: "none" },
  ],
};

/**
 * The site's stored state, with every write recorded in order.
 *
 * `failParts` makes the components store THROW — which is `readSiteParts`'
 * `why: "read"` and `loadSiteParts`' `null`, the two the rung cannot tell
 * apart. It is a per-key failure rather than a dead bucket, because a dead
 * bucket also takes the page source with it and there would be no edit to run.
 */
function bucket(slug, { parts = [{ name: "card-a", source: A_OLD }, { name: "card-b", source: B_OLD }], failParts = false } = {}) {
  const store = new Map([
    [SOURCE_KEY(slug), JSON.stringify([{ path: "index.tsx", source: HOME }])],
    [PARTS_KEY(slug), JSON.stringify(parts)],
    [CONFIG_KEY(slug), JSON.stringify({ look: { ...STORED_LOOK }, css: STORED_CSS })],
  ]);
  const writes = [];
  const reads = [];
  return {
    store, writes, reads,
    async get(k) {
      reads.push(k);
      // THE FAILURE IS ON THE READ, NOT ON A MISSING OBJECT. An absent object
      // is `ok: true, parts: []` — a site with no components, which is a real
      // and ordinary answer. Only a throw is "we cannot see".
      if (failParts && k === PARTS_KEY(slug)) throw new Error("R2 GET failed");
      const v = store.get(k);
      return v === undefined ? null : { text: async () => v };
    },
    async put(k, v) { writes.push([k, String(v)]); store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

/** Every model request this edit made, in order, with the tool it asked for. */
function withWire(answers, run) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rpc/use_credits")) {
      let want = 0;
      try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      return new Response(String(want), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_project")) return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/rest/v1/site_backends")) {
      return new Response(JSON.stringify([{ uid: USER.id, brief: "" }]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/v1/messages")) {
      let body = {};
      try { body = JSON.parse(String(init && init.body) || "{}"); } catch { body = {}; }
      const tool = body.tool_choice?.name || "";
      calls.push({ tool, body });
      // A TOOL WITH NO STUB IS REFUSED, never given a plausible answer: a stub
      // more capable than the real thing hides bugs exactly like one that is
      // less, and this file's whole job is to see which calls really happen and
      // what they carried.
      if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      const a = answers[tool];
      const input2 = typeof a === "function" ? a(calls.filter((c) => c.tool === tool).length - 1) : a;
      return new Response(JSON.stringify({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", name: tool, input: input2 }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  return (async () => {
    try { return await run(calls); } finally { globalThis.fetch = real; }
  })();
}

async function edit(slug, instruction, { store, layer = "page", page = "/" } = {}) {
  const worker = await loadWorker();
  const req = new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: TOKEN },
    body: JSON.stringify({ layer, page, remove: false, rename: "", tab: false, instruction, picker: "sonnet" }),
  });
  const res = await worker.fetch(req, { SITES_BUCKET: store, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", ...dispatchEnv() }, makeCtx());
  const body = await res.clone().json().catch(() => null);
  // THE SCREEN, COMPOSED BY THE BROWSER ITSELF. `res.ok` is what the page's own
  // reader asks first, so it travels with the body rather than being inferred
  // from it — `{ok:false}` at a 200 and `{ok:true}` at a 503 are different
  // screens and only the pair separates them.
  const said = browserReply(body, res.ok);
  return { status: res.status, body, said };
}

/**
 * A literal as it appears inside a JSON-stringified message list.
 *
 * THE PROMPT IS READ AS JSON, so a source containing `"` arrives escaped. A
 * raw `includes(A_OLD)` answers false for every real component and reads
 * exactly like "the writer was not shown it" — the reproduction passing for
 * the wrong reason, which is the one way this instrument can lie.
 */
const esc = (t) => JSON.stringify(String(t)).slice(1, -1);

/**
 * ONE KIT MODULE'S OWN SIGNATURE LINE, from the real producer.
 *
 * ⚠ IT MUST BE A MODULE OUTSIDE THE CACHED CORE. `siteComponentApi` subtracts
 * whatever the cached block already carries, so `accordion`, `carousel` and
 * `tide-chart` all answer `""` — a case built on one of those asserts that
 * nothing was sent and passes whether the wire exists or not. `seat-map` is
 * outside it, measured.
 */
const KIT_LINE = (siteComponentApi(["seat-map"]).split("\n").pop() || "").trim();

/** The `write_pages` prompt that really went out, as one string. */
function pagePrompt(calls) {
  const c = calls.find((x) => x.tool === SITE_PAGES_TOOL.name);
  return c ? JSON.stringify(c.body.messages) : "";
}

/** What the publish spine handed the compiler: `{files, parts, ...}`. */
function payload(c) {
  assert.equal(c.calls.length, 1, "expected exactly one compile, got " + c.calls.length);
  return c.calls[0].body || {};
}

/**
 * The compiler payload's components as `{name: source}`.
 *
 * ⚠ THE PAYLOAD CARRIES A LIST AND `undefined` FOR NONE — read off
 * `worker.js`'s own `compile` dep, which sends
 * `parts: (builtParts && builtParts.length) ? builtParts : undefined`. Indexing
 * that array by name answers `undefined` for every component, which reads
 * exactly like the loss this file is measuring: an assertion written that way
 * passes the reproduction and the fix alike.
 */
function sentParts(sent) {
  if (!Array.isArray(sent.parts)) return null;
  const out = {};
  for (const p of sent.parts) out[p.name] = p.source;
  return out;
}

/** What `source/<slug>/parts.json` holds after the message, as `{name: source}`. */
function storedParts(store, slug) {
  const raw = store.store.get(PARTS_KEY(slug));
  if (raw === undefined) return null;
  const out = {};
  for (const p of JSON.parse(raw)) out[p.name] = p.source;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. AN UNREADABLE COMPONENT STORE IS NOT AN EMPTY ONE
// ─────────────────────────────────────────────────────────────────────────────

test("an unreadable components store publishes NOTHING over the inventory, and says so", async () => {
  // THE DEFECT, REPRODUCED FIRST AND THEN FIXED (commit ad30cc44 holds the
  // failing version of this file). `loadSiteParts` answers `null` for BOTH
  // "this site has no components" and "the read threw", and the page rung read
  // it straight into the merge:
  //
  //     const pStored = (pValid.parts && pValid.parts.length) ? await loadSiteParts(...) : null
  //     const pParts  = ... mergeParts(pStored, pValid.parts)
  //
  // `mergeParts(null, [one])` answers `[one]`. So a transient R2 failure
  // published ONE component and deleted `card-b`, which nobody mentioned, from
  // the payload and from the store.
  //
  // WHAT IT DOES NOW: `readSiteParts` keeps the third state, `partsSent`
  // answers `unreadable`, every returned component is refused, and `pParts` is
  // `null` — which leaves the spine to re-send the store's own copy, exactly
  // as a page edit that touched no component does.
  const slug = "ctx-unreadable";
  const store = bucket(slug, { failParts: true });
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the component rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: HOME_EDITED }], parts: [{ name: "card-a", source: A_NEW }] },
    }, async (calls) => {
      const { body, said } = await edit(slug, "change the opening hours to six", { store });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // (a) THE DESIGNER'S INPUT. Nothing was offered to be built, because a
      //     declaration we cannot check against the store might name a
      //     component that already exists — and asking for it is asking for
      //     the rewrite the wall then has to refuse.
      const prompt = pagePrompt(calls);
      assert.ok(prompt, "the page writer was never called");
      const built = tsxDirective(STORED_LOOK.tsx, []);
      const builtHead = built.split("\n")[0];
      assert.ok(builtHead && builtHead.trim(), "the to-build directive has no heading to anchor on");
      assert.ok(!prompt.includes(esc(builtHead)),
        "an unreadable store still offered the site's own components to be BUILT");

      // (b) THE COMPILER PAYLOAD. No `parts` key at all — the spine re-sends
      //     the store's own copy, so nothing is written over the inventory.
      //     ⚠ `undefined` IS THE ANSWER, and an empty array would NOT be: the
      //     spine reads a list it is handed, so `[]` would publish a site with
      //     no components at all.
      const sent = payload(c);
      assert.equal(sent.parts, undefined,
        "the publish carried a component list on a read that failed: " + JSON.stringify(sent.parts));

      // (c) THE STORED INVENTORY, byte for byte what it was.
      const after = storedParts(store, slug);
      assert.deepEqual(after, { "card-a": A_OLD, "card-b": B_OLD },
        "the components store was written on a read that failed: " + JSON.stringify(after));

      // (d) AND THE CUSTOMER IS TOLD. `unseenParts` is its own field and its
      //     own sentence — "I could not read this site's components at all" —
      //     never folded into `keptParts`, which means something else.
      assert.deepEqual(body.unseenParts, ["card-a"],
        "the refused component was not named on the reply: " + JSON.stringify(body.unseenParts));
      assert.equal(body.keptParts, undefined,
        "a size refusal was reported for a store that could not be read at all");

      // (e) THE CUSTOMER'S SENTENCE, composed by the browser's own selection.
      //     The page change really did publish, so the screen is a success —
      //     what changed is that the record beside it now names what did not.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.equal(said.text, "\u2705 Done.", "the customer's sentence changed: " + JSON.stringify(said.text));
    });
  } finally { c.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TWO PAGE STEPS IN ONE MESSAGE, AND ONLY THE LAST ONE'S COMPONENT SURVIVES
// ─────────────────────────────────────────────────────────────────────────────

test("two page steps in one message: BOTH components reach the single publication", async () => {
  // `components` and `tsx` both dispatch to the `page` layer, so a two-field
  // pick runs the rung twice for ONE message. Each run used to read the stored
  // parts FRESH and merge its own answer over them:
  //
  //   step 1: mergeParts([A_OLD, B_OLD], [A_NEW]) -> [A_NEW, B_OLD]   -> handed over
  //   step 2: mergeParts([A_OLD, B_OLD], [B_NEW]) -> [A_OLD, B_NEW]   -> handed over
  //
  // and `publishStep`'s own rule is "a later list wins", so the single
  // publication carried A_OLD and B_NEW. Step one ran, was charged for, and
  // reported success.
  //
  // WHAT IT DOES NOW: one snapshot per message (`editParts`), advanced by
  // `publishStep` exactly as `eSrc` is — so step two merges against what step
  // one accepted.
  const slug = "ctx-carry";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      pick_lanes: { fields: ["components", "tsx"] },
      [TWEAK_TOOL.name]: { cannot: "that needs the components rewritten" },
      // TWO PAGE CALLS, ANSWERED IN ORDER — the first returns `card-a`, the
      // second `card-b`. Keyed by call index, because both steps ask for the
      // same tool and a single fixed answer could not tell them apart.
      [SITE_PAGES_TOOL.name]: (n) => ({
        pages: [{ path: "src/routes/index.tsx", source: HOME_EDITED }],
        parts: [n === 0 ? { name: "card-a", source: A_NEW } : { name: "card-b", source: B_NEW }],
      }),
    }, async (calls) => {
      const { body, said } = await edit(slug, "hours to six, and say beside the weir", { store, layer: "look" });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.equal(said.text, "\u2705 Done.", "the customer's sentence changed: " + JSON.stringify(said.text));

      // BOTH STEPS REALLY RAN. Without this the case would pass by doing half
      // the work once, which is the shape it is trying to catch.
      assert.equal(calls.filter((x) => x.tool === SITE_PAGES_TOOL.name).length, 2,
        "the message did not run two page steps: " + JSON.stringify(calls.map((x) => x.tool)));

      // AND THE SECOND STEP SAW THE FIRST'S WORK. Read off the prompt, because
      // this is the hop the fix is: without the carried snapshot the second
      // call is shown the ORIGINAL `card-a`, and a merge cannot put back what
      // the writer was never told had changed.
      const second = calls.filter((x) => x.tool === SITE_PAGES_TOOL.name)[1];
      const secondPrompt = JSON.stringify(second.body.messages);
      assert.ok(secondPrompt.includes(esc(A_NEW)),
        "the second page step was shown the ORIGINAL card-a, not what the first step wrote");
      assert.ok(!secondPrompt.includes(esc(A_OLD)),
        "the second page step was shown the stale card-a as well");

      // ONE PUBLISH FOR THE MESSAGE, carrying both changes.
      const got = sentParts(payload(c));
      assert.ok(got, "the compiler was handed no components at all");
      assert.equal(got["card-a"], A_NEW, "the first step's component did not reach the publication");
      assert.equal(got["card-b"], B_NEW, "the second step's component did not reach the publication");

      const after = storedParts(store, slug);
      assert.equal(after["card-a"], A_NEW, "the first step's component is not in the store");
      assert.equal(after["card-b"], B_NEW, "the second step's component is not in the store");
    });
  } finally { c.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE PAGE WRITER IS SHOWN DECLARATIONS AND TOLD TO BUILD WHAT EXISTS
// ─────────────────────────────────────────────────────────────────────────────

test("the page writer is shown the component source, the look and the kit it needs", async () => {
  // The rung's call was:
  //
  //     briefWithLayout({ brief, images: 0, tsx, gif, qr, three })
  //
  // and `briefWithLayout` already took `parts`, `partsUnreadable`, `theme`,
  // `css` and `plan` — every one of them omitted, so the one call on the edit
  // path that rewrites a whole page was the blindest caller of it there is.
  // Four separable consequences, each asserted:
  //
  //   - no `parts`  -> `partsDirective` empty, so no component source
  //   - no `parts`  -> `tsxDirective` unfiltered, so BOTH existing components
  //                    appeared under "Components to build"
  //   - no `theme`/`css` -> the writer did not know what the site wears
  //   - no `plan`   -> `siteComponentApi` sent no kit signatures
  const slug = "ctx-blind";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the component rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: HOME_EDITED }], parts: [{ name: "card-a", source: A_NEW }] },
    }, async (calls) => {
      await edit(slug, "change the opening hours to six", { store });
      const prompt = pagePrompt(calls);
      assert.ok(prompt, "the page writer was never called");

      // (a) THE COMPONENT SOURCE IS THERE, under the real producer's own
      //     heading rather than a sentence typed here — so a reworded
      //     directive cannot read as a broken wire.
      const withSource = partsDirective(partsSent([{ name: "card-a", source: A_OLD }]));
      const heading = withSource.split("\n")[0];
      assert.ok(heading && heading.trim(), "the components directive has no heading to anchor on");
      assert.ok(prompt.includes(esc(heading)), "the writer was not shown the site's components");
      assert.ok(prompt.includes(esc(A_OLD)), "card-a's real source is not in the prompt");
      assert.ok(prompt.includes(esc(B_OLD)), "card-b's real source is not in the prompt");

      // (b) AND NOTHING THE SITE ALREADY HAS IS OFFERED TO BE BUILT.
      //     `tsxDirective` filters by the names the site has a file for; with
      //     `parts` passed, both declarations are filtered out and the block
      //     is not emitted at all.
      const built = tsxDirective(STORED_LOOK.tsx, []);
      const builtHead = built.split("\n")[0];
      assert.ok(builtHead && builtHead.trim(), "the to-build directive has no heading to anchor on");
      assert.ok(!prompt.includes(esc(builtHead)),
        "an existing component is still offered under the to-build heading");
      // AND THE FILTER IS WHAT REMOVED IT, not an empty declaration list —
      // without which this assertion would pass on a site that declares none.
      assert.ok(builtHead.trim() && tsxDirective(STORED_LOOK.tsx, ["card-a", "card-b"]) === "",
        "the filter does not remove components the site already has");

      // (c) THE LOOK IT IS WEARING — the theme name and the site's own
      //     stylesheet, which no caller of this rung could read until now.
      assert.ok(prompt.includes("broadsheet"), "the writer was not told the theme");
      assert.ok(prompt.includes(esc(STORED_CSS)), "the writer was not shown the site's stylesheet");

      // (d) AND THE KIT SIGNATURES FOR THE PAGE BEING EDITED. This page
      //     imports no kit module, so the honest answer is that the block is
      //     absent — asserted with the POSITIVE case beside it, or "no
      //     signatures" would pass on a rung that can never send any.
      //
      //     ⚠ ANCHORED ON THE MODULE'S OWN LINE, never the block's heading:
      //     that heading is one shared literal across every non-empty answer,
      //     so it says the block exists and nothing about WHICH component is
      //     in it.
      assert.ok(KIT_LINE && KIT_LINE.trim(), "siteComponentApi answers nothing for a real kit module");
      assert.ok(!prompt.includes(esc(KIT_LINE)),
        "kit signatures were sent for a page that imports no kit module");
    });
  } finally { c.uninstall(); }
});

test("the kit signatures follow the page: a target importing a kit module gets its props", async () => {
  // The positive half of (d) above, and the reason it is its own case: the
  // plan is derived from the TARGET page's own imports, so a case whose page
  // imports nothing cannot tell "scoped correctly" from "never wired".
  //
  // ⚠ `modules`, NOT `kit`. `pageComponents` answers both and they are
  // different vocabularies — `siteComponentApi` is keyed on the MODULE name
  // (`accordion`) and handed the EXPORT names (`Accordion`) answers "" for
  // every one, which from outside is indistinguishable from a page importing
  // nothing. Measured on the addon path in 2026-09-17; this is the same walk.
  const slug = "ctx-kit";
  const withKit = ROUTE_HEAD
    + 'import { SeatMap } from "@/components/ui/seat-map"\n'
    + 'import CardA from "./-parts/card-a"\n'
    + "function Home(){return <main><SeatMap /><CardA /></main>}\n";
  const store = bucket(slug, { parts: [{ name: "card-a", source: A_OLD }] });
  store.store.set(SOURCE_KEY(slug), JSON.stringify([{ path: "index.tsx", source: withKit }]));
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the component rewritten" },
      [SITE_PAGES_TOOL.name]: {
        pages: [{ path: "src/routes/index.tsx", source: withKit.replace("<main>", "<main><h1>Hours</h1>") }],
        parts: [],
      },
    }, async (calls) => {
      await edit(slug, "put a heading above the seat map", { store });
      const prompt = pagePrompt(calls);
      assert.ok(prompt, "the page writer was never called");
      assert.ok(KIT_LINE && KIT_LINE.trim(), "siteComponentApi answers nothing for a real kit module");
      assert.ok(prompt.includes(esc(KIT_LINE)),
        "the writer was sent no kit signatures for a page that imports one");
      // AND THE EXPORT NAME IS NOT WHAT WAS ASKED FOR. The measured failure
      // mode: `siteComponentApi(["SeatMap"])` answers "", which reads exactly
      // like this wire not existing.
      assert.equal(siteComponentApi(["SeatMap"]), "",
        "siteComponentApi answers for an EXPORT name, so this assertion proves nothing");
    });
  } finally { c.uninstall(); }
});

test("a component too large to show is refused rather than rewritten blind, and is named", async () => {
  // THE OTHER HALF OF THE WALL, and without a case it is dead code that reads
  // as a live check. `partsSent` withholds a component over `MAX_PART_CHARS`
  // — the request cannot carry it — and the writer is told so by name. What
  // must not then happen is the writer's guess replacing the real file: a
  // rewrite composed from a one-line description is a silent loss of a working
  // implementation, and `mergeParts` has no wall of its own.
  //
  // ⚠ THE BOUND COMES FROM THE MODULE, never a number typed here. A hand-typed
  // constant is a second copy of what the product exports, and this repository
  // has shipped that drift more than once.
  const slug = "ctx-withheld";
  const huge = A_OLD + "\n// " + "x".repeat(MAX_PART_CHARS);
  assert.ok(huge.length > MAX_PART_CHARS, "the fixture is not over the bound this case is about");
  const store = bucket(slug, { parts: [{ name: "card-a", source: huge }, { name: "card-b", source: B_OLD }] });
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the component rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: HOME_EDITED }], parts: [{ name: "card-a", source: A_NEW }] },
    }, async (calls) => {
      const { body } = await edit(slug, "change the opening hours to six", { store });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // THE WRITER WAS TOLD THE NAME AND NOT THE SOURCE — `partsSent`'s own
      // rule, and the reason the refusal below is honest rather than arbitrary.
      const prompt = pagePrompt(calls);
      assert.ok(prompt.includes("card-a"), "the withheld component was not even named to the writer");
      assert.ok(!prompt.includes(esc(huge)), "a component over the bound was sent whole");

      // AND THE RETURNED REWRITE IS REFUSED. The real file is what publishes.
      const got = sentParts(payload(c));
      assert.ok(got, "the compiler was handed no components at all");
      assert.equal(got["card-a"], huge, "a component the writer never saw was replaced by its guess");
      assert.equal(got["card-b"], B_OLD, "an unrelated component was lost");

      // AND THE CUSTOMER HEARS IT, under its own name. `keptParts` is "too
      // large to show you"; `unseenParts` is "I could not read the store at
      // all". Two sentences, so two fields.
      assert.deepEqual(body.keptParts, ["card-a"],
        "the refused component was not named on the reply: " + JSON.stringify(body.keptParts));
      assert.equal(body.unseenParts, undefined,
        "a size refusal was reported as an unreadable store");
    });
  } finally { c.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// THE SAME READER, ONE BRANCH OVER: the `text` rung
// ─────────────────────────────────────────────────────────────────────────────

test("a wording edit REFUSES an unreadable components store, and spends nothing", async () => {
  // "WHEN AN INFRASTRUCTURE LIMIT IS FOUND ON ONE ROUTE, LIST EVERY ROUTE
  // UNDER IT" — this repository's own trap, and the `text` rung is the other
  // caller of the collapsed reader inside this route.
  //
  // ⚠ ITS SHAPE WAS THE WORSE ONE, and this is what the reproduction measured
  // before the fix (commit ad30cc44's successor; the probe is in the commit
  // message): the reply was `{ok: true, applied: 1}`, the compiler payload
  // carried `parts: []`, and `source/<slug>/parts.json` was REWRITTEN TO `[]`
  // — every component on the site deleted by a one-word wording change. The
  // empty list is REAL rather than absent here (`splitEditable` builds it), so
  // both the spine's preference and its save take it at face value. The page
  // rung at least handed over `null`.
  //
  // WHAT IT DOES NOW: refuses above the model call, 503, cost 0.
  const slug = "ctx-text";
  const store = bucket(slug, { failParts: true });
  const c = installCompiler();
  try {
    await withWire({
      [TEXT_TOOL.name]: { edits: [{ id: 0, to: "Ravenscroft and Fyne" }] },
    }, async (calls) => {
      const { status, body, said } = await edit(slug, "call us Ravenscroft and Fyne", { store, layer: "text" });
      assert.equal(status, 503, "the refusal is not a 503: " + status + " " + JSON.stringify(body));
      assert.equal(body && body.error, "parts-unreadable", "the refusal does not name itself: " + JSON.stringify(body));

      // NOTHING WAS SPENT. The refusal sits above the model call, so a
      // customer who retries a minute later has paid for neither attempt.
      assert.equal(body.cost, 0, "the refusal charged the customer: " + body.cost);
      assert.equal(calls.length, 0, "the refusal ran a model call first: " + JSON.stringify(calls.map((x) => x.tool)));
      assert.equal(c.calls.length, 0, "the refusal reached the compiler");

      // AND NOTHING WAS WRITTEN. The store holds exactly what it held.
      const after = storedParts(store, slug);
      assert.deepEqual(after, { "card-a": A_OLD, "card-b": B_OLD },
        "a refused wording edit wrote the components store: " + JSON.stringify(after));

      // AND THE CUSTOMER IS TOLD, in the browser's own words — a refusal that
      // reads as a success is the failure this whole file is about.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.notEqual(said.text, "\u2705 Done.", "a refusal was drawn as a success");
      assert.ok(said.text.includes("sections"), "the refusal's own sentence did not reach the screen: " + JSON.stringify(said.text));
    });
  } finally { c.uninstall(); }
});

test("CONTROL: a wording edit on a READABLE store still carries every component through", async () => {
  // The other side of the same line, and what says the case above is about
  // the FAILED read rather than the text rung having stopped sending parts
  // at all — which would pass the assertions above and break every split site.
  const slug = "ctx-text-ok";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      [TEXT_TOOL.name]: { edits: [{ id: 0, to: "Ravenscroft and Fyne" }] },
    }, async () => {
      const { body } = await edit(slug, "call us Ravenscroft and Fyne", { store, layer: "text" });
      assert.equal(body && body.ok, true, "the wording edit did not go through: " + JSON.stringify(body));
      const got = sentParts(payload(c));
      assert.ok(got, "the compiler was handed no components at all");
      assert.equal(got["card-a"], A_OLD, "an untouched component was lost on a HEALTHY read");
      assert.equal(got["card-b"], B_OLD, "an untouched component was lost on a HEALTHY read");
    });
  } finally { c.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// THE CONTROL: A SUCCESSFUL READ
// ─────────────────────────────────────────────────────────────────────────────

test("CONTROL: with the store readable, one changed component leaves the other exactly as it was", async () => {
  // Retained for both stages: this is the case that must keep behaving
  // identically after the fix, and it is what says the loss above is the
  // FAILED READ rather than the merge being wrong in general.
  const slug = "ctx-control";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the component rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: HOME_EDITED }], parts: [{ name: "card-a", source: A_NEW }] },
    }, async () => {
      const { body, said } = await edit(slug, "change the opening hours to six", { store });
      assert.equal(body && body.ok, true, "the control edit did not go through: " + JSON.stringify(body));
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.equal(said.text, "\u2705 Done.", "the control's sentence changed: " + JSON.stringify(said.text));
      const got = sentParts(payload(c));
      assert.ok(got, "the compiler was handed no components at all");
      assert.equal(got["card-a"], A_NEW, "the change did not reach the publication");
      assert.equal(got["card-b"], B_OLD, "the untouched component was lost on a HEALTHY read");
      const after = storedParts(store, slug);
      assert.equal(after["card-a"], A_NEW, "the change is not in the store");
      assert.equal(after["card-b"], B_OLD, "the untouched component is not in the store");
    });
  } finally { c.uninstall(); }
});
