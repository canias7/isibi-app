// THE THROWAWAY DATABASE THE SITE'S TESTS RUN AGAINST (2026-10-30, `run_tests`).
//
// Never the live database: it lives in the test run's own memory and is gone
// when the run ends. The template has no Postgres in-process (no pglite in its
// packages, and adding one grows the image), so this answers the SQL a site's
// server code writes most — CREATE TABLE, INSERT … RETURNING, SELECT with WHERE
// / ORDER BY / LIMIT / count(*), UPDATE, DELETE — over rows in memory, seeded
// from the site's spec. What it does not understand it REFUSES by name (never a
// silent empty answer), and a test can answer such a query itself with
// `db.on(pattern, rows)`. Imports nothing: it runs inside the sandboxed child.

const KW = /^(select|insert|update|delete|create|alter|drop|begin|commit|rollback|with)\b/i;

function splitTop(s, sep = ",") {
  const out = []; let depth = 0, q = "", cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === q) { if (s[i + 1] === q) { cur += s[++i]; } else q = ""; } continue; }
    if (c === "'" || c === '"') { q = c; cur += c; continue; }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === sep && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const ident = (s) => String(s || "").trim().replace(/^"(.*)"$/, "$1").replace(/^public\./i, "").toLowerCase();
const stamp = () => new Date().toISOString().replace("T", " ").slice(0, 19);

export function makeTestDb({ tables = [] } = {}) {
  const db = new Map();          // name -> { cols: [], serial: Set, defaults: {}, rows: [], next: 1 }
  const handlers = [];           // [{ re, answer }]
  const log = [];
  const ensure = (name, cols = [], serial = [], defaults = {}) => {
    const n = ident(name);
    if (!db.has(n)) db.set(n, { cols: cols.map(ident), serial: new Set(serial.map(ident)), defaults, rows: [], next: 1 });
    return db.get(n);
  };
  for (const t of Array.isArray(tables) ? tables : []) {
    if (!t || typeof t.name !== "string") continue;
    const cols = (Array.isArray(t.columns) ? t.columns : []).map((c) => (typeof c === "string" ? c : c && c.name)).filter(Boolean);
    const serial = (Array.isArray(t.columns) ? t.columns : []).filter((c) => c && /serial|identity/i.test(String(c.type || "")) || (c && c.name === "id" && /int/i.test(String(c.type || "")))).map((c) => c.name);
    ensure(t.name, cols.includes("id") ? cols : ["id", ...cols], serial.length ? serial : ["id"]);
  }
  ensure("_errors", ["id", "at", "message", "route", "source"], ["id"]);

  const table = (name) => {
    const t = db.get(ident(name));
    if (!t) throw new Error('relation "' + ident(name) + '" does not exist');
    return t;
  };

  function value(expr, params, at) {
    const e = String(expr).trim();
    let m;
    if ((m = e.match(/^\$(\d+)$/))) return params[Number(m[1]) - 1];
    if (e === "?") return params[at.i++];
    if (/^null$/i.test(e)) return null;
    if (/^true$/i.test(e)) return true;
    if (/^false$/i.test(e)) return false;
    if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
    if ((m = e.match(/^'((?:[^']|'')*)'(?:::\w+)?$/))) return m[1].replace(/''/g, "'");
    if ((m = e.match(/^(.*)::\w+(\[\])?$/))) return value(m[1], params, at);
    if (/^(now\(\)|current_timestamp|to_char\(.*\)|current_date)$/i.test(e)) { if (/^to_char/i.test(e)) { countMarks(e, params, at); } return stamp(); }
    if (/^gen_random_uuid\(\)$/i.test(e)) return "00000000-0000-4000-8000-" + String(Math.floor(Math.random() * 1e12)).padStart(12, "0");
    throw new Error("the test database does not understand the value " + e.slice(0, 60) + " (answer this query with db.on)");
  }
  // A `?` inside a function we stand in for still consumes its parameter.
  function countMarks(e, params, at) { const n = (e.replace(/'(?:[^']|'')*'/g, "").match(/\?/g) || []).length; at.i += n; }

  function where(clause, params, at) {
    if (!clause) return () => true;
    const parts = clause.split(/\s+and\s+/i).map((c) => c.trim()).filter(Boolean);
    const tests = parts.map((c) => {
      let m;
      if ((m = c.match(/^\(?\s*("?[\w.]+"?)\s+is\s+(not\s+)?null\s*\)?$/i))) { const col = ident(m[1].split(".").pop()); const not = !!m[2]; return (r) => (r[col] == null) !== not; }
      if ((m = c.match(/^\(?\s*(?:lower\()?("?[\w.]+"?)\)?\s*(=|<>|!=|<=|>=|<|>|ilike|like)\s*(?:lower\()?(.+?)\)?\s*\)?$/i))) {
        const col = ident(m[1].split(".").pop()); const op = m[2].toLowerCase(); const v = value(m[3], params, at);
        const lower = /lower\(/i.test(c);
        return (r) => {
          let a = r[col], b = v;
          if (lower || op === "ilike") { a = String(a ?? "").toLowerCase(); b = String(b ?? "").toLowerCase(); }
          if (op === "like" || op === "ilike") { const re = new RegExp("^" + String(b).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "s"); return re.test(String(a ?? "")); }
          if (typeof a === "number" || typeof b === "number") { a = a == null ? a : Number(a); b = b == null ? b : Number(b); }
          if (a == null || b == null) return false;
          return op === "=" ? a == b : op === "<>" || op === "!=" ? a != b : op === "<" ? a < b : op === ">" ? a > b : op === "<=" ? a <= b : a >= b; // eslint-disable-line eqeqeq
        };
      }
      throw new Error("the test database does not understand the condition " + c.slice(0, 80) + " (answer this query with db.on)");
    });
    return (r) => tests.every((f) => f(r));
  }

  const pick = (rows, cols) => {
    if (!cols || cols === "*") return rows.map((r) => ({ ...r }));
    const list = splitTop(cols).map((c) => { const m = c.match(/^(.+?)\s+as\s+"?(\w+)"?$/i); return m ? { from: ident(m[1].split(".").pop()), as: m[2] } : { from: ident(c.split(".").pop()), as: ident(c.split(".").pop()) }; });
    return rows.map((r) => Object.fromEntries(list.map((c) => [c.as, r[c.from] ?? null])));
  };

  function run(sql, params = []) {
    const text = String(sql).trim().replace(/;\s*$/, "");
    log.push({ sql: text.slice(0, 200), params: Array.isArray(params) ? params.slice(0, 20) : [] });
    for (const h of handlers) if (h.re.test(text)) { const a = typeof h.answer === "function" ? h.answer(text, params) : h.answer; return Array.isArray(a) ? a.map((r) => ({ ...r })) : []; }
    const at = { i: 0 };
    let m;
    if (/^(begin|commit|rollback)\b/i.test(text)) return [];
    if ((m = text.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?("?[\w.]+"?)\s*\(([\s\S]*)\)$/i))) {
      const defs = splitTop(m[2]).filter((d) => !/^(primary|unique|constraint|foreign|check)\b/i.test(d));
      const cols = defs.map((d) => d.split(/\s+/)[0]);
      const serial = defs.filter((d) => /serial|identity/i.test(d)).map((d) => d.split(/\s+/)[0]);
      const defaults = Object.fromEntries(defs.map((d) => [ident(d.split(/\s+/)[0]), (d.match(/\bdefault\s+(.+?)(?:\s+(?:not\s+null|null|primary|unique|references|check)\b|$)/i) || [])[1]]).filter(([, v]) => v));
      ensure(m[1], cols, serial, defaults);
      return [];
    }
    if ((m = text.match(/^create\s+(unique\s+)?index\b/i)) || /^alter\s+table\b/i.test(text)) return [];
    if ((m = text.match(/^insert\s+into\s+("?[\w.]+"?)\s*\(([^)]*)\)\s*values\s*([\s\S]+?)(?:\s+on\s+conflict\s+do\s+nothing)?(?:\s+returning\s+([\s\S]+))?$/i))) {
      const t = table(m[1]);
      const cols = splitTop(m[2]).map(ident);
      const groups = splitTop(m[3]).map((g) => g.replace(/^\(|\)$/g, ""));
      const made = [];
      for (const g of groups) {
        const vals = splitTop(g);
        if (vals.length !== cols.length) throw new Error("INSERT has " + cols.length + " columns and " + vals.length + " values");
        const row = {};
        for (const c of t.cols) row[c] = null;
        for (const s of t.serial) row[s] = t.next;
        for (const [c, d] of Object.entries(t.defaults)) { try { row[c] = value(d, [], { i: 0 }); } catch { row[c] = null; } }
        cols.forEach((c, i) => { row[c] = value(vals[i], params, at); if (!t.cols.includes(c)) t.cols.push(c); });
        if (t.serial.size) t.next = Math.max(t.next, ...[...t.serial].map((s) => Number(row[s]) || 0)) + 1;
        t.rows.push(row); made.push(row);
      }
      return m[4] ? pick(made, m[4].trim()) : [];
    }
    if ((m = text.match(/^select\s+([\s\S]+?)\s+from\s+("?[\w.]+"?)(?:\s+(?:as\s+)?\w+)?(?:\s+where\s+([\s\S]+?))?(?:\s+order\s+by\s+("?[\w.]+"?)(?:\s+(asc|desc))?)?(?:\s+limit\s+(\S+))?(?:\s+offset\s+(\S+))?$/i))) {
      const t = table(m[2]);
      const keep = where(m[3], params, at);
      let rows = t.rows.filter(keep);
      if (m[4]) { const c = ident(m[4].split(".").pop()); const d = /desc/i.test(m[5] || "") ? -1 : 1; rows = rows.slice().sort((a, b) => (a[c] > b[c] ? d : a[c] < b[c] ? -d : 0)); }
      const off = m[7] ? Number(value(m[7], params, at)) || 0 : 0;
      if (m[6]) rows = rows.slice(off, off + (Number(value(m[6], params, at)) || 0)); else if (off) rows = rows.slice(off);
      const cm = m[1].trim().match(/^count\(\s*(?:\*|1|\w+)\s*\)(?:::\w+)?(?:\s+as\s+"?(\w+)"?)?$/i);
      if (cm) return [{ [cm[1] || "count"]: rows.length }];
      return pick(rows, m[1].trim());
    }
    if ((m = text.match(/^update\s+("?[\w.]+"?)\s+set\s+([\s\S]+?)(?:\s+where\s+([\s\S]+?))?(?:\s+returning\s+([\s\S]+))?$/i))) {
      const t = table(m[1]);
      const sets = splitTop(m[2]).map((s) => { const k = s.match(/^("?\w+"?)\s*=\s*([\s\S]+)$/); if (!k) throw new Error("the test database does not understand SET " + s.slice(0, 60)); return [ident(k[1]), k[2]]; });
      const vals = sets.map(([c, e]) => [c, value(e, params, at)]);
      const keep = where(m[3], params, at);
      const hit = t.rows.filter(keep);
      for (const r of hit) for (const [c, v] of vals) r[c] = v;
      return m[4] ? pick(hit, m[4].trim()) : [];
    }
    if ((m = text.match(/^delete\s+from\s+("?[\w.]+"?)(?:\s+where\s+([\s\S]+?))?(?:\s+returning\s+([\s\S]+))?$/i))) {
      const t = table(m[1]);
      const keep = where(m[2], params, at);
      const gone = t.rows.filter(keep);
      t.rows = t.rows.filter((r) => !gone.includes(r));
      return m[3] ? pick(gone, m[3].trim()) : [];
    }
    if (!KW.test(text)) throw new Error("not a SQL statement: " + text.slice(0, 60));
    throw new Error("the test database does not understand this query: " + text.slice(0, 120) + " (answer it in the test with db.on(pattern, rows))");
  }

  return {
    query: (sql, params = []) => run(sql, params),
    seed(name, rows) { const t = table(name); for (const r of Array.isArray(rows) ? rows : []) { const row = {}; for (const c of t.cols) row[c] = null; for (const s of t.serial) row[s] = t.next; Object.assign(row, r); for (const k of Object.keys(r)) if (!t.cols.includes(ident(k))) t.cols.push(ident(k)); t.next = Math.max(t.next, ...[...t.serial].map((s) => Number(row[s]) || 0)) + 1; t.rows.push(row); } },
    rows: (name) => table(name).rows.map((r) => ({ ...r })),
    tables: () => [...db.keys()],
    on(pattern, answer) { handlers.push({ re: pattern instanceof RegExp ? pattern : new RegExp(String(pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), answer }); },
    log: () => log.slice(),
  };
}
