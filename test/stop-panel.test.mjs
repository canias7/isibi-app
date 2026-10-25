// STOP IS NEVER NOWHERE (2026-10-25, branch `fix-stop-panel`).
//
// Live 2026-10-24: one multi-part message's request ran some thirty part jobs
// for about fifteen minutes and the builder page showed no "tasks in progress"
// pill and no Stop. The box gives its Stop to the panel while a request runs
// (`siteComposerStops`), and the panel and the box found requests only by
// their card on the thread. A request's parts write their replies to the
// thread one by one, the browser keeps the last forty messages (`sitesSave`),
// and a chat read back from the server replaces the thread whole
// (`chatAdopt`): the card falls off while the request's record stays.
//   K   a request whose card is off the thread is still listed, every
//       queued or running part a row, with Stop and Stop all;
//   W   a live request whose parts cannot be read is one row whose Stop
//       stops the whole request;
//   B   the box keeps Stop whenever the panel does not list the running
//       request, and that Stop stops the request;
//   SV  a second Stop on a request already stopped asks every live job to
//       cancel again (it used to do nothing).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import * as RQ from "../builder/request.mjs";
import { platform, sendMessage, call, USER } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";

const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function cut(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const shut = CHAT.indexOf("\n}\n", open);
  return CHAT.slice(open, shut + 3);
}
function cutConst(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const line = CHAT.slice(open, CHAT.indexOf("\n", open + 1) + 1);
  if (!/\{\s*$/.test(line)) return line;
  return CHAT.slice(open, CHAT.indexOf("\n};\n", open) + 4);
}
const FNS = ["esc", "progressListHTML", "siteSaidFor", "siteMsgText", "siteParState", "siteParTitle", "siteParTag", "siteReqKeys",
  "siteRequestWorking", "siteRunningWork", "siteBusyHere", "siteComposerStops", "siteStopWork",
  "siteBgState", "siteBgKeep", "siteBgItems", "siteBgWhen", "siteBgLine", "siteBgHTML", "siteBgJobHTML", "siteBgPaint", "siteBgScrolled", "siteBgClick", "siteBgStopAll", "siteBgStopPart", "siteBgRetry", "siteBgShowMe"];
const CONSTS = ["const SITE_PAR_STATE =", "const SITE_PAR_LABEL =", "const SITE_REQ_PREP =", "const SITE_SAID_FOR =", "const SITE_BG_KEEP_MS =", "const siteBgUi =", "const SITE_BG_KEEP_KEY =", "const siteParOpen ="];
const SRC = [...FNS.map((n) => cut("function " + n + "(")), ...CONSTS.map(cutConst)].join("\n");

const KA = "a".repeat(20);
const said = (title) => ({ planned: "p", doing: "d", waiting: "w", unconfirmed: "u", done: "done", partial: "pa", notdone: "nd", title });
/** One message's request of many parts — the shape `requestView` gives — and a thread of forty part replies with no card. */
function siteOf({ parts = 32, card = false, empty = false } = {}) {
  const view = { key: KA, at: 1, updatedAt: 2, ended: false, stop: false, parts: empty ? [] : Array.from({ length: parts }, (_, n) => ({
    n, words: "part " + n, status: n < 2 ? "done" : n < 6 ? "started" : "ready", jobs: n < 2 ? ["j" + n] : [], said: said("Part " + n),
  })) };
  const msgs = Array.from({ length: 40 }, (_, i) => ({ r: "a", t: "reply " + i, req: KA, job: "j" + i }));
  if (card) msgs.unshift({ r: "a", t: "", request: KA });
  return { id: "s1", slug: "shop", msgs, requests: { [KA]: { at: Date.now(), view, shown: [], replies: [] } }, jobCards: {} };
}
function load(site, { busy = false } = {}) {
  const posts = [], stops = [], deletes = [];
  const host = { innerHTML: "", onclick: null, querySelector: () => null };
  const ctx = vm.createContext({
    EditPoll, posts, stops, console, setTimeout: () => 0, clearTimeout: () => {},
    siteOpenId: site.id, siteBusy: busy, siteBusyFor: busy ? site.id : null, siteView: "preview",
    document: { getElementById: (id) => (id === "stBg" ? host : null) },
    siteById: (id) => (id === site.id ? site : null),
    siteJobOutcome: () => "done", sitePages: () => [], switchSitePage: () => {},
    sitesSave: () => {}, renderSites: () => {},
    siteRequestStop: (id, key) => stops.push(key),
    siteRequestFollow: () => {}, siteReqState: () => null, siteSend: () => {}, sbToast: () => {},
    siteBuildServerStop: () => stops.push("build"), siteStop: () => stops.push("own-send"),
    apiFetch: async (url, init) => { (init.method === "DELETE" ? deletes : posts).push([url, init.method]); return { ok: true, json: async () => ({ ok: true }) }; },
  });
  vm.runInContext(SRC, ctx);
  const el = (attrs) => ({ getAttribute: (k) => (Object.hasOwn(attrs, k) ? attrs[k] : null) });
  const press = (attrs) => ctx.siteBgClick({ target: { closest: () => el(attrs) } }, site.id);
  return { ctx, posts, stops, deletes, press, html: () => ctx.siteBgHTML(site) };
}
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

test("K — a request whose card fell off the thread is still in the panel: every queued or running part a row, Stop all stops the request", () => {
  const site = siteOf();
  const p = load(site);
  assert.equal(text(p.html()), "30 tasks in progress ▾", "the request's parts are not in the pill");
  p.press({ "data-bg": "open" });
  const panel = p.html();
  assert.equal((panel.match(/class="st-bg-row st-par-run"/g) || []).length, 4);
  assert.equal((panel.match(/class="st-bg-row st-par-wait"/g) || []).length, 26);
  assert.match(panel, /data-bg="stopall">Stop all</);
  p.press({ "data-bg": "stopall" });
  assert.deepEqual(p.stops, [KA], "Stop all did not stop the request");
  // ITS RUNNING PART'S OWN STOP posts that part's stop.
  p.press({ "data-bg-row": KA + "|3" });
  assert.match(p.html(), /data-bg="stop" data-bg-id="a{20}\|3">Stop</);
  // AND THE CARD ON THE THREAD, when it is there, lists it once, in the same rows.
  const withCard = siteOf({ card: true });
  assert.equal(text(load(withCard).html()), "30 tasks in progress ▾");
  // A RECORD ALREADY ENDED stays out once its finished rows have dropped off.
  const ended = siteOf();
  ended.requests[KA].view = { ...ended.requests[KA].view, ended: true, parts: ended.requests[KA].view.parts.map((x) => ({ ...x, status: "done" })) };
  ended.requests[KA].doneAt = Object.fromEntries(ended.requests[KA].view.parts.map((x) => [x.n, 0]));
  assert.equal(load(ended).html(), "");
});

test("W — a live request whose parts cannot be read is one row, and its Stop stops the whole request", () => {
  const site = siteOf({ empty: true, card: true });
  const p = load(site);
  assert.equal(text(p.html()), "1 task in progress ▾");
  p.press({ "data-bg": "open" });
  p.press({ "data-bg-row": KA + "|-1" });
  const v = p.html();
  assert.match(text(v), /Your request Stop/);
  p.press({ "data-bg": "stop", "data-bg-id": KA + "|-1" });
  assert.deepEqual(p.stops, [KA]);
  assert.deepEqual(p.posts, [], "the whole request's row posted a part stop");
});

test("B — the box keeps Stop whenever the panel does not list the running request, and that Stop stops it", () => {
  // LISTED: the panel holds Stop, the box keeps Send.
  assert.equal(load(siteOf()).ctx.siteComposerStops(siteOf()), false);
  assert.equal(load(siteOf({ empty: true })).ctx.siteComposerStops(siteOf({ empty: true })), false);
  // NOT LISTED (every part still working but none the panel can draw — a view of parts with no numbers).
  const odd = siteOf();
  odd.requests[KA].view.parts = odd.requests[KA].view.parts.map(({ n: _n, ...rest }) => rest);
  const p = load(odd);
  assert.equal(p.html(), "");
  assert.equal(p.ctx.siteComposerStops(odd), true, "nothing in the panel and no Stop in the box");
  p.ctx.siteStopWork(odd);
  assert.deepEqual(p.stops, [KA], "the box's Stop did not stop the request");
});

test("SV — a second Stop on a request already stopped asks every live job to cancel again", async () => {
  const DESC = "Change the site description to say we bake overnight sourdough";
  const LOOK = { fields: ["description"], scopes: [{ part: "description", words: DESC }] };
  const compiler = installCompiler();
  const P = platform({ slug: "sp-sv-" + Math.random().toString(16).slice(2, 8), answers: { route: [{ intent: "edit", layer: "look" }], "lane:description": "Overnight sourdough.", pick: LOOK } });
  try {
    const r = await sendMessage(P, { message: DESC + "." });
    const job = RQ.partJobId(P.record(r.key), 0);
    assert.ok(job, "part 0 has no live job");
    const path = "/api/site/request/" + P.slug + "/" + r.key;
    const cancels = () => P.rpcLog.filter((x) => x.fn === "edit_cancel").map((x) => [x.args.p_id, x.args.p_uid]);
    const s1 = await call(P, "DELETE", path);
    assert.equal(s1.status, 200, JSON.stringify(s1.body));
    assert.deepEqual(cancels(), [[job, USER.id]]);
    assert.equal(P.record(r.key).stop, true);
    assert.equal(P.record(r.key).ended, false, "the request ended with its job still live");
    const s2 = await call(P, "DELETE", path);
    assert.equal(s2.status, 200, JSON.stringify(s2.body));
    assert.deepEqual(cancels(), [[job, USER.id], [job, USER.id]], "a second Stop did not ask the live job to cancel again");
  } finally { P.close(); compiler.uninstall(); }
});
