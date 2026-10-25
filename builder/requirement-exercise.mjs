/**
 * A TABLE'S RULES EXERCISED, NEVER KEPT (2026-10-25, feature-verify, owner:
 * "actually exercise features, not just check pieces exist — but it must never
 * leave data on a customer's live site").
 *
 * For each rule a table declares that Postgres itself enforces (a CHECK on a
 * value, a unique set of columns), a row that should be accepted and a write
 * that should be refused are each tried through the injected `rehearse`, which
 * is `sqlRehearse` (site-db.mjs): the statement runs inside one statement that
 * always fails after it, so Postgres rolls it back — nothing is committed,
 * ever. Each try has a short timeout; a database that cannot be reached, or a
 * table whose plain row is refused (a column we cannot fill), is `unrun`, and
 * the caller falls back to the existence check.
 *
 * What is NOT exercised here, and why: a row cap and one-per-person are counted
 * per owner, and a no-overlap rule is the Worker's own insert, not the
 * database's — a test write from here would not be judged the way a visitor's
 * is, so those stay as declared facts.
 */

const ID = /^[a-z_][a-z0-9_]{0,62}$/;
const q = (n) => '"' + n + '"';
export const EXERCISE_TIMEOUT_MS = 5000;
/** Postgres's own codes for a refused write: CHECK, UNIQUE, NOT NULL, a trigger's RAISE. */
export const REFUSED_CODES = Object.freeze(["23514", "23505", "23502", "P0001"]);
const OPS = { gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "=", ne: "≠" };

/** A plain value for a column of a declared type. */
export function testValue(type) {
  const t = String(type || "text").toLowerCase();
  if (["integer", "int", "bigint", "real", "float", "number", "numeric", "boolean", "bool"].includes(t)) return 1;
  if (["json", "jsonb", "array", "object"].includes(t)) return "{}";
  return "verify-test";
}

/** The value that passes a check `[col, op, n]`, and the one that breaks it. */
export function checkValues(op, n) {
  switch (op) {
    case "lte": return { pass: n, fail: n + 1 };
    case "lt": return { pass: n - 1, fail: n };
    case "gte": return { pass: n, fail: n - 1 };
    case "gt": return { pass: n + 1, fail: n };
    case "eq": return { pass: n, fail: n + 1 };
    case "ne": return { pass: n + 1, fail: n };
    default: return null;
  }
}

/**
 * The tries for one table: `[{ rule, says, sql, params, expect }]`. The first
 * is always the plain row (`expect: "pass"`); nothing else runs if it fails.
 */
export function ruleProbes(t) {
  if (!t || typeof t !== "object" || !ID.test(String(t.name || ""))) return [];
  const cols = (Array.isArray(t.columns) ? t.columns : [])
    .map((c) => (c && typeof c === "object" ? { name: String(c.name || "").toLowerCase(), type: c.type, pk: !!(c.pk || c.primary) } : { name: String(c || "").toLowerCase(), type: "text", pk: false }))
    .filter((c) => ID.test(c.name) && !c.pk && !["id", "owner_id", "created_at", "updated_at"].includes(c.name));
  if (!cols.length) return [];
  const row = Object.fromEntries(cols.map((c) => [c.name, testValue(c.type)]));
  const insert = (rows) => {
    const names = cols.map((c) => c.name);
    const params = [];
    const values = rows.map((r) => "(" + names.map((n) => { params.push(r[n]); return "$" + params.length; }).join(", ") + ")").join(", ");
    return { sql: "INSERT INTO " + q(t.name) + " (" + names.map(q).join(", ") + ") VALUES " + values + " RETURNING 1", params };
  };
  const out = [{ rule: "row", says: "a plain row", expect: "pass", ...insert([row]) }];
  for (const ch of Array.isArray(t.checks) ? t.checks : []) {
    if (!Array.isArray(ch) || ch.length < 3) continue;
    const [a, op, b] = ch.map((x) => String(x).toLowerCase());
    const n = Number(b);
    if (!Object.hasOwn(row, a) || !Number.isFinite(n) || typeof row[a] !== "number") continue;
    const v = checkValues(op, n);
    if (!v) continue;
    const says = a + " " + (OPS[op] || op) + " " + b;
    out.push({ rule: "checks", says, value: v.pass, expect: "pass", ...insert([{ ...row, [a]: v.pass }]) });
    out.push({ rule: "checks", says, value: v.fail, column: a, expect: "refuse", ...insert([{ ...row, [a]: v.fail }]) });
  }
  const uq = Array.isArray(t.unique) ? t.unique : typeof t.unique === "string" && t.unique ? [t.unique] : [];
  for (const u of uq) {
    const set = (Array.isArray(u) ? u : [u]).map((x) => String(x).toLowerCase());
    if (!set.length || !set.every((c) => Object.hasOwn(row, c))) continue;
    out.push({ rule: "unique", says: set.join(" + ") + " unique", expect: "refuse", ...insert([row, row]) });
  }
  return out;
}

const timed = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/**
 * One table, exercised: `{ table, ran, results: [{ rule, says, value?, outcome }] }`
 * where `outcome` is `refused` or `accepted` for a write that should be
 * refused, and `ran: false` with a `why` when nothing could be judged.
 */
export async function exerciseTable(t, { rehearse, timeoutMs = EXERCISE_TIMEOUT_MS } = {}) {
  const name = String((t && t.name) || "").toLowerCase();
  const probes = ruleProbes(t);
  if (typeof rehearse !== "function" || probes.length < 2) return { table: name, ran: false, why: probes.length ? "no-rules" : "no-columns", results: [] };
  const tryOne = async (p) => {
    try { return await timed(rehearse(p.sql, p.params), timeoutMs); } catch (e) { return { thrown: true }; }
  };
  const base = await tryOne(probes[0]);
  if (!base || base.thrown) return { table: name, ran: false, why: "unreachable", results: [] };
  if (base.ok !== true) return { table: name, ran: false, why: "plain-row-refused", results: [] };
  const results = [];
  for (const p of probes.slice(1)) {
    const r = await tryOne(p);
    if (!r || r.thrown) { results.push({ rule: p.rule, says: p.says, outcome: "unrun" }); continue; }
    if (p.expect === "pass") { if (r.ok !== true) results.push({ rule: p.rule, says: p.says, value: p.value, outcome: "pass-refused" }); continue; }
    const refused = r.ok === false && REFUSED_CODES.includes(String(r.code || ""));
    results.push({ rule: p.rule, says: p.says, ...(p.value !== undefined ? { value: p.value, column: p.column } : {}), outcome: refused ? "refused" : r.ok === true ? "accepted" : "unrun" });
  }
  return { table: name, ran: true, results };
}

/** The tables named, exercised one after another: `Map(table → result)`. */
export async function exerciseTables(spec, names, deps) {
  const out = new Map();
  const tables = spec && Array.isArray(spec.tables) ? spec.tables : [];
  for (const n of [...new Set((Array.isArray(names) ? names : []).map((x) => String(x).toLowerCase()))].slice(0, 6)) {
    const t = tables.find((x) => x && String(x.name || "").toLowerCase() === n);
    if (t) out.set(n, await exerciseTable(t, deps));
  }
  return out;
}

/**
 * A WRITE THE FORM TRIED TO SEND, read off the intercepted request (render
 * check, `exerciseForms`): `{ table, fields }` for a row write to the site's
 * Data API (`/api/db/<slug>/data/<table>`, POST), `{ rpc, fields }` for a
 * function, or null for anything else. The request itself is always aborted.
 */
export function interceptedWrite(method, url, body) {
  if (String(method || "").toUpperCase() === "GET") return null;
  let path = "";
  try { path = new URL(String(url), "http://x").pathname; } catch (e) { return null; }
  const m = path.match(/\/api\/db\/[^/]+\/data\/(rpc\/)?([A-Za-z0-9_]{1,63})\/?$/);
  if (!m) return null;
  let fields = [];
  try {
    const v = JSON.parse(String(body || ""));
    if (v && typeof v === "object" && !Array.isArray(v)) fields = Object.keys(v).filter((k) => /^[A-Za-z0-9_]{1,63}$/.test(k) && !k.startsWith("_")).map((k) => k.toLowerCase());
  } catch (e) { fields = []; }
  return m[1] ? { rpc: m[2].toLowerCase(), fields } : { table: m[2].toLowerCase(), fields };
}
