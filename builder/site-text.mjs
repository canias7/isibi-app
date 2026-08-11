// Changing the words on a page without paying for a rebuild.
//
// A typo in a heading used to cost a full revise: ~21 credits, a model call, a
// container compile, and — until the source was stored — every other page
// rewritten alongside it. The words are not in the database, they are in the
// page source, so the Data panel could never reach them.
//
// Now that a build stores the source it produced, the owner can edit the text
// directly and the site is recompiled and republished with NO model call at
// all. The container still runs, so it is not free in time; it is free in
// credits, which is the part that made a typo feel expensive.
//
// THE WHOLE DIFFICULTY IS TELLING PROSE FROM CODE. A page is TSX: it holds
// class names, import paths, route ids, column names and component props, and
// replacing the wrong one produces a site that does not compile — or worse, one
// that compiles and reads a column that does not exist. So this offers only
// strings it is confident about, and applies a change only at the exact place
// it offered it.
//
// A plain module with no imports, tested outside the Worker and the container.

/** Longer than this and it is data, not a label somebody wants to retype. */
const MAX_LEN = 400;

/** Shorter than this and it is almost always an identifier or a class fragment. */
const MIN_LEN = 2;

/**
 * Strings that look like prose but are code, listed because each one has bitten
 * something in this repo or is obviously next.
 *
 * A `className` is the biggest single source of English-looking text in a TSX
 * file ("flex items-center justify-between"), and replacing one silently
 * restyles the page.
 */
const CODE_ATTRS = /\b(className|to|href|src|id|key|type|value|htmlFor|table|order|dir|slot|variant|size|as|role|aria-[a-z-]+|data-[a-z-]+)\s*=\s*$/;

/**
 * `name=` is the one that depends on WHAT IT IS ON.
 *
 * On a DOM element it is the submitted field key — `<input name="email">` — and
 * rewriting it changes which column a booking lands in, which is exactly the
 * class of silent breakage this list exists for. On a COMPONENT it is an
 * ordinary prop, and on every page this platform generates it is THE BUSINESS
 * NAME: `<SiteChrome name="Tenfold Nails">`, the heading a visitor reads on
 * every page of the site.
 *
 * Listed unconditionally, both were invisible: the free text editor could not
 * change a business's name in its own header, and a rename through the look
 * layer moved the `<h1>` and the tagline and left the chrome saying the old
 * name — measured, 2 of 3.
 *
 * The distinction is one React enforces rather than one we invented: a
 * lowercase tag is a DOM element and a capitalised one is a component.
 */
const NAME_ATTR = /\bname\s*=\s*$/;
function nameIsCode(before) {
  if (!NAME_ATTR.test(before)) return false;
  const open = before.lastIndexOf("<");
  // No opening tag in the window we can see: assume the dangerous reading, which
  // is the one that leaves the string alone.
  if (open < 0) return true;
  return !/^[A-Z]/.test(before.slice(open + 1));
}

/** A whole string that is plainly not something a person wrote to be read. */
function looksLikeCode(v) {
  const s = String(v);
  if (!s.trim()) return true;
  if (s.length < MIN_LEN || s.length > MAX_LEN) return true;
  // A BARE LOWERCASE WORD IS AN IDENTIFIER, whatever its length. `useRows(
  // "bookings", { order: "created_at", dir: "desc" })` offered all three as
  // editable text until this — and renaming a column produces a page that
  // compiles and then reads a column that does not exist, which ships.
  //
  // What it costs, stated: a genuinely lowercase one-word label ("menu") is not
  // offered. Almost every real label is either capitalised or more than one
  // word, and the failure in the other direction is a broken site.
  if (!/\s/.test(s) && !/[A-Z]/.test(s)) return true;
  // Paths, urls, imports, tokens, class strings, template holes.
  if (/^[./@]/.test(s)) return true;
  if (/^https?:\/\//i.test(s)) return true;
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return true;
  if (/^\d+(\.\d+)?(px|rem|em|%|s|ms)?$/i.test(s)) return true;
  if (/\{|\}|\$\{|<\/|\/>/.test(s)) return true;
  // A run of tailwind-shaped tokens: two or more of `a-b`, `a-b-c`, `md:x`.
  const words = s.trim().split(/\s+/);
  if (words.length > 1 && words.every((w) => /^[a-z0-9]+(:[a-z0-9[\]./-]+)?(-[a-z0-9./[\]-]+)*$/i.test(w) && /[-:]/.test(w))) return true;
  return false;
}

/**
 * The words on a page, each with enough context to put a change back exactly.
 *
 * TWO SHAPES ONLY: a quoted string that is not the value of a code-ish
 * attribute, and JSX text between tags. Everything else is left alone —
 * template literals, comments, computed expressions — because the point is a
 * list somebody can safely retype, not complete coverage.
 *
 * `at` is the character offset in the source, and it is what makes the edit
 * exact: the same sentence can appear twice on a page, and replacing "the first
 * one that matches" changes whichever the scan happened to reach first.
 */
export function extractText(source) {
  const src = String(source == null ? "" : source);
  const out = [];
  const seen = new Set();
  const push = (text, at, kind) => {
    if (looksLikeCode(text)) return;
    const key = at + ":" + text;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text, at, kind });
  };

  // Quoted strings, skipping the ones that are a code-ish attribute's value.
  for (const m of src.matchAll(/(["'])((?:[^\\\n]|\\.)*?)\1/g)) {
    // WIDE ENOUGH TO SEE THE TAG. 24 characters reaches back past `name=` and
    // no further, so `nameIsCode` could never find the `<` that decides it —
    // and with no tag in view it answers "code", which is the safe direction
    // and also the answer that made the whole distinction do nothing.
    const before = src.slice(Math.max(0, m.index - 120), m.index);
    if (CODE_ATTRS.test(before) || nameIsCode(before)) continue;
    // An import specifier or an object key is not prose either.
    if (/\bfrom\s*$/.test(before) || /[{,]\s*$/.test(before)) continue;
    push(m[2], m.index + 1, "string");
  }

  // JSX text: between a `>` that closes a tag and the `<` that opens the next.
  for (const m of src.matchAll(/>([^<>{}]+)</g)) {
    const raw = m[1];
    const text = raw.trim();
    if (!text) continue;
    push(text, m.index + 1 + raw.indexOf(text), "jsx");
  }

  return out.sort((a, b) => a.at - b.at);
}

/**
 * Put one change back, at exactly the place it was offered.
 *
 * REFUSES RATHER THAN GUESSES. The caller sends the offset and the text it
 * expects to find there; if the source has moved on — a revise happened in
 * another tab, an edit was applied twice — the offset no longer holds that
 * string and the edit is refused. Applying it anyway would overwrite whatever
 * is there now, which on a page of TSX is how a site stops compiling.
 */
export function applyEdit(source, { at, from, to } = {}) {
  const src = String(source == null ? "" : source);
  const i = Math.floor(Number(at));
  const was = String(from == null ? "" : from);
  const now = String(to == null ? "" : to);
  if (!Number.isFinite(i) || i < 0 || !was) return { ok: false, error: "nothing to change" };
  if (src.slice(i, i + was.length) !== was) return { ok: false, error: "that text has changed — reload and try again" };
  if (!now.trim()) return { ok: false, error: "the new text cannot be empty" };
  if (now.length > MAX_LEN) return { ok: false, error: "that is too long for a label" };
  // WHAT A REPLACEMENT MAY NOT CONTAIN. This lands in TSX, so a quote ends the
  // string it sits in and a brace opens an expression — either turns a typo fix
  // into a site that does not compile. There is no correct escape here that
  // survives both string and JSX contexts, so the characters are simply
  // refused, the way the colour parser refuses anything that is not a colour.
  if (/["'`{}<>\\]/.test(now)) return { ok: false, error: "quotes, braces and angle brackets can't be used here" };
  return { ok: true, source: src.slice(0, i) + now + src.slice(i + was.length) };
}

/**
 * A whole batch, applied back to front.
 *
 * BACK TO FRONT IS THE ENTIRE REASON THIS IS NOT A LOOP THE CALLER WRITES: each
 * edit changes the length of the source, so applying them in order invalidates
 * every offset after the first. Highest offset first, and every later offset is
 * still correct because nothing before it has moved.
 */
export function applyEdits(pages, edits) {
  const list = (Array.isArray(pages) ? pages : []).map((p) => ({ path: p.path, source: p.source }));
  const byPath = new Map(list.map((p) => [p.path, p]));
  const wanted = (Array.isArray(edits) ? edits : []).filter((e) => e && byPath.has(e.path));
  if (!wanted.length) return { ok: false, error: "no changes to make", pages: list, applied: 0 };

  // WORKED ON A SECOND COPY, so a refusal can hand back the ORIGINAL. Mutating
  // `list` as it goes and returning it on failure gives the caller a
  // half-edited set — which then gets published, because it looks like the
  // pages it asked for.
  const draft = new Map([...byPath].map(([k, v]) => [k, { path: v.path, source: v.source }]));
  const ordered = wanted.slice().sort((a, b) => Number(b.at) - Number(a.at));
  let applied = 0;
  for (const e of ordered) {
    const page = draft.get(e.path);
    const r = applyEdit(page.source, e);
    // ONE BAD EDIT FAILS THE WHOLE BATCH. A partial apply leaves the owner
    // looking at a site where some of what they typed took and some did not,
    // with no way to tell which — and the failure they would see is a compile
    // error, not their own text.
    if (!r.ok) return { ok: false, error: r.error, pages: list, applied: 0 };
    page.source = r.source;
    applied++;
  }
  return { ok: true, pages: list.map((p) => draft.get(p.path) || p), applied };
}
