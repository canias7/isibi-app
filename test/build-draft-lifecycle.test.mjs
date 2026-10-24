// A REWRITE SAVED AS A DRAFT, THROUGH ITS REAL LIFECYCLE (2026-10-16, Codex's
// review of `fd951ba3`).
//
// The approved rewrite of a request part runs the existing queued build — its
// row, its consumer, its design call, its page writer, its compile, its
// activation and its charging. Under draft-first that activation saves a
// draft revision. These cases stop it at each boundary and let the platform's
// own sweep and lost-build recovery settle it:
//
//   BDL1  no fault: the part is done as draft revision N (not published), the
//         part that needs it runs after it, nothing is live until Publish.
//   BDL2  the build stops after its draft record lands, BEFORE its completion
//         marker: the row is swept lost, recovery settles it `saved` from its
//         own revision — kept, never reversed, one design, one charge — the
//         part is done as a saved draft and its dependant runs; repeated
//         ticks and deliveries change nothing; Publish then makes it live.
//   BDL3  the build stops AFTER its completion marker (`markSaved`): the same,
//         and the marker records a save, never a publication.
//   BDL4  the draft record's answer is lost (it landed): the build proves its
//         own revision and finishes as saved — no lost row, no recovery, one
//         charge.
//   BDL6  a FIRST build under draft-first, through the real consumer and
//         resume: it saves revision 1 and records `saved`; then each crash's
//         durable state — no answer and no marker, no answer after the
//         marker, and the marker the earlier code wrote (`published`) — is
//         settled by the real recovery as `saved`: kept, nothing reversed,
//         no pointer, told as a draft; repeated passes change nothing.
//   BDL5  a failure before saving (the draft record cannot be written): the
//         build is not saved, no pages are charged (the design's deposit
//         stands, Build's existing rule), and the part is not done, so its
//         dependant never runs.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, pump, tick, call, settle, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { VISIT, page as pageSrc } from "./fixtures/live-ask.mjs";
import { DRAFT_KEY } from "../site-draft.mjs";
import { buildBucket, GOOD_DESIGN, BUILD_USER } from "./fixtures/build-route.mjs";
import { ledger as buildLedgerStub, fireInterim, finishResume } from "./fixtures/build-lifecycle.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { resultKey, readResult } from "../builder/build-job.mjs";

async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}
const statuses = (rec) => rec.parts.map((p) => p.status);
const DESC = "Change the site description to say we bake overnight sourdough";
const NEW_DESC = "Overnight sourdough from a Bristol side street.";
const ADD = "add a gallery page";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const GALLERY = { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } };
const DESCRIBE = { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": NEW_DESC };
const slugOf = (k) => "bdl-" + k + "-" + Math.random().toString(16).slice(2, 8);
const MANY = Array.from({ length: 610 }, (_, i) => "<p>Line " + (i + 1) + " of our story.</p>").join("");
const BIG = [{ path: "index.tsx", source: pageSrc("/", "<section>" + MANY + "</section>") }, { path: "visit.tsx", source: VISIT }];
const WARM = pageSrc("/", "<section><p>A warmer story, line by line.</p></section>");
const REWORD = "Reword every line to sound warmer";
function rewriteAnswers(slug, { route, gallery = false, extra = {} } = {}) {
  return {
    route, ...(gallery ? GALLERY : {}), ...extra,
    design_schema: { brand: "Harbour Loaf", slug, description: "a bakery", kind: "shopfront", purpose: "visit", pages: [{ path: "/", name: "Home" }, { path: "/visit", name: "Visit" }], components: [], css: "" },
    [T.pages]: (args, n) => (gallery && n === 0 ? { pages: [writtenPage("/gallery")] } : { pages: [{ path: "src/routes/index.tsx", source: WARM }], notes: "Rewrote the home page." }),
  };
}
// PART 0 IS ROUTED AGAIN ONCE PART 2 HAS RUN AND ANSWERS "build" — the full
// rewrite the router chose, the one way a part reaches the go-ahead since
// 2026-10-24 (a climb no longer does: the owner's decision). PART 1 NEEDS
// PART 0; PART 2 IS INDEPENDENT.
const WAITING_ROUTE = [
  { intent: "edit", layer: "text", alsoAsked: [DESC, ADD], dependsOn: [{ change: 1, after: [0] }, { change: 0, after: [2] }] },
  { intent: "addon" },
  { intent: "build" },
  { intent: "edit", layer: "look" },
];
const WAITING_MSG = REWORD + ", then " + DESC + ", and " + ADD + ".";
const buildable = (P) => { P.env.NEON_API_KEY = "neon-test"; P.env.SITE_BUILD_CONTAINER = {}; };
const approve = (P, key, part = 0) => call(P, "POST", "/api/site/request/" + P.slug + "/" + key + "/approve", { part });
const builds = (P) => [...P.jobs.values()].filter((j) => j.op === "build");
const designs = (P) => P.modelLog.filter((m) => m.tool === "design_schema").length;
const buildRows = (P) => P.ledger.filter((e) => e.ref.startsWith("build:"));
const reversals = (P) => buildRows(P).filter((e) => e.delta > 0);
const pointer = (P) => P.readObj("current/" + P.slug + ".json");
const draftOf = (P) => { const t = P.readObj(DRAFT_KEY(P.slug)); return t ? JSON.parse(String(t).replace(/\n[ \t]+$/, "")) : null; };
const fenceOf = (P, id) => { const t = P.readObj("jobs/" + id + ".fence.json"); return t ? JSON.parse(t) : null; };
const answerOf = (P, id) => { const t = P.readObj("jobs/" + id + ".result.json"); return t ? JSON.parse(JSON.parse(t).body) : null; };

/** The request waiting on its go-ahead, with draft-first switched on before the press. */
async function waiting(P) {
  buildable(P);
  const r = await sendMessage(P, { message: WAITING_MSG });
  const { rec } = await settle(P, r.key);
  assert.deepEqual(statuses(rec), ["approval", "blocked", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  P.env.DRAFT_FIRST = "on";
  return r;
}
/** After a stop: past the lease and the sweep's grace, the cron until the request ends. */
async function afterStop(P, key, { rounds = 16 } = {}) {
  P.recover();
  for (let i = 0; i < rounds; i++) {
    P.advance(4 * 60 * 1000);
    await tick(P);
    await pump(P);
    const rec = P.record(key);
    if (rec && rec.ended) return rec;
  }
  return P.record(key);
}
/** The rewrite settled as a saved draft: one build, one design, kept, its part done as a draft, its dependant done, nothing live. */
function savedRewrite(P, rec, id, live0) {
  assert.deepEqual(builds(P).map((b) => b.id), [id], "not one build");
  assert.equal(designs(P), 1, "the rewrite ran more than once");
  assert.ok(buildRows(P).some((e) => e.delta < 0), "the rewrite charged nothing");
  assert.deepEqual(reversals(P), [], "a saved rewrite was refunded");
  const d = draftOf(P);
  const mine = d && d.revs.find((x) => x.job === id);
  assert.ok(mine, "no draft revision of the build's own");
  const p0 = rec.parts[0];
  assert.equal(p0.status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  assert.equal(p0.outcome.draft && p0.outcome.draft.revision, mine.n, JSON.stringify(p0.outcome));
  assert.match(p0.done, new RegExp("saved them as draft revision " + mine.n + " \\(not published\\)"), p0.done);
  assert.deepEqual(statuses(rec), ["done", "done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  assert.equal(pointer(P), live0, "the live pointer moved without Publish");
  return mine;
}

test("BDL1 NO FAULT — the approved rewrite saves draft revision N: its part is done as a saved draft (not published), the part that needs it runs after it, and nothing is live until Publish", async () => {
  const slug = slugOf("1");
  await withPlatform({ slug, pages: BIG, answers: rewriteAnswers(slug, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    const r = await waiting(P);
    const live0 = pointer(P);
    assert.equal((await approve(P, r.key)).status, 200);
    const { rec } = await settle(P, r.key, { rounds: 20 });
    const id = builds(P)[0].id;
    const mine = savedRewrite(P, rec, id, live0);
    assert.deepEqual([fenceOf(P, id).saved, fenceOf(P, id).published], [mine.version, undefined], "the build recorded a draft save as a publication");
    const a = answerOf(P, id);
    assert.deepEqual([a.draft.published, a.draft.revision], [false, mine.n]);
    assert.deepEqual([a.buildFacts.checks.published, a.buildFacts.checks.draft, a.buildFacts.checks.revision], [false, true, mine.n], JSON.stringify(a.buildFacts && a.buildFacts.checks));
  });
});

for (const [name, when] of [["BDL2", "before"], ["BDL3", "after"]]) {
  test(name + " A HARD STOP " + when.toUpperCase() + " THE COMPLETION MARKER — the row is swept lost and recovery settles it `saved` from its own revision: kept, one design, one charge, the part done as a saved draft and its dependant run; repeated ticks and deliveries change nothing; Publish then makes it live", async () => {
    const slug = slugOf(name.toLowerCase());
    await withPlatform({ slug, pages: BIG, answers: rewriteAnswers(slug, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
      const r = await waiting(P);
      const live0 = pointer(P);
      if (when === "before") P.hangPut((k) => k === DRAFT_KEY(P.slug));
      else P.hangPut((k, body) => /^jobs\/[0-9a-f]{32}\.fence\.json$/.test(k) && String(body).includes('"saved"'));
      assert.equal((await approve(P, r.key)).status, 200);
      let hung = null;
      for (let i = 0; i < 10 && !hung; i++) { const x = await pump(P); if (x && x.hung) hung = x.hung; }
      assert.ok(hung, "the build never reached the stop");
      const id = builds(P)[0].id;
      if (when === "before") assert.equal(fenceOf(P, id).saved, undefined, "a marker was written before the stop");
      else assert.equal(typeof fenceOf(P, id).saved, "string");
      const rec = await afterStop(P, r.key);
      assert.equal(builds(P)[0].state, "lost", "the build row was not swept lost: " + builds(P)[0].state);
      const mine = savedRewrite(P, rec, id, live0);
      const a = answerOf(P, id);
      assert.equal(a.lost, true);
      assert.deepEqual([a.draft.published, a.draft.revision, a.page], [false, mine.n, "app"]);
      assert.doesNotMatch(String(a.msg), /did go live|went live/);
      assert.equal(fenceOf(P, id).published, undefined);
      // ONCE: more ticks, a duplicate delivery.
      const ledgerN = P.ledger.length;
      const stored = P.readObj("jobs/" + id + ".result.json");
      for (let i = 0; i < 3; i++) { P.advance(4 * 60 * 1000); await tick(P); await pump(P, { twice: true }); }
      assert.equal(P.ledger.length, ledgerN, "a repeated tick moved money");
      assert.equal(P.readObj("jobs/" + id + ".result.json"), stored, "a repeated tick rewrote the answer");
      assert.equal(designs(P), 1);
      // PUBLISH THE REVISION.
      const pub = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: mine.n, version: mine.version });
      assert.equal(pub.status, 200, JSON.stringify(pub.body));
      assert.equal(JSON.parse(pointer(P)).version, mine.version, "Publish did not make the saved rewrite live");
    });
  });
}

test("BDL4 THE DRAFT RECORD'S ANSWER IS LOST (it landed) — the build proves its own revision and finishes as saved: no lost row, no recovery, one design, one charge, nothing live", async () => {
  const slug = slugOf("4");
  await withPlatform({ slug, pages: BIG, answers: rewriteAnswers(slug, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    const r = await waiting(P);
    const live0 = pointer(P);
    P.losePut((k) => k === DRAFT_KEY(P.slug));
    assert.equal((await approve(P, r.key)).status, 200);
    const { rec } = await settle(P, r.key, { rounds: 20 });
    const id = builds(P)[0].id;
    assert.equal(builds(P)[0].state, "done", "the build did not finish: " + builds(P)[0].state);
    savedRewrite(P, rec, id, live0);
    assert.equal(P.readObj("jobs/" + id + ".lost.json"), null, "recovery settled a build that finished");
  });
});

test("BDL5 A FAILURE BEFORE SAVING — the draft record cannot be written: nothing of the build is in the draft, no pages charged (the deposit stands, as before), the part is not done and its dependant never runs; nothing live", async () => {
  const slug = slugOf("5");
  await withPlatform({ slug, pages: BIG, answers: rewriteAnswers(slug, { route: WAITING_ROUTE, gallery: true, extra: DESCRIBE }) }, async (P) => {
    const r = await waiting(P);
    const live0 = pointer(P);
    for (let i = 0; i < 4; i++) P.failPut((k) => k === DRAFT_KEY(P.slug));
    assert.equal((await approve(P, r.key)).status, 200);
    const { rec } = await settle(P, r.key, { rounds: 20 });
    const id = builds(P)[0].id;
    const d = draftOf(P);
    assert.equal(!!(d && d.revs.some((x) => x.job === id)), false, "a revision of a save that never landed");
    assert.notEqual(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.notEqual(rec.parts[1].status, "done", "the dependant ran though its prerequisite was not saved");
    assert.equal(fenceOf(P, id) && fenceOf(P, id).saved, undefined);
    assert.equal(pointer(P), live0);
    assert.equal(designs(P), 1, "the rewrite was generated again");
    // BUILD'S EXISTING MONEY RULE, UNCHANGED: the pages are charged only for
    // a site written; the design's deposit stands; nothing reversed twice.
    assert.equal(buildRows(P).filter((e) => /:pages$/.test(e.ref)).length, 0, "pages were charged for a build that saved nothing");
    assert.deepEqual(buildRows(P).map((e) => [e.ref.split(":").pop(), e.reason]), [["deposit", "debit"]]);
    assert.equal(rec.parts[0].why, "rewrite-not-written");
  });
});

test("BDL6 A FIRST BUILD UNDER DRAFT-FIRST, THROUGH THE REAL CONSUMER AND RESUME — revision 1 saved and recorded `saved`; then each crash's durable state (no answer and no marker; no answer after the marker; the earlier code's `published` marker) is settled by recovery as `saved`: kept, nothing reversed, no pointer, told as a draft; repeated passes change nothing", async () => {
  const FIRST_PAGE = "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/')({ component: Page });\nfunction Page() { return (<main><h1>Fold Lane</h1><p>Opening hours: 7–2.</p></main>); }\n";
  const { reconcileLostBuilds } = await loadWorkerModule();
  const slug = GOOD_DESIGN.slug;
  for (const crash of ["before-marker", "after-marker", "earlier-marker"]) {
    const b = buildBucket();
    const id = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join("");
    const led = buildLedgerStub();
    await fireInterim(b, id, led, { design: GOOD_DESIGN, env: { DRAFT_FIRST: "on" } });
    await finishResume(b, id, led, { credits: 400, source: FIRST_PAGE, env: { DRAFT_FIRST: "on" } });
    assert.equal(b.store.has("current/" + slug + ".json"), false, "a first build under draft-first moved the pointer");
    const d = JSON.parse(b.store.get(DRAFT_KEY(slug)));
    const mine = d.revs.find((r) => r.job === id);
    assert.ok(mine, "the first build saved no revision of its own");
    const fenceKey = "jobs/" + id + ".fence.json";
    const f = JSON.parse(b.store.get(fenceKey));
    assert.deepEqual([f.saved, f.revision, f.published], [mine.version, mine.n, undefined], crash + ": the build recorded its draft save as a publication");
    // THE BUILD'S OWN ANSWER (the resume's) says a saved draft, not a publication.
    const own = JSON.parse(readResult(JSON.parse(b.store.get(resultKey(id)))).body);
    assert.deepEqual([own.ok, own.draft && own.draft.published, own.draft && own.draft.revision], [true, false, mine.n], crash + ": the resumed build's own answer carries no draft facts: " + JSON.stringify(Object.keys(own)));
    // THE CRASH'S DURABLE STATE: the answer was never written, and the marker as each case left it.
    b.store.delete(resultKey(id));
    if (crash === "before-marker") b.store.set(fenceKey, JSON.stringify({ by: "publish", at: f.at }));
    if (crash === "earlier-marker") b.store.set(fenceKey, JSON.stringify({ by: "publish", published: mine.version, at: f.at }));
    const row = { id, uid: BUILD_USER.id, slug, op: "build", state: "lost", created_at: "2026-10-08T11:00:00Z", updated_at: "2026-10-08T11:10:00Z" };
    const calls = [];
    const pass = async () => {
      const real = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        const u = String((input && input.url) || input || "");
        if (/\/rest\/v1\/rpc\/credit_reverse/.test(u)) { calls.push(u); return new Response(JSON.stringify(led.answer(JSON.parse(String((init && init.body) || "{}")))), { status: 200 }); }
        if (u.includes("/rest/v1/edit_jobs")) return new Response(JSON.stringify([row]), { status: 200 });
        return new Response("[]", { status: 200 });
      };
      try { return await reconcileLostBuilds({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", SITES_BUCKET: b }, { now: Date.parse("2026-10-08T12:00:00Z") }); }
      finally { globalThis.fetch = real; }
    };
    const seen = await pass();
    assert.equal(seen.saved, 1, crash + ": " + JSON.stringify(seen));
    const a = JSON.parse(readResult(JSON.parse(b.store.get(resultKey(id)))).body);
    assert.deepEqual([a.ok, a.page, a.draft && a.draft.published, a.draft && a.draft.revision], [true, "app", false, mine.n], crash + ": " + JSON.stringify(a).slice(0, 300));
    assert.doesNotMatch(String(a.msg), /did go live|went live/, crash + ": a saved first build was told as live");
    assert.deepEqual(calls, [], crash + ": a saved first build was refunded");
    assert.equal(b.store.has("current/" + slug + ".json"), false);
    const stored = b.store.get(resultKey(id));
    for (let i = 0; i < 2; i++) await pass();
    assert.equal(b.store.get(resultKey(id)), stored, crash + ": a repeated pass rewrote the answer");
    assert.deepEqual(calls, []);
  }
});
