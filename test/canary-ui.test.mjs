// THE CANARY'S UI MODE: its decisions, its stop conditions and its wiring.
//
// The driver itself was proven against the REAL gofarther.dev page code in a
// real Chromium, with every API answer supplied in the page (the 2026-09-26
// local runs: the happy path, a rehearsal, a refused session, a misrouted
// add-on and a job that never finished). CI has no browser for the unit suite,
// so here the same `runUi` is driven through a stand-in page that behaves like
// the workspace — which is what lets every stop condition be forced on demand.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import {
  UI_SCENARIOS, SESSION_KEY, WELCOME_SEEN_KEY, readUiScenario, composerReady, newReplies, budgetRefusal,
  imageFacts, recordableRequest, recordsBody, blocksPost, chainVerdict, runUi, describeUi,
  wallRefusal, requestVerdict, storedReplyVerdict, moneyVerdict, unpublishedVerdict, routeCostsOf,
  conditionProbe, dependencyVerdict, finalReplyOf, failureVerdict, refundedVerdict, sameTab,
  requestKeyOf, requestWall, requestJobsOf,
} from "../scripts/canary-ui.mjs";
import { additionRequestVerdict, additionReplyVerdict } from "../scripts/canary-additions.mjs";
import { probeBody } from "../scripts/canary-rows.mjs";
import { readAllow, bookingBodyVerdict, EVIDENCE_BOUNDARY } from "../scripts/canary-rules.mjs";
import { MAX_LOGO_BYTES } from "../builder/site-logo.mjs";
import { handleOwnerWrite } from "../site-owner.mjs";
import { ownerTable } from "./fixtures/owner-table.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const FIXTURE = "test/fixtures/ui-logo.png";
const FIXTURE_SHA = "2cc633d73b2d5ab38d29d94cf15c9ce67980a2401ee005f99e89e0781a4c3df5";
const UID = "22175f41-6fbf-49d7-b039-a65078a0141c";
const ORIGIN = "https://gofarther.dev";

// ── THE SCENARIO ────────────────────────────────────────────────────────────

test("a scenario is a name, refused whole, and tied to its own site", () => {
  const ok = readUiScenario(" 4A-Part-B ", "fold-lane-bakery");
  assert.equal(ok.ok, true);
  assert.equal(ok.name, "4a-part-b");
  assert.equal(ok.scenario, UI_SCENARIOS["4a-part-b"]);
  for (const bad of ["", "   ", null, undefined, 7, ["4a-part-b"]]) {
    assert.equal(readUiScenario(bad, "fold-lane-bakery").ok, false, `accepted ${JSON.stringify(bad)}`);
  }
  const unknown = readUiScenario("part-b", "fold-lane-bakery");
  assert.equal(unknown.ok, false);
  assert.match(unknown.msg, /4a-part-b/, "a refusal does not name the scenarios that exist");
  // The messages name that bakery's photograph and pages, so another site refuses.
  const other = readUiScenario("4a-part-b", "fretwork-1");
  assert.equal(other.ok, false);
  assert.match(other.msg, /fold-lane-bakery/);
  // And a name inherited from Object.prototype is not a scenario.
  assert.equal(readUiScenario("constructor", "fold-lane-bakery").ok, false);
});

test("Part B's scenario sends the checklist's three messages, and the file is the committed PNG", () => {
  const sc = UI_SCENARIOS["4a-part-b"];
  assert.equal(sc.site, "fold-lane-bakery");
  assert.deepEqual(sc.steps.map((s) => s.say), [
    "Use this picture as the logo.",
    "Show more of the top of the photo of the sourdough boule cooling.",
    "Move the starter page to /starter.",
  ]);
  assert.deepEqual(sc.steps.map((s) => s.attach || null), [FIXTURE, null, null], "only the logo message carries a file");
  assert.ok(Number.isFinite(sc.budget) && sc.budget > 0 && sc.budget <= 20, `budget ${sc.budget}`);
  assert.ok(Object.isFrozen(sc) && Object.isFrozen(sc.steps) && sc.steps.every(Object.isFrozen), "a scenario can be changed at run time");
  // The file: a real PNG, well under what the logo rung takes, and exactly the bytes on record.
  const bytes = fs.readFileSync(ROOT + FIXTURE);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "the fixture is not a PNG");
  assert.ok(bytes.length < MAX_LOGO_BYTES, `${bytes.length} bytes`);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), FIXTURE_SHA);
});

// ── THE PURE DECISIONS ──────────────────────────────────────────────────────

const IDLE = { busy: false, send: true, sendDisabled: false, stop: false, working: 0, textarea: true, disabled: false };

test("idle means every sign of it at once, and cannot-tell is not idle", () => {
  assert.equal(composerReady(IDLE), true);
  for (const [k, v] of [["busy", true], ["busy", null], ["send", false], ["sendDisabled", true], ["sendDisabled", null],
    ["stop", true], ["working", 1], ["textarea", false], ["disabled", true], ["disabled", null]]) {
    assert.equal(composerReady({ ...IDLE, [k]: v }), false, `ready with ${k}=${v}`);
  }
  assert.equal(composerReady(null), false);
  assert.equal(composerReady(undefined), false);
});

test("the replies are the assistant's messages after the send, never a Working row or the ask", () => {
  const msgs = [
    { who: "a", busy: false, text: "an older reply" },
    { who: "u", busy: false, text: "Use this picture as the logo." },
    { who: "a", busy: true, text: "Working" },
    { who: "a", busy: false, text: "✅ That's your logo in the header now, on every page." },
  ];
  assert.deepEqual(newReplies(1, msgs).map((m) => m.text), ["✅ That's your logo in the header now, on every page."]);
  assert.deepEqual(newReplies(4, msgs), []);
  assert.deepEqual(newReplies(0, null), []);
});

test("the budget refuses once it is spent, and refuses a balance it cannot read", () => {
  assert.equal(budgetRefusal({ start: 65, now: 60, budget: 15 }), "");
  assert.match(budgetRefusal({ start: 65, now: 50, budget: 15 }), /spent 15 of its 15/);
  assert.match(budgetRefusal({ start: 65, now: 40, budget: 15 }), /spent 25/);
  for (const [start, now] of [[65, -1], [-1, 60], [null, 60], [65, NaN], [65, undefined]]) {
    assert.match(budgetRefusal({ start, now, budget: 15 }), /could not be read/, `${start}/${now} read as known`);
  }
});

test("an attachment is recorded as its facts, and its bytes never enter the record", () => {
  const bytes = fs.readFileSync(ROOT + FIXTURE);
  const data = "data:image/png;base64," + bytes.toString("base64");
  assert.deepEqual(imageFacts({ name: "ui-logo.png", data }), { name: "ui-logo.png", type: "image/png", bytes: bytes.length, sha256: FIXTURE_SHA });
  assert.deepEqual(imageFacts({ name: "x", data: "not a data url" }), { name: "x", bytes: 0, sha256: "", type: "" });
  const rec = recordableRequest(JSON.stringify({ instruction: "Use this picture as the logo.", layer: "logo", images: [{ name: "ui-logo.png", data }] }));
  assert.equal(rec.instruction, "Use this picture as the logo.");
  assert.equal(rec.images[0].sha256, FIXTURE_SHA);
  assert.ok(!JSON.stringify(rec).includes(bytes.toString("base64").slice(0, 40)), "the image's bytes reached the record");
  assert.deepEqual(recordableRequest("{not json"), { unparsed: "{not json" });
  assert.equal(recordableRequest(""), null);
});

test("the wall refuses the work a scenario never asks for, and nothing else", () => {
  for (const p of ["/api/site/fold-lane-bakery/addon", "/api/site/react-build", "/api/site/build", "/api/site/react-revise"]) {
    assert.equal(blocksPost("POST", p), true, `${p} would be let through`);
    assert.equal(blocksPost("GET", p), false, `a GET of ${p} is refused`);
  }
  for (const p of ["/api/site/fold-lane-bakery/edit", "/api/site/route", "/api/site/fold-lane-bakery/versions", "/api/site/edit/abc"]) {
    assert.equal(blocksPost("POST", p), false, `${p} is refused`);
  }
});

test("only the calls that are the evidence keep their bodies", () => {
  assert.equal(recordsBody("POST", "/api/site/route"), true);
  assert.equal(recordsBody("POST", "/api/site/fold-lane-bakery/edit"), true);
  assert.equal(recordsBody("POST", "/api/site/fold-lane-bakery/addon"), true);
  assert.equal(recordsBody("GET", "/api/site/edit/0123abcd"), true);
  assert.equal(recordsBody("GET", "/api/site/list"), false);
  assert.equal(recordsBody("GET", "/api/credits"), false);
  assert.equal(recordsBody("GET", "/api/site/routes"), false);
});

test("the chain of publishes is checked link by link, and the after-read must be at its end", () => {
  const before = "01789969693841-xqi8vs";
  const pub = [
    { n: 1, job: "a", id: "01790500000000-aaaaaa", parent: before },
    { n: 2, job: "b", id: "01790500100000-bbbbbb", parent: "01790500000000-aaaaaa" },
    { n: 3, job: "c", id: "01790500200000-cccccc", parent: "01790500100000-bbbbbb" },
  ];
  const at = (id) => ({ "/": { version: id }, "/order": { version: id } });
  const ok = chainVerdict({ before, published: pub, wait: { kind: "match" }, after: at(pub[2].id) });
  assert.deepEqual({ verified: ok.verified, target: ok.target, links: ok.links }, { verified: true, target: pub[2].id, links: 3 });
  // A job that did not publish leaves the chain where it was: 1 and 3 still link.
  const skip = [pub[0], { ...pub[2], parent: pub[0].id }];
  assert.equal(chainVerdict({ before, published: skip, wait: { kind: "match" }, after: at(pub[2].id) }).verified, true);
  assert.equal(chainVerdict({ before, published: [pub[0], pub[2]], wait: { kind: "match" }, after: at(pub[2].id) }).why, "parent-mismatch");
  assert.equal(chainVerdict({ before: "", published: pub, wait: { kind: "match" }, after: at(pub[2].id) }).why, "before-unknown");
  assert.equal(chainVerdict({ before, published: pub, wait: { kind: "timeout" }, after: at(pub[2].id) }).why, "timeout");
  assert.equal(chainVerdict({ before, published: pub, wait: { kind: "match" }, after: {} }).why, "no-pages");
  const off = chainVerdict({ before, published: pub, wait: { kind: "match" }, after: { ...at(pub[2].id), "/visit": { version: pub[1].id } } });
  assert.deepEqual({ why: off.why, off: off.off }, { why: "page-version", off: ["/visit"] });
  // Nothing published: the after-read must see the before version.
  assert.equal(chainVerdict({ before, published: [], wait: { kind: "match" }, after: at(before) }).verified, true);
});

// ── THE DRIVER, THROUGH A STAND-IN WORKSPACE ────────────────────────────────
//
// It answers the two page functions by name, as the workspace would: the
// composer's state and the site card's id. A Send posts, the job's reply
// arrives a few polls later, and each call a real page would make is fed to
// the driver's own response listener, so what it records is what it records
// in the real run.

function standIn(opt = {}) {
  const calls = [];
  const slug = opt.slug || "fold-lane-bakery";
  const st = {
    signedIn: opt.signedIn !== false, uid: opt.uid || UID, gate: !!opt.gate, card: opt.card !== false,
    workspace: false, busy: false, messages: [], attached: 0, strip: 0, value: "", pending: null, step: 0, typed: 0,
    // THE DOCUMENT: a reload starts a new one, without the run's mark.
    mark: "", origin: 1_000_000.5,
    // A MESSAGE THE SERVER TOOK ON AS A REQUEST (2026-10-03): its script, and
    // what the page has shown of each request.
    req: null, requests: {}, views: 0, stops: 0,
  };
  // THE REQUEST'S OWN VIEW AS THE SERVER WOULD ANSWER IT, from its script.
  const viewOf = (q) => ({
    key: q.key, ended: q.ended, stop: q.stopped, state: q.ended ? (q.stopped ? "stopped" : q.approval ? "waiting" : "done") : q.approval ? "waiting" : "running",
    parts: [{ n: 0, words: q.say, status: q.ended ? (q.stopped ? "cancelled" : "done") : q.approval ? "approval" : "queued", route: q.route, ids: [q.job], jobs: q.ended && !q.stopped ? [q.job] : [], charged: 0, ...(q.addition ? { addition: true } : {}) }],
  });
  const listeners = {};
  const state = () => ({
    signedIn: st.signedIn, uid: st.uid, gate: st.gate, workspace: st.workspace,
    busy: st.busy, send: st.workspace && !st.busy, sendDisabled: st.workspace && !st.busy ? false : null,
    stop: st.workspace && st.busy, textarea: st.workspace, disabled: st.workspace ? false : null,
    value: st.value, working: st.busy ? 1 : 0, attached: st.attached, strip: st.strip,
    messages: st.messages.concat(st.busy ? [{ who: "a", busy: true, text: "Working" }] : []),
    requests: st.requests,
  });
  const respond = (method, path, status, req, res, headers = {}) => {
    const r = {
      request: () => ({ url: () => ORIGIN + path, method: () => method, postData: () => (req ? JSON.stringify(req) : null) }),
      status: () => status, headers: () => headers, text: async () => JSON.stringify(res),
    };
    return Promise.all((listeners.response || []).map((h) => h(r)));
  };
  const page = {
    on: (ev, h) => { (listeners[ev] = listeners[ev] || []).push(h); },
    goto: async (url) => { calls.push(`goto ${url}`); st.url = url; return { headers: () => ({ "x-site-version": "01790468089054-8btpep" }) }; },
    evaluate: async (fn, arg) => {
      if (fn.name === "cardIdInPage") return st.card ? `srv_${slug}` : "";
      // THE TAB'S MARK, kept on the page's own window until a reload.
      if (fn.name === "markTabInPage") { st.mark = arg; return { mark: st.mark, origin: st.origin, path: "/projects" }; }
      if (fn.name === "tabMarkInPage") return { mark: st.mark, origin: st.origin, path: "/projects" };
      // THE SITE'S OWN PAGE (a row scenario reads what a visitor sees there).
      if (fn.name === "shownListInPage") { calls.push(`shown ${arg}`); return opt.shown ? opt.shown(st.url) : []; }
      // A REQUEST'S VIEW, READ THROUGH THE PAGE'S SESSION: it ends after its polls, or once stopped.
      if (fn.name === "requestViewInPage") {
        const q = st.req;
        calls.push(`view ${arg.key}`);
        st.views++;
        if (!q || q.key !== arg.key) return { status: 404, ok: false, request: null };
        if (!q.ended && (q.stopped || (!q.approval && --q.polls <= 0))) q.ended = true;
        return { status: 200, ok: true, request: viewOf(q) };
      }
      if (fn.name === "stopRequestInPage") {
        calls.push(`stop ${arg.key}`);
        st.stops++;
        if (st.req && st.req.key === arg.key) st.req.stopped = true;
        return { status: 200, ok: true, state: "stopped" };
      }
      if (fn.name !== "readComposerInPage") throw new Error("unexpected page function " + fn.name);
      // THE PAGE SHOWS A REQUEST THAT ENDED: its part's own reply (read
      // through the job poll, under its final mark), then closes it.
      if (st.req && st.req.ended && !st.req.shown) {
        const q = st.req;
        q.shown = true;
        if (!q.stopped) {
          await respond("GET", `/api/site/edit/${q.job}`, 200, null, q.reply, { "x-gf-edit": "final" });
          st.messages.push({ who: "a", busy: false, text: q.reply.msg || "✅ Done." });
        } else st.messages.push({ who: "a", busy: false, text: "Stopped at your request." });
        st.requests[q.key] = { closed: true, ended: true };
      }
      if (st.pending && --st.pending.polls <= 0) {
        const p = st.pending; st.pending = null;
        if (!p.hang) {
          if (p.hop) {
            // THE ROUTE HANDED THE EDIT TO ANOTHER LAYER: the first job's
            // stored reply escalates, and the page files a second edit, as
            // `escalatedEdit` does, whose own job then answers.
            await respond("GET", `/api/site/edit/${p.job}`, 200, null, { ok: false, escalate: true, layer: "page", cost: 0 }, { "x-gf-edit": "final" });
            await respond("POST", `/api/site/${slug}/edit`, 202, { layer: "page" }, { ok: true, job: p.hop, status: "queued" });
            await respond("GET", `/api/site/edit/${p.hop}`, 200, null, p.reply, { "x-gf-edit": "final" });
          } else {
            // A FAILED JOB'S STORED REPLY comes back under its own status (the
            // data step's no-match is a 422), still marked final.
            await respond("GET", `/api/site/edit/${p.job}`, opt.finalStatus ? opt.finalStatus(p.n) : 200, null, p.reply, { "x-gf-edit": "final" });
          }
          // THE JOB'S OWN WRITE lands before its reply is on screen, as it does
          // live: the handler writes, then the stored reply is read.
          if (opt.onDone) opt.onDone(p.n);
          // WHAT THE APP DRAWS for that reply: a warning with the stored
          // sentence and the money for a refusal, the sentence for a success.
          st.messages.push({ who: "a", busy: false, text: opt.screen ? opt.screen(p.n, p.reply) : (p.reply.msg || "✅ Done.") });
          st.busy = false;
          // A PAGE THAT RELOADS ITSELF once a reply is out: a new document.
          if (opt.reloadAfter === p.n) { st.mark = ""; st.origin += 1; }
        } else st.pending = p;
      }
      return state();
    },
    click: async (sel) => {
      calls.push("click " + sel);
      if (sel.includes(".st-card-name")) st.workspace = true;
      if (sel === "#stSend") {
        const said = st.value;
        st.messages.push({ who: "u", busy: false, text: said });
        const n = st.step++;
        const images = st.attached ? [{ name: "ui-logo.png", data: "data:image/png;base64," + fs.readFileSync(ROOT + FIXTURE).toString("base64") }] : undefined;
        st.value = ""; st.attached = 0; st.strip = 0; st.busy = true;
        const job = String(n + 1).padStart(32, "0");
        // TAKEN ON AS A REQUEST: the routing answer names it, the page posts no
        // edit, draws the card, and follows it.
        if (opt.request) {
          const q = { ...opt.request(n), say: said, job, polls: 3, ended: false, stopped: false, shown: false };
          st.req = q;
          await respond("POST", "/api/site/route", 200, { message: said, attached: !!images, ...(images ? { images } : {}) },
            { ok: true, intent: q.route === "addon" ? "addon" : "edit", layer: q.route === "addon" ? "" : q.route, cost: 2, request: viewOf(q) });
          opt.onSend && opt.onSend(n);
          st.messages.push({ who: "a", busy: false, card: true, text: said + " Queued" });
          st.requests[q.key] = { closed: false, ended: false };
          st.busy = false;
          return;
        }
        await respond("POST", "/api/site/route", 200, { message: said, attached: !!images },
          opt.routed ? opt.routed(n) : { ok: true, intent: "edit", layer: ["logo", "picture", "page"][n], cost: 2 });
        await respond("POST", `/api/site/${slug}/edit`, 202, opt.editBody ? opt.editBody(n, said) : { layer: "x", images }, { ok: true, job, status: "queued" });
        opt.onSend && opt.onSend(n);
        st.pending = { n, job, polls: 2, hang: opt.hangAt === n, hop: opt.hopAt === n ? "9".repeat(32) : "", reply: opt.reply ? opt.reply(n) : { ok: true, msg: `reply ${n + 1}` } };
      }
    },
    fill: async (sel, v) => {
      calls.push(`fill ${v}`);
      // A BOX THAT STOPS TAKING TYPING after a reply (a redraw that resets it).
      if (opt.eatsTypingAfter !== undefined && st.step > opt.eatsTypingAfter && !st.busy) return;
      st.value = v;
      // A PAGE THAT GOES BUSY AGAIN on its own once a reply is out (a resumed
      // watch, say): the next message must not be sent into it.
      if (v === "" && opt.busyAfter !== undefined && st.step === opt.busyAfter + 1 && !st.pending) st.busy = true;
    },
    waitForEvent: async (ev) => {
      calls.push("wait " + ev);
      return { setFiles: async () => { if (!opt.noLand) { st.attached = 1; st.strip = 1; } } };
    },
    screenshot: async () => {},
  };
  const inits = [], routes = [];
  const context = {
    route: async (pattern, handler) => { routes.push({ pattern, handler }); },
    addInitScript: async (fn, arg) => { inits.push({ fn, arg }); },
    newPage: async () => page,
    close: async () => { calls.push("close context"); },
  };
  // THE VISITOR'S TAB (the rules test's booking) is a context of its own: the
  // first context is the app's, and a scenario that books gets its visitor
  // stand-in for every context after that.
  let contexts = 0;
  const contextOptions = [];
  const browser = {
    newContext: async (o) => { contextOptions.push(o); return contexts++ > 0 && opt.visitor ? opt.visitor() : context; },
    close: async () => { calls.push("close"); },
  };
  return { st, calls, inits, routes, contextOptions, launch: async () => browser };
}

const SESSION = { access_token: "a", refresh_token: "r", expires_at: 2_000_000_000, user: { id: UID, email: "o@example.com" } };
const drive = (h, over = {}) => runUi({
  base: ORIGIN, session: SESSION, slug: "fold-lane-bakery", scenario: UI_SCENARIOS["4a-part-b"],
  spend: true, balanceNow: async () => 65, evid: "", launch: h.launch, log: () => {},
  openMs: 50, attachMs: 50, startMs: 50, stepMs: 60, pollMs: 1, settleMs: 0, ...over,
});

test("the paid path sends each message after the last reply, and records what the screen showed", async () => {
  const h = standIn();
  const rec = await drive(h);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  assert.equal(rec.sent, 3);
  assert.deepEqual(rec.steps.map((s) => s.reply), ["reply 1", "reply 2", "reply 3"]);
  assert.deepEqual(rec.steps.map((s) => s.usable), [true, true, true]);
  assert.deepEqual(rec.steps.map((s) => s.job), ["1".padStart(32, "0"), "2".padStart(32, "0"), "3".padStart(32, "0")]);
  // The file went through the + button's chooser, before the first Send, and only then.
  const sends = h.calls.map((c, i) => [c, i]).filter(([c]) => c === "click #stSend").map(([, i]) => i);
  const plus = h.calls.indexOf("click #stPlus");
  assert.ok(plus >= 0 && plus < sends[0], "the file was not attached before the first Send");
  assert.equal(h.calls.filter((c) => c === "click #stPlus").length, 1, "the file was attached more than once");
  // The record holds the file's facts on the edit request, never its bytes.
  const post = rec.steps[0].network.find((e) => e.method === "POST" && /\/edit$/.test(e.path));
  assert.equal(post.req.images[0].sha256, FIXTURE_SHA);
  assert.equal(rec.steps[0].file.sha256, FIXTURE_SHA);
  assert.ok(rec.steps[1].network.every((e) => !(e.req && e.req.images)), "a file travelled with a message that had none");
  // Each Send waited for the previous reply: the reply to message n was recorded before Send n+1.
  assert.ok(h.calls.at(-1) === "close", "the browser was left open");
  assert.match(describeUi(rec), /usable again/);
});

test("without spend it attaches and types the first message, and sends nothing", async () => {
  const h = standIn();
  const rec = await drive(h, { spend: false });
  assert.equal(rec.sent, 0);
  assert.equal(rec.stopped.at, "rehearsal");
  assert.ok(!h.calls.includes("click #stSend"), "a rehearsal pressed Send");
  assert.ok(h.calls.includes("click #stPlus") && h.calls.includes("fill Use this picture as the logo."));
  assert.equal(rec.network.length, 0, "a rehearsal made an API call");
});

test("a refused session, another account, or a missing card stops before anything is typed", async () => {
  for (const [opt, at] of [[{ gate: true }, /asked to sign in/], [{ signedIn: false }, /did not open signed in/],
    [{ uid: "someone-else" }, /not the canary's account/], [{ card: false }, /never showed/]]) {
    const h = standIn(opt);
    const rec = await drive(h);
    assert.equal(rec.stopped && rec.stopped.at, "open", JSON.stringify(opt));
    assert.match(rec.stopped.msg, at);
    assert.equal(rec.sent, 0);
    assert.ok(!h.calls.some((c) => c.startsWith("fill") || c === "click #stSend"), `typed or sent with ${JSON.stringify(opt)}`);
  }
});

test("a file that never lands stops the message before it is sent", async () => {
  const h = standIn({ noLand: true });
  const rec = await drive(h);
  assert.equal(rec.stopped.at, "step 1");
  assert.match(rec.stopped.msg, /never landed/);
  assert.equal(rec.sent, 0);
  assert.ok(!h.calls.includes("click #stSend"));
});

test("the budget, and a balance it cannot read, stop before the next Send", async () => {
  let bal = 65;
  const h = standIn({ onSend: () => { bal -= 8; } });
  const rec = await drive(h, { balanceNow: async () => bal });
  // 65 -> 57 after message 1 (8 spent), 49 after message 2 (16 spent >= 15): message 3 is never sent.
  assert.equal(rec.sent, 2);
  assert.equal(rec.stopped.at, "step 3");
  assert.match(rec.stopped.msg, /spent 16 of its 15-credit budget/);
  const blind = standIn();
  const rec2 = await drive(blind, { balanceNow: async () => -1 });
  assert.equal(rec2.sent, 0);
  assert.match(rec2.stopped.msg, /could not be read/);
  assert.ok(!blind.calls.includes("click #stSend"));
});

test("a reply that never comes stops the scenario, and nothing more is sent", async () => {
  const h = standIn({ hangAt: 1 });
  const rec = await drive(h);
  assert.equal(rec.sent, 2);
  assert.equal(rec.stopped.at, "step 2");
  assert.match(rec.stopped.msg, /outcome is unknown/);
  assert.equal(h.calls.filter((c) => c === "click #stSend").length, 2, "a message was sent after one that never answered");
  assert.equal(rec.steps[1].reply, "");
});

test("a page that goes busy again after a reply gets nothing more sent into it", async () => {
  const h = standIn({ busyAfter: 0 });
  const rec = await drive(h);
  assert.equal(rec.sent, 1);
  assert.equal(rec.stopped.at, "step 2");
  assert.match(rec.stopped.msg, /not idle/);
  assert.equal(h.calls.filter((c) => c === "click #stSend").length, 1, "a message was sent into a busy page");
});

test("a box that stops taking typing is recorded as not usable, and the next message is not sent", async () => {
  const h = standIn({ eatsTypingAfter: 0 });
  const rec = await drive(h);
  assert.equal(rec.steps[0].usable, false, "a box that ate the typing was recorded as usable");
  assert.match(describeUi(rec), /NOT usable/);
  assert.equal(rec.sent, 1);
  assert.equal(rec.stopped.at, "step 2");
  assert.match(rec.stopped.msg, /words did not land/);
});

test("a message the route hands to another layer is followed through both of its jobs", async () => {
  const h = standIn({ hopAt: 1 });
  const rec = await drive(h);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  assert.deepEqual(rec.steps[1].jobs, ["2".padStart(32, "0"), "9".repeat(32)], "the hand-off's own job was not recorded");
  assert.equal(rec.steps[1].job, "2".padStart(32, "0"));
  assert.deepEqual(rec.steps.map((s) => s.jobs.length), [1, 2, 1]);
  assert.equal(rec.steps[1].reply, "reply 2");
  const told = describeUi(rec);
  assert.match(told, /layer page job 9{32}/, "the account does not show the hand-off's request");
});

test("the owner's session is planted for the app's own origin and no other", async () => {
  const h = standIn();
  await drive(h, { spend: false });
  assert.equal(h.inits.length, 1);
  const { fn, arg } = h.inits[0];
  assert.equal(arg.o, ORIGIN);
  assert.equal(arg.key, SESSION_KEY);
  const planted = JSON.parse(arg.value);
  assert.deepEqual(Object.keys(planted).sort(), ["access_token", "expires_at", "refresh_token", "user"]);
  assert.equal(planted.expires_at, SESSION.expires_at * 1000, "auth.js keeps milliseconds");
  // Run the init script itself in both origins: the site's own frame must get nothing.
  const run = (origin, have = null, seen = null) => {
    const store = new Map([...(have ? [[SESSION_KEY, have]] : []), ...(seen ? [[WELCOME_SEEN_KEY, seen]] : [])]);
    const saved = ["location", "localStorage"].map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
    const put = (k, value) => Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
    put("location", { origin });
    put("localStorage", { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
    try { fn(arg); } finally {
      for (const [k, d] of saved) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
    }
    return { session: store.get(SESSION_KEY) ?? null, seen: store.get(WELCOME_SEEN_KEY) ?? null, keys: [...store.keys()].sort() };
  };
  assert.equal(run(ORIGIN).session, arg.value);
  assert.deepEqual(run("https://fold-lane-bakery.gofarther.app").keys, [], "the customer site's origin was written to");
  assert.equal(run(ORIGIN, "rotated").session, "rotated", "a session the app already rotated was overwritten");
  // THE FIRST-RUN GREETING IS MARKED AS SEEN, in the app's origin only, and a
  // value the page already holds is kept. The key is the app's own.
  assert.equal(arg.seen, WELCOME_SEEN_KEY);
  assert.equal(run(ORIGIN).seen, "1");
  assert.equal(run(ORIGIN, null, "kept").seen, "kept");
  assert.deepEqual(run(ORIGIN).keys, [SESSION_KEY, WELCOME_SEEN_KEY].sort(), "the plant wrote something else too");
  const chat = fs.readFileSync(ROOT + "public/chat.js", "utf8");
  const key = (chat.match(/const WELCOME_KEY = '([^']+)';/) || [])[1];
  assert.equal(key, WELCOME_SEEN_KEY, "the app's welcome key is not the one the canary marks");
  // And the greeting is still what it was: the modal that covers the page, shown only without that key.
  assert.match(chat, /function maybeShowWelcome\(balance\) \{\n\s+try \{\n\s+if \(localStorage\.getItem\(WELCOME_KEY\)\) return;/);
});

test("the wall aborts the work a scenario never asks for, and passes everything else on", async () => {
  const h = standIn();
  const rec = await drive(h, { spend: false });
  const wall = h.routes.at(-1);
  assert.ok(wall.pattern(new URL(ORIGIN + "/api/site/fold-lane-bakery/addon")), "the wall does not look at the add-on route");
  assert.ok(!wall.pattern(new URL("https://fold-lane-bakery.gofarther.app/api/site/x/addon")), "the wall reaches another origin");
  const act = async (method, path) => {
    let did = "";
    await wall.handler({ request: () => ({ method: () => method, url: () => ORIGIN + path }), abort: async () => { did = "abort"; }, fallback: async () => { did = "fallback"; } });
    return did;
  };
  assert.equal(await act("POST", "/api/site/fold-lane-bakery/addon"), "abort");
  assert.equal(await act("POST", "/api/site/react-revise"), "abort");
  assert.equal(await act("POST", "/api/site/fold-lane-bakery/edit"), "fallback");
  assert.equal(await act("GET", "/api/site/fold-lane-bakery/addon"), "fallback");
  assert.deepEqual(rec.blocked.map((b) => b.path), ["/api/site/fold-lane-bakery/addon", "/api/site/react-revise"]);
});

// ── TEST 4b's D1: ONE ROW, THROUGH THE REAL APP, AND BACK ──────────────────

const D1 = UI_SCENARIOS["4b-d1-price"];
const D1_BACK = UI_SCENARIOS["4b-d1-restore"];
const D1_SAY = "In today's bake list, change the Sea Salt Focaccia's price to £4.60.";
const D1_REPLY = { ok: true, layer: "data", applied: [{ table: "loaves", id: 6, columns: ["price"] }], failed: 0, cost: 1, msg: "✅ Updated one entry in loaves." };
const SITE = "https://fold-lane-bakery.gofarther.app";

test("D1 is one message, tied to the bakery, with a data-only wall and the proposal's record", () => {
  assert.deepEqual(D1.steps.map((s) => s.say), [D1_SAY]);
  assert.equal(D1_SAY.length, 68);
  assert.equal(Buffer.byteLength(D1_SAY), 69);
  assert.equal(crypto.createHash("sha256").update(D1_SAY).digest("hex").slice(0, 16), "550cf87497ef7a8f", "the words are not the proposal's");
  assert.equal(D1.site, "fold-lane-bakery");
  assert.deepEqual([...D1.layers], ["data"]);
  assert.equal(D1.publishes, 0);
  assert.equal(D1.reply, "✅ Updated one entry in loaves.");
  assert.deepEqual(JSON.parse(JSON.stringify(D1.applied)), [{ table: "loaves", id: 6, columns: ["price"] }]);
  assert.ok(D1.budget >= 3 && D1.budget <= 6, `budget ${D1.budget}`);
  const row = D1.row;
  assert.deepEqual({ table: row.table, id: row.id, match: { ...row.match }, field: row.field, from: row.from, to: row.to },
    { table: "loaves", id: 6, match: { name: "Sea Salt Focaccia" }, field: "price", from: "4.5", to: "4.6" });
  assert.deepEqual({ ...row.shown }, { path: "/order", sel: 'input[type="radio"]', before: "£4.50", after: "£4.60" });
  // The record is the proposal's visitor read, ids 1-6, the focaccia at 4.5.
  assert.deepEqual(row.record.map((r) => [r.id, r.name, r.price]), [[1, "Country White", 4.8], [2, "Dark Rye", 5.2],
    [3, "Seeded Wholemeal", 5.4], [4, "Olive & Rosemary", 5.8], [5, "Walnut Levain", 6], [6, "Sea Salt Focaccia", 4.5]]);
  assert.ok(row.record.every((r) => r.photo === null), "a recorded photo is not null");
  for (const o of [D1, D1.steps, D1.layers, D1.row, D1.row.match, D1.row.shown, D1.row.record, ...D1.row.record, D1_BACK, D1_BACK.steps]) {
    assert.ok(Object.isFrozen(o), "a scenario can be changed at run time");
  }
  // The recovery on its own sends nothing, on the same row.
  assert.equal(D1_BACK.row, D1.row, "the recovery is not about the row D1 changes");
  assert.deepEqual([...D1_BACK.steps], []);
  assert.deepEqual([...D1_BACK.layers], []);
  for (const name of ["4b-d1-price", "4b-d1-restore"]) {
    assert.equal(readUiScenario(name, "fold-lane-bakery").ok, true);
    assert.equal(readUiScenario(name, "fretwork-1").ok, false, `${name} runs against another site`);
  }
});

test("the wall lets out the routing call and one data edit of this site, and refuses every other write", () => {
  const edit = (layer, slug = "fold-lane-bakery") => ({ method: "POST", pathname: `/api/site/${slug}/edit`, body: JSON.stringify({ layer, instruction: D1_SAY }), scenario: D1 });
  assert.equal(wallRefusal(edit("data")), "");
  for (const l of ["text", "page", "rules", "look", "picture", "logo", "nav", "rename", "", "addon"]) {
    assert.match(wallRefusal(edit(l)), /does not allow/, `an edit at ${l || "(blank)"} would leave the page`);
  }
  assert.match(wallRefusal(edit("data", "fretwork-1")), /not this scenario's site/);
  for (const body of [null, "", "{not json", JSON.stringify({ instruction: "x" }), JSON.stringify({ layer: 7 }), JSON.stringify(["data"])]) {
    assert.match(wallRefusal({ method: "POST", pathname: "/api/site/fold-lane-bakery/edit", body, scenario: D1 }), /cannot be read/, `body ${body}`);
  }
  assert.equal(wallRefusal({ method: "POST", pathname: "/api/site/route", body: "{}", scenario: D1 }), "");
  for (const [method, pathname] of [["GET", "/api/site/list"], ["GET", "/api/site/edit/abc"], ["HEAD", "/api/credits"], ["GET", "/api/site/fold-lane-bakery/rows/loaves"]]) {
    assert.equal(wallRefusal({ method, pathname, scenario: D1 }), "", `${method} ${pathname} refused`);
  }
  for (const [method, pathname] of [["POST", "/api/site/fold-lane-bakery/addon"], ["POST", "/api/site/react-revise"], ["POST", "/api/site/react-build"],
    ["PATCH", "/api/site/fold-lane-bakery/rows/loaves/6"], ["POST", "/api/site/fold-lane-bakery/rows/loaves"], ["DELETE", "/api/site/fold-lane-bakery/rows/loaves/6"],
    ["DELETE", "/api/site/edit/abc"], ["POST", "/api/site/fold-lane-bakery/jobs"], ["POST", "/api/agent/send"], ["PUT", "/api/site/x"]]) {
    assert.notEqual(wallRefusal({ method, pathname, body: "{}", scenario: D1 }), "", `${method} ${pathname} would leave the page`);
  }
  // The recovery scenario sends no message at all.
  assert.match(wallRefusal({ method: "POST", pathname: "/api/site/route", body: "{}", scenario: D1_BACK }), /never sends/);
  // Part B's wall is the one it always had: only the work none of them asks for.
  const b = UI_SCENARIOS["4a-part-b"];
  for (const [method, pathname] of [["POST", "/api/site/fold-lane-bakery/edit"], ["PATCH", "/api/site/fold-lane-bakery/rows/loaves/6"], ["DELETE", "/api/site/edit/abc"]]) {
    assert.equal(wallRefusal({ method, pathname, body: JSON.stringify({ layer: "page" }), scenario: b }), "", `Part B's wall moved for ${method} ${pathname}`);
  }
  assert.notEqual(wallRefusal({ method: "POST", pathname: "/api/site/fold-lane-bakery/addon", scenario: b }), "");
});

test("what left the page is judged from the page's own record, word for word and layer by layer", () => {
  const step = (over = {}) => ({
    say: D1_SAY,
    network: [
      { method: "POST", path: "/api/site/route", status: 200, req: { message: D1_SAY }, res: { ok: true, intent: "edit", layer: "data", cost: 2 } },
      { method: "POST", path: "/api/site/fold-lane-bakery/edit", status: 202, req: { layer: "data", instruction: D1_SAY }, res: { ok: true, job: "a".repeat(32) } },
      { method: "GET", path: "/api/site/edit/" + "a".repeat(32), status: 200, final: true, res: D1_REPLY },
      ...(over.extra || []),
    ].map((e) => (over.map ? over.map(e) : e)),
  });
  const ok = requestVerdict(step(), D1);
  assert.deepEqual({ ok: ok.ok, layer: ok.routedLayer, cost: ok.routeCost, edits: ok.edits }, { ok: true, layer: "data", cost: 2, edits: 1 });
  const bad = [
    step({ map: (e) => (e.path === "/api/site/route" ? { ...e, req: { message: D1_SAY + " " } } : e) }),
    step({ map: (e) => (e.path === "/api/site/route" ? { ...e, res: { ...e.res, layer: "text" } } : e) }),
    step({ map: (e) => (e.path === "/api/site/route" ? { ...e, res: { ...e.res, intent: "addon" } } : e) }),
    step({ map: (e) => (/\/edit$/.test(e.path) ? { ...e, req: { layer: "data", instruction: "something else" } } : e) }),
    step({ extra: [{ method: "POST", path: "/api/site/fold-lane-bakery/edit", status: 202, req: { layer: "data", instruction: D1_SAY }, res: {} }] }),
    step({ extra: [{ method: "POST", path: "/api/site/route", status: 200, req: { message: D1_SAY }, res: { intent: "edit", layer: "data" } }] }),
    { say: D1_SAY, network: [] },
  ];
  for (const [i, s2] of bad.entries()) assert.equal(requestVerdict(s2, D1).ok, false, `case ${i} passed`);
  // The job's own stored reply.
  assert.equal(storedReplyVerdict(step(), D1).ok, true);
  for (const [res, why] of [[{ ...D1_REPLY, ok: false }, /not ok/], [{ ...D1_REPLY, layer: "text" }, /text layer/],
    [{ ...D1_REPLY, applied: [{ table: "loaves", id: 6, columns: ["price", "name"] }] }, /other rows/],
    [{ ...D1_REPLY, applied: [{ table: "loaves", id: 5, columns: ["price"] }] }, /other rows/],
    [{ ...D1_REPLY, failed: 1 }, /failed/], [{ ...D1_REPLY, files: 24 }, /compiled/], [{ ...D1_REPLY, sort: { table: "loaves" } }, /reordered/]]) {
    const got = storedReplyVerdict(step({ map: (e) => (e.final ? { ...e, res } : e) }), D1);
    assert.equal(got.ok, false, JSON.stringify(res));
    assert.match(got.why, why);
  }
  assert.match(storedReplyVerdict({ network: [] }, D1).why, /no stored reply/);
  assert.deepEqual(routeCostsOf([step(), { network: [{ method: "POST", path: "/api/site/route", res: "<html>" }] }]), [2, undefined]);
});

test("the money closes only when the balance's move is the routing costs plus what each job's row and ledger both say", () => {
  const job = (over = {}) => ({ job: "j", row: { billing: "finalized", cost: 1, ...over.row }, ledgerRead: { ok: true }, ledger: over.ledger || [{ delta: -1, kind: "reserve" }] });
  assert.deepEqual(moneyVerdict({ start: 59, end: 56, routeCosts: [2], jobs: [job()] }), { ok: true, why: "", spent: 3, routing: 2, edits: 1 });
  const bad = [
    [{ start: 59, end: 57, routeCosts: [2], jobs: [job()] }, /moved 2/],
    [{ start: 59, end: 56, routeCosts: [2], jobs: [job({ ledger: [{ delta: -1 }, { delta: 1 }] })] }, /returned 1/],
    [{ start: 59, end: 56, routeCosts: [2], jobs: [job({ ledger: [] })] }, /took 0/],
    [{ start: 59, end: 56, routeCosts: [2], jobs: [{ ...job(), ledgerRead: { ok: false } }] }, /could not be read/],
    [{ start: 59, end: 56, routeCosts: [2], jobs: [job({ row: { billing: "reserved" } })] }, /not settled/],
    // A REFUNDED JOB whose reserve never came back is refused as exactly that.
    [{ start: 59, end: 56, routeCosts: [2], jobs: [job({ row: { billing: "refunded" } })] }, /refunded; the ledger took 1 and returned 0/],
    // A JOB THAT NEVER REACHED A PAID STEP (`none`, 2026-10-02) takes no
    // ledger row, and one that does is a finding — as for an exempt one.
    [{ start: 59, end: 56, routeCosts: [2], jobs: [job({ row: { billing: "none" } })] }, /none and the ledger names it/],
    [{ start: 59, end: 56, routeCosts: [2], jobs: [job({ row: { billing: "lost" } })] }, /not settled/],
    [{ start: 59, end: 56, routeCosts: [2], jobs: [job({ row: { cost: "1" } })] }, /whole number/],
    [{ start: 59, end: 56, routeCosts: [undefined], jobs: [job()] }, /not a number/],
    [{ start: -1, end: 56, routeCosts: [2], jobs: [job()] }, /could not be read/],
    [{ start: 59, end: null, routeCosts: [2], jobs: [job()] }, /could not be read/],
    [{ start: 59, end: 56, routeCosts: [2], jobs: [{ job: "j" }] }, /no readable row/],
    [{ start: 59, end: 56, routeCosts: [2], jobs: [job({ ledger: [{ delta: "x" }] })] }, /no amount/],
  ];
  for (const [args, why] of bad) {
    const got = moneyVerdict(args);
    assert.equal(got.ok, false, JSON.stringify(args));
    assert.match(got.why, why);
  }
  // An exempt job takes no ledger row, and one that does is a finding.
  assert.equal(moneyVerdict({ start: 59, end: 57, routeCosts: [2], jobs: [{ job: "e", row: { billing: "exempt", cost: 0 }, ledgerRead: { ok: true }, ledger: [] }] }).ok, true);
  // So does the add-on's hand-over: no reserve, no row, nothing spent beside
  // the menu editor's own job.
  assert.deepEqual(moneyVerdict({ start: 59, end: 55, routeCosts: [2], jobs: [{ job: "h", row: { billing: "none", cost: 0 }, ledgerRead: { ok: true }, ledger: [] }, job({ row: { cost: 2 }, ledger: [{ delta: -2 }] })] }),
    { ok: true, why: "", spent: 4, routing: 2, edits: 2 });
  // A REFUNDED JOB (a failed edit, Test 9) charged nothing: its reserve and
  // its refund net to nothing, and the edit adds nothing to the spend.
  const back = job({ row: { billing: "refunded", cost: 1 }, ledger: [{ delta: -1 }, { delta: 1 }] });
  assert.deepEqual(moneyVerdict({ start: 59, end: 54, routeCosts: [2, 2], jobs: [back, job()] }), { ok: true, why: "", spent: 5, routing: 4, edits: 1 });
  assert.match(moneyVerdict({ start: 59, end: 53, routeCosts: [2, 2], jobs: [back, job()] }).why, /moved 6; routing 4 \+ edits 1 is 5/);
  assert.match(moneyVerdict({ start: 59, end: 57, routeCosts: [2], jobs: [{ job: "e", row: { billing: "exempt", cost: 0 }, ledgerRead: { ok: true }, ledger: [{ delta: -1 }] }] }).why, /exempt/);
});

test("nothing published is three readers agreeing, never one", () => {
  const row = { publish_started_at: null, published_at: null };
  const chain = { verified: true, why: "verified", target: "v", links: 0 };
  assert.deepEqual(unpublishedVerdict({ published: [], jobs: [{ job: "j", row }], chain }), { ok: true, why: "" });
  assert.match(unpublishedVerdict({ published: [{ id: "v2" }], jobs: [{ job: "j", row }], chain }).why, /names 1 build/);
  assert.match(unpublishedVerdict({ published: [], jobs: [{ job: "j", row: { ...row, publish_started_at: "t" } }], chain }).why, /publish began/);
  assert.match(unpublishedVerdict({ published: [], jobs: [{ job: "j", row: { ...row, published_at: "t" } }], chain }).why, /publish began/);
  assert.match(unpublishedVerdict({ published: [], jobs: [{ job: "j" }], chain }).why, /no readable row/);
  assert.match(unpublishedVerdict({ published: [], jobs: [{ job: "j", row }], chain: { verified: false, why: "page-version" } }).why, /page-version/);
  assert.match(unpublishedVerdict({ published: [], jobs: [{ job: "j", row }], chain: { ...chain, links: 1 } }).why, /verified/);
  assert.match(unpublishedVerdict({ published: [], jobs: [{ job: "j", row }], chain: null }).why, /not taken/);
});

// A supplied bakery: the owner route answers the price as a string (NUMERIC,
// as the database driver does), the visitor route as the site's JSON, and the
// order page draws one card per loaf, by name. Its PATCH is the REAL owner
// route (site-owner.mjs) over the same rows, so the recovery's condition is
// judged by the route's own UPDATE. Every read and write is logged into the
// stand-in's own call list, so its order against the Send is visible.
// `oldWorker` answers a conditional write as the route did before the form.
function bakery(calls, rows = UI_SCENARIOS["4b-d1-price"].row.record, { oldWorker = false } = {}) {
  const db = { rows: JSON.parse(JSON.stringify(rows)), patches: [], ownerReads: 0, onOwnerRead: null };
  db.t = ownerTable({ types: { name: "text", description: "text", price: "numeric", photo: "text", created_at: "text" }, rows: db.rows, inPlace: true });
  db.owner = async () => {
    calls.push("owner read");
    db.ownerReads++;
    const res = { status: 200, json: { rows: db.rows.map((r) => ({ ...r, price: String(r.price) })) } };
    if (db.onOwnerRead) db.onOwnerRead(db.ownerReads, db);
    return res;
  };
  db.pub = async () => { calls.push("visitor read"); return { status: 200, text: JSON.stringify(db.rows) }; };
  db.patch = async (id, body) => {
    calls.push(`patch ${id} ${JSON.stringify(body)}`);
    db.patches.push({ id, body });
    if (oldWorker) return { status: 400, json: { error: "nothing to update" } };
    const r = await handleOwnerWrite(db.t.deps, { slug: "fold-lane-bakery", table: "loaves", uid: "owner-1", method: "PATCH", rowId: String(id), body });
    return { status: r.status, json: r.body };
  };
  db.lines = () => [...db.rows].sort((a, b) => a.name.localeCompare(b.name)).map((r) => `${r.name} £${Number(r.price).toFixed(2)} · ${r.description}`);
  db.focaccia = () => db.rows.find((r) => r.id === 6);
  return db;
}

function d1Harness(opt = {}) {
  let db = null;
  const h = standIn({
    routed: () => ({ ok: true, intent: "edit", layer: "data", cost: 2 }),
    editBody: (n, said) => ({ layer: "data", instruction: said, idem: "k" }),
    reply: () => D1_REPLY,
    onDone: () => (opt.onDone ? opt.onDone(db) : (db.focaccia().price = 4.6)),
    shown: () => (opt.shown ? opt.shown(db) : db.lines()),
    hangAt: opt.hangAt,
  });
  db = bakery(h.calls, opt.rows, { oldWorker: !!opt.oldWorker });
  return { h, db };
}
// The probe (a conditional write no row can meet) and the recovery's write.
const PROBE = { id: 6, body: probeBody(UI_SCENARIOS["4b-d1-price"].row) };
const BACK = { id: 6, body: { $set: { price: "4.5" }, $if: { name: "Sea Salt Focaccia", price: "4.6" } } };
const driveD1 = (h, db, over = {}) => runUi({
  base: ORIGIN, session: SESSION, slug: "fold-lane-bakery", scenario: D1, spend: true, balanceNow: async () => 59,
  evid: "", launch: h.launch, log: () => {}, openMs: 50, attachMs: 50, startMs: 50, stepMs: 60, pollMs: 1, settleMs: 0, shownMs: 50,
  rows: { owner: db.owner, pub: db.pub, patch: db.patch }, siteOrigin: SITE, ...over,
});

test("D1 takes its baseline just before the Send, sees the one change on the row and the page, and puts that field back", async () => {
  const { h, db } = d1Harness();
  const start = JSON.stringify(db.rows);
  const rec = await driveD1(h, db);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  assert.equal(rec.sent, 1);
  // THE ORDER: the page, then both readers, then the Send; the recovery's
  // write after the reply, and only one.
  const at = (c) => h.calls.indexOf(c);
  const send = at("click #stSend");
  const lastReadBeforeSend = Math.max(h.calls.slice(0, send).lastIndexOf("visitor read"), h.calls.slice(0, send).lastIndexOf("owner read"));
  assert.ok(lastReadBeforeSend > 0 && h.calls.slice(0, send).includes("owner read") && h.calls.slice(0, send).includes("visitor read"), "the baseline was not read before the Send");
  const pageBefore = h.calls.findIndex((c) => c.startsWith("goto " + SITE + "/order"));
  assert.ok(pageBefore > 0 && pageBefore < lastReadBeforeSend, "the page was not read before the baseline, or not before the Send");
  assert.deepEqual(h.calls.slice(lastReadBeforeSend + 1, send), [], "something stands between the baseline and the Send");
  // THE PROBE FIRST, BEFORE THE PAGE: a conditional write no row can meet.
  // Then the only write after the Send is the recovery's, on its condition.
  const patches = h.calls.map((c, i) => [c, i]).filter(([c]) => c.startsWith("patch "));
  assert.equal(patches.length, 2, JSON.stringify(patches));
  assert.ok(patches[0][1] < pageBefore, "the condition was not asked before anything else");
  assert.ok(patches[1][1] > send, "the row was written before the message was sent");
  assert.deepEqual(db.patches, [PROBE, BACK], "not the probe and then one write, of the price, on its condition");
  assert.deepEqual({ ok: rec.row.capability.ok, status: rec.row.capability.status }, { ok: true, status: 409 });
  // What the run saw.
  const r = rec.row;
  assert.equal(r.baselineVerdict.ok, true);
  assert.equal(r.record.same, true, "the baseline did not match the proposal's record");
  assert.deepEqual(r.planAtBaseline.act, "none");
  assert.deepEqual({ exact: r.change.exact, before: r.change.target.before, after: r.change.target.after }, { exact: true, before: "4.5", after: "4.6" });
  assert.equal(r.visitorChange.exact, true);
  assert.match(r.shown.before.target, /^Sea Salt Focaccia £4\.50/);
  assert.deepEqual({ ok: r.shown.afterEdit.verdict.ok, line: r.shown.afterEdit.target.slice(0, 23) }, { ok: true, line: "Sea Salt Focaccia £4.60" });
  assert.deepEqual({ plan: r.restore.plan.act, patched: r.restore.patched.verdict.ok, wrote: r.restore.wrote, conflict: r.restore.conflict, restored: r.restore.verdict.restored, bytes: r.restore.verdict.bytes },
    { plan: "patch", patched: true, wrote: true, conflict: null, restored: true, bytes: true });
  assert.deepEqual(r.shown.afterRestore.verdict, { ok: true, exact: true });
  assert.equal(JSON.stringify(db.rows), start, "the table is not what it was");
  // The page's own record of the message.
  assert.equal(requestVerdict(rec.steps[0], D1).ok, true, JSON.stringify(requestVerdict(rec.steps[0], D1)));
  assert.equal(storedReplyVerdict(rec.steps[0], D1).ok, true);
  assert.equal(rec.steps[0].reply, D1.reply);
  // Each visitor-page read ran in its own context and closed it.
  assert.equal(h.calls.filter((c) => c === "close context").length, 3);
  const told = describeUi(rec);
  assert.match(told, /EXACT: the one expected change and nothing else/);
  assert.match(told, /RESTORED: the row is its baseline again/);
});

test("the rehearsal reads the baseline and the page, decides the recovery would write nothing, and sends and writes nothing", async () => {
  const { h, db } = d1Harness();
  const rec = await driveD1(h, db, { spend: false });
  assert.equal(rec.stopped.at, "rehearsal");
  assert.equal(rec.sent, 0);
  assert.ok(!h.calls.includes("click #stSend"));
  // The one request to the owner route's PATCH is the probe, which no row can meet.
  assert.deepEqual(db.patches, [PROBE]);
  assert.equal(JSON.stringify(db.rows), JSON.stringify(UI_SCENARIOS["4b-d1-price"].row.record), "the rehearsal changed the table");
  assert.equal(rec.row.capability.ok, true);
  assert.match(describeUi(rec), /condition  the Worker writes only while the row still matches/);
  assert.equal(rec.row.baselineVerdict.ok, true);
  assert.equal(rec.row.planAtBaseline.act, "none");
  assert.equal(rec.row.restore, undefined, "a rehearsal decided a recovery beyond the plan");
  assert.match(describeUi(rec), /recovery   against this baseline: none/);
});

test("a row that is not where the test starts, or a page that does not show it, stops before anything is sent", async () => {
  for (const [rows, shown, why] of [
    [UI_SCENARIOS["4b-d1-price"].row.record.map((r) => (r.id === 6 ? { ...r, price: 4.7 } : r)), null, /unexpected-value/],
    [UI_SCENARIOS["4b-d1-price"].row.record.filter((r) => r.id !== 6), null, /row-missing/],
    [UI_SCENARIOS["4b-d1-price"].row.record.map((r) => (r.id === 6 ? { ...r, name: "Baguette" } : r)), null, /not-the-row/],
    [null, (db) => db.lines().map((l) => l.replace("£4.50", "£4.55")), /does not show Sea Salt Focaccia at £4\.50/],
    [null, () => [], /never drew a card/],
  ]) {
    const { h, db } = d1Harness({ rows: rows || undefined, shown: shown || undefined });
    const rec = await driveD1(h, db);
    assert.equal(rec.stopped && rec.stopped.at, "baseline", JSON.stringify(rec.stopped));
    assert.match(rec.stopped.msg, why);
    assert.match(rec.stopped.msg, /nothing was sent/);
    assert.equal(rec.sent, 0);
    assert.ok(!h.calls.includes("click #stSend"), "a message was sent from a wrong starting point");
    assert.deepEqual(db.patches, [PROBE], "anything but the probe was sent to the owner route");
    assert.equal(rec.row.restore.skipped, "nothing was sent, so there is nothing to put back");
  }
  // And a run handed no readers never opens a browser.
  const { h, db } = d1Harness();
  const rec = await driveD1(h, db, { rows: null });
  assert.match(rec.stopped.msg, /not handed the row readers/);
  assert.ok(!h.calls.some((c) => c.startsWith("goto")), "a browser was opened without the readers");
  assert.ok(!h.calls.includes("close"), "a browser was launched without the readers");
});

test("a price somebody else set after the edit is refused and left, and said", async () => {
  const { h, db } = d1Harness();
  // The second owner read is the after-read; right after it somebody sets 4.7.
  db.onOwnerRead = (n, d) => { if (n === 2) d.focaccia().price = 4.7; };
  const rec = await driveD1(h, db);
  assert.deepEqual(db.patches, [PROBE], "a value nobody here set was overwritten");
  assert.equal(db.focaccia().price, 4.7);
  const x = rec.row.restore;
  assert.deepEqual({ act: x.plan.act, why: x.plan.why, restored: x.verdict.restored }, { act: "refuse", why: "unexpected-value", restored: false });
  assert.deepEqual(x.moved.changed.map((c) => [c.id, c.field, c.after]), [[6, "price", "4.7"]]);
  assert.equal(rec.row.change.exact, true, "the edit itself was the expected change");
  assert.match(describeUi(rec), /refuse \(unexpected-value\)/);
});

test("a change beside the expected one is reported and kept, and only the price is put back", async () => {
  const { h, db } = d1Harness({
    onDone: (d) => { d.focaccia().price = 4.6; d.rows.find((r) => r.id === 2).description = "Dense, malty, changed."; },
  });
  const rec = await driveD1(h, db);
  const r = rec.row;
  assert.deepEqual({ expected: r.change.expected, exact: r.change.exact }, { expected: true, exact: false });
  assert.deepEqual(r.change.others.map((o) => [o.id, o.field]), [[2, "description"]]);
  assert.equal(r.shown.afterEdit.verdict.why, "other-lines-changed");
  assert.deepEqual(db.patches, [PROBE, BACK]);
  assert.equal(db.rows.find((x) => x.id === 2).description, "Dense, malty, changed.", "another row's change was overwritten");
  assert.deepEqual({ restored: r.restore.verdict.restored, bytes: r.restore.verdict.bytes }, { restored: true, bytes: false });
  assert.match(describeUi(rec), /other change: id 2 description/);
  assert.match(describeUi(rec), /still different: id 2 description/);
});

test("a reply that never comes writes nothing and names the recovery run", async () => {
  const { h, db } = d1Harness({ hangAt: 0 });
  const rec = await driveD1(h, db);
  assert.equal(rec.sent, 1);
  assert.equal(rec.steps[0].completed, false);
  assert.match(rec.row.restore.skipped, /reply never came/);
  assert.match(rec.row.restore.skipped, /price back only if it reads 4\.6/);
  assert.deepEqual(db.patches, [PROBE]);
  assert.equal(rec.row.after, undefined, "the row was read as if the job had finished");
});

test("the wall the driver registers for D1 sees every API call and aborts a misrouted edit with its reason", async () => {
  const { h, db } = d1Harness();
  const rec = await driveD1(h, db, { spend: false });
  const wall = h.routes.find((r) => typeof r.pattern === "function" && r.pattern(new URL(ORIGIN + "/api/credits")));
  assert.ok(wall, "the wall does not look at every API path on the app's origin");
  assert.ok(!wall.pattern(new URL(SITE + "/api/db/fold-lane-bakery/data/orders")), "the wall reaches the customer's site");
  const act = async (method, path, body) => {
    let did = "";
    await wall.handler({
      request: () => ({ method: () => method, url: () => ORIGIN + path, postData: () => (body === undefined ? null : JSON.stringify(body)) }),
      abort: async () => { did = "abort"; }, fallback: async () => { did = "fallback"; },
    });
    return did;
  };
  assert.equal(await act("POST", "/api/site/route", { message: D1_SAY }), "fallback");
  assert.equal(await act("POST", "/api/site/fold-lane-bakery/edit", { layer: "data", instruction: D1_SAY }), "fallback");
  assert.equal(await act("POST", "/api/site/fold-lane-bakery/edit", { layer: "text", instruction: D1_SAY }), "abort");
  assert.equal(await act("PATCH", "/api/site/fold-lane-bakery/rows/loaves/6", { price: 9 }), "abort");
  assert.equal(await act("GET", "/api/site/list"), "fallback");
  assert.deepEqual(rec.blocked.map((b) => [b.path, /text layer/.test(b.why) || /never makes/.test(b.why)]),
    [["/api/site/fold-lane-bakery/edit", true], ["/api/site/fold-lane-bakery/rows/loaves/6", true]]);
  assert.match(describeUi(rec), /BLOCKED POST \/api\/site\/fold-lane-bakery\/edit: an edit at the text layer/);
});

test("the recovery run opens no app, writes only with spend and only from 4.6, and reads the page back", async () => {
  const at46 = UI_SCENARIOS["4b-d1-price"].row.record.map((r) => (r.id === 6 ? { ...r, price: 4.6 } : r));
  const drive = (h, db, spend) => runUi({
    base: ORIGIN, session: SESSION, slug: "fold-lane-bakery", scenario: D1_BACK, spend, balanceNow: async () => 59,
    evid: "", launch: h.launch, log: () => {}, pollMs: 1, shownMs: 50, rows: { owner: db.owner, pub: db.pub, patch: db.patch }, siteOrigin: SITE,
  });
  // Dry run: decided, not written.
  let { h, db } = d1Harness({ rows: at46 });
  let rec = await drive(h, db, false);
  assert.deepEqual(db.patches, [PROBE], "a dry run sent more than the probe");
  assert.deepEqual({ act: rec.row.recovery.plan.act, sent: rec.row.recovery.sent, wrote: rec.row.recovery.wrote }, { act: "patch", sent: false, wrote: false });
  assert.equal(rec.row.capability.ok, true);
  assert.equal(rec.stopped.at, "rehearsal");
  assert.equal(h.inits.length, 0, "the owner's session was planted by a run that opens no app");
  assert.ok(!h.calls.some((c) => c.startsWith("goto " + ORIGIN) || c.startsWith("click")), "the recovery opened the app");
  assert.match(describeUi(rec), /NOT SENT \(dry run\)/);
  // THE VISITOR'S PAGE MAY WRITE NOTHING: its own context aborts every request
  // that is not a read, and names it (the analytics beacon aside).
  const siteWall = h.routes.find((r) => typeof r.pattern === "function" && r.pattern(new URL(SITE + "/order")) && r.pattern(new URL("https://anywhere.example/")));
  assert.ok(siteWall, "the visitor's page has no wall of its own");
  const on = async (method, url) => {
    let did = "";
    await siteWall.handler({ request: () => ({ method: () => method, url: () => url }), abort: async () => { did = "abort"; }, fallback: async () => { did = "fallback"; } });
    return did;
  };
  assert.equal(await on("GET", SITE + "/api/db/fold-lane-bakery/data/loaves"), "fallback");
  assert.equal(await on("HEAD", SITE + "/order"), "fallback");
  assert.equal(await on("POST", SITE + "/api/db/fold-lane-bakery/data/orders"), "abort", "the visitor's page could submit the order form");
  assert.equal(await on("PATCH", SITE + "/api/db/fold-lane-bakery/data/loaves"), "abort");
  // With spend: one write, the row back, the page back.
  ({ h, db } = d1Harness({ rows: at46 }));
  rec = await drive(h, db, true);
  assert.deepEqual(db.patches, [PROBE, BACK]);
  assert.deepEqual({ wrote: rec.row.recovery.wrote, conflict: rec.row.recovery.conflict }, { wrote: true, conflict: null });
  assert.equal(rec.row.recovery.verdict.restored, true);
  assert.equal(rec.row.shown.afterRestore.verdict.ok, true, JSON.stringify(rec.row.shown.afterRestore.verdict));
  assert.equal(rec.stopped, null);
  assert.deepEqual([rec.balance.start, rec.balance.end], [59, 59]);
  assert.match(describeUi(rec), /RESTORED: the row is its recorded value again/);
  // At the baseline already: nothing to write. At a value nobody here set: refused.
  for (const [rows, act] of [[UI_SCENARIOS["4b-d1-price"].row.record, "none"], [at46.map((r) => (r.id === 6 ? { ...r, price: 4.7 } : r)), "refuse"]]) {
    ({ h, db } = d1Harness({ rows }));
    rec = await drive(h, db, true);
    assert.equal(rec.row.recovery.plan.act, act);
    assert.deepEqual(db.patches, [PROBE]);
    assert.equal(rec.row.shown.afterRestore, undefined);
  }
});

// ── A WRITE THAT LANDS BETWEEN THE RECOVERY'S READ AND ITS WRITE ────────────
//
// Armed at the recovery's own last read, so the other write lands after every
// read it makes and immediately before the owner route's UPDATE runs.

test("the paid run's recovery does not overwrite a write that lands after its read, and the run says conflict", async () => {
  const { h, db } = d1Harness();
  // Owner reads: the baseline (1), the after-read (2), the recovery's own read (3).
  db.onOwnerRead = (n, d) => { if (n === 3) d.t.beforeUpdate(() => { d.focaccia().price = 5.2; }); };
  const rec = await driveD1(h, db);
  assert.equal(rec.sent, 1);
  const x = rec.row.restore;
  assert.deepEqual(db.patches, [PROBE, BACK], "not the probe and the one conditional write");
  assert.equal(db.focaccia().price, 5.2, "the other writer's value was overwritten");
  assert.deepEqual({ plan: x.plan.act, status: x.patched.status, why: x.patched.verdict.why, wrote: x.wrote, restored: x.verdict.restored },
    { plan: "patch", status: 409, why: "conflict", wrote: false, restored: false });
  assert.match(x.conflict, /read price as "4\.6" \(it now reads "5\.2"\), so the write matched nothing and nothing was written/);
  assert.equal(rec.row.shown.afterRestore.verdict.ok, false, "the page was called back where it started");
  const told = describeUi(rec);
  assert.match(told, /CONFLICT   the row changed after the recovery read price/);
  assert.match(told, /final      NOT RESTORED/);
  assert.doesNotMatch(told, /RESTORED: the row is its baseline again/);
});

test("the standalone recovery does not overwrite a write that lands after its read, and says conflict", async () => {
  const at46 = UI_SCENARIOS["4b-d1-price"].row.record.map((r) => (r.id === 6 ? { ...r, price: 4.6 } : r));
  const { h, db } = d1Harness({ rows: at46 });
  // The recovery's own read is the first owner read of that run.
  db.onOwnerRead = (n, d) => { if (n === 1) d.t.beforeUpdate(() => { d.focaccia().price = 5.2; }); };
  const rec = await runUi({
    base: ORIGIN, session: SESSION, slug: "fold-lane-bakery", scenario: D1_BACK, spend: true, balanceNow: async () => 59,
    evid: "", launch: h.launch, log: () => {}, pollMs: 1, shownMs: 50, rows: { owner: db.owner, pub: db.pub, patch: db.patch }, siteOrigin: SITE,
  });
  const x = rec.row.recovery;
  assert.deepEqual(db.patches, [PROBE, BACK]);
  assert.equal(db.focaccia().price, 5.2, "the other writer's value was overwritten");
  assert.deepEqual({ sent: x.sent, wrote: x.wrote, why: x.patched.verdict.why, restored: x.verdict.restored }, { sent: true, wrote: false, why: "conflict", restored: false });
  assert.match(x.conflict, /nothing was written/);
  const told = describeUi(rec);
  assert.match(told, /CONFLICT   the row changed after the recovery read price/);
  assert.doesNotMatch(told, /RESTORED: the row is its recorded value again/);
});

test("on a Worker that cannot make a conditional write, the paid run sends nothing and the recovery writes nothing", async () => {
  // Paid: refused before the Send, with nothing changed.
  let { h, db } = d1Harness({ oldWorker: true });
  let rec = await driveD1(h, db);
  assert.deepEqual({ at: rec.stopped && rec.stopped.at, sent: rec.sent }, { at: "condition", sent: 0 });
  assert.match(rec.stopped.msg, /does not take a conditional write.*nothing was sent/);
  assert.ok(!h.calls.includes("click #stSend"), "a message was sent although its recovery could not be conditional");
  assert.deepEqual(db.patches, [PROBE]);
  assert.equal(JSON.stringify(db.rows), JSON.stringify(UI_SCENARIOS["4b-d1-price"].row.record));
  assert.equal(rec.row.restore.skipped, "nothing was sent, so there is nothing to put back");
  // The rehearsal says so and stops where it always does.
  ({ h, db } = d1Harness({ oldWorker: true }));
  rec = await driveD1(h, db, { spend: false });
  assert.deepEqual({ at: rec.stopped.at, ok: rec.row.capability.ok, why: rec.row.capability.why }, { at: "rehearsal", ok: false, why: "no-conditional-write" });
  assert.match(describeUi(rec), /condition  REFUSED: this Worker does not take a conditional write/);
  // The standalone recovery with spend: its write is never sent.
  const at46 = UI_SCENARIOS["4b-d1-price"].row.record.map((r) => (r.id === 6 ? { ...r, price: 4.6 } : r));
  ({ h, db } = d1Harness({ rows: at46, oldWorker: true }));
  rec = await runUi({
    base: ORIGIN, session: SESSION, slug: "fold-lane-bakery", scenario: D1_BACK, spend: true, balanceNow: async () => 59,
    evid: "", launch: h.launch, log: () => {}, pollMs: 1, shownMs: 50, rows: { owner: db.owner, pub: db.pub, patch: db.patch }, siteOrigin: SITE,
  });
  assert.deepEqual({ at: rec.stopped && rec.stopped.at, sent: rec.row.recovery.sent }, { at: "condition", sent: false });
  assert.deepEqual(db.patches, [PROBE]);
  assert.equal(db.focaccia().price, 4.6);
  assert.match(describeUi(rec), /NOT SENT \(the Worker cannot make a conditional write\)/);
});

test("a probe whose transport throws is cannot-tell, never a yes", async () => {
  const v = await conditionProbe({ patch: async () => { throw new Error("socket hang up"); } }, UI_SCENARIOS["4b-d1-price"].row);
  assert.deepEqual({ ok: v.ok, why: v.why, status: v.status }, { ok: false, why: "cannot-tell", status: 0 });
  assert.match(v.detail, /socket hang up/);
});

// ── THE WIRING ─────────────────────────────────────────────────────────────

const CANARY = fs.readFileSync(ROOT + "scripts/edit-canary.mjs", "utf8");
const FLOW = fs.readFileSync(ROOT + ".github/workflows/edit-canary.yml", "utf8");
const MOD = fs.readFileSync(ROOT + "scripts/canary-ui.mjs", "utf8");

test("the canary refuses a bad scenario before it signs in, and runs the mode below the free checks", () => {
  const ask = CANARY.indexOf("readUiScenario(UI, CANARY)");
  const signIn = CANARY.indexOf("auth/v1/admin/generate_link");
  assert.ok(ask > 0 && signIn > 0 && ask < signIn, "the scenario is read after the sign-in");
  // EACH refusal exits on its own: one exit between them cannot stand for both.
  const refusal = (needle) => {
    const at = CANARY.indexOf(needle, ask);
    assert.ok(at > ask && at < signIn, `no refusal "${needle}" before the sign-in`);
    return CANARY.slice(at, CANARY.indexOf("\n}", at));
  };
  assert.match(refusal("REFUSING THE UI MODE"), /process\.exit\(2\)/, "a bad scenario does not stop the run");
  assert.match(refusal("two different runs"), /process\.exit\(2\)/, "a version and a scenario together do not stop the run");
  assert.match(CANARY.slice(ask, signIn), /UI_ASK && RESTORE_ASK/, "a version and a scenario can both be live");
  const branch = CANARY.indexOf("if (UI_ASK) {");
  const free = CANARY.indexOf("ALL FREE CHECKS PASSED");
  const inv = CANARY.indexOf('await inventory("before")');
  const bal = CANARY.indexOf("const BAL = await balanceNow()");
  const gate = CANARY.indexOf("if (!SPEND)");
  const paid = CANARY.indexOf("PAID CANARY EDIT");
  // The spend gate's spelling is the landmark every canary guard finds it by,
  // so it stays unique: a second one inside this branch moved it once.
  assert.equal(CANARY.split("if (!SPEND)").length - 1, 1, "the spend gate's landmark is no longer unique");
  assert.ok(free > 0 && inv > free && bal > inv && branch > bal, "the mode runs before the free checks, the before-read or the balance");
  assert.ok(gate > branch && paid > gate, "the mode sits below the spend gate or the paid edit");
  const win = CANARY.slice(branch, gate);
  const refuse = win.indexOf("if (failed)");
  const run = win.indexOf("await runUi(");
  assert.ok(refuse > 0 && run > refuse, "a failed free check does not refuse the mode before the browser opens");
  assert.match(win.slice(refuse, run), /process\.exit\(1\)/);
  assert.match(win.slice(run, win.indexOf("\n", run)), /spend: SPEND/, "the mode is not told whether it may send");
  assert.match(win.slice(run, win.indexOf("\n", run)), /session,/, "the mode is not handed the canary's own session");
  // It EXITS, so the one API edit is unreachable from it — and it posts no edit itself.
  assert.match(win.slice(win.lastIndexOf("writeFileSync")), /process\.exit\(failed \? 1 : 0\)/);
  // `\b` keeps the page list (`/api/site/routes`, a free GET the rules test
  // reads before the browser opens) from reading as the routing call.
  assert.doesNotMatch(win, /api\/site\/route\b/, "the mode makes its own routing call");
  assert.doesNotMatch(win, /call\("POST"/, "the mode posts on its own rather than through the page");
  // The chain and the money follow every job a message filed, a hand-off's included.
  assert.match(win, /s\.jobs/, "the chain follows only the first job a message filed");
  assert.doesNotMatch(win, /s\.job\b(?!s)/, "the chain still reads a message's first job alone");
  // THE PROPERTY IS WHAT IS IMPORTED, NOT HOW THE LINE IS SPELLED (2026-09-28):
  // this pinned the whole import line, and an honest fifth name — the stored
  // reply's reader, for Test 5's verdict — read as the four going missing.
  const fromUi = [...CANARY.matchAll(/import \{([^}]*)\} from "\.\/canary-ui\.mjs"/g)].flatMap((m) => m[1].split(",").map((x) => x.trim()).filter(Boolean));
  assert.ok(fromUi.length >= 4, "the canary's imports from the UI module were not found");
  for (const name of ["readUiScenario", "runUi", "describeUi", "chainVerdict"]) assert.ok(fromUi.includes(name), `the canary does not import ${name}`);
});

test("the workflow carries the mode and installs the browser only for it, before the step that launches it", () => {
  assert.match(FLOW, /\n {6}ui_scenario:\n/, "the workflow has no ui_scenario input");
  assert.match(FLOW, /CANARY_UI:\s*\$\{\{\s*github\.event\.inputs\.ui_scenario\s*\}\}/);
  // GITHUB CAPS A DISPATCH FORM AT 25 INPUTS, not ten: its changelog of
  // 2025-12-04 raised the limit, and lane-sweep.yml's 11-input form has been
  // dispatched four times since 2026-09-16. Ten was true when this was written.
  const inputs = FLOW.slice(FLOW.indexOf("inputs:"), FLOW.indexOf("\njobs:")).match(/\n {6}[a-z_]+:\n/g) || [];
  assert.ok(inputs.length >= 9 && inputs.length <= 25, `${inputs.length} inputs`);
  // The spend switch is unchanged: the mode sends only with spend=yes and no other mode named.
  const spend = FLOW.match(/CANARY_SPEND:.*/)[0];
  assert.match(spend, /inputs\.read_job == ''/);
  assert.match(spend, /inputs\.restore_version == ''/);
  assert.match(spend, /inputs\.spend == 'yes'/);
  // A scenario named on the form never arms spending by itself.
  assert.doesNotMatch(spend, /ui_scenario/, "the scenario box arms the spend switch");
  // The launch lives in the module the canary imports, so the generic order guard
  // (which reads only the script a step runs) cannot see it; this is its check.
  assert.match(MOD, /chromium\.launch\s*\(/, "the module no longer launches a browser — this check is about nothing");
  const install = FLOW.indexOf("playwright install --with-deps chromium");
  const step = FLOW.indexOf("run: node scripts/edit-canary.mjs");
  assert.ok(install > 0 && step > install, "the browser is installed after the step that launches it");
  const block = FLOW.slice(FLOW.lastIndexOf("- name:", install), install);
  assert.match(block, /if: github\.event\.inputs\.ui_scenario != ''/, "every canary run installs a browser now");
  assert.match(FLOW.slice(FLOW.lastIndexOf("\n", install), FLOW.indexOf("\n", install)), /npm i --no-save[^\n]*playwright@/);
});

test("a row scenario is handed the owner route, the visitor route and one PATCH, and every one of its checks is there", () => {
  const branch = CANARY.indexOf("if (UI_ASK) {");
  const gate = CANARY.indexOf("if (!SPEND)");
  assert.ok(branch > 0 && gate > branch, "the mode's branch or the spend gate is gone");
  const win = CANARY.slice(branch, gate);
  const from = win.indexOf("const rowReaders"), to = win.indexOf("const recoverOnly");
  assert.ok(from > 0 && to > from, "the row readers are gone");
  const readers = win.slice(from, to);
  assert.match(readers, /owner: \(\) => call\("GET", `\/api\/site\/\$\{encodeURIComponent\(CANARY\)\}\/rows\/\$\{encodeURIComponent\(ROW\.table\)\}\?order=id&dir=asc&limit=\$\{OWNER_ROWS_LIMIT\}`\)/,
    "the owner route is not read whole, in id order, at its own page size");
  assert.match(readers, /\$\{BEFORE\.origin\}\/api\/db\/\$\{encodeURIComponent\(CANARY\)\}\/data\/\$\{encodeURIComponent\(ROW\.table\)\}\?select=\*&order=id\.asc/,
    "the visitor route is not the site's own, in id order");
  assert.match(readers, /Buffer\.from\(await r\.arrayBuffer\(\)\)\.toString\("utf8"\)/, "the visitor body is not decoded once from its bytes");
  assert.match(readers, /patch: \(id, body\) => call\("PATCH", `\/api\/site\/\$\{encodeURIComponent\(CANARY\)\}\/rows\/\$\{encodeURIComponent\(ROW\.table\)\}\/\$\{id\}`, \{ body \}\)/,
    "the one write is not the owner route's PATCH of that row");
  // THE ONLY WRITES THE MODE MAKES ON ITS OWN are that PATCH and the rules
  // test's cleanup DELETE of one booking row; the message is the page's.
  assert.deepEqual(win.match(/call\("(POST|PATCH|PUT|DELETE)"/g), ['call("PATCH"', 'call("DELETE"'], "the mode writes on its own beyond the row PATCH and the rules cleanup");
  const run = win.slice(win.indexOf("await runUi("), win.indexOf("\n", win.indexOf("await runUi(")));
  assert.match(run, /rows: rowReaders/, "the readers are not handed to the driver");
  assert.match(run, /siteOrigin: BEFORE\.origin/, "the site's origin is not handed to the driver");
  for (const needle of ["r.baselineVerdict.ok", 'shownOk("before")', 'r.planAtBaseline.act === "none"', "requestVerdict(", "storedReplyVerdict(",
    "r.change.exact", "r.visitorChange.exact", 'shownOk("afterEdit")', 'x.plan.act === "patch"', "x.verdict.restored", "x.verdict.bytes === true",
    'shownOk("afterRestore")', "unpublishedVerdict(", "moneyVerdict(", "routeCostsOf(ui.steps)", "jobs.length === 1",
    "r.capability && r.capability.ok", "!x.conflict"]) {
    assert.ok(win.includes(needle), `the check on ${needle} is gone`);
  }
  // A conflict is its own failing check on BOTH recoveries, the paid run's and the standalone one.
  assert.equal(win.split("!x.conflict").length - 1, 2, "a recovery has no check of its own for a conflict");
  // The money and the no-publish proof are read after the chain, for a scenario that publishes nothing.
  const chainAt = win.indexOf("chain = chainVerdict(");
  const pub0 = win.indexOf("UI_ASK.scenario.publishes === 0");
  assert.ok(chainAt > 0 && pub0 > chainAt, "the no-publish proof is read before the after-read");
  assert.ok(win.indexOf("unpublishedVerdict(", pub0) > pub0 && win.indexOf("moneyVerdict(", pub0) > pub0);
  assert.match(CANARY, /import \{ requestVerdict, storedReplyVerdict, moneyVerdict, unpublishedVerdict, routeCostsOf \} from "\.\/canary-ui\.mjs"/);
});

test("the scenario box names every scenario there is", () => {
  const at = FLOW.indexOf("\n      ui_scenario:\n");
  const box = FLOW.slice(at, FLOW.indexOf("\n      site:\n", at));
  const desc = (box.match(/description: '([^']*)'/) || [])[1] || "";
  assert.ok(desc.length > 40, "the box has no description");
  for (const name of Object.keys(UI_SCENARIOS)) assert.ok(desc.includes(name), `the form does not name ${name}`);
});

// ── THE RULES TEST, THROUGH THE STAND-IN ────────────────────────────────────
//
// The app's half is the stand-in above, answering at the rules layer. The
// visitor's booking is a tab of its own (`bookingTab`): the page's form, and
// the request its "Book a table" makes, which the tab's wall either lets out or
// stops. A let-out request is answered by `lido`, a database that refuses a
// visitor's booking at the privilege check once it is closed and otherwise
// takes it as a row (and stamps the notification record, as the platform does
// before it sends). Every read and the one cleanup write go through `db.io`,
// the shape the canary hands the driver.

const RULES = UI_SCENARIOS["4b-rules-close"];
const LIDO = "https://lido-axes-b.gofarther.app";
const DENIED_BOOKING = { code: "42501", details: null, hint: null, message: "permission denied for table bookings" };
const rulesReply = (fields = ["retired"], over = {}) => ({
  ok: true, layer: "rules", applied: [{ table: "bookings", fields }], refused: [], cost: 1,
  msg: fields.includes("write") ? "✅ **bookings** — changed who can add to it." : "✅ **bookings** — changed whether it's open.", ...over,
});
const LIDO_SURFACE = () => {
  const r = RULES.rules.record;
  return {
    at: "t",
    routes: Object.fromEntries(r.routes.map((p) => [p, { status: 200, build: r.build, version: "", bytes: 100, masked: 1, sha256: "p" + p, styles: [r.stylesheet.path] }])),
    styles: { [r.stylesheet.path]: { status: 200, bytes: r.stylesheet.bytes, sha256: r.stylesheet.sha256 } },
  };
};

function lido(calls, opt = {}) {
  const db = {
    access: "collect", closed: false, notify: true, notifiedAt: null,
    rows: (opt.rows || [{ id: 5, name: "Real Person", phone: "07123 456789", party_size: 4, booking_date: "2026-10-01", booking_time: "12:00:00" }]).map((r) => ({ ...r })),
    nextId: opt.nextId || 6, names: opt.names || [], deletes: [], newestReads: 0, onNewest: null,
  };
  const rows = () => [...db.rows].sort((a, b) => b.id - a.id).slice(0, 50).map((r) => ({ ...r }));
  db.io = {
    tables: async () => {
      calls.push("tables");
      return { status: 200, json: { tables: [{ name: "bookings", access: db.access, rows: db.rows.length, columns: ["name", "phone", "party_size", "booking_date", "booking_time"] }, { name: "menu_items", access: "display", rows: 6, columns: ["name", "price"] }] } };
    },
    newest: async () => { calls.push("newest"); db.newestReads++; if (db.onNewest) db.onNewest(db.newestReads, db); return { status: 200, json: { rows: rows() } }; },
    secrets: async () => { calls.push("secrets"); return { status: 200, json: { ok: true, secrets: db.names.map((name) => ({ name, prefix: "re_9Zx", last4: "Q7w2", created_at: "t" })) } }; },
    stamp: async () => { calls.push("stamp"); return { status: 200, rows: [{ notify: db.notify, notified_at: db.notifiedAt }] }; },
    menu: async () => { calls.push("menu"); return { status: 200, text: "[{\"id\":1,\"name\":\"Toastie\"}]" }; },
    bookingsRead: async () => { calls.push("bookings read"); return { status: 403, text: JSON.stringify(DENIED_BOOKING) }; },
    surface: async () => { calls.push("surface"); return LIDO_SURFACE(); },
    del: async (id) => {
      calls.push(`delete ${id}`);
      db.deletes.push(id);
      const i = db.rows.findIndex((r) => r.id === id);
      if (i < 0) return { status: 404, json: { error: "no such row" } };
      db.rows.splice(i, 1);
      return { status: 200, json: { ok: true, id, soft: false } };
    },
  };
  // A VISITOR'S BOOKING: refused at the privilege check once closed; otherwise a row, and the stamp.
  db.book = (body) => {
    if (db.closed) return { status: 403, body: DENIED_BOOKING };
    db.rows.push({ id: db.nextId++, ...body, booking_time: body.booking_time + ":00" });
    if (db.notify && !db.notifiedAt) db.notifiedAt = "2026-09-27T12:00:00Z";
    return { status: 201, body: "" };
  };
  return db;
}

function bookingTab(calls, opt = {}) {
  const listeners = {};
  let wall = null;
  const form = { name: "", phone: "", date: "", times: [], hydrated: !opt.neverHydrates };
  let said = { toasts: [], success: false, form: true };
  const out = [];
  const fire = (ev, x) => Promise.all((listeners[ev] || []).map((f) => f(x)));
  // A request as the page made it. A string body is sent as that exact text
  // (malformed JSON included); headers are the lower-case names a browser
  // reports, `content-type` alone unless the case says otherwise.
  const req = (method, url, body, errorText = "net::ERR_BLOCKED_BY_CLIENT", headers = { "content-type": "application/json" }) => ({
    method: () => method, url: () => url,
    postData: () => (body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body)),
    allHeaders: async () => { if (opt.headersUnreadable) throw new Error("the request is gone"); return { ...headers }; },
    failure: () => ({ errorText }),
  });
  const send = async (method, url, body, headers) => {
    let decided = "";
    await wall({ request: () => req(method, url, body, undefined, headers), fallback: async () => { decided = "out"; }, abort: async () => { decided = "stopped"; } });
    calls.push(`${method} ${new URL(url).pathname} ${decided}`);
    if (decided !== "out") { await fire("requestfailed", req(method, url, body)); return null; }
    out.push({ method, path: new URL(url).pathname, body });
    const a = opt.answer ? opt.answer(body) : { status: 403, body: DENIED_BOOKING };
    if (a.drop) { await fire("requestfailed", req(method, url, body, "net::ERR_CONNECTION_RESET")); return { dropped: true }; }
    await fire("response", { request: () => req(method, url, body), status: () => a.status, text: async () => (typeof a.body === "string" ? a.body : JSON.stringify(a.body)) });
    return a;
  };
  const page = {
    on: (ev, f) => { (listeners[ev] = listeners[ev] || []).push(f); },
    goto: async (url) => { calls.push(`visit ${url}`); },
    evaluate: async (fn) => {
      if (fn.name === "bookingFormInPage") return { hydrated: form.hydrated, name: form.name, phone: form.phone, date: form.date, times: form.times, party: true, submit: "Book a table" };
      if (fn.name === "bookingOutcomeInPage") return said;
      throw new Error("unexpected page function " + fn.name);
    },
    fill: async (sel, v) => {
      if (sel === 'input[name="name"]') form.name = opt.mangleName ? v + "!" : v;
      else if (sel === "#phone") form.phone = v;
      else if (sel === 'input[name="booking_date"]') form.date = v;
      else throw new Error("unexpected field " + sel);
    },
    click: async (sel) => {
      calls.push(`press ${sel}`);
      if (sel.startsWith('form button[type="button"]')) form.times = ["17:00"];
      if (sel !== 'form button[type="submit"]') return;
      // What the form holds, and what the page's own code then sends: the two
      // can differ (`sendAs`), which is the case the gate exists for.
      const held = { name: form.name, phone: form.phone, party_size: 2, booking_date: form.date, booking_time: form.times[0] };
      const body = opt.sendAs ? opt.sendAs(held) : held;
      const to = LIDO + "/api/db/lido-axes-b/data/bookings" + (opt.query || "");
      if (opt.otherWrite) await send("POST", LIDO + "/api/telemetry", { e: 1 });
      const a = await send("POST", to, body, opt.headers);
      if (opt.twice) await send("POST", to, opt.retryAs ? opt.retryAs(held) : body, opt.headers);
      said = a && a.status >= 200 && a.status < 300 ? { toasts: ["Table held — see you by the water."], success: true, form: false }
        : a && a.status ? { toasts: ["That isn't available."], success: false, form: true }
          : { toasts: ["We couldn't reach the booking system."], success: false, form: true };
    },
  };
  const ctx = { route: async (p, f) => { wall = f; }, newPage: async () => page, close: async () => { calls.push("close visitor"); } };
  return { ctx, out, form };
}

function rulesHarness(opt = {}) {
  let db = null;
  const tabs = [];
  const h = standIn({
    routed: () => ({ ok: true, intent: "edit", layer: "rules", cost: 2 }),
    editBody: (n, said) => ({ layer: "rules", instruction: said, idem: "k" }),
    reply: () => opt.reply || rulesReply(),
    onDone: () => (opt.onDone ? opt.onDone(db) : (db.closed = true)),
    hangAt: opt.hangAt,
    visitor: () => {
      const t = bookingTab(h.calls, { answer: (body) => (opt.answer ? opt.answer(body, db) : db.book(body)), ...(opt.tab || {}) });
      tabs.push(t);
      return t.ctx;
    },
  });
  db = lido(h.calls, opt);
  return { h, db, tabs };
}
const driveRules = (h, db, over = {}) => runUi({
  base: ORIGIN, session: SESSION, slug: "lido-axes-b", scenario: RULES, spend: true, balanceNow: async () => 56,
  evid: "", launch: h.launch, log: () => {}, openMs: 50, attachMs: 50, startMs: 50, stepMs: 60, pollMs: 1, settleMs: 0,
  bookMs: 80, answerMs: 60, bookSettleMs: 30, rules: db.io, allow: readAllow(""), runId: "36300000001", siteOrigin: LIDO, ...over,
});
const BOOKINGS = "/api/db/lido-axes-b/data/bookings";

test("the rules rehearsal reads where it starts, presses Book a table once behind a wall, and sends and writes nothing", async () => {
  const { h, db, tabs } = rulesHarness();
  const start = JSON.stringify(db.rows);
  const rec = await driveRules(h, db, { spend: false });
  assert.equal(rec.stopped.at, "rehearsal", JSON.stringify(rec.stopped));
  assert.equal(rec.sent, 0);
  assert.ok(!h.calls.includes("click #stSend"), "the rehearsal sent the message");
  assert.equal(rec.rules.start.ok, true, rec.rules.start.why);
  assert.equal(rec.rules.marker.name, "Canary rules 36300000001", "the marker does not name this run");
  // THE BOOKING: pressed once, the request stopped in the tab, and exactly the marker's five fields.
  const d = rec.rules.dry;
  assert.equal(d.pressed, true, d.why);
  assert.equal(d.posts.length, 1);
  assert.equal(d.posts[0].sent, false);
  assert.match(d.posts[0].stopped, /rehearsal/);
  assert.equal(bookingBodyVerdict(d.posts[0].body, rec.rules.marker).ok, true, JSON.stringify(d.posts[0].body));
  assert.equal(d.response, null, "an answer arrived for a request that was stopped");
  assert.equal(d.posts[0].exact, true, `the paid run would not let this request out: ${d.posts[0].exactWhy}`);
  assert.equal(h.contextOptions.length, 2);
  assert.equal(h.contextOptions[1].serviceWorkers, "block", "a service worker could take the booking past the wall");
  assert.equal(tabs.length, 1);
  assert.deepEqual(tabs[0].out, [], "the rehearsal's booking left the tab");
  assert.ok(h.calls.includes(`POST ${BOOKINGS} stopped`));
  // NOTHING MOVED: the rows, the stamp, and nothing deleted.
  assert.equal(JSON.stringify(db.rows), start);
  assert.equal(db.notifiedAt, null);
  assert.deepEqual(db.deletes, []);
  assert.deepEqual({ count: rec.rules.dryAfter.count, ids: rec.rules.dryAfter.ids }, { count: rec.rules.before.census.count, ids: rec.rules.before.census.ids });
  // THE ORDER: every start reading, then the press, and all of it after the message was typed.
  const typed = h.calls.indexOf(`fill ${RULES.steps[0].say}`);
  const press = h.calls.indexOf('press form button[type="submit"]');
  assert.ok(typed >= 0 && h.calls.indexOf("tables") > typed && h.calls.indexOf("secrets") > typed && press > h.calls.indexOf("surface"), "the start was not read after the message was typed and before the press");
  assert.equal(h.calls.filter((c) => c === "secrets").length, 1);
  const told = describeUi(rec);
  assert.ok(told.includes(EVIDENCE_BOUNDARY));
  assert.ok(!told.includes("Real Person") && !told.includes("07123 456789"), "a visitor's row reached the account");
});

test("the rehearsal's after-read is a real second read: a row that lands after its press is seen, not the start again", async () => {
  // Nothing the rehearsal does can add a row, so the only way to tell a second
  // read from the first one reused is a row somebody else adds in between.
  const { h, db } = rulesHarness();
  db.onNewest = (n, d) => {
    if (n === 2) d.rows.push({ id: 6, name: "Walk-in", phone: "07123 000000", party_size: 2, booking_date: "2026-10-02", booking_time: "13:00:00" });
  };
  const rec = await driveRules(h, db, { spend: false });
  assert.equal(rec.stopped.at, "rehearsal", JSON.stringify(rec.stopped));
  assert.deepEqual(rec.rules.before.census.ids, [5]);
  assert.deepEqual(rec.rules.dryAfter.ids, [5, 6], "the rehearsal's after-read is the start's census again");
  const press = h.calls.indexOf('press form button[type="submit"]');
  assert.ok(press >= 0 && h.calls.lastIndexOf("newest") > press, "the owner's view was not read again after the press");
});

test("either supported way of closing lets the one real booking out, and a refusal at the privilege check with no row is a pass", async () => {
  for (const [fields, access, method] of [[["retired"], "collect", "retired"], [["write"], "read none / write none", "write none"], [["retired", "write"], "read none / write none", "retired and write none"]]) {
    const { h, db, tabs } = rulesHarness({ reply: rulesReply(fields), onDone: (d) => { d.closed = true; d.access = access; } });
    const start = JSON.stringify(db.rows);
    const rec = await driveRules(h, db);
    assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
    assert.equal(rec.sent, 1);
    assert.deepEqual({ ok: rec.rules.closing.ok, method: rec.rules.closing.method }, { ok: true, method }, rec.rules.closing.why);
    const b = rec.rules.booking;
    assert.equal(b.pressed, true, b.why);
    assert.deepEqual(b.posts.map((p) => p.sent), [true]);
    assert.deepEqual({ exact: b.posts[0].exact, why: b.posts[0].exactWhy, check: b.posts[0].check.ok }, { exact: true, why: "", check: true });
    assert.equal(tabs[0].out.length, 1, "not exactly one booking left the tab");
    assert.equal(bookingBodyVerdict(tabs[0].out[0].body, rec.rules.marker).ok, true);
    assert.deepEqual({ status: b.response.status, code: b.response.json.code }, { status: 403, code: "42501" });
    assert.equal(rec.rules.bookingVerdict.verdict, "pass", rec.rules.bookingVerdict.why);
    assert.equal(b.message.success, false);
    assert.equal(rec.rules.insertion.ok, true, rec.rules.insertion.why);
    assert.equal(rec.rules.cleanup, undefined, "a cleanup ran with no row to clean up");
    assert.deepEqual(db.deletes, []);
    assert.equal(JSON.stringify(db.rows), start);
    assert.equal(rec.rules.after.stamp.notifiedAt, null);
    // THE BOOKING ONLY AFTER THE MESSAGE'S REPLY, and in its own tab.
    const send = h.calls.indexOf("click #stSend");
    const visit = h.calls.indexOf(`visit ${LIDO}/book`);
    assert.ok(send >= 0 && visit > send, "the booking was not made after the message");
    assert.ok(h.calls.includes("close visitor"));
    assert.match(describeUi(rec), /answer     PASS: refused at the privilege check/);
  }
});

test("a reply that did not close bookings, or no reply at all, submits no booking", async () => {
  for (const [opt, re] of [
    [{ reply: rulesReply(["maxRows"]) }, /changed maxRows on bookings, which is not closing it/],
    [{ reply: rulesReply(["retired"], { layer: "data" }) }, /data layer's/],
    [{ reply: rulesReply(["retired"], { applied: [{ table: "menu_items", fields: ["retired"] }] }) }, /changed menu_items, not bookings/],
    [{ reply: rulesReply(["write"]), onDone: (d) => { d.closed = true; } }, /write rule became anyone/],
  ]) {
    const { h, db, tabs } = rulesHarness(opt);
    const rec = await driveRules(h, db);
    assert.equal(rec.sent, 1);
    assert.equal(rec.rules.closing.ok, false);
    assert.match(rec.rules.booking.skipped, re);
    assert.match(rec.rules.booking.skipped, /no booking was submitted/);
    assert.equal(tabs.length, 0, "a booking tab was opened");
    assert.ok(!h.calls.some((c) => c.startsWith("visit ")), "the booking page was visited");
    assert.equal(rec.rules.bookingVerdict, undefined);
    assert.equal(rec.rules.insertion.ok, true, "the owner's view was not read again");
  }
  const { h, db, tabs } = rulesHarness({ hangAt: 0 });
  const rec = await driveRules(h, db);
  assert.match(rec.rules.booking.skipped, /a reply never came/);
  assert.equal(tabs.length, 0);
  assert.equal(rec.rules.after, undefined, "the after-state was read while the job may still be running");
});

test("a booking that goes in is found by every marker value and deleted — that row alone — only with the owner's approval", async () => {
  // The reply says closed; the database stays open (the rule did not take).
  const run = async (allow) => {
    const { h, db, tabs } = rulesHarness({ onDone: () => {} });
    const rec = await driveRules(h, db, { allow: readAllow(allow) });
    return { h, db, tabs, rec };
  };
  const yes = await run("cleanup");
  assert.equal(yes.rec.rules.bookingVerdict.verdict, "fail");
  assert.match(yes.rec.rules.bookingVerdict.why, /the booking went in \(HTTP 201\)/);
  assert.equal(yes.rec.rules.booking.message.success, true);
  assert.deepEqual({ markers: yes.rec.rules.insertion.markers, others: yes.rec.rules.insertion.others }, { markers: [6], others: [] });
  const x = yes.rec.rules.cleanup;
  assert.deepEqual({ act: x.plan.act, id: x.plan.id, recheck: x.recheck.ok, deleted: x.deleted.ok, verified: x.verified.ok }, { act: "delete", id: 6, recheck: true, deleted: true, verified: true }, JSON.stringify(x));
  assert.deepEqual(yes.db.deletes, [6], "not exactly this run's row was deleted");
  assert.deepEqual(yes.db.rows.map((r) => r.id), [5], "the real booking went too, or ours stayed");
  // The stamp is the one thing a cleanup cannot put back, and it is said.
  assert.equal(yes.rec.rules.after.stamp.notifiedAt, "2026-09-27T12:00:00Z");
  assert.match(describeUi(yes.rec), /stamp      before never, after 2026-09-27T12:00:00Z/);
  // THE DELETE IS AFTER THE RE-READ, and the re-read after the booking.
  const calls = yes.h.calls;
  assert.equal(calls[calls.indexOf("delete 6") - 1], "newest", "the row was not read again immediately before the delete");
  assert.ok(calls.indexOf("delete 6") > calls.indexOf(`POST ${BOOKINGS} out`), "the delete came before the booking");
  // Without approval nothing is deleted, and the row is named for the owner.
  const no = await run("");
  assert.deepEqual(no.db.deletes, []);
  assert.match(no.rec.rules.cleanup.skipped, /NOT APPROVED: row 6 holds this run's booking/);
  assert.deepEqual(no.db.rows.map((r) => r.id), [5, 6]);
});

test("an unexpected row beside ours is reported and never touched; two of ours delete nothing; a row that changes is left", async () => {
  // Somebody else's booking lands beside ours.
  const walkIn = rulesHarness({ onDone: () => {}, answer: (body, d) => { const a = d.book(body); d.rows.push({ id: d.nextId++, name: "Walk-in", phone: "07123 000000", party_size: 2, booking_date: "2026-10-02", booking_time: "13:00:00" }); return a; } });
  const w = await driveRules(walkIn.h, walkIn.db, { allow: readAllow("cleanup") });
  assert.deepEqual({ markers: w.rules.insertion.markers, others: w.rules.insertion.others }, { markers: [6], others: [7] });
  assert.match(w.rules.insertion.why, /row\(s\) 7 appeared without the marker/);
  assert.deepEqual(walkIn.db.deletes, [6], "somebody else's row was deleted");
  assert.deepEqual(walkIn.db.rows.map((r) => r.id), [5, 7]);
  // Our booking twice (a retry below the page): which one is ours cannot be told, so neither goes.
  const twice = rulesHarness({ onDone: () => {}, answer: (body, d) => { d.book(body); return d.book(body); } });
  const t = await driveRules(twice.h, twice.db, { allow: readAllow("cleanup") });
  assert.deepEqual({ act: t.rules.cleanup.plan.act, ids: t.rules.cleanup.plan.ids }, { act: "refuse", ids: [6, 7] });
  assert.deepEqual(twice.db.deletes, []);
  // The row changes between the plan and the delete: nothing is deleted.
  const moved = rulesHarness({ onDone: () => {} });
  moved.db.onNewest = (n, d) => { if (n === 3) d.rows.find((r) => r.id === 6).phone = "07700 900111"; };
  const m = await driveRules(moved.h, moved.db, { allow: readAllow("cleanup") });
  assert.equal(m.rules.cleanup.recheck.ok, false);
  assert.match(m.rules.cleanup.recheck.why, /no longer holds every marker value/);
  assert.deepEqual(moved.db.deletes, []);
});

test("an answer that is not the privilege refusal, or no answer at all, is inconclusive — never a pass", async () => {
  for (const [answer, re] of [
    [() => ({ status: 403, body: { error: "turnstile" } }), /HTTP 403 — not the privilege refusal/],
    [() => ({ status: 503, body: "<html>unavailable</html>" }), /HTTP 503 with an answer that is not a JSON object/],
    [() => ({ drop: true }), /no answer arrived \(net::ERR_CONNECTION_RESET\)/],
    [() => ({ status: 403, body: { code: "42501", message: 'new row violates row-level security policy for table "bookings"' } }), /row security/],
  ]) {
    const { h, db } = rulesHarness({ answer });
    const rec = await driveRules(h, db);
    const v = rec.rules.bookingVerdict;
    assert.ok(v.verdict === "inconclusive" || v.verdict === "partial", `${v.verdict}: ${v.why}`);
    assert.notEqual(v.verdict, "pass");
    assert.match(v.why, re);
    assert.equal(rec.rules.insertion.ok, true);
    assert.equal(rec.rules.cleanup, undefined);
  }
});

test("only the first booking request leaves the tab, and any other write the page makes is stopped", async () => {
  const { h, db, tabs } = rulesHarness({ tab: { twice: true, otherWrite: true } });
  const rec = await driveRules(h, db);
  const b = rec.rules.booking;
  assert.deepEqual(b.posts.map((p) => p.sent), [true, false]);
  assert.deepEqual(b.posts.map((p) => p.exact), [true, false], "the gate did not tell the first request from the second");
  assert.match(b.posts[1].stopped, /second booking request: only the first is ever let out/);
  assert.deepEqual(tabs[0].out.map((o) => o.path), [BOOKINGS], "more than the one booking left the tab");
  assert.deepEqual(b.aborted, [`POST ${LIDO}/api/telemetry`]);
  assert.ok(h.calls.includes("POST /api/telemetry stopped"));
});

test("the gate decides before the booking leaves: the form holds the marker, the page sends another phone, and it never reaches the service", async () => {
  // THE REPRODUCTION: the form's own fields read the marker's phone; the page's
  // code sends a different one. Checked after it left, it was already booked.
  const other = "07700 900111";
  const { h, db, tabs } = rulesHarness({ tab: { sendAs: (b) => ({ ...b, phone: other }) } });
  const start = JSON.stringify(db.rows);
  const rec = await driveRules(h, db, { allow: readAllow("cleanup") });
  const b = rec.rules.booking;
  assert.equal(b.filled.phone, rec.rules.marker.phone, "the form did not hold the marker's phone");
  assert.equal(b.posts.length, 1);
  assert.deepEqual({ phone: b.posts[0].body.phone, sent: b.posts[0].sent, exact: b.posts[0].exact }, { phone: other, sent: false, exact: false });
  assert.match(b.posts[0].stopped, /not the marker booking: phone was sent as "07700 900111"/);
  assert.equal(b.posts[0].exactWhy, b.posts[0].stopped, "the gate's own reason was not recorded");
  assert.match(b.why, /stopped in the browser and never sent/);
  // NEVER REACHED THE SERVICE, AND NOTHING TO CLEAN UP.
  assert.deepEqual(tabs[0].out, [], "the request left the tab");
  assert.ok(h.calls.includes(`POST ${BOOKINGS} stopped`));
  assert.equal(JSON.stringify(db.rows), start, "a row was written");
  assert.equal(db.notifiedAt, null, "the notification stamp moved");
  assert.deepEqual(db.deletes, []);
  assert.equal(rec.rules.cleanup, undefined, "a cleanup ran for a booking that never left");
  assert.equal(rec.rules.insertion.ok, true, rec.rules.insertion.why);
  assert.equal(rec.rules.bookingVerdict.verdict, "inconclusive");
  assert.match(rec.rules.bookingVerdict.why, /never sent/);
});

test("malformed JSON, a changed value or type, a missing or extra field, a query string and a prefer or authorization header are each stopped before they leave", async () => {
  const cases = [
    ["malformed JSON", { sendAs: () => '{"name": "Canary rules 36300000001", "phone": ' }, /the request body is not JSON/],
    ["no body", { sendAs: () => undefined }, /the request body is not an object/],
    ["a list", { sendAs: (b) => [b] }, /the request body is not an object/],
    ["a changed value", { sendAs: (b) => ({ ...b, name: b.name + " " }) }, /name was sent as/],
    ["a changed type", { sendAs: (b) => ({ ...b, party_size: "2" }) }, /party_size was sent as "2"/],
    ["a missing field", { sendAs: ({ booking_time, ...b }) => b }, /the fields sent were booking_date, name, party_size, phone,/],
    ["an extra field", { sendAs: (b) => ({ ...b, cf_turnstile_response: "t" }) }, /the fields sent were .*cf_turnstile_response/],
    ["a query string", { query: "?on_conflict=id" }, /query string \(\?on_conflict=id\)/],
    ["a prefer header", { headers: { "content-type": "application/json", prefer: "return=representation" } }, /must not send: prefer/],
    ["an authorization header", { headers: { "content-type": "application/json", authorization: "Bearer member" } }, /must not send: authorization/],
    ["headers that cannot be read", { headersUnreadable: true }, /headers could not be read/],
  ];
  for (const [what, tab, re] of cases) {
    const { h, db, tabs } = rulesHarness({ tab });
    const start = JSON.stringify(db.rows);
    const rec = await driveRules(h, db, { allow: readAllow("cleanup") });
    const b = rec.rules.booking;
    assert.equal(b.posts.length, 1, what);
    assert.deepEqual({ sent: b.posts[0].sent, exact: b.posts[0].exact }, { sent: false, exact: false }, what);
    assert.match(b.posts[0].stopped, re, what);
    assert.deepEqual(tabs[0].out, [], `${what}: the request left the tab`);
    assert.equal(JSON.stringify(db.rows), start, `${what}: a row was written`);
    assert.equal(db.notifiedAt, null, what);
    assert.deepEqual(db.deletes, [], what);
    assert.equal(rec.rules.cleanup, undefined, what);
    assert.equal(rec.rules.bookingVerdict.verdict, "inconclusive", what);
  }
});

test("a stopped booking is not retried into the database: a second request, even the exact one, is stopped too", async () => {
  const { h, db, tabs } = rulesHarness({ tab: { sendAs: (b) => ({ ...b, phone: "07700 900111" }), twice: true, retryAs: (b) => b } });
  const start = JSON.stringify(db.rows);
  const rec = await driveRules(h, db, { allow: readAllow("cleanup") });
  const b = rec.rules.booking;
  assert.deepEqual(b.posts.map((p) => [p.sent, p.exact]), [[false, false], [false, false]]);
  assert.equal(bookingBodyVerdict(b.posts[1].body, rec.rules.marker).ok, true, "the retry was not the marker body, so it proves nothing");
  assert.match(b.posts[1].stopped, /second booking request: only the first is ever let out/);
  assert.deepEqual(tabs[0].out, [], "a request left the tab");
  assert.equal(JSON.stringify(db.rows), start);
  assert.deepEqual(db.deletes, []);
  assert.equal(rec.rules.cleanup, undefined);
  assert.equal(rec.rules.bookingVerdict.verdict, "inconclusive");
});

test("a form that does not hold the marker, or never becomes interactive, is not pressed", async () => {
  for (const [tab, re] of [[{ mangleName: true }, /does not hold the marker booking/], [{ neverHydrates: true }, /never became interactive/]]) {
    const { h, db, tabs } = rulesHarness({ tab });
    const rec = await driveRules(h, db);
    assert.equal(rec.rules.booking.pressed, false);
    assert.match(rec.rules.booking.why, re);
    assert.deepEqual(tabs[0].out, [], "a request left the tab");
    assert.ok(!h.calls.includes('press form button[type="submit"]'));
    assert.equal(rec.rules.bookingVerdict.verdict, "inconclusive");
  }
});

test("a start the test was not written for sends nothing; approving the possible send is what clears it", async () => {
  const mail = rulesHarness({ names: ["RESEND_KEY", "EMAIL_FROM"] });
  const r1 = await driveRules(mail.h, mail.db);
  assert.equal(r1.stopped && r1.stopped.at, "start", JSON.stringify(r1.stopped));
  assert.match(r1.stopped.msg, /could send by email, which is not approved/);
  assert.match(r1.stopped.msg, /nothing was sent/);
  assert.equal(r1.sent, 0);
  assert.ok(!mail.h.calls.includes("click #stSend"));
  assert.equal(mail.tabs.length, 0);
  const ok = rulesHarness({ names: ["RESEND_KEY", "EMAIL_FROM"] });
  const r2 = await driveRules(ok.h, ok.db, { allow: readAllow("email") });
  assert.equal(r2.stopped, null, JSON.stringify(r2.stopped));
  assert.equal(r2.sent, 1);
  // A row an earlier run left behind stops it too.
  const left = rulesHarness({ rows: [{ id: 5, name: "Canary rules 36299999999", phone: "07700 900999", party_size: 2, booking_date: "2099-12-31", booking_time: "17:00:00" }] });
  const r3 = await driveRules(left.h, left.db);
  assert.equal(r3.stopped.at, "start");
  assert.match(r3.stopped.msg, /from an earlier run of this test/);
  // And the record of the secrets is names alone.
  assert.deepEqual(r2.rules.before.secrets, { ok: true, names: ["EMAIL_FROM", "RESEND_KEY"] });
  assert.ok(!JSON.stringify(r2.rules).includes("re_9Zx") && !JSON.stringify(r2.rules).includes("Q7w2"), "a key's characters reached the record");
});

test("a rules scenario handed no readers never opens a browser", async () => {
  const { h, db } = rulesHarness();
  const rec = await driveRules(h, db, { rules: null });
  assert.match(rec.stopped.msg, /tests the rules rung and was not handed its readers/);
  assert.ok(!h.calls.includes("close"), "a browser was launched without the readers");
  const partial = await driveRules(h, db, { rules: { ...db.io, del: undefined } });
  assert.match(partial.stopped.msg, /not handed its readers/);
});

// ── THE RULES TEST'S WIRING, IN THE CANARY AND THE WORKFLOW ─────────────────

test("the rules test is handed its readers, its one DELETE, the approvals and the run id, and every check is there", () => {
  const branch = CANARY.indexOf("if (UI_ASK) {");
  const gate = CANARY.indexOf("if (!SPEND)");
  const win = CANARY.slice(branch, gate);
  const from = win.indexOf("const rulesIo = RULES ?"), to = win.indexOf("const recoverOnly");
  assert.ok(from > 0 && to > from, "the rules readers are gone");
  const io = win.slice(from, to);
  const enc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const [key, pattern] of [
    ["tables", 'tables: () => call("GET", `/api/site/${encodeURIComponent(CANARY)}/rows`)'],
    ["newest", 'newest: () => call("GET", `/api/site/${encodeURIComponent(CANARY)}/rows/${encodeURIComponent(RULES.table)}?order=id&dir=desc&limit=${NEWEST_ROWS}`)'],
    ["secrets", 'secrets: () => call("GET", `/api/site/${encodeURIComponent(CANARY)}/secrets`)'],
    ["stamp", "site_backends?slug=eq.${encodeURIComponent(CANARY)}&select=notify,notified_at`, { headers: svc }"],
    ["menu", "menu: () => visitorText(`/api/db/${encodeURIComponent(CANARY)}/data/${encodeURIComponent(RULES.record.menu.table)}?${RULES.record.menu.query}`)"],
    ["bookingsRead", "bookingsRead: () => visitorText(`/api/db/${encodeURIComponent(CANARY)}/data/${encodeURIComponent(RULES.table)}?select=*`)"],
    ["surface", "origin: BEFORE.origin, routes: RULES.record.routes"],
    ["del", 'del: (id) => call("DELETE", `/api/site/${encodeURIComponent(CANARY)}/rows/${encodeURIComponent(RULES.table)}/${id}`)'],
  ]) assert.match(io, new RegExp(enc(pattern)), `the ${key} reader is not the one it should be`);
  // The platform record is read for two columns, and never a connection string.
  assert.doesNotMatch(io, /neon_conn|neon_role|site_project/, "the readers reach for a database credential");
  assert.equal((io.match(/site_backends\?[^`]*`/g) || []).length, 1);
  assert.match(io, /site_backends\?slug=eq\.\$\{encodeURIComponent\(CANARY\)\}&select=notify,notified_at`/);
  const run = win.slice(win.indexOf("await runUi("), win.indexOf("\n", win.indexOf("await runUi(")));
  for (const k of ["rules: rulesIo", "allow: ALLOW", "runId: RUN_ID", "siteOrigin: BEFORE.origin"]) assert.ok(run.includes(k), `${k} is not handed to the driver`);
  // THE PAGE LIST IS READ BEFORE THE REFUSAL THAT GUARDS THE BROWSER, so a site
  // the app cannot route on never has the browser opened on it.
  const pl = win.indexOf("the app can read the site's page list");
  assert.ok(pl > 0 && pl < win.indexOf("if (failed)"), "the page list is not read before the browser opens");
  assert.match(win.slice(win.indexOf("if (RULES) {"), pl), /readRoutes\(rr\.status, rr\.json\)/);
  // Every check the proposal names.
  for (const needle of ["R.start.checks", "requestVerdict(s, UI_ASK.scenario)", "cl && cl.ok", "bk.posts.length === 1 && post && post.sent === true",
    "bookingBodyVerdict(post.body, R.marker)", 'v.verdict === "pass"', "bk.message.success === false", "ins && ins.ok", "x.verified && x.verified.ok",
    "a0.stamp.notifiedAt === b0.stamp.notifiedAt", "a0.menu.sha256 === b0.menu.sha256", "a0.bookingsRead.message === rr.message",
    "post.sent === false && !d.response", "d.aborted.length", "da.count === b0.census.count", "EVIDENCE_BOUNDARY",
    "post && post.exact === true", "post && post.sent === true && post.exact === true"]) {
    assert.ok(win.includes(needle), `the check on ${needle} is gone`);
  }
  // THE OLDER LAYOUT: nothing published is read off the build, the pages, the
  // stylesheet and the stored source, beside the version list and the job's row.
  const legacy = win.slice(win.indexOf("if (legacy) {", win.indexOf("UI_ASK.scenario.publishes === 0")));
  assert.match(legacy, /surfaceSame\(R\.before && R\.before\.surface, R\.after && R\.after\.surface\)/);
  assert.match(legacy, /sourceSame\(BEFORE\.source, after && after\.source\)/);
  assert.match(legacy, /legacyUnpublishedVerdict\(\{ published, jobs: jobRecords, surface, source \}\)/);
  assert.match(legacy, /list && list\.status === 200/);
  // AND THE RECORD CARRIES ROW IDS, NEVER A VISITOR'S ROW.
  assert.match(win, /ui\.rules \? \{ \.\.\.ui, rules: rulesRecordable\(ui\.rules\) \} : ui/, "the rules record is written with its rows");
});

test("the approvals are read whole before the sign-in, refused on an unknown word, and refused beside any other run", () => {
  const signIn = CANARY.indexOf("auth/v1/admin/generate_link");
  const read = CANARY.indexOf("const ALLOW = readAllow(ALLOW_RAW)");
  assert.ok(read > 0 && read < signIn, "the approvals are read after the sign-in");
  // Each refusal is its own block, read landmark to landmark (a `[^}]*` scan
  // stops inside the `${ALLOW.msg}` of the message and proves nothing).
  const block = (head) => {
    const at = CANARY.indexOf(head, read);
    assert.ok(at > read && at < signIn, `no "${head}" before the sign-in`);
    return CANARY.slice(at, CANARY.indexOf("\n}", at));
  };
  const bad = block("if (!ALLOW.ok) {");
  assert.match(bad, /REFUSING THE APPROVALS/);
  assert.match(bad, /process\.exit\(2\)/, "an unknown word does not stop the run");
  assert.match(block("if (ALLOW_RAW && !(UI_ASK && UI_ASK.scenario.rules)) {"), /process\.exit\(2\)/, "approvals beside another run do not stop it");
  assert.match(CANARY, /const ALLOW_RAW = String\(process\.env\.CANARY_ALLOW \|\| ""\)\.trim\(\)/);
  assert.match(CANARY, /const RUN_ID = runIdOf\(process\.env\)/);
  // The form: a box of its own, mapped to the script's variable, and the ten-input cap kept.
  assert.match(FLOW, /\n {6}rules_allow:\n/, "the workflow has no approvals box");
  assert.match(FLOW, /CANARY_ALLOW:\s*\$\{\{\s*github\.event\.inputs\.rules_allow\s*\}\}/);
  const box = FLOW.slice(FLOW.indexOf("\n      rules_allow:\n"), FLOW.indexOf("\n      site:\n"));
  for (const w of ["cleanup", "email", "text", "webhook", "4b-rules-close"]) assert.ok(box.includes(w), `the approvals box does not say ${w}`);
  // An approval never arms spending.
  assert.doesNotMatch(FLOW.match(/CANARY_SPEND:.*/)[0], /rules_allow/, "the approvals box arms the spend switch");
});

// ── TEST 5: A PAGE TAKEN OFF THROUGH THE REAL APP ────────────────────────────
//
// Two messages on the bakery: the gallery out of the menu (a page another page
// still names is refused), then the gallery page off the site. Each message
// may leave the app only as its own kind of edit, so a misrouted one costs its
// routing call and changes nothing. Putting the page back is the restore mode,
// pressed on its own — not part of this scenario.

const T5 = UI_SCENARIOS["5-page-remove"];
const T5_MENU = "Take Gallery out of the menu.";
const T5_REMOVE = "Remove the gallery page.";

test("Test 5 is two messages on the bakery, the menu first and then the page, each walled to its own kind of edit", () => {
  assert.equal(T5.site, "fold-lane-bakery");
  assert.deepEqual(T5.steps.map((s) => s.say), [T5_MENU, T5_REMOVE]);
  assert.deepEqual(T5.steps.map((s) => [...s.layers]), [["nav"], ["page"]]);
  // Before the first Send the scenario's list stands, and it is no wider than
  // its messages together.
  assert.deepEqual([...T5.layers].sort(), [...new Set(T5.steps.flatMap((s) => s.layers))].sort());
  assert.ok(T5.budget >= 4 && T5.budget <= 10, `budget ${T5.budget}`);
  // Nothing here changes a row, closes a table or claims to publish nothing.
  for (const k of ["row", "rules", "publishes", "attach"]) assert.equal(T5[k], undefined, `the scenario carries ${k}`);
  assert.ok(T5.steps.every((s) => !s.attach), "a message carries a file");
  // THE REMOVAL DEPENDS ON THE MENU EDIT, and the dependency is declared, not
  // left to the order of the list: message 2 is sent only once message 1's job
  // stored a menu success.
  assert.equal(T5.steps[0].needs, undefined, "the first message depends on nothing");
  assert.deepEqual({ ...T5.steps[1].needs }, { step: 1, layer: "nav" });
  // And the scenario says what a removal IS, so it passes on the operations.
  assert.deepEqual({ ...T5.removal, link: { ...T5.removal.link } }, { page: "gallery.tsx", route: "/gallery", link: { label: "Gallery", href: "/gallery" } });
  for (const o of [T5, T5.steps, T5.layers, ...T5.steps, ...T5.steps.map((s) => s.layers), T5.steps[1].needs, T5.removal, T5.removal.link]) {
    assert.ok(Object.isFrozen(o), "the scenario can be changed at run time");
  }
  assert.equal(readUiScenario("5-page-remove", "fold-lane-bakery").ok, true);
  assert.equal(readUiScenario("5-page-remove", "fretwork-1").ok, false, "Test 5 runs against another site");
});

test("a message that names its layers is walled to them; before a Send, and for a message that names none, the scenario's list stands", () => {
  const edit = (layer, step, scenario = T5) => ({ method: "POST", pathname: "/api/site/fold-lane-bakery/edit", body: JSON.stringify({ layer, instruction: "x" }), scenario, step });
  const [menu, remove] = T5.steps;
  // The first message: a menu edit and nothing else.
  assert.equal(wallRefusal(edit("nav", menu)), "");
  for (const l of ["page", "look", "text", "data", "rules", "picture", "logo", "rename", "", "addon"]) {
    assert.match(wallRefusal(edit(l, menu)), /does not allow/, `the menu message let out an edit at ${l || "(blank)"}`);
  }
  // The second: a page edit and nothing else.
  assert.equal(wallRefusal(edit("page", remove)), "");
  for (const l of ["nav", "look", "text"]) assert.match(wallRefusal(edit(l, remove)), /does not allow/, `the removal let out an edit at ${l}`);
  // The routing call and every read go out during either message.
  for (const step of [menu, remove]) {
    assert.equal(wallRefusal({ method: "POST", pathname: "/api/site/route", body: "{}", scenario: T5, step }), "");
    assert.equal(wallRefusal({ method: "GET", pathname: "/api/site/edit/abc", scenario: T5, step }), "");
    assert.notEqual(wallRefusal({ method: "POST", pathname: "/api/site/fold-lane-bakery/addon", scenario: T5, step }), "");
  }
  // Before any Send: the scenario's own list.
  for (const step of [null, undefined]) {
    assert.equal(wallRefusal(edit("nav", step)), "");
    assert.equal(wallRefusal(edit("page", step)), "");
    assert.match(wallRefusal(edit("look", step)), /does not allow/);
  }
  // A message that names no layers leaves every other scenario's wall as it was.
  const plain = { say: "x" };
  assert.equal(wallRefusal(edit("data", plain, D1)), "");
  assert.match(wallRefusal(edit("text", plain, D1)), /does not allow/);
  const b = UI_SCENARIOS["4a-part-b"];
  assert.equal(wallRefusal(edit("page", b.steps[2], b)), "");
  assert.notEqual(wallRefusal({ method: "POST", pathname: "/api/site/fold-lane-bakery/addon", scenario: b, step: b.steps[0] }), "");
});

test("the driver walls each message to its own layers from the moment it is sent", async () => {
  const seen = [];
  let wall = null;
  const act = (method, path, body) => new Promise((done) => {
    wall.handler({
      request: () => ({ method: () => method, url: () => ORIGIN + path, postData: () => (body === undefined ? null : JSON.stringify(body)) }),
      abort: async () => done("abort"), fallback: async () => done("fallback"),
    });
  });
  const h = standIn({
    routed: (n) => ({ ok: true, intent: "edit", layer: ["nav", "page"][n], cost: 2 }),
    editBody: (n, said) => ({ layer: ["nav", "page"][n], instruction: said }),
    reply: (n) => [
      { ok: true, layer: "nav", msg: "✅ Updated the menu on 4 pages: Today's bake · The starter · Visit." },
      { ok: true, layer: "page", removed: ["gallery.tsx"], msg: "✅ Took /gallery off the site. Every publish is kept, so say the word if you want it back." },
    ][n],
    // AT EACH SEND, what the wall would do with a menu edit and a page edit.
    onSend: (n) => {
      wall = wall || h.routes.find((r) => typeof r.pattern === "function" && r.pattern(new URL(ORIGIN + "/api/credits")));
      seen.push(Promise.all([
        act("POST", "/api/site/fold-lane-bakery/edit", { layer: "nav", instruction: T5.steps[n].say }),
        act("POST", "/api/site/fold-lane-bakery/edit", { layer: "page", instruction: T5.steps[n].say }),
        act("POST", "/api/site/route", { message: T5.steps[n].say }),
      ]).then((d) => [n, ...d]));
    },
  });
  const rec = await drive(h, { scenario: T5 });
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  assert.equal(rec.sent, 2);
  assert.deepEqual(rec.steps.map((s) => s.reply), [
    "✅ Updated the menu on 4 pages: Today's bake · The starter · Visit.",
    "✅ Took /gallery off the site. Every publish is kept, so say the word if you want it back.",
  ]);
  assert.deepEqual(await Promise.all(seen), [[0, "fallback", "abort", "fallback"], [1, "abort", "fallback", "fallback"]]);
  assert.deepEqual(rec.blocked.map((b) => b.why), [
    "an edit at the page layer, which this scenario does not allow",
    "an edit at the nav layer, which this scenario does not allow",
  ]);
  // The removal went out because the menu message's job stored a menu success.
  assert.deepEqual(rec.steps[1].dependency, { ok: true, why: "" });
});

// ── THE SECOND MESSAGE WAITS FOR THE FIRST TO HAVE DONE ITS WORK ─────────────
//
// Run 47 sent "Remove the gallery page." after a menu edit that had answered
// `look/no-change`: it paid its routing call and was refused `kept`, as
// designed, and the harness printed "UI MODE PASSED". A dependent message is
// now sent only once the message it depends on stored a success at its layer.

const RUN47_MENU = { ok: false, error: "no-change", cost: 0, unchanged: true, msg: "I couldn't work out how to change the site's look that way. Say which part — a colour, the fonts, a section — and what it should look like." };
const stepWith = (n, reply, extra = {}) => ({
  n, sent: true, completed: true,
  network: reply === undefined ? [] : [{ method: "GET", path: "/api/site/edit/j", status: 200, final: true, res: reply }],
  ...extra,
});

test("a dependent message may go only once the one it needs stored a success at that message's layer", () => {
  const needs = T5.steps[1].needs;
  assert.deepEqual(dependencyVerdict([], null), { ok: true, why: "" });
  assert.deepEqual(dependencyVerdict([stepWith(1, { ok: true, layer: "nav", links: [] })], needs), { ok: true, why: "" });
  for (const [steps, why] of [
    [[], /message 1 was not sent/],
    [[{ n: 1, sent: false }], /message 1 was not sent/],
    [[stepWith(1, { ok: true, layer: "nav" }, { completed: false })], /reply never came/],
    [[stepWith(1, undefined)], /no stored reply/],
    // RUN 47'S OWN MENU REPLY, verbatim.
    [[stepWith(1, RUN47_MENU)], /did not do its work \(no-change\)/],
    [[stepWith(1, { ok: true, layer: "look" })], /succeeded at look, not at nav/],
    [[stepWith(1, { ok: true })], /succeeded at no layer/],
    // Truthiness is not a success: the edit reader's own rule.
    [[stepWith(1, { ok: "true", layer: "nav" })], /did not do its work/],
  ]) {
    const v = dependencyVerdict(steps, needs);
    assert.equal(v.ok, false, JSON.stringify(steps));
    assert.match(v.why, why);
  }
  // The stored reply is the LAST final answer the page read (a hop's own job).
  const hop = stepWith(1, { ok: false, escalate: true, layer: "nav" });
  hop.network.push({ method: "GET", path: "/api/site/edit/k", status: 200, final: true, res: { ok: true, layer: "nav" } });
  assert.deepEqual(finalReplyOf(hop), { ok: true, layer: "nav" });
  assert.equal(dependencyVerdict([hop], needs).ok, true);
});

test("RUN 47's SHAPE: the menu message answers no-change, so the removal is never typed or sent, and the run says why", async () => {
  const h = standIn({
    routed: (n) => ({ ok: true, intent: "edit", layer: ["nav", "page"][n], cost: 2 }),
    editBody: (n, said) => ({ layer: ["nav", "page"][n], instruction: said }),
    reply: () => RUN47_MENU,
  });
  const rec = await drive(h, { scenario: T5 });
  assert.equal(rec.sent, 1, "the dependent message was sent");
  assert.equal(h.calls.filter((c) => c === "click #stSend").length, 1);
  assert.ok(!h.calls.includes("fill " + T5_REMOVE), "the removal was typed");
  assert.equal(rec.stopped.at, "step 2");
  assert.match(rec.stopped.msg, /message 1 did not do its work \(no-change\) — message 2 depends on it and is NOT sent/);
  assert.equal(rec.steps[1].sent, undefined);
  assert.deepEqual(rec.steps[1].dependency, { ok: false, why: "message 1 did not do its work (no-change)" });
  // THE EVIDENCE IS KEPT: the first message's routing call, its edit and its
  // job's stored reply are all on the record.
  const net = rec.steps[0].network;
  assert.ok(net.some((e) => e.path === "/api/site/route" && e.method === "POST"));
  assert.ok(net.some((e) => /\/edit$/.test(e.path) && e.method === "POST"));
  assert.deepEqual(finalReplyOf(rec.steps[0]), RUN47_MENU);
  // Only ONE routing call was made in the whole run: nothing billed for message 2.
  assert.equal(rec.network.filter((e) => e.path === "/api/site/route").length, 1);
  const told = describeUi(rec);
  assert.match(told, /not sent: message 1 did not do its work \(no-change\)/);
  assert.match(told, /STOPPED at step 2/);
});

test("the canary judges Test 5 by its operations — each stored reply, the chain, both source reads and the old address — and keeps the verdict", () => {
  const branch = CANARY.indexOf("if (UI_ASK) {");
  const gate = CANARY.indexOf("if (!SPEND)");
  assert.ok(branch > 0 && gate > branch, "the mode's branch or the spend gate is gone");
  const win = CANARY.slice(branch, gate);
  const sentGate = win.indexOf("if (SPEND && ui.sent) {");
  const chainAt = win.indexOf("chain = chainVerdict(");
  const at = win.indexOf("if (UI_ASK.scenario.removal) {");
  const end = win.indexOf("if (UI_ASK.scenario.publishes === 0)", at);
  // Inside the paid branch whenever ANY message was sent, after the chain: a
  // run the gate stopped at message 2 still records why it did not pass.
  assert.ok(sentGate > 0 && chainAt > sentGate && at > chainAt && end > at, "the removal is not judged after the chain, inside the paid branch");
  const block = win.slice(at, end);
  assert.match(block, /removalVerdict\(/, "the removal is never judged");
  assert.match(block, /ui\.steps\[i\] && ui\.steps\[i\]\.sent \? finalReplyOf\(ui\.steps\[i\]\) : null/,
    "the replies are not each message's own stored reply, or a message that was never sent reads as one");
  assert.match(block, /\bchain,/, "the chain is not handed to the verdict");
  assert.match(block, /complete: BEFORE\.readsComplete === true/, "the before-read's completeness is not carried");
  assert.match(block, /complete: after\.readsComplete === true/, "the after-read's completeness is not carried");
  assert.match(block, /redirect: "manual"/, "the old address is read by following its redirect");
  assert.match(block, /for \(const c of removal\.checks\) check\(c\.name, c\.ok, c\.why\)/, "a removal check does not fail the run");
  // KEPT: ui.json carries the verdict, and ui.txt says whether the removal happened.
  const write = win.slice(win.indexOf("writeFileSync(`${EVID}/ui.json`"));
  // The additions batch's verdict rides beside it (2026-10-02), so the record
  // is read for the removal's own key rather than for the object's last brace.
  assert.match(write, /chain, removal(, additions)? \}/, "ui.json does not carry the removal verdict");
  assert.match(write, /page removal \$\{removal\.ok \? "HAPPENED" : "DID NOT HAPPEN"\}/, "ui.txt does not say whether the removal happened");
  assert.match(CANARY, /import \{ removalVerdict \} from "\.\/canary-remove\.mjs"/);
  // The evidence upload runs on a failed run too.
  assert.match(FLOW, /- name: keep the evidence\n\s+if: always\(\)/, "the evidence is not kept when the run fails");
});

test("a rehearsal of Test 5 types the menu message and sends nothing, behind the scenario's own list", async () => {
  const h = standIn();
  const rec = await drive(h, { scenario: T5, spend: false });
  assert.equal(rec.sent, 0);
  assert.equal(rec.stopped.at, "rehearsal");
  assert.ok(h.calls.includes("fill " + T5_MENU), "the menu message was not typed");
  assert.ok(!h.calls.includes("click #stSend"), "the rehearsal pressed Send");
  const wall = h.routes.find((r) => typeof r.pattern === "function" && r.pattern(new URL(ORIGIN + "/api/credits")));
  const act = (layer) => new Promise((done) => wall.handler({
    request: () => ({ method: () => "POST", url: () => ORIGIN + "/api/site/fold-lane-bakery/edit", postData: () => JSON.stringify({ layer }) }),
    abort: async () => done("abort"), fallback: async () => done("fallback"),
  }));
  assert.deepEqual([await act("nav"), await act("page"), await act("look")], ["fallback", "fallback", "abort"]);
});

// ── TEST 9: A FOLLOW-UP AFTER A FAILURE, IN THE SAME TAB ────────────────────
//
// fretwork-1's lessons, as the stand-in's database; the first message's job
// answers the data step's own no-match (a 422, refunded), and the second's
// changes one price. The run keeps what the second message changed, so its
// PATCH must never be called at all.

const T9 = UI_SCENARIOS["9-follow-up"];
const T9_FAIL = "We've stopped running the Weekend workshop, please take it off the price list.";
const T9_SAY = "Please change the Hour one-to-one's price to £45.";
const T9_SITE = "https://fretwork-1.gofarther.app";
const NO_MATCH_MSG = "I couldn't match that to anything the site stores — say which list it's in and I'll have another go.";
// THE POLL ROUTE'S ANSWER for a refunded job: the handler's stored reply, its
// cost taken from the job's row (0 once refunded) and the refund named.
const T9_NO_MATCH = { ok: false, error: "no-match", cost: 0, refunded: 1, usage: { in: 900, out: 13 }, msg: NO_MATCH_MSG };
const T9_DONE = { ok: true, layer: "data", applied: [{ table: "lessons", id: 4, columns: ["price"] }], failed: 0, cost: 1, msg: "✅ Updated one entry in lessons." };
// What the app draws for each: `editAnswer`'s warning and money, or the success sentence.
const t9Screen = (n, reply) => (reply.ok === false ? "⚠️ " + reply.msg + " This edit cost you nothing. Reading your message cost 2 credits." : reply.msg);

function lessons(calls, rows = T9.row.record) {
  const db = { rows: JSON.parse(JSON.stringify(rows)), patches: [] };
  // The owner route answers a NUMERIC price as text; the visitor route as the Data API serves it.
  db.owner = async () => { calls.push("owner read"); return { status: 200, json: { rows: db.rows.map((r) => ({ ...r, price: String(r.price) })) } }; };
  db.pub = async () => { calls.push("visitor read"); return { status: 200, text: JSON.stringify(db.rows) }; };
  db.patch = async (id, body) => { calls.push(`patch ${id}`); db.patches.push({ id, body }); return { status: 409, json: { code: "conflict" } }; };
  // Each page draws one line per lesson; the home page's carries its button.
  db.lines = (url) => db.rows.map((r) => `${r.name} ${r.duration} ${r.description} £${r.price}${String(url || "").endsWith("/prices") ? "" : " Select"}`);
  db.hour = () => db.rows.find((r) => r.id === 4);
  return db;
}

function t9Harness(opt = {}) {
  let db = null;
  const h = standIn({
    slug: "fretwork-1",
    routed: () => ({ ok: true, intent: "edit", layer: "data", cost: 2 }),
    editBody: (n, said) => ({ layer: "data", instruction: said, idem: "k" + n }),
    reply: (n) => (opt.reply ? opt.reply(n) : n === 0 ? T9_NO_MATCH : T9_DONE),
    finalStatus: (n) => ((opt.reply ? opt.reply(n) : n === 0 ? T9_NO_MATCH : T9_DONE).ok === false ? 422 : 200),
    screen: opt.screen || t9Screen,
    onDone: (n) => (opt.onDone ? opt.onDone(n, db) : n === 1 && (db.hour().price = 45)),
    shown: (url) => (opt.shown ? opt.shown(url, db) : db.lines(url)),
    hangAt: opt.hangAt,
    reloadAfter: opt.reloadAfter,
  });
  db = lessons(h.calls, opt.rows);
  return { h, db };
}
const driveT9 = (h, db, over = {}) => runUi({
  base: ORIGIN, session: SESSION, slug: "fretwork-1", scenario: T9, spend: true, balanceNow: async () => 10,
  evid: "", launch: h.launch, log: () => {}, openMs: 50, attachMs: 50, startMs: 50, stepMs: 60, pollMs: 1, settleMs: 0, shownMs: 50,
  rows: { owner: db.owner, pub: db.pub, patch: db.patch }, siteOrigin: T9_SITE, ...over,
});

test("Test 9 is a failing message and then a follow-up that needs that failure, on fretwork-1, walled to data, with nothing put back", () => {
  assert.equal(readUiScenario("9-follow-up", "fretwork-1").ok, true);
  assert.match(readUiScenario("9-follow-up", "fold-lane-bakery").msg, /fretwork-1/);
  assert.equal(T9.site, "fretwork-1");
  assert.deepEqual(T9.steps.map((s) => s.say), [T9_FAIL, T9_SAY]);
  assert.deepEqual(T9.steps[0].fails, { error: "no-match" });
  assert.equal(T9.steps[0].needs, undefined, "the failing message depends on nothing");
  assert.deepEqual(T9.steps[1].needs, { step: 1, failed: "no-match" });
  assert.equal(T9.steps[1].fails, undefined);
  assert.deepEqual(T9.layers, ["data"]);
  assert.equal(T9.publishes, 0);
  assert.equal(T9.reply, "✅ Updated one entry in lessons.");
  assert.deepEqual(T9.applied, [{ table: "lessons", id: 4, columns: ["price"] }]);
  assert.ok(Number.isFinite(T9.budget) && T9.budget > 0 && T9.budget <= 10, `budget ${T9.budget}`);
  const row = T9.row;
  assert.deepEqual({ table: row.table, id: row.id, name: row.match.name, field: row.field, from: row.from, to: row.to, restore: row.restore },
    { table: "lessons", id: 4, name: "Hour one-to-one", field: "price", from: "42", to: "45", restore: false });
  assert.deepEqual({ path: row.shown.path, also: row.shown.also, sel: row.shown.sel, before: row.shown.before, after: row.shown.after },
    { path: "/prices", also: ["/"], sel: "li > span", before: "£42", after: "£45" });
  assert.ok(row.shown.lead.startsWith(row.match.name + " "), "the lead does not begin with the name");
  // THE RECORD: the three rows run 80 left, and the target is the one named at `from`.
  assert.deepEqual(row.record.map((r) => [r.id, r.name, r.price]), [[1, "First lesson", 0], [3, "One-to-one", 30], [4, "Hour one-to-one", 42]]);
  assert.ok(Object.isFrozen(T9) && Object.isFrozen(T9.steps) && T9.steps.every(Object.isFrozen) && Object.isFrozen(row) && Object.isFrozen(row.shown) && row.record.every(Object.isFrozen));
});

test("a failure is the named one, naming no row, costing the edit nothing, and shown as a warning with its own sentence", () => {
  const step = (reply, screen = t9Screen(0, reply), status = 422) => ({ reply: screen, network: [{ method: "GET", path: "/api/site/edit/j", status, final: true, res: reply }] });
  assert.deepEqual(failureVerdict(step(T9_NO_MATCH), { error: "no-match" }), { ok: true, why: "", error: "no-match", cost: 0, refunded: 1 });
  const bad = [
    [step(T9_DONE, T9_DONE.msg, 200), /succeeded/],
    [step({ ...T9_NO_MATCH, ok: "false" }), /neither success nor failure/],
    [step({ ...T9_NO_MATCH, error: "no-change" }), /failed as no-change, not as no-match/],
    [step({ ...T9_NO_MATCH, applied: [{ table: "lessons", id: 2, removed: true }] }), /names rows it changed/],
    [step({ ...T9_NO_MATCH, cost: 1 }), /cost reads 1, not 0/],
    [step((({ cost, ...r }) => r)(T9_NO_MATCH)), /cost reads null, not 0/],
    [step({ ...T9_NO_MATCH, msg: " " }), /no sentence/],
    // SHOWN, AND AS A WARNING: a page that drew a success, or another sentence, did not show it.
    [step(T9_NO_MATCH, "✅ Done."), /did not show/],
    [step(T9_NO_MATCH, NO_MATCH_MSG), /did not show/],
    [step(T9_NO_MATCH, "⚠️ Something went wrong."), /did not show/],
    [{ reply: "⚠️ " + NO_MATCH_MSG, network: [] }, /no stored reply/],
  ];
  for (const [s, why] of bad) {
    const got = failureVerdict(s, { error: "no-match" });
    assert.equal(got.ok, false, JSON.stringify(s));
    assert.match(got.why, why);
  }
  assert.match(failureVerdict(step(T9_NO_MATCH), {}).why, /no failure named/, "a step with no failure named passes as one");
  // THE REPLIES AS THE PAGE DREW THEM: the warning among them is enough, and
  // a warning that is not this failure's sentence, or the sentence drawn
  // without the warning, is not.
  const warned = "⚠️ " + NO_MATCH_MSG + " This edit cost you nothing.";
  assert.equal(failureVerdict({ ...step(T9_NO_MATCH), replies: ["Checking your lessons…", warned] }, { error: "no-match" }).ok, true);
  assert.match(failureVerdict({ ...step(T9_NO_MATCH), replies: ["Checking your lessons…", NO_MATCH_MSG] }, { error: "no-match" }).why, /did not show/);
  assert.match(failureVerdict({ ...step(T9_NO_MATCH), replies: ["⚠️ Something else went wrong.", NO_MATCH_MSG] }, { error: "no-match" }).why, /did not show/);
});

test("the follow-up goes only after the failure it follows, and only once the table read after it is the baseline", () => {
  const failed = { n: 1, sent: true, completed: true, reply: t9Screen(0, T9_NO_MATCH), untouched: { ok: true, why: "unchanged" },
    network: [{ method: "GET", path: "/api/site/edit/j", status: 422, final: true, res: T9_NO_MATCH }] };
  const needs = { step: 1, failed: "no-match" };
  assert.deepEqual(dependencyVerdict([failed], needs), { ok: true, why: "" });
  const cases = [
    [{ ...failed, sent: false }, /was not sent/],
    [{ ...failed, completed: false }, /never came/],
    [{ ...failed, network: [] }, /no stored reply/],
    [{ ...failed, network: [{ ...failed.network[0], status: 200, res: T9_DONE }] }, /not the failure this message follows up \(the message succeeded\)/],
    [{ ...failed, network: [{ ...failed.network[0], res: { ...T9_NO_MATCH, error: "no-change" } }] }, /failed as no-change/],
    [{ ...failed, reply: "✅ Done." }, /did not show/],
    [{ ...failed, untouched: { ok: false, why: "moved" } }, /not known to be as it was \(moved\)/],
    [{ ...failed, untouched: undefined }, /not known to be as it was \(not read\)/],
  ];
  for (const [dep, why] of cases) {
    const got = dependencyVerdict([dep], needs);
    assert.equal(got.ok, false, JSON.stringify(dep));
    assert.match(got.why, why);
  }
  // A dependency on a success is judged as it always was.
  assert.match(dependencyVerdict([failed], { step: 1, layer: "data" }).why, /did not do its work \(no-match\)/);
});

test("a failed message's charge came back only when its job says refunded and its ledger nets to nothing", () => {
  const jr = (over = {}) => ({ job: "j", row: { billing: "refunded", cost: 1, ...over.row }, ledgerRead: { ok: true }, ledger: over.ledger || [{ delta: -1 }, { delta: 1 }] });
  assert.deepEqual(refundedVerdict(jr()), { ok: true, why: "", reserved: 1, refunded: 1 });
  for (const [x, why] of [
    [jr({ ledger: [{ delta: -1 }] }), /reserved 1 and got 0 back/],
    [jr({ ledger: [] }), /reserved nothing/],
    [jr({ row: { billing: "finalized" } }), /finalized, not refunded/],
    [jr({ row: { billing: "none" } }), /none, not refunded/],
    [{ ...jr(), ledgerRead: { ok: false } }, /could not be read/],
    [jr({ ledger: [{ delta: "x" }] }), /no amount/],
    [{ job: "j" }, /no readable row/],
    [null, /no readable row/],
  ]) {
    const got = refundedVerdict(x);
    assert.equal(got.ok, false, JSON.stringify(x));
    assert.match(got.why, why);
  }
});

test("the same tab is the marked document: a lost mark or a new document start is another tab", () => {
  const opened = { mark: "a".repeat(24), origin: 1234.5, path: "/projects" };
  assert.equal(sameTab(opened, { ...opened }), true);
  assert.equal(sameTab(opened, { ...opened, path: "/projects/srv_fretwork-1" }), true, "a move inside the app is the same document");
  assert.equal(sameTab(opened, { ...opened, mark: "" }), false);
  assert.equal(sameTab(opened, { ...opened, origin: 1235.5 }), false);
  assert.equal(sameTab({ ...opened, mark: "short" }, { ...opened, mark: "short" }), false, "a mark too short to be the run's own");
  assert.equal(sameTab({ ...opened, origin: NaN }, { ...opened, origin: NaN }), false);
  assert.equal(sameTab(null, opened), false);
  assert.equal(sameTab(opened, null), false);
});

test("TEST 9 END TO END: the failure is shown and changes nothing, the follow-up goes from the same tab and makes its one change, and nothing is written back", async () => {
  const { h, db } = t9Harness();
  const rec = await driveT9(h, db);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  assert.equal(rec.sent, 2);
  const [one, two] = rec.steps;
  // MESSAGE 1: the failure, shown, and the table read against the baseline before message 2.
  assert.equal(one.reply, "⚠️ " + NO_MATCH_MSG + " This edit cost you nothing. Reading your message cost 2 credits.");
  assert.deepEqual(one.failure, { ok: true, why: "", error: "no-match", cost: 0, refunded: 1 });
  assert.deepEqual(one.untouched, { ok: true, why: "unchanged" });
  assert.equal(requestVerdict(one, T9).ok, true, JSON.stringify(requestVerdict(one, T9)));
  // MESSAGE 2: sent only after that, from the tab the run opened.
  assert.deepEqual(two.dependency, { ok: true, why: "" });
  assert.equal(sameTab(rec.tab, two.tabAtSend), true);
  assert.deepEqual([one.sameTab, two.sameTab], [true, true]);
  assert.equal(rec.tab.mark.length, 24);
  const sends = h.calls.map((c, i) => [c, i]).filter(([c]) => c === "click #stSend").map(([, i]) => i);
  assert.equal(sends.length, 2);
  const between = h.calls.slice(sends[0], sends[1]);
  assert.ok(between.includes("owner read") && between.includes("visitor read"), "the table was not read between the failure and the follow-up");
  assert.equal(requestVerdict(two, T9).ok, true);
  assert.equal(storedReplyVerdict(two, T9).ok, true);
  assert.equal(two.reply, T9.reply);
  // ITS ONE CHANGE, on both readers and on both pages that show the row.
  const r = rec.row;
  assert.deepEqual({ exact: r.change.exact, before: r.change.target.before, after: r.change.target.after }, { exact: true, before: "42", after: "45" });
  assert.equal(r.visitorChange.exact, true);
  assert.deepEqual({ ok: r.shown.afterEdit.verdict.ok, url: r.shown.afterEdit.url }, { ok: true, url: T9_SITE + "/prices" });
  assert.match(r.shown.afterEdit.target, /not enough\. £45$/);
  assert.equal(r.also.length, 1);
  assert.deepEqual({ path: r.also[0].path, before: r.also[0].before.verdict.ok, after: r.also[0].afterEdit.verdict.ok, url: r.also[0].afterEdit.url },
    { path: "/", before: true, after: true, url: T9_SITE + "/" });
  assert.match(r.also[0].afterEdit.target, /£45 Select$/);
  // NOTHING WRITTEN BACK, AND NO WRITE ASKED: no probe, no plan, no PATCH at all.
  assert.deepEqual(db.patches, []);
  assert.ok(!h.calls.some((c) => c.startsWith("patch ")));
  assert.equal(r.capability, undefined);
  assert.equal(r.planAtBaseline, undefined);
  assert.equal(r.writes, undefined);
  assert.match(r.restore.skipped, /no recovery/);
  assert.equal(r.shown.afterRestore, undefined);
  assert.equal(db.hour().price, 45, "the change was put back");
  const told = describeUi(rec);
  assert.match(told, /failure: no-match, shown as a warning, the edit's own cost 0/);
  assert.match(told, /the table after it: the baseline, on both readers, byte for byte/);
  assert.match(told, /sent from the tab the run opened; the reply read in that same tab, never reloaded/);
  assert.match(told, /price 42 -> 45, and kept: no recovery/);
  assert.match(told, /EXACT: the one expected change and nothing else/);
});

test("a first message that succeeds, fails another way, is not shown, or moves the table: the follow-up is never typed or sent", async () => {
  const hourGone = (n, db) => { if (n === 0) db.rows = db.rows.filter((r) => r.id !== 4); };
  for (const [opt, why] of [
    // THE PICKER TOOK A ROW OFF after all: a success, so there is no failure to follow up.
    [{ reply: (n) => (n === 0 ? { ok: true, layer: "data", applied: [{ table: "lessons", id: 4, removed: true }], failed: 0, cost: 1, msg: "✅ Removed one entry from lessons." } : T9_DONE), onDone: hourGone }, /the message succeeded/],
    [{ reply: (n) => (n === 0 ? { ...T9_NO_MATCH, error: "send", msg: "I couldn't reach the model that makes that change — try again in a moment." } : T9_DONE) }, /failed as send, not as no-match/],
    [{ screen: (n, reply) => (reply.ok === false ? "✅ Done." : reply.msg) }, /did not show/],
    // A FAILURE THAT STILL MOVED A ROW is not the failure a follow-up is sent after.
    [{ onDone: (n, db) => { if (n === 0) db.rows[0].price = 5; } }, /not known to be as it was \(moved\)/],
  ]) {
    const { h, db } = t9Harness(opt);
    const rec = await driveT9(h, db);
    assert.equal(rec.sent, 1, JSON.stringify(rec.stopped));
    assert.equal(rec.stopped.at, "step 2");
    assert.match(rec.stopped.msg, why);
    assert.match(rec.stopped.msg, /message 2 depends on it and is NOT sent/);
    assert.ok(!h.calls.includes("fill " + T9_SAY), "the follow-up was typed");
    assert.equal(h.calls.filter((c) => c === "click #stSend").length, 1);
    // What the first message did is read and reported, and nothing is written back.
    assert.equal(rec.row.change.exact, false);
    assert.deepEqual(db.patches, []);
    assert.match(rec.row.restore.skipped, /no recovery/);
  }
});

test("a page that reloads after the failure gets no follow-up: message 2 would not be from the same tab", async () => {
  const { h, db } = t9Harness({ reloadAfter: 0 });
  const rec = await driveT9(h, db);
  assert.equal(rec.sent, 1);
  assert.equal(rec.steps[0].sameTab, false, "the reload was not seen after the reply");
  assert.equal(rec.stopped.at, "step 2");
  assert.match(rec.stopped.msg, /no longer the tab the run opened \(it reloaded or left\), so message 2 is NOT sent/);
  assert.equal(h.calls.filter((c) => c === "click #stSend").length, 1);
  assert.match(describeUi(rec), /the reply NOT read in the tab the run opened/);
  assert.deepEqual(db.patches, []);
});

test("a reply that never comes to the follow-up writes nothing, and says what is not known", async () => {
  const { h, db } = t9Harness({ hangAt: 1 });
  const rec = await driveT9(h, db);
  assert.equal(rec.sent, 2);
  assert.equal(rec.steps[1].completed, false);
  assert.match(rec.stopped.msg, /outcome is unknown/);
  assert.match(rec.row.restore.skipped, /not known yet — and nothing is written either way/);
  assert.equal(rec.row.after, undefined, "the table was read while the job could still be writing");
  assert.deepEqual(db.patches, []);
});

test("the rehearsal reads the table and both pages, asks no conditional write, and types the failing message without sending it", async () => {
  const { h, db } = t9Harness();
  const rec = await driveT9(h, db, { spend: false });
  assert.equal(rec.stopped.at, "rehearsal");
  assert.equal(rec.sent, 0);
  assert.ok(h.calls.includes("fill " + T9_FAIL));
  assert.ok(!h.calls.includes("click #stSend"));
  assert.deepEqual(db.patches, [], "the rehearsal asked a write");
  assert.equal(rec.row.baselineVerdict.ok, true);
  assert.equal(rec.row.record.same, true, "the baseline is not the recorded table");
  assert.equal(rec.row.shown.before.verdict.ok, true);
  assert.deepEqual(rec.row.also.map((v) => [v.path, v.before.verdict.ok]), [["/", true]]);
  assert.equal(rec.row.capability, undefined);
  assert.equal(rec.row.planAtBaseline, undefined);
  // The pages first, then both readers last, then nothing before the stop.
  const pages = h.calls.filter((c) => c.startsWith("goto " + T9_SITE));
  assert.deepEqual(pages, ["goto " + T9_SITE + "/prices", "goto " + T9_SITE + "/"]);
  assert.ok(h.calls.lastIndexOf("goto " + T9_SITE + "/") < h.calls.indexOf("owner read"), "a page was read after the baseline");
});

test("a start the test was not written for sends nothing: the price, the row, or either page", async () => {
  const at = (p) => T9.row.record.map((r) => (r.id === 4 ? { ...r, price: p } : r));
  for (const [opt, why] of [
    [{ rows: at(40) }, /unexpected-value/],
    [{ rows: T9.row.record.filter((r) => r.id !== 4) }, /row-missing/],
    [{ shown: (url, db) => (url.endsWith("/prices") ? db.lines(url).map((l) => l.replace("£42", "£40")) : db.lines(url)) }, /the \/prices page does not show Hour one-to-one at £42/],
    [{ shown: (url, db) => (url.endsWith("/prices") ? db.lines(url) : []) }, /the \/ page does not show Hour one-to-one at £42 \(the page never drew a card/],
  ]) {
    const { h, db } = t9Harness(opt);
    const rec = await driveT9(h, db);
    assert.equal(rec.sent, 0, JSON.stringify(opt));
    assert.equal(rec.stopped.at, "baseline");
    assert.match(rec.stopped.msg, why);
    assert.deepEqual(db.patches, []);
  }
});

test("a row this run keeps is never written: a PATCH that some path asked for is refused before it leaves, and counted", async () => {
  // The driver's own guard, reached on purpose: a spec that keeps its row but
  // is handed to the standalone recovery (no messages) would PATCH there.
  const { h, db } = t9Harness();
  const keepNoSteps = { ...T9, steps: [] };
  const rec = await driveT9(h, db, { scenario: keepNoSteps });
  assert.deepEqual(db.patches, [], "a PATCH reached the owner route");
  assert.ok(rec.row.writes >= 1, "the refused write was not counted");
  assert.equal(rec.row.capability.ok, false, "a refused probe read as a Worker that enforces its condition");
});

test("the canary judges Test 9 by the failure, the table after it, the tab, the one change on both pages, and the refund", () => {
  const branch = CANARY.indexOf("if (UI_ASK) {");
  const gate = CANARY.indexOf("if (!SPEND)");
  const win = CANARY.slice(branch, gate);
  const at = win.indexOf("if (SPEND && FOLLOW) {");
  assert.ok(at > 0, "the follow-up has no checks of its own");
  const follow = win.slice(at, win.indexOf("} else if (SPEND) {", at));
  for (const needle of ["failureVerdict(f, fails)", "f.untouched && f.untouched.ok", "sameTab(ui.tab, g.tabAtSend)", "requestVerdict(f, UI_ASK.scenario)",
    "requestVerdict(g, UI_ASK.scenario)", "g.reply === UI_ASK.scenario.reply", "storedReplyVerdict(g, UI_ASK.scenario)", "r.change && r.change.exact",
    "r.visitorChange && r.visitorChange.exact", 'shownOk("afterEdit")', 'alsoOk(v, "afterEdit")']) {
    assert.ok(follow.includes(needle), `the follow-up's check on ${needle} is gone`);
  }
  // Its refund is read with the money, from each failing message's own job.
  const pub0 = win.indexOf("UI_ASK.scenario.publishes === 0");
  const money = win.slice(pub0);
  assert.ok(money.indexOf("refundedVerdict(mine[0])") > money.indexOf("moneyVerdict("), "the refund is not read with the money");
  assert.match(money, /each\.every\(\(s\) => Array\.isArray\(s\.jobs\) && s\.jobs\.length === 1\) && jobs\.length === each\.length/, "a message may file other than one job");
  // Every message's reply is read in the tab the run opened, and a run that
  // keeps its row asks no conditional write and plans no recovery.
  assert.match(win, /check\(`message \$\{s\.n\}'s reply was read in the tab the run opened, never reloaded`, s\.sameTab === true/);
  assert.match(win, /if \(ROW\.restore === false\) \{\s*check\("this run made no write of its own/);
  assert.match(CANARY, /import \{ failureVerdict, refundedVerdict, sameTab \} from "\.\/canary-ui\.mjs"/);
});

// ── REQUEST MODE (2026-10-03, the owner's review: *"Adapt the UI canary for
// request mode on this branch before rollout, rather than leaving that
// implementation until after deployment."*) — a message the server takes on
// as a request: the page posts no edit, draws the request's card and follows
// it; the canary follows it too, walls its parts with the request's own Stop,
// and reads its jobs off the request's own view.

const KEY_N = (n) => "rqcanary" + "0".repeat(11) + n;
const LOGO_ONLY = { site: "fold-lane-bakery", budget: 20, layers: ["logo"], steps: [{ say: "Use this picture as the logo.", attach: FIXTURE }] };

test("request mode, pure: the routing answer names the request; a card is not a reply; the request's jobs are every id it filed; the wall's own Stop is let out for this site alone, and the go-ahead never", () => {
  const net = [{ method: "POST", path: "/api/site/route", res: { ok: true, intent: "edit", layer: "logo", request: { key: KEY_N(1) } } }];
  assert.equal(requestKeyOf(net), KEY_N(1));
  assert.equal(requestKeyOf([{ method: "POST", path: "/api/site/route", res: { ok: true, intent: "edit" } }]), "");
  assert.equal(requestKeyOf([{ method: "POST", path: "/api/site/route", res: { request: { key: "short" } } }]), "");
  assert.equal(requestKeyOf(null), "");
  const msgs = [{ who: "u", text: "x" }, { who: "a", busy: false, card: true, text: "x Queued" }, { who: "a", busy: false, text: "✅ Done." }];
  assert.deepEqual(newReplies(1, msgs).map((m) => m.text), ["✅ Done."]);
  assert.deepEqual(requestJobsOf({ parts: [{ ids: ["a", "b"] }, { ids: [] }, { ids: ["c", 7, ""] }] }), ["a", "b", "c"]);
  assert.deepEqual(requestJobsOf(null), []);
  // THE WALL'S OWN DOOR: a stop of this site's request; another site's, or any other DELETE, is refused.
  const sc = UI_SCENARIOS["4b-d1-price"];
  assert.equal(wallRefusal({ method: "DELETE", pathname: "/api/site/request/fold-lane-bakery/" + KEY_N(1), scenario: sc }), "");
  assert.match(wallRefusal({ method: "DELETE", pathname: "/api/site/request/fretwork-1/" + KEY_N(1), scenario: sc }), /fretwork-1/);
  assert.match(wallRefusal({ method: "DELETE", pathname: "/api/site/fold-lane-bakery/rows/loaves/6", scenario: sc }), /never makes/);
  // THE FULL REWRITE'S GO-AHEAD is work no scenario asks for, on every scenario.
  for (const name of Object.keys(UI_SCENARIOS)) {
    assert.equal(blocksPost("POST", "/api/site/request/fold-lane-bakery/" + KEY_N(1) + "/approve", UI_SCENARIOS[name]), true, name);
  }
});

test("request mode, pure: the wall names the first part routed where the message may not go, or left waiting for the go-ahead", () => {
  const sc = { site: "fold-lane-bakery", layers: ["data"] };
  const view = (parts) => ({ parts });
  assert.equal(requestWall(view([{ n: 0, status: "queued", route: "data" }, { n: 1, status: "blocked" }]), sc, null), null);
  assert.deepEqual(requestWall(view([{ n: 0, status: "done", route: "data" }, { n: 1, status: "queued", route: "page" }]), sc, null), { n: 1, why: "a part routed to the page layer, which this scenario does not allow" });
  assert.match(requestWall(view([{ n: 0, status: "queued", route: "addon" }]), sc, null).why, /add-on step/);
  assert.match(requestWall(view([{ n: 0, status: "approval" }]), sc, null).why, /go-ahead/);
  // A MESSAGE'S OWN LAYERS WIN OVER THE SCENARIO'S.
  assert.equal(requestWall(view([{ n: 0, status: "queued", route: "nav" }]), { site: "x", layers: ["nav", "page"] }, { layers: ["nav"] }), null);
  assert.ok(requestWall(view([{ n: 0, status: "queued", route: "page" }]), { site: "x", layers: ["nav", "page"] }, { layers: ["nav"] }));
  // AN ADDITIONS SCENARIO: the add-on step, and an edit only as its hand-over.
  const adds = UI_SCENARIOS["12-additions"];
  assert.equal(requestWall(view([{ n: 0, status: "queued", route: "addon" }]), adds, adds.steps[0]), null);
  assert.equal(requestWall(view([{ n: 0, status: "queued", route: "nav", addition: true }]), adds, adds.steps[0]), null);
  assert.match(requestWall(view([{ n: 0, status: "queued", route: "nav" }]), adds, adds.steps[0]).why, /not an addition/);
  assert.match(requestWall(view([{ n: 0, status: "queued", route: "nav", addition: true }]), adds, adds.steps[3]).why, /nav layer/);
});

test("request mode, pure: the verdict is one routing call with the words, no edit from the page, and the request ended with every part done where allowed", () => {
  const sc = { site: "fold-lane-bakery", layers: ["logo"] };
  const say = "Use this picture as the logo.";
  const step = (final) => ({ say, network: [{ method: "POST", path: "/api/site/route", req: { message: say }, res: { ok: true, intent: "edit", layer: "logo", cost: 2, request: { key: KEY_N(1) } } }], request: { key: KEY_N(1), final, wall: null } });
  const done = { key: KEY_N(1), ended: true, state: "done", parts: [{ n: 0, status: "done", route: "logo", ids: ["j"] }] };
  assert.equal(requestVerdict(step(done), sc).ok, true);
  assert.equal(requestVerdict(step({ ...done, ended: false, state: "running" }), sc).ok, false, "a request still running passed");
  assert.equal(requestVerdict(step({ ...done, parts: [{ n: 0, status: "failed", route: "logo" }] }), sc).ok, false, "a failed part passed");
  assert.equal(requestVerdict(step({ ...done, parts: [{ n: 0, status: "done", route: "page" }] }), sc).ok, false, "a part done at another layer passed");
  assert.equal(requestVerdict(step(null), sc).ok, false, "a request whose view was never read passed");
  const walled = step(done); walled.request.wall = { n: 0, why: "x" };
  assert.equal(requestVerdict(walled, sc).ok, false, "a request the wall stopped passed");
  const posted = step(done); posted.network.push({ method: "POST", path: "/api/site/fold-lane-bakery/edit", req: { instruction: say, layer: "logo" } });
  assert.equal(requestVerdict(posted, sc).ok, false, "a page that posted an edit beside a request passed");
});

test("request mode end to end: the card is not the reply; the step ends once the request has ended and the page has shown it; its jobs are the request's; the file is on the routing call", async () => {
  const h = standIn({ request: (n) => ({ key: KEY_N(n + 1), route: "logo", reply: { ok: true, layer: "logo", msg: "✅ That's your logo." } }) });
  const rec = await drive(h, { scenario: LOGO_ONLY, viewEveryMs: 0 });
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  const s0 = rec.steps[0];
  assert.equal(s0.reply, "✅ That's your logo.", "the card, or nothing, was taken for the reply");
  assert.equal(s0.request.key, KEY_N(1));
  assert.equal(s0.request.final.ended, true);
  assert.deepEqual(s0.jobs, ["1".padStart(32, "0")]);
  assert.deepEqual(rec.blocked, []);
  assert.equal(h.st.stops, 0, "a request with nothing walled was stopped");
  assert.ok(!s0.network.some((e) => e.method === "POST" && /\/edit$/.test(e.path)), "the page posted an edit");
  const route = s0.network.find((e) => e.path === "/api/site/route");
  assert.equal(route.req.images[0].sha256, FIXTURE_SHA, "the file is not on the routing call");
  assert.equal(requestVerdict(s0, LOGO_ONLY).ok, true, JSON.stringify(requestVerdict(s0, LOGO_ONLY)));
  assert.match(describeUi(rec), new RegExp("request " + KEY_N(1) + ": done, ended — 0:done@logo"));
});

test("request mode's wall: a part routed outside the message's layers is stopped through the request's own Stop at once, recorded, and the step ends with the request stopped", async () => {
  const h = standIn({ request: (n) => ({ key: KEY_N(n + 1), route: "page", reply: { ok: true, layer: "page", msg: "✅ Rewrote it." } }) });
  const rec = await drive(h, { scenario: LOGO_ONLY, viewEveryMs: 0 });
  const s0 = rec.steps[0];
  assert.equal(h.st.stops, 1, "the misrouted part was not stopped exactly once");
  assert.deepEqual(s0.request.wall, { n: 0, why: "a part routed to the page layer, which this scenario does not allow" });
  assert.equal(rec.blocked.length, 1);
  assert.match(rec.blocked[0].path, new RegExp(KEY_N(1)));
  assert.equal(s0.request.final.state, "stopped");
  assert.equal(requestVerdict(s0, LOGO_ONLY).ok, false);
  assert.match(describeUi(rec), /STOPPED BY THE WALL at part 0/);
});

test("request mode's wall: a part left waiting for the full rewrite's go-ahead is stopped, and the go-ahead is never pressed", async () => {
  const h = standIn({ request: (n) => ({ key: KEY_N(n + 1), route: "logo", approval: true, reply: { ok: true, msg: "x" } }) });
  const rec = await drive(h, { scenario: LOGO_ONLY, viewEveryMs: 0 });
  assert.equal(h.st.stops, 1);
  assert.match(rec.steps[0].request.wall.why, /go-ahead/);
  assert.ok(!h.calls.some((c) => /approve/.test(c)), "the go-ahead was pressed");
});

test("request mode, additions: one routing call and nothing posted after it; the one part ran the add-on step, or the edit it handed a frame item to as an addition, and only that step's reply is read", () => {
  const SITE = "fold-lane-bakery";
  const say = "Add Order to the menu.";
  const net = (extra = []) => [{ method: "POST", path: "/api/site/route", req: { message: say }, res: { ok: true, intent: "addon", cost: 2, decision: { source: "model", raw: { intent: "addon" } }, request: { key: KEY_N(2) } } }, ...extra];
  const step = (part, extra) => ({ say, network: net(extra), request: { key: KEY_N(2), final: { key: KEY_N(2), ended: true, state: "done", parts: [part] } }, replies: ["✅ Added Order to the menu."] });
  const hop = { hop: "nav" };
  assert.equal(additionRequestVerdict(step({ n: 0, status: "done", route: "nav", addition: true, ids: ["a", "b"] }), SITE, hop).ok, true);
  assert.equal(additionRequestVerdict(step({ n: 0, status: "done", route: "nav", ids: ["a", "b"] }), SITE, hop).ok, false, "an edit not handed over by the add-on step passed");
  assert.equal(additionRequestVerdict(step({ n: 0, status: "done", route: "addon", ids: ["a"] }), SITE, {}).ok, true);
  assert.equal(additionRequestVerdict(step({ n: 0, status: "failed", route: "addon", ids: ["a"] }), SITE, {}).ok, false);
  assert.equal(additionRequestVerdict(step({ n: 0, status: "done", route: "addon", ids: ["a"] }, [{ method: "POST", path: "/api/site/" + SITE + "/addon", req: { instruction: say } }]), SITE, {}).ok, false, "a page post beside the request passed");
  // ONLY THE STEP THAT ANSWERED IS READ: the hand-over is the server's.
  const fin = (res) => ({ method: "GET", path: "/api/site/edit/b", final: true, res });
  assert.equal(additionReplyVerdict(step({ n: 0 }, [fin({ ok: true, layer: "nav" })]), hop).ok, true);
  assert.equal(additionReplyVerdict(step({ n: 0 }, [fin({ ok: false, layer: "nav", error: "x" })]), hop).ok, false);
});
