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

/**
 * What a QR may carry. Long payloads need a denser code, and a dense code
 * printed small does not scan — the cap is a scanning limit, not a storage one.
 */
export const MAX_QR_TEXT = 300;

/**
 * The schemes a site's own QR may point at.
 *
 * NOT A SECURITY BOUNDARY IN THE USUAL SENSE — a phone camera will not execute a
 * `javascript:` URL, so the risk is not code running. It is that a QR is the one
 * thing on a page a visitor CANNOT read before acting on it: they point a camera
 * and trust what comes back. So the payload is held to what a business QR
 * honestly is, and anything else is refused rather than quietly encoded.
 *
 * Plain text with no scheme at all is allowed and is a real answer — a wifi
 * password, a table number, a stall's name.
 */
const OK_SCHEME = /^(?:https?:|mailto:|tel:|sms:|geo:|WIFI:|BEGIN:VCARD)/i;
const BAD_SCHEME = /^(?:javascript|data|vbscript|file|blob):/i;

/**
 * Refuse WHOLE, like the favicon, and say why.
 *
 * A site with a refused QR simply has no QR — the same contract every drawn mark
 * on this platform has, and for the same reason: half a QR is a picture that
 * wastes a visitor's attention and then fails.
 */
export function readQrText(v) {
  if (typeof v !== "string") return { text: null, why: "not text" };
  const s = v.trim();
  if (!s) return { text: null, why: "empty" };
  if (s.length > MAX_QR_TEXT) return { text: null, why: "over " + MAX_QR_TEXT + " characters" };
  if (BAD_SCHEME.test(s)) return { text: null, why: "a scheme a QR must never carry" };
  // A colon early in the string is a scheme; no colon is plain text, which is
  // fine. This is deliberately not "does it look like a URL" — `geo:` and
  // `WIFI:` are real business QRs and neither is one.
  const scheme = /^[A-Za-z][A-Za-z0-9+.-]*:/.exec(s);
  if (scheme && !OK_SCHEME.test(s)) return { text: null, why: "the scheme " + scheme[0] };
  return { text: s, why: null };
}

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
 * The design field.
 *
 * TWO PROPERTIES AND BOTH REQUIRED. A QR with no caption is a black square a
 * visitor has no reason to point a camera at — measured behaviour of every QR
 * anybody has ever ignored — so the label is not decoration, it is the half that
 * makes the other half work.
 */
export const QR_FIELD = {
  type: "object",
  properties: {
    points: {
      type: "string",
      description:
        "What scanning it does. A full URL (\"https://…\"), or `tel:`, `mailto:`, `WIFI:` for a network, " +
        "or plain text. It must be something that is TRUE for this business — a made-up URL is a QR that " +
        "leads nowhere, which is worse than no QR at all. If the brief does not give you a real destination, " +
        "leave this whole field out.",
    },
    label: {
      type: "string",
      description:
        "The few words printed beside it, telling a visitor why they would scan it: \"Menu\", " +
        "\"Book a table\", \"Join our wifi\". A QR with no caption is a black square nobody points a camera at.",
    },
  },
  required: ["points", "label"],
  description:
    "A QR CODE ON THE PAGE. OMIT THIS FIELD ENTIRELY unless the brief asks for one or the business plainly " +
    "works that way — a café putting its menu on the table, a stall taking bookings, a venue sharing its " +
    "wifi. That is the right answer for most sites.\n" +
    "IT IS DRAWN FOR YOU. Say what it points at and what it is called; the code itself is generated at build " +
    "time and placed on the page, so you never draw one and never need a library for it.\n" +
    "NEVER INVENT THE DESTINATION. A QR is the one thing on a page a visitor cannot read before acting on " +
    "it — they point a camera and trust what comes back — so it points at something the brief actually gives " +
    "you, or it does not exist.",
};
