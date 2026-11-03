// ONE PURCHASE PER PICTURE, ACROSS PREPARATION, RETAKES AND THE APPLYING JOB
// (2026-10-09, round 3, after Codex's review of 2045f915).
//
// Codex reproduced two remaining failures through the real request-flow
// consumer with mocked services:
//   1. follow OWN 3, hang right after the bought note lands, expire the
//      preparation, and make the next read of its previous attempt's record
//      fail — the retake read that as "nothing happened" and bought again;
//   2. follow OWN 5, but let the part's own job finish before the first
//      purchase is released — the job bought another picture while the first
//      one's outcome was unknown, then the first landed too.
// A picture a request part buys is now ONE LOGICAL PURCHASE with one record,
// shared by every attempt and job of the part; an outcome nobody can tell
// holds the part, recoverable, and is never bought again on a guess.
//
// Each case asserts, separately: the provider's purchases (`imageLog`), what
// was stored (`uploads/`), what was published (the jobs' publish marks and the
// page), and what the customer was charged (each job's reserves).
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, tick, call, readWritten, T } from "./fixtures/request-flow.mjs";
import { blockNetwork, unexpected } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";

blockNetwork();

const slugOf = (k) => "pu-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  // (2026-10-09, round 4) the case ends once its background work settled
  // with the stand-ins in place, and asked for nothing they were not set up for.
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool);
const statuses = (rec) => rec.parts.map((p) => p.status);
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);
const uploads = (P) => [...P.objects.keys()].filter((k) => k.startsWith("uploads/" + P.slug + "/"));
const purchases = (P) => [...P.objects.entries()].filter(([k]) => k.includes("/purchases/")).map(([, o]) => JSON.parse(o.body));
const jobsOfPart = (P, key, n) => P.jobsOf(key).filter((j) => j.idem_key.startsWith(key + "-p" + n + "-"));
const publishedOf = (P, key, n) => jobsOfPart(P, key, n).filter((j) => j.published_at).length;
/** What the part's STEP was charged: its run jobs' reserves (its routing job is charged on its own, once). */
const chargedOf = (P, key, n) => jobsOfPart(P, key, n).filter((j) => !/\/api\/site\/route(?![\w/-])/.test(String(P.bodyOf(j.id) ? P.bodyOf(j.id).url : j.url || ""))).reduce((s, j) => s + reserveOf(P, j.id).length, 0);

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
const gate = () => { let open; const p = new Promise((r) => { open = r; }); return { p, open }; };
const takePrep = (P) => {
  const m = P.queue.find((x) => x.body.kind === "request-prep");
  assert.ok(m, "no preparation was queued");
  P.queue.splice(P.queue.indexOf(m), 1);
  return m;
};
const PREP_PAST = 10 * 60 * 1000 + 1000;
const waitFor = async (cond, what) => { for (let i = 0; i < 400 && !cond(); i++) await new Promise((ok) => setTimeout(ok, 5)); assert.ok(cond(), "never happened: " + what); };
async function retake(P) {
  P.advance(PREP_PAST);
  await tick(P);
  return takePrep(P);
}
const BASE = (o = {}) => ({
  pages: PIC_PAGES, images: true, replies: true,
  answers: {
    route: (args, n) => ROUTE_PIC[Math.min(n, 1)],
    choose_pictures: PICTURE,
    [T.text]: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }),
  },
  ...o,
});
const prepFile = (P, key, seq) => "requests/" + P.slug + "/" + key + "/prep/p1-" + seq + ".json";
const MSG = TIKTOK + ", and " + PHOTO + ".";
/** Both parts finished: each published once, each charged at most once, the picture on the page. */
function finished(P, r, rec) {
  assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.prep])));
  assert.match(P.page("index.tsx"), /<SafeImage src="\/u\/[^"]+\.jpg" alt="A loaf on the counter"/);
  assert.ok(P.page("visit.tsx").includes(TIKTOK_TO));
  assert.equal(publishedOf(P, r.key, 0), 1, "the TikTok part was not published once");
  assert.equal(publishedOf(P, r.key, 1), 1, "the photo part was not published once");
  for (const j of P.jobsOf(r.key)) assert.ok(reserveOf(P, j.id).length <= 1, j.op + " charged more than once");
}

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
