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

import { PICTOGRAPH } from "./fixtures/pictograph.mjs";
import { tweakInput, asEdits } from "./fixtures/tweak-edits.mjs";
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
  + "<section><h2>Opening hours</h2><p>Nine until five.</p></section>"
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
  + "<section><h2>Opening hours</h2><p>Nine until five.</p></section><CardA /></main>}\n";

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

function bucket(slug, { home = homeWith(slug), parts = [{ name: "card-a", source: A_OLD }, { name: "card-b", source: A_OLD }], uploads = [] } = {}) {
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
    // THE OWNER'S UPLOAD LIBRARY, listed the way R2 lists a prefix: only the
    // keys under it. Empty unless a case supplies uploads.
    async list(o) {
      const prefix = String((o && o.prefix) || "");
      return { objects: uploads.filter((k) => k.startsWith(prefix)).map((key) => ({ key, size: 1 })), truncated: false };
    },
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
        content: [{ type: "tool_use", name: tool, input: tool === "write_tweak" ? tweakInput(typeof a === "function" ? a(nth) : a, body) : (typeof a === "function" ? a(nth) : a) }],
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
