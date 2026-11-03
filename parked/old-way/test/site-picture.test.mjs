// PARKED (2026-11-03, park-old-way): the old-way half of test/site-picture.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The `picture` layer — change a photograph on a page that already exists.
//
// The property under test throughout: a photograph is put in the slot somebody
// MEANT, and nowhere else. Every guard below exists because the alternative is a
// picture of the wrong thing on a real business's home page, which is worse than
// the change not happening.
import { PICTOGRAPH } from "../../../test/fixtures/pictograph.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PICTURE_MODEL, PICTURE_TOOL, MAX_SLOTS, MAX_DESCRIBE,
  imageSlots, isEmptySlot, pictureDigest, pictureRequest, readPictures,
  applyPictures, pictureReply, pictureUsage, runPictureEdit, readNeedsPlace, newEmptySlots,
  listFrames, newListFrames, MAX_LIST_FRAMES, codeOnly, photoRemoval, BARE_CONTAINERS,
} from "../../../builder/site-picture.mjs";
import { tweakParser } from "../../../builder/site-tweak.mjs";

const HOME = {
  path: "index.tsx",
  source:
    'import { SafeImage } from "@/components/ui/safe-image";\n' +
    '<SafeImage src={null} alt="The row of chairs, Saturday morning" ratio="4/3" />\n' +
    '<SafeImage src="https://gofarther.dev/u/s/old.jpg" alt="Shopfront at dusk" ratio="1/1" />\n' +
    '{LIST.map((s) => <SafeImage key={s.a} src={null} alt={s.alt} ratio="1/1" />)}\n' +
    '<img src="" alt="The team" />\n',
};
const WORK = { path: "work.tsx", source: '<SafeImage src={null} alt="Shopfront at dusk" ratio="1/1" />\n' };
const PAGES = [HOME, WORK];
const LIB = [{ name: "shop-front.jpg", url: "https://gofarther.dev/u/s/shop-front.jpg" }];

const said = (pictures) => ({ content: [{ type: "tool_use", name: "choose_pictures", input: { pictures } }] });
const slotFor = (page, alt) => imageSlots(PAGES).find((s) => s.page === page && s.alt === alt);

// ── the whole layer ─────────────────────────────────────────────────────────

const fake = (pictures, { library = LIB, generate } = {}) => {
  const seen = { generated: [] };
  const deps = {
    send: async () => ({ ...said(pictures), usage: { input_tokens: 800, output_tokens: 40 } }),
    library: async () => library,
    ...(generate === undefined ? {} : { generate: async (d) => { seen.generated.push(d); return generate; } }),
  };
  return { deps, seen };
};

test("THE PICTURE BRANCH PUBLISHES, and prices a made picture before making it", () => {
  // Neither is visible to a unit test: `worker.js` cannot be imported, so a
  // branch that swaps the source and never publishes reports success while the
  // live site is unchanged, and one that skips the affordability check calls a
  // paid image model on an empty balance.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const from = w.indexOf('if (eLayer === "picture") {');
  assert.ok(from > 0, "the picture branch is gone or moved");
  const rest = [...w.matchAll(/if \(eLayer === "[a-z]+"\) \{/g)].map((m) => m.index).filter((i) => i > from);
  const block = w.slice(from, rest.length ? rest[0] : from + 6000);
  // `publishStep` since 2026-08-29 — the edit route's branches hand their pages
  // to a deferring wrapper so the spine runs ONCE per message (owner: "if the
  // act was 2 things then 1 publish"). The property is unchanged: this branch
  // still hands its pages to the publish path.
  assert.match(block, /publishStep\(env, \{/, "a swap that is never published is a change the owner cannot see");
  assert.match(block, /imagesAffordable\(1, \{ balance/, "a made picture must be priced against the real balance first");
  // AGAINST THE WHOLE FILE, not the branch — the import is at the top, and
  // asserting it inside a window that starts at the branch can only ever fail.
  assert.match(w, /import \{[^}]*runPictureEdit[^}]*\} from "\.\/builder\/site-picture\.mjs"/,
    "a call to a name that was never imported is a ReferenceError on the edit path");
});

// ── NOWHERE TO PUT IT: the handoff to the page layer ────────────────────────
//
// This lane fills a slot that already exists, so "add a photo to the about
// page" — on a page with none — was a REFUSAL: the one shape of picture request
// the layer's own description advertises and the code cannot do. It hands
// SIDEWAYS to `page` (one page, one model call) rather than up the ladder,
// which rewrites every page of the site to add one picture.

const REPLY = (input) => ({ content: [{ type: "tool_use", name: "choose_pictures", input }] });
const SLOTS = [
  { page: "src/routes/index.tsx", alt: "The row of chairs" },
  { page: "src/routes/book.tsx", alt: "The shopfront" },
];

test("THE ROUTE FORWARDS THE HANDOFF, and the layer that decides it is the module", () => {
  // The wiring layer, where this repo has recorded twelve dead features. The
  // module can name a lane perfectly and the route can drop it, and from the
  // customer's side that is indistinguishable from the model never naming one.
  const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = worker.indexOf('if (eLayer === "picture")');
  assert.ok(at > 0, "the picture branch is gone — rescope this");
  const branch = worker.slice(at, worker.indexOf("const pPub = await recompileAndPublish", at));
  assert.ok(branch.length > 400, "the picture window is empty — the anchor moved");
  // RE-ANCHORED 2026-09-23: the module escalates for two reasons that are two
  // classes, so the route names the handoff explicitly and explains the other
  // (`picture/no-slots`). The property — the layer and page are FORWARDED —
  // is unchanged.
  assert.match(branch, /escalate\("needs-place", \{ layer: pOut\.layer, page: pOut\.page \}\)/,
    "the route drops the handoff — a page with no slot goes to the full revise instead of one page");
});

// ─────────────────────────────────────────────────────────────────────────────
// HOW MANY EMPTY PICTURE FRAMES A CHANGE ADDED (2026-09-17)
//
// `countImageSlots` counts `@@IMG:` TOKENS and answers the same question for a
// BUILD. Its own comment says why it exists — *"a NEW page that wants one
// publishes with a placeholder and, until this, said nothing about it"* — and
// the addon's directive forbids tokens, so on the one path that ADDS pages it
// has always answered 0 and the customer's sentence never fired.
// ─────────────────────────────────────────────────────────────────────────────
const PG = (path, ...imgs) => ({ path, source: "function C(){ return <main>" + imgs.join("") + "</main> }" });
const EMPTY = (alt) => '<SafeImage src="" alt="' + alt + '" />';
const FULL = (alt) => '<SafeImage src="/u/fw/x.jpg" alt="' + alt + '" />';

// ─────────────────────────────────────────────────────────────────────────────
// A PICTURE A PAGE DRAWS FROM A LIST IN ITS OWN SOURCE (2026-09-19)
//
// Owner, after run 51: *"Fix the mismatch between the gallery's seven empty
// frames and the reply's 'one photo space.'"*
// ─────────────────────────────────────────────────────────────────────────────

/** The two kit components that take one — read off their own prop types. */
const KIT_LIST = (items) =>
  '<Gallery className="mt-10" items={[\n' + items.map((i) => "    " + i + ",\n").join("") + "  ]} />";

// A REAL TWO-ENTRY GALLERY, written where it renders — the ordinary shape, and
// its one reader is the key-set assertion at the end of the case below. It is
// declared HERE rather than beside that assertion because a `const` read from
// above its own line is this repository's recorded temporal-dead-zone trap, and
// "the test callback runs after the module finishes evaluating" is a reason
// that holds today and is not one worth resting on.
const LIST_SHAPE_PAGE =
  'export default function P() {\n' +
  '  return <Gallery items={[{ alt: "the bench", src: null }, { alt: "the window", src: null }]} />;\n' +
  '}\n';

// ── TAKING A PHOTOGRAPH OFF VERSUS KEEPING ITS SPACE (2026-09-29) ────────────
//
// Reproduced through the real edit route and compiled with the real build: the
// lane picker was promised "the slot that held it goes with it", the picture
// tool's only removal emptied the `src`, and the customer who asked for the
// photo to come off got a grey placeholder captioned with its description.
// Owner: *"distinguishes removing a photo element from explicitly clearing a
// photo while keeping its space"*, with *"reliable TSX structure"*, wrappers
// kept unless *"demonstrably just the removed photo's container"*, exact target
// identity, contradictions reported, and accurate refusals.

const PARSE = await tweakParser();
/** The slot with that description on a one-page site, read the way the route reads it. */
const slotIn = (source, alt) => imageSlots([{ path: "p.tsx", source }]).find((s) => s.alt === alt);
/** Take it off, and hand back the result beside the source it came from. */
function takeOff(source, alt, parse = PARSE) {
  const cut = photoRemoval(source, slotIn(source, alt), parse);
  return cut.ok ? { ...cut, out: source.slice(0, cut.from) + source.slice(cut.to) } : cut;
}
const PHOTO = '<SafeImage src="/u/s/counter.jpg" alt="The counter" />';
const page = (body) => "export function P() {\n  return (\n    <main>\n" + body + "    </main>\n  );\n}\n";
