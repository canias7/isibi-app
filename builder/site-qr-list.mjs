/**
 * THE QR CODES A SITE CARRIES — the list, the names, the file each one gets,
 * and the text a code may carry.
 *
 * DEPENDENCY-FREE, because two runtimes read it: the Worker, which draws the
 * codes, and the container, which writes the files and the bindings. The
 * container cannot import the drawing half — `site-qr.mjs` pulls in
 * `qrcode-generator`, which the image does not carry — so the rule that turns a
 * name into a file lives here once, and the file a code is written to and the
 * file the page is told to load cannot disagree.
 *
 * ── ONE CODE BECAME MANY (owner, 2026-09-03: "Yes, it should carry more") ──
 *
 * The stored field was one `{ points, label }`, the build drew one `qr.svg`, the
 * pages got one `SITE_QR`, and the addon refused a second because there was
 * nowhere to keep it — a wall that was a consequence of the shape, not a rule
 * anybody chose. Now the field is a LIST of named codes, each `{ name, points,
 * label }`, each written to its own file and reachable by name (`SITE_QRS.wifi`).
 *
 * THE OLD SHAPE IS READ AS A ONE-ENTRY LIST NAMED `qr`, whose file is still
 * `qr.svg` and whose binding is still `SITE_QR`, so every site published before
 * today serves exactly the bytes it served yesterday. Nothing migrates: every
 * reader goes through `qrList`, and the store is rewritten as a list the first
 * time a lane or the addon answers.
 *
 * NAMES ARE IDENTIFIERS, not slugs. `SITE_QRS.join-our-wifi` is a subtraction
 * to JavaScript, so a name is lowercase letters and digits only — `wifi`,
 * `booking`, `menu` — and a caption used as a fallback has its separators
 * removed rather than dashed.
 */

/** How many codes one site may carry. A ceiling with no floor. */
export const MAX_QRS = 6;

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

/** A code's name: an identifier the page can write after a dot. */
export const QR_NAME = /^[a-z][a-z0-9]{0,23}$/;

/** The file a named code is written to, and the pattern every such file matches. */
export const QR_FILE = /^qr(?:-[a-z][a-z0-9]{0,23})?\.svg$/;

/**
 * A usable name out of what was answered, or out of the caption when the
 * answer named nothing — or null when neither yields one.
 *
 * REFUSES A NON-STRING RATHER THAN COERCING ONE: `String(["wifi"])` is `"wifi"`,
 * and this repo has shipped that coercion as a real bug three times.
 */
export function qrName(v, fallback) {
  const ident = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/^[0-9]+/, "").slice(0, 24);
  const n = typeof v === "string" ? ident(v) : "";
  if (n && QR_NAME.test(n)) return n;
  const f = typeof fallback === "string" ? ident(fallback) : "";
  return f && QR_NAME.test(f) ? f : null;
}

/**
 * The file for a name. `qr` — the name every code written before today has —
 * keeps `qr.svg`, so an existing page's `<img src={SITE_QR}>` keeps its bytes.
 */
export function qrFile(name) {
  return name === "qr" ? "qr.svg" : "qr-" + name + ".svg";
}

/**
 * The stored field as a list, whatever shape it was stored in.
 *
 *   - a single `{ points, label }` (every site before 2026-09-03) → one entry
 *     named `qr`;
 *   - a list → each entry cleaned, an unnamed one named from its caption, a
 *     repeated name dropped (first wins), the whole cut to `MAX_QRS`;
 *   - anything else → `[]`.
 *
 * A code is BOTH halves: an entry without a destination or without a caption is
 * dropped, because the first has nothing to draw and the second is a black
 * square nobody points a camera at.
 */
export function qrList(v) {
  const raw = Array.isArray(v)
    ? v
    : (v && typeof v === "object" ? [{ ...v, name: typeof v.name === "string" && v.name ? v.name : "qr" }] : []);
  const out = [];
  const seen = new Set();
  for (const e of raw) {
    if (!e || typeof e !== "object" || Array.isArray(e)) continue;
    const points = typeof e.points === "string" ? e.points.trim() : "";
    const label = typeof e.label === "string" ? e.label.trim().slice(0, 80) : "";
    if (!points || !label) continue;
    const name = qrName(e.name, label);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, points, label });
    if (out.length >= MAX_QRS) break;
  }
  return out;
}

/**
 * ONE CODE CHANGED, THE LIST KEPT — what the `qr` edit lane answers folds into.
 *
 * The lane answers a PATCH to one code (`{ name, points?, label? }`), never the
 * list: a model handing back a whole list is a model that can drop an entry,
 * and a dropped code is a printed card that stops working. The site with ONE
 * code needs no name; a site with several is asked which. The halves not
 * mentioned come back character for character.
 *
 * Answers `{ ok, list, moved, name }` or `{ ok: false, why, names }`, and `why`
 * is one of `no-codes`, `which-code`, `no-such-code`, `bad-destination` — each
 * with a sentence in `qrRefusal`.
 */
export function patchQr(stored, patch) {
  const list = qrList(stored);
  const names = list.map((c) => c.name);
  if (!list.length) return { ok: false, why: "no-codes", names };
  const p = patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
  const said = typeof p.name === "string" && p.name.trim() ? p.name.trim() : "";
  let i = -1;
  if (said) {
    const wanted = qrName(said);
    i = wanted ? list.findIndex((c) => c.name === wanted) : -1;
    if (i < 0) return { ok: false, why: "no-such-code", names, said };
  } else if (list.length === 1) {
    i = 0;
  } else {
    return { ok: false, why: "which-code", names };
  }
  const cur = list[i];
  const points = typeof p.points === "string" && p.points.trim() ? p.points.trim() : cur.points;
  const label = typeof p.label === "string" && p.label.trim() ? p.label.trim().slice(0, 80) : cur.label;
  if (points !== cur.points && !readQrText(points).text) return { ok: false, why: "bad-destination", names, said: cur.name };
  if (points === cur.points && label === cur.label) return { ok: true, list, moved: false, name: cur.name };
  return { ok: true, list: list.map((c, j) => (j === i ? { name: c.name, points, label } : c)), moved: true, name: cur.name };
}

/** What the customer is told when a patch could not be applied, by its token. */
export function qrRefusal(why, names, said) {
  const have = (Array.isArray(names) ? names : []).filter(Boolean);
  const listed = have.length ? have.map((n) => "`" + n + "`").join(", ") : "none";
  switch (why) {
    case "no-codes": return "This site has no QR code yet — ask me to add one and say where it should point.";
    case "which-code": return "This site has " + have.length + " QR codes (" + listed + ") — say which one you mean.";
    case "no-such-code": return "This site has no QR code called " + (said ? "`" + String(said).slice(0, 40) + "`" : "that") + " — its codes are: " + listed + ".";
    case "bad-destination": return "A QR code can carry a link, a phone number, an email address, a wifi network or plain text — not that. Nothing was changed.";
    default: return "I couldn't change that QR code — say which code and what should be different about it.";
  }
}

/**
 * Which of the site's codes no page places — by binding name, or for the
 * FIRST code by the old `SITE_QR` binding, which every page written before
 * today uses. The names, in list order, so a page step can be told exactly
 * what to show.
 */
export function qrUnplaced(codes, pages) {
  const srcs = (Array.isArray(pages) ? pages : []).map((p) => String((p && p.source) || ""));
  return (Array.isArray(codes) ? codes : [])
    .filter((c, i) => {
      const n = c && typeof c.name === "string" ? c.name : "";
      if (!n) return false;
      const byName = new RegExp("\\bSITE_QRS\\s*(?:\\.\\s*" + n + "\\b|\\[\\s*[\"']" + n + "[\"']\\s*\\])");
      const legacy = i === 0 ? /\bSITE_QR\b/ : null;
      return !srcs.some((s) => byName.test(s) || (legacy && legacy.test(s)));
    })
    .map((c) => c.name);
}
