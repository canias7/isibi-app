// A JOB'S STORAGE THROUGH THE REAL GATEWAY (2026-10-16, Codex's review of
// `668ebc87`).
//
// A container job has no bucket of its own: its `SITES_BUCKET` is the
// `GatewayBucket` shim (builder/container-env.mjs), and every get, head, put,
// delete and list goes over HTTP to the Worker's `/api/job/<id>/r2…` route,
// where `gatewayHandler` (builder/job-gateway.mjs) checks the job's signed
// token and `allowedJobKey` before touching the real bucket. The fired-job
// cases before this handed a job the platform's bucket directly, so a key the
// wall refused looked writable in every case — which is how the draft's own
// records were refused in every real container job without one test noticing.
//
// Two ways in, both the real code on both sides:
//   * `gatewayBucketFor` — the handler over a given bucket, with a token this
//     side signs (`signJobToken`, the derived key `gatewayKey`), the scope op
//     wired (`/scope`, an owner lookup the case supplies), for a job run
//     outside the platform (a Build's resume after scoping);
//   * `workerGatewayFetch` — the Worker's own route (`jobGateway`), reached
//     through `worker.fetch`, for a job whose launch the Worker minted (the
//     token in the launch is the one a real container would present).
// Every answer the shim gets is kept (`calls`), and every refusal named
// (`refused`), so a case shows what the wall let through and what it did not.
import { GatewayBucket } from "../../builder/container-env.mjs";
import { gatewayHandler, gatewayKey, signJobToken, verifyJobToken, preScopeSlug } from "../../builder/job-gateway.mjs";
import { makeCtx } from "./worker-harness.mjs";

/** Wrap a fetch so every gateway answer is kept: `{ method, key, status }`, refusals also in `refused`. */
function recording(f, calls, refused) {
  return async (url, init = {}) => {
    const u = new URL(String(url));
    const res = await f(String(url), init);
    const key = u.searchParams.get("key") || u.pathname.split("/").slice(-1)[0];
    let named = key;
    if (res.status === 403) { try { named = String(((await res.clone().json()) || {}).key || key); } catch { named = key; } refused.push({ method: (init.method || "GET").toUpperCase(), key: named, path: u.pathname }); }
    calls.push({ method: (init.method || "GET").toUpperCase(), key, status: res.status, path: u.pathname });
    return res;
  };
}

/**
 * A job's bucket through the gateway over `bucket`. `slug` null makes a
 * PRE-SCOPE token (a first build with no name yet); `owner(slug)` answers the
 * scope op's lookup (default: free). Answers `{ bucket, gateway, rescope,
 * calls, refused, token }`; `rescope(slug)` runs the real `/scope` op and
 * moves the shim to the token it answers.
 */
export async function gatewayBucketFor({ bucket, id, slug = null, uid = "u-gw-1", secret = "s".repeat(48), owner = async () => null, exp = Date.now() + 3600_000 } = {}) {
  const key = await gatewayKey(secret);
  const pre = !slug;
  const token = await signJobToken({ id, slug: pre ? preScopeSlug(id) : slug, uid, exp, ...(pre ? { pre: true } : {}) }, key);
  const handle = gatewayHandler({
    bucket,
    verify: (t) => verifyJobToken(t, key, Date.now()),
    log: () => {},
    scope: { sign: (p) => signJobToken(p, key), owner },
  });
  const calls = [], refused = [];
  const f = recording((url, init) => handle(new Request(url, { ...init, ...(init && init.body != null && typeof init.body !== "string" ? { duplex: "half" } : {}) }), id), calls, refused);
  const gateway = { url: "https://gofarther.dev/api/job/" + id, token };
  const shim = new GatewayBucket({ url: gateway.url, token, fetch: f });
  const rescope = async (name) => {
    const r = await f(gateway.url + "/scope", { method: "POST", headers: { authorization: "Bearer " + gateway.token, "content-type": "application/json" }, body: JSON.stringify({ slug: name }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || typeof j.token !== "string") return { ok: false, status: r.status, body: j };
    gateway.token = j.token; shim.token = j.token;
    return { ok: true };
  };
  return { bucket: shim, gateway, rescope, calls, refused, token, fetch: f };
}

/**
 * The fetch a container job's shim uses to reach the WORKER's own gateway
 * route: each request handed to `worker.fetch` with the platform's env, as
 * Cloudflare hands the container's call to the Worker.
 */
export function workerGatewayFetch(worker, env, { calls = [], refused = [] } = {}) {
  // THE MODULE OR ITS DEFAULT EXPORT: either way, the Worker's own `fetch`.
  const w = worker && typeof worker.fetch === "function" ? worker : worker && worker.default;
  if (!w || typeof w.fetch !== "function") throw new Error("no Worker fetch to reach the gateway through");
  const f = async (url, init = {}) => {
    const ctx = makeCtx();
    const res = await w.fetch(new Request(String(url), { ...init, ...(init && init.body != null && typeof init.body !== "string" ? { duplex: "half" } : {}) }), env, ctx);
    await Promise.allSettled(ctx.pending);
    return res;
  };
  return { fetch: recording(f, calls, refused), calls, refused };
}
