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
//   STUB_SITE   the site's own data read: {"status":…, "text":"…"} (JSON), and
//               how it counts. By default it answers as the Data API does
//               through the Worker (measured on fretwork-1, 2026-09-30): the
//               rows served as `first-last/total` in `Content-Range`, the
//               total only when the request asked `Prefer: count=exact` and
//               `*` otherwise, `*/total` for no rows. `total` names a table
//               longer than the rows served; `range` (a string, or null for no
//               header at all) replaces the header outright.
// The paid edit POST is recorded and answered 500: a harness proves which calls
// were made, and nothing here runs an edit.
//   STUB_ADDON  the add-on press (2026-10-01): when set, the stored reply the
//               add-on job's poll hands back (JSON), and the add-on POST queues
//               that job; STUB_ADDON_STATUS is the reply's own status (200 by
//               default). Unset, the add-on POST is recorded and answered 500,
//               like the paid edit.
//   STUB_AFTER_VERSION  once the add-on POST has been made, the version every
//               page of the site reports (by default the before-read's, as an
//               addition that publishes nothing leaves it) — a publish landing
//               under the press.
//   STUB_ROUTES the routing-only batch (2026-10-02): a JSON list of routing
//               answers, one per routing call in order; past its end, or unset,
//               every call gets STUB_ROUTE. An entry `{"__status": n}` answers
//               that status with no body instead.
//   STUB_PAGES_DOWN  a slug whose page list (`/api/site/routes`) answers 503.
//   STUB_BALANCE the balance the credits read answers (13 by default).
import https from "node:https";
import { EventEmitter } from "node:events";
import { appendFileSync } from "node:fs";

const LOG = process.env.STUB_LOG;
const ROUTE = JSON.parse(process.env.STUB_ROUTE || "{}");
const SITE = JSON.parse(process.env.STUB_SITE || '{"status":404,"text":"{}"}');

/** The site read's `Content-Range`, as the Data API would give it (see above). */
function siteRange(prefer) {
  if (Object.hasOwn(SITE, "range")) return SITE.range;
  let n = 0;
  try { const rows = JSON.parse(SITE.text); if (Array.isArray(rows)) n = rows.length; } catch { /* not a list */ }
  const total = /\bcount=exact\b/.test(prefer || "") ? (SITE.total ?? n) : "*";
  return n ? `0-${n - 1}/${total}` : `*/${total}`;
}
const SLUG = "stub-site";
const JOB = "a".repeat(32);
const ADDON = process.env.STUB_ADDON ? JSON.parse(process.env.STUB_ADDON) : null;
const ADDON_STATUS = Number(process.env.STUB_ADDON_STATUS) || 200;
const ADDON_JOB = "b".repeat(32);
const AFTER_VERSION = process.env.STUB_AFTER_VERSION || "";
const ROUTES = process.env.STUB_ROUTES ? JSON.parse(process.env.STUB_ROUTES) : null;
const PAGES_DOWN = process.env.STUB_PAGES_DOWN || "";
let routeCalls = 0;
let addonPosted = false;
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
  if (method === "POST" && p === `/api/site/${SLUG}/addon`) {
    if (!ADDON) return [500, { error: "stub: the paid add-on is recorded, not run" }];
    addonPosted = true;
    return [202, { ok: true, job: ADDON_JOB, status: "queued", poll: "/api/site/edit/" + ADDON_JOB }];
  }
  if (method === "GET" && ADDON && p === "/api/site/edit/" + ADDON_JOB) return [ADDON_STATUS, ADDON, { "x-gf-edit": "final" }];
  if (method === "GET" && p === "/api/site/edit/" + JOB) return [200, { ok: false, escalate: true, reason: "empty", cost: 0 }, { "x-gf-edit": "final" }];
  if (method === "GET" && p.startsWith("/api/site/edit/")) return [404, { error: "not found" }];
  if (method === "GET" && p === "/api/site/source") return [200, { reads: { pages: true, parts: true, assets: true }, pages: [{ path: "index.tsx", source: "export default 1\n" }], parts: [] }];
  if (method === "GET" && p === `/api/site/${SLUG}/seo`) return [200, {}];
  if (method === "GET" && p === "/api/site/routes") {
    const slug = new URLSearchParams(path.split("?")[1] || "").get("slug");
    if (PAGES_DOWN && slug === PAGES_DOWN) return [503, { error: "down" }];
    return [200, { ok: true, routes: ["/", "/prices"] }];
  }
  if (method === "POST" && p === "/api/site/route") {
    const answer = ROUTES && routeCalls < ROUTES.length ? ROUTES[routeCalls] : ROUTE;
    routeCalls++;
    if (answer && Number.isInteger(answer.__status)) return [answer.__status, {}];
    return [200, answer];
  }
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
  else if (url.includes("/rest/v1/credits")) r = reply([{ balance: process.env.STUB_BALANCE ? Number(process.env.STUB_BALANCE) : 13 }]);
  else if (url.startsWith(`https://${SLUG}.gofarther.app/sitemap.xml`)) r = reply(`<urlset><url><loc>https://${SLUG}.gofarther.app/</loc></url></urlset>`);
  else if (url.startsWith(`https://${SLUG}.gofarther.app/api/db/${SLUG}/data/`)) {
    const prefer = new Headers(init.headers || {}).get("prefer");
    const range = siteRange(prefer);
    r = new Response(SITE.text, { status: SITE.status, headers: { "content-type": "application/json", ...(range === null ? {} : { "content-range": range }) } });
    log({ via: "fetch", method, url, status: r.status, prefer, range });
    return r;
  }
  else if (url.startsWith(`https://${SLUG}.gofarther.app/`)) r = reply("<html><body><h1>Home</h1></body></html>", 200, { "x-site-version": addonPosted && AFTER_VERSION ? AFTER_VERSION : "01790404806543-kk6qsh" });
  else r = reply({ error: "stub has no answer" }, 599);
  log({ via: "fetch", method, url, status: r.status });
  return r;
};
