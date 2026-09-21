// EXISTING PHOTOGRAPHS ON THE EDIT PATH, DRIVEN THROUGH THE REAL ROUTE.
//
// Stage 2's subject, and the same discipline as `edit-page-context.test.mjs`:
// POST at `/api/site/<slug>/edit` with the wire stubbed and the opt-in compiler
// installed, then read the DESIGNER'S OWN INPUT, the COMPILER PAYLOAD, the
// STORED SOURCE and the CUSTOMER'S SENTENCE. Nothing reaches a model and
// nothing is spent.
//
// THE DEFECT THIS FILE IS ABOUT. The page rung passes a bare `images: 0`, and
// `imageDirective` says a bare zero as:
//
//   "PHOTOGRAPHS: none on this site. Do not write any @@IMG:@@ token. Every
//    picture is <SafeImage> with no src, which renders this theme's own
//    placeholder — that is the intended look here."
//
// On a site that HAS photographs every clause of that is wrong, and the last
// two are an active instruction to strip them. The same sentence was corrected
// on the ADDON path on 2026-09-17, reproduced there through the real route on
// a site showing two; the edit path is the caller that never moved.
//
// AND THE REPORTING HALF. `photos:` on the reply is `countImageSlots(...)`,
// which counts `@@IMG:` TOKENS — on a rung whose directive forbids them. So it
// is the number of tokens a model wrote against an instruction not to: zero on
// every obedient answer, and `photoNote` is silent. The customer is never told
// about an empty picture frame the change left. `newEmptySlots(before, after)`
// is the reader the addon path already uses for exactly this.
//
// ⚠ THE PRESERVATION CONTRACT, AND IT MOVED ON 2026-09-20. Until then this
// rung DETECTED and REPORTED a loss and published it anyway — deliberately,
// because the addon's 422 `lost-photos` is right for a step whose contract is
// "an addition is always a new thing" and would have refused *"take that
// photo off the front page"*, which is an ordinary edit.
//
// What that missed is the word UNRELATED. Owner: *"If an unrelated edit loses
// a protected image and safe restoration is uncertain, withhold the unsafe
// change with an explanation. Do not publish the loss merely because matching
// failed."* Restoration needs a slot to write into and a description to match
// on, so a writer that DELETES the element, RENAMES its description or
// SUBSTITUTES another url walked past the protection — and the reporting
// sentence below then arrived after the photograph had already gone.
//
// SO THE LINE IS NOW: a loss `keepPhotos` could REACH is silently put back; a
// loss it could not reach REFUSES the rung (409 `withheld`, cost 0, nothing
// compiled, nothing stored). A removal the customer really asked for is
// authorised by the PICTURE RUNG'S OWN APPLIED WORK — it publishes through
// `publishStep`, which advances `eSrc`, so the photograph is already gone
// from the site this rung compares against and there is nothing to protect.
// `test/edit-page-protect.test.mjs` drives both halves end to end.

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { imageDirective, shownPhotos } from "../builder/site-images.mjs";
import { PICTURE_TOOL } from "../builder/site-picture.mjs";
import { laneLayer } from "../builder/site-lanes.mjs";
// ⚠ `editBrowserReply`, NOT `browserReply` — the two are different composers
// and the wrong one answers plausibly. `browserReply` runs `addonAnswer`,
// which is the ADD route's selection; an EDIT reply goes through `editAnswer`
// → `applyEditResult` → `editReply`, where every sentence about a page edit is
// written. MEASURED: an edit reply naming a page, a lost photograph and two
// picture spaces came back through the addon composer as "✅ Done." — a
// fixture in a different shape from reality, one route over.
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const USER = { id: "u-editpix-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";

const SLUG_PARTS = (slug) => "source/" + String(slug).toLowerCase() + "/parts.json";
const SLUG_SRC = (slug) => "source/" + String(slug).toLowerCase() + "/pages.json";

/** A literal as it appears inside a JSON-stringified message list. */
const esc = (t) => JSON.stringify(String(t)).slice(1, -1);

const ROUTE_HEAD = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n"
  + "import { SafeImage } from '@/components/ui/safe-image'\n";

// TWO REAL PHOTOGRAPHS, at `/u/<slug>/<hash>.jpg` — the shape `photoUrls` and
// `imageRefs` really match, so these are pictures the readers can see rather
// than strings that look like them.
const PIC_A = (slug) => "/u/" + slug + "/a1b2c3d4e5f60718.jpg";
const PIC_B = (slug) => "/u/" + slug + "/b2c3d4e5f6071829.jpg";

const homeWith = (slug) => ROUTE_HEAD
  + "function Home(){return <main><h1>Ravenscroft</h1>"
  + '<SafeImage src="' + PIC_A(slug) + '" alt="the bench" />'
  + '<p>Nine until five.</p>'
  + '<SafeImage src="' + PIC_B(slug) + '" alt="the window" />'
  + "</main>}\n";

/** The same page with the words changed and BOTH pictures still on it. */
const keptBoth = (slug) => homeWith(slug).replace("Nine until five.", "Nine until six.");

/** The same page with the words changed and the pictures STRIPPED — the
 *  defect's own output: a `<SafeImage>` with an empty src, which is exactly
 *  what the bare-zero directive asks for. */
const strippedBoth = (slug) => homeWith(slug)
  .replace("Nine until five.", "Nine until six.")
  .replace('src="' + PIC_A(slug) + '"', 'src=""')
  .replace('src="' + PIC_B(slug) + '"', 'src=""');

/**
 * THE SAME STRIPPING, WITH THE DESCRIPTIONS REWRITTEN TOO.
 *
 * ⚠ THIS IS WHAT THE REPORTING HALF IS FOR, SINCE 2026-09-20. The page rung
 * PROTECTS a photograph an unrelated message emptied: the `src` is put back
 * from the page's own previous source, matched on the `alt` — the picture
 * rung's own identity rule (`PICTURE_TOOL`: *"copied EXACTLY from the list
 * below — this is how the slot is identified"*). So a plain
 * `src="…"` → `src=""` no longer loses anything, and the two cases below,
 * which were written against that shape, would have been asserting the defect
 * as correct.
 *
 * A REWRITTEN DESCRIPTION IS THE RESIDUE. There is nothing to match on, so
 * nothing can honestly be put back — and reporting is the only thing left to
 * do. That is a real limit of the protection rather than a contrivance, and
 * pinning it here is what keeps the reporting path exercised.
 */
const strippedAndRenamed = (slug) => strippedBoth(slug)
  .replace('alt="the bench"', 'alt="a bench in the yard"')
  .replace('alt="the window"', 'alt="the front window"');

const STORED_CSS = ":root{--background:oklch(100% 0 0)}";
const STORED_LOOK = { brand: "Ravenscroft", theme: "broadsheet" };

function bucket(slug, { home = homeWith(slug), parts = [] } = {}) {
  const store = new Map([
    [SLUG_SRC(slug), JSON.stringify([{ path: "index.tsx", source: home }])],
    [SLUG_PARTS(slug), JSON.stringify(parts)],
    [CONFIG_KEY(slug), JSON.stringify({ look: { ...STORED_LOOK }, css: STORED_CSS })],
  ]);
  const writes = [];
  return {
    store, writes,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v }; },
    async put(k, v) { writes.push([k, String(v)]); store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

function withWire(answers, run) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/rpc/use_credits")) {
      let want = 0;
      try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      return new Response(String(want), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_project")) return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/rest/v1/site_backends")) return new Response(JSON.stringify([{ uid: USER.id, brief: "" }]), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/v1/messages")) {
      let body = {};
      try { body = JSON.parse(String(init && init.body) || "{}"); } catch { body = {}; }
      const tool = body.tool_choice?.name || "";
      calls.push({ tool, body });
      if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      return new Response(JSON.stringify({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", name: tool, input: answers[tool] }],
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
  return { status: res.status, body, said: editBrowserReply(body, res.ok) };
}

const pagePrompt = (calls) => {
  const c = calls.find((x) => x.tool === SITE_PAGES_TOOL.name);
  return c ? JSON.stringify(c.body.messages) : "";
};

/** The page source the publish spine really sent, off the compiler payload. */
function sentHome(c) {
  assert.equal(c.calls.length, 1, "expected exactly one compile, got " + c.calls.length);
  const files = (c.calls[0].body || {}).files || {};
  const key = Object.keys(files).find((k) => /index\.tsx$/.test(k));
  assert.ok(key, "the compiler payload has no home page: " + JSON.stringify(Object.keys(files)));
  return files[key];
}

/** What `source/<slug>/pages.json` holds afterwards, home page only. */
function storedHome(store, slug) {
  const raw = store.store.get(SLUG_SRC(slug));
  if (raw === undefined) return null;
  const list = JSON.parse(raw);
  const p = list.find((x) => /index\.tsx$/.test(x.path));
  return p ? p.source : null;
}

/** Every `/u/<slug>/` picture a source draws, distinct and sorted. */
const picsIn = (src, slug) => [...new Set([...String(src || "").matchAll(/\/u\/[^"']+/g)].map((m) => m[0]))]
  .filter((u) => u.toLowerCase().startsWith("/u/" + slug.toLowerCase() + "/")).sort();

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE PROMPT
// ─────────────────────────────────────────────────────────────────────────────

test("the page writer is told what the site really shows, and that the zero is ours", async () => {
  // THE DEFECT (reproduced at b9353187): the rung passed a bare `images: 0`,
  // and `imageDirective` says a bare zero as *"PHOTOGRAPHS: none on this site
  // … Every picture is <SafeImage> with no src … that is the intended look
  // here."* On a site that HAS photographs every clause is false and the last
  // two are an instruction to STRIP them.
  //
  // WHAT IT DOES NOW: the object form, with the inventory READ through
  // `photoInventory`/`shownPhotos` — the correction the addon path made on
  // 2026-09-17, on the caller that never moved.
  const slug = "pix-prompt";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: keptBoth(slug) }], parts: [] },
    }, async (calls) => {
      await edit(slug, "change the opening hours to six, and keep the photographs exactly as they are", { store });
      const prompt = pagePrompt(calls);
      assert.ok(prompt, "the page writer was never called");

      // (a) THE FALSE SENTENCE IS GONE, checked against its real producer — so
      //     a reworded directive cannot read as a fixed defect, and a fixed
      //     defect cannot read as a rewording.
      const bare = imageDirective(0);
      assert.ok(bare.includes("none on this site"), "the bare-zero directive no longer says what this case is about");
      assert.ok(!prompt.includes(esc(bare)),
        "the bare-zero directive is still on the wire for a site showing two photographs");

      // (b) AND THE HONEST ONE IS THERE, VERBATIM, over the inventory the
      //     readers really answer for this site.
      //
      //     ⚠ THE DISCRIMINATOR IS THE DIRECTIVE'S OWN SENTENCE, NOT THE URLS.
      //     A first draft of the reproduction asserted the picture urls were
      //     absent from the prompt and failed, correctly: the site's own page
      //     SOURCE is sent as the prior page and carries every `src` it draws.
      //     So a url in the prompt says nothing about whether the writer was
      //     TOLD the pictures are real and must stay.
      const shown = shownPhotos([{ path: "index.tsx", source: homeWith(slug) }], slug);
      assert.equal(shown.count, 2, "the fixture does not show two photographs: " + JSON.stringify(shown));
      const honest = imageDirective({ shown, place: false });
      assert.ok(honest.includes("already shows 2 real photographs"),
        "the object form no longer states the inventory, so this case has no discriminator");
      assert.ok(prompt.includes(esc(honest)),
        "the honest directive is not on the wire, verbatim: the writer was told something else");

      // (c) AND THE BUDGET IS STILL ZERO — that half must not have moved. This
      //     rung buys nothing; what changed is that the zero is stated as OURS
      //     rather than as a fact about the site.
      assert.ok(prompt.includes(esc("this change buys none")), "the zero is no longer stated");
    });
  } finally { c.uninstall(); }
});

test("an unreadable component store claims nothing about the pictures either way", async () => {
  // THE THIRD STATE, on the input that decides what a model believes about the
  // site it is editing. `photoInventory` answers `null` when the components
  // could not be read — a photograph can live in one since the band split — and
  // `shownPhotos` reads that as `known: false`, so the directive says *"Leave
  // every picture already on this site exactly as it is"* rather than naming a
  // count it cannot stand behind.
  //
  // WITHOUT THIS CASE the wire could pass `shownPhotos(imageSources(...))` with
  // the components silently missing, which reads as a SMALLER inventory — and a
  // smaller inventory is an invitation to strip whatever is not in it.
  const slug = "pix-unknown";
  const store = bucket(slug);
  const realGet = store.get.bind(store);
  store.get = async (k) => { if (k === SLUG_PARTS(slug)) throw new Error("R2 GET failed"); return realGet(k); };
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: keptBoth(slug) }], parts: [] },
    }, async (calls) => {
      await edit(slug, "change the opening hours to six", { store });
      const prompt = pagePrompt(calls);
      assert.ok(prompt, "the page writer was never called");
      const unknown = imageDirective({ shown: { known: false }, place: false });
      assert.ok(unknown.includes("Leave every picture already on this site exactly as it is"),
        "the unknown form no longer says what this case is about");
      assert.ok(prompt.includes(esc(unknown)), "an unreadable inventory did not reach the writer as cannot-tell");
      // AND IT DOES NOT CLAIM A COUNT. Naming one from the pages alone would
      // be a number about half the site presented as a number about all of it.
      assert.ok(!prompt.includes(esc("already shows 2 real photographs")),
        "a count was claimed over an inventory that could not be completed");
    });
  } finally { c.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PRESERVATION — a wording edit keeps the pictures
// ─────────────────────────────────────────────────────────────────────────────

test("a wording edit that loses the photographs is WITHHELD, not published", async () => {
  // THE DEFECT (reproduced at b9353187): the writer obeyed the false sentence,
  // both `src` attributes came back empty, the publish carried the stripped
  // page, the store kept it, and the reply said `photos: 0` with no field
  // naming the loss — over a request that asked in as many words to keep them.
  //
  // ⚠ RE-ANCHORED 2026-09-20, AND THE EXPECTATION IS THIS ROUND'S CORRECTION.
  // It asserted `status: 200` with the loss NAMED afterwards, which is what
  // the previous round shipped and is exactly what the owner sent back:
  // *"Do not publish the loss merely because matching failed."* A rewritten
  // description leaves the restoration nothing to match, so this request —
  // which says *"keep the photographs exactly as they are"* — now refuses.
  //
  // THE REPORTING CHAIN THIS CASE USED TO CARRY IS NOT LOST: an AUTHORISED
  // removal still publishes and still names the loss, driven through the real
  // picture rung in `test/edit-page-protect.test.mjs`.
  const slug = "pix-strip";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      // ⚠ THE DESCRIPTIONS ARE REWRITTEN TOO, SINCE 2026-09-20. A plain
      //   emptied `src` is PUT BACK by the protection, matched on the `alt`
      //   — so this case, written against that shape, would now be asserting
      //   a loss the route no longer allows. A rewritten description leaves
      //   nothing to match, which is the residue this reporting path exists
      //   for. `edit-page-protect.test.mjs` drives the protected shape.
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: strippedAndRenamed(slug) }], parts: [] },
    }, async () => {
      const { status, body, said } = await edit(slug, "change the opening hours to six, and keep the photographs exactly as they are", { store });

      // (a) IT REFUSES, AND NOT AS AN ESCALATE. `escalate` is what the browser
      //     turns into the ~25-credit rewrite of every page, which is the
      //     opposite of protecting two photographs.
      assert.equal(status, 409, "a loss the restoration could not reach was published: " + status + " " + JSON.stringify(body));
      assert.equal(body && body.ok, false, "a refusal reported success: " + JSON.stringify(body));
      assert.equal(body.error, "withheld", "the refusal cannot name itself: " + JSON.stringify(body.error));
      assert.equal(body.escalate, undefined, "the refusal escalates: " + JSON.stringify(body.escalate));
      assert.equal(body.cost, 0, "a refusal was charged for: " + JSON.stringify(body.cost));

      // (b) AND IT SAYS HOW MANY, as a COUNT. A storage key tells a customer
      //     nothing — `lostPhotosMsg`'s own rule, one path over.
      assert.equal(body.photosBlocked, 2,
        "the refusal does not say how many it held: " + JSON.stringify(body.photosBlocked));
      assert.ok(!JSON.stringify(body).includes(PIC_A(slug)),
        "the reply carries a storage key, which tells the customer nothing");

      // (c) NOTHING WAS BUILT AND NOTHING WAS WRITTEN — including the hours
      //     change, which is the stated cost of this rule rather than an
      //     oversight.
      assert.equal(c.calls.length, 0, "a refusal compiled the site: " + c.calls.length);
      assert.equal(storedHome(store, slug), homeWith(slug),
        "a refusal wrote to the page store — the ORIGINAL is what must still be there, not the answer");

      // (d) AND THE CUSTOMER'S OWN SENTENCE SAYS SO. Composed by the
      //     browser's real `editAnswer` selection, not retyped here.
      //
      //     ⚠ A FIELD THE BROWSER NEVER RENDERS IS THIS REPOSITORY'S OWN
      //     WIRING TRAP: a value computed and never forwarded, which from
      //     outside is indistinguishable from never having been computed. The
      //     reply half is asserted above; this is the hop.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(said.text.startsWith("\u26a0\ufe0f"), "a refusal was not drawn as one: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("2 photographs"),
        "the refusal does not say how many on screen: " + JSON.stringify(said.text));
      // ⚠ THE PROPERTY, NOT THE SPELLING (re-anchored 2026-09-21). The rung's
      //   own sentence no longer claims the whole site, because the identical
      //   sentence is printed beside a rung that SHIPPED — it ends at "so I
      //   didn't make it". The reassurance is true on a COMPLETE refusal and
      //   the browser adds it there, so what this asserts is that the customer
      //   is told, never which half of the reply tells them.
      assert.ok(said.text.includes("Nothing on your site changed"),
        "the customer is not told their site is untouched: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("take those photos off"),
        "the customer is not told how to authorise it: " + JSON.stringify(said.text));
    });
  } finally { c.uninstall(); }
});

test("a photograph living in a COMPONENT counts on both sides", async () => {
  // ⚠ SINCE THE BAND SPLIT A SECTION IS `src/routes/-parts/<name>.tsx`, so a
  // site's hero photograph can live in a component rather than on the page.
  // Every reader here has to take the PAIR: `imageSources(pages, parts)` is
  // the one definition of "every file a photograph can be in", and reading the
  // pages alone answers a SMALLER inventory — which is an invitation to strip
  // whatever is not in it, and makes a component's picture invisible to the
  // loss wall as well.
  //
  // FOUND BY A SWEEP MUTANT, and it was a real gap rather than an inert
  // mutation: every other case in this file puts both photographs on the page,
  // so cutting the parts out of the BEFORE changed nothing any of them could
  // see.
  const slug = "pix-part";
  const partWith = 'export default function Hero(){return <SafeImage src="' + PIC_B(slug) + '" alt="the window" />}';
  const pagePic = ROUTE_HEAD
    + 'import Hero from "./-parts/hero"\n'
    + "function Home(){return <main><h1>Ravenscroft</h1>"
    + '<SafeImage src="' + PIC_A(slug) + '" alt="the bench" />'
    + "<p>Nine until five.</p><Hero /></main>}\n";
  const store = bucket(slug, { home: pagePic, parts: [{ name: "hero", source: partWith }] });
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      // THE WRITER TOUCHES THE PAGE AND RETURNS NO COMPONENT, which is the
      // ordinary wording edit: the component is unchanged and the spine
      // re-sends the store's own copy.
      [SITE_PAGES_TOOL.name]: {
        pages: [{ path: "src/routes/index.tsx", source: pagePic.replace("Nine until five.", "Nine until six.") }],
        parts: [],
      },
    }, async (calls) => {
      const { body } = await edit(slug, "change the opening hours to six", { store });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // (a) THE PROMPT COUNTS BOTH. Reading the pages alone would say ONE, and
      //     a writer told the site shows one picture has no reason to keep the
      //     other.
      const prompt = pagePrompt(calls);
      const both = shownPhotos(
        [{ path: "index.tsx", source: pagePic }, { path: "-parts/hero.tsx", source: partWith }],
        slug,
      );
      assert.equal(both.count, 2, "the fixture does not put a photograph in the component: " + JSON.stringify(both));
      assert.ok(prompt.includes(esc("already shows 2 real photographs")),
        "the component's photograph is invisible to the prompt: " + JSON.stringify(prompt.slice(0, 0)) + " (count was not 2)");

      // (b) AND NOTHING WAS REPORTED LOST. The component is untouched on both
      //     sides, so a BEFORE that could not see it would read its picture as
      //     appearing from nowhere — or, the other way round, as lost.
      assert.equal(body.photosRemoved, undefined,
        "an untouched component's photograph was reported as lost: " + JSON.stringify(body.photosRemoved));
      assert.equal(body.photos, 0, "an untouched component's photograph was counted as a new space: " + body.photos);
    });
  } finally { c.uninstall(); }
});

test("a photograph stripped out of a COMPONENT is withheld too", async () => {
  // ⚠ THE DISCRIMINATING HALF, and the case above is not it. There both
  // pictures survive, so a BEFORE that reads the pages alone answers a smaller
  // set and still loses nothing — `keptImages` only reports what was in the
  // BEFORE and is not in the AFTER, and `newEmptySlots` counts EMPTY frames,
  // which a filled `src` is not. Measured: a sweep mutant cutting the parts out
  // of the BEFORE survived that case.
  //
  // So the photograph has to be in a component AND be lost. Unmutated the
  // before holds both and the loss is one; with the pages alone the before
  // holds one, the after holds the same one, and nothing is reported.
  const slug = "pix-part-lost";
  const partWith = 'export default function Hero(){return <SafeImage src="' + PIC_B(slug) + '" alt="the window" />}';
  // ⚠ THE DESCRIPTION IS REWRITTEN TOO, SINCE 2026-09-20 — see
  //   `strippedAndRenamed` above. A plain emptied `src` is PUT BACK now,
  //   matched on the `alt`, and that applies inside a component exactly as
  //   it does on a page. What this case is about is unchanged: only a
  //   BEFORE that reads the components can see this loss at all.
  const partBare = 'export default function Hero(){return <SafeImage src="" alt="the front window" />}';
  const pagePic = ROUTE_HEAD
    + 'import Hero from "./-parts/hero"\n'
    + "function Home(){return <main><h1>Ravenscroft</h1>"
    + '<SafeImage src="' + PIC_A(slug) + '" alt="the bench" />'
    + "<p>Nine until five.</p><Hero /></main>}\n";
  const store = bucket(slug, { home: pagePic, parts: [{ name: "hero", source: partWith }] });
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: {
        pages: [{ path: "src/routes/index.tsx", source: pagePic.replace("Nine until five.", "Nine until six.") }],
        parts: [{ name: "hero", source: partBare }],
      },
    }, async () => {
      const { status, body, said } = await edit(slug, "change the opening hours to six, and keep the photographs", { store });
      // ⚠ IT REFUSES SINCE 2026-09-20 — see the contract note at the top of
      // this file. What this case is about has NOT moved: only a BEFORE that
      // reads the components can see this loss at all, and a pages-only
      // reader publishes it in silence either way.
      assert.equal(status, 409, "a loss the restoration could not reach was published: " + status + " " + JSON.stringify(body));
      assert.equal(body && body.ok, false, "a refusal reported success: " + JSON.stringify(body));
      assert.equal(body.error, "withheld", "the refusal cannot name itself: " + JSON.stringify(body.error));
      assert.equal(body.escalate, undefined, "the refusal escalates: " + JSON.stringify(body.escalate));
      assert.equal(body.cost, 0, "a refusal was charged for: " + JSON.stringify(body.cost));

      // THE LOSS IS THE COMPONENT'S, and only a BEFORE that read the
      // components can see it — so this count is the whole discriminator.
      assert.equal(body.photosBlocked, 1,
        "a photograph stripped out of a component was not detected: " + JSON.stringify(body.photosBlocked));

      // AND NOTHING SHIPPED, on either list. The store keeps its own copy of
      // the component, which is what makes the next edit start from a site
      // that still has its picture.
      assert.equal(c.calls.length, 0, "a refusal compiled the site: " + c.calls.length);
      assert.equal(storedHome(store, slug), pagePic, "a refusal wrote to the page store");
      assert.equal(JSON.parse(store.store.get(SLUG_PARTS(slug)))[0].source, partWith,
        "a refusal wrote the stripped component to the store");

      // AND THE SCREEN SAYS SO.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(said.text.startsWith("\u26a0\ufe0f"), "a refusal was not drawn as one: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("a photograph"),
        "the component's loss never reached the screen: " + JSON.stringify(said.text));
      // ⚠ THE PROPERTY, NOT THE SPELLING (re-anchored 2026-09-21). The rung's
      //   own sentence no longer claims the whole site, because the identical
      //   sentence is printed beside a rung that SHIPPED — it ends at "so I
      //   didn't make it". The reassurance is true on a COMPLETE refusal and
      //   the browser adds it there, so what this asserts is that the customer
      //   is told, never which half of the reply tells them.
      assert.ok(said.text.includes("Nothing on your site changed"),
        "the customer is not told their site is untouched: " + JSON.stringify(said.text));
    });
  } finally { c.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. AUTHORISED REMOVAL — which must keep working
// ─────────────────────────────────────────────────────────────────────────────

test("an explicitly requested removal takes the picture off and PUBLISHES", async () => {
  // ⚠ THE CASE THAT BOUNDS THE REFUSAL, and it is the half the two above
  // cannot prove: a rung that simply refused every loss would satisfy both of
  // them and leave this product unable to take a photograph off a page.
  //
  // ⚠ RE-ANCHORED 2026-09-20 ONTO THE DOOR THE ROUTER REALLY USES. It drove a
  // bare `layer: "page"` POST and expected the page rung to authorise the
  // removal from the customer's sentence — which is the `ePhotoAsk` shape the
  // owner sent back: a judgement about the MESSAGE, made by a rung that
  // cannot see which picture was meant. *"Scope permission to the actual
  // matched picture operations."*
  //
  // THOSE OPERATIONS LIVE IN THE PICTURE RUNG. `pick_lanes` reads the
  // message, the `images` lane dispatches to `picture`, and that rung matches
  // the customer's words to a slot by its `alt` and publishes through
  // `publishStep` — which advances `eSrc`. So the removal IS the state, and
  // nothing downstream has to re-derive an intention from prose.
  assert.equal(laneLayer("images"), "picture",
    "this case's whole premise is that the images lane dispatches to `picture`");
  const slug = "pix-remove";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      // `layer: "look"` IS WHAT OPENS THE LANE SYSTEM — `pick_lanes` runs
      // above the layer dispatch and is the front door for all of it.
      pick_lanes: { fields: ["images"] },
      [PICTURE_TOOL.name]: { pictures: [{ page: "index.tsx", alt: "the window", clear: true }] },
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
    }, async () => {
      const { status, body } = await edit(slug, "take the window photo off the front page", { store, layer: "look" });
      assert.equal(status, 200, "an authorised removal was refused: " + status + " " + JSON.stringify(body));
      assert.equal(body && body.ok, true, "an authorised removal did not publish: " + JSON.stringify(body));

      // THE ONE THEY NAMED IS GONE AND THE OTHER IS UNTOUCHED.
      assert.deepEqual(picsIn(sentHome(c), slug), [PIC_A(slug)],
        "the removal did not leave exactly the other photograph: " + JSON.stringify(picsIn(sentHome(c), slug)));
      assert.deepEqual(picsIn(storedHome(store, slug), slug), [PIC_A(slug)],
        "the store does not hold exactly the other photograph");
      // AND IT IS NOT WITHHELD. The refusal the two cases above assert is the
      // one thing that must not fire here.
      assert.notEqual(body.error, "withheld", "an authorised removal was withheld");
    });
  } finally { c.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE EMPTY FRAME NOBODY IS TOLD ABOUT
// ─────────────────────────────────────────────────────────────────────────────

test("a page edit that adds an empty picture frame says so", async () => {
  // THE BACKLOG'S OWN OPEN ITEM. `photos` was `countImageSlots(...)`, which
  // counts `@@IMG:` TOKENS on a rung whose directive forbids them — so it was
  // zero on every obedient answer and `photoNote` never fired. A customer left
  // looking at a new empty frame had no way to know it was theirs to fill.
  //
  // `newEmptySlots(before, after)` is the reader the addon path already uses:
  // per page, only the increase, negative never subtracting.
  const slug = "pix-frame";
  // A site with NO photographs, so the frame the writer adds is unambiguously
  // new rather than one it emptied.
  const plain = ROUTE_HEAD + "function Home(){return <main><h1>Ravenscroft</h1><p>Nine until five.</p></main>}\n";
  const withFrame = plain
    .replace("Nine until five.", "Nine until six.")
    .replace("</main>", '<SafeImage src="" alt="the bench" /></main>');
  const store = bucket(slug, { home: plain });
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: withFrame }], parts: [] },
    }, async () => {
      const { body } = await edit(slug, "hours to six, and leave room for a photo of the bench", { store });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));
      assert.ok(sentHome(c).includes('src=""'), "the publish carried no empty frame, so this case is about nothing");
      assert.equal(body.photos, 1, "the new empty frame was not counted: " + body.photos);
      // AND NOTHING WAS LOST, so the other field stays absent. Its PRESENCE is
      // the signal, so a case that adds a frame must not also report a loss.
      assert.equal(body.photosRemoved, undefined,
        "an edit that lost no photograph reported one: " + JSON.stringify(body.photosRemoved));
    });
  } finally { c.uninstall(); }
});

test("a page edit that adds nothing and loses nothing reports neither", async () => {
  // THE SILENCE THAT MAKES THE TWO FIELDS SIGNALS. Both are omitted when
  // empty, so an ordinary page edit's reply is byte-identical to what it was
  // — without this case, a rung that reported `0` and `0` on every edit would
  // pass every assertion above and add a sentence to every reply.
  const slug = "pix-quiet";
  const plain = ROUTE_HEAD + "function Home(){return <main><h1>Ravenscroft</h1><p>Nine until five.</p></main>}\n";
  const store = bucket(slug, { home: plain });
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: plain.replace("five", "six") }], parts: [] },
    }, async () => {
      const { body } = await edit(slug, "hours to six", { store });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));
      assert.equal(body.photos, 0, "a quiet edit reported a picture space: " + body.photos);
      assert.equal(body.photosRemoved, undefined, "a quiet edit reported a loss: " + JSON.stringify(body.photosRemoved));
    });
  } finally { c.uninstall(); }
});
