// ── THE CANARY'S RULES TEST: BOOKINGS CLOSED, AND ONE REAL BOOKING REFUSED ──
//
// The rules rung changes what a site's database accepts, and nothing a visitor
// downloads. So a reply saying "✅" proves nothing: the apply runs its
// statements one at a time and logs a failed one rather than stopping. What
// proves a booking table closed is a real visitor booking being REFUSED at the
// privilege check, with no row added. This module decides everything about
// that test; the canary hands it the transports, so every decision here is
// driven by tests with no site, no token and no database.
//
// WHAT A PASS SHOWS, AND WHAT IT CANNOT. No booking is submitted before the
// edit (the owner kept that out of scope), so a pass shows the configuration
// changing and a booking refused afterwards — never a measured change from a
// booking that went through to one that was refused. `EVIDENCE_BOUNDARY` says
// so in every account this module writes.
//
// EITHER SUPPORTED WAY OF CLOSING IS ACCEPTED. The rules tool can mark a table
// closed (`retired`) or take its write access away (`write: "none"`); both
// refuse a visitor's booking at the privilege check. Neither is required: the
// verdict reads what the job's own stored reply says it changed, what the
// owner's table listing says afterwards, and what a real booking gets back —
// never the wording of one implementation.
//
// NOTHING SECRET IS RECORDED. The owner's secrets list carries a few characters
// of each key (`prefix`, `last4`); only the NAMES leave `readSecretNames`.

import crypto from "node:crypto";
import { ACCESS_PRESETS, READ_LEVELS, WRITE_LEVELS } from "../site-access.mjs";
import { MAIL_PROVIDERS } from "../site-mail.mjs";
import { SMS_PROVIDERS } from "../site-sms.mjs";
import { readRowList, decimalOf } from "./canary-rows.mjs";

/** Said wherever a result is: what a pass on this test does and does not show. */
export const EVIDENCE_BOUNDARY =
  "No booking was submitted before the edit, so this shows the configuration changing and a booking refused " +
  "afterwards — not a measured change from a booking that went through to one that was refused.";

/** How many of the newest rows the owner's view reads. The count is exact; these are the newest ids. */
export const NEWEST_ROWS = 50;

const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");

// ── THE MARKER BOOKING ──────────────────────────────────────────────────────

/**
 * The run's own id, from the workflow run (and its attempt past the first), so
 * the marker names one run and no other. Outside Actions it is a timestamp.
 */
export function runIdOf(env = {}) {
  const id = String(env.GITHUB_RUN_ID || "").trim();
  const attempt = Number(env.GITHUB_RUN_ATTEMPT || 1);
  if (/^\d{1,20}$/.test(id)) return Number.isSafeInteger(attempt) && attempt > 1 ? `${id}.${attempt}` : id;
  return `local-${Date.now()}`;
}

/** The marker booking: the scenario's template, with this run's id in the name. */
export function markerBooking(template, runId) {
  const t = template || {};
  return Object.freeze({
    name: `${t.name} ${runId}`,
    phone: t.phone,
    party_size: t.party_size,
    booking_date: t.booking_date,
    booking_time: t.booking_time,
  });
}

const dateOf = (v) => {
  // A DATE comes back from the owner route as "2099-12-31", or as a timestamp at
  // that day's midnight when the driver turns it into a Date; anything else is
  // not this date.
  const s = typeof v === "string" ? v : "";
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ]00:00(?::00(?:\.0+)?)?(?:Z|[+-]00(?::?00)?)?)?$/.exec(s);
  return m ? m[1] : null;
};
const timeOf = (v) => {
  const s = typeof v === "string" ? v : "";
  const m = /^(\d{2}:\d{2})(?::00(?:\.0+)?)?$/.exec(s);
  return m ? m[1] : null;
};

/**
 * Does this stored row hold EVERY value the marker booking sent? The name
 * carries the run id, so it names this run; the other four must match too, or
 * the row is not the one this run's booking made.
 */
export function rowIsMarker(row, marker) {
  if (!row || typeof row !== "object" || !marker) return false;
  return row.name === marker.name &&
    row.phone === marker.phone &&
    decimalOf(row.party_size) === decimalOf(marker.party_size) &&
    dateOf(row.booking_date) === marker.booking_date &&
    timeOf(row.booking_time) === marker.booking_time;
}

/**
 * What the booking form sent, checked against the marker: exactly the five
 * fields, each the marker's value, and `party_size` a number as the form sends
 * it. Anything else is not the booking this run meant to make.
 */
export function bookingBodyVerdict(raw, marker) {
  let body = raw;
  if (typeof raw === "string") { try { body = JSON.parse(raw); } catch { return { ok: false, why: "the request body is not JSON" }; } }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, why: "the request body is not an object" };
  const want = ["booking_date", "booking_time", "name", "party_size", "phone"];
  const keys = Object.keys(body).sort();
  if (JSON.stringify(keys) !== JSON.stringify(want)) return { ok: false, why: `the fields sent were ${keys.join(", ") || "none"}, not ${want.join(", ")}` };
  for (const k of want) {
    if (body[k] !== marker[k]) return { ok: false, why: `${k} was sent as ${JSON.stringify(body[k])}, not ${JSON.stringify(marker[k])}` };
  }
  return { ok: true, why: "" };
}

/**
 * The request headers the platform's data route passes on to the database,
 * beside `content-type`, `accept` and `cookie`. Each changes what the database
 * checks:
 * - `prefer` can turn the insert into an upsert, or ask for the new row back.
 *   Asking for it back needs the READ privilege visitors do not have on this
 *   table, and is refused with the very answer a pass looks for.
 * - `authorization` makes it a signed-in member's request, not a visitor's.
 * The site's own booking request carries neither (read from its live code).
 */
export const BOOKING_HEADERS_REFUSED = Object.freeze(["prefer", "authorization"]);

/**
 * IS THIS THE ONE BOOKING REQUEST THE TEST WAS WRITTEN FOR? Asked in the
 * tab's interceptor BEFORE the request can leave, never afterwards. It must be:
 * - the first booking request;
 * - exactly the marker's five fields and values (`bookingBodyVerdict`), so
 *   malformed JSON, a changed value or a missing or extra field all fail;
 * - sent to the endpoint with no query string, which the data route would
 *   pass on to the database too;
 * - without a `prefer` or `authorization` header.
 * Anything else answers `ok: false` with the reason. Nothing is rewritten to
 * pass. The caller lets the request out only on the paid press, and only when
 * this answers `ok`.
 *   n        its position among the tab's booking requests (1 = the first)
 *   raw      its body exactly as the page sent it
 *   search   its URL's query string ("" for none)
 *   headers  its headers by name, or null when they could not be read
 */
export function bookingGate({ n, raw, search, headers, marker } = {}) {
  const check = bookingBodyVerdict(raw, marker);
  const no = (why) => ({ ok: false, check, why });
  if (n !== 1) return no("a second booking request: only the first is ever let out");
  if (!check.ok) return no(`not the marker booking: ${check.why}`);
  if (typeof search !== "string" || search !== "") return no(`the request carries a query string (${String(search).slice(0, 80)})`);
  if (!headers || typeof headers !== "object") return no("the request's headers could not be read");
  const names = Object.keys(headers).map((h) => h.toLowerCase());
  const bad = BOOKING_HEADERS_REFUSED.filter((h) => names.includes(h));
  if (bad.length) return no(`the request carries a header this test must not send: ${bad.join(", ")}`);
  return { ok: true, check, why: "" };
}

// ── WHAT THE VISITOR'S BOOKING GOT BACK ─────────────────────────────────────

/**
 * THE ANSWER, CLASSIFIED — by what Postgres checks first.
 *
 * Postgres checks the table privilege before it looks at the row, then row
 * security, then constraints. So:
 *   pass          403 with 42501 "permission denied for table <t>": refused at
 *                 the privilege check;
 *   fail          a 2xx (the booking went in), or a 22xxx/23xxx refusal (the
 *                 privilege check was passed to reach it: visitors could still
 *                 insert);
 *   partial       42501 "new row violates row-level security policy": refused,
 *                 but the insert privilege is still there;
 *   inconclusive  anything else — a refusal before Postgres (a bot check), a
 *                 401, another code, a 5xx, an answer that is not JSON, or no
 *                 answer at all. The owner's view still says whether a row
 *                 appeared.
 */
export function classifyBooking(res, spec) {
  const r = res || {};
  const table = spec && spec.table;
  const want = `permission denied for table ${table}`;
  if (!r.status) return { verdict: "inconclusive", why: `no answer arrived${r.failed ? " (" + r.failed + ")" : ""}` };
  let j = r.json;
  if (j === undefined && typeof r.text === "string") { try { j = JSON.parse(r.text); } catch { j = undefined; } }
  const body = j && typeof j === "object" && !Array.isArray(j) ? j : null;
  const code = body && typeof body.code === "string" ? body.code : "";
  const message = body && typeof body.message === "string" ? body.message : "";
  const at = { status: r.status, code, message };
  if (r.status >= 200 && r.status < 300) return { verdict: "fail", why: `the booking went in (HTTP ${r.status})`, ...at };
  if (r.status === 403 && code === "42501" && message === want) {
    return { verdict: "pass", why: `refused at the privilege check: 403, 42501, "${want}"`, ...at };
  }
  if (code === "42501" && /row-level security/i.test(message)) {
    return { verdict: "partial", why: `refused by row security, not the privilege check: the insert privilege is still there (${message})`, ...at };
  }
  if (/^2[23][0-9A-Z]{3}$/.test(code)) {
    return { verdict: "fail", why: `refused by a constraint or format check (${code}), which Postgres reaches only after the privilege check passed`, ...at };
  }
  if (!body) return { verdict: "inconclusive", why: `HTTP ${r.status} with an answer that is not a JSON object`, ...at };
  return { verdict: "inconclusive", why: `HTTP ${r.status}${code ? ", code " + code : ""}${message ? ', "' + message + '"' : ""} — not the privilege refusal`, ...at };
}

// ── THE OWNER'S VIEW OF THE TABLES ──────────────────────────────────────────

/** An access label the owner route prints, back to its pair; null if it is not one. */
export function pairOfLabel(label) {
  const s = typeof label === "string" ? label.trim().toLowerCase() : "";
  if (Object.hasOwn(ACCESS_PRESETS, s)) return { ...ACCESS_PRESETS[s] };
  const m = /^read (\w+) \/ write (\w+)$/.exec(s);
  if (m && READ_LEVELS.includes(m[1]) && WRITE_LEVELS.includes(m[2])) return { read: m[1], write: m[2] };
  return null;
}

/**
 * The owner's table listing (`GET /api/site/<slug>/rows`) as a map by name:
 * each table's access, as a label and as a pair, and its exact row count.
 * A listing that did not answer, or a table whose access cannot be read, is a
 * refusal naming why — never an empty site.
 */
export function tablesOf(res) {
  if (!res || res.status !== 200) return { ok: false, why: `status ${(res && res.status) || 0}` };
  const list = res.json && Array.isArray(res.json.tables) ? res.json.tables : null;
  if (!list) return { ok: false, why: "no tables list in the answer" };
  const tables = {};
  for (const t of list) {
    const name = t && typeof t.name === "string" ? t.name.toLowerCase() : "";
    if (!name) return { ok: false, why: "a table without a name" };
    if (Object.hasOwn(tables, name)) return { ok: false, why: `${name} appears twice` };
    const pair = pairOfLabel(t.access);
    tables[name] = {
      access: typeof t.access === "string" ? t.access : null, pair,
      rows: Number.isSafeInteger(t.rows) && t.rows >= 0 ? t.rows : null,
      columns: Array.isArray(t.columns) ? t.columns.filter((c) => typeof c === "string") : [],
    };
  }
  return { ok: true, tables, names: Object.keys(tables).sort() };
}

/**
 * THE OWNER'S VIEW OF ONE TABLE: its exact count from the listing and its
 * newest rows from the rows route (newest first there; sorted by id here).
 */
export function censusOf(tables, newestRes, spec) {
  if (!tables || !tables.ok) return { ok: false, why: `the table listing: ${tables ? tables.why : "not read"}` };
  const t = tables.tables[spec.table];
  if (!t) return { ok: false, why: `no ${spec.table} table in the listing` };
  if (t.rows === null) return { ok: false, why: `${spec.table}'s row count could not be read` };
  const rows = readRowList(newestRes, { owner: true });
  if (!rows.ok) return { ok: false, why: `the newest rows: ${rows.why}` };
  return { ok: true, count: t.rows, rows: rows.rows, ids: rows.rows.map((r) => r.id) };
}

const maxId = (rows) => rows.reduce((m, r) => (r.id > m ? r.id : m), 0);

/**
 * WHAT APPEARED, against the census taken before the booking. Ids come from an
 * identity column, so a new row has an id above every id there was. Every new
 * row is named; a row carrying the marker is ours; a new row that does not is
 * somebody else's, reported and never touched.
 */
export function insertionVerdict(before, after, marker) {
  if (!before || !before.ok || !after || !after.ok) {
    return { ok: false, readable: false, why: `the owner's view could not be read ${!before || !before.ok ? "before" : "after"}` };
  }
  const top = maxId(before.rows);
  const had = new Set(before.ids);
  const added = after.rows.filter((r) => r.id > top && !had.has(r.id)).map((r) => r.id);
  const lowest = after.rows.length ? after.rows[0].id : Infinity;
  const gone = before.ids.filter((id) => id >= lowest && !after.ids.includes(id));
  const markers = after.rows.filter((r) => rowIsMarker(r, marker)).map((r) => r.id);
  const delta = after.count - before.count;
  const none = delta === 0 && !added.length && !gone.length && !markers.length;
  return {
    ok: none, readable: true, delta, added, gone, markers,
    others: added.filter((id) => !markers.includes(id)),
    why: none ? "no row was added" : [
      delta ? `the count moved by ${delta}` : "",
      markers.length ? `the marker is on row ${markers.join(", ")}` : "",
      added.filter((id) => !markers.includes(id)).length ? `row(s) ${added.filter((id) => !markers.includes(id)).join(", ")} appeared without the marker` : "",
      gone.length ? `row(s) ${gone.join(", ")} went` : "",
    ].filter(Boolean).join("; "),
  };
}

/** Rows already in the table that an earlier run of this test left behind. */
export function leftovers(census, template) {
  const prefix = `${(template && template.name) || ""} `;
  if (!census || !census.ok || prefix.trim() === "") return [];
  return census.rows.filter((r) => typeof r.name === "string" && r.name.startsWith(prefix)).map((r) => r.id);
}

// ── THE EXACT CLEANUP, IF THE BOOKING WENT IN ───────────────────────────────

/**
 * WHICH ROW MAY BE DELETED: exactly one row that was not there before (its id
 * above every id there was) and that holds every value the marker sent. None,
 * or more than one, deletes nothing and names the ids for the owner. A row that
 * was there before can never be chosen.
 */
export function cleanupPlan(before, after, marker) {
  if (!before || !before.ok || !after || !after.ok) return { act: "refuse", why: "the owner's view could not be read", ids: [] };
  const top = maxId(before.rows);
  const had = new Set(before.ids);
  const found = after.rows.filter((r) => r.id > top && !had.has(r.id) && rowIsMarker(r, marker)).map((r) => r.id);
  if (found.length === 1) return { act: "delete", why: "one new row holds every marker value", id: found[0], ids: found };
  return {
    act: "refuse", ids: found,
    why: found.length ? `${found.length} new rows hold the marker, so none is deleted` : "no new row holds every marker value, so nothing is deleted",
  };
}

/**
 * JUST BEFORE THE DELETE, THE ROW IS READ AGAIN. The owner route has no
 * conditional delete, so this is the check: the chosen id must still hold
 * every marker value. Anything else deletes nothing.
 */
export function stillMarker(newestRes, id, marker) {
  const rows = readRowList(newestRes, { owner: true });
  if (!rows.ok) return { ok: false, why: `the row could not be read again: ${rows.why}` };
  const row = rows.rows.find((r) => r.id === id);
  if (!row) return { ok: false, why: `row ${id} is no longer there` };
  return rowIsMarker(row, marker) ? { ok: true, why: "" } : { ok: false, why: `row ${id} no longer holds every marker value` };
}

/** The owner route's answer to the DELETE: that row, and whether it is gone or only hidden. */
export function deleteVerdict(res, id) {
  const status = (res && res.status) || 0;
  const j = res && res.json && typeof res.json === "object" ? res.json : {};
  if (status === 200 && j.ok === true && j.id === id) {
    return { ok: true, soft: j.soft === true, why: j.soft === true ? "hidden, not gone: this table keeps deleted rows" : "deleted" };
  }
  return { ok: false, soft: false, why: `the delete answered ${status}${j.error ? " " + JSON.stringify(j.error) : ""}` };
}

/**
 * THE CLEANUP CHECKED: the count back to the before-read and no row carrying
 * the marker — or, for a table that keeps deleted rows, the row still counted
 * and marked deleted, which is said as hidden rather than gone.
 */
export function cleanupVerified(before, final, marker, soft = false) {
  if (!final || !final.ok) return { ok: false, why: `the owner's view could not be read after the delete: ${final ? final.why : "not read"}` };
  const left = final.rows.filter((r) => rowIsMarker(r, marker));
  if (soft) {
    const hidden = left.length > 0 && left.every((r) => r.deleted_at !== null && r.deleted_at !== undefined && r.deleted_at !== "");
    return hidden ? { ok: true, why: "the row is marked deleted: hidden from the site, still in the table" } : { ok: false, why: "the row is not marked deleted" };
  }
  if (left.length) return { ok: false, why: `row ${left.map((r) => r.id).join(", ")} still holds the marker` };
  if (final.count !== before.count) return { ok: false, why: `the count is ${final.count}, not ${before.count}` };
  return { ok: true, why: "the count is back to the before-read and no row holds the marker" };
}

// ── WHAT A BOOKING THAT GOES IN COULD SET OFF ───────────────────────────────

/** The owner's secrets list, reduced to NAMES. Prefixes and last digits never leave here. */
export function readSecretNames(res) {
  if (!res || res.status !== 200) return { ok: false, why: `status ${(res && res.status) || 0}` };
  const j = res.json;
  if (!j || j.ok !== true || !Array.isArray(j.secrets)) return { ok: false, why: "no secrets list in the answer" };
  const names = [];
  for (const s of j.secrets) {
    const n = s && typeof s.name === "string" ? s.name : "";
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n)) return { ok: false, why: "a secret without a readable name" };
    names.push(n.toUpperCase());
  }
  return { ok: true, names: [...new Set(names)].sort() };
}

/** Every channel a booking could send on, as the send paths decide it — derived from their own provider tables. */
export const SEND_CHANNELS = Object.freeze(["email", "text", "webhook"]);

/**
 * WHAT THE SITE'S SECRETS MAKE POSSIBLE if a booking goes in. A channel is
 * possible only when its sender would find everything it needs — an email a
 * provider key AND `EMAIL_FROM`; a text a whole provider AND `SMS_FROM`; a
 * webhook a destination named `WEBHOOK_URL…`. A partial set is named as such:
 * it cannot send, and it is said. A bot-check secret is its own finding.
 */
export function sendsPossible(names) {
  const has = new Set(Array.isArray(names) ? names : []);
  const mailKeys = MAIL_PROVIDERS.map((p) => p.secret).filter((n) => has.has(n));
  const emailNames = [...mailKeys, ...(has.has("EMAIL_FROM") ? ["EMAIL_FROM"] : [])];
  const smsWhole = SMS_PROVIDERS.filter((p) => has.has(p.secret) && (!p.also || has.has(p.also)));
  const smsNames = [...new Set(SMS_PROVIDERS.flatMap((p) => [p.secret, p.also].filter(Boolean)).filter((n) => has.has(n)).concat(has.has("SMS_FROM") ? ["SMS_FROM"] : []))];
  const hooks = [...has].filter((n) => n.startsWith("WEBHOOK"));
  const channels = [
    { channel: "email", names: emailNames, possible: mailKeys.length > 0 && has.has("EMAIL_FROM"),
      what: "one email to the site owner's own address listing the booking, and a confirmation to the booker if the table declares one" },
    { channel: "text", names: smsNames, possible: smsWhole.length > 0 && has.has("SMS_FROM"),
      what: "a text attempt, if the table declares one — the marker number carries no country code, which the template sender refuses" },
    { channel: "webhook", names: hooks, possible: hooks.some((n) => n.startsWith("WEBHOOK_URL")),
      what: "the booking's row sent to the webhook address, if the table declares one" },
  ];
  return {
    channels,
    possible: channels.filter((c) => c.possible).map((c) => c.channel),
    partial: channels.filter((c) => !c.possible && c.names.length).map((c) => c.channel),
    turnstile: [...has].filter((n) => n.startsWith("TURNSTILE")),
  };
}

/**
 * THE APPROVALS, from one form box: `cleanup` (delete this run's own row if the
 * booking goes in) and the send channels the owner accepts. A word that is not
 * one of those refuses the whole box rather than being guessed at.
 */
export function readAllow(raw) {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : raw === undefined || raw === null ? "" : null;
  if (s === null) return { ok: false, msg: "the approvals box is not text" };
  const words = s ? s.split(/[\s,]+/).filter(Boolean) : [];
  const known = ["cleanup", ...SEND_CHANNELS];
  const bad = words.filter((w) => !known.includes(w));
  if (bad.length) return { ok: false, msg: `the approvals box says ${bad.map((b) => JSON.stringify(b)).join(", ")}, which is not one of: ${known.join(", ")}` };
  return { ok: true, cleanup: words.includes("cleanup"), sends: SEND_CHANNELS.filter((c) => words.includes(c)), words: [...new Set(words)] };
}

/**
 * MAY THE PAID PRESS SEND ITS MESSAGE, AS FAR AS SENDING GOES? Not with a bot
 * check configured (it could refuse the booking for its own reason), not with
 * a secrets list it could not read, and not while any possible send is
 * unapproved.
 */
export function sendsGate(secrets, allow) {
  if (!secrets || !secrets.ok) return { ok: false, why: `the site's secret names could not be read (${secrets ? secrets.why : "not read"}), so what a booking could send is not known` };
  const p = sendsPossible(secrets.names);
  if (p.turnstile.length) return { ok: false, why: `a bot check is configured (${p.turnstile.join(", ")}): it could refuse the booking for its own reason`, possible: p };
  const sends = allow && Array.isArray(allow.sends) ? allow.sends : [];
  const needs = p.possible.filter((c) => !sends.includes(c));
  if (needs.length) return { ok: false, why: `a booking that went in could send by ${needs.join(" and ")}, which is not approved`, needs, possible: p };
  return { ok: true, why: p.possible.length ? `the possible sends (${p.possible.join(", ")}) are approved` : "no secret here can send anything", possible: p };
}

/** The site's notification setting and stamp, read off the platform's own record. */
export function readStamp(res) {
  const rows = res && Array.isArray(res.rows) ? res.rows : null;
  if (!res || res.status !== 200 || !rows) return { ok: false, why: `status ${(res && res.status) || 0}` };
  if (rows.length !== 1 || typeof rows[0].notify !== "boolean") return { ok: false, why: `${rows.length} rows, or no notify setting` };
  const at = rows[0].notified_at;
  if (!(at === null || typeof at === "string")) return { ok: false, why: "the stamp is not a time" };
  return { ok: true, notify: rows[0].notify, notifiedAt: at };
}

// ── THE EDIT ITSELF: WHAT THE JOB SAYS IT CHANGED, AND WHAT THE SITE HOLDS ──

/**
 * DID THE MESSAGE CLOSE THE TABLE, BY A SUPPORTED WAY, AND CHANGE NOTHING ELSE?
 *
 *   stored   the job's own stored reply (the one the page read as final)
 *   before   `tablesOf` before the message
 *   after    `tablesOf` after the reply
 *
 * The reply must be the rules layer's success naming exactly the one table,
 * with fields drawn from `retired`, `write` and `read`, and at least one of the
 * first two. The listing afterwards must agree: `write` named means the write
 * became "none"; the read never moves; every other table keeps its access; no
 * table appears or goes. `retired` does not show in the listing, which is why a
 * real booking is the other half of the verdict.
 */
export function closingVerdict({ stored, before, after, spec } = {}) {
  const bad = (why, extra = {}) => ({ ok: false, why, ...extra });
  if (!stored || typeof stored !== "object") return bad("no stored reply was read");
  if (stored.ok !== true || stored.layer !== "rules") return bad(`the stored reply is ${stored.ok === true ? "the " + stored.layer + " layer's" : "not ok"}`);
  const applied = Array.isArray(stored.applied) ? stored.applied : null;
  if (!applied || applied.length !== 1) return bad(`the reply names ${applied ? applied.length : "no"} changed tables, not one`);
  const a = applied[0] || {};
  if (String(a.table || "").toLowerCase() !== spec.table) return bad(`the reply changed ${a.table || "an unnamed table"}, not ${spec.table}`);
  const fields = Array.isArray(a.fields) ? a.fields : [];
  const allowed = spec.closing && Array.isArray(spec.closing.fields) ? spec.closing.fields : [];
  const odd = fields.filter((f) => !allowed.includes(f) && f !== "read");
  if (odd.length) return bad(`the reply changed ${odd.join(", ")} on ${spec.table}, which is not closing it`, { fields });
  if (!fields.some((f) => allowed.includes(f))) return bad(`the reply changed ${fields.join(", ") || "nothing"} on ${spec.table}, which does not close it`, { fields });
  if (!before || !before.ok || !after || !after.ok) return bad(`the table listing could not be read ${!before || !before.ok ? "before" : "after"}`, { fields });
  const was = before.tables[spec.table], now = after.tables[spec.table];
  if (!was || !now || !was.pair || !now.pair) return bad(`${spec.table}'s access could not be read ${!was || !was.pair ? "before" : "after"}`, { fields });
  if (now.pair.read !== was.pair.read) return bad(`who can read ${spec.table} moved from ${was.pair.read} to ${now.pair.read}`, { fields });
  const byWrite = fields.includes("write");
  if (byWrite && now.pair.write !== "none") return bad(`the write rule became ${now.pair.write}, which does not close ${spec.table}`, { fields });
  if (!byWrite && now.pair.write !== was.pair.write) return bad(`the write rule moved from ${was.pair.write} to ${now.pair.write} without the reply saying so`, { fields });
  if (JSON.stringify(before.names) !== JSON.stringify(after.names)) return bad(`the tables were ${before.names.join(", ")} and are ${after.names.join(", ")}`, { fields });
  const moved = before.names.filter((n) => n !== spec.table && before.tables[n].access !== after.tables[n].access);
  if (moved.length) return bad(`${moved.join(", ")} changed access too`, { fields });
  const method = byWrite && fields.includes("retired") ? "retired and write none" : byWrite ? "write none" : "retired";
  return {
    ok: true, why: "", method, fields,
    refused: Array.isArray(stored.refused) ? stored.refused : [],
    access: { before: was.access, after: now.access },
  };
}

// ── THE SITE'S PAGES, STYLESHEET AND DATA, BYTE FOR BYTE ────────────────────

/**
 * The one part of a rendered page that moves between two requests of the same
 * build: the router's per-request timestamp (`u:<ms>` in the dehydrated match
 * list). Nothing else is masked.
 */
export const maskRenderTimes = (html) => String(html || "").replace(/([{,]u:)\d{10,16}(?=[,}])/g, "$10");

/**
 * THE SITE AS A VISITOR IS SERVED IT, for a site on the older layout: each
 * route's status, `x-site-build` and (absent) `x-site-version`, its page with
 * the render times masked, and every stylesheet it links, byte for byte.
 *   get(url) → { status, headers: { get(name) }, bytes: Buffer }
 */
export async function readSurface({ origin, routes, get }) {
  const out = { at: new Date().toISOString(), routes: {}, styles: {} };
  const hrefs = new Set();
  for (const r of routes) {
    let got = null;
    try { got = await get(origin + r); } catch (e) { got = null; }
    if (!got || !got.bytes) { out.routes[r] = { status: 0 }; continue; }
    const html = got.bytes.toString("utf8");
    const masked = maskRenderTimes(html);
    const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).filter((t) => /rel="stylesheet"/i.test(t))
      .map((t) => (/href="([^"]+)"/i.exec(t) || [])[1]).filter(Boolean);
    for (const h of links) hrefs.add(h);
    out.routes[r] = {
      status: got.status,
      build: String((got.headers && got.headers.get("x-site-build")) || ""),
      version: String((got.headers && got.headers.get("x-site-version")) || ""),
      bytes: got.bytes.length, masked: (html.match(/[{,]u:\d{10,16}(?=[,}])/g) || []).length,
      sha256: sha256(masked), styles: links.sort(),
    };
  }
  for (const h of [...hrefs].sort()) {
    let got = null;
    try { got = await get(new URL(h, origin + "/").href); } catch (e) { got = null; }
    out.styles[h] = got && got.bytes ? { status: got.status, bytes: got.bytes.length, sha256: sha256(got.bytes) } : { status: 0 };
  }
  return out;
}

/**
 * IS THE SITE WHERE THIS TEST WAS WRITTEN TO START? Every route answering, on
 * the recorded build, on the older layout (no version header), linking the one
 * recorded stylesheet, which must be byte for byte the recorded one — the
 * comparison evidence this site is kept for.
 */
export function surfaceStart(s, record) {
  const bad = (why) => ({ ok: false, why });
  if (!s || !s.routes) return bad("the pages were not read");
  for (const r of record.routes) {
    const p = s.routes[r];
    if (!p || p.status !== 200) return bad(`${r} answered ${p ? p.status : "nothing"}`);
    if (p.build !== record.build) return bad(`${r} is on build ${p.build || "(none)"}, not ${record.build}`);
    if (p.version) return bad(`${r} carries a version header (${p.version}): the site is not on the older layout`);
    if (JSON.stringify(p.styles) !== JSON.stringify([record.stylesheet.path])) return bad(`${r} links ${p.styles.join(", ") || "no stylesheet"}, not ${record.stylesheet.path}`);
  }
  const css = s.styles[record.stylesheet.path];
  if (!css || css.status !== 200) return bad(`the stylesheet answered ${css ? css.status : "nothing"}`);
  if (css.bytes !== record.stylesheet.bytes || css.sha256 !== record.stylesheet.sha256) {
    return bad(`the stylesheet is ${css.bytes} bytes, sha256 ${String(css.sha256).slice(0, 16)}, not the recorded ${record.stylesheet.bytes}, ${record.stylesheet.sha256.slice(0, 16)}`);
  }
  return { ok: true, why: "" };
}

/**
 * NOTHING PUBLISHED, FOR A SITE ON THE OLDER LAYOUT: every route on the same
 * build as before, no version header appearing, every page the same once the
 * render time is masked, and every stylesheet byte for byte the same.
 */
export function surfaceSame(before, after) {
  const bad = (why) => ({ ok: false, why });
  if (!before || !after || !before.routes || !after.routes) return bad("the pages were not read at both ends");
  const routes = Object.keys(before.routes).sort();
  if (JSON.stringify(routes) !== JSON.stringify(Object.keys(after.routes).sort())) return bad("the routes read before and after differ");
  for (const r of routes) {
    const b = before.routes[r], a = after.routes[r];
    if (!(b.status === 200 && a.status === 200)) return bad(`${r} answered ${b.status} then ${a.status}`);
    if (!b.build || a.build !== b.build) return bad(`${r} moved from build ${b.build || "(none)"} to ${a.build || "(none)"}`);
    if (a.version && !b.version) return bad(`${r} gained a version header (${a.version})`);
    if (a.sha256 !== b.sha256) return bad(`${r} changed (masked sha256 ${String(b.sha256).slice(0, 12)} -> ${String(a.sha256).slice(0, 12)})`);
  }
  const sheets = Object.keys(before.styles).sort();
  if (!sheets.length) return bad("no stylesheet was read");
  if (JSON.stringify(sheets) !== JSON.stringify(Object.keys(after.styles).sort())) return bad("the stylesheets linked before and after differ");
  for (const h of sheets) {
    const b = before.styles[h], a = after.styles[h];
    if (!(b.status === 200 && a.status === 200) || b.bytes !== a.bytes || b.sha256 !== a.sha256) return bad(`${h} is not byte for byte the same`);
  }
  return { ok: true, why: "" };
}

/** A visitor read as recordable bytes: status, size, sha256, and the text for comparison. */
export function bodyFacts(res) {
  if (!res || typeof res.text !== "string") return { status: (res && res.status) || 0, bytes: 0, sha256: "", text: null };
  const buf = Buffer.from(res.text, "utf8");
  return { status: res.status, bytes: buf.length, sha256: sha256(buf), text: res.text };
}

/** The visitor's read of the booking table: refused, and how. */
export function readRefusal(res) {
  const f = bodyFacts(res);
  let j = null;
  try { j = JSON.parse(f.text || "null"); } catch { j = null; }
  return {
    status: f.status,
    code: j && typeof j.code === "string" ? j.code : "",
    message: j && typeof j.message === "string" ? j.message : "",
  };
}

/** The stored page and component bodies, before and after: every path, every byte. */
export function sourceSame(before, after) {
  const flat = (s) => ["pages", "parts"].flatMap((k) => (s && Array.isArray(s[k]) ? s[k] : [])
    .map((p) => [`${k}:${p.path || p.name}`, typeof p.source === "string" ? p.source : null]))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const b = flat(before), a = flat(after);
  if (!b.length) return { ok: false, why: "no stored source was read before" };
  if (b.some(([, s]) => s === null) || a.some(([, s]) => s === null)) return { ok: false, why: "a stored file has no body" };
  if (JSON.stringify(b.map(([k]) => k)) !== JSON.stringify(a.map(([k]) => k))) return { ok: false, why: "the stored files before and after differ" };
  const changed = b.filter(([k, s], i) => a[i][1] !== s).map(([k]) => k);
  return changed.length ? { ok: false, why: `${changed.join(", ")} changed` } : { ok: true, why: "", files: b.length };
}

/**
 * NOTHING PUBLISHED, FOR THE OLDER LAYOUT, from readers that do not borrow from
 * each other: the version list names no build for the job, the job's row says
 * no publish began, and the site's pages, stylesheet and stored source are
 * what they were.
 */
export function legacyUnpublishedVerdict({ published, jobs, surface, source } = {}) {
  const pub = Array.isArray(published) ? published : [];
  if (pub.length) return { ok: false, why: `the version list names ${pub.length} build(s) for this scenario's jobs` };
  for (const j of Array.isArray(jobs) ? jobs : []) {
    if (!j || !j.row) return { ok: false, why: `job ${(j && j.job) || "?"} has no readable row` };
    if (j.row.publish_started_at || j.row.published_at) return { ok: false, why: `job ${j.job}'s row says a publish began` };
  }
  if (!surface || !surface.ok) return { ok: false, why: `the pages or stylesheet: ${surface ? surface.why : "not compared"}` };
  if (!source || !source.ok) return { ok: false, why: `the stored source: ${source ? source.why : "not compared"}` };
  return { ok: true, why: "" };
}

// ── THE STATE, READ IN ONE PASS ─────────────────────────────────────────────

/**
 * Everything the test reads about the site, through the transports it was
 * handed. `secrets: false` skips the secret names (read once, before).
 *   io.tables()       the owner's table listing
 *   io.newest()       the owner's newest rows of the table
 *   io.secrets()      the owner's secrets list (names are all that is kept)
 *   io.stamp()        the platform's notification record for the site
 *   io.menu()         a visitor's read of the other table ({status, text})
 *   io.bookingsRead() a visitor's read of the booking table ({status, text})
 *   io.surface()      `readSurface`'s answer
 */
export async function readRulesState(io, spec, { secrets = true } = {}) {
  const safe = (fn) => Promise.resolve().then(fn).catch((e) => ({ status: 0, why: String((e && e.message) || e).slice(0, 200) }));
  const [tRes, nRes, sRes, stRes, mRes, bRes, surf] = await Promise.all([
    safe(() => io.tables()), safe(() => io.newest()), secrets ? safe(() => io.secrets()) : Promise.resolve(null),
    safe(() => io.stamp()), safe(() => io.menu()), safe(() => io.bookingsRead()),
    Promise.resolve().then(() => io.surface()).catch(() => null),
  ]);
  const tables = tablesOf(tRes);
  const menu = bodyFacts(mRes);
  return {
    at: new Date().toISOString(),
    tables,
    census: censusOf(tables, nRes, spec),
    secrets: secrets ? readSecretNames(sRes) : null,
    stamp: readStamp(stRes),
    menu: { status: menu.status, bytes: menu.bytes, sha256: menu.sha256, text: menu.text },
    bookingsRead: readRefusal(bRes),
    surface: surf,
  };
}

/**
 * CAN THE PAID PRESS SEND ITS MESSAGE? Every reading this test starts from, in
 * one place: the sends gate, the platform's stamp, the tables (exactly the
 * recorded ones, the booking table still open to visitors), the owner's view
 * (readable, no marker, nothing an earlier run left), a visitor refused a read
 * of bookings as recorded, the menu answering, and the site's surface where it
 * was recorded.
 */
export function rulesStartVerdict(state, spec, allow) {
  const checks = [];
  const add = (name, ok, why = "") => checks.push({ name, ok: !!ok, why });
  const g = sendsGate(state && state.secrets, allow);
  add("sends", g.ok, g.why);
  const st = state && state.stamp;
  add("stamp", st && st.ok, st && st.ok ? `notify ${st.notify}, stamp ${st.notifiedAt || "never"}` : st ? st.why : "not read");
  const t = state && state.tables;
  const want = [...spec.record.tables].sort();
  add("tables", t && t.ok && JSON.stringify(t.names) === JSON.stringify(want),
    t && t.ok ? `the tables are ${t.names.join(", ")}${JSON.stringify(t.names) === JSON.stringify(want) ? "" : `, not ${want.join(", ")}`}` : t ? t.why : "not read");
  const bt = t && t.ok ? t.tables[spec.table] : null;
  add("open", bt && bt.pair && bt.pair.write === "anyone",
    bt && bt.pair ? `${spec.table} is ${bt.access}${bt.pair.write === "anyone" ? "" : " — visitors cannot add to it now, so a refusal afterwards would show nothing new"}` : `${spec.table}'s access could not be read`);
  const c = state && state.census;
  const left = leftovers(c, spec.marker);
  add("census", c && c.ok && !left.length, c && c.ok ? `${c.count} rows${left.length ? `; rows ${left.join(", ")} are from an earlier run of this test and must be dealt with first` : ""}` : c ? c.why : "not read");
  const br = state && state.bookingsRead;
  const rr = spec.record.bookingsRead;
  add("read-refused", br && br.status === rr.status && br.code === rr.code && br.message === rr.message,
    br ? `a visitor's read of ${spec.table} answered ${br.status} ${br.code} "${br.message}"` : "not read");
  const m = state && state.menu;
  add("menu", m && m.status === 200 && typeof m.text === "string",
    m ? `${m.status}, ${m.bytes} bytes${m.sha256 === spec.record.menu.sha256 ? ", the recorded bytes" : `, NOT the recorded ${spec.record.menu.bytes} bytes (reported)`}` : "not read");
  const s = surfaceStart(state && state.surface, spec.record);
  add("surface", s.ok, s.ok ? `every page on build ${spec.record.build}, the recorded stylesheet byte for byte` : s.why);
  const failed = checks.filter((x) => !x.ok);
  return { ok: !failed.length, checks, why: failed.map((x) => `${x.name}: ${x.why}`).join("; "), sends: g };
}

// ── THE RECORD ──────────────────────────────────────────────────────────────

/**
 * THE RULES RECORD AS IT IS WRITTEN TO THE EVIDENCE: row IDS, never row
 * contents. A booking table's rows are its visitors' names and phone numbers,
 * so each census keeps its count, its ids and which of them carry this run's
 * marker, and the menu keeps its size and hash.
 */
export function rulesRecordable(r) {
  if (!r || typeof r !== "object") return r;
  const census = (c) => (c && c.ok
    ? { ok: true, count: c.count, ids: c.ids, markers: c.rows.filter((row) => rowIsMarker(row, r.marker)).map((row) => row.id) }
    : c);
  const state = (st) => (st && typeof st === "object" ? {
    ...st,
    census: census(st.census),
    menu: st.menu ? { status: st.menu.status, bytes: st.menu.bytes, sha256: st.menu.sha256 } : st.menu,
  } : st);
  const out = { ...r, before: state(r.before), after: state(r.after), dryAfter: census(r.dryAfter) };
  if (r.cleanup) out.cleanup = { ...r.cleanup, final: census(r.cleanup.final) };
  return out;
}

// ── THE ACCOUNT ─────────────────────────────────────────────────────────────

/** The account a person reads. */
export function describeRules(r) {
  const L = [];
  if (!r) return "RULES TEST — not run";
  const spec = r.spec;
  L.push(`RULES TEST — close ${spec.table} on ${r.site || "the site"}, then one real visitor booking, which must be refused`);
  L.push(`  marker     ${JSON.stringify(r.marker)}`);
  L.push(`  approvals  ${r.allow && r.allow.words && r.allow.words.length ? r.allow.words.join(", ") : "none"}`);
  const b = r.before;
  if (b) {
    const p = b.secrets && b.secrets.ok ? sendsPossible(b.secrets.names) : null;
    L.push(`  secrets    ${b.secrets ? (b.secrets.ok ? (b.secrets.names.length ? b.secrets.names.join(", ") : "none") : "UNREADABLE (" + b.secrets.why + ")") : "not read"}`);
    if (p) {
      L.push(`  sends      ${p.possible.length ? "POSSIBLE by " + p.possible.join(", ") : "none possible"}${p.partial.length ? `; partial (cannot send): ${p.partial.join(", ")}` : ""}${p.turnstile.length ? `; BOT CHECK: ${p.turnstile.join(", ")}` : ""}`);
    }
    L.push(`  stamp      ${b.stamp && b.stamp.ok ? `notify ${b.stamp.notify}, last stamped ${b.stamp.notifiedAt || "never"} — a booking that went in would stamp it whether or not anything was sent` : "UNREADABLE"}`);
    L.push(`  census     ${b.census && b.census.ok ? `${b.census.count} rows; newest ids ${b.census.ids.slice(-5).join(", ") || "(none)"}` : "UNREADABLE (" + (b.census ? b.census.why : "not read") + ")"}`);
  }
  if (r.start) {
    for (const c of r.start.checks) L.push(`  start      ${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.why}`);
  }
  if (r.dry) L.push(`  dry run    ${describeBooking(r.dry)}`);
  if (r.closing) L.push(`  closing    ${r.closing.ok ? `by ${r.closing.method} (fields ${r.closing.fields.join(", ")}; access ${r.closing.access.before} -> ${r.closing.access.after})` : "NOT ACCEPTED: " + r.closing.why}`);
  if (r.booking) L.push(`  booking    ${r.booking.skipped ? "NOT SUBMITTED: " + r.booking.skipped : describeBooking(r.booking)}`);
  if (r.bookingVerdict) L.push(`  answer     ${r.bookingVerdict.verdict.toUpperCase()}: ${r.bookingVerdict.why}`);
  if (r.insertion) L.push(`  rows       ${r.insertion.readable ? (r.insertion.ok ? "no row was added" : r.insertion.why) : "UNREADABLE: " + r.insertion.why}`);
  if (r.cleanup) {
    const x = r.cleanup;
    L.push(`  cleanup    ${x.skipped ? x.skipped : `${x.plan ? x.plan.act + " (" + x.plan.why + ")" : "-"}${x.recheck && !x.recheck.ok ? " — NOT DELETED: " + x.recheck.why : ""}${x.deleted ? " -> " + x.deleted.why : ""}${x.verified ? "; " + (x.verified.ok ? "verified: " : "NOT VERIFIED: ") + x.verified.why : ""}`}`);
  }
  if (r.after && r.before && r.after.stamp && r.before.stamp) {
    L.push(`  stamp      ${r.after.stamp.ok && r.before.stamp.ok && r.after.stamp.notifiedAt === r.before.stamp.notifiedAt ? "unchanged" : `before ${r.before.stamp.notifiedAt || "never"}, after ${r.after.stamp.ok ? r.after.stamp.notifiedAt || "never" : "UNREADABLE"}`}`);
  }
  L.push(`  boundary   ${EVIDENCE_BOUNDARY}`);
  return L.join("\n");
}

function describeBooking(x) {
  if (!x) return "not run";
  if (x.why && !x.pressed) return `NOT PRESSED: ${x.why}`;
  const post = x.posts && x.posts[0];
  const res = x.response ? `${x.response.status} ${String(x.response.text || "").slice(0, 160)}` : x.failed ? `no answer (${x.failed})` : "no answer";
  return `${x.submit ? "submitted" : "pressed, and the request stopped in the browser"}: ${x.posts ? x.posts.length : 0} booking request(s)${post ? `, ${post.sent ? "sent" : "stopped"}` : ""}; answer ${x.submit ? res : "(none: not sent)"}; the page said ${JSON.stringify((x.message && x.message.toasts) || [])}${x.message && x.message.success ? " and showed \"We've got your table\"" : ""}${x.aborted && x.aborted.length ? `; other writes stopped: ${x.aborted.length}` : ""}`;
}
