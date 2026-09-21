// WHAT THE EDIT PATH PROTECTS, AND WHAT IT REFUSES TO CALL A NO-CHANGE.
//
// Six defects, each reproduced through `POST /api/site/<slug>/edit` with the
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
// AND THREE MORE IN THE FIX FOR (1), each reported against the shipped
// version of it:
//
//   4. THE PERMISSION WAS A BOOLEAN OVER THE WHOLE MESSAGE. *"Remove only the
//      window photograph; keep the bench photograph"* turned the protection
//      off for every picture on the site and published both missing. It is
//      the picture rung's own APPLIED WORK that permits a removal now — the
//      state, not a flag — so the scope is exactly the operations that
//      matched.
//
//   5. RESTORATION WAS TREATED AS COVERAGE. It needs a slot to write into and
//      a description to match on, so a writer that DELETES the element,
//      RENAMES its description or SUBSTITUTES another url walked past it and
//      the loss was published anyway. A loss the restoration cannot reach
//      REFUSES the rung — not an escalate, which would buy the ~25-credit
//      rewrite of every page.
//
//   6. A MOVE PUBLISHED THE PHOTOGRAPH TWICE. The guard ran once per list, so
//      each call's site-wide rule was only half site-wide: the pages call saw
//      an empty `src` and no sign of where the url had gone, and restored it
//      beside the component that now carried it. One call, both lists,
//      evaluated over the ACCEPTED publication.
//
// WHAT EVERY CASE ASSERTS: the COMPILER PAYLOAD, the STORED SOURCE, the reply,
// and the CUSTOMER'S SCREEN — composed by `public/chat.js`'s own `editAnswer`
// selection, including whether another paid action would start.

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { TWEAK_TOOL, sameProse, proseOf } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL, MAX_PART_CHARS } from "../builder/page-gen.mjs";
import { PICTURE_TOOL, newEmptySlots } from "../builder/site-picture.mjs";
import { keptImages, keepPhotos, photoUrls } from "../builder/site-images.mjs";
import { laneLayer, LANE_FIELDS } from "../builder/site-lanes.mjs";
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

/**
 * THE SAME PAGE WITH ONE PICTURE ELEMENT SIMPLY GONE.
 *
 * Owner: *"Deleting the element, changing its description, or substituting
 * another URL bypasses preservation."* This is the first of those three, and
 * it is the shape that made the previous round's fix a half-fix: the
 * restoration needs a slot to write into and a description to match on, so a
 * writer that deletes the element walks past it entirely and the photograph
 * was published missing exactly as if no protection existed.
 */
const benchDeleted = (slug) => homeWith(slug)
  .replace("Nine until five.", "Nine until six.")
  .replace('<SafeImage src="' + PIC_A(slug) + '" alt="the bench" />', "");

/** ONE PICTURE, ONE COMPONENT — the shape a move can be measured on. */
const homeOnePic = (slug) => ROUTE_HEAD
  + 'import CardA from "./-parts/card-a"\n'
  + "function Home(){return <main><h1>Ravenscroft</h1>"
  + '<SafeImage src="' + PIC_A(slug) + '" alt="the bench" />'
  + "<p>Nine until five.</p><CardA /></main>}\n";

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

/**
 * EVERY FILE THE PUBLISH SPINE SENT, pages and components together.
 *
 * ⚠ THE UNION IS THE POINT. A photograph moved out of a page and into a
 * component is only correct site-wide: reading the page alone says it was
 * lost, and reading the component alone says it was added. The defect this
 * answers published it TWICE, which neither single-list reader can see.
 */
function sentFiles(c) {
  assert.ok(c.calls.length >= 1, "nothing was compiled at all");
  const body = c.calls[c.calls.length - 1].body || {};
  const out = { ...(body.files || {}) };
  // ⚠ COMPONENTS RIDE IN THEIR OWN ARRAY, not in `files` — `build-server.mjs`
  // writes each `payload.parts` entry into `src/routes/-parts/<name>.tsx`
  // itself. A reader that only walked `files` answered "no file shows it" on a
  // payload whose component shows it, which is the same blindness the defect
  // this case is about.
  for (const p of Array.isArray(body.parts) ? body.parts : []) {
    if (p && typeof p.name === "string") out["src/routes/-parts/" + p.name + ".tsx"] = String(p.source || "");
  }
  return out;
}

/** Which of the publication's files carry a photograph of this site's. */
const sentShowing = (c, slug) => Object.entries(sentFiles(c))
  .filter(([, v]) => photoUrls(String(v || ""), slug).size)
  .map(([k]) => k)
  .sort();

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

test("the picture rung running FIRST is what the page rung protects against", async () => {
  // ⚠ THE CASE THAT PROVES THE SCOPE, AND A RED CHECK IS WHY IT EXISTS.
  //
  // Mutating the guard's BEFORE from `eSrc` (the site as THIS rung finds it)
  // to `eSrcAt0` (the site the MESSAGE arrived to) SURVIVED every case in
  // these six files — and it is the whole of the permission rule. The reason
  // is the running order: `LANE_FIELDS` puts `shape` (12) before `images`
  // (13), so the case below runs the PAGE rung first and the two readings are
  // equal by construction. Nothing exercised the direction that matters.
  //
  // `tsx` IS 17, AFTER `images`. So "take the window photo off and rewrite
  // the cards" runs the picture rung FIRST — it clears the window and
  // publishes through `publishStep`, which advances `eSrc` — and the page
  // rung then finds a site whose window slot is already empty. There is
  // nothing to put back, the removal ships, and the bench (which nobody
  // named) is protected from the same answer.
  //
  // Under `eSrcAt0` BOTH go back and the authorised removal is undone, which
  // is the defect wearing a different hat.
  assert.ok(LANE_FIELDS.indexOf("images") < LANE_FIELDS.indexOf("tsx"),
    "this case's whole premise is that the picture rung runs before this page rung");
  const slug = "prot-first";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      pick_lanes: { fields: ["images", "tsx"] },
      [PICTURE_TOOL.name]: { pictures: [{ page: "index.tsx", alt: "the window", clear: true }] },
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: strippedBoth(slug) }], parts: [] },
    }, async (calls) => {
      const { body, said } = await edit(slug, "take the window photo off and rewrite the cards", { store, layer: "look" });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));
      assert.deepEqual(body.layers, ["picture", "page"],
        "the rungs did not run picture-then-page, so this case proves nothing: " + JSON.stringify(body.layers));
      assert.equal(calls.filter((x) => x.tool === PICTURE_TOOL.name).length, 1, "the picture rung never ran");

      // THE BENCH IS BACK AND THE WINDOW IS GONE — the same answer, told
      // apart by which of the two the picture rung had already acted on.
      assert.deepEqual(pics(sentHome(c), slug), [PIC_A(slug)],
        "the publication does not carry the bench alone: " + JSON.stringify(pics(sentHome(c), slug)));
      assert.deepEqual(pics(storedHome(store, slug), slug), [PIC_A(slug)],
        "the store disagrees with what was published");
      assert.equal(body.photosKept, 1, "the wrong number was protected: " + JSON.stringify(body.photosKept));
      assert.equal(body.photosRemoved, 1, "the authorised removal was not reported: " + JSON.stringify(body.photosRemoved));
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.deepEqual(paidActions(said), [], "something paid was started: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("a change whose ONLY effect is taking a photograph off is withheld", async () => {
  // ⚠ THE THIRD REFUSAL SENTENCE, AND A RED CHECK FOUND IT UNTESTED. Cutting
  // `wrote = { ...wrote, source: pGuarded.source }` SURVIVED — the
  // publication comes from `pGuard.pages` either way, so that line matters
  // only where the guarded page is compared: the no-change decision.
  //
  // WHICH IS THE CASE THIS IS. The writer's whole answer is one emptied
  // `src`, and the guard puts it straight back — so the page that would ship
  // is byte-identical to the one stored. Publishing it would be a compile and
  // a version for a site identical to itself, and escalating would buy the
  // ~25-credit rewrite. It refuses, and the sentence says what the change
  // would have done.
  const slug = "prot-only-photo";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: {
        // The alt is INTACT, so the restoration reaches it — which is what
        // makes this a withheld change rather than an unreachable loss.
        pages: [{ path: "src/routes/index.tsx", source: homeWith(slug).replace('src="' + PIC_B(slug) + '"', 'src=""') }],
        parts: [],
      },
    }, async () => {
      const { status, body, said } = await edit(slug, "tidy up the front page", { store });
      assert.equal(status, 409, "the refusal wore the wrong status: " + status);
      assert.equal(body.error, "withheld", "the refusal cannot name itself: " + JSON.stringify(body.error));
      assert.equal(body.escalate, undefined, "a withheld photograph still buys the full rewrite");
      assert.equal(body.cost, 0, "a refusal was charged for: " + JSON.stringify(body.cost));
      // NOT THE UNREACHABLE-LOSS BRANCH. The guard REACHED this one, which is
      // why it is a no-change rather than a loss — two refusals, two
      // sentences, and only the pair separates them.
      assert.equal(body.photosBlocked, undefined,
        "the reachable case answered the unreachable branch: " + JSON.stringify(body.photosBlocked));
      assert.equal(c.calls.length, 0, "a refusal compiled the site: " + c.calls.length);
      assert.equal(storedHome(store, slug), homeWith(slug), "a refusal wrote to the page store");

      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(said.text.startsWith("⚠️"), "a refusal was not drawn as one: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("take a photograph off your page"),
        "the customer is not told what the change would have done: " + JSON.stringify(said.text));
      assert.deepEqual(said.actions, [], "the refusal still started something: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("a photograph put back into a COMPONENT reaches the publication", async () => {
  // ⚠ AND A RED CHECK FOUND THIS ONE UNTESTED TOO. Handing the publish
  // `pAccepted` — the merge of what the model returned — instead of
  // `pGuard.parts` SURVIVED, because no case here had ever restored a `src`
  // INTO a component: the one that empties a component's picture renames its
  // description too, so nothing is put back and the rung refuses instead.
  //
  // THE GUARD WRITES INTO BOTH LISTS, so both have to reach the container.
  // Publishing the unguarded merge would ship the component the model wrote
  // and quietly drop what was put back into it — and the message-wide reader
  // would then report the loss the guard had just undone.
  const slug = "prot-part-back";
  const withPic = 'export default function CardA(){return <section data-slot="card"><h2>Opening hours</h2>'
    + '<SafeImage src="' + PIC_A(slug) + '" alt="the bench" /></section>}';
  const bare = withPic.replace('src="' + PIC_A(slug) + '"', 'src=""');
  const store = bucket(slug, {
    home: homeOnePic(slug).replace('<SafeImage src="' + PIC_A(slug) + '" alt="the bench" />', ""),
    parts: [{ name: "card-a", source: withPic }],
  });
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: {
        pages: [{ path: "src/routes/index.tsx", source: store.store.get(SRC_KEY(slug))
          ? JSON.parse(store.store.get(SRC_KEY(slug)))[0].source.replace("Nine until five.", "Nine until six.") : "" }],
        parts: [{ name: "card-a", source: bare }],
      },
    }, async () => {
      const { body, said } = await edit(slug, "change the opening hours to six", { store });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // (a) THE COMPILER PAYLOAD'S COMPONENT CARRIES IT, which is the half a
      //     pages-only reader cannot see.
      assert.deepEqual(sentShowing(c, slug), ["src/routes/-parts/card-a.tsx"],
        "the restored component never reached the container: " + JSON.stringify(sentShowing(c, slug)));

      // (b) AND THE STORE AGREES, so the next edit starts from a component
      //     that still has its picture.
      assert.deepEqual(pics(storedParts(store, slug)["card-a"], slug), [PIC_A(slug)],
        "the store kept the stripped component");

      // (c) AND IT IS COUNTED AND SAID. `photosKept` reads the publication,
      //     and the publication's picture is in a component.
      assert.equal(body.photosKept, 1, "the restoration was not counted: " + JSON.stringify(body.photosKept));
      assert.equal(body.photosRemoved, undefined,
        "a photograph the guard put back was reported lost: " + JSON.stringify(body.photosRemoved));
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(said.text.includes("still there"),
        "the protection never reached the screen: " + JSON.stringify(said.text));
    });
  } finally { c.uninstall(); }
});

test("an authorised removal takes the one it names and keeps the one it does not", async () => {
  // THE OTHER HALF, and without it the fix above is a ban rather than a
  // protection. The model's PAGE answer is BYTE-IDENTICAL to the case above —
  // `strippedBoth`, both pictures emptied. The only difference is that a
  // picture rung ran first and cleared ONE of them.
  //
  // ⚠ AND THIS EXPECTATION IS THIS ROUND'S CORRECTION. It used to assert that
  // BOTH photographs disappeared, which is what the code really did and what
  // the owner reported: *"'Remove only the window photograph; keep the bench
  // photograph' can publish both missing. `ePhotoAsk` disables protection
  // globally."* A boolean over the whole message — "did any picture step
  // run?" — turned the protection off for every picture on the site the
  // moment one was named. The test agreed with the defect, so it could never
  // have found it.
  //
  // WHERE THE PERMISSION COMES FROM NOW: the picture rung publishes through
  // `publishStep`, which advances `eSrc` — so by the time the page rung runs,
  // the site AS IT STANDS already has the window's `src` empty and the
  // bench's filled. The guard's BEFORE is that state. The window is not in
  // it, so there is nothing to put back and the removal ships; the bench IS
  // in it, was never asked about, and goes back.
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
      const { body, said } = await edit(slug, "take the window photo off, keep the bench one, and lay the front page out in two columns", { store, layer: "look" });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // (a) THE PUBLICATION HAS EXACTLY ONE, and which one is the whole case.
      //     The named removal is honoured; the unnamed photograph survives an
      //     answer that emptied it.
      assert.deepEqual(pics(sentHome(c), slug), [PIC_A(slug)],
        "the publication does not carry the bench alone: " + JSON.stringify(pics(sentHome(c), slug)));
      assert.deepEqual(pics(storedHome(store, slug), slug), [PIC_A(slug)],
        "the store disagrees with what was published: " + JSON.stringify(pics(storedHome(store, slug), slug)));

      // (b) BOTH COUNTS, because each is half the claim. One put back, one
      //     really gone — and the loss is REPORTED rather than refused, which
      //     is what separates this rung from the addon's 422.
      assert.equal(body.photosKept, 1,
        "the protection did not act on the photograph nobody named: " + JSON.stringify(body.photosKept));
      assert.equal(body.photosRemoved, 1,
        "the authorised removal was not reported, or the wrong number was: " + JSON.stringify(body.photosRemoved));
      assert.notEqual(body.error, "withheld", "this rung refused an authorised removal instead of making it");

      // (c) THE SCREEN SAYS BOTH THINGS, and starts nothing.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(said.text.includes("One photograph is no longer on the site"),
        "the loss never reached the screen: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("still there"),
        "the customer is not told the other one was kept: " + JSON.stringify(said.text));
      assert.deepEqual(paidActions(said), [], "something paid was started: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("a rung that WITHHELD beside a rung that shipped still reaches the screen", async () => {
  // ⚠ THE SILENT PARTIAL MY OWN REFUSAL MADE REACHABLE, and it is the third
  // round of exactly one complaint: *"the new warnings disappear in
  // multi-step edits."*
  //
  // REPRODUCED before the fix. The picture rung clears the window and
  // succeeds; the page rung finds a loss it cannot put back and refuses. One
  // rung succeeded, so `merged.layer` is `"picture"` — and `editReply` had
  // ELEVEN layer branches with the outcome clauses called from TWO of them.
  // The refusal's sentence went onto `partial`, which had no reader anywhere
  // in `chat.js`, and the screen read `"✅ Took the picture off “the
  // window”."` and stopped.
  //
  // THE SITE WAS RIGHT EITHER WAY — the bench survived, the window went, the
  // withheld half published nothing — which is what makes this a REPORTING
  // defect and exactly the kind that ships unnoticed.
  const slug = "prot-partial";
  const store = bucket(slug, { parts: [] });
  const c = installCompiler();
  try {
    await withWire({
      pick_lanes: { fields: ["images", "tsx"] },
      [PICTURE_TOOL.name]: { pictures: [{ page: "index.tsx", alt: "the window", clear: true }] },
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      // The bench element is DELETED, so the restoration cannot reach it and
      // the page rung withholds.
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: benchDeleted(slug) }], parts: [] },
    }, async () => {
      const { body, said } = await edit(slug, "take the window photo off and rewrite the cards", { store, layer: "look" });

      // (a) ONE RUNG SHIPPED AND ONE DID NOT, and the reply says so on the
      //     field that carries it.
      assert.equal(body && body.ok, true, "the whole message failed: " + JSON.stringify(body));
      assert.equal(body.layer, "picture",
        "this case no longer lands on a branch that never composed the outcomes: " + body.layer);
      assert.ok(Array.isArray(body.partial) && body.partial.length === 1,
        "the withheld rung is not on `partial`: " + JSON.stringify(body.partial));
      assert.equal(body.partial[0].layer, "page", "the wrong rung is reported as partial");
      assert.equal(body.partial[0].error, "withheld", "the partial lost the refusal's name");

      // (b) THE SITE IS CORRECT EITHER WAY, which is why only the screen can
      //     catch this: the bench is still there and the window is gone.
      assert.deepEqual(pics(storedHome(store, slug), slug), [PIC_A(slug)],
        "the withheld half published anyway: " + JSON.stringify(pics(storedHome(store, slug), slug)));

      // (c) AND THE CUSTOMER IS TOLD. The refusal's own sentence, verbatim,
      //     under a warning inside a reply that opens with a green tick.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(said.text.startsWith("✅"), "the successful half is no longer reported: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("⚠️"), "the withheld half is not flagged: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("couldn't put it back safely"),
        "the refusal's own sentence never reached the screen: " + JSON.stringify(said.text));
      assert.deepEqual(paidActions(said), [], "something paid was started: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("a rung that failed WITHOUT a sentence is counted rather than dropped", async () => {
  // ⚠ THE OTHER ARM OF THE PARTIAL CLAUSE, and a red check found it undriven:
  // cutting it SURVIVED, because every case here gives its failing rung a
  // `msg`. It is reachable in the product — `escalate(...)` answers
  // `{ok:false, escalate:true, reason, cost:0}` and carries NO sentence at
  // all, and so does a body the route could not read.
  //
  // *NOTHING AT ALL* IS THE OUTCOME THIS WHOLE CLAUSE EXISTS TO CLOSE, so a
  // failure with no words still has to leave a mark. The count goes out even
  // when the sentence did not, with an instruction that gets the customer the
  // reason: ask for that part on its own.
  const slug = "prot-wordless";
  const store = bucket(slug, { parts: [] });
  const c = installCompiler();
  try {
    await withWire({
      pick_lanes: { fields: ["images", "tsx"] },
      [PICTURE_TOOL.name]: { pictures: [{ page: "index.tsx", alt: "the window", clear: true }] },
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      // THE MODEL RETURNS NO PAGE, which is `escalate("no-page-back")` — a
      // refusal with a reason and no prose.
      [SITE_PAGES_TOOL.name]: { pages: [], parts: [] },
    }, async () => {
      const { body, said } = await edit(slug, "take the window photo off and rewrite the cards", { store, layer: "look" });
      assert.equal(body && body.ok, true, "the whole message failed: " + JSON.stringify(body));
      assert.ok(Array.isArray(body.partial) && body.partial.length === 1,
        "the failed rung is not on `partial`: " + JSON.stringify(body.partial));
      assert.equal(body.partial[0].msg, undefined,
        "this case's premise is a failure with NO sentence, and it has one: " + JSON.stringify(body.partial[0]));

      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(said.text.includes("⚠️"), "a wordless failure left no mark at all: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("One part of that message didn’t go through"),
        "the wordless failure is not counted: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("on its own"),
        "the customer is told a part failed and not how to find out why: " + JSON.stringify(said.text));
      assert.deepEqual(paidActions(said), [], "something paid was started: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("a loss the restoration cannot reach is withheld, not published", async () => {
  // THE DEFECT, REPRODUCED THROUGH THE ROUTE. Owner: *"`keepPhotos` restores
  // empty `src` only when the description still matches. Deleting the
  // element, changing its description, or substituting another URL bypasses
  // preservation… withhold the unsafe change with an explanation. Do not
  // publish the loss merely because matching failed, or trigger a full
  // rewrite."*
  //
  // The writer DELETES the `<SafeImage>` for the bench. There is no slot to
  // write into, so the previous round's restoration fired on nothing — and
  // the page shipped with the photograph gone, reported afterwards, which is
  // exactly the behaviour the round before that was meant to end.
  const slug = "prot-unreachable";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: benchDeleted(slug) }], parts: [] },
    }, async () => {
      const { status, body, said } = await edit(slug, "change the opening hours to six", { store });

      // (a) ITS OWN REFUSAL — and NOT an escalate, for the reason the
      //     component case one section down gives: `escalate` is what buys
      //     the ~25-credit rewrite of every page, which is the opposite of
      //     protecting one photograph.
      assert.equal(status, 409, "the refusal wore the wrong status: " + status);
      assert.equal(body && body.ok, false, "a refusal reported success: " + JSON.stringify(body));
      assert.equal(body.error, "withheld", "the refusal cannot name itself: " + JSON.stringify(body.error));
      assert.equal(body.escalate, undefined, "the refusal escalates: " + JSON.stringify(body.escalate));
      assert.equal(body.cost, 0, "a refusal was charged for: " + JSON.stringify(body.cost));
      assert.equal(body.photosBlocked, 1, "the refusal does not say how many: " + JSON.stringify(body.photosBlocked));
      // THE COUNT, NEVER THE URL — `lostPhotosMsg`'s own rule, one path over.
      assert.ok(!JSON.stringify(body).includes(PIC_A(slug)),
        "a storage key reached the customer: " + JSON.stringify(body).slice(0, 300));

      // (b) NOTHING WAS BUILT AND NOTHING WAS WRITTEN. A refusal changes
      //     nothing — including the customer's own hours change, which is the
      //     stated cost of this rule and not an oversight.
      assert.equal(c.calls.length, 0, "a refusal compiled the site: " + c.calls.length);
      assert.equal(storedHome(store, slug), homeWith(slug), "a refusal wrote to the page store");
      assert.deepEqual(pics(storedHome(store, slug), slug), [PIC_A(slug), PIC_B(slug)].sort(),
        "the store lost a photograph on a request that published nothing");

      // (c) THE SCREEN, AND WHAT IT DOES NOT START.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(said.text.startsWith("⚠️"), "a refusal was not drawn as one: " + JSON.stringify(said.text));
      // ⚠ THE PROPERTY, NOT THE SPELLING (re-anchored 2026-09-21). This pinned
      //   the words *"left your site exactly as it was"*, which the rung no
      //   longer says — it cannot, because the same sentence is printed beside
      //   a rung that SHIPPED. The reassurance is true here and is added by
      //   the browser's complete-refusal branch, so the property to assert is
      //   that the customer is told it, never which half of the reply says so.
      assert.ok(said.text.includes("Nothing on your site changed"),
        "the customer is not told their site is untouched: " + JSON.stringify(said.text));
      // ⚠ AND THE RUNG'S OWN HALF STOPS AT ITS OWN CHANGE. The clause above is
      //   the BROWSER's, added because this reply refused outright; the
      //   sentence the rung composed must be true beside a rung that shipped
      //   too, so it ends at "I didn't make it" and never claims the site.
      //   Without this, putting the whole-site wording back into the server's
      //   sentence is a mutant the line above cannot see — the browser would
      //   still be appending its own clause and the assertion would pass.
      assert.ok(/so I didn't make (it|that change)/.test(said.text),
        "the rung's own sentence is not scoped to its own change: " + JSON.stringify(said.text));
      assert.ok(said.text.includes("take that photo off"),
        "the customer is not told how to authorise it: " + JSON.stringify(said.text));
      assert.deepEqual(said.actions, [],
        "the refusal still started something: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("a photograph moved from the page into a component is published once", async () => {
  // THE DEFECT, REPRODUCED THROUGH THE ROUTE. Owner: *"Moving an image from
  // the page into a component publishes it twice: the separate page check
  // restores the old copy without seeing the new component."*
  //
  // The guard ran TWICE, once per list, and each call's site-wide rule was
  // only half site-wide: the pages call saw an emptied `src` on the page and
  // no sign of where the url had gone, so it put the old copy back — beside
  // the component that now also carries it.
  const slug = "prot-moved";
  const store = bucket(slug, { home: homeOnePic(slug), parts: [{ name: "card-a", source: A_OLD }] });
  const c = installCompiler();
  const moved = 'export default function CardA(){return <section data-slot="card"><h2>Opening hours</h2>'
    + '<SafeImage src="' + PIC_A(slug) + '" alt="the bench" /></section>}';
  try {
    await withWire({
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: {
        pages: [{ path: "src/routes/index.tsx", source: homeOnePic(slug).replace('src="' + PIC_A(slug) + '"', 'src=""') }],
        parts: [{ name: "card-a", source: moved }],
      },
    }, async () => {
      const { body, said } = await edit(slug, "put the bench photograph inside the opening-hours card", { store });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // (a) ONE FILE SHOWS IT, AND IT IS THE COMPONENT. Counted over the
      //     WHOLE compiler payload rather than the page alone, because the
      //     page alone cannot tell a move from a loss and the component alone
      //     cannot tell a move from an addition.
      assert.deepEqual(sentShowing(c, slug), ["src/routes/-parts/card-a.tsx"],
        "the photograph is not published exactly once, in the component: " + JSON.stringify(sentShowing(c, slug)));
      assert.deepEqual(pics(sentHome(c), slug), [],
        "the page it moved OUT of got a copy put back: " + JSON.stringify(pics(sentHome(c), slug)));

      // (b) THE STORE AGREES, so the next edit starts from a site with one
      //     copy rather than two.
      assert.deepEqual(pics(storedHome(store, slug), slug), [], "the stored page kept a duplicate");
      assert.deepEqual(pics(storedParts(store, slug)["card-a"], slug), [PIC_A(slug)],
        "the component did not keep the photograph it was given");

      // (c) A MOVE IS NEITHER A LOSS NOR A RESTORATION, and both fields say
      //     so — the message-wide reader is site-wide, so the site still
      //     shows what it showed.
      assert.equal(body.photosRemoved, undefined,
        "a move was reported as a loss: " + JSON.stringify(body.photosRemoved));
      assert.equal(body.photosKept, undefined,
        "the protection claimed to have acted on a move: " + JSON.stringify(body.photosKept));
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(!said.text.includes("no longer on the site"),
        "the customer was told about a loss that did not happen: " + JSON.stringify(said.text));
      assert.deepEqual(paidActions(said), [], "something paid was started: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("the restoration is by description, and it refuses to guess", () => {
  // THE MODULE, DRIVEN DIRECTLY, for the cases a route test cannot reach
  // cheaply. Each is a refusal to guess rather than a capability.
  //
  // ⚠ ONE CALL, TWO LISTS. `keepPhotos` takes `{pages, parts}` on both sides,
  // because two calls — one per list — each had a rule that was only half
  // site-wide. The `lost` half is the other half of the answer: what the
  // restoration COULD NOT reach, which the route turns into a refusal.
  const slug = "fw";
  const url = "/u/fw/aaaabbbbccccdddd.jpg";
  const src = (body) => ROUTE_HEAD + "function Home(){return <main>" + body + "</main>}\n";
  const one = (body) => ({ pages: [{ path: "index.tsx", source: src(body) }], parts: [] });

  // (a) THE ORDINARY CASE: emptied, and put back — and nothing is left lost.
  const back = keepPhotos(
    one('<SafeImage src="' + url + '" alt="the bench" />'),
    one('<SafeImage src="" alt="the bench" />'),
    slug,
  );
  assert.deepEqual(back.restored, [url], "the ordinary restoration did not happen");
  assert.ok(back.pages[0].source.includes('src="' + url + '"'), "the url is not in the file");
  assert.deepEqual(back.lost, [], "a photograph that WAS put back is also reported lost");

  // (b) A DIFFERENT PICTURE IS AN ANSWER, NOT A LOSS. Overwriting it would be
  //     this function editing the change rather than protecting what was
  //     there — so nothing is restored. But the url the site showed is gone,
  //     and `lost` is what says so: the route refuses rather than publishing
  //     a substitution nobody asked for.
  const other = "/u/fw/1111222233334444.jpg";
  const swapped = keepPhotos(
    one('<SafeImage src="' + url + '" alt="the bench" />'),
    one('<SafeImage src="' + other + '" alt="the bench" />'),
    slug,
  );
  assert.deepEqual(swapped.restored, [], "a deliberate replacement was overwritten");
  assert.deepEqual(swapped.lost, [url], "a substituted url reads as no loss at all: " + JSON.stringify(swapped.lost));

  // (c) AN EXPRESSION IS NOT OUR SLOT — `src={row.photo}` is a picture the
  //     site's own data decides, and a literal written over it drops the
  //     binding. Reported lost for the same reason.
  const bound = keepPhotos(
    one('<SafeImage src="' + url + '" alt="the bench" />'),
    one("<SafeImage src={row.photo} alt=\"the bench\" />"),
    slug,
  );
  assert.deepEqual(bound.restored, [], "a data binding was overwritten with a literal");
  assert.deepEqual(bound.lost, [url], "a binding that took a photograph's place reads as no loss");

  // (d) AN AMBIGUOUS DESCRIPTION IS SKIPPED. Two empty slots sharing one `alt`
  //     cannot say which is the one that had the picture.
  const twice = keepPhotos(
    one('<SafeImage src="' + url + '" alt="the bench" />'),
    one('<SafeImage src="" alt="the bench" /><SafeImage src="" alt="the bench" />'),
    slug,
  );
  assert.deepEqual(twice.restored, [], "an ambiguous description was guessed at");
  assert.deepEqual(twice.lost, [url], "an ambiguity the restoration skipped reads as no loss");

  // (e) ⚠ THE THREE WAYS ROUND THE MATCH, all of which used to publish the
  //     loss because the restoration simply did not fire. Owner: *"Deleting
  //     the element, changing its description, or substituting another URL
  //     bypasses preservation."* (b) is the substitution; these two are the
  //     other two, and the point is that `lost` names every one of them.
  const gone = keepPhotos(one('<SafeImage src="' + url + '" alt="the bench" />'), one("<p>nothing here</p>"), slug);
  assert.deepEqual(gone.restored, [], "a deleted element was somehow restored");
  assert.deepEqual(gone.lost, [url], "a DELETED picture element reads as no loss: " + JSON.stringify(gone.lost));
  const renamed = keepPhotos(
    one('<SafeImage src="' + url + '" alt="the bench" />'),
    one('<SafeImage src="" alt="the seating area" />'),
    slug,
  );
  assert.deepEqual(renamed.restored, [], "a renamed description was matched anyway");
  assert.deepEqual(renamed.lost, [url], "a RENAMED description reads as no loss: " + JSON.stringify(renamed.lost));

  // (f) ⚠ AND A PHOTOGRAPH THE ANSWER MOVED IS NEVER PUT BACK, whichever list
  //     it moved into. `keptImages` is site-wide on purpose — a writer moving
  //     a `<SafeImage>` into a COMPONENT has kept every picture the site
  //     shows — so a restoration that could not see the other list would meet
  //     that legitimate move and publish the photograph TWICE. Both
  //     directions, because the two lists are two arguments and a fix that
  //     only looked one way would pass one of these.
  const intoPart = keepPhotos(
    { pages: [{ path: "index.tsx", source: src('<SafeImage src="' + url + '" alt="the bench" />') }], parts: [{ name: "card", source: "y" }] },
    { pages: [{ path: "index.tsx", source: src('<SafeImage src="" alt="the bench" />') }],
      parts: [{ name: "card", source: 'y<SafeImage src="' + url + '" alt="the bench" />' }] },
    slug,
  );
  assert.deepEqual(intoPart.restored, [], "a photograph moved into a component was duplicated back into the page");
  assert.deepEqual(intoPart.lost, [], "a move reads as a loss: " + JSON.stringify(intoPart.lost));
  assert.equal(keptImages([...intoPart.pages, ...intoPart.parts], [...intoPart.pages, ...intoPart.parts], slug).ok, true,
    "the moved publication does not satisfy the site-wide reader");
  const intoPage = keepPhotos(
    { pages: [{ path: "index.tsx", source: src("<p>x</p>") }], parts: [{ name: "card", source: 'y<SafeImage src="' + url + '" alt="the bench" />' }] },
    { pages: [{ path: "index.tsx", source: src('<SafeImage src="' + url + '" alt="the bench" />') }],
      parts: [{ name: "card", source: 'y<SafeImage src="" alt="the bench" />' }] },
    slug,
  );
  assert.deepEqual(intoPage.restored, [], "a photograph moved OUT of a component was duplicated back into it");
  assert.deepEqual(intoPage.lost, [], "the other direction of a move reads as a loss: " + JSON.stringify(intoPage.lost));
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
      // ⚠ THE PROPERTY, NOT THE SPELLING (re-anchored 2026-09-21). This pinned
      //   the words *"left your site exactly as it was"*, which the rung no
      //   longer says — it cannot, because the same sentence is printed beside
      //   a rung that SHIPPED. The reassurance is true here and is added by
      //   the browser's complete-refusal branch, so the property to assert is
      //   that the customer is told it, never which half of the reply says so.
      assert.ok(said.text.includes("Nothing on your site changed"),
        "the customer is not told their site is untouched: " + JSON.stringify(said.text));
      // ⚠ AND THE RUNG'S OWN HALF STOPS AT ITS OWN CHANGE. The clause above is
      //   the BROWSER's, added because this reply refused outright; the
      //   sentence the rung composed must be true beside a rung that shipped
      //   too, so it ends at "I didn't make it" and never claims the site.
      //   Without this, putting the whole-site wording back into the server's
      //   sentence is a mutant the line above cannot see — the browser would
      //   still be appending its own clause and the assertion would pass.
      assert.ok(/so I didn't make (it|that change)/.test(said.text),
        "the rung's own sentence is not scoped to its own change: " + JSON.stringify(said.text));
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

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE CHEAP RUNG IS ON THE SAME CONTRACT (2026-09-21)
//
// Owner: *"Successful tweaks bypass protection … Test this with write_tweak
// succeeding; forcing it to decline misses the defect."*
//
// ⚠ AND THAT INSTRUCTION NAMES A REAL PROPERTY OF THIS FILE. Every case above
// stubs `write_tweak` with `{cannot}`, because each was written about the
// REWRITE rung — so all of them drove the fallback and not one drove the path
// a customer's message actually takes. The protection was built on the rung
// that answers second.
// ─────────────────────────────────────────────────────────────────────────────

/** A third real photograph, for the one bypass shape that reaches this rung. */
const PIC_C = (slug) => "/u/" + slug + "/c3d4e5f60718293a.jpg";

/**
 * THE TWEAK'S OWN ANSWER: the heading really is bigger, and one `src` is gone.
 *
 * ⚠ THE HEADING CHANGE MUST BE VISUAL AND NOT VERBAL, or `sameProse` refuses
 * the answer as `reworded` and the rung falls through to the rewrite — the
 * case would then pass by testing the branch it is not about. A `className` is
 * what a real "make the heading bigger" tweak returns.
 */
const biggerHeading = (slug) => homeWith(slug).replace("<h1>", '<h1 className="text-5xl">');
const biggerLostBench = (slug) => biggerHeading(slug).replace('src="' + PIC_A(slug) + '"', 'src=""');
const biggerSwappedBench = (slug) => biggerHeading(slug).replace('src="' + PIC_A(slug) + '"', 'src="' + PIC_C(slug) + '"');

test("WHICH bypass shapes can reach the cheap rung at all — measured, not assumed", () => {
  // ⚠ THE FINDING THAT SHAPED THE THREE CASES BELOW, and it is worth keeping
  // because it is not what the general contract predicts: `alt` TEXT IS PROSE.
  // `proseOf` reads a picture's description as words on the page, so of the
  // three bypasses the last round named — DELETE the element, RENAME its
  // description, SUBSTITUTE another url — the first two never get past
  // `readTweak` at all. They come back `reworded` and the rung falls through.
  //
  // SO THE SUBSTITUTION IS THE ONE THAT REACHES THE GUARD HERE, and a case
  // built on a deletion would be green about a path it never took. Asserted
  // rather than commented, because the day `extractText` stops reading `alt`
  // this file needs to grow two cases and nothing else would say so.
  const slug = "prot-shapes";
  const before = homeWith(slug);
  assert.equal(proseOf(before).includes("the bench"), true,
    "`alt` stopped being prose — the delete and rename bypasses now reach this rung and need their own cases");
  assert.equal(sameProse(before, biggerHeading(slug)), true, "a className change reads as a rewording");
  assert.equal(sameProse(before, biggerLostBench(slug)), true, "an emptied src reads as a rewording");
  assert.equal(sameProse(before, biggerSwappedBench(slug)), true, "a substituted url reads as a rewording");
  assert.equal(sameProse(before, benchDeleted(slug)), false, "a deleted element is no longer caught by the prose gate");
});

test("a SUCCESSFUL tweak puts the photograph back before it publishes", async () => {
  // THE DEFECT, REPRODUCED EXACTLY AS REPORTED. *"Make the heading bigger and
  // keep both photographs"*: `write_tweak` answers with the larger heading and
  // one emptied `src`, `tw.ok` is true, and the rung published the missing
  // photograph and reported it afterwards — the behaviour two rounds have now
  // closed on the rewrite path, still live on the path that answers first.
  const slug = "prot-tweak-keep";
  const store = bucket(slug, { parts: [] });
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { source: biggerLostBench(slug) },
      // ⚠ NO `write_pages` STUB AT ALL. `withWire` refuses a tool it has no
      // stub for, so if this case ever reaches the rewrite it fails loudly
      // instead of quietly proving the fallback's protection a third time.
    }, async (calls) => {
      const { body, said } = await edit(slug, "make the heading bigger and keep both photographs", { store });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // (a) THE PATH IS THE SUBJECT. One tweak call, no page call — so
      //     everything below is a statement about the cheap rung.
      assert.equal(body.tweak, true, "this did not go through the tweak rung: " + JSON.stringify(body));
      assert.equal(calls.filter((x) => x.tool === TWEAK_TOOL.name).length, 1, "the tweak rung never ran");
      assert.equal(calls.filter((x) => x.tool === SITE_PAGES_TOOL.name).length, 0,
        "the rewrite ran, so this case is about the fallback again");

      // (b) THE COMPILER PAYLOAD carries both photographs AND the asked-for
      //     change. A protection that reverted the file would satisfy the
      //     first half and throw away the customer's edit.
      const sent = sentHome(c);
      assert.deepEqual(pics(sent, slug), [PIC_A(slug), PIC_B(slug)].sort(),
        "the tweak published a page with a photograph stripped: " + JSON.stringify(pics(sent, slug)));
      assert.ok(sent.includes('className="text-5xl"'),
        "the visual tweak itself was thrown away by the protection");

      // (c) THE STORED SOURCE agrees, so the next message starts from a site
      //     that still has its pictures.
      assert.deepEqual(pics(storedHome(store, slug), slug), [PIC_A(slug), PIC_B(slug)].sort(),
        "the store kept the stripped page");
      assert.ok(storedHome(store, slug).includes('className="text-5xl"'), "the store lost the tweak");

      // (d) THE RECEIPT. `photosKept` is the message-wide intersection, so a
      //     restoration on this rung has to reach it exactly as one on the
      //     rewrite rung does.
      assert.equal(body.photosRemoved, undefined,
        "a loss was reported on a publication that kept both: " + JSON.stringify(body.photosRemoved));
      assert.equal(body.photosKept, 1, "the protection's own count is wrong: " + JSON.stringify(body.photosKept));

      // (e) THE SCREEN.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.ok(!said.text.includes("no longer on the site"),
        "the customer was told about a loss that did not happen: " + JSON.stringify(said.text));
      assert.deepEqual(paidActions(said), [], "something paid was started: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("a tweak whose loss cannot be reached is withheld, and no rewrite starts", async () => {
  // THE SUBSTITUTION — the one bypass that gets past `sameProse`. The slot
  // holds a DIFFERENT picture, which `keepPhotos` correctly leaves alone (it
  // is an answer, not an omission), so there is nothing to put back and the
  // photograph the site was serving is gone.
  //
  // ⚠ IT MUST NOT FALL THROUGH. Owner, the previous round: *"Do not publish
  // the loss merely because matching failed, or trigger a full rewrite."*
  // Falling through here is that second clause — the customer asked for a
  // heading and would buy a whole-page regeneration because our cheap rung
  // mangled a picture.
  const slug = "prot-tweak-lost";
  const store = bucket(slug, { parts: [] });
  const before = storedHome(store, slug);
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { source: biggerSwappedBench(slug) },
    }, async (calls) => {
      const { status, body, said } = await edit(slug, "make the heading bigger", { store });

      // (a) THE REFUSAL, BY NAME AND AT COST 0.
      assert.equal(status, 409, "the loss was not withheld: " + status + " " + JSON.stringify(body));
      assert.equal(body.error, "withheld", "the refusal lost its name: " + JSON.stringify(body));
      assert.equal(body.cost, 0, "a withheld change was charged for: " + JSON.stringify(body.cost));
      assert.equal(body.photosBlocked, 1, "the count is wrong: " + JSON.stringify(body.photosBlocked));

      // (b) NOTHING COMPILED AND NOTHING WAS WRITTEN. The refusal is before
      //     the publish, which is the whole of "preservation, not reporting".
      assert.equal(c.calls.length, 0, "a withheld change was compiled anyway");
      assert.equal(storedHome(store, slug), before, "the store moved on a refusal");
      assert.deepEqual(store.writes, [], "a refusal wrote to the bucket: " + JSON.stringify(store.writes.map((w) => w[0])));

      // (c) AND THE REWRITE NEVER RAN — neither here nor from the browser.
      assert.equal(calls.filter((x) => x.tool === SITE_PAGES_TOOL.name).length, 0,
        "the withheld tweak fell through to the paid rewrite");
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.deepEqual(paidActions(said), [],
        "the browser started something paid off a refusal: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("a tweak that was ONLY a removal falls through, and the rewrite still protects", async () => {
  // THE BRANCH THE RESTORATION CREATES. With the picture put back, this
  // tweak's answer is byte-identical to the page it was given — the cheap
  // attempt achieved nothing. That is what the fall-through is for, and it is
  // NOT the rewrite rung's "the only thing that change would have done is take
  // a photograph off" refusal: there the expensive writer has already had its
  // go, here it has not.
  const slug = "prot-tweak-noop";
  const store = bucket(slug, { parts: [] });
  const c = installCompiler();
  try {
    await withWire({
      // The tweak empties a `src` and changes nothing else.
      [TWEAK_TOOL.name]: { source: homeWith(slug).replace('src="' + PIC_A(slug) + '"', 'src=""') },
      // The rewrite makes the real change, and keeps both pictures.
      [SITE_PAGES_TOOL.name]: {
        pages: [{ path: "src/routes/index.tsx", source: homeWith(slug).replace("Nine until five.", "Nine until six.") }],
        parts: [],
      },
    }, async (calls) => {
      const { body } = await edit(slug, "change the opening hours to six", { store });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // THE REWRITE RAN, which is the point of the branch.
      assert.equal(calls.filter((x) => x.tool === TWEAK_TOOL.name).length, 1, "the tweak rung never ran");
      assert.equal(calls.filter((x) => x.tool === SITE_PAGES_TOOL.name).length, 1,
        "the no-op tweak did not fall through to the rewrite");
      assert.notEqual(body.tweak, true, "the no-op tweak published itself");

      // AND THE SITE IS RIGHT: the change happened and both pictures survived.
      assert.deepEqual(pics(storedHome(store, slug), slug), [PIC_A(slug), PIC_B(slug)].sort(),
        "a photograph was lost across the fall-through");
      assert.ok(storedHome(store, slug).includes("Nine until six."), "the asked-for change never happened");
    });
  } finally { c.uninstall(); }
});

test("a tweak that touches no photograph publishes exactly what the model wrote", async () => {
  // THE CONTROL. Every case above is about the guard ACTING; this one is about
  // it not acting. A protection that rewrote an innocent tweak would pass the
  // three cases above and quietly corrupt the ordinary path — which is most
  // messages, since the cheap rung answers first.
  const slug = "prot-tweak-clean";
  const store = bucket(slug, { parts: [] });
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { source: biggerHeading(slug) },
    }, async (calls) => {
      const { body } = await edit(slug, "make the heading bigger", { store });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));
      assert.equal(body.tweak, true, "this did not go through the tweak rung");
      assert.equal(calls.filter((x) => x.tool === SITE_PAGES_TOOL.name).length, 0, "an innocent tweak bought a rewrite");
      // BYTE-IDENTICAL to what the model returned, which is the assertion a
      // weaker "it still has both pictures" check would not make.
      assert.equal(sentHome(c), biggerHeading(slug), "the guard rewrote a tweak that lost nothing");
      assert.equal(storedHome(store, slug), biggerHeading(slug), "the store holds something the model did not write");
      assert.equal(body.photosKept, undefined, "a receipt was printed for a protection that never acted");
      assert.equal(body.photosRemoved, undefined, "a loss was reported on a publication that lost nothing");
    });
  } finally { c.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. A RUNG'S REFUSAL DOES NOT SPEAK FOR THE WHOLE REQUEST (2026-09-21)
//
// Owner: *"Partial-success wording makes whole-site claims … Scope refusal
// wording to the part that was withheld. Reserve 'nothing changed' and
// 'nothing charged' for cases where those statements are true of the whole
// request."*
// ─────────────────────────────────────────────────────────────────────────────

test("a refusal beside a change that SHIPPED does not claim the site is untouched", async () => {
  // REPRODUCED: the picture rung takes the window off as asked, the page rung
  // withholds a photograph it could not put back, and the screen read
  //
  //     ✅ Took the picture off “the window”. ⚠️ … so I left your site
  //     exactly as it was.
  //
  // A picture HAD just come off. Both halves true of their own rung and the
  // second false of the request.
  const slug = "prot-scope-partial";
  const store = bucket(slug, { parts: [] });
  const c = installCompiler();
  try {
    await withWire({
      pick_lanes: { fields: ["images", "tsx"] },
      [PICTURE_TOOL.name]: { pictures: [{ page: "index.tsx", alt: "the window", clear: true }] },
      [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
      [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: benchDeleted(slug) }], parts: [] },
    }, async () => {
      const { body, said } = await edit(slug, "take the window photo off and rewrite the cards", { store, layer: "look" });

      // (a) THE PREMISE: one rung shipped, one withheld.
      assert.equal(body && body.ok, true, "the whole message failed: " + JSON.stringify(body));
      assert.ok(Array.isArray(body.partial) && body.partial.length === 1, "this case is no longer a partial");
      assert.equal(body.partial[0].error, "withheld", "the partial is not the refusal this case is about");

      // (b) THE STORED RESULT really did change — which is what makes the old
      //     sentence false rather than merely clumsy.
      assert.deepEqual(pics(storedHome(store, slug), slug), [PIC_A(slug)],
        "the site did not change, so this case cannot show the defect: "
        + JSON.stringify(pics(storedHome(store, slug), slug)));

      // (c) THE SCREEN, EXACTLY. The refusal is still there and still names
      //     its reason; what is gone is the claim about the whole site.
      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      // ⚠ THE WHOLE SENTENCE, MEASURED OFF THE REAL COMPOSER rather than
      // written from memory — my first draft of this expectation left out the
      // two clauses the picture rung legitimately earns (a photograph really
      // did come off, and the slot it left is really empty), and a narrower
      // pin would have called those a defect. What this case is about is the
      // LAST clause: the refusal's own words, ending at "I didn't make it".
      assert.equal(
        said.text,
        "✅ Took the picture off “the window”. One photograph is no longer on the site. If that was not what "
        + "you wanted, say “put the photo back”. ⚠️ I couldn't make that change without taking a photograph "
        + "off your site, and I couldn't put it back safely — so I didn't make it. Say “take that photo off” "
        + "if you did want it gone. There is a space for a photo — upload yours in the Data panel and it’ll "
        + "fill in.",
        "the partial-success sentence is not what this case fixed: " + JSON.stringify(said.text),
      );
      assert.ok(!said.text.includes("left your site exactly as it was"),
        "the refusal still claims the whole site is untouched: " + JSON.stringify(said.text));
      assert.ok(!said.text.includes("haven’t been charged") && !said.text.includes("haven't been charged"),
        "a partial success claims nothing was charged: " + JSON.stringify(said.text));
      assert.deepEqual(paidActions(said), [], "something paid was started: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("a COMPLETE refusal does say nothing changed and nothing was charged", async () => {
  // THE OTHER HALF, AND IT IS WHAT STOPS THE FIX BEING A DELETION. The
  // reassurance is true of a request where no rung shipped, and dropping it
  // everywhere would take a real sentence off the one screen that should
  // carry it. `wholeRequestNote` adds it here because `ok` is false for the
  // WHOLE reply — the merge sets that from `ranOk.length > 0`, so nothing
  // published.
  const slug = "prot-scope-whole";
  const store = bucket(slug, { parts: [] });
  const before = storedHome(store, slug);
  const c = installCompiler();
  try {
    await withWire({
      [TWEAK_TOOL.name]: { source: biggerSwappedBench(slug) },
    }, async () => {
      const { status, body, said } = await edit(slug, "make the heading bigger", { store });
      assert.equal(status, 409, "this case is no longer a complete refusal: " + status);
      assert.equal(body.ok, false, "the reply claims something shipped");
      assert.equal(storedHome(store, slug), before, "something really did change, so the sentence would be false");

      assert.equal(said.ok, true, "the browser could not compose a reply: " + said.why);
      assert.equal(
        said.text,
        "⚠️ I couldn't make that change without taking a photograph off your site, and I couldn't put it back "
        + "safely — so I didn't make it. Say “take that photo off” if you did want it gone. "
        + "Nothing on your site changed and you haven’t been charged.",
        "the complete-refusal sentence is wrong: " + JSON.stringify(said.text),
      );
      assert.deepEqual(paidActions(said), [], "a refusal started something paid: " + JSON.stringify(said.actions));
    });
  } finally { c.uninstall(); }
});

test("a tweak reads the site's COMPONENTS too, though it cannot write one", async () => {
  // ⚠ THE SURVIVOR THAT FOUND THIS, and it was a real gap rather than an inert
  // mutant: every tweak case above gives the site `parts: []`, so passing the
  // stored components on the AFTER side and passing `[]` are the same input
  // and no assertion could tell them apart.
  //
  // WHY IT IS PASSED AT ALL, since `runTweak` answers one page's source and
  // can never touch a component: `keepPhotos` is SITE-WIDE. The `shows` set is
  // built over pages AND components, and `lost` is `keptImages` over the
  // union — so a component's photograph missing from the AFTER side reads as a
  // photograph this tweak took off, and an innocent heading change refuses.
  const slug = "prot-tweak-parts";
  // The component carries its OWN photograph, and the tweak never mentions it.
  const CARD_WITH_PIC = 'export default function CardA(){return <section data-slot="card">'
    + '<SafeImage src="' + PIC_B(slug) + '" alt="the window" /></section>}';
  const home = ROUTE_HEAD
    + 'import CardA from "./-parts/card-a"\n'
    + "function Home(){return <main><h1>Ravenscroft</h1>"
    + '<SafeImage src="' + PIC_A(slug) + '" alt="the bench" />'
    + "<p>Nine until five.</p><CardA /></main>}\n";
  const store = bucket(slug, { home, parts: [{ name: "card-a", source: CARD_WITH_PIC }] });
  const c = installCompiler();
  try {
    await withWire({
      // The tweak makes the heading bigger and empties the PAGE's picture.
      [TWEAK_TOOL.name]: {
        source: home.replace("<h1>", '<h1 className="text-5xl">').replace('src="' + PIC_A(slug) + '"', 'src=""'),
      },
    }, async () => {
      const { status, body } = await edit(slug, "make the heading bigger and keep both photographs", { store });

      // (a) NO REFUSAL. The component's photograph never moved, so nothing was
      //     lost — which is exactly what reading it on both sides establishes.
      assert.equal(status, 200, "an innocent tweak was refused: " + status + " " + JSON.stringify(body));
      assert.equal(body.tweak, true, "this did not go through the tweak rung");
      assert.equal(body.photosBlocked, undefined, "a loss was found where the component still shows it");

      // (b) THE PAGE'S OWN PICTURE IS BACK, and the component is untouched, so
      //     the publication shows both — once each.
      // ⚠ BY BASENAME, because the two rungs spell the payload's page key
      //   DIFFERENTLY: the tweak passes `eSrc` straight through and those
      //   paths are stored bare (`cleanPath` strips `src/routes/`), while the
      //   rewrite's come back from the model prefixed. `sentHome` hides that
      //   behind a `$`-anchored regex; a raw key comparison here would pin the
      //   spelling and go red on a rung it is not about. Both files showing a
      //   photograph is the property.
      const showing = sentShowing(c, slug).map((k) => k.split("/").pop()).sort();
      assert.deepEqual(showing, ["card-a.tsx", "index.tsx"],
        "the publication does not show a photograph in each file: " + JSON.stringify(sentShowing(c, slug)));
      assert.deepEqual(pics(storedHome(store, slug), slug), [PIC_A(slug)],
        "the page's own photograph was not put back: " + JSON.stringify(pics(storedHome(store, slug), slug)));
      assert.equal(storedParts(store, slug)["card-a"], CARD_WITH_PIC,
        "a tweak rewrote a component it cannot even see");
    });
  } finally { c.uninstall(); }
});
