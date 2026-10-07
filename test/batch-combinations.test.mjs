// THE CLEANUP BATCH'S COMBINATIONS, THROUGH THE REAL REQUEST FLOW (2026-10-07).
//
// The owner: *"Test the meaningful combinations, not just isolated happy
// paths: mixed Edit/Add-on requests touching the same target, one successful
// part followed by a failed or questioning part, persistent database changes
// followed by publish failure, cancellation or budget stop after partial
// application, requirements exceeding former cutoffs, duplicate delivery and
// crash recovery without double charging, and completion followed from
// another session."*
//
// Most of those already have their own evidence, kept where it was written
// (the handoff's checklist names each): a part's question beside a part that
// goes on (request-flow C2), Stop after a part finished or while publishing
// (H2, H3), a stop after the tables went in (addon-failure-outcome STATUS 2), a
// job that died after its tables went in (STATUS 4), every job delivered twice
// (I3), crashes around the charge and the publish (J1–J3), requirements past
// what one step keeps track of (no-silent-loss LIMIT 1–2), and the next try
// after a database left unrecorded (late-provision PROV 10). What these cases
// add is the crossing of this batch's changes in ONE request, followed to the
// end by the real Worker, its queue consumer, the request's driver and — for
// the last — a fresh page reading it all back:
//
//   * an edit that lands and an addition whose publish is refused AFTER its
//     table went in: the part done, the part done in part (never wholly
//     failed), what is live and what is not told, the money exact;
//   * the same with every job delivered twice: one apply, one charge each;
//   * the same read back by a fresh session: each part's reply once, the card
//     saying what each part's job really did, the preview moved once for both,
//     no undo offered for another session's work, and nothing said or moved
//     again on another look. (The table the refused addition left standing is
//     not added to the page's table list when its failure is read: that list is
//     the router's hint, and the routing route reads the site's own inventory
//     and hands it back on the next message — recorded as a remaining gap.)
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer is the case's.
import test from "node:test";
import assert from "node:assert/strict";
import { page, settle as drain, copy } from "./fixtures/browser-page.mjs";
import { platform, sendMessage, settle, pump, T } from "./fixtures/request-flow.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";
import { requestReplyFacts } from "../builder/site-reply.mjs";

const DESC = "Change the site description to say we bake overnight sourdough";
const NEW_DESC = "Overnight sourdough from a Bristol side street.";
const SIGNUP = "add a sign-up form that keeps the names of people who sign up";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const DESCRIBE = { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": NEW_DESC };
const SIGNUPS = {
  [T.adds]: { kinds: ["table", "page"] },
  "add:table": { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }] }, seed: [] }] },
  "add:page": { page: [PAGE("/sign-up", "Sign up")] },
  [T.pages]: { pages: [writtenPage("/sign-up")] },
};
const slugOf = (k) => "bc-" + k + "-" + Math.random().toString(16).slice(2, 8);
const statuses = (rec) => rec.parts.map((p) => p.status);
/** One case: a platform with the message's edit and addition, its add-on's publish refused at the gate (after the seam). */
async function withRequest(k, fn) {
  const compiler = installCompiler();
  const db = rowsDb({ tables: {} });
  const P = platform({
    slug: slugOf(k), replies: true, db,
    answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [SIGNUP] }, { intent: "addon" }], ...DESCRIBE, ...SIGNUPS },
  });
  P.testDb = db;
  // THE ADD-ON'S GATE ALONE IS REFUSED: the edit's publish goes through.
  P.failRpc("edit_may_publish", (args) => (P.jobs.get(args.p_id) || {}).op === "addon");
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}
/** What the ledger moved for one job: its reserves (`<id>#n`) and its refund (`<id>`). */
const netOf = (P, jobId) => P.ledger.filter((e) => e.ref === jobId || e.ref.startsWith(jobId + "#")).reduce((n, e) => n + e.delta, 0);
/** The statements that made the addition's table. */
const creates = (P) => P.testDb.log().filter((s) => /create table[^(]*signups/i.test(s.query)).length;

function sameStory(P, key) {
  const rec = P.record(key);
  assert.equal(rec.ended, true, JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  // THE PARTS: the edit done, the addition done in part — its table stands — never wholly failed.
  assert.deepEqual(statuses(rec), ["done", "partial"], JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.left])));
  assert.deepEqual([rec.parts[1].why, rec.parts[1].left], ["partly-done", "partial"]);
  // THE SITE: the description changed; the addition's page is not published.
  assert.equal(P.look().description, NEW_DESC);
  assert.ok(!P.pages().includes("sign-up.tsx"), "the refused addition's page was published");
  // THE ADDITION'S OWN ANSWER: partial, by name — its table live, nothing published.
  const [edit, , add] = P.jobsOf(key);
  assert.deepEqual([edit.op, add.op], ["edit", "addon"]);
  const answer = P.answerOf(add);
  assert.match(String(answer.msg), /couldn't be published/, "the gate did not refuse — this case tests nothing");
  assert.deepEqual(answer.outcome, { state: "partial", published: false, database: "applied", tables: ["signups"] });
  // WHAT THE CUSTOMER IS TOLD: the request's own facts say the addition was done in part, never not done
  // and never that nothing changed; the addition's own reply was given what is live.
  const told = requestReplyFacts(rec).facts.map((x) => x.text);
  assert.ok(told.some((t) => /^Done only in part:/.test(t)), JSON.stringify(told));
  assert.ok(!told.some((t) => /^Not done:/.test(t) || /Nothing was added|nothing changed/i.test(t)), JSON.stringify(told));
  const given = P.replyLog.find((fs) => fs.some((x) => x.text.startsWith("Part of this addition went in and is live")));
  assert.ok(given, "the addition's reply was never given what is live");
  assert.ok(!given.some((x) => /Nothing was added/.test(x.text)), JSON.stringify(given));
  // THE MONEY: the routing call once; the edit charged once; the refused addition charged nothing.
  assert.deepEqual(P.ledger.filter((e) => e.reason === "route").map((e) => e.delta), [-1]);
  assert.equal(netOf(P, edit.id), -1, "the edit was not charged once");
  assert.equal(netOf(P, add.id), 0, "the refused addition kept a charge");
  // THE TABLE WAS MADE ONCE.
  assert.equal(creates(P), 1, "the addition's table was made " + creates(P) + " times");
  return { rec, edit, add };
}

test("COMBO 1 — AN EDIT THAT LANDS AND AN ADDITION WHOSE PUBLISH IS REFUSED AFTER ITS TABLE WENT IN, in one message: the edit done, the addition done in part with what is live told, no part told as nothing changed, the money exact", async () => {
  await withRequest("c1", async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + SIGNUP + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    await settle(P, r.key);
    await pump(P);
    sameStory(P, r.key);
  });
});

test("COMBO 2 — THE SAME WITH EVERY JOB DELIVERED TWICE: each step runs once — the table made once, the edit published once, nothing charged twice — and the story is the same", async () => {
  await withRequest("c2", async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + SIGNUP + "." });
    for (let i = 0; i < 10 && !(P.record(r.key) || {}).ended; i++) await pump(P, { twice: true });
    await pump(P, { twice: true });
    const { edit } = sameStory(P, r.key);
    assert.equal(P.jobsOf(r.key).length, 3, "a job was filed twice");
    assert.equal(P.rpcLog.filter((c) => c.fn === "edit_committed" && c.out && c.out.ok && c.args && c.args.p_id === edit.id).length, 1, "the edit published twice");
  });
});

/** The page's network, answered by the real Worker. */
function wire(P) {
  return (url, method, body) => (async () => {
    if (url === "/api/site/react-revise") return new Promise(() => {});
    const worker = await loadWorker();
    return P.run(async () => {
      const ctx = makeCtx();
      const res = await worker.fetch(new Request("https://gofarther.dev" + url, {
        method, headers: { "content-type": "application/json", Authorization: "Bearer token" }, body: body === undefined ? undefined : JSON.stringify(body),
      }), P.env, ctx);
      await Promise.allSettled(ctx.pending);
      const headers = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      return { status: res.status, body: await res.text(), headers };
    });
  })();
}
const idle = async () => { await drain(); await drain(); };

test("COMBO 3 — THE SAME FOLLOWED FROM ANOTHER SESSION after it ended: each part's reply once, the card saying done and done in part, the preview moved once for both, no undo offered, and nothing said or moved again on another look", async () => {
  await withRequest("c3", async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + SIGNUP + "." });
    await settle(P, r.key);
    await pump(P);
    sameStory(P, r.key);
    // A FRESH SESSION: another browser, with nothing of this request.
    const site = { id: "origin-2", slug: P.slug, react: true, name: "Harbour Loaf", url: "https://" + P.slug + ".gofarther.app/", pages: [{ path: "/" }, { path: "/visit" }], msgs: [] };
    const p = page({ site, answer: wire(P), timers: true, frame: true });
    p.ctx.renderSites();
    p.ctx.siteRequestsCheck(p.s);
    await idle();
    for (let i = 0; i < 4; i++) { p.flush(); await idle(); }
    const st = p.s.requests && p.s.requests[r.key];
    assert.ok(st, "the fresh session did not find the request");
    assert.equal(st.own, false);
    const replies = p.s.msgs.filter((m) => m.r === "a" && m.req === r.key && m.job).map((m) => m.job);
    assert.equal(new Set(replies).size, replies.length, "a part's reply was said twice");
    assert.ok(replies.length >= 2, "a part's reply is missing: " + JSON.stringify(copy(p.s.msgs)));
    const html = p.ctx.siteRequestHTML(p.s.msgs.find((m) => m.request === r.key), p.s);
    assert.match(html, />Done</);
    assert.match(html, />Partly done</, "the addition's part was not shown as done in part: " + html);
    assert.doesNotMatch(html, />Not done</);
    // ONE MOVE FOR BOTH PARTS (`sitePreviewHold`): the frame's addresses.
    const frames = [...new Set(p.frames().filter(Boolean))];
    assert.equal(frames.length, 2, "the preview moved once per part, or not at all: " + frames.join(" "));
    assert.equal(p.s.undoRows == null, true, "another session's work offered an undo");
    // ANOTHER LOOK, as a returning tab makes: nothing said or moved again.
    const n = p.s.msgs.length;
    const v = p.s.previewV;
    p.ctx.siteRequestsCheck(p.s, true);
    await idle();
    for (let i = 0; i < 3; i++) { p.flush(); await idle(); }
    assert.equal(p.s.msgs.length, n, "a look said something again");
    assert.equal(p.s.previewV, v, "a look moved the preview again");
  });
});
