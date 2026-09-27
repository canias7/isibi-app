// ONE TABLE IN MEMORY, UNDER THE REAL OWNER ROUTE.
//
// `handleOwnerData` and `handleOwnerWrite` (site-owner.mjs) take their SQL
// executor as a dependency. This hands them one that holds a single table in
// memory and runs exactly the statements those two handlers emit — and throws
// on anything else, so a handler that starts emitting a different statement
// fails a test rather than being answered by a guess.
//
// WHAT IT MODELS OF POSTGRES, AND NO MORE:
//   * a statement runs whole: an UPDATE's WHERE is judged against the row as
//     it stands when the UPDATE runs, and the SET is applied to that same row;
//   * `IS NOT DISTINCT FROM ?` with an untyped parameter, which Postgres casts
//     to the column's type (measured on a real PostgreSQL 16: '4.6' matches a
//     REAL 4.6, and '4.6' matches a NUMERIC 4.60);
//   * the values a driver hands back: a REAL as a JS number in its shortest
//     float4 spelling, a NUMERIC as a string (its scale is not modelled: 4.60
//     is held as the number 4.6), text as text.
// The real semantics are proved on a real PostgreSQL by
// test/integration/local-pg-owner-cas.mjs; this is for driving the handlers.
//
// `beforeUpdate(fn)` runs `fn` once, immediately before the next UPDATE
// executes — a competing writer landing between whatever the caller read and
// the write the route is about to make.

/** The shortest decimal that reads back as the same float4 — what Postgres prints. */
function float4Out(x) {
  const f = Math.fround(Number(x));
  for (let p = 1; p <= 9; p++) {
    const s = Number(f.toPrecision(p));
    if (Math.fround(s) === f) return s;
  }
  return f;
}

function numericKey(v) {
  const s = String(v).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  let [w, fr = ""] = s.split(".");
  fr = fr.replace(/0+$/, "");
  w = w.replace(/^(-?)0+(?=\d)/, "$1");
  if (w === "-0" && !fr) w = "0";
  return fr ? `${w}.${fr}` : w;
}

/**
 * types: { column: "real" | "numeric" | "text" | "integer" }, every column but
 * `id`. rows: the table's rows, each with a positive integer `id`. With
 * `inPlace` the given array IS the table — a test may change a row by hand,
 * as another writer would — and its values are held as given.
 */
export function ownerTable({ table = "loaves", types, rows, owner = "owner-1", inPlace = false }) {
  const cols = Object.keys(types);
  // How a value is HELD: numbers for the number types.
  const store = (col, v) => {
    if (v === null || v === undefined) return null;
    const t = types[col];
    if (t === "real") return float4Out(v);
    if (t === "numeric") { if (numericKey(v) === null) throw new Error(`invalid input syntax for type numeric: "${v}"`); return Number(v); }
    if (t === "integer") return Math.trunc(Number(v));
    return String(v);
  };
  // How the driver HANDS IT BACK.
  const out = (row) => {
    const o = { ...row };
    for (const c of cols) if (o[c] !== null && o[c] !== undefined && types[c] === "numeric") o[c] = String(o[c]);
    return o;
  };
  const same = (col, stored, param) => {
    if (param === null || param === undefined) return stored === null;
    if (stored === null) return false;
    const t = col === "id" ? "integer" : types[col];
    if (t === "real") return Math.fround(Number(stored)) === Math.fround(Number(param));
    if (t === "numeric") return numericKey(stored) !== null && numericKey(stored) === numericKey(param);
    if (t === "integer") return Number(stored) === Number(param);
    return String(stored) === String(param);
  };
  let data = inPlace ? rows : rows.map((r) => {
    const held = { id: r.id };
    for (const c of cols) held[c] = store(c, r[c] === undefined ? null : r[c]);
    return held;
  });
  const copy = (r) => (r ? { ...r } : r);
  const statements = [];
  let pending = null;

  const Q = `"${table}"`;
  const SELECT_PAGE = new RegExp(`^SELECT \\* FROM ${Q} ORDER BY "(\\w+)" (ASC|DESC) LIMIT \\? OFFSET \\?$`);
  const SELECT_ONE = new RegExp(`^SELECT \\* FROM ${Q} WHERE id=\\?$`);
  const UPDATE = new RegExp(`^UPDATE ${Q} SET ((?:"\\w+"=\\?)(?:,"\\w+"=\\?)*) WHERE id=\\?((?: AND "\\w+" IS NOT DISTINCT FROM \\?)*)( RETURNING \\*)?$`);

  function run(sql, args = []) {
    statements.push({ sql, args: [...args] });
    let m = SELECT_PAGE.exec(sql);
    if (m) {
      const [col, dir] = [m[1], m[2]];
      const [limit, offset] = args;
      const sorted = [...data].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (dir === "ASC" ? 1 : -1));
      return { rows: sorted.slice(offset, offset + limit).map(out), changes: 0 };
    }
    m = SELECT_ONE.exec(sql);
    if (m) return { rows: data.filter((r) => r.id === Number(args[0])).map(out), changes: 0 };
    m = UPDATE.exec(sql);
    if (m) {
      if (pending) { const fn = pending; pending = null; fn(); }
      const setCols = [...m[1].matchAll(/"(\w+)"=\?/g)].map((x) => x[1]);
      const whereCols = [...(m[2] || "").matchAll(/"(\w+)" IS NOT DISTINCT FROM \?/g)].map((x) => x[1]);
      for (const c of setCols) if (!cols.includes(c)) throw new Error(`column "${c}" does not exist`);
      for (const c of whereCols) if (c !== "id" && !cols.includes(c)) throw new Error(`column "${c}" does not exist`);
      const setVals = args.slice(0, setCols.length);
      const id = Number(args[setCols.length]);
      const whereVals = args.slice(setCols.length + 1);
      if (whereVals.length !== whereCols.length) throw new Error("bind message supplies the wrong number of parameters");
      const hit = data.filter((r) => r.id === id && whereCols.every((c, i) => same(c, r[c], whereVals[i])));
      for (const r of hit) setCols.forEach((c, i) => { r[c] = store(c, setVals[i]); });
      return { rows: m[3] ? hit.map(out) : [], changes: hit.length };
    }
    throw new Error("owner-table fixture: a statement it does not model: " + sql);
  }

  const deps = {
    ownerOf: async () => owner,
    dbFor: async () => "postgres://in-memory",
    loadSchema: async () => ({ tables: [{ name: table, read: "public", write: "none", columns: cols.map((name) => ({ name })) }] }),
    query: async (_db, sql, args) => run(sql, args).rows,
    exec: async (_db, sql, args) => { const r = run(sql, args); return { results: r.rows, changes: r.changes }; },
    ident: (n) => '"' + n + '"',
    nowSql: () => "now()",
  };

  return {
    deps,
    statements,
    /** The table as it stands, each row a copy. */
    rows: () => data.map(copy),
    /** A write that is not the route's: another writer, or a person. */
    set(id, col, v) { const r = data.find((x) => x.id === id); if (!r) throw new Error("no row " + id); r[col] = store(col, v); },
    remove(id) { const at = data.findIndex((x) => x.id === id); if (at >= 0) data.splice(at, 1); },
    /** Run `fn` once, immediately before the next UPDATE executes. */
    beforeUpdate(fn) { pending = fn; },
  };
}
