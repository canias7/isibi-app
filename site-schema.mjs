// The schema engine: an isibi.schema.json declaration becomes real Postgres
// tables, indexes, constraints and triggers.
//
// This is where unique / noOverlap / sequence / trash actually live. NOTE
// (2026-07-28): publicView / teamRead / transitions / sla are parsed and stored
// here and enforced NOWHERE — their only appearance below is the norm.push that
// copies them into _meta. Same for mask (whose maskFields() is written and never
// called), fieldRoles, webhooks, geo, currency, formulas, roundRobin, assignBy,
// searchWeights, jsonShapes, checks, computed and defaultSort. This header used
// to claim otherwise. Do not assume a declared feature does anything without
// finding its DDL.
// Historical wording follows: unique / noOverlap / publicView / teamRead / transitions /
// sequence / sla / trash actually live, so a generator that emits a schema file
// gets all of it without knowing how any of it is implemented.
//
// `db` throughout is a Neon connection string (see ./site-db.mjs).
import { sqlQuery, sqlQuery as realSqlQuery } from "./site-db.mjs";
import { policiesFor, grantsFor, publicViewSql, functionSql, SESSION_JWT_EXT, SESSION_JWT_GRANTS, APP_TEAM_FN, APP_USER_FN_NATIVE, APP_USER_FN_FALLBACK } from "./site-rls.mjs";
import { normalizePayment, PAYMENT_COLUMNS } from "./site-payments.mjs";
import { resolveAccess } from "./site-access.mjs";
import { normalizeConfirm } from "./site-mail.mjs";
import { normalizeSms } from "./site-sms.mjs";
import { normalizeJob } from "./site-jobs.mjs";
import { normalizeApi } from "./site-apis.mjs";
import { isManagedColumn } from "./site-access.mjs";
import { makeCache } from "./ttl-cache.mjs";

const SAFE_IDENT = /^[a-z_][a-z0-9_]{0,40}$/i;

export function sqlIdent(name) { if (!SAFE_IDENT.test(String(name || ""))) throw Object.assign(new Error("bad identifier: " + name), { bad: true }); return '"' + name + '"'; }

// SQLite let a trigger carry its body inline (CREATE TRIGGER … BEGIN … END).
// Postgres does not: every trigger is a function plus a trigger that calls it.
// This emits both, and is idempotent — CREATE OR REPLACE on the function, and a
// DROP before the trigger — so re-applying a schema is safe the way it was before.
//
// `body` is plpgsql and may use NEW/OLD. BEFORE triggers return NEW so the row
// they edited is what gets written; AFTER triggers return NULL (ignored).
// Bodies are dollar-quoted and carry no bound parameters.

// The default for a team-scoped row's `team_id`. Written once because the CREATE
// and the revise-path ALTER must agree byte for byte: a column created with one
// default and altered to a different one is a table whose behaviour depends on
// when it was built, which is the class of bug `ADD COLUMN IF NOT EXISTS` not
// changing a type already caused here.
//
// The regex is what makes the cast safe. `app_team_id()` returns text, and a bare
// `::uuid` on anything else THROWS — every write to a team table would fail. This
// way a value that is not uuid-shaped becomes NULL: the row is simply not shared,
// which is the failure the owner can live with. `~*`, because a uuid may arrive
// uppercased.
const TEAM_DEFAULT = "(CASE WHEN app_team_id() ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN app_team_id()::uuid END)";

const PG_TYPES = { text: "TEXT", string: "TEXT", integer: "INTEGER", int: "INTEGER", real: "REAL", float: "REAL", number: "REAL", numeric: "NUMERIC", blob: "BYTEA", boolean: "INTEGER", bool: "INTEGER", json: "TEXT", array: "TEXT", object: "TEXT" };
// JSON/array columns store as TEXT: an object/array value is JSON-stringified on write
// and re-parsed on read, so an app can keep nested/flexible data in one column.

function slaMinutes(v) {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  const s = String(v == null ? "" : v).trim().toLowerCase();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]); const u = m[2] || "min";
  const mult = u[0] === "w" ? 10080 : u[0] === "d" ? 1440 : u[0] === "h" ? 60 : 1;
  const mins = Math.floor(n * mult);
  return mins > 0 ? mins : 0;
}
// SLA / time-based deadlines — a table declaring `sla:{start,mins,done}` gets a read-time `_sla`
// on each row describing its deadline and whether it's overdue. The clock runs from `start` (a date
// column, default created_at) for `mins` minutes; if the row's `done` status column holds a
// stop value the clock is MET (never overdue). Pure read-time (no cron) — powers "overdue" badges,
// urgency sorting, and the /overdue queue (which computes the same thing in SQL for filtering).

function slugify(s) {
  return String(s == null ? "" : s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// `maskFields()` LIVED HERE and was deleted 2026-08-04 along with `mask` in the
// designer tool. Not a gap to fill back in — see the note at the tool for why it
// cannot be enforced from here any more: the Worker left the read path when
// `site-data.mjs` went on 2026-07-30, and the roles `mask` names are ours rather
// than Postgres's. It sat with zero callers in between, while the tool went on
// promising redaction, so a table declaring it served the raw value to everyone.
//
// Restoring it means building the enforcement first;
// test/declarable-enforced.test.mjs fails if the declaration comes back alone.

export function normalizeSchema(spec) {
  if (!spec || typeof spec !== "object") return { tables: [] };
  const out = [];
  const coerceCol = (c) => {
    if (typeof c === "string") return { name: c, type: "text" };
    if (c && typeof c === "object" && c.name) return { name: c.name, type: c.type || c.dataType || "text", pk: c.pk || c.primary, notnull: c.notnull || c.required || c.notNull, unique: c.unique, ref: c.ref || c.references || c.foreignKey || c.fk, max: (c.max !== undefined ? c.max : (c.maxLength !== undefined ? c.maxLength : c.maxlength)), min: (c.min !== undefined ? c.min : c.minLength), format: c.format, enum: c.enum || c.oneOf || c.values, pattern: c.pattern || c.regex, default: (c.default !== undefined ? c.default : c.defaultValue), immutable: !!(c.immutable || c.readonly || c.readOnly || c.writeOnce), onDelete: (() => { const m = String(c.onDelete || c.on_delete || c.onDeleteAction || "").toLowerCase().replace(/[^a-z]/g, ""); return (m === "setnull" || m === "cascade" || m === "restrict") ? m : null; })() };
    return null;
  };
  const coerceTable = (name, def) => {
    if (!name || !def || typeof def !== "object") return;
    const access = ["collect", "display", "user", "feed", "admin"].includes(def.access) ? def.access : "collect";
    const src = def.columns || def.fields || def.cols || def.schema;
    let cols = [];
    if (Array.isArray(src)) cols = src.map(coerceCol);
    else if (src && typeof src === "object") cols = Object.entries(src).map(([n, ty]) => ({ name: n, type: (typeof ty === "string" ? ty : (ty && (ty.type || ty.dataType)) || "text") }));
    // A payable table's payment columns are dropped from the DECLARED list, not
    // only from the DDL, and the difference matters. The DDL filter stops a
    // CREATE TABLE collision; this one stops the column reaching `_meta` and
    // therefore `schemaDigest`, which prints every declared column with no
    // managed filter — so a declared `payment_status` would be described to the
    // generator as an ordinary field and end up on the checkout form, where the
    // customer sets whether their own order is paid.
    if (normalizePayment(def)) cols = cols.filter((c) => c && c.name && !PAYMENT_COLUMNS.includes(String(c.name).toLowerCase()));
    // READ AND WRITE SURVIVE THE ALLOW-LIST. `coerceTable` builds its output
    // field by field, so anything not named here is dropped SILENTLY on every
    // build — the way `teamScope` was for months. Carried through UNNORMALISED
    // and undefined when absent, because `resolveAccess` is the one place that
    // decides what a missing or unrecognised half means, and a second opinion
    // here is how the two start disagreeing.
    out.push({ name, access, read: def.read, write: def.write, columns: cols.filter(Boolean), unique: def.unique, oncePerUser: def.oncePerUser || def.uniquePerUser || def.oncePer, retired: retiredOf(def), trash: !!(def.trash || def.softDelete || def.soft), slug: def.slug || def.slugFrom || def.slugify, writeRoles: def.writeRoles || def.write_roles || def.editorRoles, version: !!(def.version || def.optimisticLock || def.concurrency), timestamps: !!(def.timestamps || def.updatedAt || def.updated_at || def.timestamp), ordered: !!(def.ordered || def.position || def.sortable || def.reorderable), expires: !!(def.expires || def.ttl || def.expiry || def.expiring), pinnable: !!(def.pinnable || def.pinned || def.featurable || def.sticky), defaultSort: (() => { const s = def.defaultSort || def.default_sort || def.orderBy || def.order_by; return (typeof s === "string" && /^[-+a-z0-9_,\s]{1,80}$/i.test(s)) ? s : null; })(), scheduled: !!(def.publishable || def.scheduled || def.publishAt || def.publish_at || def.scheduling), uniqueCI: def.uniqueCI || def.uniqueCaseInsensitive || def.ciUnique || null, maxRows: (() => { const n = parseInt(def.maxRows != null ? def.maxRows : (def.max_rows != null ? def.max_rows : (def.rowLimit != null ? def.rowLimit : def.cap)), 10); return (Number.isFinite(n) && n > 0) ? Math.min(n, 10000000) : 0; })(), checks: (() => { const raw = def.checks || def.validate || def.constraints; if (!Array.isArray(raw)) return null; const OPS = new Set(["gt", "gte", "lt", "lte", "eq", "ne"]); const out = []; for (const ch of raw) { if (!Array.isArray(ch) || ch.length < 3) continue; const a = String(ch[0]).toLowerCase(), op = String(ch[1]).toLowerCase(), b = String(ch[2]).toLowerCase(); if (/^[a-z0-9_]{1,40}$/.test(a) && OPS.has(op) && /^[a-z0-9_]{1,40}$/.test(b)) out.push([a, op, b]); } return out.length ? out.slice(0, 12) : null; })(), enforceRefs: !!(def.enforceRefs || def.refIntegrity || def.strictRefs), computed: (() => { const src = def.computed || def.derived || def.virtual; if (!src || typeof src !== "object" || Array.isArray(src)) return null; const out = {}; for (const [name, tpl] of Object.entries(src)) { if (!/^[a-z0-9_]{1,40}$/i.test(name)) continue; const arr = Array.isArray(tpl) ? tpl : (typeof tpl === "string" ? [tpl] : null); if (!arr) continue; const toks = arr.filter((x) => typeof x === "string" && x.length <= 60).slice(0, 8); if (toks.length) out[name.toLowerCase()] = toks; } return Object.keys(out).length ? out : null; })(), requireVerified: !!(def.requireVerified || def.verifiedOnly || def.emailVerified), audit: !!(def.audit || def.auditLog || def.changelog), history: !!(def.history || def.versions || def.snapshots || def.revisions), archivable: !!(def.archivable || def.archive), sync: !!(def.sync || def.syncable || def.offline), searchWeights: (() => { const w = def.searchWeights || def.searchRank || def.searchBoost; if (!w || typeof w !== "object" || Array.isArray(w)) return null; const out = {}; for (const [k, v] of Object.entries(w)) { const n = Number(v); if (/^[a-z0-9_]{1,40}$/i.test(k) && Number.isFinite(n) && n > 0) out[k.toLowerCase()] = Math.min(n, 100); } return Object.keys(out).length ? out : null; })(), rateLimit: (() => { const n = parseInt(def.rateLimit != null ? def.rateLimit : (def.writeLimit != null ? def.writeLimit : (def.throttle != null ? def.throttle : def.maxPerMinute)), 10); return (Number.isFinite(n) && n > 0) ? Math.min(n, 10000) : 0; })(), geo: (() => { const g = def.geo || def.location; if (g && typeof g === "object" && g.lat && g.lng) { const la = String(g.lat).toLowerCase(), ln = String(g.lng).toLowerCase(); if (/^[a-z0-9_]{1,40}$/.test(la) && /^[a-z0-9_]{1,40}$/.test(ln)) return { lat: la, lng: ln }; } return null; })(), transitions: (() => { const raw = def.transitions || def.stateMachine || def.stages; if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null; const out = {}; for (const [col, m] of Object.entries(raw)) { if (!/^[a-z0-9_]{1,40}$/i.test(col) || !m || typeof m !== "object" || Array.isArray(m)) continue; const cm = {}; for (const [from, tos] of Object.entries(m)) { if (String(from).length > 60) continue; const arr = (Array.isArray(tos) ? tos : [tos]).map((x) => String(x)).filter((x) => x.length <= 60).slice(0, 24); if (arr.length) cm[from] = arr; } if (Object.keys(cm).length) out[col.toLowerCase()] = cm; } return Object.keys(out).length ? out : null; })(), formulas: (() => { const src = def.formulas || def.formula || def.calc; if (!src || typeof src !== "object" || Array.isArray(src)) return null; const out = {}; for (const [name, tpl] of Object.entries(src)) { if (!/^[a-z0-9_]{1,40}$/i.test(name)) continue; const arr = Array.isArray(tpl) ? tpl : (typeof tpl === "string" ? tpl.trim().split(/\s+/) : null); if (!arr) continue; const toks = arr.filter((x) => (typeof x === "string" || typeof x === "number") && String(x).length <= 40).map(String).slice(0, 24); if (toks.length) out[name.toLowerCase()] = toks; } return Object.keys(out).length ? out : null; })(), fieldRoles: (() => { const raw = def.fieldRoles || def.fieldSecurity || def.secureFields; if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null; const out = {}; for (const [col, roles] of Object.entries(raw)) { if (!/^[a-z0-9_]{1,40}$/i.test(col)) continue; const arr = (Array.isArray(roles) ? roles : [roles]).map((x) => String(x).toLowerCase()).filter((x) => /^[a-z0-9_]{1,24}$/.test(x)).slice(0, 24); if (arr.length) out[col.toLowerCase()] = arr; } return Object.keys(out).length ? out : null; })(), teamRead: !!(def.teamRead || def.teamVisible || def.managerRead || def.hierarchyRead), teamScope: !!(def.teamScope || def.teamShared || def.sharedWithTeam || def.teamOwned), currency: (() => { const c = def.currency || def.money || def.multiCurrency; if (!c || typeof c !== "object" || Array.isArray(c)) return null; const amount = String(c.amount || c.value || c.field || "").toLowerCase(); const code = String(c.code || c.currency || c.currencyField || c.codeField || "").toLowerCase(); if (!/^[a-z0-9_]{1,40}$/.test(amount) || !/^[a-z0-9_]{1,40}$/.test(code)) return null; const base = String(c.base || c.baseCurrency || "USD").toUpperCase().slice(0, 8); if (!/^[A-Z]{2,8}$/.test(base)) return null; const rates = {}; const raw = c.rates || c.rate; if (raw && typeof raw === "object" && !Array.isArray(raw)) { for (const [k, v] of Object.entries(raw)) { const cc = String(k).toUpperCase(); const n = Number(v); if (/^[A-Z]{2,8}$/.test(cc) && Number.isFinite(n) && n > 0) rates[cc] = n; } } rates[base] = 1; let as = String(c.as || c.into || (amount + "_base")).toLowerCase(); if (!/^[a-z0-9_]{1,40}$/.test(as)) as = amount + "_base"; return { amount, code, base, rates, as }; })(), approval: (() => { const a = def.approval || def.approvals || def.signoff; if (!a || typeof a !== "object" || Array.isArray(a)) return null; const src = Array.isArray(a.approvers) ? a.approvers : (Array.isArray(a.roles) ? a.roles : [a.approvers || a.roles]); const approvers = src.map((x) => String(x == null ? "" : x).toLowerCase()).filter((x) => /^[a-z0-9_]{1,24}$/.test(x)); const uniq = [...new Set(approvers)].slice(0, 12); if (!uniq.length) return null; let status = String(a.status || a.field || a.statusField || "approval_status").toLowerCase(); if (!/^[a-z0-9_]{1,40}$/.test(status)) status = "approval_status"; return { approvers: uniq, status }; })(), sequence: (() => { const s = def.sequence || def.autoNumber || def.recordNumber || def.numbering; if (!s || typeof s !== "object" || Array.isArray(s)) return null; const field = String(s.field || s.column || s.into || "number").toLowerCase(); if (!/^[a-z0-9_]{1,40}$/.test(field)) return null; let prefix = String(s.prefix == null ? "" : s.prefix).slice(0, 16); if (!/^[A-Za-z0-9_\-\/#.]*$/.test(prefix)) prefix = ""; let pad = parseInt(s.pad != null ? s.pad : s.padding, 10); pad = (Number.isFinite(pad) && pad > 0) ? Math.min(pad, 12) : 0; let start = parseInt(s.start != null ? s.start : s.from, 10); start = Number.isFinite(start) ? start : 1; return { field, prefix, pad, start }; })(), roundRobin: (() => { const r = def.roundRobin || def.autoAssign || def.leadRouting || def.assignRoundRobin; if (!r) return null; const src = r === true ? ["user"] : (Array.isArray(r) ? r : (Array.isArray(r.among) ? r.among : (Array.isArray(r.roles) ? r.roles : [r.among || r.roles || r.role]))); const among = src.map((x) => String(x == null ? "" : x).toLowerCase()).filter((x) => /^[a-z0-9_]{1,24}$/.test(x)); const uniq = [...new Set(among)].slice(0, 24); return uniq.length ? { among: uniq } : null; })(), assignBy: (() => { const a = def.assignBy || def.territory || def.assignmentRules || def.routeBy; if (!a || typeof a !== "object" || Array.isArray(a)) return null; const field = String(a.field || a.on || a.by || "").toLowerCase(); if (!/^[a-z0-9_]{1,40}$/.test(field)) return null; const rawMap = a.map || a.rules || a.routes; const map = {}; if (rawMap && typeof rawMap === "object" && !Array.isArray(rawMap)) { for (const [k, v] of Object.entries(rawMap)) { const key = String(k).toLowerCase().trim(); const val = String(v == null ? "" : v).trim(); if (key && val && (/^\d+$/.test(val) || val.includes("@")) && val.length <= 120) map[key] = val; } } if (!Object.keys(map).length) return null; const d0 = a.default != null ? String(a.default).trim() : ""; const dfl = (d0 && (/^\d+$/.test(d0) || d0.includes("@")) && d0.length <= 120) ? d0 : null; return { field, map, default: dfl }; })(), sla: (() => { const s = def.sla || def.deadline || def.responseTime; if (!s || typeof s !== "object" || Array.isArray(s)) return null; const mins = slaMinutes(s.mins != null ? s.mins : (s.within != null ? s.within : (s.minutes != null ? s.minutes : s.duration))); if (!mins) return null; let start = String(s.start || s.from || s.since || "created_at").toLowerCase(); if (!/^[a-z0-9_]{1,40}$/.test(start)) start = "created_at"; let doneField = null, doneValues = null; const d = s.done || s.until || s.stopWhen; if (d && typeof d === "object" && !Array.isArray(d)) { const df = String(d.field || d.column || "").toLowerCase(); const vals = (Array.isArray(d.values) ? d.values : (d.value != null ? [d.value] : [])).map((x) => String(x)).filter((x) => x.length <= 60).slice(0, 24); if (/^[a-z0-9_]{1,40}$/.test(df) && vals.length) { doneField = df; doneValues = vals; } } let escalate = null; const e = s.escalate || s.then || s.onBreach; if (e && typeof e === "object" && !Array.isArray(e)) { const to0 = e.to != null ? String(e.to).trim() : ""; const toV = (to0 && (/^\d+$/.test(to0) || to0.includes("@")) && to0.length <= 120) ? to0 : null; const ef = String(e.field || e.column || "").toLowerCase(); const efV = /^[a-z0-9_]{1,40}$/.test(ef) ? ef : null; const ev = e.value != null ? String(e.value).slice(0, 120) : null; const hasField = !!(efV && ev != null); if (toV || hasField) escalate = { to: toV, field: hasField ? efV : null, value: hasField ? ev : null }; } return { start, mins, doneField, doneValues, escalate }; })(), mask: (() => { const m0 = def.mask || def.maskFields; if (!m0 || typeof m0 !== "object") return null; /* The designer emits an ARRAY of {column,roles,keep}. A map with arbitrary keys needs `additionalProperties` in the tool schema, and an under-specified schema THERE is what took the builder down for three merges. Both shapes are accepted; the stored shape stays the map the enforcement reads. */ const m = Array.isArray(m0) ? Object.fromEntries(m0.filter((e) => e && typeof e === "object" && e.column).map((e) => [String(e.column), e])) : m0; const out = {}; for (const [col, cfg] of Object.entries(m)) { if (!/^[a-z0-9_]{1,40}$/i.test(col)) continue; const c = (cfg && typeof cfg === "object" && !Array.isArray(cfg)) ? cfg : {}; const roles = (Array.isArray(c.roles) ? c.roles : []).map((x) => String(x).toLowerCase()).filter((x) => /^[a-z0-9_]{1,24}$/.test(x)).slice(0, 24); let keep = parseInt(c.keep != null ? c.keep : c.show, 10); keep = (Number.isFinite(keep) && keep >= 0) ? Math.min(keep, 12) : 4; const char = (String(c.char || "•").slice(0, 1)) || "•"; out[col.toLowerCase()] = { roles, keep, char }; } return Object.keys(out).length ? out : null; })(), jsonShapes: (() => { const raw = def.jsonShapes || def.jsonShape || def.shapes; if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null; const TYPES = new Set(["string", "number", "boolean", "array", "object"]); const out = {}; for (const [col, shape] of Object.entries(raw)) { if (!/^[a-z0-9_]{1,40}$/i.test(col) || !shape || typeof shape !== "object" || Array.isArray(shape)) continue; const fields = {}; for (const [f, ty] of Object.entries(shape)) { const t2 = String(ty).toLowerCase(); if (/^[a-z0-9_]{1,40}$/i.test(f) && TYPES.has(t2)) fields[f] = t2; } if (Object.keys(fields).length) out[col.toLowerCase()] = fields; } return Object.keys(out).length ? out : null; })(), fts: (() => { const x = def.fts || def.fullText || def.fullTextSearch; if (x === true || x === 1) return true; if (Array.isArray(x)) { const cols = x.map((c) => String(c).toLowerCase()).filter((c) => /^[a-z0-9_]{1,40}$/.test(c)).slice(0, 12); return cols.length ? cols : null; } return null; })(), webhooks: (() => { const w = def.webhooks || def.emitEvents || def.fireWebhooks; if (w === true || w === 1) return true; if (Array.isArray(w)) { const acts = [...new Set(w.map((a) => String(a).toLowerCase()).filter((a) => ["created", "updated", "deleted"].includes(a)))]; return acts.length ? acts : null; } return null; })(), noOverlap: (() => { /* INTERVAL exclusivity: no two live rows may occupy overlapping [start,end) ranges within the same group. A partial UNIQUE index only catches EXACT collisions, which is wrong the moment services have different lengths — a 60-minute booking at 10:00 and a 30-minute one at 10:30 are distinct (date,time) pairs and both would be accepted. Enforced as a single atomic INSERT..WHERE NOT EXISTS, so it is race-free rather than a check-then-write. */ const o = def.noOverlap || def.noDoubleBooking || def.exclusive; if (!o || typeof o !== "object" || Array.isArray(o)) return null; const start = String(o.start || o.from || "").toLowerCase(), end = String(o.end || o.to || "").toLowerCase(); if (!/^[a-z0-9_]{1,40}$/.test(start) || !/^[a-z0-9_]{1,40}$/.test(end) || start === end) return null; const on = (Array.isArray(o.on) ? o.on : (o.on != null ? [o.on] : [])).map((x) => String(x).toLowerCase()).filter((x) => /^[a-z0-9_]{1,40}$/.test(x)).slice(0, 4); /* This predicate is a runtime query, not DDL, so the value is a bound parameter and needs no character restriction — unlike the partial-index WHERE above. */ const wm = String(o.where == null ? "" : o.where).match(/^([a-z_][a-z0-9_]{0,40}):(eq|ne):([\s\S]{0,80})$/i); const where = wm ? { col: wm[1].toLowerCase(), op: wm[2].toLowerCase(), val: wm[3] } : null; return { start, end, on, where }; })(), payment: normalizePayment(def), /* Confirm the SUBMITTER, using the owner's own provider key. The model owns which column holds the address, the subject and the words; the platform owns only the wire, because a public page cannot hold a key and Postgres has no HTTP client. Validated against `cols` — the columns that actually survive — so a recipient column that got dropped cannot leave a table looking as though it confirms. */ confirm: normalizeConfirm({ ...def, columns: cols }), /* The same thing by text message. Separate from `confirm` rather than a channel on it, because a site may want either or both — an emailed receipt AND a texted reminder — and because SMS costs the owner money per message, which is a decision worth declaring on its own. */ sms: normalizeSms({ ...def, columns: cols }), publicView: (() => { /* A PII-filtered, read-only projection of an owner-scoped table, readable by ANYONE. The case it exists for: a booking app whose `bookings` are `user`-scoped, where a visitor must see which slots are taken without seeing who took them. Columns are an explicit allow-list — never a wildcard, never id/owner_id — so a table can only leak exactly what it declares. */ const p = def.publicView || def.publicFields || def.sharedView; if (!p || typeof p !== "object" || Array.isArray(p)) return null; const cols = (Array.isArray(p.columns) ? p.columns : (Array.isArray(p.fields) ? p.fields : [])).map((c) => String(c).toLowerCase()).filter((c) => /^[a-z0-9_]{1,40}$/.test(c) && c !== "owner_id" && c !== "id"); const uniq = [...new Set(cols)].slice(0, 12); if (!uniq.length) return null; const rawW = p.where != null ? (Array.isArray(p.where) ? p.where : [p.where]) : []; const where = rawW.map((w) => String(w)).filter((w) => /^[a-z_][a-z0-9_]{0,40}:(eq|ne|lt|lte|gt|gte|contains|startswith|endswith|in|nin|between|isnull|notnull):[\s\S]{0,80}$/i.test(w)).slice(0, 6); let lim = parseInt(p.limit, 10); lim = (Number.isFinite(lim) && lim > 0) ? Math.min(lim, 2000) : 500; return { columns: uniq, where, limit: lim }; })() });
  };
  const t = spec.tables || spec;
  if (Array.isArray(t)) t.forEach((tb) => tb && coerceTable(tb.name, tb));
  else if (t && typeof t === "object") Object.entries(t).forEach(([n, def]) => coerceTable(n, def));

  // TWO TABLES WITH THE SAME NAME BOTH SURVIVED, and the second silently
  // destroyed the first. `applySiteSchema` walks this list in order and, per
  // table, DROPS its policy shapes and its public view before recreating them —
  // so a duplicate re-ran that teardown against the same object and left the
  // second declaration's (emptier) version standing. The first's publicView,
  // noOverlap and access rules were simply gone, with no error anywhere.
  //
  // Found by making it happen: a second `bookings` in the e2e fixture failed the
  // run on `relation "bookings_public" does not exist`, six checks away from
  // anything to do with the change. The model can emit a duplicate just as
  // easily, on a real site, and nothing would have said so.
  //
  // First declaration wins, and later ones contribute any COLUMNS the first did
  // not have — so a repeat cannot delete a guarantee, and a field declared only
  // in the duplicate is not thrown away either.
  const byName = new Map();
  for (const tb of out) {
    const key = String(tb.name).toLowerCase();
    const first = byName.get(key);
    if (!first) { byName.set(key, tb); continue; }
    const have = new Set(first.columns.map((c) => String(c.name).toLowerCase()));
    for (const c of tb.columns) {
      if (!have.has(String(c.name).toLowerCase())) { first.columns.push(c); have.add(String(c.name).toLowerCase()); }
    }
  }
  out.length = 0;
  out.push(...byName.values());
  // Per-app rate-limit config — the owner tunes the data API's per-IP caps (requests
  // per minute) for reads and writes; `{read, write}` (aliases rateLimits/rate/
  // apiRateLimit, a bare number = both). Clamped to sane bounds; absent → platform
  // defaults (300 read / 60 write). Threaded through to the persisted schema so it's
  // loaded with the spec (no extra per-request read).
  const rlSrc = spec.rateLimits || spec.rate || spec.apiRateLimit || spec.rateLimit;
  let rateLimits = null;
  if (rlSrc != null) {
    const clamp = (v) => { const n = parseInt(v, 10); return (Number.isFinite(n) && n > 0) ? Math.min(n, 100000) : 0; };
    if (typeof rlSrc === "number" || typeof rlSrc === "string") { const b = clamp(rlSrc); if (b) rateLimits = { read: b, write: b }; }
    else if (typeof rlSrc === "object" && !Array.isArray(rlSrc)) {
      const read = clamp(rlSrc.read != null ? rlSrc.read : rlSrc.get);
      const write = clamp(rlSrc.write != null ? rlSrc.write : (rlSrc.post != null ? rlSrc.post : rlSrc.mutate));
      if (read || write) rateLimits = { read: read || 0, write: write || 0 };
    }
  }
  // ── DECLARED DATABASE FUNCTIONS ───────────────────────────────────────────
  //
  // The substrate becoming expressive, rather than another named verb. Four
  // client hooks — `useRpc`, `useRpcAction`, `useClaimedRow`, `useCancelClaim` —
  // called functions BY NAME, and until now no schema could declare one: the
  // designer's tool offered `tables` and eight cosmetic keys, and the engine
  // emitted `CREATE FUNCTION` only for its own triggers. So the whole RPC tier,
  // the claim flow and `manage.tsx` were unreachable on every site ever built.
  //
  // This is what the claim-link note always described: "ten lines of SQL the
  // generator can emit per site", replacing a hand-built verb. It is also the
  // ONLY way a `collect` table can hand anything back — a SECURITY DEFINER
  // function reaches past RLS deliberately and by name, which is a far narrower
  // hole than a read policy.
  //
  // Everything is bounded because a model writes it: the NAME is an identifier we
  // re-render (never interpolated raw), argument and return types come from an
  // allow-list, the body is capped, and the count is capped. The body itself is
  // arbitrary SQL and is NOT sanitised — it cannot be, and it does not need to
  // be: it runs inside the SITE'S OWN Neon project, which reaches no other site,
  // no Go Farther table and no secret, and a wrong one breaks that site's own page.
  const fnSrc = Array.isArray(spec.functions) ? spec.functions : [];
  const TYPES = new Set(["text", "int", "integer", "bigint", "numeric", "boolean", "uuid", "date", "timestamptz", "json", "jsonb"]);
  const ident = (x) => /^[a-z][a-z0-9_]{0,40}$/.test(String(x || "").toLowerCase()) ? String(x).toLowerCase() : null;
  const declared = new Set(out.map((x) => String(x.name).toLowerCase()));
  const functions = [];
  for (const f of fnSrc.slice(0, 8)) {
    if (!f || typeof f !== "object") continue;
    const name = ident(f.name);
    // Never let a declaration shadow the engine's own helpers: `app_user_id` is
    // what every RLS policy calls, and a redefinition would rewrite the access
    // rules of every table on the site from inside a page's data model.
    //
    // `app_team_id` WAS NOT COVERED, and it is the same hole one function over:
    // it is what every `teamScope` table's policy calls to decide which team's
    // rows a member may read and write, so a declared function of that name
    // rewrites the sharing rules of the whole site. The guard named one helper
    // when it meant "the engine's namespace", so it is on the PREFIX now — the
    // engine owns `app_`, nothing a site declares needs it, and a helper added
    // later is covered without anybody remembering to come back here.
    if (!name || name.startsWith("_") || name.startsWith("app_")) continue;
    const args = (Array.isArray(f.args) ? f.args : []).slice(0, 8).map((a2) => {
      const an = ident(a2 && a2.name);
      const at = String((a2 && a2.type) || "text").toLowerCase();
      return an && TYPES.has(at) ? { name: an, type: at } : null;
    }).filter(Boolean);
    // `setof <table>` is the shape a claim read needs, and the table has to be
    // one this schema actually declares — otherwise the function fails to create
    // and takes the whole apply down with it.
    const rawRet = String(f.returns || "void").toLowerCase().trim();
    const setof = rawRet.match(/^setof\s+([a-z][a-z0-9_]{0,40})$/);
    let returns = null;
    if (setof && declared.has(setof[1])) returns = "setof " + setof[1];
    else if (rawRet === "void" || TYPES.has(rawRet)) returns = rawRet;
    if (!returns) continue;
    const body = String(f.body || "").slice(0, 4000).trim();
    if (!body) continue;
    const lang = String(f.language || "sql").toLowerCase() === "plpgsql" ? "plpgsql" : "sql";
    // A model-written body may NEVER name an internal table. This is the one
    // sanitisation the body gets, and it is here rather than left to the
    // sandbox argument because the sandbox argument does not cover it:
    //
    //   - the function is created SECURITY DEFINER by default, so it runs as
    //     the database owner, which bypasses RLS
    //   - it is GRANT EXECUTE'd to `anonymous`, so any visitor can call it
    //   - `_secrets` — the site owner's Stripe key — lives in this same
    //     database, and `_meta` holds the site's own configuration
    //   - `dblink` and `postgres_fdw` ARE installable on Neon (measured in
    //     `neon-e2e`), so a body can open an outbound connection
    //
    // Put together that is a read of anything in the site, by anyone, with a
    // way out. The comment at the top of this block used to say model SQL
    // "reaches no other site, no Go Farther table and no secret" — the first two
    // hold, the third never did.
    //
    // Refusing the function outright rather than stripping the reference: a
    // body that wanted `_secrets` is not a body to repair, and a half-edited
    // one fails at CREATE time anyway. Nothing legitimate needs these — the
    // declared tables are the model's whole surface.
    if (/\b_(secrets|meta|users|sessions|invites|identities|credentials|auth_codes|auth_events|audit|teams)\b/i.test(body)) {
      continue;
    }
    // NEON_AUTH IS THE LIVE SESSION STORE, and the list above never covered it.
    //
    // Those underscore names are ours, and most of them went with the hand-built
    // auth layer on 2026-07-30 — the tables that actually hold identity today are
    // `neon_auth."user"`, `.session`, `.account` and `.verification`, created by
    // Neon Auth and none of them matching `_something`. So the deny-list was
    // guarding the ghosts of deleted tables while the real one stood open.
    //
    // Every model function is SECURITY DEFINER and therefore bypasses RLS, and a
    // non-`internal` one is GRANTed to `anonymous`. So a body reading
    // `neon_auth.session` and returning its rows hands any visitor every member's
    // live session token — full account takeover of that site — and `dblink` is
    // installable on Neon, so the body can post them outbound. It does not take a
    // malicious brief: "an admin page showing who's logged in" is enough, and the
    // platform's own threat model already treats model input as
    // attacker-influenceable (fetched pages and web research go into this model).
    //
    // Matched on the SCHEMA, not on table names: `neon_auth` is Neon's whole
    // namespace and nothing a site declares ever lives in it, so there is no
    // legitimate reference to preserve. Quoted, bracketed and bare forms all
    // reduce to the same word, which is why the check is on the identifier alone.
    if (/\bneon_auth\b/i.test(body)) {
      continue;
    }
    functions.push({ name, args, returns, body, language: lang, definer: f.definer !== false, /* An internal function is created, REVOKEd from PUBLIC, and never granted to the Data API roles. The revoke is the protection and the missing grant is only what stops it being handed back: Postgres grants EXECUTE on a new function to PUBLIC by default, so omission alone left it callable by everyone (measured by `neon e2e` 2026-08-07). A confirmation builder takes a row id and returns somebody's address and message, and every model function is SECURITY DEFINER, so reachable by `anonymous` it reads any customer's confirmation by guessing a number. The Worker calls it on the owner's connection, which bypasses grants, so revoking costs it nothing. */ internal: !!f.internal });
  }

  // A `confirm: {fn}` naming a function that does not exist — or one a visitor
  // could call — is dropped here rather than published. Both failures are the
  // silent kind: the site looks as though it confirms and never does, or it
  // confirms while exposing every customer's message to anyone who can count.
  // This is the one place both halves are visible; coerceTable sees a single
  // table and never the function list.
  const confirmFns = new Map(functions.map((f) => [f.name, f]));
  for (const t of out) {
    if (!t.confirm || !t.confirm.fn) continue;
    const f = confirmFns.get(t.confirm.fn);
    if (!f || !f.internal) t.confirm = null;
  }
  // The SAME cross-reference for the SMS builder, and it is a separate loop
  // rather than a condition folded into the one above so that adding a third
  // channel cannot silently skip it. A text costs the owner real money per
  // message, so a builder a visitor could call is worse here than for mail:
  // it hands out every customer's number AND spends the owner's balance.
  for (const t of out) {
    if (!t.sms || !t.sms.fn) continue;
    const f = confirmFns.get(t.sms.fn);
    if (!f || !f.internal) t.sms = null;
  }

  // Scheduled work: a schedule plus an internal function returning the messages.
  // Same cross-reference and same reason as `confirm.fn` — a job naming a
  // function that does not exist never runs, and one naming a function a visitor
  // could call hands out every recipient's address and message to anyone who
  // asks. Both silent. Names are unique, last declaration winning, because two
  // jobs of one name collide on the (slug, name) key they are stored under.
  const jobs = [];
  const jobNames = new Set();
  for (const raw of (Array.isArray(spec.jobs) ? spec.jobs : []).slice(0, 8)) {
    const j = normalizeJob(raw);
    if (!j) continue;
    const f = confirmFns.get(j.fn);
    if (!f || !f.internal) continue;
    if (jobNames.has(j.name)) jobs.splice(jobs.findIndex((x) => x.name === j.name), 1);
    jobNames.add(j.name);
    jobs.push(j);
  }

  // Third-party reads. Normalised HERE, in the one function every schema passes
  // through, rather than at request time — `normalizeSchema` is an ALLOW-LIST,
  // so anything not copied out explicitly is dropped silently on every build,
  // which is how `teamScope` stayed dead at a fifth layer.
  const apis = [];
  const apiNames = new Set();
  for (const raw of (Array.isArray(spec.apis) ? spec.apis : []).slice(0, 8)) {
    const a = normalizeApi(raw);
    if (!a || apiNames.has(a.name)) continue;
    apiNames.add(a.name);
    apis.push(a);
  }

  const extra = {};
  if (rateLimits) extra.rateLimits = rateLimits;
  if (functions.length) extra.functions = functions;
  if (jobs.length) extra.jobs = jobs;
  if (apis.length) extra.apis = apis;
  return { tables: out, ...extra };
}

async function pgTrigger(db, name, { timing, event, table, when, body, returns }) {
  const fn = sqlIdent(name + "_fn");
  const trg = sqlIdent(name);
  await sqlQuery(db,
    "CREATE OR REPLACE FUNCTION " + fn + "() RETURNS TRIGGER AS $trg$ BEGIN " + body +
    " RETURN " + (returns || (timing === "BEFORE" ? "NEW" : "NULL")) + "; END; $trg$ LANGUAGE plpgsql");
  await sqlQuery(db, "DROP TRIGGER IF EXISTS " + trg + " ON " + table);
  await sqlQuery(db, "CREATE TRIGGER " + trg + " " + timing + " " + event + " ON " + table +
    " FOR EACH ROW" + (when ? " WHEN (" + when + ")" : "") + " EXECUTE FUNCTION " + fn + "()");
}
// Auto-slug: a url-safe, lowercase, dash-joined key derived from a source column
// ("My First Post!" → "my-first-post"), used for pretty per-row URLs. Uniqueness is
// enforced with a UNIQUE INDEX; on collision we append -2, -3, … (also deduping within
// a single batch via `extraTaken`). Diacritics are folded; empty → "item".

export async function applySiteSchema(uuid, spec) {
  // The identity function every policy below is written against. Created once per
  // apply, before any policy references it, and `OR REPLACE` so a revise updates
  // the body rather than failing. Non-fatal: a site whose policies could not be
  // created still works through the Worker, which is the only door open today.
  // Neon's own pg_session_jwt verifies the session JWT inside Postgres and gives
  // `auth.user_id()`; the fallback reads PostgREST's claims setting. Which one is
  // installed decides which body is defined, because a function referencing a
  // function that does not exist fails to PARSE — and every policy built on it
  // would fail with it.
  let jwtExt = false;
  try { await sqlQuery(uuid, SESSION_JWT_EXT); jwtExt = true; }
  catch (e) { console.error("pg_session_jwt unavailable, falling back:", e && (e.detail || e.message)); }
  try { await sqlQuery(uuid, jwtExt ? APP_USER_FN_NATIVE : APP_USER_FN_FALLBACK); }
  catch (e) {
    console.error("app_user_id() failed:", e && (e.detail || e.message));
    // If the native form was refused for any other reason, the fallback is still
    // better than no function at all — without one, every policy is broken.
    if (jwtExt) { try { await sqlQuery(uuid, APP_USER_FN_FALLBACK); } catch {} }
  }
  // CREATING THE FUNCTION IS NOT THE SAME AS BEING ABLE TO CALL IT. The native
  // body reads `auth.user_id()`, and the Data API's roles have no USAGE on that
  // schema — so every member read and write answered `permission denied for
  // schema auth` while the function itself existed and the owner could run it
  // perfectly. Only on the native path; the fallback reads a GUC.
  const authGrants = [];
  if (jwtExt) {
    for (const g of SESSION_JWT_GRANTS) {
      try { await sqlQuery(uuid, g); authGrants.push({ sql: g, ok: true }); }
      catch (e) {
        const why = String((e && (e.detail || e.message)) || e);
        console.error("auth schema grant failed:", g, why);
        authGrants.push({ sql: g, ok: false, error: why });
      }
    }
  }
  // The team lookup, lifted out of the policy it used to be inlined in — see
  // site-rls.mjs. Created unconditionally so a revise picks it up; a site with no
  // team-scoped table simply never calls it.
  try { await sqlQuery(uuid, APP_TEAM_FN); }
  catch (e) { console.error("app_team_id() failed:", e && (e.detail || e.message)); }
  spec = normalizeSchema(spec);
  const tables = (spec && Array.isArray(spec.tables)) ? spec.tables.slice(0, 24) : [];
  const made = [], norm = [];
  for (const t of tables) {
    if (!t || !t.name) continue;
    const tn = sqlIdent(t.name);
    // access = who can read/write via the public data API:
    //   collect  — anyone can INSERT; nobody reads publicly (owner reads in-app)
    //   display  — anyone can READ; no public writes (owner-managed content)
    //   user     — requires the site's own login; each visitor sees only THEIR rows
    //   feed     — anyone READS; a logged-in visitor posts + edits only their OWN rows
    //   admin    — anyone READS; only an 'admin' site-user WRITES (shared, in-app CMS)
    const access = ["collect", "display", "user", "feed", "admin"].includes(t.access) ? t.access : "collect";
    // THE READ/WRITE PAIR, which every question below is really asking. The five
    // names above are presets over it, so a table declared either way — `access:
    // "user"` or `read: "own", write: "own"` — reaches identical DDL. Keyed on
    // the names instead, a pair-declared table silently loses `owner_id` and
    // every member write fails a WITH CHECK against a column that is not there.
    const rw = resolveAccess(t);
    const cols = []; let hasPk = false;
    const colNames = []; const numCols = []; const jsonCols = []; const seen = new Set(); const refs = {}; const refModes = {}; const rules = {};
    const appAdds = []; // [name-type] for each declared app column, ALTER-added on re-apply so a REVISE that adds a field actually gets the column (CREATE IF NOT EXISTS won't)
    // Auto-slug config: table-level `"slug":"title"` or `{"from":"title"}` → the platform
    // adds+fills a unique url-safe `slug` column derived from that source column on insert.
    let slugFrom = null;
    if (typeof t.slug === "string" && SAFE_IDENT.test(t.slug)) slugFrom = t.slug.toLowerCase();
    else if (t.slug && typeof t.slug === "object" && typeof t.slug.from === "string" && SAFE_IDENT.test(t.slug.from)) slugFrom = t.slug.from.toLowerCase();
    // RBAC: an `admin`-access table may name extra custom roles allowed to WRITE (the
    // built-in `admin` role always can). Role names are short safe identifiers.
    const writeRoles = (access === "admin" && Array.isArray(t.writeRoles)) ? t.writeRoles.map((r) => String(r).toLowerCase()).filter((r) => /^[a-z0-9_]{1,24}$/.test(r)).slice(0, 16) : null;
    // id / created_at / owner_id are ALWAYS platform-managed — we add them below.
    // Skip any the model declared itself (the rules say not to, but models don't
    // always comply) and skip duplicate column names, else CREATE TABLE would have
    // two columns of the same name → D1 error 7500 and the whole backend fails.
    const MANAGED = new Set(["id", "created_at", "owner_id"]);
    // DEFENCE IN DEPTH, AND UNREACHABLE TODAY — said plainly rather than left
    // looking like a live check, which is the failure this file has committed
    // five times. `coerceTable` already strips these from a payable table's
    // declared columns, so a mutation removing this line survives the suite.
    //
    // It stays for the one path that does not go through today's coerceTable: a
    // spec read back from a site's own `_meta`, written before that filter
    // existed. No payable site exists yet so none can be carrying one, but this
    // is the layer that turns such a column into a duplicate in CREATE TABLE,
    // and a failed CREATE takes the whole backend with it.
    if (normalizePayment(t)) for (const c of PAYMENT_COLUMNS) MANAGED.add(c);
    for (const c of (Array.isArray(t.columns) ? t.columns.slice(0, 48) : [])) {
      if (!c || !c.name) continue;
      const low = String(c.name).toLowerCase();
      if (MANAGED.has(low) || seen.has(low)) continue;
      seen.add(low);
      const cn = sqlIdent(c.name);
      const ctype = String(c.type || "text").toLowerCase();
      const ty = PG_TYPES[ctype] || "TEXT";
      const isNum = ["integer", "int", "real", "float", "number", "numeric"].includes(ctype);
      const isJson = ["json", "array", "object"].includes(ctype);
      let def = cn + " " + ty;
      if (c.pk) { def += " PRIMARY KEY"; if (ty === "INTEGER") def += " GENERATED BY DEFAULT AS IDENTITY"; hasPk = true; }
      if (c.notnull || c.required) def += " NOT NULL";
      if (c.unique) def += " UNIQUE";
      // Column DEFAULT — a server-side default applied when the writer omits the field.
      // Safely literalized: numbers as-is, booleans as 0/1, strings single-quote-escaped.
      if (c.default !== undefined && c.default !== null && !c.pk) {
        let dl = null;
        // Computed default tokens (dynamic per-insert): `@now`/`now`/`timestamp` →
        // current datetime, `@today`/`today` → current date, `@uuid`/`uuid` → a random
        // uuid-shaped id. Emitted as a SQL DEFAULT expression so the DB fills it when the
        // writer omits the field (no insert-path plumbing). A bare literal string default
        // still works for anything that isn't one of these reserved words.
        const COMPUTED = { now: "(to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'))", timestamp: "(to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'))", today: "(to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD'))", uuid: "(gen_random_uuid()::text)" };
        const tok = typeof c.default === "string" ? c.default.trim().toLowerCase().replace(/^@/, "") : null;
        if (tok && COMPUTED[tok]) dl = COMPUTED[tok];
        else if (typeof c.default === "number" && Number.isFinite(c.default)) dl = String(c.default);
        else if (typeof c.default === "boolean") dl = c.default ? "1" : "0";
        else if (typeof c.default === "string" && c.default.length <= 200) dl = "'" + c.default.replace(/'/g, "''") + "'";
        if (dl != null) def += " DEFAULT " + dl;
      }
      cols.push(def); colNames.push(c.name); if (isNum) numCols.push(String(c.name).toLowerCase()); if (isJson) jsonCols.push(String(c.name).toLowerCase());
      appAdds.push(cn + " " + ty); // bare type only — ALTER ADD COLUMN can't carry NOT NULL/UNIQUE/PK on a populated table; required-ness is enforced at the API layer anyway
      // A declared foreign key (`ref`/`references`) is stored as metadata only — the
      // column stays a plain integer id; the `expand` reader uses refs to join. Not a
      // SQL FK (D1 has FKs off by default), so app-side integrity, platform-side join.
      if (c.ref && SAFE_IDENT.test(String(c.ref))) { refs[low] = String(c.ref); if (c.onDelete) refModes[low] = c.onDelete; } // onDelete: setnull|cascade(default)|restrict
      // validation rules (enforced on writes): required, length/value bounds, format,
      // allowed-set (enum) and regex pattern.
      const rule = {};
      if (c.notnull || c.required) rule.required = true;
      if (isNum) { const nmn = Number(c.min); if (Number.isFinite(nmn)) rule.numMin = nmn; const nmx = Number(c.max); if (Number.isFinite(nmx)) rule.numMax = nmx; }
      else { const mx = parseInt(c.max, 10); if (mx > 0) rule.max = Math.min(mx, 100000); const mn = parseInt(c.min, 10); if (mn > 0) rule.minLen = Math.min(mn, 100000); }
      const fmt = String(c.format || "").toLowerCase(); if (["email", "url", "number"].includes(fmt)) rule.format = fmt;
      if (Array.isArray(c.enum) && c.enum.length) rule.enum = c.enum.map((x) => String(x)).slice(0, 100);
      if (typeof c.pattern === "string" && c.pattern.length && c.pattern.length <= 300) rule.pattern = c.pattern;
      if (c.immutable) rule.immutable = true; // write-once: set on insert, rejected on any later edit
      if (Object.keys(rule).length) rules[low] = rule;
    }
    if (!hasPk) cols.unshift('"id" INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY');
    // Auto-slug column (unless the app already declared its own `slug`): a UNIQUE url-safe key.
    if (slugFrom && !seen.has("slug")) { cols.push('"slug" TEXT'); colNames.push("slug"); seen.add("slug"); }
    // UUID, not INTEGER. It was an integer because it referenced a hand-rolled
    // `_users` whose ids were sequential integers; identity is Neon Auth's as of
    // 2026-07-30 and `neon_auth."user".id` is a `uuid` — measured against a real
    // project, and NOT what this repo's notes predicted (they said text).
    //
    // No FOREIGN KEY, deliberately, even though the reference is accepted. Two
    // reasons, and the second is the one that decides it: `neon_auth` is Neon's
    // schema, synced by their service, so a constraint of ours in it is a coupling
    // to something we do not control — and this DDL is re-run by every revise, on
    // a table that may already hold rows, where adding a constraint retroactively
    // FAILS if any existing owner_id no longer matches a live user. An orphaned
    // owner_id reads as "belongs to nobody" and the row is still the owner's to
    // see, which is what site-owner.mjs already decided when a member was deleted.
    // DEFAULT app_user_id(), and without it the member tier could READ and never
    // WRITE. Nothing stamps this column any more: the Worker's data path did,
    // and it was deleted on 2026-07-30 when the site moved to Neon's Data API.
    // So a member's insert arrived with `owner_id` NULL, the policy's
    // `WITH CHECK (owner_id = app_user_id())` evaluated NULL, and every write
    // answered 403. Measured live 2026-08-05.
    //
    // The default and the policy are BOTH needed and neither replaces the other:
    // the default fills the column in for a client that omits it (which the Data
    // API does, since owner_id is a managed column the generator is told never to
    // write), and the WITH CHECK is what stops a client that SENDS one from
    // claiming somebody else's id.
    // KEYED ON THE PROPERTY, not the two names. A table needs `owner_id`
    // exactly when its writes are scoped to the member who made the row —
    // which is what `user` and `feed` have always meant, and is now also
    // reachable as `write: "own"` without either name. Declared as a pair and
    // keyed on the name, the column is absent, every member INSERT fails its
    // own WITH CHECK, and the table looks broken rather than misconfigured.
    // EITHER AXIS. A row needs an owner when the WRITE is own-scoped (the member
    // who made it) or when the READ is (the member who may see it) — and
    // `read: "own", write: "none"` is a real pair: rows the owner fills in from
    // their dashboard for one member each. Keyed on write alone, its read policy
    // named a column that was never created, failed to CREATE, and left the
    // table with no read policy at all. Found by the guard below, not by hand.
    if (rw.write === "own" || rw.read === "own") { cols.push('"owner_id" UUID DEFAULT app_user_id()'); } // stamps the author / scopes rows
    // A team is a Neon Auth ORGANIZATION now, so this holds
    // `neon_auth.organization.id` — a uuid, not the sequential integer the deleted
    // `_teams` table used. No foreign key into `neon_auth`, for the same reason
    // owner_id has none.
    // DEFAULT the caller's team, for the same reason owner_id defaults to the
    // caller: nothing stamps it since the Worker's data path was deleted, so a
    // row created by a member carried `team_id` NULL and their colleagues could
    // not see it — the widening quietly did nothing.
    //
    // THE CAST IS GUARDED RATHER THAN BARE, and that asymmetry is deliberate:
    // `app_team_id()` returns text (its own comment says why), and a plain
    // `::uuid` on a value that is not uuid-shaped THROWS, which would make every
    // write to a team table fail. Absent sharing is a feature quietly not
    // working; a broken write is the form nobody can use. Measured 2026-08-05
    // against a real project — `neon_auth.member."organizationId"` IS uuid — so
    // this is expected to take; the guard is for the deployment where it stops
    // being true, which would otherwise be discovered by a customer.
    // MUST ASK THE SAME QUESTION `policiesFor` ASKS. The policy widens to the
    // team when the read is own-scoped; if this stamped the column on a
    // different condition the policy would name a column that does not exist,
    // fail to CREATE — which the apply loop logs and carries on from — and
    // leave the table with NO read policy, i.e. invisible to its own members.
    if (t.teamScope && rw.read === "own") cols.push('"team_id" UUID DEFAULT ' + TEAM_DEFAULT);
    // A payable table's order rows. Written by the checkout route and the
    // webhook and by nothing else — see grantsFor, which gives a payable table
    // NO public INSERT, so the priced path is the only way a row can exist.
    //
    // `payment_status` starts at 'pending' because the row is created BEFORE the
    // customer reaches Stripe: if it were created on the webhook instead, a
    // customer who paid while the callback was lost would have no order at all,
    // and the owner would have money with nothing to ship against.
    //
    // `amount_total` is an INTEGER of the currency's minor unit, never a decimal:
    // it is what was actually charged, and it has to compare exactly against
    // Stripe for the owner to reconcile.
    if (t.payment) {
      cols.push('"payment_status" TEXT NOT NULL DEFAULT \'pending\'');
      cols.push('"payment_ref" TEXT');
      cols.push('"amount_total" INTEGER');
      cols.push('"currency" TEXT');
      cols.push('"paid_at" TEXT');
    }
    if (t.trash) cols.push('"deleted_at" TEXT'); // soft-delete: NULL = live, timestamp = trashed
    if (t.version) cols.push('"_version" INTEGER NOT NULL DEFAULT 1'); // optimistic-concurrency row version
    if (t.timestamps || t.sync) cols.push('"updated_at" TEXT DEFAULT (to_char(now() AT TIME ZONE \'UTC\',\'YYYY-MM-DD HH24:MI:SS\'))'); // auto edit-tracking (also required by sync): set on insert, bumped on every UPDATE
    if (t.ordered) cols.push('"position" REAL'); // manual sort order — auto-assigned to end on insert (trigger below), midpoint-reordered via /move
    if (t.expires) cols.push('"expires_at" TEXT'); // TTL — app sets it; reads hide rows past it
    if (t.pinnable) cols.push('"pinned" INTEGER DEFAULT 0'); // featured/sticky — app sets 0/1; pinned rows list first
    if (t.scheduled) cols.push('"publish_at" TEXT'); // scheduled publish — hidden until this time (app-set)
    if (t.approval) cols.push(sqlIdent(t.approval.status) + " TEXT"); // approval state — endpoint-set only (NOT app-writable), queryable
    if (t.sequence) cols.push(sqlIdent(t.sequence.field) + " TEXT"); // auto-number — stamped on insert (NOT app-writable), queryable/sortable
    if (t.archivable) cols.push('"archived_at" TEXT'); // soft archive — reads hide archived rows by default
    cols.push('"created_at" TEXT DEFAULT (to_char(now() AT TIME ZONE \'UTC\',\'YYYY-MM-DD HH24:MI:SS\'))');
    await sqlQuery(uuid, "CREATE TABLE IF NOT EXISTS " + tn + " (" + cols.join(", ") + ")");
    // Schema evolution for APP columns: CREATE IF NOT EXISTS is a no-op on an existing table,
    // so a REVISE that adds a new field (e.g. "add a due_date to tasks") would never get the
    // column and every write to it fails ("data error"). ADD COLUMN is idempotent here (the
    // "duplicate column" error on a fresh table is swallowed), so this backfills any newly
    // declared column onto a pre-existing table without disturbing existing data.
    for (const add of appAdds) { try { await sqlQuery(uuid, "ALTER TABLE " + tn + " ADD COLUMN IF NOT EXISTS " + add); } catch {} }
    // Schema evolution: CREATE IF NOT EXISTS is a no-op for a table that already exists,
    // so a revise that CHANGES a table's access mode (display→user/feed) or turns on
    // trash would otherwise leave the newly-required platform columns missing — and its
    // scoped writes / soft-deletes would silently fail. ADD COLUMN is idempotent here
    // (a "duplicate column" error on a fresh table is swallowed), so re-declaring safely
    // backfills owner_id / deleted_at onto a pre-existing table.
    // The DEFAULT needs its own statement: `ADD COLUMN IF NOT EXISTS` does
    // nothing at all when the column is already there, so every site built
    // before 2026-08-05 would keep a column with no default and keep refusing
    // every member write. Same class as `ADD COLUMN IF NOT EXISTS` never
    // changing a type — a revise-path fix has to say what it wants explicitly.
    if (rw.write === "own") {
      try { await sqlQuery(uuid, "ALTER TABLE " + tn + ' ADD COLUMN IF NOT EXISTS "owner_id" UUID'); } catch {}
      try { await sqlQuery(uuid, "ALTER TABLE " + tn + ' ALTER COLUMN "owner_id" SET DEFAULT app_user_id()'); } catch {}
    }
    if (t.teamScope && rw.read === "own") {
      try { await sqlQuery(uuid, "ALTER TABLE " + tn + ' ADD COLUMN IF NOT EXISTS "team_id" UUID'); } catch {}
      try { await sqlQuery(uuid, "ALTER TABLE " + tn + ' ALTER COLUMN "team_id" SET DEFAULT ' + TEAM_DEFAULT); } catch {}
    }
    if (t.trash) { try { await sqlQuery(uuid, "ALTER TABLE " + tn + ' ADD COLUMN IF NOT EXISTS "deleted_at" TEXT'); } catch {} }
    if (t.version) { try { await sqlQuery(uuid, "ALTER TABLE " + tn + ' ADD COLUMN IF NOT EXISTS "_version" INTEGER NOT NULL DEFAULT 1'); } catch {} }
    // Auto updated_at backfill on a pre-existing table (ALTER ADD COLUMN can't carry a
    // datetime() default, so seed existing rows to created_at; new inserts on a table
    // revised THIS way get updated_at on their first edit — fresh tables get the CREATE
    // default above, so the common path is fully automatic).
    if (t.timestamps || t.sync) { try { await sqlQuery(uuid, "ALTER TABLE " + tn + ' ADD COLUMN IF NOT EXISTS "updated_at" TEXT'); } catch {} try { await sqlQuery(uuid, "UPDATE " + tn + ' SET "updated_at"=created_at WHERE "updated_at" IS NULL'); } catch {} }
    // Re-apply hygiene: DROP the flag-driven triggers first, so turning a flag OFF on a
    // revise (e.g. removing `audit`) actually REMOVES its trigger instead of leaving a stale
    // one behind. A left-behind AFTER trigger keeps firing into its side table (_audit /
    // _history) and rolls back every subsequent write ("data error") — a real bug when a
    // schema is re-applied without a flag it previously had. Each conditional block below
    // recreates its trigger only when the flag is still set. (Names are fixed per table; the
    // per-column enforceRefs triggers are left alone — columns are never dropped.)
    for (const suf of ["_del", "_pos", "_max", "_aud_i", "_aud_u", "_aud_d", "_hist"]) {
      try { await sqlQuery(uuid, "DROP TRIGGER IF EXISTS " + sqlIdent("trg_" + t.name + suf)); } catch {}
    }
    // Sync (offline-first) — record deletes as tombstones so a client can pull edits AND
    // deletes since a timestamp via /changes?sync=. `updated_at` (above) covers inserts+edits.
    if (t.sync) {
      try { await sqlQuery(uuid, "CREATE TABLE IF NOT EXISTS _deletes (row_table TEXT, row_id INTEGER, at TEXT)"); } catch {}
      try {
        await pgTrigger(uuid, "trg_" + t.name + "_del", {
          timing: "AFTER", event: "DELETE", table: tn,
          body: "INSERT INTO _deletes (row_table,row_id,at) VALUES ('" + t.name.replace(/'/g, "''") + "', OLD.id, to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'));",
          returns: "OLD",
        });
      } catch (e) { console.error("delete tombstone trigger failed:", t.name, e && e.detail); }
    }
    // Manual ordering: a `position` column auto-assigned to the END of its scope on insert
    // (per-owner on user/feed, global otherwise) by an AFTER INSERT trigger, so the app
    // never manages positions itself; rows are reordered by the /move endpoint (midpoints,
    // REAL, so no renumber). Backfill existing rows to a stable initial order (by id).
    if (t.ordered) {
      try { await sqlQuery(uuid, "ALTER TABLE " + tn + ' ADD COLUMN IF NOT EXISTS "position" REAL'); } catch {}
      try { await sqlQuery(uuid, "UPDATE " + tn + ' SET "position"=id WHERE "position" IS NULL'); } catch {}
      const scoped = (rw.write === "own");
      const trg = sqlIdent("trg_" + t.name + "_pos");
      // Postgres can assign the position in a BEFORE INSERT instead of updating the
      // row back afterwards. `IS NOT DISTINCT FROM` is the null-safe comparison
      // SQLite spelled `IS`.
      const maxScope = scoped ? ' WHERE "owner_id" IS NOT DISTINCT FROM NEW."owner_id"' : "";
      try {
        await pgTrigger(uuid, "trg_" + t.name + "_pos", {
          timing: "BEFORE", event: "INSERT", table: tn,
          when: 'NEW."position" IS NULL',
          body: 'SELECT COALESCE(MAX("position"),0)+1 INTO NEW."position" FROM ' + tn + maxScope + ";",
        });
      } catch (e) { console.error("position trigger failed:", t.name, e && e.detail); }
    }
    if (t.expires) { try { await sqlQuery(uuid, "ALTER TABLE " + tn + ' ADD COLUMN IF NOT EXISTS "expires_at" TEXT'); } catch {} }
    if (t.pinnable) { try { await sqlQuery(uuid, "ALTER TABLE " + tn + ' ADD COLUMN IF NOT EXISTS "pinned" INTEGER DEFAULT 0'); } catch {} }
    if (t.scheduled) { try { await sqlQuery(uuid, "ALTER TABLE " + tn + ' ADD COLUMN IF NOT EXISTS "publish_at" TEXT'); } catch {} }
    if (t.approval) { try { await sqlQuery(uuid, "ALTER TABLE " + tn + " ADD COLUMN IF NOT EXISTS " + sqlIdent(t.approval.status) + " TEXT"); } catch {} }
    if (t.sequence) { try { await sqlQuery(uuid, "ALTER TABLE " + tn + " ADD COLUMN IF NOT EXISTS " + sqlIdent(t.sequence.field) + " TEXT"); } catch {} }
    if (t.archivable) { try { await sqlQuery(uuid, "ALTER TABLE " + tn + ' ADD COLUMN IF NOT EXISTS "archived_at" TEXT'); } catch {} }
    // Auto-slug: backfill the column on a pre-existing table + a UNIQUE index to police
    // collisions (SQLite lets a UNIQUE index hold many NULLs, so slug-less rows are fine).
    if (slugFrom) {
      try { await sqlQuery(uuid, "ALTER TABLE " + tn + ' ADD COLUMN IF NOT EXISTS "slug" TEXT'); } catch {}
      try { await sqlQuery(uuid, "CREATE UNIQUE INDEX IF NOT EXISTS " + sqlIdent("ux_" + t.name + "_slug") + " ON " + tn + ' ("slug")'); } catch (e) { console.error("slug index failed:", t.name, e && e.detail); }
    }
    // Composite UNIQUE constraints (declared at the TABLE level, race-free — enforced
    // by a real UNIQUE INDEX in D1; a violation surfaces to the data API as a 409).
    //   unique: [...]      → a group of columns that must be globally unique
    //   oncePerUser: [...] → unique PER author on user/feed tables (owner_id + cols):
    //                        "one review per member per product", "one RSVP per event".
    // Accepts a single group ["a","b"] or many [["a"],["b","c"]].
    {
      const hasOwner = (rw.write === "own");
      const colSet = new Set(colNames.map((n) => String(n).toLowerCase()));
      // A group may be a bare column, an array of columns, or {columns:[…], where:"status:eq:confirmed"} —
      // the last form becomes a PARTIAL unique index. That matters for anything slot-shaped: a plain
      // UNIQUE(date,time) stops two people booking 10:00, but it also means a CANCELLED booking keeps
      // occupying the slot forever, because an index does not care about status. Scoping the index to the
      // rows that actually hold the slot is the difference between "race-free" and "race-free and usable".
      const partialWhere = (spec) => {
        // Deliberately only eq/ne against a literal: a partial index's WHERE is baked into DDL, so it cannot
        // be parameterised and anything richer would mean building SQL out of user text.
        const m = String(spec || "").match(/^([a-z_][a-z0-9_]{0,40}):(eq|ne):([\s\S]{0,60})$/i);
        if (!m) return null;
        const col = m[1].toLowerCase();
        if (!colSet.has(col)) return null;
        const val = m[3];
        if (!/^[\w .:@+/-]{0,60}$/.test(val)) return null; // no quotes, no SQL punctuation
        return sqlIdent(col) + (m[2].toLowerCase() === "eq" ? " = '" : " <> '") + val + "'";
      };
      const mkIndexes = async (groups, perUser) => {
        const raw = Array.isArray(groups) ? groups : (groups ? [groups] : []);
        const many = raw.length && (Array.isArray(raw[0]) || (raw[0] && typeof raw[0] === "object")) ? raw : (raw.length ? [raw] : []);
        let gi = 0;
        for (const g of many) {
          const isObj = g && typeof g === "object" && !Array.isArray(g);
          const src = isObj ? (Array.isArray(g.columns) ? g.columns : [g.columns]) : g;
          const gcols = (Array.isArray(src) ? src : [src]).map((c) => String(c).toLowerCase()).filter((c) => colSet.has(c));
          if (!gcols.length) continue;
          const idxCols = (perUser && hasOwner ? ["owner_id"] : []).concat(gcols);
          const where = isObj ? partialWhere(g.where) : null;
          const idxName = sqlIdent("ux_" + t.name + "_" + (perUser ? "u" : "g") + "_" + (gi++));
          try { await sqlQuery(uuid, "CREATE UNIQUE INDEX IF NOT EXISTS " + idxName + " ON " + tn + " (" + idxCols.map(sqlIdent).join(",") + ")" + (where ? " WHERE " + where : "")); } catch (e) { console.error("unique index failed:", t.name, e && e.detail); }
        }
      };
      await mkIndexes(t.unique, false);

      // True interval exclusivity. On SQLite this could only be approximated by
      // a hand-rolled INSERT … WHERE NOT EXISTS, which raced two simultaneous
      // bookings; Postgres has EXCLUDE USING gist, so the DATABASE refuses an
      // overlap and there is nothing for application code to get wrong.
      //   "noOverlap": { "on": ["room"], "start": "start_min", "end": "end_min",
      //                  "where": "status:eq:confirmed" }
      // Ranges are half-open, so 10:00–11:00 and 11:00–12:00 do not clash.
      if (t.noOverlap && t.noOverlap.start && t.noOverlap.end) {
        const no = t.noOverlap;
        const sc = String(no.start).toLowerCase(), ec = String(no.end).toLowerCase();
        const on = (Array.isArray(no.on) ? no.on : no.on ? [no.on] : [])
          .map((c) => String(c).toLowerCase()).filter((c) => colSet.has(c));
        // The range type has to match the column type; only the numeric form is
        // emitted, so a text/date start column is skipped rather than guessed at.
        if (colSet.has(sc) && colSet.has(ec) && numCols.includes(sc) && numCols.includes(ec)) {
          // btree_gist is what allows a plain column to use `=` inside a gist
          // exclusion alongside the range's `&&`.
          try { await sqlQuery(uuid, "CREATE EXTENSION IF NOT EXISTS btree_gist"); } catch {}
          const where = partialWhere(no.where);
          const cname = sqlIdent("ex_" + t.name + "_nooverlap");
          const parts = on.map((c) => sqlIdent(c) + " WITH =")
            .concat(["int4range(" + sqlIdent(sc) + ", " + sqlIdent(ec) + ") WITH &&"]);
          try { await sqlQuery(uuid, "ALTER TABLE " + tn + " DROP CONSTRAINT IF EXISTS " + cname); } catch {}
          try {
            await sqlQuery(uuid, "ALTER TABLE " + tn + " ADD CONSTRAINT " + cname +
              " EXCLUDE USING gist (" + parts.join(", ") + ")" + (where ? " WHERE (" + where + ")" : ""));
          } catch (e) { console.error("noOverlap constraint failed:", t.name, e && e.detail); }
        } else {
          console.error("noOverlap skipped (start/end must be numeric columns):", t.name);
        }
      }
      await mkIndexes(t.oncePerUser, true);
      // Case-insensitive UNIQUE — `uniqueCI:["email"]` → a UNIQUE INDEX over lower(col), so
      // "A@x.com" and "a@x.com" collide (usernames, emails, slugs). Race-free like `unique`;
      // a violation surfaces as the same 409 duplicate. One column per group.
      { let ci = 0;
        for (const raw of (Array.isArray(t.uniqueCI) ? t.uniqueCI : (t.uniqueCI ? [t.uniqueCI] : []))) {
          const col = String(Array.isArray(raw) ? raw[0] : raw).toLowerCase();
          if (!colSet.has(col)) continue;
          try { await sqlQuery(uuid, "CREATE UNIQUE INDEX IF NOT EXISTS " + sqlIdent("ux_" + t.name + "_ci_" + (ci++)) + " ON " + tn + " (lower(" + sqlIdent(col) + "))"); } catch (e) { console.error("uniqueCI index failed:", t.name, e && e.detail); }
        }
      }
    }
    // Max-rows quota — `maxRows:N` caps how many rows the table may hold (scoped per-owner
    // on user/feed, global otherwise), enforced by a BEFORE INSERT trigger that ABORTs once
    // the cap is reached. Zero insert-path plumbing; the abort surfaces to the data API as a
    // clean 409 "limit reached". Free-tier caps, "max 100 todos per user", etc.
    if (t.maxRows > 0) {
      const scoped = (rw.write === "own");
      const cntScope = scoped ? ' WHERE "owner_id" IS NOT DISTINCT FROM NEW."owner_id"' : "";
      try {
        await pgTrigger(uuid, "trg_" + t.name + "_max", {
          timing: "BEFORE", event: "INSERT", table: tn,
          body: "IF (SELECT COUNT(*) FROM " + tn + cntScope + ") >= " + Math.floor(t.maxRows) +
                " THEN RAISE EXCEPTION 'row limit reached'; END IF;",
        });
      } catch (e) { console.error("maxRows trigger failed:", t.name, e && e.detail); }
    }
    // Referential integrity — `enforceRefs:true` refuses a write whose foreign-key column
    // points at a NON-existent parent (no orphan comments / line-items). A BEFORE INSERT and
    // BEFORE UPDATE trigger per ref column RAISEs when the fk is set but the parent id is
    // missing; the abort maps to a clean 400 in the data API. Complements the delete-time
    // cascade (which stops orphans when a parent is removed). NULL fk = allowed (optional link).
    if (t.enforceRefs) {
      for (const col of Object.keys(refs)) {
        const parent = refs[col];
        if (!SAFE_IDENT.test(String(parent)) || !SAFE_IDENT.test(String(col))) continue;
        const cn = sqlIdent(col), pn = sqlIdent(parent);
        const guard = "IF NEW." + cn + " IS NOT NULL AND NOT EXISTS (SELECT 1 FROM " + pn +
                      " WHERE id=NEW." + cn + ") THEN RAISE EXCEPTION 'missing parent'; END IF;";
        try { await pgTrigger(uuid, "trg_" + t.name + "_ref_" + col + "_i", { timing: "BEFORE", event: "INSERT", table: tn, body: guard }); } catch (e) { console.error("ref trigger i failed:", t.name, col, e && e.detail); }
        try { await pgTrigger(uuid, "trg_" + t.name + "_ref_" + col + "_u", { timing: "BEFORE", event: "UPDATE OF " + cn, table: tn, body: guard }); } catch (e) { console.error("ref trigger u failed:", t.name, col, e && e.detail); }
      }
    }
    // Audit log — `audit:true` records every write to the table (insert/update/delete) in a
    // shared `_audit` trail via AFTER triggers (no write-path plumbing). Captures table, row
    // id, action, time, and the actor (owner_id on user/feed tables, else NULL). The app's
    // admin reads it at GET /api/db/<slug>/audit. Compliance, "who changed this", activity.
    if (t.audit) {
      // actor_id holds owner_id, so it is a uuid for the same reason.
      try { await sqlQuery(uuid, "CREATE TABLE IF NOT EXISTS _audit (id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, row_table TEXT, row_id INTEGER, action TEXT, actor_id UUID, at TEXT)"); } catch {}
      const hasOwner = (rw.write === "own");
      const actNew = hasOwner ? 'NEW."owner_id"' : "NULL";
      const actOld = hasOwner ? 'OLD."owner_id"' : "NULL";
      const AT = "to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')";
      const mk = (suffix, event, idRef, actor, action) => pgTrigger(uuid, "trg_" + t.name + "_aud_" + suffix, {
        timing: "AFTER", event, table: tn,
        body: "INSERT INTO _audit (row_table,row_id,action,actor_id,at) VALUES ('" + t.name.replace(/'/g, "''") +
              "', " + idRef + ", '" + action + "', " + actor + ", " + AT + ");",
        returns: event === "DELETE" ? "OLD" : "NEW",
      });
      try { await mk("i", "INSERT", "NEW.id", actNew, "insert"); } catch (e) { console.error("audit trigger i failed:", t.name, e && e.detail); }
      try { await mk("u", "UPDATE", "NEW.id", actNew, "update"); } catch (e) { console.error("audit trigger u failed:", t.name, e && e.detail); }
      try { await mk("d", "DELETE", "OLD.id", actOld, "delete"); } catch (e) { console.error("audit trigger d failed:", t.name, e && e.detail); }
    }
    // Row history / revert — `history:true` snapshots a row's OLD data columns (as JSON, via
    // json_object) into `_history` on every UPDATE (BEFORE UPDATE trigger). The owner/admin
    // can view the timeline and restore any prior version. Undo, revision history, audit-of-content.
    if (t.history && colNames.length) {
      try { await sqlQuery(uuid, "CREATE TABLE IF NOT EXISTS _history (id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, row_table TEXT, row_id INTEGER, snapshot TEXT, at TEXT)"); } catch {}
      const jsonPairs = colNames.map((cn) => "'" + String(cn).replace(/'/g, "''") + "', OLD." + sqlIdent(cn)).join(", ");
      try {
        await pgTrigger(uuid, "trg_" + t.name + "_hist", {
          timing: "BEFORE", event: "UPDATE", table: tn,
          body: "INSERT INTO _history (row_table,row_id,snapshot,at) VALUES ('" + t.name.replace(/'/g, "''") +
                "', OLD.id, json_build_object(" + jsonPairs + ")::text, to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'));",
        });
      } catch (e) { console.error("history trigger failed:", t.name, e && e.detail); }
    }
    // FULL-TEXT SEARCH — `fts:true` (all text cols) or `fts:["title","body"]`. Postgres
    // indexes in place: a GENERATED tsvector column over those columns plus a GIN index,
    // queried (ranked, ts_rank) via `?fts=<query>` on the list read. This replaces the
    // SQLite FTS5 shadow table and its three sync triggers — the column is maintained by
    // the database itself, so it cannot drift from the row the way a shadow table could.
    // Re-applying a schema recreates the column when the indexed set changes.
    if (t.fts) {
      try {
        const textCols = colNames.filter((c) => { const lc = String(c).toLowerCase(); return !numCols.includes(lc) && !jsonCols.includes(lc); });
        const want = Array.isArray(t.fts) ? textCols.filter((c) => t.fts.includes(String(c).toLowerCase())) : textCols;
        const tsv = sqlIdent("_fts");
        if (want.length) {
          // to_tsvector is only IMMUTABLE with an explicit regconfig, which a generated
          // column requires; COALESCE keeps a NULL column from nulling the whole document.
          const doc = want.map((c) => "COALESCE(" + sqlIdent(c) + ",'')").join(" || ' ' || ");
          await sqlQuery(uuid, "ALTER TABLE " + tn + " DROP COLUMN IF EXISTS " + tsv);
          await sqlQuery(uuid, "ALTER TABLE " + tn + " ADD COLUMN " + tsv +
            " tsvector GENERATED ALWAYS AS (to_tsvector('english', " + doc + ")) STORED");
          await sqlQuery(uuid, "CREATE INDEX IF NOT EXISTS " + sqlIdent("idx_" + t.name + "_fts") +
            " ON " + tn + " USING GIN (" + tsv + ")");
        }
      } catch (e) { console.error("fts setup failed:", t.name, e && e.detail); }
    }
    made.push(t.name);
    // Row-level security. The Worker's own enforcement stays — these are
    // additional, so a mistake in either is caught by the other — and applying
    // them changes nothing for the current data path, because a table's owner
    // bypasses its policies and the Worker connects as the owner.
    //
    // Statement by statement rather than as one block, and non-fatal: a policy
    // that fails to apply must not lose a build whose tables and data are already
    // in place. The failure is logged with the table so it is findable.
    // Policies first, then the grants that make the table reachable at all. In the
    // other order there is a window — however short — where a role can ask and no
    // policy has decided what it may see.
    // And LAST the public projection, which is a view over the table this loop
    // has just finished building — so it needs `colNames`, the columns that were
    // really created, rather than the ones the spec asked for. After the grants
    // for the same reason the grants come after the policies: the object is only
    // reachable once the thing it reads from is settled.
    const pubSql = publicViewSql({ ...t, access }, colNames, new Set((spec.tables || []).map((x) => String(x && x.name))));
    for (const stmt of policiesFor({ ...t, access }).concat(grantsFor({ ...t, access })).concat(pubSql)) {
      try { await sqlQuery(uuid, stmt); }
      catch (e) { console.error("rls failed:", t.name, stmt.slice(0, 80), e && (e.detail || e.message)); }
    }

    norm.push({ name: t.name, access, retired: t.retired, columns: colNames, refs, refModes: Object.keys(refModes).length ? refModes : null, rules, num: numCols, json: jsonCols, trash: !!t.trash, slug: slugFrom ? { from: slugFrom } : null, writeRoles: (writeRoles && writeRoles.length) ? writeRoles : null, version: !!t.version, timestamps: !!t.timestamps, ordered: !!t.ordered, expires: !!t.expires, pinnable: !!t.pinnable, defaultSort: t.defaultSort || null, scheduled: !!t.scheduled, checks: t.checks || null, computed: t.computed || null, requireVerified: !!t.requireVerified, audit: !!t.audit, history: !!t.history, archivable: !!t.archivable, sync: !!t.sync, searchWeights: t.searchWeights || null, rateLimit: t.rateLimit || 0, geo: t.geo || null, transitions: t.transitions || null, formulas: t.formulas || null, fieldRoles: t.fieldRoles || null, teamRead: !!t.teamRead, currency: t.currency || null, approval: t.approval || null, sequence: t.sequence || null, roundRobin: t.roundRobin || null, assignBy: t.assignBy || null, sla: t.sla || null, mask: t.mask || null, jsonShapes: t.jsonShapes || null, fts: t.fts || null, webhooks: t.webhooks || null, teamScope: !!t.teamScope, publicView: t.publicView || null, noOverlap: t.noOverlap || null });
  }
  // Persist the normalized access rules + column allow-list in the site's own DB so
  // the data API can enforce them per request. MERGE into whatever's already
  // persisted (don't replace): a revise may re-emit a schema with only the new/
  // changed table, and replacing would strip the pre-existing tables from the
  // API's allow-list — their data still exists (CREATE IF NOT EXISTS above never
  // drops it) but the data API would 404 them. Re-declared tables win; untouched
  // ones are preserved. (A revise cannot silently drop a table this way.)
  await sqlQuery(uuid, "CREATE TABLE IF NOT EXISTS _meta (k TEXT PRIMARY KEY, v TEXT)");
  // The owner's own API keys — their Stripe key and its webhook secret — live in
  // the SITE's database rather than in a central table, and created HERE rather
  // than on a payments-only path for the reason `_sessions` had to move into
  // `ensureSiteUsers`: a table that exists only where somebody used the feature
  // 500s everywhere else the moment anything else reads it.
  //
  // Three things follow from it being per-site. The checkout route must already
  // hold this connection to price a cart from the site's own products, so the
  // key costs no extra round trip on a path a customer is waiting on. Deleting
  // the site drops the database and takes the keys with it, with no second
  // cleanup path to forget. And one customer's live key is not sitting beside
  // every other customer's.
  //
  // It is deliberately NOT passed through `grantsFor` — only declared tables are
  // — so `anonymous` and `authenticated` hold no privilege on it and it is
  // unreachable through the Data API by construction. Values are encrypted with
  // the PLATFORM key regardless, so a connection string alone yields ciphertext.
  await sqlQuery(uuid, "CREATE TABLE IF NOT EXISTS _secrets (name TEXT PRIMARY KEY, cipher TEXT NOT NULL, hint TEXT, created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')))");
  let mergedTables = norm;
  // THE SAME MERGE THE TABLES GET, and it was missing — found 2026-08-05 by
  // asking whether a "manage my booking" page could be added by a later EDIT.
  // It can: the designer declares the claim function, `applySiteSchema` creates
  // it, and the page gets built. But `metaOut.functions` was written from THIS
  // run's spec alone, so the NEXT unrelated edit ("add a gallery") declared no
  // functions, recorded none, and erased them from `_meta`.
  //
  // The functions themselves survive in Postgres — `CREATE OR REPLACE` persisted
  // them and nothing drops them — so a published page kept working. What was
  // lost is the generator's KNOWLEDGE of them: `schemaDigest` reads this list,
  // the lint refuses a `useRpc` on a name it does not list, and the rules say to
  // build the manage page only when the schema declares the functions. So the
  // page would be built on one edit and silently dropped by the next.
  //
  // Exactly the failure the comment below describes for tables, which was fixed
  // for tables and not for these.
  let mergedFns = [];
  let rateLimits = spec.rateLimits || null; // this run's per-app rate config (if any)
  try {
    // Was `loadSiteSchema(env, uuid)` — a two-arg call left from the D1 era, and
    // `env` does not exist in this scope. It threw a ReferenceError into the bare
    // catch below on EVERY apply, so the merge never ran: a revise that re-emitted
    // only its changed table stripped every other table from _meta.schema, and the
    // data API then 404'd tables whose rows were still sitting in Postgres. Exactly
    // the failure the comment above says this code prevents.
    const prev = await loadSiteSchema(uuid);
    if (prev && Array.isArray(prev.tables) && prev.tables.length) {
      const byName = new Map();
      for (const t of prev.tables) if (t && t.name) byName.set(String(t.name).toLowerCase(), t);
      for (const t of norm) {
        // THIS RUN OVERRIDES, EXCEPT WHERE IT SAID NOTHING. The override is
        // whole-object, so a table re-listed without `retired` used to wipe the
        // flag and restore its public write grant — a removed form quietly
        // taking submissions again, with nothing on the site to show for it.
        const key = String(t.name).toLowerCase();
        const prevT = byName.get(key);
        if (t.retired === undefined && prevT && prevT.retired !== undefined) t.retired = prevT.retired;
        byName.set(key, t);
      }
      mergedTables = Array.from(byName.values());
    }
    if (prev && Array.isArray(prev.functions)) mergedFns = prev.functions.filter((f) => f && f.name);
    if (!rateLimits && prev && prev.rateLimits) rateLimits = prev.rateLimits; // preserve prior tuning when unspecified
  } catch {}
  // ── The declared functions ────────────────────────────────────────────────
  //
  // Emitted AFTER every table exists, because a `SETOF <table>` return type and
  // any body touching a table both need the table to be there. `CREATE OR
  // REPLACE` so a revise updates a function instead of failing on it.
  //
  // NOT FATAL, deliberately: the tables, policies and grants are already applied
  // by this point and a site with a working form and one broken function is a
  // far better outcome than losing the whole apply. The failure is returned so
  // the caller can report it rather than discover it from a 404 at runtime.
  const fnErrors = [];
  let fnsMade = [];
  for (const f of (spec.functions || [])) {
    // The DDL lives in site-rls.mjs beside the policies and grants, so it can be
    // asserted without a database — the version inline here could only be checked
    // by grepping this file, and four mutants survived that, one of them by
    // matching "SECURITY DEFINER" inside a comment.
    try {
      for (const stmt of functionSql(f)) await sqlQuery(uuid, stmt);
      fnsMade.push(f.name);
    } catch (e) {
      console.error("function failed:", f.name, e && (e.detail || e.message));
      fnErrors.push({ name: f.name, error: String((e && (e.detail || e.message)) || e).slice(0, 200) });
    }
  }

  const metaOut = { tables: mergedTables }; if (rateLimits) metaOut.rateLimits = rateLimits;
  // Declared third-party reads. Recorded whole, and unlike a function there is
  // nothing to "make" — no DDL runs, so there is no created/not-created split to
  // filter on. A revise REPLACES the list rather than merging, because a
  // declaration the new schema dropped is one the site no longer offers.
  if (Array.isArray(spec.apis) && spec.apis.length) metaOut.apis = spec.apis;
  // The digest reads this to tell the generator which functions it may call, so
  // only the ones that REALLY EXIST are recorded. Naming a failed function would
  // point the model at a 404.
  // Keyed by name, this run overriding — the same shape as the table merge. A
  // function that failed to re-create this run keeps its previous entry, which is
  // correct: `CREATE OR REPLACE` failing leaves the working one in place.
  {
    const byName = new Map(mergedFns.map((f) => [String(f.name).toLowerCase(), f]));
    for (const f of (spec.functions || [])) {
      // `internal` TRAVELS WITH IT, and dropping it was a live break the moment
      // anything read this back. `_meta` is the only copy the request path ever
      // sees — the parsed spec is gone by then — so the inbound-webhook route,
      // which requires a hook function to BE internal, resolved null for every
      // hook on every site. The build succeeded, the function existed in
      // Postgres, and the feature was simply unreachable: the exact shape this
      // codebase has recorded five times over.
      if (fnsMade.includes(f.name)) byName.set(String(f.name).toLowerCase(), { name: f.name, args: f.args, returns: f.returns, internal: !!f.internal });
    }
    if (byName.size) metaOut.functions = Array.from(byName.values());
  }
  // AN APPLY THAT DECLARES NOTHING MUST NOT ERASE WHAT IS STORED.
  //
  // `_meta.schema` is the ONLY copy the request path ever reads, so writing an
  // empty table list over a real one takes every table on the site off the data
  // API while its rows sit untouched in Postgres. That was unreachable while an
  // empty spec was refused at the route; a look-only revise ("make the
  // background yellow") now reaches here with zero tables, and the merge above
  // hands back the stored ones — EXCEPT when its read throws, where `mergedTables`
  // is still that empty list and this would publish it.
  //
  // Skipped rather than written, because with nothing declared and nothing
  // merged there is genuinely nothing to record: the write could only destroy.
  if (mergedTables.length || norm.length) {
    await sqlQuery(uuid, "INSERT INTO _meta (k,v) VALUES ('schema', ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", [JSON.stringify(metaOut)]);
  }
  // The spec on disk just changed; anything this isolate remembered is stale.
  invalidateSiteSchema(uuid);
  // ATTACHED TO THE ARRAY, and the guard that used to wrap this said
  // `!Array.isArray(made)` — which `made` always is, so the whole block was dead
  // and a source-reading test asserting the line exists passed anyway. Found by
  // writing the e2e; the same shape as everything else fixed today.
  //
  // Note for callers: JSON.stringify drops properties hung off an array, so the
  // route reads these BEFORE serialising rather than expecting them in `tables`.
  made.functions = fnsMade;
  if (fnErrors.length) made.functionErrors = fnErrors;
  // WHETHER THE AUTH-SCHEMA GRANTS TOOK, reported rather than assumed. The first
  // attempt at this raised no error and changed no privilege, and finding that
  // out cost a whole CI cycle reading a job log for a line that was never
  // written. `app_user_id()` no longer depends on them; this is how anyone can
  // tell whether a future deployment has made them unnecessary or essential.
  made.authGrants = authGrants;
  return made;
}
// Load the persisted access rules for a site's tables (from its own _meta.schema).

// Short, on purpose. The schema changes only on a build, and applySiteSchema
// clears this — but only in the isolate that ran the build, so every other PoP
// has to heal by expiry. 15s means a revise is visible on the next refresh
// rather than after a minute of a site 404ing its own new tables.
const SCHEMA_TTL_MS = 15_000;
const _schemaCache = makeCache({ ttlMs: SCHEMA_TTL_MS, max: 200 });

export function invalidateSiteSchema(uuid) { _schemaCache.delete(uuid); }

export async function loadSiteSchema(uuid) {
  const hit = _schemaCache.get(uuid);
  if (hit !== undefined) return hit;
  try {
    const rows = await sqlQuery(uuid, "SELECT v FROM _meta WHERE k='schema'");
    if (rows[0] && rows[0].v) return _schemaCache.set(uuid, JSON.parse(rows[0].v));
  } catch {}
  // An empty result is NOT cached: a site whose _meta read failed transiently
  // would otherwise serve "no tables" for the whole TTL, 404ing every read.
  return { tables: [] };
}

// Starter content for the tables a visitor READS.
//
// Without this every generated site launches empty and stays that way: writes to
// a `display` table are 403 for every caller including the owner, and no
// owner-write route exists. So the menu says "Nothing listed yet." forever — and
// worse, a booking form whose required Service field is a Select fed by that
// table renders with zero options, so no visitor can submit anything. Measured
// live on 2026-07-28: every site the builder produced was a brochure with a dead
// form. Seeding at build time is what makes a generated site usable on arrival.
//
// Only `display` tables, and only ones that are EMPTY — a revise re-runs the
// whole build, and duplicating the menu on every revise would be worse than not
// seeding at all. Values go in as bound parameters; column names are checked
// against what was actually applied, so a hallucinated column is dropped rather
// than failing the insert (the same rule the data API uses on a real write).
// `deps` is the database seam, same shape site-data.mjs and publish-pages.mjs
// use, so every decision below is testable with no Neon project.
export const MAX_SEED_ROWS = 12;

export async function seedSiteRows(uuid, spec, seed, deps) {
  const sqlQuery = (deps && deps.sqlQuery) || realSqlQuery;
  const out = { seeded: {}, skipped: [] };
  if (!seed || typeof seed !== "object") return out;
  const byName = new Map();
  for (const t of ((spec && spec.tables) || [])) if (t && t.name) byName.set(String(t.name).toLowerCase(), t);

  for (const [rawTable, rawRows] of Object.entries(seed)) {
    const t = byName.get(String(rawTable).toLowerCase());
    if (!t) { out.skipped.push(rawTable + ": not a table in this schema"); continue; }
    // Seeding a `collect` table would be fabricating customer submissions, and the
    // API refuses to read them back anyway, so there would be no way to see them.
    if (t.access !== "display") { out.skipped.push(t.name + ": only display tables are seeded (" + t.access + ")"); continue; }
    const rows = Array.isArray(rawRows) ? rawRows.slice(0, MAX_SEED_ROWS) : [];
    if (!rows.length) continue;

    const allowed = new Set((Array.isArray(t.columns) ? t.columns : [])
      .map((c) => String(typeof c === "string" ? c : (c && c.name) || "").toLowerCase())
      .filter((n) => SAFE_IDENT.test(n) && !isManagedColumn(n)));
    if (!allowed.size) { out.skipped.push(t.name + ": no writable columns"); continue; }

    // Idempotence, and the reason this is safe to run on a revise. Checked per
    // table rather than once: a schema change can add a NEW display table to a
    // site whose existing ones already have content the owner would not want
    // replaced.
    let already = true;
    try {
      const c = await sqlQuery(uuid, "SELECT 1 AS x FROM " + sqlIdent(t.name) + " LIMIT 1");
      already = Array.isArray(c) && c.length > 0;
    } catch (e) { out.skipped.push(t.name + ": " + String((e && (e.detail || e.message)) || e).slice(0, 120)); continue; }
    if (already) { out.skipped.push(t.name + ": already has rows"); continue; }

    let n = 0;
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const cols = [], vals = [];
      for (const [k, v] of Object.entries(row)) {
        const key = String(k).toLowerCase();
        if (!allowed.has(key) || v === undefined) continue;
        cols.push(sqlIdent(key));
        // Same coercion the data API applies: objects/arrays live in TEXT columns
        // as JSON, booleans as 0/1 (PG_TYPES maps boolean → INTEGER).
        vals.push(v !== null && typeof v === "object" ? JSON.stringify(v)
          : typeof v === "boolean" ? (v ? 1 : 0)
          : v);
      }
      if (!cols.length) continue;
      try {
        await sqlQuery(uuid, "INSERT INTO " + sqlIdent(t.name) + " (" + cols.join(",") + ") VALUES (" +
          cols.map(() => "?").join(",") + ")", vals);
        n++;
      } catch (e) {
        // One bad row must not cost the other eleven — a site with 3 of 4 services
        // is alive; a site with none is the failure this whole function exists for.
        out.skipped.push(t.name + " row " + (n + 1) + ": " + String((e && (e.detail || e.message)) || e).slice(0, 120));
      }
    }
    if (n) out.seeded[t.name] = n;
  }
  return out;
}

/**
 * RETIRED IS THREE-VALUED, and the third value is what stops a removed feature
 * quietly coming back.
 *
 * The schema merge is whole-object per table — this run's version REPLACES the
 * stored one — so a boolean here meant a later revise that re-listed a table
 * without mentioning `retired` wiped the flag, and a contact form the owner had
 * removed started accepting submissions from anyone with the endpoint again.
 * Silent, because nothing on the site changes: the page is still gone.
 *
 *   undefined → the designer said nothing; whatever it was, it stays
 *   true      → retire it
 *   false     → put it back
 *
 * `false` is the only way to un-retire, which is deliberate: "did not mention
 * it" and "wants it back" are different things and a boolean cannot tell them
 * apart. The tool description says so.
 */
function retiredOf(def) {
  for (const k of ["retired", "removed", "unused"]) {
    if (def && def[k] !== undefined) return !!def[k];
  }
  return undefined;
}

export function parseSchemaSpec(files) {
  const key = Object.keys(files).find((k) => /(^|\/)isibi\.schema\.json$/i.test(k));
  if (!key) return null;
  let spec = null; try { spec = JSON.parse(files[key]); } catch {}
  delete files[key];
  return spec;
}
// Pull declared edge functions out of a React build's `isibi.functions.json`
// (body `{"functions":[{"name":"x","steps":[…],"schedule":?,"verify":?}]}` or a
// bare array). Strips the file (never ships as a static asset). Returns validated
// [{name, spec}] ready for persistSiteFunctions.
