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

import { metaHeaders, readMetaHeaders, onlyIfHeaders, SB_MARKER, SB_REQUEST_HEADERS } from "./job-gateway.mjs";

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

/**
 * A refusal the gateway answered, TYPED (stage 4a, 2026-09-05). Before this
 * every non-2xx but 404 and 412 threw a plain Error, so a 403 — the wall
 * refusing a key the job needed — read exactly like an R2 outage, and the
 * spine's catch called it "our build service was restarting". `code` says
 * which of the two it is: `forbidden` (401 or 403 — nothing a retry fixes;
 * the wall or the token) or `transient` (everything else); `status` and
 * `key` ride with it so the sentence the customer reads can name the key and
 * the log can say what the list lacks.
 */
export class GatewayError extends Error {
  constructor(op, status, key) {
    super("gateway " + op + " " + status + (key ? " for " + key : ""));
    this.name = "GatewayError";
    this.op = op;
    this.status = Number(status) || 0;
    this.key = key == null ? "" : String(key);
    this.code = this.status === 403 || this.status === 401 ? "forbidden" : "transient";
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
    if (!r.ok) throw new GatewayError("get", r.status, key);
    return new GatewayObject({ key: String(key), ...readMetaHeaders(r.headers) }, r);
  }
  async head(key) {
    const r = await this._req(this._key(key), { method: "HEAD" });
    if (r.status === 404) return null;
    if (!r.ok) throw new GatewayError("head", r.status, key);
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
    if (!r.ok) throw new GatewayError("put", r.status, key);
    const j = await r.json();
    return new GatewayObject({ ...j, uploaded: j.uploaded ? new Date(j.uploaded) : undefined }, null);
  }
  async delete(keys) {
    const list = Array.isArray(keys) ? keys.map(String) : [String(keys)];
    if (list.length === 1) {
      const r = await this._req(this._key(list[0]), { method: "DELETE" });
      if (!r.ok && r.status !== 404) throw new GatewayError("delete", r.status, list[0]);
      return;
    }
    if (!list.length) return;
    const r = await this._req("/r2/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ keys: list }) });
    if (!r.ok) {
      // THE KEY THE WALL NAMED, when it named one: a batch refusal says which
      // of the list it stopped on, so the log and the sentence carry it.
      let named = "";
      try { named = String(((await r.json()) || {}).key || ""); } catch { named = ""; }
      throw new GatewayError("delete", r.status, named);
    }
  }
  async list(opts = {}) {
    const r = await this._req("/r2/list", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(opts || {}) });
    if (!r.ok) throw new GatewayError("list", r.status, String((opts && opts.prefix) || ""));
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
 * SUPABASE THROUGH THE GATEWAY (stage 4b, 2026-09-06): the `fetch` a job
 * process runs under. A request to the platform's Supabase origin that
 * presents `SB_MARKER` as its credential — `apikey`, or `Authorization:
 * Bearer` — is what the Worker's helpers send when the env carries the marker
 * under `SUPABASE_SERVICE_KEY`; it goes to the gateway's `/sb/<path>` with the
 * job token instead, the path and the query as they were, the body as it was,
 * the caller's own `signal` kept (its timeout is the caller's clock). Every
 * other request — the customer's own calls with the anon key and their JWT, a
 * provider, Neon, the Cloudflare API, the build service next door, the R2
 * gateway itself — goes out untouched. The marker is the tell; the origin is
 * the belt.
 */
export function gatewayFetch({ gateway, sbUrl, fetch: f = globalThis.fetch } = {}) {
  if (!gateway || !gateway.url || !gateway.token) throw new Error("the gateway fetch needs its gateway");
  const base = String(gateway.url).replace(/\/+$/, "");
  const origin = new URL(String(sbUrl)).origin;
  return async function fetchThroughGateway(input, init) {
    const req = typeof Request !== "undefined" && input instanceof Request ? input : null;
    let u;
    try { u = new URL(req ? req.url : String(input)); } catch { return f(input, init); }
    if (u.origin !== origin) return f(input, init);
    const headers = new Headers(req ? req.headers : undefined);
    if (init && init.headers) for (const [k, v] of new Headers(init.headers)) headers.set(k, v);
    const marked = headers.get("apikey") === SB_MARKER || headers.get("authorization") === "Bearer " + SB_MARKER;
    if (!marked) return f(input, init);
    const method = String((init && init.method) || (req && req.method) || "GET").toUpperCase();
    const fwd = new Headers();
    for (const h of SB_REQUEST_HEADERS) if (headers.has(h)) fwd.set(h, headers.get(h));
    fwd.set("authorization", "Bearer " + gateway.token);
    let body;
    if (method !== "GET" && method !== "HEAD") body = init && init.body !== undefined ? init.body : (req ? req.body : undefined);
    const signal = (init && init.signal) || (req && req.signal) || undefined;
    return f(base + "/sb" + u.pathname + u.search, {
      method, headers: fwd, body, signal, ...(body != null && typeof body !== "string" ? { duplex: "half" } : {}),
    });
  };
}

/**
 * The env for one job. `secrets` are the string bindings (keys, the flags);
 * `gateway` is `{ url, token }`; `sb` — `{ url }`, the Supabase origin the
 * shim intercepts — puts `SB_MARKER` under `SUPABASE_SERVICE_KEY` and
 * `CREDITS_MINT_SECRET`, whatever `secrets` carried under those names (a
 * launch is refused with them; this is the belt); `fetch` is injected for
 * tests. Every non-string binding is either the shim or absent.
 */
export function makeContainerEnv({ secrets = {}, gateway, sb = null, fetch: f } = {}) {
  if (!gateway || !gateway.url || !gateway.token) throw new Error("a job env needs its gateway");
  const env = {};
  for (const [k, v] of Object.entries(secrets || {})) if (typeof v === "string") env[k] = v;
  if (sb && sb.url) { env.SUPABASE_SERVICE_KEY = SB_MARKER; env.CREDITS_MINT_SECRET = SB_MARKER; }
  env.SITES_BUCKET = new GatewayBucket({ url: gateway.url, token: gateway.token, fetch: f });
  env.BUILD_QUEUE = refusingQueue;
  env.SITE_BUILD_CONTAINER = { local: true };
  // THE STOP SIGNAL (stage 5d, 2026-09-06): aborted by the runner when the
  // process is told to stop (SIGTERM — the build service past the job's
  // deadline, a cancel from outside, the service's own drain giving up), read
  // by the job's gate as `stopped`, which ends the job through the row's own
  // door instead of a death the sweep has to notice. A binding the Worker's
  // own consumer never has, and every read of it is optional-chained.
  env.JOB_STOP = new AbortController();
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
