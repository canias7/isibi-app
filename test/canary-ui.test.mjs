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
} from "../scripts/canary-ui.mjs";
import { MAX_LOGO_BYTES } from "../builder/site-logo.mjs";

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
    goto: async () => { calls.push("goto"); },
    evaluate: async (fn) => {
      if (fn.name === "cardIdInPage") return st.card ? "srv_fold-lane-bakery" : "";
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
        st.messages.push({ who: "u", busy: false, text: st.value });
        const n = st.step++;
        const images = st.attached ? [{ name: "ui-logo.png", data: "data:image/png;base64," + fs.readFileSync(ROOT + FIXTURE).toString("base64") }] : undefined;
        st.value = ""; st.attached = 0; st.strip = 0; st.busy = true;
        const job = String(n + 1).padStart(32, "0");
        await respond("POST", "/api/site/route", 200, { message: "…", attached: !!images }, { ok: true, intent: "edit", layer: ["logo", "picture", "page"][n], cost: 2 });
        await respond("POST", "/api/site/fold-lane-bakery/edit", 202, { layer: "x", images }, { ok: true, job, status: "queued" });
        opt.onSend && opt.onSend(n);
        st.pending = { job, polls: 2, hang: opt.hangAt === n, hop: opt.hopAt === n ? "9".repeat(32) : "", reply: { ok: true, msg: `reply ${n + 1}` } };
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
