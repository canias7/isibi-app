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

// ── CODEX'S REPRODUCTION ────────────────────────────────────────────────────

test("PO 1 — Codex's reproduction: the next upload write FAILS during the preparation — the store is tried again on the same picture: ONE provider call, one stored photograph, both tasks done, the photo part charged once", async () => {
  await withPlatform({ slug: slugOf("o1"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    P.failPut(isUpload(P));
    await deliver(P, takePrep(P));
    // PROVIDER: one call. ASSET: stored by the preparation's own retry.
    assert.equal(P.imageLog.length, 1, "provider calls after the preparation");
    assert.equal(uploads(P).length, 1, "the preparation's retry did not store the made picture");
    assert.deepEqual(purchases(P).map((x) => x.state), ["bought"]);
    assert.equal(P.record(r.key).parts[1].prep.outcome, "ready", JSON.stringify(P.record(r.key).parts[1].prep));
    const { rec } = await settle(P, r.key);
    // TASK STATE.
    finished(P, r, rec);
    shownIsStored(P);
    // PROVIDER, ASSET AND ACCOUNTING, each on its own.
    assert.equal(P.imageLog.length, 1, "the job bought the photograph again");
    assert.equal(uploads(P).length, 1, "stored photographs");
    assert.equal(chargedOf(P, r.key, 1), 1, "the photo part's charges");
    assert.equal(chargedOf(P, r.key, 0), 1, "the TikTok part's charges");
  });
});

// ── MADE, NOT STORED: FINISHED ON THE SAME PICTURE ─────────────────────────

test("PO 2 — STORAGE FAILS on every try of the preparation: the purchase record keeps the made picture's source (`generated`), the preparation ends uncertain with no second call; the part's job stores THE SAME picture — one provider call, one stored photograph, charged once", async () => {
  await withPlatform({ slug: slugOf("o2"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    for (let i = 0; i < 3; i++) P.failPut(isUpload(P));
    await deliver(P, takePrep(P));
    assert.equal(P.imageLog.length, 1);
    assert.equal(uploads(P).length, 0, "nothing could be stored");
    const [rec0] = purchases(P);
    assert.equal(rec0.state, "generated", JSON.stringify(rec0));
    assert.equal(rec0.source, "https://img.test/p1.jpg", "the made picture's source was not kept");
    assert.equal(P.record(r.key).parts[1].prep.outcome, "uncertain");
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    shownIsStored(P);
    assert.equal(P.imageLog.length, 1, "the job asked for a new picture instead of storing the one made");
    assert.deepEqual([...new Set(P.downloadLog)], ["https://img.test/p1.jpg"], "a different picture was downloaded");
    assert.equal(uploads(P).length, 1);
    assert.deepEqual(purchases(P).map((x) => x.state), ["bought"]);
    assert.equal(chargedOf(P, r.key, 1), 1);
  });
});

test("PO 3 — the DOWNLOAD of the made picture fails on every try: kept as `generated`, never bought again — the job downloads the same picture and stores it: one provider call, one stored photograph, charged once", async () => {
  await withPlatform({ slug: slugOf("o3"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    P.failDownload((u) => u.includes("/p1.jpg"), { times: 3 });
    await deliver(P, takePrep(P));
    assert.equal(P.imageLog.length, 1);
    assert.equal(P.downloadLog.length, 3, "the download was not tried again");
    assert.equal(uploads(P).length, 0);
    assert.equal(purchases(P)[0].state, "generated");
    assert.equal(P.record(r.key).parts[1].prep.outcome, "uncertain");
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    shownIsStored(P);
    assert.equal(P.imageLog.length, 1, "provider calls");
    assert.deepEqual([...new Set(P.downloadLog)], ["https://img.test/p1.jpg"]);
    assert.equal(P.downloadLog.length, 4, "downloads: three failed, one by the job");
    assert.equal(uploads(P).length, 1);
    assert.equal(chargedOf(P, r.key, 1), 1);
  });
});

test("PO 4 — the STORE LANDS BUT ITS ANSWER IS LOST on every try: the stored photograph is found by its purchase tag at once — one provider call, one stored photograph, bought, both tasks done, charged once", async () => {
  await withPlatform({ slug: slugOf("o4"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    for (let i = 0; i < 3; i++) P.losePut(isUpload(P));
    await deliver(P, takePrep(P));
    assert.equal(P.imageLog.length, 1);
    assert.equal(uploads(P).length, 1, "the lost-answer store did land");
    assert.deepEqual(purchases(P).map((x) => x.state), ["bought"], "a store whose answer was lost was not found by its tag");
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    shownIsStored(P);
    assert.equal(P.imageLog.length, 1);
    assert.equal(uploads(P).length, 1);
    assert.equal(chargedOf(P, r.key, 1), 1);
  });
});

test("PO 5 — made, not stored, through the preparation AND the job's first try: the job holds the part (`store-pending`: nothing published, nothing charged, told the picture was made and is being saved); the driver's next look stores the same picture and the part moves on by itself — no buy-again, one provider call, charged once", async () => {
  await withPlatform({ slug: slugOf("o5"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    for (let i = 0; i < 6; i++) P.failPut(isUpload(P));
    await deliver(P, takePrep(P));
    const s1 = await settle(P, r.key);
    assert.deepEqual(statuses(s1.rec), ["done", "uncertain"], JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
    const held = jobsOfPart(P, r.key, 1).map((j) => P.answerOf(j)).find((a) => a && a.error === "purchase-unconfirmed");
    assert.ok(held, "no job answered purchase-unconfirmed");
    assert.deepEqual(held.held.map((h) => h.why), ["store-pending"]);
    assert.match(held.msg, /made but I couldn't save it yet/);
    assert.equal(publishedOf(P, r.key, 1), 0, "a held part published");
    assert.equal(chargedOf(P, r.key, 1), 0, "a held part was charged");
    assert.equal(uploads(P).length, 0);
    assert.equal(purchases(P)[0].state, "generated");
    // THE STORE WORKS AGAIN: the sweep's look finishes it, with no say-so.
    await tick(P);
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    shownIsStored(P);
    assert.equal(P.imageLog.length, 1, "provider calls");
    assert.equal(uploads(P).length, 1);
    assert.deepEqual(purchases(P).map((x) => x.state), ["bought"]);
    assert.equal(chargedOf(P, r.key, 1), 1);
  });
});

test("PO 9 — the store LANDS AND ITS BUYER DIES (the record still `generated`), and the made picture can no longer be downloaded: the next reader finds the stored photograph by its tag and needs no download — one provider call, one download, one stored photograph", async () => {
  await withPlatform({ slug: slugOf("o9"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    P.hangPut(isUpload(P));
    assert.equal(await deliver(P, takePrep(P)), "hung");
    P.recover();
    assert.equal(uploads(P).length, 1, "the store landed");
    assert.equal(purchases(P)[0].state, "generated");
    // THE SOURCE IS GONE: a reader that downloads again would fail.
    P.failDownload(() => true, { times: 99 });
    await deliver(P, await retake(P));
    assert.equal(P.record(r.key).parts[1].prep.outcome, "ready", JSON.stringify(P.record(r.key).parts[1].prep));
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    shownIsStored(P);
    assert.equal(P.imageLog.length, 1, "provider calls");
    assert.equal(P.downloadLog.length, 1, "a stored photograph was downloaded again instead of found by its tag");
    assert.equal(uploads(P).length, 1);
    assert.deepEqual(purchases(P).map((x) => x.state), ["bought"]);
    assert.equal(chargedOf(P, r.key, 1), 1);
  });
});

test("PO 10 — made and never storable, and its source is gone: the part stays held; the customer's buy-again releases the `generated` record and a new picture is bought once — two provider calls, one stored photograph, one charge", async () => {
  await withPlatform({ slug: slugOf("o10"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    P.failDownload((u) => u.includes("/p1.jpg"), { times: 99 });
    await deliver(P, takePrep(P));
    const s1 = await settle(P, r.key);
    assert.deepEqual(statuses(s1.rec), ["done", "uncertain"]);
    assert.equal(purchases(P)[0].state, "generated");
    await tick(P);
    assert.equal(P.record(r.key).parts[1].status, "uncertain");
    assert.equal(P.imageLog.length, 1, "a picture made and not yet stored was bought again without the customer");
    const b = await buyAgain(P, r.key);
    assert.equal(b.status, 200, JSON.stringify(b.body));
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    shownIsStored(P);
    assert.equal(P.imageLog.length, 2);
    assert.equal(uploads(P).length, 1);
    assert.deepEqual(purchases(P).map((x) => x.state), ["bought"]);
    assert.equal(chargedOf(P, r.key, 1), 1);
  });
});

// ── AN ANSWER THAT NEVER CAME BACK: UNKNOWN, HELD ──────────────────────────

test("PO 6 — a TRANSPORT ERROR AFTER THE CALL LEFT: unknown — the purchase stays `buying`, the preparation ends uncertain, the job holds the part (nothing published or charged) and the sweep never buys it on a guess; the customer's buy-again buys it once: two provider calls, one stored photograph, one charge", async () => {
  await withPlatform({ slug: slugOf("o6"), ...BASE({ imageWith: (e, i) => { if (i === 0) throw new TypeError("connection reset"); } }) }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    await deliver(P, takePrep(P));
    assert.equal(P.imageLog.length, 1, "the call left");
    assert.equal(purchases(P)[0].state, "buying", "a lost answer was recorded as an ending");
    assert.equal(P.record(r.key).parts[1].prep.outcome, "uncertain");
    const s1 = await settle(P, r.key);
    assert.deepEqual(statuses(s1.rec), ["done", "uncertain"]);
    assert.equal(P.imageLog.length, 1, "the job bought again after a lost answer");
    assert.equal(publishedOf(P, r.key, 1), 0);
    assert.equal(chargedOf(P, r.key, 1), 0);
    assert.equal(uploads(P).length, 0);
    await tick(P);
    assert.equal(P.record(r.key).parts[1].status, "uncertain");
    assert.equal(P.imageLog.length, 1, "the sweep bought on a guess");
    const b = await buyAgain(P, r.key);
    assert.equal(b.status, 200, JSON.stringify(b.body));
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    shownIsStored(P);
    assert.equal(P.imageLog.length, 2, "provider calls: the lost one and the one the customer asked for");
    assert.equal(uploads(P).length, 1);
    assert.equal(chargedOf(P, r.key, 1), 1);
  });
});

test("PO 7 — the service answers 500 after the call: unknown too, held, not bought again by the job", async () => {
  await withPlatform({ slug: slugOf("o7"), ...BASE({ imageWith: (e, i) => (i === 0 ? new Response(JSON.stringify({ detail: "upstream" }), { status: 500, headers: { "content-type": "application/json" } }) : undefined) }) }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    await deliver(P, takePrep(P));
    const s1 = await settle(P, r.key);
    assert.deepEqual(statuses(s1.rec), ["done", "uncertain"]);
    assert.equal(P.imageLog.length, 1);
    assert.equal(purchases(P)[0].state, "buying");
    assert.equal(chargedOf(P, r.key, 1), 0);
  });
});

// ── CONTROL: A REFUSAL IS AN ENDING ────────────────────────────────────────

test("PO 8 — CONTROL: the service REFUSES (422, nothing made): recorded `none`, so the part's job may buy it — two provider calls (the first made nothing), one stored photograph, both tasks done, charged once", async () => {
  await withPlatform({ slug: slugOf("o8"), ...BASE({ imageWith: (e, i) => (i === 0 ? new Response(JSON.stringify({ detail: "rejected" }), { status: 422, headers: { "content-type": "application/json" } }) : undefined) }) }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    await deliver(P, takePrep(P));
    assert.equal(P.imageLog.length, 1);
    assert.equal(purchases(P)[0].state, "none", "a refusal was not recorded as an ending");
    assert.equal(P.downloadLog.length, 0, "a refusal was downloaded");
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    shownIsStored(P);
    assert.equal(P.imageLog.length, 2);
    assert.equal(uploads(P).length, 1);
    assert.equal(chargedOf(P, r.key, 1), 1);
  });
});

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

test("NET 2 — a case ends only once its held work settled: a purchase still out when the case is done finishes with the stand-ins in place (stored, bought), and nothing reaches the blocking fetch", async () => {
  let release;
  const held = new Promise((ok) => { release = ok; });
  const before = unexpected().filter((u) => u.by === "blocked").length;
  const compiler = installCompiler();
  const P = platform({ slug: slugOf("n2"), ...BASE({ imageWith: () => held }) });
  try {
    await sendMessage(P, { message: MSG });
    const running = deliver(P, takePrep(P));
    for (let i = 0; i < 400 && !P.imageLog.length; i++) await new Promise((ok) => setTimeout(ok, 5));
    assert.equal(P.imageLog.length, 1, "the purchase never began");
    setTimeout(release, 60);
    const left = await P.settle();
    assert.equal(left, 0, "work was still running when the stand-ins went");
    await running;
    assert.equal(uploads(P).length, 1, "the held purchase did not finish before the case closed");
    assert.deepEqual(purchases(P).map((x) => x.state), ["bought"]);
  } finally { P.close(); compiler.uninstall(); }
  await new Promise((ok) => setTimeout(ok, 50));
  assert.equal(unexpected().filter((u) => u.by === "blocked").length, before, "work left running reached the blocking fetch");
});

test("NET — no request in this file left the machine", () => {
  // NET 1's own refused address is the only one allowed.
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked" && u.url !== "https://fal.run/fal-ai/x"), []);
});
