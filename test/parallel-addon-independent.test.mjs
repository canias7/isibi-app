// INDEPENDENT TASKS RUN AT THE SAME TIME; ONLY WHAT NEEDS ANOTHER'S RESULT
// WAITS (2026-10-11, the parallel-work goal, after Codex's check of ecb7484a).
//
// The owner: *"when a user requests independent tasks — for example, generate
// an image and create a component — both should actively run at the same
// time. Only work that genuinely needs another task's result should wait."*
// Codex found it partly built: inside an addition the designers ran one after
// another, the page writer was awaited and the photographs were bought only
// after it; and between request parts an image-first request kept the
// component's addition waiting, because the planner took an addition to read
// every page and picture, while the reverse order overlapped.
//
// THE EVIDENCE IS A RENDEZVOUS, never a status or a routing answer: each of
// two independent calls is held until the other has STARTED (`meet`), with a
// time limit, so a schedule that runs them one after the other cannot pass —
// the first waits out the limit and records that it met no one. Then both
// final results are checked on the site, and the purchases, the model work and
// the charges are counted.
//
// Through the real request driver, queue consumer, routes and job runner, with
// supplied model answers and a stand-in image service; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, deliver, call, tick, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc, SOURCE_KEY, PARTS_KEY } from "./fixtures/live-ask.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { addonScope, stepInputs, clearToPrepare } from "../builder/request-plan.mjs";

blockNetwork();

const slugOf = (k) => "pi-" + k + "-" + Math.random().toString(16).slice(2, 8);
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

/**
 * TWO (OR MORE) CALLS THAT MAY ONLY FINISH ONCE ALL HAVE STARTED. `arrive(name)`
 * resolves `true` when every name has arrived, or `false` after `ms` — so a
 * sequential schedule records the miss instead of hanging. Only the first
 * arrival under each name waits; a later one (a replay, a retry) passes.
 */
function rendezvous(names, ms = 2500) {
  const at = {};
  const met = {};
  let open;
  const all = new Promise((r) => { open = r; });
  return {
    at, met,
    async arrive(name) {
      if (Object.hasOwn(at, name)) return true;
      at[name] = Date.now();
      if (names.every((n) => Object.hasOwn(at, n))) open();
      met[name] = await Promise.race([all.then(() => true), new Promise((r) => setTimeout(() => r(false), ms))]);
      return met[name];
    },
  };
}

const BENCH = "the workshop bench under the window, warm afternoon light";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>Open from 8.</p></section>");
const ABOUT = pageSrc("/about", "<section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }, { path: "about.tsx", source: ABOUT }];
const VISIT_WITH_PHOTO = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { SafeImage } from '@/components/safe-image'\n"
  + "export const Route = createFileRoute('/visit')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"come\"><h1>Come to the bakery</h1><p>Open from 8.</p><SafeImage src=\"@@IMG:" + BENCH + "@@\" alt=\"the workshop bench\" ratio=\"4/3\" /></section></main> }\n";
const ABOUT_WITH_FAQ = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { Card } from '@/components/ui/card'\n"
  + "export const Route = createFileRoute('/about')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section><section className=\"faq\"><Card><h2>Questions</h2><p>Do you deliver? Yes, on Fridays.</p></Card></section></main> }\n";

const PHOTO_ANSWER = { photo: [{ page: "/visit", describe: BENCH, name: "bench" }] };
const COMPONENT_ANSWER = { component: [{ page: "/about", where: "after the story", does: "answers common questions", components: ["card"] }] };
const statuses = (rec) => rec.parts.map((p) => p.status);
const uploads = (P) => [...P.objects.keys()].filter((k) => k.startsWith("uploads/" + P.slug + "/"));
const designCalls = (P) => P.modelLog.filter((m) => m.tool === T.design).length;
const pageCalls = (P) => P.modelLog.filter((m) => m.tool === T.pages).length;

// ── ONE ADDITION HOLDING BOTH TASKS ─────────────────────────────────────────

test("PI 1 — ONE ADDITION, A PHOTOGRAPH AND A COMPONENT: the two designers run at the same time, and the photograph is bought while the pages are written; the photograph is placed only once both exist — both on the site, bought once, the designers and the page writer asked once", async () => {
  const designers = rendezvous(["add:photo", "add:component"]);
  const work = rendezvous(["image", "pages"]);
  await withPlatform({
    slug: slugOf("b1"), pages: PAGES, images: true, replies: true, balance: 400,
    imageWith: async () => { await work.arrive("image"); return null; },
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["component", "photo"] },
      "add:photo": async () => { await designers.arrive("add:photo"); return PHOTO_ANSWER; },
      "add:component": async () => { await designers.arrive("add:component"); return COMPONENT_ANSWER; },
      [T.pages]: async () => { await work.arrive("pages"); return { pages: [{ path: "src/routes/visit.tsx", source: VISIT_WITH_PHOTO }, { path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] }; },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Add a photo of the workshop bench to the Visit page, and add a questions section to the About page." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    // AT THE SAME TIME, BY THE RENDEZVOUS.
    assert.deepEqual(designers.met, { "add:photo": true, "add:component": true }, "the designers ran one after the other: " + JSON.stringify(designers));
    assert.deepEqual(work.met, { image: true, pages: true }, "the photograph was not bought while the pages were written: " + JSON.stringify(work));
    // BOTH RESULTS, AND THE PHOTOGRAPH ATTACHED ONLY TO WHAT EXISTS.
    assert.match(P.page("visit.tsx"), /<SafeImage src=\{?"\/u\/[^"]+\.jpg"\}? alt="the workshop bench"/, P.page("visit.tsx"));
    assert.doesNotMatch(P.page("visit.tsx"), /@@IMG/);
    assert.ok(P.page("about.tsx").includes("Do you deliver?"), P.page("about.tsx"));
    // ONCE EACH.
    assert.equal(P.imageLog.length, 1, "the photograph was bought twice");
    assert.equal(uploads(P).length, 1);
    assert.equal(designCalls(P), 2);
    assert.equal(pageCalls(P), 1);
  });
});

// ── THE SAME TWO TASKS AS TWO PARTS OF ONE REQUEST, IN EITHER ORDER ─────────

const W_PHOTO = "add a photo of the workshop bench to the Visit page";
const W_FAQ = "add a questions section to the About page";
const textOf = (args) => JSON.stringify(args.messages || []);
// WHICH PART IS ASKING, from its own words only: every part's request also
// carries the whole message as context, so the whole text cannot tell them apart.
const ownWords = (args) => { const m = /Their message:\\n([^\\]*)/.exec(textOf(args)); return m ? m[1] : ""; };
const isFaq = (args) => /questions section/.test(ownWords(args));
// The page writer is told the photograph's token to place when, and only when,
// its part is the photograph's.
const writesPhoto = (args) => textOf(args).includes("@@IMG:" + BENCH);
const PHOTO_TARGETS = ["page:/visit", "images"];
const FAQ_TARGETS = ["page:/about", "new-component:faq"];
const viewOf = async (P, key) => { const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + key); assert.equal(v.status, 200, JSON.stringify(v.body)); return v.body.request; };
const prepUseOf = (view, n) => (view.parts[n].prepUse || [])[0] || null;

/**
 * Two parts, the first answered by the routing of the message and the second
 * held back and routed on its own. `hold` names the rendezvous each side meets
 * at: `photoAt` is the photograph's work (its purchase, or its designer), and
 * `faqAt` the component's (its designer, or its page writer).
 */
async function twoParts({ slug, first, meet, photoAt, faqAt, targets = null, twice = false, between = null, refuse = false, pages = PAGES, setup = null, faqParts = null, faqExtra = null, check }) {
  const photoFirst = first === "photo";
  const route0 = {
    intent: "addon",
    alsoAsked: [photoFirst ? W_FAQ : W_PHOTO],
    targets: targets || [{ change: 0, writes: photoFirst ? PHOTO_TARGETS : FAQ_TARGETS }, { change: 1, writes: photoFirst ? FAQ_TARGETS : PHOTO_TARGETS }],
  };
  await withPlatform({
    slug, pages, images: true, replies: true, balance: 400,
    imageWith: async () => {
      if (photoAt === "image") await meet.arrive("photo");
      // `refuse`: THE SERVICE REFUSES THE PICTURE, after the component's
      // preparation has run beside it.
      return refuse ? new Response(JSON.stringify({ detail: "refused" }), { status: 422, headers: { "content-type": "application/json" } }) : null;
    },
    answers: {
      route: (args, n) => (n === 0 ? route0 : { intent: "addon" }),
      [T.adds]: (args) => ({ kinds: isFaq(args) ? ["component"] : ["photo"] }),
      "add:photo": async () => { if (photoAt === "designer") await meet.arrive("photo"); return PHOTO_ANSWER; },
      "add:component": async () => { if (faqAt === "designer") await meet.arrive("faq"); return COMPONENT_ANSWER; },
      [T.pages]: async (args) => {
        // THE WRITER WRITES THE PAGE IT WAS SHOWN: a heading changed under it
        // (PI 6) is kept, as a real writer keeps what it was not asked about.
        if (!writesPhoto(args)) {
          if (faqAt === "pages") await meet.arrive("faq");
          const about = { path: "src/routes/about.tsx", source: textOf(args).includes("Our story so far") ? ABOUT_WITH_FAQ.replace("Our story", "Our story so far") : ABOUT_WITH_FAQ };
          const more = faqExtra ? faqExtra(args) : {};
          return { pages: [about, ...(more.pages || [])], ...(more.remove ? { remove: more.remove } : {}), ...(more.parts ? { parts: more.parts } : faqParts ? { parts: faqParts } : {}) };
        }
        return { pages: [{ path: "src/routes/visit.tsx", source: VISIT_WITH_PHOTO }] };
      },
    },
  }, async (P) => {
    if (setup) setup(P);
    const r = await sendMessage(P, { message: (photoFirst ? W_PHOTO + ", and " + W_FAQ : W_FAQ + ", and " + W_PHOTO) + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    // THE QUEUE RUNS ITS MESSAGES SIDE BY SIDE, as the real one does: the
    // first part's job and every preparation the driver asked for, delivered
    // at once — what overlaps is then only what the code let start.
    // `twice`: EVERY ONE OF THEM DELIVERED TWICE AT ONCE — the real queue's
    // at-least-once delivery, the job and the preparation each redelivered
    // while the first copy is still running.
    const first = P.queue.splice(0);
    const runs = first.flatMap((m) => (twice ? [m, { ...m, body: JSON.parse(JSON.stringify(m.body)) }] : [m]));
    await Promise.all(runs.map((m) => deliver(P, m)));
    if (between) await between(P, r);
    const { rec } = await settle(P, r.key);
    await check(P, rec, r, await viewOf(P, r.key));
  });
}
// THE SECOND PART'S JOB TOOK ITS PREPARATION'S ANSWERS EXACTLY: every model
// call it made was answered by the preparation (`replayed`), none asked again
// (`fresh`) — its scoped requests were byte for byte what was prepared, though
// the first part had changed the site in between.
const replayedExactly = (view, n) => {
  const u = prepUseOf(view, n);
  assert.ok(u, "part " + n + "'s job's use of its preparation is not served: " + JSON.stringify(view.parts[n]));
  assert.equal(u.staged, "yes", JSON.stringify(u));
  assert.ok(u.replayed >= 3, "the picker, the designer and the page writer replayed: " + JSON.stringify(u));
  assert.equal(u.fresh, 0, "a model was asked again: " + JSON.stringify(u));
};
const bothLanded = (P) => {
  assert.match(P.page("visit.tsx"), /<SafeImage src=\{?"\/u\/[^"]+\.jpg"\}? alt="the workshop bench"/, P.page("visit.tsx"));
  assert.doesNotMatch(P.page("visit.tsx"), /@@IMG/);
  assert.ok(P.page("about.tsx").includes("Do you deliver?"), P.page("about.tsx"));
  assert.equal(P.imageLog.length, 1, "the photograph was bought twice");
  assert.equal(uploads(P).length, 1);
  // NO CHARGE TWICE, whoever made the photograph (a job, or a preparation).
  const refs = P.ledger.map((e) => e.ref);
  assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
};

test("PI 2 — IMAGE FIRST, TWO PARTS: the photograph is GENERATED (the first part's job) while the component's pages are written (the second part's preparation), the component's addition replayed exactly by its job; both land, bought once, nothing designed twice", async () => {
  const meet = rendezvous(["photo", "faq"]);
  await twoParts({
    // THE IMAGE GENERATION MEETS THE COMPONENT'S PAGE WRITER (its substantive work).
    slug: slugOf("p2"), first: "photo", meet, photoAt: "image", faqAt: "pages",
    check: async (P, rec, r, view) => {
      assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.deepEqual(meet.met, { photo: true, faq: true }, "the component waited for the photograph: " + JSON.stringify(meet));
      replayedExactly(view, 1);
      bothLanded(P);
      assert.equal(P.modelLog.filter((m) => m.tool === T.design).length, 2, "a designer was asked twice");
    },
  });
});

test("PI 3 — COMPONENT FIRST, TWO PARTS: the component's pages are written (the first part's job) while the photograph is GENERATED (the second part's preparation buys it, under the part's own purchase); its job reuses it — both land, bought once, nothing designed twice", async () => {
  const meet = rendezvous(["photo", "faq"]);
  await twoParts({
    // THE PHOTOGRAPH'S OWN GENERATION, NOT ITS DESIGNER (Codex on d7a00395):
    // the image call meets the component's page writer.
    slug: slugOf("p3"), first: "faq", meet, photoAt: "image", faqAt: "pages",
    check: async (P, rec, r, view) => {
      assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.deepEqual(meet.met, { photo: true, faq: true }, "the photograph waited for the component: " + JSON.stringify(meet));
      replayedExactly(view, 1);
      bothLanded(P);
      assert.equal(P.modelLog.filter((m) => m.tool === T.design).length, 2, "a designer was asked twice");
    },
  });
});

/** Each job's reserve rows, by job id. */
const reservesByJob = (P) => {
  const by = {};
  for (const e of P.ledger) if (e.reason === "reserve") { const id = String(e.ref).split("#")[0]; by[id] = (by[id] || 0) + 1; }
  return by;
};

test("PI 4 — A SHARED TARGET IS SERIALIZED: both parts write the Visit page, so the second is not prepared beside the first part's job — it waits (they never meet), then both land, the photograph bought once", async () => {
  const meet = rendezvous(["photo", "faq"], 800);
  await twoParts({
    slug: slugOf("p4"), first: "photo", meet, photoAt: "image", faqAt: "designer",
    targets: [{ change: 0, writes: PHOTO_TARGETS }, { change: 1, writes: ["page:/visit", "new-component:faq"] }],
    check: async (P, rec) => {
      assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      // THE OBSERVER IS ALIVE: both sides arrived, and the first waited out the limit.
      assert.ok(Object.hasOwn(meet.at, "photo") && Object.hasOwn(meet.at, "faq"), JSON.stringify(meet));
      assert.equal(meet.met.photo, false, "the conflicting part ran beside the first: " + JSON.stringify(meet));
      assert.ok(meet.at.faq >= meet.at.photo, JSON.stringify(meet));
      bothLanded(P);
    },
  });
});

test("PI 5 — A GENUINE DEPENDENCY WAITS: the photograph is placed inside the questions component the first part creates (it reads `component:faq`), so it is neither prepared nor run until that part has been applied — they never meet; both land", async () => {
  const meet = rendezvous(["photo", "faq"], 800);
  await twoParts({
    slug: slugOf("p5"), first: "faq", meet, photoAt: "designer", faqAt: "pages",
    targets: [{ change: 0, writes: FAQ_TARGETS }, { change: 1, writes: PHOTO_TARGETS, reads: ["component:faq"] }],
    check: async (P, rec) => {
      assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.deepEqual(rec.parts[1].needs, [0], "the dependency the targets imply is recorded: " + JSON.stringify(rec.parts[1].needs));
      assert.ok(Object.hasOwn(meet.at, "photo") && Object.hasOwn(meet.at, "faq"), JSON.stringify(meet));
      assert.equal(meet.met.faq, false, "the dependent part ran before what it needs existed: " + JSON.stringify(meet));
      assert.ok(meet.at.photo >= meet.at.faq, JSON.stringify(meet));
      bothLanded(P);
    },
  });
});

test("PI 6 — A STALE PREPARED ANSWER IS STILL REJECTED: the component's preparation ran beside the photograph's job, then its own page changed under it before its job (a write no plan declared); its job asks every call again (replayed 0) and the change lands on the page as it now is", async () => {
  const meet = rendezvous(["photo", "faq"]);
  await twoParts({
    slug: slugOf("p6"), first: "photo", meet, photoAt: "image", faqAt: "designer",
    between: async (P) => {
      const key = SOURCE_KEY(P.slug);
      const pages = JSON.parse(P.objects.get(key).body).map((p) => (p.path === "about.tsx" ? { ...p, source: p.source.replace("Our story", "Our story so far") } : p));
      P.objects.set(key, { ...P.objects.get(key), body: JSON.stringify(pages), etag: "e-between" });
    },
    check: async (P, rec, r, view) => {
      assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.deepEqual(meet.met, { photo: true, faq: true }, JSON.stringify(meet));
      const u = prepUseOf(view, 1);
      assert.ok(u && u.staged === "yes", JSON.stringify(view.parts[1]));
      assert.equal(u.replayed, 0, "a prepared answer was reused for a request it was not made for: " + JSON.stringify(u));
      assert.ok(u.fresh >= 3, JSON.stringify(u));
      assert.ok(P.page("about.tsx").includes("Do you deliver?"), P.page("about.tsx"));
      assert.equal(P.imageLog.length, 1);
    },
  });
});

test("PI 7 — REDELIVERED WHILE RUNNING: the first part's job and the second's preparation each delivered twice at once; the photograph is bought once, each designer asked once (the preparation's answers replayed), each job reserved once; both land", async () => {
  const meet = rendezvous(["photo", "faq"]);
  await twoParts({
    slug: slugOf("p7"), first: "photo", meet, photoAt: "image", faqAt: "designer", twice: true,
    check: async (P, rec, r, view) => {
      assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.deepEqual(meet.met, { photo: true, faq: true }, JSON.stringify(meet));
      bothLanded(P);
      assert.equal(designCalls(P), 2, "a designer was asked twice");
      // EVERY CHARGE ONCE: no ledger reference twice, one routing charge, and
      // the same three jobs a single delivery files (the two parts' jobs and
      // the photograph's own reserve on the first) — measured against PI 2's
      // ledger, which has exactly this shape.
      const refs = P.ledger.map((e) => e.ref);
      assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
      assert.equal(P.ledger.filter((e) => e.reason === "route").length, 1, JSON.stringify(P.ledger));
      assert.equal(Object.keys(reservesByJob(P)).length, 3, JSON.stringify(P.ledger));
      replayedExactly(view, 1);
    },
  });
});

test("PI 8 — THE PHOTOGRAPH FAILS, THE COMPONENT DOES NOT: the picture service refuses after the component was designed beside it; the component's part still lands from its preparation (replayed exactly), the picture is asked for once and never again, and no charge is left for a picture that was not made", async () => {
  const meet = rendezvous(["photo", "faq"]);
  await twoParts({
    slug: slugOf("p8"), first: "photo", meet, photoAt: "image", faqAt: "designer", refuse: true,
    check: async (P, rec, r, view) => {
      // THE PHOTOGRAPH'S PART FAILED, AND WHAT IT RESERVED CAME BACK: its job
      // nets to nothing, and no picture reserve was ever taken for it.
      assert.equal(rec.parts[0].status, "failed", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      const refunded = P.ledger.filter((e) => e.reason === "refund").map((e) => String(e.ref));
      assert.equal(refunded.length, 1, JSON.stringify(P.ledger));
      assert.equal(P.ledger.filter((e) => String(e.ref).split("#")[0] === refunded[0]).reduce((a, e) => a + e.delta, 0), 0, JSON.stringify(P.ledger));
      assert.deepEqual(meet.met, { photo: true, faq: true }, JSON.stringify(meet));
      assert.equal(rec.parts[1].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.ok(P.page("about.tsx").includes("Do you deliver?"), P.page("about.tsx"));
      assert.equal(P.imageLog.length, 1, "the refused picture was asked for again");
      assert.equal(uploads(P).length, 0);
      assert.equal(designCalls(P), 2, "a designer was asked twice");
      replayedExactly(view, 1);
    },
  });
});

// ── THE PLAN'S RULES, PURE ──────────────────────────────────────────────────
const planPart = (n, writes, reads = [], o = {}) => ({ n, at: n, needs: o.needs || [], status: "ready", phase: o.phase || "run", route: o.route || { op: "addon", intent: "addon" }, targets: { writes, reads } });
const live = () => false;

test("PI 9 — AN ADDITION'S SCOPE IS DECLARED ONLY WHERE EVERY WRITE LANDS ON A NAMED PAGE: its pages for a picture or a component placed on them; none for a new page, a menu, a table, the whole site, a declared read, a routing or an edit step", () => {
  assert.deepEqual(addonScope(planPart(0, PHOTO_TARGETS)), { pages: ["/visit"] });
  assert.deepEqual(addonScope(planPart(0, FAQ_TARGETS)), { pages: ["/about"] });
  assert.deepEqual(addonScope(planPart(0, ["page:/about", "page:/", "component:faq"])), { pages: ["/about", "/"] });
  assert.equal(addonScope(planPart(0, ["new-page:/gallery", "menu"])), null, "a new page copies the pages beside it");
  assert.equal(addonScope(planPart(0, ["page:/visit", "menu"])), null);
  assert.equal(addonScope(planPart(0, ["page:/visit", "new-data:bookings"])), null);
  assert.equal(addonScope(planPart(0, ["images"])), null, "no page named: nowhere to narrow to");
  assert.equal(addonScope(planPart(0, [])), null);
  assert.equal(addonScope(planPart(0, PHOTO_TARGETS, ["component:faq"])), null, "a declared read is never narrowed away");
  assert.equal(addonScope(planPart(0, PHOTO_TARGETS, [], { phase: "route" })), null);
  assert.equal(addonScope(planPart(0, ["page:/visit"], [], { route: { layer: "text", page: "/visit" } })), null);
  // WHAT THE STEP IS PLANNED AS READING follows the scope.
  assert.deepEqual(stepInputs(planPart(0, PHOTO_TARGETS)), ["pagelist", "theme", "page:/visit"]);
  assert.deepEqual(stepInputs(planPart(0, ["new-page:/gallery"])), ["pagelist", "theme", "menu", "pages", "images"]);
});

test("PI 10 — WHAT A PART PLACES LANDS ON THE PAGES IT NAMES: a photograph or a new component on Visit does not hold back a scoped addition on About, in either order; on the same page, with no page named, or as a change to an existing component it does", () => {
  const photo = planPart(0, PHOTO_TARGETS), faq = planPart(1, FAQ_TARGETS);
  assert.equal(clearToPrepare([photo, faq], 1, live), true, "image first");
  assert.equal(clearToPrepare([planPart(0, FAQ_TARGETS), planPart(1, PHOTO_TARGETS)], 1, live), true, "component first");
  assert.equal(clearToPrepare([planPart(0, ["page:/about", "images"]), faq], 1, live), false, "a photograph placed on About");
  assert.equal(clearToPrepare([planPart(0, ["images"]), faq], 1, live), false, "a photograph placed on no named page may land anywhere");
  assert.equal(clearToPrepare([planPart(0, ["new-component:gallery"]), faq], 1, live), false, "a component placed on no named page may land anywhere");
  assert.equal(clearToPrepare([planPart(0, ["page:/visit", "component:footer"]), faq], 1, live), false, "an existing component may render on About");
  assert.equal(clearToPrepare([planPart(0, ["page:/visit", "theme"]), faq], 1, live), false, "the look feeds every page");
  // AN UNSCOPED ADDITION READS EVERY PAGE AND PICTURE: held back as before.
  assert.equal(clearToPrepare([photo, planPart(1, ["new-page:/faq"])], 1, live), false);
  // ONCE THE EARLIER PART HAS ENDED, nothing holds it.
  assert.equal(clearToPrepare([planPart(0, ["images"]), faq], 1, () => true), true);
});

// ── WHAT A SCOPED ADDITION IS SHOWN ─────────────────────────────────────────
// The home page carries a component of the site's own; neither part touches it.
const HOURS_SRC = "export function OpeningHours(){ return <section className=\"hours-band\"><p>Open from 8, Tuesday to Sunday.</p></section> }\n";
const HOME_WITH_HOURS = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { OpeningHours } from '@/routes/-parts/opening-hours'\n"
  + "export const Route = createFileRoute('/')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"hero\"><h1>Harbour Loaf</h1></section><OpeningHours /></main> }\n";
const PAGES_WITH_PART = [{ path: "index.tsx", source: HOME_WITH_HOURS }, { path: "visit.tsx", source: VISIT }, { path: "about.tsx", source: ABOUT }];

test("PI 11 — A SCOPED PART IS SHOWN ITS OWN PAGES, AND WHAT IT WAS NOT SHOWN IT CANNOT REPLACE: the component's picker, designer and page writer (prepared beside the photograph's job) are never told the Visit heading, the home page's own component or its source; a scoped answer returning that component is never applied — the writer is asked again with the whole site, and the stored component is kept; both changes land", async () => {
  const meet = rendezvous(["photo", "faq"]);
  const REWRITE = "export function OpeningHours(){ return <section><p>Closed.</p></section> }\n";
  await twoParts({
    slug: slugOf("p11"), first: "photo", meet, photoAt: "image", faqAt: "designer",
    pages: PAGES_WITH_PART,
    setup: (P) => { const k = PARTS_KEY(P.slug); P.objects.set(k, { ...P.objects.get(k), body: JSON.stringify([{ name: "opening-hours", source: HOURS_SRC }]), etag: "e-parts" }); },
    // RETURNED ONLY BY A WRITER THAT HAS NOT SEEN IT (2026-10-11, Codex on
    // d7a00395): that answer is never applied; the writer asked again with the
    // whole site in front of it leaves the component alone.
    faqExtra: (args) => (textOf(args).includes("hours-band") ? {} : { parts: [{ name: "opening-hours", source: REWRITE }] }),
    check: async (P, rec, r, view) => {
      assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.deepEqual(meet.met, { photo: true, faq: true }, JSON.stringify(meet));
      // ITS ANSWER REACHED A COMPONENT IT WAS NOT SHOWN, SO IT WAS ASKED AGAIN:
      // the picker and designer replayed, the writer asked fresh.
      const u = prepUseOf(view, 1);
      assert.ok(u && u.replayed >= 2 && u.fresh >= 1, JSON.stringify(u));
      // THE COMPONENT PART'S OWN REQUESTS, told apart by its own words.
      const asked = (m) => (/What they asked to add:\n([^\n]*)/.exec(m.text) || [])[1] || "";
      const design = P.modelLog.filter((m) => m.tool === T.design && /questions section/.test(asked(m)));
      const writers = P.modelLog.filter((m) => m.tool === T.pages && /questions section/.test(m.text) && !m.text.includes("@@IMG:" + BENCH));
      // THE SCOPED ASK (its preparation's) saw nothing else; the ask after it saw the whole site.
      const writer = writers.slice(0, 1);
      assert.ok(writers.slice(1).some((m) => m.text.includes("hours-band")), "the writer was never asked again with the component in front of it");
      // THE OBSERVERS ARE ALIVE: both were asked, and the writer was shown its own page.
      assert.ok(design.length >= 1 && writer.length >= 1, JSON.stringify(P.modelLog.map((m) => m.tool)));
      assert.ok(writer.every((m) => m.text.includes("Our story")), "the writer was not shown its own page");
      for (const m of [...design, ...writer]) {
        assert.doesNotMatch(m.text, /Come to the bakery/, "another page's heading reached the scoped part (" + m.tool + ")");
        assert.doesNotMatch(m.text, /opening-hours|OpeningHours/, "a component its pages do not use reached the scoped part (" + m.tool + ")");
        assert.doesNotMatch(m.text, /hours-band|className=\\?"hero/, "another page's source reached the scoped part (" + m.tool + ")");
      }
      // WHAT IT WAS NOT SHOWN, IT DID NOT REPLACE.
      const stored = JSON.parse(P.objects.get(PARTS_KEY(P.slug)).body);
      assert.equal(stored.find((p) => p.name === "opening-hours").source, HOURS_SRC, "a component the writer was never shown was replaced");
      bothLanded(P);
    },
  });
});

// ── THE SCOPED WRITER'S OUTPUT BOUNDARY (Codex on d7a00395) ─────────────────
// A writer shown only About that writes, or takes away, a page it was not
// shown. Answered here only while that page is NOT in its request: a writer
// re-asked with the whole site in front of it writes About alone.
const HOME_SHOWN = (args) => textOf(args).includes('className=\\"hero\\"');
const HOME_TOUCHED = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"hero-wide\"><h1>Harbour Loaf</h1></section></main> }\n";

for (const [name, extra] of [
  ["changes the home page it was never shown", (args) => (HOME_SHOWN(args) ? {} : { pages: [{ path: "src/routes/index.tsx", source: HOME_TOUCHED }] })],
  ["takes away the Visit page it was never shown", (args) => (textOf(args).includes("Come to the bakery") ? {} : { remove: ["/visit"] })],
]) {
  test("PI 12 — THE SCOPED WRITER " + name.toUpperCase() + ": that answer is never applied — the writer is asked again with the whole site as it is now, and only what that answer writes is applied; every page it was not shown is as it was", async () => {
    const meet = rendezvous(["photo", "faq"]);
    await twoParts({
      slug: slugOf("p12"), first: "photo", meet, photoAt: "image", faqAt: "designer",
      faqExtra: extra,
      check: async (P, rec, r, view) => {
        assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
        assert.deepEqual(meet.met, { photo: true, faq: true }, JSON.stringify(meet));
        // THE UNSEEN PAGES, AS THEY WERE.
        assert.equal(P.page("index.tsx"), HOME, "the home page the scoped writer was never shown was changed");
        assert.ok(P.page("visit.tsx"), "the Visit page the scoped writer was never shown was taken away");
        bothLanded(P);
        // AND THE WRITER WAS ASKED AGAIN WITH THE SITE IN FRONT OF IT.
        const faqWriters = P.modelLog.filter((m) => m.tool === T.pages && /questions section/.test(m.text) && !m.text.includes("@@IMG:" + BENCH));
        assert.ok(faqWriters.some((m) => m.text.includes("Come to the bakery") && m.text.includes("hero")), "the writer was never shown the pages its answer touched");
        const u = prepUseOf(view, 1);
        assert.ok(u && u.fresh >= 1, "the boundary answer was replayed rather than asked again: " + JSON.stringify(u));
      },
    });
  });
}

// ── CAPACITY BEFORE SPENDING (Codex on d7a00395) ────────────────────────────
const seedUploads = (P, n) => { for (let i = 0; i < n; i++) P.objects.set("uploads/" + P.slug + "/seed" + i + ".jpg", { body: "x", etag: "s" + i, at: 0 }); };
async function oneAddition({ slug, uploadsBefore = 0, imageWith = null, pagesWith = null, check }) {
  await withPlatform({
    slug, pages: PAGES, images: true, replies: true, balance: 400,
    imageWith,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["component", "photo"] },
      "add:photo": PHOTO_ANSWER,
      "add:component": COMPONENT_ANSWER,
      [T.pages]: async (args, n) => (pagesWith ? pagesWith(args, n) : { pages: [{ path: "src/routes/visit.tsx", source: VISIT_WITH_PHOTO }, { path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] }),
    },
  }, async (P) => {
    seedUploads(P, uploadsBefore);
    globalThis.__p14 = () => uploads(P).length;
    const r = await sendMessage(P, { message: "Add a photo of the workshop bench to the Visit page, and add a questions section to the About page." });
    await check(P, r);
  });
}

test("PI 13 — A FULL LIBRARY IS CHECKED BEFORE ANYTHING IS BOUGHT: with 200 files already stored, the photograph is never asked of the image service and nothing is stored; the component still lands", async () => {
  await oneAddition({
    slug: slugOf("p13"), uploadsBefore: 200,
    check: async (P, r) => {
      const { rec } = await settle(P, r.key);
      assert.equal(P.imageLog.length, 0, "the image service was asked with no room in the library");
      assert.equal(uploads(P).length, 200, "a file was stored past the library's limit");
      assert.ok(P.page("about.tsx").includes("Do you deliver?"), JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    },
  });
});

test("PI 14 — ONE FILE OF ROOM IS ENOUGH FOR ONE PHOTOGRAPH, AND ITS OWN STORED FILE IS NEVER COUNTED AGAINST IT: with 199 files the photograph is bought once beside the page writer, stored as the 200th, and placed", async () => {
  await oneAddition({
    slug: slugOf("p14"), uploadsBefore: 199,
    // THE WRITER ANSWERS ONLY ONCE THE EARLY PHOTOGRAPH IS STORED, so the image
    // step counts the library with that file already in it.
    pagesWith: async () => {
      for (let i = 0; i < 100 && !(globalThis.__p14 && globalThis.__p14() >= 200); i++) await new Promise((ok) => setTimeout(ok, 10));
      return { pages: [{ path: "src/routes/visit.tsx", source: VISIT_WITH_PHOTO }, { path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] };
    },
    check: async (P, r) => {
      const { rec } = await settle(P, r.key);
      assert.deepEqual(statuses(rec), ["done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.notDone])));
      assert.equal(P.imageLog.length, 1);
      assert.equal(uploads(P).length, 200);
      assert.match(P.page("visit.tsx"), /<SafeImage src=\{?"\/u\/[^"]+\.jpg"\}? alt="the workshop bench"/, P.page("visit.tsx"));
    },
  });
});

// ── AN EARLY TASK'S WHOLE LIFE (Codex on d7a00395) ──────────────────────────
test("PI 15 — THE PAGE WRITER FAILS WHILE THE PHOTOGRAPH IS STILL BEING MADE: the job waits for the purchase it began (within the image step's own wait) and the part's outcome says the photograph was saved and is not on the site; nothing is generated again, and nothing is charged for it", { timeout: 30000 }, async () => {
  let release; const held = new Promise((ok) => { release = ok; });
  await oneAddition({
    slug: slugOf("p15"),
    imageWith: async () => { await held; return null; },
    pagesWith: async () => { setTimeout(() => release(), 200); throw Object.assign(new Error("upstream 529"), { status: 529 }); },
    check: async (P, r) => {
      const { rec } = await settle(P, r.key);
      for (let i = 0; i < 3; i++) await settle(P, r.key);
      assert.equal(rec.parts[0].status, "failed", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.equal(P.imageLog.length, 1, "the photograph was generated again");
      assert.equal(uploads(P).length, 1);
      // THE JOB'S OWN ANSWER, WRITTEN AFTER THE PURCHASE IT BEGAN HAD ENDED.
      const jobs = [...P.jobs.values()].filter((j) => j.op === "addon");
      assert.equal(jobs.length, 1, "the addition ran again: " + jobs.length);
      const res = jobs[0].result || {};
      const answer = typeof res.body === "string" ? JSON.parse(res.body) : (res.body || res);
      const out = answer.outcome;
      assert.ok(out && out.photos === 1 && out.state === "unpublished", "the outcome does not say one photograph was saved and is not on the site: " + JSON.stringify(jobs[0].result).slice(0, 800));
      // NOTHING LEFT CHARGED FOR AN ADDITION THAT DID NOT GO THROUGH.
      assert.equal(P.ledger.filter((e) => String(e.ref).split("#")[0] === jobs[0].id).reduce((a, e) => a + e.delta, 0), 0, JSON.stringify(P.ledger));
      const purchases = [...P.objects.keys()].filter((k) => k.includes("/purchases/"));
      for (const k of purchases) assert.notEqual(JSON.parse(P.objects.get(k).body).state, "buying", "a purchase was left buying: " + k);
    },
  });
});

test("PI 16 — THE PAGE WRITER FAILS AND THE PHOTOGRAPH OUTLASTS THE IMAGE STEP'S WAIT: the part is held on that purchase (never ended as if nothing were out); when it lands, the part runs again, reuses it, and finishes — one generation, one stored file", { timeout: 30000 }, async () => {
  let release; const held = new Promise((ok) => { release = ok; });
  let writes = 0;
  const real = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...a) => real(fn, Number(ms) >= 30000 ? 30 : ms, ...a);
  try {
    await oneAddition({
      slug: slugOf("p16"),
      imageWith: async () => { await held; return null; },
      pagesWith: async () => {
        writes++;
        if (writes === 1) throw Object.assign(new Error("upstream 529"), { status: 529 });
        return { pages: [{ path: "src/routes/visit.tsx", source: VISIT_WITH_PHOTO }, { path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] };
      },
      check: async (P, r) => {
        const s1 = await settle(P, r.key);
        assert.equal(s1.rec.parts[0].status, "uncertain", "the part was not held on the purchase still out: " + JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
        release();
        for (let i = 0; i < 50 && !([...P.objects.keys()].some((k) => k.startsWith("uploads/" + P.slug + "/"))); i++) await new Promise((ok) => real(ok, 20));
        let rec = null;
        for (let i = 0; i < 4; i++) { await tick(P); rec = (await settle(P, r.key)).rec; if (rec && rec.parts[0].status === "done") break; }
        assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
        assert.equal(P.imageLog.length, 1, "the photograph was generated again");
        assert.equal(uploads(P).length, 1);
        assert.match(P.page("visit.tsx"), /<SafeImage src=\{?"\/u\/[^"]+\.jpg"\}? alt="the workshop bench"/, P.page("visit.tsx"));
      },
    });
  } finally { globalThis.setTimeout = real; }
});
