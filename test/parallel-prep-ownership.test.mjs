// WHO OWNS A PREPARATION (2026-10-09, after Codex's review of 464c6a3c).
//
// Codex reproduced it through the real consumer: the same `request-prep`
// message delivered twice AT ONCE — both deliveries read the part's claim as
// "attempting" before either wrote anything, and the one preparation bought
// two photographs. The sequential twice-delivery case (P6) never overlapped
// them. A preparation is now TAKEN by one consumer in one conditional write
// of the request record before any model call or purchase; results are kept
// only by that owner, for that attempt; a purchase is noted before it is made
// so an attempt that dies is never blindly bought again.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, pump, T } from "./fixtures/request-flow.mjs";
import { blockNetwork, unexpected } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";

blockNetwork();

const slugOf = (k) => "po-" + k + "-" + Math.random().toString(16).slice(2, 8);
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

// ── CRASH BOUNDARIES, EXPIRY AND A LATE OWNER ───────────────────────────────

const PREP_PAST = 10 * 60 * 1000 + 1000;
const waitFor = async (cond, what) => { for (let i = 0; i < 400 && !cond(); i++) await new Promise((ok) => setTimeout(ok, 5)); assert.ok(cond(), "never happened: " + what); };
/** The sweep's turn after the attempt's time ran out: it takes the preparation again and queues it. */
async function retake(P, r) {
  const { tick } = await import("./fixtures/request-flow.mjs");
  P.advance(PREP_PAST);
  await tick(P);
  const p = P.record(r.key).parts[1].prep;
  return { m: takePrep(P), prep: p };
}
const BASE = (o) => ({
  pages: PIC_PAGES, images: true,
  answers: {
    route: o.route || ((args, n) => ROUTE_PIC[Math.min(n, 1)]),
    choose_pictures: PICTURE,
    [T.text]: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }),
  },
  ...o.more,
});
async function finish(P, r) {
  const { rec } = await settle(P, r.key);
  assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.prep])));
  assert.match(P.page("index.tsx"), /<SafeImage src="\/u\/[^"]+\.jpg" alt="A loaf on the counter"/);
  assert.ok(P.page("visit.tsx").includes(TIKTOK_TO));
  const js = P.jobsOf(r.key);
  for (const j of js) assert.ok(reserveOf(P, j.id).length <= 1, j.op + " charged more than once");
  assert.equal(js.filter((j) => j.published_at).length, 2, "a part was published twice, or not at all");
  return rec;
}

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
