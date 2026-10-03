// THE CUSTOMER'S REPLY, WRITTEN BY A MODEL — THROUGH THE REAL ROUTES AND THE
// REAL PAGE (2026-10-03).
//
// Owner: *"Make normal customer-facing messages throughout edit and add-on
// model-written, including router clarification, success, partial completion,
// pending work, ordinary refusals, repeated-question explanations, and
// cancellation acknowledgments. Audit both Worker responses and
// browser-generated messages so canned paragraphs are not added after the model
// replies. … Keep fixed messages only for genuine technical failures … an HTTP
// status alone must not turn a normal product outcome into that exception. …
// A reply-generation failure must never rerun completed work. Preserve
// clarification state, answer retention, and protections against duplicate
// changes and charges; leave first-build behavior unchanged. Test complete and
// partial success, clarification and follow-ups, ordinary refusals,
// cancellation, and technical fallbacks, checking the final browser-visible
// text against actual outcomes."*
//
// EVERY HOP IS DRIVEN, with `MODEL_REPLIES` on: the real routing route, the
// real edit and add-on routes (synchronously and as a queued job), the real
// poll route that hands a finished job's answer back, the real question route
// that cancels — and, where the case is about what the customer reads, the
// real page (test/fixtures/browser-page.mjs: the handlers of public/chat.js in
// a VM) sending its own requests to the real Worker and drawing the answer.
// What a case checks is what happened — the stored pages and design, every
// publish, every charge, the stored question, each model call — and that the
// page shows the reply the Worker wrote, whole, with nothing after it.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. The reply model here explains every fact it is
// shown in that fact's own words and lists them all; whether a real model
// writes a good, faithful reply — and how long it takes — is a live
// measurement this file cannot make.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page, settle } from "./fixtures/browser-page.mjs";
import { REPLY_TOOL } from "../builder/site-reply.mjs";
import { QUESTION_KEY, ASK_TTL_MS, MAX_ANSWER_CHARS, MAX_HISTORY, againNote } from "../builder/clarify.mjs";
import { JOB_ENV_NAMES, jobSecrets } from "../builder/edit-job.mjs";
import { editBrowserReply, browserReply } from "../scripts/addon-sweep.mjs";
import {
  T, TOKEN, VISIT, VISIT_MOVED, NEW_DESC, OLD_DESC, Q, freshSlug, bucket, question, seedQuestion, withWire, envFor,
  routeCall, questionCall, browserPost, postRoute, SITE, storedLook, storedPage, userText, json,
} from "./fixtures/live-ask.mjs";

const FINAL_HEADER = createRequire(import.meta.url)("../public/edit-poll.js").FINAL_HEADER;
const W = REPLY_TOOL.name;
const ON = (store) => ({ ...envFor(store), MODEL_REPLIES: "on" });
const DESC_WORDS = "Change the site's search description to \"" + NEW_DESC + "\"";
const MOVE_WORDS = "put the order band above the other one";
const Q2 = { text: "Which band is the order band — the one about holding a loaf?", options: ["Yes", "No"] };

/** The facts one reply call was shown, by id, read off its own request. */
function factsShown(args) {
  const t = userText(args);
  const at = t.indexOf("WHAT REALLY HAPPENED");
  assert.ok(at >= 0, "a reply call carried no facts: " + t.slice(0, 200));
  return [...t.slice(at).matchAll(/^\[([a-z]\d+)\] (.+)$/gm)].map((m) => ({ id: m[1], text: m[2] }));
}

/**
 * THE REPLY MODEL, SUPPLIED. It explains every fact it is shown, in that
 * fact's own words — so a case reads off the reply that the facts reached it —
 * and lists them all. A note (a question asked again) is one short line.
 * `log` keeps every call's facts and whether it was a note.
 */
function writer(log, tag = "Here is what happened") {
  return (args, n) => {
    const facts = factsShown(args);
    const note = /WRITE A NOTE/.test(userText(args));
    log.push({ facts, note });
    return {
      reply: note ? "You answered this one before, so here it is again, more exactly (" + n + ")." : tag + " (" + n + "): " + facts.map((f) => f.text).join(" "),
      covers: facts.map((f) => f.id),
    };
  };
}
const replyCalls = (seen) => seen.calls.filter((c) => c === W).length;
const builds = (compiler) => compiler.calls.filter((c) => String(c.url).includes("/build")).length;
const withoutReply = (body) => { const { reply, replySource, ...rest } = body; return rest; };

/** A finished job's answer, as the poll route hands it back, from the row `edit_get` would read. */
async function poll(worker, env, id, row) {
  const wire = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (/\/rest\/v1\/rpc\/edit_get\b/.test(url)) return json({ ok: true, job: id, phase: null, needs_review: false, cancel: false, ms: 1000, error: null, ...row });
    return wire(input, init);
  };
  try {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/edit/" + id, { headers: { Authorization: TOKEN } }), env, makeCtx());
    return { status: res.status, final: res.headers.get(FINAL_HEADER), body: await res.json().catch(() => null) };
  } finally { globalThis.fetch = wire; }
}

/** The row of a job `postRoute` ran: what it stored, and its money as the ledger left it. */
const doneRow = (slug, r, over = {}) => ({ slug, state: "done", billing: "finalized", cost: Number(r.body.cost) || 0, result: r.finalized.p_result, ...over });

/**
 * THE PAGE'S REQUESTS, ANSWERED BY THE REAL WORKER: each goes to its route with
 * the body the page composed, and every answer is kept (`log`) so a case can
 * hold what the page shows to what the Worker said.
 */
function toWorker(worker, env, log) {
  return (url, method, body) => worker.fetch(new Request("https://gofarther.dev" + url, {
    method, headers: { "content-type": "application/json", Authorization: TOKEN }, body: body === undefined ? undefined : JSON.stringify(body),
  }), env, makeCtx()).then(async (res) => {
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    log.push({ url, method, status: res.status, body: parsed });
    return { status: res.status, body: text };
  });
}
/** The page on a site that exists, its picker the one the supplied models answer for. */
function livePage(slug, worker, env, log, over = {}) {
  const p = page({ site: { id: "origin-" + slug, slug, react: true, name: "Harbour Loaf", url: "https://" + slug + ".gofarther.app/", pages: [{ path: "/" }, { path: "/visit" }], msgs: [], ...over }, answer: toWorker(worker, env, log) });
  p.ctx.buildPicker = "sonnet";
  return p;
}
/** Until the page has finished with the message (or a bound): the Worker's own awaits run between. */
async function until(p, done, max = 400) {
  for (let i = 0; i < max && !done(); i++) await settle(5);
  assert.ok(done(), "the page never finished with the message: " + JSON.stringify(p.said()).slice(0, 400));
}
const answered = (p, n) => () => p.said().length >= n && p.busy() === false;

// ─────────────────────────────────────────────────────────────────────────────
// 1. COMPLETE SUCCESS — synchronously, and as a queued job
// ─────────────────────────────────────────────────────────────────────────────

test("COMPLETE SUCCESS, ON THE PAGE: the change is made, published and charged once; then one reply is written from what the route said — what changed and what was left for later — and the page shows that reply whole, with nothing of its own after it", async () => {
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
    const slug = freshSlug("ok-page");
    const store = bucket(slug);
    const log = [];
    const replies = [];
    await withWire({ route: { intent: "edit", layer: "look", alsoAsked: "add a gallery page" }, [T.pick]: { fields: ["description"] }, "lane:description": NEW_DESC, [W]: writer(replies) }, async (seen) => {
      const p = livePage(slug, worker, ON(store), log);
      p.ctx.siteSend(DESC_WORDS + ". Then add a gallery page.");
      await until(p, answered(p, 2));
      const [route, edit] = log;
      assert.equal(route.url, "/api/site/route");
      assert.equal(route.body.reply, undefined, "a routing answer that hands on to a step was given a reply");
      assert.equal(edit.url, "/api/site/" + slug + "/edit");
      assert.equal(log.length, 2, "the page made more requests than the route and the edit: " + JSON.stringify(log.map((l) => l.url)));
      // WHAT HAPPENED: the description, stored and published once, charged once — routing and the edit.
      assert.equal(storedLook(store, slug).description, NEW_DESC);
      assert.equal(builds(compiler), 1, "the change was not published exactly once");
      assert.equal(seen.debits.length, 2, "the routing call and the edit were not each charged once: " + JSON.stringify(seen.debits));
      assert.deepEqual([].concat(edit.body.deferred), ["add a gallery page"], "the part left for later is not the route's own");
      // THE REPLY, WRITTEN ONCE, AFTER THE WORK, FROM THE ROUTE'S OWN ANSWER.
      assert.equal(replyCalls(seen), 1);
      assert.equal(seen.calls[seen.calls.length - 1], W, "the reply was written before the work was done");
      assert.deepEqual(replies[0].facts.map((f) => f.text), [
        "Changed the description.",
        "Left for later, so not tried this time (they can send it next): “add a gallery page”",
      ]);
      assert.equal(edit.body.replySource, "model");
      // THE PAGE SHOWS THE REPLY, WHOLE: no headline, tail or money sentence of its own.
      assert.deepEqual(p.said(), [{ r: "u", t: DESC_WORDS + ". Then add a gallery page." }, { r: "a", t: edit.body.reply }]);
    }, { slug });
  } finally { compiler.uninstall(); }
});

test("THE REPLY IS ADDED, NOTHING ELSE MOVES: the same request with replies on and off answers the same fields, makes the same change, publishes and charges the same — and with them off the page says what it always said", async () => {
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
    const runOnce = async (flag) => {
      const slug = freshSlug("same-" + (flag ? "on" : "off"));
      const store = bucket(slug);
      const replies = [];
      return withWire({ [T.pick]: { fields: ["description"] }, "lane:description": NEW_DESC, [W]: writer(replies) }, async (seen) => {
        const b0 = builds(compiler);
        const post = browserPost(SITE(slug), { intent: "edit", layer: "look", alsoAsked: "add a gallery page", cost: 2 }, DESC_WORDS + ". Then add a gallery page.");
        assert.equal(post.body.routedCost, 2, "the page does not send what reading the message cost");
        const r = await postRoute(worker, flag ? ON(store) : envFor(store), store, seen, slug, post, "sync");
        return { r, built: builds(compiler) - b0, debits: seen.debits.slice(), calls: seen.calls.slice(), desc: storedLook(store, slug).description };
      }, { slug });
    };
    const on = await runOnce(true);
    const off = await runOnce(false);
    assert.equal(on.r.status, off.r.status);
    assert.deepEqual(withoutReply(on.r.body), off.r.body, "a field the route said changed when its reply was written");
    assert.equal(off.r.body.reply, undefined);
    assert.equal(on.built, 1);
    assert.equal(off.built, 1);
    assert.deepEqual(on.debits, off.debits, "the reply changed what was charged");
    assert.deepEqual(on.calls, [...off.calls, W], "the reply call is not the one call added, after the work");
    assert.equal(on.desc, NEW_DESC);
    assert.equal(off.desc, NEW_DESC);
    // WHAT THE PAGE SAYS, BOTH WAYS: the reply whole; without one, the page's own composition, tail and all.
    const shownOn = editBrowserReply(on.r.body, true, { layer: "look", cost: 2 });
    const shownOff = editBrowserReply(off.r.body, true, { layer: "look", cost: 2 });
    assert.ok(shownOn.ok && shownOff.ok, shownOn.why || shownOff.why);
    assert.equal(shownOn.text, on.r.body.reply);
    assert.match(shownOff.text, /^✅/);
    assert.match(shownOff.text, /add a gallery page/, "without a reply the page lost its own tail");
    assert.notEqual(shownOff.text, shownOn.text);
    assert.ok(shownOn.actions.includes("refresh the credit balance"), "the page stopped refreshing the balance once it had a reply to show");
  } finally { compiler.uninstall(); }
});

test("COMPLETE SUCCESS, QUEUED: the job makes, publishes and charges the change and writes no reply — it keeps what one needs beside its answer; the first poll of the finished job writes it once, every later poll hands back the same one, `replyFor` is never served, and the page shows the reply whole", async () => {
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
    const slug = freshSlug("ok-job");
    const store = bucket(slug);
    const replies = [];
    await withWire({ [T.pick]: { fields: ["description"] }, "lane:description": NEW_DESC, [W]: writer(replies) }, async (seen) => {
      const post = browserPost(SITE(slug), { intent: "edit", layer: "look", cost: 2 }, DESC_WORDS);
      const r = await postRoute(worker, ON(store), store, seen, slug, post, "job");
      assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
      assert.equal(r.finalized.p_ok, true);
      assert.equal(builds(compiler), 1);
      assert.equal(seen.rpc.filter((x) => x.fn === "edit_reserve").length, 1, "the edit was not reserved once");
      assert.equal(replyCalls(seen), 0, "the job wrote its own reply, before its money was settled");
      assert.equal(r.body.reply, undefined);
      assert.deepEqual(r.body.replyFor, { kind: "edit", request: DESC_WORDS, answers: [], picker: "sonnet", routedCost: 2, slug, pages: ["/", "/visit"] });
      const id = r.finalized.p_id;
      const rpcBefore = seen.rpc.length;
      const p1 = await poll(worker, ON(store), id, doneRow(slug, r));
      assert.equal(p1.status, 200);
      assert.equal(p1.final, "final", "the poll's own answer and the stored one cannot be told apart");
      assert.equal(p1.body.replySource, "model");
      assert.equal(Object.hasOwn(p1.body, "replyFor"), false, "what the reply needed was served to the page");
      const { replyFor, ...stored } = r.body;
      assert.deepEqual(withoutReply(p1.body), stored, "the poll changed what the job stored");
      assert.equal(replyCalls(seen), 1);
      assert.deepEqual(replies[0].facts.map((f) => f.text), ["Changed the description."]);
      assert.ok(store.store.has("edit-replies/" + id + ".json"), "the reply was not kept");
      // EVERY LATER POLL: the same reply, no second call.
      const p2 = await poll(worker, ON(store), id, doneRow(slug, r));
      assert.equal(p2.body.reply, p1.body.reply);
      assert.equal(replyCalls(seen), 1, "a later poll wrote the reply again");
      // AND NOTHING OF THE JOB RAN AGAIN.
      assert.equal(seen.rpc.length, rpcBefore, "a poll touched the job's own bookkeeping: " + JSON.stringify(seen.rpc.slice(rpcBefore).map((x) => x.fn)));
      assert.equal(builds(compiler), 1);
      // THE PAGE: the watcher hands the stored answer to the same reader.
      const shown = editBrowserReply(p1.body, true, { layer: "look", cost: 2 });
      assert.ok(shown.ok, shown.why);
      assert.equal(shown.text, p1.body.reply);
    }, { slug });
  } finally { compiler.uninstall(); }
});

test("A QUEUED JOB KEEPS EVERY ANSWER ITS REPLY NEEDS — none cut at twelve — and the poll's reply call is shown them all (2026-10-03, the owner's review: nothing cut)", async () => {
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
    const slug = freshSlug("all-answers");
    const store = bucket(slug);
    const told = Array.from({ length: 14 }, (_, i) => ({ q: "Detail " + (i + 1) + "?", a: "Answer number " + (i + 1) }));
    await withWire({ [T.pick]: { fields: ["description"] }, "lane:description": NEW_DESC, [W]: writer([]) }, async (seen) => {
      const post = browserPost(SITE(slug), { intent: "edit", layer: "look", askRound: 2, context: told }, DESC_WORDS);
      assert.deepEqual(post.body.context, told, "the page did not post every answer");
      const r = await postRoute(worker, ON(store), store, seen, slug, post, "job");
      assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
      assert.deepEqual(r.body.replyFor.answers, told, "the job kept fewer answers than the request carried");
      await poll(worker, ON(store), r.finalized.p_id, doneRow(slug, r));
      const shown = seen.inputs[W] && seen.inputs[W][0];
      assert.ok(shown, "no reply call was made");
      for (const p of told) assert.ok(shown.includes("“" + p.a + "”"), "the reply call was not shown " + p.a);
    }, { slug });
  } finally { compiler.uninstall(); }
});

test("TWO POLLS AT ONCE KEEP ONE REPLY: both may write one, the first kept wins, and both — and every later read — hand back that one", async () => {
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
    const slug = freshSlug("race");
    const store = bucket(slug);
    const replies = [];
    await withWire({ [T.pick]: { fields: ["description"] }, "lane:description": NEW_DESC, [W]: writer(replies) }, async (seen) => {
      const r = await postRoute(worker, ON(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, DESC_WORDS), "job");
      const id = r.finalized.p_id;
      const [a, b] = await Promise.all([poll(worker, ON(store), id, doneRow(slug, r)), poll(worker, ON(store), id, doneRow(slug, r))]);
      assert.equal(replyCalls(seen), 2, "the two polls did not both write (the race this case is about did not happen)");
      assert.notEqual(replies.length, 0);
      assert.equal(a.body.reply, b.body.reply, "two polls of one job handed back two different replies");
      const c = await poll(worker, ON(store), id, doneRow(slug, r));
      assert.equal(c.body.reply, a.body.reply);
      assert.equal(replyCalls(seen), 2);
    }, { slug });
  } finally { compiler.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. A REPLY THAT CANNOT BE WRITTEN NEVER RERUNS THE WORK
// ─────────────────────────────────────────────────────────────────────────────

test("A REPLY THAT CANNOT BE WRITTEN CHANGES NOTHING: the reply model failing, or leaving a fact out twice, leaves the route's answer exactly as it was — one change, one publish, one charge — and the page says what it always said", async () => {
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
    const cases = [
      ["the reply model fails", undefined, 1],
      ["it leaves a fact out, twice", () => ({ reply: "All done!", covers: [] }), 2],
      ["it answers in plain text", () => ({ text: "All done!" }), 1],
      ["its reply carries a fact's id", (args) => ({ reply: "Done [c1].", covers: factsShown(args).map((f) => f.id) }), 1],
    ];
    for (const [name, answer, calls] of cases) {
      const slug = freshSlug("fail-reply");
      const store = bucket(slug);
      await withWire({ [T.pick]: { fields: ["description"] }, "lane:description": NEW_DESC, ...(answer ? { [W]: answer } : {}) }, async (seen) => {
        const b0 = builds(compiler);
        const r = await postRoute(worker, ON(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look", cost: 2 }, DESC_WORDS), "sync");
        assert.equal(r.status, 200, name);
        assert.equal(r.body.ok, true, name);
        assert.equal(r.body.reply, undefined, name + ": a reply that could not be had was used");
        assert.equal(r.body.replySource, undefined, name);
        assert.equal(replyCalls(seen), calls, name + ": the reply was asked for the wrong number of times");
        assert.equal(storedLook(store, slug).description, NEW_DESC, name);
        assert.equal(builds(compiler) - b0, 1, name + ": the change was published more or less than once");
        assert.equal(seen.debits.length, 1, name + ": the edit was charged more or less than once");
        assert.equal(seen.lanes.length, 1, name + ": the change was made again");
        const shown = editBrowserReply(r.body, true, { layer: "look", cost: 2 });
        assert.ok(shown.ok, shown.why);
        assert.match(shown.text, /^✅ /, name + ": the page did not say it the way it always has: " + shown.text);
      }, { slug });
    }
  } finally { compiler.uninstall(); }
});

test("A QUEUED JOB WHOSE REPLY CANNOT BE WRITTEN: the poll hands back the stored answer as it was, the job is not run, published or charged again, and a later poll may still write the reply", async () => {
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
    const slug = freshSlug("fail-poll");
    const store = bucket(slug);
    let down = true;
    const replies = [];
    const ok = writer(replies);
    await withWire({ [T.pick]: { fields: ["description"] }, "lane:description": NEW_DESC, [W]: (args, n) => (down ? { reply: "", covers: [] } : ok(args, n)) }, async (seen) => {
      const r = await postRoute(worker, ON(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, DESC_WORDS), "job");
      const id = r.finalized.p_id;
      const before = { rpc: seen.rpc.length, built: builds(compiler), lanes: seen.lanes.length };
      const p1 = await poll(worker, ON(store), id, doneRow(slug, r));
      assert.equal(p1.status, 200);
      assert.equal(p1.body.reply, undefined, "an unusable reply was served");
      assert.equal(Object.hasOwn(p1.body, "replyFor"), false, "what the reply needed was served when no reply was");
      const { replyFor, ...stored } = r.body;
      assert.deepEqual(p1.body, stored, "the stored answer was not handed back as it was");
      assert.equal(store.store.has("edit-replies/" + id + ".json"), false, "a reply that was never written was kept");
      assert.match(editBrowserReply(p1.body, true, {}).text, /^✅ /);
      down = false;
      const p2 = await poll(worker, ON(store), id, doneRow(slug, r));
      assert.equal(p2.body.replySource, "model", "a later poll could not write the reply");
      assert.deepEqual({ rpc: seen.rpc.length, built: builds(compiler), lanes: seen.lanes.length }, before, "a poll ran, published or charged the job again");
    }, { slug });
  } finally { compiler.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PARTIAL COMPLETION, AND QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

test("PARTIAL COMPLETION, ON THE PAGE: the part that could run is made and charged; the part that could not is in the reply with the builder's own reason; the page shows the reply alone", async () => {
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
    const slug = freshSlug("partial");
    const store = bucket(slug);
    const log = [];
    const replies = [];
    await withWire({
      route: { intent: "edit", layer: "look" },
      [T.pick]: { fields: ["description", "shape"], scopes: [{ part: "description", words: DESC_WORDS }, { part: "shape", page: "/gallery", words: MOVE_WORDS }] },
      "lane:description": NEW_DESC, [W]: writer(replies),
    }, async (seen) => {
      const p = livePage(slug, worker, ON(store), log);
      p.ctx.siteSend(DESC_WORDS + ". Then on the gallery page " + MOVE_WORDS + ".");
      await until(p, answered(p, 2));
      const edit = log[log.length - 1];
      assert.equal(edit.body.ok, true);
      assert.equal(storedLook(store, slug).description, NEW_DESC);
      assert.equal(storedPage(store, slug, "visit.tsx"), VISIT, "a page the request did not name was changed");
      assert.equal(builds(compiler), 1);
      const part = (edit.body.partial || [])[0];
      assert.equal(part && part.error, "no-page", JSON.stringify(edit.body.partial));
      assert.deepEqual(replies[0].facts.map((f) => f.id), ["c1", "f1"]);
      assert.equal(replies[0].facts[1].text, "Part of the request was not done. The builder's own reason: “" + part.msg + "”");
      assert.equal(p.last().t, edit.body.reply, "the page added to the reply, or did not show it");
    }, { slug });
  } finally { compiler.uninstall(); }
});

test("A STEP'S QUESTION BESIDE WORK DONE: the reply says what was done and leads into the question, which the page draws under it with its card; the answer resumes only the part that asked, and that ending is explained in its own reply — nothing made or charged twice", async () => {
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
    const slug = freshSlug("mixed");
    const store = bucket(slug);
    const replies = [];
    await withWire({
      [T.pick]: [
        { fields: ["description", "shape"], scopes: [{ part: "description", words: DESC_WORDS }, { part: "shape", page: "/visit", words: MOVE_WORDS }] },
        { fields: ["shape"], scopes: [{ part: "shape", page: "/visit", words: MOVE_WORDS }] },
      ],
      "lane:description": NEW_DESC,
      [T.tweak]: [{ source: "", question: Q2 }, { source: VISIT_MOVED }],
      route: { intent: "edit", layer: "look", answered: true },
      [W]: writer(replies),
    }, async (seen) => {
      const r = await postRoute(worker, ON(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look", cost: 2 }, DESC_WORDS + ". Then " + MOVE_WORDS + "."), "sync");
      assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
      assert.equal(storedLook(store, slug).description, NEW_DESC);
      assert.equal(storedPage(store, slug, "visit.tsx"), VISIT, "the page whose step asked was changed");
      const q = question(store, slug);
      assert.equal(q.id, r.body.clarify.id);
      assert.equal(q.request, MOVE_WORDS, "the question keeps more than the part that asked");
      assert.deepEqual(replies[0].facts.map((f) => f.id), ["c1", "q1"]);
      assert.match(replies[0].facts[1].text, /^A question for them will be shown right under your reply[^]*“Which band is the order band — the one about holding a loaf\?”/);
      const shown = editBrowserReply(r.body, true, { layer: "look", cost: 2 });
      assert.ok(shown.ok, shown.why);
      assert.equal(shown.text, r.body.reply + "\n" + Q2.text, "the page did not draw the question under the reply, alone");
      assert.equal(shown.asked && shown.asked.id, q.id, "the question was drawn without its card");
      // THE ANSWER, THROUGH THE ROUTING ROUTE: not an ending, so no reply; the request resumes.
      const calls0 = replyCalls(seen);
      const d = (await routeCall(worker, ON(store), { slug, message: "Yes", ask: { id: q.id } })).body;
      assert.equal(d.ask.answered, true, JSON.stringify(d));
      assert.equal(d.reply, undefined, "the routing answer that resumes the request was given a reply");
      assert.equal(replyCalls(seen), calls0);
      const resumed = browserPost(SITE(slug), { ...d, askRound: d.ask.round, putOff: d.ask.putOff, context: d.ask.context }, d.instruction);
      const r2 = await postRoute(worker, ON(store), store, seen, slug, resumed, "sync");
      assert.equal(r2.body.ok, true, JSON.stringify(r2.body).slice(0, 300));
      assert.equal(storedPage(store, slug, "visit.tsx"), VISIT_MOVED, "the part that waited on the answer was not made");
      assert.equal(seen.lanes.filter((l) => l.field === "description").length, 1, "the completed change was made again on the answer");
      assert.equal(builds(compiler), 2, "each ending did not publish exactly once");
      assert.equal(replyCalls(seen), calls0 + 1);
      assert.equal(r2.body.replySource, "model");
      assert.equal(editBrowserReply(r2.body, true, d).text, r2.body.reply);
      assert.equal(question(store, slug).status, "answered");
    }, { slug });
  } finally { compiler.uninstall(); }
});

test("A STEP'S QUESTION AND NOTHING ELSE IS ITS OWN REPLY: no reply call is made, nothing is changed or charged, and the page shows the question in the model's own words, with its card", async () => {
  const worker = await loadWorker();
  for (const mode of ["sync", "job"]) {
    const slug = freshSlug("q-only-" + mode);
    const store = bucket(slug);
    await withWire({ [T.pick]: { fields: ["shape"], question: Q }, [W]: writer([]) }, async (seen) => {
      const r = await postRoute(worker, ON(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, "Move the order band up"), mode);
      assert.equal(r.body.error, "clarify", mode);
      assert.equal(replyCalls(seen), 0, mode + ": a reply was written for a question alone");
      assert.equal(r.body.reply, undefined, mode);
      if (mode === "job") {
        const p = await poll(worker, ON(store), r.finalized.p_id, { slug, state: "failed", billing: "none", cost: 0, result: r.finalized.p_result });
        assert.equal(p.body.reply, undefined, mode + ": the poll wrote a reply for a question alone");
        assert.equal(replyCalls(seen), 0, mode);
      }
      const shown = editBrowserReply(r.body, false, {});
      assert.equal(shown.text, Q.text, mode);
      assert.equal(shown.asked && shown.asked.id, question(store, slug).id, mode);
    }, { slug });
  }
});

test("A QUESTION ASKED AGAIN — AT THE ROUTER AND AT A STEP: its note is written from the answers that did not settle it, kept with the question and drawn above it; a note that cannot be written is the fixed one; nothing runs or is charged beyond the calls that asked", async () => {
  const worker = await loadWorker();
  for (const writes of [true, false]) {
    {
      const slug = freshSlug("again-route");
      const store = bucket(slug);
      const q = seedQuestion(store, slug);
      const again = { intent: "clarify", question: { text: Q.text.toUpperCase().replace("—", "-"), options: Q.options }, answered: true };
      const replies = [];
      await withWire({ route: [again, again], ...(writes ? { [W]: writer(replies) } : {}) }, async (seen) => {
        const r = await routeCall(worker, ON(store), { slug, message: "the bigger one", ask: { id: q.id } });
        assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
        assert.equal(r.body.intent, "clarify");
        const fixed = againNote([{ q: Q.text, a: "the bigger one" }]);
        if (writes) {
          assert.equal(replies.length, 1);
          assert.equal(replies[0].note, true, "the note was not asked for as a note");
          assert.match(replies[0].facts[0].text, /their answer, “the bigger one”, did not settle it/);
          assert.match(r.body.question.note, /^You answered this one before/, "the note is not the one written");
        } else {
          assert.equal(r.body.question.note, fixed, "a note that could not be written is not the fixed one");
        }
        const kept = question(store, slug);
        assert.equal(kept.note, r.body.question.note, "the note shown is not the one kept");
        assert.deepEqual(kept.context, [{ q: Q.text, a: "the bigger one" }], "the answer that did not settle it was lost");
        assert.equal(kept.request, q.request);
        assert.equal(seen.debits.length, 1, "the routing call was not charged once");
        assert.equal(seen.routerAsked.length, 2);
      });
    }
    {
      // AT THE THRESHOLD: answered once already, answered again, and asked again — the router is not sent
      // again, and the note says only their answer or a cancel moves it now.
      const slug = freshSlug("again-limit");
      const store = bucket(slug);
      const q = seedQuestion(store, slug, { context: [{ q: Q.text, a: "the first one" }], round: 2 });
      const again = { intent: "clarify", question: { text: Q.text, options: Q.options }, answered: true };
      const replies = [];
      await withWire({ route: [again], ...(writes ? { [W]: writer(replies) } : {}) }, async (seen) => {
        const r = await routeCall(worker, ON(store), { slug, message: "the bigger one", ask: { id: q.id } });
        assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
        assert.equal(seen.routerAsked.length, 1, "the router was sent again at the threshold");
        if (writes) {
          assert.match(replies[0].facts[0].text, /their answers, “the first one” and “the bigger one”, did not settle it/);
          assert.match(replies[0].facts[2].text, /until they answer once more or cancel/, "the note was not told our own re-asking has stopped");
          assert.match(r.body.question.note, /^You answered this one before/);
        } else {
          assert.equal(r.body.question.note, againNote([{ q: Q.text, a: "the first one" }, { q: Q.text, a: "the bigger one" }]));
        }
        assert.equal(question(store, slug).note, r.body.question.note);
      });
    }
    {
      const slug = freshSlug("again-step");
      const store = bucket(slug);
      const replies = [];
      await withWire({ [T.pick]: [{ fields: ["shape"], question: Q }, { fields: ["shape"], question: Q }], ...(writes ? { [W]: writer(replies) } : {}) }, async (seen) => {
        const post = browserPost(SITE(slug), { intent: "edit", layer: "look", askRound: 1, context: [{ q: Q.text, a: "the big one" }] }, "Move the band");
        const r = await postRoute(worker, ON(store), store, seen, slug, post, "sync");
        assert.equal(r.body.error, "clarify", JSON.stringify(r.body).slice(0, 300));
        const kept = question(store, slug);
        if (writes) assert.match(kept.note, /^You answered this one before/);
        else assert.equal(kept.note, againNote([{ q: Q.text, a: "the big one" }]));
        assert.equal(r.body.clarify.note, kept.note);
        assert.equal(r.body.reply, undefined, "a question alone, asked again, was given a reply besides its note");
        assert.equal(storedPage(store, slug, "visit.tsx"), VISIT);
        const shown = editBrowserReply(r.body, false, {});
        assert.equal(shown.text, kept.note + "\n" + Q.text, "the note is not drawn above the question");
      }, { slug });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. ORDINARY REFUSALS, AT WHATEVER STATUS
// ─────────────────────────────────────────────────────────────────────────────

test("AN EDIT REFUSED, ON THE PAGE: a change to a page the site does not have is said in the reply with the builder's reason, that nothing changed and what each part cost — at the route's own status — and the page adds nothing of its own", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("no-page");
  const store = bucket(slug);
  const log = [];
  const replies = [];
  const ASK = "Make the heading on the gallery page bigger";
  await withWire({ route: { intent: "edit", layer: "look" }, [T.pick]: { fields: ["shape"], scopes: [{ part: "shape", page: "/gallery", words: ASK }] }, [W]: writer(replies) }, async (seen) => {
    const p = livePage(slug, worker, ON(store), log);
    p.ctx.siteSend(ASK);
    await until(p, answered(p, 2));
    const [route, edit] = log;
    assert.equal(edit.url, "/api/site/" + slug + "/edit", JSON.stringify(log.map((l) => l.url)));
    assert.ok(edit.status >= 400 && edit.status < 500, "the refusal was not the route's own 4xx: " + edit.status);
    assert.equal(edit.body.ok, false);
    assert.equal(edit.body.unchanged, true, JSON.stringify(edit.body).slice(0, 300));
    assert.equal(edit.body.ours, undefined);
    assert.equal(storedPage(store, slug, "visit.tsx"), VISIT);
    assert.ok(Number(route.body.cost) > 0, "the routing call cost nothing, so the case cannot read its money");
    const told = replies[0].facts.map((f) => f.text);
    assert.match(told[0], /gallery/i, "the builder's reason was not a fact: " + told[0]);
    assert.deepEqual(told.slice(-3), [
      "Nothing on their site changed.",
      "This change cost them nothing.",
      "Reading their message cost " + (route.body.cost === 1 ? "one credit" : route.body.cost + " credits") + ".",
    ]);
    assert.equal(p.last().t, edit.body.reply, "the page added its own sentence to a refusal it had a reply for");
    assert.deepEqual(seen.debits, [route.body.cost], "the refused change was charged");
  }, { slug });
});

test("AN ADD-ON REFUSED: nothing to add is said in the reply with the builder's reason and what reading cost, and the page shows the reply alone", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("addon-no");
  const store = bucket(slug);
  const replies = [];
  await withWire({ [T.adds]: { kinds: [] }, [W]: writer(replies) }, async (seen) => {
    const r = await postRoute(worker, ON(store), store, seen, slug, browserPost(SITE(slug), { intent: "addon", cost: 1 }, "Add a way to pay a deposit"), "sync");
    assert.equal(r.body.ok, false);
    assert.equal(r.body.replySource, "model");
    assert.match(replies[0].facts[0].text, /^Nothing was added\. The builder's own reason: “/);
    assert.equal(replies[0].facts[1].text, "Reading their message cost one credit.");
    const shown = browserReply(r.body, r.status >= 200 && r.status < 300);
    assert.ok(shown.ok, shown.why);
    assert.equal(shown.text, r.body.reply);
    assert.deepEqual(seen.debits, [], "the refused addition was charged");
  }, { slug });
});

test("AN ANSWER THE ROUTE WILL NOT ACT ON, ON THE PAGE: a question already answered (409), one too long (422) or a request whose answers are full (422) is explained in its own reply — nothing routed, run or charged, the question kept where it waits — and the page shows the reply alone", async () => {
  const worker = await loadWorker();
  const cases = [
    // A STALE ANSWER IS REFUSED BEFORE ANY MODEL CALL; ONE TOO LONG, OR PAST A
    // FULL HISTORY, AFTER THE ROUTER SAID IT ANSWERS THE QUESTION — uncharged.
    ["closed", (store, slug) => { const q = seedQuestion(store, slug, { status: "cancelled" }); return q; }, "Visit", 409, "stale-question", false],
    ["too long", (store, slug) => seedQuestion(store, slug), "y".repeat(MAX_ANSWER_CHARS + 1), 422, "answer-too-long", true],
    ["answers full", (store, slug) => seedQuestion(store, slug, { context: Array.from({ length: MAX_HISTORY }, (_, i) => ({ q: "Detail " + i + "?", a: "Answer " + i })), round: MAX_HISTORY + 1 }), "Visit", 422, "answers-full", true],
  ];
  for (const [name, seed, typed, status, error, routerAsked] of cases) {
    const slug = freshSlug("route-no");
    const store = bucket(slug);
    const q = seed(store, slug);
    const before = store.raw(QUESTION_KEY(slug));
    const log = [];
    const replies = [];
    await withWire({ route: { intent: "edit", layer: "look", answered: true }, [W]: writer(replies) }, async (seen) => {
      const p = livePage(slug, worker, ON(store), log, { ask: { id: q.id, text: Q.text, options: Q.options, attached: false }, msgs: [{ r: "u", t: "Move the order band up" }, { r: "a", t: Q.text, q: Q.text, opts: Q.options, ask: q.id }] });
      p.ctx.siteSend(typed);
      await until(p, () => p.busy() === false && log.length === 1 && p.said().length >= 4);
      const [route] = log;
      assert.equal(route.status, status, name);
      assert.equal(route.body.error, error, name);
      assert.equal(route.body.cost, 0, name);
      assert.equal(typeof route.body.msg, "string", name + ": the route's own sentence was not kept beside the reply");
      assert.equal(route.body.replySource, "model", name);
      assert.equal(seen.routerAsked.length, routerAsked ? 1 : 0, name + ": the router was asked when it should not be, or not when it is");
      assert.deepEqual(seen.debits, [], name + ": the refusal was charged");
      assert.equal(store.raw(QUESTION_KEY(slug)), before, name + ": the waiting question moved");
      assert.ok(replies[0].facts.some((f) => /nothing was charged/.test(f.text)), name + ": the reply was not told nothing was charged");
      assert.equal(p.last().t, route.body.reply, name + ": the page added to the reply, or did not show it");
    }, { slug });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. CANCELLATION
// ─────────────────────────────────────────────────────────────────────────────

test("CANCEL, ON THE PAGE: the question closes once on the server; the acknowledgement is written from what the cancel did and what the request had put off, and the page shows it alone; a cancel with nothing to close says why", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("cancel");
  const store = bucket(slug);
  const q = seedQuestion(store, slug, { held: ["add a gallery page"] });
  const log = [];
  const replies = [];
  await withWire({ [W]: writer(replies) }, async (seen) => {
    const p = livePage(slug, worker, ON(store), log, { ask: { id: q.id, text: Q.text, options: Q.options, attached: false }, msgs: [{ r: "u", t: "Move the order band up" }, { r: "a", t: Q.text, q: Q.text, opts: Q.options, ask: q.id }] });
    p.click("data-ask-cancel", "1");
    await until(p, () => log.length === 1 && p.busy() === false && p.said().length >= 4);
    const [c] = log;
    assert.equal(c.url, "/api/site/" + slug + "/question");
    assert.equal(c.body.cancelled, true);
    assert.deepEqual(c.body.putOff, ["add a gallery page"]);
    assert.equal(question(store, slug).status, "cancelled");
    assert.deepEqual(replies[0].facts.map((f) => f.id), ["c1", "x1", "p1"]);
    assert.equal(replies[0].facts[2].text, "Left for later and never tried, so it is not done either: “add a gallery page”");
    assert.equal(p.last().t, c.body.reply, "the page added to the acknowledgement, or did not show it");
    assert.equal(p.ask(), null, "the cancelled question kept its card");
    assert.deepEqual(seen.debits, [], "a cancel was charged");
    // AGAIN: nothing left to cancel, said as that.
    const again = await questionCall(worker, ON(store), slug, "POST", { id: q.id, cancel: true, picker: "sonnet" });
    assert.equal(again.body.cancelled, false);
    assert.equal(again.body.why, "closed");
    assert.match(replies[1].facts[0].text, /^There was nothing to cancel/);
    assert.equal(again.body.replySource, "model");
  }, { slug });
});

test("A QUEUED CHANGE STOPPED AT THE CUSTOMER'S CANCEL: its stored answer is an ordinary outcome at its 503, so the poll writes its acknowledgement — nothing published, nothing charged — and a stop that is ours keeps its fixed sentence", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("job-cancel");
  const store = bucket(slug);
  const replies = [];
  await withWire({ [W]: writer(replies) }, async (seen) => {
    const replyFor = { kind: "edit", request: "Make the header button forest green.", answers: [], picker: "sonnet", routedCost: 2, slug, pages: ["/", "/visit"] };
    const stopped = { ok: false, error: "cancelled", phase: "build", cost: 0, refunded: 1, msg: "I stopped that edit before anything was published.", replyFor };
    const id = "c".repeat(32);
    const p = await poll(worker, ON(store), id, { slug, state: "cancelled", billing: "refunded", cost: 1, result: { status: 503, body: JSON.stringify(stopped), type: "application/json" } });
    assert.equal(p.status, 503, "the stored status moved");
    assert.equal(p.body.replySource, "model", "a cancel at its 503 was read as a failure of ours");
    assert.equal(p.body.cost, 0);
    assert.equal(p.body.refunded, 1);
    assert.deepEqual(replies[0].facts.map((f) => f.text), [
      "The change was not made. The builder's own reason: “I stopped that edit before anything was published.”",
      "This change cost them nothing.",
      "Reading their message cost 2 credits.",
    ]);
    assert.equal(editBrowserReply(p.body, false, {}).text, p.body.reply);
    // A STOP THAT IS OURS — the service shut down under the job — keeps its sentence.
    const ours = { ...stopped, error: "stopped", msg: "That change was stopped before it could publish — the service running it was shut down or ran past its time limit. Send it again in a few minutes." };
    const p2 = await poll(worker, ON(store), "d".repeat(32), { slug, state: "failed", billing: "refunded", cost: 1, result: { status: 503, body: JSON.stringify(ours), type: "application/json" } });
    assert.equal(p2.body.reply, undefined, "a failure of ours was given a model's reply");
    assert.equal(replies.length, 1);
    assert.match(editBrowserReply(p2.body, false, {}).text, /^⚠️ That change was stopped before it could publish/);
    assert.equal(Object.hasOwn(p2.body, "replyFor"), false);
  }, { slug });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. TECHNICAL FAILURES KEEP THEIR FIXED SENTENCES; THE FIRST BUILD IS UNTOUCHED
// ─────────────────────────────────────────────────────────────────────────────

test("A FAILURE OF OURS KEEPS ITS FIXED SENTENCE: a question that could not be kept, a routing call that failed — no reply call is made, and the page says what it always said", async () => {
  const worker = await loadWorker();
  {
    const slug = freshSlug("unkept");
    const store = bucket(slug, { failQuestion: true });
    await withWire({ [T.pick]: { fields: ["shape"], question: Q }, [W]: writer([]) }, async (seen) => {
      const r = await postRoute(worker, ON(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, "Move the band"), "sync");
      assert.equal(r.status, 503);
      assert.equal(r.body.ours, true);
      assert.equal(replyCalls(seen), 0, "a failure of ours was sent to the reply model");
      assert.equal(r.body.reply, undefined);
      assert.ok(editBrowserReply(r.body, false, {}).text.startsWith("⚠️ " + r.body.msg));
    }, { slug });
  }
  {
    const slug = freshSlug("route-down");
    const store = bucket(slug);
    const log = [];
    await withWire({ [W]: writer([]) }, async (seen) => {
      const p = livePage(slug, worker, ON(store), log);
      p.ctx.siteSend("Make the footer blue");
      await until(p, answered(p, 2));
      assert.equal(log[0].body.failed, true, "the routing call did not fail as this case needs: " + JSON.stringify(log[0].body).slice(0, 200));
      assert.equal(log[0].body.reply, undefined);
      assert.equal(replyCalls(seen), 0);
      assert.match(p.last().t, /^⚠️ /, "a failed routing call was not said by the page's own sentence");
    }, { slug });
  }
});

test("THE FIRST BUILD IS UNTOUCHED, AND SO IS EVERYTHING WITH THE SWITCH OFF: no reply call, no reply field", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("first");
  const store = bucket(slug);
  await withWire({ route: { intent: "build", answered: false }, [W]: writer([]) }, async (seen) => {
    const r = await routeCall(worker, ON(store), { slug, message: "A bakery site for Harbour Loaf", firstBuild: true, hasSite: false });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    assert.equal(r.body.reply, undefined, "the first build's routing answer was given a reply");
    // EVEN ITS REFUSALS: a first build naming a question is refused as stale, in the route's own words.
    const stale = await routeCall(worker, ON(store), { slug, message: "Visit", ask: { id: "e".repeat(32) }, firstBuild: true, hasSite: false });
    assert.equal(stale.status, 409, JSON.stringify(stale.body).slice(0, 200));
    assert.equal(stale.body.error, "stale-question");
    assert.equal(stale.body.reply, undefined, "a first build's refusal was given a reply");
    assert.equal(replyCalls(seen), 0);
  });
  const slug2 = freshSlug("off");
  const store2 = bucket(slug2);
  seedQuestion(store2, slug2, { status: "cancelled" });
  await withWire({ [W]: writer([]) }, async (seen) => {
    const r = await routeCall(worker, envFor(store2), { slug: slug2, message: "Visit", ask: { id: question(store2, slug2).id } });
    assert.equal(r.body.error, "stale-question");
    assert.equal(r.body.reply, undefined, "a reply was written with the switch off");
    assert.equal(replyCalls(seen), 0);
  });
  // AND A QUEUED JOB IN THE CONTAINER IS HANDED THE SWITCH, or it would keep nothing for its reply.
  assert.ok(JOB_ENV_NAMES.includes("MODEL_REPLIES"));
  assert.equal(jobSecrets({ MODEL_REPLIES: "on", OTHER: "x" }).MODEL_REPLIES, "on");
});
