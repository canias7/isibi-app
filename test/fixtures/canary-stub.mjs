// Preloaded with `node --import`: answers EVERY network call the edit canary
// makes, in-process, so the real `scripts/edit-canary.mjs` can be driven end to
// end with nothing leaving this machine. `https.request` and `fetch` are both
// replaced before the script's first line runs; each call is appended to
// STUB_LOG as one JSON line, and a call the stub has no answer for is answered
// 599 and logged, never forwarded.
//
// What the harness supplies, by environment:
//   STUB_LOG    the file each call is appended to
//   STUB_ROUTE  the routing answer `/api/site/route` gives (JSON)
//   STUB_SITE   the site's own data read: {"status":…, "text":"…"} (JSON)
// The paid edit POST is recorded and answered 500: a harness proves which calls
// were made, and nothing here runs an edit.
import https from "node:https";
import { EventEmitter } from "node:events";
import { appendFileSync } from "node:fs";

const LOG = process.env.STUB_LOG;
const ROUTE = JSON.parse(process.env.STUB_ROUTE || "{}");
const SITE = JSON.parse(process.env.STUB_SITE || '{"status":404,"text":"{}"}');
const SLUG = "stub-site";
const JOB = "a".repeat(32);
const log = (e) => { if (LOG) appendFileSync(LOG, JSON.stringify(e) + "\n"); };

function worker(method, path, body, headers) {
  const p = path.split("?")[0];
  if (method === "GET" && p === "/api/site/build-health") return [200, { deploy: "0123456789abcdef0123456789abcdef01234567", image: "0123456789abcdef" }];
  if (method === "GET" && p === "/api/site/runtime") return [200, { deploy: "0123456789abcdef0123456789abcdef01234567", async: true, runner: true }];
  if (method === "POST" && p === `/api/site/${SLUG}/edit`) {
    let b = {}; try { b = JSON.parse(body || "{}"); } catch { /* not JSON */ }
    if (headers && headers["x-gf-job"]) return [404, { error: "not found" }];
    if (b.instruction === "") return [202, { ok: true, job: JOB, status: "queued", poll: "/api/site/edit/" + JOB }];
    return [500, { error: "stub: the paid edit is recorded, not run" }];
  }
  if (method === "GET" && p === "/api/site/edit/" + JOB) return [200, { ok: false, escalate: true, reason: "empty", cost: 0 }, { "x-gf-edit": "final" }];
  if (method === "GET" && p.startsWith("/api/site/edit/")) return [404, { error: "not found" }];
  if (method === "GET" && p === "/api/site/source") return [200, { reads: { pages: true, parts: true, assets: true }, pages: [{ path: "index.tsx", source: "export default 1\n" }], parts: [] }];
  if (method === "GET" && p === `/api/site/${SLUG}/seo`) return [200, {}];
  if (method === "GET" && p === "/api/site/routes") return [200, { ok: true, routes: ["/", "/prices"] }];
  if (method === "POST" && p === "/api/site/route") return [200, ROUTE];
  return [599, { error: "stub has no answer for " + method + " " + path }];
}

https.request = (opts, cb) => {
  const req = new EventEmitter();
  let body = "";
  req.write = (c) => { body += String(c); };
  req.end = () => setImmediate(() => {
    const [status, json, extra] = worker(opts.method, opts.path, body, opts.headers);
    log({ via: "https", method: opts.method, path: opts.path, body: body || null, status });
    const res = new EventEmitter();
    res.statusCode = status;
    res.headers = { "content-type": "application/json", ...(extra || {}) };
    cb(res);
    setImmediate(() => { res.emit("data", Buffer.from(JSON.stringify(json))); res.emit("end"); });
  });
  return req;
};

const reply = (v, status = 200, headers = {}) => new Response(typeof v === "string" ? v : JSON.stringify(v), { status, headers: { "content-type": typeof v === "string" ? "text/html" : "application/json", ...headers } });
globalThis.fetch = async (input, init = {}) => {
  const url = String((input && input.url) || input);
  const method = (init && init.method) || "GET";
  let r;
  if (url.endsWith("/auth/v1/admin/generate_link")) r = reply({ hashed_token: "h" });
  else if (url.endsWith("/auth/v1/verify")) r = reply({ access_token: "t", user: { id: "u-stub", email: "owner@example.com" } });
  else if (url.includes("/rest/v1/credits")) r = reply([{ balance: 13 }]);
  else if (url.startsWith(`https://${SLUG}.gofarther.app/sitemap.xml`)) r = reply(`<urlset><url><loc>https://${SLUG}.gofarther.app/</loc></url></urlset>`);
  else if (url.startsWith(`https://${SLUG}.gofarther.app/api/db/${SLUG}/data/`)) r = new Response(SITE.text, { status: SITE.status, headers: { "content-type": "application/json" } });
  else if (url.startsWith(`https://${SLUG}.gofarther.app/`)) r = reply("<html><body><h1>Home</h1></body></html>", 200, { "x-site-version": "01790404806543-kk6qsh" });
  else r = reply({ error: "stub has no answer" }, 599);
  log({ via: "fetch", method, url, status: r.status });
  return r;
};
