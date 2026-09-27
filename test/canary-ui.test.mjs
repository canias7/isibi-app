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
  UI_SCENARIOS, SESSION_KEY, readUiScenario, composerReady, newReplies, budgetRefusal,
  imageFacts, recordableRequest, recordsBody, blocksPost, chainVerdict, runUi, describeUi,
  wallRefusal, requestVerdict, storedReplyVerdict, moneyVerdict, unpublishedVerdict, routeCostsOf,
  conditionProbe,
} from "../scripts/canary-ui.mjs";
import { probeBody } from "../scripts/canary-rows.mjs";
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
  const st = {
    signedIn: opt.signedIn !== false, uid: opt.uid || UID, gate: !!opt.gate, card: opt.card !== false,
    workspace: false, busy: false, messages: [], attached: 0, strip: 0, value: "", pending: null, step: 0, typed: 0,
  };
  const listeners = {};
  const state = () => ({
    signedIn: st.signedIn, uid: st.uid, gate: st.gate, workspace: st.workspace,
    busy: st.busy, send: st.workspace && !st.busy, sendDisabled: st.workspace && !st.busy ? false : null,
    stop: st.workspace && st.busy, textarea: st.workspace, disabled: st.workspace ? false : null,
    value: st.value, working: st.busy ? 1 : 0, attached: st.attached, strip: st.strip,
    messages: st.messages.concat(st.busy ? [{ who: "a", busy: true, text: "Working" }] : []),
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
    goto: async (url) => { calls.push(`goto ${url}`); return { headers: () => ({ "x-site-version": "01790468089054-8btpep" }) }; },
    evaluate: async (fn, arg) => {
      if (fn.name === "cardIdInPage") return st.card ? "srv_fold-lane-bakery" : "";
      // THE SITE'S OWN PAGE (a row scenario reads what a visitor sees there).
      if (fn.name === "shownListInPage") { calls.push(`shown ${arg}`); return opt.shown ? opt.shown() : []; }
      if (fn.name !== "readComposerInPage") throw new Error("unexpected page function " + fn.name);
      if (st.pending && --st.pending.polls <= 0) {
        const p = st.pending; st.pending = null;
        if (!p.hang) {
          if (p.hop) {
            // THE ROUTE HANDED THE EDIT TO ANOTHER LAYER: the first job's
            // stored reply escalates, and the page files a second edit, as
            // `escalatedEdit` does, whose own job then answers.
            await respond("GET", `/api/site/edit/${p.job}`, 200, null, { ok: false, escalate: true, layer: "page", cost: 0 }, { "x-gf-edit": "final" });
            await respond("POST", "/api/site/fold-lane-bakery/edit", 202, { layer: "page" }, { ok: true, job: p.hop, status: "queued" });
            await respond("GET", `/api/site/edit/${p.hop}`, 200, null, p.reply, { "x-gf-edit": "final" });
          } else {
            await respond("GET", `/api/site/edit/${p.job}`, 200, null, p.reply, { "x-gf-edit": "final" });
          }
          // THE JOB'S OWN WRITE lands before its reply is on screen, as it does
          // live: the handler writes, then the stored reply is read.
          if (opt.onDone) opt.onDone(p.n);
          st.messages.push({ who: "a", busy: false, text: p.reply.msg || "✅ Done." });
          st.busy = false;
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
        await respond("POST", "/api/site/route", 200, { message: said, attached: !!images },
          opt.routed ? opt.routed(n) : { ok: true, intent: "edit", layer: ["logo", "picture", "page"][n], cost: 2 });
        await respond("POST", "/api/site/fold-lane-bakery/edit", 202, opt.editBody ? opt.editBody(n, said) : { layer: "x", images }, { ok: true, job, status: "queued" });
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
  const browser = { newContext: async () => context, close: async () => { calls.push("close"); } };
  return { st, calls, inits, routes, launch: async () => browser };
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
  const run = (origin, have = null) => {
    const store = new Map(have ? [[SESSION_KEY, have]] : []);
    const saved = ["location", "localStorage"].map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
    const put = (k, value) => Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
    put("location", { origin });
    put("localStorage", { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
    try { fn(arg); } finally {
      for (const [k, d] of saved) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
    }
    return store.get(SESSION_KEY) ?? null;
  };
  assert.equal(run(ORIGIN), arg.value);
  assert.equal(run("https://fold-lane-bakery.gofarther.app"), null, "the session was written into the customer site's origin");
  assert.equal(run(ORIGIN, "rotated"), "rotated", "a session the app already rotated was overwritten");
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
    [{ start: 59, end: 56, routeCosts: [2], jobs: [job({ row: { billing: "refunded" } })] }, /not settled/],
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
  assert.doesNotMatch(win, /api\/site\/route/, "the mode makes its own routing call");
  assert.doesNotMatch(win, /call\("POST"/, "the mode posts on its own rather than through the page");
  // The chain and the money follow every job a message filed, a hand-off's included.
  assert.match(win, /s\.jobs/, "the chain follows only the first job a message filed");
  assert.doesNotMatch(win, /s\.job\b(?!s)/, "the chain still reads a message's first job alone");
  assert.match(CANARY, /import \{ readUiScenario, runUi, describeUi, chainVerdict \} from "\.\/canary-ui\.mjs"/);
});

test("the workflow carries the mode and installs the browser only for it, before the step that launches it", () => {
  assert.match(FLOW, /\n {6}ui_scenario:\n/, "the workflow has no ui_scenario input");
  assert.match(FLOW, /CANARY_UI:\s*\$\{\{\s*github\.event\.inputs\.ui_scenario\s*\}\}/);
  // GitHub caps a dispatch form at ten inputs.
  const inputs = FLOW.slice(FLOW.indexOf("inputs:"), FLOW.indexOf("\njobs:")).match(/\n {6}[a-z_]+:\n/g) || [];
  assert.ok(inputs.length >= 9 && inputs.length <= 10, `${inputs.length} inputs`);
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
  // THE ONLY WRITE THE MODE MAKES ON ITS OWN is that PATCH; the message is the page's.
  assert.deepEqual(win.match(/call\("(POST|PATCH|PUT|DELETE)"/g), ['call("PATCH"'], "the mode writes on its own beyond the one PATCH");
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
