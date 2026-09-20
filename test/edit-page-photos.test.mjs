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
import { browserReply } from "../scripts/addon-sweep.mjs";

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
  return { status: res.status, body, said: browserReply(body, res.ok) };
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

test("REPRODUCTION A: the page writer is told this site has no photographs, on a site showing two", async () => {
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

      // THE SENTENCE, FROM ITS REAL PRODUCER — so a reworded directive cannot
      // read as a fixed defect, and a fixed defect cannot read as a rewording.
      const bare = imageDirective(0);
      assert.ok(bare.includes("none on this site"), "the bare-zero directive no longer says what this case is about");
      assert.ok(prompt.includes(esc(bare)),
        "expected the reproduction: the bare-zero directive, verbatim, on a site showing two photographs");

      // AND THE HONEST ALTERNATIVE IS ABSENT. `shownPhotos` reads the site's
      // real pictures and `imageDirective`'s object form states the budget as
      // OURS rather than as a fact about the site — the addon's own shape.
      //
      // ⚠ THE DISCRIMINATOR IS THE DIRECTIVE'S OWN SENTENCE, NOT THE URLS. A
      // first draft asserted the picture urls were absent from the prompt and
      // failed, correctly: the site's own page SOURCE is sent as the prior
      // page and carries every `src` it draws. So a url in the prompt says
      // nothing about whether the writer was TOLD the pictures are real and
      // must stay — which is the whole of what is missing.
      const shown = shownPhotos([{ path: "index.tsx", source: homeWith(slug) }], slug);
      assert.equal(shown.count, 2, "the fixture does not show two photographs: " + JSON.stringify(shown));
      const honest = imageDirective({ shown });
      assert.ok(honest.includes("already shows 2 real photographs"),
        "the object form no longer states the inventory, so this case has no discriminator");
      assert.ok(!prompt.includes(esc("already shows 2 real photographs")),
        "the writer is already told the site's photographs are real — this reproduction is stale");
      assert.ok(!prompt.includes(esc("they stay exactly as they are")),
        "the writer is already told to keep them — this reproduction is stale");
    });
  } finally { c.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PRESERVATION — a wording edit keeps the pictures
// ─────────────────────────────────────────────────────────────────────────────

test("REPRODUCTION B: a wording edit that strips both photographs publishes and reports nothing", async () => {
  // The defect end to end: the writer obeys the sentence above, both `src`
  // attributes come back empty, the publish carries the stripped page, the
  // store keeps it, and the reply says `photos: 0` with no word about the loss.
  const slug = "pix-strip";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: strippedBoth(slug) }], parts: [] },
    }, async () => {
      const { body, said } = await edit(slug, "change the opening hours to six, and keep the photographs exactly as they are", { store });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // (a) THE COMPILER PAYLOAD — both pictures gone.
      assert.deepEqual(picsIn(sentHome(c), slug), [],
        "expected the reproduction: the publish still carried the photographs");

      // (b) THE STORE — and the loss is permanent.
      assert.deepEqual(picsIn(storedHome(store, slug), slug), [],
        "expected the reproduction: the stored source still carries the photographs");

      // (c) THE REPLY — `photos` counts TOKENS, and the directive forbids
      //     tokens, so an obedient answer is always zero.
      assert.equal(body.photos, 0, "the token counter is no longer zero on an obedient answer: " + body.photos);
      assert.equal(body.lostPhotos, undefined, "a lostPhotos field already exists on this rung");

      // (d) AND THE CUSTOMER'S SENTENCE IS A FLAT SUCCESS over a page that
      //     just lost two photographs they asked to keep.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.equal(said.text, "✅ Done.",
        "the customer's sentence is not the flat success this reproduction is about: " + JSON.stringify(said.text));
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

test("REPRODUCTION C: a page edit that adds an empty picture frame reports no space at all", async () => {
  // The backlog's own open item: `pSlots = countImageSlots(...)` counts
  // `@@IMG:` tokens on a rung whose directive forbids them, so `photoNote` is
  // silent on every obedient answer — and a customer left looking at a new
  // empty frame has no way to know it is theirs to fill.
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
      // THE FRAME REALLY SHIPPED.
      assert.ok(sentHome(c).includes('src=""'), "the publish carried no empty frame, so this case is about nothing");
      // AND THE COUNT IS ZERO, because it counts the wrong thing.
      assert.equal(body.photos, 0,
        "expected the reproduction: the token counter reported " + body.photos + " for an empty frame");
    });
  } finally { c.uninstall(); }
});
