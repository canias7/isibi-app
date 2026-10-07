// EACH REQUEST'S REPLIES WITH THAT REQUEST (2026-10-05).
//
// The owner, after run 99: *"fix the product bug that appends historical
// requests' replies beneath a new message: preserve each reply's association
// with its original request and place it with that request, including delayed
// model replies, questions, reloads and opening the site in another browser.
// Keep the composer usable while history loads, preserve existing
// conversations, and prevent duplicate messages or reapplying completed
// changes. Use request/job identity rather than matching message wording, and
// keep normal explanations model-written. Test a new message sent before
// history finishes loading, historical and current replies arriving in either
// order, duplicate polls, pending replies settling, and reloads."*
//
// The page's own functions, cut out of public/chat.js and run in a VM
// (`test/fixtures/browser-page.mjs`), with every request answered by the REAL
// Worker on the stateful platform (`test/fixtures/request-flow.mjs`) — the
// routing call, the request routes, the job poll, the reply writer on the
// queue. Earlier requests are made by another device's routing calls
// (`sendMessage`), as a second browser would meet them. Every case reads the
// thread by identity — each message's request (`req`, a card's `request`) and
// job (`job`) — never by its words; the words are checked only to show they are
// the model's (the platform's writer answers with the facts it was given).
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer is supplied. The pixels are
// checked separately, in a real Chromium, and shown as screenshots.
import test from "node:test";
import assert from "node:assert/strict";
import { page, settle as drain, copy } from "./fixtures/browser-page.mjs";
import { platform, pump, pumpBeside, sendMessage, call, T } from "./fixtures/request-flow.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";

// THREE DESCRIPTIONS, ONE MESSAGE EACH: every message is one part, on the look
// layer, and its reply names its own new description.
const MSGS = [
  "Change the site description to say we bake overnight sourdough",
  "Change the site description to say we open at seven every morning",
  "Change the site description to say we close on Mondays",
  "Change the site description to say we sell rye on Saturdays",
  "Change the site description to say we bake to order",
];
const NEWS = [
  "Overnight sourdough from a Bristol side street.",
  "Open from seven every morning, Bristol side street.",
  "Closed on Mondays; open every other day.",
  "Rye on Saturdays, sourdough every day.",
  "Baked to order, collected at the counter.",
];
const which = (args, n) => {
  const said = JSON.stringify((args && args.messages) || "");
  const i = MSGS.findIndex((m) => said.includes(m));
  return i >= 0 ? i : n;
};
const ANSWERS = {
  route: MSGS.map(() => ({ intent: "edit", layer: "look" })),
  [T.pick]: (args, n) => ({ fields: ["description"], scopes: [{ part: "description", words: MSGS[which(args, n)] }] }),
  "lane:description": (args, n) => NEWS[which(args, n)],
};
// THE KEYS: another device's, and the ones a page mints, one per message —
// each page load its own (`tag`), as a real page's are random.
const K1 = "otherdevice00000000001";
const K2 = "otherdevice00000000002";
const KEYOF = (tag, n) => tag + String(n).padStart(20 - tag.length, "0");
const PAGEKEY = (n) => KEYOF("pagekey", n);
const slugOf = (k) => "rpl-" + k + "-" + Math.random().toString(16).slice(2, 8);
const siteFor = (slug) => ({ id: "origin-1", slug, react: true, name: "Harbour Loaf", url: "https://" + slug + ".gofarther.app/", pages: [{ path: "/" }, { path: "/visit" }], msgs: [] });

/** The page's network, answered by the real Worker: `{ status, body, headers }`. */
function wire(P, seen = []) {
  return (url, method, body) => (async () => {
    seen.push({ url, method, body });
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
/**
 * THE NETWORK WITH ITS ANSWERS HELD WHERE A CASE SAYS: `hold(url)` gives a
 * name for an answer to keep back until `release(name)`; everything else is
 * answered at once.
 */
function gated(P, seen, hold) {
  const real = wire(P, seen);
  const gates = new Map();
  const gate = (name) => {
    if (!gates.has(name)) { let open; const p = new Promise((ok) => { open = ok; }); gates.set(name, { p, open }); }
    return gates.get(name);
  };
  const answer = (url, method, body) => {
    const name = hold(url, method);
    return name ? gate(name).p.then(() => real(url, method, body)) : real(url, method, body);
  };
  return { answer, release: (name) => gate(name).open() };
}
/** One page load on the site — a fresh browser's, or `site` as a reload finds it — with its keys minted as a page's are. */
function openPage(P, answer, { site, tag = "pagekey" } = {}) {
  const p = page({ site: site || siteFor(P.slug), answer, timers: true });
  p.ctx.buildPicker = "sonnet";
  let n = 0;
  p.ctx.EditPoll.newIdemKey = () => KEYOF(tag, ++n);
  return p;
}
/** A page opened as the real one is: its requests and its question read from the server, its held replies followed. */
function opened(p) {
  p.ctx.siteHeldRepliesCheck(p.s);
  p.ctx.siteAskCheck(p.s);
  p.ctx.siteRequestsCheck(p.s);
  return p;
}
/** A request as the server has it, read through its own route. */
async function viewOf(P, key) {
  const r = await wire(P)("/api/site/request/" + P.slug + "/" + key, "GET");
  return JSON.parse(r.body);
}
async function withPage(opts, fn, after = () => {}) {
  const compiler = installCompiler();
  const P = platform(opts);
  // `after` OPENS ANY WRITER A CASE HELD, so a failed assertion never leaves one hanging.
  try { return await fn(P); } finally { after(); P.close(); compiler.uninstall(); }
}
const idle = async () => { await drain(); await drain(); };
/** Let the page look again, as many times as it takes its polls to land. */
const looks = async (p, n = 3) => { for (let i = 0; i < n; i++) { p.flush(); await idle(); } };
/**
 * THE THREAD BY IDENTITY: `u` for a message sent (with the request it belongs
 * to), `card:<key>` for a request's card, `a:<key>` for a request's message
 * (`#` when it is a part's reply, `…` while it holds a reply's place, `=` the
 * request's own reply), and `a:` for anything else.
 */
const shape = (p) => p.s.msgs.map((m) => (m.r === "u" ? "u" + (m.req ? ":" + m.req : "")
  : m.request ? "card:" + m.request
    : "a:" + (m.req || "") + (m.job ? "#" : "") + (m.held ? "…" : "") + (m.for ? "=" : "")));
const textOf = (p, key) => p.s.msgs.filter((m) => m.req === key && m.r === "a" && m.job).map((m) => m.t);
const posts = (seen, re) => seen.filter((c) => c.method === "POST" && re.test(c.url));
/** Two earlier requests, made from another device and finished, a minute apart. */
async function earlier(P) {
  for (const [i, k] of [[0, K1], [1, K2]]) {
    const r = await sendMessage(P, { message: MSGS[i], key: k });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body && r.body.request && r.body.request.key === k, "the server did not take message " + i + " on as a request");
    await pump(P);
    assert.equal(P.record(k).ended, true, "request " + i + " did not end");
    P.advance(60000);
  }
}

test("PLACE 1 — another browser, and a message sent before the earlier requests are read: the composer takes it at once, the earlier requests go above it in the order they were made, each reply under its own card, and this message's card and reply under it; nothing of theirs is applied again", async () => {
  await withPage({ slug: slugOf("p1"), replies: true, answers: ANSWERS }, async (P) => {
    await earlier(P);
    const seen = [];
    const net = gated(P, seen, (url) => (url === "/api/site/requests/" + P.slug ? "list" : ""));
    const b = opened(openPage(P, net.answer));
    await idle();
    // THE READ OF THE SITE'S REQUESTS IS STILL OUT, AND THE COMPOSER IS FREE.
    assert.equal(b.busy(), false, "the page was busy while the earlier requests loaded");
    assert.deepEqual(shape(b), []);
    b.ctx.siteSend(MSGS[2]);
    await idle();
    const K3 = PAGEKEY(1);
    assert.ok(P.record(K3), "the message was not taken on as a request");
    assert.equal(b.busy(), false);
    assert.deepEqual(shape(b), ["u:" + K3, "card:" + K3]);
    // ITS PART RUNS, AND THE PAGE SHOWS ITS REPLY.
    await pump(P);
    await looks(b);
    assert.deepEqual(shape(b), ["u:" + K3, "card:" + K3, "a:" + K3 + "#"]);
    // THE EARLIER REQUESTS ARRIVE NOW: above the message, oldest first, each reply with its card.
    net.release("list");
    await idle();
    await looks(b);
    assert.deepEqual(shape(b), ["card:" + K1, "a:" + K1 + "#", "card:" + K2, "a:" + K2 + "#", "u:" + K3, "card:" + K3, "a:" + K3 + "#"]);
    // EACH REPLY THE MODEL'S — and the three read alike ("Changed the
    // description.": the fact carries no new words, the backlog's MR8), so
    // only their identity tells whose each is.
    const said = [K1, K2, K3].map((k) => textOf(b, k));
    for (const t of said) assert.equal(t.length, 1);
    for (const [t] of said) assert.ok(P.factsOf(t), "a reply is not the writer's: " + t);
    assert.equal(new Set(said.map(([t]) => t)).size, 1, "the case meant to show replies alike by their words: " + JSON.stringify(said));
    // NOTHING OF THE EARLIER REQUESTS WAS REPLAYED HERE: no question, nothing
    // back in the box, no step posted. Their finished jobs moved the preview on
    // to what is published now (2026-10-05, the owner's review: the page cannot
    // tell whether its preview was loaded before or after a job published) —
    // ONCE FOR BOTH since 2026-10-07, as the page's first look holds the preview
    // until it has read them (`sitePreviewHold`) — and this message's once: two.
    assert.equal(b.s.previewV, 2, "the earlier requests' jobs were not reconciled once together, or this message's once");
    await looks(b);
    assert.equal(b.s.previewV, 2, "looking again moved the preview again");
    assert.equal(b.ask(), null);
    assert.ok(!b.s.unsent || b.s.unsent.length === 0, "an earlier request put words back in the box");
    assert.deepEqual(posts(seen, /\/(edit|addon)$/), [], "the page posted a step");
    assert.equal(b.s.requests[K1].own, false);
    assert.equal(b.s.requests[K2].own, false);
    assert.equal(b.s.requests[K3].own, true);
  });
});

for (const first of ["history", "current"]) {
  test("PLACE 2 (" + first + " reply first) — an earlier request's reply and this message's arrive in either order, and each lands with its own request: the same thread either way", async () => {
    await withPage({ slug: slugOf("p2" + first[0]), replies: true, answers: ANSWERS }, async (P) => {
      const r = await sendMessage(P, { message: MSGS[0], key: K1 });
      assert.equal(r.status, 200);
      await pump(P);
      P.advance(60000);
      const oldJob = P.jobsOf(K1)[0].id;
      let newJob = "";
      const net = gated(P, [], (url) => (url === "/api/site/edit/" + oldJob ? "history" : newJob && url === "/api/site/edit/" + newJob ? "current" : ""));
      const b = opened(openPage(P, net.answer));
      await idle();
      // THE EARLIER REQUEST'S CARD IS HERE; ITS PART'S REPLY IS HELD BACK.
      assert.deepEqual(shape(b), ["card:" + K1]);
      b.ctx.siteSend(MSGS[2]);
      await idle();
      const K3 = PAGEKEY(1);
      newJob = P.jobsOf(K3)[0].id;
      await pump(P);
      await looks(b);
      assert.deepEqual(shape(b), ["card:" + K1, "u:" + K3, "card:" + K3], "a reply landed before its poll answered");
      const [a, z] = first === "history" ? ["history", "current"] : ["current", "history"];
      net.release(a);
      await idle();
      await looks(b);
      assert.deepEqual(shape(b), a === "history"
        ? ["card:" + K1, "a:" + K1 + "#", "u:" + K3, "card:" + K3]
        : ["card:" + K1, "u:" + K3, "card:" + K3, "a:" + K3 + "#"]);
      net.release(z);
      await idle();
      await looks(b);
      assert.deepEqual(shape(b), ["card:" + K1, "a:" + K1 + "#", "u:" + K3, "card:" + K3, "a:" + K3 + "#"]);
      assert.equal(b.s.msgs.find((m) => m.req === K1 && m.job).job, oldJob);
      assert.equal(b.s.msgs.find((m) => m.req === K3 && m.job).job, newJob);
    });
  });
}

test("PLACE 3 — duplicate polls: looking again, two readings of one request at once, and a page whose record of the requests is lost add no second message", async () => {
  await withPage({ slug: slugOf("p3"), replies: true, answers: ANSWERS }, async (P) => {
    await earlier(P);
    const b = opened(openPage(P, wire(P)));
    await idle();
    await looks(b);
    b.ctx.siteSend(MSGS[2]);
    await idle();
    await pump(P);
    await looks(b);
    const K3 = PAGEKEY(1);
    const full = ["card:" + K1, "a:" + K1 + "#", "card:" + K2, "a:" + K2 + "#", "u:" + K3, "card:" + K3, "a:" + K3 + "#"];
    assert.deepEqual(shape(b), full);
    // LOOKING AGAIN: every request followed again, the held replies again.
    for (const k of [K1, K2, K3]) b.ctx.siteRequestFollow(b.s.id, k);
    b.ctx.siteHeldRepliesCheck(b.s);
    await looks(b);
    assert.deepEqual(shape(b), full, "a look showed something twice");
    // TWO READINGS OF ONE REQUEST AT ONCE, its part's reply not yet shown: one message.
    b.ctx.siteSend(MSGS[3]);
    await idle();
    await pump(P);
    const K4 = PAGEKEY(2);
    const v = await viewOf(P, K4);
    assert.ok(v.request && v.request.ended, "the second request did not end");
    await Promise.all([
      b.ctx.siteRequestShow(b.s.id, K4, v.request, null, null, null),
      b.ctx.siteRequestShow(b.s.id, K4, copy(v.request), null, null, null),
    ]);
    await looks(b);
    const more = [...full, "u:" + K4, "card:" + K4, "a:" + K4 + "#"];
    assert.deepEqual(shape(b), more, "two readings at once showed a reply twice");
    // A PAGE WHOSE RECORD OF THE REQUESTS IS LOST (another tab wrote over it):
    // the thread's own marks say what is shown, and nothing is said again.
    const lost = copy(b.s);
    lost.requests = {};
    const c = opened(openPage(P, wire(P), { site: lost, tag: "pagelost" }));
    await idle();
    await looks(c);
    assert.deepEqual(shape(c), more, "a page that lost its record said a reply again");
    assert.deepEqual(c.s.msgs.map((m) => m.t), b.s.msgs.map((m) => m.t));
  });
});

test("PLACE 4 — a reply still being written: an earlier request's part reply holds its place under its own card, above a message sent since, and settles there, the thread no longer", async () => {
  let release;
  const gate = new Promise((ok) => { release = ok; });
  await withPage({ slug: slugOf("p4"), replies: true, replyWith: async ({ n }) => { if (n === 0) await gate; }, answers: ANSWERS }, async (P) => {
    const r = await sendMessage(P, { message: MSGS[0], key: K1 });
    assert.equal(r.status, 200);
    const job = P.jobsOf(K1)[0].id;
    const running = await pumpBeside(P, (m) => m.body && m.body.kind === "edit-reply" && m.body.id === job);
    assert.equal(running.length, 1, "the earlier part's reply was not asked for");
    assert.equal(P.record(K1).ended, true);
    P.advance(60000);
    const b = opened(openPage(P, wire(P)));
    await idle();
    await looks(b);
    assert.deepEqual(shape(b), ["card:" + K1, "a:" + K1 + "#…"]);
    b.ctx.siteSend(MSGS[2]);
    await idle();
    await pump(P);
    await looks(b);
    const K3 = PAGEKEY(1);
    assert.deepEqual(shape(b), ["card:" + K1, "a:" + K1 + "#…", "u:" + K3, "card:" + K3, "a:" + K3 + "#"]);
    const n = b.s.msgs.length;
    // WRITTEN: the held line becomes the model's reply where it stands.
    release();
    await Promise.all(running);
    await looks(b, 4);
    assert.deepEqual(shape(b), ["card:" + K1, "a:" + K1 + "#", "u:" + K3, "card:" + K3, "a:" + K3 + "#"]);
    assert.equal(b.s.msgs.length, n, "a message was added instead of the held one settled");
    assert.ok(P.factsOf(b.s.msgs[1].t), "the settled reply is not the writer's: " + b.s.msgs[1].t);
    // THE EARLIER REQUEST'S JOB MOVED THE PREVIEW ON ONCE (reconciled, never
    // replayed), and settling its reply moved nothing more; this message's once.
    assert.equal(b.s.previewV, 2, "the earlier request's job was reconciled more or less than once");
  }, () => release());
});

test("PLACE 4b — an earlier request's own reply, written late: it goes under that request's card, above a message sent since, never at the bottom", async () => {
  let release;
  const gate = new Promise((ok) => { release = ok; });
  const ofRequest = (facts) => facts.some((f) => /^Stopped at their request/.test(f.text));
  const ADD = "add a gallery page";
  await withPage({
    slug: slugOf("p4b"), replies: true, replyWith: async ({ facts }) => { if (ofRequest(facts)) await gate; },
    answers: { ...ANSWERS, route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "edit", layer: "look" }] },
  }, async (P) => {
    const r = await sendMessage(P, { message: MSGS[0] + ", and " + ADD + ".", key: K1 });
    assert.equal(r.status, 200);
    // STOPPED ON THE OTHER DEVICE before anything ran: the request's own reply says so.
    const stop = await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + K1);
    assert.equal(stop.status, 200);
    const running = await pumpBeside(P, (m) => m.body && m.body.kind === "edit-reply" && !m.body.id);
    assert.equal(running.length, 1, "the request's own reply was not asked for");
    assert.equal(P.record(K1).ended, true);
    P.advance(60000);
    // WHAT ITS PARTS SAY THEMSELVES (a part stopped on its way has a reply of its own).
    const parts = (await viewOf(P, K1)).request.parts.flatMap((x) => x.jobs).map(() => "a:" + K1 + "#");
    const b = opened(openPage(P, wire(P)));
    await idle();
    await looks(b);
    assert.deepEqual(shape(b), ["card:" + K1, ...parts]);
    b.ctx.siteSend(MSGS[2]);
    await idle();
    await pump(P);
    await looks(b);
    const K3 = PAGEKEY(1);
    assert.deepEqual(shape(b), ["card:" + K1, ...parts, "u:" + K3, "card:" + K3, "a:" + K3 + "#"]);
    release();
    await Promise.all(running);
    await looks(b, 4);
    assert.deepEqual(shape(b), ["card:" + K1, ...parts, "a:" + K1 + "=", "u:" + K3, "card:" + K3, "a:" + K3 + "#"]);
    assert.match(b.s.msgs[1 + parts.length].t, /Stopped at their request/);
    // AND ONCE: looking again adds nothing.
    b.ctx.siteRequestFollow(b.s.id, K1);
    await looks(b);
    assert.equal(b.s.msgs.filter((m) => m.for).length, 1, "the request's own reply was shown twice");
    // NOR A PAGE WHOSE RECORD OF THE REQUESTS IS LOST: the thread's mark says it is shown.
    const lost = copy(b.s);
    lost.requests = {};
    const c = opened(openPage(P, wire(P), { site: lost, tag: "pagelost" }));
    await idle();
    await looks(c);
    assert.deepEqual(shape(c), shape(b), "a page that lost its record said the request's own reply again");
  }, () => release());
});

test("PLACE 5 — reloads: the thread comes back as it was, with nothing said or applied again; a request still running at a reload keeps its reply with it, under a message sent after the reload", async () => {
  await withPage({ slug: slugOf("p5"), replies: true, answers: ANSWERS }, async (P) => {
    await earlier(P);
    const b = opened(openPage(P, wire(P)));
    await idle();
    await looks(b);
    b.ctx.siteSend(MSGS[2]);
    await idle();
    await pump(P);
    await looks(b);
    const before = shape(b);
    const shown = b.s.previewV;
    // RELOADED: the site as `sitesSave` kept it, opened as the page opens it.
    const c = opened(openPage(P, wire(P), { site: copy(b.s), tag: "pagec" }));
    await idle();
    await looks(c);
    assert.deepEqual(shape(c), before, "the reloaded thread is not the one kept");
    assert.equal(c.s.previewV, shown, "the reload applied a change again");
    // A MESSAGE WHOSE PART HAS NOT RUN, THEN ANOTHER RELOAD, AND A MESSAGE SENT
    // AT ONCE: the first's reply goes with the first, above the second.
    c.ctx.siteSend(MSGS[3]);
    await idle();
    const K4 = KEYOF("pagec", 1);
    assert.ok(P.record(K4));
    const d = opened(openPage(P, wire(P), { site: copy(c.s), tag: "paged" }));
    await idle();
    d.ctx.siteSend(MSGS[4]);
    await idle();
    const K5 = KEYOF("paged", 1);
    await pump(P);
    await looks(d, 4);
    assert.deepEqual(shape(d), [...before, "u:" + K4, "card:" + K4, "a:" + K4 + "#", "u:" + K5, "card:" + K5, "a:" + K5 + "#"]);
    // SENT FROM THIS BROWSER, so applied here — and, both finishing together
    // and read together, with one preview move for the two (2026-10-07,
    // `sitePreviewHold`: a move asked for while the site's preview is held is
    // made once when the last hold lets go).
    assert.equal(d.s.previewV, shown + 1);
  });
});

test("PLACE 6 — questions go with their requests: an earlier question already answered is shown under its card and not made live; one still waiting is made live under its card, once; its answer joins that request, and the reply it brings comes after it", async () => {
  const QA = { text: "Which word should lead — overnight or slow?", options: ["Overnight", "Slow"] };
  const QB = { text: "From which hour do you open?", options: ["Seven", "Eight"] };
  await withPage({
    slug: slugOf("p6"), replies: true,
    answers: {
      ...ANSWERS,
      route: [{ intent: "edit", layer: "look" }, { intent: "edit", layer: "look", answered: true }, { intent: "edit", layer: "look" }, { intent: "edit", layer: "look", answered: true }],
      "lane:description": (args, n) => (n === 0 ? { question: QA } : n === 2 ? { question: QB } : NEWS[which(args, n)]),
    },
  }, async (P) => {
    // ON THE OTHER DEVICE: a request that asked and was answered there; then one still waiting on its question.
    await sendMessage(P, { message: MSGS[0], key: K1 });
    await pump(P);
    const qa = P.question();
    assert.equal(qa.requestKey, K1);
    await sendMessage(P, { message: "Overnight", ask: { id: qa.id, chosen: true } });
    await pump(P);
    assert.equal(P.record(K1).ended, true);
    P.advance(60000);
    await sendMessage(P, { message: MSGS[1], key: K2 });
    await pump(P);
    const qb = P.question();
    assert.equal(qb.requestKey, K2);
    assert.equal(P.record(K2).parts[0].status, "waiting");
    // THIS BROWSER OPENS THE SITE.
    const seen = [];
    const b = opened(openPage(P, wire(P, seen)));
    await idle();
    await looks(b);
    assert.deepEqual(shape(b), ["card:" + K1, "a:" + K1 + "#", "a:" + K1 + "#", "card:" + K2, "a:" + K2 + "#"]);
    const asks = (id) => b.s.msgs.filter((m) => m.ask === id);
    assert.equal(asks(qa.id).length, 1, "the answered question is not shown once");
    assert.equal(asks(qb.id).length, 1, "the waiting question is not shown once");
    assert.equal(asks(qa.id)[0].req, K1);
    assert.equal(asks(qb.id)[0].req, K2);
    // ONLY THE WAITING ONE IS LIVE, and it knows its request.
    assert.equal(b.ask().id, qb.id);
    assert.deepEqual(b.ask().request, { key: K2, part: 0 });
    assert.equal(b.ctx.siteLiveAskHTML(asks(qa.id)[0], b.s), "", "the answered question still offers its answers");
    assert.match(b.ctx.siteLiveAskHTML(asks(qb.id)[0], b.s), /data-ask-ans="Seven"/);
    // ANSWERED HERE: the answer is that request's, and its reply comes after it.
    b.click("data-ask-ans", "Seven");
    await idle();
    await pump(P);
    await looks(b, 4);
    assert.equal(P.record(K2).ended, true);
    assert.deepEqual(shape(b), ["card:" + K1, "a:" + K1 + "#", "a:" + K1 + "#", "card:" + K2, "a:" + K2 + "#", "u:" + K2, "a:" + K2 + "#"]);
    assert.equal(b.ask(), null);
    // THE OTHER DEVICE'S CHANGE WAS RECONCILED ONCE (the preview moved on, its
    // question never made live again); THE ONE ANSWERED HERE WAS APPLIED, ONCE.
    assert.equal(b.s.previewV, 2);
    assert.deepEqual(posts(seen, /\/(edit|addon)$/), []);
  });
});

test("PLACE 7 — an older thread, from before the marks: its messages keep their order, and a reply still to come for a request it was showing goes after that request's earlier reply, not above it", async () => {
  let release;
  const gate = new Promise((ok) => { release = ok; });
  const ADD = "add a gallery page";
  const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
  await withPage({
    slug: slugOf("p7"), replies: true, replyWith: async ({ n }) => { if (n === 1) await gate; },
    answers: {
      ...ANSWERS, route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }],
      [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] },
    },
  }, async (P) => {
    // A REQUEST OF TWO PARTS, SENT FROM THIS BROWSER BEFORE THE CHANGE: part 0
    // shown then, part 1's reply still being written.
    const r = await sendMessage(P, { message: MSGS[0] + ", and " + ADD + ".", key: K1 });
    assert.equal(r.status, 200);
    const add = () => P.jobsOf(K1).find((j) => j.op === "addon");
    const running = await pumpBeside(P, (m) => m.body && m.body.kind === "edit-reply" && add() && m.body.id === add().id);
    assert.equal(running.length, 1);
    const v = (await viewOf(P, K1)).request;
    const job0 = v.parts[0].jobs[0];
    assert.ok(job0);
    // THE THREAD AS THE OLD PAGE KEPT IT: nothing marked, the record without `own`.
    const site = siteFor(P.slug);
    site.msgs = [
      { r: "u", t: "Make the logo bigger" }, { r: "a", t: "✅ Made the logo bigger." },
      { r: "u", t: MSGS[0] + ", and " + ADD + "." }, { r: "a", t: "", request: K1 }, { r: "a", t: "Changed the description." },
      { r: "u", t: "Thanks" }, { r: "a", t: "You're welcome." },
    ];
    site.requests = { [K1]: { at: Date.now(), view: v, shown: [job0], replied: false, replies: [], closed: false, approving: [] } };
    const old = site.msgs.map((m) => m.t);
    const b = opened(openPage(P, wire(P), { site }));
    await idle();
    await looks(b);
    release();
    await Promise.all(running);
    await looks(b, 4);
    const now = b.s.msgs.map((m) => m.t);
    // EVERY OLD MESSAGE STILL THERE, IN ITS ORDER.
    assert.deepEqual(now.filter((t) => old.includes(t)), old);
    // PART 1'S REPLY, after part 0's and before the next message.
    const at = b.s.msgs.findIndex((m) => m.req === K1 && m.job);
    assert.equal(at, 5, "part 1's reply is not under part 0's: " + JSON.stringify(shape(b)));
    assert.equal(b.s.msgs[at].job, add().id);
    assert.equal(b.s.msgs.length, old.length + 1);
  }, () => release());
});

test("PLACE 8 — a question cancelled here, of a request made on another device: the cancel and what it is told go with that request, and a reading of the request taken before the cancel does not make the question live again", async () => {
  const QB = { text: "From which hour do you open?", options: ["Seven", "Eight"] };
  await withPage({ slug: slugOf("p8"), replies: true, answers: { ...ANSWERS, "lane:description": () => ({ question: QB }) } }, async (P) => {
    await sendMessage(P, { message: MSGS[1], key: K2 });
    await pump(P);
    const qb = P.question();
    assert.equal(qb.requestKey, K2);
    // A READING TAKEN NOW, while it waits; it lands after the cancel.
    const stale = (await viewOf(P, K2)).request;
    assert.equal(stale.parts[0].status, "waiting");
    const b = opened(openPage(P, wire(P)));
    await idle();
    await looks(b);
    assert.deepEqual(shape(b), ["card:" + K2, "a:" + K2 + "#"]);
    assert.equal(b.ask().id, qb.id);
    // CANCELLED HERE: the cancel and its acknowledgement, under the request's card.
    b.click("data-ask-cancel", "1");
    await idle();
    assert.equal(b.ask(), null);
    assert.deepEqual(shape(b).slice(0, 4), ["card:" + K2, "a:" + K2 + "#", "u:" + K2, "a:" + K2]);
    await b.ctx.siteRequestShow(b.s.id, K2, stale, null, null, null);
    assert.equal(b.ask(), null, "a reading from before the cancel made the question live again");
    // THE REQUEST ENDS WITH ITS OWN REPLY, after the cancel and what it was told.
    await pump(P);
    await looks(b, 4);
    assert.deepEqual(shape(b), ["card:" + K2, "a:" + K2 + "#", "u:" + K2, "a:" + K2, "a:" + K2 + "="]);
    assert.match(b.s.msgs[4].t, /^Cancelled with the question it asked/);
    assert.equal(b.ask(), null);
  });
});

test("PLACE 9 — an older thread's request card stays under the message that asked for it: an earlier request picked up from the server goes above that message, never between them", async () => {
  await withPage({ slug: slugOf("p9"), replies: true, answers: ANSWERS }, async (P) => {
    const r = await sendMessage(P, { message: MSGS[0], key: K1 });
    assert.equal(r.status, 200);
    await pump(P);
    const at = (await viewOf(P, K1)).request.at;
    // THE OLDER THREAD: a request of this browser's, made after K1 and finished
    // here (so the server's list is not asked to repeat it), nothing marked.
    const KL = "olderthreadrequest0001";
    const site = siteFor(P.slug);
    site.msgs = [{ r: "u", t: "Make the logo bigger" }, { r: "a", t: "", request: KL }, { r: "a", t: "✅ Made the logo bigger." }];
    site.requests = { [KL]: { at: Date.now(), view: { key: KL, state: "done", ended: true, at: at + 60000, parts: [] }, shown: [], replied: true, replies: ["end"], closed: true, approving: [] } };
    const b = opened(openPage(P, wire(P), { site }));
    await idle();
    await looks(b);
    assert.deepEqual(shape(b), ["card:" + K1, "a:" + K1 + "#", "u", "card:" + KL, "a:"]);
    assert.deepEqual(b.s.msgs.slice(2).map((m) => m.t), ["Make the logo bigger", "", "✅ Made the logo bigger."]);
  });
});

test("PLACE 1b — the earlier requests arrive while the message's own routing reply is still out: they go above it all the same, and its card goes under it when the reply comes", async () => {
  await withPage({ slug: slugOf("p1b"), replies: true, answers: ANSWERS }, async (P) => {
    await earlier(P);
    const net = gated(P, [], (url) => (url === "/api/site/requests/" + P.slug ? "list" : url === "/api/site/route" ? "route" : ""));
    const b = opened(openPage(P, net.answer));
    await idle();
    b.ctx.siteSend(MSGS[2]);
    await idle();
    // ON ITS WAY: the message is there, and nothing has been said about it.
    assert.deepEqual(shape(b), ["u"]);
    assert.equal(b.busy(), true);
    net.release("list");
    await idle();
    await looks(b);
    assert.deepEqual(shape(b), ["card:" + K1, "a:" + K1 + "#", "card:" + K2, "a:" + K2 + "#", "u"], "an earlier request went under a message sent since the page opened");
    net.release("route");
    await idle();
    const K3 = PAGEKEY(1);
    assert.ok(P.record(K3));
    await pump(P);
    await looks(b);
    assert.deepEqual(shape(b), ["card:" + K1, "a:" + K1 + "#", "card:" + K2, "a:" + K2 + "#", "u:" + K3, "card:" + K3, "a:" + K3 + "#"]);
  });
});

test("PLACE 10 — an answer whose routing reply is lost on the way back, though the server took it: the answer and what the page says about it stay with the request, and the reply the answer brings comes after them", async () => {
  const QB = { text: "From which hour do you open?", options: ["Seven", "Eight"] };
  await withPage({
    slug: slugOf("p10"), replies: true,
    answers: {
      ...ANSWERS,
      route: [{ intent: "edit", layer: "look" }, { intent: "edit", layer: "look", answered: true }],
      "lane:description": (args, n) => (n === 0 ? { question: QB } : NEWS[which(args, n)]),
    },
  }, async (P) => {
    await sendMessage(P, { message: MSGS[1], key: K2 });
    await pump(P);
    const qb = P.question();
    assert.equal(qb.requestKey, K2);
    const real = wire(P);
    let lose = true;
    const answer = (url, method, body) => {
      if (url === "/api/site/route" && lose) { lose = false; return real(url, method, body).then(() => ({ reject: new Error("connection reset") })); }
      return real(url, method, body);
    };
    const b = opened(openPage(P, answer));
    await idle();
    await looks(b);
    assert.equal(b.ask().id, qb.id);
    b.click("data-ask-ans", "Seven");
    await idle();
    // THE SERVER TOOK THE ANSWER; THE PAGE NEVER HEARD, AND SAID SO.
    assert.notEqual(P.record(K2).parts[0].status, "waiting", "the server did not take the answer");
    assert.deepEqual(shape(b), ["card:" + K2, "a:" + K2 + "#", "u:" + K2, "a:" + K2]);
    // THE RESUMED PART'S REPLY, after the answer and what was said about it.
    await pump(P);
    await looks(b, 4);
    assert.equal(P.record(K2).ended, true);
    assert.deepEqual(shape(b), ["card:" + K2, "a:" + K2 + "#", "u:" + K2, "a:" + K2, "a:" + K2 + "#"]);
  });
});

test("PLACE 6b — a question another device's request asks while this page is open: drawn once under its card, and made live here by the request's own reading", async () => {
  const QB = { text: "From which hour do you open?", options: ["Seven", "Eight"] };
  await withPage({
    slug: slugOf("p6b"), replies: true,
    answers: {
      ...ANSWERS,
      route: [{ intent: "edit", layer: "look" }, { intent: "edit", layer: "look", answered: true }],
      "lane:description": (args, n) => (n === 0 ? { question: QB } : NEWS[which(args, n)]),
    },
  }, async (P) => {
    // TAKEN ON FROM THE OTHER DEVICE; ITS PART HAS NOT RUN YET.
    const r = await sendMessage(P, { message: MSGS[1], key: K2 });
    assert.equal(r.status, 200);
    assert.equal(P.question(), null);
    // THIS PAGE OPENS: no live question yet, so the open-time check has none to keep.
    const b = opened(openPage(P, wire(P)));
    await idle();
    await looks(b);
    assert.equal(b.ask(), null);
    // THE PART ASKS NOW.
    await pump(P);
    const qb = P.question();
    assert.equal(qb.requestKey, K2);
    await looks(b, 4);
    assert.deepEqual(shape(b), ["card:" + K2, "a:" + K2 + "#"]);
    assert.equal(b.s.msgs.filter((m) => m.ask === qb.id).length, 1, "the question is not drawn once");
    assert.equal(b.ask() && b.ask().id, qb.id, "the waiting question was not made live here");
    assert.deepEqual(b.ask().request, { key: K2, part: 0 });
    // ANSWERED HERE: its reply after the answer, and the request now this page's own.
    b.click("data-ask-ans", "Eight");
    await idle();
    await pump(P);
    await looks(b, 4);
    assert.equal(P.record(K2).ended, true);
    assert.deepEqual(shape(b), ["card:" + K2, "a:" + K2 + "#", "u:" + K2, "a:" + K2 + "#"]);
    assert.equal(b.s.requests[K2].own, true);
  });
});
