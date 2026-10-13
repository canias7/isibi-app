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
import { platform, sendMessage, settle, deliver, call, tick, pump, T } from "./fixtures/request-flow.mjs";
import { EDIT_JOB_MS } from "../builder/edit-job.mjs";
import { addonReplyFacts } from "../builder/site-reply.mjs";
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
      // (round 11) The picker and designer are shown each page's headline as
      // the request was understood, so their requests are unchanged and their
      // answers replayed exactly; the writer, which reads the About page's
      // source, is asked again against the page as it now is.
      assert.equal(u.replayed, 2, "only the unchanged picker and designer requests may be replayed: " + JSON.stringify(u));
      assert.ok(u.fresh >= 1, "the writer, whose input changed, was not asked again: " + JSON.stringify(u));
      assert.ok(P.page("about.tsx").includes("Our story so far"), "the change made in between was lost");
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
  // A NEW PAGE (round 11) is designed on the page list, the look, the menu and
  // what pages are built from; its writer's read of the pages is `designOnly`'s.
  assert.deepEqual(stepInputs(planPart(0, ["new-page:/gallery"])), ["pagelist", "theme", "menu", "kits"]);
  assert.deepEqual(stepInputs(planPart(0, ["new-page:/gallery"], ["page:/"])), ["pagelist", "theme", "menu", "pages", "images"], "a declared read keeps the whole site");
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
async function oneAddition({ slug, uploadsBefore = 0, imageWith = null, pagesWith = null, addsWith = null, photoWith = null, setup = null, check }) {
  await withPlatform({
    slug, pages: PAGES, images: true, replies: true, balance: 400,
    imageWith,
    answers: {
      route: { intent: "addon" },
      [T.adds]: addsWith || { kinds: ["component", "photo"] },
      "add:photo": photoWith || PHOTO_ANSWER,
      "add:component": COMPONENT_ANSWER,
      [T.pages]: async (args, n) => (pagesWith ? pagesWith(args, n) : { pages: [{ path: "src/routes/visit.tsx", source: VISIT_WITH_PHOTO }, { path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] }),
    },
  }, async (P) => {
    seedUploads(P, uploadsBefore);
    if (setup) setup(P);
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

// ── A PURCHASE'S OUTCOME, NOT ITS PROMISE (Codex on 902fc7f0) ──────────────
//
// Two gaps in one rule: a JavaScript promise that settled is not a purchase
// whose outcome is known, and an outcome that IS known is not to be made
// again by a later step of the same request. A refusal the image service
// answered ends the logical purchase; only the customer's explicit buy-again
// (`released`) may begin it again. A purchase begun and not known to have
// ended (`unconfirmed`), or made and not stored (`store-pending`), is held by
// its identity and reason until it is known — never counted as done, never
// bought again on a guess.
const purchasesOf = (P) => [...P.objects.keys()].filter((k) => k.includes("/purchases/")).map((k) => JSON.parse(String(P.objects.get(k).body)));
const runJobs = (rec, n) => (rec.parts[n].jobs || []).filter((j) => j.kind === "run").map((j) => j.id);
const netFor = (P, ids) => P.ledger.filter((e) => ids.includes(String(e.ref).split("#")[0])).reduce((a, e) => a + e.delta, 0);
const placed = (P) => assert.match(P.page("visit.tsx"), /<SafeImage src=\{?"\/u\/[^"]+\.jpg"\}? alt="the workshop bench"/, P.page("visit.tsx"));
const lostCall = () => { throw new TypeError("fetch failed: connection reset"); };
const failUploads = (P, times) => { for (let i = 0; i < times; i++) P.failPut((k) => k.startsWith("uploads/" + P.slug + "/")); };
// WHAT THE CUSTOMER IS TOLD: the job's own answer names the held purchase by
// its identity and reason, which the request holds the part on.
const heldTold = (P, id, why) => {
  const job = [...P.jobs.values()].filter((j) => j.op === "addon")[0];
  const res = job.result || {};
  const body = typeof res.body === "string" ? JSON.parse(res.body) : (res.body || res);
  assert.deepEqual((body.held || []).map((h) => [h.id, h.why]), [[id, why]], JSON.stringify(body).slice(0, 600));
};
const settleUntil = async (P, key, want, { rounds = 6, twice = false } = {}) => {
  let rec = null;
  for (let i = 0; i < rounds; i++) {
    await tick(P);
    if (twice) await pump(P, { twice: true });
    rec = (await settle(P, key)).rec;
    if (rec && want(rec)) break;
  }
  return rec;
};

test("PI 17 — A REFUSED PICTURE STAYS REFUSED FOR THE REST OF ITS REQUEST: component first, the photograph's preparation (beside the component's page writer) is refused by the image service; the part's own job reads that ending on the purchase's record and never asks the service again — the component lands, the photograph's part fails, and nothing is charged for it", async () => {
  const meet = rendezvous(["photo", "faq"]);
  await twoParts({
    slug: slugOf("p17"), first: "faq", meet, photoAt: "image", faqAt: "pages", refuse: true,
    check: async (P, rec) => {
      assert.deepEqual(meet.met, { photo: true, faq: true }, "the refused generation did not run beside the component's page writer: " + JSON.stringify(meet));
      assert.equal(P.imageLog.length, 1, "the refused picture was asked for again by the part's own job");
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.equal(rec.parts[1].status, "failed", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.ok(P.page("about.tsx").includes("Do you deliver?"), P.page("about.tsx"));
      assert.deepEqual(purchasesOf(P).map((x) => x.state), ["none"]);
      assert.equal(uploads(P).length, 0);
      assert.equal(netFor(P, runJobs(rec, 1)), 0, "a charge was left for a picture that was not made: " + JSON.stringify(P.ledger));
    },
  });
});

test("PI 18 — THE SAME, EVERY MESSAGE DELIVERED TWICE AT ONCE: the refusal is still asked of the image service exactly once — neither the redelivered preparation nor the redelivered job begins it again", async () => {
  const meet = rendezvous(["photo", "faq"]);
  await twoParts({
    slug: slugOf("p18"), first: "faq", meet, photoAt: "image", faqAt: "pages", refuse: true, twice: true,
    check: async (P, rec) => {
      assert.equal(P.imageLog.length, 1, "a redelivery asked for the refused picture again");
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.equal(rec.parts[1].status, "failed", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.deepEqual(purchasesOf(P).map((x) => x.state), ["none"]);
    },
  });
});

test("PI 19 — THE IMAGE CALL'S ANSWER IS LOST AND THE PAGE WRITER FAILS: the part is HELD on that purchase (its id, `unconfirmed`), never failed as if nothing were out and never bought again by the driver; only the customer's buy-again begins it again — then it is made, placed, and the request finishes", { timeout: 30000 }, async () => {
  let writes = 0;
  await oneAddition({
    slug: slugOf("p19"),
    imageWith: async (entry, n) => (n === 0 ? lostCall() : null),
    pagesWith: async () => {
      writes++;
      if (writes === 1) throw Object.assign(new Error("upstream 529"), { status: 529 });
      return { pages: [{ path: "src/routes/visit.tsx", source: VISIT_WITH_PHOTO }, { path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] };
    },
    check: async (P, r) => {
      const s1 = await settle(P, r.key);
      const p0 = s1.rec.parts[0];
      assert.equal(p0.status, "uncertain", "the part was not held on the purchase whose outcome is unknown: " + JSON.stringify([p0.status, p0.why]));
      const recs = purchasesOf(P);
      assert.deepEqual(recs.map((x) => x.state), ["buying"]);
      assert.deepEqual((p0.purchase.held || []).map((h) => [h.id, h.why]), [[recs[0].id, "unconfirmed"]], JSON.stringify(p0.purchase));
      assert.equal(netFor(P, runJobs(s1.rec, 0)), 0, JSON.stringify(P.ledger));
      heldTold(P, recs[0].id, "unconfirmed");
      // THE PAGE'S VIEW OF THE PART: held, on that picture, for that reason.
      const v = await viewOf(P, r.key);
      assert.equal(v.parts[0].status, "uncertain");
      assert.deepEqual(v.parts[0].purchases, [{ d: BENCH, why: "unconfirmed", state: "unknown" }]);
      assert.equal(v.parts[0].purchaseState, "unknown");
      assert.equal(v.parts[0].buyAgain, true);
      // THE DRIVER LOOKS AGAIN AND STILL CANNOT TELL: nothing is bought on a guess.
      const s2 = await settleUntil(P, r.key, () => false, { rounds: 3 });
      assert.equal(s2.parts[0].status, "uncertain");
      assert.equal(P.imageLog.length, 1, "the purchase was begun again without the customer's say-so");
      // THE CUSTOMER'S EXPLICIT BUY-AGAIN: the one way it is begun again.
      const b = await call(P, "POST", "/api/site/request/" + P.slug + "/" + r.key + "/buy-again", { part: 0 });
      assert.equal(b.status, 200, JSON.stringify(b.body));
      const rec = await settleUntil(P, r.key, (x) => x.parts[0].status === "done");
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.equal(P.imageLog.length, 2);
      assert.equal(uploads(P).length, 1);
      placed(P);
    },
  });
});

test("PI 20 — THE PICTURE IS MADE, ITS STORE FAILS, AND THE PAGE WRITER FAILS: the part is HELD on that purchase (`store-pending`, its source on the record), never failed; once storage answers, the SAME picture is saved (no second generation), the part runs again — every message redelivered — reuses it, and finishes, charged once", { timeout: 30000 }, async () => {
  let writes = 0;
  await oneAddition({
    slug: slugOf("p20"),
    setup: (P) => failUploads(P, 3),
    pagesWith: async () => {
      writes++;
      if (writes === 1) throw Object.assign(new Error("upstream 529"), { status: 529 });
      return { pages: [{ path: "src/routes/visit.tsx", source: VISIT_WITH_PHOTO }, { path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] };
    },
    check: async (P, r) => {
      const s1 = await settle(P, r.key);
      const p0 = s1.rec.parts[0];
      assert.equal(p0.status, "uncertain", "the part was not held on the picture made and not stored: " + JSON.stringify([p0.status, p0.why]));
      const recs = purchasesOf(P);
      assert.equal(recs.length, 1);
      assert.equal(recs[0].state, "generated");
      assert.match(recs[0].source, /^https:\/\/img\.test\//);
      assert.deepEqual((p0.purchase.held || []).map((h) => [h.id, h.why]), [[recs[0].id, "store-pending"]], JSON.stringify(p0.purchase));
      heldTold(P, recs[0].id, "store-pending");
      assert.equal(uploads(P).length, 0);
      assert.equal(netFor(P, runJobs(s1.rec, 0)), 0, JSON.stringify(P.ledger));
      // STORAGE ANSWERS NOW; THE DRIVER FINISHES THE SAME PICTURE.
      const rec = await settleUntil(P, r.key, (x) => x.parts[0].status === "done", { twice: true });
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.equal(P.imageLog.length, 1, "the picture was generated again");
      assert.equal(uploads(P).length, 1);
      assert.deepEqual(purchasesOf(P).map((x) => x.state), ["bought"]);
      placed(P);
      const refs = P.ledger.map((e) => e.ref);
      assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
    },
  });
});

test("PI 21 — THE RUN AFTER THE HELD PURCHASE IS KNOWN REUSES WHAT WAS FINISHED: the picker's and both designers' answers are replayed from the run that ended held (never asked of a model again — 2026-10-11, the continuation round), only the page writer that failed is asked again, and the same stored picture is placed — never generated again; done, charged once", { timeout: 30000 }, async () => {
  let writes = 0;
  await oneAddition({
    slug: slugOf("p21"),
    setup: (P) => failUploads(P, 3),
    pagesWith: async () => {
      writes++;
      if (writes === 1) throw Object.assign(new Error("upstream 529"), { status: 529 });
      return { pages: [{ path: "src/routes/visit.tsx", source: VISIT_WITH_PHOTO }, { path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] };
    },
    check: async (P, r) => {
      const s1 = await settle(P, r.key);
      assert.equal(s1.rec.parts[0].status, "uncertain", JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
      const rec = await settleUntil(P, r.key, (x) => x.parts[0].status === "done");
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.equal(P.imageLog.length, 1, "the picture was generated again");
      assert.equal(uploads(P).length, 1);
      // REUSED, NOT ASKED AGAIN: one picker call and one call per designer in all.
      assert.equal(P.modelLog.filter((m) => m.tool === T.adds).length, 1, "the picker was asked again");
      assert.equal(designCalls(P), 2, "a designer was asked again");
      assert.equal(writes, 2, "only the page writer that failed is asked again");
      const refs = P.ledger.map((e) => e.ref);
      assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
      placed(P);
    },
  });
});

// ── THE CLOCK BEFORE AN EARLY PURCHASE (the gap recorded on ef8ea26d) ───────
//
// The job's own clock, moved by the platform's injected clock while its
// designers answer: the production limits are untouched. With too little of
// the job left for a photograph (less than the publish reserve plus the
// slowest shot), nothing is asked of the image service — neither early nor by
// the image step. With enough, the same addition buys it once.
const clockCase = (left) => async () => {
  let P0 = null;
  await oneAddition({
    slug: slugOf("p22"),
    setup: (P) => { P0 = P; },
    photoWith: async () => { P0.advance(EDIT_JOB_MS - left); await P0.beatNow(); return PHOTO_ANSWER; },
    check: async (P, r) => {
      P0.rec = (await settle(P, r.key)).rec;
      // WORK THE JOB LEFT RUNNING AFTER ITS ANSWER (a purchase begun and not
      // waited for) is given time to reach the stand-ins before anything is read.
      for (let i = 0; i < 20; i++) await new Promise((ok) => setTimeout(ok, 25));
    },
  });
  return P0;
};
test("PI 22 — TOO LITTLE OF THE JOB LEFT FOR A PHOTOGRAPH: with 80 seconds of the job's clock left when the designers answer, the photograph is never asked of the image service — the early purchase obeys the same clock gate as the image step", { timeout: 30000 }, async () => {
  const P = await clockCase(80000)();
  assert.equal(P.imageLog.length, 0, "a photograph was bought with no time left to place it");
  // THE JOB ITSELF ENDS AT THE PUBLISH GATE FOR TIME, charging nothing: the
  // purchase would have been money spent on a change that never went live.
  assert.deepEqual(P.rec.parts.map((p) => [p.status, p.why]), [["failed", "time"]]);
  assert.equal(P.ledger.reduce((a, e) => a + e.delta, 0) <= 0 ? 0 : 1, 0, JSON.stringify(P.ledger));
  assert.equal(purchasesOf(P).length, 0, "a purchase was begun");
});
test("PI 22 control — ENOUGH OF THE JOB LEFT: with 400 seconds left (past the publish gate's 255) the same addition buys the photograph once and publishes it", { timeout: 30000 }, async () => {
  const P = await clockCase(400000)();
  assert.equal(P.imageLog.length, 1);
  assert.deepEqual(P.rec.parts.map((p) => p.status), ["done"], JSON.stringify(P.rec.parts.map((p) => [p.status, p.why])));
  placed(P);
});

test("PI 23 — A FAILED ADDITION'S REPLY FACTS NAME EACH HELD PICTURE BY ITS REASON: made and not saved yet (saved later, never made again, no buy-again offered), or not known (never bought again; buy-again named with its cost); in a request, carried on by itself", () => {
  const body = (why) => ({ ok: false, error: "rewrote", cost: 0, msg: "That change would have rewritten your page.", outcome: { state: "none", published: false, database: "none" }, held: [{ id: "a".repeat(24), d: BENCH, why }] });
  const said = (why, inRequest) => addonReplyFacts(body(why), { inRequest }).facts.filter((f) => f.kind === "pending").map((f) => f.text).join("\n");
  const saving = said("store-pending", true);
  assert.match(saving, /made and is not saved yet; the same picture is saved later, never made again/);
  assert.match(saving, /carries on by itself/);
  assert.doesNotMatch(saving, /buy the picture again/);
  const unknown = said("unconfirmed", true);
  assert.match(unknown, /cannot be told yet, so it was not bought again/);
  assert.match(unknown, /buy the picture again, which may cost a second time/);
  assert.match(said("in-flight", true), /still being made when this step stopped/);
  assert.doesNotMatch(said("unconfirmed", false), /carries on by itself/);
  // CONTROL: no held picture, no such fact.
  assert.equal(addonReplyFacts({ ...body("x"), held: [] }, { inRequest: true }).facts.filter((f) => f.kind === "pending").length, 0);
});

// ── A TABLE AND A COMPONENT THAT NEED NOTHING FROM EACH OTHER (Codex, on adbb7ad7) ──
//
// Codex: one addition asking for an empty signups table (a `name` column, no
// page shows it) and a static questions section on the About page completed,
// with each designer asked once — but one after the other, because a table
// (like every schema kind and a `page`) changed the site facts every later
// designer was shown, so nothing after it could start until it was decided.
// A designer is now shown only what it uses: the results of the kinds the
// picker says it uses, of the kinds that share its words, and — for a schema
// kind — the schema the kinds before it decided. Everything else it is shown
// as the site stands, so it starts at once.
const W_TABLE = "add a signups table with a name column";
const W_ABOUT_FAQ = "add a questions section to the About page";
const SIGNUPS_TABLE = { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }] }, seed: [] }] };
const ABOUT_FAQ_ANSWER = { component: [{ page: "/about", where: "after the story", does: "answers common questions", components: ["card"] }] };
// THE SITE AS THE DESIGNER WAS SHOWN IT: the note above the customer's words
// (which name the table either way).
const askedText = (args) => { const t = JSON.stringify((args && args.messages) || []); const at = t.indexOf("What they asked to add"); return at < 0 ? t : t.slice(0, at); };
async function tableAndFaq({ key, message, kinds, scopes, met, component = ABOUT_FAQ_ANSWER }) {
  const { rowsDb } = await import("./fixtures/rows-db.mjs");
  const designers = met;
  const seen = {};
  const db = rowsDb({ tables: {} });
  const out = await withPlatform({
    slug: slugOf(key), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds, scopes },
      "add:table": async (args) => { seen.table = askedText(args); await designers.arrive("add:table"); return SIGNUPS_TABLE; },
      "add:component": async (args) => {
        seen.component = askedText(args); (seen.components = seen.components || []).push(seen.component);
        await designers.arrive("add:component");
        return typeof component === "function" ? component(seen.components.length) : component;
      },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message });
    const { rec } = await settle(P, r.key);
    const creates = db.log().filter((q) => /create table[^(]*signups/i.test(q.query)).length;
    return { P, rec, about: P.page("about.tsx"), designs: designCalls(P), pagesAsked: pageCalls(P), creates };
  });
  return { ...out, seen };
}

for (const [label, message, kinds] of [
  ["table first", "Please " + W_TABLE + ", and " + W_ABOUT_FAQ + ".", ["table", "component"]],
  ["questions first", "Please " + W_ABOUT_FAQ + ", and " + W_TABLE + ".", ["component", "table"]],
]) {
  test("PI 24 (" + label + ") — A TABLE NOTHING SHOWS AND A STATIC QUESTIONS SECTION, IN ONE ADDITION: the two designers run at the same time; both results land, each designer is asked once, and the questions designer is shown the site without the new table", { timeout: 30000 }, async () => {
    const met = rendezvous(["add:table", "add:component"]);
    const scopes = [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "component", words: W_ABOUT_FAQ, uses: [] }];
    const r = await tableAndFaq({ key: "tf" + kinds[0][0], message, kinds, scopes, met });
    assert.deepEqual(statuses(r.rec), ["done"], JSON.stringify(r.rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(met.met, { "add:table": true, "add:component": true }, "the designers ran one after the other: " + JSON.stringify(met));
    assert.ok(r.about.includes("Do you deliver?"), r.about);
    assert.equal(r.creates, 1, "the signups table was not created exactly once");
    assert.equal(r.designs, 2, "a designer was asked twice");
    assert.equal(r.pagesAsked, 1);
    // ITS INPUT IS THE SITE AS IT STANDS: the table being added is not in it.
    assert.doesNotMatch(r.seen.component.replace(/This same change is ALSO designing[^.]*\./, ""), /signups/, "the questions designer was shown the new table");
    // …AND IS TOLD WHAT IT IS NOT SHOWN, so an answer that needs it can say so.
    assert.match(r.seen.component, /This same change is ALSO designing, at the same time, what this note does NOT show you: a `table`/);
  });
}

test("PI 25 — A FORM THAT SAVES INTO THE TABLE BEING ADDED (the picker says it uses the table): the form's designer waits for the table, is shown it, and is asked once — a real dependency is never started early", { timeout: 30000 }, async () => {
  const met = rendezvous(["add:table", "add:component"], 600);
  const W_FORM = "a sign-up form on the About page that saves into it";
  const scopes = [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "component", words: W_FORM, uses: ["table"] }];
  const r = await tableAndFaq({
    key: "tfd", message: "Please " + W_TABLE + ", and " + W_FORM + ".", kinds: ["table", "component"], scopes, met,
    component: { component: [{ page: "/about", where: "after the story", does: "collects names into signups", components: ["card"] }] },
  });
  assert.deepEqual(statuses(r.rec), ["done"], JSON.stringify(r.rec.parts.map((p) => [p.status, p.why])));
  assert.equal(met.met["add:table"], false, "the form's designer started before the table it saves into was decided");
  assert.match(r.seen.component, /signups/, "the form's designer was not shown the table it uses");
  assert.equal(r.designs, 2);
});

test("PI 26 — THE PICKER SAYS NOTHING ABOUT WHAT A KIND USES: the old order stands — the questions designer waits for the table and is shown it, asked once", { timeout: 30000 }, async () => {
  const met = rendezvous(["add:table", "add:component"], 600);
  const scopes = [{ kind: "table", words: W_TABLE }, { kind: "component", words: W_ABOUT_FAQ }];
  const r = await tableAndFaq({ key: "tfu", message: "Please " + W_TABLE + ", and " + W_ABOUT_FAQ + ".", kinds: ["table", "component"], scopes, met });
  assert.deepEqual(statuses(r.rec), ["done"], JSON.stringify(r.rec.parts.map((p) => [p.status, p.why])));
  assert.equal(met.met["add:table"], false);
  assert.match(r.seen.component, /signups/);
  assert.equal(r.designs, 2);
});

// ── WHAT EACH DESIGNER WAITS FOR, AS A RULE (`designWaits`) ─────────────────
test("PI 27 — designWaits: a kind waits only for what it uses, shares words with, or (a schema kind) is written against; and for what those wait for; a kind the picker said nothing about waits as before", async () => {
  const { designWaits, readAddUses } = await import("../builder/site-add.mjs");
  // Independent: nothing waits.
  assert.deepEqual(designWaits(["table", "component"], { scopes: { table: "a signups table", component: "a questions section" }, uses: { table: [], component: [] } }), { table: [], component: [] });
  // Declared use.
  assert.deepEqual(designWaits(["table", "component"], { uses: { table: [], component: ["table"] } }).component, ["table"]);
  // One phrase for two kinds ("a booking page" is a page and a table).
  assert.deepEqual(designWaits(["table", "page"], { scopes: { table: "a booking page", page: "a booking page" }, uses: { table: [], page: [] } }).page, ["table"]);
  // NO CHAIN BY CATEGORY (the scheduler round): a function that reads no table and a job that runs no new function wait for nothing…
  const free = designWaits(["table", "function", "job", "component"], { uses: { table: [], function: [], job: [], component: [] } });
  assert.deepEqual(free, { table: [], function: [], job: [], component: [] });
  // …and a function that reads the new table, and a job that runs the new function, say so and wait — transitively.
  const chain = designWaits(["table", "function", "job"], { uses: { table: [], function: ["table"], job: ["function"] } });
  assert.deepEqual(chain, { table: [], function: ["table"], job: ["table", "function"] });
  // Transitive: a QR code on a new page that shows a new table is shown both.
  assert.deepEqual(designWaits(["table", "page", "qr"], { uses: { table: [], page: ["table"], qr: ["page"] } }).qr, ["table", "page"]);
  // Unread (no `uses`): every earlier kind that changes what a designer is shown — as before.
  assert.deepEqual(designWaits(["table", "page", "component", "photo"], {}), { table: [], page: ["table"], component: ["table", "page"], photo: ["table", "page"] });
  // Only earlier kinds, and only ones that change the site facts.
  assert.deepEqual(designWaits(["component", "photo"], { uses: { component: ["photo"], photo: ["component"] } }), { component: [], photo: [] });
  // The reader: a non-list is unread, a non-string or unpicked kind refused, never coerced.
  const reply = (scopes) => ({ content: [{ type: "tool_use", input: { kinds: ["table", "component"], scopes } }] });
  assert.deepEqual(readAddUses(reply([{ kind: "component", words: "x", uses: "table" }]), ["table", "component"]), {});
  assert.deepEqual(readAddUses(reply([{ kind: "component", words: "x", uses: [["table"], "job", "table"] }]), ["table", "component"]), { component: ["table"] });
  assert.deepEqual(readAddUses(reply([{ kind: "component", words: "x", uses: [] }, { kind: "component", words: "y", uses: ["table"] }]), ["table", "component"]), { component: [] });
});

test("PI 28 — THE PICKER SAID THE QUESTIONS SECTION USES NOTHING, BUT ITS DESIGNER NEEDS THE TABLE: it answers `needs` and designs nothing; it is asked again, once, shown the table — the first answer is never used, and the table is created once", { timeout: 30000 }, async () => {
  const met = rendezvous(["add:table", "add:component"]);
  const scopes = [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "component", words: W_ABOUT_FAQ, uses: [] }];
  const r = await tableAndFaq({
    key: "tfn", message: "Please " + W_TABLE + ", and " + W_ABOUT_FAQ + ".", kinds: ["table", "component"], scopes, met,
    component: (n) => (n === 1 ? { needs: ["table"] } : ABOUT_FAQ_ANSWER),
  });
  assert.deepEqual(statuses(r.rec), ["done"], JSON.stringify(r.rec.parts.map((p) => [p.status, p.why])));
  assert.deepEqual(met.met, { "add:table": true, "add:component": true }, "the first designs did not overlap");
  assert.equal(r.seen.components.length, 2, "the designer that needed the table was not asked again, or was asked more than once more");
  assert.doesNotMatch(r.seen.components[0].replace(/This same change is ALSO designing[^.]*\./, ""), /signups/);
  assert.match(r.seen.components[1], /signups \(name text\)[^\n]*being added by this same change/, "the second ask was not shown the table");
  assert.doesNotMatch(r.seen.components[1], /does NOT show you/);
  assert.equal(r.designs, 3);
  assert.equal(r.creates, 1);
  assert.ok(r.about.includes("Do you deliver?"), r.about);
});

// ── A TEXT EDIT AND A COMPONENT ADDITION, AS SEPARATE PARTS, IN EITHER ORDER ──
//
// No picture anywhere: a heading changed on Visit and a questions section
// added to About, two parts of one message. Neither reads what the other
// writes (the addition is scoped to About, `addonScope`; the text step to
// Visit, `prepScope`), so the second part is prepared while the first part's
// job runs, and its job replays that preparation exactly.
//
// (A TABLE-ONLY addition is not such a pair today: every table addition runs
// the page writer, which must return a page and may choose any — its reach is
// the model's choice inside the step, so it is planned as reading every page.)
const W_VISIT_HEAD = "make the Visit heading say Come to the harbour bakery";
const visitLine = (args) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[visit.tsx] Come to the bakery"));
  return Number(String(at || "-1.").split(".")[0]);
};
for (const textFirst of [true, false]) {
  test("PI 29 (" + (textFirst ? "text first" : "questions first") + ") — A HEADING CHANGED ON VISIT AND A QUESTIONS SECTION ADDED TO ABOUT, AS TWO PARTS: the second part's model work runs while the first part's does; its job replays its preparation exactly; both land, nothing asked twice, one charge per job", { timeout: 30000 }, async () => {
    const meet = rendezvous(["text", "faq"]);
    const TEXT_W = ["page:/visit"];
    const route0 = textFirst
      ? { intent: "edit", layer: "text", page: "/visit", alsoAsked: [W_ABOUT_FAQ], targets: [{ change: 0, writes: TEXT_W }, { change: 1, writes: FAQ_TARGETS }] }
      : { intent: "addon", alsoAsked: [W_VISIT_HEAD], targets: [{ change: 0, writes: FAQ_TARGETS }, { change: 1, writes: TEXT_W }] };
    const route1 = textFirst ? { intent: "addon" } : { intent: "edit", layer: "text", page: "/visit" };
    await withPlatform({
      slug: slugOf("p29" + (textFirst ? "t" : "f")), pages: PAGES, replies: true, balance: 400,
      answers: {
        route: (args, n) => (n === 0 ? route0 : route1),
        [T.text]: async (args) => { await meet.arrive("text"); return { edits: [{ id: visitLine(args), to: "Come to the harbour bakery" }] }; },
        [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: W_ABOUT_FAQ, uses: [] }] },
        "add:component": async () => { await meet.arrive("faq"); return ABOUT_FAQ_ANSWER; },
        [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
      },
    }, async (P) => {
      const r = await sendMessage(P, { message: "Please " + (textFirst ? W_VISIT_HEAD + ", and " + W_ABOUT_FAQ : W_ABOUT_FAQ + ", and " + W_VISIT_HEAD) + "." });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const first = P.queue.splice(0);
      await Promise.all(first.map((m) => deliver(P, m)));
      const { rec } = await settle(P, r.key);
      assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.deepEqual(meet.met, { text: true, faq: true }, "one part's model work waited for the other's: " + JSON.stringify(meet));
      assert.match(P.page("visit.tsx"), /Come to the harbour bakery/);
      assert.ok(P.page("about.tsx").includes("Do you deliver?"), P.page("about.tsx"));
      assert.equal(designCalls(P), 1, "the questions section was designed twice");
      assert.equal(P.modelLog.filter((m) => m.tool === T.text).length, 1, "the text step was asked twice");
      const view = await viewOf(P, r.key);
      const u = prepUseOf(view, 1);
      assert.ok(u && u.staged === "yes" && u.fresh === 0 && u.replayed >= 1, "the second part's job did not replay its preparation exactly: " + JSON.stringify(view.parts[1]));
      const refs = P.ledger.map((e) => e.ref);
      assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
    });
  });
}

test("PI 30 — THE QUESTIONS DESIGNER ASKS WHILE THE TABLE'S DESIGNER (started beside it) ANSWERS: nothing is applied — no table made, nothing charged for the addition; the answer resumes only the work it reaches — the questions designer is asked again, shown the answer, while the table's finished design is replayed, never asked of a model twice; the table made once", { timeout: 30000 }, async () => {
  const { rowsDb } = await import("./fixtures/rows-db.mjs");
  const first = rendezvous(["add:table", "add:component"]);
  const db = rowsDb({ tables: {} });
  let compN = 0, tableN = 0, pickN = 0;
  const compAsked = [];
  const scopes = [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "component", words: W_ABOUT_FAQ, uses: [] }];
  await withPlatform({
    slug: slugOf("p30"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: async () => { pickN++; return { kinds: ["table", "component"], scopes }; },
      "add:table": async () => { tableN++; await first.arrive("add:table"); return SIGNUPS_TABLE; },
      "add:component": async (args) => {
        compN++;
        compAsked.push(JSON.stringify(args.messages || []));
        await first.arrive("add:component");
        return compN === 1 ? { question: { text: "Should the questions go before or after the story?", options: ["Before", "After"] } } : ABOUT_FAQ_ANSWER;
      },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  }, async (P) => {
    const creates = () => db.log().filter((q) => /create table[^(]*signups/i.test(q.query)).length;
    const r = await sendMessage(P, { message: "Please " + W_TABLE + ", and " + W_ABOUT_FAQ + "." });
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting", JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(first.met, { "add:table": true, "add:component": true }, "the first designs did not overlap");
    assert.equal(creates(), 0, "the table was made beside a question");
    assert.equal(P.ledger.filter((e) => e.reason === "reserve").length, 0, "the addition was charged beside a question: " + JSON.stringify(P.ledger));
    const q = P.question();
    assert.ok(q && q.id, "no question was kept");
    assert.equal(q.by, "add:component", "the question does not say which designer asked it");
    await sendMessage(P, { message: "After", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.equal(s2.rec.parts[0].status, "done", JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why])));
    assert.equal(creates(), 1, "the table was not made exactly once");
    assert.ok(P.page("about.tsx").includes("Do you deliver?"));
    // ONLY THE WORK THE ANSWER REACHES WAS ASKED AGAIN.
    assert.equal(tableN, 1, "the table's finished design was asked of a model again");
    assert.equal(pickN, 1, "the picker, which the answer does not reach, was asked again");
    assert.equal(compN, 2);
    assert.match(compAsked[1], /After/, "the questions designer was not shown the answer");
    // ONE CHARGE: the replayed design is billed once, by the job that used it.
    const refs = P.ledger.map((e) => e.ref);
    assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
  });
});

test("PI 31 — THE SAME QUESTION, ANSWERED, WITH EVERY MESSAGE AFTER THE ANSWER DELIVERED TWICE AT ONCE (a redelivery while the kept answers wait): the table's finished design is still replayed, never asked again; the table is made once, the page published once, one charge per job", { timeout: 30000 }, async () => {
  const { rowsDb } = await import("./fixtures/rows-db.mjs");
  const db = rowsDb({ tables: {} });
  let compN = 0, tableN = 0;
  const scopes = [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "component", words: W_ABOUT_FAQ, uses: [] }];
  await withPlatform({
    slug: slugOf("p31"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["table", "component"], scopes },
      "add:table": async () => { tableN++; return SIGNUPS_TABLE; },
      "add:component": async () => { compN++; return compN === 1 ? { question: { text: "Before or after the story?", options: ["Before", "After"] } } : ABOUT_FAQ_ANSWER; },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  }, async (P) => {
    const creates = () => db.log().filter((q) => /create table[^(]*signups/i.test(q.query)).length;
    const r = await sendMessage(P, { message: "Please " + W_TABLE + ", and " + W_ABOUT_FAQ + "." });
    await settle(P, r.key);
    const q = P.question();
    assert.ok(q && q.id && q.by === "add:component");
    await sendMessage(P, { message: "After", ask: { id: q.id, chosen: true } });
    // EVERY QUEUED MESSAGE, TWICE AT ONCE, UNTIL NOTHING IS LEFT.
    for (let round = 0; round < 12 && P.queue.length; round++) {
      const msgs = P.queue.splice(0);
      await Promise.all(msgs.flatMap((m) => [deliver(P, m), deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) })]));
    }
    const s2 = await settle(P, r.key);
    assert.equal(s2.rec.parts[0].status, "done", JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why])));
    assert.equal(tableN, 1, "the table's finished design was asked of a model again");
    assert.equal(creates(), 1, "the table was not made exactly once");
    assert.ok(P.page("about.tsx").includes("Do you deliver?"));
    const refs = P.ledger.map((e) => e.ref);
    assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
  });
});

// ── IMAGE-FREE ADDITIONS (2026-10-12, the acceptance plan's Add-on cases) ────
//
// The owner, closing the repair batch on 358dff0a: testing independent
// additions must not depend on buying photographs. PI 24 (a table and a
// questions section) and PI 29 (an Add-on part beside an Edit part) were
// already image-free; these two are the shapes the live scenarios
// `acc-addon-inner` and `acc-addon-pair` press, with nothing bought: a new page
// and a section on another page inside ONE addition, and two sections on two
// pages as TWO add-on parts.
const W_DELIVERY = "add a Delivery page saying we deliver to Clifton, Redland and Montpelier";
const PAGE_SPEC = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const DELIVERY = { path: "src/routes/delivery.tsx", source: "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/delivery')({ component: Page })\nfunction Page(){ return <main><h1>Delivery</h1><p>We deliver to Clifton, Redland and Montpelier on weekday mornings.</p></main> }\n" };

test("PI 32 — IMAGE-FREE, ONE ADDITION: A NEW PAGE AND A QUESTIONS SECTION ON ANOTHER PAGE: the page's and the section's designers run at the same time; both land, each designer and the page writer asked once, nothing bought, no charge made twice", { timeout: 30000 }, async () => {
  const designers = rendezvous(["add:page", "add:component"]);
  await withPlatform({
    slug: slugOf("p32"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["page", "component"], scopes: [{ kind: "page", words: W_DELIVERY, uses: [] }, { kind: "component", words: W_ABOUT_FAQ, uses: [] }] },
      "add:page": async () => { await designers.arrive("add:page"); return { page: [PAGE_SPEC("/delivery", "Delivery")] }; },
      "add:component": async () => { await designers.arrive("add:component"); return ABOUT_FAQ_ANSWER; },
      [T.pages]: { pages: [DELIVERY, { path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_DELIVERY + ", and " + W_ABOUT_FAQ + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(designers.met, { "add:page": true, "add:component": true }, "the designers ran one after the other: " + JSON.stringify(designers));
    assert.match(String(P.page("delivery.tsx")), /Clifton, Redland and Montpelier/, JSON.stringify(P.pages()));
    assert.ok(P.page("about.tsx").includes("Do you deliver?"), P.page("about.tsx"));
    assert.equal(P.page("visit.tsx"), VISIT, "a page nobody named changed");
    assert.equal(designCalls(P), 2, "a designer was asked twice");
    assert.equal(pageCalls(P), 1, "the page writer was asked twice");
    assert.equal(P.imageLog.length, 0, "something was bought");
    const refs = P.ledger.map((e) => e.ref);
    assert.ok(refs.length > 0, "the observer is alive: the addition was charged");
    assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
  });
});

const W_VISIT_HOURS = "add an opening hours section to the Visit page";
const VISIT_WITH_HOURS = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { Card } from '@/components/ui/card'\n"
  + "export const Route = createFileRoute('/visit')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"come\"><h1>Come to the bakery</h1><p>Open from 8.</p></section><section className=\"hours\"><Card><h2>Opening hours</h2><p>Tuesday to Sunday, 8 till 2.</p></Card></section></main> }\n";
const VISIT_HOURS_ANSWER = { component: [{ page: "/visit", where: "after the welcome", does: "lists the opening hours", components: ["card"] }] };
const HOURS_TARGETS = ["page:/visit", "new-component:hours"];
const isHours = (args) => /opening hours/.test(ownWords(args));
// A DESIGNER IS TOLD ITS OWN PART UNDER "What they asked to add:".
const designsHours = (args) => /opening hours/.test((/What they asked to add:\n([^\n]*)/.exec(String(args.messages[0].content)) || [])[1] || "");
for (const hoursFirst of [false, true]) {
  test("PI 33 (" + (hoursFirst ? "hours first" : "questions first") + ") — IMAGE-FREE, TWO ADD-ON PARTS ON TWO PAGES: the second part's designer runs while the first part's does; its job replays its preparation exactly; both sections land, every other page as it was, nothing bought, no charge made twice", { timeout: 30000 }, async () => {
    const meet = rendezvous(["faq", "hours"]);
    const [w0, w1] = hoursFirst ? [W_VISIT_HOURS, W_ABOUT_FAQ] : [W_ABOUT_FAQ, W_VISIT_HOURS];
    const [t0, t1] = hoursFirst ? [HOURS_TARGETS, FAQ_TARGETS] : [FAQ_TARGETS, HOURS_TARGETS];
    await withPlatform({
      slug: slugOf("p33" + (hoursFirst ? "h" : "f")), pages: PAGES, replies: true, balance: 400,
      answers: {
        route: (args, n) => (n === 0 ? { intent: "addon", alsoAsked: [w1], targets: [{ change: 0, writes: t0 }, { change: 1, writes: t1 }] } : { intent: "addon" }),
        [T.adds]: (args) => (isHours(args)
          ? { kinds: ["component"], scopes: [{ kind: "component", words: W_VISIT_HOURS, uses: [] }] }
          : { kinds: ["component"], scopes: [{ kind: "component", words: W_ABOUT_FAQ, uses: [] }] }),
        "add:component": async (args) => {
          if (designsHours(args)) { await meet.arrive("hours"); return VISIT_HOURS_ANSWER; }
          await meet.arrive("faq"); return ABOUT_FAQ_ANSWER;
        },
        [T.pages]: (args) => (textOf(args).includes(VISIT_HOURS_ANSWER.component[0].does)
          ? { pages: [{ path: "src/routes/visit.tsx", source: VISIT_WITH_HOURS }] }
          : { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] }),
      },
    }, async (P) => {
      const r = await sendMessage(P, { message: "Please " + w0 + ", and " + w1 + "." });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const first = P.queue.splice(0);
      await Promise.all(first.map((m) => deliver(P, m)));
      const { rec } = await settle(P, r.key);
      assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.deepEqual(meet.met, { faq: true, hours: true }, "one part's designer waited for the other's: " + JSON.stringify(meet));
      assert.ok(P.page("about.tsx").includes("Do you deliver?"), P.page("about.tsx"));
      assert.ok(P.page("visit.tsx").includes("Tuesday to Sunday, 8 till 2."), P.page("visit.tsx"));
      assert.equal(P.page("index.tsx"), HOME, "a page nobody named changed");
      assert.equal(designCalls(P), 2, "a section was designed twice");
      assert.equal(P.imageLog.length, 0, "something was bought");
      const view = await viewOf(P, r.key);
      const u = prepUseOf(view, 1);
      assert.ok(u && u.staged === "yes" && u.fresh === 0 && u.replayed >= 1, "the second part's job did not replay its preparation exactly: " + JSON.stringify(view.parts[1]));
      const refs = P.ledger.map((e) => e.ref);
      assert.ok(refs.length >= 2, "the observer is alive: both jobs were charged");
      assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
    });
  });
}

// AFTER P1 (run 128, 2026-10-12): the inside-one-Add-on shape the real router
// can keep as one answer. P1 saw S9's two sections come back as one Add-on,
// but two sections are one kind and so one designer; S7's page and section
// were split into parts. A section and a line are two kinds, and neither
// changes what the other is shown, so their designers start together WITHOUT
// the picker saying what each uses (no `uses` here, unlike PI 32).
const W_VISIT_LINE = "add one line on the Visit page saying every loaf is baked the morning you collect it";
const VISIT_LINE_ANSWER = { words: [{ page: "/visit", where: "under the opening line", words: "Every loaf is baked the morning you collect it." }] };
const VISIT_WITH_LINE = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/visit')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"come\"><h1>Come to the bakery</h1><p>Open from 8.</p><p>Every loaf is baked the morning you collect it.</p></section></main> }\n";

test("PI 34 — IMAGE-FREE, ONE ADDITION OF TWO KINDS: A QUESTIONS SECTION AND ONE LINE ON ANOTHER PAGE, with no `uses` from the picker: the section's and the line's designers run at the same time; both land, each designer and the page writer asked once, nothing bought, no charge made twice", { timeout: 30000 }, async () => {
  const designers = rendezvous(["add:component", "add:words"]);
  await withPlatform({
    slug: slugOf("p34"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["component", "words"], scopes: [{ kind: "component", words: W_ABOUT_FAQ }, { kind: "words", words: W_VISIT_LINE }] },
      "add:component": async () => { await designers.arrive("add:component"); return ABOUT_FAQ_ANSWER; },
      "add:words": async () => { await designers.arrive("add:words"); return VISIT_LINE_ANSWER; },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }, { path: "src/routes/visit.tsx", source: VISIT_WITH_LINE }] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_ABOUT_FAQ + ", and " + W_VISIT_LINE + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(designers.met, { "add:component": true, "add:words": true }, "the designers ran one after the other: " + JSON.stringify(designers));
    assert.ok(P.page("about.tsx").includes("Do you deliver?"), P.page("about.tsx"));
    assert.ok(P.page("visit.tsx").includes("Every loaf is baked the morning you collect it."), P.page("visit.tsx"));
    assert.equal(P.page("index.tsx"), HOME, "a page nobody named changed");
    assert.equal(designCalls(P), 2, "a designer was asked twice");
    assert.equal(pageCalls(P), 1, "the page writer was asked twice");
    assert.equal(P.imageLog.length, 0, "something was bought");
    const refs = P.ledger.map((e) => e.ref);
    assert.ok(refs.length > 0, "the observer is alive: the addition was charged");
    assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
  });
});

// AFTER P1: S7's shape as the real router answered it — a new page as one
// Add-on part and a questions section on another page held back as a second
// Add-on part. THEY ARE NOT INDEPENDENT AS PARTS: a scoped addition reads the
// site's page list (its picker is shown which pages there are), and a new page
// changes it, so the section's preparation waits for the page's part
// (`clearToPrepare`). This records that wait, so no plan claims overlap for
// this message; the across-parts case is S8 (PI 29, `acc-addon-edit`).
const DELIVERY_TARGETS = ["new-page:/delivery"];
test("PI 35 — TWO ADD-ON PARTS, A NEW PAGE AND A SECTION ON ANOTHER PAGE (S7 as P1 saw it): the section's preparation waits for the page's part — its picker reads the page list the new page changes — and only then runs; both land, every other page as it was, nothing bought, no charge made twice", { timeout: 30000 }, async () => {
  const meet = rendezvous(["page", "faq"], 300);
  await withPlatform({
    slug: slugOf("p35"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: (args, n) => (n === 0 ? { intent: "addon", alsoAsked: [W_ABOUT_FAQ], targets: [{ change: 0, writes: DELIVERY_TARGETS }, { change: 1, writes: FAQ_TARGETS }] } : { intent: "addon" }),
      [T.adds]: (args) => (isFaq(args)
        ? { kinds: ["component"], scopes: [{ kind: "component", words: W_ABOUT_FAQ, uses: [] }] }
        : { kinds: ["page"], scopes: [{ kind: "page", words: W_DELIVERY, uses: [] }] }),
      "add:page": async () => { await meet.arrive("page"); return { page: [PAGE_SPEC("/delivery", "Delivery")] }; },
      "add:component": async () => { await meet.arrive("faq"); return ABOUT_FAQ_ANSWER; },
      [T.pages]: (args) => (textOf(args).includes(ABOUT_FAQ_ANSWER.component[0].does)
        ? { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] }
        : { pages: [DELIVERY] }),
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_DELIVERY + ", and " + W_ABOUT_FAQ + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const first = P.queue.splice(0);
    await Promise.all(first.map((m) => deliver(P, m)));
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    // THE WAIT, FROM THE REQUEST'S OWN RECORD: the section's model work began
    // only after the page's part had run to its end.
    assert.equal(meet.met.page, false, "the page's designer met the section's: " + JSON.stringify(meet));
    assert.ok(meet.at.faq > meet.at.page, JSON.stringify(meet));
    // AND FROM THE REQUEST'S OWN RECORD: nothing was prepared for the section
    // beside the page's part — its job worked it out afresh.
    const view = await viewOf(P, r.key);
    const u = prepUseOf(view, 1);
    assert.ok(u && u.known === true, "the section part's use of preparation is not recorded: " + JSON.stringify(view.parts[1]));
    assert.equal(u.staged, "no", "the section was prepared beside the page's part: " + JSON.stringify(u));
    assert.ok(u.fresh >= 1 && u.replayed === 0, JSON.stringify(u));
    assert.match(String(P.page("delivery.tsx")), /Clifton, Redland and Montpelier/, JSON.stringify(P.pages()));
    assert.ok(P.page("about.tsx").includes("Do you deliver?"), P.page("about.tsx"));
    assert.equal(P.page("visit.tsx"), VISIT, "a page nobody named changed");
    assert.equal(P.page("index.tsx"), HOME, "a page nobody named changed");
    assert.equal(designCalls(P), 2, "a designer was asked twice");
    assert.equal(P.imageLog.length, 0, "something was bought");
    // THE REPLY MODEL'S FACTS (2026-10-13, the connected batch): the waiting part, once run, is told as done; nothing as missing.
    replySaysOnlyDone(P, ["Updated /about."]);
    const refs = P.ledger.map((e) => e.ref);
    assert.ok(refs.length >= 2, "the observer is alive: both jobs were charged");
    assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
  });
});

// THE ONE ROUTING SHAPE THAT MAKES TWO INDEPENDENT ADD-ON PARTS (2026-10-12,
// after P1). The router's instructions make additions ONE "addon" answer when
// it can make them all, and hold a change back only when the chosen answer
// cannot make it ("something to ADD … beside a change"). So two additions
// become two parts only when the message's answer is NOT an addition — an
// edit — and each addition is held back as its own entry. Both held parts are
// scoped additions on two other pages: each reads the page list, the look and
// its own page, and writes only its own page and new component, so neither
// feeds the other and neither is fed by the heading's text job
// (`clearToPrepare`). Their preparations run at the same time, and each job
// replays its own exactly. What this does NOT show: whether the real router
// answers that way (the eligibility the live probe reads).
const W_HOME_HEAD = "make the home heading say Harbour Loaf Bakery";
const homeLine = (args) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[index.tsx] Harbour Loaf"));
  return Number(String(at || "-1.").split(".")[0]);
};
test("PI 36 — A HEADING CHANGED, WITH TWO ADDITIONS HELD BACK AS TWO ADD-ON PARTS ON TWO OTHER PAGES: the two Add-on parts' designers run at the same time; each Add-on job replays its own preparation exactly; all three land, every other page as it was, nothing bought, no charge made twice", { timeout: 30000 }, async () => {
  const meet = rendezvous(["faq", "hours"]);
  await withPlatform({
    slug: slugOf("p36"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: (args, n) => (n === 0
        ? { intent: "edit", layer: "text", page: "/", alsoAsked: [W_ABOUT_FAQ, W_VISIT_HOURS], targets: [{ change: 0, writes: ["page:/"] }, { change: 1, writes: FAQ_TARGETS }, { change: 2, writes: HOURS_TARGETS }] }
        : { intent: "addon" }),
      [T.text]: async (args) => ({ edits: [{ id: homeLine(args), to: "Harbour Loaf Bakery" }] }),
      [T.adds]: (args) => (isHours(args)
        ? { kinds: ["component"], scopes: [{ kind: "component", words: W_VISIT_HOURS, uses: [] }] }
        : { kinds: ["component"], scopes: [{ kind: "component", words: W_ABOUT_FAQ, uses: [] }] }),
      "add:component": async (args) => {
        if (designsHours(args)) { await meet.arrive("hours"); return VISIT_HOURS_ANSWER; }
        await meet.arrive("faq"); return ABOUT_FAQ_ANSWER;
      },
      [T.pages]: (args) => (textOf(args).includes(VISIT_HOURS_ANSWER.component[0].does)
        ? { pages: [{ path: "src/routes/visit.tsx", source: VISIT_WITH_HOURS }] }
        : { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] }),
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_HOME_HEAD + ", " + W_ABOUT_FAQ + ", and " + W_VISIT_HOURS + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const first = P.queue.splice(0);
    await Promise.all(first.map((m) => deliver(P, m)));
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(meet.met, { faq: true, hours: true }, "one Add-on part's designer waited for the other's: " + JSON.stringify(meet));
    assert.match(P.page("index.tsx"), /Harbour Loaf Bakery/);
    assert.ok(P.page("about.tsx").includes("Do you deliver?"), P.page("about.tsx"));
    assert.ok(P.page("visit.tsx").includes("Tuesday to Sunday, 8 till 2."), P.page("visit.tsx"));
    assert.equal(designCalls(P), 2, "a section was designed twice");
    assert.equal(P.imageLog.length, 0, "something was bought");
    // THE REPLY MODEL'S FACTS (2026-10-13, the connected batch): each overlapping part's own success; nothing as missing.
    replySaysOnlyDone(P, ["Changed the wording; it now reads “Harbour Loaf Bakery”.", "Updated /about.", "Updated /visit."]);
    const view = await viewOf(P, r.key);
    for (const n of [1, 2]) {
      const u = prepUseOf(view, n);
      assert.ok(u && u.staged === "yes" && u.fresh === 0 && u.replayed >= 1, `Add-on part ${n}'s job did not replay its preparation exactly: ` + JSON.stringify(view.parts[n]));
    }
    const refs = P.ledger.map((e) => e.ref);
    assert.ok(refs.length >= 3, "the observer is alive: every job was charged");
    assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
  });
});

// ── ONE PART'S STEP NEVER MAKES ANOTHER PART'S CHANGE (2026-10-12, run 137) ──
//
// Live, an Add-on part and a heading change held back as its own part: the
// Add-on's page writer, shown the whole message for its references, also
// changed the Gallery heading, and the preservation guard refused the whole
// addition (`rewrote`). Every model call of a part now sees the other parts'
// words marked as another part's (`partBlock`). The stand-in writer here does
// what an obedient model did live: it makes every change it is shown that is
// not marked as another part's — so on the old wording this part fails exactly
// as run 137's did.
const W_HOME_RENAME = "change the home heading from Harbour Loaf to Harbour Bread";
const MARKED = /⟦ANOTHER PART: [^⟧]*⟧/g;
const unmarked = (args) => textOf(args).replace(MARKED, "");
const HOME_RENAMED = HOME.replace("<h1>Harbour Loaf</h1>", "<h1>Harbour Bread</h1>");

test("PI 37 — AN ADD-ON PART AND AN EDIT PART FROM ONE MESSAGE STAY IN THEIR OWN WORK: the Add-on's picker, designer and page writer are shown the heading change only marked as another part's, so the writer (which makes whatever it is asked) writes only the questions section; the heading is changed by its own part, whose preparation ran beside the Add-on's job and is replayed exactly; both finish, every other page as it was", { timeout: 30000 }, async () => {
  const seen = { writer: [], addonCalls: [], text: [] };
  await withPlatform({
    slug: slugOf("p37"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: (args, n) => (n === 0
        ? { intent: "addon", alsoAsked: [W_HOME_RENAME], targets: [{ change: 0, writes: FAQ_TARGETS }, { change: 1, writes: ["page:/"] }] }
        : { intent: "edit", layer: "text", page: "/" }),
      [T.text]: async (args) => { seen.text.push(textOf(args)); return { edits: [{ id: homeLine(args), to: "Harbour Bread" }] }; },
      [T.adds]: (args) => { seen.addonCalls.push(textOf(args)); return { kinds: ["component"], scopes: [{ kind: "component", words: W_ABOUT_FAQ, uses: [] }] }; },
      "add:component": async (args) => { seen.addonCalls.push(textOf(args)); return ABOUT_FAQ_ANSWER; },
      [T.pages]: (args) => {
        seen.writer.push(textOf(args));
        const pages = [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }];
        // AN OBEDIENT WRITER: any change it is shown unmarked, it makes.
        if (unmarked(args).includes(W_HOME_RENAME)) pages.push({ path: "src/routes/index.tsx", source: HOME_RENAMED });
        return { pages };
      },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_ABOUT_FAQ + ", and " + W_HOME_RENAME + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const first = P.queue.splice(0);
    await Promise.all(first.map((m) => deliver(P, m)));
    const { rec } = await settle(P, r.key);
    // BOTH PARTS FINISH, EACH WITHIN ITS OWN WORK.
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.done])));
    assert.ok(P.page("about.tsx").includes("Do you deliver?"), P.page("about.tsx"));
    assert.match(P.page("index.tsx"), /<h1>Harbour Bread<\/h1>/);
    assert.equal(P.page("visit.tsx"), VISIT, "a page no part named was changed");
    // THE OBSERVER IS ALIVE: the writer was asked, and was shown the heading change — marked.
    assert.ok(seen.writer.length >= 1, "the page writer was never asked");
    for (const t of [...seen.writer, ...seen.addonCalls]) {
      assert.ok(t.includes("⟦ANOTHER PART: " + W_HOME_RENAME), "an Add-on call was not shown the heading change as another part's: " + t.slice(-1200));
      assert.ok(!t.replace(MARKED, "").includes(W_HOME_RENAME), "an Add-on call was shown the heading change unmarked");
    }
    // …AND THE EDIT PART'S STEP SEES THE ADDITION ONLY AS ANOTHER PART'S.
    assert.ok(seen.text.length >= 1, "the heading's step was never asked");
    for (const t of seen.text) {
      assert.ok(t.includes(W_ABOUT_FAQ) && !t.replace(MARKED, "").includes(W_ABOUT_FAQ), "the heading's step was shown the addition unmarked: " + t.slice(-800));
    }
    // THE HEADING'S PREPARATION RAN BESIDE THE ADD-ON'S JOB AND WAS REPLAYED EXACTLY.
    const view = await viewOf(P, r.key);
    const u = prepUseOf(view, 1);
    assert.ok(u && u.staged === "yes" && u.fresh === 0 && u.replayed >= 1, "the heading part's job did not replay its preparation exactly: " + JSON.stringify(view.parts[1]));
    assert.equal(P.imageLog.length, 0, "something was bought");
    const refs = P.ledger.map((e) => e.ref);
    assert.ok(refs.length >= 2, "the observer is alive: both jobs were charged");
    assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
  });
});

// ── CONNECTED CASES, END TO END TO THE REPLY MODEL'S FACTS (2026-10-13) ─────
//
// The owner's consolidated batch: the connected Edit/Add-on cases that the
// existing tests covered only up to the site or the record are carried here to
// what the reply model is told (`P.replyLog`, every fact the reply writer was
// given), so observed success, missing work and unverified behavior stay
// accurate all the way. Same driver, same stand-ins; no network.
const FAQ_BAND = "<section className=\"faq\"><h2>Questions</h2><p>Do you deliver? Yes, on Fridays.</p></section>";
const HOURS_BAND = "<section className=\"hours\"><h2>Opening hours</h2><p>Tuesday to Sunday, 8 till 2.</p></section>";
// A WRITER THAT BUILDS ON THE PAGE AS IT NOW IS (what a model shown the page does).
const withBand = (src, band) => src.replace("</main>", band + "</main>");
const aboutLine = (args) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[about.tsx] Our story"));
  return Number(String(at || "-1.").split(".")[0]);
};
const W_ABOUT_HEAD = "change the About heading from Our story to Our story so far";
const ABOUT_HEAD_TARGETS = ["page:/about"];
const allFacts = (P) => P.replyLog.flat();
const factTexts = (P) => allFacts(P).map((f) => f.text);
const uniqueRefs = (P) => { const refs = P.ledger.map((e) => e.ref); assert.ok(refs.length >= 1, "the observer is alive: something was charged"); assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger)); };

const reservesOf = (P, id) => P.ledger.filter((e) => String(e.ref).startsWith(id + "#") && e.reason === "reserve");
const NOT_DONE = /^(Not done|Not made|Not started|Done only in part|The change was not made)/;
/** Every expected success fact told once, and no fact telling anything as not done. */
const replySaysOnlyDone = (P, expected) => {
  const texts = factTexts(P);
  for (const e of expected) assert.equal(texts.filter((t) => t === e).length, 1, "not told exactly once: " + e + " — " + JSON.stringify(P.replyLog));
  assert.deepEqual(texts.filter((t) => NOT_DONE.test(t)), [], "a finished part was told as not done");
};
const faqParts = (P) => (P.page("about.tsx").match(/Do you deliver\?/g) || []).length;

// CC 1 — AN EDIT AND AN ADD-ON ON THE SAME PAGE, IN EITHER ORDER.
async function samePageEditAddon(first) {
  const holder = {};
  await withPlatform({
    slug: slugOf("cc1" + first), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: (args, n) => (n > 0 ? (first === "addon" ? { intent: "edit", layer: "text", page: "/about" } : { intent: "addon" })
        : first === "addon"
          ? { intent: "addon", alsoAsked: [W_ABOUT_HEAD], targets: [{ change: 0, writes: FAQ_TARGETS }, { change: 1, writes: ABOUT_HEAD_TARGETS }] }
          : { intent: "edit", layer: "text", page: "/about", alsoAsked: [W_ABOUT_FAQ], targets: [{ change: 0, writes: ABOUT_HEAD_TARGETS }, { change: 1, writes: FAQ_TARGETS }] }),
      [T.text]: async (args) => ({ edits: [{ id: aboutLine(args), to: "Our story so far" }] }),
      [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: W_ABOUT_FAQ, uses: [] }] },
      "add:component": ABOUT_FAQ_ANSWER,
      // THE WRITER BUILDS ON THE PAGE AS IT IS WHEN IT IS ASKED.
      [T.pages]: () => ({ pages: [{ path: "src/routes/about.tsx", source: withBand(holder.P.page("about.tsx"), FAQ_BAND) }] }),
    },
  }, async (P) => {
    holder.P = P;
    const words = first === "addon" ? [W_ABOUT_FAQ, W_ABOUT_HEAD] : [W_ABOUT_HEAD, W_ABOUT_FAQ];
    const r = await sendMessage(P, { message: "Please " + words[0] + ", and " + words[1] + "." });
    const q = P.queue.splice(0);
    await Promise.all(q.map((m) => deliver(P, m)));
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    // NEITHER CHANGE LOST: the heading changed once, the section added once, the rest kept.
    const about = P.page("about.tsx");
    assert.equal((about.match(/<h1>Our story so far<\/h1>/g) || []).length, 1, about);
    assert.equal(faqParts(P), 1, about);
    assert.ok(about.includes("<p>Since 2019.</p>"), about);
    assert.equal(P.page("index.tsx"), HOME);
    assert.equal(P.page("visit.tsx"), VISIT);
    // A SHARED TARGET IS SERIALIZED: the second job ran on the first's published page.
    const jobs = P.jobsOf(r.key).filter((j) => j.op !== "route");
    assert.equal(jobs.length, 2, jobs.map((j) => j.op + ":" + j.state).join(","));
    // THE REPLY MODEL'S FACTS: each part's own success, nothing called missing.
    const texts = factTexts(P);
    assert.ok(texts.includes("Updated /about."), JSON.stringify(P.replyLog));
    assert.ok(texts.some((t) => t.includes("“Our story so far”")), JSON.stringify(P.replyLog));
    assert.deepEqual(texts.filter((t) => NOT_DONE.test(t)), [], "a finished part was told as not done");
    uniqueRefs(P);
  });
}
test("CC 1a — SAME PAGE, ADD-ON FIRST: the questions section and the heading change both land on About, each once; the second job builds on the first's page; the reply facts say each part's change and nothing as missing; one charge per job", { timeout: 30000 }, () => samePageEditAddon("addon"));
test("CC 1b — SAME PAGE, EDIT FIRST: the same, in the other order — the Add-on's writer is asked only at its job, on the page the heading change left, so the heading is kept", { timeout: 30000 }, () => samePageEditAddon("edit"));

// CC 2 — TWO ADD-ON PARTS WRITING THE SAME PAGE.
const W_ABOUT_HOURS = "add an opening hours section to the About page";
const ABOUT_HOURS_ANSWER = { component: [{ page: "/about", where: "after the story", does: "lists the opening hours", components: ["card"] }] };
const ABOUT_HOURS_TARGETS = ["page:/about", "new-component:hours"];
async function twoOnAbout({ stale, check }) {
  const holder = {};
  await withPlatform({
    slug: slugOf("cc2"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: (args, n) => (n === 0
        ? { intent: "addon", alsoAsked: [W_ABOUT_HOURS], targets: [{ change: 0, writes: FAQ_TARGETS }, { change: 1, writes: ABOUT_HOURS_TARGETS }] }
        : { intent: "addon" }),
      [T.adds]: (args) => (isHours(args)
        ? { kinds: ["component"], scopes: [{ kind: "component", words: W_ABOUT_HOURS, uses: [] }] }
        : { kinds: ["component"], scopes: [{ kind: "component", words: W_ABOUT_FAQ, uses: [] }] }),
      "add:component": (args) => (designsHours(args) ? ABOUT_HOURS_ANSWER : ABOUT_FAQ_ANSWER),
      [T.pages]: (args) => (textOf(args).includes(ABOUT_HOURS_ANSWER.component[0].does)
        // STALE: built on the page as it was before the first part's section.
        ? { pages: [{ path: "src/routes/about.tsx", source: withBand(stale ? ABOUT : holder.P.page("about.tsx"), HOURS_BAND) }] }
        : { pages: [{ path: "src/routes/about.tsx", source: withBand(holder.P.page("about.tsx"), FAQ_BAND) }] }),
    },
  }, async (P) => {
    holder.P = P;
    const r = await sendMessage(P, { message: "Please " + W_ABOUT_FAQ + ", and " + W_ABOUT_HOURS + "." });
    const q = P.queue.splice(0);
    await Promise.all(q.map((m) => deliver(P, m)));
    const { rec } = await settle(P, r.key);
    await check(P, rec, r);
  });
}
test("CC 2a — TWO ADD-ON PARTS ON ONE PAGE: serialized on the shared page; both sections land, each once, the story kept; both replies say About was updated, neither says anything is missing", { timeout: 30000 }, () => twoOnAbout({
  stale: false,
  check: async (P, rec) => {
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const about = P.page("about.tsx");
    assert.equal(faqParts(P), 1, about);
    assert.equal((about.match(/Tuesday to Sunday, 8 till 2\./g) || []).length, 1, about);
    assert.ok(about.includes("<h1>Our story</h1>"), about);
    assert.equal(P.page("visit.tsx"), VISIT);
    const texts = factTexts(P);
    assert.equal(texts.filter((t) => t === "Updated /about.").length, 2, JSON.stringify(P.replyLog));
    assert.deepEqual(texts.filter((t) => NOT_DONE.test(t)), []);
    uniqueRefs(P);
  },
}));
test("CC 2b — THE SECOND ADD-ON'S WRITER ANSWERS FROM THE PAGE BEFORE THE FIRST'S SECTION (a lost update): it is refused, the first section is kept on the site, and the reply facts say the second was not done while the first's stands", { timeout: 30000 }, () => twoOnAbout({
  stale: true,
  check: async (P, rec) => {
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.notEqual(rec.parts[1].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const about = P.page("about.tsx");
    assert.equal(faqParts(P), 1, "the first part's section was lost: " + about);
    assert.equal(rec.parts[1].why, "rewrote");
    assert.ok(!about.includes("Tuesday to Sunday"), "the refused section was published: " + about);
    // THE FACTS: the first part's success, the second's refusal with the words it would have lost — and nothing claimed for it.
    const texts = factTexts(P);
    assert.ok(texts.includes("Updated /about."), JSON.stringify(P.replyLog));
    assert.ok(texts.some((t) => t.startsWith("Nothing was added.") && t.includes("Do you deliver? Yes, on Fridays.")), JSON.stringify(P.replyLog));
    assert.ok(texts.some((t) => /^Not done: “add an opening hours section to the About page”/.test(t)), JSON.stringify(P.replyLog));
    assert.ok(texts.some((t) => /^Done: “Please add a questions section to the About page, and …”/.test(t)), "the summary named the done part by more than its own words");
    assert.equal(texts.filter((t) => t === "Updated /about.").length, 1, "the refused part was told as updated");
    uniqueRefs(P);
  },
}));

// CC 3 — TWO ADD-ON PARTS ON TWO PAGES; ONE ASKS.
test("CC 3 — ONE OF TWO ADD-ON PARTS ASKS: the hours part on Visit finishes while the questions part on About waits for its answer; the reply facts say one is done and one waits, quoting the question; the answer resumes only the waiting part — the finished one is never run or charged again — and its own reply then says About was updated", { timeout: 30000 }, async () => {
  let faqN = 0;
  const Q = { text: "Should the questions go before or after the story?", options: ["Before", "After"] };
  await withPlatform({
    slug: slugOf("cc3"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: (args, n) => (n === 0
        ? { intent: "addon", alsoAsked: [W_VISIT_HOURS], targets: [{ change: 0, writes: FAQ_TARGETS }, { change: 1, writes: HOURS_TARGETS }] }
        : { intent: "addon" }),
      [T.adds]: (args) => (isHours(args)
        ? { kinds: ["component"], scopes: [{ kind: "component", words: W_VISIT_HOURS, uses: [] }] }
        : { kinds: ["component"], scopes: [{ kind: "component", words: W_ABOUT_FAQ, uses: [] }] }),
      "add:component": (args) => {
        if (designsHours(args)) return VISIT_HOURS_ANSWER;
        faqN++;
        return faqN === 1 ? { question: Q } : ABOUT_FAQ_ANSWER;
      },
      [T.pages]: (args) => (textOf(args).includes(VISIT_HOURS_ANSWER.component[0].does)
        ? { pages: [{ path: "src/routes/visit.tsx", source: VISIT_WITH_HOURS }] }
        : { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] }),
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_ABOUT_FAQ + ", and " + W_VISIT_HOURS + "." });
    const q0 = P.queue.splice(0);
    await Promise.all(q0.map((m) => deliver(P, m)));
    const s1 = await settle(P, r.key);
    assert.deepEqual(statuses(s1.rec), ["waiting", "done"], JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.page("visit.tsx").includes("Tuesday to Sunday, 8 till 2."), P.page("visit.tsx"));
    assert.equal(P.page("about.tsx"), ABOUT, "the waiting part changed About");
    const hoursJobs = (rec) => (rec.parts[1].jobs || []).filter((j) => j.kind === "run").map((j) => j.id);
    const doneRuns = hoursJobs(s1.rec);
    assert.equal(doneRuns.length, 1);
    // WHILE IT WAITS: one part told as done, the other as needing an answer — the question quoted, nothing claimed added, nothing told as failed.
    const before = factTexts(P);
    assert.ok(before.includes("Updated /visit."), JSON.stringify(P.replyLog));
    assert.ok(before.includes("Nothing was added yet; one detail is needed first."), JSON.stringify(P.replyLog));
    assert.ok(before.some((t) => t.includes("“" + Q.text + "”")), "the question was not given to the reply model");
    assert.ok(!before.includes("Updated /about."), "the waiting part was told as done");
    assert.deepEqual(before.filter((t) => NOT_DONE.test(t)), []);
    const logged = P.replyLog.length;
    const q = P.question();
    assert.ok(q && q.id, "no question was kept");
    await sendMessage(P, { message: "After", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.deepEqual(statuses(s2.rec), ["done", "done"], JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.page("about.tsx").includes("Do you deliver?"), P.page("about.tsx"));
    assert.ok(P.page("visit.tsx").includes("Tuesday to Sunday, 8 till 2."), "the finished part's work was lost");
    assert.deepEqual(hoursJobs(s2.rec), doneRuns, "the finished part was run again");
    assert.equal(faqN, 2, "the questions designer was not asked again once, with the answer");
    // AFTER THE ANSWER: only the resumed part's reply is new, and it says what it did.
    const after = P.replyLog.slice(logged).flat().map((f) => f.text);
    assert.ok(after.includes("Updated /about."), JSON.stringify(P.replyLog.slice(logged)));
    assert.ok(!after.includes("Updated /visit."), "the finished part was told again");
    assert.deepEqual(after.filter((t) => NOT_DONE.test(t)), []);
    uniqueRefs(P);
  });
});

// CC 4 / CC 5 — ONE PART FAILS, THE OTHER'S WORK STANDS.
async function oneFails({ failing, check }) {
  await withPlatform({
    slug: slugOf("cc-" + failing), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: (args, n) => (n > 0 ? { intent: "addon" }
        : { intent: "edit", layer: "text", page: "/", alsoAsked: [W_ABOUT_FAQ], targets: [{ change: 0, writes: ["page:/"] }, { change: 1, writes: FAQ_TARGETS }] }),
      // THE EDIT FAILS HONESTLY: its step finds nothing to change.
      [T.text]: async (args) => (failing === "edit" ? { edits: [] } : { edits: [{ id: homeLine(args), to: "Harbour Loaf Bakery" }] }),
      [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: W_ABOUT_FAQ, uses: [] }] },
      "add:component": ABOUT_FAQ_ANSWER,
      // THE ADD-ON FAILS ON OUR SIDE: its page writer's provider is overloaded.
      [T.pages]: async () => {
        if (failing === "addon") throw Object.assign(new Error("upstream 529"), { status: 529 });
        return { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] };
      },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_HOME_HEAD + ", and " + W_ABOUT_FAQ + "." });
    const q = P.queue.splice(0);
    await Promise.all(q.map((m) => deliver(P, m)));
    const { rec } = await settle(P, r.key);
    for (let i = 0; i < 3; i++) await settle(P, r.key);
    await check(P, P.record(r.key), r);
  });
}
test("CC 4 — THE ADD-ON PART FAILS ON OUR SIDE BESIDE A HEADING CHANGE: the heading lands and stays; About is untouched; nothing is charged for the failed part; the reply facts say the heading was changed and the section was not done, and nothing is claimed for it", { timeout: 30000 }, () => oneFails({
  failing: "addon",
  check: async (P, rec, r) => {
    assert.deepEqual(rec.parts.map((p) => [p.status, p.why]), [["done", null], ["failed", "generate"]]);
    assert.match(P.page("index.tsx"), /<h1>Harbour Loaf Bakery<\/h1>/);
    assert.equal(P.page("about.tsx"), ABOUT, "the failed addition changed About");
    assert.equal(P.page("visit.tsx"), VISIT);
    // ITS OWN ANSWER: nothing made, nothing published, nothing charged — the fixed sentence of a failure of ours.
    const job = P.jobsOf(r.key).find((j) => j.op === "addon");
    const ans = P.answerOf(job);
    assert.equal(ans.ok, false);
    assert.deepEqual(ans.outcome, { state: "none", published: false, database: "none" });
    assert.ok(typeof ans.msg === "string" && ans.msg.length > 0, "the failure carries no sentence of its own");
    assert.equal(reservesOf(P, job.id).length, 0, "the failed addition was charged");
    // THE FACTS: the heading's change; the section not done; nothing told as added.
    const texts = factTexts(P);
    assert.ok(texts.includes("Changed the wording; it now reads “Harbour Loaf Bakery”."), JSON.stringify(P.replyLog));
    assert.ok(texts.includes("Not done: “add a questions section to the About page” — its own reply above says why."), JSON.stringify(P.replyLog));
    assert.ok(!texts.some((t) => /Updated \/about|^Done: “add a questions/.test(t)), "the failed addition was told as done");
    uniqueRefs(P);
  },
}));
test("CC 5 — THE EDIT PART FAILS BESIDE AN ADD-ON: the section lands and stays; the home page is untouched; the reply facts say the section was added and the heading was not changed", { timeout: 30000 }, () => oneFails({
  failing: "edit",
  check: async (P, rec, r) => {
    assert.deepEqual(rec.parts.map((p) => [p.status, p.why]), [["failed", "no-match"], ["done", null]]);
    assert.equal(P.page("index.tsx"), HOME, "the failed edit changed the home page");
    assert.ok(P.page("about.tsx").includes("Do you deliver?"), P.page("about.tsx"));
    assert.equal(P.page("visit.tsx"), VISIT);
    const job = P.jobsOf(r.key).find((j) => j.op === "edit");
    assert.equal(reservesOf(P, job.id).length, 0, "the edit that changed nothing was charged");
    // THE FACTS: the edit's own failure, with nothing changed and nothing charged — and the section's success.
    const texts = factTexts(P);
    assert.ok(texts.some((t) => t.startsWith("The change was not made.")), JSON.stringify(P.replyLog));
    assert.ok(texts.includes("Nothing on their site changed."));
    assert.ok(texts.includes("This change cost them nothing."));
    assert.ok(texts.includes("Updated /about."));
    assert.ok(texts.includes("Done: “add a questions section to the About page” — its own reply above says what changed."), JSON.stringify(P.replyLog));
    assert.ok(texts.some((t) => /^Not done: “Please make the home heading say Harbour Loaf Bakery, and …” — its own reply above says why\.$/.test(t)), JSON.stringify(P.replyLog));
    uniqueRefs(P);
  },
}));

// CC 6 — AN ADD-ON JOB LOST JUST AFTER ITS CHARGE.
const PAST_LEASE = (90 + 60 + 15) * 1000;
test("CC 6 — THE ADD-ON PART'S JOB IS LOST JUST AFTER ITS CHARGE (the Add-on twin of P5): the sweep pays it back, the part runs once more from its preparation — no designer or picker asked again — the finished heading part is not run again; one section on About, one reply saying so, one net charge per job", { timeout: 30000 }, async () => {
  let pickN = 0, designN = 0, writeN = 0;
  await withPlatform({
    slug: slugOf("cc6"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: (args, n) => (n > 0 ? { intent: "addon" }
        : { intent: "edit", layer: "text", page: "/", alsoAsked: [W_ABOUT_FAQ], targets: [{ change: 0, writes: ["page:/"] }, { change: 1, writes: FAQ_TARGETS }] }),
      [T.text]: async (args) => ({ edits: [{ id: homeLine(args), to: "Harbour Loaf Bakery" }] }),
      [T.adds]: () => { pickN++; return { kinds: ["component"], scopes: [{ kind: "component", words: W_ABOUT_FAQ, uses: [] }] }; },
      "add:component": () => { designN++; return ABOUT_FAQ_ANSWER; },
      [T.pages]: () => { writeN++; return { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] }; },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_HOME_HEAD + ", and " + W_ABOUT_FAQ + "." });
    // THE ADD-ON'S OWN JOB'S RESERVE LANDS, AND THEN THE JOB IS GONE.
    const addonJob = () => P.jobsOf(r.key).find((j) => j.op === "addon");
    P.hang("edit_reserve", (a, out) => !!out && out.ok === true && out.charged > 0 && !!addonJob() && a && a.p_id === addonJob().id);
    const p1 = await pump(P);
    assert.equal(p1.hung, "edit_reserve", JSON.stringify(p1));
    P.recover();
    P.advance(PAST_LEASE);
    await tick(P);
    await tick(P);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const runs = P.jobsOf(r.key).filter((j) => j.op === "addon");
    assert.deepEqual(runs.map((j) => j.state + ":" + j.billing), ["lost:refunded", "done:finalized"]);
    // THE LOST JOB'S CHARGE CAME BACK; THE RERUN WAS CHARGED ONCE.
    const net = (id) => P.ledger.filter((e) => String(e.ref).split("#")[0] === id).reduce((a, e) => a + e.delta, 0);
    assert.equal(net(runs[0].id), 0, JSON.stringify(P.ledger));
    assert.equal(reservesOf(P, runs[1].id).length, 1);
    // NOTHING DONE TWICE: the edit once, the addition's preparation replayed by both runs.
    assert.equal(P.jobsOf(r.key).filter((j) => j.op === "edit").length, 1, "the finished heading part was run again");
    assert.equal(pickN, 1, "the picker was asked again");
    assert.equal(designN, 1, "the designer was asked again");
    assert.equal(faqParts(P), 1, P.page("about.tsx"));
    assert.match(P.page("index.tsx"), /<h1>Harbour Loaf Bakery<\/h1>/);
    // ONE REPLY FOR THE ADDITION, FROM THE RUN THAT FINISHED.
    const texts = factTexts(P);
    assert.equal(texts.filter((t) => t === "Updated /about.").length, 1, JSON.stringify(P.replyLog));
    assert.deepEqual(texts.filter((t) => NOT_DONE.test(t)), []);
    assert.equal(writeN, 1, "the page writer was asked again");
  });
});

// CC 7 — WHAT THE PUBLISHED PAGE SHOWED, CARRIED THROUGH A REQUEST'S BACKGROUND REPLY.
// CE 11 showed the three-way reading (stored / shown on load / interaction
// untried) through the Add-on route alone; here the addition is one part of a
// request beside an edit, so its reply is written in the background from the
// stored answer — the reading must reach the reply model's facts unchanged.
const FAQ_COLLAPSED = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { Faq } from '@/components/faq'\n"
  + "export const Route = createFileRoute('/about')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section><Faq items={[{ question: \"Do you deliver?\", answer: \"Yes, on Fridays to Clifton.\" }]} /></main> }\n";
const FAQ_REQ = { need: "The About page has a questions section answering whether we deliver", status: "covered", by: "the questions section answers it", item: "faq", kind: "component", basis: "asked", words: "a questions section" };
const judgeEntries = (args) => {
  const t = (args.messages || []).filter((m) => m && m.role === "user").map((m) => (typeof m.content === "string" ? m.content : (m.content || []).map((x) => (x && x.text) || "").join("\n"))).join("\n");
  const head = "The requirements the designers wrote down, one per line:\n";
  const at = t.indexOf(head);
  const out = [];
  for (const line of (at < 0 ? [] : t.slice(at + head.length).split("\n"))) { if (!line.startsWith("{")) break; try { out.push(JSON.parse(line)); } catch { break; } }
  return { out, step: /about to be handed to the (\S+) step/.test(t) };
};
async function collapsedInRequest(texts) {
  const compiler = installCompiler({ render: { ok: true, checked: 1, pages: 1, findings: [], ...(texts ? { texts } : {}) } });
  const P = platform({
    slug: slugOf("cc7"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: (args, n) => (n > 0 ? { intent: "addon" }
        : { intent: "edit", layer: "text", page: "/", alsoAsked: [W_ABOUT_FAQ], targets: [{ change: 0, writes: ["page:/"] }, { change: 1, writes: FAQ_TARGETS }] }),
      [T.text]: async (args) => ({ edits: [{ id: homeLine(args), to: "Harbour Loaf Bakery" }] }),
      [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: W_ABOUT_FAQ, uses: [] }] },
      "add:component": { component: [{ page: "/about", where: "after the story", does: "answers common questions", components: ["faq"] }], requirements: [FAQ_REQ] },
      judge_requirements: (args) => { const { out, step } = judgeEntries(args); return { verdicts: out.map((e) => (step ? { id: e.id, follows: "asked", carried: "unsure", reason: "before" } : { id: e.id, follows: "asked", carried: "yes", by: ["component:faq"], reason: "the questions section carries it" })) }; },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: FAQ_COLLAPSED }] },
    },
  });
  try {
    const r = await sendMessage(P, { message: "Please " + W_HOME_HEAD + ", and " + W_ABOUT_FAQ + "." });
    const q = P.queue.splice(0);
    await Promise.all(q.map((m) => deliver(P, m)));
    const { rec } = await settle(P, r.key);
    await P.settle();
    assert.deepEqual(P.unexpected, []);
    const job = P.jobsOf(r.key).find((j) => j.op === "addon");
    return { P, rec, ans: P.answerOf(job), texts: factTexts(P) };
  } finally { P.close(); compiler.uninstall(); }
}
test("CC 7 — A COLLAPSED SECTION ADDED AS ONE PART OF A REQUEST: the job's answer says it is in the code and not shown on first load, with the hidden answer; the background reply's facts say exactly that — and that opening it was not tried — never that it could not be seen; the heading part's facts are untouched", { timeout: 30000 }, async () => {
  const { rec, ans, texts, P } = await collapsedInRequest([{ route: "/about", text: "Our story Since 2019. Do you deliver?", complete: true }]);
  assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  assert.equal(ans.requirementsTold.length, 1, JSON.stringify(ans.requirementsTold));
  assert.equal(ans.requirementsTold[0].told, "behind", JSON.stringify(ans.requirementsTold));
  assert.deepEqual(ans.requirementsTold[0].hidden, [{ text: "Yes, on Fridays to Clifton.", placement: ["handed"] }]);
  assert.ok(texts.some((t) => /not shown when the published page first loads/.test(t) && /not checked/.test(t) && t.includes("Yes, on Fridays to Clifton.")), JSON.stringify(P.replyLog));
  assert.ok(!texts.some((t) => /can see whether this is in place/.test(t)), "the reading was lost on the way to the reply");
  assert.ok(texts.includes("Changed the wording; it now reads “Harbour Loaf Bakery”."));
});
test("CC 7b — THE SAME, WITH THE PUBLISHED PAGE UNREAD (no text from the render check): in the code, whether it shows not known — never shown, never missing", { timeout: 30000 }, async () => {
  const { ans, texts, P } = await collapsedInRequest(null);
  assert.equal(ans.requirementsTold[0].told, "in-code", JSON.stringify(ans.requirementsTold));
  assert.ok(texts.some((t) => /could not be read, so whether it shows is not known/.test(t)), JSON.stringify(P.replyLog));
  assert.ok(!texts.some((t) => /seen on the published page/.test(t) || /^Not done: The About page/.test(t)));
});
