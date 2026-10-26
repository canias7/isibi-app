// PUT A SITE'S DATA BACK TO AN EARLIER MOMENT (2026-10-26, the owner's feature).
//
// A customer asks in chat ("put my data back to how it was yesterday 6pm").
// The router answers intent "restore" with the moment in their words
// (`builder/site-ask.mjs`). Then, here:
//
//   1. THE MOMENT, in the customer's time zone (`resolveRestoreTime`). A
//      moment that cannot be pinned to a clock time is asked about; one
//      older than the history window (the owner chose one day, Neon's
//      default; no project's retention is changed) or in the future is
//      refused with an honest sentence.
//   2. THE REAL DIFFERENCE (`previewRestore`): a Neon branch of the site's
//      branch as it was at that moment (point-in-time, `parent_timestamp`),
//      every table read row by row there and now, and compared
//      (`diffTables`): rows that come back, rows that change back (before and
//      after), and rows that would be lost. The branch is deleted at once.
//   3. THE EXPLANATION is written by a model from that difference only (the
//      owner's rule: replies model-written from authoritative results), then
//      checked by code (`checkExplanation`): every number and every name in it
//      must be in the difference, and no email or phone number may appear.
//      A text that fails is replaced by the plain list (`plainExplanation`).
//   4. THE CARD (public/chat.js) shows it with "Comes back" and "Will be
//      lost", and a box where the customer types "restore".
//   5. THE RESTORE (`confirmRestore`): refused unless the typed word is
//      "restore" (checked here, on the server). Neon's restore of the site's
//      branch to its own history at that moment, with `preserve_under_name`:
//      Neon keeps the data as it was just before as a branch named
//      `before-restore-<time>` IN THE SAME OPERATION, so there is no moment
//      when the restore has run and its copy does not exist. The copy is then
//      found in the branch list, and the restored tables are read and compared
//      with the past (verified). `undoRestore` puts that copy back.
//
// THE SITE LOCK: every Neon call names the project read from the site's own
// row, which must belong to the caller; a project whose branch holds another
// database than the site's is refused (a restore would move that one too).
//
// Pure: every network step is injected (`deps`), so the tests run with a fake
// Neon and fake databases.

export const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SNAPSHOT_PREFIX = "before-restore-";
export const UNDO_PREFIX = "before-undo-";
export const ROW_LIMIT = 5000;

// ------------------------------------------------------------------ the moment

function partsIn(ms, tz) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const o = {};
  for (const p of f.formatToParts(new Date(ms))) if (p.type !== "literal") o[p.type] = Number(p.value);
  return o;
}

/** The UTC instant of a wall-clock time in `tz` (two passes settle a DST edge). */
export function zonedToUtc(y, mo, d, h, mi, tz) {
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) {
    const p = partsIn(guess, tz);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += Date.UTC(y, mo - 1, d, h, mi) - shown;
  }
  return guess;
}

export function validZone(tz) {
  if (typeof tz !== "string" || !tz) return false;
  try { new Intl.DateTimeFormat("en-GB", { timeZone: tz }); return true; } catch { return false; }
}

/** "Sunday 25 October, 6:00 pm" in `tz`. */
export function sayMoment(ms, tz) {
  const d = new Date(ms);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(d);
  const p = partsIn(ms, tz);
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return day + ", " + h12 + ":" + String(p.minute).padStart(2, "0") + " " + (p.hour < 12 ? "am" : "pm");
}

const WINDOW_SAY = "I can only put your data back to a moment in the last 24 hours — that is how much history your site's database keeps.";

/**
 * Read the moment in the customer's words. Answers `{ ok: true, at, iso, said }`
 * or `{ ok: false, why, say }` (`ask` when it needs a clock time, `window` or
 * `future` when refused, `zone` when the zone is unknown).
 */
export function resolveRestoreTime(words, { now = Date.now(), tz = "UTC" } = {}) {
  if (!validZone(tz)) return { ok: false, why: "zone", say: "I couldn't tell which time zone you're in, so I can't pin that moment down. Tell me the time with the date, like \"25 October at 6pm\"." };
  const w = String(words || "").toLowerCase().replace(/\s+/g, " ").trim();
  const ask = { ok: false, why: "ask", say: "Which exact time should I put your data back to? For example \"yesterday at 6pm\" or \"today at 9:30am\". I can go back up to 24 hours." };
  if (!w) return ask;
  let at = null;
  const ago = /\b(\d{1,3}|an?|one)\s*(minutes?|mins?|hours?|hrs?)\s+ago\b/.exec(w);
  const iso = /\b(\d{4})-(\d{2})-(\d{2})[t ](\d{1,2}):(\d{2})\b/.exec(w);
  if (ago) {
    const n = /^\d/.test(ago[1]) ? Number(ago[1]) : 1;
    at = now - n * (/^h/.test(ago[2]) ? 3600000 : 60000);
  } else if (iso) {
    at = zonedToUtc(+iso[1], +iso[2], +iso[3], +iso[4], +iso[5], tz);
  } else {
    let h = null, mi = 0;
    const clock = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?=\b|$)/g;
    for (const m of w.matchAll(clock)) {
      const hh = Number(m[1]);
      const mer = m[3] ? m[3][0] : "";
      if (!m[2] && !mer) continue;
      if (hh > 23 || (m[2] && Number(m[2]) > 59) || (mer && (hh < 1 || hh > 12))) return ask;
      h = mer === "p" ? (hh % 12) + 12 : mer === "a" ? hh % 12 : hh;
      mi = m[2] ? Number(m[2]) : 0;
      break;
    }
    if (h === null && /\bnoon\b|\bmidday\b/.test(w)) h = 12;
    if (h === null && /\bmidnight\b/.test(w)) h = 0;
    if (h === null) return ask;
    const today = partsIn(now, tz);
    const base = Date.UTC(today.year, today.month - 1, today.day);
    const dayAt = (offsetDays) => {
      const d = new Date(base + offsetDays * 86400000);
      return zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), h, mi, tz);
    };
    if (/\byesterday\b|\blast night\b/.test(w)) at = dayAt(-1);
    else if (/\btoday\b|\bthis (morning|afternoon|evening)\b|\btonight\b/.test(w)) at = dayAt(0);
    else { at = dayAt(0); if (at > now) at = dayAt(-1); }
  }
  if (!Number.isFinite(at)) return ask;
  if (at > now) return { ok: false, why: "future", say: "That moment hasn't happened yet, so there is nothing to put back. Tell me a time in the last 24 hours." };
  if (now - at > RESTORE_WINDOW_MS) return { ok: false, why: "window", say: WINDOW_SAY };
  return { ok: true, at, iso: new Date(at).toISOString(), said: sayMoment(at, tz) };
}

// ------------------------------------------------------------------ the difference

const PRIVATE_COL = /e-?mail|phone|mobile|\btel\b|_tel|address|postcode|post_code|zip|password|passcode|token|secret|ssn|birth|dob|card|iban/i;
const EMAIL = /[^\s@"']+@[^\s@"']+\.[a-z]{2,}/i;
const PHONE = /(?:\+?\d[\d ()-]{7,}\d)/;
const LABEL_COLS = ["name", "title", "label", "item", "product", "event", "lesson", "service", "subject", "heading", "slug"];
const TIME_COLS = ["updated_at", "modified_at", "changed_at", "created_at", "inserted_at", "added_at"];

export function privateColumn(col) { return PRIVATE_COL.test(String(col)); }
export function privateValue(v) { return typeof v === "string" && (EMAIL.test(v) || PHONE.test(v)); }

function canon(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function rowLabel(row, key) {
  for (const c of LABEL_COLS) {
    const v = row[c];
    if (typeof v === "string" && v.trim() && !privateValue(v)) return v.trim().slice(0, 80);
  }
  for (const [c, v] of Object.entries(row)) {
    if (key.includes(c) || privateColumn(c)) continue;
    if (typeof v === "string" && v.trim() && !privateValue(v) && v.length <= 80) return v.trim();
  }
  return key.length ? "#" + key.map((k) => canon(row[k])).join("/") : "an entry";
}

function rowTime(row) {
  for (const c of TIME_COLS) {
    const v = row[c];
    if (v === null || v === undefined || v === "") continue;
    const t = v instanceof Date ? v.getTime() : Date.parse(String(v));
    if (Number.isFinite(t)) return { col: c, at: t };
  }
  return null;
}

function shown(col, v) { return privateColumn(col) || privateValue(v) ? "(hidden)" : canon(v); }

/**
 * One table's difference. `key` is the primary key's columns (empty: the whole
 * row is its identity). Answers `{ back, change, lost }`: rows that come back,
 * rows that change back (`fields: [{ col, now, back }]`), rows that would be lost.
 */
export function diffRows(pastRows, nowRows, key = []) {
  const id = (r) => key.length ? JSON.stringify(key.map((k) => canon(r[k]))) : JSON.stringify(Object.keys(r).sort().map((k) => [k, canon(r[k])]));
  const past = new Map(pastRows.map((r) => [id(r), r]));
  const cur = new Map(nowRows.map((r) => [id(r), r]));
  const back = [], change = [], lost = [];
  for (const [k, r] of past) {
    if (!cur.has(k)) { back.push({ label: rowLabel(r, key), time: rowTime(r) }); continue; }
    const n = cur.get(k);
    const cols = [...new Set([...Object.keys(r), ...Object.keys(n)])].sort();
    const fields = cols.filter((c) => canon(r[c]) !== canon(n[c]) && !TIME_COLS.includes(c)).map((c) => ({ col: c, now: shown(c, n[c]), back: shown(c, r[c]) }));
    if (fields.length) change.push({ label: rowLabel(r, key), fields, time: rowTime(n) });
  }
  for (const [k, n] of cur) if (!past.has(k)) lost.push({ label: rowLabel(n, key), time: rowTime(n) });
  return { back, change, lost };
}

/** Every table: `{ table: { key, rows, truncated } }` on both sides. Tables only on one side are named. */
export function diffTables(past, now) {
  const tables = [...new Set([...Object.keys(past), ...Object.keys(now)])].sort();
  const out = [];
  for (const t of tables) {
    const p = past[t], n = now[t];
    if (!p) { out.push({ table: t, onlyNow: true, back: [], change: [], lost: [{ label: "the whole " + t + " list (" + n.rows.length + " entries)", time: null }] }); continue; }
    if (!n) { out.push({ table: t, onlyPast: true, back: [{ label: "the whole " + t + " list (" + p.rows.length + " entries)", time: null }], change: [], lost: [] }); continue; }
    const d = diffRows(p.rows, n.rows, p.key || []);
    if (d.back.length || d.change.length || d.lost.length || p.truncated || n.truncated) out.push({ table: t, ...d, truncated: !!(p.truncated || n.truncated) });
  }
  return out;
}

export function diffEmpty(diff) { return !diff.some((t) => t.back.length || t.change.length || t.lost.length); }

// ------------------------------------------------------------------ reading the tables

/** Read every table in `public` (not `_`-prefixed), key and rows, through `query(conn, sql, params)`. */
export async function readTables(query, conn, limit = ROW_LIMIT) {
  const tabs = await query(conn, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name", []);
  const out = {};
  for (const r of tabs) {
    const t = String(r.table_name);
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(t)) continue;
    const keyRows = await query(conn, "SELECT a.attname AS col FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = ('public.' || $1)::regclass AND i.indisprimary ORDER BY a.attname", [t]);
    const key = keyRows.map((k) => String(k.col));
    const rows = await query(conn, "SELECT * FROM public.\"" + t + "\"" + (key.length ? " ORDER BY " + key.map((k) => "\"" + k.replace(/"/g, "") + "\"").join(", ") : "") + " LIMIT " + (limit + 1), []);
    out[t] = { key, rows: rows.slice(0, limit), truncated: rows.length > limit };
  }
  return out;
}

/** A digest of every table's rows (verification after a restore). */
export async function tablesDigest(tables) {
  const canonTables = Object.keys(tables).sort().map((t) => [t, tables[t].rows.map((r) => Object.keys(r).sort().map((k) => [k, canon(r[k])])).map((x) => JSON.stringify(x)).sort()]);
  const buf = new TextEncoder().encode(JSON.stringify(canonTables));
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ------------------------------------------------------------------ facts, the plain list, the check

function timeSay(time, tz) { return time ? " (" + (time.col.startsWith("created") || time.col.startsWith("inserted") || time.col.startsWith("added") ? "added " : "changed ") + sayMoment(time.at, tz) + ")" : ""; }
const q = (s) => "\"" + s + "\"";

/** The facts the model explains, one per table side. */
export function restoreFacts(diff, { said, tz = "UTC" } = {}) {
  const facts = [{ id: "F0", text: "The customer asked to put their site's data back to how it was on " + said + "." }];
  let i = 1;
  for (const t of diff) {
    if (t.back.length) facts.push({ id: "F" + i++, text: "In " + t.table + ", " + t.back.length + " entr" + (t.back.length === 1 ? "y" : "ies") + " would come back: " + t.back.map((r) => q(r.label)).join(", ") + "." });
    if (t.change.length) facts.push({ id: "F" + i++, text: "In " + t.table + ", " + t.change.length + " entr" + (t.change.length === 1 ? "y" : "ies") + " would change back: " + t.change.map((r) => q(r.label) + " " + r.fields.map((f) => f.col + " " + f.now + " → " + f.back).join(", ") + timeSay(r.time, tz)).join("; ") + "." });
    if (t.lost.length) facts.push({ id: "F" + i++, text: "In " + t.table + ", " + t.lost.length + " entr" + (t.lost.length === 1 ? "y" : "ies") + " added or changed after that moment would be lost: " + t.lost.map((r) => q(r.label) + timeSay(r.time, tz)).join(", ") + "." });
    if (t.truncated) facts.push({ id: "F" + i++, text: "The " + t.table + " list is longer than " + ROW_LIMIT + " entries, so only its first " + ROW_LIMIT + " were compared." });
  }
  if (diffEmpty(diff)) facts.push({ id: "F" + i++, text: "Nothing in the data is different between then and now." });
  return facts;
}

/** The deterministic explanation: the facts, as a list. */
export function plainExplanation(diff, { said, tz = "UTC" } = {}) {
  const lines = ["Here is what putting your data back to " + said + " would do:"];
  for (const f of restoreFacts(diff, { said, tz }).slice(1)) lines.push("• " + f.text);
  return lines.join("\n");
}

const NAME_OK = new Set(["i", "a", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "am", "pm", "restore", "cancel", "ok", "okay"]);

/**
 * Is every number and name in `text` in the difference? Numbers: each one in
 * the text appears in the facts. Names: each quoted phrase, and each capitalised
 * word not opening a sentence, appears in the facts. No email or phone number.
 * Answers `{ ok, bad: [...] }`.
 */
export function checkExplanation(text, facts) {
  const bad = [];
  const src = facts.map((f) => f.text).join("\n");
  const srcLow = src.toLowerCase();
  const nums = new Set((src.match(/\d+(?:[.:]\d+)?/g) || []));
  if (typeof text !== "string" || !text.trim()) return { ok: false, bad: ["empty"] };
  if (EMAIL.test(text)) bad.push("email");
  if (PHONE.test(text)) bad.push("phone");
  for (const n of text.match(/\d+(?:[.:]\d+)?/g) || []) if (!nums.has(n)) bad.push(n);
  for (const m of text.matchAll(/["“‘]([^"”’]{1,80})["”’]/g)) if (!srcLow.includes(m[1].toLowerCase())) bad.push(m[1]);
  for (const m of text.matchAll(/(?<=[^.!?:\s]\s+)([A-Z][\w'-]+)/g)) {
    const w = m[1].replace(/'s$/, "");
    if (!NAME_OK.has(w.toLowerCase()) && !srcLow.includes(w.toLowerCase())) bad.push(w);
  }
  return { ok: bad.length === 0, bad };
}

/** The card's two lists, from the difference (never the model's text). */
export function cardLists(diff, tz = "UTC") {
  const comes = [], lost = [];
  for (const t of diff) {
    for (const r of t.back) comes.push(t.table + ": " + r.label + timeSay(r.time, tz));
    for (const r of t.change) comes.push(t.table + ": " + r.label + " — " + r.fields.map((f) => f.col + " " + f.now + " → " + f.back).join(", "));
    for (const r of t.lost) lost.push(t.table + ": " + r.label + timeSay(r.time, tz));
  }
  return { comes, lost };
}

// ------------------------------------------------------------------ the site lock

/**
 * The site's own project, or a refusal. `project` is the site's row
 * (`uid`, `neon_project`, `neon_branch`); `dbName` its database.
 */
export async function lockSite(neon, { project, uid, dbName }) {
  if (!project || typeof project.neon_project !== "string" || !project.neon_project || typeof project.neon_branch !== "string" || !project.neon_branch) return { ok: false, why: "no-project", say: "This site has no database history I can reach, so I can't put its data back." };
  if (!uid || project.uid !== uid) return { ok: false, why: "not-owner", say: "That site isn't yours, so I can't change its data." };
  let dbs;
  try { dbs = await neon.databases(project.neon_project, project.neon_branch); } catch { return { ok: false, why: "unreadable", say: "I couldn't reach your site's database just now. Nothing was changed — try again in a moment." }; }
  const others = dbs.filter((d) => d !== dbName && d !== "neondb" && d !== "postgres");
  if (!dbs.includes(dbName) || others.length) return { ok: false, why: "shared-project", say: "Your site's data shares its storage with other data, so putting it back could change more than this site. I haven't changed anything." };
  return { ok: true, projectId: project.neon_project, branchId: project.neon_branch };
}

function neonSay(e) {
  const d = String((e && (e.detail || e.message)) || "");
  if (/history|retention|timestamp|lsn|too old|before/i.test(d) && e && e.status >= 400 && e.status < 500) return "Your site's database no longer keeps that far back, so I can't put it back to that moment. Nothing was changed.";
  return "I couldn't reach your site's database history just now. Nothing was changed — try again in a moment.";
}

// ------------------------------------------------------------------ the flow

/**
 * The difference and its explanation. Nothing is changed.
 *
 * deps.neon: `databases(projectId, branchId)`, `pastBranch(projectId, branchId,
 * iso)` → `{ branchId }`, `conn(projectId, branchId)` → conn, `del(projectId,
 * branchId)`. deps.query(conn, sql, params). deps.mainConn: the site's own
 * connection. deps.explain(facts) → `{ text, usage }` or null.
 */
export async function previewRestore(deps, { project, uid, dbName, when, tz, now = Date.now() }) {
  const t = resolveRestoreTime(when, { now, tz });
  if (!t.ok) return { ok: false, why: t.why, say: t.say };
  const lock = await lockSite(deps.neon, { project, uid, dbName });
  if (!lock.ok) return lock;
  let past = "";
  let pastTables, nowTables;
  try {
    past = (await deps.neon.pastBranch(lock.projectId, lock.branchId, t.iso)).branchId;
    const pconn = await deps.neon.conn(lock.projectId, past);
    pastTables = await readTables(deps.query, pconn);
    nowTables = await readTables(deps.query, deps.mainConn);
  } catch (e) {
    if (e && e.branchId && !past) past = e.branchId;
    return { ok: false, why: "neon", say: neonSay(e) };
  } finally {
    if (past) { try { await deps.neon.del(lock.projectId, past); } catch { /* swept by name later */ } }
  }
  const diff = diffTables(pastTables, nowTables);
  const facts = restoreFacts(diff, { said: t.said, tz });
  let text = "", usage = [], written = "plain", bad = [];
  if (!diffEmpty(diff) && typeof deps.explain === "function") {
    let out = null;
    try { out = await deps.explain(facts); } catch { out = null; }
    usage = (out && Array.isArray(out.usage)) ? out.usage : [];
    if (out && typeof out.text === "string") {
      const c = checkExplanation(out.text, facts);
      if (c.ok) { text = out.text.trim(); written = "model"; } else bad = c.bad;
    }
  }
  if (!text) text = diffEmpty(diff) ? "Your data is the same now as it was on " + t.said + ", so there is nothing to put back." : plainExplanation(diff, { said: t.said, tz });
  return { ok: true, at: t.iso, said: t.said, empty: diffEmpty(diff), text, written, bad, usage, lists: cardLists(diff, tz), diff };
}

function stamp(now) { return new Date(now).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "z").toLowerCase(); }

/**
 * The restore, after the customer typed "restore". Neon's restore keeps the
 * data as it is now under `before-restore-<time>` in the same operation; the
 * copy is then found, and the restored tables are compared with the past.
 */
export async function confirmRestore(deps, { project, uid, dbName, at, typed, tz = "UTC", now = Date.now() }) {
  if (String(typed || "").trim().toLowerCase() !== "restore") return { ok: false, why: "confirm-required", say: "Type restore in the box to confirm. Nothing was changed." };
  const ms = Date.parse(String(at || ""));
  if (!Number.isFinite(ms) || ms > now) return { ok: false, why: "future", say: "That moment hasn't happened yet. Nothing was changed." };
  if (now - ms > RESTORE_WINDOW_MS) return { ok: false, why: "window", say: WINDOW_SAY + " Nothing was changed." };
  const lock = await lockSite(deps.neon, { project, uid, dbName });
  if (!lock.ok) return lock;
  const iso = new Date(ms).toISOString();
  // THE PAST, READ FIRST, so the restore can be checked against it.
  let past = "", want = "";
  try {
    past = (await deps.neon.pastBranch(lock.projectId, lock.branchId, iso)).branchId;
    want = await tablesDigest(await readTables(deps.query, await deps.neon.conn(lock.projectId, past)));
  } catch (e) {
    if (e && e.branchId && !past) past = e.branchId;
    if (past) { try { await deps.neon.del(lock.projectId, past); } catch { /* swept later */ } }
    return { ok: false, why: "neon", say: neonSay(e) };
  }
  const snapshot = SNAPSHOT_PREFIX + stamp(now);
  try {
    await deps.neon.restore(lock.projectId, lock.branchId, { atIso: iso, preserveName: snapshot });
  } catch (e) {
    try { await deps.neon.del(lock.projectId, past); } catch { /* swept later */ }
    return { ok: false, why: "neon", say: neonSay(e) };
  }
  try { await deps.neon.del(lock.projectId, past); } catch { /* swept later */ }
  let kept = false, verified = false;
  try { kept = (await deps.neon.branches(lock.projectId)).some((b) => b.name === snapshot); } catch { kept = false; }
  try { verified = (await tablesDigest(await readTables(deps.query, deps.mainConn))) === want; } catch { verified = false; }
  const say = "Done — your data is back to how it was at " + sayMoment(ms, validZone(tz) ? tz : "UTC") + "." +
    (kept ? " A copy of your data from just before is saved, so you can say \"undo the restore\" to go back." : " I couldn't find the saved copy of your data from just before, so I can't promise an undo — please tell support.") +
    (verified ? "" : " I couldn't check every list afterwards, so please look over your data.");
  return { ok: true, snapshot, kept, verified, say };
}

/** Put the latest `before-restore-` copy back (after "undo"), keeping the state it replaces. */
export async function undoRestore(deps, { project, uid, dbName, typed, now = Date.now() }) {
  if (String(typed || "").trim().toLowerCase() !== "undo") return { ok: false, why: "confirm-required", say: "Type undo in the box to confirm. Nothing was changed." };
  const lock = await lockSite(deps.neon, { project, uid, dbName });
  if (!lock.ok) return lock;
  let list;
  try { list = await deps.neon.branches(lock.projectId); } catch (e) { return { ok: false, why: "neon", say: neonSay(e) }; }
  const copies = list.filter((b) => b.name.startsWith(SNAPSHOT_PREFIX)).sort((a, b) => (a.name < b.name ? 1 : -1));
  if (!copies.length) return { ok: false, why: "no-copy", say: "There is no earlier restore to undo." };
  const preserve = UNDO_PREFIX + stamp(now);
  try { await deps.neon.restore(lock.projectId, lock.branchId, { sourceBranchId: copies[0].id, preserveName: preserve }); }
  catch (e) { return { ok: false, why: "neon", say: neonSay(e) }; }
  return { ok: true, from: copies[0].name, preserve, say: "Done — your data is back to how it was just before the restore." };
}
