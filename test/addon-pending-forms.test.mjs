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

test("APF 1 — EQUIVALENT JSX FORMS (Codex's reproduction first): `src={\"…\"}`, `src='…'` and a template literal each hold the token; each is marked with its purchase when the store fails, the part held rather than partial, and each frame is filled with that same picture afterwards", async () => {
  const forms = {
    expression: '<SafeImage src={"' + TOKEN + '"} alt="the workshop bench" ratio="4/3" />',
    single: "<SafeImage src='" + TOKEN + "' alt=\"the workshop bench\" ratio=\"4/3\" />",
    template: "<SafeImage src={`" + TOKEN + "`} alt=\"the workshop bench\" ratio=\"4/3\" />",
  };
  for (const [name, frame] of Object.entries(forms)) {
    await withPlatform({ slug: slugOf("f-" + name), ...BASE({ pages: { pages: [{ path: "src/routes/gallery.tsx", source: gallerySrc(frame) }] } }) }, async (P) => {
      const { placed } = await heldThenPlaced(P);
      // NOTHING ELSE ON THE PAGE MOVED.
      assert.ok(placed.includes('alt="the workshop bench" ratio="4/3"') && placed.includes("<p>Our work, up close.</p>"), name + ": " + placed);
    });
  }
});

test("APF 2 — A SHARED COMPONENT: the addition writes a component whose photograph is a value in its own list (`{ image: '…' }`), rendered through `src={t.image}`; that value is marked, the component published, and the placement fills it there — the page that renders it is not touched", async () => {
  const TILE = "import { SafeImage } from '@/components/safe-image'\n"
    + "const TILES = [{ image: '" + TOKEN + "', title: 'The bench' }];\n"
    + "export function GalleryTiles(){ return <div>{TILES.map((t) => <SafeImage key={t.title} src={t.image} alt={t.title} ratio=\"4/3\" />)}</div> }\n";
  const PAGE = HEAD.replace("import { SafeImage } from '@/components/safe-image'\n", "import { GalleryTiles } from '@/routes/-parts/gallery-tiles'\n")
    + "function Page(){ return <main><h1>Gallery</h1><GalleryTiles /><p>Our work, up close.</p></main> }\n";
  await withPlatform({ slug: slugOf("shared"), ...BASE({ pages: { pages: [{ path: "src/routes/gallery.tsx", source: PAGE }], parts: [{ name: "gallery-tiles", source: TILE }] } }) }, async (P) => {
    let pageWhenHeld = "";
    const { placed } = await heldThenPlaced(P, { where: (Q) => { pageWhenHeld = pageWhenHeld || gallery(Q); return partSrc(Q, "gallery-tiles"); } });
    assert.match(placed, /const TILES = \[\{ image: "\/u\/[^"]+\.jpg", title: 'The bench' \}\];/, placed);
    assert.equal(gallery(P), pageWhenHeld, "the page rendering the component was changed by the placement");
  });
});

test("APF 3 — NO FRAME CAN BE SAFELY FOUND (the token inside a longer string): the purchase is kept as explicit pending work with no frame and told so; when it lands it is reported saved, nothing is placed by a guess, nothing published or charged for it, and the part ends partial with that reason", async () => {
  const frame = "<div style={{ backgroundImage: `url(" + TOKEN + ")` }} className=\"h-64\" />";
  await withPlatform({ slug: slugOf("noframe"), ...BASE({ pages: { pages: [{ path: "src/routes/gallery.tsx", source: gallerySrc(frame) }] } }) }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    for (let i = 0; i < 3; i++) P.failPut(isUpload(P));
    const s1 = await settle(P, r.key);
    assert.deepEqual(statuses(s1.rec), ["done", "uncertain"], JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why, p.notDone])));
    const pend = s1.rec.parts[1].place.photos;
    assert.equal(pend.length, 1);
    assert.equal(pend[0].located, false, "a frame was claimed where none could be safely found");
    assert.doesNotMatch(gallery(P), /pending-photo|@@IMG/);
    // THE CUSTOMER IS TOLD it will not be placed by itself.
    await readWritten(P, "/api/site/edit/" + runJobs(P, r.key, 1)[0].id);
    const facts = P.replyLog.flat().map((x) => x.text);
    assert.ok(facts.some((t) => t.includes(BENCH) && /will not be put in by itself/.test(t)), JSON.stringify(facts));
    const pageBefore = gallery(P);
    await tick(P);
    const s2 = await settle(P, r.key);
    assert.deepEqual(statuses(s2.rec), ["done", "partial"], JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why, p.notDone])));
    assert.ok(s2.rec.parts[1].notDone.some((x) => x.why === "no-frame" && x.what === BENCH), JSON.stringify(s2.rec.parts[1].notDone));
    assert.equal(gallery(P), pageBefore, "the page was changed by a guess");
    assert.equal(P.imageLog.length, 1, "bought again");
    assert.equal(uploads(P).length, 1, "the made picture was not saved");
    assert.equal(publishedOf(P, r.key, 1), 1, "a placement with nothing to place published");
    const rs = runJobs(P, r.key, 1).map((j) => reserveOf(P, j.id).filter((x) => x > 0));
    assert.deepEqual(rs.slice(1), [[]], "the unplaced photograph was charged: " + JSON.stringify(rs));
  });
});

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

test("APF 4 — THE WAIT ENDS WHILE THE PHOTOGRAPH IS STILL BEING MADE: the addition publishes with the frame marked under the purchase's identity (kept before the wait), the part is held with the photograph told as still being made, the independent part finishes; when the call lands later, the next look places that photograph — one provider call, no new purchase, the addition not redone", async () => {
  let release;
  const gate = new Promise((ok) => { release = ok; });
  let restore = null;
  await withPlatform({ slug: slugOf("late"), ...BASE({ imageWith: async () => { await gate; } }) }, async (P) => {
    restore = shortPhotoWait();
    const r = await sendMessage(P, { message: MSG });
    const s1 = await settle(P, r.key);
    restore(); restore = null;
    assert.deepEqual(statuses(s1.rec), ["done", "uncertain"], JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why, p.notDone])));
    assert.ok(P.page("visit.tsx").includes(TIKTOK_TO));
    const pend = s1.rec.parts[1].place.photos;
    assert.equal(pend.length, 1);
    assert.equal(pend[0].why, "in-flight");
    assert.equal(pend[0].located, true);
    assert.equal((gallery(P).match(MARK) || [])[1], pend[0].id, gallery(P));
    assert.equal(P.imageLog.length, 1);
    assert.equal(publishedOf(P, r.key, 1), 1);
    const addJob = runJobs(P, r.key, 1)[0];
    assert.equal(reserveOf(P, addJob.id).filter((x) => x > 4).length, 0, "the addition charged for a photograph it did not place");
    await readWritten(P, "/api/site/edit/" + addJob.id);
    const facts = P.replyLog.flat().map((x) => x.text);
    assert.ok(facts.some((t) => t.includes(BENCH) && /still being made when the addition was published/.test(t) && /put into that frame by itself/.test(t)), JSON.stringify(facts));
    const before = additionCalls(P);
    // THE CALL LANDS NOW, after its job ended; the purchase finishes on its own record.
    release();
    for (let i = 0; i < 50 && !(purchases(P)[0] && purchases(P)[0].state === "bought"); i++) await new Promise((ok) => setTimeout(ok, 20));
    assert.equal(purchases(P)[0].state, "bought", "the late photograph did not finish on its purchase");
    await tick(P);
    const s2 = await settle(P, r.key);
    assert.deepEqual(statuses(s2.rec), ["done", "done"], JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why, p.notDone])));
    assert.match(gallery(P), /<SafeImage src=\{"\/u\/[^"]+\.jpg"\} alt="the workshop bench"/);
    assert.equal(P.imageLog.length, 1, "the late photograph was bought again");
    assert.equal(uploads(P).length, 1);
    assert.deepEqual(additionCalls(P), before, "the addition's model work ran again");
    assert.equal(publishedOf(P, r.key, 1), 2);
    const rs = runJobs(P, r.key, 1).map((j) => reserveOf(P, j.id));
    assert.equal(rs[1].length, 1, "the placement was not charged once: " + JSON.stringify(rs));
  });
  if (restore) restore();
});

test("APF 5 — EVERY MESSAGE DELIVERED TWICE, NO PAGE OPEN: the addition published once, the photograph bought once, the placement publishing once and charged once", async () => {
  await withPlatform({ slug: slugOf("twice"), ...BASE({ pages: { pages: [{ path: "src/routes/gallery.tsx", source: gallerySrc('<SafeImage src={"' + TOKEN + '"} alt="the workshop bench" ratio="4/3" />') }] } }) }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    for (let i = 0; i < 3; i++) P.failPut(isUpload(P));
    const run = async () => {
      for (let i = 0; i < 30; i++) {
        if (P.queue.length) { await pump(P, { twice: true }); continue; }
        const rec = P.record(r.key);
        if (!rec || rec.ended || rec.parts.every((p) => ["done", "partial", "failed"].includes(p.status))) return rec;
        await tick(P);
      }
      return P.record(r.key);
    };
    const s = await run();
    assert.deepEqual(statuses(s), ["done", "done"], JSON.stringify(s.parts.map((p) => [p.status, p.why, p.notDone])));
    assert.match(gallery(P), /<SafeImage src=\{"\/u\/[^"]+\.jpg"\}/);
    assert.equal(P.imageLog.length, 1, "bought twice");
    assert.equal(uploads(P).length, 1);
    assert.equal(calls(P, T.pages), 1, "the addition's page writer was asked twice");
    assert.equal(publishedOf(P, r.key, 1), 2, "publishes: the addition and the placement, once each");
    for (const j of P.jobsOf(r.key)) assert.ok(reserveOf(P, j.id).length <= 1, j.op + " charged twice");
  });
});

test("APF 6 — THE FRAME WAS CHANGED BEFORE THE PLACEMENT (the customer put their own picture in it, the mark still beside it): their picture is kept and never overwritten, nothing is bought, nothing published; the made photograph is reported saved and the part ends partial with that reason", async () => {
  await withPlatform({ slug: slugOf("changed"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    for (let i = 0; i < 3; i++) P.failPut(isUpload(P));
    await settle(P, r.key);
    const OWN = "/u/" + P.slug + "/my-own-bench.jpg";
    const key = "source/" + P.slug + "/pages.json";
    const pages = JSON.parse(P.objects.get(key).body).map((p) => (p.path === "gallery.tsx" ? { ...p, source: p.source.replace(/""( \/\*pending-photo:)/, JSON.stringify(OWN) + "$1") } : p));
    P.objects.set(key, { ...P.objects.get(key), body: JSON.stringify(pages), etag: "e-own-picture" });
    assert.ok(gallery(P).includes(OWN));
    await tick(P);
    const s2 = await settle(P, r.key);
    assert.deepEqual(statuses(s2.rec), ["done", "partial"], JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why, p.notDone])));
    assert.ok(s2.rec.parts[1].notDone.some((x) => x.why === "frame-changed" && x.what === BENCH), JSON.stringify(s2.rec.parts[1].notDone));
    assert.ok(gallery(P).includes(OWN), "the customer's picture was overwritten");
    assert.doesNotMatch(gallery(P), /src=\{"\/u\/[^"]+\/[0-9a-f]+\.jpg"/);
    assert.equal(P.imageLog.length, 1, "bought again");
    assert.equal(publishedOf(P, r.key, 1), 1, "a placement that placed nothing published");
  });
});

test("APF 7 — THE PROGRESS LINE WHILE THE PHOTOGRAPH WAITS: the add-on's publish milestone says the addition is being published AND, as a separate fact in its own state, that the photograph is not on the page yet and goes in once confirmed — never that the photograph is published", async () => {
  await withPlatform({ slug: slugOf("prog"), progress: true, ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    for (let i = 0; i < 3; i++) P.failPut(isUpload(P));
    await settle(P, r.key);
    const addJob = runJobs(P, r.key, 1)[0];
    const rec = P.progressOf(addJob.id);
    assert.ok(rec, "the addition kept no progress record");
    const publish = rec.marks.find((m) => m.stage === "publish");
    assert.ok(publish, "no publish milestone: " + rec.marks.map((m) => m.stage).join(","));
    const doing = publish.facts.find((f) => f.state === "doing");
    const waiting = publish.facts.find((f) => f.text.includes(BENCH));
    assert.match(doing.text, /Publishing the site with the additions/);
    assert.ok(waiting, "the waiting photograph was not a fact of its own: " + JSON.stringify(publish.facts));
    assert.equal(waiting.state, "next");
    assert.match(waiting.text, /is not on the page yet/);
    assert.doesNotMatch(waiting.text, /\b(?:is|was|has been) published\b/, "a fact says something is published before it is");
  });
});

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
