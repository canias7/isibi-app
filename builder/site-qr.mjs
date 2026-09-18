/**
 * A QR CODE ON THE SITE (owner's call, 2026-08-29: "qr code maker as optional…
 * in the design step").
 *
 * ── WHY THIS IS A BUILD-TIME IMAGE AND NOT A COMPONENT ──────────────────────
 *
 * The owner's own answer, asked directly: the code is FOR the site — a café's
 * menu, a booking link, a wifi network, a card at a stall — not a generator the
 * visitor drives. That settles where the work happens. A QR matrix depends on
 * nothing but its payload, so computing it once at build time and baking the
 * result in costs the visitor no download, no JavaScript and no time, where a
 * browser-side encoder costs all three on every page load for a picture that
 * never changes. It is the share card's argument exactly.
 *
 * ── WHY A LIBRARY AND NOT OUR OWN ENCODER ───────────────────────────────────
 *
 * QR is Reed-Solomon error correction over a spec with four encoding modes, 40
 * sizes and eight mask patterns, and its failure mode is the worst kind
 * available here: an encoder that is subtly wrong produces a code that LOOKS
 * exactly like a QR and does not scan. Nothing in a build, a render check or a
 * screenshot can tell those apart — only a phone can — so a hand-rolled one
 * would be unfalsifiable by every instrument we have. `qrcode-generator` is one
 * file, no dependencies of its own, and is bundled into the Worker at deploy.
 *
 * ── THE SVG IS ONE PATH, NOT A GRID OF RECTANGLES ───────────────────────────
 *
 * The library's own `createSvgTag` emits a `<rect>` per dark module: measured at
 * 8,464 characters for a 25-module code, which is most of a `MAX_FAVICON` for a
 * picture of a square. Runs of adjacent modules are merged into horizontal
 * strokes of one `<path>` instead — same image, a fraction of the bytes, and it
 * is a single element the page can colour with one rule.
 */
import qrcode from "qrcode-generator";
// THE LIST, THE NAMES AND THE PAYLOAD RULE LIVE ONE MODULE OVER (2026-09-03),
// dependency-free, because the container writes the files and cannot import
// this module's encoder. Forwarded here so every existing reader keeps its
// import path — in the TWO-LINE form, because `export { X } from` binds nothing
// locally and `qrSvg` below calls `readQrText` (the ReferenceError
// `test/worker-imports.test.mjs` exists for).
import { MAX_QR_TEXT, MAX_QRS, readQrText, QR_NAME, QR_FILE, qrName, qrFile, qrList, patchQr, qrRefusal, qrUnplaced } from "./site-qr-list.mjs";
export { MAX_QR_TEXT, MAX_QRS, readQrText, QR_NAME, QR_FILE, qrName, qrFile, qrList, patchQr, qrRefusal, qrUnplaced };

/**
 * The matrix as one `<path>`, merging horizontal runs.
 *
 * `quiet` IS NOT DECORATION AND IS NOT OPTIONAL. The QR spec requires four
 * modules of clear margin; without it a scanner cannot find the code's edge
 * against whatever the page puts beside it, and the failure is intermittent —
 * it scans on a white band and fails on a dark one, which is exactly the kind of
 * bug nobody reproduces.
 */
export function qrSvg(text, { quiet = 4 } = {}) {
  const read = readQrText(text);
  if (!read.text) return { svg: null, why: read.why };
  let qr;
  try {
    // Type 0 = "pick the smallest size that fits". Error correction M: the
    // middle setting, and the right one for a code that is printed and may be
    // scuffed — H wastes a third of the capacity, L does not survive a smudge.
    qr = qrcode(0, "M");
    qr.addData(read.text);
    qr.make();
  } catch (e) {
    // The library throws when the payload will not fit any size. That is a real
    // refusal with a real reason, and it must not read as "we have no QR step".
    return { svg: null, why: "too much data for one code" };
  }
  const n = qr.getModuleCount();
  const size = n + quiet * 2;
  let d = "";
  for (let row = 0; row < n; row++) {
    let run = 0;
    for (let col = 0; col <= n; col++) {
      const on = col < n && qr.isDark(row, col);
      if (on) { run++; continue; }
      if (run) {
        // One horizontal stroke per run: move to its start, draw its width,
        // close. `h` and `v` are relative, so the numbers stay small.
        d += "M" + (col - run + quiet) + " " + (row + quiet) + "h" + run + "v1h-" + run + "z";
        run = 0;
      }
    }
  }
  if (!d) return { svg: null, why: "an empty code" };
  // `shape-rendering="crispEdges"` because a QR is a grid of squares and
  // anti-aliasing its edges is what makes a small one fail to scan.
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + " " + size + '" ' +
    'width="' + size + '" height="' + size + '" shape-rendering="crispEdges">' +
    '<rect width="' + size + '" height="' + size + '" fill="#fff"/>' +
    '<path d="' + d + '" fill="#000"/></svg>';
  return { svg, why: null };
}

/**
 * THE INVERSE OF THE EMITTER ABOVE: the module set a drawing really carries.
 *
 * ── WHY THIS LIVES HERE AND NOT IN THE THING THAT CHECKS IT ─────────────────
 *
 * It was written inline inside `test/site-marks.test.mjs`, which was the only
 * reader. A live run has to ask the same question of a code served off a real
 * site — *"does this open the URL we think it does"* — and a second copy of a
 * matrix reader is the recorded two-copies trap in the one place it cannot be
 * noticed: two readers disagreeing about our own drawing would show up as a
 * live check passing while the guard is red, or the reverse, with nothing
 * saying which is right. The module that WRITES the path owns the reader of it.
 *
 * ── THE QUIET ZONE IS DERIVED, NOT PASSED IN ────────────────────────────────
 *
 * A served file is all a live check has, so being TOLD the margin would be
 * assuming the very thing worth checking. Row 0 of every QR is the top finder
 * pattern — dark from column 0 — so the smallest x any stroke starts at IS the
 * margin, and the module count falls out of the viewBox: `n = size - 2·quiet`.
 *
 * ── AND THE STROKE PATTERN IS STRICTER THAN THE EMITTER'S ───────────────────
 *
 * `h(\d+)v1h-\3z` requires the two run lengths to AGREE, where `h-\d+` would
 * admit a stroke that opens seven modules wide and closes six. A drawing that
 * fails that is unreadable rather than half-read: this answers `ok: false` and
 * a caller refuses, which is the fail-closed direction for a picture whose
 * whole failure mode is looking right and not scanning.
 */
export function qrModules(svg) {
  const s = String(svg == null ? "" : svg);
  const no = (why) => ({ ok: false, why, modules: null, size: 0, quiet: 0, n: 0 });
  const box = s.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!box || box[1] !== box[2]) return no("no square viewBox — this is not one of our codes");
  const strokes = [...s.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)];
  if (!strokes.length) return no("no strokes — nothing is drawn, or the path is not the shape we emit");
  // …AND EVERY `M` IN THE PATH MUST BE ONE OF THEM. `matchAll` SKIPS what it
  // cannot match, so one malformed stroke among four hundred good ones was
  // silently dropped and the drawing read as a code missing a few modules —
  // which a comparison then blames on the payload, sending somebody to check an
  // address that is fine. Found by the guard for this, which replaced ONE
  // stroke's run length and watched the reader answer `ok`. Counting the `M`s
  // makes a partly-malformed drawing unreadable, which is what the caller needs
  // to hear: half-read is the one answer a picture like this must never give.
  // NO `\b` BEFORE THE `M`: the strokes are concatenated with no separator
  // (`…h-7zM12 4h…`) and `z` and `M` are both word characters, so a word
  // boundary matches only the FIRST one — which counted 1 stroke in a path of
  // 295 and reported every good drawing as broken. Caught by running it.
  const moves = (s.match(/M\d+ \d+h/g) || []).length;
  if (moves !== strokes.length) return no(`${moves - strokes.length} of ${moves} stroke(s) are not the shape we emit — this drawing is only partly readable`);
  const size = Number(box[1]);
  let quiet = Infinity;
  for (const m of strokes) quiet = Math.min(quiet, Number(m[1]), Number(m[2]));
  const n = size - quiet * 2;
  if (!(n > 0)) return no(`the margin (${quiet}) does not fit inside the drawing (${size})`);
  const modules = new Set();
  for (const m of strokes) {
    const x = Number(m[1]), y = Number(m[2]), run = Number(m[3]);
    for (let i = 0; i < run; i++) modules.add((y - quiet) + "," + (x - quiet + i));
  }
  return { ok: true, why: null, modules, size, quiet, n };
}

/**
 * DOES THIS DRAWING OPEN THAT ADDRESS? — module for module, against the
 * library's own matrix.
 *
 * NOT A DECODER, AND THAT IS THE STRONGER CLAIM. A decoder answers what a
 * scanner happens to read from an image; this answers whether the drawing IS
 * the canonical encoding of the text we expect, which is the only ground truth
 * available without a camera. A code that is subtly wrong looks exactly like a
 * QR, and a build, a render check and a screenshot all pass it.
 *
 * EVERY DISAGREEMENT IS NAMED RATHER THAN COUNTED. A different size, a module
 * dark here and not there, an unreadable drawing and a payload that would never
 * be drawn at all each need a different fix, so each gets its own sentence —
 * "the code does not match" is the answer that sends somebody looking
 * everywhere at once.
 *
 * AND AN EMPTY COMPARISON IS A REFUSAL — a DECLARED BELT, measured inert
 * rather than assumed so. `[].every(...)` is `true`, so a reference matrix with
 * nothing dark in it would pass every module test there is; through
 * `qrcode-generator` that cannot happen, because the three finder patterns are
 * always drawn — MEASURED: the EMPTY payload still gives a 21×21 matrix with
 * 234 dark modules. It stays because the check is about the OBSERVER rather
 * than about this library, and a sweep cannot say that a line is deliberate.
 * Its mutant flips the polarity instead of cutting it, which IS observable.
 */
export function qrEncodes(svg, text) {
  const read = readQrText(text);
  if (!read.text) return { ok: false, why: `the expected payload is not one we would ever draw: ${read.why}`, missing: [], extra: [] };
  const got = qrModules(svg);
  if (!got.ok) return { ok: false, why: `the drawing could not be read: ${got.why}`, missing: [], extra: [] };
  let ref;
  try { ref = qrcode(0, "M"); ref.addData(read.text); ref.make(); }
  catch (e) { return { ok: false, why: "the expected payload is too much data for one code", missing: [], extra: [] }; }
  const n = ref.getModuleCount();
  if (n !== got.n) return { ok: false, why: `the drawing is ${got.n} modules across and ${JSON.stringify(read.text)} encodes to ${n}`, missing: [], extra: [] };
  const expected = new Set();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (ref.isDark(r, c)) expected.add(r + "," + c);
  if (!expected.size) return { ok: false, why: "the reference matrix is empty — nothing would be compared", missing: [], extra: [] };
  const missing = [...expected].filter((k) => !got.modules.has(k));
  const extra = [...got.modules].filter((k) => !expected.has(k));
  if (missing.length || extra.length) {
    return {
      ok: false,
      why: `the drawing is not this payload's code — ${missing.length} module(s) dark in the code and not drawn, ${extra.length} drawn and not dark`,
      missing: missing.slice(0, 6), extra: extra.slice(0, 6),
    };
  }
  return { ok: true, why: null, missing: [], extra: [], n, quiet: got.quiet, dark: expected.size };
}

/**
 * The design field.
 *
 * TWO PROPERTIES AND BOTH REQUIRED. A QR with no caption is a black square a
 * visitor has no reason to point a camera at — measured behaviour of every QR
 * anybody has ever ignored — so the label is not decoration, it is the half that
 * makes the other half work.
 *
 * ── WHY THE WORDING CHANGED (2026-08-30, after three paid declines) ─────────
 *
 * Runs 84, 85 and 86 all designed a site where a QR was the obvious answer and
 * all three declined. Run 86 removed every excuse: the brief handed over real
 * wifi credentials and said "put a code on the page they can scan to join it",
 * both of this field's own triggers fired, and `readQrText`/`qrSvg` were checked
 * to accept and draw that exact payload beforehand. The model used the
 * credentials and printed them as text with copy buttons.
 *
 * THE NATURAL A/B IS `gif`, ON THE SAME BUILD. It is optional in the same way,
 * offered in the same call, and it FIRED — the drum in the window is on the
 * published page. So the difference is not the mechanism, the placement or the
 * brief; it is the wording, and the two fields were measurably different:
 *
 *     gif   1,225 chars, 4 omit-ish phrases, and a "WHAT IT IS FOR" paragraph
 *     qr      668 chars, 7 omit-ish phrases, and no positive case at all
 *
 * FOUR SEPARATE INSTRUCTIONS TO OMIT — "OMIT THIS FIELD ENTIRELY", "that is the
 * right answer for most sites", "or it does not exist", and a fourth inside
 * `points` — against one trigger buried mid-sentence between two of them. A
 * model reading that answers the question it was asked four times and skips the
 * one it was asked once.
 *
 * So this now has the shape that works on `gif`: the omit rule ONCE, then what
 * the thing is FOR in concrete terms. The strictness is kept and not loosened —
 * "never invent the destination" stays, stated once, in `points`, which is the
 * property it actually governs. The owner's call when asked was to give the
 * brief a real destination rather than relax that rule, and this respects it.
 */
/**
 * ONE CODE, as an item of the list below. Shared with the addon step's `qr`
 * kind by shape — the edit lane answers a PATCH to one of these by name.
 *
 * `name` IS WHAT MAKES SEVERAL POSSIBLE (owner, 2026-09-03: "it should carry
 * more"): it names the file (`qr-wifi.svg`) and the binding the page reads
 * (`SITE_QRS.wifi`), so two codes on one site never fight over one slot.
 */
export const QR_ITEM = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description:
        "A short handle for THIS code, unique on the site: \"wifi\", \"booking\", \"menu\". Lowercase " +
        "letters and digits only — it names the file and the binding the page reads it through.",
    },
    points: {
      type: "string",
      description:
        "What scanning it does, as the exact string the code carries. A full URL (\"https://…\"); " +
        "`WIFI:T:WPA;S:<network>;P:<password>;;` to join a network; `tel:` a number; `mailto:` an address; " +
        "`geo:lat,lng` a place. NEVER INVENT IT — a QR is the one thing on a page a visitor cannot read " +
        "before acting on it, so it carries something the brief actually gives you, or this code is " +
        "left out.",
    },
    label: {
      type: "string",
      description:
        "The few words printed beside it, telling a visitor why they would scan it: \"Menu\", " +
        "\"Book a table\", \"Join our wifi\". A QR with no caption is a black square nobody points a camera at.",
    },
  },
  required: ["name", "points", "label"],
};

export const QR_FIELD = {
  type: "array",
  items: QR_ITEM,
  maxItems: MAX_QRS,
  description:
    "THE QR CODES ON THE PAGE — squares a visitor points their phone at to get something they would " +
    "otherwise have to type. OMIT THIS FIELD ENTIRELY unless the brief gives you a real destination for " +
    "one; that is the right answer for most sites. A site may carry several, one per real destination " +
    "the brief gives — the wifi, the booking link, the menu — each with its own name.\n" +
    "WHAT IT IS FOR: the moment somebody is standing in front of the business, phone in hand, and the " +
    "alternative is copying a password off a screen, keying a long address, or asking a person who is not " +
    "there. A wifi network they can join by pointing a camera. A number they can ring without typing it. " +
    "A place they can walk to. If the brief describes that moment, this field is the answer to it — the " +
    "words the page prints beside each code are what make somebody bother, so say those too.\n" +
    "THEY ARE DRAWN FOR YOU. Say what each carries and what it is called; the codes are generated at " +
    "build time and placed on the page, so you never draw one and never need a library for it.",
};
