// A SITE DATABASE THAT REMEMBERS (2026-10-01): tables that already hold rows,
// and `_meta` with its primary key, answering the statements the add-on's
// `row` step sends, in Neon's own wire shape.
//
// WHY IT EXISTS. The add-on route's own fixture (`addon-route.mjs`) answers
// every table read with no rows, so a table the site already has reads as
// empty there — and the same `table` answer that the live bakery refuses to
// seed was INSERTED on it (Test 11's trace, recorded in the backlog). A test of
// adding an entry to an existing list has to start from a list that has
// entries, and has to be able to see what was written, what it was given back,
// and that nothing was written twice.
//
// WHAT IT MODELS, each measured on a real Postgres 16 before it was written
// down (the probe is in `docs/history/2026-10-01-add-row.md`):
//   - an identity `id` per table, assigned by the database, never by the caller;
//   - `created_at` filled by the database;
//   - every value arriving as TEXT (the driver sends parameters that way) and
//     read by the column's type: a numeric column given "£5.00" is refused with
//     Postgres's own 22P02, which is how a write failure looks from the route;
//   - `INSERT … RETURNING *` handing back the stored row;
//   - `rowsInsert`'s single statement: every entry and the request's `_meta`
//     key apply together or not at all, and a key that is already there is
//     refused with 23505 on `_meta_pkey`, leaving the tables as they were;
//   - a table's own unique columns, refused the same way on `<table>_<col>_key`.
//
// IT ANSWERS ONLY WHAT IT RECOGNISES and returns `null` for anything else, so a
// harness falls through to its own answers rather than this inventing one.

const NOW = "2026-10-01T03:00:00.000000+00:00";

function wire(fields, rows, command = "SELECT") {
  return new Response(JSON.stringify({
    command,
    rowCount: rows.length,
    rows: rows.map((r) => fields.map((f) => (r[f.name] === undefined ? null : r[f.name]))),
    fields: fields.map((f) => ({ name: f.name, dataTypeID: f.type || 25 })),
  }), { status: 200, headers: { "content-type": "application/json" } });
}

/** A write with no RETURNING: how many rows it touched, and no rows back. */
function affected(n, command) {
  return new Response(JSON.stringify({ command, rowCount: n, rows: [], fields: [] }),
    { status: 200, headers: { "content-type": "application/json" } });
}

function pgError(code, message, detail) {
  return new Response(JSON.stringify({ message, code, detail: detail || undefined, severity: "ERROR" }),
    { status: 400, headers: { "content-type": "application/json" } });
}

/** A value as the column's type reads it, or `{ error }` the way Postgres refuses it. */
function cast(type, v) {
  if (v === null || v === undefined) return { value: null };
  const s = String(v);
  if (type === "integer" || type === "bigint") {
    if (!/^-?\d+$/.test(s.trim())) return { error: ["22P02", "invalid input syntax for type integer: \"" + s + "\""] };
    return { value: Number(s) };
  }
  if (type === "numeric") {
    if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(s.trim())) return { error: ["22P02", "invalid input syntax for type numeric: \"" + s + "\""] };
    return { value: Number(s) };
  }
  if (type === "boolean") {
    if (/^(1|t|true|y|yes|on)$/i.test(s)) return { value: true };
    if (/^(0|f|false|n|no|off)$/i.test(s)) return { value: false };
    return { error: ["22P02", "invalid input syntax for type boolean: \"" + s + "\""] };
  }
  return { value: s };
}

/**
 * `tables`: `{ name: { columns: [{name, type}], rows: [{…}], unique?: [col], next?: n } }`,
 * the columns in the table's own order (`id` first, `created_at` last, as the
 * engine makes them). `meta`: `{ key: text }`. `failWrite`: `{ code, message }`
 * makes every row INSERT fail that way. `hideMarker`: the first N reads of a
 * request's `_meta` key answer no row — the read that loses a race. `noMeta`:
 * the database has no `_meta` table at all (a real state: `META_TABLE_SQL`'s
 * note in `site-schema.mjs`), so a request's key is read and written against a
 * relation Postgres says does not exist (42P01).
 *
 * THE ANSWER THAT NEVER ARRIVES (2026-10-01, the review of f6532d66). A thrown
 * answer is how the Neon driver reports a request whose response was lost: its
 * `fetch` rejects and the driver throws "Error connecting to database" with no
 * SQLSTATE. Three ways to get there, each counted down per statement:
 *   - `loseAnswer`: the next N `row` statements COMMIT — entries and key —
 *     and then the answer is lost (the reviewer's reproduction);
 *   - `inFlight`: the next N are lost before they commit and stay PENDING:
 *     `land()` applies one later, by the same all-or-nothing rule, so a key
 *     closed in the meantime refuses it whole; with `landOnClose`, a pending
 *     statement lands the moment a key is closed — a write that commits while
 *     the reconcile is closing the key, and wins;
 *   - `garbleAnswer`: the next N commit and answer rows that cannot be read.
 * `failKeyReads`: once a `row` statement has been sent, the next N reads of a
 * request's key throw the same way, so a key that is there cannot be seen —
 * the check before the picker reads as it always did.
 * `vanish`: `[{ table, id }]`, rows taken off by someone else after the list
 * was read — gone the moment the first UPDATE or DELETE arrives (2026-10-07).
 */
export function rowsDb({ tables = {}, meta = {}, failWrite = null, hideMarker = 0, noMeta = false, now = NOW,
  loseAnswer = 0, inFlight = 0, landOnClose = false, garbleAnswer = 0, failKeyReads = 0, vanish = [] } = {}) {
  const state = { tables: new Map(), meta: new Map(Object.entries(meta)), log: [], pending: [], sent: false };
  const vanishing = (Array.isArray(vanish) ? vanish : []).slice();
  let lose = Number(loseAnswer) || 0, flying = Number(inFlight) || 0, garble = Number(garbleAnswer) || 0, keyFails = Number(failKeyReads) || 0;
  /** The driver's own report of a request whose answer never came back. */
  const lost = () => { throw new TypeError("fetch failed"); };
  for (const [name, t] of Object.entries(tables)) {
    const rows = (t.rows || []).map((r) => ({ ...r }));
    state.tables.set(name, {
      columns: t.columns.map((c) => ({ ...c })),
      rows,
      // `next` IS THE SEQUENCE'S OWN POSITION, which is not max(id) + 1 on a
      // table that has lost rows — the reason the new entry's id is read back
      // and never predicted.
      next: Number.isSafeInteger(t.next) ? t.next : rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1,
      unique: Array.isArray(t.unique) ? t.unique.slice() : [],
    });
  }
  let hidden = Number(hideMarker) || 0;

  /** One row ready to store, or `{ error }` — nothing is stored here. */
  function build(name, cols, vals) {
    const t = state.tables.get(name);
    if (!t) return { error: ["42P01", "relation \"" + name + "\" does not exist"] };
    const row = {};
    for (const c of t.columns) row[c.name] = null;
    for (let i = 0; i < cols.length; i++) {
      const col = t.columns.find((c) => c.name === cols[i]);
      if (!col) return { error: ["42703", "column \"" + cols[i] + "\" of relation \"" + name + "\" does not exist"] };
      if (col.name === "id") return { error: ["428C9", "the fixture does not take an id from the caller"] };
      const r = cast(col.type, vals[i]);
      if (r.error) return { error: r.error };
      row[col.name] = r.value;
    }
    return { row, t };
  }

  /** Parse `INSERT INTO "t" ("a", "b") VALUES ($1, $2)` into its parts. */
  const insertRe = /INSERT INTO "([^"]+)" \(([^)]*)\) VALUES \(([^)]*)\)/g;
  function inserts(query, params) {
    const out = [];
    for (const m of query.matchAll(insertRe)) {
      const cols = m[2].split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
      const vals = m[3].split(",").map((x) => {
        const p = /^\$(\d+)$/.exec(x.trim());
        return p ? params[Number(p[1]) - 1] : undefined;
      });
      out.push({ table: m[1], cols, vals });
    }
    return out;
  }

  /** Store built rows, all or none: the unique checks run before anything is kept. */
  function commit(built, markerKey) {
    if (markerKey !== null && state.meta.has(markerKey)) {
      return { error: ["23505", "duplicate key value violates unique constraint \"_meta_pkey\"", "Key (k)=(" + markerKey + ") already exists."] };
    }
    for (const b of built) {
      for (const u of b.t.unique) {
        const clash = b.t.rows.some((r) => r[u] !== null && r[u] === b.row[u])
          || built.some((o) => o !== b && o.t === b.t && o.row[u] !== null && o.row[u] === b.row[u]);
        if (clash) return { error: ["23505", "duplicate key value violates unique constraint \"" + b.name + "_" + u + "_key\""] };
      }
    }
    for (const b of built) {
      b.row.id = b.t.next++;
      if (b.t.columns.some((c) => c.name === "created_at")) b.row.created_at = now;
      // THE TABLE'S OWN COLUMN ORDER, which is the order `row_to_json` writes.
      const ordered = {};
      for (const c of b.t.columns) ordered[c.name] = b.row[c.name];
      b.t.rows.push(ordered);
      b.saved = ordered;
    }
    return { ok: true };
  }

  /**
   * `rowsInsert`'s statement, applied all or nothing: `{ saved }`, the result
   * rows in order, or `{ error }` the way Postgres refuses it, nothing kept.
   */
  function rowStatement(q, p) {
    const found = inserts(q, p);
    const named = [...q.matchAll(/SELECT (\d+) AS n, \$(\d+)::text AS t, row_to_json\(r(\d+)\)::text AS row FROM r\d+/g)];
    const mark = /INSERT INTO _meta \(k, v\) SELECT \$(\d+), json_build_object\('rows'.*'cost', \$(\d+)::numeric\)::text FROM saved/.exec(q);
    // NO `_meta`: the statement names a relation that is not there, so
    // Postgres refuses it whole before any entry is kept.
    if (noMeta && mark) return { error: ["42P01", "relation \"_meta\" does not exist"] };
    const built = [];
    for (const f of found) {
      const b = build(f.table, f.cols, f.vals);
      if (b.error) return { error: b.error };
      built.push({ ...b, name: f.table });
    }
    const key = mark ? String(p[Number(mark[1]) - 1]) : null;
    const done = commit(built, key);
    if (done.error) return { error: done.error };
    const saved = named.map((m) => ({ n: Number(m[1]), t: String(p[Number(m[2]) - 1]), row: JSON.stringify(built[Number(m[3])].saved) }));
    if (mark) {
      const costRaw = p[Number(mark[2]) - 1];
      state.meta.set(key, JSON.stringify({
        rows: saved.map((s) => ({ n: s.n, table: s.t, row: JSON.parse(s.row) })),
        cost: costRaw === null || costRaw === undefined ? null : Number(costRaw),
      }));
    }
    return { saved: saved.sort((a, b) => a.n - b.n) };
  }

  /** The oldest pending statement arrives: `{ saved }` or `{ error }`, by the same rule. */
  function land() {
    const next = state.pending.shift();
    if (!next) throw new Error("rows-db: nothing pending to land");
    const done = rowStatement(next.q, next.p);
    state.log.push({ query: "-- landed: " + next.q.slice(0, 40), params: [], landed: done.error ? "refused " + done.error[0] : "saved" });
    return done;
  }

  function answer(query, params) {
    const q = String(query || "");
    const p = Array.isArray(params) ? params : [];
    state.log.push({ query: q, params: p });

    if (/information_schema\.columns/i.test(q)) {
      const rows = [];
      for (const [name, t] of state.tables) for (const c of t.columns) rows.push({ t: name, c: c.name, ty: c.type });
      return wire([{ name: "t" }, { name: "c" }, { name: "ty" }], rows);
    }
    if (/role_table_grants|pg_policies|pg_trigger/i.test(q)) return wire([{ name: "t" }], []);
    if (/^SELECT 1\s*$/i.test(q.trim())) return wire([{ name: "?column?", type: 23 }], [{ "?column?": 1 }]);

    // A REQUEST'S KEY CLOSED BY THE RECONCILE: `INSERT … ON CONFLICT DO
    // NOTHING`, one row back when it closed the key and none when a value was
    // already there. A pending statement lands first when `landOnClose` says
    // it wins the race.
    const close = /^INSERT INTO _meta \(k, v\) VALUES \(\$1, \$2\) ON CONFLICT \(k\) DO NOTHING RETURNING k$/i.exec(q.trim());
    if (close) {
      const k = String(p[0]);
      if (!k.startsWith("addon-row:")) return null;
      if (noMeta) return pgError("42P01", "relation \"_meta\" does not exist");
      if (landOnClose) while (state.pending.length) land();
      if (state.meta.has(k)) return wire([{ name: "k" }], [], "INSERT");
      state.meta.set(k, String(p[1]));
      return wire([{ name: "k" }], [{ k }], "INSERT");
    }

    // `_meta`, read by one key: the schema by literal, a request's key by parameter.
    const literal = /^SELECT v FROM _meta WHERE k\s*=\s*'([^']+)'\s*$/i.exec(q.trim());
    const bound = /^SELECT v FROM _meta WHERE k\s*=\s*\$1\s*$/i.exec(q.trim());
    if (literal || bound) {
      const k = literal ? literal[1] : String(p[0]);
      // ONLY ITS OWN KEYS: a request's key always, any other only when this
      // database holds it — so inside another fixture the schema read stays
      // that fixture's, and two fixtures never give two answers.
      if (!k.startsWith("addon-row:") && !state.meta.has(k)) return null;
      if (bound && k.startsWith("addon-row:") && state.sent && keyFails > 0) { keyFails--; lost(); }
      if (noMeta && k.startsWith("addon-row:")) return pgError("42P01", "relation \"_meta\" does not exist");
      // THE READ THAT LOSES THE RACE: a key another run has ALREADY saved, read
      // as absent — so the first run's own empty read never uses one up.
      if (bound && k.startsWith("addon-row:") && state.meta.has(k) && hidden > 0) { hidden--; return wire([{ name: "v" }], []); }
      return wire([{ name: "v" }], state.meta.has(k) ? [{ v: state.meta.get(k) }] : []);
    }
    if (/^SELECT k, v FROM _meta WHERE k IN/i.test(q.trim())) {
      const keys = [...q.matchAll(/'([^']+)'/g)].map((m) => m[1]);
      if (!keys.some((k) => state.meta.has(k))) return null;
      return wire([{ name: "k" }, { name: "v" }], keys.filter((k) => state.meta.has(k)).map((k) => ({ k, v: state.meta.get(k) })));
    }

    // A LIST READ, and the seed's existence probe.
    const probe = /^SELECT 1 AS x FROM "([^"]+)" LIMIT 1$/i.exec(q.trim());
    if (probe) {
      const t = state.tables.get(probe[1]);
      return wire([{ name: "x", type: 23 }], t && t.rows.length ? [{ x: 1 }] : []);
    }
    const all = /^SELECT \* FROM "([^"]+)"/i.exec(q.trim());
    if (all) {
      const t = state.tables.get(all[1]);
      if (!t) return pgError("42P01", "relation \"" + all[1] + "\" does not exist");
      return wire(t.columns.map((c) => ({ name: c.name, type: c.name === "id" ? 23 : 25 })), [...t.rows].sort((a, b) => a.id - b.id));
    }

    // THE `row` STEP'S ONE STATEMENT: entries and the request's key together.
    if (/^WITH r0 AS \(INSERT INTO "/.test(q.trim())) {
      state.sent = true;
      if (failWrite) return pgError(failWrite.code || "XX000", failWrite.message || "the write failed");
      // LOST BEFORE IT COMMITS, AND STILL ON ITS WAY: kept to land later.
      if (flying > 0) { flying--; state.pending.push({ q, p }); lost(); }
      const done = rowStatement(q, p);
      if (done.error) return pgError(...done.error);
      // COMMITTED — entries and key — AND THE ANSWER LOST on the way back.
      if (lose > 0) { lose--; lost(); }
      // COMMITTED, AND ANSWERED WITH ROWS NOBODY CAN READ.
      if (garble > 0) { garble--; return wire([{ name: "n", type: 23 }, { name: "t" }, { name: "row" }], done.saved.map((s) => ({ ...s, row: "{not json" }))); }
      return wire([{ name: "n", type: 23 }, { name: "t" }, { name: "row" }], done.saved);
    }

    // A ROW CHANGED OR TAKEN OFF BY THE DATA STEP (2026-10-07), with or without
    // RETURNING: `UPDATE "t" SET "a" = $1, "b" = $2 WHERE id = $3` and
    // `DELETE FROM "t" WHERE id = $1`. A row `vanish` names is gone by the
    // time the first of them runs — taken off since the step read the list.
    const upd = /^UPDATE "([^"]+)" SET (.+) WHERE id = \$(\d+)( RETURNING \*)?$/.exec(q.trim());
    const del = /^DELETE FROM "([^"]+)" WHERE id = \$(\d+)( RETURNING id)?$/.exec(q.trim());
    if (upd || del) {
      if (failWrite) return pgError(failWrite.code || "XX000", failWrite.message || "the write failed");
      for (const v of vanishing.splice(0)) {
        const vt = state.tables.get(v.table);
        if (vt) vt.rows = vt.rows.filter((r) => Number(r.id) !== Number(v.id));
      }
      const t = state.tables.get((upd || del)[1]);
      if (!t) return pgError("42P01", "relation \"" + (upd || del)[1] + "\" does not exist");
      const fields = t.columns.map((c) => ({ name: c.name, type: c.name === "id" ? 23 : 25 }));
      if (del) {
        const id = Number(p[Number(del[2]) - 1]);
        const gone = t.rows.filter((r) => Number(r.id) === id);
        t.rows = t.rows.filter((r) => Number(r.id) !== id);
        return del[3] ? wire([{ name: "id", type: 23 }], gone.map((r) => ({ id: r.id })), "DELETE") : affected(gone.length, "DELETE");
      }
      const next = {};
      for (const m of upd[2].matchAll(/"([^"]+)" = \$(\d+)/g)) {
        const col = t.columns.find((c) => c.name === m[1]);
        if (!col) return pgError("42703", "column \"" + m[1] + "\" of relation \"" + upd[1] + "\" does not exist");
        const r = cast(col.type, p[Number(m[2]) - 1]);
        if (r.error) return pgError(...r.error);
        next[col.name] = r.value;
      }
      const id = Number(p[Number(upd[3]) - 1]);
      const hit = t.rows.filter((r) => Number(r.id) === id);
      for (const r of hit) Object.assign(r, next);
      return upd[4] ? wire(fields, hit.map((r) => ({ ...r })), "UPDATE") : affected(hit.length, "UPDATE");
    }

    // A PLAIN ROW INSERT — the data step's, with or without RETURNING.
    if (/^INSERT INTO "/.test(q.trim())) {
      const [f] = inserts(q, p);
      if (!f) return null;
      if (failWrite) return pgError(failWrite.code || "XX000", failWrite.message || "the write failed");
      const b = build(f.table, f.cols, f.vals);
      if (b.error) return pgError(...b.error);
      const one = { ...b, name: f.table };
      const done = commit([one], null);
      if (done.error) return pgError(...done.error);
      if (/RETURNING \*\s*$/i.test(q.trim())) return wire(b.t.columns.map((c) => ({ name: c.name, type: c.name === "id" ? 23 : 25 })), [one.saved], "INSERT");
      return wire([], [], "INSERT");
    }
    return null;
  }

  return {
    answer,
    /** A statement lost on its way (`inFlight`) arrives now. */
    land,
    /** How many statements are still on their way. */
    pending: () => state.pending.length,
    /** The table's rows as stored now — a copy. */
    rows: (name) => (state.tables.get(name) ? state.tables.get(name).rows.map((r) => ({ ...r })) : null),
    /** A `_meta` value, or `undefined`. */
    meta: (k) => state.meta.get(k),
    metaKeys: () => [...state.meta.keys()],
    /** Every statement asked, in order. */
    log: () => state.log.slice(),
    /** The statements that WROTE: any INSERT, UPDATE, DELETE or DDL, CTEs included. */
    writes: () => state.log.filter((e) => /^\s*(WITH\b[\s\S]*\bINSERT\b|INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)\b/i.test(e.query)),
  };
}

/** The bakery's `loaves` and `orders`, as `fold-lane-bakery` holds them at `dgmag4` (2026-10-01). */
export const BAKERY_LOAVES = [
  { id: 1, name: "Country White", description: "Our everyday loaf. Open crumb, thin crisp crust, a little wheat sweetness.", price: 4.8, photo: null, created_at: "2026-08-21 23:06:22" },
  { id: 2, name: "Dark Rye", description: "Dense and malty. Good with smoked fish or a sharp cheddar.", price: 5.2, photo: null, created_at: "2026-08-21 23:06:22" },
  { id: 3, name: "Seeded Wholemeal", description: "Toasted sunflower, flax and sesame through a wholemeal dough.", price: 5.4, photo: null, created_at: "2026-08-21 23:06:22" },
  { id: 4, name: "Olive & Rosemary", description: "Green olives and a handful of rosemary from the morning bunches.", price: 5.8, photo: null, created_at: "2026-08-21 23:06:23" },
  { id: 5, name: "Walnut Levain", description: "Butter walnuts folded through a long-fermented white dough.", price: 6, photo: null, created_at: "2026-08-21 23:06:23" },
  { id: 6, name: "Sea Salt Focaccia", description: "A tray bake, heavy on the oil, finished with flaky salt.", price: 4.5, photo: null, created_at: "2026-08-21 23:06:23" },
];
export const LOAF_COLUMNS = [
  { name: "id", type: "integer" }, { name: "name", type: "text" }, { name: "description", type: "text" },
  { name: "price", type: "numeric" }, { name: "photo", type: "text" }, { name: "created_at", type: "timestamp with time zone" },
];
