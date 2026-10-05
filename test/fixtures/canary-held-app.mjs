// A STAND-IN FOR THE APP AS IT FOLLOWS A REQUEST SINCE DEPLOY 2183 (2026-10-05),
// for the UI canary's reply watch (`test/canary-replies.test.mjs`).
//
// What the real page does, and what this does the same way, look by look (one
// look per read of the page, as the canary reads it):
//   * each part's job is polled once its request lists it; an answer whose
//     reply is still being written (`replyState: "pending"`) is applied and
//     its place HELD on the thread — a message carrying the job's id
//     (`held`), drawn as the waiting line — and the job counts as shown
//     (`siteRequestJobReply`, `editReplyHold`);
//   * every held message's job is polled again at each look until its reply
//     is no longer pending, and the message is SETTLED in place: the model's
//     words (with a question's words under them when it asks), or the page's
//     own sentence when the reply failed (`editReplyFollow`, `settleHeld`);
//   * the request is CLOSED once it has ended and every job is shown — held
//     ones included — and its own reply, when one is owed, is no longer
//     pending (`siteRequestShow`): so a request closes while a reply is still
//     being written, which is what run 97's canary did not wait out;
//   * OTHER REQUESTS of the same site, picked up on open (`siteRequestsCheck`),
//     have their replies drawn at the end of the thread when they arrive —
//     after the new message, as the real page does (an open product bug) —
//     and their held replies are followed the same way;
//   * a RELOAD keeps the thread and its held marks (they are stored) and
//     starts another page life (`origin`); a tab opened later shares them.
// Each poll of a job takes that job's next answer (`answers[job]`, the last
// one repeating) — or, for a job a case times (`timed[job]`), its pending
// answer until that long after the send and its written one after — and each
// is handed to the canary's own response listener under `x-gf-edit: final`,
// as the real poll route does. `endAfterMs` keeps the request from ending
// until that long after the send. `drawLag` redraws a settled reply that many
// looks after its written answer came back — the moment the canary has the
// answer in its record and the page has not yet drawn it.

export const ORIGIN = "https://gofarther.dev";
export const SLUG = "fold-lane-bakery";
export const UID = "22175f41-6fbf-49d7-b039-a65078a0141c";
export const HOLD_LINE = "Done — writing up what changed…";

const clone = (v) => JSON.parse(JSON.stringify(v));

export function heldApp(opt = {}) {
  const calls = [];
  const requestListeners = [];
  // WHAT THE BROWSER STORES, shared by every tab: the thread, the page's own
  // record of each request, the live question.
  const keep = { msgs: [], requests: {}, ask: null };
  const server = { key: "", views: [], at: 0 };
  const taken = {};
  let sends = 0;
  let looks = 0;
  let sentTime = 0;
  const since = () => Date.now() - sentTime;
  const now = () => (server.views.length ? clone(server.views[Math.min(server.at, server.views.length - 1)]) : null);
  const read = () => {
    const toLast = server.at + 1 === server.views.length - 1;
    if (server.at < server.views.length - 1 && !(toLast && opt.endAfterMs && since() < opt.endAfterMs)) server.at++;
    return now();
  };
  const answerOf = (job) => {
    const timed = (opt.timed || {})[job];
    if (timed) return clone(since() >= timed.afterMs ? timed.res : timed.pending);
    const list = (opt.answers || {})[job] || [{ ok: true, msg: "✅ Done.", reply: `Done: ${job}.`, replySource: "model" }];
    const i = Math.min(taken[job] || 0, list.length - 1);
    taken[job] = (taken[job] || 0) + 1;
    return clone(list[i]);
  };
  const modelOf = (res) => (res && res.replySource === "model" && typeof res.reply === "string" && res.reply.trim() ? res.reply.trim() : "");
  const asksOf = (res) => (res && res.clarify && typeof res.clarify.text === "string" ? res.clarify.text : "");
  // THE WORDS A SETTLED ANSWER IS DRAWN IN: the model's (and the question
  // under them), the question alone, or the page's own sentence.
  const wordsOf = (res) => {
    const model = modelOf(res);
    const asks = asksOf(res);
    if (model) return asks ? `${model}\n${asks}` : model;
    if (asks) return asks;
    return String((res && res.msg) || "");
  };
  const tabs = [];
  const newTab = () => {
    const t = { id: tabs.length + 1, closed: false, workspace: false, busy: false, value: "", mark: "", origin: 1000 + tabs.length * 1000, listeners: {}, looks: 0, history: false };
    tabs.push(t);
    const emit = async (method, path, status, req, res, headers = {}) => {
      for (const l of requestListeners) l({ url: () => ORIGIN + path, method: () => method });
      const r = { request: () => ({ url: () => ORIGIN + path, method: () => method, postData: () => (req ? JSON.stringify(req) : null) }), status: () => status, headers: () => headers, text: async () => JSON.stringify(res) };
      await Promise.all((t.listeners.response || []).map((h) => h(r)));
    };
    const poll = async (job) => {
      const res = answerOf(job);
      calls.push(`tab ${t.id} poll ${job} ${res.replyState || (modelOf(res) ? "model" : asksOf(res) ? "question" : "plain")}`);
      await emit("GET", `/api/site/edit/${job}`, 200, null, res, { "x-gf-edit": "final" });
      return res;
    };
    // ONE ANSWER ON THE THREAD: held when its reply is still being written.
    const say = (job, res) => {
      if (res.escalate === true) return;
      // A QUESTION'S CARD IS DRAWN AT ONCE, under a held line as under a written reply.
      if (asksOf(res)) keep.ask = { id: res.clarify.id, text: res.clarify.text, key: "", part: null };
      if (res.replyState === "pending") { keep.msgs.push({ who: "a", text: HOLD_LINE, held: job, asks: asksOf(res) }); return; }
      if ((opt.drop || []).includes(job)) return;
      keep.msgs.push({ who: "a", text: wordsOf(res) });
    };
    const look = async () => {
      if (!t.workspace) return;
      t.looks++;
      looks++;
      // A RELOAD, at the look a case names: another page life, the thread and
      // its held marks as stored.
      if (opt.reloadAtLook && looks === opt.reloadAtLook && !t.reloaded) {
        t.reloaded = true;
        t.origin += 500;
        t.mark = "";
        calls.push(`tab ${t.id} reloaded`);
      }
      // OTHER REQUESTS OF THE SITE, arriving after the new message's send.
      for (const h of opt.history || []) {
        if (h.done || sends < 1 || looks < (h.atLook || 1)) continue;
        h.done = true;
        keep.requests[h.key] = { closed: false, ended: true, shown: [], replied: false, replies: [] };
        for (const job of h.jobs || []) {
          const res = await poll(job);
          keep.requests[h.key].shown.push(job);
          say(job, res);
        }
        if (h.own) { keep.msgs.push({ who: "a", text: h.own }); keep.requests[h.key].replied = true; }
        calls.push(`history ${h.key} drawn`);
      }
      // EVERY HELD REPLY, FOLLOWED: settled in place once it is not pending —
      // drawn at once, or `drawLag` looks later.
      for (const m of keep.msgs) {
        if (!m.held) continue;
        if (m.drawAt) { if (looks < m.drawAt) continue; }
        const res = m.drawn || await poll(m.held);
        if (res.replyState === "pending") continue;
        if (opt.drawLag && !m.drawAt) { m.drawAt = looks + opt.drawLag; m.drawn = res; continue; }
        calls.push(`settled ${m.held}`);
        const job = m.held;
        delete m.held;
        m.text = (opt.drop || []).includes(job) ? "" : wordsOf(res) || m.text;
        if (!m.text) m.gone = true;
      }
      // THE CURRENT REQUEST: one job's answer per look, and the close.
      if (t.looks <= (opt.followAfter || 0)) return;
      const key = server.key;
      const rec = key ? keep.requests[key] : null;
      if (!rec || rec.closed) return;
      const v = now();
      if (!v) return;
      for (const p of v.parts) {
        for (const job of p.jobs || []) {
          if (rec.shown.includes(job)) continue;
          const res = await poll(job);
          rec.shown.push(job);
          say(job, res);
          return;
        }
      }
      if (v.ended) {
        const own = opt.requestReply || null;
        if (own && own.pendingLooks && looks < own.pendingLooks) return;
        if (own && own.text && !rec.replied) { keep.msgs.push({ who: "a", text: own.text }); rec.replied = true; rec.replies.push(own.for || "end"); }
        rec.ended = true; rec.closed = true;
        calls.push(`closed ${key}`);
      }
    };
    const state = () => ({
      signedIn: true, uid: UID, gate: false, workspace: t.workspace, busy: t.busy,
      send: t.workspace && !t.busy, sendDisabled: t.workspace && !t.busy ? false : null, stop: t.workspace && t.busy,
      textarea: t.workspace, disabled: t.workspace ? false : null, value: t.value, working: t.busy ? 1 : 0, attached: 0, strip: 0,
      messages: keep.msgs.filter((m) => !m.gone).map((m) => ({
        who: m.who, busy: false, card: !!m.card,
        text: m.held ? (m.asks ? `${m.text}\n${m.asks}` : m.text) : m.text,
        holding: !!m.held, held: m.held || "",
      })),
      origin: t.origin,
      requests: clone(keep.requests),
      ask: keep.ask ? { ...keep.ask } : null, askCard: !!keep.ask,
    });
    const page = {
      on: (ev, h) => { (t.listeners[ev] = t.listeners[ev] || []).push(h); },
      goto: async (url) => { calls.push(`tab ${t.id} goto ${new URL(url).pathname}`); return { headers: () => ({}) }; },
      close: async () => { calls.push(`tab ${t.id} closed`); t.closed = true; },
      evaluate: async (fn, arg) => {
        if (t.closed) throw new Error("Target page, context or browser has been closed");
        if (fn.name === "cardIdInPage") return `srv_${SLUG}`;
        if (fn.name === "markTabInPage") { t.mark = arg; return { mark: t.mark, origin: t.origin, path: "/projects" }; }
        if (fn.name === "tabMarkInPage") return { mark: t.mark, origin: t.origin, path: "/projects" };
        if (fn.name === "requestViewInPage") {
          calls.push(`tab ${t.id} view`);
          if (arg.key !== server.key) return { status: 404, ok: false, request: null, reply: null, replyState: "", replyFor: "" };
          const v = read();
          const own = opt.requestReply || null;
          const pending = own && own.pendingLooks && looks < own.pendingLooks;
          const reply = v && v.ended && own && own.text && !pending ? { text: own.text, source: own.source || "model", for: own.for || "end" } : null;
          return { status: 200, ok: true, request: v, reply, replyState: v && v.ended && pending ? "pending" : own && own.state ? own.state : "", replyFor: own ? own.for || "end" : "" };
        }
        if (fn.name === "stopRequestInPage") return { status: 200, ok: true, state: "stopped" };
        if (fn.name !== "readComposerInPage") throw new Error("unexpected page function " + fn.name);
        await look();
        return state();
      },
      click: async (sel) => {
        calls.push(`tab ${t.id} click ${sel}`);
        if (sel.includes(".st-card-name")) t.workspace = true;
        if (sel !== "#stSend") return;
        const said = t.value;
        t.value = "";
        keep.msgs.push({ who: "u", text: said });
        // THE ANSWER TO A STEP'S QUESTION resumes that part of its request.
        const waits = keep.ask && server.key ? (now() || { parts: [] }).parts.find((p) => p.status === "waiting" && p.question && p.question.id === keep.ask.id) : null;
        if (waits) {
          keep.ask = null;
          server.views = opt.answerViews || []; server.at = 0;
          calls.push(`sent ${sends + 1} (the answer)`);
          sends++;
          await emit("POST", "/api/site/route", 200, { message: said, attached: false }, { ok: true, intent: "addon", cost: 1, request: now(), resumed: { key: server.key, part: waits.n } });
          return;
        }
        keep.ask = null;
        const plan = opt.send(sends++, said);
        sentTime = Date.now();
        calls.push(`sent ${sends}`);
        server.key = plan.request.key; server.views = plan.request.views; server.at = 0;
        await emit("POST", "/api/site/route", 200, { message: said, attached: false }, { ok: true, intent: "edit", layer: "nav", cost: 2, ...(plan.route || {}), request: now() });
        keep.msgs.push({ who: "a", card: true, text: said + " Queued" });
        keep.requests[plan.request.key] = { closed: false, ended: false, shown: [], replied: false, replies: [] };
      },
      fill: async (sel, v) => { t.value = v; },
      waitForEvent: async () => ({ setFiles: async () => {} }),
      screenshot: async () => {},
    };
    return page;
  };
  const context = {
    route: async () => {},
    addInitScript: async () => {},
    newPage: async () => newTab(),
    on: (ev, fn) => { if (ev === "request") requestListeners.push(fn); },
    close: async () => {},
  };
  const browser = { newContext: async () => context, close: async () => { calls.push("browser closed"); } };
  return {
    calls, keep, server, tabs,
    launch: async () => browser,
    requestsNow: async () => { calls.push("list"); const v = read(); return { status: 200, json: { ok: true, requests: v ? [v] : [] } }; },
    stopNow: async () => ({ status: 200, json: { ok: true, request: now() } }),
  };
}
