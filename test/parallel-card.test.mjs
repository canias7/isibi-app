// THE PARALLEL CARD (2026-10-23, the owner's approved design, without the bar).
//
// One customer message split into several parts is drawn as ONE card: the
// model's opening line, a header with the counts, one compact row per part
// that opens on that part's own text, Try again on a part that did not work,
// and a soft box under the card holding the live question or, once the
// request ends, its model-written reply. A single part keeps today's card. The
// real functions are cut out of public/chat.js and run in a VM; the opening
// line and the titles come from the task-lines writer's facts
// (builder/site-progress.mjs) and travel through `requestView`.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { taskRequest, readTasks, TASK_TOOL, TASK_STATES, commitTasks, saidOf } from "../builder/site-progress.mjs";
import { requestView } from "../builder/request.mjs";

const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function cut(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const shut = CHAT.indexOf("\n}\n", open);
  assert.ok(shut > open, head + " has no end");
  return CHAT.slice(open, shut + 3);
}
function cutConst(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const line = CHAT.slice(open, CHAT.indexOf("\n", open + 1) + 1);
  if (!/\{\s*$/.test(line)) return line;
  return CHAT.slice(open, CHAT.indexOf("\n};\n", open) + 4);
}
const FNS = ["esc", "progressListHTML", "siteSaidFor", "siteMsgText", "siteParView", "siteParState", "siteParTitle", "siteParTag", "siteParSnap", "siteParHidden", "siteReqCardHTML", "siteParClick", "siteParRetry"];
const CONSTS = ["const SITE_PAR_STATE =", "const SITE_PAR_LABEL =", "const siteParOpen =", "const SITE_REQ_PREP =", "const SITE_SAID_FOR ="];
const SRC = [...FNS.map((n) => cut("function " + n + "(")), ...CONSTS.map(cutConst)].join("\n");

function load(site) {
  const sent = [];
  let draws = 0;
  const ctx = vm.createContext({
    EditPoll, sent,
    siteOpenId: site.id,
    siteById: (id) => (id === site.id ? site : null),
    siteAskHTML: (m) => '<div class="ask-buttons" data-ask="' + m.ask + '"></div>',
    siteRequestHTML: () => '<div class="st-req">TODAY</div>',
    siteSend: (t, leave) => sent.push([t, leave]),
    renderSites: () => { draws++; },
  });
  vm.runInContext(SRC, ctx);
  const thread = { contains: () => true };
  const press = (attr, vals) => ctx.siteParClick({ target: { closest: (sel) => (sel === "[" + attr + "]" ? { getAttribute: (k) => vals[k] } : null) } }, thread);
  return { ctx, sent, draws: () => draws, press, html: () => ctx.siteReqCardHTML(site.msgs.find((m) => m.request), site) };
}
const said = (title, done) => ({ planned: "p", doing: "d", waiting: "w", unconfirmed: "u", done: done || "Done line", partial: "pa", notdone: "Not done line", ...(title ? { title } : {}) });
const KEY = "k".repeat(20);
function site8() {
  const statuses = ["done", "done", "started", "waiting", "failed", "queued", "blocked", "done"];
  const parts = statuses.map((status, i) => ({
    n: i + 1, words: "words of part " + (i + 1), status, jobs: ["job" + (i + 1)], said: said("Title " + (i + 1)),
    ...(status === "started" ? { progress: [{ text: "Writing the menu now" }] } : {}),
  }));
  return {
    id: "s1",
    msgs: [
      { r: "u", t: "eight things" },
      { r: "a", t: "", request: KEY },
      { r: "a", t: "Part one reply from the model", req: KEY, job: "job1" },
      { r: "a", t: "Part five could not be done, said by the model", req: KEY, job: "job5" },
      { r: "a", t: "Which colour?", req: KEY, ask: "q1" },
    ],
    ask: { id: "q1" },
    requests: { [KEY]: { view: { key: KEY, ended: false, opening: "I will work on these eight changes side by side.", parts } } },
  };
}

test("a split message is ONE card: the model's opening line, the counts, one row per part, no bar", () => {
  const p = load(site8());
  const html = p.html();
  assert.match(html, /<div class="st-par-opening">I will work on these eight changes side by side\.<\/div>/);
  assert.match(html, /Working on 8 changes<\/b><span> · 3 done<\/span>/);
  assert.equal((html.match(/class="st-par-row"/g) || []).length, 8);
  for (let i = 1; i <= 8; i++) assert.match(html, new RegExp(">Title " + i + "<"));
  assert.doesNotMatch(html, /st-par-bar|<progress|role="progressbar"/, "the card draws a bar");
  assert.doesNotMatch(html, /TODAY/, "the single-part card was drawn for a split message");
});

test("each part's state maps to its dot and label", () => {
  const st = (status, extra = {}) => load(site8()).ctx.siteParState({ status, ...extra });
  assert.equal(st("done"), "done"); assert.equal(st("partial"), "done");
  assert.equal(st("started"), "run"); assert.equal(st("recovering"), "run");
  assert.equal(st("waiting"), "ask"); assert.equal(st("approval"), "ask");
  assert.equal(st("waiting", { question: { queued: true } }), "wait");
  assert.equal(st("queued"), "wait"); assert.equal(st("blocked"), "wait");
  assert.equal(st("blocked", { prep: "prepared" }), "run");
  assert.equal(st("failed"), "bad"); assert.equal(st("not-run"), "bad"); assert.equal(st("cancelled"), "bad");
  assert.equal(st("anything-new"), "wait");
  const html = load(site8()).html();
  assert.match(html, /st-par-part st-par-done[^>]*>.*?<span class="st-par-tag">done</);
  assert.match(html, /st-par-part st-par-run open[^>]*>.*?<span class="st-par-tag">working…</);
  assert.match(html, /st-par-part st-par-ask[^>]*>.*?<span class="st-par-tag">needs you</);
  assert.match(html, /st-par-part st-par-bad[^>]*>.*?<span class="st-par-tag">didn’t work</);
  assert.match(html, /st-par-part st-par-wait[^>]*>.*?<span class="st-par-tag">waiting</);
});

test("the working row opens by itself on its live lines, the others are closed, and it closes once done", () => {
  const s = site8();
  const p = load(s);
  let html = p.html();
  assert.equal((html.match(/ open"/g) || []).length, 1);
  // A closed row's dropdown is drawn hidden.
  assert.match(html, /data-par-n="1" role="button" tabindex="0" aria-expanded="false">.*?<\/div><div class="st-par-body" hidden>/);
  assert.match(html, /data-par-n="3" role="button" tabindex="0" aria-expanded="true">.*?<div class="st-par-body"><ul class="st-req-prog"><li class="live">Writing the menu now<\/li>/s);
  s.requests[KEY].view.parts[2].status = "done";
  html = p.html();
  assert.doesNotMatch(html, / open"/, "the finished row stayed open");
});

test("a row toggles on a press, and a row that moves on goes back to its own default", () => {
  const s = site8();
  const p = load(s);
  assert.equal(p.press("data-par-row", { "data-par-row": KEY, "data-par-n": "1" }), true);
  let html = p.html();
  assert.match(html, /data-par-n="1" role="button" tabindex="0" aria-expanded="true">.*?<div class="st-par-said">Part one reply from the model<\/div>/s);
  assert.equal(p.draws(), 1);
  p.press("data-par-row", { "data-par-row": KEY, "data-par-n": "1" });
  assert.match(p.html(), /data-par-n="1" role="button" tabindex="0" aria-expanded="false"/);
  // The working row closed by hand, then done: done's default (closed).
  p.press("data-par-row", { "data-par-row": KEY, "data-par-n": "3" });
  assert.match(p.html(), /data-par-n="3" role="button" tabindex="0" aria-expanded="false"/);
  assert.equal(p.press("data-other", {}), false, "a press outside the card was taken");
});

test("a failed part's row shows its own reply and Try again, which sends that part's words and leaves the composer alone", () => {
  const s = site8();
  const p = load(s);
  p.press("data-par-row", { "data-par-row": KEY, "data-par-n": "5" });
  const html = p.html();
  assert.match(html, /<div class="st-par-said">Part five could not be done, said by the model<\/div><button type="button" class="st-par-retry" data-par-retry="kkkkkkkkkkkkkkkkkkkk" data-par-n="5">Try again<\/button>/);
  assert.equal((html.match(/data-par-retry/g) || []).length, 1, "Try again offered on a part that did not fail");
  p.press("data-par-retry", { "data-par-retry": KEY, "data-par-n": "5" });
  assert.deepEqual(JSON.parse(JSON.stringify(p.sent)), [["words of part 5", true]]);
  // Not on a part that worked.
  p.press("data-par-retry", { "data-par-retry": KEY, "data-par-n": "1" });
  assert.equal(p.sent.length, 1);
});

test("the soft box holds the waiting question with its answers, then the request's own reply once it ends; those messages leave the thread", () => {
  const s = site8();
  const p = load(s);
  let html = p.html();
  assert.match(html, /<div class="st-par-box">Which colour\?<div class="ask-buttons" data-ask="q1"><\/div><\/div>$/);
  assert.equal(p.ctx.siteParHidden(s.msgs[4], s), true);
  assert.equal(p.ctx.siteParHidden(s.msgs[2], s), true, "a part's reply was left on the thread");
  assert.equal(p.ctx.siteParHidden(s.msgs[0], s), false);
  assert.equal(p.ctx.siteParHidden(s.msgs[1], s), false, "the card itself was hidden");
  s.ask = null;
  s.requests[KEY].view.ended = true;
  s.msgs.push({ r: "a", t: "All in: seven changes made, one did not work.", req: KEY, for: "end" });
  html = p.html();
  assert.match(html, /<b>8 changes<\/b><span> · 3 done · 1 didn’t work<\/span>/);
  assert.match(html, /<div class="st-par-box">All in: seven changes made, one did not work\.<\/div>$/);
  assert.equal(p.ctx.siteParHidden(s.msgs[5], s), true);
});

test("a single-part message keeps today's card and today's thread", () => {
  const s = site8();
  s.requests[KEY].view.parts = s.requests[KEY].view.parts.slice(0, 1);
  const p = load(s);
  assert.equal(p.html(), '<div class="st-req">TODAY</div>');
  assert.equal(p.ctx.siteParHidden(s.msgs[2], s), false);
  // A SNAPSHOT FOR A RELOAD NOW (2026-10-23, background work: the panel above
  // the box lists a single part too), and the card is still today's.
  p.ctx.siteParSnap(s, KEY);
  assert.equal(s.msgs[1].rq.parts.length, 1);
  assert.equal(p.html(), '<div class="st-req">TODAY</div>', "a single part's snapshot drew the parallel card");
});

test("after a reload the card is drawn again from the snapshot kept with the chat", () => {
  const s = site8();
  const p = load(s);
  const before = p.html();
  p.ctx.siteParSnap(s, KEY);
  const stored = JSON.parse(JSON.stringify(s));
  delete stored.requests;
  const q = load(stored);
  const after = q.html();
  assert.equal(after, before);
});

test("the opening line and the titles are the writer's, from the fact of the split; no sentence is written in the code", () => {
  const tasks = [{ n: 1, words: "make the menu blue" }, { n: 2, words: "add a gallery" }];
  const req = taskRequest({ tasks, model: "m", split: 2 });
  assert.match(JSON.stringify(req), /THE REQUEST WAS SPLIT INTO 2 CHANGES/);
  assert.doesNotMatch(JSON.stringify(taskRequest({ tasks, model: "m" })), /SPLIT/);
  assert.ok(TASK_TOOL.input_schema.properties.opening);
  const entry = (n, title) => ({ id: "t" + n, ...Object.fromEntries(TASK_STATES.map((k) => [k, k + " " + n])), title });
  const reply = { content: [{ type: "tool_use", name: TASK_TOOL.name, input: { tasks: [entry(1, "Blue menu"), entry(2, "Gallery")], opening: "Two changes, side by side." } }] };
  const read = readTasks(reply, tasks);
  assert.equal(read.ok, true);
  assert.equal(read.opening, "Two changes, side by side.");
  assert.equal(read.tasks[0].title, "Blue menu");
  const rec = { op: "request", taskWords: tasks, tasks: null, writer: { owner: "o", until: Date.now() + 60000 } };
  const next = commitTasks(rec, { owner: "o", tasks: read.tasks, now: Date.now(), opening: read.opening });
  assert.equal(next.opening, "Two changes, side by side.");
  assert.equal(saidOf(next, 1).title, "Blue menu");
  assert.equal(commitTasks({ ...rec, op: "edit" }, { owner: "o", tasks: read.tasks, now: Date.now(), opening: read.opening }).opening, undefined, "a single job took an opening line");
  const view = requestView({ key: KEY, state: "running", parts: [{ n: 1, words: "a", status: "done", jobs: [] }, { n: 2, words: "b", status: "started", jobs: [] }] }, { said: { 1: said("Blue menu"), opening: "Two changes, side by side." } });
  assert.equal(view.opening, "Two changes, side by side.");
  // No opening written: none shown. No title: the model's line for the part's
  // state names it, and with no lines written, the customer's own words.
  const s = site8();
  delete s.requests[KEY].view.opening;
  s.requests[KEY].view.parts.forEach((x) => { delete x.said.title; });
  delete s.requests[KEY].view.parts[1].said;
  const html = load(s).html();
  assert.doesNotMatch(html, /st-par-opening/);
  assert.match(html, /data-par-n="1"[^>]*><span class="st-par-dot"><\/span><span class="st-par-title">Done line</);
  assert.match(html, /data-par-n="2"[^>]*><span class="st-par-dot"><\/span><span class="st-par-title">words of part 2</);
  // The card's code writes no customer sentence: its literals are labels and markup.
  // Whole-line comments blanked first: prose may quote what it describes.
  const src = cut("function siteReqCardHTML(").split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  // The two buttons' labels are today's card's own (`siteRequestHTML`), reused as they stand.
  const today = cut("function siteRequestHTML(");
  const literals = (src.match(/'[^'\n]*'/g) || []).map((x) => x.slice(1, -1).replace(/<[^>]*>?/g, " ").replace(/^[^A-Za-z]+/, "").trim()).filter((t) => /[A-Za-z]{3,}\s+[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(t) && !/class=|data-|type=|aria-|role=/.test(t) && !today.includes(t));
  assert.deepEqual(literals, [], "a sentence is written in the card's code");
});

test("the owner's labels (2026-10-23): a part saved to the draft says \"saved as draft\", and the header still counts it done", () => {
  const s = site8();
  s.requests[KEY].view.parts[0].draft = { revision: 4 };
  const html = load(s).html();
  const rows = html.split('<div class="st-par-part ').slice(1);
  assert.match(rows[0], /<span class="st-par-tag">saved as draft</);
  assert.match(rows[1], /<span class="st-par-tag">done</, "a part with no draft revision keeps \"done\"");
  assert.match(html, /Working on 8 changes<\/b><span> · 3 done<\/span>/);
});

test("the owner's labels (2026-10-23): a part held for another names it by its title, else by its place", () => {
  const s = site8();
  s.requests[KEY].view.parts[6].needs = [2];
  let rows = load(s).html().split('<div class="st-par-part ').slice(1);
  assert.match(rows[6], /<span class="st-par-tag">waiting for Title 3</);
  delete s.requests[KEY].view.parts[2].said.title;
  rows = load(s).html().split('<div class="st-par-part ').slice(1);
  assert.match(rows[6], /<span class="st-par-tag">waiting for part 3</);
  s.requests[KEY].view.parts[6].needs = [];
  rows = load(s).html().split('<div class="st-par-part ').slice(1);
  assert.match(rows[6], /<span class="st-par-tag">waiting</);
});
