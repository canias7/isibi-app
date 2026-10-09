// THE STAND-IN APP IN REQUEST MODE, shared by the request presses' tests
// (moved here from test/canary-requests.test.mjs on 2026-10-06, unchanged, so
// the progress live check's tests drive the same harness; see
// test/canary-progress.test.mjs).
import { runUi } from "../../scripts/canary-ui.mjs";

export const SLUG = "fold-lane-bakery";
export const UID = "22175f41-6fbf-49d7-b039-a65078a0141c";
export const ORIGIN = "https://gofarther.dev";
export const SITE = "https://fold-lane-bakery.gofarther.app";

// ── THE DRIVER, THROUGH A STAND-IN APP IN REQUEST MODE ───────────────────────
//
// One browser: tabs share what the page keeps (its thread, its record of each
// request, the live question), as localStorage does. The server's request is a
// list of views, and moves one view on each time the CANARY reads it — its own
// view read through the page, or the requests list — never when a page draws
// it. An open tab shows each part's reply as the views name its jobs, keeps a
// step's question as the site's live one with its card, and closes the request
// once it has ended and every reply is on screen. Every API call a page makes
// goes through the context's routes (the canary's wall) and its request
// listeners, as in a real browser.

export const RQ_KEY = (n) => "rqbatch" + "0".repeat(16) + n;
export const part = (n, words, status, over = {}) => ({ n, words, status, ids: [], jobs: [], charged: 0, ...over });
export const view = (key, parts, over = {}) => ({ key, state: over.ended ? "done" : "running", ended: false, stop: false, at: 1, updatedAt: 2, parts, ...over });

export function rqApp(opt = {}) {
  const calls = [];
  const routes = [];
  const requestListeners = [];
  // A QUESTION ALREADY LIVE WHEN THE SITE OPENS (`liveAsk`, 2026-10-08): the page
  // makes a waiting request's question its live one on open, as `siteRequestShow` does.
  const keep0 = () => ({ msgs: [], requests: {}, ask: opt.liveAsk ? { ...opt.liveAsk } : null, previewV: 0, pages: opt.pages ? [...opt.pages] : null, tables: opt.tables ? [...opt.tables] : null });
  // WHAT THE PAGE KEEPS, PER BROWSER CONTEXT (2026-10-06): the run's own; and,
  // where a case says so (`fresh`), each later context's own, empty — a fresh
  // browser session holds nothing of the first's.
  const mainKeep = keep0();
  const server = { key: "", views: [], at: 0, stopped: false };
  // WHICH TAB SENT EACH REQUEST (a live case): a tab that did not send it and
  // finds it done is reconciling, which the old page did not (`oldReconcile`).
  const senders = {};
  let sends = 0;
  const now = () => (server.views.length ? JSON.parse(JSON.stringify(server.views[Math.min(server.at, server.views.length - 1)])) : null);
  const read = () => { if (server.at < server.views.length - 1) server.at++; return now(); };
  const stopIt = () => {
    const v = now();
    if (!v) return;
    v.ended = true; v.stop = true; v.state = "stopped";
    for (const p of v.parts) if (p.status !== "done") p.status = "cancelled";
    server.views = [v]; server.at = 0;
  };
  const tabs = [];
  const newTab = (keep = mainKeep) => {
    const t = { id: tabs.length + 1, closed: false, workspace: false, busy: false, value: "", attached: 0, strip: 0, mark: "", origin: 1000 + tabs.length, listeners: {}, looks: 0, frame: null };
    tabs.push(t);
    // THE PREVIEW FRAME (a live case): given the site's address with the
    // preview's version, and loading it — a request from this tab to the site.
    const draw = () => {
      if (!opt.live) return;
      t.frame = `${SITE}/?v=${keep.previewV}`;
      for (const h of t.listeners.request || []) h({ url: () => t.frame, method: () => "GET" });
    };
    const emit = async (method, path, status, req, res, headers = {}) => {
      for (const l of requestListeners) l({ url: () => ORIGIN + path, method: () => method });
      const r = { request: () => ({ url: () => ORIGIN + path, method: () => method, postData: () => (req ? JSON.stringify(req) : null) }), status: () => status, headers: () => headers, text: async () => JSON.stringify(res) };
      await Promise.all((t.listeners.response || []).map((h) => h(r)));
    };
    const throughWall = async (method, path, body) => {
      const u = new URL(ORIGIN + path);
      for (const r of routes) {
        if (typeof r.pattern === "function" && !r.pattern(u)) continue;
        let out = "fallback";
        await r.handler({ request: () => ({ url: () => u.href, method: () => method, postData: () => JSON.stringify(body) }), fallback: async () => { out = "fallback"; }, abort: async () => { out = "abort"; } });
        calls.push(`wall ${method} ${path} ${out}`);
        if (out === "abort") return false;
      }
      return true;
    };
    // THE PAGE FOLLOWS ITS REQUEST: each part's reply once — one job per look,
    // as the page polls each job in turn — a step's question kept, and the
    // request closed once it has ended and every reply is on screen.
    const follow = async () => {
      // ONLY ONCE THE SITE'S WORKSPACE IS OPEN, and — where a case says so
      // (`followAfter`) — a few looks after that, as a page reopened on a
      // finished request takes its time to fetch each part's reply.
      if (!t.workspace || ++t.looks <= (opt.followAfter || 0)) return;
      const key = server.key;
      const rec = key ? keep.requests[key] : null;
      if (!rec || rec.closed) return;
      const v = now();
      if (!v) return;
      for (const p of v.parts) {
        for (const job of p.jobs || []) {
          if (rec.shown.includes(job)) continue;
          const reply = (opt.replies || {})[job] || { ok: true, msg: "✅ Done.", reply: `Done: ${job}.`, replySource: "model" };
          await emit("GET", `/api/site/edit/${job}`, 200, null, reply, { "x-gf-edit": "final" });
          rec.shown.push(job);
          if (reply.clarify) {
            // AS THE PAGE KEEPS IT: a question read off a job's reply by
            // `clarifyOf` carries its id, words and answers, not its request.
            keep.ask = { id: reply.clarify.id, text: reply.clarify.text, key: opt.askKeepsRequest ? key : "", part: opt.askKeepsRequest ? p.n : null };
            keep.msgs.push({ who: "a", text: reply.clarify.text, ask: true });
          } else keep.msgs.push({ who: "a", text: reply.replySource === "model" ? reply.reply : reply.msg, job: opt.live ? job : "" });
          // A LIVE CASE: the page moves its preview on and keeps the job's
          // pages and tables — the old page did not, for a request it did not
          // send and found done (`oldReconcile`).
          if (opt.live && !(opt.oldReconcile && senders[key] !== t.id)) {
            keep.previewV++;
            const fx = (opt.jobs || {})[job] || {};
            if (fx.pages) keep.pages = [...new Set([...(keep.pages || []), ...fx.pages])];
            if (fx.tables) keep.tables = [...new Set([...(keep.tables || []), ...fx.tables])];
            draw();
          }
          // ANOTHER REQUEST'S REPLY, DRAWN AT THE END OF THE THREAD (the old
          // page's placement, `misplace`): once, after this job's reply.
          if (opt.misplace && opt.misplace.after === job) keep.msgs.push({ who: "a", text: opt.misplace.text, job: opt.misplace.job });
          return;
        }
      }
      if (v.ended) { rec.ended = true; rec.closed = true; }
    };
    // EACH REQUEST'S CARD AS DRAWN (`progress`, 2026-10-06): each part named by
    // the model's line for its state where the view carries its lines (`said`),
    // by its words otherwise; its progress lines; the newest live while it runs.
    const SAID_FOR = { blocked: "planned", ready: "planned", queued: "planned", started: "doing", waiting: "waiting", unverified: "unconfirmed", done: "done", partial: "partial", failed: "notdone", cancelled: "notdone" };
    const cardsOf = () => {
      const v = now();
      const out = {};
      for (const k of Object.keys(keep.requests)) {
        if (!v || v.key !== k) continue;
        out[k] = {
          ended: !!v.ended,
          parts: v.parts.map((p) => {
            const which = SAID_FOR[p.status] || "";
            const lines = (Array.isArray(p.progress) ? p.progress : []).map((l) => l.text);
            return {
              n: p.n, status: p.status, words: p.said && which && p.said[which] ? p.said[which] : p.words, label: p.status,
              lines, live: p.status === "started" && lines.length ? lines[lines.length - 1] : "", said: p.said ? { ...p.said } : null,
            };
          }),
        };
      }
      return out;
    };
    const state = () => ({
      signedIn: true, uid: UID, gate: false, workspace: t.workspace, busy: t.busy,
      send: t.workspace && !t.busy, sendDisabled: t.workspace && !t.busy ? false : null, stop: t.workspace && t.busy,
      textarea: t.workspace, disabled: t.workspace ? false : null, value: t.value, working: t.busy ? 1 : 0, attached: t.attached, strip: t.strip,
      messages: keep.msgs.map((m) => ({ who: m.who, busy: false, card: !!m.card, text: m.text, job: m.job || "" })),
      frame: t.frame, pages: keep.pages ? [...keep.pages] : null, tables: keep.tables ? [...keep.tables] : null,
      requests: JSON.parse(JSON.stringify(keep.requests)),
      ask: keep.ask ? { ...keep.ask } : null, askCard: !!keep.ask,
      ...(opt.progress ? { cards: cardsOf() } : {}),
    });
    const page = {
      on: (ev, h) => { (t.listeners[ev] = t.listeners[ev] || []).push(h); },
      goto: async (url) => { calls.push(`tab ${t.id} goto ${new URL(url).pathname}`); return { headers: () => ({}) }; },
      close: async () => { calls.push(`tab ${t.id} closed`); t.closed = true; },
      evaluate: async (fn, arg) => {
        if (t.closed) throw new Error("Target page, context or browser has been closed");
        if (fn.name === "cardIdInPage") return `srv_${SLUG}`;
        // THE SITE'S OWN LIST AS A VISITOR SEES IT (`shown`, 2026-10-09): a
        // row press reads it in a context of its own, before and after.
        if (fn.name === "shownListInPage") { calls.push(`tab ${t.id} shown ${arg}`); return opt.shown ? opt.shown(arg) : []; }
        if (fn.name === "markTabInPage") { t.mark = arg; return { mark: t.mark, origin: t.origin, path: "/projects" }; }
        if (fn.name === "tabMarkInPage") return { mark: t.mark, origin: t.origin, path: "/projects" };
        if (fn.name === "requestViewInPage") {
          calls.push(`tab ${t.id} view`);
          for (const l of requestListeners) l({ url: () => `${ORIGIN}/api/site/request/${SLUG}/${arg.key}`, method: () => "GET" });
          if (arg.key !== server.key) return { status: 404, ok: false, request: null, reply: null };
          return { status: 200, ok: true, request: read(), reply: opt.requestReply || null };
        }
        if (fn.name === "stopRequestInPage") { calls.push(`tab ${t.id} stop`); stopIt(); return { status: 200, ok: true, state: "stopped" }; }
        if (fn.name !== "readComposerInPage") throw new Error("unexpected page function " + fn.name);
        // WITH ITS PROGRESS DRAWN (`progress`), A LOOK MOVES THE REQUEST ON, as
        // the page's own polling of it does — in an open tab only.
        if (opt.progress && t.workspace) read();
        await follow();
        return state();
      },
      click: async (sel) => {
        calls.push(`tab ${t.id} click ${sel}`);
        if (sel.includes(".st-card-name")) {
          t.workspace = true; draw();
          // A FRESH BROWSER SESSION'S PAGE (`fresh`) FINDS THE REQUEST ON THE
          // SERVER, as the requests list names it — unless a case says it does
          // not (`discover: false`).
          if (keep !== mainKeep && server.key && opt.discover !== false && !keep.requests[server.key]) {
            keep.requests[server.key] = { closed: false, ended: false, shown: [] };
            keep.msgs.push({ who: "a", card: true, text: "found " + server.key });
          }
        }
        if (sel !== "#stSend") return;
        const said = t.value;
        t.value = "";
        keep.msgs.push({ who: "u", text: said });
        // THE ANSWER TO A STEP'S QUESTION resumes that part of its request: the
        // server knows the question by its id, whatever the page noted.
        const waits = keep.ask && server.key ? (now() || { parts: [] }).parts.find((p) => p.status === "waiting" && p.question && p.question.id === keep.ask.id) : null;
        if (waits) {
          keep.ask = null;
          server.views = opt.answerViews || []; server.at = 0;
          await emit("POST", "/api/site/route", 200, { message: said, attached: false }, { ok: true, intent: "addon", cost: 1, request: now(), resumed: { key: server.key, part: waits.n } });
          return;
        }
        keep.ask = null;
        const plan = opt.send(sends++, said);
        if (plan.request) {
          server.key = plan.request.key; server.views = plan.request.views; server.at = 0;
          senders[plan.request.key] = t.id;
          const site = opt.live ? { site: { tables: keep.tables ? [...keep.tables] : [] } } : {};
          await emit("POST", "/api/site/route", 200, { message: said, attached: false, ...site }, { ok: true, intent: "edit", layer: "text", cost: 2, ...(plan.route || {}), request: now() });
          if (opt.live && plan.route && Array.isArray(plan.route.tablesFilled)) keep.tables = [...plan.route.tablesFilled];
          keep.msgs.push({ who: "a", card: true, text: said + " Queued" });
          keep.requests[plan.request.key] = { closed: false, ended: false, shown: [] };
          // THE FIRST TAB'S FIRST LOOK AT THE SITE'S EARLIER REQUESTS, landing
          // after the send (`historyMoves`, run 101's shape): it reconciles
          // their jobs, moving this tab's preview once each — and the stored
          // address, which the tab opened afterwards opens at.
          if (opt.live && opt.historyMoves && sends === 1) for (let k = 0; k < opt.historyMoves; k++) { keep.previewV++; draw(); }
          return;
        }
        if (plan.clarify) {
          await emit("POST", "/api/site/route", 200, { message: said, attached: false }, { ok: true, intent: "clarify", question: plan.clarify, cost: 1 });
          keep.ask = { id: plan.clarify.id, text: plan.clarify.text, key: "", part: null };
          keep.msgs.push({ who: "a", text: plan.clarify.text, ask: true });
          return;
        }
        // THE OLD PATH: no request, so the page posts its own edit — through the wall.
        await emit("POST", "/api/site/route", 200, { message: said, attached: false }, { ok: true, intent: "edit", layer: plan.layer, cost: 2 });
        const out = await throughWall("POST", `/api/site/${SLUG}/edit`, { layer: plan.layer, instruction: said });
        keep.msgs.push({ who: "a", text: out ? "✅ Done the old way." : "⚠️ I couldn't reach the site just now — nothing changed." });
      },
      fill: async (sel, v) => { t.value = v; },
      waitForEvent: async () => ({ setFiles: async () => { t.attached = 1; t.strip = 1; } }),
      screenshot: async () => {},
    };
    return page;
  };
  const contexts = [];
  const makeContext = (keep) => {
    const c = {
      keep, inits: [],
      route: async (pattern, handler) => { routes.push({ pattern, handler }); },
      addInitScript: async (fn, arg) => { c.inits.push(arg); },
      newPage: async () => newTab(keep),
      on: (ev, fn) => { if (ev === "request") requestListeners.push(fn); },
      close: async () => {},
    };
    contexts.push(c);
    return c;
  };
  const context = makeContext(mainKeep);
  const browser = {
    newContext: async () => {
      calls.push("context");
      return opt.fresh && calls.filter((x) => x === "context").length > 1 ? makeContext(keep0()) : context;
    },
    close: async () => { calls.push("browser closed"); },
  };
  return {
    calls, keep: mainKeep, server, tabs, contexts,
    launch: async () => browser,
    requestsNow: async () => {
      calls.push("list");
      // ANOTHER PAGE OF THE RUN'S BROWSER READING THE REQUEST'S OWN ROUTE while
      // the tab is closed (`readWhileAway`): what the closed-tab check exists to catch.
      if (opt.readWhileAway && calls.filter((c) => c === "list").length === 2) {
        for (const l of requestListeners) l({ url: () => `${ORIGIN}/api/site/request/${SLUG}/${server.key}`, method: () => "GET" });
      }
      const v = read();
      return { status: 200, json: { ok: true, requests: v ? [v] : [] } };
    },
    stopNow: async (key) => { calls.push(`stopNow ${key}`); stopIt(); return { status: 200, json: { ok: true, request: now() } }; },
  };
}

export const SESSION = { access_token: "a", refresh_token: "r", expires_at: 2_000_000_000, user: { id: UID } };
export const drive = (h, scenario, over = {}) => runUi({
  base: ORIGIN, session: SESSION, slug: SLUG, scenario, spend: true, balanceNow: async () => 100, evid: "", launch: h.launch, log: () => {},
  openMs: 200, attachMs: 50, startMs: 50, stepMs: 2_000, stepCapMs: 2_000, pollMs: 1, settleMs: 0, viewEveryMs: 0, awayEveryMs: 1, askShownMs: 30,
  requestsNow: h.requestsNow, stopNow: h.stopNow, ...over,
});
