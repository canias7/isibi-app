// A FIRST BUILD'S INDEPENDENT WORK, RUN TOGETHER (2026-10-09, round 3).
//
// The owner asked for the missing Build capability itself, not the existing
// design graph counted as it: identify independent work inside a first build,
// run it at once where its inputs are there, wait for real dependencies, keep
// results across retries, and assemble and check the whole before it is
// published — with the existing jobs, dependency machinery and recovery, and
// the 1-page / 15-component limits unchanged.
//
// WHAT IS NEW, AND WHAT WAS THERE:
//   * existing: the design graph runs its agents concurrently by their needs
//     (P8 in test/parallel-requests.test.mjs; unchanged here);
//   * new: the photographs the design describes are a task of their own. They
//     need only the design, so they are bought BESIDE the page generation
//     instead of after it, each as the build's logical purchase (one record,
//     durable across a resume or a retry). The image step joins them: a token
//     whose purchase is in flight waits for it, one bought is reused, one the
//     writer changed is bought then. Nothing is handed on — to the resume, the
//     reply, the refund — while a purchase it began is in flight.
//
// Through the real queue consumer (design → fire → 202) and the real resume
// (images → compile → publish), with the network stood in for: the image
// service (`fal.run`, `img.test`), the container, GoTrue and the ledger.
import test from "node:test";
import assert from "node:assert/strict";
import { buildBucket, GOOD_DESIGN, BRIEF, JPEG_DATA } from "./fixtures/build-route.mjs";
import { ledger, fireInterim, finishResume } from "./fixtures/build-lifecycle.mjs";
import { resultKey, readResult } from "../builder/build-job.mjs";
import { resumeKey } from "../builder/build-resume.mjs";
import { buildReplyFacts } from "../builder/site-reply.mjs";
import { blockNetwork, unexpected, clearUnexpected, blockedFetch, noteUnexpected } from "./fixtures/no-network.mjs";
import { BUILD_USER } from "./fixtures/build-route.mjs";
import { loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { progressKey } from "../builder/site-progress.mjs";
import { replayLines, afterNotMade } from "./fixtures/progress-replay.mjs";

blockNetwork();

const SLUG = GOOD_DESIGN.slug;
let seq = 0;
const newId = () => (++seq).toString(16).padStart(3, "0") + "b8c3d4e5f60718293a4b5c6d7e8f9";
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const JPEG = Uint8Array.from(Buffer.from(JPEG_DATA.split(",")[1], "base64"));

// A REALISTIC FIRST-BUILD REQUEST WITH SEVERAL REQUIREMENTS: four pictures the
// design names, opening hours, an order line, and the address.
const BRIEF_MANY = "Harbour Loaf, a bakery on Wharf Street in Leeds. We want a page with a photo of a loaf at dawn, our shop front, hands shaping dough and the window counter; our opening hours (Tue–Sat 7–2); a way to order loaves for Saturday collection; and our address.";
const PICS = ["a loaf at dawn", "the shop front on a wet morning", "hands shaping dough", "the window counter with bread stacked high"];
const DESIGN = Object.freeze({ ...GOOD_DESIGN, images: PICS.map((describe) => ({ page: "/", describe })) });
const pageOf = (tokens) => routeSrc(
  tokens.map((d) => '<img src="@@IMG:' + d + '@@" alt="' + d + '" />').join("") +
  "<section><h2>Opening hours</h2><p>Tue–Sat 7–2</p></section><section><h2>Order for Saturday</h2><p>Order loaves for Saturday collection.</p></section><section><h2>Find us</h2><p>Wharf Street, Leeds</p></section>");
function routeSrc(body) {
  return "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/')({ component: Page });\nfunction Page() { return (<main>" + body + "</main>); }\n";
}

/** The image service, stood in for: every purchase logged with when it began and ended; `hold(i)` may delay one; `refuse` answers every one as an empty balance does (403). */
function images({ hold = null, refuse = false } = {}) {
  const log = [];
  return {
    log,
    open: () => log.filter((e) => e.end == null).length,
    over: async (u, init) => {
      if (u.startsWith("https://fal.run/")) {
        let prompt = "";
        try { prompt = JSON.parse(String((init && init.body) || "{}")).prompt || ""; } catch { prompt = ""; }
        const e = { prompt, at: Date.now(), end: null, i: log.length };
        log.push(e);
        if (hold) await hold(e);
        e.end = Date.now();
        if (refuse) return json({ detail: "User is locked. Reason: Exhausted balance." }, 403);
        return json({ images: [{ url: "https://img.test/p" + (e.i + 1) + ".jpg" }] });
      }
      if (u.startsWith("https://img.test/")) {
        const n = Number((u.match(/\/p(\d+)\.jpg/) || [])[1]) || 0;
        const bytes = new Uint8Array(JPEG.length + 2);
        bytes.set(JPEG); bytes.set([n & 255, 0x41], JPEG.length);
        return new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } });
      }
      return null;
    },
  };
}
const uploads = (b) => [...b.store.keys()].filter((k) => k.startsWith("uploads/" + SLUG + "/"));
const purchases = (b, id) => [...b.store.entries()].filter(([k]) => k.startsWith("source/" + SLUG + "/purchases/build-" + id + "/")).map(([, v]) => JSON.parse(v));
const answerOf = (b, id) => { const raw = b.store.get(resultKey(id)); if (!raw) return null; const r = readResult(JSON.parse(raw)); return { status: r.status, body: JSON.parse(r.body) }; };
const published = (b) => { const raw = b.store.get("source/" + SLUG + "/pages.json"); return raw ? JSON.parse(raw).map((p) => p.source).join("\n") : ""; };
const urlsIn = (src) => [...src.matchAll(/\/u\/[a-z0-9-]+\/[a-z0-9]+\.jpg/g)].map((m) => m[0]);
const promptOf = (d) => new RegExp("^" + d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

test("BLD 1 — NEW OVERLAP: a first build's photographs are bought WHILE its page generation is out — the image service is called after the generation was fired and before the fire returned — and the resume reuses them: the page writer's tokens find their purchases, a token it changed is bought then, and a picture never written is stored and not charged", async () => {
  const b = buildBucket();
  const id = newId();
  const img = images({ hold: async (e) => { if (e.i === 0) { const t0 = Date.now(); while (!fire.at && Date.now() - t0 < 3000) await wait(5); e.fireSeen = !!fire.at; } } });
  const fire = { at: null, sawPhoto: false };
  await fireInterim(b, id, ledger(), {
    design: DESIGN, brief: BRIEF_MANY, env: { FAL_KEY: "k" }, over: img.over,
    // THE CONTAINER ACCEPTS THE PAGE WRITER'S CALL only once it has seen a
    // photograph being bought — with the old order (pictures after the pages)
    // that never happens while it waits.
    fire: async () => { fire.at = Date.now(); const t0 = Date.now(); while (!img.log.length && Date.now() - t0 < 3000) await wait(5); fire.sawPhoto = img.log.length > 0; },
  });
  assert.ok(fire.at, "the generation was never fired");
  assert.equal(fire.sawPhoto, true, "no photograph was being bought while the page generation was out");
  assert.equal(img.log[0].fireSeen, true, "the first purchase did not overlap the fire");
  assert.ok(img.log[0].at <= fire.at + 3000);
  // EVERY PURCHASE THE TASK BEGAN HAD ENDED BEFORE THE BUILD WAS HANDED ON.
  assert.equal(img.open(), 0);
  assert.equal(img.log.length, PICS.length, "provider purchases while the pages were written");
  assert.deepEqual(purchases(b, id).map((p) => p.state).sort(), PICS.map(() => "bought"));
  assert.equal(answerOf(b, id).status, 202, "the build did not hand on to its resume");
  // THE PAGE WRITER USED TWO OF THE DESIGN'S PICTURES WORD FOR WORD, LEFT ONE
  // OUT, CHANGED ONE.
  const written = [PICS[0], PICS[2], PICS[3], "a cup of coffee by the window"];
  await finishResume(b, id, ledger(), { credits: 400, env: { FAL_KEY: "k" }, source: pageOf(written), over: img.over });
  const body = answerOf(b, id).body;
  assert.equal(body.page, "app", JSON.stringify(body).slice(0, 300));
  // PROVIDER PURCHASES: the four the design named, then only the changed one.
  assert.equal(img.log.length, PICS.length + 1, "the resume bought a picture the build had already bought");
  assert.match(img.log[img.log.length - 1].prompt, promptOf("a cup of coffee by the window"));
  // STORED: one upload per purchase.
  assert.equal(uploads(b).length, PICS.length + 1);
  // PUBLISHED: every written token is a real picture, none left as a token.
  const src = published(b);
  assert.doesNotMatch(src, /@@IMG/);
  assert.equal(new Set(urlsIn(src)).size, 4, src.slice(0, 400));
  for (const section of ["Opening hours", "Tue–Sat 7–2", "Order loaves for Saturday collection.", "Wharf Street, Leeds"]) assert.ok(src.includes(section), "a requirement's section was lost: " + section);
  // CHARGED: the bill counts the pictures the page shows (`made`), not the one never written.
  assert.equal(body.images.made, 4);
  assert.equal(body.images.alongside, 1);
  const shop = body.images.pictures.find((p) => p.describe === PICS[1]);
  assert.equal(shop.status, "made");
  assert.notEqual(shop.stage, "published", "a picture no page shows was told as on the site");
  for (const d of [PICS[0], PICS[2], PICS[3]]) assert.equal(body.images.pictures.find((p) => p.describe === d).stage, "published", d);
  // AND WHAT THE MODEL-WRITTEN EXPLANATION IS GIVEN: the unused picture told as stored and not on the site.
  const facts = buildReplyFacts(body.buildFacts).facts.map((f) => f.text || f).join("\n");
  assert.match(facts, /made and shown on a published page: “a loaf at dawn”; “hands shaping dough”; “the window counter with bread stacked high”/);
  assert.match(facts, /made and stored, but not on any page that was published, so they are not on the site: “the shop front on a wet morning”/);
});

test("BLD 2 — REQUIRED ORDER AND NOTHING LOST: the build is not handed on while a photograph it began is still being bought (the resume record is written after the last purchase ended); the resume's image step comes after the pages and before the compile, so the published page holds every result — each picture, each requirement's section — and no token", async () => {
  const id = newId();
  const order = [];
  const img = images({ hold: async (e) => { if (e.i === 1) await wait(150); } });
  const b = buildBucket({}, { beforePut: (k) => { if (k === resumeKey(id)) order.push({ what: "resume", open: img.open(), purchases: img.log.length }); } });
  await fireInterim(b, id, ledger(), { design: DESIGN, brief: BRIEF_MANY, env: { FAL_KEY: "k" }, over: img.over });
  const at = order.find((o) => o.what === "resume");
  assert.ok(at, "no resume record was written");
  assert.equal(at.open, 0, "the build was handed on while a purchase it began was in flight");
  assert.equal(at.purchases, PICS.length);
  await finishResume(b, id, ledger(), { credits: 400, env: { FAL_KEY: "k" }, source: pageOf(PICS), over: img.over });
  const body = answerOf(b, id).body;
  assert.equal(body.page, "app");
  assert.equal(img.log.length, PICS.length, "a picture was bought twice");
  const src = published(b);
  assert.doesNotMatch(src, /@@IMG/, "a token reached the published page: the image step did not run before the compile");
  assert.equal(new Set(urlsIn(src)).size, PICS.length);
  for (const d of PICS) {
    const p = body.images.pictures.find((x) => x.describe === d);
    assert.equal(p && p.status, "made", d);
    assert.equal(p.stage, "published", d);
  }
  for (const section of ["Opening hours", "Tue–Sat 7–2", "Order loaves for Saturday collection.", "Wharf Street, Leeds"]) assert.ok(src.includes(section), section);
  assert.equal(body.images.made, PICS.length);
  assert.equal(body.images.alongside, undefined);
});

test("BLD 3 — DURABLE ACROSS A RETRY: the build's first run is delivered again after its photographs were bought (a redelivery, as after a crash) — the second run designs again and buys NOTHING: every picture is the build's recorded purchase; the resume then buys none either", async () => {
  const b = buildBucket();
  const id = newId();
  const img = images();
  await fireInterim(b, id, ledger(), { design: DESIGN, brief: BRIEF_MANY, env: { FAL_KEY: "k" }, over: img.over });
  assert.equal(img.log.length, PICS.length);
  await fireInterim(b, id, ledger(), { design: DESIGN, brief: BRIEF_MANY, env: { FAL_KEY: "k" }, over: img.over });
  assert.equal(img.log.length, PICS.length, "the retried run bought the pictures again");
  await finishResume(b, id, ledger(), { credits: 400, env: { FAL_KEY: "k" }, source: pageOf(PICS), over: img.over });
  assert.equal(answerOf(b, id).body.page, "app");
  assert.equal(img.log.length, PICS.length);
  assert.equal(uploads(b).length, PICS.length);
});

test("BLD 4 — A PURCHASE WHOSE BUYER DIED WITH ITS PHOTOGRAPH STORED: the resume finds it by its tag and uses it; one whose outcome nobody can tell is NOT bought again — its token is left as the placeholder and told as unconfirmed, every other result kept", async () => {
  const b = buildBucket();
  const id = newId();
  const img = images();
  await fireInterim(b, id, ledger(), { design: DESIGN, brief: BRIEF_MANY, env: { FAL_KEY: "k" }, over: img.over });
  const recs = [...b.store.keys()].filter((k) => k.startsWith("source/" + SLUG + "/purchases/build-" + id + "/"));
  assert.equal(recs.length, PICS.length);
  // ONE RECORD SET BACK TO `buying` WITH ITS PHOTOGRAPH STORED (its buyer died
  // after the store), ONE SET BACK WITH NOTHING STORED (it died inside the purchase).
  const byD = new Map(recs.map((k) => [JSON.parse(b.store.get(k)).d, k]));
  const landed = JSON.parse(b.store.get(byD.get(PICS[0])));
  b.store.set(byD.get(PICS[0]), JSON.stringify({ ...landed, state: "buying", url: undefined }));
  const lost = JSON.parse(b.store.get(byD.get(PICS[1])));
  const lostFile = uploads(b).find((k) => lost.url.endsWith(k.split("/").pop()));
  b.store.delete(lostFile);
  b.store.set(byD.get(PICS[1]), JSON.stringify({ ...lost, state: "buying", url: undefined }));
  await finishResume(b, id, ledger(), { credits: 400, env: { FAL_KEY: "k" }, source: pageOf(PICS), over: img.over });
  const body = answerOf(b, id).body;
  assert.equal(body.page, "app");
  assert.equal(img.log.length, PICS.length, "a purchase was bought again");
  assert.equal(JSON.parse(b.store.get(byD.get(PICS[0]))).state, "bought", "the landed purchase was not found by its tag");
  const src = published(b);
  assert.equal(new Set(urlsIn(src)).size, PICS.length - 1);
  assert.equal(body.images.made, PICS.length - 1, "the customer would be charged for a picture they did not get");
  assert.deepEqual(body.images.unconfirmed, [PICS[1]]);
  // TOLD AS WHAT IT IS: a purchase that could not be confirmed, never bought again.
  assert.deepEqual(body.images.pictures.find((p) => p.describe === PICS[1]), { page: "/", describe: PICS[1], status: "unknown", why: "purchase-unconfirmed" });
  for (const section of ["Opening hours", "Wharf Street, Leeds"]) assert.ok(src.includes(section), section);
  assert.match(buildReplyFacts(body.buildFacts).facts.map((f) => f.text || f).join("\n"), /could not be confirmed either way; they were not bought a second time.*“the shop front on a wet morning”/);
});

test("BLD 5 — CONTROL: a balance that cannot cover the pages and the pictures together buys nothing beside the pages; the pictures are bought after them, as before, and the build publishes", async () => {
  const b = buildBucket();
  const id = newId();
  const img = images();
  await fireInterim(b, id, ledger(), { design: DESIGN, brief: BRIEF_MANY, env: { FAL_KEY: "k" }, over: img.over, credits: 40 });
  assert.equal(img.log.length, 0, "photographs were bought beside the pages against a balance held for the pages");
  await finishResume(b, id, ledger(), { credits: 400, env: { FAL_KEY: "k" }, source: pageOf(PICS), over: img.over });
  const body = answerOf(b, id).body;
  assert.equal(body.page, "app");
  assert.ok(img.log.length >= 1);
  assert.equal(body.images.made, img.log.length);
});

/** Every upload write to ONE photograph's key fails `times` times (the first upload key written takes them all). */
function failStoreOf(b, times) {
  const put0 = b.put.bind(b);
  let target = null;
  const seen = { failed: 0 };
  b.put = async (k, ...rest) => {
    if (k.startsWith("uploads/" + SLUG + "/") && (target === null || target === k) && seen.failed < times) { target = k; seen.failed++; throw new Error("r2 unavailable"); }
    return put0(k, ...rest);
  };
  return seen;
}

test("BLD 6 — MADE, NOT STORED, BESIDE THE PAGES (round 4): one photograph's store fails on every try of the photo task — its record keeps the made picture's source (`generated`), the build is handed on with nothing in flight, and the resume's image step stores THAT picture: four provider calls in all, every picture on the page, charged for four", async () => {
  const b = buildBucket();
  const id = newId();
  const img = images();
  const fault = failStoreOf(b, 3);
  await fireInterim(b, id, ledger(), { design: DESIGN, brief: BRIEF_MANY, env: { FAL_KEY: "k" }, over: img.over });
  assert.equal(fault.failed, 3, "the store did not fail as set up");
  assert.equal(img.log.length, PICS.length, "provider calls beside the pages");
  assert.equal(img.open(), 0);
  const states = purchases(b, id).map((p) => p.state).sort();
  assert.deepEqual(states, ["bought", "bought", "bought", "generated"], "a picture made and not stored was not kept as generated");
  const gen = purchases(b, id).find((p) => p.state === "generated");
  assert.match(gen.source, /^https:\/\/img\.test\/p\d\.jpg$/);
  assert.equal(uploads(b).length, PICS.length - 1);
  await finishResume(b, id, ledger(), { credits: 400, env: { FAL_KEY: "k" }, source: pageOf(PICS), over: img.over });
  const body = answerOf(b, id).body;
  assert.equal(body.page, "app", JSON.stringify(body).slice(0, 300));
  // PROVIDER: no picture asked for twice. ASSET: the generated one stored by
  // the image step. TASK: every picture made and published. ACCOUNTING: the
  // bill counts the four shown.
  assert.equal(img.log.length, PICS.length, "the image step asked for a new picture instead of storing the made one");
  assert.equal(uploads(b).length, PICS.length);
  assert.deepEqual(purchases(b, id).map((p) => p.state), PICS.map(() => "bought"));
  assert.equal(new Set(urlsIn(published(b))).size, PICS.length);
  for (const d of PICS) assert.equal(body.images.pictures.find((x) => x.describe === d).status, "made", d);
  assert.equal(body.images.made, PICS.length);
  assert.equal(body.images.unconfirmed, undefined);
});

test("BLD 7 — THE IMAGE STEP MEETS PURCHASES STILL IN FLIGHT (the recorded untested case): nothing bought beside the pages in the first run (balance held for the pages), the resume's photo task begins all four and they are held; the image step waits for each — none read as unknown, none bought a second time — and every picture is placed", async () => {
  const b = buildBucket();
  const id = newId();
  let release;
  const gateP = new Promise((ok) => { release = ok; });
  const img = images({ hold: async () => { await gateP; } });
  await fireInterim(b, id, ledger(), { design: DESIGN, brief: BRIEF_MANY, env: { FAL_KEY: "k" }, over: img.over, credits: 40 });
  assert.equal(img.log.length, 0, "the first run bought beside the pages against a balance held for them");
  // THE HOLD IS LIFTED ONLY ONCE THE IMAGE STEP IS WAITING: every purchase the
  // resume's task began is in flight, and the build's image step has reached
  // them (nothing else would be waiting on the image service).
  const opened = (async () => {
    const t0 = Date.now();
    while (img.open() < PICS.length && Date.now() - t0 < 5000) await wait(5);
    const seenOpen = img.open();
    await wait(120);
    release();
    return seenOpen;
  })();
  await finishResume(b, id, ledger(), { credits: 400, env: { FAL_KEY: "k" }, source: pageOf(PICS), over: img.over });
  assert.equal(await opened, PICS.length, "the resume's photo task did not have all four in flight");
  const body = answerOf(b, id).body;
  assert.equal(body.page, "app", JSON.stringify(body).slice(0, 300));
  assert.equal(img.log.length, PICS.length, "a purchase in flight was bought a second time");
  assert.equal(img.open(), 0);
  assert.equal(body.images.unconfirmed, undefined, "a purchase in flight was read as unknown instead of waited for");
  assert.equal(new Set(urlsIn(published(b))).size, PICS.length);
  for (const d of PICS) assert.equal(body.images.pictures.find((x) => x.describe === d).status, "made", d);
  assert.equal(body.images.made, PICS.length);
  assert.deepEqual(purchases(b, id).map((p) => p.state), PICS.map(() => "bought"));
});

test("BLD 8 — NO IMAGE KEY, NO CALL: a build without the image service's key never asks it — nothing leaves, each purchase ends `none` (refused before sending), and the build publishes with its placeholders", async () => {
  const b = buildBucket();
  const id = newId();
  const img = images();
  await fireInterim(b, id, ledger(), { design: DESIGN, brief: BRIEF_MANY, over: img.over });
  assert.equal(img.log.length, 0, "the image service was asked without a key");
  assert.deepEqual(purchases(b, id).map((p) => p.state), PICS.map(() => "none"));
  assert.ok(purchases(b, id).every((p) => p.why === "refused"));
  await finishResume(b, id, ledger(), { credits: 400, source: pageOf(PICS), over: img.over });
  assert.equal(img.log.length, 0);
  assert.equal(answerOf(b, id).body.page, "app");
  assert.equal(answerOf(b, id).body.images.made, 0);
});

test("BLD 9 — THE COMPILE'S READY INPUTS BESIDE THE PHOTOGRAPHS (round 5): the first run hands its page writing on WITHOUT fetching fonts (it never compiles); the resume asks for the fonts and the French translation WHILE its photographs are still being bought, and the compile uses that one answer — one fonts fetch, one translation call, every picture placed", async () => {
  const b = buildBucket();
  const id = newId();
  const seen = { fonts: [], translate: [], fontsInFirst: 0 };
  let release;
  const gateP = new Promise((ok) => { release = ok; });
  const img = images({ hold: async () => { await gateP; } });
  const design = { ...DESIGN, lang: "en", langs: ["fr"], css: 'body{font-family:"Cormorant Garamond",serif}' };
  const over = (phase) => async (u, init) => {
    if (u.startsWith("https://api.fontsource.org/")) {
      seen.fonts.push({ phase, ended: img.log.filter((e) => e.end != null).length });
      return new Response("not here", { status: 404 });
    }
    if (u.includes("/v1/messages")) {
      let bd = {};
      try { bd = JSON.parse(String((init && init.body) || "{}")); } catch { bd = {}; }
      if (bd.tool_choice && bd.tool_choice.name === "write_translation") {
        const text = String((bd.messages && bd.messages[0] && bd.messages[0].content) || "");
        const strings = JSON.parse(text.slice(text.indexOf("Strings:\n") + "Strings:\n".length));
        seen.translate.push({ phase, ended: img.log.filter((e) => e.end != null).length, n: strings.length });
        return json({ stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: "tool_use", id: "tr1", name: "write_translation", input: { strings: strings.map((x) => "FR " + x) } }] });
      }
    }
    return img.over(u, init);
  };
  await fireInterim(b, id, ledger(), { design, brief: BRIEF_MANY, env: { FAL_KEY: "k" }, over: over("first"), credits: 40 });
  assert.equal(seen.fonts.length, 0, "the first run fetched fonts it never uses before handing its page writing on");
  assert.equal(answerOf(b, id).status, 202, "the first run did not hand on to its resume");
  // THE HOLD LIFTS ONCE BOTH COMPILE INPUTS WERE ASKED FOR (or after 3s, so the old order fails rather than hangs).
  const lifted = (async () => {
    const t0 = Date.now();
    while (!(seen.fonts.length && seen.translate.length) && Date.now() - t0 < 3000) await wait(5);
    await wait(20);
    release();
  })();
  await finishResume(b, id, ledger(), { credits: 400, env: { FAL_KEY: "k", ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k" }, source: pageOf(PICS), over: over("resume") });
  await lifted;
  const body = answerOf(b, id).body;
  assert.equal(body.page, "app", JSON.stringify(body).slice(0, 300));
  assert.equal(seen.fonts.length, 1, "fonts fetched: " + JSON.stringify(seen.fonts));
  // ASKED BEFORE ANY PHOTOGRAPH'S PURCHASE HAD ENDED — the purchases are held
  // until both were asked for, so these ran beside them, not after.
  assert.equal(seen.fonts[0].ended, 0, "the fonts were fetched after a photograph's purchase had ended");
  assert.equal(seen.translate.length, 1, "the translation was asked again at the compile: " + JSON.stringify(seen.translate));
  assert.equal(seen.translate[0].ended, 0, "the translation was asked after a photograph's purchase had ended (at the compile)");
  assert.equal(img.log.length, PICS.length);
  assert.equal(new Set(urlsIn(published(b))).size, PICS.length);
  assert.equal(img.open(), 0);
});

// ── THE BUILD'S LIVE LINES (round 5) ────────────────────────────────────────
//
// The progress writer and the job row, stood in for: the row names the run the
// record holds as its lease (the build still running), and the writer answers
// each fact as given, so a case reads which facts a line covered — the facts
// are the build's; the wording would be a model's.
function progressStand(b, id) {
  const written = [];
  const recOf = () => { const raw = b.store.get(progressKey(id)); return raw ? JSON.parse(raw) : null; };
  const over = async (u, init) => {
    if (u.includes("/rest/v1/edit_jobs?select=id,uid,state,lease_owner")) {
      const rec = recOf();
      return json([{ id, uid: BUILD_USER.id, state: "running", lease_owner: rec ? rec.run : "none", lease_expires_at: new Date(Date.now() + 60000).toISOString(), cancel_requested_at: null, needs_review: false, op: "build" }]);
    }
    // EITHER PROVIDER'S WIRE: the writer is the picked model's quick one.
    const anthropic = u.includes("/v1/messages");
    if (anthropic || u.includes("/v1/chat/completions")) {
      let bd = {};
      try { bd = JSON.parse(String((init && init.body) || "{}")); } catch { bd = {}; }
      const asked = (bd.tool_choice && (bd.tool_choice.name || (bd.tool_choice.function && bd.tool_choice.function.name))) || "";
      if (asked === "write_progress") {
        const text = (bd.messages || []).filter((m) => m && m.role === "user").map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
        const facts = [...text.matchAll(/^\[(f\d+)\] \(([a-z]+)\) (.*)$/gm)].map((m) => ({ id: m[1], state: m[2], text: m[3] }));
        written.push(facts);
        const input = { text: "MODEL: " + facts.map((f) => f.text).join(" "), says: facts.map((f) => ({ id: f.id, as: f.state })) };
        return json(anthropic
          ? { stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: "tool_use", id: "p1", name: "write_progress", input }] }
          : { choices: [{ message: { content: "", tool_calls: [{ id: "c1", function: { name: asked, arguments: JSON.stringify(input) } }] }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 10 } });
      }
    }
    return null;
  };
  return { written, recOf, over };
}
const taskQueue = () => ({ sent: [], async send(m) { this.sent.push(m); }, async sendBatch() { throw new Error("no batch"); } });
const PROGRESS_ENV = { PROGRESS_REPLIES: "on", SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k" };
/** Every progress task the build queued, delivered through the real consumer until none is left — the browser plays no part. */
async function deliverProgress(b, q, stand, { install = true } = {}) {
  for (let round = 0; round < 6; round++) {
    const tasks = q.sent.filter((m) => m && m.kind === "edit-progress");
    q.sent = q.sent.filter((m) => !(m && m.kind === "edit-progress"));
    if (!tasks.length) return;
    // WHILE A BUILD RUN IS STILL GOING (\`install: false\`), its own stand-in
    // answers — it carries this one — and is never swapped out under it.
    const prior = globalThis.fetch;
    if (install) globalThis.fetch = async (input, init) => {
      const u = String((input && input.url) || input || "");
      const r = await stand.over(u, init);
      if (r) return r;
      if (u.includes("/rest/v1/")) return json([]);
      noteUnexpected((init && init.method) || "GET", u, "build-parallel");
      return new Response("no", { status: 503 });
    };
    try {
      const worker = await loadWorker();
      const ctx = makeCtx();
      await worker.queue({ messages: tasks.map((t) => ({ body: t, ack() {}, retry() {} })) }, { ...PROGRESS_ENV, SITES_BUCKET: b, BUILD_QUEUE: q }, ctx);
      for (let i = 0; i < 8 && ctx.pending.length; i++) await Promise.allSettled(ctx.pending.splice(0));
    } finally { globalThis.fetch = install ? blockedFetch : prior; }
  }
}
async function pollBuild(b, id) {
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    if (u.includes("/auth/v1/user")) return json(BUILD_USER);
    if (u.includes("/rest/v1/")) return json([]);
    noteUnexpected("GET", u, "build-parallel");
    return new Response("no", { status: 503 });
  };
  try {
    const worker = await loadWorker();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/build/" + id, { headers: { Authorization: "Bearer t" } }), { ...PROGRESS_ENV, SITES_BUCKET: b }, makeCtx());
    return { status: res.status, body: await res.json().catch(() => null) };
  } finally { globalThis.fetch = blockedFetch; }
}
const allFacts = (rec) => rec.marks.flatMap((m) => m.facts.map((f) => ({ stage: m.stage, ...f })));
/** NO PREPARATION SAID AS PUBLISHED: a fact naming publication says it is not published yet, or that the check comes before it. */
function noPublishClaim(facts) {
  for (const f of facts) {
    if (!/publish/i.test(f.text)) continue;
    assert.match(f.text, /not published|before it is published/i, "a build fact claims publication: " + f.text);
  }
  assert.ok(!facts.some((f) => f.state === "applied"), "a build fact was stated as applied: " + JSON.stringify(facts));
}

test("BLD 10 — MODEL-WRITTEN BUILD PROGRESS FROM ITS REAL STEPS (round 5): the first run opens the build's record when its site is named and marks what it really did — designed, the photographs started beside the pages, the page writing out; the writer turns them into lines with the browser closed; the poll hands them over; the resume takes the record over under its own lease, says it RECOVERED the made-but-unsaved photograph instead of buying it again, says the compile comes before publication, and closes the record — no fact ever says anything is published", async () => {
  const b = buildBucket();
  const id = newId();
  const img = images();
  const stand = progressStand(b, id);
  const both = async (u, init) => (await stand.over(u, init)) || img.over(u, init);
  const fault = failStoreOf(b, 3);
  const q = await fireInterim(b, id, ledger(), { design: DESIGN, brief: BRIEF_MANY, env: { FAL_KEY: "k", PROGRESS_REPLIES: "on" }, over: both });
  assert.equal(fault.failed, 3, "the store did not fail as set up");
  const first = stand.recOf();
  assert.ok(first, "the first run opened no progress record");
  assert.equal(first.op, "build");
  assert.equal(first.slug, SLUG);
  const stages1 = first.marks.map((m) => m.stage);
  for (const s of ["build-design", "build-photos-alongside", "build-fired"]) assert.ok(stages1.includes(s), "missing " + s + " in " + stages1.join(","));
  assert.ok(stages1.indexOf("build-design") < stages1.indexOf("build-fired"), "the milestones are out of order: " + stages1.join(","));
  assert.ok(!first.closed, "the first run closed a record its resume carries on: " + JSON.stringify(first.closed));
  assert.match(allFacts(first).find((f) => f.stage === "build-photos-alongside").text, /4 photographs/);
  noPublishClaim(allFacts(first));
  // THE WRITER, WITH THE BROWSER CLOSED: the tasks the build queued, delivered.
  await deliverProgress(b, q, stand);
  const afterFirst = stand.recOf();
  assert.ok(afterFirst.lines.length >= 1, "no line was written for the first run's milestones");
  assert.ok(afterFirst.lines.every((l) => /^MODEL: /.test(l.text)), "a line is not the writer's own");
  const said = stand.written.flat().map((f) => f.text);
  assert.ok(said.some((t) => /Designed the site/.test(t)), "the writer was not told the design: " + said.join(" | "));
  // THE POLL: the stored hand-on answer carries the lines; so does the next look.
  const p1 = await pollBuild(b, id);
  assert.equal(p1.status, 202);
  assert.ok(Array.isArray(p1.body.progress) && p1.body.progress.length >= 1, "the poll's 202 carried no lines: " + JSON.stringify(p1.body).slice(0, 300));
  assert.ok(p1.body.progress.every((l) => /^MODEL: /.test(l.text || l)), JSON.stringify(p1.body.progress));
  const p2 = await pollBuild(b, id);
  assert.equal(p2.status, 202);
  assert.ok(Array.isArray(p2.body.progress) && p2.body.progress.length >= 1, "the pending look carried no lines: " + JSON.stringify(p2.body).slice(0, 300));
  // THE RESUME TAKES THE RECORD OVER and carries the lines on.
  const rq = taskQueue();
  await finishResume(b, id, ledger(), { credits: 400, env: { FAL_KEY: "k", PROGRESS_REPLIES: "on", ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", BUILD_QUEUE: rq }, source: pageOf(PICS), over: both });
  const body = answerOf(b, id).body;
  assert.equal(body.page, "app", JSON.stringify(body).slice(0, 300));
  assert.equal(img.log.length, PICS.length, "a picture was bought twice");
  const last = stand.recOf();
  assert.notEqual(last.run, first.run, "the resume did not take the record over under its own lease");
  assert.equal(last.marks.length > first.marks.length, true, "the resume added no milestone");
  const stages2 = last.marks.slice(first.marks.length).map((m) => m.stage);
  assert.ok(stages2.includes("build-photo-recovered"), "the recovery was not said: " + stages2.join(","));
  assert.ok(stages2.includes("build-compile"), "the compile was not said: " + stages2.join(","));
  assert.match(allFacts(last).find((f) => f.stage === "build-photo-recovered").text, /Recovered a photograph .* instead of buying it again/);
  assert.ok(last.closed, "the resume did not close the record at the build's end");
  noPublishClaim(allFacts(last));
});

test("BLD 11 — WAITING FOR A DEPENDENCY, SAID WHILE IT WAITS (round 5): the resume's image step meets photographs still being bought; the record says the pages are written and it is waiting for those four — written by the model while the purchases are still held — and only then are they released", async () => {
  const b = buildBucket();
  const id = newId();
  let release;
  const gateP = new Promise((ok) => { release = ok; });
  const img = images({ hold: async () => { await gateP; } });
  const stand = progressStand(b, id);
  const both = async (u, init) => (await stand.over(u, init)) || img.over(u, init);
  const q = await fireInterim(b, id, ledger(), { design: DESIGN, brief: BRIEF_MANY, env: { FAL_KEY: "k", PROGRESS_REPLIES: "on" }, over: both, credits: 40 });
  assert.equal(img.log.length, 0);
  await deliverProgress(b, q, stand);
  const rq = taskQueue();
  // HELD UNTIL THE WAIT IS ON THE RECORD AND THE WRITER HAS PUT IT INTO WORDS (or 4s, so a missing mark fails rather than hangs).
  let waitLine = null;
  const watcher = (async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 4000) {
      const rec = stand.recOf();
      const m = rec && rec.marks.find((x) => x.stage === "build-photos-wait");
      if (m) {
        await deliverProgress(b, rq, stand, { install: false });
        const now = stand.recOf();
        waitLine = now.lines.find((l) => /Waiting for 4 photographs/.test(l.text)) || null;
        if (waitLine) break;
      }
      await wait(10);
    }
    release();
  })();
  await finishResume(b, id, ledger(), { credits: 400, env: { FAL_KEY: "k", PROGRESS_REPLIES: "on", ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", BUILD_QUEUE: rq }, source: pageOf(PICS), over: both });
  await watcher;
  assert.ok(waitLine, "no model line said the build was waiting for its photographs while they were held");
  const rec = stand.recOf();
  const wf = allFacts(rec).find((f) => f.stage === "build-photos-wait");
  assert.equal(wf.state, "doing");
  assert.match(wf.text, /The pages are written\. Waiting for 4 photographs still being bought/);
  assert.equal(answerOf(b, id).body.page, "app");
  assert.equal(img.log.length, PICS.length);
  assert.ok(rec.closed);
  noPublishClaim(allFacts(rec));
});

test("BLD 12 — A BUILD'S PROGRESS MESSAGE LOST, FOUND BY THE SWEEP (round 5): the first run's milestones wait and the message that would have asked for their writer never arrives; once the ask's grace has passed, the two-minute progress sweep reads the build's running row and asks again, and the lines are written — with no page open", async () => {
  const b = buildBucket();
  const id = newId();
  const img = images();
  const stand = progressStand(b, id);
  const both = async (u, init) => (await stand.over(u, init)) || img.over(u, init);
  const q = await fireInterim(b, id, ledger(), { design: DESIGN, brief: BRIEF_MANY, env: { FAL_KEY: "k", PROGRESS_REPLIES: "on" }, over: both, credits: 40 });
  // THE MESSAGE IS LOST, and the ask's grace runs out.
  q.sent = q.sent.filter((m) => !(m && m.kind === "edit-progress"));
  const rec = stand.recOf();
  assert.ok(rec && rec.marks.length > 0 && rec.lines.length === 0, "the case needs milestones waiting with no line");
  b.store.set(progressKey(id), JSON.stringify({ ...rec, asked: Date.now() - 60 * 60 * 1000 }));
  // THE SWEEP: the job table lists the build as running.
  const sq = taskQueue();
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (u.includes("/rest/v1/edit_jobs?select=id,uid,op,state&op=in.(") && u.includes("state=not.in.")) return json([{ id, uid: BUILD_USER.id, op: "build", state: "running" }]);
    if (u.includes("/rest/v1/edit_jobs?select=id,uid,op,state&op=in.(")) return json([]);
    const r = await stand.over(u, init);
    if (r) return r;
    noteUnexpected((init && init.method) || "GET", u, "build-parallel");
    return new Response("no", { status: 503 });
  };
  try {
    const mod = await loadWorkerModule();
    await mod.runProgressSweep({ ...PROGRESS_ENV, SITES_BUCKET: b, BUILD_QUEUE: sq });
  } finally { globalThis.fetch = blockedFetch; }
  assert.equal(sq.sent.filter((m) => m && m.kind === "edit-progress" && m.id === id).length, 1, "the sweep did not ask for the build's writer");
  await deliverProgress(b, sq, stand);
  assert.ok(stand.recOf().lines.length >= 1, "no line was written after the sweep's ask");
});

test("BLD 13 — THE PHOTO SERVICE REFUSES EVERY PICTURE (an empty balance, 2026-10-10): the build still publishes its pages with the frames left empty; its live lines are told, from the purchase's own result, that the four photographs were not made — never placed — and every line after that is told they are still not made; nothing is made, so nothing is billed (`made` 0)", async () => {
  const b = buildBucket();
  const id = newId();
  const img = images({ refuse: true });
  const stand = progressStand(b, id);
  const both = async (u, init) => (await stand.over(u, init)) || img.over(u, init);
  await fireInterim(b, id, ledger(), { design: DESIGN, brief: BRIEF_MANY, env: { FAL_KEY: "k", PROGRESS_REPLIES: "on" }, over: both });
  const rq = taskQueue();
  await finishResume(b, id, ledger(), { credits: 400, env: { FAL_KEY: "k", PROGRESS_REPLIES: "on", ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", BUILD_QUEUE: rq }, source: pageOf(PICS), over: both });
  const body = answerOf(b, id).body;
  assert.equal(body.page, "app", JSON.stringify(body).slice(0, 300));
  assert.equal(body.images.made, 0);
  assert.ok(img.log.length >= 1, "the image service was never asked");
  assert.equal(uploads(b).length, 0, "a refused picture was stored");
  assert.ok(!published(b).includes("@@IMG"), "a token was left in the published pages");
  assert.match(published(b), /Opening hours/, "the pages were not published");
  const rec = stand.recOf();
  const facts = allFacts(rec);
  const missing = facts.find((f) => f.stage === "build-photos-missing");
  assert.ok(missing, "the photographs not made were not said: " + rec.marks.map((m) => m.stage).join(","));
  assert.equal(missing.state, "notdone");
  assert.equal(missing.text, "4 photographs could not be made, so their places on the pages are left empty.");
  assert.ok(!facts.some((f) => f.stage === "build-photos-joined" && f.state === "prepared"), "a photograph was said placed: " + JSON.stringify(facts.filter((f) => /Placed/.test(f.text))));
  const stages = rec.marks.map((m) => m.stage);
  assert.ok(stages.indexOf("build-photos-missing") < stages.indexOf("build-compile"), "the compile milestone does not come after: " + stages.join(","));
  // EVERY LINE AFTER IT, AS THE WRITER WOULD BE ASKED: still not made.
  const { texts } = replayLines(rec);
  const { at, later } = afterNotMade(texts, missing);
  assert.ok(at >= 0 && later.length >= 1, "no line after the not-made fact: the check would be empty");
  for (const t of later) assert.match(t.split("WHAT HAS HAPPENED SINCE")[0], /STILL NOT MADE IN THIS WORK[^]*4 photographs could not be made/, t);
  noPublishClaim(facts);
});

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});

void BRIEF;
void clearUnexpected;
