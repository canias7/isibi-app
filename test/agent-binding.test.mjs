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

/**
 * Just enough of an element for the agent screen's own reads and writes.
 *
 * **ATTRIBUTES, A SELECTION AND FOCUS ARE REAL HERE, and they were not.**
 * `getAttribute` answered `null` for everything and `focus()` did nothing, which
 * made every one of the composer's own reads unobservable: the code that keeps
 * somebody's half-typed message across a poll asks the element which conversation
 * it belongs to and where the cursor is, so a fake that cannot answer either would
 * have reported the fix as working with the fix deleted. A fake LESS capable than
 * the thing it stands in for hides a defect exactly as well as one that is more.
 */
function el(id, doc) {
  const attrs = {};
  return {
    id, value: "", textContent: "", innerHTML: "", scrollTop: 0, scrollHeight: 0,
    style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    blur() {}, click() {}, selectionStart: 0, selectionEnd: 0, dataset: {},
    // Counted rather than recorded as a boolean: "it was focused" and "it was
    // focused again on every one of eight polls" are different facts.
    focusCount: 0,
    focus() { this.focusCount++; if (doc) doc.activeElement = this; },
    // The RANGE the page asked for, kept apart from `selectionStart` — which a case
    // sets itself, so reading it back would be the test observing its own write.
    rangeSet: null,
    setSelectionRange(a, b) { this.rangeSet = [a, b]; this.selectionStart = a; this.selectionEnd = b; },
    appendChild() {}, removeChild() {}, remove() {}, insertBefore() {},
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    setAttribute(k, v) { attrs[k] = String(v); },
    removeAttribute(k) { delete attrs[k]; },
    getAttribute: (k) => (Object.hasOwn(attrs, k) ? attrs[k] : null),
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
function loadScreen({ store = {}, uid = "acct-A", answer, refuse: refuseAt = null } = {}) {
  // A `let`, because a store can come BACK: the one case that can isolate what
  // `doSignOut` claims for needs the write refused at boot and accepted at
  // sign-out, inside one page load.
  let refuse = refuseAt;
  const els = new Map();
  const doc = {
    getElementById: (id) => (els.has(id) ? els.get(id) : (els.set(id, el(id, doc)), els.get(id))),
    querySelector: () => el("shell"),
    querySelectorAll: () => [],
    addEventListener() {}, createElement: () => el("x"), body: el("body"),
    documentElement: el("html"), head: el("head"), title: "",
    // WHAT HAS FOCUS. Absent, `document.activeElement === el` is false for every
    // element, so "the box had focus and got it back" could not be asked at all.
    activeElement: null,
  };
  let currentUid = uid;
  const calls = [];
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    document: doc,
    // `refuse` is how a FULL OR BLOCKED STORE is driven: `{ key, how }`, where
    // `how` is `"throw"` (a real `QuotaExceededError`, which is what a browser
    // does) or `"silent"` (the write is accepted and does not persist — rarer,
    // and the only thing `agentsStore`'s read-back can see). Both shapes exist,
    // so both are drivable; one option rather than two flags, because they are
    // the same fact about one key.
    localStorage: {
      getItem: (k) => (Object.hasOwn(store, k) ? store[k] : null),
      setItem: (k, v) => {
        if (refuse && refuse.key === k) {
          if (refuse.how === "throw") { const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; }
          return;                                   // accepted, not stored
        }
        store[k] = String(v);
      },
      removeItem: (k) => { delete store[k]; },
    },
    crypto: { randomUUID: () => "id-" + Math.random().toString(16).slice(2) },
    location: { pathname: "/", search: "", href: "https://gofarther.dev/", origin: "https://gofarther.dev", reload() {} },
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
      onChange() {}, signOut: async () => { currentUid = ""; },
      signOutEverywhere: async () => { currentUid = ""; },
      session: () => ({ user: { id: currentUid } }),
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
    allowWrites: () => { refuse = null; },
    uid: () => currentUid,
  };
}

/**
 * A browser that `who` has been signed into, holding legacy records.
 *
 * **THE MARKER IS WHAT MAKES THEM THEIRS, and that is the product's rule rather
 * than this file's convenience.** `zephyr_owner_v1` is the only thing in a
 * browser that says which account was last in it, so it is the only thing that
 * can establish whose an unstamped legacy record is — and the page's own boot
 * claims them for it. A fixture without the marker is a browser nobody can
 * place, which is a different case (its own test below), not a shortcut to this
 * one: every record in it is SEALED at load and no account ever sees it.
 */
const browserOf = (who, rows) => ({ zephyr_owner_v1: who, zephyr_agents_v1: JSON.stringify(rows) });

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
  const w = loadScreen({ answer: (p) => (p === "/api/agent/send" ? gate.p : okRes({ agents: [] })) });
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
  const w = loadScreen({ answer: (p) => (p === "/api/agent/send" ? gate.p : okRes({ agents: [] })) });
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
  const w = loadScreen({ uid: "acct-A", answer: () => okRes({ agents: [] }) });
  // RE-ANCHORED, NOT APPEASED: the property is unchanged and the KEY moved. A draft
  // is now the account's as well as the conversation's, so the fixture is written
  // through the page's own setter rather than by naming the map's keys — which is
  // also what stops this case going stale the next time that key gains a part.
  w.ev('agentDraftSet("A", "about A"); agentDraftSet("B", "about B");');
  assert.equal(w.ev('agentDraftOf("A")'), "about A");
  assert.equal(w.ev('agentDraftOf("B")'), "about B");
  assert.equal(w.ev('agentDraftOf("C")'), "", "an untouched conversation has a draft");
  // ⚠ AND THE NEXT ACCOUNT SEES NEITHER. Unsent words are the one thing on this
  // screen that never went to the server, so nothing else can filter them.
  w.signIn("acct-B");
  assert.equal(w.ev('agentDraftOf("A")'), "", "the next account read the last one's unsent message");
  assert.equal(w.ev('agentDraftOf("B")'), "");
  w.ev('agentDraftSet("A", "B typing in the same conversation");');
  w.signIn("acct-A");
  assert.equal(w.ev('agentDraftOf("A")'), "about A", "B's draft overwrote A's in the same conversation");
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
  const store = browserOf("acct-A", [
    { id: "L1", name: "One", instructions: "x", messages: [] },
    { id: "L2", name: "Two", instructions: "y", messages: [] },
  ]);
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
  const store = browserOf("acct-A", [
    { id: "L1", name: "One", instructions: "x", messages: [] },
    { id: "L2", name: "Two", instructions: "y", messages: [] },
  ]);
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
  const store = browserOf("acct-A", [
    { id: "L-stable-1", name: "One", instructions: "x", messages: [{ text: "hello", at: 1 }] },
  ]);
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
  const store = browserOf("acct-A", [
    { id: "L1", name: "A's agent", instructions: "written by A", messages: [{ text: "said to A", at: 1 }] },
  ]);
  // **THE BOOT IS WHAT CLAIMS, so the boot is what is driven** — `loadScreen`
  // evaluates the page's own scripts, `enterApp` runs, and it stamps every
  // unstamped record with the marker it found. Calling `agentsClaimFor` by hand
  // here (which this case used to do) asserts the helper and not the moment.
  const a = loadScreen({ store, uid: "acct-A" });
  assert.equal(a.ev("agentsStored()[0].uid"), "acct-A", "the boot did not record whose these are");
  assert.equal(a.ev("agentsLocal().length"), 1, "A cannot see its own record");

  // B signs in on the same machine: the same browser, loaded again.
  const b = loadScreen({ store, uid: "acct-B" });
  const kept = JSON.parse(store.zephyr_agents_v1);
  assert.equal(kept.length, 1, "the record was deleted rather than preserved");
  assert.equal(kept[0].uid, "acct-A", "the record was kept without saying whose it is");
  assert.deepEqual(kept[0].messages, [{ text: "said to A", at: 1 }], "its conversation was lost");
  assert.equal(b.ev("agentsLocal().length"), 0, "B can see A's written instructions");
  assert.equal(b.ev("agentsToImport().length"), 0, "B is offered A's agents to import");

  // A comes back and finds everything.
  const a2 = loadScreen({ store, uid: "acct-A" });
  assert.equal(a2.ev("agentsLocal().length"), 1, "A lost its records by signing out and back in");
  assert.equal(a2.ev("agentsToImport().length"), 1, "A is no longer offered the import");
});

test("a second switch does not re-assign the first account's records", () => {
  // **THE FIXTURE MUST MIX STAMPED AND UNSTAMPED.** With every record already
  // owned, `agentsClaimFor` returns at its "nothing unclaimed" line and a mutant
  // that re-assigns everything never runs — the case passed while proving
  // nothing, which a sweep found. One of each makes the two readings differ.
  const store = browserOf("acct-B", [
    { id: "L1", name: "A's", instructions: "x", uid: "acct-A" },
    { id: "L2", name: "written while B was signed in", instructions: "y" },
  ]);
  loadScreen({ store, uid: "acct-B" });      // the boot claims for the marker
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
  const w = loadScreen({ uid: "acct-A", answer: (p) => (p === "/api/agent/send" ? gate.p : okRes({ agents: [] })) });
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
  const store = browserOf("acct-A", [{ id: "L1", name: "One", instructions: "x", messages: [] }]);
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
  const store = browserOf("acct-A", [{ id: "L1", name: "One", instructions: "x", messages: [] }]);
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
  const store = browserOf("acct-A", [{ id: "L1", name: "x", instructions: "y" }]);
  const w = loadScreen({ store, uid: "acct-A" });
  assert.equal(w.ev("agentsLocal().length"), 1);
  w.signIn("");
  assert.equal(w.ev("agentsLocal().length"), 0,
    "a record is shown to a page with nobody signed in");
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
  // AND THE ORDER, WHICH IS THE PROPERTY — not the position of the call.
  // **RE-ANCHORED, NOT APPEASED**: the claim used to sit inside
  // `if (prevOwner && prevOwner !== uid)` and this guard read that branch. It
  // runs for every sign-in now, because the ordinary upgrade needs it as much as
  // a switch does — the same account, with records written before this code
  // stamped anything. What has to hold is that ownership is decided from the
  // MARKER and decided BEFORE the marker is overwritten; writing the marker
  // first would make the next sign-in read it as "the same account as last
  // time" and hand the records to whoever arrived, one step removed.
  //
  // Windowed landmark-to-landmark on the NEXT SIBLING statement, never by bytes:
  // this file's neighbours are comments, and a byte window is outrun by the next
  // one somebody writes.
  const at = CHAT.indexOf("const prevOwner = localStorage.getItem('zephyr_owner_v1')");
  const end = CHAT.indexOf("if (pendingSiteBrief)", at);
  assert.ok(at > 0, "the boot no longer reads the marker — nothing is being read");
  assert.ok(end > at, "the block's closing landmark moved; re-read enterApp");
  const boot = CHAT.slice(at, end);
  assert.match(boot, /agentsClaimFor\(prevOwner\)/,
    "the boot does not assign the records to the account the marker names");
  assert.match(boot, /agentsSealUnknown\(\)/,
    "a browser with no marker is not sealed, so its records go to whoever signs in");
  const marker = boot.indexOf("localStorage.setItem('zephyr_owner_v1', uid)");
  assert.ok(marker > 0, "the boot no longer records which account this browser belongs to");
  assert.ok(boot.indexOf("agentsClaimFor(prevOwner)") < marker,
    "the marker is overwritten before ownership is taken from it");
  assert.ok(boot.indexOf("agentsSealUnknown()") < marker,
    "the marker is written before the unplaceable records are sealed");
});

// ────────────────────────────────────────────────────────────────────────────
// WHOSE THE LEGACY RECORDS ARE, ACROSS A REAL SIGN-OUT
//
// **THE GAP THESE FOUR ARE ABOUT.** `doSignOut` removed `zephyr_owner_v1` — the
// only thing in a browser that says which account was last in it — without first
// recording ownership, and `agentsLocal` let an unstamped record through for any
// signed-in account, on the reasoning that unstamped meant "never been through a
// switch, so it can only be the current account's". Those two together are the
// bug: A signs out, B signs in, and every one of A's records reads as B's. B
// could see them, and B could bring them into B's account for good.
//
// EVERY CASE HERE DRIVES THE PAGE'S OWN BOOT AND THE REAL `doSignOut`. A second
// `loadScreen` over the SAME `store` object is a second visit to the same
// browser, which is what `location.reload()` does at the end of a sign-out — so
// the sequence under test is the sequence a person performs, not a helper called
// in the order the fix happens to want.
// ────────────────────────────────────────────────────────────────────────────

const LEGACY = [{
  id: "L1", name: "A's agent", instructions: "written by A",
  messages: [{ id: "m1", text: "said to A", at: 1 }],
}];
const listOnly = (p) => (p === "/api/agent/list" ? okRes({ agents: [] }) : okRes({}));

test("⚠ 1. A signs out, B signs in: B can neither see nor import A's records", async () => {
  const store = browserOf("acct-A", LEGACY);
  const a = loadScreen({ store, uid: "acct-A", answer: listOnly });
  assert.equal(a.ev("agentsLocal().length"), 1, "A cannot see its own record to begin with");

  // A REAL SIGN-OUT. This is where the finding lived: the identity marker went
  // and nothing had written the answer down anywhere else.
  await a.ev("doSignOut()");
  assert.equal(JSON.parse(store.zephyr_agents_v1)[0].uid, "acct-A",
    "signing out cleared the identity without recording whose the records are");
  assert.equal(store.zephyr_owner_v1, undefined,
    "sign-out no longer forgets which account this browser belonged to");

  // B signs in on the same machine.
  const b = loadScreen({ store, uid: "acct-B", answer: listOnly });
  assert.equal(b.ev("agentsLocal().length"), 0, "B can see A's written instructions");
  assert.equal(b.ev("agentsToImport().length"), 0, "B is offered A's agents");

  // AND THE IMPORT IS ASKED DIRECTLY, because the offer being empty is a
  // statement about what B can SEE. The action is what would copy A's written
  // instructions into B's account, and it is handed a record to refuse: the
  // store really does hold one that has not been imported.
  assert.equal(b.val("agentsStored().filter((r) => !r.imported).length"), 1,
    "the action had nothing in hand, so refusing to send proves nothing");
  await b.ev("agentImport()");
  assert.equal(b.calls.filter((c) => c.path === "/api/agent/import").length, 0,
    "the import sent a record belonging to another account");

  // Nothing was destroyed to achieve any of that.
  const kept = JSON.parse(store.zephyr_agents_v1);
  assert.equal(kept.length, 1, "A's record was deleted rather than hidden");
  assert.deepEqual(kept[0].messages, [{ id: "m1", text: "said to A", at: 1 }],
    "A's conversation was lost");
});

test("2. ...and when A signs back in, the records and their messages are still there", async () => {
  // THE CONTROL FOR ALL OF IT. Hiding records from everybody would satisfy the
  // case above, and this is the half that says the hiding is a filter.
  const store = browserOf("acct-A", LEGACY);
  const a = loadScreen({ store, uid: "acct-A", answer: listOnly });
  await a.ev("doSignOut()");
  loadScreen({ store, uid: "acct-B", answer: listOnly });        // B has a look
  const back = loadScreen({ store, uid: "acct-A", answer: listOnly });

  assert.equal(back.ev("agentsLocal().length"), 1, "A lost its records by signing out");
  assert.equal(back.ev("agentsToImport().length"), 1, "A is no longer offered the import");
  assert.deepEqual(back.val("agentsLocal()[0].messages"), [{ id: "m1", text: "said to A", at: 1 }],
    "A's conversation did not come back with it");
  assert.equal(back.ev("agentsLocal()[0].instructions"), "written by A",
    "what A wrote did not survive the round trip");

  // And the import really works for the account that owns them.
  await back.ev("agentImport()");
  const sent = back.calls.filter((c) => c.path === "/api/agent/import");
  assert.equal(sent.length, 1, "A cannot bring its own records over");
  assert.equal(sent[0].body.key, "L1", "the import lost the record's identity");
});

test("⚠ 3. records nobody can vouch for are kept in full and shown to no one", async () => {
  // THE BROWSER THIS FIX CANNOT REPAIR, and the cost is stated rather than
  // hidden: somebody signed out under the OLD code, so the marker is gone and
  // the records are unstamped. There is nothing left that can say whose they
  // are — so they are SEALED, which means preserved and permanently invisible.
  // The alternative is handing them to whoever signs in next, which is the bug.
  const store = { zephyr_agents_v1: JSON.stringify(LEGACY) };      // no marker, deliberately
  const a = loadScreen({ store, uid: "acct-A", answer: listOnly });

  const sealed = JSON.parse(store.zephyr_agents_v1);
  assert.equal(sealed.length, 1, "an unplaceable record was deleted instead of sealed");
  assert.equal(sealed[0].instructions, "written by A", "what somebody wrote was altered");
  assert.deepEqual(sealed[0].messages, [{ id: "m1", text: "said to A", at: 1 }],
    "the conversation went with the seal");
  assert.equal(a.ev("agentsLocal().length"), 0, "an unplaceable record was shown to whoever signed in");
  assert.equal(a.ev("agentsToImport().length"), 0, "an unplaceable record was offered for import");
  await a.ev("agentImport()");
  assert.equal(a.calls.filter((c) => c.path === "/api/agent/import").length, 0,
    "an unplaceable record was uploaded into an account we cannot establish");

  // **AND THE SEAL CANNOT BE LAUNDERED BY A LATER MARKER**, which is the whole
  // reason it is a VALUE rather than an absence. This visit wrote the marker; a
  // browser read a second time would otherwise find one naming "the same account
  // as last time" and claim the records for an account that merely arrived first.
  assert.equal(store.zephyr_owner_v1, "acct-A", "the boot did not record this visit at all");
  const again = loadScreen({ store, uid: "acct-A", answer: listOnly });
  assert.equal(again.ev("agentsLocal().length"), 0,
    "the marker this fix wrote laundered a record nobody could place");
  assert.notEqual(JSON.parse(store.zephyr_agents_v1)[0].uid, "acct-A",
    "a sealed record was re-assigned to the account that happened to arrive");
});

for (const how of ["throw", "silent"]) {
  test(`⚠ 4. a refused ownership write (${how}) does not expose the records to B`, async () => {
    // **A FULL OR BLOCKED STORE IS THE CASE WHERE BEING WRONG COSTS MOST**, and
    // there are two real shapes: a browser THROWS `QuotaExceededError`, and a
    // write can be accepted and not persist — which only `agentsStore`'s read-back
    // can see. Both are driven, because they are caught by different halves.
    const refuse = { key: "zephyr_agents_v1", how };
    const store = browserOf("acct-A", LEGACY);
    const a = loadScreen({ store, uid: "acct-A", refuse, answer: listOnly });
    assert.equal(a.ev("agentsStored()[0].uid"), undefined,
      "the fixture is not refusing the write at all, so this case proves nothing");

    // A signs out. The claim cannot land, so THE MARKER STAYS: it is the only
    // other place the answer exists, and erasing it as well would lose it.
    await a.ev("doSignOut()");
    assert.equal(store.zephyr_owner_v1, "acct-A",
      "a failed claim still threw away the one record of whose these are");

    // B signs in, with the store still refusing.
    const b = loadScreen({ store, uid: "acct-B", refuse, answer: listOnly });
    assert.equal(b.ev("agentsLocal().length"), 0, "a record we could not stamp was shown to B");
    assert.equal(b.ev("agentsToImport().length"), 0, "a record we could not stamp was offered to B");
    assert.equal(b.val("agentsStored().filter((r) => !r.imported).length"), 1,
      "the action had nothing in hand, so refusing to send proves nothing");
    await b.ev("agentImport()");
    assert.equal(b.calls.filter((c) => c.path === "/api/agent/import").length, 0,
      "a record we could not stamp was uploaded into B's account");
    assert.equal(store.zephyr_owner_v1, "acct-A",
      "the marker moved to the account that arrived while ownership was unrecorded");
    assert.equal(JSON.parse(store.zephyr_agents_v1).length, 1, "the record was lost");

    // AND IT IS RECOVERABLE. The store starts accepting writes; A comes back;
    // the marker that was kept is what puts the records back in A's hands.
    const back = loadScreen({ store, uid: "acct-A", answer: listOnly });
    assert.equal(back.ev("agentsLocal().length"), 1,
      "keeping the marker bought nothing — A's records never came back");
    assert.equal(store.zephyr_owner_v1, "acct-A");
  });
}

test("4b. the control: with the store working, sign-out records ownership and forgets the account", async () => {
  // Without this, a `doSignOut` that never cleared the marker at all would pass
  // every assertion above.
  const store = browserOf("acct-A", LEGACY);
  const a = loadScreen({ store, uid: "acct-A", answer: listOnly });
  await a.ev("doSignOut()");
  assert.equal(JSON.parse(store.zephyr_agents_v1)[0].uid, "acct-A", "ownership was not recorded");
  assert.equal(store.zephyr_owner_v1, undefined,
    "the marker is kept even when there was nothing to keep it for");
});

test("⚠ 1b. B arriving on A's browser does not acquire A's unstamped records", async () => {
  // THE EXPIRED-SESSION SWAP, which is the shape the account-switch wipe exists
  // for: A never signed out, so the marker still names A and the records are
  // still unstamped. The claim has to take the MARKER — claiming for the account
  // that has just arrived is the same bug through a different door, and from the
  // store afterwards the two are one field apart.
  const store = browserOf("acct-A", LEGACY);
  const b = loadScreen({ store, uid: "acct-B", answer: listOnly });
  assert.equal(JSON.parse(store.zephyr_agents_v1)[0].uid, "acct-A",
    "the records were claimed for the account that arrived");
  assert.equal(b.ev("agentsLocal().length"), 0, "B can see A's written instructions");
  assert.equal(b.ev("agentsToImport().length"), 0, "B is offered A's agents");
  assert.equal(b.val("agentsStored().filter((r) => !r.imported).length"), 1,
    "the action had nothing in hand, so refusing to send proves nothing");
  await b.ev("agentImport()");
  assert.equal(b.calls.filter((c) => c.path === "/api/agent/import").length, 0,
    "the import sent a record belonging to another account");
  assert.equal(store.zephyr_owner_v1, "acct-B", "the marker did not move to the account now here");

  // A comes back to everything.
  const a = loadScreen({ store, uid: "acct-A", answer: listOnly });
  assert.equal(a.ev("agentsLocal().length"), 1, "A lost its records to B's visit");
});

test("4c. a sign-out claims for the MARKER, never for whoever is signing out", async () => {
  // **THE ONE CASE THAT CAN TELL THE TWO AUTHORITIES APART.** `enterApp` only
  // moves the marker once ownership is settled, so a browser whose store refused
  // that write is signed in as B with the marker still naming A — and the
  // unstamped records really are A's. If the store then comes back and B signs
  // out, a sign-out reading `Auth.userId()` stamps A's written instructions as
  // B's, for good. Everywhere else in this file the two agree, which is exactly
  // why a mutant swapping them survives every other case.
  const store = browserOf("acct-A", LEGACY);
  const refuse = { key: "zephyr_agents_v1", how: "throw" };
  loadScreen({ store, uid: "acct-A", refuse, answer: listOnly });     // A's claim is refused
  const b = loadScreen({ store, uid: "acct-B", refuse, answer: listOnly });
  assert.equal(b.ev("agentsStored()[0].uid"), undefined,
    "the fixture recorded ownership after all, so the two authorities still agree");
  assert.equal(store.zephyr_owner_v1, "acct-A",
    "the marker moved while ownership was unrecorded");

  // The store comes back, and B signs out.
  b.allowWrites();
  await b.ev("doSignOut()");
  assert.equal(JSON.parse(store.zephyr_agents_v1)[0].uid, "acct-A",
    "B's sign-out claimed A's records for B");
  assert.equal(store.zephyr_owner_v1, undefined,
    "ownership was recorded and the marker was kept anyway");
});

// ────────────────────────────────────────────────────────────────────────────
// SENDING STARTS WORK, AND THE SCREEN WATCHES IT
//
// Five things that only go wrong when time passes, which is why they are here and
// not in a source read: a double press, a reload mid-run, a failure, a run whose
// answer lands after the screen has moved, and the watching itself.
// ────────────────────────────────────────────────────────────────────────────

/** A thread row as `/api/agent/messages` really answers it. */
const msg = (id, text, run = null) => ({ id, text, at: 1_700_000_000_000, run });
const run = (state, over = {}) =>
  ({ id: "run-" + state, state, step: 0, simulated: true, text: "", why: "", at: 0, ...over });

/**
 * A screen with one agent open and a server that answers both halves of a send.
 *
 * `sends` records every `/api/agent/send` body, so "one press, one message" is
 * counted rather than inferred, and `thread` is what the next read answers — which
 * is how a run is moved from queued to answered without waiting for anything.
 */
function sending(t, { thread = [], sendAnswer = null, uid = "acct-A" } = {}) {
  const sends = [];
  const reads = [];
  let rows = thread;
  const w = loadScreen({
    uid,
    answer: (path, opts) => {
      if (path === "/api/agent/send") {
        const body = JSON.parse(opts.body);
        sends.push(body);
        if (sendAnswer) return sendAnswer(body, sends.length);
        return okRes({ id: body.id, repeat: sends.length > 1, queued: sends.length === 1,
                       message: msg("m" + sends.length, body.body), runId: "run-queued" });
      }
      if (path.startsWith("/api/agent/messages")) { reads.push(path); return okRes({ messages: rows }); }
      return okRes({ agents: ROWS });
    },
  });
  setRows(w);
  w.ev('agentThread = "A"; agentMsgs = []; agentMsgsFor = "A";');
  // ⚠ THE BOX SAYS WHICH CONVERSATION IT IS, because the real render emits
  // `data-agent` and every composer read asks the ELEMENT for it. Without this the
  // fixture was LESS CAPABLE than the screen: `agentComposerRead` answered "no
  // conversation" and wrote nothing, which hid a defect the live site showed at once
  // — a successful send left its words in the box, put back by the next redraw.
  w.s.document.getElementById("agMsg").setAttribute("data-agent", "A");
  // ⚠ THE POLL IS STOPPED IN A HOOK, NEVER AT THE END OF A CASE — and this cost a
  // whole mutation sweep to learn. A running conversation arms a REAL 2.5-second
  // timer that RE-ARMS itself after each read, so a case whose assertion FAILS never
  // reaches its own cleanup and the process never exits: `node --test` sat for eleven
  // minutes on a mutant it had correctly killed, and the sweep read a hang instead of
  // a kill. A hook runs on the failing path too.
  if (t && typeof t.after === "function") t.after(() => { try { w.ev("agentPollStop();"); } catch { /* the page may be gone */ } });
  return { w, sends, reads, serve: (next) => { rows = next; } };
}

/**
 * Capture the POLL's own timer callback, and nothing else's.
 *
 * **BY ITS DELAY, DERIVED FROM THE PAGE'S OWN CONSTANT.** The render schedules
 * timers of its own, so a stub that kept the last callback it was handed captured
 * one of those instead — and the case then "fired the poll" and observed nothing,
 * which read as the poll being correctly bound when it had never been armed.
 */
function catchPoll(w) {
  const every = w.ev("AGENT_POLL_MS");
  assert.ok(Number.isFinite(every) && every > 0, `the poll interval read as ${every}`);
  let fn = null;
  w.s.setTimeout = (f, ms) => { if (ms === every) fn = f; return 1; };
  return { fire: () => { assert.ok(fn, "no poll was armed"); const f = fn; fn = null; return f(); },
           get armed() { return !!fn; } };
}

test("A SEND STARTS A RUN AND THE CONVERSATION SHOWS IT", async (t) => {
  const b = sending(t);
  b.serve([msg("m1", "when do you open?", run("queued", { id: "run-1" }))]);
  b.w.s.document.getElementById("agMsg").value = "when do you open?";
  await b.w.ev("agentSend()");
  assert.equal(b.sends.length, 1, "one press did not make one send");
  assert.equal(b.sends[0].body, "when do you open?");
  assert.ok(b.sends[0].key, "the send carried no key, so a retry cannot be told from a new message");
  // THE RUN'S STATE CAME FROM THE SERVER, not from the browser. `agentSend` composes
  // none of it: it appends the message and re-reads, and the thread is the one reader.
  assert.deepEqual(b.w.val("agentMsgs.map((m) => m.run && m.run.state)"), ["queued"]);
  assert.ok(b.reads.length >= 1, "the send did not re-read the conversation");
});

test("⚠ A DOUBLE PRESS IS ONE MESSAGE AND ONE RUN, because both presses carry ONE key", async (t) => {
  // THE SCENARIO THE BUTTON'S `disabled` CANNOT COVER: two presses landing before
  // the re-render, or the Enter key held. The server absorbs the second on the key,
  // so what this has to prove is that the second press SENDS THE SAME KEY — which is
  // false the moment a key is minted inside `agentSend`.
  const b = sending(t);
  b.w.s.document.getElementById("agMsg").value = "twice";
  const first = b.w.ev("agentSend()");
  const second = b.w.ev("agentSend()");
  await Promise.all([first, second]);
  assert.equal(b.sends.length, 2, "the second press never reached the server");
  assert.equal(b.sends[0].key, b.sends[1].key,
    "the two presses carried different keys, so the server saw two messages");
});

test("...AND A FAILED SEND KEEPS ITS KEY, so pressing again is the SAME press", async (t) => {
  // A lost response is indistinguishable from a refusal here, and the recovery for
  // both is the person pressing again. If the key were cleared on failure, that
  // second press would be a new press — and a message the server already committed
  // would gain a second copy with a second run.
  let fail = true;
  const b = sending(t, { sendAnswer: (body) => (fail ? badRes("couldn’t save that just now") : okRes({
    id: body.id, repeat: true, queued: false, message: msg("m1", body.body), runId: "run-1" })) });
  b.w.s.document.getElementById("agMsg").value = "for A";
  await b.w.ev("agentSend()");
  assert.equal(b.w.ev('agentDraftOf("A")'), "for A", "a failed send lost the words");
  const key = b.sends[0].key;
  fail = false;
  await b.w.ev("agentSend()");
  assert.equal(b.sends[1].key, key, "the retry was a new press, so the server saw a second message");
  // AND ONCE IT LANDS, BOTH GO. A key kept after a success would make the NEXT
  // message a retry of this one and be absorbed — the failure in the other direction.
  assert.equal(b.w.ev('agentDraftOf("A")'), "");
  b.w.s.document.getElementById("agMsg").value = "something new";
  await b.w.ev("agentSend()");
  assert.notEqual(b.sends[2].key, key, "a genuinely new message reused the last one's key");
});

test("A RELOAD MID-RUN NEEDS NO RECOVERY, because the browser remembers nothing", async (t) => {
  // The screen holds no state about a run at all — `agentLive` is derived from the
  // rows the server just sent. So a reload is an ordinary first read of a
  // conversation that happens to have work in it, and the watching starts from that.
  const fresh = sending(t, { thread: [msg("m1", "hello", run("working", { step: 2 }))] });
  await fresh.w.ev('agentThreadLoad("A")');
  assert.deepEqual(fresh.w.val("agentMsgs.map((m) => m.run.state)"), ["working"]);
  assert.equal(fresh.w.val("agentLive(agentMsgs)"), true, "a running conversation is not being watched");
  // AND A FINISHED ONE IS NOT WATCHED. Without this, the poll would run for ever on
  // every conversation anybody opens.
  const done = sending(t, { thread: [msg("m1", "hello", run("answered", { text: "[simulated] nine" }))] });
  await done.w.ev('agentThreadLoad("A")');
  assert.equal(done.w.val("agentLive(agentMsgs)"), false, "a finished conversation is still being watched");
  assert.equal(done.w.ev("agentPollTimer === null"), true, "a finished conversation armed a poll");
});

test("A FAILED RUN IS SHOWN AS A FAILURE, with the engine's own reason", async (t) => {
  const b = sending(t, { thread: [msg("m1", "hello", run("failed", { why: "call-failed" }))] });
  await b.w.ev('agentThreadLoad("A")');
  assert.equal(b.w.val("agentMsgs[0].run.state"), "failed");
  assert.equal(b.w.val("agentLive(agentMsgs)"), false, "a failed run is still being watched");
  // The sentence names the cause. "Something went wrong" cannot tell a run that hit
  // a limit from one whose model call died, and they need different things done.
  assert.match(b.w.ev('agentWhyText("call-failed")'), /model call failed/);
  assert.match(b.w.ev('agentWhyText("spent")'), /limits/);
  // AN UNKNOWN REASON IS SHOWN AS ITSELF rather than swallowed — the engine gains
  // stop reasons without this file being edited.
  assert.match(b.w.ev('agentWhyText("brand-new-reason")'), /brand-new-reason/);
  assert.match(b.w.ev('agentWhyText("unknown")'), /no reason recorded/);
});

test("⚠ A POLL THAT FIRES AFTER THE SCREEN MOVED TOUCHES NOTHING", async (t) => {
  // THE BINDING, ON A TIMER INSTEAD OF ON A RESPONSE. Between arming a poll and its
  // firing, somebody can open another conversation or sign in as somebody else — and
  // a poll that painted A's rows into B is the defect every other case in this file
  // is about, arriving through the one door that has no request to bind.
  const b = sending(t, { thread: [msg("m1", "hello", run("working", { step: 1 }))] });
  // THE TIMER IS CAPTURED RATHER THAN WAITED FOR. `setTimeout` is an ordinary global
  // in the page's scope, so replacing it here needs no seam in the product — and a
  // case that really slept 2.5 seconds would be one nobody re-runs.
  const poll = catchPoll(b.w);
  await b.w.ev('agentThreadLoad("A")');
  assert.ok(poll.armed, "a running conversation armed no poll");
  const before = b.reads.length;
  // B is opened, and only then does the timer fire.
  b.w.ev('agentThread = "B"; agentMsgs = []; agentMsgsFor = "B";');
  await poll.fire();
  assert.equal(b.reads.length, before, "the poll read A's conversation after B was opened");
  assert.deepEqual(b.w.val("agentMsgs"), [], "the poll painted A's rows into B");
  // THE CONTROL: with the screen left on A, the very same timer DOES read. Without
  // it, "the poll touched nothing" could be true because the poll never polls.
  const c = sending(t, { thread: [msg("m1", "hello", run("working", { step: 1 }))] });
  const onA = catchPoll(c.w);
  await c.w.ev('agentThreadLoad("A")');
  const had = c.reads.length;
  await onA.fire();
  assert.equal(c.reads.length, had + 1, "the poll never reads, so the case above proves nothing");
  // AND THE SAME WALL ON THE ACCOUNT. A session that expires mid-run and is replaced
  // is the other way the screen moves, and a poll must not carry A's rows into it.
  const d = sending(t, { thread: [msg("m1", "hello", run("working", { step: 1 }))] });
  const other = catchPoll(d.w);
  await d.w.ev('agentThreadLoad("A")');
  const seen = d.reads.length;
  d.w.signIn("acct-B");
  await other.fire();
  assert.equal(d.reads.length, seen, "the poll read a conversation for the account that left");
});

test("LEAVING THE CONVERSATION STOPS THE WATCHING", async (t) => {
  const b = sending(t, { thread: [msg("m1", "hello", run("queued"))] });
  await b.w.ev('agentThreadLoad("A")');
  assert.equal(b.w.ev("agentPollTimer !== null"), true, "no poll was armed");
  b.w.ev("agentList();");
  assert.equal(b.w.ev("agentPollTimer === null"), true, "the poll outlived the screen that wanted it");
});

test("A READ THAT FAILED ARMS NO POLL, so a server that is down is not hammered", async (t) => {
  // At this interval, for as long as the screen is open. It is the presence of live
  // work in a SUCCESSFUL answer that arms the next read, and nothing else.
  //
  // ⚠ AND THE STOP IS A HOOK HERE TOO, which is what the sweep found: with a poll
  // armed on a failed read, the chain is read → arm → fire → read → arm, for ever, and
  // the assertion below fails without ever reaching a cleanup at the end of the body.
  // `node --test` then never exits and the runner reads a hang instead of a kill —
  // eleven minutes on a mutant it had correctly killed. Every screen that can arm a
  // timer stops it in a hook, including the ones built by hand.
  const w = loadScreen({ answer: (path) => (path.startsWith("/api/agent/messages")
    ? badRes("couldn’t load this conversation") : okRes({ agents: ROWS })) });
  t.after(() => { try { w.ev("agentPollStop();"); } catch { /* the page may be gone */ } });
  setRows(w);
  w.ev('agentThread = "A";');
  await w.ev('agentThreadLoad("A")');
  assert.ok(w.ev("agentMsgsErr").length > 0, "a failed read said nothing");
  assert.equal(w.ev("agentPollTimer === null"), true, "a failed read armed a poll");
});

test("WHAT EACH RUN STATE DRAWS, and what a message with no run draws", (t) => {
  // **DRIVEN AS A FUNCTION, because two sweep mutants survived every case above.**
  // `agentRunHtml` is pure, and the two things it must get right are invisible from a
  // case that only ever asks for a queued or answered run: that a message with NO run
  // draws NOTHING, and that the chrome's label is absent when the answer is not a
  // stand-in. Both would otherwise be found by a customer.
  const w = loadScreen({ answer: () => okRes({ agents: ROWS }) });
  t.after(() => { try { w.ev("agentPollStop();"); } catch { /* the page may be gone */ } });
  const draw = (run) => w.ev(`agentRunHtml(${JSON.stringify(run)})`);

  // A MESSAGE THAT STARTED NOTHING DRAWS NOTHING. Every imported conversation is that
  // shape, and so is every message sent before this existed — a bubble there would be
  // a sentence about the platform in the middle of somebody's conversation.
  for (const none of [null, undefined, 0, ""]) {
    assert.equal(draw(none), "", `${JSON.stringify(none)} drew something`);
  }

  const queued = draw(run("queued"));
  assert.match(queued, /ag-msg-bot/, "a queued run draws nothing on the agent's side");
  assert.match(queued, /Queued/);
  assert.ok(!/ag-bubble-bot/.test(queued), "a run with no answer drew a bubble");

  const working = draw(run("working", { step: 3 }));
  assert.match(working, /Working/);
  assert.match(working, /step 3/, "the progress does not say how far it has got");

  const answered = draw(run("answered", { step: 1, text: "[simulated] we open at nine", at: 1 }));
  assert.match(answered, /ag-bubble-bot/, "an answer is not drawn as a bubble");
  assert.match(answered, /we open at nine/);

  const failed = draw(run("failed", { why: "call-failed" }));
  assert.match(failed, /ag-run-fail/);
  assert.match(failed, /model call failed/);
  assert.ok(!/ag-bubble-bot/.test(failed), "a failure drew a bubble, which reads as an answer");

  // ⚠ THE CHROME'S LABEL IS DRAWN FOR A STAND-IN AND NOT FOR A REAL ANSWER, in every
  // state. A label written unconditionally survives every other case in this file —
  // it did — and would keep saying "simulated" over a real provider's answer, which is
  // the one thing this milestone must not do.
  for (const state of ["queued", "working", "answered", "failed"]) {
    const on = draw(run(state, { simulated: true, text: "x", why: "spent", step: 1 }));
    const off = draw(run(state, { simulated: false, text: "x", why: "spent", step: 1 }));
    assert.match(on, /class="ag-sim"/, `${state}: a stand-in is not labelled`);
    assert.ok(!/ag-sim/.test(off), `${state}: a real answer is labelled as a simulation`);
    // And the STATE still draws either way, so the label is not what carries it.
    assert.match(off, /ag-msg-bot/, `${state}: nothing is drawn for a real answer`);
  }

  // AN ANSWERED RUN WITH NO WORDS IS SAID, not drawn as an empty bubble — an empty
  // bubble reads as a rendering fault rather than as what happened.
  const silent = draw(run("answered", { text: "" }));
  assert.match(silent, /without saying anything/);
  assert.ok(!/ag-bubble-bot/.test(silent), "an empty answer drew an empty bubble");

  // The agent's words are ESCAPED. They come from a model, and the thread is built
  // with `innerHTML`.
  const nasty = draw(run("answered", { text: '<img src=x onerror="alert(1)">' }));
  assert.ok(!nasty.includes("<img"), "a model's answer reached the page as markup");
  assert.match(nasty, /&lt;img/);
});

// ════════════════════════════════════════════════════════════════════════════
// THE POLL AND THE MESSAGE BOX (2026-09-16)
//
// A code review found three things wrong with this screen once a run is really
// going, and two of them are here. They are the shape this whole file exists for:
// the code reads correctly, every earlier case passes, and the defect only exists
// while time passes and somebody is typing.
// ════════════════════════════════════════════════════════════════════════════

test("⚠ TYPING WHILE IT ANSWERS SURVIVES THE POLL — the words, the cursor and the focus", async (t) => {
  // THE DEFECT: `renderAgents` writes `innerHTML`, the poll calls it every 2.5 s, and
  // the draft it redraws from was only ever written on Send. So a sentence typed while
  // waiting for an answer was destroyed at the next tick — eight times a minute — with
  // the caret and the focus going with it.
  const b = sending(t);
  b.serve([msg("m1", "hello", run("working", { id: "run-1", step: 2 }))]);
  const poll = catchPoll(b.w);
  await b.w.ev('agentThreadLoad("A", true)');
  assert.ok(poll.armed, "a working run armed no poll, so this case proves nothing");

  // THE RENDER'S OWN HALF: the box it draws says which conversation it belongs to and
  // asks to be saved as it is typed. Asserted on the drawn markup, because nothing in
  // this harness parses HTML — the other half is driven below through the element.
  const drawn = () => b.w.s.document.getElementById("viewAgents").innerHTML;
  assert.match(drawn(), /id="agMsg"[^>]*data-agent="A"/, "the box does not say which conversation it is");
  assert.match(drawn(), /data-input="agent-msg"/, "the box does not save what is typed into it");

  const box = b.w.s.document.getElementById("agMsg");
  box.setAttribute("data-agent", "A");
  box.value = "half a sentence";
  box.selectionStart = 4; box.selectionEnd = 4;
  box.focus();
  const focusedBefore = box.focusCount;

  await poll.fire();                       // the real poll callback: a quiet read, then a redraw

  assert.equal(b.w.ev('agentDraftOf("A")'), "half a sentence",
    "the poll did not take what was in the box, so the next redraw loses it");
  assert.match(drawn(), />half a sentence<\/textarea>/,
    "the redrawn box does not carry the half-typed message");
  assert.deepEqual(box.rangeSet, [4, 4], "the cursor was not put back where it was");
  assert.ok(box.focusCount > focusedBefore, "the box lost focus to the poll");
  // AND THE THREAD REALLY WAS REDRAWN, so this is not passing because nothing happened.
  assert.match(drawn(), /hello/);
});

test("...and the box is only restored into the conversation it came from", () => {
  // THE OPPOSITE MISTAKE, which is worse than the one above: forcing focus and a
  // cursor into whatever box is on screen now would move somebody's caret in a
  // conversation they had just opened.
  const w = loadScreen({ uid: "acct-A", answer: () => okRes({ agents: [] }) });
  const box = w.s.document.getElementById("agMsg");
  box.setAttribute("data-agent", "A");
  box.value = "typed in A";
  box.focus();
  const held = w.ev("agentComposerRead()");
  assert.equal(w.ev('agentDraftOf("A")'), "typed in A", "reading the box did not save it");
  box.setAttribute("data-agent", "B");     // a different conversation is drawn now
  box.rangeSet = null;
  const focused = box.focusCount;
  w.ev(`agentComposerRestore(${JSON.stringify(held)})`);
  assert.equal(box.rangeSet, null, "a cursor was put into another conversation's box");
  assert.equal(box.focusCount, focused, "focus was forced into another conversation's box");
});

test("...and a box that names no conversation is read and restored by nobody", () => {
  // The control for the two cases above: the ATTRIBUTE is what makes either work, so
  // without it neither may do anything at all — never a fall back to whatever is open.
  const w = loadScreen({ uid: "acct-A", answer: () => okRes({ agents: [] }) });
  w.ev('agentThread = "A";');
  const box = w.s.document.getElementById("agMsg");
  box.value = "unattributed";
  const held = w.ev("agentComposerRead()");
  assert.equal(w.ev('agentDraftOf("A")'), "", "a box with no conversation wrote into one anyway");
  w.ev(`agentComposerRestore(${JSON.stringify(held)})`);
  assert.equal(box.rangeSet, null);
});

test("what is typed is the draft immediately, without waiting for Send", async (t) => {
  // The input hook, driven through the page's own table. Without it the only writer is
  // the render, and a browser that gave us no input event would lose the last keystroke.
  const b = sending(t);
  b.w.ev(`INPUT_ACTIONS['agent-msg']({}, { getAttribute: () => "A", value: "as I type" })`);
  assert.equal(b.w.ev('agentDraftOf("A")'), "as I type");
  // AND IT DRAWS NOTHING. A re-render per keystroke is the twitch the wrapper exists
  // to remove, so the hook must not be the thing that calls it.
  const before = b.w.s.document.getElementById("viewAgents").innerHTML;
  b.w.ev(`INPUT_ACTIONS['agent-msg']({}, { getAttribute: () => "A", value: "as I type more" })`);
  assert.equal(b.w.s.document.getElementById("viewAgents").innerHTML, before,
    "typing redrew the panel, which is the twitch this is meant to avoid");
});

test("⚠ AN EDITED RETRY AFTER A LOST RESPONSE IS A NEW PRESS, not a silent no-op", async (t) => {
  // THE DEFECT: the first send COMMITTED and its response was lost. The words are still
  // in the box, so the person edits them and presses again — and with the key held per
  // conversation, that retry carried the FIRST message's key. The server absorbed it,
  // answered the original body, the browser read `ok` and cleared the box: the edit
  // gone, silently, with the conversation keeping text nobody wanted to send.
  let lose = true;
  const b = sending(t, { sendAnswer: (body) => (lose ? badRes("couldn’t reach the server") : okRes({
    id: body.id, repeat: false, queued: true, message: msg("m2", body.body), runId: "run-2" })) });
  const box = b.w.s.document.getElementById("agMsg");
  box.value = "can you come tuesday";
  await b.w.ev("agentSend()");
  const first = b.sends[0].key;
  assert.equal(b.w.ev('agentDraftOf("A")'), "can you come tuesday", "the lost send lost the words");

  // The SAME words retried are the same press: one message, one run.
  lose = true;
  await b.w.ev("agentSend()");
  assert.equal(b.sends[1].key, first, "an unedited retry minted a new key, so the server sees two messages");

  // NOW THE EDIT. Different words are a different message and must carry their own key.
  lose = false;
  box.value = "can you come wednesday instead";
  b.w.ev(`agentDraftSet("A", "can you come wednesday instead");`);
  await b.w.ev("agentSend()");
  assert.equal(b.sends[2].body, "can you come wednesday instead");
  assert.notEqual(b.sends[2].key, first,
    "the edit carried the first message's key, so the server absorbed it and the edit was lost");
  assert.equal(b.w.ev('agentDraftOf("A")'), "", "a send that really landed left its words as unsent");
});

test("...and an absorbed press whose words differ keeps the edit rather than clearing it", async (t) => {
  // THE SERVER'S HALF, which cannot be reached from this browser any more (the key is
  // bound to the body) and is answered anyway: another tab, an older cached script or a
  // hand request can all produce it, and the one outcome that must never happen is the
  // person's edited words disappearing behind an `ok`.
  const b = sending(t, { sendAnswer: (body) => okRes({
    id: body.id, repeat: true, mismatch: true, queued: false,
    message: msg("m1", "what was really stored"), runId: "run-1" }) });
  b.w.s.document.getElementById("agMsg").value = "my edited words";
  await b.w.ev("agentSend()");
  assert.equal(b.w.ev('agentDraftOf("A")'), "my edited words",
    "an absorbed press with different words cleared the box");
  assert.match(b.w.ev("agentActErr"), /already sent/i, "nothing told the person what happened");
  // THE MESSAGE IS NOT APPENDED AS IF IT WERE THIS ONE, and the key is dropped so the
  // next press is a NEW message rather than a third attempt to absorb.
  assert.deepEqual(b.w.val("agentMsgs.map((m) => m.text)"), [], "the stored message was drawn as this send's");
  await b.w.ev("agentSend()");
  assert.notEqual(b.sends[1].key, b.sends[0].key, "the next press reused the absorbed key");
});

test("⚠ A SUCCESSFUL SEND EMPTIES THE BOX, not just the draft — found on the live site", async (t) => {
  // THE DEFECT, and it needed a real browser to see. `agentSend` drops the draft on
  // success; the next render then READS the box before redrawing it, and the words
  // still sitting in the textarea were written straight back into the draft it had
  // just cleared. So the box kept the sent message, and the next press sent it again.
  //
  // Every unit case missed it because the fake `#agMsg` carried no `data-agent`, so
  // the read answered "no conversation" and wrote nothing — the fixture was less
  // capable than the render. It carries the attribute now, which is what makes this
  // case able to fail.
  const b = sending(t);
  const box = b.w.s.document.getElementById("agMsg");
  box.value = "when do you open on sunday?";
  await b.w.ev("agentSend()");
  assert.equal(b.sends.length, 1);
  assert.equal(b.w.ev('agentDraftOf("A")'), "", "the draft survived a successful send");
  assert.equal(box.value, "", "the BOX kept the sent message, so the next press sends it twice");
  // AND THE REDRAW AGREES: the drawn textarea is empty too, which is the half a
  // person sees.
  assert.doesNotMatch(b.w.s.document.getElementById("viewAgents").innerHTML,
    />when do you open on sunday\?<\/textarea>/, "the redrawn box still holds the sent message");
});

test("...and a FAILED send leaves the box exactly as it was", async (t) => {
  // The control. Clearing the box on failure would throw away words the server never
  // took — the opposite defect, and the one the draft-keeping rules exist for.
  const b = sending(t, { sendAnswer: () => badRes("couldn’t reach the server") });
  const box = b.w.s.document.getElementById("agMsg");
  box.value = "did you get this";
  await b.w.ev("agentSend()");
  assert.equal(box.value, "did you get this", "a failed send emptied the box");
  assert.equal(b.w.ev('agentDraftOf("A")'), "did you get this");
});
