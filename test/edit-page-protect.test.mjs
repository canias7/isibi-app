// WHAT THE EDIT PATH PROTECTS, AND WHAT IT REFUSES TO CALL A NO-CHANGE.
//
// Three defects, each reproduced through `POST /api/site/<slug>/edit` with the
// wire stubbed and the opt-in compiler installed, before anything moved.
// Nothing here reaches a model and nothing is spent.
//
//   1. A PHOTOGRAPH THE MESSAGE NEVER MENTIONED CAME OFF THE PAGE, and the
//      reply named the loss afterwards. Reporting is not preservation:
//      *"keep the window photograph and tighten the heading"* published
//      `src=""`. It is put back now — and an AUTHORISED removal still goes
//      through, which is the half that makes this a protection rather than a
//      ban.
//
//   2. EVERY ONE OF THOSE WARNINGS VANISHED ON A MULTI-RUNG MESSAGE.
//      `components` and `tsx` both dispatch to the page rung, so one sentence
//      runs it twice — and the merged reply's `layer` is then `"look"`, a
//      branch of `editReply` that never read any of them. The facts were on
//      the wire and none of them on the screen.
//
//   3. A COMPONENT THE WALL WITHHELD READ AS "the site already does that".
//      The page came back unchanged because the only change was one we
//      refused to make, and `escalate("no-change")` is what the browser turns
//      into the ~25-credit rewrite of every page — with no sentence saying
//      why.
//
// WHAT EVERY CASE ASSERTS: the COMPILER PAYLOAD, the STORED SOURCE, the reply,
// and the CUSTOMER'S SCREEN — composed by `public/chat.js`'s own `editAnswer`
// selection, including whether another paid action would start.

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL, MAX_PART_CHARS } from "../builder/page-gen.mjs";
import { PICTURE_TOOL, newEmptySlots } from "../builder/site-picture.mjs";
import { keptImages, keepPhotos, photoUrls } from "../builder/site-images.mjs";
import { laneLayer } from "../builder/site-lanes.mjs";
// ⚠ `editBrowserReply`, NOT `browserReply`. The add composer answers a
// PLAUSIBLE sentence for an edit body rather than throwing, so a guard pinned
// to it passes whatever the edit screen really says.
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const USER = { id: "u-editprot-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";

const SRC_KEY = (slug) => "source/" + String(slug).toLowerCase() + "/pages.json";
const PARTS_KEY = (slug) => "source/" + String(slug).toLowerCase() + "/parts.json";

// ⚠ THE ROUTE EXPORT IS LOAD-BEARING: `validatePages` refuses a page without
// `createFileRoute(`, so a hand-spelled page in any other shape reads to this
// rung as the model declining and escalates `no-page-back` — the reproduction
// then passes for a reason that has nothing to do with its subject.
const ROUTE_HEAD = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n"
  + "import { SafeImage } from '@/components/ui/safe-image'\n";

// TWO REAL PHOTOGRAPHS at `/u/<slug>/<hash>.jpg` — the shape `photoUrls` and
// `imageSlots` really match, rather than strings that look like them.
const PIC_A = (slug) => "/u/" + slug + "/a1b2c3d4e5f60718.jpg";
const PIC_B = (slug) => "/u/" + slug + "/b2c3d4e5f6071829.jpg";

const homeWith = (slug) => ROUTE_HEAD
  + 'import CardA from "./-parts/card-a"\n'
  + 'import CardB from "./-parts/card-b"\n'
  + "function Home(){return <main><h1>Ravenscroft</h1>"
  + '<SafeImage src="' + PIC_A(slug) + '" alt="the bench" />'
  + "<p>Nine until five.</p>"
  + '<SafeImage src="' + PIC_B(slug) + '" alt="the window" />'
  + "<CardA /><CardB /></main>}\n";

/** The same page, words changed, BOTH pictures emptied — the defect's output. */
const strippedBoth = (slug) => homeWith(slug)
  .replace("Nine until five.", "Nine until six.")
  .replace('src="' + PIC_A(slug) + '"', 'src=""')
  .replace('src="' + PIC_B(slug) + '"', 'src=""');

const A_OLD = 'export default function CardA(){return <section data-slot="card"><h2>Opening hours</h2></section>}';
const A_NEW = 'export default function CardA(){return <section data-slot="card"><h2>When we are open</h2></section>}';
// ⚠ DERIVED FROM THE REAL BOUND, never a number typed here. `partsSent`
// withholds a component whose source will not fit, and a fixture sized by hand
// stops being oversized the day the bound moves — the check then passes while
// proving nothing.
const B_BIG = 'export default function CardB(){return <section data-slot="card"><h2>Where to find us</h2><p>'
  + "x".repeat(MAX_PART_CHARS + 500) + "</p></section>}";
const B_NEW = 'export default function CardB(){return <section data-slot="card"><h2>How to find us</h2></section>}';

const STORED_CSS = ":root{--background:oklch(100% 0 0)}";
const STORED_LOOK = {
  brand: "Ravenscroft",
  theme: "broadsheet",
  tsx: [
    { name: "card-a", does: "the opening hours card", props: "none" },
    { name: "card-b", does: "the address card", props: "none" },
  ],
};

function bucket(slug, { home = homeWith(slug), parts = [{ name: "card-a", source: A_OLD }, { name: "card-b", source: A_OLD }] } = {}) {
  const store = new Map([
    [SRC_KEY(slug), JSON.stringify([{ path: "index.tsx", source: home }])],
    [PARTS_KEY(slug), JSON.stringify(parts)],
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

/**
 * Every model request this edit made, with the tool it asked for.
 *
 * A TOOL WITH NO STUB IS REFUSED rather than given a plausible answer: a stub
 * more capable than the real thing hides bugs exactly like one that is less.
 * An answer may be a FUNCTION of how many times that tool has been asked, which
 * is what lets one message drive the page rung twice with two different answers.
 */
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
      const a = answers[tool];
      const nth = calls.filter((c) => c.tool === tool).length - 1;
      return new Response(JSON.stringify({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", name: tool, input: typeof a === "function" ? a(nth) : a }],
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
  // `res.ok` TRAVELS WITH THE BODY. `{ok:false}` at a 200 and `{ok:true}` at a
  // 503 are different screens and only the pair separates them.
  return { status: res.status, body, said: editBrowserReply(body, res.ok) };
}

/** The home page the publish spine really sent, off the compiler payload. */
function sentHome(c) {
  assert.ok(c.calls.length >= 1, "nothing was compiled at all");
  const files = (c.calls[c.calls.length - 1].body || {}).files || {};
  const key = Object.keys(files).find((k) => /index\.tsx$/.test(k));
  assert.ok(key, "the compiler payload has no home page: " + JSON.stringify(Object.keys(files)));
  return files[key];
}

/** What `source/<slug>/pages.json` holds afterwards, home page only. */
function storedHome(store, slug) {
  const raw = store.store.get(SRC_KEY(slug));
  if (raw === undefined) return null;
  const p = JSON.parse(raw).find((x) => /index\.tsx$/.test(x.path));
  return p ? p.source : null;
}

/** What `source/<slug>/parts.json` holds afterwards, as `{name: source}`. */
function storedParts(store, slug) {
  const raw = store.store.get(PARTS_KEY(slug));
  if (raw === undefined) return null;
  const out = {};
  for (const p of JSON.parse(raw)) out[p.name] = p.source;
  return out;
}

const pics = (source, slug) => [...photoUrls(source, slug)].sort();

/**
 * EVERY ACTION THE BROWSER WOULD START THAT COSTS SOMETHING.
 *
 * ⚠ AN ALLOW-LIST, NOT A PATTERN OVER THE PROSE. `editBrowserReply` records
 * what the page would do, and a SUCCESS always does two local things — bump the
 * credit chip and save its own site list — neither of which leaves the browser.
 * Naming those two and treating everything else as paid is the safe direction:
 * an action added to that harness next month shows up here as spend rather than
 * being matched away by a regex nobody updated.
 *
 * (My first draft asserted `actions` was EMPTY on a success, and all three
 * success cases failed on `refresh the credit balance` — the assertion was
 * wrong, not the route.)
 */
const HOUSEKEEPING = ["refresh the credit balance", "write the browser's own stored site list"];
const paidActions = (said) => (said.actions || []).filter((a) => !HOUSEKEEPING.includes(a));

// ─────────────────────────────────────────────────────────────────────────────
// 1. A PHOTOGRAPH NOBODY ASKED ABOUT GOES BACK
// ─────────────────────────────────────────────────────────────────────────────

test("an unrelated edit that empties a `src` publishes the photograph, not the loss", async () => {
  // THE DEFECT: the writer returns `<SafeImage src="" alt="the window" />` on a
  // message that asked for the heading and said in as many words to keep the
  // picture. Before this the empty attribute was PUBLISHED and the reply
  // carried `photosRemoved: 2` — a sentence about a change nobody wanted,
  // arriving after the change had shipped.
  const slug = "prot-keep";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: strippedBoth(slug) }], parts: [] },
    }, async () => {
      const { body, said } = await edit(slug, "keep both photographs exactly as they are and change the opening hours to six", { store });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // (a) THE COMPILER PAYLOAD. Both urls are back in the file the container
      //     was handed — so what compiled is the page with its photographs.
      const sent = sentHome(c);
      assert.deepEqual(pics(sent, slug), [PIC_A(slug), PIC_B(slug)].sort(),
        "the publish carried a page with the photographs stripped: " + JSON.stringify(pics(sent, slug)));
      // AND THE ASKED-FOR CHANGE IS STILL THERE. A protection that reverted the
      // file would satisfy the line above and lose the customer's edit — the
      // opposite failure, and the one worth pinning.
      assert.ok(sent.includes("Nine until six."),
        "the edit itself was thrown away by the protection: " + JSON.stringify(sent.slice(0, 200)));
      assert.ok(!sent.includes("Nine until five."), "the stored wording survived a change that replaced it");

      // (b) THE STORED SOURCE agrees, so the next edit starts from a site that
      //     still has its pictures.
      assert.deepEqual(pics(storedHome(store, slug), slug), [PIC_A(slug), PIC_B(slug)].sort(),
        "the store kept the stripped page");

      // (c) THE REPLY REPORTS NO LOSS, because there was none — and says what
      //     it held, which is the only way the customer can tell the builder
      //     nearly took them off.
      assert.equal(body.photosRemoved, undefined,
        "a loss was reported on a publication that kept both: " + JSON.stringify(body.photosRemoved));
      assert.equal(body.photosKept, 2, "the protection's own count is wrong: " + JSON.stringify(body.photosKept));
      assert.equal(body.photos, 0, "an empty frame was counted on a page whose pictures are all filled");

      // (d) THE SCREEN. No "put the photos back", because nothing came off.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(!said.text.includes("no longer on the site"),
        "the customer was told about a loss that did not happen: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("still there"),
        "the protection never reached the screen: " + JSON.stringify(said.text));
      assert.deepEqual(paidActions(said), [], "something paid was started: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("a message that IS about the pictures still removes them", async () => {
  // THE OTHER HALF, and without it the fix above is a ban rather than a
  // protection. The model answer is BYTE-IDENTICAL to the case above; the only
  // difference is what the message asked for, so this is an A/B on the one
  // input that decides.
  //
  // THE SIGNAL IS THE PICKER'S OWN ANSWER. `laneLayer("images")` is `picture`,
  // so a message the picker reads as being about photographs gets a step at
  // that layer — and the page rung asks for the layer rather than keeping its
  // own list of which fields are about pictures.
  assert.equal(laneLayer("images"), "picture",
    "this case's whole premise is that the images lane dispatches to `picture`");
  const slug = "prot-authorised";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      // ⚠ `layer: "look"` IS WHAT OPENS THE LANE SYSTEM. `pick_lanes` runs
      // above the layer dispatch and is the front door for all of it.
      pick_lanes: { fields: ["images", "shape"] },
      [PICTURE_TOOL.name]: { pictures: [{ page: "index.tsx", alt: "the window", clear: true }] },
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: strippedBoth(slug) }], parts: [] },
    }, async () => {
      const { body, said } = await edit(slug, "take the window photo off and lay the front page out in two columns", { store, layer: "look" });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // (a) THE PUBLICATION HAS NEITHER. The same answer that was protected
      //     above ships as written here.
      assert.deepEqual(pics(sentHome(c), slug), [],
        "an authorised removal was undone by the protection: " + JSON.stringify(pics(sentHome(c), slug)));
      assert.deepEqual(pics(storedHome(store, slug), slug), [], "the store kept a picture the customer asked to remove");

      // (b) NOTHING WAS RESTORED, and the loss is reported the way it always
      //     was — this rung reports, it does not refuse. The addon's 422 is
      //     deliberately not here.
      assert.equal(body.photosKept, undefined,
        "the protection acted on a message that asked about the pictures: " + JSON.stringify(body.photosKept));
      assert.equal(body.photosRemoved, 2, "the loss was not reported: " + JSON.stringify(body.photosRemoved));
      assert.notEqual(body.error, "lost-photos", "this rung refused instead of reporting");

      // (c) THE SCREEN NAMES IT, and starts nothing.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(said.text.includes("2 photographs are no longer on the site"),
        "the loss never reached the screen: " + JSON.stringify(said.text));
      assert.deepEqual(paidActions(said), [], "something paid was started: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("the restoration is by description, and it refuses to guess", () => {
  // THE MODULE, DRIVEN DIRECTLY, for the four cases a route test cannot reach
  // cheaply. Each is a refusal to guess rather than a capability.
  const slug = "fw";
  const url = "/u/fw/aaaabbbbccccdddd.jpg";
  const one = (body) => [{ path: "index.tsx", source: ROUTE_HEAD + "function Home(){return <main>" + body + "</main>}\n" }];

  // (a) THE ORDINARY CASE: emptied, and put back.
  const back = keepPhotos(
    one('<SafeImage src="' + url + '" alt="the bench" />'),
    one('<SafeImage src="" alt="the bench" />'),
    slug,
  );
  assert.deepEqual(back.restored, [url], "the ordinary restoration did not happen");
  assert.ok(back.files[0].source.includes('src="' + url + '"'), "the url is not in the file");

  // (b) A DIFFERENT PICTURE IS AN ANSWER, NOT A LOSS. Overwriting it would be
  //     this function editing the change rather than protecting what was there.
  const other = "/u/fw/1111222233334444.jpg";
  const swapped = keepPhotos(
    one('<SafeImage src="' + url + '" alt="the bench" />'),
    one('<SafeImage src="' + other + '" alt="the bench" />'),
    slug,
  );
  assert.deepEqual(swapped.restored, [], "a deliberate replacement was overwritten");

  // (c) AN EXPRESSION IS NOT OUR SLOT — `src={row.photo}` is a picture the
  //     site's own data decides, and a literal written over it drops the
  //     binding.
  const bound = keepPhotos(
    one('<SafeImage src="' + url + '" alt="the bench" />'),
    one("<SafeImage src={row.photo} alt=\"the bench\" />"),
    slug,
  );
  assert.deepEqual(bound.restored, [], "a data binding was overwritten with a literal");

  // (d) AN AMBIGUOUS DESCRIPTION IS SKIPPED. Two empty slots sharing one `alt`
  //     cannot say which is the one that had the picture.
  const twice = keepPhotos(
    one('<SafeImage src="' + url + '" alt="the bench" />'),
    one('<SafeImage src="" alt="the bench" /><SafeImage src="" alt="the bench" />'),
    slug,
  );
  assert.deepEqual(twice.restored, [], "an ambiguous description was guessed at");

  // (e) ⚠ AND A PHOTOGRAPH THE ANSWER MOVED IS NEVER PUT BACK. `keptImages` is
  //     site-wide on purpose — a writer moving a `<SafeImage>` into a component
  //     has kept every picture the site shows — so a per-file restoration would
  //     meet that legitimate move and publish the photograph TWICE.
  const moved = keepPhotos(
    [{ path: "index.tsx", source: 'x<SafeImage src="' + url + '" alt="the bench" />' },
      { path: "about.tsx", source: "y" }],
    [{ path: "index.tsx", source: 'x<SafeImage src="" alt="the bench" />' },
      { path: "about.tsx", source: 'y<SafeImage src="' + url + '" alt="the bench" />' }],
    slug,
  );
  assert.deepEqual(moved.restored, [], "a moved photograph was duplicated back into the page it left");
  assert.equal(keptImages(moved.files, moved.files, slug).ok, true, "the move reads as a loss");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE WARNINGS SURVIVE A MULTI-RUNG MESSAGE
// ─────────────────────────────────────────────────────────────────────────────

test("a withheld component is named on the reply AND on the screen when two rungs ran", async () => {
  // THE DEFECT, REPRODUCED. `components` and `tsx` both dispatch to the page
  // rung, so this message runs it twice. `merged.layer` is then `"look"` —
  // the merge says so in as many words — and `editReply`'s look branch never
  // read `keptParts`, `unseenParts`, `photosRemoved` or `photos`. The reply
  // carried the field and the screen said "✅ Updated the look." and stopped.
  assert.equal(laneLayer("components"), "page");
  assert.equal(laneLayer("tsx"), "page");
  const slug = "prot-merge";
  const store = bucket(slug, { parts: [{ name: "card-a", source: A_OLD }, { name: "card-b", source: B_BIG }] });
  const c = installCompiler();
  try {
    await withWire({
      pick_lanes: { fields: ["components", "tsx"] },
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      // RUNG 1 changes the page and `card-a`; RUNG 2 hands back a replacement
      // for `card-b`, which the wall withholds because it was too large to
      // show. Keyed by CALL ORDER, which is what makes this two rungs rather
      // than one asked twice.
      [SITE_PAGES_TOOL.name]: (n) => (n === 0
        ? { pages: [{ path: "src/routes/index.tsx", source: homeWith(slug).replace("Nine until five.", "Nine until six.") }], parts: [{ name: "card-a", source: A_NEW }] }
        : { pages: [{ path: "src/routes/index.tsx", source: homeWith(slug).replace("Nine until five.", "Nine until seven.") }], parts: [{ name: "card-b", source: B_NEW }] }),
    }, async (calls) => {
      const { body, said } = await edit(slug, "rename the hours card and rewrite the address card", { store, layer: "look" });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));
      assert.equal(calls.filter((x) => x.tool === SITE_PAGES_TOOL.name).length, 2,
        "this case's premise is two page rungs, and only one ran");

      // (a) THE MERGED REPLY IS THE `look` SHAPE — the branch the warnings
      //     used to be invisible in. Asserted so a future merge that stops
      //     collapsing the layer does not silently make this case vacuous.
      assert.equal(body.layer, "look", "the merge stopped collapsing two rungs to `look`: " + body.layer);
      assert.deepEqual(body.layers, ["page", "page"], "the two rungs are not both page rungs: " + JSON.stringify(body.layers));

      // (b) THE WITHHELD COMPONENT SURVIVES THE MERGE. It came from the SECOND
      //     rung, which is the half the catch-all could never carry: it copies
      //     a key from the first body that has one and skips every later rung.
      assert.deepEqual(body.keptParts, ["card-b"],
        "the withheld component was lost in the merge: " + JSON.stringify(body.keptParts));

      // (c) AND THE FIRST RUNG'S WORK REALLY SHIPPED, so this is a merge that
      //     kept both rungs rather than one that dropped the first.
      const parts = storedParts(store, slug);
      assert.equal(parts["card-a"], A_NEW, "the first rung's component did not ship");
      assert.equal(parts["card-b"], B_BIG, "the withheld component was overwritten anyway");

      // (d) THE SCREEN. This is the whole subject: the sentence a customer
      //     reads has to name the component nobody changed.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(said.text.startsWith("✅ Updated the look"),
        "this case no longer lands on the branch it is about: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("card-b"),
        "the withheld component never reached the screen: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("too long to show the builder"),
        "the customer is told a name and not a reason: " + JSON.stringify(said.text));
      assert.deepEqual(paidActions(said), [], "something paid was started: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("an empty frame the LAST rung removed is not reported", async () => {
  // Owner: *"avoid reporting intermediate changes that the final publication
  // reverses."* Every rung used to answer this about its own output, and the
  // merge then carried the FIRST rung's number — an opinion about a version
  // the second rung had already replaced.
  const slug = "prot-interim";
  const store = bucket(slug, { parts: [] });
  const withFrame = homeWith(slug)
    .replace("<CardA />", '<SafeImage src="" alt="the team" /><CardA />');
  const c = installCompiler();
  try {
    await withWire({
      pick_lanes: { fields: ["components", "tsx"] },
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      // RUNG 1 leaves an empty picture frame; RUNG 2 takes it out again. The
      // publication has none.
      [SITE_PAGES_TOOL.name]: (n) => (n === 0
        ? { pages: [{ path: "src/routes/index.tsx", source: withFrame }], parts: [] }
        : { pages: [{ path: "src/routes/index.tsx", source: homeWith(slug).replace("Nine until five.", "Nine until six.") }], parts: [] }),
    }, async () => {
      const { body, said } = await edit(slug, "add a team picture and then change the hours", { store, layer: "look" });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // (a) THE INTERMEDIATE REALLY DID CARRY ONE — measured with the product's
      //     own reader, so the case cannot rot into a story about a frame that
      //     was never there.
      const stored = [{ path: "index.tsx", source: homeWith(slug) }];
      const interim = [{ path: "index.tsx", source: withFrame }];
      assert.equal(newEmptySlots(stored, interim), 1,
        "the first rung's answer has no empty frame, so this case discriminates nothing");

      // (b) AND THE PUBLICATION HAS NONE, so the reply says none.
      assert.equal(newEmptySlots(stored, [{ path: "index.tsx", source: sentHome(c) }]), 0,
        "the publication still carries the frame: " + JSON.stringify(sentHome(c).slice(0, 200)));
      assert.equal(body.photos, 0,
        "an empty frame the last rung removed was reported: " + JSON.stringify(body.photos));
      assert.ok(!said.text.includes("space for a photo"),
        "the customer was told about a frame the publication does not have: " + JSON.stringify(said.text));
    });
  } finally { c.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. A WITHHELD CHANGE IS NOT A NO-CHANGE
// ─────────────────────────────────────────────────────────────────────────────

test("a component-only refusal answers for itself instead of buying a full rewrite", async () => {
  // THE DEFECT: an oversized stored component, an unchanged page back, and a
  // replacement for the component the wall had withheld. The wall refuses it
  // (which is the point of the wall), nothing is left that differs, and the
  // rung answered `escalate("no-change")` — which `escalatedEdit` turns into
  // the ~25-credit rewrite of every page, with no sentence on screen saying
  // why.
  const slug = "prot-withheld";
  const store = bucket(slug, { parts: [{ name: "card-a", source: A_OLD }, { name: "card-b", source: B_BIG }] });
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the component rewritten" },
      [SITE_PAGES_TOOL.name]: {
        pages: [{ path: "src/routes/index.tsx", source: homeWith(slug) }],
        parts: [{ name: "card-b", source: B_NEW }],
      },
    }, async () => {
      const { status, body, said } = await edit(slug, "rewrite the address card", { store });

      // (a) ITS OWN REFUSAL, NOT AN ESCALATE AND NOT A COMPILE FAILURE.
      assert.equal(status, 409, "the refusal wore the wrong status: " + status);
      assert.equal(body && body.ok, false, "a refusal reported success: " + JSON.stringify(body));
      assert.equal(body.error, "withheld", "the refusal cannot name itself: " + JSON.stringify(body.error));
      assert.equal(body.escalate, undefined, "the refusal still escalates: " + JSON.stringify(body.escalate));
      assert.equal(body.cost, 0, "a refusal was charged for: " + JSON.stringify(body.cost));
      assert.deepEqual(body.keptParts, ["card-b"], "the refusal does not name the component: " + JSON.stringify(body.keptParts));

      // (b) NOTHING WAS BUILT AND NOTHING WAS WRITTEN. A refusal changes
      //     nothing — the rule the addon path keeps one route over.
      assert.equal(c.calls.length, 0, "a refusal compiled the site: " + c.calls.length);
      assert.deepEqual(storedParts(store, slug), { "card-a": A_OLD, "card-b": B_BIG },
        "a refusal wrote to the components store");
      assert.equal(storedHome(store, slug), homeWith(slug), "a refusal wrote to the page store");

      // (c) THE SCREEN, AND WHAT IT DOES NOT START. This is the half that was
      //     costing ~25 credits: `actions` records every paid request the
      //     browser would fire, and the refusal branch fires none.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(said.text.startsWith("⚠️"), "a refusal was not drawn as one: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("card-b"), "the screen does not name the component: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("left your site exactly as it was"),
        "the customer is not told their site is untouched: " + JSON.stringify(said.text));
      assert.deepEqual(said.actions, [],
        "the refusal still started something: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("a GENUINE no-change still escalates, and the rewrite still starts", async () => {
  // ⚠ THE CONTROL, AND IT IS THE HALF THAT KEEPS THE FIX HONEST. A rung that
  // simply stopped escalating would satisfy the case above and quietly delete
  // the ladder: a model that hands back the page it was given, with nothing
  // withheld anywhere, is answering *"the site already does that"* — and
  // climbing is the right response.
  //
  // THE ONLY DIFFERENCE FROM THE CASE ABOVE is that no component is oversized,
  // so nothing is withheld. Same unchanged page, same instruction shape.
  const slug = "prot-nochange";
  const store = bucket(slug, { parts: [{ name: "card-a", source: A_OLD }, { name: "card-b", source: A_OLD }] });
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: homeWith(slug) }], parts: [] },
    }, async () => {
      const { body, said } = await edit(slug, "make the front page two columns", { store });
      assert.equal(body && body.escalate, true, "a genuine no-change stopped escalating: " + JSON.stringify(body));
      assert.equal(body.reason, "no-change", "the escalation lost its reason: " + JSON.stringify(body.reason));
      assert.equal(c.calls.length, 0, "a no-change compiled the site");

      // AND THE BROWSER REALLY STARTS THE REWRITE. Reading the reply alone
      // would leave "escalate: true" as a word in a body nobody acts on.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.deepEqual(said.actions, ["start the FULL ~25-credit rewrite (the browser's `fallback`)"],
        "the ladder no longer climbs on a genuine no-change: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});
