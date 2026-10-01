// ONE NEW ROW, ADMITTED AND WRITTEN THE SAME WAY FROM EITHER DOOR (2026-10-01).
//
// A LEAF, with no imports of its own. Two steps write a new row to a table the
// site already has: the edit path's data step (`site-apply.mjs`, whose INSERT
// the route runs in `worker.js`) and the add-on step's `row` kind
// (`site-add.mjs`, owner: "Add will always go in addon"). Two spellings of
// which values a row may be handed, or of the statement that writes it, would
// be two answers to one question on the two doors a customer uses for it — so
// this is the one, and both import it. It carries no path's wording.

/**
 * ONE ROW'S VALUES, AS THE DATABASE MAY BE HANDED THEM — the rule the data step
 * applies to a model's `values` (`readDataChanges`), shared with the add-on's
 * `row` kind, so an entry added from either door is admitted the same way:
 * a column the table declares, a scalar or `null`, a string cut to 2,000
 * characters. Anything else is dropped on its own, never the row beside it.
 *
 * `columns` is a Set or an array of the declared names. Not an object answers
 * `null`; an object with nothing usable answers `{}`, and an empty row is the
 * caller's refusal to make.
 */
export function rowValues(values, columns) {
  if (!values || typeof values !== "object" || Array.isArray(values)) return null;
  const cols = columns instanceof Set ? columns
    : new Set((Array.isArray(columns) ? columns : []).filter((c) => typeof c === "string"));
  const set = {};
  for (const [k, v] of Object.entries(values)) {
    if (!cols.has(k)) continue;
    if (v === null) { set[k] = null; continue; }
    if (typeof v === "object") continue; // a shape in a column is not a value
    set[k] = typeof v === "string" ? v.slice(0, 2000) : v;
  }
  return set;
}

/**
 * THE ONE PARAMETERISED INSERT — the statement the data step has always written
 * for a new row (it lived inline in `worker.js` until 2026-10-01), shared with
 * the add-on's `row` kind so the two doors cannot write a row two ways.
 *
 * Every value is a bound parameter. The table and the column names are the only
 * parts that cannot be, so they come from the DECLARED schema, never from a
 * model, and lose any double quote on the way in. `{ sql, params }` with `?`
 * placeholders, as `sqlQuery` takes them. An empty row has no statement: it
 * throws rather than write `() VALUES ()`.
 */
export function insertStatement(table, values) {
  const cols = values && typeof values === "object" && !Array.isArray(values) ? Object.keys(values) : [];
  if (!cols.length) throw new Error("insertStatement: no values to insert");
  const name = String(table).replace(/"/g, "");
  return {
    sql: "INSERT INTO \"" + name + "\" (" + cols.map((k) => '"' + k.replace(/"/g, "") + '"').join(", ") + ") VALUES (" + cols.map(() => "?").join(", ") + ")",
    params: cols.map((k) => values[k]),
  };
}
