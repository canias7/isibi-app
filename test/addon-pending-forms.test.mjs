// AN ADDITION'S PHOTOGRAPH WAITING ON ITS PURCHASE, WHATEVER VALID TSX HOLDS
// IT, AND HOWEVER LATE IT LANDS (2026-10-09, parallel round 6).
//
// Codex reproduced the gap with the existing addon-pending-photo fixture: the
// page writer's `src="@@IMG:…@@"` written as `src={"@@IMG:…@@"}` — the same
// JSX — with the three upload writes failing. The purchase was `generated`,
// no frame was marked (the marker needed one exact spelling), and the part
// ended partial instead of recoverable. These cases drive the REAL Worker
// (routing, the add-on route, the queue consumer, the request driver and the
// cron) against `test/fixtures/request-flow.mjs`, with the network blocked:
//   - the equivalent JSX forms, each marked and later placed;
//   - a photograph inside a shared component the addition wrote;
//   - a token no frame can be safely found for: pending, never guessed;
//   - a purchase still being made when the add-on's wait ends;
//   - its claim still out then, with a frame (placed) and with none (never bought);
//   - every message delivered twice;
//   - a frame the customer changed before the placement;
//   - the progress facts while the photograph waits.
// Each checks the final page, the task statuses, provider calls, publication
// and accounting.
//
// ⚠ SUPPLIED-MODEL, STAND-IN-SERVICE PROOF ONLY.

import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, tick, pump, readWritten, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { blockNetwork, unexpected } from "./fixtures/no-network.mjs";

blockNetwork();

const slugOf = (k) => "apf-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try {
    const out = await fn(P);
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
const runJobs = (P, key, n) => jobsOfPart(P, key, n).filter((j) => !/\/api\/site\/route(?![\w/-])/.test(String(P.bodyOf(j.id) ? P.bodyOf(j.id).url : "")));
const publishedOf = (P, key, n) => jobsOfPart(P, key, n).filter((j) => j.published_at).length;
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool).length;
const isUpload = (P) => (k) => k.startsWith("uploads/" + P.slug + "/");
const parts = (P) => { const o = P.objects.get("source/" + P.slug + "/parts.json"); return o ? JSON.parse(o.body) : []; };
const partSrc = (P, name) => (parts(P).find((p) => p.name === name) || {}).source || "";

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
/** The gallery page with its photograph written as `frame` (the JSX that holds the token). */
const gallerySrc = (frame) => HEAD + "function Page(){ return <main><h1>Gallery</h1>" + frame + "<p>Our work, up close.</p></main> }\n";
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const ROUTES = [
  { intent: "edit", layer: "text", page: "/visit", alsoAsked: [ADD], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["page:/gallery", "images"] }] },
  { intent: "addon" },
];
const BASE = ({ pages = { pages: [{ path: "src/routes/gallery.tsx", source: gallerySrc('<SafeImage src="' + TOKEN + '" alt="the workshop bench" ratio="4/3" />') }] }, ...o } = {}) => ({
  pages: PAGES, images: true, replies: true, balance: 400,
  answers: {
    route: (args, n) => ROUTES[Math.min(n, 1)],
    [T.text]: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }),
    [T.adds]: { kinds: ["page", "photo"] },
    "add:page": { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work", sections: ["a photograph"], components: ["card"] }] },
    "add:photo": { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }] },
    [T.pages]: pages,
  },
  ...o,
});
const gallery = (P) => P.page("gallery.tsx") || "";
/** A frame marked for a purchase: the empty literal and the purchase's mark. */
const MARK = /"" \/\*pending-photo:([0-9a-f]{24})\*\//;
const PLACED = /"\/u\/[^"]+\.jpg"/;
const additionCalls = (P) => ({ adds: calls(P, T.adds), design: calls(P, T.design), pages: calls(P, T.pages) });

/**
 * THE STORE FAILS ON EVERY TRY OF THE ADDITION, then works: the part must be
 * held with the frame marked (not partial), and the next look must place that
 * same picture — one provider call, the addition not redone, one more publish
 * and the photograph charged once. Answers the gallery as published by the
 * addition, for a case to read the form it left.
 */
async function heldThenPlaced(P, { where = gallery } = {}) {
  const r = await sendMessage(P, { message: MSG });
  for (let i = 0; i < 3; i++) P.failPut(isUpload(P));
  const s1 = await settle(P, r.key);
  assert.deepEqual(statuses(s1.rec), ["done", "uncertain"], JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why, p.notDone])));
  assert.equal(s1.rec.parts[1].why, "photos-pending");
  assert.equal(s1.rec.parts[1].published, true);
  assert.ok(P.page("visit.tsx").includes(TIKTOK_TO), "the independent part did not finish");
  const id = purchases(P)[0].id;
  const held = where(P);
  assert.equal((held.match(MARK) || [])[1], id, "the frame was not marked with its purchase: " + held);
  assert.ok(!held.includes("@@IMG"), "a token was left in the published source");
  assert.equal(P.imageLog.length, 1);
  assert.equal(purchases(P)[0].state, "generated");
  const before = additionCalls(P);
  await tick(P);
  const s2 = await settle(P, r.key);
  assert.deepEqual(statuses(s2.rec), ["done", "done"], JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why, p.notDone])));
  const placed = where(P);
  assert.match(placed, PLACED, "the photograph was not placed into its frame: " + placed);
  assert.doesNotMatch(placed, /pending-photo/);
  assert.equal(P.imageLog.length, 1, "the photograph was bought again");
  assert.equal(uploads(P).length, 1);
  assert.deepEqual(additionCalls(P), before, "the addition's model work ran again");
  assert.equal(publishedOf(P, r.key, 1), 2, "publishes: the addition, then the placement");
  const rs = runJobs(P, r.key, 1).map((j) => reserveOf(P, j.id));
  assert.equal(rs.length, 2, JSON.stringify(rs));
  assert.equal(rs[1].length, 1, "the placement was not charged exactly once: " + JSON.stringify(rs));
  return { r, held, placed };
}

/**
 * THE ADD-ON'S PHOTOGRAPH WAIT, COMPRESSED: its race timer is the job's
 * remaining clock less the publish reserve (minutes), so a delay that long is
 * run after 30ms while the case holds the photograph. Every shorter timer is
 * untouched. Answers the restore.
 */
function shortPhotoWait() {
  const real = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...a) => real(fn, Number(ms) >= 30000 ? 30 : ms, ...a);
  return () => { globalThis.setTimeout = real; };
}

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
