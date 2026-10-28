// Each site's own R2 bucket (the site Worker split, step "seal each site",
// 2026-10-27; the owner's Q1: one bucket per site).
//
// WHY. A site's Worker used to be bound to the WHOLE shared bucket
// (`isibi-sites`), so its code could read every other site's files, every
// owner's source and every job record. A dispatch-namespace script gets only
// the bindings it is uploaded with, so binding it to a bucket that holds only
// its own serving files is the seal.
//
// WHAT GOES IN IT: exactly what the template's `src/server.ts` reads, under the
// same keys, so the site's code does not change:
//   - `builds/<slug>/<version>/client/**`   the built assets (immutable)
//   - `builds/<slug>/<version>/state/sidecar.json`   a draft's head (immutable)
//   - `sitemeta/<slug>.json`   the live head (patched by the owner's panels)
//   - `sites/<slug>/site.live`   the liveness marker (the offline switch)
// The shared bucket stays the platform's source of truth; this is a copy.
//
// Every side effect is injected, as in `site-dispatch.mjs`.

const API = "https://api.cloudflare.com/client/v4";
export const SITE_BUCKET_PREFIX = "gfs-";
export const BUCKET_CALL_MS = 60000;

/** djb2, as hex: enough to keep two long slugs from sharing a truncated name. */
function shortHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/**
 * The bucket's name. R2 allows lowercase letters, digits and hyphens, 3–63
 * characters, starting and ending with a letter or digit. A slug that would
 * not fit is cut and given a hash of the whole slug, so the name stays unique.
 * "" for a slug with nothing usable in it: never a shared fallback name.
 */
export function siteBucketName(slug) {
  const s = String(slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
  if (!s) return "";
  const full = SITE_BUCKET_PREFIX + s;
  if (full.length <= 63) return full;
  return (SITE_BUCKET_PREFIX + s.slice(0, 63 - SITE_BUCKET_PREFIX.length - 9)).replace(/-+$/, "") + "-" + shortHash(s);
}

/** The mutable keys: copied when their bytes differ, removed when the source has none. */
export function headKeys(slug) {
  return ["sitemeta/" + slug + ".json", "sites/" + slug + "/site.live"];
}

/**
 * Is this key one the site's Worker may read? Only its own builds' client and
 * state sidecar, and its head keys. Everything else under `builds/<slug>/`
 * (the server bundle, manifests, source) stays out.
 */
export function isServingKey(slug, key) {
  const k = String(key || "");
  if (!slug || k.includes("..")) return false;
  if (headKeys(slug).includes(k)) return true;
  // The owner's uploads and hosted media (2026-10-27): one level, a file name.
  const up = "uploads/" + slug + "/";
  if (k.startsWith(up)) return /^[A-Za-z0-9._-]{1,120}$/.test(k.slice(up.length));
  const pre = "builds/" + slug + "/";
  if (!k.startsWith(pre)) return false;
  const rest = k.slice(pre.length).split("/");
  if (rest.length < 3 || !rest[0]) return false;
  if (rest[1] === "client") return rest.length >= 3 && rest.slice(2).every(Boolean);
  return rest[1] === "state" && rest.length === 3 && rest[2] === "sidecar.json";
}

/**
 * Bring the site's bucket in line with the shared bucket, for the serving keys.
 *
 * `src` and `dst` each give `list(prefix)` → [{ key, etag }] (every page).
 * `src.get(key)` → { body, contentType } | null; `dst.put(key, body, ct)`;
 * `dst.del(key)`. `budget` bounds the copies and deletions of one call.
 *
 * Immutable build keys are copied when missing (a key present is the same
 * bytes: builds are never rewritten). Head keys are copied when their etags
 * differ and removed when the source has none, so taking a site offline in
 * the shared bucket takes it offline here at the next sync.
 *
 * Returns { done, copied, removed, failed, left }. `done` only when every
 * difference was settled in this call, which is what the caller needs before
 * it binds the script to this bucket.
 */
export async function syncSiteBucket({ slug, src, dst, budget = 2000 }) {
  const out = { done: false, copied: 0, removed: 0, failed: 0, left: 0 };
  if (!slug || !src || !dst) return out;
  const [srcBuilds, dstBuilds] = await Promise.all([src.list("builds/" + slug + "/"), dst.list("builds/" + slug + "/")]);
  const have = new Map(dstBuilds.map((o) => [o.key, o.etag]));
  const want = srcBuilds.filter((o) => isServingKey(slug, o.key));
  const wantKeys = new Set(want.map((o) => o.key));
  const jobs = [];
  for (const o of want) if (!have.has(o.key)) jobs.push({ op: "copy", key: o.key });
  // A build the platform trimmed is trimmed here too.
  for (const o of dstBuilds) if (!wantKeys.has(o.key)) jobs.push({ op: "del", key: o.key });
  // THE OWNER'S UPLOADS: copied when missing or changed (a media file can be
  // replaced under its name), removed when the platform no longer has them.
  // A VISITOR'S upload is written by the site itself under `vuploads/`, which
  // this never touches.
  {
    const pre = "uploads/" + slug + "/";
    const [s, d] = await Promise.all([src.list(pre), dst.list(pre)]);
    const want = new Map(s.filter((o) => isServingKey(slug, o.key)).map((o) => [o.key, o.etag]));
    const got = new Map(d.map((o) => [o.key, o.etag]));
    for (const [k, e] of want) if (got.get(k) !== e) jobs.push({ op: "copy", key: k });
    for (const k of got.keys()) if (!want.has(k)) jobs.push({ op: "del", key: k });
  }
  for (const k of headKeys(slug)) {
    const [s] = await src.list(k).then((l) => l.filter((o) => o.key === k));
    const [d] = await dst.list(k).then((l) => l.filter((o) => o.key === k));
    if (s && (!d || d.etag !== s.etag)) jobs.push({ op: "copy", key: k });
    else if (!s && d) jobs.push({ op: "del", key: k });
  }
  // THE MARKER LAST, so a first sync never makes a site live before its files are there.
  jobs.sort((a, b) => (a.key.endsWith("/site.live") ? 1 : 0) - (b.key.endsWith("/site.live") ? 1 : 0));
  let spent = 0;
  for (const j of jobs) {
    if (spent >= budget) { out.left++; continue; }
    spent++;
    try {
      if (j.op === "del") { await dst.del(j.key); out.removed++; continue; }
      const obj = await src.get(j.key);
      // Gone since the listing: the next sync settles it.
      if (!obj) { out.failed++; continue; }
      await dst.put(j.key, obj.body, obj.contentType);
      out.copied++;
    } catch { out.failed++; }
  }
  out.done = out.failed === 0 && out.left === 0;
  return out;
}

// ── The Cloudflare REST half ────────────────────────────────────────────────

const base = (accountId, bucket) =>
  `${API}/accounts/${encodeURIComponent(accountId)}/r2/buckets` + (bucket ? "/" + encodeURIComponent(bucket) : "");
const objUrl = (accountId, bucket, key) => base(accountId, bucket) + "/objects/" + key.split("/").map(encodeURIComponent).join("/");

async function call(fetchImpl, url, init) {
  try { return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(BUCKET_CALL_MS) }); }
  catch (e) { return { ok: false, status: 0, error: String((e && e.message) || e).slice(0, 300), json: async () => null }; }
}

/** Create the bucket; one that already exists is done (409, or code 10004). */
export async function ensureSiteBucket({ accountId, apiToken, bucket }, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  if (!accountId || !apiToken || !bucket) return { ok: false, status: 0, error: "missing accountId, apiToken or bucket" };
  const r = await call(fetchImpl, base(accountId), {
    method: "POST",
    headers: { authorization: "Bearer " + apiToken, "content-type": "application/json" },
    body: JSON.stringify({ name: bucket }),
  });
  if (r.ok) return { ok: true, status: r.status, created: true };
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  const codes = (body && Array.isArray(body.errors) ? body.errors : []).map((e) => e && e.code);
  if (r.status === 409 || codes.includes(10004)) return { ok: true, status: r.status, created: false };
  return { ok: false, status: r.status, error: r.error || ("create bucket answered " + r.status) };
}

/** The destination side of `syncSiteBucket`, over the REST API. */
export function restBucket({ accountId, apiToken, bucket }, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  const auth = { authorization: "Bearer " + apiToken };
  return {
    async list(prefix) {
      const all = [];
      let cursor = "";
      for (let i = 0; i < 100; i++) {
        const q = new URLSearchParams({ prefix, per_page: "1000" });
        if (cursor) q.set("cursor", cursor);
        const r = await call(fetchImpl, base(accountId, bucket) + "/objects?" + q, { headers: auth });
        if (!r.ok) throw new Error("list answered " + r.status);
        const j = await r.json();
        for (const o of (j && j.result) || []) all.push({ key: o.key, etag: o.etag });
        cursor = (j && j.result_info && j.result_info.cursor) || "";
        if (!(j && j.result_info && j.result_info.is_truncated) || !cursor) return all;
      }
      throw new Error("list did not end");
    },
    async put(key, body, contentType) {
      const r = await call(fetchImpl, objUrl(accountId, bucket, key), {
        method: "PUT",
        headers: { ...auth, "content-type": contentType || "application/octet-stream" },
        body,
      });
      if (!r.ok) throw new Error("put answered " + r.status);
    },
    async del(key) {
      const r = await call(fetchImpl, objUrl(accountId, bucket, key), { method: "DELETE", headers: auth });
      if (!r.ok && r.status !== 404) throw new Error("delete answered " + r.status);
    },
    /** One object's bytes, or null when it is not there. */
    async get(key) {
      const r = await call(fetchImpl, objUrl(accountId, bucket, key), { headers: auth });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("get answered " + r.status);
      return { body: await r.arrayBuffer(), contentType: r.headers.get("content-type") || "" };
    },
  };
}

/** The source side, over a Worker R2 binding (the shared bucket). */
export function bindingBucket(b) {
  return {
    async list(prefix) {
      const all = [];
      let cursor;
      for (let i = 0; i < 100; i++) {
        const r = await b.list({ prefix, cursor });
        for (const o of r.objects) all.push({ key: o.key, etag: o.etag });
        if (!r.truncated) return all;
        cursor = r.cursor;
      }
      throw new Error("list did not end");
    },
    async get(key) {
      const o = await b.get(key);
      if (!o) return null;
      return { body: await o.arrayBuffer(), contentType: (o.httpMetadata && o.httpMetadata.contentType) || "" };
    },
  };
}

/**
 * Empty the site's bucket and delete it (a site deleted). A bucket that does
 * not exist is done; anything left behind is reported, never hidden.
 */
export async function deleteSiteBucket({ accountId, apiToken, bucket }, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  if (!accountId || !apiToken || !bucket) return { ok: false, status: 0, error: "missing accountId, apiToken or bucket" };
  const b = restBucket({ accountId, apiToken, bucket }, { fetch: fetchImpl });
  let keys;
  try { keys = await b.list(""); }
  catch (e) {
    if (/answered 404/.test(String(e && e.message))) return { ok: true, status: 404, removed: 0 };
    return { ok: false, status: 0, error: String((e && e.message) || e).slice(0, 300) };
  }
  let removed = 0;
  for (const o of keys) {
    try { await b.del(o.key); removed++; }
    catch (e) { return { ok: false, status: 0, removed, error: String((e && e.message) || e).slice(0, 300) }; }
  }
  const r = await call(fetchImpl, base(accountId, bucket), { method: "DELETE", headers: { authorization: "Bearer " + apiToken } });
  if (r.ok || r.status === 404) return { ok: true, status: r.status, removed };
  return { ok: false, status: r.status, removed, error: r.error || ("delete bucket answered " + r.status) };
}

/** Where a site whose copy did not finish is remembered, for the tick. */
export const RESYNC_PREFIX = "ownbucket-pending/";
