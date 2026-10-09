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

// ── CODEX'S FIRST REPRODUCTION: AN UNREADABLE PREVIOUS RECORD ──────────────

test("PUR 1 — Codex's first reproduction: the owner hangs right after the bought note lands; after expiry the next read of its record FAILS once — the retake reads it again, reuses its calls and its photograph, and buys nothing", async () => {
  await withPlatform({ slug: slugOf("p1"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    const first = takePrep(P);
    P.hangPut((k, body) => k.includes("/prep/p1-") && String(body).includes('"state":"bought"'));
    assert.equal(await deliver(P, first), "hung");
    P.recover();
    assert.equal(P.imageLog.length, 1);
    const m = await retake(P);
    P.failGet((k) => k === prepFile(P, r.key, first.body.seq));
    await deliver(P, m);
    const prep = P.record(r.key).parts[1].prep;
    assert.equal(prep.outcome, "ready", JSON.stringify(prep));
    assert.equal(P.imageLog.length, 1, "the retake bought the photograph again after one failed read");
    assert.equal(calls(P, T.route).length, 2, "the retake asked the router again");
    assert.equal(calls(P, "choose_pictures").length, 1, "the retake asked the picture model again");
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    assert.equal(P.imageLog.length, 1, "provider purchases");
    assert.equal(uploads(P).length, 1, "stored photographs");
    assert.equal(chargedOf(P, r.key, 1), 1, "the photo part's charges");
    assert.deepEqual(purchases(P).map((x) => x.state), ["bought"]);
  });
});

test("PUR 2 — the previous record STAYS unreadable for the retake: it is unknown, never empty — the retake ends `uncertain` with no call and no purchase; the part's job reads it again, reuses the recorded calls, and finds the purchase bought on its own record", async () => {
  await withPlatform({ slug: slugOf("p2"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    const first = takePrep(P);
    P.hangPut((k, body) => k.includes("/prep/p1-") && String(body).includes('"state":"bought"'));
    assert.equal(await deliver(P, first), "hung");
    P.recover();
    const m = await retake(P);
    for (let i = 0; i < 3; i++) P.failGet((k) => k === prepFile(P, r.key, first.body.seq));
    const before = { route: calls(P, T.route).length, pic: calls(P, "choose_pictures").length };
    await deliver(P, m);
    const prep = P.record(r.key).parts[1].prep;
    assert.equal(prep.outcome, "uncertain", JSON.stringify(prep));
    assert.deepEqual({ route: calls(P, T.route).length, pic: calls(P, "choose_pictures").length }, before, "an attempt that could not read the one before made calls");
    assert.equal(P.imageLog.length, 1, "an unreadable record was taken as nothing bought");
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    assert.equal(P.imageLog.length, 1, "provider purchases");
    assert.equal(uploads(P).length, 1, "stored photographs");
    assert.equal(calls(P, "choose_pictures").length, 1, "the job did not reuse the recorded picture call");
    assert.equal(chargedOf(P, r.key, 1), 1);
  });
});

test("PUR 3 — a MALFORMED previous record is unknown too: no call and no purchase by the retake; the job, unable to reuse its calls, asks the picture model again — but the photograph is the purchase already bought, never a second one", async () => {
  await withPlatform({ slug: slugOf("p3"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    const first = takePrep(P);
    P.hangPut((k, body) => k.includes("/prep/p1-") && String(body).includes('"state":"bought"'));
    assert.equal(await deliver(P, first), "hung");
    P.recover();
    P.objects.get(prepFile(P, r.key, first.body.seq)).body = "{\"v\":1,\"run\":";
    const m = await retake(P);
    await deliver(P, m);
    assert.equal(P.record(r.key).parts[1].prep.outcome, "uncertain");
    assert.equal(P.imageLog.length, 1);
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    assert.equal(P.imageLog.length, 1, "provider purchases");
    assert.equal(uploads(P).length, 1, "stored photographs");
    // THE HONEST COST: the recorded picture call could not be read, so the job made it again (ours: the preparation's was never charged).
    assert.equal(calls(P, "choose_pictures").length, 2);
    assert.equal(chargedOf(P, r.key, 1), 1);
  });
});

// ── CODEX'S SECOND REPRODUCTION: THE JOB FINISHES BEFORE THE FIRST PURCHASE ──

test("PUR 4 — Codex's second reproduction: the first purchase is held past its attempt's time, the retake ends uncertain, and the part's JOB RUNS BEFORE the purchase lands — it buys nothing and holds the part (nothing published or charged) while the independent part finishes; the purchase then lands, the part moves on by itself and reuses it: one purchase, one stored photograph, one publish, one charge", async () => {
  const held = gate();
  await withPlatform({ slug: slugOf("p4"), ...BASE({ imageWith: (e, i) => (i === 0 ? held.p : undefined) }) }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    const late = deliver(P, takePrep(P));
    await waitFor(() => P.imageLog.length === 1, "the first attempt's purchase");
    await deliver(P, await retake(P));
    assert.equal(P.record(r.key).parts[1].prep.outcome, "uncertain");
    const s1 = await settle(P, r.key);
    assert.deepEqual(statuses(s1.rec), ["done", "uncertain"], JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
    assert.equal(s1.rec.ended, false);
    assert.equal(P.imageLog.length, 1, "the job bought a picture while the first purchase's outcome was unknown");
    assert.equal(uploads(P).length, 0, "a photograph was stored before any purchase landed");
    assert.equal(publishedOf(P, r.key, 1), 0, "the held part published");
    assert.equal(chargedOf(P, r.key, 1), 0, "the held part was charged");
    assert.ok(P.page("visit.tsx").includes(TIKTOK_TO), "the independent part did not go on");
    assert.match(P.page("index.tsx"), /<SafeImage src="" alt="A loaf on the counter"/);
    // WHAT THE PAGE IS SHOWN.
    const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    const p1 = v.body.request.parts[1];
    assert.equal(p1.status, "uncertain");
    assert.deepEqual(p1.purchases, [{ d: "a sourdough loaf on a wooden counter" }]);
    // AND WHAT THE CUSTOMER IS TOLD, as the page asks for the held job's reply:
    // its facts say it is held, not given up, and how it moves on.
    const heldJob = jobsOfPart(P, r.key, 1).find((j) => (P.answerOf(j) || {}).error === "purchase-unconfirmed");
    assert.ok(heldJob, "no job of the photo part answered held");
    const told = await readWritten(P, "/api/site/edit/" + heldJob.id);
    assert.equal(told.body.error, "purchase-unconfirmed");
    assert.ok(P.replyLog.some((f) => f.some((x) => /on hold, not given up/.test(x.text))), "no fact said the part is held: " + JSON.stringify(P.replyLog));
    held.open();
    await late;
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    assert.equal(P.imageLog.length, 1, "provider purchases");
    assert.equal(uploads(P).length, 1, "stored photographs");
    assert.equal(chargedOf(P, r.key, 1), 1, "the photo part's charges");
    assert.deepEqual(purchases(P).map((x) => x.state), ["bought"]);
  });
});

test("PUR 5 — the first purchase lands AFTER the retake and BEFORE the part's job starts (OWN 5's order): the job reuses it — one purchase, one stored photograph — and the late owner's result never replaces the newer attempt's", async () => {
  const held = gate();
  await withPlatform({ slug: slugOf("p5"), ...BASE({ imageWith: (e, i) => (i === 0 ? held.p : undefined) }) }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    const late = deliver(P, takePrep(P));
    await waitFor(() => P.imageLog.length === 1, "the first attempt's purchase");
    await deliver(P, await retake(P));
    const newer = P.record(r.key).parts[1].prep;
    held.open();
    await late;
    assert.equal(P.record(r.key).parts[1].prep.seq, newer.seq);
    assert.equal(P.record(r.key).parts[1].prep.outcome, "uncertain");
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    assert.equal(P.imageLog.length, 1);
    assert.equal(uploads(P).length, 1);
    assert.equal(chargedOf(P, r.key, 1), 1);
  });
});

test("PUR 6 — a purchase that landed and was stored but whose buyer died before recording it: found by its tag, recorded bought, reused — never bought again", async () => {
  await withPlatform({ slug: slugOf("p6"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    // THE STORE OF THE PHOTOGRAPH LANDS AND ITS BUYER IS GONE: stored and
    // tagged, its record still `buying`, its attempt's note still `buying`.
    P.hangPut((k) => k.startsWith("uploads/" + P.slug + "/"));
    assert.equal(await deliver(P, takePrep(P)), "hung");
    P.recover();
    assert.equal(uploads(P).length, 1, "the photograph was stored before its buyer died");
    // (2026-10-09, round 4) the record names the made picture's source before
    // the store, so it reads `generated`, not `buying`.
    assert.deepEqual(purchases(P).map((x) => x.state), ["generated"]);
    const before = calls(P, "choose_pictures").length;
    await deliver(P, await retake(P));
    assert.equal(P.record(r.key).parts[1].prep.outcome, "ready", JSON.stringify(P.record(r.key).parts[1].prep));
    assert.deepEqual(purchases(P).map((x) => x.state), ["bought"], "the landed purchase was not recorded when found");
    assert.equal(calls(P, "choose_pictures").length, before, "the retake did not reuse the recorded picture call");
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    assert.equal(P.imageLog.length, 1, "provider purchases");
    assert.equal(uploads(P).length, 1, "stored photographs");
    assert.deepEqual(purchases(P).map((x) => x.state), ["bought"]);
  });
});

// ── AN OUTCOME NOBODY CAN EVER TELL: HELD, RECOVERABLE, NEVER GUESSED ───────

test("PUR 7 — the first purchase never answers and nothing was stored: the part is held; only the customer's say-so buys it again — once, though the job's message is delivered twice at once — and a second press answers 409", async () => {
  await withPlatform({ slug: slugOf("p7"), ...BASE({ imageWith: (e, i) => (i === 0 ? new Promise(() => {}) : undefined) }) }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    deliver(P, takePrep(P)); // dies inside the purchase
    await waitFor(() => P.imageLog.length === 1, "the first attempt's purchase");
    await deliver(P, await retake(P));
    const s1 = await settle(P, r.key);
    assert.deepEqual(statuses(s1.rec), ["done", "uncertain"]);
    assert.equal(P.imageLog.length, 1);
    // THE SWEEP LOOKS AGAIN: still nothing stored, still held — not bought on a guess.
    await tick(P);
    assert.equal(P.record(r.key).parts[1].status, "uncertain");
    assert.equal(P.imageLog.length, 1);
    const b = await call(P, "POST", "/api/site/request/" + P.slug + "/" + r.key + "/buy-again", { part: 1 });
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.equal(purchases(P)[0].state, "released");
    const again = await call(P, "POST", "/api/site/request/" + P.slug + "/" + r.key + "/buy-again", { part: 1 });
    assert.equal(again.status, 409);
    const job = P.queue.find((m) => m.body.kind !== "request-prep");
    assert.ok(job, "no job was filed after the say-so");
    P.queue.splice(P.queue.indexOf(job), 1);
    await Promise.all([deliver(P, job), deliver(P, job)]);
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    assert.equal(P.imageLog.length, 2, "provider purchases: the lost one and the one the customer asked for");
    assert.equal(uploads(P).length, 1, "stored photographs");
    assert.equal(chargedOf(P, r.key, 1), 1, "the customer was charged for the picture more than once");
  });
});

test("PUR 8 — a malformed purchase record is unknown: the part is held, nothing bought; the customer's say-so replaces it and the picture is bought once", async () => {
  await withPlatform({ slug: slugOf("p8"), ...BASE({ imageWith: (e, i) => (i === 0 ? new Promise(() => {}) : undefined) }) }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    deliver(P, takePrep(P));
    await waitFor(() => P.imageLog.length === 1, "the first attempt's purchase");
    const pk = [...P.objects.keys()].find((k) => k.includes("/purchases/"));
    P.objects.get(pk).body = "{\"v\":1,\"state\":\"bou";
    await deliver(P, await retake(P));
    const s1 = await settle(P, r.key);
    assert.deepEqual(statuses(s1.rec), ["done", "uncertain"]);
    assert.equal(P.imageLog.length, 1);
    assert.equal((await call(P, "POST", "/api/site/request/" + P.slug + "/" + r.key + "/buy-again", { part: 1 })).status, 200);
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    assert.equal(P.imageLog.length, 2);
    assert.equal(uploads(P).length, 1);
    assert.equal(chargedOf(P, r.key, 1), 1);
  });
});

test("PUR 9 — held for a day with nobody able to tell: the part expires, told as not done, the request ends; nothing is ever bought again", async () => {
  await withPlatform({ slug: slugOf("p9"), ...BASE({ imageWith: (e, i) => (i === 0 ? new Promise(() => {}) : undefined) }) }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    deliver(P, takePrep(P));
    await waitFor(() => P.imageLog.length === 1, "the first attempt's purchase");
    await deliver(P, await retake(P));
    await settle(P, r.key);
    P.advance(24 * 3600 * 1000 + 1000);
    await tick(P);
    const rec = P.record(r.key);
    assert.deepEqual(statuses(rec), ["done", "expired"]);
    assert.equal(rec.parts[1].why, "purchase-unconfirmed");
    assert.equal(rec.ended, true);
    assert.equal(P.imageLog.length, 1);
    assert.equal(uploads(P).length, 0);
    assert.equal(chargedOf(P, r.key, 1), 0);
  });
});

test("PUR 10 — the purchase's OWN record cannot be read when a preparation reaches it (three failing reads), though nothing was ever begun: unknown, never absent — the preparation buys nothing and ends uncertain; the part's job then reads it, finds nothing begun, and buys it once", async () => {
  await withPlatform({ slug: slugOf("p10"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    for (let i = 0; i < 3; i++) P.failGet((k) => k.includes("/purchases/"));
    await deliver(P, takePrep(P));
    assert.equal(P.record(r.key).parts[1].prep.outcome, "uncertain", JSON.stringify(P.record(r.key).parts[1].prep));
    assert.equal(P.imageLog.length, 0, "a purchase whose record could not be read was made");
    assert.equal(purchases(P).length, 0);
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    assert.equal(P.imageLog.length, 1);
    assert.equal(uploads(P).length, 1);
    assert.equal(chargedOf(P, r.key, 1), 1);
  });
});

test("PUR 11 — the preparation's `buying` claim LANDS but its answer is lost: it may have been written, so nothing is bought on it — the preparation ends uncertain with no purchase; the part's job finds the claim and nothing stored, and holds the part; the customer's say-so then buys it once", async () => {
  await withPlatform({ slug: slugOf("p11"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    P.losePut((k, body) => k.includes("/purchases/") && String(body).includes('"state":"buying"'));
    await deliver(P, takePrep(P));
    assert.equal(P.record(r.key).parts[1].prep.outcome, "uncertain", JSON.stringify(P.record(r.key).parts[1].prep));
    assert.equal(P.imageLog.length, 0, "a purchase was made on a claim whose answer was lost");
    assert.deepEqual(purchases(P).map((x) => x.state), ["buying"]);
    const s1 = await settle(P, r.key);
    assert.deepEqual(statuses(s1.rec), ["done", "uncertain"]);
    assert.equal(P.imageLog.length, 0);
    assert.equal((await call(P, "POST", "/api/site/request/" + P.slug + "/" + r.key + "/buy-again", { part: 1 })).status, 200);
    const { rec } = await settle(P, r.key);
    finished(P, r, rec);
    assert.equal(P.imageLog.length, 1);
    assert.equal(uploads(P).length, 1);
    assert.equal(chargedOf(P, r.key, 1), 1);
  });
});

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
