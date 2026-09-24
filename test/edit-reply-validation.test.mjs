// AN EDIT REPLY IS VALIDATED BEFORE IT IS TRUSTED (2026-09-24).
//
// The owner, reproducing it independently on fd27cc9f: "HTTP 503 carrying the
// edit's addon handoff posts a paid addon", and "HTTP 200 with {ok:"false"}
// prints "✅ Done."". The rule is the one the add-on's replies were given the
// same day: "Require real booleans, appropriate HTTP status and valid action
// fields before success or another paid action. Invalid or contradictory
// responses must stop with uncertainty. Preserve legitimate edit handoffs,
// refusals, recovered results, partial outcomes and duplicate-execution
// protection."
//
// REPRODUCED FIRST, through these same handlers on the deployed `chat.js`
// (fd27cc9f, sha256 489b2884…), each shape straight back AND as a queued job's
// stored reply: 25 malformed shapes, and in 34 of their 50 readings the page
// started a paid request — another edit (16), the add-on (6), the full rewrite
// (12) — while 8 printed "✅", 2 printed a success's own words under a warning
// and 5 said the edit "didn't finish … untouched … refunded" about a body that
// said nothing of the kind. Six replies that were not receipts were taken as
// one — watched, polled as `/api/site/edit/7`, or printed "✅ Done." at once —
// and a job's own final reply shaped as a receipt printed "✅ Done.".
//
// `editAnswer` read `e.escalate` by truthiness before it asked the status, and
// `!e.ok`; `siteEdit` took a receipt on `e.ok && e.job && !e.result`. Both ask
// `readEditReply` now: the add-on's rule (`readRouteReply`), with the one thing
// the edit route really does differently — its escalate may hand the ask to the
// add-on route. Anything the rule does not trust says the edit's own
// not-knowing sentence and posts nothing more.
//
// `siteSend` is cut out of public/chat.js and RUN, with the real `siteRoute`,
// `siteEdit`, `editAnswer`, `escalatedEdit`, `watchEditJob`, `resumeOpenSite`,
// the readers, both reply composers, `siteAddon`, `reactSend` and the real
// public/edit-poll.js. `fetch` is the one seam: each request is recorded and
// answered from the case's script, and a request the script does not answer
// never settles — so a paid request that STARTED is recorded as started.
//
// Every answer here is SUPPLIED. This proves what the browser sends and says
// for a reply, never how often a real route answers these shapes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const POLL = readFileSync(new URL("../public/edit-poll.js", import.meta.url), "utf8");

// A top-level function runs from its declaration to the first `}` at column 0.
function cut(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const shut = CHAT.indexOf("\n}\n", open);
  assert.ok(shut > open, head + " has no end in chat.js");
  return CHAT.slice(open, shut + 3);
}
function cutLine(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  return CHAT.slice(open, CHAT.indexOf("\n", open + 1) + 1);
}
const SRC = [
  POLL,
  cut("async function apiFetch("),
  cutLine("const ROUTE_EDIT_LAYERS ="),
  cut("function routeQuestion("),
  cut("function routeActionable("),
  cut("function siteRoute("),
  cutLine("const siteNewDraft ="),
  cut("function siteDraft("),
  cut("function siteSend("),
  cut("function siteBuildStart("),
  cutLine("function siteBuildStop("),
  "const editInFlight = new Set(); const editIdem = new Map(); const editBlocked = new Set(); const editWatched = new Set();",
  cut("function siteEdit("),
  cut("function unreadEditMsg("),
  cut("function wholeRequestNote("),
  cut("function editAnswer("),
  cut("function applyEditResult("),
  cut("function escalatedEdit("),
  cut("function watchEditJob("),
  cut("function resumeEditJob("),
  cut("function resumeOpenSite("),
  cut("function siteAddon("),
  cut("function addonAnswer("),
  cut("function readRouteReply("),
  cut("function readAddonReply("),
  cut("function readEditReply("),
  cut("function applyAddonResult("),
  cut("function addonOutcomeMsg("),
  cut("function sitePathOf("),
  ...["problemNote", "photoNote", "listPhotoNote", "browserTimeZone", "jobZone", "onceWhen", "jobWords",
    "jobOnceNote", "addonReplyText", "renderTail", "alsoTail", "editOutcomes", "partialSaid", "pageOpVerb",
    "pageOpsSaid", "editReplyBody", "editReply"].map((n) => cut("function " + n + "(")),
  cut("function reactSend("),
  cut("function reactStageLabel("),
  cut("function buildCostWords("),
  cut("function buildErrOutcome("),
  cutLine("const ST_PHASE_ORDER ="),
].join("\n");

const settle = async () => { for (let i = 0; i < 200; i++) await new Promise((r) => setImmediate(r)); };

function kindOf(url, method) {
  const u = String(url);
  if (u === "/api/site/route") return "route";
  if (/^\/api\/site\/edit\//.test(u)) return method === "GET" ? "poll" : "cancel";
  if (/^\/api\/site\/[^/]+\/edit$/.test(u)) return "edit";
  if (/^\/api\/site\/[^/]+\/addon$/.test(u)) return "addon";
  if (/^\/api\/site\/react-(revise|build)$/.test(u)) return "rewrite";
  return "other";
}

/**
 * ONE PAGE, with the real handlers loaded and `fetch` answered from `answers`
 * (a request kind → the responses it gets, in order). Messages are sent with
 * `send`; `read()` is every request, the assistant messages, the busy flag, the
 * rail and its clock. Several messages may go through one page, which is what
 * the needs-review case needs: the second message meets the first one's block.
 */
function page({ answers, site = LIVE }) {
  const reqs = [];
  const events = [];
  const clock = { started: 0, cleared: 0 };
  const s = JSON.parse(JSON.stringify(site));
  s.msgs = [];
  const script = {};
  for (const k of Object.keys(answers)) script[k] = answers[k].slice();
  const store = new Map();
  const ctx = vm.createContext({
    window: {}, Auth: { accessToken: async () => "token" },
    AbortController, encodeURIComponent, Intl, Response, Headers,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } },
    fetch: (url, init) => {
      const method = (init && init.method) || "GET";
      const kind = kindOf(url, method);
      reqs.push({ kind, method, url: String(url), body: init && init.body ? JSON.parse(init.body) : undefined });
      const next = script[kind] && script[kind].length ? script[kind].shift() : null;
      if (!next) return new Promise(() => {});
      if (next.reject) return Promise.reject(next.reject);
      const headers = { "content-type": next.type || "application/json", ...(next.headers || {}) };
      return Promise.resolve(new Response(next.body, { status: next.status, headers }));
    },
    setInterval: () => { clock.started++; return { clock: clock.started }; },
    clearInterval: () => { clock.cleared++; },
    setTimeout: (fn) => { setImmediate(fn); return {}; },
    clearTimeout: () => {},
    showAuthGate: () => events.push("sign-in gate"),
    scheduleCreditRefresh: () => events.push("credit refresh"),
    fetchCredits: () => {},
    siteById: (id) => (id === "origin-1" ? s : null),
    sitesSave: () => {},
    sitePages: (x) => (Array.isArray(x.pages) ? x.pages : []),
    siteActivePage: () => null,
    paintAttachStrip: () => {},
    buildPicker: "grok",
    siteBusy: false, siteBuild: null, siteTicker: null, siteOpenId: "origin-1",
    renderSites: () => {},
    paintReactLive: () => {},
    siteAbort: null, siteErr: null,
  });
  vm.runInContext(SRC, ctx);
  return {
    ctx, s,
    async send(message = ASK) { ctx.siteSend(message); await settle(); },
    read() {
      const msgs = JSON.parse(JSON.stringify(s.msgs));
      return {
        reqs,
        trail: reqs.filter((r) => r.kind !== "route").map((r) => r.method + " " + r.url),
        said: msgs.filter((m) => m.r === "a").map((m) => m.t),
        busy: ctx.siteBusy,
        railRunning: !!ctx.siteBuild,
        clock,
        ticker: ctx.siteTicker,
        events,
        store,
      };
    },
  };
}

/** One message through the real send handler; the routing call is asserted first. */
async function drive({ answers, site, message = ASK }) {
  const p = page({ answers, site });
  await p.send(message);
  const o = p.read();
  assert.equal(o.reqs[0] && o.reqs[0].url, "/api/site/route", "the routing call went out first");
  return o;
}

const LIVE = { slug: "fretwork-1", react: true, name: "Fretwork", url: "https://fretwork-1.gofarther.app/", pages: [{ path: "/" }, { path: "/prices" }, { path: "/gear" }] };
const ASK = "Make the footer navy";
const json = (o) => JSON.stringify(o);
const ok = (o, status = 200) => ({ status, body: json(o) });
const FINAL = { "x-gf-edit": "final" };
const stored = (o, status = 200) => ({ status, body: json(o), headers: FINAL });
const routeTo = (layer) => ok({ ok: true, intent: "edit", layer, cost: 2 });
const RECEIPT = ok({ ok: true, job: "job-e", status: "queued", poll: "/api/site/edit/job-e" }, 202);

// THE EDIT ROUTE'S OWN SHAPES, as `escalate()`, `explain()`, `enqueueReply`,
// `editStopped` and the sweep write them (worker.js, builder/site-reconcile.mjs).
const HANDOFF = { ok: false, escalate: true, reason: "addon", cost: 0, field: "qr", layer: "addon" };
const HOP = { ok: false, escalate: true, reason: "no-data", cost: 0, layer: "text" };
const PAGE_HOP = { ok: false, escalate: true, reason: "needs-place", cost: 0, layer: "page", page: "/prices" };
const CLIMB = { ok: false, escalate: true, reason: "too-much-text", cost: 0 };
const SUCCESS = { ok: true, layer: "look", lanes: ["css"], layers: ["look"], cost: 1 };
const WORDED = { ok: true, layer: "text", applied: 1, cost: 1 };
const ADD_SUCCESS = { ok: true, cost: 12, kinds: ["qr"], added: [], changed: ["index.tsx"] };

const EDIT = "/api/site/fretwork-1/edit";
const ADD = "/api/site/fretwork-1/addon";
const POLLED = "/api/site/edit/job-e";
const REWRITE = "/api/site/react-revise";

// The edit's own not-knowing sentence (`unreadEditMsg`), unchanged by this round.
const UNREAD = "⚠️ I couldn’t read the answer to that change, so I can’t tell whether it went through. Check the preview before asking for it again.";
// The routing stop's and the add-on's own sentence.
const SIGNED_OUT = "⚠️ You’re signed out. Sign in and send that again.";

// What every stop owes the customer: the requests it expected and not one more
// — no rewrite, no add-on, no second edit — one sentence, and the send box free.
function assertStopped(o, trail, sentence = UNREAD) {
  assert.deepEqual(o.trail, trail, "the requests after the routing call");
  assert.ok(!o.trail.some((t) => t.endsWith(REWRITE) || t.endsWith("/api/site/react-build")), "a rewrite was started");
  assert.ok(!o.trail.some((t) => t.endsWith(ADD)), "the add-on was posted");
  assert.equal(o.trail.filter((t) => t === "POST " + EDIT).length, 1, "the edit was posted more than once");
  assert.deepEqual(o.said, [sentence], "the customer is told, in one sentence");
  assert.equal(o.busy, false, "the busy flag is cleared, so the next message can be sent");
  assert.equal(o.railRunning, false, "the rail is stopped");
  assert.equal(o.clock.started, 1, "the rail's clock started when the message was sent");
  assert.equal(o.clock.cleared, 1, "and was cleared when it stopped");
  assert.equal(o.ticker, null, "no clock left behind");
}

// ── THE OWNER'S TWO, STRAIGHT BACK AND AS A QUEUED JOB'S STORED REPLY ────────
const THE_TWO = [
  ["a 503 carrying the edit's add-on handoff", HANDOFF, 503],
  ['ok spelled "false"', { ok: "false" }, 200],
];
// ── AND THE SAME CLASS, WIDER ────────────────────────────────────────────────
const MALFORMED = [
  ["a 503 carrying a hop", HOP, 503],
  ["a 503 carrying a no-layer climb", CLIMB, 503],
  ['escalate "false" naming a layer', { ...HOP, escalate: "false" }, 200],
  ['escalate "false" naming the add-on', { ...HANDOFF, escalate: "false" }, 200],
  ['escalate "true" naming a layer', { ...HOP, escalate: "true" }, 200],
  ["escalate 1 naming a layer", { ...HOP, escalate: 1 }, 200],
  ["an escalate beside ok: true naming a layer", { ...HOP, ok: true }, 200],
  ["an escalate beside ok: true naming the add-on", { ...HANDOFF, ok: true }, 200],
  ["an escalate with no ok naming a layer", (({ ok: _, ...rest }) => rest)(HOP), 200],
  ["an escalate naming a layer the edit route does not have", { ...HOP, layer: "theme" }, 200],
  ["an escalate whose layer is a list", { ...HOP, layer: ["text"] }, 200],
  ["an escalate whose layer is null", { ...HOP, layer: null }, 200],
  ["an escalate whose layer is empty", { ...HOP, layer: "" }, 200],
  ["an escalate whose page is a number", { ...PAGE_HOP, page: 5 }, 200],
  ['a no-layer climb with ok spelled "false"', { ...CLIMB, ok: "false" }, 200],
  ['escalate "true" on a success', { ...SUCCESS, escalate: "true" }, 200],
  ['ok spelled "true"', { ...SUCCESS, ok: "true" }, 200],
  ["ok 1", { ...SUCCESS, ok: 1 }, 200],
  ['ok "false" carrying a sentence', { ok: "false", msg: "Could not do it." }, 200],
  ["a success at a 422 carrying a sentence", { ...SUCCESS, msg: "Updated the look." }, 422],
  ["a success at a 503 with no sentence", SUCCESS, 503],
  ["a list", [], 200],
  ["a bare {error} with no ok, at a 500", { error: "boom" }, 500],
];
for (const [what, body, status] of [...THE_TWO, ...MALFORMED]) {
  test("AN EDIT STOPS: " + what + ", straight back — nothing more is posted", async () => {
    const o = await drive({ answers: { route: [routeTo(body && body.reason === "no-data" ? "data" : "look")], edit: [ok(body, status)] } });
    assertStopped(o, ["POST " + EDIT]);
  });
  test("AN EDIT STOPS: " + what + ", as a queued job's stored reply — nothing more is posted", async () => {
    const o = await drive({ answers: { route: [routeTo(body && body.reason === "no-data" ? "data" : "look")], edit: [RECEIPT], poll: [stored(body, status)] } });
    assertStopped(o, ["POST " + EDIT, "GET " + POLLED]);
  });
}

// ── A RECEIPT IS TAKEN ONLY WHEN IT IS ONE ───────────────────────────────────
const BAD_RECEIPTS = [
  ['ok spelled "true"', { ok: "true", job: "job-e", status: "queued" }, 202],
  ["a job id that is a number", { ok: true, job: 7, status: "queued" }, 202],
  ["a receipt at a 503", { ok: true, job: "job-e", status: "queued" }, 503],
  ["an empty job id", { ok: true, job: "", status: "queued" }, 202],
  ["a receipt carrying a result", { ok: true, job: "job-e", result: { ok: true } }, 202],
  ["a receipt beside an escalate", { ok: true, job: "job-e", escalate: true, layer: "text" }, 202],
];
for (const [what, body, status] of BAD_RECEIPTS) {
  test("A RECEIPT THAT IS NOT ONE STOPS: " + what + " — nothing is watched or polled, and nothing is said as done", async () => {
    // The poll is scripted with a success, so a watch that wrongly started would
    // be recorded AND would print "✅" — two ways for this case to see it.
    const o = await drive({ answers: { route: [routeTo("look")], edit: [ok(body, status)], poll: [stored(SUCCESS)] } });
    assertStopped(o, ["POST " + EDIT]);
  });
}

test("A RECEIPT THAT IS NOT ONE STOPS: a job's own stored reply shaped as a receipt is not read as done", async () => {
  const o = await drive({ answers: { route: [routeTo("look")], edit: [RECEIPT], poll: [stored({ ok: true, job: "job-e", status: "queued", poll: POLLED })] } });
  assertStopped(o, ["POST " + EDIT, "GET " + POLLED]);
});

// ── SIGNED OUT ASKS FOR SIGN-IN ──────────────────────────────────────────────
test("A 401 ASKS FOR SIGN-IN, beside the gate, and starts nothing more — decided by the status, whatever the body", async () => {
  // It said "That edit didn't finish … refunded": true of a 401, and not the
  // next step. Read as a reply it would now be not knowing (a 401 has no `ok`),
  // so the status decides first, as it does for the add-on and the routing call.
  const o = await drive({ answers: { route: [routeTo("look")], edit: [ok({ error: "sign in required" }, 401)] } });
  assertStopped(o, ["POST " + EDIT], SIGNED_OUT);
  assert.ok(o.events.includes("sign-in gate"), "the sign-in gate is up");
  const html = await drive({ answers: { route: [routeTo("look")], edit: [{ status: 401, body: "<html>401</html>", type: "text/html" }] } });
  assertStopped(html, ["POST " + EDIT], SIGNED_OUT);
  // ONE SENTENCE ON THREE PATHS: the routing stop and the add-on say it too.
  assert.ok(CHAT.includes("'⚠️ You’re signed out. Sign in and send that again.'"), "the edit's sign-in sentence drifted from the others'");
  assert.match(CHAT, /if \(kind === 'signed-out'\) return '⚠️ You’re signed out\. Sign in and send that again\.';/, "the add-on's sign-in sentence drifted");
});

// ── A WATCH RESUMED AFTER A REFRESH READS WITH THE SAME RULE ─────────────────
async function resumed(storedReply) {
  // THE OPEN WORKSPACE'S OWN RECORD: the resume's `finish` writes the reply to
  // the site it was started for, by its id.
  const p = page({ answers: { poll: [storedReply] }, site: { ...LIVE, id: "origin-1" } });
  p.ctx.EditPoll.rememberJob("fretwork-1", "job-e", undefined, { ask: ASK, op: "edit", layer: "look", page: "" });
  assert.equal(p.ctx.resumeOpenSite(p.s), true, "the resume did not start a watch");
  await settle();
  return p.read();
}

test("A RESUMED WATCH STOPS: after a refresh, a stored 503 carrying the add-on handoff posts nothing", async () => {
  const o = await resumed(stored(HANDOFF, 503));
  assert.deepEqual(o.trail, ["GET " + POLLED], "the requests after the resume");
  assert.deepEqual(o.said, [UNREAD]);
  assert.equal(o.busy, false, "the busy flag is cleared");
});

test("CONTROL: a resumed watch whose stored reply is the valid handoff still posts the add-on once, with the ask the record kept", async () => {
  const o = await resumed(stored(HANDOFF));
  assert.deepEqual(o.trail, ["GET " + POLLED, "POST " + ADD]);
  assert.equal(o.reqs[1].body.instruction, ASK, "the add-on was not asked in the customer's own words");
});

// ── KEPT, AND ASSERTED SO ────────────────────────────────────────────────────
test("CONTROL: a success is applied and said, straight back and queued — the receipt and the duplicate receipt watched", async () => {
  for (const [edit, trail] of [
    [ok(SUCCESS), ["POST " + EDIT]],
    [RECEIPT, ["POST " + EDIT, "GET " + POLLED]],
    [ok({ ok: true, job: "job-e", status: "running", duplicate: true, poll: POLLED }), ["POST " + EDIT, "GET " + POLLED]],
  ]) {
    const o = await drive({ answers: { route: [routeTo("look")], edit: [edit], poll: [stored(SUCCESS)] } });
    assert.deepEqual(o.trail, trail);
    assert.deepEqual(o.said, ["✅ Updated the look."]);
    assert.ok(o.events.includes("credit refresh"), "a published change did not refresh the balance");
    assert.equal(o.busy, false);
  }
  // THE RECEIPT WAS REMEMBERED WITH ITS ASK, so a refresh can pick it up.
  const p = page({ answers: { route: [routeTo("look")], edit: [RECEIPT] } });
  await p.send();
  const rec = JSON.parse(p.read().store.get("gf.edit.watch.v1"))["fretwork-1"];
  assert.equal(rec.job, "job-e");
  assert.equal(rec.ask, ASK);
  assert.equal(rec.op, "edit");
});

test("CONTROL: the valid edit → add-on handoff posts the add-on once, in the customer's own words, straight back and queued", async () => {
  for (const [edit, poll, trail] of [
    [[ok(HANDOFF)], [], ["POST " + EDIT, "POST " + ADD]],
    [[RECEIPT], [stored(HANDOFF)], ["POST " + EDIT, "GET " + POLLED, "POST " + ADD]],
  ]) {
    const o = await drive({ answers: { route: [routeTo("look")], edit, poll, addon: [ok(ADD_SUCCESS)] } });
    assert.deepEqual(o.trail, trail);
    assert.equal(o.reqs.find((r) => r.kind === "addon").body.instruction, ASK);
    assert.equal(o.said.length, 1, "the handoff's addition was not said once");
    assert.match(o.said[0], /^✅/);
  }
});

test("CONTROL: a hop to a cheaper rung posts one edit there with the same ask, straight back and queued — and carries a named page", async () => {
  for (const [edit, poll, trail] of [
    [[ok(HOP), ok(WORDED)], [], ["POST " + EDIT, "POST " + EDIT]],
    [[RECEIPT, ok(WORDED)], [stored(HOP)], ["POST " + EDIT, "GET " + POLLED, "POST " + EDIT]],
  ]) {
    const o = await drive({ answers: { route: [routeTo("data")], edit, poll } });
    assert.deepEqual(o.trail, trail);
    const posts = o.reqs.filter((r) => r.kind === "edit");
    assert.deepEqual(posts.map((r) => r.body.layer), ["data", "text"]);
    assert.equal(posts[1].body.instruction, ASK);
    assert.deepEqual(o.said, ["✅ Updated the wording."]);
  }
  const paged = await drive({ answers: { route: [routeTo("picture")], edit: [ok(PAGE_HOP)] } });
  const second = paged.reqs.filter((r) => r.kind === "edit")[1];
  assert.equal(second.body.layer, "page");
  assert.equal(second.body.page, "/prices", "the hop did not carry the page the route named");
});

test("CONTROL: a classified climb still starts the rewrite, straight back and queued", async () => {
  // The edit route's no-layer escalates are classified (`builder/edit-failure.mjs`
  // — `text/too-much-text` is `up`), and the rewrite is what they ask for.
  for (const [edit, poll, trail] of [
    [[ok(CLIMB)], [], ["POST " + EDIT, "POST " + REWRITE]],
    [[RECEIPT], [stored(CLIMB)], ["POST " + EDIT, "GET " + POLLED, "POST " + REWRITE]],
  ]) {
    const o = await drive({ answers: { route: [routeTo("text")], edit, poll } });
    assert.deepEqual(o.trail, trail);
    assert.equal(o.reqs.find((r) => r.kind === "rewrite").body.instruction, ASK, "the rewrite is not of the customer's own ask");
  }
});

test("CONTROL: DUPLICATE EXECUTION — one hop, then up; and an escalate naming the layer it came from goes up", async () => {
  // The hop's own escalate does not hop again: `escalateAction` allows one.
  const twice = await drive({ answers: { route: [routeTo("data")], edit: [ok(HOP), ok(PAGE_HOP)] } });
  assert.deepEqual(twice.trail, ["POST " + EDIT, "POST " + EDIT, "POST " + REWRITE]);
  const same = await drive({ answers: { route: [routeTo("text")], edit: [ok({ ...HOP, layer: "text" })] } });
  assert.deepEqual(same.trail, ["POST " + EDIT, "POST " + REWRITE]);
});

test("CONTROL: refusals are shown in their own words, with the whole-request note, straight back and queued", async () => {
  const EXPLAIN = { ok: false, error: "no-page", cost: 0, unchanged: true, msg: "Your site has no /blog page, so there was nothing to take off." };
  const NOTE = " Nothing on your site changed, and this edit cost you nothing. Reading your message cost 2 credits.";
  for (const [edit, poll] of [[[ok(EXPLAIN, 422)], []], [[RECEIPT], [stored(EXPLAIN, 422)]]]) {
    const o = await drive({ answers: { route: [routeTo("page")], edit, poll } });
    // THE ROUTING REPLY RIDES BOTH PATHS, so both name what reading the message cost.
    assert.deepEqual(o.said, ["⚠️ " + EXPLAIN.msg + NOTE]);
    assert.equal(o.trail.filter((t) => t.startsWith("POST")).length, 1);
  }
  // THE ALL-REFUSED MERGE: every step's sentence, no top-level `msg`.
  const ALL = { ok: false, layer: "look", lanes: ["css", "shape"], cost: 0, unchanged: true,
    partial: [{ layer: "look", msg: "I couldn't find that colour." }, { layer: "page", msg: "The photo change was refused." }] };
  const all = await drive({ answers: { route: [routeTo("look")], edit: [ok(ALL, 422)] } });
  assert.deepEqual(all.said, ["⚠️ I couldn't find that colour. The photo change was refused." + NOTE]);
  // A refusal whose body carries a real `escalate: false` is a refusal.
  const f = await drive({ answers: { route: [routeTo("look")], edit: [ok({ ok: false, escalate: false, error: "x", msg: "No." }, 422)] } });
  assert.deepEqual(f.said, ["⚠️ No."]);
  // editStopped and the reconcile's refund, as stored: their own sentences.
  for (const [body, status] of [
    [{ ok: false, error: "stopped", phase: "build", cost: 0, refunded: 2, msg: "That change was stopped before it could publish." }, 503],
    [{ ok: false, error: "reconciled", kind: "never-activated", job: "job-e", refunded: 2, msg: "That change never went live, so I've refunded it." }, 409],
  ]) {
    const o = await drive({ answers: { route: [routeTo("look")], edit: [RECEIPT], poll: [stored(body, status)] } });
    assert.deepEqual(o.said, ["⚠️ " + body.msg]);
  }
});

test("CONTROL: a partial outcome is said beside the change that shipped, and escalate: false does not stop a success", async () => {
  const PARTIAL = { ...SUCCESS, partial: [{ layer: "page", msg: "The photo change was refused." }] };
  const o = await drive({ answers: { route: [routeTo("look")], edit: [ok(PARTIAL)] } });
  assert.deepEqual(o.said, ["✅ Updated the look. ⚠️ The photo change was refused."]);
  const f = await drive({ answers: { route: [routeTo("look")], edit: [ok({ ...SUCCESS, escalate: false })] } });
  assert.deepEqual(f.said, ["✅ Updated the look."]);
});

test("CONTROL: the sweep's recovered reply carries a job and is still a success, said in its own words", async () => {
  const o = await drive({ answers: { route: [routeTo("look")], edit: [RECEIPT], poll: [stored({ ok: true, recovered: true, reconciled: "committed", job: "job-e", cost: 2, build: null })] } });
  assert.deepEqual(o.said, ["✅ Your change was published — but the details of what it did were lost along the way. Reload the preview to see it."]);
});

test("CONTROL: needs-review blocks the site, and the next message is refused without an edit POST", async () => {
  const REVIEW = { ok: false, error: "needs-review", job: "job-r", msg: "Your last edit stopped part-way through publishing." };
  const p = page({ answers: { route: [routeTo("look"), routeTo("look")], edit: [ok(REVIEW, 409)] } });
  await p.send();
  await p.send("Make the header navy too");
  const o = p.read();
  assert.deepEqual(o.trail, ["POST " + EDIT], "the second message reached the edit route");
  assert.equal(o.said.length, 2);
  for (const t of o.said) assert.match(t, /^⚠️ That edit stopped while it was publishing/);
});

test("CONTROL: a dropped POST and an unreadable body say the not-knowing sentence, as they did", async () => {
  for (const edit of [{ reject: new TypeError("Failed to fetch") }, { status: 200, body: "<html>", type: "text/html" }]) {
    const o = await drive({ answers: { route: [routeTo("look")], edit: [edit] } });
    assertStopped(o, ["POST " + EDIT]);
  }
});

// ── ONE RULE, TWO READERS ─────────────────────────────────────────────────────
test("THE EDIT'S READER IS THE ADD-ON'S RULE, and the two differ only where an escalate names the add-on", async () => {
  const p = page({ answers: {} });
  const run = (fn, httpOk, body) => JSON.parse(JSON.stringify(p.ctx[fn](httpOk, body)));
  const shapes = [
    ...[...THE_TWO, ...MALFORMED, ...BAD_RECEIPTS].map(([, body, status]) => [status >= 200 && status < 300, body]),
    [true, HOP], [true, PAGE_HOP], [true, CLIMB], [true, SUCCESS], [true, { ok: true, job: "job-e" }],
    [false, { ok: false, error: "x", msg: "No." }], [true, null], [true, { ok: true, recovered: true, job: "job-e" }],
  ];
  let compared = 0;
  for (const [httpOk, body] of shapes) {
    if (body && body.layer === "addon" && body.escalate === true) continue;
    assert.deepEqual(run("readEditReply", httpOk, body), run("readAddonReply", httpOk, body), json(body));
    compared++;
  }
  assert.ok(compared >= 30, "the comparison covered " + compared + " shapes");
  // THE ONE DIFFERENCE: the handoff is a hop for an edit and not knowing for an add-on.
  assert.deepEqual(run("readEditReply", true, HANDOFF), { act: "hop", layer: "addon", page: "" });
  assert.deepEqual(run("readAddonReply", true, HANDOFF), { act: "unknown" });
});

test("THE READING IS THE READER'S: `editAnswer` reads no action field itself, and a paid step gets only what the reader checked", () => {
  const blank = (t) => t.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  const ans = blank(CHAT.slice(CHAT.indexOf("\nfunction editAnswer("), CHAT.indexOf("\nfunction applyEditResult(")));
  assert.ok(ans.includes("const said = readEditReply(httpOk, e);"), "editAnswer does not ask the reader — this census would read nothing");
  for (const f of ["ok", "escalate", "layer", "page", "job"]) {
    assert.ok(!new RegExp("\\be\\." + f + "\\b").test(ans), "editAnswer reads e." + f + " itself: " + (ans.match(new RegExp(".*\\be\\." + f + "\\b.*")) || [""])[0]);
  }
  assert.match(ans, /return escalatedEdit\(\{ layer: said\.layer, page: said\.page \}, o\);/, "the escalation handler is handed the raw reply");
  const edit = blank(CHAT.slice(CHAT.indexOf("\nfunction siteEdit("), CHAT.indexOf("\nfunction unreadEditMsg(")));
  const receipt = edit.indexOf("if (said.act === 'receipt') {");
  assert.ok(receipt > 0 && edit.indexOf("const said = readEditReply(r.ok, e);") < receipt, "siteEdit's receipt is not the reader's");
  assert.ok(!/\be\.job\b/.test(edit), "siteEdit watches or remembers a job the reader did not check");
  // AND THE 401 IS DECIDED BEFORE THE READER.
  assert.ok(edit.indexOf("if (r.status === 401)") > 0 && edit.indexOf("if (r.status === 401)") < edit.indexOf("const said = readEditReply(r.ok, e);"),
    "a 401 is read as a reply before its status is asked");
});
