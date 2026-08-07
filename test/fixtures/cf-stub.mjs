// A stand-in for the Cloudflare API, preloaded with `--import` so
// `.github/scripts/saas-setup.mjs` can be RUN rather than read.
//
// Source-reading assertions could not hold this script: a mutation that made
// `if (r.code === NOT_ENTITLED)` unreachable survived a test asserting the
// constant and both messages were present, because all three still were. The
// only thing that catches a dead branch is executing it.
//
// The scenario arrives as JSON in `CF_STUB`, and every write is recorded and
// printed on exit so a test can assert that a dry run wrote NOTHING — which is
// the property that keeps this script safe to point at production DNS.
const S = JSON.parse(process.env.CF_STUB || "{}");
const wrote = [];

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const method = (init.method || "GET").toUpperCase();
  if (method !== "GET") wrote.push(method + " " + u.replace("https://api.cloudflare.com/client/v4", ""));

  const deny = (code, message) => ({
    ok: false, status: code === 1404 ? 403 : 403,
    json: async () => ({ success: false, errors: [{ code, message: message || "Authentication error" }] }),
  });
  const ok = (result, extra = {}) => ({ ok: true, status: 200, json: async () => ({ success: true, result, ...extra }) });

  if (u.includes("/zones?name=")) {
    return S.noZone ? ok([]) : ok([{ id: "zone123", plan: { name: S.plan || "Free Website" } }]);
  }
  if (u.includes("/dns_records")) {
    if (!S.dns) return deny(10000);
    if (method === "GET") return ok(S.record ? [S.record] : []);
    return ok({ id: "rec1" });
  }
  if (u.includes("/custom_hostnames/fallback_origin")) {
    if (!S.ssl) return deny(S.sslCode || 10000, S.sslMessage);
    return ok({ origin: S.fallback || null, status: S.fallback ? "active" : "" });
  }
  if (u.includes("/custom_hostnames")) {
    if (!S.ssl) return deny(S.sslCode || 10000, S.sslMessage);
    return ok([], { result_info: { total_count: S.hostnames || 0 } });
  }
  if (u.includes("/workers/routes")) {
    if (!S.routes) return deny(10000);
    return ok(S.routeList || []);
  }
  return { ok: false, status: 404, json: async () => ({ success: false, errors: [{ code: 7003, message: "no route for that URI" }] }) };
};

process.on("exit", () => console.log("[stub-writes] " + (wrote.join(" | ") || "none")));
