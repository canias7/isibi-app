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
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { withWire, envFor } from "./fixtures/live-ask.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { sniffMedia } from "../site-media.mjs";
import {
  run, judgeDeleteVsClose, composerAllows, caseHistory, CONVERSE_CASES, wavOf, GUARDED_SITES, ESTIMATES, BROWSER_EXPECT, UNAVAILABLE, MODES,
} from "../scripts/media-verify.mjs";

const FIX = new URL("./fixtures/media/", import.meta.url).pathname;
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
const PUB = new URL("../public/", import.meta.url).pathname;
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

test("THE COMPOSER'S PAGE MAY WRITE ONLY THIS SITE'S MEDIA: routing, builds, edits and any other site are refused", () => {
  assert.equal(composerAllows("GET", "/api/site/list", "s"), true);
  assert.equal(composerAllows("POST", "/api/site/s/media", "s"), true);
  assert.equal(composerAllows("PUT", "/api/site/s/media/abc/1", "s"), true);
  assert.equal(composerAllows("DELETE", "/api/site/s/uploads/x.webm", "s"), true);
  for (const p of ["/api/site/route", "/api/site/react-build", "/api/site/edit", "/api/site/other/media", "/api/site/s/pages", "/api/agent/x"]) {
    assert.equal(composerAllows("POST", p, "s"), false, p);
  }
});

// ── THE JUDGE ───────────────────────────────────────────────────────────────

test("THE DELETE-AGAINST-CLOSE JUDGE accepts every valid order — close 200 then delete 200 among them — and refuses what is never valid", () => {
  const end = { servedAfter: 404, originalReceipt: "removed", roomFree: true };
  const ok = [
    { close: { status: 200 }, del: { status: 409, code: "replacing" }, delRetry: { status: 200 }, replacementReceipt: "removed" },
    { close: { status: 200 }, del: { status: 200 }, replacementReceipt: "removed" },
    { close: { status: 410, code: "removed" }, del: { status: 200 }, replacementReceipt: "gone" },
    { close: { status: 200 }, del: { status: 503, code: "unconfirmed" }, delRetry: { status: 200 }, replacementReceipt: "removed" },
  ];
  for (const c of ok) assert.equal(judgeDeleteVsClose({ ...end, ...c }).ok, true, JSON.stringify(c) + " " + judgeDeleteVsClose({ ...end, ...c }).why);
  const bad = [
    { ...end, close: { status: 200 }, del: { status: 200 }, replacementReceipt: "removed", servedAfter: 200 }, // a delete answered and the file still served
    { ...end, close: { status: 200 }, del: { status: 200 }, replacementReceipt: "done" }, // the receipt says done over a deleted file
    { ...end, close: { status: 200 }, del: { status: 409, code: "replacing" }, delRetry: { status: 409 }, replacementReceipt: "removed" }, // never deleted
    { ...end, close: { status: 410, code: "removed" }, del: { status: 200 }, replacementReceipt: "gone", roomFree: false }, // room held
    { ...end, close: { status: 502 }, del: { status: 200 }, replacementReceipt: "gone" }, // an order nothing valid makes
  ];
  for (const c of bad) assert.equal(judgeDeleteVsClose(c).ok, false, JSON.stringify(c));
});

// ── THE DETERMINISTIC CASES ─────────────────────────────────────────────────

test("THE CUT-HISTORY CASE IS CUT BEFORE ANYTHING IS SENT: the page's own historyWire leaves version three out and says so", () => {
  const c = CONVERSE_CASES.find((x) => x.id === "C5-cut-history");
  const h = caseHistory(c);
  assert.equal(h.cutProven, true);
  const long = h.history.find((t) => t.role === "assistant");
  assert.ok(long.full > 4000 && long.text.length === 4000);
  assert.match(long.text, /Version two/);
  assert.doesNotMatch(long.text, /Version three/);
  // The others send no thread: deterministic, and none relies on a long model answer.
  for (const x of CONVERSE_CASES.filter((y) => y.id !== c.id)) assert.deepEqual(caseHistory(x).history, []);
});

test("THE GENERATED THREE-PART WAV is a WAV the server takes from its bytes", () => {
  const w = wavOf(2 * 8 * 1024 * 1024 + 4096);
  assert.deepEqual(sniffMedia(w.subarray(0, 8 * 1024 * 1024)), { ext: "wav", mime: "audio/wav", kind: "audio" });
});

test("THE EXPECTATIONS ARE STATED, NOT ASSUMED: estimates are labelled estimates, the unavailable browsers are named, every required format is a fixture", () => {
  assert.ok(ESTIMATES.message.high >= ESTIMATES.message.low && ESTIMATES.build.high >= ESTIMATES.build.low);
  assert.deepEqual([...UNAVAILABLE], ["Safari on macOS", "Safari on iOS", "Chrome on Android", "Microsoft Edge"]);
  for (const e of Object.values(BROWSER_EXPECT)) for (const f of [...e.required, ...e.recorded]) assert.ok(existsSync(FIX + f), f);
});

// ── THE GATES ───────────────────────────────────────────────────────────────

test("THE GATES: a guarded site, a mutating mode without mutate=yes, and a paid mode with photographs still on are refused before any write or send", async () => {
  const worker = await loadWorker();
  const bucket = mediaBucket();
  const env = envFor(bucket);
  await withWire({}, async (seen) => {
    const calls = [];
    const f = wired(worker, env, seen, calls);
    const base = { fetch: f, base: "https://gofarther.dev", token: "t", fixtures: FIX };
    const guarded = await run({ ...base, mode: "storage", slug: GUARDED_SITES[0], mutate: "yes" });
    assert.match(guarded.refused, /help-needed fixture/);
    const noMutate = await run({ ...base, mode: "storage", slug: "verify-site" });
    assert.match(noMutate.refused, /mutate must be yes/);
    const imagesOn = await run({ ...base, mode: "converse", slug: "verify-site", spend: "yes", maxCredits: 50 });
    assert.match(imagesOn.refused, /IMAGE_PURCHASES must be off/);
    const noCeiling = await run({ ...base, mode: "build", slug: "verify-site", spend: "yes" });
    assert.match(noCeiling.refused, /max_credits/);
    assert.ok(calls.every((c) => c.startsWith("GET ")), "a refused press wrote or sent something: " + calls.filter((c) => !c.startsWith("GET ")).join(", "));
    assert.ok(!calls.some((c) => c.includes("/api/site/route") || c.includes("react-build")));
    // THE REHEARSAL reads, writes nothing, and lists what each mode would need.
    const reh = await run({ ...base, mode: "rehearsal", slug: "verify-site" });
    assert.equal(reh.ok, true, JSON.stringify(reh.results.checks));
    assert.equal(reh.results.imagePurchases, true);
    assert.ok(reh.results.recorded.find((r) => r.mode === "converse").wouldNeed.includes("IMAGE_PURCHASES is not off"));
    assert.equal(bucket.calls.filter((c) => c === "put" || c === "createMultipartUpload").length, 0, "a rehearsal wrote");
  });
});

// ── THE STORAGE MODE, WHOLE ─────────────────────────────────────────────────

test("THE STORAGE MODE, END TO END against the real Worker: every check passes, every race ends consistent, and the library ends as it was found", { timeout: 600000 }, async () => {
  const worker = await loadWorker();
  const bucket = mediaBucket({ lag: true });
  const env = envFor(bucket);
  await withWire({}, async (seen) => {
    const lines = [];
    const r = await run({ fetch: wired(worker, env, seen), base: "https://gofarther.dev", token: "t", fixtures: FIX, mode: "storage", slug: "verify-store", mutate: "yes", repeat: 2, log: (l) => lines.push(l) });
    const failed = r.results.checks.filter((c) => !c.pass);
    assert.deepEqual(failed, [], lines.filter((l) => l.startsWith("FAIL")).join("\n"));
    assert.ok(r.ok);
    assert.ok(r.results.checks.length > 100, "the storage mode ran " + r.results.checks.length + " checks");
    assert.equal(r.results.recorded.filter((x) => x.race).length, 2);
    assert.equal([...bucket.store.keys()].filter((k) => k.startsWith("uploads/verify-store/")).length, 0, "the run left files behind");
  });
});

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
    assert.deepEqual(c1.filter((c) => !c.pass), [], JSON.stringify(c1));
    assert.equal(one.results.stopped, "ceiling", "the run did not stop at its ceiling");
  });
});

// ── THE BUILD MODE: AN EARLY-ACCEPTED BUILD IS FOLLOWED ─────────────────────

test("THE BUILD MODE follows an early-accepted build by its poll and judges its answer: drafts moved, no fixed narration, no photograph", async () => {
  let balance = 200;
  let polls = 0;
  const said = [];
  const rows = [];
  const ledger = { last: async () => ({ ok: true, id: rows.length }), window: async (from, to) => ({ ok: true, complete: true, rows: rows.filter((x) => x.id > from && x.id <= to) }) };
  const fake = async (url, init = {}) => {
    const u = new URL(url);
    const p = u.pathname;
    said.push((init.method || "GET") + " " + p);
    const j = (v, s = 200) => Response.json(v, { status: s });
    if (p === "/api/site/runtime") return j({ ok: true, deploy: "d", imagePurchases: false });
    if (p === "/api/site/build-health") return j({ ok: false }, 501);
    if (p === "/api/credits") return j({ balance });
    if (p === "/api/media/drafts" && init.method === "POST") return j({ ok: true, session: (said.length.toString(16) + "0".repeat(32)).slice(0, 32), parts: 1, partBytes: 8388608 }, 201);
    if (/^\/api\/media\/drafts\/[a-f0-9]{32}\/1$/.test(p)) return j({ ok: true, etag: "e" });
    if (/\/complete$/.test(p)) return j({ ok: true, name: "a".repeat(32) + (said.length % 2 ? ".webm" : ".mp3"), kind: "audio" }, 201);
    if (p === "/api/site/react-build") return j({ ok: true, pending: true, job: JOB, poll: "/api/site/build/" + JOB }, 202);
    if (p === "/api/site/build/" + JOB) {
      polls++;
      if (polls < 3) return j({ ok: true, pending: true }, 202);
      balance -= 20;
      rows.push({ id: rows.length + 1, kind: "debit", reason: "build", delta: -20, ref: "build:" + JOB, at: "t" });
      return j({ ok: true, slug: "harbour-loaf", notes: "Your tour video plays on the home page and the jingle on the About page.", contextNote: undefined, cost: 20, images: { made: 0 }, media: { placed: [{ name: "x.webm", url: "/u/harbour-loaf/x.webm" }, { name: "y.mp3", url: "/u/harbour-loaf/y.mp3" }], missing: [] } });
    }
    if (p.startsWith("/u/")) return new Response("ok", { status: 200 });
    if (p === "/api/media/drafts") return j({ files: [], maxCount: 6 });
    if (/^\/api\/media\/drafts\/[a-f0-9]{32}$/.test(p)) return j({ ok: true, state: "removed", finished: true });
    return j({ error: "unexpected " + p }, 599);
  };
  const r = await run({ fetch: fake, base: "https://gofarther.dev", token: "t", fixtures: FIX, mode: "build", slug: "verify-build", spend: "yes", maxCredits: 60, sleep: async () => {}, ledger });
  assert.equal(polls, 3, "the poll was not followed to its answer");
  assert.deepEqual(r.results.checks.filter((c) => c.verdict === "fail"), []);
  assert.deepEqual(r.results.spends.map((s) => s.spent), [20]);
  assert.equal(r.results.money.ok, true, JSON.stringify(r.results.money));
  // THE NARRATION'S MEANING IS FOR A PERSON: kept whole, and the run says so.
  assert.equal(r.results.outcome, "needs review", JSON.stringify({ stopped: r.results.stopped, error: r.results.error }));
  assert.equal(r.results.unverified.find((u) => u.case === "P9").answer, "Your tour video plays on the home page and the jingle on the About page.");
  assert.ok(said.some((s) => s === "GET /api/site/runtime"), "images were not read before the send");
});

// ── THE BROWSER MODE: PLAY AND SEEK IN A REAL CHROMIUM ──────────────────────

test("THE BROWSER MODE plays and seeks every required format in a real Chromium from its /u/ address, records the rest, names what no runner has, and cleans up", { skip: !HAVE_BROWSER && "no browser here", timeout: 300000 }, async () => {
  const worker = await loadWorker();
  const bucket = mediaBucket();
  const env = envFor(bucket);
  await withWire({}, async (seen) => {
    const f = wired(worker, env, seen);
    const server = http.createServer(async (req, res) => {
      const headers = {};
      for (const h of ["range", "if-none-match"]) if (req.headers[h]) headers[h] = req.headers[h];
      const r = await worker.fetch(new Request("https://gofarther.dev" + req.url, { method: req.method, headers }), env, makeCtx());
      const out = {};
      r.headers.forEach((v, k) => { out[k] = v; });
      res.writeHead(r.status, out);
      res.end(Buffer.from(await r.arrayBuffer()));
    });
    await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
    const origin = "http://127.0.0.1:" + server.address().port;
    try {
      const blockedSeen = [];
      const r = await run({
        fetch: f, base: "https://gofarther.dev", mediaOrigin: origin, token: "t", fixtures: FIX, mode: "browser", slug: "verify-play", mutate: "yes",
        browsers: { chromium: () => chromium.launch({ executablePath: EXE }), firefox: async () => { throw new Error("not on this runner"); } },
        requiredEngines: ["chromium"],
        appOrigin: APP,
        composer: { launch: () => chromium.launch({ executablePath: EXE }), token: "t", refresh: "r", user: { id: "u-1", email: "owner@example.com" }, prepare: (ctx) => appRoutes(ctx, worker, env, "verify-play", blockedSeen) },
      });
      assert.deepEqual(r.results.checks.filter((c) => !c.pass), []);
      // THE COMPOSER RAN, ALL OF IT: its observer is alive.
      for (const want of ["B2 a file attached in the composer goes up and is ready", "B2 … and reused: no part sent, no new file", "B3 the Files panel lists it as media with a player", "B2 … and sent again as a new file", "B2 the library ends as it was found"]) {
        assert.ok(r.results.checks.some((c) => c.name === want && c.pass), "missing or failed: " + want);
      }
      assert.equal(r.results.checks.filter((c) => c.name.startsWith("B1 chromium")).length, BROWSER_EXPECT.chromium.required.length);
      assert.ok(r.results.recorded.some((x) => x.engine === "firefox" && x.unavailable), "a missing browser was not said as unavailable");
      assert.ok(UNAVAILABLE.every((u) => r.results.recorded.some((x) => x.engine === u)));
      assert.equal([...bucket.store.keys()].filter((k) => k.startsWith("uploads/verify-play/")).length, 0);
    } finally { server.close(); }
  });
});

test("THE WORKFLOW is dispatch only, offers exactly the script's modes, and passes every variable the command line reads", () => {
  const wf = readFileSync(new URL("../.github/workflows/media-verify.yml", import.meta.url), "utf8");
  const on = wf.match(/^on:\n((?:[ #].*\n|\n)+?)^\S/m);
  assert.ok(on, "the workflow's on: block was not found");
  assert.match(on[1], /^ {2}workflow_dispatch:/m);
  assert.doesNotMatch(on[1], /^ {2}(push|pull_request|schedule|workflow_run):/m, "media verify must start on a press only");
  const opts = wf.match(/options:\s*\[([^\]]+)\]/);
  assert.ok(opts, "the mode box's options were not found");
  assert.deepEqual(opts[1].split(",").map((s) => s.trim()), [...MODES]);
  const script = readFileSync(new URL("../scripts/media-verify.mjs", import.meta.url), "utf8");
  const cli = script.slice(script.indexOf("// ── THE COMMAND LINE"));
  assert.ok(cli.length > 200, "the command-line section was not found");
  const read = new Set([...cli.matchAll(/env\.([A-Z_]+)/g)].map((m) => m[1]));
  assert.ok(read.size >= 10, `only ${read.size} variables read: the scan is not reading the command line`);
  const passed = new Set([...wf.matchAll(/^ {10}([A-Z_]+):/gm)].map((m) => m[1]));
  // CHROMIUM_PATH is a local convenience; the runner's browsers come from Playwright.
  const missing = [...read].filter((v) => v !== "CHROMIUM_PATH" && !passed.has(v));
  assert.deepEqual(missing, [], "variables the script reads that the workflow does not pass");
  assert.match(wf, /playwright install --with-deps chromium firefox webkit/);
});
