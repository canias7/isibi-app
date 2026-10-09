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
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";

const slugOf = (k) => "po-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
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

test("OWN 1 — Codex's reproduction: the same preparation delivered twice AT ONCE, its routing held until both are inside — one consumer takes it, one routing call, one picture call, one photograph; the request then finishes with one publish and one charge per job", async () => {
  const held = gate();
  let inside = 0;
  await withPlatform({
    slug: slugOf("o1"), pages: PIC_PAGES, images: true,
    answers: {
      route: async (args, n) => { if (n >= 1) { inside++; await held.p; } return ROUTE_PIC[Math.min(n, 1)]; },
      choose_pictures: PICTURE,
      [T.text]: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }),
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: TIKTOK + ", and " + PHOTO + "." });
    const m = takePrep(P);
    const a = deliver(P, m), b = deliver(P, m);
    for (let i = 0; i < 100 && inside < 1; i++) await new Promise((ok) => setTimeout(ok, 5));
    await new Promise((ok) => setTimeout(ok, 50));
    held.open();
    await Promise.all([a, b]);
    assert.equal(inside, 1, "both deliveries made the preparation's routing call");
    assert.equal(calls(P, "choose_pictures").length, 1, "both deliveries asked the picture model");
    assert.equal(P.imageLog.length, 1, "the one preparation bought two photographs");
    const rec0 = P.record(r.key);
    assert.equal(rec0.parts[1].prep.state, "done", JSON.stringify(rec0.parts[1].prep));
    assert.equal(rec0.parts[1].prep.outcome, "ready");
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
    assert.equal(P.imageLog.length, 1, "the part's job bought the photograph again");
    assert.equal(calls(P, "choose_pictures").length, 1);
    const js = P.jobsOf(r.key);
    for (const j of js) assert.equal(reserveOf(P, j.id).length, 1, j.op + " charged more than once");
    assert.equal(js.filter((j) => j.published_at).length, 2);
  });
});

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

test("OWN 2 — the owner dies after taking the claim, inside its first call: inside its time nothing takes it again; after it, the sweep takes it again naming the first, and the new attempt does the work once — one picture call, one photograph", async () => {
  await withPlatform({ slug: slugOf("o2"), ...BASE({ route: (args, n) => (n === 1 ? new Promise(() => {}) : ROUTE_PIC[Math.min(n, 1)]) }) }, async (P) => {
    const r = await sendMessage(P, { message: TIKTOK + ", and " + PHOTO + "." });
    const first = takePrep(P);
    deliver(P, first); // never answers: the owner is gone
    await waitFor(() => calls(P, T.route).length === 2, "the first attempt's routing call");
    assert.equal(P.record(r.key).parts[1].prep.state, "running");
    const { tick } = await import("./fixtures/request-flow.mjs");
    await tick(P);
    assert.equal(P.queue.filter((m) => m.body.kind === "request-prep").length, 0, "a running attempt was taken again inside its time");
    const { m, prep } = await retake(P, r);
    assert.equal(prep.prev, first.body.seq, "the new attempt does not name the one that died");
    await deliver(P, m);
    assert.equal(P.record(r.key).parts[1].prep.outcome, "ready");
    await finish(P, r);
    assert.equal(calls(P, "choose_pictures").length, 1);
    assert.equal(P.imageLog.length, 1);
  });
});

test("OWN 3 — the owner dies right after the photograph was bought and noted, before it kept its outcome: the next attempt reuses the recorded calls AND the photograph — no second routing or picture call, no second purchase", async () => {
  await withPlatform({ slug: slugOf("o3"), ...BASE({}) }, async (P) => {
    const r = await sendMessage(P, { message: TIKTOK + ", and " + PHOTO + "." });
    const first = takePrep(P);
    P.hangPut((k, body) => k.includes("/prep/p1-") && String(body).includes('"state":"bought"'));
    assert.equal(await deliver(P, first), "hung");
    P.recover();
    assert.equal(P.imageLog.length, 1);
    const { m } = await retake(P, r);
    await deliver(P, m);
    const prep = P.record(r.key).parts[1].prep;
    assert.equal(prep.outcome, "ready", JSON.stringify(prep));
    assert.equal(calls(P, T.route).length, 2, "the new attempt asked the router again");
    assert.equal(calls(P, "choose_pictures").length, 1, "the new attempt asked the picture model again");
    assert.equal(P.imageLog.length, 1, "the new attempt bought the photograph again");
    await finish(P, r);
    assert.equal(P.imageLog.length, 1);
    assert.equal(calls(P, "choose_pictures").length, 1);
  });
});

test("OWN 4 — the owner dies INSIDE the purchase, its outcome unknown: the next attempt does not buy it again — it ends `uncertain` with no new call; the part's own job does not buy it either (2026-10-09, round 3): the part is held, recoverable, and the independent part finishes", async () => {
  await withPlatform({ slug: slugOf("o4"), ...BASE({ more: { imageWith: (e, i) => (i === 0 ? new Promise(() => {}) : undefined) } }) }, async (P) => {
    const r = await sendMessage(P, { message: TIKTOK + ", and " + PHOTO + "." });
    deliver(P, takePrep(P)); // dies inside the purchase
    await waitFor(() => P.imageLog.length === 1, "the first attempt's purchase");
    const before = { route: calls(P, T.route).length, pic: calls(P, "choose_pictures").length };
    const { m } = await retake(P, r);
    await deliver(P, m);
    const prep = P.record(r.key).parts[1].prep;
    assert.equal(prep.outcome, "uncertain", JSON.stringify(prep));
    assert.equal(P.imageLog.length, 1, "a purchase whose outcome is unknown was made again by a preparation");
    assert.deepEqual({ route: calls(P, T.route).length, pic: calls(P, "choose_pictures").length }, before, "the uncertain attempt made calls");
    // THE PART'S OWN JOB, finding the purchase begun and nothing landed, HOLDS
    // the part (round 3; it bought a second picture before): no purchase, no
    // publish, no charge — moved on only when the purchase is found or the
    // customer says to buy it again (`test/parallel-purchase.test.mjs`).
    const { settle: drive } = await import("./fixtures/request-flow.mjs");
    const { rec } = await drive(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "uncertain"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(P.imageLog.length, 1, "the part's job bought a picture whose first purchase's outcome was unknown");
    assert.ok(P.page("visit.tsx").includes(TIKTOK_TO));
  });
});

test("OWN 5 — a LATE owner: the first attempt is held inside its purchase past its time; the next attempt ends uncertain; the first then lands the photograph — its result never replaces the newer attempt, and the part's job reuses that photograph instead of buying another", async () => {
  const held = gate();
  await withPlatform({ slug: slugOf("o5"), ...BASE({ more: { imageWith: (e, i) => (i === 0 ? held.p : undefined) } }) }, async (P) => {
    const r = await sendMessage(P, { message: TIKTOK + ", and " + PHOTO + "." });
    const late = deliver(P, takePrep(P));
    await waitFor(() => P.imageLog.length === 1, "the first attempt's purchase");
    const { m } = await retake(P, r);
    await deliver(P, m);
    const newer = P.record(r.key).parts[1].prep;
    assert.equal(newer.outcome, "uncertain");
    held.open();
    await late;
    const after = P.record(r.key).parts[1].prep;
    assert.equal(after.seq, newer.seq, "the late owner replaced the newer attempt");
    assert.equal(after.outcome, "uncertain", "the late owner's result was kept over the newer attempt's");
    await finish(P, r);
    assert.equal(P.imageLog.length, 1, "the photograph the late owner bought was bought again");
  });
});
