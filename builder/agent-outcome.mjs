// THE SITE AGENT'S OUTCOME (2026-10-30, fix-all: the router-era behaviours it
// had lost). Plain functions with their I/O injected; `worker.js`'s
// `runAgentChange` wires them.
//
//   rows     the agent's queued table entries, written BEFORE the publish,
//            each operation one statement with its own journal key in `_meta`
//            (the add-on's `rowsInsert` pattern): a re-run of the same job or a
//            lease takeover finds the key and does not write twice. Each
//            statement keeps the row as it was, so a save that then fails puts
//            every entry back (`undoRows`). Rows are named by the table's own
//            key column, never an assumed `id`.
//   facts    what the reply is told, from what really happened: the files the
//            save wrote and took away, the entries the database answered, the
//            settings, rules, moves, orders, schema and address applied, the
//            keys the server code needs and has not got. The agent's own
//            summary rides beside them as colour, never as the facts.
//   money    `settleCharge`: the agent's usage is charged only once the save
//            landed; a failure after a charge is reversed (`refund`).
import { serverEvidence, serverFacts } from "./server-code.mjs";
import { fileName } from "./site-agent.mjs";

const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const q = (n) => {
  if (!IDENT.test(String(n || ""))) throw new Error("not an identifier: " + String(n).slice(0, 40));
  return '"' + n + '"';
};

/** The journal key of one row operation: per job (or retry key), per queued op, per entry. "" when there is no stable key. */
export function rowOpKey(base, opIndex, kind, n) {
  const b = typeof base === "string" ? base.trim() : "";
  if (!/^[A-Za-z0-9_:-]{8,80}$/.test(b)) return "";
  return "agent-row:" + b + ":" + opIndex + ":" + kind + ":" + n;
}

/**
 * ONE ROW OPERATION AS ONE STATEMENT, with its journal row when it has a key.
 * `{ sql, params }`; the answer's one row carries `old` (the row before, or
 * null) and `row` (the row after, or null), each as JSON text.
 */
export function rowStatement({ table, pk = "id", kind, values = null, id = null, set = null, key = "" }) {
  const T = q(table), K = q(pk);
  const mark = key ? ", m AS (INSERT INTO _meta (k, v) SELECT ?, json_build_object('kind', ?::text, 'table', ?::text, 'old', (SELECT o FROM o), 'row', (SELECT w FROM w))::text WHERE EXISTS (SELECT 1 FROM w)" + (kind === "remove" ? " OR EXISTS (SELECT 1 FROM o)" : "") + ")" : "";
  const markParams = key ? [key, kind, String(table)] : [];
  if (kind === "add") {
    const ks = Object.keys(values || {});
    if (!ks.length) throw new Error("an entry with no values");
    return {
      sql: "WITH o AS (SELECT NULL::json AS o WHERE false), w0 AS (INSERT INTO " + T + " (" + ks.map(q).join(", ") + ") VALUES (" + ks.map(() => "?").join(", ") + ") RETURNING *), w AS (SELECT row_to_json(w0) AS w FROM w0)" + mark +
        " SELECT NULL::text AS old, (SELECT w FROM w)::text AS row",
      params: [...ks.map((k) => values[k]), ...markParams],
    };
  }
  if (kind === "update") {
    const ks = Object.keys(set || {});
    if (!ks.length) throw new Error("an update with nothing to set");
    return {
      sql: "WITH o AS (SELECT row_to_json(t) AS o FROM " + T + " t WHERE " + K + " = ?), w0 AS (UPDATE " + T + " SET " + ks.map((k) => q(k) + " = ?").join(", ") + " WHERE " + K + " = ? RETURNING *), w AS (SELECT row_to_json(w0) AS w FROM w0)" + mark +
        " SELECT (SELECT o FROM o)::text AS old, (SELECT w FROM w)::text AS row",
      params: [id, ...ks.map((k) => set[k]), id, ...markParams],
    };
  }
  if (kind === "remove") {
    return {
      sql: "WITH w0 AS (DELETE FROM " + T + " WHERE " + K + " = ? RETURNING *), o AS (SELECT row_to_json(w0) AS o FROM w0), w AS (SELECT NULL::json AS w WHERE false)" + mark +
        " SELECT (SELECT o FROM o)::text AS old, NULL::text AS row",
      params: [id, ...markParams],
    };
  }
  throw new Error("no such row operation: " + kind);
}

const parse = (t) => { try { return typeof t === "string" ? JSON.parse(t) : (t && typeof t === "object" ? t : null); } catch { return null; } };
const isDuplicateKey = (e) => String((e && (e.code || "")) || "") === "23505" && /_meta/.test(String((e && (e.message || e.detail || e.constraint)) || "") + String((e && e.table) || "")) ||
  /duplicate key value violates unique constraint "_meta_pkey"/.test(String((e && e.message) || ""));

/**
 * THE AGENT'S ENTRIES, WRITTEN (fix-all). `query(sql, params)` → rows;
 * `fence()` → false once the job no longer holds the site (a lost turn or
 * lease): nothing more is written then. `key` is the job's (or the request's
 * retry key's) stable name; with none, the writes carry no journal and say so.
 * Answers `{ done: [{table, kind, pk, old, row, key}], failed, already, stopped, facts }`.
 */
export async function writeAgentRows({ ops = [], query, fence = () => true, key = "" } = {}) {
  const done = [], failedBy = new Map(), countBy = new Map();
  let already = 0, stopped = false;
  const bump = (m, t, k) => { const c = m.get(t) || { add: 0, update: 0, remove: 0 }; c[k]++; m.set(t, c); };
  const list = Array.isArray(ops) ? ops : [];
  for (let oi = 0; oi < list.length && !stopped; oi++) {
    const op = list[oi];
    const pk = op && typeof op.pk === "string" && op.pk ? op.pk : "id";
    const work = [
      ...(op.add || []).map((values, n) => ({ kind: "add", values, n })),
      ...(op.update || []).map((u, n) => ({ kind: "update", id: u.id, set: u.set, n })),
      ...(op.remove || []).map((id, n) => ({ kind: "remove", id, n })),
    ];
    for (const w of work) {
      if (!fence()) { stopped = true; break; }
      const k = rowOpKey(key, oi, w.kind, w.n);
      let got = null;
      // ALREADY DONE BY AN EARLIER RUN OF THIS JOB: read first, so a removal
      // (which finds nothing the second time, and so writes no key) is known
      // as done, not as failed. The statement's own key still refuses a race.
      if (k) {
        let v = null;
        try { const r = await query("SELECT v FROM _meta WHERE k = ?", [k]); v = parse(r && r[0] && r[0].v); } catch { v = null; }
        if (v) { done.push({ table: op.table, kind: w.kind, pk, old: v.old || null, row: v.row || null, key: k, repeat: true }); bump(countBy, op.table, w.kind); already++; continue; }
      }
      try {
        const st = rowStatement({ table: op.table, pk, kind: w.kind, values: w.values, id: w.id, set: w.set, key: k });
        const rows = await query(st.sql, st.params);
        got = Array.isArray(rows) ? rows[0] : null;
      } catch (e) {
        // THE SAME JOB RAN THIS ALREADY (its journal key is there): the write
        // stands from that run, read back so a failed save can still undo it.
        if (k && isDuplicateKey(e)) {
          try {
            const r = await query("SELECT v FROM _meta WHERE k = ?", [k]);
            const v = parse(r && r[0] && r[0].v);
            if (v) { done.push({ table: op.table, kind: w.kind, pk, old: v.old || null, row: v.row || null, key: k, repeat: true }); bump(countBy, op.table, w.kind); already++; continue; }
          } catch { /* told as failed below */ }
        }
        bump(failedBy, op.table, w.kind);
        continue;
      }
      const old = parse(got && got.old), row = parse(got && got.row);
      if ((w.kind === "add" && row) || (w.kind === "update" && row) || (w.kind === "remove" && old)) {
        done.push({ table: op.table, kind: w.kind, pk, old, row, key: k });
        bump(countBy, op.table, w.kind);
      } else bump(failedBy, op.table, w.kind);
    }
  }
  return { done, already, stopped, failed: [...failedBy.entries()].reduce((n, [, c]) => n + c.add + c.update + c.remove, 0), facts: rowFacts(countBy, failedBy, stopped) };
}

/** The entries as facts: per table, what the database answered it did; what it refused. */
export function rowFacts(countBy, failedBy, stopped = false) {
  const out = [];
  for (const [t, c] of countBy) {
    const did = [c.add && "added " + c.add, c.update && "changed " + c.update, c.remove && "removed " + c.remove].filter(Boolean);
    const n = c.add + c.update + c.remove;
    if (did.length) out.push("In the " + t + " table: " + did.join(", ") + (n === 1 ? " entry" : " entries") + ".");
  }
  for (const [t, c] of failedBy) {
    const n = c.add + c.update + c.remove;
    if (n) out.push(n + (n === 1 ? " entry" : " entries") + " in the " + t + " table could not be saved (no such entry, or the database refused it).");
  }
  if (stopped) out.push("The table changes stopped part-way: this job no longer held the site.");
  return out;
}

/**
 * EVERY ENTRY PUT BACK, newest first (a save that failed after the entries were
 * written). Its journal keys go too, so a later run writes them again. Answers
 * `{ ok, left }`: `left` the entries that could not be put back.
 */
export async function undoRows({ done = [], query } = {}) {
  let left = 0;
  for (const d of [...done].reverse()) {
    try {
      const T = q(d.table), K = q(d.pk || "id");
      if (d.kind === "add") {
        if (d.row && Object.hasOwn(d.row, d.pk || "id")) await query("DELETE FROM " + T + " WHERE " + K + " = ?", [d.row[d.pk || "id"]]);
        else { left++; continue; }
      } else if (d.kind === "update") {
        if (!d.old) { left++; continue; }
        const ks = Object.keys(d.old).filter((k) => k !== (d.pk || "id") && IDENT.test(k));
        if (ks.length) await query("UPDATE " + T + " SET " + ks.map((k) => q(k) + " = ?").join(", ") + " WHERE " + K + " = ?", [...ks.map((k) => d.old[k]), d.old[d.pk || "id"]]);
      } else if (d.kind === "remove") {
        if (!d.old) { left++; continue; }
        const ks = Object.keys(d.old).filter((k) => IDENT.test(k));
        await query("INSERT INTO " + T + " (" + ks.map(q).join(", ") + ") OVERRIDING SYSTEM VALUE VALUES (" + ks.map(() => "?").join(", ") + ")", ks.map((k) => d.old[k]));
      }
      if (d.key) await query("DELETE FROM _meta WHERE k = ?", [d.key]);
    } catch { left++; }
  }
  return { ok: left === 0, left };
}

/**
 * WHAT THE REPLY IS TOLD (fix-all): every line from an outcome, the agent's
 * summary last and marked as its own words. `out` is the publish's answer.
 */
export function outcomeFacts({ changed = [], removed = [], out = null, rows = [], settings = [], moves = [], schema = [], rules = [], sorts = [], media = [], address = [], keys = [], report = "", undo = "", summary = "" } = {}) {
  const facts = [];
  const wrote = changed.filter((k) => !removed.includes(k));
  if (wrote.length) facts.push("Saved changes to " + wrote.slice(0, 10).map(fileName).join(", ") + (wrote.length > 10 ? " and " + (wrote.length - 10) + " more files" : "") + ".");
  if (removed.length) facts.push("Took away " + removed.slice(0, 10).map(fileName).join(", ") + ".");
  if (out && out.draft) facts.push("The change is saved to the draft; it goes live when the owner publishes.");
  for (const s of sorts) if (s && s.files && s.files.length) facts.push("The " + s.table + " list is now ordered by " + s.by + " (" + (s.direction === "desc" ? "descending" : "ascending") + ") on " + s.files.length + (s.files.length === 1 ? " page or component" : " pages or components") + ".");
  for (const m of media) facts.push("Placed the owner's " + m.kind + " " + m.name + " from " + m.url + ".");
  facts.push(...settings, ...moves, ...schema, ...rows, ...rules, ...address, ...keys);
  if (report) facts.push(report);
  if (undo) facts.push(undo);
  if (summary) facts.push("In the agent's own words: " + summary);
  return facts.filter(Boolean);
}

/** The owner's keys the finished server code needs and has not set, as facts (`list_keys`' names). */
export function keyFacts(parts, keysSet) {
  const ev = serverEvidence({ pages: [], parts: Array.isArray(parts) ? parts : [], keysSet: Array.isArray(keysSet) ? keysSet : null });
  if (!ev) return [];
  return serverFacts({ keys: ev.keys }).map((f) => f.text).filter((t) => /NOT set yet|if the owner has not added it/.test(t));
}

/** One of the owner's videos or recordings by its name, from the site's media listing (`siteMediaFiles`). */
export function pickMedia(files, name) {
  const n = String(name || "").toLowerCase();
  const f = (Array.isArray(files) ? files : []).find((x) => x && (x.kind === "video" || x.kind === "audio") && typeof x.url === "string" &&
    (String(x.name || "").toLowerCase() === n || String(x.url).split("?")[0].split("/").pop().toLowerCase() === n));
  return f ? { ok: true, name: f.download || f.name, url: f.url, kind: f.kind, mime: f.mime || "" } : { ok: false, why: "that is not one of the owner's uploaded videos or recordings" };
}
