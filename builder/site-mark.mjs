// ONE MARK, SEVERAL FORMS.
//
// Owner, 2026-09-07: *"instead of it being 3 things or 4 or 5, its gotta be one,
// wordmark, but it can be made in svg, etc etc etc"* → *"exactly yeah"*.
//
// WHAT WAS THERE: THREE FIELDS PER MARK, WITH A LADDER NOBODY COULD SEE.
// A site's header mark lived in `config.logo` (an uploaded raster, written by
// the `logo` rung), `look.wordmark` (the literal word `text`, or an SVG the
// model drew) and, under both, the brand name in type. The tab icon had the
// identical split: `config.icon`, `look.favicon`, and the initials mark. Six
// storage locations, two doors, three names for two slots — and the precedence
// between them lived a layer away, in the container's baker, as `if (!logoValue)`
// and `if (!icon)`.
//
// WHAT THAT COST, MEASURED. Run 41 (2026-09-06): the `wordmark` lane drew 612
// characters of SVG for fretwork-1, stored it, published a whole build, took 2
// credits and reported success — for something no visitor could ever be shown,
// because that site's header has carried an uploaded PNG since run 16 and the
// upload wins. Doing less than was asked while saying it was done. The wall
// built the next morning refused such an ask for nothing, which was honest and
// was still three things wearing one job.
//
// SO: ONE FIELD PER MARK, CARRYING A FORM.
//
//   look.wordmark = { form: "text" }                     the name in type
//                 | { form: "svg",   svg: "<svg …>" }    drawn
//                 | { form: "image", url: "/u/…png" }    a file a person sent
//
//   look.favicon  = { form: "initials" }                 drawn from the name
//                 | { form: "svg",   svg: "<svg …>" }
//                 | { form: "image", url: "/u/…png" }
//
// A new form REPLACES the one before it. There is nothing to outrank and no
// ladder to be invisible inside, so run 41's ask simply works.
//
// PROVENANCE IS DERIVED, NEVER STORED. The rule the ladder was really carrying
// is the owner's, 2026-08-28: *a model must not outrank a person* — a rebuild's
// design step must not wipe a mark somebody uploaded. That survives here as
// `ownedMark`, which reads the FORM: only a person can produce `image` (the
// model has no way to make an upload URL) and only the model produces `svg` (an
// uploaded SVG is refused — see the security note below). A stored `set: "owner"`
// field would be a second value that can disagree with the first, which is the
// trap `dir` is derived to avoid one module over.
//   If an uploaded SVG is ever admitted, that equivalence breaks and provenance
//   becomes a real field. It is not admitted, so it is not a field.
//
// NOTHING MOVES. `markOf` folds a site still carrying the old pair — every live
// site, today — into a form, with the old precedence exactly: the upload first,
// the drawn mark under it, the floor under that. The new shape is written the
// first time anything touches the mark, and every published site's frozen
// `server.js` bakes the same string it bakes now. The `qrList` rule.
//
// THE WIRE IS UNCHANGED, AND `markPayload` IS THE ONE PLACE THAT PROJECTS IT.
// The container's baker re-validates whatever it is handed, because it also
// takes hand-written payloads and survives version skew — so it keeps its own
// reading and its own ladder as a belt. What changes is that the Worker now
// resolves the form first and sends ONE half of each pair, so that ladder can
// never fire; `test/site-mark.test.mjs` pins that rather than leaving a dead
// precedence to rot, which is this repository's own recorded trap.
//
// Dependency-free apart from the drawing validators, so the container can import
// it and every decision here is driven with no R2, no model and no Worker.
import { readWordmark, cleanFavicon } from "./site-favicon.mjs";

/** The two marks a site carries. They are NOT one mark — see `MARK_WORDS`. */
export const MARKS = Object.freeze(["wordmark", "favicon"]);

/**
 * What each mark falls back to when it has no form of its own.
 *
 * The floor is a real form and not an absence: `text` renders the brand in type
 * (which is what most small businesses' logo IS) and `initials` draws a mark
 * from the name. Both are what every site had before any of this existed, so a
 * mark can always be resolved and no consumer has to handle a null.
 */
export const MARK_FLOOR = Object.freeze({ wordmark: "text", favicon: "initials" });

/** Every form each mark may take, richest first — the fold's own order. */
export const MARK_FORMS = Object.freeze({
  wordmark: Object.freeze(["image", "svg", "text"]),
  favicon: Object.freeze(["image", "svg", "initials"]),
});

/**
 * The LEGACY config key each mark's upload was stored under.
 *
 * Read by the fold and by nothing else. These keys stop being WRITTEN the
 * moment anything sets a form; they are still read for ever, because a site
 * nobody has edited since is entitled to keep serving what it serves.
 */
export const MARK_UPLOAD = Object.freeze({ wordmark: "logo", favicon: "icon" });

/**
 * What to call each mark to a customer.
 *
 * "wordmark" is the field's name and a word most people do not use. The header
 * one is what somebody means by "my logo"; the other is the tab icon.
 */
export const MARK_WORDS = Object.freeze({ wordmark: "header logo", favicon: "tab icon" });

/**
 * WHAT AN `image` FORM'S URL MAY BE, and this is the ONE copy of that rule.
 *
 * It was written out twice before this — inline in `writeSiteBrand` and again in
 * `siteIconFrom` — which is the recorded "two lists of the same thing": both end
 * up in a `src` inside generated TypeScript, so both have to refuse anything
 * that could be a `javascript:` URL, and two copies of that refusal drift in
 * silence. Both import this now.
 *
 * An absolute https address (an owner's own CDN) or a path under this
 * platform's own upload prefix. Nothing else — not `data:`, not protocol-
 * relative, not a bare path.
 */
export const MARK_URL_RE = Object.freeze([
  /^https:\/\/[^\s"'<>]+$/i,
  /^\/u\/[a-z0-9][a-z0-9-]{0,80}\/[a-z0-9._-]{1,120}$/i,
]);

/** Is this string usable as a mark's `image` URL? Never coerces — see below. */
export function markUrlOk(v) {
  // `String(["a"])` is `"a"`, which has shipped as a real bug three times here,
  // so a non-string is refused rather than converted.
  if (typeof v !== "string") return false;
  const s = v.trim();
  return !!s && MARK_URL_RE.some((re) => re.test(s));
}

/** One of the two, asked with `hasOwn` so `"constructor"` is not a mark. */
export function isMark(field) {
  return typeof field === "string" && MARKS.includes(field);
}

/** The form a mark falls to with nothing of its own. Never null. */
export function markFloor(field) {
  return { form: isMark(field) ? MARK_FLOOR[field] : "text" };
}

/**
 * READ ONE STORED VALUE — the new shape or the old one — or answer null.
 *
 * BOTH SHAPES, deliberately, and this is the whole of the migration: a stored
 * object is a form, a stored STRING is what the field held before forms existed.
 * `"text"` was the wordmark's name-in-type answer and an SVG document was the
 * drawn one; the favicon never had a `text` option, so a string there is only
 * ever a drawing.
 *
 * THE DRAWING IS RE-VALIDATED HERE, by the same readers that validated it
 * before, so a stored document that has become unacceptable (a scanner rule
 * tightened, a row written by some other route) reads as no mark rather than as
 * a mark we then hand to a browser. `readWordmark` sizes from the drawing's own
 * viewBox — the header constrains by height — and `cleanFavicon` forces a
 * square; that difference is why there are two readers and not one.
 */
export function readMark(field, v) {
  if (!isMark(field)) return null;
  if (typeof v === "string") return readLegacyMark(field, v);
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  // `hasOwn` and never truthiness: `{}["constructor"]` is truthy, and a form
  // read off the prototype is a mark nobody stored.
  const form = Object.prototype.hasOwnProperty.call(v, "form") ? v.form : null;
  if (typeof form !== "string" || !MARK_FORMS[field].includes(form)) return null;
  if (form === "image") {
    const url = Object.prototype.hasOwnProperty.call(v, "url") ? v.url : null;
    return markUrlOk(url) ? { form: "image", url: url.trim() } : null;
  }
  if (form === "svg") {
    const svg = Object.prototype.hasOwnProperty.call(v, "svg") ? v.svg : null;
    const drawn = readDrawn(field, svg);
    return drawn ? { form: "svg", svg: drawn } : null;
  }
  // The floor, which carries nothing beside its name.
  return { form };
}

/** The drawn document, validated by the reader that mark uses, or "". */
function readDrawn(field, svg) {
  if (typeof svg !== "string" || !svg.trim()) return "";
  if (field === "favicon") {
    const r = cleanFavicon(svg);
    return r && r.svg ? r.svg : "";
  }
  const r = readWordmark(svg);
  return r && r.kind === "svg" ? r.svg : "";
}

/** A value stored before forms existed: `"text"`, or a drawn document. */
function readLegacyMark(field, s) {
  const t = s.trim();
  if (!t) return null;
  // `text` is the wordmark's floor said out loud, and the ONLY string that is
  // not a document. A document starts with a tag, so the two cannot collide —
  // the rule `readWordmark` already keeps.
  if (field === "wordmark" && /^text$/i.test(t)) return { form: "text" };
  const drawn = readDrawn(field, t);
  return drawn ? { form: "svg", svg: drawn } : null;
}

/**
 * THE FOLD: what mark this site actually has, whichever shape it is stored in.
 *
 * The whole config, not the look, because the old shape put the upload BESIDE
 * `look` — `mergeLook` rebuilds its output from `EDIT_FIELDS` alone, so an
 * upload stored on the look would be dropped by the next colour change, which
 * is exactly why the logo rung stored it outside. That reason expires with this
 * function: a form IS a look field, so a mark set today survives the merge like
 * every other design decision.
 *
 * ORDER IS THE OLD PRECEDENCE, EXACTLY. An upload first (a person's own file),
 * the drawn mark under it, the floor under that. So a site nobody has touched
 * resolves to precisely what it serves today, and the change is invisible until
 * somebody asks for a new mark.
 *
 * Never null: an unreadable config is a site on its floor, which is what such a
 * site publishes anyway.
 */
export function markOf(config, field) {
  if (!isMark(field)) return markFloor(field);
  const c = config && typeof config === "object" ? config : {};
  const look = c.look && typeof c.look === "object" ? c.look : {};
  const stored = look[field];
  // A FORM ALREADY WRITTEN IS THE ANSWER AND THE FOLD STOPS THERE, so a mark set
  // through the new door is never overruled by an upload key the old one left
  // behind. Only an OBJECT is that — a stored STRING is the legacy drawn mark
  // and belongs BELOW the upload, which is the whole of the old precedence. The
  // first cut read both through `readMark` and returned whichever it could
  // parse, which inverted the ladder: fretwork-1's uploaded PNG lost to the
  // wordmark run 41 drew under it, and its next publish would have taken the
  // owner's own logo off. Found by driving it, not by reading it.
  if (stored && typeof stored === "object") {
    const m = readMark(field, stored);
    if (m) return m;
    // AN UNREADABLE FORM FALLS THROUGH TO THE OLD PAIR rather than to the floor.
    // Cannot-tell must never read as nothing-there: a junk value here is a site
    // that still has whatever it had before anybody wrote junk.
  }
  const up = c[MARK_UPLOAD[field]];
  if (markUrlOk(up)) return { form: "image", url: up.trim() };
  return (typeof stored === "string" ? readLegacyMark(field, stored) : null) || markFloor(field);
}

/**
 * WHAT IS UNDER THE TOP FORM on a site still carrying the old pair.
 *
 * Only the fold can answer this, and only for as long as the old pair exists:
 * a site on the new shape stores ONE value, so there is nothing beneath it.
 * That is what "one mark" means and it is not an oversight — see `markRemove`.
 */
export function markUnder(config, field) {
  if (!isMark(field)) return null;
  const c = config && typeof config === "object" ? config : {};
  const look = c.look && typeof c.look === "object" ? c.look : {};
  // Only a LEGACY string can be under an upload: a form written today replaced
  // whatever it replaced, and `markOf` would have answered it outright.
  if (typeof look[field] !== "string") return null;
  if (!markUrlOk(c[MARK_UPLOAD[field]])) return null;
  return readLegacyMark(field, look[field]);
}

/**
 * THE VALUE TO STORE WHEN A MARK IS TAKEN OFF.
 *
 * Dropping the top form. On a site still carrying the old pair the fold knows
 * what sits beneath the upload — a drawn mark the ladder was hiding — so a
 * removal reveals it exactly as it did before forms existed, and writes it AS A
 * FORM, so the reveal happens once rather than being re-derived for ever. On a
 * site already on the new shape there is nothing under the one value and the
 * mark falls to its floor.
 *
 * Both answers are a form, so the caller stores one thing either way.
 */
export function markRemove(config, field) {
  return markUnder(config, field) || markFloor(field);
}

/**
 * DID A PERSON SUPPLY THIS, rather than a model draw it?
 *
 * The one question the old precedence was really asking. Derived from the form
 * because the two are the same fact today (above): a model cannot mint an
 * upload URL, and an uploaded SVG is refused, so `image` is exactly "somebody
 * sent us a file".
 */
export function ownedMark(mark) {
  return !!mark && mark.form === "image";
}

/** Two marks that would publish identically. Used to answer "already". */
export function sameMark(a, b) {
  if (!a || !b || a.form !== b.form) return false;
  if (a.form === "image") return a.url === b.url;
  if (a.form === "svg") return a.svg === b.svg;
  return true;
}

/**
 * THE WIRE PROJECTION — the container's four fields, off the one stored form.
 *
 * The payload keeps the shape it has always had because the baker RE-VALIDATES
 * what it is handed and must keep doing so: it also serves hand-written
 * payloads and survives version skew, and what it writes is an SVG document
 * served from the site's own origin. What changes is that exactly one half of
 * each pair is ever sent now, so the baker's own precedence can never fire.
 *
 * `undefined` rather than `""` for the drawn half, matching what the two call
 * sites already send, so a payload is byte-identical to the one they built.
 */
export function markPayload(field, mark) {
  const m = mark && mark.form ? mark : markFloor(field);
  const upKey = MARK_UPLOAD[field] || "logo";
  const drawnKey = field === "favicon" ? "favicon" : "wordmark";
  if (m.form === "image") return { [upKey]: m.url, [drawnKey]: undefined };
  if (m.form === "svg") return { [upKey]: "", [drawnKey]: m.svg };
  // The floor. `text` is the wordmark's own word for it and the container reads
  // it as "render the brand in type"; the favicon's floor is silence, and the
  // container draws the initials mark for it.
  return { [upKey]: "", [drawnKey]: field === "wordmark" ? "text" : undefined };
}

/**
 * THE STORED LOOK WITH BOTH MARKS RESOLVED TO FORMS.
 *
 * What every reader that MERGES or PUBLISHES a look wants, because after this
 * the marks are ordinary look fields and nothing downstream has to know the old
 * pair existed. In particular `mergeLook` can then see that a mark was
 * uploaded, which is what lets the "a model must not outrank a person" rule
 * live in the merge instead of in the container.
 *
 * The other keys are copied through untouched — this replaces two fields and
 * decides nothing else.
 */
export function lookWithMarks(config) {
  const c = config && typeof config === "object" ? config : {};
  const look = c.look && typeof c.look === "object" ? c.look : null;
  const marks = {};
  let any = false;
  for (const f of MARKS) {
    marks[f] = markOf(c, f);
    if (marks[f].form !== MARK_FLOOR[f]) any = true;
  }
  // NOTHING STORED IS STILL NOTHING STORED, and this half is not tidiness.
  // `markOf` never answers null — every site resolves to at least its floor —
  // so an unconditional `{ ...look, ...marks }` turns a site with NO stored look
  // into a truthy object, and the edit path's "a site may have a stylesheet and
  // a thin look" gate keys on `!priorLook`. The first cut did exactly that and
  // the guard for that gate caught it: a site with neither a look nor a
  // stylesheet stopped being refused and went all the way to a real compile.
  // So a config that has nothing to resolve hands its own `look` straight back,
  // null or undefined exactly as it arrived.
  if (!look && !any) return c.look;
  return { ...(look || {}), ...marks };
}

/**
 * THE FOUR WIRE FIELDS OFF ONE CONFIG — `markPayload` for both marks at once.
 *
 * Every publish path sends these four and every one of them has been the site
 * of a "read here and never put on the wire" bug, because the container
 * rewrites `public/` and `site-brand.ts` from pristine copies on EVERY build:
 * a payload that omits a mark takes it OFF the site. One reader for all four
 * is what stops the next path forgetting one.
 */
export function markWire(config) {
  return {
    ...markPayload("wordmark", markOf(config, "wordmark")),
    ...markPayload("favicon", markOf(config, "favicon")),
  };
}

/** How a customer hears a form, per mark. One clause, never a sentence. */
export function markWords(field, mark) {
  const m = mark && mark.form ? mark : markFloor(field);
  if (m.form === "image") return field === "favicon" ? "the icon you sent" : "the logo you sent";
  if (m.form === "svg") return field === "favicon" ? "a drawn icon" : "a drawn wordmark";
  return field === "favicon" ? "the mark drawn from your initials" : "your name in type";
}
