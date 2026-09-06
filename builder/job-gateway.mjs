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
};

/**
 * THE TABLES A JOB MAY TOUCH, per method. `filter` names the query parameter
 * that must be present as `eq.<the token's field>` (PostgREST ANDs top-level
 * filters, so one bound filter confines every read and every delete, whatever
 * else the query says); `rows` names the fields every row of a write must
 * carry with the token's value. A method not listed is refused; `PATCH` is
 * nowhere, because no job patches a row.
 */
export const SB_TABLES = {
  edit_traces: { POST: { rows: { slug: "slug", uid: "uid" } } },
  edit_jobs: { GET: { filter: { id: "id" } } },
  site_backends: { GET: { filter: { slug: "slug" } }, POST: { rows: { slug: "slug", uid: "uid" } } },
  site_project: { GET: { filter: { slug: "slug" } }, POST: { rows: { slug: "slug", uid: "uid" } } },
  site_aliases: { GET: {}, POST: { rows: { slug: "slug", uid: "uid" } }, DELETE: { filter: { slug: "slug" } } },
  site_functions: { GET: { filter: { slug: "slug" } }, POST: { rows: { slug: "slug", owner_id: "uid" } } },
  site_builds: { POST: { rows: { slug: "slug" } } },
  credits: { GET: { filter: { user_id: "uid" } } },
};

/** The request headers forwarded to Supabase, and the response headers handed back. */
export const SB_REQUEST_HEADERS = ["content-type", "prefer", "accept", "accept-profile", "content-profile", "range"];
export const SB_RESPONSE_HEADERS = ["content-type", "content-range", "preference-applied"];
/** A Supabase request's body cap, and how long the forward may take. */
export const SB_MAX_BODY = 1 << 20;
export const SB_TIMEOUT_MS = 20_000;

const NAME_RE = /^[a-z_][a-z0-9_]{0,62}$/;

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
  for (const [param, word] of Object.entries(rule.filter || {})) {
    if (who.pre === true && word === "slug") return { ok: false, why: "filter:" + param };
    if (params.get(param) !== "eq." + boundValue(who, word)) return { ok: false, why: "filter:" + param };
  }
  if (m === "GET" || m === "HEAD" || m === "DELETE") return { ok: true, body: undefined };
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
  }
  return { ok: true, body: JSON.stringify(body) };
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

/** The signing key for gateway tokens, DERIVED from the platform's secrets key. */
export async function gatewayKey(secretsKey) {
  const s = String(secretsKey || "");
  if (!s) throw new Error("no secrets key to derive the gateway key from");
  const base = await crypto.subtle.importKey("raw", TE.encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const derived = await crypto.subtle.sign("HMAC", base, TE.encode("gofarther job gateway v1"));
  return crypto.subtle.importKey("raw", derived, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;
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
  if (k === "orphans/" + slug + ".json") return true;
  // The job's own objects: the request it replays, its result, its resume
  // record — every one named by the job's id, none by anybody else's.
  if (k.startsWith("jobs/") && k.includes(String(id))) return true;
  return false;
}

/** May a job list under `prefix`? Only inside a prefix it may touch at all. */
export function allowedJobPrefix(slug, id, prefix, pre = false) {
  const p = String(prefix || "");
  if (!p) return false;
  if (pre === true) return allowedJobKey(slug, id, p, true);
  if (jobPrefixes(slug).some((own) => p.startsWith(own))) return true;
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
export function gatewayHandler({ bucket, verify, log = () => {}, sb = null, scope = null }) {
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

    if (!bucket) return json(503, { error: "no bucket" });
    const key = url.searchParams.get("key") || "";
    const pre = who.pre === true;
    const refuse = (k) => { log("out-of-scope", { id: who.id, slug: who.slug, key: k, ...(pre ? { pre: true } : {}) }); return json(403, { error: "key not in this job's scope", key: k }); };

    if (tail === "/r2" && (request.method === "GET" || request.method === "HEAD")) {
      if (!allowedJobKey(who.slug, who.id, key, pre)) return refuse(key);
      const obj = request.method === "HEAD" ? await bucket.head(key) : await bucket.get(key);
      if (!obj) return new Response(null, { status: 404 });
      const headers = metaHeaders(obj);
      if (request.method === "HEAD") return new Response(null, { status: 200, headers });
      return new Response(obj.body, { status: 200, headers });
    }
    if (tail === "/r2" && request.method === "PUT") {
      if (!allowedJobKey(who.slug, who.id, key, pre)) return refuse(key);
      const meta = readMetaHeaders(request.headers);
      const onlyIf = readOnlyIf(request.headers);
      const opts = {};
      if (meta.httpMetadata) opts.httpMetadata = meta.httpMetadata;
      if (meta.customMetadata) opts.customMetadata = meta.customMetadata;
      if (onlyIf) opts.onlyIf = onlyIf;
      const body = await request.arrayBuffer();
      const put = await bucket.put(key, body, opts);
      // R2 answers a failed condition with null, never a throw; the shim on
      // the other side turns this 412 back into that null.
      if (put === null || put === undefined) return json(412, { error: "precondition failed" });
      return json(200, listEntry(put));
    }
    if (tail === "/r2" && request.method === "DELETE") {
      if (!allowedJobKey(who.slug, who.id, key, pre)) return refuse(key);
      await bucket.delete(key);
      return new Response(null, { status: 204 });
    }
    if (tail === "/r2/delete" && request.method === "POST") {
      let body = null;
      try { body = await request.json(); } catch { body = null; }
      const keys = body && Array.isArray(body.keys) ? body.keys.map(String) : null;
      if (!keys) return json(400, { error: "keys" });
      for (const k of keys) if (!allowedJobKey(who.slug, who.id, k, pre)) return refuse(k);
      if (keys.length) await bucket.delete(keys);
      return new Response(null, { status: 204 });
    }
    if (tail === "/r2/list" && request.method === "POST") {
      let body = null;
      try { body = await request.json(); } catch { body = null; }
      const prefix = String((body && body.prefix) || "");
      if (!allowedJobPrefix(who.slug, who.id, prefix, pre)) return refuse(prefix);
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
