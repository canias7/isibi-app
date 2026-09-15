// FOUR THINGS THAT ONLY GO WRONG WHEN TIME PASSES, driven rather than read.
//
// Everything here is about the gap between a request leaving and its answer
// arriving. A source read cannot see any of it: the code looks identical whether
// or not it checks where it came back to, and every one of these bugs produces a
// screen that is internally consistent and wrong.
//
// **THE AGENT SCREEN IS A CLASSIC SCRIPT, NOT A MODULE**, so it is loaded the way
// the browser loads it — the file is evaluated in one scope with a small DOM and
// a stub `Auth`, and the real `agentSend`, `agentSave`, `agentImport` and
// `agentsLocal` are then called by name. Nothing is re-implemented here; a
// re-implementation would be a second copy of the thing under test, which is the
// one fixture shape this repository has paid for most often.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

/**
 * The scripts the page really loads, in the order it loads them.
 *
 * DERIVED FROM `index.html` rather than listed here, because `chat.js` is a
 * classic script that reads names its siblings define (`SiteList`, the QR
 * library) at load time, and a hand-kept list would go stale the first time the
 * page gains one — silently, as a "not defined" that reads like a broken test.
 *
 * `auth.js` is the ONE exception and is replaced by a stub: these cases are
 * about what happens when the signed-in account CHANGES mid-request, so who is
 * signed in has to be a lever the test can pull.
 */
const PAGE_SCRIPTS = [...fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8")
  .matchAll(/<script src="\/([a-z0-9/.-]+\.js)"><\/script>/g)].map((m) => m[1]);
assert.ok(PAGE_SCRIPTS.length >= 5, `the page's script list read as ${PAGE_SCRIPTS.length} — re-read index.html`);
assert.ok(PAGE_SCRIPTS.includes("chat.js"), "the script census did not find chat.js");

/** Just enough of an element for the agent screen's own reads and writes. */
function el(id) {
  return {
    id, value: "", textContent: "", innerHTML: "", scrollTop: 0, scrollHeight: 0,
    style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    focus() {}, blur() {}, click() {}, selectionStart: 0, selectionEnd: 0, dataset: {},
    appendChild() {}, removeChild() {}, remove() {}, insertBefore() {},
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null,
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 }),
    scrollIntoView() {}, closest: () => null, checked: false, disabled: false, children: [],
  };
}

/**
 * Load `public/chat.js` for real and hand back the pieces these cases drive.
 *
 * `store` is a plain object standing in for `localStorage` — the same surface,
 * so `agentsStored`/`agentsStore` run unmodified. `answer` decides what each
 * `apiFetch` resolves to and, crucially, WHEN: a case can hold a response open,
 * move the screen, and only then let it land.
 */
function loadScreen({ store = {}, uid = "acct-A", answer } = {}) {
  const els = new Map();
  const doc = {
    getElementById: (id) => (els.has(id) ? els.get(id) : (els.set(id, el(id)), els.get(id))),
    querySelector: () => el("shell"),
    querySelectorAll: () => [],
    addEventListener() {}, createElement: () => el("x"), body: el("body"),
    documentElement: el("html"), head: el("head"), title: "",
  };
  let currentUid = uid;
  const calls = [];
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    document: doc,
    localStorage: {
      getItem: (k) => (Object.hasOwn(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    crypto: { randomUUID: () => "id-" + Math.random().toString(16).slice(2) },
    location: { pathname: "/", search: "", href: "https://gofarther.dev/", origin: "https://gofarther.dev" },
    history: { replaceState() {}, pushState() {} },
    navigator: { userAgent: "node", language: "en", clipboard: { writeText: async () => {} } },
    setTimeout, clearTimeout, setInterval, clearInterval, fetch: async () => { throw new Error("no bare fetch"); },
    // The real `Auth`'s surface, as `chat.js` uses it. `userId` is the one this
    // file is about; the rest keep the script from throwing on load.
    Auth: {
      userId: () => currentUid,
      email: () => "you@example.com",
      accessToken: async () => "tok",
      isSignedIn: () => !!currentUid,
      onChange() {}, signOut: async () => {}, session: () => ({ user: { id: currentUid } }),
    },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    requestAnimationFrame: (f) => setTimeout(f, 0),
    URL, URLSearchParams, TextEncoder, Response, Request, Headers, AbortSignal,
    Intl, Date, Math, JSON, confirm: () => true, alert() {}, prompt: () => null,
    getComputedStyle: () => ({ getPropertyValue: () => "", width: "0px", height: "0px" }),
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    Blob, File: globalThis.File, FormData, Image: class {},
    performance, queueMicrotask, structuredClone, btoa, atob,
  };
  sandbox.addEventListener = () => {};
  sandbox.removeEventListener = () => {};
  sandbox.dispatchEvent = () => true;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const src of PAGE_SCRIPTS) {
    if (src === "auth.js") continue;                       // the controllable stub above
    const text = fs.readFileSync(new URL("../public/" + src, import.meta.url), "utf8");
    vm.runInContext(text, sandbox, { filename: src });
  }

  // The screen's own door to the network, replaced AFTER load so the real
  // handlers are the ones under test.
  sandbox.apiFetch = async (path, opts = {}) => {
    calls.push({ path, body: opts.body ? JSON.parse(opts.body) : null });
    return answer(path, opts);
  };
  // **A CLASSIC SCRIPT'S `let` AND `const` ARE NOT PROPERTIES OF THE GLOBAL
  // OBJECT.** They live in the global LEXICAL scope, which is shared between
  // scripts in one context and invisible to `sandbox.whatever` — so reading
  // `agentMsgDrafts` off the sandbox answers `undefined` and writing to it
  // creates a second, unrelated global. Everything below is driven by
  // EVALUATING in the context, which is also what a browser really does.
  const ev = (code) => vm.runInContext(code, sandbox, { filename: "case.js" });
  // **AN ARRAY BUILT INSIDE THE VM IS NOT THIS REALM'S ARRAY.** It has the
  // context's own `Array.prototype`, and `assert.deepEqual` from
  // `node:assert/strict` compares prototypes — so a perfectly correct answer
  // fails with a message about the value, which reads as the product being
  // broken. Structured values cross the boundary as JSON; `ev` stays for side
  // effects and primitives.
  const val = (code) => JSON.parse(ev(`JSON.stringify(${code})`) ?? "null");
  return {
    s: sandbox, store, calls, ev, val,
    signIn: (who) => { currentUid = who; },
    uid: () => currentUid,
  };
}

const okRes = (body) => ({ ok: true, status: 200, json: async () => ({ ok: true, ...body }) });
const badRes = (error, status = 502) => ({ ok: false, status, json: async () => ({ error }) });
/** A response nobody has answered yet, plus the lever that answers it. */
function held(res) {
  let release;
  const p = new Promise((r) => { release = () => r(res); });
  return { p, release };
}

// ────────────────────────────────────────────────────────────────────────────
// SENDING IN A, OPENING B
//
// EVERY CASE DRIVES THE SCRIPT'S OWN SCOPE through `ev`/`val`, never through a
// property on the sandbox. Four of these passed VACUOUSLY when they did the
// latter: `agentEditing = "B"` on the sandbox object creates a second, unrelated
// global while `chat.js`'s `let agentEditing` sits untouched, so the guard read
// its own write back and the product was never asked anything.
// ────────────────────────────────────────────────────────────────────────────

const ROWS = [
  { id: "A", name: "Agent A", instructions: "a", created: 1, updated: 1, preview: "" },
  { id: "B", name: "Agent B", instructions: "b", created: 1, updated: 1, preview: "" },
];
const setRows = (w) => w.ev(`agentRows = ${JSON.stringify(ROWS)};`);

test("⚠ A's answer landing while B is open cannot touch B's messages or its draft", async () => {
  // THE FINDING, END TO END. `agentSend` used to capture nothing: it appended
  // `j.message` onto whatever `agentMsgs` happened to be, so the message typed
  // into A appeared in B's conversation — a message somebody never sent, in a
  // conversation they were reading.
  const gate = held(okRes({ message: { id: "m-A", text: "for A", at: 1 } }));
  const w = loadScreen({ answer: (p) => (p === "/api/agent/message" ? gate.p : okRes({ agents: [] })) });
  setRows(w);

  // In A: type and send. The request leaves; the answer is held.
  w.ev('agentThread = "A"; agentMsgs = []; agentMsgsFor = "A";');
  w.s.document.getElementById("agMsg").value = "for A";
  const sending = w.ev("agentSend()");

  // Move to B and start typing there.
  w.ev('agentThread = "B"; agentMsgs = [{ id: "m-B", text: "already in B", at: 1 }];' +
       'agentMsgsFor = "B"; agentMsgDrafts["B"] = "half a sentence about B";');

  gate.release();
  await sending;

  assert.deepEqual(w.val("agentMsgs.map((m) => m.text)"), ["already in B"],
    "A's message was appended into B's conversation");
  assert.equal(w.ev('agentMsgDrafts["B"]'), "half a sentence about B",
    "B's unsent words were changed by A's answer");
  assert.equal(w.ev("agentThread"), "B", "the screen was moved");
  // A's draft IS cleared, because A's send succeeded — that is the write it is
  // entitled to make, and it lands in A rather than in whatever is on screen.
  assert.equal(w.ev('agentDraftOf("A")'), "", "A's own success did not clear A's draft");
});

test("⚠ a FAILURE for A cannot put an error on B's screen", async () => {
  // The half that reads worst: a red sentence under B's box saying the message
  // could not be sent, about a message sent somewhere else entirely.
  const gate = held(badRes("couldn’t save that just now"));
  const w = loadScreen({ answer: (p) => (p === "/api/agent/message" ? gate.p : okRes({ agents: [] })) });
  setRows(w);
  w.ev('agentThread = "A"; agentMsgs = []; agentMsgsFor = "A";');
  w.s.document.getElementById("agMsg").value = "for A";
  const sending = w.ev("agentSend()");
  w.ev('agentThread = "B"; agentMsgs = []; agentMsgsFor = "B"; agentActErr = "";');
  gate.release();
  await sending;
  assert.equal(w.ev("agentActErr"), "", "A's failure was announced into B's screen");
  // AND THE WORDS ARE STILL IN A. A failed send keeps what was typed — in the
  // conversation it was typed in, so going back to A finds it.
  assert.equal(w.ev('agentDraftOf("A")'), "for A", "A's failed message was lost");
  assert.equal(w.ev('agentDraftOf("B")'), "", "B gained a draft it never had");
});

test("the draft belongs to the conversation, so two threads keep their own", () => {
  const w = loadScreen({ answer: () => okRes({ agents: [] }) });
  w.ev('agentMsgDrafts = { A: "about A", B: "about B" };');
  assert.equal(w.ev('agentDraftOf("A")'), "about A");
  assert.equal(w.ev('agentDraftOf("B")'), "about B");
  assert.equal(w.ev('agentDraftOf("C")'), "", "an untouched conversation has a draft");
  // `Object.hasOwn`, never truthiness: an agent whose id happens to be a
  // prototype key must not read a function back as its draft.
  assert.equal(w.ev('agentDraftOf("constructor")'), "");
  assert.equal(w.ev("agentDraftOf('')"), "");
});

test("a save that lands after the composer moved cannot close it or clear it", async () => {
  const gate = held(badRes("couldn’t save that"));
  const w = loadScreen({ answer: (p) => (/\/(update|create)$/.test(p) ? gate.p : okRes({ agents: [] })) });
  setRows(w);
  w.ev('agentEditing = "A";');
  w.s.document.getElementById("agName").value = "A renamed";
  w.s.document.getElementById("agInstr").value = "new instructions for A";
  const saving = w.ev("agentSave()");

  // Move to editing a different agent and type there.
  w.ev('agentEditing = "B"; agentDraft = { name: "B", instructions: "typing about B" };' +
       'agentDraftFor = "B"; agentActErr = "";');

  gate.release();
  await saving;
  assert.equal(w.ev("agentEditing"), "B", "A's answer closed the composer on B");
  assert.deepEqual(w.val("agentDraft"), { name: "B", instructions: "typing about B" },
    "A's answer threw away what was being typed about B");
  assert.equal(w.ev("agentActErr"), "", "A's failure was announced on B's composer");
});

test("...and a save that lands where it started still reports its failure", async () => {
  // THE CONTROL. Without it every assertion above is satisfied by a `agentSave`
  // that simply stopped doing anything after an await.
  const gate = held(badRes("couldn’t save that"));
  const w = loadScreen({ answer: (p) => (/\/(update|create)$/.test(p) ? gate.p : okRes({ agents: [] })) });
  setRows(w);
  w.ev('agentEditing = "A";');
  w.s.document.getElementById("agName").value = "A renamed";
  w.s.document.getElementById("agInstr").value = "new instructions for A";
  const saving = w.ev("agentSave()");
  gate.release();
  await saving;
  assert.equal(w.ev("agentEditing"), "A", "the composer closed on a failure");
  assert.match(w.ev("agentActErr"), /save/i, "a failure that stayed put said nothing");
  assert.deepEqual(w.val("agentDraft"), { name: "A renamed", instructions: "new instructions for A" },
    "the words that failed were not kept");
});

// ────────────────────────────────────────────────────────────────────────────
// THE ACCOUNT CAN CHANGE MID-FLIGHT TOO
// ────────────────────────────────────────────────────────────────────────────

test("⚠ a list answered for one account cannot fill another account's screen", async () => {
  const gate = held(okRes({ agents: [{ id: "A1", name: "A's agent", instructions: "x", created: 1, updated: 1, preview: "" }] }));
  const w = loadScreen({ uid: "acct-A", answer: () => gate.p });
  w.ev("agentRows = null;");
  const loading = w.ev("agentsLoad()");
  w.signIn("acct-B");                 // the session expired and somebody else signed in
  gate.release();
  await loading;
  assert.equal(w.ev("agentRows"), null, "one account's agents were painted into another's screen");
});

test("...and the same answer DOES fill the account that asked for it", async () => {
  // The control for the case above: without it, an `agentsLoad` that stopped
  // writing rows at all would satisfy it.
  const w = loadScreen({
    uid: "acct-A",
    answer: () => okRes({ agents: [{ id: "A1", name: "A's agent", instructions: "x", created: 1, updated: 1, preview: "" }] }),
  });
  w.ev("agentRows = null;");
  await w.ev("agentsLoad()");
  assert.deepEqual(w.val("agentRows.map((a) => a.id)"), ["A1"], "the list never arrives at all");
  assert.equal(w.ev("agentState"), "ready");
});

test("⚠ an import stops the moment the account changes, and marks nothing", async () => {
  // Marking would claim the outgoing account's record for the incoming one, and
  // sending the next would put their written instructions into the wrong account.
  const store = { zephyr_agents_v1: JSON.stringify([
    { id: "L1", name: "One", instructions: "x", messages: [] },
    { id: "L2", name: "Two", instructions: "y", messages: [] },
  ]) };
  const gate = held(okRes({ id: "S1", key: "L1", imported: 0, unreadable: 0 }));
  let sent = 0;
  const w = loadScreen({
    store, uid: "acct-A",
    answer: (p) => { if (p === "/api/agent/import") { sent++; return gate.p; } return okRes({ agents: [] }); },
  });
  w.ev('agentState = "ready";');
  const importing = w.ev("agentImport()");
  w.signIn("acct-B");
  gate.release();
  await importing;
  assert.equal(sent, 1, "it carried on importing under the account that arrived");
  const after = JSON.parse(store.zephyr_agents_v1);
  assert.ok(after.every((a) => !a.imported), "a record was claimed for the wrong account");
  assert.equal(after.length, 2, "a record was lost");
});

test("...and an import that keeps its account brings every record over", async () => {
  // The control. Without it, an `agentImport` that returned immediately would
  // pass the case above.
  const store = { zephyr_agents_v1: JSON.stringify([
    { id: "L1", name: "One", instructions: "x", messages: [] },
    { id: "L2", name: "Two", instructions: "y", messages: [] },
  ]) };
  let n = 0;
  const w = loadScreen({
    store, uid: "acct-A",
    answer: (p) => (p === "/api/agent/import"
      ? okRes({ id: "S" + (++n), key: "L" + n, imported: 0, unreadable: 0 })
      : okRes({ agents: [] })),
  });
  w.ev('agentState = "ready";');
  await w.ev("agentImport()");
  assert.equal(n, 2, "it did not import both");
  const after = JSON.parse(store.zephyr_agents_v1);
  assert.deepEqual(after.map((a) => a.imported), ["S1", "S2"], "the records were not marked");
  assert.equal(w.ev("agentsToImport().length"), 0, "they are still being offered");
});

test("the import sends the browser record's own id as its identity", async () => {
  const store = { zephyr_agents_v1: JSON.stringify([
    { id: "L-stable-1", name: "One", instructions: "x", messages: [{ text: "hello", at: 1 }] },
  ]) };
  const w = loadScreen({
    store, uid: "acct-A",
    answer: (p) => (p === "/api/agent/import"
      ? okRes({ id: "S1", key: "L-stable-1", imported: 1, unreadable: 0 })
      : okRes({ agents: [] })),
  });
  w.ev('agentState = "ready";');
  await w.ev("agentImport()");
  const imp = w.calls.find((c) => c.path === "/api/agent/import");
  assert.ok(imp, "nothing was imported");
  assert.equal(imp.body.key, "L-stable-1",
    "the import carries no stable identity, so a retry would make a second agent");
  // The key is the LOCAL id, never the server's — the server's does not exist
  // until the first press has already succeeded, which is the press that can be
  // lost.
  assert.notEqual(imp.body.key, "S1");
  assert.equal(JSON.parse(store.zephyr_agents_v1)[0].imported, "S1");
});

// ────────────────────────────────────────────────────────────────────────────
// THE LEGACY RECORDS SURVIVE AN ACCOUNT SWITCH
// ────────────────────────────────────────────────────────────────────────────

test("⚠ an account switch STAMPS the legacy agents, it does not delete them", () => {
  // THE FINDING. The switch used to `removeItem(AGENTS_KEY)`, which satisfied
  // "the next account must not see them" by destroying the only copy of agents
  // written before this screen had an account behind it — including any whose
  // import had not been pressed yet.
  const store = { zephyr_agents_v1: JSON.stringify([
    { id: "L1", name: "A's agent", instructions: "written by A", messages: [{ text: "said to A", at: 1 }] },
  ]) };
  const w = loadScreen({ store, uid: "acct-A" });

  // A is signed in: the record is unstamped and A can see it.
  assert.equal(w.ev("agentsLocal().length"), 1, "A cannot see its own record");

  // B signs in on the same machine. This is the one moment A's identity is known.
  w.ev('agentsClaimFor("acct-A");');
  w.signIn("acct-B");

  const kept = JSON.parse(store.zephyr_agents_v1);
  assert.equal(kept.length, 1, "the record was deleted rather than preserved");
  assert.equal(kept[0].uid, "acct-A", "the record was kept without saying whose it is");
  assert.deepEqual(kept[0].messages, [{ text: "said to A", at: 1 }], "its conversation was lost");
  assert.equal(w.ev("agentsLocal().length"), 0, "B can see A's written instructions");
  assert.equal(w.ev("agentsToImport().length"), 0, "B is offered A's agents to import");

  // A comes back and finds everything.
  w.signIn("acct-A");
  assert.equal(w.ev("agentsLocal().length"), 1, "A lost its records by signing out and back in");
  assert.equal(w.ev("agentsToImport().length"), 1, "A is no longer offered the import");
});

test("a second switch does not re-assign the first account's records", () => {
  // **THE FIXTURE MUST MIX STAMPED AND UNSTAMPED.** With every record already
  // owned, `agentsClaimFor` returns at its "nothing unclaimed" line and a mutant
  // that re-assigns everything never runs — the case passed while proving
  // nothing, which a sweep found. One of each makes the two readings differ.
  const store = { zephyr_agents_v1: JSON.stringify([
    { id: "L1", name: "A's", instructions: "x", uid: "acct-A" },
    { id: "L2", name: "written while B was signed in", instructions: "y" },
  ]) };
  const w = loadScreen({ store, uid: "acct-B" });
  w.ev('agentsClaimFor("acct-B");');          // B leaves; A's record must not become B's
  const after = JSON.parse(store.zephyr_agents_v1);
  assert.equal(after.find((a) => a.id === "L1").uid, "acct-A",
    "an already-stamped record was re-assigned to whoever left next");
  assert.equal(after.find((a) => a.id === "L2").uid, "acct-B",
    "the unstamped record was not claimed, so the stamp did nothing at all");
});

test("⚠ a send answered after the ACCOUNT changed cannot write into the new one", async () => {
  // The conversation cases move the thread. This one leaves the thread exactly
  // where it was and changes WHO is signed in — a session that expired while the
  // message was in the air, with somebody else now at the keyboard. A binding
  // that only compared the conversation let A's message land in B's screen.
  const gate = held(okRes({ message: { id: "m-A", text: "for A", at: 1 } }));
  const w = loadScreen({ uid: "acct-A", answer: (p) => (p === "/api/agent/message" ? gate.p : okRes({ agents: [] })) });
  setRows(w);
  w.ev('agentThread = "A"; agentMsgs = []; agentMsgsFor = "A";');
  w.s.document.getElementById("agMsg").value = "for A";
  const sending = w.ev("agentSend()");
  w.signIn("acct-B");                 // same conversation on screen, different person
  gate.release();
  await sending;
  assert.deepEqual(w.val("agentMsgs"), [],
    "one account's message was appended to the next account's screen");
  // THE DRAFT FOR THAT CONVERSATION *IS* CLEARED, and that is correct: the send
  // SUCCEEDED, so those words are no longer unsent. The first version of this
  // case asserted the opposite and failed working code — the thing an account
  // change must protect is somebody ELSE'S screen, not bookkeeping about a
  // message that really was saved.
  assert.equal(w.ev('agentDraftOf("A")'), "", "a successful send left its words as unsent");
  assert.deepEqual(w.val("Object.keys(agentMsgDrafts)"), [],
    "the answer touched a conversation other than its own");
});

test("⚠ a thread read answered after the account changed cannot paint the new one", async () => {
  const gate = held(okRes({ id: "A", messages: [{ id: "m1", text: "A's private conversation", at: 1 }] }));
  const w = loadScreen({ uid: "acct-A", answer: (p) => (p.startsWith("/api/agent/messages") ? gate.p : okRes({ agents: [] })) });
  setRows(w);
  const reading = w.ev('agentThreadLoad("A")');
  w.signIn("acct-B");
  gate.release();
  await reading;
  assert.equal(w.ev("agentMsgs"), null,
    "one account's conversation was painted into the next account's screen");
});

test("⚠ an import that DIES after the account changed says nothing to the new one", async () => {
  // The throw path had no wall at all: "couldn't reach the server" would appear
  // on the incoming account's screen, about an import they never pressed.
  const store = { zephyr_agents_v1: JSON.stringify([{ id: "L1", name: "One", instructions: "x", messages: [] }]) };
  let reject;
  const w = loadScreen({
    store, uid: "acct-A",
    answer: (p) => (p === "/api/agent/import"
      ? new Promise((_, r) => { reject = () => r(new Error("socket hang up")); })
      : okRes({ agents: [] })),
  });
  w.ev('agentState = "ready"; agentActErr = "";');
  const importing = w.ev("agentImport()");
  w.signIn("acct-B");
  reject();
  await importing;
  assert.equal(w.ev("agentActErr"), "",
    "a failed import announced itself into the account that arrived");
  assert.equal(JSON.parse(store.zephyr_agents_v1).length, 1, "a record was lost");
});

test("...and an import that dies with its account still there DOES say so", async () => {
  // The control for the case above: without it, an `agentImport` whose catch
  // stopped reporting anything at all would pass.
  const store = { zephyr_agents_v1: JSON.stringify([{ id: "L1", name: "One", instructions: "x", messages: [] }]) };
  let reject;
  const w = loadScreen({
    store, uid: "acct-A",
    answer: (p) => (p === "/api/agent/import"
      ? new Promise((_, r) => { reject = () => r(new Error("socket hang up")); })
      : okRes({ agents: [] })),
  });
  w.ev('agentState = "ready"; agentActErr = "";');
  const importing = w.ev("agentImport()");
  reject();
  await importing;
  assert.match(w.ev("agentActErr"), /Nothing was removed from this browser/,
    "a failed import that stayed put said nothing");
});

test("a signed-out page is shown nothing at all", () => {
  const store = { zephyr_agents_v1: JSON.stringify([{ id: "L1", name: "x", instructions: "y" }]) };
  const w = loadScreen({ store, uid: "acct-A" });
  assert.equal(w.ev("agentsLocal().length"), 1);
  w.signIn("");
  assert.equal(w.ev("agentsLocal().length"), 0,
    "an unstamped record is offered to a page with nobody signed in");
});

test("marking one record as imported does not delete the other account's", () => {
  // The quiet way the wipe could come back: `agentMarkImported` mapping over the
  // FILTERED list and writing the result back would drop every record belonging
  // to anyone else.
  const store = { zephyr_agents_v1: JSON.stringify([
    { id: "L1", name: "mine", instructions: "x", uid: "acct-A" },
    { id: "L2", name: "theirs", instructions: "y", uid: "acct-B" },
  ]) };
  const w = loadScreen({ store, uid: "acct-A" });
  w.ev('agentMarkImported("L1", "S1");');
  const after = JSON.parse(store.zephyr_agents_v1);
  assert.equal(after.length, 2, "the other account's record was deleted");
  assert.equal(after.find((a) => a.id === "L1").imported, "S1");
  assert.equal(after.find((a) => a.id === "L2").uid, "acct-B");
});

test("the account-switch wipe no longer names the agents at all", () => {
  // Read rather than driven, because what is asserted is an ABSENCE from a list.
  // The other keys in it are caches; this one is somebody's writing.
  const wipe = /\[SITES_KEY,([\s\S]{0,400}?)\]\s*\n\s*\.forEach\(\(k\) => localStorage\.removeItem\(k\)\)/.exec(CHAT);
  assert.ok(wipe, "the account-switch wipe list is gone or reshaped — re-read it");
  assert.ok(!/\bAGENTS_KEY\b/.test(wipe[1]), "the switch still deletes what somebody typed");
  assert.ok(!/removeItem\(AGENTS_KEY\)/.test(CHAT), "something removes the agents by key");
  // And the stamp really runs on the switch, not merely exists.
  const branch = CHAT.slice(CHAT.indexOf("if (prevOwner && prevOwner !== uid)"));
  assert.match(branch.slice(0, 1800), /agentsClaimFor\(prevOwner\)/,
    "the switch does not assign the outgoing account's records to it");
});
