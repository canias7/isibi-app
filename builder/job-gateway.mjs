// THE JOB GATEWAY — how a job running inside the site's container reaches the
// Worker's storage, and nothing else's.
//
// ── WHY A GATEWAY AND NOT A CREDENTIAL (2026-09-04) ──────────────────────────
//
// The Worker's own module runs inside the container for a queued job
// (worker-loader.mjs), and that module reads and writes R2 through
// `env.SITES_BUCKET` — 141 call sites. The container has no bindings, so the
// bucket it is handed (container-env.mjs) is a shim that speaks HTTP back to the
// Worker, and THIS module is both ends of that conversation: the request shapes
// the shim sends, and the handler the Worker mounts under `/api/job/<id>/…`.
// One module for both halves, so the protocol has one definition and the shim
// is driven against the real handler in tests.
//
// An R2 API token in the container would have been the cheap alternative, and
// it is wrong twice: a bucket token cannot be scoped to one site's keys, and the
// container executes model-written page code in a child (build-keys.mjs) — a
// credential for every customer's site, in the one process that must never hold
// one. The gateway holds nothing: the job carries a SIGNED, EXPIRING token that
// names the job, its site and its owner, and every key it asks for is checked
// against that site.
//
// ── THE TOKEN ────────────────────────────────────────────────────────────────
//
// `v1.<payload>.<signature>` — the payload `{ id, slug, uid, exp }` as base64url
// JSON, the signature HMAC-SHA256 over `v1.<payload>` with a key DERIVED from the
// platform's secrets key (`gatewayKey`), never that key itself. Minted by the
// consumer when it fires the job, verified on every request; nothing is stored,
// so a gateway request costs no read before the R2 call it carries. It expires
// with the job's own clock and a little grace.
//
// A BUILD WITH NO NAME YET (stage 5b, 2026-09-06) carries a PRE-SCOPE token:
// `pre: true` in the payload and the placeholder `pre-<id>` as its slug
// (`preScopeSlug`), refused at the mint AND at the reader if the two disagree.
// It opens the job's own objects and the id- and uid-bound calls, nothing of
// any site — and is re-minted for the site's real name by the `/scope` op the
// moment the designer gives one.
//
// ── THE SCOPE ────────────────────────────────────────────────────────────────
//
// `allowedJobKey(slug, id, key)` is the wall: a site's own prefixes (`sites/`,
// `source/`, `versions/`, `uploads/`, `backups/`, `builds/`), its one config
// object, its pointer, its sidecar, its orphan marker, and
// the job's own objects under `jobs/` — read out of the key builders the code
// uses, not guessed. A key outside it is refused with 403 and LOGGED with the
// key, so the first live job on a site says exactly which key it needed that
// this list lacks, and the answer is a line here, never a wider wall. Under a
// pre-scope token (`pre`) only the job's own objects pass.
//
// ── THE OPS ──────────────────────────────────────────────────────────────────
//
//   GET    /r2?key=      the object: bytes as the body, metadata as headers
//   HEAD   /r2?key=      the metadata alone
//   PUT    /r2?key=      write: bytes as the body, metadata as headers, the
//                        `onlyIf` conditions as `x-gf-if-*` headers; 412 when a
//                        condition fails, which the shim answers as R2 does: null
//   DELETE /r2?key=      one object; POST /r2/delete {keys} for several
//   POST   /r2/list      {prefix, cursor, limit, delimiter} → the listing
//   POST   /scope        {slug} → a pre-scope token re-minted for that name
//                        (stage 5b; the rules on `gatewayHandler`)
//
// Metadata rides as headers because R2 keeps it beside the bytes and a JSON
// envelope would mean base64 for every dist file. `x-gf-meta-<name>` carries a
// custom-metadata entry (the value URL-encoded, since a header cannot carry a
// newline), `x-gf-http-<field>` an http-metadata field other than the content
// type, which is the `content-type` header itself.
//
// ── SUPABASE THROUGH THE SAME DOOR (stage 4b, 2026-09-06) ────────────────────
//
// The job process used to hold the platform's SERVICE KEY and the CREDIT MINT
// SECRET — the two credentials that open every site's rows and every
// customer's ledger — for the length of the job, because the Worker's code
// reaches Postgres directly (`editRpc`, `svcHeaders`, and the PostgREST reads
// and writes the edit and addon routes make). Now the job holds neither: the
// container's env carries `SB_MARKER` under both names, the fetch shim
// (container-env.mjs) sends any Supabase request that presents the marker to
// `/sb/<path>` here with the job token, and THIS handler injects the real key
// and the real mint before forwarding — for the RPCs and the tables a job
// has business with, each bound to the job's own row, its site or its owner
// (`SB_RPCS`, `SB_TABLES`, `sbDecision`). A request outside that is 403 and
// LOGGED with the op, so the first live job says which call it needed that the
// list lacks, and the answer is a line here, never the key back in the
// container. The customer's own calls (the anon key with the customer's JWT)
// never carried a platform secret and are not routed here.
//
//   POST   /sb/rest/v1/rpc/<fn>     the body's `p_mint` (the marker) becomes the
//                                   real mint; the binding argument must name
//                                   the job, its site or its owner
//   GET    /sb/rest/v1/<table>?…    the bound filter must be present as `eq.`
//   POST   /sb/rest/v1/<table>?…    every row carries the bound fields
//   DELETE /sb/rest/v1/<table>?…    the bound filter must be present
//
// A non-2xx answer to an RPC is passed back as its STATUS with a scrubbed
// body — PostgREST quotes the request that produced an error, and that request
// carries the mint, which is the one thing this branch exists to keep out of
// the container. A table error keeps its body: nothing in a table request is
// a platform secret, and the sentence the customer reads names the constraint.
//
// Dependency-free: `crypto.subtle` is what both runtimes have.

/**
 * The value the job's env carries under `SUPABASE_SERVICE_KEY` and
 * `CREDITS_MINT_SECRET` inside the container: never a credential, a tell. The
 * Worker's helpers see a truthy string and proceed; the shim sees the marker
 * on the wire and routes the request here; and a request that somehow reached
 * Supabase with it would be a 401, which is the safe direction.
 */
export const SB_MARKER = "gf-gateway";

/**
 * THE RPCs A JOB MAY CALL, and the argument that binds each to the job.
 * `id` / `slug` / `uid` name the token's field the argument must equal; a
 * trailing `?` binds only when the argument is present and not null (a
 * handoff names the slug when it sets one); `build-ref` is a reversal's ref,
 * which must be the job's own (`build:<id>…`, the refs stage 1c mints).
 * Everything else — the sweeps, the gate's set and clear, `edit_create`,
 * `add_credits`, `rebuild_claim` — is a Worker's call and is refused by name.
 */
export const SB_RPCS = {
  edit_claim: { p_id: "id" },
  edit_handoff: { p_id: "id", p_slug: "slug?" },
  edit_beat: { p_id: "id" },
  edit_reserve: { p_id: "id" },
  edit_exempt: { p_id: "id" },
  edit_may_publish: { p_id: "id" },
  edit_publish_mark: { p_id: "id" },
  edit_committed: { p_id: "id" },
  edit_finalize: { p_id: "id" },
  edit_refund: { p_id: "id" },
  edit_reconcile: { p_id: "id" },
  edit_phase_write: { p_id: "id" },
  deploy_gate_read: {},
  credit_reverse: { p_target: "uid", p_ref: "build-ref" },
  // A BUILD'S OWN DEBIT, for the container-run build whose customer's bearer
  // has expired (2026-10-08, Codex's review of `b4300a07`; the function is
  // the proposed `supabase/proposed/build_debit.sql`, not applied). Bound three
  // ways: the job's own id, the job's own account, and EXACTLY one of the
  // job's own three refs — never a prefix. The function itself refuses a row
  // that is not a live build of that account.
  build_debit: { p_id: "id", p_uid: "uid", p_ref: "build-step-ref" },
};

/** The three refs a build may debit under, exactly. */
export const BUILD_STEP_REFS = (id) => ["deposit", "settle", "pages"].map((step) => "build:" + id + ":" + step);

/**
 * THE TABLES A JOB MAY TOUCH, per method. `filter` names the query parameter
 * that must be present as `eq.<the token's field>` (PostgREST ANDs top-level
 * filters, so one bound filter confines every read and every delete, whatever
 * else the query says); `rows` names the fields every row of a write must
 * carry with the token's value. A method not listed is refused; the one
 * `PATCH` is site_backends' blank database name (`unset` names the extra
 * query the update must carry, `set` the only fields it may write).
 */
export const SB_TABLES = {
  edit_traces: { POST: { rows: { slug: "slug", uid: "uid" } } },
  edit_jobs: { GET: { filter: { id: "id" } } },
  // `exists` (2026-10-18, audit A03-1/S1-1): "is this name a site?" for ANY
  // name, answering the name alone — never its owner or connection — so a
  // job's rename check is never blind (a refused lookup read as "free").
  // PATCH (2026-10-18, audit A04-2/A09-1): the ONE update a job makes — the
  // database name onto its own site's row, only while that row's name is
  // still blank (`healSiteBackendDb`). Without it a database first made in a
  // container left the site's link blank, and every visitor call 404'd.
  site_backends: {
    // `own` (2026-10-18, audit A01-1/A08-3/S1-3): the job's OWN ACCOUNT's
    // rows — `uid` bound to the token, a few plain columns — so a first
    // build finds its chat's site and the account's names ("you already have
    // a site in this chat", the fresh-name rule). Never another account's.
    GET: { filter: { slug: "slug" }, exists: "slug", own: { uid: "uid", select: ["slug", "neon_db", "brief", "chat_id"] } },
    POST: { rows: { slug: "slug", uid: "uid" } },
    PATCH: { filter: { slug: "slug", uid: "uid" }, unset: { or: "(neon_db.is.null,neon_db.eq.)" }, set: { neon_db: /^[a-z0-9_]{1,63}$/ } },
  },
  site_project: { GET: { filter: { slug: "slug" } }, POST: { rows: { slug: "slug", uid: "uid" } } },
  // `columns` and `claim` (2026-10-23, audit A33-9): a read names only the
  // public columns (never `uid`), and a write may not take a name whose row
  // belongs to another site — PostgREST's merge-duplicates would otherwise
  // repoint that site's address at this one (checked by the handler, which
  // reads the names' rows before forwarding).
  site_aliases: { GET: { columns: ["alias", "slug", "current", "created_at"] }, POST: { rows: { slug: "slug", uid: "uid" }, claim: "alias", storage: "site_backends" }, DELETE: { filter: { slug: "slug" } } },
  site_functions: { GET: { filter: { slug: "slug" } }, POST: { rows: { slug: "slug", owner_id: "uid" } } },
  site_builds: { POST: { rows: { slug: "slug" } } },
  credits: { GET: { filter: { user_id: "uid" } } },
  // A LOST PAGES-DEBIT ANSWER, READ BACK BY REF (2026-10-08, Codex's review
  // of `b4300a07`): the job's own account and exactly one of its own three
  // build refs, so a container-run build can tell "debited" from "unknown"
  // and can read nothing of any other job or account.
  credit_events: { GET: { filter: { uid: "uid", ref: "build-step-ref" } } },
  // `probe` (2026-10-22, audit A01-4): "is this database project queued for
  // teardown?" (`neonTearingDown`), asked by a provision settling its own
  // attempt note. Exactly one project id, `select=id`, `limit=1`: it answers
  // whether that one project is going away, never which ones are. Refused,
  // one unclaimed project blocked the site's database for good.
  neon_teardown: { GET: { probe: { col: "project_id", select: "id", re: /^[a-z0-9][a-z0-9-]{0,63}$/ } } },
};

/** The request headers forwarded to Supabase, and the response headers handed back. */
export const SB_REQUEST_HEADERS = ["content-type", "prefer", "accept", "accept-profile", "content-profile", "range"];
export const SB_RESPONSE_HEADERS = ["content-type", "content-range", "preference-applied"];
/** A Supabase request's body cap, and how long the forward may take. */
export const SB_MAX_BODY = 1 << 20;
export const SB_TIMEOUT_MS = 20_000;

const NAME_RE = /^[a-z_][a-z0-9_]{0,62}$/;

/** Is this query exactly an existence read of one name in `col`? */
function existenceRead(params, col) {
  const keys = [...params.keys()];
  if (keys.some((k) => k !== col && k !== "select" && k !== "limit")) return false;
  if (params.getAll(col).length !== 1 || params.getAll("select").length !== 1 || params.getAll("limit").length > 1) return false;
  if (params.get("select") !== col) return false;
  if (params.has("limit") && !/^[1-9]$/.test(params.get("limit"))) return false;
  const v = params.get(col);
  return typeof v === "string" && v.startsWith("eq.") && SLUG_RE.test(v.slice(3));
}

/** Is this query exactly a probe of one value: `<col>=eq.<value>`, `select=<select>`, `limit=1`, nothing else? */
function probeRead(params, probe) {
  const keys = [...params.keys()];
  if (keys.length !== 3 || keys.some((k) => k !== probe.col && k !== "select" && k !== "limit")) return false;
  if (params.getAll(probe.col).length !== 1 || params.get("select") !== probe.select || params.get("limit") !== "1") return false;
  const v = params.get(probe.col);
  return typeof v === "string" && v.startsWith("eq.") && probe.re.test(v.slice(3));
}

/** Is this query a read of the token's own account's rows, in plain columns only? */
function ownRead(who, params, own) {
  if (!who || typeof who.uid !== "string" || !who.uid) return false;
  for (const k of new Set(params.keys())) if (params.getAll(k).length !== 1) return false;
  if (params.get("uid") !== "eq." + who.uid) return false;
  const sel = params.get("select");
  if (!sel || !sel.split(",").every((c) => own.select.includes(c))) return false;
  for (const k of params.keys()) {
    if (k === "uid" || k === "select") continue;
    if (k === "limit") { if (!/^[1-9][0-9]{0,2}$/.test(params.get(k))) return false; continue; }
    if (k === "order") { if (!/^(created_at|slug)\.(asc|desc)$/.test(params.get(k))) return false; continue; }
    if (!own.select.includes(k) || !/^eq\./.test(params.get(k))) return false;
  }
  return true;
}

/** The token's field a binding word names. */
function boundValue(who, word) {
  const w = String(word).replace(/\?$/, "");
  if (w === "id") return who.id;
  if (w === "slug") return who.slug;
  if (w === "uid") return who.uid;
  return undefined;
}

/**
 * MAY THIS JOB MAKE THIS SUPABASE REQUEST? `who` is the token's payload,
 * `path` the Supabase path (`/rest/v1/rpc/edit_beat`), `search` the query
 * string (with or without its `?`), `text` the body as sent. Answers
 * `{ ok: true, body }` — the body to FORWARD, re-serialised from what was
 * checked so a duplicate key cannot pass one value to the check and another
 * to Postgres, with `p_mint` replaced by `mint` when the marker was sent — or
 * `{ ok: false, why }`. Pure, so every rule is driven with literals.
 */
export function sbDecision(who, method, path, search, text, mint) {
  const m = String(method || "GET").toUpperCase();
  const p = String(path || "");
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const sel = params.get("select");
  if (sel && /[(!]/.test(sel)) return { ok: false, why: "embed" };
  const rpc = /^\/rest\/v1\/rpc\/([^/?]+)$/.exec(p);
  if (rpc) {
    const fn = rpc[1];
    if (m !== "POST") return { ok: false, why: "method" };
    if (!NAME_RE.test(fn) || !Object.hasOwn(SB_RPCS, fn)) return { ok: false, why: "rpc" };
    let body;
    try { body = JSON.parse(String(text || "{}")); } catch { return { ok: false, why: "body" }; }
    if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, why: "body" };
    for (const [arg, word] of Object.entries(SB_RPCS[fn])) {
      const v = body[arg];
      if (word === "build-step-ref") {
        if (typeof v !== "string" || !who.id || !BUILD_STEP_REFS(who.id).includes(v)) return { ok: false, why: "bind:" + arg };
        continue;
      }
      if (word === "build-ref") {
        if (typeof v !== "string" || !v.startsWith("build:" + who.id)) return { ok: false, why: "bind:" + arg };
        continue;
      }
      if (String(word).endsWith("?") && (v === undefined || v === null)) continue;
      // A PRE-SCOPED JOB NAMES NO SITE (stage 5b): a slug-bound argument is
      // refused whatever it says — the placeholder included.
      if (who.pre === true && String(word).replace(/\?$/, "") === "slug") return { ok: false, why: "bind:" + arg };
      if (v !== boundValue(who, word)) return { ok: false, why: "bind:" + arg };
    }
    if (Object.hasOwn(body, "p_mint")) {
      if (body.p_mint !== SB_MARKER) return { ok: false, why: "mint" };
      body.p_mint = mint;
    }
    return { ok: true, body: JSON.stringify(body) };
  }
  const tbl = /^\/rest\/v1\/([^/?]+)$/.exec(p);
  if (!tbl) return { ok: false, why: "path" };
  const table = tbl[1];
  if (!NAME_RE.test(table) || !Object.hasOwn(SB_TABLES, table)) return { ok: false, why: "table" };
  const rule = SB_TABLES[table][m];
  if (!rule) return { ok: false, why: "method" };
  // AN EXISTENCE READ: exactly `<col>=eq.<a valid name>`, `select=<col>` and
  // an optional `limit`, nothing else — it answers which names exist, which
  // every site's public address already tells.
  if (rule.exists && (m === "GET" || m === "HEAD") && existenceRead(params, rule.exists)) return { ok: true, body: undefined };
  if (rule.own && (m === "GET" || m === "HEAD") && ownRead(who, params, rule.own)) return { ok: true, body: undefined };
  if (rule.probe) return probeRead(params, rule.probe) ? { ok: true, body: undefined } : { ok: false, why: "probe" };
  for (const [param, word] of Object.entries(rule.filter || {})) {
    if (who.pre === true && word === "slug") return { ok: false, why: "filter:" + param };
    if (word === "build-step-ref") {
      const v = params.get(param);
      if (typeof v !== "string" || !v.startsWith("eq.") || !who.id || !BUILD_STEP_REFS(who.id).includes(v.slice(3))) return { ok: false, why: "filter:" + param };
      continue;
    }
    if (params.get(param) !== "eq." + boundValue(who, word)) return { ok: false, why: "filter:" + param };
  }
  if (rule.columns) {
    const cols = new Set(rule.columns);
    if (!sel || !sel.split(",").every((c) => cols.has(c))) return { ok: false, why: "select" };
    for (const k of params.keys()) {
      if (k === "select" || k === "limit") continue;
      if (k === "order") { if (!cols.has(String(params.get(k)).split(".")[0])) return { ok: false, why: "query:order" }; continue; }
      if (!cols.has(k)) return { ok: false, why: "query:" + k };
    }
  }
  if (m === "GET" || m === "HEAD" || m === "DELETE") return { ok: true, body: undefined };
  if (m === "PATCH") {
    if (who.pre === true) return { ok: false, why: "method" };
    const allowed = new Set([...Object.keys(rule.filter || {}), ...Object.keys(rule.unset || {})]);
    for (const k of params.keys()) if (!allowed.has(k) || params.getAll(k).length !== 1) return { ok: false, why: "query:" + k };
    for (const [k, v] of Object.entries(rule.unset || {})) if (params.get(k) !== v) return { ok: false, why: "query:" + k };
    let pb;
    try { pb = JSON.parse(String(text || "")); } catch { return { ok: false, why: "body" }; }
    if (!pb || typeof pb !== "object" || Array.isArray(pb)) return { ok: false, why: "body" };
    const keys = Object.keys(pb);
    if (!keys.length) return { ok: false, why: "body" };
    for (const k of keys) {
      const re = rule.set && Object.hasOwn(rule.set, k) ? rule.set[k] : null;
      if (!re || typeof pb[k] !== "string" || !re.test(pb[k])) return { ok: false, why: "set:" + k };
    }
    return { ok: true, body: JSON.stringify(pb) };
  }
  // A CLAIMING WRITE TAKES NO QUERY (A16-4, 2026-10-23): no `on_conflict`
  // naming another column, no `columns`, nothing that changes which row a
  // merge lands on. The name column is the conflict target by itself.
  if (rule.claim) for (const k of params.keys()) return { ok: false, why: "query:" + k };
  let body;
  try { body = JSON.parse(String(text || "")); } catch { return { ok: false, why: "body" }; }
  const rows = Array.isArray(body) ? body : [body];
  if (!rows.length) return { ok: false, why: "body" };
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return { ok: false, why: "body" };
    for (const [field, word] of Object.entries(rule.rows || {})) {
      if (who.pre === true && word === "slug") return { ok: false, why: "row:" + field };
      if (row[field] !== boundValue(who, word)) return { ok: false, why: "row:" + field };
    }
    if (rule.claim && (typeof row[rule.claim] !== "string" || !SLUG_RE.test(row[rule.claim]))) return { ok: false, why: "row:" + rule.claim };
  }
  if (rule.claim) return { ok: true, body: JSON.stringify(body), claims: { table, col: rule.claim, names: rows.map((r) => r[rule.claim]), ...(rule.storage ? { storage: rule.storage } : {}) } };
  return { ok: true, body: JSON.stringify(body) };
}

/**
 * MAY THIS JOB CLAIM THESE NAMES? (audit A33-9.) Reads the names' rows with the
 * service key and answers true only when every existing one is the job's own
 * site's; a read that fails or answers in another shape is a refusal.
 */
export async function claimsOwn(who, claims, { url, key, fetch: f = globalThis.fetch, timeoutMs = SB_TIMEOUT_MS }) {
  const list = claims.names.map((n) => encodeURIComponent('"' + n + '"')).join(",");
  try {
    const r = await (f || globalThis.fetch)(String(url).replace(/\/+$/, "") + "/rest/v1/" + claims.table + "?" + claims.col + "=in.(" + list + ")&select=" + claims.col + ",slug", {
      method: "GET", headers: { apikey: key, authorization: "Bearer " + key }, signal: AbortSignal.timeout(timeoutMs || SB_TIMEOUT_MS),
    });
    if (!r.ok) return false;
    const rows = await r.json();
    if (!(Array.isArray(rows) && rows.every((x) => x && typeof x === "object" && x.slug === who.slug))) return false;
    // A NAME THAT IS ANOTHER SITE'S STORAGE NAME (A16-4, 2026-10-23): an
    // unused alias equal to another site's slug would take that site's
    // address. Every existing site row named must be the job's own site.
    if (!claims.storage) return true;
    const s = await (f || globalThis.fetch)(String(url).replace(/\/+$/, "") + "/rest/v1/" + claims.storage + "?slug=in.(" + list + ")&select=slug", {
      method: "GET", headers: { apikey: key, authorization: "Bearer " + key }, signal: AbortSignal.timeout(timeoutMs || SB_TIMEOUT_MS),
    });
    if (!s.ok) return false;
    const sites = await s.json();
    return Array.isArray(sites) && sites.every((x) => x && typeof x === "object" && x.slug === who.slug);
  } catch { return false; }
}

const B64 = {
  encode(bytes) {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode(str) {
    const s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
    const bin = atob(s + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

const TE = new TextEncoder();
const TD = new TextDecoder();

/**
 * WHERE THE GATEWAY'S SIGNING KEY COMES FROM (audit finding 31, A16-1 and
 * A12-7, 2026-10-22). Every name here is the WORKER'S ALONE: none may be in
 * `JOB_ENV_NAMES` (edit-job.mjs), and a launch carrying any of them is refused
 * by the runner (`LAUNCH_NEVER`, container-job.mjs). Until this date the key
 * was derived from SITE_SECRETS_KEY and that name was handed to every job, so
 * a job process (the box that runs model-written page code in a child) could
 * mint a valid token for any job id, site and account, and decrypt every
 * owner's stored Stripe and mail keys with the same value.
 *
 * GATEWAY_SIGNING_KEY is the dedicated secret, used when it holds at least
 * `GATEWAY_KEY_MIN` characters (the deploy's `not-a-key` placeholder for an
 * unset secret is shorter, so it reads as unset). Without it the key is
 * derived from SITE_SECRETS_KEY as before, which is still the Worker's alone
 * now that no job is handed it; tokens in flight keep verifying across the
 * deploy. Setting GATEWAY_SIGNING_KEY later ends the tokens of jobs running at
 * that moment, once.
 */
export const GATEWAY_KEY_NAMES = ["GATEWAY_SIGNING_KEY", "SITE_SECRETS_KEY"];
export const GATEWAY_KEY_MIN = 32;

/** The secret the gateway key derives from, `{ name, secret }`, or null. */
export function gatewaySecretOf(env) {
  const own = env && typeof env.GATEWAY_SIGNING_KEY === "string" ? env.GATEWAY_SIGNING_KEY : "";
  if (own.length >= GATEWAY_KEY_MIN) return { name: "GATEWAY_SIGNING_KEY", secret: own };
  const vault = env && typeof env.SITE_SECRETS_KEY === "string" ? env.SITE_SECRETS_KEY : "";
  if (vault) return { name: "SITE_SECRETS_KEY", secret: vault };
  return null;
}

/** The signing key for gateway tokens, DERIVED from the secret `gatewaySecretOf` names. */
export async function gatewayKey(secretsKey) {
  const s = String(secretsKey || "");
  if (!s) throw new Error("no secrets key to derive the gateway key from");
  const base = await crypto.subtle.importKey("raw", TE.encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const derived = await crypto.subtle.sign("HMAC", base, TE.encode("gofarther job gateway v1"));
  return crypto.subtle.importKey("raw", derived, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;
/** The largest file a job may stream into its library: the media ceiling (site-media.mjs `MEDIA_CEILINGS.videoBytes`). */
export const MAX_STREAM_BYTES = 2_000_000_000;
const ID_RE = /^[a-z0-9][a-z0-9_-]{3,80}$/i;
/** A name the build route claims — lower-case, no edge dash, sixty at most (its `cleanSlug`). */
const SITE_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

/**
 * THE PLACEHOLDER A BUILD WITH NO NAME YET RUNS UNDER (stage 5b, 2026-09-06).
 * A first build lets the designer invent the site's name minutes into the
 * job, so its token cannot name a site at the mint: it names this — one
 * placeholder per job, never a site (the wall under `pre` opens no site
 * prefix whatever the slug says) — and is re-minted for the real name by
 * the `/scope` op the moment the designer gives one.
 */
export function preScopeSlug(id) {
  return "pre-" + String(id || "");
}

/**
 * Mint a token for one job. `exp` is a unix time in SECONDS. `pre` marks a
 * PRE-SCOPE token (stage 5b): it must name the placeholder, and the flag
 * rides the signed payload so the wall reads it off the token, never off
 * the spelling of the slug.
 */
export async function signJobToken({ id, slug, uid, exp, pre = false }, key) {
  if (!ID_RE.test(String(id || ""))) throw new Error("bad job id");
  if (!SLUG_RE.test(String(slug || ""))) throw new Error("bad slug");
  if (typeof uid !== "string" || !uid) throw new Error("bad uid");
  const e = Math.floor(Number(exp));
  if (!Number.isFinite(e) || e <= 0) throw new Error("bad exp");
  if (pre === true && String(slug) !== preScopeSlug(id)) throw new Error("a pre-scope token names the placeholder, not a site");
  const payload = B64.encode(TE.encode(JSON.stringify({ id: String(id), slug: String(slug), uid, exp: e, ...(pre === true ? { pre: true } : {}) })));
  const sig = await crypto.subtle.sign("HMAC", key, TE.encode("v1." + payload));
  return "v1." + payload + "." + B64.encode(new Uint8Array(sig));
}

/** The payload of a valid, unexpired token, or null. Never throws. `pre` is
 *  carried only when it is set, so a scoped token's payload is what it was. */
export async function verifyJobToken(token, key, now = Date.now()) {
  try {
    const t = String(token || "");
    const parts = t.split(".");
    if (parts.length !== 3 || parts[0] !== "v1") return null;
    const ok = await crypto.subtle.verify("HMAC", key, B64.decode(parts[2]), TE.encode("v1." + parts[1]));
    if (!ok) return null;
    const p = JSON.parse(TD.decode(B64.decode(parts[1])));
    if (!p || typeof p !== "object") return null;
    if (!ID_RE.test(String(p.id || "")) || !SLUG_RE.test(String(p.slug || "")) || typeof p.uid !== "string" || !p.uid) return null;
    const exp = Number(p.exp);
    if (!Number.isFinite(exp) || exp * 1000 <= Number(now)) return null;
    const pre = p.pre === true;
    if (pre && String(p.slug) !== preScopeSlug(String(p.id))) return null;
    return { id: String(p.id), slug: String(p.slug), uid: p.uid, exp, ...(pre ? { pre: true } : {}) };
  } catch { return null; }
}

/** The prefixes a site's job may read and write under. */
export function jobPrefixes(slug) {
  const s = String(slug || "");
  // `builds/` since stage 7 (2026-09-05): every publish stages its own prefix
  // there, so a job that could not write it would fail at its first put.
  return ["sites/", "source/", "versions/", "uploads/", "backups/", "builds/"].map((p) => p + s + "/");
}

/**
 * May a job for `slug` with id `id` touch `key`? Under a PRE-SCOPE token
 * (stage 5b) the answer is the job's own objects and nothing of any site —
 * not even the placeholder's prefixes, since a pre-scoped job has no site.
 */
/**
 * WHAT A JOB MAY READ BUT NEVER WRITE (2026-10-17, found live on deploy 2215):
 * a request record of its own site (`requests/<slug>/<key>.json`,
 * builder/request.mjs `recordKey`). A job running beside others of its request
 * reads the record to know which jobs are its request's (`mayWriteSite`); the
 * Worker alone writes it (the gateway's `next` op asks the Worker to step it).
 * Never another site's, never a pre-scoped job, never a request's files or
 * reply under the record's own prefix.
 */
const REQUEST_RECORD_RE = /^requests\/([a-z0-9][a-z0-9-]{0,80})\/[A-Za-z0-9_-]{16,64}\.json$/;
export function readableJobKey(slug, key, pre = false) {
  if (pre === true || !SLUG_RE.test(String(slug || ""))) return false;
  // ITS OWN SITE'S OFFLINE MARKER (2026-10-23, audit #118): read so a build's
  // stand-in page is never put over a site taken off the web; written and
  // removed by the Worker's offline route alone.
  if (String(key || "") === "site-offline/" + slug + ".json") return true;
  const m = REQUEST_RECORD_RE.exec(String(key || ""));
  return !!m && m[1] === slug;
}
export function allowedJobKey(slug, id, key, pre = false) {
  const k = String(key || "");
  if (!k || !SLUG_RE.test(String(slug || "")) || !ID_RE.test(String(id || ""))) return false;
  if (k.includes("..")) return false;
  if (pre === true) return k.startsWith("jobs/") && k.includes(String(id));
  if (jobPrefixes(slug).some((p) => k.startsWith(p))) return true;
  if (k === "config/" + slug + ".json") return true;
  // The site's pointer (stage 7) — the one object activation moves.
  if (k === "current/" + slug + ".json") return true;
  // THE SIDECAR AND THE ORPHAN MARKER (stage 4a, 2026-09-05). Every publish
  // reads the previous sidecar for its redirect map and writes the new one at
  // activation (`siteMetaKey`), and the legacy sweep keeps its marker under
  // `orphans/` (`P_ORPHANS`) — both keyed by the slug alone, both outside the
  // served prefix, both refused by this wall until now: the first runner
  // canary would have lost every site's redirects and share tags at its first
  // publish, silently, because the sidecar read is fenced as best-effort.
  // Spelled here rather than imported (this file is dependency-free for the
  // container's sake) and held to the two key builders by a guard.
  if (k === "sitemeta/" + slug + ".json") return true;
  // NO SHARED DRAFT SIDECAR (2026-10-16, after Codex's review of `fbd53dca`):
  // the preview reads the head staged inside its own version's prefix
  // (`builds/<slug>/<version>/state/sidecar.json`, admitted with `builds/`),
  // so `sitemeta-draft/` is nobody's to write.
  // THE PREVIEW'S STATE (2026-10-16): a draft save marks it pending before it
  // puts the preview up and ready once it is confirmed (site-draft.mjs
  // `PREVIEW_STATE_KEY`); a job saving its own site's draft writes it.
  if (k === "preview-state/" + slug + ".json") return true;
  // …AND ITS CLAIMS (2026-10-16): one per writer that may put the preview up,
  // written before its upload and removed by it once confirmed (site-draft.mjs
  // `claimPreview`); a job saving its own site's draft writes, lists and
  // removes them.
  if (k.startsWith("preview-claims/" + slug + "/")) return true;
  // …AND WHAT IT CONFIRMED (2026-10-16, Codex's review of `668ebc87`): a save
  // that confirmed its preview records the version as up before it drops its
  // claim (site-draft.mjs `PREVIEW_UP_KEY`); refused here, `markPreviewUp`
  // answered false in every container job.
  if (k === "preview-up/" + slug + ".json") return true;
  // THE SITE'S PUBLISH TURN (2026-10-17, found live on deploy 2215): with
  // PARALLEL_WRITES on, a job running beside others of its request takes
  // the turn (builder/publish-turn.mjs `turnKey`) before it reads the site,
  // and gives it back after its publish. Refused here, every container job
  // of such a request waited for a turn it could never read until its budget
  // ran out — both jobs of the first live request, 30 minutes, nothing done.
  // Its own site's turn only; another site's stays refused.
  if (k === "publish-turn/" + slug + ".json") return true;
  // THE SITE'S DRAFT (2026-10-16, Codex's review of `668ebc87`): under
  // draft-first a job saves its work as the draft's next revision — the
  // record (`DRAFT_KEY`), the immutable journal of its held changes
  // (`HELD_KEY`, named by a 24-hex id) and the cumulative record of the
  // unpublished ones (`HELD_SUM_KEY`). Each refused here, every container
  // job failed its save ("draft: gateway get 403"). Exactly those keys of the
  // job's own site: never the publication's journal (`site-publishing/`,
  // the owner's Publish only), never another site's, never a pre-scoped job's.
  if (k === "site-drafts/" + slug + ".json") return true;
  if (k === "site-drafts/" + slug + "/held-sum.json") return true;
  if (k.startsWith("site-drafts/" + slug + "/held/") && /^[a-f0-9]{24}\.json$/.test(k.slice(("site-drafts/" + slug + "/held/").length))) return true;
  if (k === "orphans/" + slug + ".json") return true;
  // A LIVE PUBLICATION'S SCRIPT NOTE (found 2026-10-16 by the fired-job cases
  // run through the real gateway): written, renewed and retired immediately
  // around the site script's upload (worker.js `scriptPendingKey`, a UUID
  // under the site's own prefix); refused, every container job's publish
  // stopped before uploading. Only that shape, only this site's.
  if (k.startsWith("scriptpending/" + slug + "/") && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/.test(k.slice(("scriptpending/" + slug + "/").length))) return true;
  // The job's own objects: the request it replays, its result, its resume
  // record — every one named by the job's id, none by anybody else's.
  if (k.startsWith("jobs/") && k.includes(String(id))) return true;
  return false;
}

/**
 * A BUILD'S OWN MARKER IN ITS OWNER'S LISTING (found 2026-10-16 by the
 * container Build run through the real gateway): `builds-live/<uid>/<id>.json`
 * and its kept answer `<id>.done.json` (builder/build-live.mjs
 * `buildLiveKey`, `buildKeptKey`) — the job's own id under the uid its token
 * was minted for, never another account's, never another job's. Refused, a
 * container build could not keep its final answer for a later read.
 */
export function ownBuildMarker(who, key) {
  if (!who || typeof who.uid !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(who.uid) || !ID_RE.test(String(who.id || ""))) return false;
  const root = "builds-live/" + who.uid + "/" + who.id;
  const k = String(key || "");
  return k === root + ".json" || k === root + ".done.json";
}

// A JOB'S LEDGER WRITE (2026-10-18): the revision is the stored one plus one;
// every entry still live in the stored record is kept exactly; any entry the
// write adds or changes is an `adopt` hold — a size, one file, at most ten
// minutes (and a minute's slack) ahead, nothing else. Expired entries may go,
// and so may stored `adopt` holds (the release).
const ADOPT_MS = 11 * 60 * 1000;
const sameEntry = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const adoptEntry = (h, now) => !!h && typeof h === "object" && !Array.isArray(h)
  && Object.keys(h).sort().join() === "adopt,expires,files,size"
  && h.adopt === true && h.files === 1 && Number.isSafeInteger(h.size) && h.size >= 0
  && Number.isFinite(h.expires) && h.expires <= now + ADOPT_MS;
export function ledgerWriteAllowed(stored, next, now) {
  const before = stored && typeof stored === "object" && stored.held && typeof stored.held === "object" && !Array.isArray(stored.held) ? stored.held : {};
  const rev = stored && Number.isSafeInteger(stored.rev) && stored.rev > 0 ? stored.rev : 0;
  if (!next || next.v !== 2 || next.rev !== rev + 1 || typeof next.w !== "string") return false;
  const after = next.held;
  for (const [id, h] of Object.entries(before)) {
    const live = h && typeof h === "object" && Number(h.expires) > now;
    if (!live || h.adopt === true) continue;
    if (!Object.hasOwn(after, id) || !sameEntry(after[id], h)) return false;
  }
  for (const [id, h] of Object.entries(after)) {
    if (Object.hasOwn(before, id) && sameEntry(before[id], h)) continue;
    if (!adoptEntry(h, now)) return false;
  }
  return true;
}

/**
 * THE ACCOUNT'S OWN PRE-SITE FILES AND ITS SITE'S MEDIA LEDGER (2026-10-18,
 * audit A01-2/A08-2/A10-1/S1-4): video and audio a customer attached before
 * the site existed are kept under `drafts/<uid>/` (the uid the token was
 * minted for), and a first build reads them — before it has a name, so a
 * pre-scoped job too — and moves each into the site's library, taking room
 * in the site's ledger (`media-ledger/site-<slug>.json`). `op` is `read`,
 * `write`, `delete` or `list`: a job reads, lists and removes the account's
 * drafts, never writes one; it reads and writes its own site's ledger, never
 * a pre-scoped job and never another site's or account's.
 */
export function ownAccountKey(who, key, op) {
  if (!who || typeof who.uid !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(who.uid)) return false;
  const k = String(key || "");
  if (!k || k.includes("..")) return false;
  const drafts = "drafts/" + who.uid + "/";
  if (k.startsWith(drafts)) {
    if (op === "list") return k === drafts;
    if (op === "write") return false;
    // REMOVED ONLY BY A JOB THAT HOLDS A SITE (the build that moved it), never
    // by a pre-scoped one that has no site to have moved it into.
    if (op === "delete" && who.pre === true) return false;
    return /^[a-z0-9._-]{1,120}$/.test(k.slice(drafts.length));
  }
  if (who.pre !== true && SLUG_RE.test(String(who.slug || "")) && k === "media-ledger/site-" + who.slug + ".json") return op === "read" || op === "write";
  return false;
}

/** May a job list under `prefix`? Only inside a prefix it may touch at all. */
export function allowedJobPrefix(slug, id, prefix, pre = false) {
  const p = String(prefix || "");
  if (!p) return false;
  if (pre === true) return allowedJobKey(slug, id, p, true);
  if (jobPrefixes(slug).some((own) => p.startsWith(own))) return true;
  // ITS OWN SITE'S SCRIPT NOTES AND PREVIEW CLAIMS, listed by the site's prefix.
  if (SLUG_RE.test(String(slug || "")) && (p === "scriptpending/" + slug + "/" || p === "preview-claims/" + slug + "/")) return true;
  return allowedJobKey(slug, id, p);
}
// ── METADATA ON THE WIRE ────────────────────────────────────────────────────

const HTTP_FIELDS = ["contentType", "contentLanguage", "contentDisposition", "contentEncoding", "cacheControl", "cacheExpiry"];

/** Headers for an object's metadata, the way the handler answers and the shim sends. */
export function metaHeaders(obj) {
  const h = new Headers();
  if (!obj) return h;
  const hm = obj.httpMetadata || {};
  if (hm.contentType) h.set("content-type", String(hm.contentType));
  for (const f of HTTP_FIELDS) {
    if (f === "contentType" || hm[f] == null) continue;
    const v = hm[f] instanceof Date ? hm[f].toISOString() : String(hm[f]);
    h.set("x-gf-http-" + f.toLowerCase(), encodeURIComponent(v));
  }
  for (const [k, v] of Object.entries(obj.customMetadata || {})) {
    if (v == null) continue;
    h.set("x-gf-meta-" + encodeURIComponent(k).toLowerCase(), encodeURIComponent(String(v)));
  }
  if (obj.etag) h.set("x-gf-etag", String(obj.etag));
  if (obj.httpEtag) h.set("x-gf-http-etag", String(obj.httpEtag));
  if (obj.size != null) h.set("x-gf-size", String(obj.size));
  if (obj.uploaded) h.set("x-gf-uploaded", obj.uploaded instanceof Date ? obj.uploaded.toISOString() : String(obj.uploaded));
  if (obj.key) h.set("x-gf-key", encodeURIComponent(String(obj.key)));
  return h;
}

/** The metadata out of headers, the way the shim reads and the handler stores. */
export function readMetaHeaders(headers) {
  const h = headers instanceof Headers ? headers : new Headers(headers || {});
  const httpMetadata = {};
  const customMetadata = {};
  const ct = h.get("content-type");
  if (ct) httpMetadata.contentType = ct;
  for (const [k, v] of h.entries()) {
    const lk = k.toLowerCase();
    if (lk.startsWith("x-gf-http-")) {
      const field = HTTP_FIELDS.find((f) => f.toLowerCase() === lk.slice("x-gf-http-".length));
      if (field && field !== "contentType") httpMetadata[field] = field === "cacheExpiry" ? new Date(decodeURIComponent(v)) : decodeURIComponent(v);
    } else if (lk.startsWith("x-gf-meta-")) {
      customMetadata[decodeURIComponent(lk.slice("x-gf-meta-".length))] = decodeURIComponent(v);
    }
  }
  const sizeRaw = h.get("x-gf-size");
  const uploadedRaw = h.get("x-gf-uploaded");
  return {
    httpMetadata: Object.keys(httpMetadata).length ? httpMetadata : undefined,
    customMetadata: Object.keys(customMetadata).length ? customMetadata : undefined,
    etag: h.get("x-gf-etag") || undefined,
    httpEtag: h.get("x-gf-http-etag") || undefined,
    size: sizeRaw == null ? undefined : Number(sizeRaw),
    uploaded: uploadedRaw ? new Date(uploadedRaw) : undefined,
    key: h.get("x-gf-key") ? decodeURIComponent(h.get("x-gf-key")) : undefined,
  };
}

/** The `onlyIf` conditions as headers (the shim's half). */
export function onlyIfHeaders(onlyIf) {
  const h = {};
  if (!onlyIf || typeof onlyIf !== "object") return h;
  if (onlyIf.etagMatches != null) h["x-gf-if-match"] = String(onlyIf.etagMatches);
  if (onlyIf.etagDoesNotMatch != null) h["x-gf-if-none-match"] = String(onlyIf.etagDoesNotMatch);
  if (onlyIf.uploadedBefore) h["x-gf-if-unmodified-since"] = onlyIf.uploadedBefore instanceof Date ? onlyIf.uploadedBefore.toISOString() : String(onlyIf.uploadedBefore);
  if (onlyIf.uploadedAfter) h["x-gf-if-modified-since"] = onlyIf.uploadedAfter instanceof Date ? onlyIf.uploadedAfter.toISOString() : String(onlyIf.uploadedAfter);
  return h;
}

/** The `onlyIf` conditions out of headers (the handler's half). */
export function readOnlyIf(headers) {
  const h = headers instanceof Headers ? headers : new Headers(headers || {});
  const o = {};
  if (h.get("x-gf-if-match")) o.etagMatches = h.get("x-gf-if-match");
  if (h.get("x-gf-if-none-match")) o.etagDoesNotMatch = h.get("x-gf-if-none-match");
  if (h.get("x-gf-if-unmodified-since")) o.uploadedBefore = new Date(h.get("x-gf-if-unmodified-since"));
  if (h.get("x-gf-if-modified-since")) o.uploadedAfter = new Date(h.get("x-gf-if-modified-since"));
  return Object.keys(o).length ? o : undefined;
}

/** One listing entry as JSON. */
export function listEntry(o) {
  return {
    key: o.key, size: o.size, etag: o.etag, httpEtag: o.httpEtag,
    uploaded: o.uploaded instanceof Date ? o.uploaded.toISOString() : o.uploaded,
    httpMetadata: o.httpMetadata || undefined, customMetadata: o.customMetadata || undefined,
  };
}

// ── THE HANDLER ─────────────────────────────────────────────────────────────

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * The Worker's end. `bucket` is the real R2 binding; `verify(token)` answers
 * the token's payload or null; `id` is the job id out of the path; `log` says
 * what was refused and why, with the key, so a live job's first refusal is
 * diagnosable from the log alone.
 *
 * Every answer is one of: 401 (no valid token), 403 (a token for another job,
 * or a key outside the job's site), 400 (a request this protocol does not
 * have), 404 (no such object), 412 (a `put` whose condition failed), 204 (a
 * delete), 200.
 *
 * `sb` is `{ url, key, mint, fetch }` — the platform's Supabase origin, the
 * SERVICE KEY and the MINT SECRET the Worker holds and the container does not
 * (stage 4b), and the fetch the forward goes out on (injected for tests).
 * Without it the `/sb/` branch answers 503 and nothing else changes.
 *
 * `scope` is `{ sign, owner }` (stage 5b): `sign(payload)` mints a token the
 * way the fire does, `owner(slug)` answers who holds a site's name — null
 * for a free one, a uid, or a throw when it cannot tell. Without it the
 * `/scope` op answers 503.
 *
 *   POST   /scope  {slug}   a PRE-SCOPE token re-minted for the name the
 *                           designer gave: free or this owner's own, never
 *                           a stranger's (403 `taken`), never on a token
 *                           that is not pre-scoped (403), never when the
 *                           owner cannot be read (503); a name the platform
 *                           would not claim is 400, and a non-string is
 *                           never coerced into one
 */
/**
 * THE LONGEST A `/wire` PROBE MAY HOLD A CONNECTION. Above the 270-second wall
 * it exists to measure and well under any real job's clock — an instrument that
 * cannot outlast the thing it measures answers nothing, and one that can outlast
 * a job is a way to hold sockets open.
 */
export const WIRE_MAX_MS = 8 * 60_000;

/** How long a `/wire` probe holds by default, and the floor on its tick. */
export const WIRE_DEFAULT_MS = 60_000;
export const WIRE_MIN_TICK_MS = 1000;

/**
 * WHAT A `/wire` CALL ASKED FOR, CLAMPED — its own function, because the only
 * other way to observe the clamp is to WAIT for it, and asking for the ceiling
 * to prove the ceiling costs eight minutes a run. (Found by writing the guard:
 * the first draft drove the op with a nine-hour ask and hung the suite.)
 *
 * Answers `{ mode, ms, everyMs }`, or `null` for a mode nobody recognises —
 * never a default mode, because a `trickle` silently answered as `quiet` would
 * report a wall that was never measured.
 *
 * THE TICK'S FLOOR IS A SECOND. A faster one measures nothing about a
 * 270-second wall and is a way to make a Worker do work per connection.
 */
export function readWire(b) {
  const mode = String((b && b.mode) || "quiet");
  if (mode !== "quiet" && mode !== "trickle") return null;
  // NON-NUMBERS FALL TO THE DEFAULT RATHER THAN COERCING: `Number(["600000"])`
  // is 600000, and this repository has shipped that as a real bug.
  const want = typeof (b && b.ms) === "number" && Number.isFinite(b.ms) ? b.ms : WIRE_DEFAULT_MS;
  const ms = Math.max(1000, Math.min(WIRE_MAX_MS, Math.round(want)));
  const evWant = typeof (b && b.everyMs) === "number" && Number.isFinite(b.everyMs) ? b.everyMs : 20_000;
  const everyMs = Math.max(WIRE_MIN_TICK_MS, Math.min(ms, Math.round(evWant)));
  return { mode, ms, everyMs };
}

export function gatewayHandler({ bucket, verify, log = () => {}, sb = null, scope = null, waitUntil = null, next = null, reply = null, progress = null }) {
  return async function handle(request, id) {
    const auth = String(request.headers.get("authorization") || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const who = token ? await verify(token) : null;
    if (!who) return json(401, { error: "unauthorized" });
    if (String(who.id) !== String(id || "")) { log("id-mismatch", { token: who.id, path: id }); return json(403, { error: "not this job" }); }
    const url = new URL(request.url);
    const base = url.pathname.replace(/\/+$/, "");
    const tail = base.slice(base.indexOf("/api/job/") + ("/api/job/" + id).length);

    // ── SUPABASE (stage 4b): the key and the mint stay here ────────────────
    if (tail === "/sb" || tail.startsWith("/sb/")) {
      if (!sb || !sb.url || !sb.key) return json(503, { error: "no supabase" });
      const sbPath = tail.slice("/sb".length) || "/";
      const op = request.method + " " + sbPath;
      const rpcCall = sbPath.startsWith("/rest/v1/rpc/");
      let text = "";
      if (request.method !== "GET" && request.method !== "HEAD") {
        const len = Number(request.headers.get("content-length") || 0);
        if (len > SB_MAX_BODY) return json(413, { error: "request too large" });
        text = await request.text();
        if (text.length > SB_MAX_BODY) return json(413, { error: "request too large" });
      }
      const d = sbDecision(who, request.method, sbPath, url.search, text, String(sb.mint || ""));
      if (!d.ok) { log("sb-out-of-scope", { id: who.id, slug: who.slug, op, reason: d.why }); return json(403, { error: "supabase op not in this job's scope", op, why: d.why }); }
      if (d.claims && !(await claimsOwn(who, d.claims, { url: sb.url, key: sb.key, fetch: sb.fetch, timeoutMs: sb.timeoutMs }))) {
        log("sb-out-of-scope", { id: who.id, slug: who.slug, op, reason: "claim" });
        return json(403, { error: "supabase op not in this job's scope", op, why: "claim" });
      }
      const fwd = { apikey: sb.key, authorization: "Bearer " + sb.key };
      for (const h of SB_REQUEST_HEADERS) if (request.headers.has(h)) fwd[h] = request.headers.get(h);
      let r;
      try {
        r = await (sb.fetch || globalThis.fetch)(String(sb.url).replace(/\/+$/, "") + sbPath + url.search, {
          method: request.method, headers: fwd, body: d.body, signal: AbortSignal.timeout(sb.timeoutMs || SB_TIMEOUT_MS),
        });
      } catch (e) {
        log("sb-unreachable", { id: who.id, op, error: String((e && e.name) || e) });
        return json(502, { error: "supabase unreachable" });
      }
      const out = new Headers();
      for (const h of SB_RESPONSE_HEADERS) if (r.headers.has(h)) out.set(h, r.headers.get(h));
      // THE STATUS, NEVER THE BODY, when an RPC refused: PostgREST quotes the
      // request it refused, and an RPC request carries the mint.
      if (!r.ok && rpcCall) { log("sb-refused", { id: who.id, op, status: r.status }); return json(r.status, { error: "supabase", status: r.status }); }
      if (r.status === 204) return new Response(null, { status: 204, headers: out });
      return new Response(await r.arrayBuffer(), { status: r.status, headers: out });
    }

    // ── THE WIRE OP (2026-09-14): A LONG CONNECTION, ON PURPOSE ───────────
    //
    // The far end of `builder/job-probe.mjs`'s transport test. It holds this
    // response open for a stated time in one of two shapes — `quiet` sends
    // NOTHING until it answers (what a non-streaming model call looks like on
    // the wire), `trickle` sends a byte every `everyMs` (what `stream: true`
    // produces) — so the container can find out which one its egress kills
    // without a model call, a credit, or waiting for a model to answer slowly.
    //
    // IT CARRIES NO DATA IN EITHER DIRECTION. The body out is a space per tick
    // and one JSON line; the body in is three numbers. There is nothing here to
    // read and nothing to leak, which is what makes a route whose whole job is
    // to hold a socket open acceptable at all.
    //
    // BOUNDED HERE AND NOT ONLY AT THE CALLER, because a bound that lives in
    // the caller is one the next caller forgets — this repository's own rule,
    // written for `/hold` one process over and true for the same reason. The
    // token is the wall in front of it: a job token, verified above, minted
    // only by the fire.
    if (tail === "/wire" && request.method === "POST") {
      let b = null;
      try { b = await request.json(); } catch { b = null; }
      const asked = readWire(b);
      if (!asked) return json(400, { error: "wire mode must be quiet or trickle" });
      const { mode, ms, everyMs } = asked;
      log("wire", { id: who.id, mode, ms, everyMs });
      const nap = (n) => new Promise((r) => setTimeout(r, n));
      if (mode === "quiet") {
        await nap(ms);
        return json(200, { wire: "quiet", ms, everyMs: 0 });
      }
      // A STREAMED BODY, because the point is bytes moving DURING the wait —
      // an answer at the end would be the quiet shape wearing another name.
      const { readable, writable } = new TransformStream();
      const w = writable.getWriter();
      const enc = new TextEncoder();
      const pump = (async () => {
        const end = Date.now() + ms;
        try {
          while (Date.now() < end) {
            await nap(Math.min(everyMs, Math.max(1, end - Date.now())));
            await w.write(enc.encode(" "));
          }
          await w.write(enc.encode("\n" + JSON.stringify({ wire: "trickle", ms, everyMs }) + "\n"));
        } catch { /* the caller went away, which is itself the answer it wanted */ }
        try { await w.close(); } catch { /* already closed by the disconnect */ }
      })();
      // HELD, because a Worker tears its context down once the response is
      // returned and a promise nobody holds is cancelled mid-flight — this
      // repository has already lost most of an audit log to exactly that, and
      // an abandoned pump would report a trickle that stopped after one byte.
      if (typeof waitUntil === "function") { try { waitUntil(pump); } catch { /* a probe never costs a job */ } }
      return new Response(readable, { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    }

    // ── THE SCOPE OP (stage 5b): a pre-scoped build learns its site ───────
    if (tail === "/scope" && request.method === "POST") {
      if (!scope || typeof scope.sign !== "function" || typeof scope.owner !== "function") return json(503, { error: "no scope" });
      if (who.pre !== true) { log("scope-not-pre", { id: who.id, slug: who.slug }); return json(403, { error: "not a pre-scope token" }); }
      let body = null;
      try { body = await request.json(); } catch { body = null; }
      const slug = body && typeof body.slug === "string" ? body.slug : null;
      if (slug === null || !SITE_NAME_RE.test(slug)) return json(400, { error: "bad slug" });
      let owner;
      try { owner = await scope.owner(slug); } catch { owner = undefined; }
      if (owner === undefined) { log("scope-unread", { id: who.id, slug }); return json(503, { error: "owner unreadable" }); }
      if (owner && owner !== who.uid) { log("scope-taken", { id: who.id, slug, uid: who.uid }); return json(403, { error: "taken", slug }); }
      let token;
      try { token = await scope.sign({ id: who.id, slug, uid: who.uid, exp: who.exp }); }
      catch (e) { log("scope-sign", { id: who.id, slug, error: String((e && e.message) || e) }); return json(503, { error: "could not sign" }); }
      return json(200, { ok: true, token, slug });
    }

    // ── THE NEXT OP (2026-10-03): a part of a longer request ended here ─────
    //
    // The container has no queue and may not file a job (`edit_create` is a
    // Worker's call), so the job that ran a part of a request asks the Worker
    // to move that request on. Bound to the job's own token — its id, its site
    // and its owner — and to a request key the Worker checks names this job
    // among its parts; the Worker's step is idempotent, so a repeated call
    // changes nothing. A pre-scoped build has no request.
    if (tail === "/next" && request.method === "POST") {
      if (typeof next !== "function") return json(503, { error: "no next" });
      if (who.pre === true) return json(403, { error: "not a site job" });
      let body = null;
      try { body = await request.json(); } catch { body = null; }
      const key = body && typeof body.key === "string" ? body.key : "";
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) return json(400, { error: "bad key" });
      let ok = false;
      try { ok = (await next({ id: who.id, slug: who.slug, uid: who.uid, key })) === true; } catch { ok = false; }
      return ok ? json(200, { ok: true }) : json(404, { error: "not this job's request" });
    }

    // ── THE REPLY OP (2026-10-04): a job that ended here asks for its reply ──
    //
    // The container has no queue, so the job asks the Worker to have its reply
    // written in the background once its outcome and money are final. Bound to
    // the job's own token — its id and its owner, nothing the job names — and
    // the Worker's ask is idempotent: the reply's record is made once.
    if (tail === "/reply" && request.method === "POST") {
      if (typeof reply !== "function") return json(503, { error: "no reply" });
      if (who.pre === true) return json(403, { error: "not a site job" });
      let ok = false;
      try { ok = (await reply({ id: who.id, uid: who.uid })) === true; } catch { ok = false; }
      return ok ? json(200, { ok: true }) : json(409, { error: "no reply asked" });
    }

    // ── THE PROGRESS OP (2026-10-06): a running job records its milestones ──
    //
    // The container has no queue and no write to `jobs/` outside its own
    // objects' rules, so the job's recorder (`makeProgress` in worker.js) asks
    // the Worker to open, add to and close the job's progress record. Bound to
    // the job's own token — its id, its site and its owner, never anything the
    // body names — and every op is idempotent on the Worker's side: a
    // milestone carries the recorder's own number. A pre-scoped build has no
    // progress. The body is bounded like a Supabase call's.
    if (tail === "/progress" && request.method === "POST") {
      if (typeof progress !== "function") return json(503, { error: "no progress" });
      // A PRE-SCOPED BUILD TALKS TOO (2026-10-19, after deploy 2220's build
      // said nothing for its whole design): before the design names the site,
      // a first build may write its OWN build record only — no site on it
      // (`slug: ""`), and the Worker refuses it any record that is not a build's.
      const len = Number(request.headers.get("content-length") || 0);
      if (len > SB_MAX_BODY) return json(413, { error: "request too large" });
      const text = await request.text();
      if (text.length > SB_MAX_BODY) return json(413, { error: "request too large" });
      let body = null;
      try { body = JSON.parse(text); } catch { body = null; }
      if (!body || typeof body !== "object" || Array.isArray(body) || !["begin", "mark", "close"].includes(body.op)) return json(400, { error: "bad progress" });
      let out = null;
      try { out = await progress(who.pre === true ? { id: who.id, slug: "", uid: who.uid, pre: true } : { id: who.id, slug: who.slug, uid: who.uid }, body); } catch { out = null; }
      // A STORE THAT FAILED IS NOT A REFUSAL (2026-10-06): 503, which the job's
      // recorder sends again; a refusal (a closed record, another run's) is 409
      // and never is. A throw here is the Worker's own failure: tried again.
      if (out && out.ok === true) return json(200, { ok: true });
      return !out || out.retry === true ? json(503, { error: "not recorded yet" }) : json(409, { error: "not recorded" });
    }

    if (!bucket) return json(503, { error: "no bucket" });
    const key = url.searchParams.get("key") || "";
    const pre = who.pre === true;
    const refuse = (k) => { log("out-of-scope", { id: who.id, slug: who.slug, key: k, ...(pre ? { pre: true } : {}) }); return json(403, { error: "key not in this job's scope", key: k }); };

    if (tail === "/r2" && (request.method === "GET" || request.method === "HEAD")) {
      if (!allowedJobKey(who.slug, who.id, key, pre) && !ownBuildMarker(who, key) && !readableJobKey(who.slug, key, pre) && !ownAccountKey(who, key, "read")) return refuse(key);
      const obj = request.method === "HEAD" ? await bucket.head(key) : await bucket.get(key);
      if (!obj) return new Response(null, { status: 404 });
      const headers = metaHeaders(obj);
      if (request.method === "HEAD") return new Response(null, { status: 200, headers });
      return new Response(obj.body, { status: 200, headers });
    }
    if (tail === "/r2" && request.method === "PUT") {
      if (!allowedJobKey(who.slug, who.id, key, pre) && !ownBuildMarker(who, key) && !ownAccountKey(who, key, "write")) return refuse(key);
      const meta = readMetaHeaders(request.headers);
      const onlyIf = readOnlyIf(request.headers);
      const opts = {};
      if (meta.httpMetadata) opts.httpMetadata = meta.httpMetadata;
      if (meta.customMetadata) opts.customMetadata = meta.customMetadata;
      if (onlyIf) opts.onlyIf = onlyIf;
      // STREAMED WHEN ITS LENGTH IS KNOWN (2026-10-18, audit S1-4): a moved
      // video was held whole in the Worker's memory. Storage takes a stream
      // of a declared length; without one, or without the runtime's
      // fixed-length stream, the body is read as before.
      const said = request.headers.get("x-r2-length");
      const declared = said !== null && /^\d{1,15}$/.test(said) ? Number(said) : NaN;
      const FLS = globalThis.FixedLengthStream;
      // ONLY A FILE INTO ITS OWN SITE'S LIBRARY, AND BOUNDED (2026-10-18,
      // review of batch 1): the stream is the one path with no memory cap,
      // so it takes the media ceiling and the uploads prefix, nothing else.
      const streamable = SLUG_RE.test(String(who.slug || "")) && who.pre !== true && key.startsWith("uploads/" + who.slug + "/") && declared <= MAX_STREAM_BYTES;
      // THE SITE'S MEDIA LEDGER IS WRITTEN ONLY CONDITIONALLY, as a JSON
      // object — the hold and release the Worker's code makes — so a job
      // cannot blank the record its media limits are counted in.
      if (key.startsWith("media-ledger/") && (!onlyIf || (!onlyIf.etagMatches && !onlyIf.etagDoesNotMatch))) return json(428, { error: "a ledger write must be conditional" });
      let body;
      if (typeof FLS === "function" && request.body && Number.isSafeInteger(declared) && declared >= 0 && streamable) body = request.body.pipeThrough(new FLS(declared));
      else {
        body = await request.arrayBuffer();
        if (key.startsWith("media-ledger/")) {
          let led = null;
          try { led = JSON.parse(new TextDecoder().decode(body)); } catch { led = null; }
          if (!led || typeof led !== "object" || Array.isArray(led) || !led.held || typeof led.held !== "object" || Array.isArray(led.held)) return json(400, { error: "ledger" });
          // …AND ONLY AS A HOLD OR RELEASE OF ITS OWN KIND, against the
          // record as stored (2026-10-18, audit batch 1's open point): a job
          // may add or drop a short `adopt` entry, never touch another live
          // reservation, so it cannot free the room an upload is using.
          let stored = null;
          try { const got = await bucket.get(key); stored = got ? JSON.parse(await got.text()) : null; } catch { return json(503, { error: "ledger unread" }); }
          if (!ledgerWriteAllowed(stored, led, Date.now())) return json(403, { error: "ledger change" });
        }
      }
      let put;
      // A LENGTH THAT DOES NOT MATCH THE BODY is the caller's fault, said as
      // such — never a failure that reads as "try again".
      try { put = await bucket.put(key, body, opts); }
      catch (e) { if (body && typeof body.getReader === "function") return json(400, { error: "length-mismatch" }); throw e; }
      // R2 answers a failed condition with null, never a throw; the shim on
      // the other side turns this 412 back into that null.
      if (put === null || put === undefined) return json(412, { error: "precondition failed" });
      return json(200, listEntry(put));
    }
    if (tail === "/r2" && request.method === "DELETE") {
      if (!allowedJobKey(who.slug, who.id, key, pre) && !ownBuildMarker(who, key) && !ownAccountKey(who, key, "delete")) return refuse(key);
      await bucket.delete(key);
      return new Response(null, { status: 204 });
    }
    if (tail === "/r2/delete" && request.method === "POST") {
      let body = null;
      try { body = await request.json(); } catch { body = null; }
      const keys = body && Array.isArray(body.keys) ? body.keys.map(String) : null;
      if (!keys) return json(400, { error: "keys" });
      for (const k of keys) if (!allowedJobKey(who.slug, who.id, k, pre) && !ownBuildMarker(who, k) && !ownAccountKey(who, k, "delete")) return refuse(k);
      if (keys.length) await bucket.delete(keys);
      return new Response(null, { status: 204 });
    }
    if (tail === "/r2/list" && request.method === "POST") {
      let body = null;
      try { body = await request.json(); } catch { body = null; }
      const prefix = String((body && body.prefix) || "");
      if (!allowedJobPrefix(who.slug, who.id, prefix, pre) && !ownAccountKey(who, prefix, "list")) return refuse(prefix);
      const opts = { prefix };
      if (body.cursor) opts.cursor = String(body.cursor);
      if (body.limit) opts.limit = Number(body.limit);
      if (body.delimiter) opts.delimiter = String(body.delimiter);
      if (Array.isArray(body.include)) opts.include = body.include;
      const got = await bucket.list(opts);
      return json(200, {
        objects: (got && got.objects ? got.objects : []).map(listEntry),
        truncated: !!(got && got.truncated),
        cursor: (got && got.cursor) || undefined,
        delimitedPrefixes: (got && got.delimitedPrefixes) || [],
      });
    }
    return json(400, { error: "no such op", op: request.method + " " + tail });
  };
}

/** Is this path a gateway request, and for which job? */
export function gatewayJobId(pathname) {
  const m = /^\/api\/job\/([A-Za-z0-9_-]{4,81})(\/|$)/.exec(String(pathname || ""));
  return m ? m[1] : null;
}
