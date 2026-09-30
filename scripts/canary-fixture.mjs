// The rows a paid data press is written for, read before the first paid call.
//
// ── WHY THE CANARY NEEDS ONE (run 77, 2026-09-30) ──────────────────────────
//
// Run 77 was a paid press of a deletion written for a table holding a
// temporary row and a price put back. Neither was there: the temporary row had
// never been added and the price still read its old value. Nothing checked,
// so the routing call was bought (2 credits) for a row that did not exist, the
// job matched nothing, and the run said nothing about the deletion it was for.
//
// OPT-IN AND GENERIC. The press names one table, the digest its other rows
// must have, and the fields of the one row the message is about. Nothing here
// knows a site, a table or a sentence: the same three keys describe a row to
// be deleted, a row to be changed, or a row to be put back.
//
// ONE READER: THE SITE'S OWN. The table is read as the site's pages read it
// (the Data API, `/api/db/<slug>/data/<table>`), and only there:
//   - it is the read the named digests are computed from, and anyone can take
//     it for free, so a press is prepared without the owner's session;
//   - the job's own database is the one it reflects (Batch 1's B1: the job's
//     write showed there);
//   - the owner route cannot be compared with it value for value. Its driver
//     hands NUMERIC and BIGINT columns back as text and dates as Date objects,
//     where the Data API serves numbers and its own date text, so a strict
//     comparison would stop a setup that is exactly as named.
// A table the site does not serve is unreadable here, and stops.
//
// AND THE READ MUST BE THE WHOLE TABLE (the owner's review, 2026-09-30). A
// 200 list is not that: an answer that leaves a row out still digests to the
// named baseline when the rows it does serve are the named ones (the owner
// reproduced it with the baseline and the target served, a third row left
// out, and `Content-Range: 0-1/3`). So the read asks for the table's count and
// is judged only when the answer holds every row (`readWhole`).
//
// NOTHING HERE WRITES, AND A SETUP THAT IS NOT AS NAMED STOPS AT NO COST. The
// check runs before the routing call, and on a press that does not spend it is
// the whole run: a free way to see the setup before paying for it.
import { createHash } from "node:crypto";
import { readRowList } from "./canary-rows.mjs";

const KEYS = ["table", "baseline", "target"];
/** A table's name as the generated schemas spell one, and a column's likewise. */
const NAME = /^[a-z_][a-z0-9_]{0,62}$/;
/** The start of a sha256, long enough that two setups do not share it. */
const DIGEST = /^[0-9a-f]{16,64}$/;
const MAX_FIELDS = 20;

const plain = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const scalar = (v) => v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v));

/**
 * The form's box, read whole. Blank is no check; anything else must be one
 * JSON object with exactly `table`, `baseline` and `target`.
 *
 * @returns {{ ok: true, expect: object | null } | { ok: false, msg: string }}
 */
export function readExpectRows(raw) {
  if (raw === undefined || raw === null) return { ok: true, expect: null };
  if (typeof raw !== "string") return { ok: false, msg: "the fixture box is not text" };
  const text = raw.trim();
  if (!text) return { ok: true, expect: null };
  let v;
  try { v = JSON.parse(text); } catch { return { ok: false, msg: "the fixture box is not JSON" }; }
  if (!plain(v)) return { ok: false, msg: "the fixture box must be one JSON object" };
  const extra = Object.keys(v).filter((k) => !KEYS.includes(k));
  if (extra.length) return { ok: false, msg: `it names ${extra.join(", ")}; only ${KEYS.join(", ")} are read` };
  for (const k of KEYS) if (!Object.hasOwn(v, k)) return { ok: false, msg: `it has no ${k}` };
  if (typeof v.table !== "string" || !NAME.test(v.table)) return { ok: false, msg: "table must be a table's name: lower-case letters, digits and _" };
  if (typeof v.baseline !== "string" || !DIGEST.test(v.baseline)) return { ok: false, msg: "baseline must be 16 to 64 lower-case hex characters: the start of the other rows' digest" };
  if (!plain(v.target)) return { ok: false, msg: "target must be an object: the fields of the one row the message is about" };
  const fields = Object.keys(v.target);
  if (!fields.length) return { ok: false, msg: "target names no field" };
  if (fields.length > MAX_FIELDS) return { ok: false, msg: `target names ${fields.length} fields; at most ${MAX_FIELDS} are read` };
  for (const f of fields) {
    if (!NAME.test(f)) return { ok: false, msg: `target field ${JSON.stringify(f)} is not a column's name` };
    if (!scalar(v.target[f])) return { ok: false, msg: `target field ${f} is not a string, a number, a boolean or null` };
  }
  return { ok: true, expect: { table: v.table, baseline: v.baseline, target: { ...v.target } } };
}

/**
 * One text for a list of rows: keys sorted at every level, rows by id. The
 * same values in a different key order give the same text; a value of another
 * type does not.
 */
export function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (plain(v)) return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}

/** The digest a press names as its baseline: sha256 of the canonical rows. */
export function rowsDigest(rows) {
  const list = [...(Array.isArray(rows) ? rows : [])].sort((a, b) => a.id - b.id);
  return createHash("sha256").update(canonical(list), "utf8").digest("hex");
}

/** Does this row have every named field, holding exactly the named value? */
function isTarget(row, target) {
  return Object.keys(target).every((f) => Object.hasOwn(row, f) && canonical(row[f]) === canonical(target[f]));
}

const stop = (why, detail) => ({ ok: false, why, detail });

// `first-last/total`, and `*/total` for an answer with no rows. Fifteen digits
// keep a count exact.
const COUNTED = /^(\d{1,15})-(\d{1,15})\/(\d{1,15}|\*)$/;
const NO_ROWS = /^\*\/(\d{1,15}|\*)$/;

// THE SITE'S OWN READ, TAKEN ONLY WHEN IT IS THE WHOLE TABLE. The Data API's
// count contract, which the Worker passes through both ways
// (`proxySiteService`): asked with `Prefer: count=exact`, it says in
// `Content-Range` which rows it served and how many the table holds. Measured
// through the Worker on fretwork-1, 2026-09-30:
//   the whole table          200, `0-3/4`
//   part of it (a limit)     206, `0-1/4`
//   no row                   200, `*/0`
//   the count not asked for  200, `0-3/*`
//
// WHOLE is an answer whose count is the number of rows it served, with a range
// from the first to the last: `0-(n-1)/n`, or `*/0` with no rows. Anything else
// stops, before any routing call:
//   incomplete            the table holds rows the answer did not serve (a 206,
//                         or a count above the rows served);
//   completeness-unknown  nothing to hold the rows to: no header, a `*` count,
//                         a header this does not read, or one that does not
//                         describe the rows beside it;
//   unreadable            not a whole row list at all (`readRowList`).
//
// `served` is `{status, text, range}`, `range` the header as it came (null when
// absent). The answer is `{ok: true, rows, count, range}` or
// `{ok: false, stop, why, range}`, `stop` being one of the three above.
export function readWhole(served) {
  const range = served && typeof served.range === "string" && served.range.trim() ? served.range.trim() : null;
  const said = range === null ? "no Content-Range" : `Content-Range ${JSON.stringify(range)}`;
  const no = (why, text) => ({ ok: false, stop: why, why: text, range });
  if (served && served.status === 206) return no("incomplete", `206 Partial Content, ${said}: the answer holds part of the table`);
  const list = readRowList(served);
  if (!list.ok) return no("unreadable", list.why);
  const n = list.rows.length;
  if (!range) return no("completeness-unknown", `${n} rows and ${said}: the answer does not say how many rows the table holds`);
  const m = COUNTED.exec(range);
  const none = m ? null : NO_ROWS.exec(range);
  if (!m && !none) return no("completeness-unknown", `${n} rows and ${said}, which this does not read`);
  const total = m ? m[3] : none[1];
  if (total === "*") return no("completeness-unknown", `${n} rows and ${said}: the table's count was not given`);
  if (Number(total) > n) return no("incomplete", `${n} rows served and ${said}: the table holds ${Number(total)}`);
  const described = n === 0 ? !!none : !!m && Number(m[1]) === 0 && Number(m[2]) === n - 1;
  if (Number(total) !== n || !described) return no("completeness-unknown", `${n} rows served and ${said}, which does not describe them`);
  return { ok: true, rows: list.rows, count: n, range };
}

/**
 * IS THE SETUP THE ONE THIS PRESS NAMES? Asked of the site's own read, as
 * `readWhole` returns it, and the first failure decides:
 *   unreadable, incomplete, completeness-unknown
 *                     the read is not the whole table (`readWhole` says why);
 *   target-missing    no row has every field the target names;
 *   target-ambiguous  more than one does;
 *   baseline-mismatch the other rows do not digest to the named baseline.
 */
export function fixtureVerdict(expect, site) {
  if (!site || !site.ok) return stop((site && site.stop) || "unreadable", `the site's own read: ${(site && site.why) || "not read"}`);
  const rows = site.rows;
  const named = Object.entries(expect.target).map(([k, v]) => `${k} ${JSON.stringify(v)}`).join(", ");
  const hits = rows.filter((r) => isTarget(r, expect.target));
  if (!hits.length) return stop("target-missing", `no row of ${expect.table}'s ${rows.length} has ${named}`);
  if (hits.length > 1) return stop("target-ambiguous", `${hits.length} rows (id ${hits.map((r) => r.id).join(", ")}) have ${named}`);
  const others = rows.filter((r) => r !== hits[0]);
  const digest = rowsDigest(others);
  if (!digest.startsWith(expect.baseline)) {
    return { ...stop("baseline-mismatch", `the other ${others.length} rows digest to ${digest.slice(0, 16)}, not ${expect.baseline.slice(0, 16)}`), digest };
  }
  return { ok: true, why: "as-named", detail: `${rows.length} rows; the target is id ${hits[0].id}, and the other ${others.length} digest to ${digest.slice(0, 16)}`, target: hits[0], digest, count: rows.length };
}

/** The expectation in one line, for the log. */
export function expectRowsSaid(expect) {
  return expect ? `${expect.table}: target ${JSON.stringify(expect.target)}, the other rows ${expect.baseline.slice(0, 16)}` : "";
}

/** The verdict in one line, for the log. */
export function fixtureSaid(v) {
  return v && v.ok ? `as named: ${v.detail}` : `NOT AS NAMED (${(v && v.why) || "unread"}): ${(v && v.detail) || ""}`;
}

/**
 * What goes into the evidence: the reading, its `Content-Range`, and the rows
 * of a whole read, which the site's pages serve to anyone. A table the site
 * does not serve is unreadable here, so nothing only the owner can read is
 * copied out.
 */
export function fixtureRecord(expect, site, verdict) {
  const ok = !!(site && site.ok);
  const read = site ? { ok, stop: ok ? null : site.stop || "unreadable", why: ok ? null : site.why || null, count: ok ? site.count : null, range: site.range === undefined ? null : site.range } : null;
  return { expect, site: read, rows: ok ? site.rows : null, verdict };
}
