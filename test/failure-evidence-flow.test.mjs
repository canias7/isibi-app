// WHAT STANDS AFTER A JOB ENDS BADLY, THROUGH THE REAL WORKER (2026-10-07).
//
// Two exits the request flow's own cases did not reach:
//
//   REPLY  a job's stored answer replaced after its reply was written — the
//          reconcile stores its own over the route's — must never be served
//          the earlier answer's reply: each reply record names the answer it
//          was written from (`replyTag`), and a changed answer is asked again.
//   DEAD   a job that died with no answer of its own after an addition's
//          tables went in: the poll hands back its database record and the
//          note that says it, and its request part keeps what stands across
//          its retry (`endedEvidence`, `leftOfRecord`).
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer is supplied.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, pump, tick, call, readWritten, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { MIGRATIONS_KEY, newMigration, withApplied, readMigrations } from "../builder/site-migrations.mjs";
import { page as openPage, settle as pageTick } from "./fixtures/browser-page.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";

const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const GALLERY = { route: [{ intent: "addon" }], [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } };
const slugOf = (k) => "fe-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}
const PAST_LEASE = (90 + 60 + 15) * 1000;

test("REPLY 1 — A JOB'S STORED ANSWER REPLACED AFTER ITS REPLY WAS WRITTEN: the next read asks for a reply again and serves the one written from the answer stored now — never the earlier answer's reply", async () => {
  await withPlatform({ slug: slugOf("reply1"), replies: true, answers: GALLERY }, async (P) => {
    const r = await sendMessage(P, { message: "add a gallery page" });
    await settle(P, r.key);
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    const first = await readWritten(P, "/api/site/edit/" + job.id);
    assert.equal(first.body.replySource, "model", "the first reply was not written");
    const firstFacts = P.factsOf(first.body.reply);
    assert.ok(firstFacts && firstFacts.length, "the first reply's facts were not found");
    // THE ANSWER IS REPLACED, AS THE RECONCILE REPLACES ONE: a refusal that
    // kept the route's reply context, so a reply is owed for it too.
    const prior = JSON.parse(job.result.body);
    const replaced = { ok: false, error: "reconciled", kind: "never-activated", job: job.id, refunded: 0, msg: "That change stopped while it was being published and never went live — your site's pages are as they were. Ask again.", replyFor: prior.replyFor };
    job.result = { ...job.result, status: 409, body: JSON.stringify(replaced) };
    const next = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.notEqual(next.body.reply, first.body.reply, "the earlier answer's reply was served for the answer stored now");
    assert.equal(next.body.replyState, "pending", "the reply was not asked for again");
    const after = await readWritten(P, "/api/site/edit/" + job.id);
    assert.equal(after.body.replySource, "model");
    assert.notEqual(after.body.reply, first.body.reply);
    const facts = P.factsOf(after.body.reply);
    assert.ok(facts && facts.some((f) => /never went live/.test(f.text)), "the new reply was not written from the answer stored now: " + JSON.stringify(facts));
    // AND IT STAYS: a third read serves the same reply, asking for nothing.
    const sent = P.queue.length;
    const third = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(third.body.reply, after.body.reply);
    assert.equal(P.queue.length, sent, "a settled reply was asked for again");
  });
});

test("DEAD 1 — AN ADDITION'S JOB DIES WITH NO ANSWER AFTER ITS TABLES WENT IN: the sweep ends it lost; the poll hands back its database record, settled without its page, and the note that says so; its part keeps what stands and is tried again; the retry's success speaks for the part", async () => {
  await withPlatform({ slug: slugOf("dead1"), replies: true, answers: GALLERY }, async (P) => {
    const r = await sendMessage(P, { message: "add a gallery page" });
    P.hang("edit_reserve", (a, out) => !!out && out.ok === true && out.charged > 0);
    assert.equal((await pump(P)).hung, "edit_reserve");
    const first = [...P.jobs.values()].find((j) => j.op === "addon");
    // WHAT THE JOB HAD DONE BEFORE IT DIED: its database record filed, the
    // engine's report on it (`withApplied`), as the route writes it.
    await P.bucket.put(MIGRATIONS_KEY(P.slug), JSON.stringify({ at: "t", slug: P.slug, migrations: [withApplied(newMigration({ job: first.id, slug: P.slug, added: ["gallery_items"] }), ["gallery_items"])] }));
    P.recover();
    P.advance(PAST_LEASE);
    await tick(P);
    assert.equal(P.jobs.get(first.id).state, "lost", "the sweep did not end the dead job");
    const poll = await call(P, "GET", "/api/site/edit/" + first.id);
    assert.equal(poll.body.migration && poll.body.migration.status, "applied_without_page", JSON.stringify(poll.body));
    assert.match(poll.body.note || "", /The database changes for this were made — now storing gallery_items — but the page didn't publish/);
    const stored = readMigrations(JSON.parse((await (await P.bucket.get(MIGRATIONS_KEY(P.slug))).text())));
    assert.equal(stored.find((m) => m.job === first.id).status, "applied_without_page", "the record was not settled from its evidence");
    // ANOTHER DEVICE FOLLOWING THE JOB, THROUGH THE REAL POLL ROUTE: its ended
    // sentence carries the server's note verbatim (`siteJobFollow`).
    const p = openPage({
      site: { id: "origin-1", slug: P.slug, react: true, name: "Harbour Loaf", url: "https://" + P.slug + ".gofarther.app/", pages: [{ path: "/" }], msgs: [] },
      timers: true,
      answer: (url, method, body) => call(P, method, url, body).then((x) => ({ status: x.status, body: x.body, headers: x.headers ? Object.fromEntries(x.headers) : {} })),
    });
    p.ctx.siteJobDiscovered("origin-1", { job: first.id, op: "addon", state: "editing", words: "add a gallery page", at: 1, progress: [] });
    const toldOf = () => p.said().find((m) => m && !m.jobCard && Array.isArray(m.jobs) && m.jobs.includes(first.id));
    for (let i = 0; i < 6 && !toldOf(); i++) { p.flush(); await pageTick(400); }
    assert.ok(toldOf(), "the other device said nothing for the ended job: " + JSON.stringify(p.said()));
    assert.ok(toldOf().t.startsWith("⚠️ ") && toldOf().t.endsWith(" " + poll.body.note), "the ended sentence does not carry the server's note: " + toldOf().t);
    // THE PART KEPT WHAT STANDS while it was tried again.
    const mid = P.record(r.key);
    assert.equal(mid.parts[0].left, "partial", JSON.stringify(mid.parts[0]));
    const { rec } = await settle(P, r.key);
    assert.deepEqual(rec.parts.map((p) => p.status), ["done"]);
    assert.equal(Object.hasOwn(rec.parts[0], "left"), false, "a finished retry kept the first try's mark");
  });
});

test("DEAD 2 — A JOB THAT DIED BEFORE THE ENGINE REPORTED: its record fails rather than claim a table, the note says some of the change may have gone in, and its part keeps that as not known", async () => {
  await withPlatform({ slug: slugOf("dead2"), answers: GALLERY }, async (P) => {
    const r = await sendMessage(P, { message: "add a gallery page" });
    P.hang("edit_reserve", (a, out) => !!out && out.ok === true && out.charged > 0);
    await pump(P);
    const first = [...P.jobs.values()].find((j) => j.op === "addon");
    await P.bucket.put(MIGRATIONS_KEY(P.slug), JSON.stringify({ at: "t", slug: P.slug, migrations: [newMigration({ job: first.id, slug: P.slug, added: ["gallery_items"] })] }));
    P.recover();
    P.advance(PAST_LEASE);
    await tick(P);
    const poll = await call(P, "GET", "/api/site/edit/" + first.id);
    assert.equal(poll.body.migration && poll.body.migration.status, "failed");
    assert.match(poll.body.note || "", /some of that change may already have gone in/);
    assert.equal(P.record(r.key).parts[0].left, "unknown");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A STOP AT A GATE AND THE DEVELOPER RECORD, THROUGH THE QUEUED ROUTE
// ─────────────────────────────────────────────────────────────────────────────

const SIGNUP = "Add a sign-up page where people leave their name and email address";
const SIGNUP_ANSWERS = (pages) => ({
  route: [{ intent: "addon" }],
  [T.adds]: { kinds: ["table", "page"] },
  "add:table": { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }] }, seed: [] }] },
  "add:page": { page: [PAGE("/sign-up", "Sign up")] },
  [T.pages]: pages,
});
const addonJobOf = (P) => [...P.jobs.values()].find((j) => j.op === "addon");

test("STOP 1 — AN ADDITION STOPPED AT ITS PUBLISH GATE AFTER A DATABASE WAS MADE FOR THE SITE: the stored stop carries the outcome its own evidence gives — a database made, nothing in it, nothing published — and its coverage; its request part is stopped, never told as stopped before anything changed; one project was made", async () => {
  const compiler = installCompiler();
  let P = null;
  P = platform({
    slug: slugOf("stop1"), provisions: true, db: rowsDb({ tables: {} }),
    // THE CUSTOMER STOPS IT WHILE ITS PAGES ARE BEING WRITTEN: the next gate
    // (before the publish, after the database was made) reads the stop.
    answers: SIGNUP_ANSWERS(async () => {
      const c = await call(P, "DELETE", "/api/site/edit/" + addonJobOf(P).id);
      assert.equal(c.status, 200, "the stop was not taken: " + JSON.stringify(c.body));
      // THE HEARTBEAT A STEP THIS LONG HAS, which is how the job hears it.
      await P.beatNow();
      return { pages: [writtenPage("/sign-up")] };
    }),
  });
  try {
    const r = await sendMessage(P, { message: SIGNUP + "." });
    const { rec } = await settle(P, r.key);
    const job = addonJobOf(P);
    const answer = JSON.parse(job.result.body);
    assert.deepEqual([answer.ok, answer.error], [false, "cancelled"], JSON.stringify(answer).slice(0, 400));
    assert.equal(P.neon.projects.length, 1, "the case did not make the site's database: " + JSON.stringify(P.neon.calls));
    assert.deepEqual(answer.outcome, { state: "partial", published: false, database: "none", provisioned: true }, "the stop does not carry what its own evidence gives");
    // AND THE COVERAGE THE GATE COMPOSES AGAINST THAT OUTCOME (no requirement
    // was written down here, so there is no outcome list to carry).
    assert.ok(answer.coverage && typeof answer.coverage === "object", "the stop carries no coverage: " + JSON.stringify(answer).slice(0, 300));
    const part = rec.parts.find((p) => p.status === "cancelled");
    assert.ok(part, JSON.stringify(rec.parts.map((p) => p.status)));
    assert.equal(part.left, "partial", "the stopped part lost what stands");
  } finally { P.close(); compiler.uninstall(); }
});

test("RECORD 1 — THE DEVELOPER RECORD NAMES THE ADDITION UNDER WAY AND HOW IT ENDED: while its designer is working it is this addition's, being designed — never the previous addition's; a designer call that did not go through is written onto it as failed; a designer's question as asked", async () => {
  const KEY = (slug) => "source/" + slug + "/addon-answer.json";
  const read = (P) => JSON.parse(P.objects.get(KEY(P.slug)).body);
  const earlier = (P) => P.bucket.put(KEY(P.slug), JSON.stringify({ at: "t", slug: P.slug, message: "an earlier addition", kinds: ["page"], coverage: { counts: {} } }));
  // WHILE IT IS DESIGNED.
  {
    let reach, open;
    const reached = new Promise((x) => { reach = x; });
    const opened = new Promise((x) => { open = x; });
    const P = platform({ slug: slugOf("rec-designing"), answers: { ...GALLERY, "add:page": async () => { reach(); await opened; return { page: [PAGE("/gallery", "Gallery")] }; } } });
    try {
      await earlier(P);
      const r = await sendMessage(P, { message: "add a gallery page" });
      const done = settle(P, r.key);
      await reached;
      const mid = read(P);
      assert.deepEqual([mid.message, mid.state], ["add a gallery page", "designing"], "the record still told the previous addition: " + JSON.stringify(mid).slice(0, 200));
      open();
      await done;
      assert.notEqual(read(P).state, "designing", "the record still says designing after the addition ended");
    } finally { P.close(); }
  }
  // A DESIGNER CALL THAT DID NOT GO THROUGH (no answer for it: the call fails).
  {
    const { "add:page": _gone, ...noDesigner } = GALLERY;
    const P = platform({ slug: slugOf("rec-failed"), answers: noDesigner });
    try {
      await earlier(P);
      const r = await sendMessage(P, { message: "add a gallery page" });
      await settle(P, r.key);
      const rec = read(P);
      assert.deepEqual([rec.message, rec.state, rec.error], ["add a gallery page", "failed", "send"], JSON.stringify(rec).slice(0, 300));
    } finally { P.close(); }
  }
  // A DESIGNER THAT ASKED.
  {
    const P = platform({ slug: slugOf("rec-asked"), answers: { ...GALLERY, "add:page": { question: { text: "Which photos should it show?", options: ["Bakes", "The shop"] } } } });
    try {
      await earlier(P);
      const r = await sendMessage(P, { message: "add a gallery page" });
      await settle(P, r.key);
      const rec = read(P);
      assert.deepEqual([rec.message, rec.state], ["add a gallery page", "asked"], JSON.stringify(rec).slice(0, 300));
    } finally { P.close(); }
  }
});
