// AN ADDITION'S PHOTOGRAPH RECOVERY ON EVERY PATH THAT REALLY RUNS IT
// (2026-10-09, parallel round 7).
//
// Codex passed round 6 and named what its offline proof did not establish:
// marking and filling need the page's parser, which loads under Node and never
// in the Worker's isolate — so a Node test with `typescript` installed says
// nothing about a job the runner flags keep in the Worker. And an addition
// posted straight to the add-on route was a job of its own with no purchase
// record. These cases drive the REAL Worker (its routes, queue consumer,
// request driver and cron, `test/fixtures/request-flow.mjs`) on each real
// execution choice, with the network blocked:
//   - INLINE (the runner flags name nobody): the consumer runs the job in the
//     Worker; the parser is made ABSENT in this process, as in workerd, and
//     the frames are read by the REAL build service (`builder/build-server.mjs`,
//     spawned on a free port, its `/frames` door) — then that door unreachable
//     when marking, and unreachable at placement and back;
//   - FIRED (`JOB_RUNNER_EVERYONE`): the consumer fires each job at the site's
//     container and runs nothing itself; the container's side is the Worker's
//     own export (`runContainerJob`), with the parser, as the image runs it;
//   - THE LEGACY ENTRY: a post straight to `/api/site/<slug>/addon`, taken on
//     as a one-part request, and redelivered; and with the flow off, a job of
//     its own whose purchase is still a record.
// Each checks the final page, the task statuses, provider calls, publication
// and accounting, and which way the frames were read.
//
// ⚠ SUPPLIED-MODEL, STAND-IN-SERVICE PROOF ONLY. The container's side of a
// fired job is this process running the Worker's export, not a container.

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import http from "node:http";
import { spawn } from "node:child_process";
import { platform, sendMessage, settle, tick, pump, call, readWritten, T } from "./fixtures/request-flow.mjs";
import { loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, getContainer } from "./fixtures/cf-containers.mjs";
import vm from "node:vm";
import { page as pageSrc, cut } from "./fixtures/live-ask.mjs";
import { blockNetwork, unexpected } from "./fixtures/no-network.mjs";
import { useFrameParser } from "../builder/pending-frames.mjs";

blockNetwork();

// ── THE REAL BUILD SERVICE, for its `/frames` door ──────────────────────────
let SERVICE = null;
const freePort = () => new Promise((res, rej) => {
  const s = net.createServer();
  s.on("error", rej);
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); });
});
/** One POST to the spawned service, through `node:http` so no fixture's fetch stands between. */
const postLocal = (path, body) => new Promise((res, rej) => {
  const data = JSON.stringify(body);
  const req = http.request({ host: "127.0.0.1", port: SERVICE.port, path, method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) } }, (r) => {
    let text = "";
    r.on("data", (c) => { text += c; });
    r.on("end", () => res({ status: r.statusCode, text }));
  });
  req.on("error", rej);
  req.end(data);
});
before(async () => {
  const port = await freePort();
  const child = spawn(process.execPath, [new URL("../builder/build-server.mjs", import.meta.url).pathname], {
    env: { ...process.env, PORT: String(port), APP_DIR: "/nonexistent-app" }, stdio: ["ignore", "ignore", "ignore"],
  });
  SERVICE = { port, child };
  for (let i = 0; i < 200; i++) {
    const up = await new Promise((ok) => {
      const r = http.get({ host: "127.0.0.1", port, path: "/health" }, (x) => { let t = ""; x.on("data", (c) => { t += c; }); x.on("end", () => ok(t.startsWith("ok "))); });
      r.on("error", () => ok(false));
    });
    if (up) return;
    await new Promise((ok) => setTimeout(ok, 50));
  }
  throw new Error("the build service did not come up");
});
after(() => { if (SERVICE) SERVICE.child.kill("SIGKILL"); });

/** The `/frames` door as the Worker meets it: the real service, or down (`up()` false), each call's op kept. */
function door() {
  const ops = [];
  let isUp = true;
  return {
    ops,
    up(v) { isUp = v; },
    handler: async (body) => {
      ops.push(String((body && body.op) || ""));
      if (!isUp) return new Response("There is no Container instance available", { status: 503 });
      const r = await postLocal("/frames", body);
      return new Response(r.text, { status: r.status, headers: { "content-type": "application/json" } });
    },
  };
}

// ── THE SITE AND THE SUPPLIED ANSWERS (as `addon-pending-forms`) ────────────
const slugOf = (k) => "art-" + k + "-" + Math.random().toString(16).slice(2, 8);
const statuses = (rec) => rec.parts.map((p) => p.status);
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);
const uploads = (P) => [...P.objects.keys()].filter((k) => k.startsWith("uploads/" + P.slug + "/"));
const purchaseKeys = (P) => [...P.objects.keys()].filter((k) => k.includes("/purchases/"));
const purchases = (P) => purchaseKeys(P).map((k) => JSON.parse(P.objects.get(k).body));
const jobsOfPart = (P, key, n) => P.jobsOf(key).filter((j) => j.idem_key.startsWith(key + "-p" + n + "-"));
const runJobs = (P, key, n) => jobsOfPart(P, key, n).filter((j) => !/\/api\/site\/route(?![\w/-])/.test(String(P.bodyOf(j.id) ? P.bodyOf(j.id).url : "")));
const publishedOf = (P, key, n) => jobsOfPart(P, key, n).filter((j) => j.published_at).length;
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool).length;
const isUpload = (P) => (k) => k.startsWith("uploads/" + P.slug + "/");

const TIKTOK_LINE = "Follow us on TikTok at @oldloaf";
const TIKTOK_TO = "Follow us on TikTok at @harbourloaf";
const VISIT_TT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TIKTOK_LINE + "</p></section>");
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT_TT }];
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf";
const ADD = "add a gallery page with a photo of the workshop bench";
const BENCH = "the workshop bench under the window, warm afternoon light";
const TOKEN = "@@IMG:" + BENCH + "@@";
const MSG = TIKTOK + ", and " + ADD + ".";
const HEAD = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { SafeImage } from '@/components/safe-image'\n"
  + "export const Route = createFileRoute('/gallery')({ component: Page })\n";
// THE FORM CODEX REPRODUCED WITH, braced: only the parser can tell it is a frame.
const GALLERY = HEAD + "function Page(){ return <main><h1>Gallery</h1><SafeImage src={\"" + TOKEN + "\"} alt=\"the workshop bench\" ratio=\"4/3\" /><p>Our work, up close.</p></main> }\n";
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const ROUTES = [
  { intent: "edit", layer: "text", page: "/visit", alsoAsked: [ADD], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["page:/gallery", "images"] }] },
  { intent: "addon" },
];
const BASE = (o = {}) => ({
  pages: PAGES, images: true, replies: true, balance: 400,
  answers: {
    route: (args, n) => ROUTES[Math.min(n, 1)],
    [T.text]: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }),
    [T.adds]: { kinds: ["page", "photo"] },
    "add:page": { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work", sections: ["a photograph"], components: ["card"] }] },
    "add:photo": { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }] },
    [T.pages]: { pages: [{ path: "src/routes/gallery.tsx", source: GALLERY }] },
  },
  ...o,
});
const gallery = (P) => P.page("gallery.tsx") || "";
const MARK = /"" \/\*pending-photo:([0-9a-f]{24})\*\//;
const PLACED = /<SafeImage src=\{"\/u\/[^"]+\.jpg"\} alt="the workshop bench"/;
const additionCalls = (P) => ({ adds: calls(P, T.adds), design: calls(P, T.design), pages: calls(P, T.pages) });
const key32 = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * One case's platform, with the compiler and (when given) the frames door;
 * `env` is laid over the platform's own. The parser is absent for the whole
 * case when `isolate` — the Worker's isolate, where it cannot be loaded.
 */
async function withPlatform(opts, fn, { frames = null, env = {}, isolate = false } = {}) {
  const compiler = installCompiler({ frames });
  const P = platform(opts);
  Object.assign(P.env, env);
  if (isolate) useFrameParser(null);
  try {
    const out = await fn(P, compiler);
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
    return out;
  } finally { useFrameParser(undefined); P.close(); compiler.uninstall(); }
}

/** The message, its store failing on every try of the addition; answers the first settle. */
async function heldAddition(P, run = (key) => settle(P, key), { fails = 3 } = {}) {
  const r = await sendMessage(P, { message: MSG });
  for (let i = 0; i < fails; i++) P.failPut(isUpload(P));
  const s1 = await run(r.key);
  return { r, s1 };
}

test("RT 7 — A LEGACY POST WHOSE PICTURES WOULD NOT ALL BE KEPT STAYS A JOB OF ITS OWN (round 8: a post with pictures is taken on with its files, `addon-attachments`): more files than one request carries is never a request that lost some — it answers with its job, as before", async () => {
  await withPlatform({ slug: slugOf("attached"), ...BASE() }, async (P) => {
    const idem = key32();
    const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const four = [1, 2, 3, 4].map((n) => ({ name: "p" + n + ".png", data: PNG }));
    const a = await call(P, "POST", "/api/site/" + P.slug + "/addon", { instruction: ADD, picker: "sonnet", idem, tz: "Europe/London", attached: true, images: four });
    assert.equal(a.status, 202, JSON.stringify(a.body));
    assert.ok(typeof a.body.job === "string" && a.body.job && !a.body.request, JSON.stringify(a.body));
    assert.equal(P.record(idem), null, "a request was saved that could not keep every file");
    assert.deepEqual([...P.objects.keys()].filter((k) => k.includes("/files/")), []);
    await pump(P);
  });
});

test("RT 8 — THE PAGE FOLLOWS AN ADDITION THE SERVER TOOK ON AS A REQUEST: `siteAddon` (cut from public/chat.js) handed the route's request answer starts following that request — and does not watch a job or say a sentence of its own", async () => {
  const started = [], watched = [], told = [];
  let answer = null;
  const ctx = vm.createContext({
    EditPoll: { newIdemKey: () => "k".repeat(32), heldWire: (x) => x, contextWire: (x) => x, rememberJob: () => {} },
    buildPicker: "sonnet", browserTimeZone: () => "Europe/London",
    siteRequestOf: (d) => (d && d.request && typeof d.request.key === "string" ? d.request : null),
    siteRequestStart: (origin, d, imgs, key) => { started.push({ origin, key: d.request.key, sent: key }); },
    watchEditJob: () => { watched.push(1); }, readAddonReply: () => ({ act: "applied" }), addonAnswer: () => {}, siteTablesAfter: () => {},
    addonOutcomeMsg: (s) => "outcome:" + s, alsoTail: () => "",
    apiFetch: () => Promise.resolve({ ok: true, status: 200, json: async () => answer }),
  });
  vm.runInContext(cut("siteAddon"), ctx);
  answer = { ok: true, intent: "addon", request: { key: "r".repeat(32), parts: [{ n: 0, status: "queued" }] } };
  await new Promise((done) => { ctx.siteAddon({ slug: "harbour-loaf" }, ADD, "origin-1", (t) => { told.push(t); done(); }, () => {}, { intent: "addon" }, []); setTimeout(done, 50); });
  assert.deepEqual(started, [{ origin: "origin-1", key: "r".repeat(32), sent: "k".repeat(32) }]);
  assert.deepEqual([watched.length, told.length], [0, 0], "the page also watched a job or said something");
  // A JOB RECEIPT IS STILL WATCHED AS BEFORE.
  started.length = 0;
  ctx.readAddonReply = () => ({ act: "receipt", job: "j".repeat(32) });
  answer = { ok: true, job: "j".repeat(32), status: "queued" };
  await new Promise((done) => { ctx.siteAddon({ slug: "harbour-loaf" }, ADD, "origin-1", () => done(), () => {}, { intent: "addon" }, []); setTimeout(done, 50); });
  assert.deepEqual([started.length, watched.length], [0, 1]);
});

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
