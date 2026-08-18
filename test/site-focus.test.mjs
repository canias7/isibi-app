// WHICH PART OF A PHOTOGRAPH SURVIVES THE CROP.
//
// WHAT WAS WRONG. `SafeImage` renders `object-cover` inside a fixed ratio and
// never set `object-position`, so every picture on every published site was
// cropped from the CENTRE — a head-and-shoulders photo in a 21/9 hero loses the
// head, a tall shopfront in a 4/3 card loses the sign. Neither is a fault in the
// photograph, and neither was fixable at any price: the owner had to re-crop the
// file and upload it again.
//
// MEASURED IN A REAL BROWSER before a line of the lane was written: the three
// positions read `50% 0%`, `50% 50%` and `50% 100%`, an unrecognised value falls
// back to the middle, and the rendered crop really moves (a tall image with a
// red band at the top and a blue one at the bottom shows red under "top" and
// blue under "bottom"). This file holds the decisions; the class landing in a
// real compiled bundle is asserted in test/integration/site-build.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  FOCUS_VALUES, imageSlots, readPictures, applyPictures, pictureReply,
  runPictureEdit, PICTURE_TOOL,
} from "../builder/site-picture.mjs";
import { ASK_TOOL } from "../builder/site-ask.mjs";

const UI = path.join(import.meta.dirname, "../builder/lovable/template/src/components/ui");
const safeImage = fs.readFileSync(path.join(UI, "safe-image.tsx"), "utf8");

const PAGE = (src) => [{ path: "index.tsx", source: src }];
const REF = () => PAGE(
  `<SafeImage src="/u/s/a.jpg" alt="Mo at the chair" ratio="21/9" />\n` +
  `<SafeImage src="/u/s/b.jpg" alt="The shopfront" ratio="4/3" focus="bottom" />\n` +
  `<img src="/u/s/c.jpg" alt="A plain img" />\n` +
  `<SafeImage src={row.photo} alt="Bound framing" focus={row.crop} />`);

const reply = (pictures) => ({ content: [{ type: "tool_use", input: { pictures } }] });
const deps = (pictures, library = []) => ({
  send: async () => reply(pictures),
  library: async () => library,
});

// ── THE COMPONENT ───────────────────────────────────────────────────────────

test("every value the lane can write, the component can render", () => {
  // DERIVED FROM THE ENUM, so a sixth position is covered without anybody
  // remembering this file. A value the writer emits and the component does not
  // map is a change reported as applied that moves nothing.
  const map = /const FOCUS_CLASS: Record<string, string> = \{([\s\S]*?)\n\};/.exec(safeImage);
  assert.ok(map, "FOCUS_CLASS is no longer declared the way this scan expects");
  for (const v of FOCUS_VALUES) {
    assert.match(map[1], new RegExp(`\\b${v}:`), `SafeImage cannot render "${v}"`);
  }
  // `centre` maps to NOTHING on purpose — it is the browser's own default, so a
  // picture put back to the middle carries no class at all.
  assert.match(map[1], /centre:\s*""/, "centre writes a class rather than none");
});

/**
 * The file with its comments blanked, LENGTH-PRESERVING so offsets stay valid.
 *
 * FOUND BY THIS TEST FAILING AGAINST CORRECT CODE. `safe-image.tsx` opens with
 * a comment reading "An `<img>` that cannot render broken", so a scan for the
 * real element matched the PROSE and ran to a `/>` a hundred lines away. Prose
 * describing a thing contains that thing's spelling — the hazard this repo has
 * now recorded in a lint, a router guard and here.
 */
function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
}

test("the position is applied to the IMAGE, where object-cover is", () => {
  // `object-position` only means anything on the element that is being cropped.
  // On the wrapper it is inert — which typechecks, bundles, publishes and moves
  // nothing, the failure this whole lane exists to fix.
  const img = /<img[\s\S]*?\/>/.exec(code(safeImage));
  assert.ok(img, "safe-image.tsx no longer renders an <img> the way this scan expects");
  assert.match(img[0], /object-cover/, "the image is not object-cover, so a position does nothing");
  assert.match(img[0], /FOCUS_CLASS\[focus\]/, "the position is not applied to the image itself");
});

test("the enum accepts a widened string, or a page holding pictures in a const cannot compile", () => {
  // The lesson `SiteLayout` paid for: a `const` object's property widens to
  // `string`, which a bare literal union refuses — measured as TS2322 against
  // the real reference pages, costing the whole site.
  const t = /export type ImageFocus = ([^;]+);/.exec(safeImage);
  assert.ok(t, "ImageFocus is no longer declared the way this scan expects");
  assert.match(t[1], /\(string & \{\}\)/,
    "ImageFocus is a CLOSED union — a page writing it into a const widens to string and the build fails");
  for (const v of FOCUS_VALUES) assert.ok(t[1].includes(`"${v}"`), `ImageFocus does not offer "${v}"`);
});

// ── READING A SLOT ──────────────────────────────────────────────────────────

test("a slot reports the framing it has, and refuses one that is bound", () => {
  const s = imageSlots(REF());
  const by = Object.fromEntries(s.map((x) => [x.alt, x]));
  assert.equal(by["Mo at the chair"].focus, "", "a picture with no focus reported one");
  assert.equal(by["The shopfront"].focus, "bottom");
  // `focus={row.crop}` is a value the site's own data decides, and overwriting
  // it drops the binding — the skip-rather-than-guess rule every scanner here
  // lives under.
  assert.equal(by["Bound framing"].focusBound, true);
  assert.equal(by["Bound framing"].focusAt, null);
});

// ── WRITING IT ──────────────────────────────────────────────────────────────

test("a framing change is inserted, replaced, and REMOVED to put it back", () => {
  const ins = applyPictures(REF(), [{ slot: imageSlots(REF())[0], focus: "top" }]);
  assert.deepEqual(ins.changed, ["index.tsx"]);
  assert.match(ins.pages[0].source, /<SafeImage focus="top" src="\/u\/s\/a\.jpg"/);

  const rep = applyPictures(REF(), [{ slot: imageSlots(REF())[1], focus: "top" }]);
  assert.match(rep.pages[0].source, /alt="The shopfront" ratio="4\/3" focus="top"/);

  // PUT BACK MEANS GONE. `centre` and an absent attribute are the same picture,
  // so a site restored to the middle is byte-identical to one never touched —
  // the source is stored and re-read on every later edit.
  const back = applyPictures(REF(), [{ slot: imageSlots(REF())[1], focus: "centre" }]);
  assert.ok(!/focus="centre"/.test(back.pages[0].source), "centre wrote the word instead of removing the attribute");
  assert.ok(!/alt="The shopfront"[^>]*focus=/.test(back.pages[0].source), "the attribute survived: " + back.pages[0].source);
});

test("a swap and a reframe on ONE element are written in one pass", () => {
  // Two edits to one element, and a second pass over offsets the first pass
  // moved lands in the middle of an attribute. Both cases: an insert (which
  // grows the source ahead of the src) and a replace.
  const slot = imageSlots(REF())[0];
  const out = applyPictures(REF(), [{ slot, url: "/u/s/new.jpg", focus: "top" }]);
  assert.match(out.pages[0].source, /<SafeImage focus="top" src="\/u\/s\/new\.jpg" alt="Mo at the chair" ratio="21\/9" \/>/,
    "the two edits corrupted each other: " + out.pages[0].source.split("\n")[0]);
});

test("a framing-only choice carries no url and is still written", () => {
  // Gated on the url alone this is read, priced, reported — and dropped before
  // anything reaches the file.
  const out = applyPictures(REF(), [{ slot: imageSlots(REF())[0], focus: "left" }]);
  assert.deepEqual(out.changed, ["index.tsx"]);
  assert.match(out.pages[0].source, /focus="left"/);
});

// ── THE LANE ────────────────────────────────────────────────────────────────

test("his head is cut off — free, and it says which way it moved", async () => {
  const out = await runPictureEdit(deps([{ page: "index.tsx", alt: "Mo at the chair", focus: "top" }]),
    { instruction: "his head is cut off", pages: REF() });
  assert.equal(out.ok, true, JSON.stringify(out.reason || out.msg));
  assert.match(out.pages[0].source, /focus="top"/);
  // NOT "adjusted the framing" — the owner cannot check that against the page.
  assert.match(out.msg, /show the top/i);
  // No image model was called at all, which is what makes this free.
  assert.equal(out.made.length, 0);
  assert.equal(out.failed, 0, "a framing change was counted as a picture that could not be made");
});

test("a refused framing NAMES the picture rather than claiming it was not found", async () => {
  // Measured before this: all four refusal paths answered "I couldn't match that
  // to any of the pictures on your site" about a picture the model found and
  // copied the description of — the one sentence that sends the owner looking
  // for the wrong thing.
  const cases = [
    [{ page: "index.tsx", alt: "The shopfront", focus: "bottom" }, /already shows the bottom/],
    [{ page: "index.tsx", alt: "A plain img", focus: "top" }, /couldn't change the framing of .A plain img./],
    [{ page: "index.tsx", alt: "Bound framing", focus: "top" }, /couldn't change the framing/],
    [{ page: "index.tsx", alt: "Mo at the chair", focus: "sideways" }, /couldn't change the framing/],
  ];
  for (const [pic, want] of cases) {
    const out = await runPictureEdit(deps([pic]), { instruction: "x", pages: REF() });
    assert.equal(out.ok, false);
    assert.match(out.msg, want, JSON.stringify(pic));
    assert.ok(!/match that to any of the pictures/.test(out.msg),
      "a refusal still claims the picture was not found: " + out.msg);
    // AND IT MUST NOT ESCALATE. The rung above rewrites the page for ~25
    // credits and cannot reframe a picture either.
    assert.ok(!out.escalate, "a refused framing bought a page rewrite");
  }
});

test("a swap that also named an impossible framing does BOTH things it can say", async () => {
  // An entry can be work AND a refusal. Collapsing the two loses the half that
  // is silent — the swap lands and the customer is told nothing about the
  // framing they also asked for.
  const out = await runPictureEdit(
    deps([{ page: "index.tsx", alt: "Mo at the chair", file: "shop.jpg", focus: "sideways" }],
      [{ name: "shop.jpg", url: "/u/s/shop.jpg" }]),
    { instruction: "x", pages: REF() });
  assert.equal(out.ok, true);
  assert.match(out.msg, /photograph on/, "the swap was lost");
  assert.match(out.msg, /couldn't change the framing/, "the refused framing was silent");
});

test("the already-that-way sentence reads the SLOT, not the refused choice", () => {
  // A refused entry carries no focus of its own — that is what refusing means —
  // so reading the choice printed "already shows the null".
  const slot = { alt: "The shopfront", focus: "bottom" };
  assert.match(pictureReply({ refused: [{ slot, refused: "already", focus: null }] }), /already shows the bottom/);
  assert.match(pictureReply({ refused: [{ slot: { alt: "Mo", focus: "" }, refused: "already" }] }), /already shows the middle/);
});

// ── REACHABILITY ────────────────────────────────────────────────────────────

test("the tool offers exactly the values the writer can write", () => {
  const f = PICTURE_TOOL.input_schema.properties.pictures.items.properties.focus;
  assert.ok(f, "choose_pictures does not offer `focus`, so nothing can ever ask for it");
  assert.deepEqual(f.enum, FOCUS_VALUES, "the tool and the writer disagree about the values");
  // A NEW PICTURE IS THE EXPENSIVE WRONG ANSWER to "it's cut off", and it would
  // very likely be cropped the same way. The tool has to say so.
  assert.match(f.description, /costs nothing/i);
});

test("the router sends a cut-off picture to this lane", () => {
  // Without the sentence every layer below it is unreachable — the shape this
  // repo has recorded thirteen times.
  const d = ASK_TOOL.input_schema.properties.layer.description;
  const from = d.indexOf('"picture" —');
  assert.ok(from > 0, "the layer description no longer opens the picture clause the way this scan expects");
  const next = /\n"[a-z]+" —/.exec(d.slice(from + 12));
  const seg = d.slice(from, next ? from + 12 + next.index : undefined);
  assert.ok(seg.length > 200, "the picture clause window collapsed to nothing");
  assert.match(seg, /cut off/i, "the router never points a cropped picture at this lane");
  assert.match(seg, /costs nothing|free/i, "the router does not say a reframe is free, so it reads as a paid swap");
});
