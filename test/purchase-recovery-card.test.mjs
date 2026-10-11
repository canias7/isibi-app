// THE RECOVERY CARD FOLLOWS EACH PURCHASE'S STATE (2026-10-11, Codex on
// 2454494b).
//
// A part held on a picture purchase showed one status and one action for
// every reason the server gave: "Checking a picture purchase" and "Buy the
// picture again (may cost again)", for a picture already made and waiting to
// be saved, for one still being made, and for one nobody can tell. Now:
//
//   saving   made, not stored yet: "Saving a picture already made", no
//            buy-again — the same picture is saved by itself;
//   running  still within the image call's own time: "Picture still being
//            made", no buy-again;
//   unknown  nobody can tell (or its source no longer hands it over): the
//            cost-aware buy-again, as before.
//
// AND THE SERVER READS EVERY RECORD AGAIN ON A PRESS: a stale card, or a part
// whose purchases are in different states, never lets a made picture go or a
// running one be bought again; only a purchase nobody can tell is released.
// Two presses at once release it once.
//
// Through the real request driver, routes, job runner and page code, with
// supplied model answers and a stand-in image service; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, call, tick, pump, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { page, settle as idle } from "./fixtures/browser-page.mjs";
import { requestView, heldPurchaseState, heldReasons, PHOTO_RUNNING_MS } from "../builder/request.mjs";

blockNetwork();

const slugOf = (k) => "rc-" + k + "-" + Math.random().toString(16).slice(2, 8);
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

const BENCH = "the workshop bench under the window, warm afternoon light";
const SHELF = "the bread shelf by the door, early morning";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>Open from 8.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }];
const visitWith = (ds) => "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { SafeImage } from '@/components/safe-image'\n"
  + "export const Route = createFileRoute('/visit')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"come\"><h1>Come to the bakery</h1><p>Open from 8.</p>"
  + ds.map((d, i) => "<SafeImage src=\"@@IMG:" + d + "@@\" alt=\"photo " + i + "\" ratio=\"4/3\" />").join("") + "</section></main> }\n";
const MSG = "Add a photo of the workshop bench to the Visit page.";
const uploads = (P) => [...P.objects.keys()].filter((k) => k.startsWith("uploads/" + P.slug + "/"));
const purchasesOf = (P) => [...P.objects.keys()].filter((k) => k.includes("/purchases/")).map((k) => JSON.parse(String(P.objects.get(k).body)));
const lostCall = () => { throw new TypeError("fetch failed: connection reset"); };
const buyAgain = (P, key, n = 0) => call(P, "POST", "/api/site/request/" + P.slug + "/" + key + "/buy-again", { part: n });
const viewOf = async (P, key) => { const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + key); assert.equal(v.status, 200, JSON.stringify(v.body)); return v.body.request; };

/**
 * ONE PHOTO ADDITION whose page writer fails the first time (a provider 529),
 * so the job ends with its early purchases held; later writes succeed.
 * `broken()` says whether the upload store is failing right now — a case
 * turns it off to let storage answer again.
 */
async function heldAddition({ slug, shots = [BENCH], imageWith = null, storeDown = false, check }) {
  let writes = 0;
  const store = { down: storeDown };
  await withPlatform({
    slug, pages: PAGES, images: true, replies: true, balance: 400,
    imageWith,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["photo"] },
      "add:photo": { photo: shots.map((d, i) => ({ page: "/visit", describe: d, name: "photo" + i })) },
      [T.pages]: async () => {
        writes++;
        if (writes === 1) throw Object.assign(new Error("upstream 529"), { status: 529 });
        return { pages: [{ path: "src/routes/visit.tsx", source: visitWith(shots) }] };
      },
    },
  }, async (P) => {
    for (let i = 0; i < 200; i++) P.failPut((k) => store.down && k.startsWith("uploads/" + P.slug + "/"));
    const r = await sendMessage(P, { message: MSG });
    await check(P, r, store);
  });
}

/** The card the page draws for this view, on a page fixture of its own. */
function cardFor(view, { rebuying = [] } = {}) {
  const KEY = view.key;
  const site = { id: "s1", slug: "harbour-loaf", react: true, msgs: [], requests: { [KEY]: { view, rebuying, at: Date.now() } } };
  const p = page({ site });
  return { p, html: p.ctx.siteRequestHTML({ request: KEY }, p.s) };
}

// ── THE STATES, PURE ────────────────────────────────────────────────────────

test("RC 1 — EACH HELD PURCHASE'S STATE FROM ITS REASON: made and not saved is `saving`; still being made is `running` only within the image call's own time, then `unknown`; a frame not readable is `placing`; anything else `unknown` — and the part's state is the most uncertain of them, with a buy-again only for an unknown one", () => {
  const t0 = 1_000_000;
  assert.equal(heldPurchaseState({ why: "store-pending" }, t0, t0), "saving");
  assert.equal(heldPurchaseState({ why: "in-flight" }, t0, t0 + PHOTO_RUNNING_MS - 1), "running");
  assert.equal(heldPurchaseState({ why: "in-flight" }, t0, t0 + PHOTO_RUNNING_MS), "unknown", "a call past its own time was still shown as running");
  assert.equal(heldPurchaseState({ why: "frames-unreachable" }, t0, t0), "placing");
  for (const why of ["unconfirmed", "unreadable", "malformed", "source-unreachable", "", undefined]) assert.equal(heldPurchaseState({ why }, t0, t0), "unknown", String(why));
  const rec = (held) => ({ key: "k", state: "waiting", parts: [{ n: 0, words: "w", status: "uncertain", jobs: [], purchase: { held, at: t0 } }] });
  const id = (c) => c.repeat(24);
  const v = (held, now = t0 + 1000) => requestView(rec(held), { now }).parts[0];
  const saving = v([{ id: id("a"), d: "A", why: "store-pending" }]);
  assert.deepEqual([saving.purchaseState, saving.buyAgain], ["saving", false]);
  const running = v([{ id: id("a"), d: "A", why: "in-flight" }]);
  assert.deepEqual([running.purchaseState, running.buyAgain], ["running", false]);
  assert.deepEqual([v([{ id: id("a"), d: "A", why: "in-flight" }], t0 + PHOTO_RUNNING_MS).purchaseState], ["unknown"]);
  const mixed = v([{ id: id("a"), d: "A", why: "store-pending" }, { id: id("b"), d: "B", why: "unconfirmed" }, { id: id("c"), d: "C", why: "in-flight" }]);
  assert.deepEqual([mixed.purchaseState, mixed.buyAgain], ["unknown", true]);
  assert.deepEqual(mixed.purchases.map((x) => x.state), ["saving", "unknown", "running"]);
  assert.deepEqual(v([{ id: id("a"), d: "A", why: "store-pending" }, { id: id("c"), d: "C", why: "in-flight" }]).purchaseState, "running");
  // CONTROL: a part that is not held carries none of it.
  const done = requestView({ key: "k", state: "done", parts: [{ n: 0, words: "w", status: "done", jobs: [] }] }).parts[0];
  assert.equal(done.purchaseState, undefined);
  // THE REASON THE DRIVER OBSERVES is written onto the held purchase, its time kept.
  const r0 = rec([{ id: id("a"), d: "A", why: "store-pending" }]);
  const moved = heldReasons(r0, 0, new Map([[id("a"), "source-unreachable"]]));
  assert.equal(moved.parts[0].purchase.held[0].why, "source-unreachable");
  assert.equal(moved.parts[0].purchase.at, t0);
  assert.equal(heldReasons(r0, 0, new Map([[id("a"), "store-pending"]])), null, "an unchanged reason rewrote the record");
});

// ── THE CARD, PURE ──────────────────────────────────────────────────────────

const heldView = (purchaseState, extra = {}) => ({
  key: "rqcard00000000000001", state: "waiting", ended: false, stop: false,
  parts: [{ n: 0, words: "make a photo of the workshop bench for the Visit page", status: "uncertain", purchaseState, buyAgain: purchaseState === "unknown", purchases: [{ d: BENCH, state: purchaseState }], ...extra }],
});
const hasBuy = (html) => /data-req-buy=/.test(html);

test("RC 2 — THE CARD FOLLOWS THE STATE: saving and running show their own status and no buy-again; unknown shows the cost-aware buy-again; a part with mixed purchases shows the most uncertain; an addition already live says which; a view from before the field reads as unknown, as it did", () => {
  const saving = cardFor(heldView("saving")).html;
  assert.match(saving, />Saving a picture already made</);
  assert.ok(!hasBuy(saving), "a picture already made was offered a buy-again");
  const running = cardFor(heldView("running")).html;
  assert.match(running, />Picture still being made</);
  assert.ok(!hasBuy(running), "a picture still being made was offered a buy-again");
  const unknown = cardFor(heldView("unknown")).html;
  assert.match(unknown, />Checking a picture purchase</);
  assert.match(unknown, /Buy the picture again \(may cost again\)/);
  const placing = cardFor(heldView("placing")).html;
  assert.match(placing, />Putting the picture in</);
  assert.ok(!hasBuy(placing));
  const mixed = cardFor(heldView("unknown", { purchases: [{ d: BENCH, state: "saving" }, { d: SHELF, state: "unknown" }] })).html;
  assert.ok(hasBuy(mixed));
  assert.match(cardFor(heldView("saving", { published: true, waitingPhotos: 1 })).html, />Added — photo being saved</);
  assert.match(cardFor(heldView("running", { published: true, waitingPhotos: 2 })).html, />Added — photos still being made</);
  // A VIEW KEPT FROM BEFORE `purchaseState`: what it said then.
  const old = heldView("unknown"); delete old.parts[0].purchaseState; delete old.parts[0].buyAgain;
  const oldHtml = cardFor(old).html;
  assert.match(oldHtml, />Checking a picture purchase</);
  assert.ok(hasBuy(oldHtml));
  // WHILE A PRESS IS IN FLIGHT: no second button.
  assert.match(cardFor(heldView("unknown"), { rebuying: [0] }).html, />Starting…</);
});

test("RC 3 — A PRESS IS SENT ONCE: two clicks before the answer post once; a part whose view offers no buy-again posts nothing", async () => {
  const view = heldView("unknown");
  const site = { id: "s1", slug: "harbour-loaf", react: true, msgs: [], requests: { [view.key]: { view, at: Date.now() } } };
  let release;
  const late = new Promise((ok) => { release = ok; });
  const p = page({ site, answer: (url, method) => (method === "POST" && /buy-again$/.test(url) ? late.then(() => ({ status: 200, body: { ok: true, request: view } })) : null) });
  p.ctx.siteRequestBuyAgain("s1", view.key, 0);
  p.ctx.siteRequestBuyAgain("s1", view.key, 0);
  await idle();
  assert.equal(p.calls.filter((c) => /buy-again$/.test(c.url)).length, 1, "a second click posted again");
  release();
  await idle();
  const quiet = heldView("saving");
  const q = page({ site: { id: "s1", slug: "harbour-loaf", react: true, msgs: [], requests: { [quiet.key]: { view: quiet, at: Date.now() } } }, answer: () => ({ status: 200, body: { ok: true, request: quiet } }) });
  q.ctx.siteRequestBuyAgain("s1", quiet.key, 0);
  await idle();
  assert.equal(q.calls.filter((c) => /buy-again$/.test(c.url)).length, 0, "a picture already made was pressed for");
});

// ── THE SERVER, THROUGH THE REAL ROUTES ─────────────────────────────────────

test("RC 4 — STORED-BUT-UNSAVED, A STALE PRESS, AND THE BROWSER CLOSED: the part shows `saving` with no buy-again; a press anyway (an old card) releases nothing and leaves the made picture on its record; once storage answers, the driver alone saves that same picture and the part finishes — one generation", { timeout: 30000 }, async () => {
  await heldAddition({
    slug: slugOf("r4"), storeDown: true,
    check: async (P, r, store) => {
      const s1 = await settle(P, r.key);
      assert.equal(s1.rec.parts[0].status, "uncertain", JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
      assert.deepEqual(purchasesOf(P).map((x) => x.state), ["generated"]);
      const v = await viewOf(P, r.key);
      assert.deepEqual([v.parts[0].purchaseState, v.parts[0].buyAgain], ["saving", false]);
      const { html } = cardFor(v);
      assert.match(html, />Saving a picture already made</);
      assert.ok(!hasBuy(html));
      // A STALE CARD'S PRESS: nothing released, the made picture kept.
      const b = await buyAgain(P, r.key);
      assert.equal(b.status, 200, JSON.stringify(b.body));
      assert.equal(b.body.released, 0);
      assert.deepEqual(b.body.kept, [{ d: BENCH, state: "saving" }]);
      assert.deepEqual(purchasesOf(P).map((x) => x.state), ["generated"], "a made picture was let go");
      assert.equal(P.imageLog.length, 1);
      // STORAGE ANSWERS; NO PAGE IS OPEN — only the driver's own sweeps run.
      store.down = false;
      let rec = null;
      for (let i = 0; i < 6; i++) { await tick(P); rec = (await settle(P, r.key)).rec; if (rec.parts[0].status === "done") break; }
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.equal(P.imageLog.length, 1, "the picture was generated again");
      assert.equal(uploads(P).length, 1);
      assert.deepEqual(purchasesOf(P).map((x) => x.state), ["bought"]);
    },
  });
});

test("RC 5 — STILL RUNNING: within the call's own time the part shows `running` with no buy-again, and a press releases nothing; when the call lands, the part finishes with that picture — one generation", { timeout: 30000 }, async () => {
  let release;
  const held = new Promise((ok) => { release = ok; });
  const real = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...a) => real(fn, Number(ms) >= 30000 ? 30 : ms, ...a);
  try {
    await heldAddition({
      slug: slugOf("r5"),
      imageWith: async () => { await held; return null; },
      check: async (P, r) => {
        const s1 = await settle(P, r.key);
        assert.equal(s1.rec.parts[0].status, "uncertain", JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
        const v = await viewOf(P, r.key);
        assert.deepEqual([v.parts[0].purchaseState, v.parts[0].buyAgain], ["running", false]);
        assert.match(cardFor(v).html, />Picture still being made</);
        const b = await buyAgain(P, r.key);
        assert.equal(b.status, 200, JSON.stringify(b.body));
        assert.equal(b.body.released, 0);
        assert.deepEqual(b.body.kept, [{ d: BENCH, state: "running" }]);
        assert.deepEqual(purchasesOf(P).map((x) => x.state), ["buying"], "a running purchase was released");
        release();
        for (let i = 0; i < 50 && !uploads(P).length; i++) await new Promise((ok) => real(ok, 20));
        let rec = null;
        for (let i = 0; i < 4; i++) { await tick(P); rec = (await settle(P, r.key)).rec; if (rec.parts[0].status === "done") break; }
        assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
        assert.equal(P.imageLog.length, 1, "the picture was generated again");
      },
    });
  } finally { globalThis.setTimeout = real; }
});

test("RC 6 — UNKNOWN, PRESSED TWICE AT ONCE: the part shows the cost-aware buy-again; two presses together release the purchase once (neither fails), and it is bought again exactly once", { timeout: 30000 }, async () => {
  await heldAddition({
    slug: slugOf("r6"),
    imageWith: async (e, n) => (n === 0 ? lostCall() : null),
    check: async (P, r) => {
      const s1 = await settle(P, r.key);
      assert.equal(s1.rec.parts[0].status, "uncertain");
      const v = await viewOf(P, r.key);
      assert.deepEqual([v.parts[0].purchaseState, v.parts[0].buyAgain], ["unknown", true]);
      assert.match(cardFor(v).html, /Buy the picture again \(may cost again\)/);
      const [a, b] = await Promise.all([buyAgain(P, r.key), buyAgain(P, r.key)]);
      for (const x of [a, b]) assert.ok(x.status === 200 || x.status === 409, "a press failed: " + x.status + " " + JSON.stringify(x.body));
      assert.equal((a.body.released || 0) + (b.body.released || 0), 1, "released " + JSON.stringify([a.body.released, b.body.released]));
      let rec = null;
      for (let i = 0; i < 4; i++) { rec = (await settle(P, r.key)).rec; if (rec.parts[0].status === "done") break; await tick(P); }
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.equal(P.imageLog.length, 2, "the customer's one buy-again bought " + (P.imageLog.length - 1) + " times");
      assert.equal(uploads(P).length, 1);
    },
  });
});

test("RC 7 — MIXED: one purchase made and not saved, one nobody can tell; the card offers the buy-again for the unknown one, and a press releases ONLY it — the made picture stays on its record and is saved, never made again; once storage answers both photographs are placed: three generations in all, never four", { timeout: 30000 }, async () => {
  await heldAddition({
    slug: slugOf("r7"), shots: [BENCH, SHELF], storeDown: true,
    imageWith: async (e, n) => (n === 0 ? lostCall() : null),
    check: async (P, r, store) => {
      const s1 = await settle(P, r.key);
      assert.equal(s1.rec.parts[0].status, "uncertain", JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
      assert.deepEqual(purchasesOf(P).map((x) => x.state).sort(), ["buying", "generated"]);
      const v = await viewOf(P, r.key);
      assert.deepEqual([v.parts[0].purchaseState, v.parts[0].buyAgain], ["unknown", true]);
      assert.deepEqual(v.parts[0].purchases.map((x) => x.state).sort(), ["saving", "unknown"]);
      assert.ok(hasBuy(cardFor(v).html));
      const made = purchasesOf(P).find((x) => x.state === "generated");
      const b = await buyAgain(P, r.key);
      assert.equal(b.status, 200, JSON.stringify(b.body));
      assert.equal(b.body.released, 1);
      assert.deepEqual(b.body.kept, [{ d: made.d, state: "saving" }]);
      const after = purchasesOf(P);
      assert.equal(after.find((x) => x.id === made.id).state, "generated", "the made picture was let go");
      assert.equal(after.filter((x) => x.state === "released").length, 1);
      // WHAT THE PAGE IS SHOWN NOW: the released one is bought again next, the
      // made one is still being saved — the part held on it.
      const va = await viewOf(P, r.key);
      assert.equal(va.parts[0].status, "uncertain");
      assert.deepEqual(Object.values(bySd(va)).sort(), ["again", "saving"]);
      assert.deepEqual([va.parts[0].purchaseState, va.parts[0].buyAgain], ["saving", false]);
      store.down = false;
      let rec = null;
      for (let i = 0; i < 6; i++) { await tick(P); rec = (await settle(P, r.key)).rec; if (rec.parts[0].status === "done") break; }
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.equal(P.imageLog.length, 3, "the made picture was generated again, or the released one twice");
      assert.equal(uploads(P).length, 2);
      assert.equal((P.page("visit.tsx").match(/<SafeImage src="\/u\//g) || []).length, 2, P.page("visit.tsx"));
    },
  });
});

test("RC 8 — MADE, BUT ITS SOURCE NO LONGER HANDS IT OVER: the driver observes it while trying to save it, the part turns to `unknown` with the buy-again, and a press releases it — bought again once", { timeout: 30000 }, async () => {
  await heldAddition({
    slug: slugOf("r8"), storeDown: true,
    check: async (P, r, store) => {
      const s1 = await settle(P, r.key);
      assert.equal(s1.rec.parts[0].status, "uncertain");
      assert.equal((await viewOf(P, r.key)).parts[0].purchaseState, "saving");
      // THE STORE ANSWERS NOW, BUT THE MADE PICTURE CAN NO LONGER BE FETCHED.
      store.down = false;
      P.failDownload((u) => u.includes("/p1.jpg"), { times: 99 });
      await tick(P);
      await settle(P, r.key);
      const v = await viewOf(P, r.key);
      assert.equal(v.parts[0].status, "uncertain");
      assert.deepEqual([v.parts[0].purchaseState, v.parts[0].buyAgain], ["unknown", true]);
      assert.deepEqual(v.parts[0].purchases.map((x) => x.why), ["source-unreachable"]);
      assert.equal(P.imageLog.length, 1);
      const b = await buyAgain(P, r.key);
      assert.equal(b.body.released, 1, JSON.stringify(b.body));
      let rec = null;
      for (let i = 0; i < 4; i++) { rec = (await settle(P, r.key)).rec; if (rec.parts[0].status === "done") break; await tick(P); }
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.equal(P.imageLog.length, 2);
    },
  });
});

test("RC 9 — LANDED, ITS RECORD NEVER SAID SO: the call outlives its running time, then its photograph is stored but the record's last write is lost; the card offers the buy-again, and a press finds the stored photograph — recorded bought, nothing released, never bought again", { timeout: 30000 }, async () => {
  let release;
  const held = new Promise((ok) => { release = ok; });
  const real = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...a) => real(fn, Number(ms) >= 30000 ? 30 : ms, ...a);
  try {
    await heldAddition({
      slug: slugOf("r9"),
      imageWith: async () => { await held; return null; },
      check: async (P, r) => {
        const s1 = await settle(P, r.key);
        assert.equal(s1.rec.parts[0].status, "uncertain");
        // ITS LATER WRITES (`generated`, then `bought`) ARE LOST; the photograph
        // itself is stored, tagged with the purchase — the record still says `buying`.
        for (const st of ["generated", "bought"]) P.failPut((k, body) => k.includes("/purchases/") && String(body).includes('"state":"' + st + '"'));
        release();
        for (let i = 0; i < 50 && !uploads(P).length; i++) await new Promise((ok) => real(ok, 20));
        assert.equal(uploads(P).length, 1);
        assert.deepEqual(purchasesOf(P).map((x) => x.state), ["buying"]);
        // PAST ITS RUNNING TIME: nobody can tell from the part alone.
        // (Pressed straight from the card: no read in between, which would let
        // the driver find the photograph first.)
        P.advance(PHOTO_RUNNING_MS + 1000);
        const b = await buyAgain(P, r.key);
        assert.equal(b.status, 200, JSON.stringify(b.body));
        assert.equal(b.body.released, 0, "a purchase that had landed was released");
        assert.deepEqual(b.body.kept, [{ d: BENCH, state: "saved" }]);
        assert.ok(!purchasesOf(P).some((x) => x.state === "released"), "a purchase that had landed was released");
        let rec = null;
        for (let i = 0; i < 4; i++) { await tick(P); rec = (await settle(P, r.key)).rec; if (rec.parts[0].status === "done") break; }
        assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
        assert.equal(P.imageLog.length, 1, "a landed purchase was bought again");
      },
    });
  } finally { globalThis.setTimeout = real; }
});

// ── EVERY PURCHASE RECOVERED ON ITS OWN (Codex on 4079bb38) ─────────────────
//
// A part held on two purchases — one nobody can tell, one made while the
// store was down — was recovered as a whole: the driver's look stopped at the
// first purchase it could not tell, so a made picture behind it was never
// saved; and one it did save kept the reason it was held with ("saving") in
// what the page was shown. Each purchase is now looked at and moved on by
// itself, every time, and what the page is shown is what each one is now. The
// part stays held while any of them is not known.
const isBench = (e) => e.prompt.includes(BENCH.slice(0, 16));
const bySd = (v) => Object.fromEntries((v.parts[0].purchases || []).map((x) => [x.d, x.state]));
const sweeps = async (P, n = 3) => { for (let i = 0; i < n; i++) await tick(P); };

for (const [name, lostAt, unknownD, madeD] of [["RC 10", 0, BENCH, SHELF], ["RC 11", 1, SHELF, BENCH]]) {
  let lost = false;
  test(name + " — TWO PURCHASES, ONE NOBODY CAN TELL (" + (lostAt === 0 ? "first" : "second") + ") AND ONE MADE WHILE THE STORE WAS DOWN: with the store back and no page open, three sweeps save the made picture — never made again — and the page is shown it as saved while the part stays held on the other; the customer's buy-again then buys only the unknown one, and the part finishes with both placed", { timeout: 30000 }, async () => {
    await heldAddition({
      slug: slugOf(name === "RC 10" ? "r10" : "r11"), shots: [BENCH, SHELF], storeDown: true,
      // THE CALL FOR THAT PICTURE IS THE ONE LOST, by its own words — the order
      // the calls leave in is the stand-in's, and the held order is the shots'.
      imageWith: async (e) => { if (e.prompt.includes(unknownD.slice(0, 16)) && !lost) { lost = true; lostCall(); } return null; },
      check: async (P, r, store) => {
        const s1 = await settle(P, r.key);
        assert.equal(s1.rec.parts[0].status, "uncertain", JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
        assert.deepEqual(Object.fromEntries(purchasesOf(P).map((x) => [x.d, x.state])), { [unknownD]: "buying", [madeD]: "generated" });
        // HELD IN THE SHOTS' ORDER: the unknown one first (RC 10) or second (RC 11).
        assert.equal(s1.rec.parts[0].purchase.held[lostAt].d, unknownD, JSON.stringify(s1.rec.parts[0].purchase.held));
        assert.equal(P.imageLog.length, 2);
        // THE STORE ANSWERS AGAIN; THE BROWSER IS CLOSED: only the sweeps run.
        store.down = false;
        await sweeps(P);
        assert.equal(P.record(r.key).parts[0].status, "uncertain", "the part went on with a purchase nobody can tell");
        assert.deepEqual(Object.fromEntries(purchasesOf(P).map((x) => [x.d, x.state])), { [unknownD]: "buying", [madeD]: "bought" }, "the made picture was not saved");
        assert.equal(uploads(P).length, 1);
        assert.equal(P.imageLog.length, 2, "the made picture was generated again");
        const v = await viewOf(P, r.key);
        assert.deepEqual(bySd(v), { [unknownD]: "unknown", [madeD]: "saved" }, "the page was not shown each picture as it is now");
        assert.deepEqual([v.parts[0].purchaseState, v.parts[0].buyAgain], ["unknown", true]);
        // THE CUSTOMER'S EXPLICIT BUY-AGAIN: only the unknown one is released.
        const b = await buyAgain(P, r.key);
        assert.equal(b.status, 200, JSON.stringify(b.body));
        assert.equal(b.body.released, 1);
        assert.deepEqual(b.body.kept, []);
        let rec = null;
        for (let i = 0; i < 6; i++) { await tick(P); await pump(P, { twice: true }); rec = (await settle(P, r.key)).rec; if (rec.parts[0].status === "done") break; }
        assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
        assert.equal(P.imageLog.length, 3, "the made picture was generated again, or the unknown one twice");
        assert.equal(uploads(P).length, 2);
        assert.equal((P.page("visit.tsx").match(/<SafeImage src="\/u\//g) || []).length, 2, P.page("visit.tsx"));
      },
    });
  });
}

test("RC 12 — ONE STILL BEING MADE, ONE MADE WHILE THE STORE WAS DOWN: the sweeps save the made picture and show it saved while the other is shown still being made, the part held; when the call lands the part finishes by itself — every message delivered twice — with exactly two generations and both placed", { timeout: 30000 }, async () => {
  let release;
  const held = new Promise((ok) => { release = ok; });
  const real = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...a) => real(fn, Number(ms) >= 30000 ? 30 : ms, ...a);
  try {
    await heldAddition({
      slug: slugOf("r12"), shots: [BENCH, SHELF], storeDown: true,
      // EACH CALL ITS OWN PICTURE (the stand-in names a picture by the calls
      // made when it answers, so a held call would otherwise answer the same).
      imageWith: async (e, n) => {
        if (isBench(e)) await held;
        return new Response(JSON.stringify({ images: [{ url: "https://img.test/p" + (isBench(e) ? 11 : 12) + ".jpg" }] }), { status: 200, headers: { "content-type": "application/json" } });
      },
      check: async (P, r, store) => {
        const s1 = await settle(P, r.key);
        assert.equal(s1.rec.parts[0].status, "uncertain", JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
        store.down = false;
        await sweeps(P);
        assert.equal(P.record(r.key).parts[0].status, "uncertain");
        assert.deepEqual(Object.fromEntries(purchasesOf(P).map((x) => [x.d, x.state])), { [BENCH]: "buying", [SHELF]: "bought" });
        const v = await viewOf(P, r.key);
        assert.deepEqual(bySd(v), { [BENCH]: "running", [SHELF]: "saved" });
        assert.deepEqual([v.parts[0].purchaseState, v.parts[0].buyAgain], ["running", false]);
        // THE CALL LANDS; NOBODY PRESSES ANYTHING.
        release();
        for (let i = 0; i < 50 && uploads(P).length < 2; i++) await new Promise((ok) => real(ok, 20));
        let rec = null;
        for (let i = 0; i < 6; i++) { await tick(P); await pump(P, { twice: true }); rec = (await settle(P, r.key)).rec; if (rec.parts[0].status === "done") break; }
        assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
        assert.equal(P.imageLog.length, 2, "a picture was generated again");
        assert.equal(uploads(P).length, 2);
        assert.equal((P.page("visit.tsx").match(/<SafeImage src="\/u\//g) || []).length, 2, P.page("visit.tsx"));
        const refs = P.ledger.map((e) => e.ref);
        assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
      },
    });
  } finally { globalThis.setTimeout = real; }
});

test("RC 13 — SAVED AND ENDED ARE THEIR OWN STATES: a purchase saved and waiting to be placed is `saved`, one known to have ended or released is `ended`; neither is offered a buy-again or outranks one still unsettled, and the card names them", () => {
  const t0 = 1_000_000;
  assert.equal(heldPurchaseState({ why: "saved" }, t0, t0), "saved");
  assert.equal(heldPurchaseState({ why: "ended" }, t0, t0), "ended");
  assert.equal(heldPurchaseState({ why: "released" }, t0, t0), "again");
  assert.match(cardFor(heldView("again")).html, />Buying the picture again next</);
  const rec = (held) => ({ key: "k", state: "waiting", parts: [{ n: 0, words: "w", status: "uncertain", jobs: [], purchase: { held, at: t0 } }] });
  const id = (c) => c.repeat(24);
  const v = (held) => requestView(rec(held), { now: t0 + 1000 }).parts[0];
  assert.deepEqual([v([{ id: id("a"), d: "A", why: "saved" }, { id: id("b"), d: "B", why: "store-pending" }]).purchaseState], ["saving"]);
  assert.deepEqual([v([{ id: id("a"), d: "A", why: "saved" }, { id: id("b"), d: "B", why: "unconfirmed" }]).purchaseState], ["unknown"]);
  const allSaved = v([{ id: id("a"), d: "A", why: "saved" }]);
  assert.deepEqual([allSaved.purchaseState, allSaved.buyAgain], ["saved", false]);
  const html = cardFor(heldView("saved")).html;
  assert.match(html, />Picture saved, placing it next</);
  assert.ok(!hasBuy(html));
  assert.match(cardFor(heldView("ended")).html, />Picture purchase ended</);
});

test("RC 14 — ONE STILL BEING MADE LANDS ON ITS OWN WHILE THE OTHER IS UNKNOWN: past its running time, the landed one is shown saved (never as unknown, never offered a buy-again), the part held on the other", { timeout: 30000 }, async () => {
  let release;
  const held = new Promise((ok) => { release = ok; });
  const real = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...a) => real(fn, Number(ms) >= 30000 ? 30 : ms, ...a);
  try {
    await heldAddition({
      slug: slugOf("r14"), shots: [BENCH, SHELF],
      imageWith: async (e, n) => {
        if (isBench(e)) await held; else lostCall();
        return new Response(JSON.stringify({ images: [{ url: "https://img.test/p" + (isBench(e) ? 11 : 12) + ".jpg" }] }), { status: 200, headers: { "content-type": "application/json" } });
      },
      check: async (P, r) => {
        const s1 = await settle(P, r.key);
        assert.equal(s1.rec.parts[0].status, "uncertain");
        release();
        for (let i = 0; i < 50 && !uploads(P).length; i++) await new Promise((ok) => real(ok, 20));
        assert.deepEqual(Object.fromEntries(purchasesOf(P).map((x) => [x.d, x.state])), { [BENCH]: "bought", [SHELF]: "buying" });
        P.advance(PHOTO_RUNNING_MS + 1000);
        await sweeps(P);
        const v = await viewOf(P, r.key);
        assert.equal(v.parts[0].status, "uncertain");
        assert.deepEqual(bySd(v), { [BENCH]: "saved", [SHELF]: "unknown" });
        assert.equal(P.imageLog.length, 2);
      },
    });
  } finally { globalThis.setTimeout = real; }
});

test("RC 15 — LANDED, ITS RECORD NEVER SAID SO, BESIDE ONE NOBODY CAN TELL: the sweeps find its stored photograph and show it saved; the part stays held on the other", { timeout: 30000 }, async () => {
  let release;
  const held = new Promise((ok) => { release = ok; });
  const real = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...a) => real(fn, Number(ms) >= 30000 ? 30 : ms, ...a);
  try {
    await heldAddition({
      slug: slugOf("r15"), shots: [BENCH, SHELF],
      imageWith: async (e, n) => {
        if (isBench(e)) await held; else lostCall();
        return new Response(JSON.stringify({ images: [{ url: "https://img.test/p" + (isBench(e) ? 11 : 12) + ".jpg" }] }), { status: 200, headers: { "content-type": "application/json" } });
      },
      check: async (P, r) => {
        const s1 = await settle(P, r.key);
        assert.equal(s1.rec.parts[0].status, "uncertain");
        for (const st of ["generated", "bought"]) P.failPut((k, body) => k.includes("/purchases/") && String(body).includes('"state":"' + st + '"'));
        release();
        for (let i = 0; i < 50 && !uploads(P).length; i++) await new Promise((ok) => real(ok, 20));
        assert.deepEqual(Object.fromEntries(purchasesOf(P).map((x) => [x.d, x.state])), { [BENCH]: "buying", [SHELF]: "buying" });
        await sweeps(P);
        const v = await viewOf(P, r.key);
        assert.equal(v.parts[0].status, "uncertain");
        assert.deepEqual(bySd(v), { [BENCH]: "saved", [SHELF]: "unknown" });
        assert.deepEqual(Object.fromEntries(purchasesOf(P).map((x) => [x.d, x.state])), { [BENCH]: "bought", [SHELF]: "buying" });
      },
    });
  } finally { globalThis.setTimeout = real; }
});

for (const [name, how] of [["RC 16", "unfetchable"], ["RC 17", "unreadable"]]) {
  test(name + " — A MADE PICTURE " + (how === "unfetchable" ? "THAT CANNOT BE FETCHED" : "WHOSE RECORD CANNOT BE READ") + " AHEAD OF ANOTHER MADE PICTURE: in ONE sweep, with the store back, the other is saved — never made again — and the first keeps the part held", { timeout: 30000 }, async () => {
    await heldAddition({
      slug: slugOf(how === "unfetchable" ? "r16" : "r17"), shots: [BENCH, SHELF], storeDown: true,
      imageWith: async (e) => new Response(JSON.stringify({ images: [{ url: "https://img.test/p" + (isBench(e) ? 11 : 12) + ".jpg" }] }), { status: 200, headers: { "content-type": "application/json" } }),
      check: async (P, r, store) => {
        const s1 = await settle(P, r.key);
        assert.equal(s1.rec.parts[0].status, "uncertain");
        assert.equal(s1.rec.parts[0].purchase.held[0].d, BENCH, "held in the shots' order");
        assert.deepEqual(Object.fromEntries(purchasesOf(P).map((x) => [x.d, x.state])), { [BENCH]: "generated", [SHELF]: "generated" });
        const bench = purchasesOf(P).find((x) => x.d === BENCH);
        if (how === "unfetchable") P.failDownload((u) => u === bench.source, { times: 999 });
        else {
          const benchKey = [...P.objects.keys()].find((k) => k.includes("/purchases/") && JSON.parse(String(P.objects.get(k).body)).d === BENCH);
          for (let i = 0; i < 3; i++) P.failGet((k) => k === benchKey);
        }
        store.down = false;
        await tick(P);
        assert.equal(purchasesOf(P).find((x) => x.d === SHELF).state, "bought", "a purchase ahead of it stopped a made picture being saved");
        assert.equal(P.record(r.key).parts[0].status, "uncertain");
        assert.equal(P.imageLog.length, 2);
        assert.equal(uploads(P).length, 1);
        if (how === "unfetchable") {
          const v = await viewOf(P, r.key);
          assert.deepEqual(bySd(v), { [BENCH]: "unknown", [SHELF]: "saved" });
          assert.deepEqual(v.parts[0].purchases.map((x) => x.why).sort(), ["saved", "source-unreachable"]);
        }
      },
    });
  });
}
