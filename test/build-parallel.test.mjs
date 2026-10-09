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
import { blockNetwork, unexpected, clearUnexpected } from "./fixtures/no-network.mjs";

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

/** The image service, stood in for: every purchase logged with when it began and ended; `hold(i)` may delay one. */
function images({ hold = null } = {}) {
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

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});

void BRIEF;
void clearUnexpected;
