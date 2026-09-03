// A spreadsheet into the owner's own table.
//
// THE GAP. The Data panel could add ONE row at a time, through a form, and a
// café moving its menu off a spreadsheet — or a shop with four hundred products
// — had no way in but typing them. Every business already has its data in a
// CSV, because every spreadsheet exports one.
//
// DEPENDENCY-FREE, deliberately, the way `site-turnstile.mjs` and
// `site-qr-list.mjs` are: the parser and the cell rules are decisions, and
// decisions are tested without a Worker, a database or a file. The owner route
// (`handleOwnerImport` in `site-owner.mjs`) owns the gate, the schema and the
// INSERT; this file owns what the bytes MEAN.
//
// WHAT IS NOT HERE, and why: no upsert, no "update matching rows". An import is
// an INSERT of every row in the file, because a file that both adds and edits
// needs a key column to match on, and choosing that key is a conversation the
// owner has not had. Run it twice and you get every row twice — the reply
// says how many went in, and the duplicate rule on a table that declares one
// refuses the second copy by name.

/** Rows one file may add. Above this the reply says how many were left out. */
export const MAX_IMPORT_ROWS = 5000;
/** Bytes one file may be. Checked by the route on `content-length` before the
 *  body is read, and again here on the text it got. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
/** Columns one file may name — the same ceiling `pickWritable` puts on a row. */
export const MAX_IMPORT_COLS = 60;
/** Rows per INSERT. 100 rows × 60 columns is 6,000 bound parameters, well
 *  under Postgres's 65,535, and a failed batch is retried a row at a time so a
 *  single bad line costs only itself. */
export const IMPORT_BATCH = 100;

/**
 * Which character separates the fields.
 *
 * Excel on a European locale writes `;` and a "tab-separated" export writes
 * `\t`, and both call the file CSV. Decided on the HEADER line alone, counting
 * candidates outside quotes, so a comma inside a quoted address does not vote.
 * A tie goes to the comma, which is what the format's name says.
 */
export function sniffDelimiter(line) {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let q = false;
  for (const ch of String(line || "")) {
    if (ch === '"') { q = !q; continue; }
    if (!q && ch in counts) counts[ch]++;
  }
  let best = ",";
  for (const d of [";", "\t"]) if (counts[d] > counts[best]) best = d;
  return best;
}

/**
 * RFC 4180, read leniently: `"` quotes a field, `""` inside one is a literal
 * quote, a quoted field may span lines, records end at `\n`, `\r\n` or a bare
 * `\r`, and a BOM at the start is dropped. Blank lines are skipped rather than
 * read as empty rows, because a trailing newline is not a row.
 *
 * Answers `{ headers, rows, truncated, error }`. `rows` are arrays of STRINGS,
 * exactly as written — nothing here knows what a column is; `coerceCell` does,
 * once the caller has said which column a header names. `truncated` is how
 * many rows past `maxRows` were left unread, reported so a 6,000-line file does
 * not silently become a 5,000-row import.
 *
 * `error` is a string only when the file cannot be read AT ALL — an unclosed
 * quote (every field after it would be one giant field) or no header line.
 * Anything short of that is a row the caller can judge.
 */
export function parseCsv(text, { maxRows = MAX_IMPORT_ROWS, maxCols = MAX_IMPORT_COLS } = {}) {
  let s = String(text == null ? "" : text);
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  const firstBreak = s.search(/\r\n|\n|\r/);
  const delim = sniffDelimiter(firstBreak < 0 ? s : s.slice(0, firstBreak));

  const records = [];
  let field = "", record = [], q = false, i = 0;
  let truncated = 0;
  const endField = () => { record.push(field); field = ""; };
  const endRecord = () => {
    endField();
    // A blank line is skipped, not stored: `record.every(empty)` is also true
    // of a real row of empty cells, but such a row imports as all-NULL and
    // says nothing, so dropping it loses nothing either.
    if (record.some((f) => f !== "")) {
      if (records.length < maxRows + 1) records.push(record.slice(0, maxCols));
      else truncated++;
    }
    record = [];
  };
  while (i < s.length) {
    const ch = s[i];
    if (q) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        q = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === "") { q = true; i++; continue; }
    if (ch === delim) { endField(); i++; continue; }
    if (ch === "\r") { endRecord(); i += s[i + 1] === "\n" ? 2 : 1; continue; }
    if (ch === "\n") { endRecord(); i++; continue; }
    field += ch; i++;
  }
  if (q) return { headers: [], rows: [], truncated: 0, error: "unterminated quote" };
  if (field !== "" || record.length) endRecord();
  if (!records.length) return { headers: [], rows: [], truncated: 0, error: "no header" };
  const headers = records[0].map((h) => String(h).trim());
  // `maxRows + 1` above keeps the header out of the count: the cap is on ROWS.
  const rows = records.slice(1);
  return { headers, rows, truncated, error: null };
}

/**
 * A header and a column are the same name when they agree once spaces,
 * hyphens and case are ignored: a spreadsheet says "Customer Name", the table
 * says `customer_name`, and making the owner retype the header to match is the
 * kind of friction that sends them back to the form.
 */
export function headerKey(h) {
  return String(h == null ? "" : h).trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const INT_RE = /^[-+]?\d+$/;
const NUM_RE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_RE = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/;
const TRUE_WORDS = new Set(["true", "yes", "y", "1", "on"]);
const FALSE_WORDS = new Set(["false", "no", "n", "0", "off"]);

/**
 * One cell, read as the column's type.
 *
 * Answers `{ value }` or `{ error }`, and the error is a sentence with the
 * column's name in it, because it is shown beside a line number in the reply.
 * An EMPTY cell is NULL whatever the type — a spreadsheet's blank is "not
 * given", and the table's own NOT NULL rule is the one that decides whether
 * that is allowed, by name, when the row is written.
 *
 * WHY THIS CHECKS AT ALL when Postgres would refuse a bad cell itself: a
 * refusal from Postgres fails the whole batch of a hundred with "invalid input
 * syntax", which names neither the line nor the column. Reading here turns
 * that into "line 14: price is not a number", and lets the other ninety-nine
 * go in.
 *
 * Text is TRIMMED of outer whitespace and nothing else — a stray space after
 * a name is a spreadsheet artefact, a space inside it is the name.
 */
export function coerceCell(raw, type, column) {
  const s = String(raw == null ? "" : raw).trim();
  if (s === "") return { value: null };
  const t = String(type || "text").toLowerCase();
  const bad = (what) => ({ error: `${column} is not ${what}` });
  switch (t) {
    case "int": case "integer": case "bigint": case "serial": case "smallint": {
      if (!INT_RE.test(s)) return bad("a whole number");
      const n = Number(s);
      // Past 2^53 a Number lies; the digits themselves are what Postgres wants.
      return { value: Number.isSafeInteger(n) ? n : s };
    }
    case "numeric": case "real": case "float": case "double": case "decimal": case "money": case "number": {
      if (!NUM_RE.test(s)) return bad("a number");
      return { value: Number(s) };
    }
    case "boolean": case "bool": {
      const w = s.toLowerCase();
      if (TRUE_WORDS.has(w)) return { value: true };
      if (FALSE_WORDS.has(w)) return { value: false };
      return bad("yes or no");
    }
    case "json": case "jsonb": case "array": case "object": {
      // Stored as the JSON TEXT, which is what `pickWritable` writes for an
      // object it is handed — one convention for both doors.
      try { return { value: JSON.stringify(JSON.parse(s)) }; } catch { return bad("valid JSON"); }
    }
    case "uuid":
      return UUID_RE.test(s) ? { value: s.toLowerCase() } : bad("an id");
    case "date": {
      if (ISO_DATE_RE.test(s)) return { value: s };
      // DAY FIRST, because the platform's customers are, and a `01/02/2026`
      // read the American way is a silent month swap on every row.
      const m = s.match(DMY_RE);
      if (m) return { value: `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` };
      return bad("a date (YYYY-MM-DD)");
    }
    case "timestamptz": case "timestamp": case "datetime": {
      const ms = Date.parse(s);
      if (!Number.isFinite(ms)) return bad("a date and time");
      return { value: new Date(ms).toISOString() };
    }
    default:
      return { value: s };
  }
}

/**
 * Match the file's headers to the table's columns and read every row.
 *
 * `columns` are the WRITABLE columns — `{ name, type }` — which the caller has
 * already filtered (the engine's own `id`, `created_at`, `owner_id` are never
 * importable, for the reason `pickWritable` gives). A header naming none of
 * them is IGNORED and reported, never an error: a spreadsheet with a "notes"
 * column the table lacks should still import the columns it has. Two headers
 * naming one column keep the first.
 *
 * Answers:
 *   columns  — `[{ header, name, type, index }]`, in file order
 *   ignored  — the headers that matched nothing
 *   rows     — `[{ line, values }]`, `values` in `columns` order, ready to bind
 *   skipped  — `[{ line, reason }]`, rows with a cell the column cannot take
 *
 * `line` is the file's own line number (the header is line 1), because that
 * is the number the owner can find in their spreadsheet.
 */
export function importPlan(columns, parsed) {
  const byKey = new Map();
  for (const c of Array.isArray(columns) ? columns : []) {
    const name = String((c && c.name) || "").trim();
    if (name) byKey.set(headerKey(name), { name, type: String((c && c.type) || "text") });
  }
  const matched = [], ignored = [], taken = new Set();
  (parsed && parsed.headers || []).forEach((h, index) => {
    const col = byKey.get(headerKey(h));
    if (!col || taken.has(col.name)) { ignored.push(h); return; }
    taken.add(col.name);
    matched.push({ header: h, name: col.name, type: col.type, index });
  });
  const rows = [], skipped = [];
  (parsed && parsed.rows || []).forEach((r, i) => {
    const line = i + 2;
    const values = [];
    for (const c of matched) {
      const got = coerceCell(r[c.index], c.type, c.name);
      if (got.error) { skipped.push({ line, reason: got.error }); return; }
      values.push(got.value);
    }
    // A row that is empty in every matched column adds nothing but a NULL row.
    if (values.every((v) => v === null)) { skipped.push({ line, reason: "nothing in any of the table's columns" }); return; }
    rows.push({ line, values });
  });
  return { columns: matched, ignored, rows, skipped };
}
