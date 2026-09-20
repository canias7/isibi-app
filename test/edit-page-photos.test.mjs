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
// ⚠ THE PRESERVATION CONTRACT IS **NOT** THE ADDON'S HERE, and that is the
// whole design of this stage. The addon REFUSES 422 `lost-photos` — right for
// a step whose contract is "an addition is always a new thing", and wrong for
// an edit, where "take that photo off the front page" is an ordinary request.
// So loss is DETECTED and REPORTED, never refused: the `orderingMoved` /
// `alsoOn` precedent one field over in the same reply.

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { imageDirective, shownPhotos } from "../builder/site-images.mjs";
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

/** One picture deliberately taken off, the other kept — an authorised removal. */
const removedOne = (slug) => homeWith(slug)
  .replace('<SafeImage src="' + PIC_B(slug) + '" alt="the window" />', "");

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

test("a wording edit that loses the photographs NAMES the loss on the reply", async () => {
  // THE DEFECT (reproduced at b9353187): the writer obeyed the false sentence,
  // both `src` attributes came back empty, the publish carried the stripped
  // page, the store kept it, and the reply said `photos: 0` with no field
  // naming the loss — over a request that asked in as many words to keep them.
  //
  // ⚠ WHAT IT DOES NOW IS **REPORT**, NOT REFUSE, and that line is the whole
  // of Stage 2's design. The addon answers a lost photograph with 422
  // `lost-photos` at cost 0 — right for a step whose contract is "an addition
  // is always a new thing" — and applying that here would refuse *"take the
  // window photo off the front page"*, which is an ordinary edit. The case
  // below this one is the other side of that line and must stay green.
  //
  // So this asserts BOTH halves: it still publishes, AND the customer is told.
  const slug = "pix-strip";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: strippedBoth(slug) }], parts: [] },
    }, async () => {
      const { status, body, said } = await edit(slug, "change the opening hours to six, and keep the photographs exactly as they are", { store });

      // (a) IT PUBLISHES. Not a 422 — the customer's change is not held
      //     hostage to a reader's opinion about their pictures.
      assert.equal(status, 200, "a lost photograph was REFUSED: " + status + " " + JSON.stringify(body));
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // (b) AND THE LOSS IS NAMED, as a COUNT. A storage key tells a customer
      //     nothing (`lostPhotosMsg`'s own rule); the number is what they can
      //     act on.
      assert.equal(body.photosRemoved, 2,
        "the reply does not name the two lost photographs: " + JSON.stringify(body.photosRemoved));
      assert.ok(!JSON.stringify(body).includes(PIC_A(slug)),
        "the reply carries a storage key, which tells the customer nothing");

      // (c) AND THE EMPTY FRAMES ARE COUNTED. Two pictures became two
      //     placeholders, so there really are two spaces where a photograph
      //     was — the reader the addon path uses, on the rung that lacked it.
      assert.equal(body.photos, 2, "the empty frames left behind were not counted: " + body.photos);

      // (d) AND THE CUSTOMER'S OWN SENTENCE SAYS SO. Composed by the
      //     browser's real `addonAnswer`, not retyped here. It still opens as
      //     a success, because it is one — the page change shipped — and the
      //     two clauses beside it are the record: what was lost, and what is
      //     standing where it was.
      //
      //     ⚠ A FIELD THE BROWSER NEVER RENDERS IS THIS REPOSITORY'S OWN
      //     WIRING TRAP: a value computed and never forwarded, which from
      //     outside is indistinguishable from never having been computed. The
      //     reply half is asserted above; this is the hop.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(said.text.startsWith("\u2705 Updated /."),
        "the customer's sentence does not name the page it changed: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("2 photographs are no longer on that page"),
        "the loss never reached the screen: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("put the photos back"),
        "the customer is told what was lost and not what to do about it: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("2 spaces for a photo"),
        "the empty frames left behind never reached the screen: " + JSON.stringify(said.text));
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

test("a photograph stripped out of a COMPONENT is detected too", async () => {
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
  const partBare = 'export default function Hero(){return <SafeImage src="" alt="the window" />}';
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
      // IT STILL PUBLISHES — the edit path reports, it does not refuse.
      assert.equal(status, 200, "a lost photograph in a component was REFUSED: " + status + " " + JSON.stringify(body));
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // THE LOSS IS THE COMPONENT'S, and only a BEFORE that read the
      // components can see it.
      assert.equal(body.photosRemoved, 1,
        "a photograph stripped out of a component was not detected: " + JSON.stringify(body.photosRemoved));
      // AND THE FRAME IT LEFT IS COUNTED — the same pair, one reader over.
      assert.equal(body.photos, 1, "the empty frame left in the component was not counted: " + body.photos);
      // AND THE SCREEN SAYS BOTH.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(said.text.includes("One photograph is no longer on that page"),
        "the component's loss never reached the screen: " + JSON.stringify(said.text));
    });
  } finally { c.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. AUTHORISED REMOVAL — which must keep working
// ─────────────────────────────────────────────────────────────────────────────

test("an explicitly requested removal takes the picture off and PUBLISHES", async () => {
  // ⚠ THE CASE THAT BOUNDS THE FIX. The addon's contract refuses a publish that
  // loses a photograph (422 `lost-photos`, cost 0), which is right for a step
  // whose whole subject is adding and wrong here: "take the window photo off
  // the front page" is an ordinary edit, and a rung that refuses it is a rung
  // that cannot do its job.
  //
  // Asserted BEFORE the fix as well as after, so the fix cannot quietly import
  // the addon's refusal.
  const slug = "pix-remove";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: removedOne(slug) }], parts: [] },
    }, async () => {
      const { status, body } = await edit(slug, "take the window photo off the front page", { store });
      assert.equal(status, 200, "an authorised removal was refused: " + status + " " + JSON.stringify(body));
      assert.equal(body && body.ok, true, "an authorised removal did not publish: " + JSON.stringify(body));

      // THE ONE THEY NAMED IS GONE AND THE OTHER IS UNTOUCHED.
      assert.deepEqual(picsIn(sentHome(c), slug), [PIC_A(slug)],
        "the removal did not leave exactly the other photograph: " + JSON.stringify(picsIn(sentHome(c), slug)));
      assert.deepEqual(picsIn(storedHome(store, slug), slug), [PIC_A(slug)],
        "the store does not hold exactly the other photograph");
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
