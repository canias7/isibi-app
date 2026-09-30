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
// NOTHING HERE WRITES, AND A SETUP THAT IS NOT AS NAMED STOPS AT NO COST. The
// check runs before the routing call, and on a press that does not spend it is
// the whole run: a free way to see the setup before paying for it.
import { createHash } from "node:crypto";

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

/**
 * IS THE SETUP THE ONE THIS PRESS NAMES? Asked of the site's own read, as
 * `readRowList` in canary-rows.mjs returns it, and the first failure decides:
 *   unreadable        the site's read did not answer with a whole row list;
 *   target-missing    no row has every field the target names;
 *   target-ambiguous  more than one does;
 *   baseline-mismatch the other rows do not digest to the named baseline.
 */
export function fixtureVerdict(expect, site) {
  if (!site || !site.ok) return stop("unreadable", `the site's own read: ${(site && site.why) || "not read"}`);
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
 * What goes into the evidence: the reading, and the rows the site's own read
 * served, which its pages serve to anyone. A table the site does not serve is
 * unreadable here, so nothing only the owner can read is copied out.
 */
export function fixtureRecord(expect, site, verdict) {
  const ok = !!(site && site.ok);
  return { expect, site: site ? { ok, why: ok ? null : site.why || null, count: ok ? site.rows.length : null } : null, rows: ok ? site.rows : null, verdict };
}
