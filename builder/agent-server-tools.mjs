// THE SITE AGENT'S SERVER TOOLS (2026-10-30, the owner approved five):
// call_function, read_errors, list_keys, change_schema, read_docs.
//
// The definitions and the pure halves live here; `site-agent.mjs` offers each
// one only when its caller wired the dependency behind it (TOOL_NEEDS), and
// runs it through these functions, so every refusal is code, not instruction:
//   • call_function runs one server function in the test-run sandbox (fake
//     database, fake outside calls, no key): never the live site.
//   • read_errors hands back the site's error log, capped, cut and with
//     anything shaped like a key blanked.
//   • list_keys hands back NAMES only; a value cannot reach this module.
//   • change_schema adds a table or columns, and nothing else: a drop, a
//     rename or a type change is refused here, before anything is queued.
//   • read_docs reads official documentation from a fixed list of hosts.

export const DOCS_MAX_CHARS = 20000;
export const ERRORS_MAX = 50;
export const ERRORS_DEFAULT = 20;
export const ERROR_MSG_CHARS = 300;
export const CALL_BODY_CHARS = 4000;
export const KEYS_MAX = 50;

// ── THE DEFINITIONS ──────────────────────────────────────────────────────────
export const SERVER_TOOLS = Object.freeze([
  {
    name: "call_function",
    description: "Try one of the site's server functions (\"-parts/server-<name>\") as your workspace holds it, with a sample request, in the test sandbox: the database is a stand-in (reads answer no rows, writes are not saved), outside services answer a plausible empty reply, and no key exists. Answers the status, the response (cut) and any error it threw. Never touches the live site.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The function's name, without \"server-\"." },
        method: { type: "string", description: "GET, POST, PUT, PATCH or DELETE (default POST)." },
        body: { description: "The request body: an object is sent as JSON, a string as it is." },
        query: { type: "object", description: "Query parameters, as name: value." },
      },
      required: ["name"],
    },
  },
  {
    name: "read_errors",
    description: "Read the site's recent error log, newest first: failures of its server code and errors visitors' browsers reported. Messages are cut short.",
    input_schema: { type: "object", properties: { limit: { type: "integer", description: "How many (at most " + ERRORS_MAX + ", default " + ERRORS_DEFAULT + ")." } } },
  },
  {
    name: "list_keys",
    description: "The NAMES of the keys (secrets) the owner has set for this site, e.g. STRIPE_SECRET_KEY. Never their values. Use it to know which key a server function can use, and which one the owner still has to add.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "change_schema",
    description: "Add to the site's database: a new table (`create`), or new columns on an existing table (`add_columns`). Only additions: nothing is ever dropped, renamed or changed in type. Saved when you finish, before the table entries.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string" },
        add_columns: { type: "array", items: { type: "object", properties: { name: { type: "string" }, type: { type: "string" } }, required: ["name"] } },
        create: { type: "object", description: "A new table: { columns: [{ name, type }], access?: \"public\" | \"collect\" | \"user\" | \"owner\" }." },
      },
      required: ["table"],
    },
  },
  {
    name: "read_docs",
    description: "Read a page of official API documentation, as text (cut at " + DOCS_MAX_CHARS + " characters). Only these sites: " + "DOCS_HOSTS_LIST" + ".",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
]);

// ── read_docs ────────────────────────────────────────────────────────────────
/** Where documentation may be read from: a host, and the path it must start with ("" = any). */
export const DOCS_HOSTS = Object.freeze([
  { host: "docs.stripe.com", prefix: "" },
  { host: "stripe.com", prefix: "/docs" },
  { host: "resend.com", prefix: "/docs" },
  { host: "www.twilio.com", prefix: "/docs" },
  { host: "developers.cloudflare.com", prefix: "" },
  { host: "developer.mozilla.org", prefix: "" },
  { host: "supabase.com", prefix: "/docs" },
  { host: "neon.tech", prefix: "/docs" },
  { host: "neon.com", prefix: "/docs" },
]);
// The description names them, so the model never has to guess.
SERVER_TOOLS[4].description = SERVER_TOOLS[4].description.replace("DOCS_HOSTS_LIST", DOCS_HOSTS.map((h) => h.host + h.prefix).join(", "));
Object.freeze(SERVER_TOOLS[4]);
for (const t of SERVER_TOOLS) Object.freeze(t);

/** The URL, parsed, when documentation may be read from it; otherwise `{ ok:false, why }`. */
export function docsAllowed(raw) {
  let u;
  try { u = new URL(String(raw || "").trim()); } catch { return { ok: false, why: "not an address" }; }
  if (u.protocol !== "https:") return { ok: false, why: "only https addresses" };
  if (u.username || u.password || (u.port && u.port !== "443")) return { ok: false, why: "not a plain documentation address" };
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  const hit = DOCS_HOSTS.find((h) => h.host === host && (!h.prefix || path === h.prefix || path.startsWith(h.prefix + "/")));
  if (!hit) return { ok: false, why: "documentation is read only from " + DOCS_HOSTS.map((h) => h.host + h.prefix).join(", ") };
  u.hash = "";
  return { ok: true, url: u.toString() };
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", "#39": "'" };
/** A page's readable text: scripts, styles and markup out, entities read, blank runs closed. */
export function docsText(html, max = DOCS_MAX_CHARS) {
  let s = String(html || "");
  s = s.replace(/<(script|style|noscript|svg|iframe|template)\b[\s\S]*?<\/\1\s*>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/pre|\/section|\/article)\b[^>]*>/gi, "\n");
  s = s.replace(/<li\b[^>]*>/gi, "\n- ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+|#39);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (Object.hasOwn(ENTITIES, k)) return ENTITIES[k];
    if (k.startsWith("#x")) { const n = parseInt(k.slice(2), 16); return Number.isFinite(n) && n < 0x110000 ? String.fromCodePoint(n) : m; }
    if (k.startsWith("#")) { const n = parseInt(k.slice(1), 10); return Number.isFinite(n) && n < 0x110000 ? String.fromCodePoint(n) : m; }
    return m;
  });
  s = s.replace(/[ \t\f\v\r]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return s.length > max ? s.slice(0, max) + "\n[cut at " + max + " characters]" : s;
}

/**
 * Read one documentation page. `fetchDocs(url)` → `{ status, url, body }` (the
 * final address after redirects). The address is judged before the fetch AND
 * after it, so a redirect off the list is refused too. Never throws.
 */
export async function readDocs(fetchDocs, raw) {
  const a = docsAllowed(raw);
  if (!a.ok) return { error: a.why };
  if (typeof fetchDocs !== "function") return { error: "documentation cannot be read here" };
  let r;
  try { r = await fetchDocs(a.url); } catch (e) { return { error: "the page could not be read: " + String((e && e.message) || e).slice(0, 160) }; }
  if (!r || typeof r !== "object") return { error: "the page could not be read" };
  if (r.url && !docsAllowed(r.url).ok) return { error: "the page moved off the documentation sites, so it was not read" };
  if (!(r.status >= 200 && r.status < 300)) return { error: "the documentation site answered " + Number(r.status || 0) };
  const text = docsText(r.body);
  if (!text) return { error: "the page had no readable text" };
  return { text: "From " + (r.url || a.url) + ":\n" + text, host: new URL(r.url || a.url).hostname };
}

// ── SECRETS NEVER LEAVE ──────────────────────────────────────────────────────
// Anything shaped like a key is blanked before text from the site reaches the
// model: provider prefixes, bearer tokens, long opaque runs.
const KEY_SHAPES = [
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{6,}/g,
  /\bwhsec_[A-Za-z0-9+/=]{6,}/g,
  /\b(?:re|xai|sk-ant|sk-proj|sk|ghp|gho|github_pat|AKIA|SG\.)[-_][A-Za-z0-9._-]{12,}/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\b(?:postgres(?:ql)?|mysql|redis):\/\/[^\s'"]+/gi,
  /\b[A-Za-z0-9+/_-]{40,}={0,2}/g,
];
export function redactSecrets(text) {
  let s = String(text == null ? "" : text);
  for (const re of KEY_SHAPES) s = s.replace(re, "[hidden]");
  return s;
}

// ── read_errors ──────────────────────────────────────────────────────────────
export function errorsLimit(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, ERRORS_MAX) : ERRORS_DEFAULT;
}
/** The log's rows as lines, newest first, capped and cut; never a stack. */
export function errorLines(rows, limit = ERRORS_DEFAULT) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === "object")
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0)).slice(0, errorsLimit(limit));
  if (!list.length) return "The error log is empty: nothing has been recorded.";
  const one = (r) => "- " + [r.at && String(r.at).slice(0, 25), r.source && "[" + String(r.source).slice(0, 20) + "]", r.route && String(r.route).slice(0, 80)].filter(Boolean).join(" ") + ": " + redactSecrets(String(r.message || "").slice(0, ERROR_MSG_CHARS));
  return "The site's error log, newest first (" + list.length + "):\n" + list.map(one).join("\n");
}

// ── list_keys ────────────────────────────────────────────────────────────────
const KEY_NAME = /^[A-Z][A-Z0-9_]{0,63}$/;
/** Names only, from whatever the reader handed back: a value can never pass. */
export function keyNames(rows) {
  const names = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const n = typeof r === "string" ? r : r && typeof r === "object" && typeof r.name === "string" ? r.name : "";
    if (KEY_NAME.test(n) && !names.includes(n)) names.push(n);
  }
  return names.sort().slice(0, KEYS_MAX);
}

// ── change_schema ────────────────────────────────────────────────────────────
export const COLUMN_TYPES = Object.freeze(["text", "int", "integer", "bigint", "numeric", "boolean", "uuid", "date", "timestamptz", "json", "jsonb"]);
const ACCESS = new Set(["public", "collect", "user", "owner", "admin"]);
const IDENT = /^[a-z][a-z0-9_]{0,40}$/;
const RESERVED = new Set(["id", "owner_id", "created_at", "updated_at"]);
// Words for what this tool will never do; any of these keys in the input is refused.
const DESTRUCTIVE = ["drop", "drop_columns", "remove", "remove_columns", "rename", "rename_columns", "alter", "alter_columns", "change_type", "type_changes", "truncate", "delete", "replace"];

/**
 * One change_schema call, judged against the tables the site has. Answers
 * `{ ok:true, op }` (op = `{ table, create?: {columns, access}, add?: [cols] }`)
 * or `{ ok:false, why }`. Only additions pass.
 */
export function schemaChange(input, tables) {
  const i = input && typeof input === "object" ? input : {};
  const bad = DESTRUCTIVE.filter((k) => Object.hasOwn(i, k));
  if (bad.length) return { ok: false, why: "only additions: a table or a column is never dropped, renamed or changed in type (" + bad.join(", ") + "). Say in finish what the change would need" };
  const t = typeof i.table === "string" ? i.table.trim() : "";
  if (!IDENT.test(t)) return { ok: false, why: "a table name is lowercase letters, digits and _, starting with a letter" };
  const have = (Array.isArray(tables) ? tables : []).find((x) => x && x.name === t);
  const col = (c, where) => {
    if (!c || typeof c !== "object" || Array.isArray(c)) return { why: where + ": a column is { name, type }" };
    const extra = Object.keys(c).filter((k) => k !== "name" && k !== "type");
    if (extra.length) return { why: where + ": a column here is only { name, type } (" + extra.join(", ") + ")" };
    const n = typeof c.name === "string" ? c.name.trim() : "";
    if (!IDENT.test(n)) return { why: where + ": a column name is lowercase letters, digits and _" };
    if (RESERVED.has(n)) return { why: where + ": " + n + " is made for every table already" };
    const ty = c.type == null ? "text" : typeof c.type === "string" ? c.type.trim().toLowerCase() : "";
    if (!COLUMN_TYPES.includes(ty)) return { why: where + ": a column type is one of " + COLUMN_TYPES.join(", ") };
    return { col: { name: n, type: ty } };
  };
  const hasCreate = i.create != null, hasAdd = i.add_columns != null;
  if (hasCreate === hasAdd) return { ok: false, why: "give either create (a new table) or add_columns (new columns on a table it has)" };
  if (hasCreate) {
    if (have) return { ok: false, why: "the site already has a table " + t + "; add columns to it instead" };
    const c = i.create;
    if (!c || typeof c !== "object" || Array.isArray(c)) return { ok: false, why: "create is { columns, access? }" };
    const extra = Object.keys(c).filter((k) => k !== "columns" && k !== "access");
    if (extra.length) return { ok: false, why: "create takes only columns and access (" + extra.join(", ") + ")" };
    const access = c.access == null ? "owner" : String(c.access);
    if (!ACCESS.has(access)) return { ok: false, why: "access is one of " + [...ACCESS].join(", ") };
    const raw = Array.isArray(c.columns) ? c.columns : [];
    if (!raw.length || raw.length > 40) return { ok: false, why: "a new table has 1 to 40 columns" };
    const cols = [];
    for (const r of raw) { const x = col(r, t); if (x.why) return { ok: false, why: x.why }; if (cols.some((y) => y.name === x.col.name)) return { ok: false, why: t + ": the column " + x.col.name + " is named twice" }; cols.push(x.col); }
    return { ok: true, op: { table: t, create: { columns: cols, access } } };
  }
  if (!have) return { ok: false, why: "the site has no table " + t + (tables && tables.length ? "; its tables are " + tables.map((x) => x.name).join(", ") : "") + ". Use create for a new one" };
  const raw = Array.isArray(i.add_columns) ? i.add_columns : [];
  if (!raw.length || raw.length > 20) return { ok: false, why: "add 1 to 20 columns at a time" };
  const cols = [];
  const existing = new Set((have.columns || []).map((c) => (typeof c === "string" ? c : c && c.name)).filter(Boolean));
  for (const r of raw) {
    const x = col(r, t);
    if (x.why) return { ok: false, why: x.why };
    if (existing.has(x.col.name)) return { ok: false, why: t + " already has a column " + x.col.name + " (a column's type is never changed here)" };
    if (cols.some((y) => y.name === x.col.name)) return { ok: false, why: t + ": the column " + x.col.name + " is named twice" };
    cols.push(x.col);
  }
  return { ok: true, op: { table: t, add: cols } };
}

/**
 * The stored schema with the queued additions folded in, for the builder's
 * own apply. Every table and column the stored schema had is kept exactly;
 * an op that would collide is skipped and named. Answers `{ spec, added, skipped }`.
 */
export function mergeSchemaOps(stored, ops) {
  const base = stored && typeof stored === "object" ? stored : {};
  const tables = (Array.isArray(base.tables) ? base.tables : []).map((t) => ({ ...t, columns: Array.isArray(t.columns) ? t.columns.slice() : [] }));
  const added = [], skipped = [];
  for (const op of Array.isArray(ops) ? ops : []) {
    const at = tables.find((t) => t && t.name === op.table);
    if (op.create) {
      if (at) { skipped.push(op.table); continue; }
      tables.push({ name: op.table, access: op.create.access, columns: op.create.columns.map((c) => ({ name: c.name, type: c.type })) });
      added.push(op.table);
    } else if (Array.isArray(op.add)) {
      if (!at) { skipped.push(op.table); continue; }
      const have = new Set(at.columns.map((c) => (typeof c === "string" ? c : c && c.name)));
      const fresh = op.add.filter((c) => !have.has(c.name));
      if (fresh.length < op.add.length) skipped.push(op.table);
      if (fresh.length) { at.columns.push(...fresh.map((c) => ({ name: c.name, type: c.type }))); added.push(op.table + "(" + fresh.map((c) => c.name).join(", ") + ")"); }
    }
  }
  return { spec: { ...base, tables }, added, skipped };
}

/** True when every table and column of `before` is still in `after`: the guard on the merged spec. */
export function keepsEverything(before, after) {
  const names = (t) => new Set((t.columns || []).map((c) => (typeof c === "string" ? c : c && c.name)));
  for (const t of (before && before.tables) || []) {
    const a = ((after && after.tables) || []).find((x) => x && x.name === t.name);
    if (!a) return false;
    const have = names(a);
    for (const c of names(t)) if (!have.has(c)) return false;
    for (const c of t.columns || []) {
      if (!c || typeof c !== "object") continue;
      const ac = (a.columns || []).find((x) => x && typeof x === "object" && x.name === c.name);
      if (ac && c.type && ac.type && String(ac.type).toLowerCase() !== String(c.type).toLowerCase()) return false;
    }
  }
  return true;
}

// ── call_function ────────────────────────────────────────────────────────────
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
/** The call, judged: `{ ok:true, call }` or `{ ok:false, why }`. */
export function callRequest(input, partNames) {
  const i = input && typeof input === "object" ? input : {};
  const name = typeof i.name === "string" ? i.name.trim().replace(/^-parts\//, "").replace(/^server-/, "") : "";
  if (!/^[a-z0-9][a-z0-9-]{0,55}$/i.test(name)) return { ok: false, why: "name a server function (the part \"-parts/server-<name>\", without \"server-\")" };
  if (!(partNames || []).includes("server-" + name)) return { ok: false, why: "no server function " + name + " in your workspace" + ((partNames || []).some((n) => n.startsWith("server-")) ? "; it has " + partNames.filter((n) => n.startsWith("server-")).map((n) => n.slice(7)).join(", ") : "") };
  const method = i.method == null ? "POST" : String(i.method).toUpperCase();
  if (!METHODS.has(method)) return { ok: false, why: "a method is GET, POST, PUT, PATCH or DELETE" };
  let body = null;
  if (i.body != null) {
    if (method === "GET") return { ok: false, why: "a GET request has no body; use query" };
    body = typeof i.body === "string" ? i.body : JSON.stringify(i.body);
    if (body.length > 20000) return { ok: false, why: "the sample body is over 20,000 characters" };
  }
  const query = {};
  if (i.query != null) {
    if (typeof i.query !== "object" || Array.isArray(i.query)) return { ok: false, why: "query is { name: value }" };
    for (const [k, v] of Object.entries(i.query).slice(0, 20)) query[String(k).slice(0, 60)] = String(v).slice(0, 500);
  }
  return { ok: true, call: { name, method, body, query, json: i.body != null && typeof i.body !== "string" } };
}
/** What the sandbox answered, as the agent reads it. */
export function callAnswer(r) {
  if (!r || typeof r !== "object") return { error: "the test run gave no answer" };
  if (r.ran === false) return { error: "the function could not be run: " + String(r.why || "no reason").slice(0, 200) };
  const x = Array.isArray(r.results) ? r.results[0] : r;
  if (!x || typeof x !== "object") return { error: "the test run gave no answer" };
  const lines = [];
  if (typeof x.status === "number") lines.push("Status " + x.status + (x.contentType ? " (" + String(x.contentType).slice(0, 60) + ")" : ""));
  if (typeof x.body === "string") lines.push("Response:\n" + (x.body.length > CALL_BODY_CHARS ? x.body.slice(0, CALL_BODY_CHARS) + "\n[cut]" : x.body || "(empty)"));
  if (x.error) lines.push("It threw: " + String(x.error).slice(0, 400) + (x.kind === "code" ? " (a mistake in the code)" : ""));
  const keys = Array.isArray(x.keys) && x.keys.length ? "Keys it asked for: " + x.keys.slice(0, 12).join(", ") : "";
  const calls = Array.isArray(x.calls) && x.calls.length ? "Outside calls (answered by the sandbox): " + x.calls.slice(0, 10).map((c) => c.method + " " + c.host).join(", ") : "";
  const sql = Array.isArray(x.sql) && x.sql.length ? "Database statements (not run on the live site): " + x.sql.length : "";
  for (const l of [keys, calls, sql]) if (l) lines.push(l);
  lines.push("This was the test sandbox: nothing was saved, nothing was sent, no key was used.");
  return { text: redactSecrets(lines.join("\n")), status: typeof x.status === "number" ? x.status : 0, threw: !!x.error };
}
