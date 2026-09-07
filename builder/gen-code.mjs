// THE CODE AS IT IS BEING WRITTEN — partial tool-call JSON into readable source.
//
// Owner, 2026-09-07: "yea lets do it, send the code out as it writes."
//
// WHAT ARRIVES ON THE WIRE IS NOT CODE. The generation answers a TOOL CALL, so
// what streams back is the tool's arguments as PARTIAL JSON — the page source
// is a JSON string value inside it, with its newlines as `\n` and its quotes
// escaped. Printing that raw would show a customer
// `{"pages":[{"path":"index.tsx","source":"import { createFileRoute } fro`
// rather than their site being written. This module is the one place that
// turns the first into the second.
//
// DEPENDENCY-FREE, because the container imports it (see the Dockerfile's COPY
// line and `test/dockerfile.test.mjs`, which walks the import graph).
//
// IT NEVER PARSES — a partial document has no parse. It SCANS, which is the
// only thing that works on a string that stops in the middle of a token.

/**
 * THE FIELD NAMES ARE DERIVED FROM THE TOOL, NEVER TYPED HERE.
 *
 * `write_pages` (builder/page-gen.mjs) answers `pages[] {path, name, source}`
 * and `parts[] {name, source}`. Two copies of that shape would drift the first
 * time the tool is edited, and the drift is silent: the display would quietly
 * stop finding the code and show nothing, which reads exactly like a model
 * that has not started. So the caller passes the names in, and
 * `test/gen-code.test.mjs` reads them OUT of the tool and drives this with
 * whatever it finds there today.
 */
export const CODE_FIELD = "source";
export const NAME_FIELDS = ["path", "name"];

/** How much of the tail is kept — enough to fill the panel several times over,
 *  small enough that a 6-second poll carrying it stays a small answer. The
 *  whole transcript is never sent: this is a live view of what is happening
 *  now, not a transcript, and the finished source is stored in R2 anyway. */
export const CODE_TAIL_MAX = 4000;

/**
 * The string value currently being written, and which file it belongs to.
 *
 * Answers `{ file, code }` — `file` is "" when nothing has named one yet.
 *
 * WHY THE LAST OPEN STRING AND NOT THE LAST COMPLETE ONE: while the model is
 * emitting a page, the source is the one string with no closing quote yet.
 * That is exactly the value worth showing, and it needs no guess about which
 * field is "the big one".
 *
 * AND WHY IT FALLS BACK TO THE LAST COMPLETE `source`: between two pages the
 * model is writing `"path":"menu.tsx"`, and blanking the panel for those few
 * hundred milliseconds would make a working generation flicker. The last
 * finished source stays on screen until the next one starts.
 */
export function readCodeSoFar(partial, opts) {
  if (typeof partial !== "string" || !partial) return { file: "", code: "" };
  const codeField = (opts && typeof opts.codeField === "string" && opts.codeField) || CODE_FIELD;
  const nameFields = (opts && Array.isArray(opts.nameFields) && opts.nameFields.length)
    ? opts.nameFields.filter((n) => typeof n === "string" && n)
    : NAME_FIELDS;

  let i = 0;
  const n = partial.length;
  // The key most recently completed, so a value knows what it is called. A
  // scanner cannot ask a parser this, and a value with no key is not code.
  let pendingKey = "";
  let lastKey = "";
  let file = "";
  let lastSource = "";
  let openKey = "";   // the key of the string still being written, "" if none
  let openRaw = "";   // its raw (still escaped) content

  while (i < n) {
    const c = partial[i];
    if (c !== '"') {
      // Between tokens. A colon means the string just read was a KEY; a comma
      // or a brace means the next string is a key again.
      if (c === ":") { pendingKey = lastKey; }
      else if (c === "," || c === "{" || c === "[") { pendingKey = ""; }
      i++;
      continue;
    }
    // A string starts here. Walk to its unescaped closing quote.
    i++;
    let raw = "";
    let closed = false;
    while (i < n) {
      const ch = partial[i];
      if (ch === "\\") {
        // A lone trailing backslash is half an escape — the wire stopped
        // mid-token. Keep it raw; `unescapeJson` drops it.
        raw += ch;
        if (i + 1 < n) { raw += partial[i + 1]; i += 2; } else { i += 1; }
        continue;
      }
      if (ch === '"') { closed = true; i++; break; }
      raw += ch;
      i++;
    }
    if (!closed) { openKey = pendingKey; openRaw = raw; break; }
    // A completed string: either a key (nothing follows it yet) or a value.
    if (pendingKey) {
      const val = unescapeJson(raw);
      if (pendingKey === codeField) lastSource = val;
      else if (nameFields.indexOf(pendingKey) >= 0 && val) file = val;
      pendingKey = "";
      lastKey = "";
    } else {
      lastKey = unescapeJson(raw);
    }
  }

  if (openKey === codeField) return { file, code: unescapeJson(openRaw) };
  // The open string is a path or a name — the model has moved on to the next
  // file. Its own value is not shown (it is a word, not code), but it IS the
  // file about to be written, so naming it is honest.
  if (openKey && nameFields.indexOf(openKey) >= 0) {
    const nm = unescapeJson(openRaw);
    return { file: nm || file, code: lastSource };
  }
  return { file, code: lastSource };
}

/**
 * A JSON string body, unescaped, WITHOUT throwing on a truncated tail.
 *
 * `JSON.parse('"' + raw + '"')` is the obvious implementation and it is the
 * wrong one here: the whole point is that this text can stop anywhere, and a
 * parse of `…fro\` or `…\u26` throws, which would blank the panel on roughly
 * one tick in every few. An unfinished escape is simply dropped — it is one
 * character the customer sees a moment later.
 */
export function unescapeJson(raw) {
  if (typeof raw !== "string" || !raw) return "";
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c !== "\\") { out += c; continue; }
    const e = raw[i + 1];
    if (e === undefined) break;           // half an escape at the tail
    if (e === "n") { out += "\n"; i++; continue; }
    if (e === "t") { out += "\t"; i++; continue; }
    if (e === "r") { out += "\r"; i++; continue; }
    if (e === "b") { out += "\b"; i++; continue; }
    if (e === "f") { out += "\f"; i++; continue; }
    if (e === '"' || e === "\\" || e === "/") { out += e; i++; continue; }
    if (e === "u") {
      const hex = raw.slice(i + 2, i + 6);
      if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) break;  // truncated
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
      continue;
    }
    // Not an escape JSON defines. Keep the character rather than invent one.
    out += e;
    i++;
  }
  return out;
}

/**
 * The last `max` characters, cut at a line boundary so the view never opens
 * mid-token. A cut that lands inside a word reads as corrupted output rather
 * than as a window onto a longer file.
 */
export function tailOf(code, max = CODE_TAIL_MAX) {
  if (typeof code !== "string" || !code) return "";
  const cap = Number.isFinite(max) && max > 0 ? Math.floor(max) : CODE_TAIL_MAX;
  if (code.length <= cap) return code;
  const cut = code.slice(code.length - cap);
  const nl = cut.indexOf("\n");
  // Only drop the partial first line when there IS a later one — otherwise a
  // single very long line would come back empty, which is worse than a cut.
  return nl >= 0 && nl < cut.length - 1 ? cut.slice(nl + 1) : cut;
}

/** What the container sends and the browser shows: one bounded object. */
export function codeUpdate(partial, opts) {
  const { file, code } = readCodeSoFar(partial, opts);
  const max = (opts && Number.isFinite(opts.max) && opts.max > 0) ? opts.max : CODE_TAIL_MAX;
  return { file: String(file || "").slice(0, 120), code: tailOf(code, max), chars: code.length };
}
