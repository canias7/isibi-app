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
// ── THE SCOPE ────────────────────────────────────────────────────────────────
//
// `allowedJobKey(slug, id, key)` is the wall: a site's own prefixes (`sites/`,
// `source/`, `versions/`, `uploads/`, `backups/`), its one config object, and
// the job's own objects under `jobs/` — read out of the key builders the code
// uses, not guessed. A key outside it is refused with 403 and LOGGED with the
// key, so the first live job on a site says exactly which key it needed that
// this list lacks, and the answer is a line here, never a wider wall.
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
//
// Metadata rides as headers because R2 keeps it beside the bytes and a JSON
// envelope would mean base64 for every dist file. `x-gf-meta-<name>` carries a
// custom-metadata entry (the value URL-encoded, since a header cannot carry a
// newline), `x-gf-http-<field>` an http-metadata field other than the content
// type, which is the `content-type` header itself.
//
// Dependency-free: `crypto.subtle` is what both runtimes have.

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

/** Mint a token for one job. `exp` is a unix time in SECONDS. */
export async function signJobToken({ id, slug, uid, exp }, key) {
  if (!ID_RE.test(String(id || ""))) throw new Error("bad job id");
  if (!SLUG_RE.test(String(slug || ""))) throw new Error("bad slug");
  if (typeof uid !== "string" || !uid) throw new Error("bad uid");
  const e = Math.floor(Number(exp));
  if (!Number.isFinite(e) || e <= 0) throw new Error("bad exp");
  const payload = B64.encode(TE.encode(JSON.stringify({ id: String(id), slug: String(slug), uid, exp: e })));
  const sig = await crypto.subtle.sign("HMAC", key, TE.encode("v1." + payload));
  return "v1." + payload + "." + B64.encode(new Uint8Array(sig));
}

/** The payload of a valid, unexpired token, or null. Never throws. */
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
    return { id: String(p.id), slug: String(p.slug), uid: p.uid, exp };
  } catch { return null; }
}

/** The prefixes a site's job may read and write under. */
export function jobPrefixes(slug) {
  const s = String(slug || "");
  // `builds/` since stage 7 (2026-09-05): every publish stages its own prefix
  // there, so a job that could not write it would fail at its first put.
  return ["sites/", "source/", "versions/", "uploads/", "backups/", "builds/"].map((p) => p + s + "/");
}

/** May a job for `slug` with id `id` touch `key`? */
export function allowedJobKey(slug, id, key) {
  const k = String(key || "");
  if (!k || !SLUG_RE.test(String(slug || "")) || !ID_RE.test(String(id || ""))) return false;
  if (k.includes("..")) return false;
  if (jobPrefixes(slug).some((p) => k.startsWith(p))) return true;
  if (k === "config/" + slug + ".json") return true;
  // The site's pointer (stage 7) — the one object activation moves.
  if (k === "current/" + slug + ".json") return true;
  // The job's own objects: the request it replays, its result, its resume
  // record — every one named by the job's id, none by anybody else's.
  if (k.startsWith("jobs/") && k.includes(String(id))) return true;
  return false;
}

/** May a job list under `prefix`? Only inside a prefix it may touch at all. */
export function allowedJobPrefix(slug, id, prefix) {
  const p = String(prefix || "");
  if (!p) return false;
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
 */
export function gatewayHandler({ bucket, verify, log = () => {} }) {
  return async function handle(request, id) {
    const auth = String(request.headers.get("authorization") || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const who = token ? await verify(token) : null;
    if (!who) return json(401, { error: "unauthorized" });
    if (String(who.id) !== String(id || "")) { log("id-mismatch", { token: who.id, path: id }); return json(403, { error: "not this job" }); }
    if (!bucket) return json(503, { error: "no bucket" });
    const url = new URL(request.url);
    const base = url.pathname.replace(/\/+$/, "");
    const tail = base.slice(base.indexOf("/api/job/") + ("/api/job/" + id).length);
    const key = url.searchParams.get("key") || "";
    const refuse = (k) => { log("out-of-scope", { id: who.id, slug: who.slug, key: k }); return json(403, { error: "key not in this job's scope", key: k }); };

    if (tail === "/r2" && (request.method === "GET" || request.method === "HEAD")) {
      if (!allowedJobKey(who.slug, who.id, key)) return refuse(key);
      const obj = request.method === "HEAD" ? await bucket.head(key) : await bucket.get(key);
      if (!obj) return new Response(null, { status: 404 });
      const headers = metaHeaders(obj);
      if (request.method === "HEAD") return new Response(null, { status: 200, headers });
      return new Response(obj.body, { status: 200, headers });
    }
    if (tail === "/r2" && request.method === "PUT") {
      if (!allowedJobKey(who.slug, who.id, key)) return refuse(key);
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
      if (!allowedJobKey(who.slug, who.id, key)) return refuse(key);
      await bucket.delete(key);
      return new Response(null, { status: 204 });
    }
    if (tail === "/r2/delete" && request.method === "POST") {
      let body = null;
      try { body = await request.json(); } catch { body = null; }
      const keys = body && Array.isArray(body.keys) ? body.keys.map(String) : null;
      if (!keys) return json(400, { error: "keys" });
      for (const k of keys) if (!allowedJobKey(who.slug, who.id, k)) return refuse(k);
      if (keys.length) await bucket.delete(keys);
      return new Response(null, { status: 204 });
    }
    if (tail === "/r2/list" && request.method === "POST") {
      let body = null;
      try { body = await request.json(); } catch { body = null; }
      const prefix = String((body && body.prefix) || "");
      if (!allowedJobPrefix(who.slug, who.id, prefix)) return refuse(prefix);
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
