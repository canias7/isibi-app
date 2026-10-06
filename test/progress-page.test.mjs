// PROGRESS LINES ON THE PAGE, WITHOUT A BROWSER (2026-10-06): the real
// functions of public/chat.js and public/edit-poll.js, run in a VM — so the
// drawing, the keeping and the finding run on unit CI, where the real-Chromium
// cases (`test/progress-browser.test.mjs`) are skipped.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { page, settle, copy } from "./fixtures/browser-page.mjs";

const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const cut = (head) => { const o = CHAT.indexOf("\n" + head); assert.ok(o > 0, head + " is gone"); return CHAT.slice(o, CHAT.indexOf("\n}\n", o) + 3); };
const cutLine = (head) => { const o = CHAT.indexOf("\n" + head); assert.ok(o > 0, head + " is gone"); return CHAT.slice(o, CHAT.indexOf("\n", o + 1) + 1); };

const JOB = "a" + "1".repeat(31);
const SOLO = "b" + "2".repeat(31);
const SITE = { id: "origin-1", slug: "fold-lane-bakery", react: true, name: "Fold Lane", url: "https://fold-lane-bakery.gofarther.app/", pages: [{ path: "/" }], msgs: [] };
const LINES = [{ job: JOB, n: 0, ms: 30000, text: "Adding a page <with> a form." }, { job: JOB, n: 1, ms: 91000, text: "The list is designed." }];
const partView = (status, progress) => ({ key: "pagerequestkey000001", state: status === "done" ? "done" : "running", ended: status === "done", stop: false, at: 1000, updatedAt: 2000, routedUnsaid: 0, parts: [{ n: 0, words: "Add a page", status, ids: [JOB], jobs: status === "done" ? [JOB] : [], charged: 0, route: "addon", ...(progress ? { progress } : {}) }] });

test("POLL — progressLines reads what the server wrote, in order, whole: an entry that does not read is left out, never repaired, and no length is imposed", () => {
  const long = "A long, useful line. ".repeat(200).trim();
  const lines = EditPoll.progressLines({ progress: [
    { n: 0, ms: 1200, text: "  first  " }, { n: 1, ms: -5, text: "second" }, { n: 2.5, ms: 0, text: "bad n" }, { n: 3, ms: 0, text: 7 },
    null, "x", { n: 4, ms: 9, text: "   " }, { n: 5, ms: 10, text: long, job: JOB },
  ] });
  assert.deepEqual(lines, [{ n: 0, ms: 1200, text: "first" }, { n: 1, ms: 0, text: "second" }, { n: 5, ms: 10, text: long, job: JOB }]);
  for (const b of [null, undefined, {}, { progress: "x" }, { progress: {} }]) assert.deepEqual(EditPoll.progressLines(b), [], JSON.stringify(b));
});

test("CARD — a request part's lines are drawn under its fixed label, escaped, the newest live only while the part runs; an ended part's are kept, with no live line; a part with none draws no list", () => {
  const p = page({ site: SITE });
  const draw = (view) => {
    p.ctx.siteReqState("origin-1", view.key, view);
    return p.ctx.siteRequestHTML({ request: view.key }, p.s);
  };
  const running = draw(partView("started", LINES));
  assert.match(running, /<span class="st-req-status">In progress<\/span><ul class="st-req-prog"><li><span class="at">0:30<\/span>Adding a page &lt;with&gt; a form\.<\/li><li class="live"><i><\/i><span><span class="at">1:31<\/span>The list is designed\.<\/span><\/li><\/ul>/);
  const ended = draw(partView("done", LINES));
  assert.match(ended, /st-req-done/);
  const list = ended.match(/<ul class="st-req-prog">(.*?)<\/ul>/);
  assert.ok(list, "an ended part's lines are gone");
  assert.equal((list[1].match(/<li/g) || []).length, 2);
  assert.doesNotMatch(ended, /class="live"/, "an ended part still shows a live line");
  assert.doesNotMatch(draw(partView("started", null)), /st-req-prog/, "a part with no lines drew an empty list");
});

test("FOUND — a standalone job the list names is drawn once as a card with its words, label and lines, placed in time, and followed; one this page already shows — watched, remembered on a reply, held, or carded — is not drawn again", async () => {
  const p = page({ site: { ...SITE, msgs: [{ r: "u", t: "earlier" }] } });
  p.ctx.siteJobDiscovered("origin-1", { job: SOLO, op: "edit", state: "editing", words: "Change the <heading>", at: 5000, progress: [{ n: 0, ms: 5000, text: "Found it." }] });
  await settle();
  const msgs = p.said();
  assert.deepEqual(msgs.map((m) => m.jobCard || m.r), ["u", SOLO]);
  const html = p.ctx.siteJobCardHTML(msgs[1], p.s);
  assert.match(html, /<span class="st-req-words">Change the &lt;heading&gt;<\/span><span class="st-req-status">In progress<\/span><ul class="st-req-prog"><li class="live">/);
  assert.ok(p.calls.some((c) => c.url === "/api/site/edit/" + SOLO), "the found job is not followed");
  // ONCE: the list read again names it again.
  p.ctx.siteJobDiscovered("origin-1", { job: SOLO, op: "edit", state: "editing", words: "x", at: 5000 });
  assert.equal(p.said().filter((m) => m.jobCard).length, 1, "a found job was drawn twice");
  // ALREADY SHOWN HERE, four ways.
  const shown = (msgs2, setup) => {
    const q = page({ site: { ...SITE, msgs: msgs2 } });
    if (setup) setup(q.ctx);
    q.ctx.siteJobDiscovered("origin-1", { job: SOLO, op: "edit", state: "done", ended: true, words: "x", at: 1 });
    return q.said().filter((m) => m.jobCard).length;
  };
  assert.equal(shown([{ r: "a", t: "done", jobs: [SOLO] }]), 0, "a job whose reply this page shows was drawn again");
  assert.equal(shown([{ r: "a", t: "…", held: { job: SOLO, at: 1, else: "x", asked: "" } }]), 0, "a job whose reply this page holds was drawn again");
  assert.equal(shown([], (c) => vm.runInContext("editWatched.add(" + JSON.stringify(SOLO) + ")", c)), 0, "a job this page watches was drawn again");
  assert.equal(shown([{ r: "a", t: "", jobCard: SOLO }]), 1, "a carded job was drawn a second time");
  // AND THE JOB THIS PAGE REMEMBERS (a reload mid-watch, before its resume runs).
  assert.equal(shown([], (c) => { c.EditPoll.resumableRecord = (slug) => (slug === "fold-lane-bakery" ? { job: SOLO } : null); }), 0, "a job this page remembers was drawn again");
  // IN TIME: a found job older than a request card goes above it.
  const t = page({ site: { ...SITE, msgs: [] } });
  const v = partView("done", null);
  t.ctx.siteReqState("origin-1", v.key, { ...v, at: 9000 });
  t.ctx.siteReqCard(t.s, v.key);
  t.ctx.siteJobDiscovered("origin-1", { job: SOLO, op: "addon", state: "done", ended: true, words: "older", at: 4000 });
  assert.deepEqual(t.said().map((m) => m.jobCard || m.request), [SOLO, v.key], "an older found job was placed under a newer request");
});

test("FOUND — the card is followed to its end: the model's reply is said right after it, once; the card's label and lines follow each poll; nothing is applied to the page's own site", async () => {
  let done = false;
  const p = page({
    site: { ...SITE, msgs: [] },
    timers: true,
    answer: (url) => {
      if (url !== "/api/site/edit/" + SOLO) return null;
      return done
        ? { body: { ok: true, layer: "text", changed: ["src/routes/index.tsx"], cost: 1, reply: "✅ The heading is changed.", replySource: "model", progress: [{ n: 0, ms: 5000, text: "Found it." }, { n: 1, ms: 8000, text: "Publishing now." }] }, headers: { "x-gf-edit": "final" } }
        : { status: 202, body: { ok: true, status: "editing", progress: [{ n: 0, ms: 5000, text: "Found it." }] } };
    },
  });
  p.ctx.siteJobDiscovered("origin-1", { job: SOLO, op: "edit", state: "queued", words: "Change the heading", at: 1, progress: [] });
  await settle();
  const card = () => p.s.jobCards[SOLO];
  assert.equal(card().view.state, "editing");
  assert.equal(card().view.progress.length, 1);
  done = true;
  p.flush();
  await settle();
  assert.equal(card().closed, true);
  assert.equal(card().view.state, "done");
  assert.equal(card().view.progress.length, 2);
  const msgs = p.said();
  assert.deepEqual(msgs.map((m) => (m.jobCard ? "card" : m.t)), ["card", "✅ The heading is changed."]);
  assert.deepEqual(msgs[1].jobs, [SOLO], "the reply does not name its job");
  p.flush();
  await settle();
  assert.equal(p.said().length, 2, "the reply was said twice");
  p.ctx.siteJobSay("origin-1", SOLO, "said again");
  assert.equal(p.said().length, 2, "a found job's reply was said a second time");
});

test("PLACE — a request's reply goes with its request, never under a found job's card that stands after it", () => {
  const p = page({ site: { ...SITE, msgs: [] } });
  const v = partView("done", null);
  p.ctx.siteReqState("origin-1", v.key, { ...v, at: 4000 });
  p.ctx.siteReqCard(p.s, v.key);
  p.ctx.siteJobDiscovered("origin-1", { job: SOLO, op: "edit", state: "editing", words: "later", at: 9000 });
  p.ctx.siteReqSay("origin-1", "✅ The request is done.", { key: v.key });
  assert.deepEqual(p.said().map((m) => (m.jobCard ? "job" : m.request ? "request" : m.t)), ["request", "✅ The request is done.", "job"]);
});

test("LIST — the requests list's jobs are drawn, and a list with none (progress off) draws nothing new", async () => {
  const withJobs = page({ site: { ...SITE, msgs: [] }, answer: (url) => (url === "/api/site/requests/fold-lane-bakery" ? { body: { ok: true, requests: [], jobs: [{ job: SOLO, op: "addon", state: "editing", words: "Add a gallery", at: 1, progress: [] }] } } : null) });
  withJobs.ctx.siteRequestsCheck(withJobs.s);
  await settle();
  assert.deepEqual(withJobs.said().map((m) => m.jobCard), [SOLO]);
  const off = page({ site: { ...SITE, msgs: [] }, answer: (url) => (url === "/api/site/requests/fold-lane-bakery" ? { body: { ok: true, requests: [] } } : null) });
  off.ctx.siteRequestsCheck(off.s);
  await settle();
  assert.deepEqual(off.said(), [], "a list with no jobs drew something");
});

test("KEPT — a watched job's lines are kept on the reply its finish put on the thread, each with its job; a hop's job is added beside it; nothing is doubled; a finish that put nothing on the thread keeps nothing", () => {
  const p = page({ site: { ...SITE, msgs: [{ r: "u", t: "ask" }] } });
  const before = p.s.msgs.length;
  p.s.msgs.push({ r: "a", t: "✅ Done." });
  p.ctx.siteKeepJobProgress("origin-1", JOB, before, [{ n: 0, ms: 1000, text: "one" }]);
  p.ctx.siteKeepJobProgress("origin-1", SOLO, before, [{ n: 0, ms: 2000, text: "two" }]);
  p.ctx.siteKeepJobProgress("origin-1", JOB, before, [{ n: 0, ms: 1000, text: "one" }]);
  const m = p.last();
  assert.deepEqual(m.jobs, [JOB, SOLO]);
  assert.deepEqual(m.prog, [{ job: JOB, n: 0, ms: 1000, text: "one" }, { job: SOLO, n: 0, ms: 2000, text: "two" }]);
  const q = page({ site: { ...SITE, msgs: [{ r: "a", t: "older" }] } });
  q.ctx.siteKeepJobProgress("origin-1", JOB, q.s.msgs.length, [{ n: 0, ms: 1, text: "x" }]);
  assert.equal(q.last().prog, undefined, "lines were put on a message this finish did not write");
  // AND THE REPLY IS DRAWN WITH THEM ABOVE IT, MUTED.
  assert.match(p.ctx.progressListHTML(m.prog, false, true), /^<ul class="st-req-prog st-prog-done"><li>/);
});

test("WATCH — the page-driven watch: each running poll's newest line is painted where \"Thinking\" was; the finished answer's lines are kept on its reply with the job named on it", async () => {
  const s = { id: "origin-1", slug: "fold-lane-bakery", msgs: [{ r: "u", t: "Change the heading" }] };
  const polls = [
    { status: 202, body: { ok: true, status: "editing", progress: [{ n: 0, ms: 3000, text: "Found the heading." }] } },
    { status: 202, body: { ok: true, status: "editing", progress: [{ n: 0, ms: 3000, text: "Found the heading." }, { n: 1, ms: 6000, text: "Publishing now." }] } },
    { status: 200, final: true, body: { ok: true, layer: "text", reply: "✅ Changed.", replySource: "model", progress: [{ n: 0, ms: 3000, text: "Found the heading." }, { n: 1, ms: 6000, text: "Publishing now." }] } },
  ];
  const timers = [];
  let paints = 0;
  const ctx = vm.createContext({
    EditPoll: { ...EditPoll, forgetJob: () => {} },
    apiFetch: async () => { const a = polls.shift(); return new Response(JSON.stringify(a.body), { status: a.status, headers: a.final ? { "x-gf-edit": "final" } : {} }); },
    setTimeout: (fn) => { timers.push(fn); return 0; },
    siteById: (id) => (id === s.id ? s : null), sitesSave: () => {}, renderSites: () => {}, siteOpenId: s.id,
    siteBuild: { react: true, rphase: "thinking" }, paintReactLive: () => { paints++; },
    replyTellsEnding: () => false, editReplyHold: () => { throw new Error("not held here"); },
    editAnswer: (ok, e, o) => o.finish(e.reply), scheduleCreditRefresh: () => {}, alsoTail: () => "", wholeRequestNote: () => "",
    Response, Headers,
  });
  vm.runInContext([cutLine("const editWatched ="), cut("function siteKeepJobProgress("), cut("function watchEditJob(")].join("\n"), ctx);
  ctx.watchEditJob({ slug: s.slug }, {}, JOB, s.id, (reply) => { s.msgs.push({ r: "a", t: reply }); }, null, "Change the heading", [], undefined, false);
  const run = async () => { const fn = timers.shift(); fn(); for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r)); };
  await run();
  assert.equal(ctx.siteBuild.progressLine, "Found the heading.", "the newest line was not painted");
  await run();
  assert.equal(ctx.siteBuild.progressLine, "Publishing now.");
  assert.ok(paints >= 2, "the line was not painted");
  await run();
  const reply = s.msgs[s.msgs.length - 1];
  assert.equal(reply.t, "✅ Changed.");
  assert.deepEqual(copy(reply.jobs), [JOB]);
  assert.deepEqual(copy(reply.prog).map((l) => [l.job, l.n, l.text]), [[JOB, 0, "Found the heading."], [JOB, 1, "Publishing now."]]);
});

test("BUBBLE — the newest line replaces \"Thinking\", escaped, in its own style; a waiting sentence still comes first; with no line, \"Thinking\" as before", () => {
  const draw = (sb) => {
    const ctx = vm.createContext({ siteBuild: sb, stBuildRunning: () => false, esc: (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") });
    vm.runInContext(cut("function reactLiveStepsHTML("), ctx);
    return ctx.reactLiveStepsHTML();
  };
  assert.equal(draw({ progressLine: "Found <it>." }), '<div class="st-steps st-steps-live"><div class="st-think st-think-prog"><i></i><span>Found &lt;it&gt;.</span></div></div>');
  assert.match(draw({ progressLine: "Found it.", waitNote: "Waiting — busy." }), /<div class="st-think"><i><\/i>Waiting — busy\.<\/div>/);
  assert.equal(draw({}), '<div class="st-steps st-steps-live"><div class="st-think"><i></i>Thinking</div></div>');
});

// ── EACH TASK NAMED BY THE MODEL'S OWN LINE (2026-10-06) ──────────────────────

const SAID = { planned: "I'll add a page with a form.", doing: "I'm adding the page now.", done: "I've added the page.", notdone: "I couldn't add the page." };
const wordsOf = (html) => [...html.matchAll(/<span class="st-req-words">(.*?)<\/span>/g)].map((m) => m[1]);

test("SAID — taskSaid reads the model's four lines strictly: one state missing, blank or not text and none is used; nothing is cut", () => {
  const long = "I'm adding the page you asked for, with its form. ".repeat(40).trim();
  assert.deepEqual(EditPoll.taskSaid({ ...SAID, doing: "  " + long + "  ", extra: 1 }), { ...SAID, doing: long });
  for (const bad of [null, undefined, "x", [], [SAID], {}, { ...SAID, done: "" }, { ...SAID, notdone: "   " }, { ...SAID, planned: 7 }, (({ doing, ...r }) => r)(SAID)]) {
    assert.equal(EditPoll.taskSaid(bad), null, JSON.stringify(bad));
  }
});

test("SAID — a request part is named by the model's line for the state its status is in, never the line of another state; with no lines, or lines that do not read, by its words as they are, with nothing put before them", () => {
  const p = page({ site: SITE });
  const draw = (status, said) => {
    const v = partView(status, null);
    v.parts[0].words = "Change the <Gallery> heading";
    if (said !== undefined) v.parts[0].said = said;
    p.ctx.siteReqState("origin-1", v.key, v);
    return wordsOf(p.ctx.siteRequestHTML({ request: v.key }, p.s))[0];
  };
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;").replace(/"/g, "&quot;");
  const want = { blocked: "planned", ready: "planned", queued: "planned", waiting: "planned", approval: "planned", "needs-rewrite": "planned", started: "doing", unverified: "doing", done: "done", partial: "notdone", failed: "notdone", "not-run": "notdone", cancelled: "notdone", expired: "notdone", refused: "notdone" };
  for (const [status, which] of Object.entries(want)) {
    assert.equal(draw(status, SAID), esc(SAID[which]), status + " was not named by its " + which + " line");
  }
  const words = "Change the &lt;Gallery&gt; heading";
  assert.equal(draw("started"), words, "a part with no lines was not named by its words");
  assert.equal(draw("started", { ...SAID, doing: "" }), words, "a part with a blank line was named by another state's line");
  assert.equal(draw("started", { ...SAID, notdone: " " }), words, "lines with one state missing were used for another");
  assert.equal(draw("started", "I'm on it."), words);
  assert.equal(draw("some-new-status", SAID), words, "a status the page does not know took a line");
  // WITH THE LINES ESCAPED, as the words are.
  assert.equal(draw("done", { ...SAID, done: "I've changed <it>." }), "I&#39;ve changed &lt;it&gt;.");
});

test("SAID — a found job's card is named by the line for its state (queued planned, running doing, finished done, failed, lost or stopped not done), by its words without one; a later reading of the list brings lines a drawn card did not have", async () => {
  const p = page({ site: { ...SITE, msgs: [] } });
  p.ctx.siteJobDiscovered("origin-1", { job: SOLO, op: "addon", state: "editing", words: "add a gallery", at: 1 });
  await settle();
  const card = () => wordsOf(p.ctx.siteJobCardHTML({ jobCard: SOLO }, p.s))[0];
  assert.equal(card(), "add a gallery", "a card with no lines was not named by its words");
  // A LATER READING OF THE LIST, with the lines now written.
  p.ctx.siteJobDiscovered("origin-1", { job: SOLO, op: "addon", state: "editing", words: "add a gallery", at: 1, said: SAID });
  assert.equal(p.said().filter((m) => m.jobCard).length, 1, "the card was drawn twice");
  assert.equal(card(), SAID.doing.replace(/'/g, "&#39;"), "a drawn card did not take the lines a later reading brought");
  // A READING WITH NO LINES, or lines that do not read, takes nothing away.
  p.ctx.siteJobDiscovered("origin-1", { job: SOLO, op: "addon", state: "editing", words: "add a gallery", at: 1, said: { ...SAID, done: "" } });
  assert.equal(card(), SAID.doing.replace(/'/g, "&#39;"));
  const want = { queued: "planned", editing: "doing", started: "doing", "": "doing", done: "done", failed: "notdone", lost: "notdone", cancelled: "notdone" };
  for (const [state, which] of Object.entries(want)) {
    p.s.jobCards[SOLO].view.state = state;
    assert.equal(card(), SAID[which].replace(/'/g, "&#39;"), (state || "(none)") + " was not named by its " + which + " line");
  }
});

test("SAID — the card's follow takes the lines from the job's poll, and keeps them through a poll without them", async () => {
  let n = 0;
  const p = page({
    site: { ...SITE, msgs: [] },
    timers: true,
    answer: (url) => {
      if (url !== "/api/site/edit/" + SOLO) return null;
      n++;
      if (n === 1) return { status: 202, body: { ok: true, status: "editing", progress: [] } };
      if (n === 2) return { status: 202, body: { ok: true, status: "editing", progress: [], said: SAID } };
      if (n === 3) return { status: 202, body: { ok: true, status: "editing", progress: [] } };
      return { body: { ok: true, layer: "text", changed: ["src/routes/index.tsx"], cost: 1, reply: "✅ Done.", replySource: "model", progress: [], said: SAID }, headers: { "x-gf-edit": "final" } };
    },
  });
  p.ctx.siteJobDiscovered("origin-1", { job: SOLO, op: "edit", state: "queued", words: "Change the heading", at: 1, progress: [] });
  await settle();
  const view = () => p.s.jobCards[SOLO].view;
  assert.equal(view().said, null);
  p.flush(); await settle();
  assert.deepEqual(copy(view().said), SAID, "the poll's lines were not taken");
  p.flush(); await settle();
  assert.deepEqual(copy(view().said), SAID, "a poll without lines took them away");
  p.flush(); await settle();
  assert.equal(view().state, "done");
  assert.equal(wordsOf(p.ctx.siteJobCardHTML({ jobCard: SOLO }, p.s))[0], "I&#39;ve added the page.");
});
