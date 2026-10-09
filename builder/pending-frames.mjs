// AN ADDITION'S PHOTOGRAPH FRAMES, MARKED AND FILLED THROUGH THE SYNTAX TREE
// (2026-10-09, parallel rounds 5–7). Moved out of `site-images.mjs` in round 7
// WITH NO IMPORTS on purpose: the same code runs wherever a parser is — the
// Worker's own modules under Node in the site's container, and the container's
// build service (`build-server.mjs`, the `/frames` door), which the Worker
// asks when its own isolate has no parser (`frameParser()` answers null in
// workerd). One implementation, so the two places cannot come to read a frame
// differently. `site-images.mjs` re-exports what it exported before.

/** A shared component's real path (`site-files.mjs`'s `partPath`, which this file may not import). */
const PART_FILE = (p) => "src/routes/-parts/" + String((p && p.name) || "") + ".tsx";

/**
 * A FRAME WHOSE PHOTOGRAPH IS STILL BEING CONFIRMED (2026-10-09, parallel round
 * 5; found through the syntax tree since round 6). An addition's purchase whose
 * outcome nobody can tell yet is not bought again and its page is not held
 * back: the frame is published empty, as any frame the step could not fill,
 * and MARKED with the purchase it waits on, so a later step can fill exactly
 * that frame with exactly that photograph once the purchase is known — without
 * rewriting the page or redoing the addition.
 *
 * THE FRAME IS FOUND BY THE PAGE'S OWN PARSER, never by spelling (Codex's
 * reproduction, round 6: `src={"@@IMG:…@@"}` is the same JSX as
 * `src="@@IMG:…@@"` and was swept unmarked, the part ending partial). Every
 * string literal whose WHOLE value is the token is a frame, wherever valid
 * TSX puts it:
 *   - a JSX attribute's value, quoted either way (`src="…"`, `src='…'`), or
 *     braced (`src={"…"}`, `` src={`…`} ``) — on a kit element or on one of the
 *     site's own components (`<Card image="…" />`);
 *   - a value a shared component reads (`{ image: "…" }`, an array entry, a
 *     variable, an argument, a default).
 * Each becomes an empty string followed by the purchase's mark, a comment
 * (the empty string, then the comment `pending-photo:<id>`, braced where it
 * was a bare attribute value):
 * the frame renders exactly as an unfilled one, and the comment travels with
 * the literal through any later edit that keeps it.
 *
 * WHAT CANNOT BE SAFELY RESOLVED IS SAID, NEVER GUESSED: the token inside a
 * longer string (`url(@@IMG:…@@)`), in text, in a position that is not a value
 * (a type, a key, a module name), in a file that does not parse, or any
 * occurrence the tree does not account for — and every token when no parser
 * is given. Those are `unlocated` (with why); the token is swept as before and
 * the caller keeps the purchase as pending work with no frame.
 *
 * `parse` is the injected parser (`frameParser()`'s, below). Answers the files with
 * every located frame marked, the marks made (`{ token, id, file }`, one per
 * file a token was marked in) and the unlocated (`{ token, id, file, why }`).
 */
export function markPending(pages, idByToken, parse = null) {
  const map = idByToken instanceof Map ? idByToken : new Map();
  const wanted = [...map].filter(([token, id]) => typeof token === "string" && token && typeof id === "string" && PENDING_ID.test(id));
  const marked = [], unlocated = [];
  const files = (Array.isArray(pages) ? pages : []).map((p) => {
    // A SHARED COMPONENT IS NAMED BY ITS REAL PATH: parts carry `name`, not
    // `path`, and a frame in one must still say which file it is in.
    const path = String((p && p.path) || (p && p.name ? PART_FILE(p) : ""));
    let src = String((p && p.source) || "");
    const here = wanted.filter(([token]) => src.includes(token));
    if (!here.length) return p;
    const found = typeof parse === "function" ? literalFrames(src, here.map(([t]) => t), parse) : null;
    const edits = [];
    for (const [token, id] of here) {
      const occurrences = src.split(token).length - 1;
      const at = found && !found.error ? found.frames.filter((f) => f.token === token) : [];
      // EVERY OCCURRENCE ACCOUNTED FOR, OR NONE IS MARKED: a frame marked
      // beside one the tree could not read would fill one copy and leave the
      // other swept, which is a guess about which one the customer sees.
      if (!found) { unlocated.push({ token, id, file: path, why: "no-parser" }); continue; }
      if (found.error) { unlocated.push({ token, id, file: path, why: "unparsed" }); continue; }
      if (at.length !== occurrences || at.some((f) => !f.ok)) {
        const bad = at.find((f) => !f.ok);
        unlocated.push({ token, id, file: path, why: bad ? bad.why : "embedded" });
        continue;
      }
      for (const f of at) edits.push({ start: f.start, end: f.end, text: (f.bare ? '{"" ' + pendingMark(id) + "}" : '"" ' + pendingMark(id)) });
      marked.push({ token, id, file: path });
    }
    edits.sort((a, b) => b.start - a.start);
    for (const e of edits) src = src.slice(0, e.start) + e.text + src.slice(e.end);
    return { ...p, source: src };
  });
  return { pages: files, marked, unlocated };
}

/** A purchase's id: 24 hex, as `purchaseId` makes it. */
const PENDING_ID = /^[0-9a-f]{24}$/;

/** The mark a pending photograph's frame carries, right after its empty literal. */
export const pendingMark = (id) => "/*pending-photo:" + id + "*/";

/** Does a source still carry a frame marked for this purchase? */
export const hasPendingMark = (source, id) => PENDING_ID.test(String(id || "")) && String(source || "").includes(pendingMark(id));

// The literal kinds that can hold a frame's value, and the parents under which
// replacing one with an empty string and its mark is the same expression in
// the same place. Compared BY VALUE (`SK[name]`): the parser's reverse table
// names some kinds by an alias (`FirstTemplateToken`), so a name read off a
// node is not the name it was declared with.
const LIT_KINDS = ["StringLiteral", "NoSubstitutionTemplateLiteral"];
const TEXT_KINDS = ["JsxText", "TemplateHead", "TemplateMiddle", "TemplateTail"];
const VALUE_PARENTS = [
  "PropertyAssignment", "ArrayLiteralExpression", "VariableDeclaration", "ConditionalExpression",
  "ParenthesizedExpression", "ReturnStatement", "Parameter", "BindingElement", "CallExpression",
  "NewExpression", "BinaryExpression", "AsExpression", "SatisfiesExpression", "JsxExpression",
];
const kindIs = (P, n, names) => !!n && names.some((name) => typeof P.SK[name] === "number" && n.kind === P.SK[name]);

/**
 * Every literal in `src` whose whole value is one of `tokens`, through the
 * syntax tree: `{ token, start, end, ok, bare, why }` — `bare` a JSX
 * attribute's own quoted value (it is braced when marked), `ok` false with
 * `why` where replacing it would not be the same expression in the same place.
 * Literals and text that merely CONTAIN a token are reported too (`embedded`).
 */
function literalFrames(src, tokens, parse) {
  let P;
  try { P = parse(src); } catch { return { error: true }; }
  const file = P && P.file;
  if (!file || typeof P.each !== "function" || !P.SK) return { error: true };
  // A FILE THE PARSER COULD NOT READ CLEANLY is not one to rewrite.
  if (Array.isArray(file.parseDiagnostics) && file.parseDiagnostics.length) return { error: true };
  const frames = [];
  const visit = (n) => {
    if (kindIs(P, n, LIT_KINDS)) {
      const value = n.text;
      const token = tokens.find((t) => value === t);
      if (token) frames.push({ token, start: n.getStart(file), end: n.end, ...placeOf(P, n) });
      else for (const t of tokens) if (value.includes(t)) frames.push({ token: t, start: n.getStart(file), end: n.end, ok: false, why: "embedded" });
    } else if (kindIs(P, n, TEXT_KINDS)) {
      const value = String(n.text || "");
      for (const t of tokens) if (value.includes(t)) frames.push({ token: t, start: n.getStart(file), end: n.end, ok: false, why: "embedded" });
    }
    P.each(n, visit);
  };
  try { visit(file); } catch { return { error: true }; }
  return { frames };
}

/** Where a whole-token literal stands: a bare JSX attribute value, a value position, or neither. */
function placeOf(P, n) {
  const parent = n.parent;
  if (kindIs(P, parent, ["JsxAttribute"])) return parent.initializer === n ? { ok: true, bare: true, why: "" } : { ok: false, why: "not-a-value" };
  if (kindIs(P, parent, ["JsxExpression"])) {
    const ok = parent.expression === n && kindIs(P, parent.parent, ["JsxAttribute"]);
    return { ok, bare: false, why: ok ? "" : "text" };
  }
  if (kindIs(P, parent, ["PropertyAssignment"]) && parent.initializer !== n) return { ok: false, why: "not-a-value" };
  if (kindIs(P, parent, ["VariableDeclaration", "Parameter", "BindingElement"]) && parent.initializer !== n) return { ok: false, why: "not-a-value" };
  if (kindIs(P, parent, ["BinaryExpression"])) {
    const ok = parent.right === n && kindIs(P, parent.operatorToken, ["QuestionQuestionToken", "BarBarToken"]);
    return { ok, bare: false, why: ok ? "" : "not-a-value" };
  }
  return kindIs(P, parent, VALUE_PARENTS) ? { ok: true, bare: false, why: "" } : { ok: false, why: "not-a-value" };
}

/**
 * FILL A PURCHASE'S MARKED FRAMES IN ONE SOURCE, through the syntax tree: each
 * mark must sit right after a string literal that is STILL EMPTY — the frame
 * as the addition left it. One that holds anything else was changed after the
 * addition (the customer's own picture, say) and is left exactly as it is.
 * Answers `{ source, filled, changed }`; `filled` 0 with `changed` 0 means no
 * mark is here. Without a parser, or on a file that does not parse, nothing
 * is filled (`unverified`).
 */
export function fillPending(source, id, url, parse = null) {
  const src = String(source || "");
  if (!PENDING_ID.test(String(id || "")) || typeof url !== "string" || !url) return { source: src, filled: 0, changed: 0 };
  const mark = pendingMark(id);
  if (!src.includes(mark)) return { source: src, filled: 0, changed: 0 };
  if (typeof parse !== "function") return { source: src, filled: 0, changed: 0, unverified: true };
  let P;
  try { P = parse(src); } catch { return { source: src, filled: 0, changed: 0, unverified: true }; }
  const file = P && P.file;
  if (!file || typeof P.each !== "function" || !P.SK || (Array.isArray(file.parseDiagnostics) && file.parseDiagnostics.length)) return { source: src, filled: 0, changed: 0, unverified: true };
  const lits = [];
  const visit = (n) => { if (kindIs(P, n, LIT_KINDS)) lits.push(n); P.each(n, visit); };
  visit(file);
  const edits = [];
  let changed = 0;
  for (let at = src.indexOf(mark); at >= 0; at = src.indexOf(mark, at + mark.length)) {
    // ONLY AN EMPTY LITERAL RIGHT BEFORE THE MARK (whitespace between) is a
    // frame; a mark typed inside a string has no literal ending before it.
    let lit = null;
    for (const n of lits) if (n.end <= at && /^\s*$/.test(src.slice(n.end, at)) && (!lit || n.end > lit.end)) lit = n;
    if (!lit || lit.text !== "") { changed++; continue; }
    edits.push({ start: lit.getStart(file), end: at + mark.length });
  }
  let out = src;
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) out = out.slice(0, e.start) + JSON.stringify(url) + out.slice(e.end);
  return { source: out, filled: edits.length, changed };
}

let PARSER;
/**
 * WHAT `frameParser()` ANSWERS FROM NOW ON, for a test that stands in for the
 * Worker's isolate (`null`: no parser there) — `undefined` loads the real one
 * again on the next ask. Production never calls it.
 */
export function useFrameParser(p) { PARSER = p; }
/**
 * THE PARSER THESE FRAMES ARE READ WITH, or null where none can be loaded (the
 * Worker's isolate: `typescript` is not bundled, and the name is built so the
 * bundler never tries). Only what the frame readers use: the file, the kinds by
 * value, and the parser's own walk. Loaded once.
 */
export async function frameParser() {
  if (PARSER !== undefined) return PARSER;
  PARSER = null;
  try {
    const name = ["type", "script"].join("");
    const mod = await import(/* @vite-ignore */ name);
    const ts = mod && (mod.default || mod);
    if (!ts || typeof ts.createSourceFile !== "function") return PARSER;
    PARSER = (text) => ({
      file: ts.createSourceFile("page.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
      SK: ts.SyntaxKind,
      each: (n, f) => ts.forEachChild(n, f),
    });
  } catch { PARSER = null; }
  return PARSER;
}
