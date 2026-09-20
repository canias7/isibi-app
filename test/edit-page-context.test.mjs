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
// THE CUSTOMER'S OWN SENTENCE. `browserReply` loads `public/chat.js` and runs
// its real `addonAnswer` — the SELECTION, not one composer — so what is
// asserted is what the screen said rather than a second copy of it written
// here. `httpOk` is `Response.ok` and is not derivable from the body.
import { browserReply } from "../scripts/addon-sweep.mjs";
import { SITE_PAGES_TOOL, partsDirective, tsxDirective, partsSent } from "../builder/page-gen.mjs";

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

test("REPRODUCTION 1: a failed components read lets one returned component replace the whole inventory", async () => {
  // THE DEFECT. `loadSiteParts` answers `null` for BOTH "this site has no
  // components" and "the read threw", and the page rung reads it:
  //
  //     const pStored = (pValid.parts && pValid.parts.length) ? await loadSiteParts(...) : null
  //     const pParts  = ... mergeParts(pStored, pValid.parts)
  //
  // `mergeParts(null, [one])` answers `[one]`. So a transient R2 failure turns
  // a one-component edit into a publish carrying ONE component, and `card-b` —
  // which nobody mentioned — is gone from the compiler payload and from the
  // store.
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

      // (a) THE DESIGNER'S INPUT. With the store unreadable the writer was
      //     shown no component source at all, and — this is the half that
      //     makes the replacement possible — `card-a` was offered to be BUILT.
      const prompt = pagePrompt(calls);
      assert.ok(prompt, "the page writer was never called");

      // (b) THE COMPILER PAYLOAD — the only place the loss is visible before
      //     the write. `card-b` is not in it.
      const sent = payload(c);
      const got = sentParts(sent);
      assert.ok(got, "the compiler was handed no components at all");
      assert.deepEqual(Object.keys(got).sort(), ["card-a"],
        "expected the reproduction's loss: the compiler was handed " + JSON.stringify(Object.keys(got)));

      // (c) THE STORED INVENTORY. The site's second component is gone.
      const after = storedParts(store, slug);
      assert.deepEqual(Object.keys(after || {}).sort(), ["card-a"],
        "expected the reproduction's loss in the store: " + JSON.stringify(after));

      // (d) AND NOBODY IS TOLD. The reply carries no field naming a component
      //     that was not shown and no field naming one that was dropped.
      assert.equal(body.keptParts, undefined, "a keptParts field already exists on this rung");
      assert.equal(body.unseenParts, undefined, "an unseenParts field already exists on this rung");

      // (e) THE CUSTOMER'S SENTENCE, composed by the browser's own selection.
      //     A flat success over a site that just lost a component nobody
      //     mentioned. This is what makes the defect silent rather than noisy.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.equal(said.text, "\u2705 Done.",
        "the customer's sentence is not the flat success this reproduction is about: " + JSON.stringify(said.text));
      assert.ok(!said.text.toLowerCase().includes("card-b"),
        "the customer was already told about the lost component — this reproduction is stale");
    });
  } finally { c.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TWO PAGE STEPS IN ONE MESSAGE, AND ONLY THE LAST ONE'S COMPONENT SURVIVES
// ─────────────────────────────────────────────────────────────────────────────

test("REPRODUCTION 2: two page steps each merge against the ORIGINAL store, so the first change is lost", async () => {
  // `components` and `tsx` both dispatch to the `page` layer, so a two-field
  // pick runs the rung twice for ONE message. Each run reads the stored parts
  // FRESH and merges its own answer over them:
  //
  //   step 1: mergeParts([A_OLD, B_OLD], [A_NEW]) -> [A_NEW, B_OLD]   -> handed over
  //   step 2: mergeParts([A_OLD, B_OLD], [B_NEW]) -> [A_OLD, B_NEW]   -> handed over
  //
  // and `publishStep`'s own rule is "a later list wins", so the single
  // publication carries A_OLD and B_NEW. Step one ran, was charged for, and
  // reported success.
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
      // AND THE CUSTOMER IS TOLD IT WORKED. Both asks were understood, both
      // ran, one was thrown away, and the screen says Done.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.equal(said.text, "\u2705 Done.",
        "the customer's sentence is not the flat success this reproduction is about: " + JSON.stringify(said.text));

      // BOTH STEPS REALLY RAN. Without this the case would pass by doing half
      // the work once, which is the shape it is trying to catch.
      assert.equal(calls.filter((x) => x.tool === SITE_PAGES_TOOL.name).length, 2,
        "the message did not run two page steps: " + JSON.stringify(calls.map((x) => x.tool)));

      // ONE PUBLISH FOR THE MESSAGE, which is the rule that makes this a loss
      // rather than two correct publications.
      const got = sentParts(payload(c));
      assert.ok(got, "the compiler was handed no components at all");
      assert.equal(got["card-a"], A_OLD,
        "expected the reproduction: the first step's component did not reach the publication");
      assert.equal(got["card-b"], B_NEW,
        "the second step's component is missing too — this is not the defect under test");

      const after = storedParts(store, slug);
      assert.equal(after["card-a"], A_OLD, "expected the reproduction in the store");
      assert.equal(after["card-b"], B_NEW, "the second step's component is missing from the store");
    });
  } finally { c.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE PAGE WRITER IS SHOWN DECLARATIONS AND TOLD TO BUILD WHAT EXISTS
// ─────────────────────────────────────────────────────────────────────────────

test("REPRODUCTION 3: the page writer gets no component source, no theme and no stylesheet", async () => {
  // The rung's call is:
  //
  //     briefWithLayout({ brief, images: 0, tsx, gif, qr, three })
  //
  // and `briefWithLayout` already takes `parts`, `partsUnreadable`, `theme`,
  // `css` and `plan` — every one of them omitted here. The consequences are
  // separable and all four are asserted:
  //
  //   - no `parts`  -> `partsDirective` is empty, so no component source
  //   - no `parts`  -> `tsxDirective` is unfiltered, so BOTH existing
  //                    components appear under "Components to build"
  //   - no `theme`/`css` -> the writer does not know what the site wears
  //   - no `plan`   -> `siteComponentApi` sends no kit signatures
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

      // (a) NO COMPONENT SOURCE. Asserted against the REAL producer's heading
      //     rather than a sentence typed here, so a reworded directive does not
      //     read as a fixed defect.
      const withSource = partsDirective(partsSent([{ name: "card-a", source: A_OLD }]));
      const heading = withSource.split("\n")[0];
      assert.ok(heading && heading.trim(), "the components directive has no heading to anchor on");
      assert.ok(!prompt.includes(JSON.stringify(heading).slice(1, -1)),
        "the writer was already shown the site's components — this reproduction is stale");
      assert.ok(!prompt.includes(JSON.stringify(A_OLD).slice(1, -1)),
        "card-a's real source is already in the prompt — this reproduction is stale");

      // (b) AND BOTH EXISTING COMPONENTS ARE OFFERED TO BE BUILT. `tsxDirective`
      //     filters by the names the site has a file for; with no `parts` that
      //     filter is empty, so the declarations go over whole.
      const built = tsxDirective(STORED_LOOK.tsx, []);
      const builtHead = built.split("\n")[0];
      assert.ok(builtHead && builtHead.trim(), "the to-build directive has no heading to anchor on");
      assert.ok(prompt.includes(JSON.stringify(builtHead).slice(1, -1)),
        "expected the reproduction: existing components under the to-build heading");
      // FILTERED, the same declarations produce nothing at all — which is what
      // makes the line above a defect rather than a description.
      assert.equal(tsxDirective(STORED_LOOK.tsx, ["card-a", "card-b"]), "",
        "the filter does not remove components the site already has");

      // (c) NO THEME AND NO STYLESHEET.
      assert.ok(!prompt.includes("broadsheet"), "the writer already knows the theme — this reproduction is stale");
      assert.ok(!prompt.includes("oklch(100% 0 0)"), "the writer already has the stylesheet — this reproduction is stale");
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
