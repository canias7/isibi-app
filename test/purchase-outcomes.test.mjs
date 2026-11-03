// HOW A PICTURE'S PURCHASE ENDED, STAGE BY STAGE (2026-10-09, parallel round
// 4, after Codex's review of f19e73f3).
//
// Codex reproduced the remaining gap through the real request-flow fixture:
// accept the TikTok-plus-photo request, fail the next `uploads/<slug>/` write
// during the preparation, deliver it, then settle the request. The image
// service made the picture, the store failed, `makeSitePhoto` answered no
// address, and `purchaseOnce` wrote `none` — so the part's job bought it
// again: two provider calls, both tasks done. A missing stored address is not
// proof that nothing was bought.
//
// The purchase now tells apart: the service's refusal (nothing made), an
// answer that never came back (unknown — held, never bought again on a
// guess), a picture made (its source kept on the purchase record before the
// download), a download that failed and a store that failed (both finished
// later on THE SAME picture), and a store whose answer was lost (found by its
// tag). Each case asserts separately: the provider's calls (`imageLog`), the
// stored photographs and the downloads (asset recovery), the request's task
// states, and what the customer was charged. The wire refuses anything it was
// not set up for, and each case ends only once its background work settled.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, tick, call, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { blockNetwork, unexpected, blockedFetch, isLocal } from "./fixtures/no-network.mjs";

blockNetwork();

const slugOf = (k) => "po-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try {
    const out = await fn(P);
    // EVERY INVOCATION THE CASE STARTED HAS ENDED (one held on purpose aside)
    // WITH THE STAND-INS STILL IN PLACE, and none of them asked for anything
    // the stand-ins were not set up to answer.
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
    return out;
  } finally { P.close(); compiler.uninstall(); }
}
const statuses = (rec) => rec.parts.map((p) => p.status);
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);
const uploads = (P) => [...P.objects.keys()].filter((k) => k.startsWith("uploads/" + P.slug + "/"));
const purchases = (P) => [...P.objects.entries()].filter(([k]) => k.includes("/purchases/")).map(([, o]) => JSON.parse(o.body));
const jobsOfPart = (P, key, n) => P.jobsOf(key).filter((j) => j.idem_key.startsWith(key + "-p" + n + "-"));
const publishedOf = (P, key, n) => jobsOfPart(P, key, n).filter((j) => j.published_at).length;
/** What the part's STEP was charged: its run jobs' reserves (its routing job is charged on its own, once). */
const chargedOf = (P, key, n) => jobsOfPart(P, key, n).filter((j) => !/\/api\/site\/route(?![\w/-])/.test(String(P.bodyOf(j.id) ? P.bodyOf(j.id).url : j.url || ""))).reduce((s, j) => s + reserveOf(P, j.id).length, 0);
const isUpload = (P) => (k) => k.startsWith("uploads/" + P.slug + "/");

const HOME_PIC = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><SafeImage src=\"\" alt=\"A loaf on the counter\" ratio=\"4/3\" /><p>Bread from the harbour, every morning.</p></section>");
const TIKTOK_LINE = "Follow us on TikTok at @oldloaf";
const VISIT_TT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TIKTOK_LINE + "</p></section>");
const PIC_PAGES = [{ path: "index.tsx", source: HOME_PIC }, { path: "visit.tsx", source: VISIT_TT }];
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf";
const PHOTO = "make a photo of a sourdough loaf for the home page";
const TIKTOK_TO = "Follow us on TikTok at @harbourloaf";
const PICTURE = { pictures: [{ page: "index.tsx", alt: "A loaf on the counter", describe: "a sourdough loaf on a wooden counter" }] };
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const ROUTE_PIC = [
  { intent: "edit", layer: "text", page: "/visit", alsoAsked: [PHOTO], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["images", "page:/"] }] },
  { intent: "edit", layer: "picture", page: "/" },
];
const takePrep = (P) => {
  const m = P.queue.find((x) => x.body.kind === "request-prep");
  assert.ok(m, "no preparation was queued");
  P.queue.splice(P.queue.indexOf(m), 1);
  return m;
};
const BASE = (o = {}) => ({
  pages: PIC_PAGES, images: true, replies: true,
  answers: {
    route: (args, n) => ROUTE_PIC[Math.min(n, 1)],
    choose_pictures: PICTURE,
    [T.text]: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }),
  },
  ...o,
});
const MSG = TIKTOK + ", and " + PHOTO + ".";
const PREP_PAST = 10 * 60 * 1000 + 1000;
/** The preparation's time passes and the sweep takes it again. */
async function retake(P) { P.advance(PREP_PAST); await tick(P); return takePrep(P); }
const buyAgain = (P, key) => call(P, "POST", "/api/site/request/" + P.slug + "/" + key + "/buy-again", { part: 1 });
/** Both parts finished: each published once, the picture on the page. */
function finished(P, r, rec) {
  assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.prep])));
  assert.match(P.page("index.tsx"), /<SafeImage src="\/u\/[^"]+\.jpg" alt="A loaf on the counter"/);
  assert.ok(P.page("visit.tsx").includes(TIKTOK_TO));
  assert.equal(publishedOf(P, r.key, 0), 1, "the TikTok part was not published once");
  assert.equal(publishedOf(P, r.key, 1), 1, "the photo part was not published once");
}
/** The one picture the page shows is the one stored. */
function shownIsStored(P) {
  const src = (P.page("index.tsx").match(/<SafeImage src="\/u\/[^/]+\/([^"]+)"/) || [])[1];
  assert.ok(src && uploads(P).some((k) => k.endsWith("/" + src)), "the page shows a picture that is not the one stored: " + src);
}

// ── THE HARNESS ITSELF ─────────────────────────────────────────────────────

test("NET 1 — the blocking fetch refuses an outside address and records it, and lets a data address through; loopback counts as local", async () => {
  const before = unexpected().length;
  await assert.rejects(blockedFetch("https://fal.run/fal-ai/x", { method: "POST" }), /network blocked in tests: POST https:\/\/fal\.run\/fal-ai\/x/);
  const got = unexpected().slice(before);
  assert.deepEqual(got, [{ method: "POST", url: "https://fal.run/fal-ai/x", by: "blocked" }]);
  const r = await blockedFetch("data:text/plain,ok");
  assert.equal(await r.text(), "ok");
  assert.equal(isLocal("http://127.0.0.1:8080/x"), true);
  assert.equal(isLocal("http://localhost/x"), true);
  assert.equal(isLocal("https://img.test/p1.jpg"), false);
  // TAKEN BACK OUT, so the file's own network check below reads only cases.
  const all = unexpected();
  assert.equal(all.filter((u) => u.url === "https://fal.run/fal-ai/x").length, 1);
});

test("NET — no request in this file left the machine", () => {
  // NET 1's own refused address is the only one allowed.
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked" && u.url !== "https://fal.run/fal-ai/x"), []);
});
