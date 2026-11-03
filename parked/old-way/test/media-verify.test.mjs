// PARKED (2026-11-03, park-old-way): the old-way half of test/media-verify.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE PREPARED VERIFICATION HARNESS, DRIVEN OFFLINE (2026-10-15, after
// Codex's review of `9a2ea70b`).
//
// `scripts/media-verify.mjs` is what a press will run against the deployed
// Worker. Here the same `run()` is driven against the REAL Worker in-process
// (its routes, its owner gate, its serving) over the R2 double, with the
// sign-in and the ledger supplied — nothing leaves the machine, nothing is
// bought, no model is called. What these show: the gates refuse before any
// write or send; the storage mode's every check passes on a correct Worker
// and leaves the library as it found it; the delete-against-close judge
// accepts every valid order (close 200 then delete 200 among them) and refuses
// the outcomes that are never valid; the cut-history case is proven cut
// before any call; the conversation mode's ceiling and image gate stop it
// before it sends; and an early-accepted build is followed by its poll.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { withWire, envFor } from "../../../test/fixtures/live-ask.mjs";
import { mediaBucket } from "../../../test/fixtures/r2-media.mjs";
import { siteWorkersServingFiles } from "../../../test/fixtures/site-own-files.mjs";
import { sniffMedia } from "../../../site-media.mjs";
import {
  run, judgeDeleteVsClose, composerAllows, FOLLOW_UP_THREADS, caseHistory, CONVERSE_CASES, wavOf, GUARDED_SITES, ESTIMATES, BROWSER_EXPECT, UNAVAILABLE, MODES,
} from "../../../scripts/media-verify.mjs";

const FIX = new URL("../../../test/fixtures/media/", import.meta.url).pathname;
const JOB = "0123456789abcdef0123456789abcdef";
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE_BROWSER = !!chromium && existsSync(EXE);

/**
 * The harness's network, answered by the real Worker in-process. The ledger's
 * balance moves by what each routing call reports it charged — a stand-in for
 * the real ledger, so the harness's own accounting can be checked against it.
 */
function wired(worker, env, seen, calls = []) {
  let balance = 500;
  return async (url, init = {}) => {
    const u = new URL(url);
    calls.push(init.method + " " + u.pathname);
    if (u.pathname === "/api/credits") return Response.json({ balance });
    const req = new Request(url, { method: init.method, headers: init.headers, body: init.body });
    const res = await worker.fetch(req, env, makeCtx());
    if (u.pathname === "/api/site/route") {
      const body = await res.clone().json().catch(() => null);
      if (body && Number(body.cost) > 0) balance -= Number(body.cost);
    }
    return res;
  };
}

// ── THE REAL APP, LOCALLY: public/ served, media answered by the Worker ─────

const APP = "https://gofarther.test";
const PUB = new URL("../../../public/", import.meta.url).pathname;
async function appRoutes(ctx, worker, env, slug, hits) {
  const site = { id: "site_1727000000000_verify", slug, react: true, name: "Verify Bakery", url: "https://" + slug + ".gofarther.app/", pages: [{ path: "/", name: "Home" }], msgs: [], updatedAt: Date.now(), createdAt: Date.now() };
  await ctx.addInitScript(({ s }) => {
    try { localStorage.setItem("zephyr_owner_v1", "u-1"); if (!localStorage.getItem("zephyr_sites_v1")) localStorage.setItem("zephyr_sites_v1", JSON.stringify([s])); } catch (e) { /* no storage */ }
  }, { s: site });
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin !== APP) return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><h1>site</h1>" });
    const p = url.pathname;
    hits.push(req.method() + " " + p);
    if (p.startsWith("/api/site/" + slug + "/media") || p.startsWith("/api/site/" + slug + "/uploads") || p.startsWith("/u/")) {
      const headers = {};
      for (const [k, v] of Object.entries(req.headers())) if (/^(authorization|content-type|range|if-none-match)$/.test(k)) headers[k] = v;
      const body = req.postDataBuffer();
      if (body) headers["content-length"] = String(body.length);
      const r = await worker.fetch(new Request("https://gofarther.dev" + p + url.search, { method: req.method(), headers, body: body && req.method() !== "GET" && req.method() !== "HEAD" ? body : undefined }), env, makeCtx());
      const out = {};
      r.headers.forEach((v, k) => { out[k] = v; });
      return route.fulfill({ status: r.status, headers: out, body: Buffer.from(await r.arrayBuffer()) });
    }
    if (p.startsWith("/api/")) {
      if (p === "/api/site/list") return json(route, { ok: true, sites: [{ slug, name: slug, chat: site.id, db: false }] });
      if (p === "/api/credits" || p === "/api/credits/balance") return json(route, { credits: 48 });
      if (p.endsWith("/share")) return json(route, { share: "" });
      return json(route, { ok: true });
    }
    const file = p === "/" || p.startsWith("/projects") ? "/index.html" : p;
    const fp = path.join(PUB, file);
    if (!existsSync(fp)) return route.fulfill({ status: 404, body: "" });
    const ct = fp.endsWith(".js") ? "application/javascript" : fp.endsWith(".css") ? "text/css" : fp.endsWith(".html") ? "text/html" : fp.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
    return route.fulfill({ status: 200, contentType: ct, body: readFileSync(fp) });
  });
}

// ── THE CONVERSATION MODE: THE CEILING, AND ONE CASE ────────────────────────

test("THE CONVERSATION MODE: the harness's own ceiling stops it before it sends; with room, a case is sent once with images verified off and its charge read from the ledger", async () => {
  const worker = await loadWorker();
  const bucket = mediaBucket();
  const env = { ...envFor(bucket), IMAGE_PURCHASES: "off" };
  await withWire({ route: { intent: "ask", answer: "Hello!" }, converse: "Hello — tell me what you'd like for your site." }, async (seen) => {
    const calls = [];
    const f = wired(worker, env, seen, calls);
    const low = await run({ fetch: f, base: "https://gofarther.dev", token: "t", fixtures: FIX, mode: "converse", slug: "verify-talk", spend: "yes", picker: "sonnet", maxCredits: ESTIMATES.message.high - 1 });
    assert.equal(low.ok, false);
    assert.equal(low.results.stopped, "ceiling");
    assert.equal(calls.filter((c) => c.includes("/api/site/route")).length, 0, "a send passed the ceiling");
    const one = await run({ fetch: f, base: "https://gofarther.dev", token: "t", fixtures: FIX, mode: "converse", slug: "verify-talk", spend: "yes", picker: "sonnet", maxCredits: ESTIMATES.message.high + 1 });
    assert.equal(calls.filter((c) => c.includes("/api/site/route")).length, 1, "exactly one case fits the ceiling");
    const c1 = one.results.checks.filter((c) => c.name.startsWith("C1-greeting"));
    assert.deepEqual(c1.filter((c) => c.verdict === "fail"), [], JSON.stringify(c1));
    assert.equal(one.results.stopped, "ceiling", "the run did not stop at its ceiling");
  });
});
