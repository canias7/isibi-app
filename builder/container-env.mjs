// THE WORKER'S `env`, INSIDE THE CONTAINER.
//
// The Worker module (worker.js) reads its bindings off one object: the R2
// bucket, the queue, the container namespace, and the string secrets. When the
// module runs inside the site's container for a queued job (worker-loader.mjs),
// this is that object — the strings as they are, the bucket as a shim speaking
// job-gateway.mjs's protocol back to the Worker, the container namespace as a
// marker the loader's `getContainer` shim ignores, and the queue as a refusal.
//
// ── WHAT IS SHIMMED AND WHAT IS NOT, read off the edit path ──────────────────
//
//   SITES_BUCKET          141 call sites — `GatewayBucket` below, R2's surface:
//                         get/head/put/list/delete, objects with text/json/
//                         arrayBuffer/body and their metadata, `put` with
//                         `onlyIf` answering null the way R2 does.
//   SITE_BUILD_CONTAINER  the loader's `getContainer` shim reaches the build
//                         service on localhost; the namespace is a marker.
//   BUILD_QUEUE           NOTHING ON THE EDIT PATH SENDS. The build's resume
//                         messages and both routes' enqueues are Worker-side;
//                         so a send from inside the container is a design
//                         mistake, refused loudly rather than dropped.
//   SITE_ROUTES           optional in the code (`env.SITE_ROUTES || null`, a
//                         cache whose miss falls back to Supabase) — absent.
//   SITE_API_CACHE, EMAIL, SITE_WORKERS, ASSETS — not on the job path; absent.
//   the secrets           strings, handed in over stdin by the build service
//                         (container-job.mjs), never through the environment.
//
// Dependency-free; the `fetch` is injected so the shim is driven in tests
// against the real handler and a fake bucket, with no server.

import { metaHeaders, readMetaHeaders, onlyIfHeaders } from "./job-gateway.mjs";

/** An object as R2 hands it out: metadata, and a body read once. */
export class GatewayObject {
  constructor(meta, response) {
    this.key = meta.key;
    this.size = meta.size;
    this.etag = meta.etag;
    this.httpEtag = meta.httpEtag || (meta.etag ? '"' + meta.etag + '"' : undefined);
    this.uploaded = meta.uploaded;
    this.httpMetadata = meta.httpMetadata || {};
    this.customMetadata = meta.customMetadata || {};
    this.version = meta.etag;
    this._res = response || null;
    this.bodyUsed = false;
  }
  get body() { return this._res ? this._res.body : null; }
  async arrayBuffer() { this.bodyUsed = true; return this._res ? this._res.arrayBuffer() : new ArrayBuffer(0); }
  async bytes() { return new Uint8Array(await this.arrayBuffer()); }
  async text() { this.bodyUsed = true; return this._res ? this._res.text() : ""; }
  async json() { return JSON.parse(await this.text()); }
  async blob() { this.bodyUsed = true; return this._res ? this._res.blob() : new Blob([]); }
  writeHttpMetadata(headers) {
    const h = metaHeaders({ httpMetadata: this.httpMetadata });
    for (const [k, v] of h.entries()) if (k === "content-type" || k.startsWith("x-gf-http-")) headers.set(k === "content-type" ? k : k.slice("x-gf-http-".length), k === "content-type" ? v : decodeURIComponent(v));
  }
}

/** The R2 bucket, over the gateway. */
export class GatewayBucket {
  constructor({ url, token, fetch: f = globalThis.fetch }) {
    if (!url || !token) throw new Error("gateway url and token are required");
    this.url = String(url).replace(/\/+$/, "");
    this.token = String(token);
    this.fetch = f;
  }
  _req(path, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set("authorization", "Bearer " + this.token);
    return this.fetch(this.url + path, { ...init, headers });
  }
  _key(key) { return "/r2?key=" + encodeURIComponent(String(key)); }

  async get(key) {
    const r = await this._req(this._key(key), { method: "GET" });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("gateway get " + r.status + " for " + key);
    return new GatewayObject({ key: String(key), ...readMetaHeaders(r.headers) }, r);
  }
  async head(key) {
    const r = await this._req(this._key(key), { method: "HEAD" });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("gateway head " + r.status + " for " + key);
    return new GatewayObject({ key: String(key), ...readMetaHeaders(r.headers) }, null);
  }
  async put(key, value, opts = {}) {
    const headers = { ...onlyIfHeaders(opts && opts.onlyIf) };
    const meta = metaHeaders({ httpMetadata: opts && opts.httpMetadata, customMetadata: opts && opts.customMetadata });
    for (const [k, v] of meta.entries()) headers[k] = v;
    if (!headers["content-type"]) headers["content-type"] = "application/octet-stream";
    const body = value == null ? new Uint8Array(0) : value;
    const r = await this._req(this._key(key), { method: "PUT", headers, body, duplex: "half" });
    // A failed condition is R2's null, not a throw — the resume's claim and
    // every `onlyIf` caller reads it that way.
    if (r.status === 412) return null;
    if (!r.ok) throw new Error("gateway put " + r.status + " for " + key);
    const j = await r.json();
    return new GatewayObject({ ...j, uploaded: j.uploaded ? new Date(j.uploaded) : undefined }, null);
  }
  async delete(keys) {
    const list = Array.isArray(keys) ? keys.map(String) : [String(keys)];
    if (list.length === 1) {
      const r = await this._req(this._key(list[0]), { method: "DELETE" });
      if (!r.ok && r.status !== 404) throw new Error("gateway delete " + r.status + " for " + list[0]);
      return;
    }
    if (!list.length) return;
    const r = await this._req("/r2/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ keys: list }) });
    if (!r.ok) throw new Error("gateway delete " + r.status);
  }
  async list(opts = {}) {
    const r = await this._req("/r2/list", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(opts || {}) });
    if (!r.ok) throw new Error("gateway list " + r.status + " for " + String((opts && opts.prefix) || ""));
    const j = await r.json();
    return {
      objects: (j.objects || []).map((o) => new GatewayObject({ ...o, uploaded: o.uploaded ? new Date(o.uploaded) : undefined }, null)),
      truncated: !!j.truncated,
      cursor: j.cursor || undefined,
      delimitedPrefixes: j.delimitedPrefixes || [],
    };
  }
}

/** A queue nothing inside the container may send to. */
export const refusingQueue = {
  async send(msg) { throw new Error("BUILD_QUEUE.send inside the container: " + JSON.stringify(msg).slice(0, 120)); },
  async sendBatch() { throw new Error("BUILD_QUEUE.sendBatch inside the container"); },
};

/**
 * The env for one job. `secrets` are the string bindings (keys, the service
 * key, the flags); `gateway` is `{ url, token }`; `fetch` is injected for
 * tests. Every non-string binding is either the shim or absent.
 */
export function makeContainerEnv({ secrets = {}, gateway, fetch: f } = {}) {
  if (!gateway || !gateway.url || !gateway.token) throw new Error("a job env needs its gateway");
  const env = {};
  for (const [k, v] of Object.entries(secrets || {})) if (typeof v === "string") env[k] = v;
  env.SITES_BUCKET = new GatewayBucket({ url: gateway.url, token: gateway.token, fetch: f });
  env.BUILD_QUEUE = refusingQueue;
  env.SITE_BUILD_CONTAINER = { local: true };
  return env;
}

/** The ctx for one job: `waitUntil` collects, and the runner drains it. */
export function makeContainerCtx() {
  const pending = [];
  return {
    waitUntil(p) { pending.push(Promise.resolve(p).catch(() => {})); },
    passThroughOnException() {},
    async drain() { while (pending.length) await pending.splice(0).reduce((a, p) => a.then(() => p), Promise.resolve()); },
  };
}
