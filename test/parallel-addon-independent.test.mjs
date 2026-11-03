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
// RE-ANCHORED 2026-10-24 (provider-retry re-landed): a provider 529 is now waited for
// and the job parked (the owner's design, docs/plans/2026-10-24-model-failures.md),
// so a call that must FAIL here fails on a refused request (400), which keeps its
// failure handling exactly as these cases test it.

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

/** Each job's reserve rows, by job id. */
const reservesByJob = (P) => {
  const by = {};
  for (const e of P.ledger) if (e.reason === "reserve") { const id = String(e.ref).split("#")[0]; by[id] = (by[id] || 0) + 1; }
  return by;
};

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

// ── THE SCOPED WRITER'S OUTPUT BOUNDARY (Codex on d7a00395) ─────────────────
// A writer shown only About that writes, or takes away, a page it was not
// shown. Answered here only while that page is NOT in its request: a writer
// re-asked with the whole site in front of it writes About alone.
const HOME_SHOWN = (args) => textOf(args).includes('className=\\"hero\\"');
const HOME_TOUCHED = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"hero-wide\"><h1>Harbour Loaf</h1></section></main> }\n";

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

// ── WHAT EACH DESIGNER WAITS FOR, AS A RULE (`designWaits`) ─────────────────
test("PI 27 — designWaits: a kind waits only for what it uses, shares words with, or (a schema kind) is written against; and for what those wait for; a kind the picker said nothing about waits as before", async () => {
  const { designWaits, readAddUses } = await import("../builder/site-add.mjs");
  // Independent: nothing waits.
  assert.deepEqual(designWaits(["table", "component"], { scopes: { table: "a signups table", component: "a questions section" }, uses: { table: [], component: [] } }), { table: [], component: [] });
  // Declared use.
  assert.deepEqual(designWaits(["table", "component"], { uses: { table: [], component: ["table"] } }).component, ["table"]);
  // One phrase for two kinds ("a booking page" is a page and a table).
  assert.deepEqual(designWaits(["table", "page"], { scopes: { table: "a booking page", page: "a booking page" }, uses: { table: [], page: [] } }).page, ["table"]);
  // NO CHAIN BY CATEGORY (the scheduler round): a function that reads no table and a page that calls no new function wait for nothing…
  // (A job was the third link until the job kind went, 2026-10-29; a page that calls the function is now.)
  const free = designWaits(["table", "function", "page", "component"], { uses: { table: [], function: [], page: [], component: [] } });
  assert.deepEqual(free, { table: [], function: [], page: [], component: [] });
  // …and a function that reads the new table, and a page that calls the new function, say so and wait — transitively.
  const chain = designWaits(["table", "function", "page"], { uses: { table: [], function: ["table"], page: ["function"] } });
  assert.deepEqual(chain, { table: [], function: ["table"], page: ["table", "function"] });
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

// AFTER P1: S7's shape as the real router answered it — a new page as one
// Add-on part and a questions section on another page held back as a second
// Add-on part. THEY ARE NOT INDEPENDENT AS PARTS: a scoped addition reads the
// site's page list (its picker is shown which pages there are), and a new page
// changes it, so the section's preparation waits for the page's part
// (`clearToPrepare`). This records that wait, so no plan claims overlap for
// this message; the across-parts case is S8 (PI 29, `acc-addon-edit`).
const DELIVERY_TARGETS = ["new-page:/delivery"];

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
        if (failing === "addon") throw Object.assign(new Error("upstream 400"), { status: 400 });
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

// CC 6 — AN ADD-ON JOB LOST JUST AFTER ITS CHARGE.
const PAST_LEASE = (90 + 60 + 15) * 1000;

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
