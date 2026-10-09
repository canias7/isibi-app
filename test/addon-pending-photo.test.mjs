// AN ADDITION'S UNFINISHED PHOTOGRAPHS, KEPT AS PENDING WORK (2026-10-09,
// parallel round 5).
//
// Until now an addition whose photograph's purchase could not be told was
// published with an empty frame, its part ended partial, and the photograph
// was never placed: the customer had to ask again. Now the frame is published
// MARKED with the purchase it waits on, the part is held on it, and once the
// purchase is known a placement step fills that frame with that photograph —
// the addition is never made again, nothing is bought again on a guess, and
// nothing has to be sent again. An independent part carries on meanwhile.
//
// Through the real request driver, queue consumer, add-on route and picture
// step, with supplied model answers and a stand-in image service, on a wire
// that refuses anything it was not set up for. Each case asserts separately:
// the provider's calls, the addition's own model calls (never repeated), the
// publishes, the page, the task states and what was charged.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, tick, call, readWritten, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { blockNetwork, unexpected } from "./fixtures/no-network.mjs";

blockNetwork();

const slugOf = (k) => "ap-" + k + "-" + Math.random().toString(16).slice(2, 8);
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
const reservesOf = (P, key, n) => runJobs(P, key, n).map((j) => reserveOf(P, j.id));
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool).length;
const isUpload = (P) => (k) => k.startsWith("uploads/" + P.slug + "/");
const buyAgain = (P, key, n) => call(P, "POST", "/api/site/request/" + P.slug + "/" + key + "/buy-again", { part: n });

const TIKTOK_LINE = "Follow us on TikTok at @oldloaf";
const TIKTOK_TO = "Follow us on TikTok at @harbourloaf";
const VISIT_TT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TIKTOK_LINE + "</p></section>");
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT_TT }];
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf";
const ADD = "add a gallery page with a photo of the workshop bench";
const BENCH = "the workshop bench under the window, warm afternoon light";
const MSG = TIKTOK + ", and " + ADD + ".";
const GALLERY_SRC = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { SafeImage } from '@/components/safe-image'\n"
  + "export const Route = createFileRoute('/gallery')({ component: Page })\n"
  + "function Page(){ return <main><h1>Gallery</h1><SafeImage src=\"@@IMG:" + BENCH + "@@\" alt=\"the workshop bench\" ratio=\"4/3\" /><p>Our work, up close.</p></main> }\n";
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
    [T.pages]: { pages: [{ path: "src/routes/gallery.tsx", source: GALLERY_SRC }] },
  },
  ...o,
});
const gallery = (P) => P.page("gallery.tsx") || "";
/** The addition's own model work: its designers and its page writer. */
const additionCalls = (P) => ({ adds: calls(P, T.adds), design: calls(P, T.design), pages: calls(P, T.pages) });

test("APH 1 — the photograph is MADE but cannot be stored during the addition: the gallery is published with its frame MARKED, the part is held (live, not partial), the independent TikTok part finishes; the next look stores THAT picture and a placement fills the frame — one provider call, the addition's model work done once, one more publish, the photo charged once", async () => {
  await withPlatform({ slug: slugOf("a1"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    for (let i = 0; i < 3; i++) P.failPut(isUpload(P));
    const s1 = await settle(P, r.key);
    // TASK STATE: the independent part is done; the addition is live and held.
    assert.deepEqual(statuses(s1.rec), ["done", "uncertain"], JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.page("visit.tsx").includes(TIKTOK_TO));
    const held = s1.rec.parts[1];
    assert.equal(held.why, "photos-pending");
    assert.equal(held.published, true);
    // THE PAGE: live, its frame empty and marked with the purchase.
    const id = purchases(P)[0].id;
    assert.match(gallery(P), new RegExp('src="" data-pending-photo="' + id + '"'), gallery(P));
    assert.doesNotMatch(gallery(P), /@@IMG/);
    // PROVIDER AND ASSET: one call, the made picture kept (generated), nothing stored.
    assert.equal(P.imageLog.length, 1);
    assert.equal(purchases(P)[0].state, "generated");
    assert.equal(uploads(P).length, 0);
    const before = additionCalls(P);
    const pubBefore = publishedOf(P, r.key, 1);
    assert.equal(pubBefore, 1, "the addition was not published once");
    // THE VIEW: added, photo still being confirmed — never "nothing done".
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    const vp = view.body.request.parts[1];
    // (the read itself looks again and may already move it on to its placement)
    assert.ok(["uncertain", "queued", "started"].includes(vp.status), vp.status);
    assert.equal(vp.published, true);
    assert.equal(vp.waitingPhotos, 1);
    // AND WHAT THE CUSTOMER IS TOLD BY THE ADDITION'S REPLY: added, the photograph
    // still being confirmed, filled by itself — never "left out".
    const addJob = runJobs(P, r.key, 1)[0];
    await readWritten(P, "/api/site/edit/" + addJob.id);
    const facts = P.replyLog.flat().map((x) => x.text);
    assert.ok(facts.some((t) => /“the workshop bench under the window, warm afternoon light” is not on the page yet/.test(t) && /by itself, without redoing the addition/.test(t)), JSON.stringify(facts));
    assert.ok(!facts.some((t) => /Left out .*workshop bench/.test(t)), "the waiting photograph was told as left out");
    // THE STORE WORKS AGAIN: the driver's look finishes the store and files the placement.
    await tick(P);
    const s2 = await settle(P, r.key);
    assert.deepEqual(statuses(s2.rec), ["done", "done"], JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why, p.notDone])));
    assert.match(gallery(P), /<SafeImage src="\/u\/[^"]+\.jpg" alt="the workshop bench"/);
    assert.doesNotMatch(gallery(P), /data-pending-photo/);
    assert.equal(P.imageLog.length, 1, "the photograph was bought again");
    assert.equal(uploads(P).length, 1);
    assert.deepEqual(additionCalls(P), before, "the addition's model work ran again");
    assert.equal(publishedOf(P, r.key, 1), 2, "publishes: the addition, then the placement");
    // ACCOUNTING: the addition's job and the placement's, each charged on its own.
    const rs = reservesOf(P, r.key, 1);
    assert.equal(rs.length, 2, JSON.stringify(rs));
    assert.ok(rs[1].length === 1, "the placement charged once: " + JSON.stringify(rs));
  });
});

test("APH 2 — the photograph's call is LOST after it left: unknown — the gallery is live with its frame marked, held; the sweep never buys it on a guess; the customer's buy-again places one new photograph into that frame without redoing the addition", async () => {
  await withPlatform({ slug: slugOf("a2"), ...BASE({ imageWith: (e, i) => { if (i === 0) throw new TypeError("connection reset"); } }) }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    const s1 = await settle(P, r.key);
    assert.deepEqual(statuses(s1.rec), ["done", "uncertain"]);
    assert.equal(purchases(P)[0].state, "buying");
    assert.match(gallery(P), /data-pending-photo="[0-9a-f]{24}"/);
    const before = additionCalls(P);
    await tick(P);
    assert.equal(P.record(r.key).parts[1].status, "uncertain");
    assert.equal(P.imageLog.length, 1, "the sweep bought on a guess");
    const b = await buyAgain(P, r.key, 1);
    assert.equal(b.status, 200, JSON.stringify(b.body));
    const s2 = await settle(P, r.key);
    assert.deepEqual(statuses(s2.rec), ["done", "done"], JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why, p.notDone])));
    assert.match(gallery(P), /<SafeImage src="\/u\/[^"]+\.jpg" alt="the workshop bench"/);
    assert.equal(P.imageLog.length, 2, "provider calls: the lost one and the one the customer asked for");
    assert.equal(uploads(P).length, 1);
    assert.deepEqual(additionCalls(P), before, "the addition's model work ran again");
    assert.equal(publishedOf(P, r.key, 1), 2);
  });
});

test("APH 3 — the marked frame is GONE when the placement runs (a later change took it): nothing is bought for it and the part ends partial, telling which photograph was not placed — the addition still stands", async () => {
  await withPlatform({ slug: slugOf("a3"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    for (let i = 0; i < 3; i++) P.failPut(isUpload(P));
    await settle(P, r.key);
    // THE FRAME IS TAKEN OFF THE PAGE BEFORE THE STORE WORKS AGAIN.
    const key = "source/" + P.slug + "/pages.json";
    const pages = JSON.parse(P.objects.get(key).body).map((p) => (p.path === "gallery.tsx" ? { ...p, source: p.source.replace(/<SafeImage src="" data-pending-photo="[0-9a-f]{24}"[^>]*\/>/, "") } : p));
    P.objects.set(key, { ...P.objects.get(key), body: JSON.stringify(pages), etag: "e-frame-gone" });
    assert.doesNotMatch(gallery(P), /data-pending-photo/);
    await tick(P);
    const s2 = await settle(P, r.key);
    assert.deepEqual(statuses(s2.rec), ["done", "partial"], JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why, p.notDone])));
    assert.ok(s2.rec.parts[1].notDone.some((x) => x.why === "frame-gone" && x.what === BENCH), JSON.stringify(s2.rec.parts[1].notDone));
    assert.ok(gallery(P).includes("<h1>Gallery</h1>"), "the addition was taken back");
    assert.equal(publishedOf(P, r.key, 1), 1, "a placement with nothing to place published");
  });
});

test("APH 4 — held for a day with nobody able to tell: the addition is LIVE, so the part ends partial (photo not confirmed), never expired as if nothing was done", async () => {
  await withPlatform({ slug: slugOf("a4"), ...BASE({ imageWith: (e, i) => { if (i === 0) throw new TypeError("connection reset"); } }) }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    await settle(P, r.key);
    P.advance(24 * 60 * 60 * 1000 + 1000);
    await tick(P);
    const rec = P.record(r.key);
    assert.equal(rec.parts[1].status, "partial", JSON.stringify(rec.parts[1]));
    assert.equal(rec.parts[1].why, "photos-unconfirmed");
    assert.ok(rec.parts[1].notDone.some((x) => x.what === BENCH && x.why === "photo-unconfirmed"));
    assert.equal(P.imageLog.length, 1, "bought again on expiry");
  });
});

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
