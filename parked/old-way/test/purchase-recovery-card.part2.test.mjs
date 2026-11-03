// PARKED (2026-11-03, park-old-way): the old-way half of test/purchase-recovery-card.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { platform, sendMessage, settle, call, tick, pump, T } from "../../../test/fixtures/request-flow.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { page as pageSrc } from "../../../test/fixtures/live-ask.mjs";
import { blockNetwork } from "../../../test/fixtures/no-network.mjs";
import { page, settle as idle } from "../../../test/fixtures/browser-page.mjs";
import { requestView, heldPurchaseState, heldReasons, PHOTO_RUNNING_MS } from "../../../builder/request.mjs";
// RE-ANCHORED 2026-10-24 (provider-retry re-landed): a provider 529 is now waited for
// and the job parked (the owner's design, docs/plans/2026-10-24-model-failures.md),
// so a call that must FAIL here fails on a refused request (400), which keeps its
// failure handling exactly as these cases test it.

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
        if (writes === 1) throw Object.assign(new Error("upstream 400"), { status: 400 });
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

// ── THE CARD, PURE ──────────────────────────────────────────────────────────

const heldView = (purchaseState, extra = {}) => ({
  key: "rqcard00000000000001", state: "waiting", ended: false, stop: false,
  parts: [{ n: 0, words: "make a photo of the workshop bench for the Visit page", status: "uncertain", purchaseState, buyAgain: purchaseState === "unknown", purchases: [{ d: BENCH, state: purchaseState }], ...extra }],
});
const hasBuy = (html) => /data-req-buy=/.test(html);

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
