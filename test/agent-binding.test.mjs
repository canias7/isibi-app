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

/**
 * ⚠ **THE STATES THE SERVER CAN ANSWER, FROM THE SERVER'S OWN LIST.** Both halves are the
 * site's — `agent-store.mjs` is this product's module and `public/chat.js` is its screen —
 * so the census over what a conversation draws is derived rather than transcribed, and a
 * state added to `runView` next month fails here by existing rather than by being noticed.
 */
import { RUN_STATES } from "../agent-store.mjs";

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
/**
 * TURN WHAT THE FORM REALLY DREW INTO A DOM THE FORM CAN READ BACK.
 *
 * **THE FIXTURE IS DERIVED FROM ITS OWN PRODUCER, which is the only way these
 * cases mean anything.** `renderAgentsNow` writes a STRING into `innerHTML`, and
 * `agentSave` reads elements — so without this the two halves never meet and a
 * case would be asserting that a fixture it typed itself round-trips. Here the
 * checkboxes that exist are exactly the ones the product drew, ticked exactly as
 * the product drew them, so a case that unticks one is unticking a real control.
 *
 * It is deliberately a PARSE of the markup rather than a list this file keeps: a
 * tool the form stops drawing disappears from the fixture too, which is what makes
 * "the form draws the catalog" and "a save sends what is ticked" one property
 * instead of two that can drift.
 */
function hydrate(w) {
  const html = w.s.document.getElementById("viewAgents").innerHTML;
  const val = (id) => {
    const m = new RegExp(`id="${id}"[^>]*value="([^"]*)"`).exec(html);
    return m ? m[1] : null;
  };
  const name = w.s.document.getElementById("agName");
  if (val("agName") !== null) name.value = val("agName");
  const instr = w.s.document.getElementById("agInstr");
  const ta = /<textarea[^>]*id="agInstr"[^>]*>([\s\S]*?)<\/textarea>/.exec(html);
  if (ta) instr.value = ta[1].trim();
  // The pause, as drawn: an `id="agPaused"` input carrying `checked` or not.
  const pausedEl = w.s.document.getElementById("agPaused");
  const drawnPause = /<input type="checkbox" id="agPaused"([^>]*)>/.exec(html);
  pausedEl.checked = !!(drawnPause && / checked/.test(drawnPause[1]));
  // One element per tool checkbox the form drew, in the order it drew them.
  const boxes = [...html.matchAll(/<input type="checkbox" data-tool="([^"]+)"([^>]*)>/g)].map((m) => {
    const box = { checked: / checked/.test(m[2]), getAttribute: (k) => (k === "data-tool" ? m[1] : null) };
    return box;
  });
  w.s.document.querySelectorAll = (sel) => (sel === "[data-tool]" ? boxes : []);
  // ⚠ THE ZONE BOX, HYDRATED FROM THE MARKUP LIKE THE NAME. Without this every case
  // below reads an empty element the form may never have drawn — which is the fixture
  // being less capable than the render, in the field whose whole point is that a
  // scheduled automation cannot be authored until somebody fills it in.
  const zoneEl = w.s.document.getElementById("agZone");
  const drawnZone = val("agZone");
  if (drawnZone !== null) zoneEl.value = drawnZone;
  // BOTH, and they answer different questions: `paused` is what the form was DRAWN
  // with, `pauseBox` is the control somebody presses. A case that only had the
  // boolean could assert the drawing and never tick the box — which is how a
  // control that answers and is discarded stays invisible.
  return { html, boxes, drewPause: !!drawnPause, paused: pausedEl.checked, pauseBox: pausedEl,
           drewZone: drawnZone !== null, zone: zoneEl.value, zoneBox: zoneEl };
}

/**
 * ⚠ HYDRATE THE AUTOMATION FORM FROM THE MARKUP IT REALLY DREW.
 *
 * The same shape as `hydrate` above and for the same reason: a case that adds a step
 * must be pressing the control the form really drew, over the values it really drew, or
 * it is testing a fixture. **THE STEP ROWS ARE WHERE THIS EARNS ITS PLACE** — the form's
 * read-back walks `[data-step-type]` and then each row's own `[data-field]` and
 * `[data-day]`, so a fake whose rows answered nothing would make the whole read
 * unobservable and report the generation gate as working with the gate deleted.
 */
function hydrateAuto(w) {
  const doc = w.s.document;
  const html = doc.getElementById("viewAgents").innerHTML;
  const val = (id) => {
    const m = new RegExp(`id="${id}"[^>]*value="([^"]*)"`).exec(html);
    return m ? m[1] : null;
  };
  // THE FORM'S OWN GENERATION, as an attribute, because that is how the read-back tells
  // "the screen shows what I hold" from "the screen is older than what I hold".
  const form = doc.getElementById("agAutoForm");
  const gen = /id="agAutoForm" data-gen="(\d+)"/.exec(html);
  if (gen) form.setAttribute("data-gen", gen[1]);
  for (const id of ["agAutoName", "agAutoAt", "agAutoZone"]) {
    const v = val(id);
    if (v !== null) doc.getElementById(id).value = v;
  }
  const sched = /<option value="(manual|daily)" selected>/.exec(html);
  doc.getElementById("agAutoSched").value = sched ? sched[1] : "manual";
  const offBox = doc.getElementById("agAutoOff");
  const drawnOff = /<input type="checkbox" id="agAutoOff"([^>]*)>/.exec(html);
  offBox.checked = !!(drawnOff && / checked/.test(drawnOff[1]));

  // One fake row per step the form drew, each answering its OWN fields — which is what
  // `agentAutoValues` walks.
  const chunks = html.split('class="ag-step" data-step-type="').slice(1);
  const rows = chunks.map((chunk) => {
    const type = chunk.slice(0, chunk.indexOf('"'));
    const body = chunk.slice(0, chunk.indexOf('class="ag-step"') === -1 ? chunk.length : chunk.indexOf('class="ag-step"'));
    const fields = [...body.matchAll(/data-field="([^"]+)"[^>]*value="([^"]*)"/g)].map((m) => ({
      value: m[2].replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, "&"),
      getAttribute: (k) => (k === "data-field" ? m[1] : null),
    }));
    // ⚠ **A `<select>` HAS NO `value=` ATTRIBUTE, so the regex above could never see one —
    // and every choice field on this form is a select.** That is a fixture LESS capable than
    // a browser, in the controls that decide which other controls exist: with it, no case
    // could read the wait's kind, the comparison's operator or the timeout outcome, so all
    // three read as absent and a save that dropped them looked correct. The chosen option is
    // the value, exactly as `.value` reflects it in a browser.
    for (const m of body.matchAll(/<select[^>]*data-field="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
      const picked = /<option value="([^"]*)" selected>/.exec(m[2]);
      // ⚠ **A `<select>` WITH NOTHING SELECTED ANSWERS ITS FIRST OPTION, NEVER THE EMPTY
      // STRING.** HTML's own selectedness algorithm picks the first enabled option when no
      // `selected` attribute is present, so `.value` is that option's value — and answering
      // `""` here made this fake LESS capable than a browser in exactly the field it is
      // about. A sweep mutant that removed the blank option from every OPTIONAL choice
      // SURVIVED because of it: the form drew a select with no blank and no `selected`, a
      // real browser would have read back the first option and stored a default nobody
      // chose, and this fixture read back nothing at all and called it correct.
      const firstOpt = /<option value="([^"]*)"/.exec(m[2]);
      const el = {
        value: picked ? picked[1] : firstOpt ? firstOpt[1] : "",
        getAttribute: (k) => (k === "data-field" ? m[1] : k === "data-kind" ? "choice" : null),
      };
      fields.push(el);
    }
    const days = [...body.matchAll(/data-day="([^"]+)"([^>]*)>/g)].map((m) => ({
      checked: / checked/.test(m[2]),
      getAttribute: (k) => (k === "data-day" ? m[1] : null),
    }));
    return {
      getAttribute: (k) => (k === "data-step-type" ? type : null),
      querySelectorAll: (sel) => (sel === "[data-field]" ? fields : sel === "[data-day]" ? days : []),
      fields, days,
    };
  });
  doc.querySelectorAll = (sel) => (sel === "[data-step-type]" ? rows : []);
  return { html, rows, form, offBox, gen: gen ? Number(gen[1]) : null };
}

/** The step catalog as the server sends it, derived from what the engine really has. */
/**
 * THE CATALOG THE ROUTE REALLY SENDS, not a hand-typed pair of steps.
 *
 * ⚠ **A HAND-TYPED CATALOG WENT STALE AND TOOK EVERY NEW CONTROL WITH IT.** This held two
 * steps — a weekday and a note — written when there were two, so once the catalog grew to
 * nine the form under test could not draw a branch, a wait, an approval, a lookup or a
 * memory read AT ALL, and every case about them would have passed against a screen with no
 * such control on it. Derived from `agent-store.mjs`, which is the object `/api/agent/list`
 * puts on the wire, so a step added next month arrives here by existing. `JSON` round-trips
 * it because that is what a real answer is: frozen objects with no prototype from this realm.
 */
const { AUTOMATION_STEPS, AUTOMATION_DAYS, EXAMPLE_AUTOMATION, MAX_AUTOMATION_INPUTS,
  AGENT_PROVIDERS, MAX_CONNECTIONS, connectionRow } = await import("../agent-store.mjs");
const STEP_CATALOG = JSON.parse(JSON.stringify(AUTOMATION_STEPS));
assert.ok(STEP_CATALOG.length >= 9, `the catalog read as ${STEP_CATALOG.length} steps`);
const DAY_LIST = [...AUTOMATION_DAYS];
/**
 * ⚠ **THE WORKED EXAMPLE, DERIVED FROM THE ROUTE'S OWN ANSWER rather than typed.** A fixture
 * that hand-wrote one would be a second example agreeing with the real one today — which is
 * the trap this file has already paid for twice, with `STEP_CATALOG` and with `hydrateAuto`.
 */
const EXAMPLE = JSON.parse(JSON.stringify(EXAMPLE_AUTOMATION));

/** One agent with one automation, and the screen opened on it. */
/**
 * ⚠ **A CONNECTION AS THE ROUTE REALLY ANSWERS ONE — built by the PRODUCER, never typed here.**
 *
 * The case below used to set `agentConnRows` by hand with a `state` field, and
 * `connectionRow()` answers `status` and has no `state` at all: so the browser's filter was
 * `undefined === 'active'` for every real row, the fixture agreed with it, and both halves
 * shared one defect. Passing a database-shaped row through the real reader is what makes that
 * impossible — a field renamed on the answer moves here too, or this stops compiling.
 */
const connAnswer = (r) => connectionRow({
  id: r.id, agent_id: "A", provider: r.provider ?? "fakemail",
  label: r.label ?? "", account: r.account ?? "someone@example.test",
  scopes: r.scopes ?? ["read", "send"], status: r.status ?? "active",
  refreshable: false, expires_at: null, stopped_why: null, created_at: "2026-09-19T00:00:00Z",
});

function autoAnswer({ automations = [], steps = STEP_CATALOG, listFails = false, history = [],
  fail = {}, noExample = false, halfExample = false, connections = [], connFails = false,
  connThrows = false,
  noSendScope = false, onPost = () => {} } = {}) {
  return (path, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    /**
     * ⚠ **THE CONNECTED ACCOUNTS COME FROM THE ROUTE, because that is where the browser now
     * reads them.** It is a GET, so it must be answered ABOVE the catch-all — which records a
     * post and would make every example press look like one.
     */
    if (path.startsWith("/api/agent/connections")) {
      // ⚠ A REFUSED ANSWER AND A READ THAT NEVER HAPPENED ARE TWO SHAPES, and only the second
      // reaches the `catch`. `apiFetch` is `async`, so a throw here is a rejected promise —
      // which is what a browser with no network really produces.
      if (connThrows) throw new Error("the network went away");
      if (connFails) return { ok: false, body: { error: "the store is away" } };
      // AND THE CATALOG RIDES ON IT, as the real route sends it. `noSendScope` is the older
      // Worker: a provider described with no send scope at all, which nothing may read as
      // permission to send.
      const providers = JSON.parse(JSON.stringify(AGENT_PROVIDERS)).map((pr) => {
        if (noSendScope) delete pr.sendScope;
        return pr;
      });
      return { ok: true, body: { ok: true, connections: connections.map(connAnswer),
        providers, max: MAX_CONNECTIONS } };
    }
    if (path.startsWith("/api/agent/list")) {
      return { ok: true, body: { ok: true, agents: [{ id: "A", name: "Shop", instructions: "help", created: 1, updated: 1, preview: "", status: "active", tools: [] }], tools: [] } };
    }
    if (path.startsWith("/api/agent/messages")) return { ok: true, body: { ok: true, id: "A", messages: [] } };
    if (path.startsWith("/api/agent/automations")) {
      if (listFails) return { ok: false, body: { error: "the store is away" } };
      // ⚠ EVERY KEY THE ROUTE REALLY SENDS. `maxInputs` was missing here as well as in the
      // browser, so a fixture-side check could not have seen the browser dropping it — the
      // same key absent from both sides of the wire.
      return { ok: true, body: { ok: true, agent: "A", automations, steps, days: DAY_LIST,
        max: 20, maxInputs: MAX_AUTOMATION_INPUTS,
        // ⚠ THREE SHAPES, because a sweep survivor showed the middle one was undrivable: a
        // whole example, NONE at all (an older Worker), and a HALF-READ one — an answer that
        // is truthy and carries no steps, which a truthiness check would offer as an example.
        example: noExample ? undefined : (halfExample ? { name: EXAMPLE.name } : EXAMPLE) } };
    }
    // THE HISTORY IS THE FIXTURE'S, so a case about a WAITING execution has one to look at.
    // It held `executions: []` and that is what made every waiting-and-approving case below
    // impossible to write: the panel drew nothing and nothing was wrong with it.
    if (path.startsWith("/api/agent/automation-history")) {
      return { ok: true, body: { ok: true, id: body.id, executions: history } };
    }
    onPost(path, body);
    // ONE ROUTE MADE TO FAIL, BY PATH. A refusal is a first-class outcome on this screen —
    // two of the approval route's three refusals are 409s that are not failures — so a
    // fixture that can only succeed cannot ask what the screen does with one.
    const said = Object.keys(fail).find((k) => path.startsWith(k));
    if (said) return { ok: false, body: { error: fail[said] } };
    return { ok: true, body: { ok: true, id: "AU1", runId: "R1", notified: true, automation: { ...(automations[0] ?? {}), enabled: body.enabled } } };
  };
}

/** What one `/api/agent/list` answer looks like, catalog and all. */
const CATALOG = [{ name: "echo", label: "Echo", does: "Repeats a short piece of text back." }];

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
  // ⚠ RE-ANCHORED TWICE, and each time the claim got stronger rather than looser. The
  // draft carries every setting the form draws — the ticks, the pause and now the time
  // zone — so a failed save has to keep all of them: a form redrawn with an unticked box
  // ticked would say a permission was stored when it was refused, and one redrawn with a
  // zone the person had just cleared would say the same about a schedule.
  assert.deepEqual(w.val("agentDraft"),
    { name: "A renamed", instructions: "new instructions for A", status: "active", tools: [], zone: null },
    "the settings that failed were not kept");
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
function sending(t, { thread = [], sendAnswer = null, uid = "acct-A", approvals = [] } = {}) {
  const sends = [];
  const reads = [];
  let rows = thread;
  const w = loadScreen({
    uid,
    answer: (path, opts) => {
      // ⚠ **WHAT IS WAITING FOR A PERSON, because the thread load ASKS FOR IT on every
      // read** — and this fixture answered the agent list to that request, so
      // `agentApprovals` was `[]` in every case in this file whatever the screen did.
      // A fake LESS capable than the thing it stands in for: the banner above the box is
      // the one control whose absence is silent, and nothing here could see it.
      if (path.startsWith("/api/agent/tool-approvals")) return okRes({ approvals });
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

test("⚠ EVERY RUN STATE IS CLASSIFIED LIVE OR NOT, and a reload while waiting shows the banner", async (t) => {
  // ⚠ **`AGENT_LIVE_STATES` WAS WRITTEN FOR A FOUR-STATE WORLD** and its own comment
  // enumerated it. It happens to be right about all seven — the five it excludes are
  // states where nothing will move on its own — but nothing asserted that, so an eighth
  // state would have defaulted to "not live" in silence. The census is derived from
  // `RUN_STATES`, so a new state forces the decision rather than inheriting one.
  const b = sending(t, { thread: [] });
  const live = (state) => b.w.ev(`agentLive([{ run: ${JSON.stringify({ id: "r", state })} }])`);
  const yes = RUN_STATES.filter((s) => live(s));
  assert.deepEqual(yes, ["queued", "working"],
    `the live set is ${JSON.stringify(yes)} — every other state must have a reason not to be`);
  // AND THE OBSERVER: a message with no run, and a row that is not one, are not live either.
  assert.equal(b.w.ev("agentLive([{ run: null }, {}, null])"), false);
  assert.equal(b.w.ev('agentLive("not a list")'), false);

  // ⚠ **A RELOAD WHILE WAITING FOR AN APPROVAL IS AN ORDINARY FIRST READ**, which is the
  // scenario the milestone names: the browser remembers nothing about a pending decision,
  // so what a person comes back to is whatever the SERVER says is waiting. Driven with
  // the real shapes both routes answer.
  const pending = {
    id: "ap-1", tool: "make_automation", step: 1, index: 0,
    args: { name: "Weekday follow-up", schedule: "weekly", at: "09:00" },
  };
  const back = sending(t, {
    thread: [msg("m1", "every weekday at nine", run("waiting", { open: 1 }))],
    approvals: [pending],
  });
  await back.w.ev('agentThreadLoad("A")');
  // ⚠ THE APPROVALS READ IS STARTED AND NOT AWAITED by the thread load — deliberately, so
  // the conversation draws without waiting on a second request — so awaiting the load alone
  // asserts against a screen that has not heard yet. One macrotask turn is enough because
  // the fixture answers immediately; nothing about the product's own timing is being waited on.
  await settle();
  assert.equal(back.w.val("agentMsgs[0].run.state"), "waiting");
  assert.equal(back.w.val("agentApprovals.length"), 1, "the reload did not read what is waiting");
  assert.equal(back.w.val("agentApprovalsFor"), "A", "the banner is not bound to this agent");
  // ⚠ NO POLL, and that is the point rather than an omission: nothing will deliver this
  // run until a person answers, so a poll would ask the same question for ever.
  assert.equal(back.w.ev("agentPollTimer === null"), true, "a run waiting for a person armed a poll");
  // AND WHAT THE PERSON READS CARRIES THE ARGUMENTS THEY ARE APPROVING, because approving
  // what you were not shown is the one mistake here that cannot be taken back.
  const banner = back.w.ev(`agentApprovalHtml(${JSON.stringify(pending)})`);
  assert.match(banner, /Waiting for you/);
  assert.match(banner, /Weekday follow-up/, "the arguments are not shown");
  assert.match(banner, /Nothing has happened yet/, "it does not say nothing has happened");
  assert.match(banner, /data-act="agent-tool-approve"/, "there is no way to approve it");
  assert.match(banner, /data-act="agent-tool-reject"/, "there is no way to refuse it");
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


  // ⚠ **EVERY STATE `runView` CAN ANSWER, DERIVED FROM `RUN_STATES` RATHER THAN LISTED —
  // and listing them is exactly how three went unguarded.** The census above iterated the
  // four this function happened to draw, so `waiting`, `unresolved` and `cancelled` were
  // neither drawn nor asked about: MEASURED, `waiting` and `unresolved` both read *"It
  // stopped, and there is no reason recorded."* in the warn colour, and `cancelled` read
  // *"It stopped: cancelled."* with the who, the words and the counts dropped. A run needing
  // one press of Approve was a broken run; a stranded one was the same sentence; and
  // somebody's own decision was a fault.
  const shown = new Map();
  for (const state of RUN_STATES) {
    const h = draw(run(state, {
      step: 2, text: "hello", why: state === "cancelled" ? "cancelled" : "call-failed", at: 1,
      open: 2, by: "acct-A", note: "changed my mind", steps: 2, calls: 1,
    }));
    assert.match(h, /ag-msg-bot/, `${state}: nothing is drawn at all`);
    // WHAT A PERSON READS, with the markup taken off — which is the level the defect lived
    // at. Three states drawing three different classes and one sentence would still be
    // three states a customer cannot tell apart.
    const words = h.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    assert.ok(words.length > 0, `${state}: draws no words`);
    const same = [...shown].find(([, w]) => w === words);
    assert.ok(!same, `${state} reads exactly like ${same && same[0]}: ${words}`);
    shown.set(state, words);
  }
  assert.equal(shown.size, RUN_STATES.length);

  // ⚠ AND THE THREE FACTS EACH STATE MUST CARRY, because "they differ" is satisfied by
  // three different wrong sentences. Each was proved RED against the branch it forbids.
  const waiting = shown.get("waiting");
  assert.match(waiting, /Waiting for you/, "a run waiting for a person does not say so");
  assert.match(waiting, /2 actions/, "it does not say how many are waiting");
  assert.ok(!/ag-run-fail/.test(draw(run("waiting", { open: 1 }))),
    "a run waiting for one press of Approve is drawn as a failure");

  const stranded = shown.get("unresolved");
  assert.match(stranded, /can’t carry on/, "a stranded run does not say it cannot carry on");
  assert.match(stranded, /2 actions/, "it does not say how many are unanswered");
  assert.match(stranded, /may already have gone/, "it does not say to check before asking again");
  assert.notEqual(stranded, shown.get("waiting"),
    "stranded and waiting read the same, which is the defect this case exists for");

  const stopped = shown.get("cancelled");
  assert.match(stopped, /Stopped/, "a cancellation does not say it was stopped");
  assert.match(stopped, /changed my mind/, "the person's own words are dropped");
  assert.match(stopped, /2 steps had already run/, "what had already run is dropped");
  assert.match(stopped, /1 action had already gone out/, "1 action, not 1 actions");
  assert.match(stopped, /anything already sent stays sent/,
    "it does not say that stopping cannot reach back");
  assert.ok(!/undone|reversed|rolled back/i.test(stopped),
    "a cancellation claims completed effects were undone");
  // ⚠ NOT DRAWN AS A FAILURE: nothing went wrong, a person asked for it to stop.
  assert.ok(!/ag-run-fail/.test(draw(run("cancelled", { why: "cancelled", steps: 1 }))),
    "somebody's own decision is drawn as a fault");
  // AND A CANCELLATION THAT RECORDED NOTHING SAYS THE ONE TRUE THING and invents no counts.
  const bare = draw(run("cancelled", { why: "cancelled" }));
  assert.match(bare, /anything already sent stays sent/);
  assert.ok(!/had already run/.test(bare), "it invented a count nobody recorded");
  // AND THE ACCOUNT ID IS NEVER DRAWN — a raw uuid is not something a person can read.
  assert.ok(!stopped.includes("acct-A"), "an account id reached the conversation");

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

test("⚠ ...and it only removes WHAT WAS SENT, so typing your next message is not wiped", async (t) => {
  // FOUND LIVE, one press after the defect above was fixed. The answer lands about a
  // second after the press, so somebody who starts their next message inside that
  // second had its first characters deleted mid-word — measured on the real site as 12
  // characters gone, leaving "ake card payments".
  const b = sending(t);
  const box = b.w.s.document.getElementById("agMsg");
  box.value = "when do you open?";
  const sending1 = b.w.ev("agentSend()");
  // Typed while the request is in the air, which is exactly the window that hurt.
  box.value = "and do you take card";
  b.w.ev(`agentDraftSet("A", "and do you take card");`);
  await sending1;
  assert.equal(box.value, "and do you take card", "the send's clear ate a message it never sent");
  assert.equal(b.w.ev('agentDraftOf("A")'), "and do you take card",
    "the words typed during the send were dropped from the draft");
});

// ────────────────────────────────────────────────────────────────────────────
// THE SETTINGS: A STATUS, AND WHICH TOOLS AN AGENT MAY USE
//
// Every case here drives the real `renderAgentsNow` and the real `agentSave`, and
// the DOM between them is HYDRATED FROM WHAT THE FORM DREW. A case that typed its
// own checkboxes would be asserting that a fixture round-trips.
// ────────────────────────────────────────────────────────────────────────────

/**
 * A screen whose list read answers a catalog, loaded and rendered.
 *
 * `tools: null` is how a case asks for an answer with NO `tools` key at all — the
 * older-Worker shape. A default parameter cannot express it: `undefined` is exactly
 * what a default replaces, so passing it asked for the catalog back and the empty
 * state read as green while never being drawn.
 */
async function withCatalog({ tools = CATALOG, rows = SETTINGS_ROWS, answer } = {}) {
  const list = tools === null ? { agents: rows } : { agents: rows, tools };
  const w = loadScreen({
    answer: answer || ((p) => okRes(p === "/api/agent/list" ? list : {})),
  });
  await w.ev("agentsLoad()");
  return w;
}

/**
 * ⚠ **`zone` IS ON THESE ROWS BECAUSE `agentRow` PUTS IT ON EVERY ROW**, and a fixture
 * missing a field the producer always sends is the less-capable fake this file has already
 * paid for twice. `A` has one and `P` has none, so both readings are drawn somewhere: a
 * stored zone in the box, and the empty box that makes the tools refuse a schedule.
 */
const SETTINGS_ROWS = [
  { id: "A", name: "Agent A", instructions: "a", created: 1, updated: 1, preview: "",
    status: "active", tools: [], zone: "Europe/London" },
  { id: "P", name: "Resting", instructions: "p", created: 1, updated: 1, preview: "",
    status: "paused", tools: ["echo"], zone: null },
];

test("THE CATALOG IS THE SERVER'S AND THE FORM DRAWS EXACTLY IT", async () => {
  const w = await withCatalog();
  assert.deepEqual(w.val("agentTools.map((t) => t.name)"), ["echo"]);
  w.ev('agentEditing = "A"; renderAgents();');
  const f = hydrate(w);
  assert.deepEqual(f.boxes.map((b) => b.getAttribute("data-tool")), ["echo"]);
  assert.ok(/Repeats a short piece of text back/.test(f.html), "a tool was offered with no description");
  // NOTHING IS ALLOWED UNTIL IT IS TICKED. `A` has an empty selection, so its box
  // is drawn unticked — the default a new agent gets too.
  assert.deepEqual(f.boxes.map((b) => b.checked), [false]);
  // ...and the stored selection is what decides, which is the control.
  w.ev('agentEditing = "P"; renderAgents();');
  assert.deepEqual(hydrate(w).boxes.map((b) => b.checked), [true], "a stored selection was not drawn");
});

test("⚠ NO TOOLS AT ALL IS AN HONEST SENTENCE, not an empty box", async () => {
  // A REAL BRANCH RATHER THAN A DECORATION: a Worker that predates the catalog
  // answers no `tools` key, which lands as an empty catalog. Drawing an empty
  // container there would read as a rendering fault.
  const w = await withCatalog({ tools: null });
  assert.deepEqual(w.val("agentTools"), [], "an absent catalog was not read as an empty one");
  w.ev('agentEditing = "A"; renderAgents();');
  const f = hydrate(w);
  assert.deepEqual(f.boxes, [], "a tool was drawn from nothing");
  assert.match(f.html, /no tools to give an agent yet/i);
  // AND THE FORM STILL WORKS. The empty state is a sentence in a form, not a
  // screen that replaces it.
  assert.ok(f.html.includes('id="agName"') && f.html.includes('id="agInstr"'));
  assert.ok(f.drewPause, "the status control went with the tools");
});

test("...and a catalog that is not a list is an empty one, not a screen that throws", async () => {
  // `j.tools || []` is right for an ABSENT key and wrong for everything else: a
  // string or an object falls straight through it and the form maps over it. The
  // absent case cannot see that at all, which is why it needed its own.
  for (const junk of ["echo", { echo: true }, 7, true]) {
    const w = await withCatalog({ tools: junk });
    assert.deepEqual(w.val("agentTools"), [], `${JSON.stringify(junk)} was read as a catalog`);
    w.ev('agentEditing = "A"; renderAgents();');
    assert.match(hydrate(w).html, /no tools to give an agent yet/i);
  }
  // AND AN ENTRY WITH NO NAME IS NOT A TOOL. It cannot be ticked, sent or looked
  // up, so drawing it would offer a permission nothing can grant.
  const half = await withCatalog({ tools: [{ label: "Nameless", does: "x" }, ...CATALOG] });
  assert.deepEqual(half.val("agentTools.map((t) => t.name)"), ["echo"]);
});

test("A SAVE SENDS THE TICKS, THE PAUSE AND THE WORDS — read out of the form", async () => {
  const w = await withCatalog();
  w.ev('agentEditing = "A"; renderAgents();');
  const f = hydrate(w);
  w.s.document.getElementById("agName").value = "Renamed";
  w.s.document.getElementById("agInstr").value = "Do the thing.";
  f.boxes[0].checked = true;
  w.s.document.getElementById("agPaused").checked = true;
  await w.ev("agentSave()");
  const sent = w.calls.find((c) => c.path === "/api/agent/update");
  assert.ok(sent, "nothing was saved");
  // ⚠ THE WHOLE BODY, so a field the form draws and does not send is red — which is the
  // shape `status` failed in once and `zone` would have failed in next.
  assert.deepEqual(sent.body, { id: "A", name: "Renamed", instructions: "Do the thing.",
                                status: "paused", tools: ["echo"], zone: "Europe/London" });
});

test("⚠ THE TIME ZONE IS DRAWN FROM THE ROW, EDITED, AND SENT", async () => {
  // **A SETTING NO SCREEN CAN SET IS A SETTING NOBODY SETS**, and the agent's authoring
  // tools refuse a scheduled automation while this is empty and say to come here — so the
  // box existing, carrying what is stored, and sending what is typed are three claims and
  // all three are asked.
  const w = await withCatalog();
  w.ev('agentEditing = "A"; renderAgents();');
  const drawn = hydrate(w);
  assert.equal(drawn.drewZone, true, "the settings form has no time-zone box at all");
  assert.equal(drawn.zone, "Europe/London", "the box was not drawn from the stored row");
  w.s.document.getElementById("agZone").value = "America/New_York";
  await w.ev("agentSave()");
  assert.equal(w.calls.find((c) => c.path === "/api/agent/update").body.zone, "America/New_York");

  // ⚠ AND AN AGENT WITH NO ZONE DRAWS AN EMPTY BOX RATHER THAN A GUESS. `UTC` here would
  // be a zone nobody chose reaching a schedule that fires at the wrong hour, with every
  // reader agreeing it is right.
  const w2 = await withCatalog();
  w2.ev('agentEditing = "P"; renderAgents();');
  assert.equal(hydrate(w2).zone, "", "an agent with no zone was drawn with one");

  // ⚠ AND EMPTYING IT SENDS `null`, WHICH CLEARS IT — not `""`, which the route reads as a
  // clear too but which would make "leave it alone" and "forget it" one value on the wire.
  const w3 = await withCatalog();
  w3.ev('agentEditing = "A"; renderAgents();');
  hydrate(w3);
  w3.s.document.getElementById("agZone").value = "   ";
  await w3.ev("agentSave()");
  assert.equal(w3.calls.find((c) => c.path === "/api/agent/update").body.zone, null);
});

test("...and an unticked box sends an EMPTY selection, never silence", async () => {
  // The two are different on the wire and mean different things: `[]` is "allow
  // nothing" and an absent key is "I am not saying" — which the route leaves alone.
  // A form that sent silence could never take a tool away again.
  const w = await withCatalog();
  w.ev('agentEditing = "P"; renderAgents();');
  const f = hydrate(w);
  assert.equal(f.boxes[0].checked, true, "the fixture is not the case it claims");
  f.boxes[0].checked = false;
  w.s.document.getElementById("agPaused").checked = false;
  await w.ev("agentSave()");
  const sent = w.calls.find((c) => c.path === "/api/agent/update");
  assert.deepEqual(sent.body.tools, []);
  assert.equal(sent.body.status, "active");
  assert.ok(Object.hasOwn(sent.body, "tools"), "an empty selection was sent as silence");
});

test("⚠ A NEW AGENT SENDS THE PAUSE IT WAS DRAWN WITH, and its ticks go with its writing", async () => {
  // ⚠ THIS CASE USED TO REQUIRE THE DEFECT, and it read as a rule: "a new agent
  // sends no status". The form draws a Paused control for a new agent, so the tick
  // was a control somebody sets and nothing reads — the agent came back active and
  // the box was the only thing claiming otherwise. **A dead control that ANSWERS,
  // wrongly**, which is this repository's own worst shape of that finding.
  //
  // THE ANSWER'S ROW SAYS `paused` because that is what was asked for, and a fixture
  // answering `active` would be the less-capable fake that hid this in the first
  // place — the screen would draw an active agent and nothing here would notice.
  const w = await withCatalog({
    answer: (p) => okRes(p === "/api/agent/list"
      ? { agents: SETTINGS_ROWS, tools: CATALOG }
      : { agent: { id: "NEW", name: "Fresh", instructions: "i", created: 2, updated: 2, preview: "", status: "paused", tools: ["echo"] } }),
  });
  w.ev("agentNew();");
  const f = hydrate(w);
  assert.deepEqual(f.boxes.map((b) => b.checked), [false], "a new agent started with something allowed");
  assert.equal(f.paused, false, "a new agent was drawn paused");
  w.s.document.getElementById("agName").value = "Fresh";
  w.s.document.getElementById("agInstr").value = "i";
  f.boxes[0].checked = true;
  f.pauseBox.checked = true;
  await w.ev("agentSave()");
  const sent = w.calls.find((c) => c.path === "/api/agent/create");
  // ⚠ THE ZONE IS ON A CREATE TOO, for the reason this case was written: the form draws
  // the box for a NEW agent, so a route or a body that dropped it would make that box a
  // control somebody fills in and nothing reads. `null` is what an empty box means.
  assert.deepEqual(sent.body,
    { name: "Fresh", instructions: "i", status: "paused", tools: ["echo"], zone: null });
  // AND IT BECOMES AN EDIT OF WHAT IT MADE, so the next press adjusts the same
  // agent rather than making a second one.
  assert.equal(w.ev("agentEditing"), "NEW");
  assert.equal(w.ev("agentSaved"), true);
});

test("...AND A NEW AGENT NOBODY PAUSED SENDS `active`, which is the ordinary press", async () => {
  // THE CONTROL FOR THE CASE ABOVE. Without it, a screen that sent `"paused"`
  // whatever the box said would satisfy every assertion up there — the difference
  // between reading the control and hardcoding its answer is only visible from the
  // side that does NOT tick it.
  const w = await withCatalog({
    answer: (p) => okRes(p === "/api/agent/list"
      ? { agents: SETTINGS_ROWS, tools: CATALOG }
      : { agent: { id: "NEW", name: "Fresh", instructions: "i", created: 2, updated: 2, preview: "", status: "active", tools: [] } }),
  });
  w.ev("agentNew();");
  const f = hydrate(w);
  w.s.document.getElementById("agName").value = "Fresh";
  w.s.document.getElementById("agInstr").value = "i";
  assert.equal(f.paused, false, "a new agent was drawn paused");
  await w.ev("agentSave()");
  const sent = w.calls.find((c) => c.path === "/api/agent/create");
  assert.equal(sent.body.status, "active");
});

test("SAVING SAYS SO, WHERE THE BUTTON WAS", async () => {
  // It used to close onto the list, which is feedback of a sort and not one
  // anybody reads as confirmation.
  const w = await withCatalog();
  w.ev('agentEditing = "A"; renderAgents();');
  hydrate(w);
  w.s.document.getElementById("agName").value = "A";
  w.s.document.getElementById("agInstr").value = "a";
  await w.ev("agentSave()");
  assert.equal(w.ev("agentEditing"), "A", "the form closed instead of confirming");
  assert.equal(w.ev("agentSaved"), true);
  assert.match(w.s.document.getElementById("viewAgents").innerHTML, /Saved\./);
  // AND IT IS GONE THE MOMENT SOMETHING ELSE HAPPENS, so it can never be read as
  // confirmation of a LATER change.
  w.ev('agentEditing = "A"; agentSaved = false; renderAgents();');
  assert.ok(!/Saved\./.test(w.s.document.getElementById("viewAgents").innerHTML));
});

test("⚠ A FAILED SAVE KEEPS THE TICKS AND THE PAUSE, not just the words", async () => {
  // A form redrawn with an unticked box ticked would say a permission was stored
  // when it was refused — the one failure here nobody can see from either side.
  const w = await withCatalog({
    answer: (p) => (p === "/api/agent/list"
      ? okRes({ agents: SETTINGS_ROWS, tools: CATALOG })
      : badRes("couldn’t save that")),
  });
  w.ev('agentEditing = "A"; renderAgents();');
  const f = hydrate(w);
  w.s.document.getElementById("agName").value = "A";
  w.s.document.getElementById("agInstr").value = "a";
  f.boxes[0].checked = true;
  w.s.document.getElementById("agPaused").checked = true;
  await w.ev("agentSave()");
  assert.match(w.ev("agentActErr"), /save/i);
  // ⚠ THE ZONE IS A SETTING TOO, so a failed save has to keep the one that was typed —
  // and the case types a DIFFERENT one from the stored `Europe/London`, or "it was kept"
  // is satisfied by a redraw that simply read the row again.
  w.s.document.getElementById("agZone").value = "Asia/Tokyo";
  await w.ev("agentSave()");
  assert.deepEqual(w.val("agentDraft"),
    { name: "A", instructions: "a", status: "paused", tools: ["echo"], zone: "Asia/Tokyo" });
  // AND THE REDRAW SHOWS THEM. The draft is only worth anything if the form reads
  // it back — which is the half a state assertion alone cannot see.
  const again = hydrate(w);
  assert.deepEqual(again.boxes.map((b) => b.checked), [true], "the tick that failed was redrawn empty");
  assert.equal(again.paused, true, "the pause that failed was redrawn as active");
  assert.equal(again.zone, "Asia/Tokyo", "the zone that failed was redrawn from the row instead");
});

test("A PAUSED AGENT SAYS SO WHERE SOMEBODY WOULD TYPE, and the list says so too", async () => {
  const w = await withCatalog();
  w.ev('agentThread = "P"; agentMsgs = []; agentMsgsFor = "P"; renderAgents();');
  const html = w.s.document.getElementById("viewAgents").innerHTML;
  assert.match(html, /isn’t starting anything new/);
  assert.match(html, /data-act="agent-edit" data-id="P"/, "the banner offers no way to resume it");
  // THE BOX STAYS ENABLED AND THE BUTTON DOES NOT. Whatever is half-written is
  // still theirs; the button is off because the server would refuse the send.
  assert.match(html, /<button class="ag-send-btn"[^>]* disabled/);
  assert.ok(!/<textarea class="ag-send-in"[^>]* disabled/.test(html), "the draft was locked away");
  // The control: an active agent has neither.
  w.ev('agentThread = "A"; agentMsgsFor = "A"; renderAgents();');
  const active = w.s.document.getElementById("viewAgents").innerHTML;
  assert.ok(!/isn’t starting anything new/.test(active));
  assert.ok(!/<button class="ag-send-btn"[^>]* disabled/.test(active));
  // AND THE LIST SAYS IT TOO, because that is where somebody wonders why an agent
  // has gone quiet.
  w.ev("agentList(); renderAgents();");
  const list = w.s.document.getElementById("viewAgents").innerHTML;
  assert.match(list, /<span class="ag-chip">Paused<\/span>/);
  assert.equal(list.match(/ag-chip/g).length, 1, "every row was marked paused");
});

test("⚠ A SEND REFUSED FOR A PAUSE KEEPS THE WORDS AND THE KEY", async () => {
  // Nothing was committed — no message, no run — so the same press against a
  // resumed agent must be the SAME press: same key, same words, one message.
  // Clearing the key here is how a lost message becomes two.
  const w = await withCatalog({
    answer: (p) => (p === "/api/agent/send"
      ? { ok: false, status: 409, json: async () => ({ error: "this agent is paused", paused: true }) }
      : okRes({ agents: SETTINGS_ROWS, tools: CATALOG })),
  });
  w.ev('agentThread = "A"; agentMsgs = []; agentMsgsFor = "A"; renderAgents();');
  const box = w.s.document.getElementById("agMsg");
  box.setAttribute("data-agent", "A");
  box.value = "are you there?";
  await w.ev("agentSend()");
  assert.equal(w.ev('agentDraftOf("A")'), "are you there?", "the words were thrown away");
  assert.equal(box.value, "are you there?", "the box was cleared on a refusal");
  assert.match(w.ev("agentActErr"), /paused/i);
  assert.match(w.ev("agentActErr"), /still here/i, "it did not say the message survived");
  const keyed = w.val('Object.keys(agentSendKeys)');
  assert.equal(keyed.length, 1, "the retry key was dropped, so the next press is a different press");
  // THE CONTROL: the same press against an agent that accepts it clears both.
  const ok = await withCatalog({
    answer: (p) => (p === "/api/agent/send"
      ? okRes({ message: { id: "m1", text: "are you there?", at: 1 }, runId: "r1" })
      : okRes({ agents: SETTINGS_ROWS, tools: CATALOG, messages: [] })),
  });
  ok.ev('agentThread = "A"; agentMsgs = []; agentMsgsFor = "A"; renderAgents();');
  const b2 = ok.s.document.getElementById("agMsg");
  b2.setAttribute("data-agent", "A");
  b2.value = "are you there?";
  await ok.ev("agentSend()");
  assert.equal(ok.ev('agentDraftOf("A")'), "");
  assert.deepEqual(ok.val('Object.keys(agentSendKeys)'), []);
});

// ═══════════════════════════════════════════════════════════════════════════
// THE AUTOMATIONS SCREEN
//
// Its own section, driving the real `chat.js` in a real page scope. The cases below
// are about the two things a screen like this gets wrong: a redraw that eats what
// somebody is typing, and an answer that lands after they have moved on.
// ═══════════════════════════════════════════════════════════════════════════

/** Open one agent's automations, with the catalog the server sends. */
async function withAutomations(opts = {}) {
  const posts = [];
  // EVERY OPTION IS FORWARDED, including `history` and `fail`, so a case does not have to
  // rebuild `loadScreen` by hand to look at one execution.
  const answer = autoAnswer({ ...opts, onPost: (p, b) => posts.push({ path: p, body: b }) });
  const w = loadScreen({
    answer: (p, init) => {
      /**
       * ⚠ **THE CONNECTIONS READ CAN BE HELD OPEN, because the example's seed is a REQUEST and
       * a request can land after the screen has moved on.** Without a gate the answer arrives
       * inside the same press and the three walls above it — the press, the agent and the
       * account — are all trivially satisfied, which is a wall nobody can drive.
       */
      if (opts.connGates && p.startsWith("/api/agent/connections")) {
        // ONE GATE PER REQUEST, IN ORDER — two presses have to be able to answer DIFFERENTLY,
        // or "the earlier answer did not win" is satisfied by the two being the same value.
        const g = opts.connGates.shift();
        if (g) return g.p;
      }
      const a = answer(p, init);
      return a.ok ? okRes(a.body) : badRes(a.body.error);
    },
  });
  await w.ev("agentsLoad()");
  await w.ev('agentAutomations("A")'); await settle();
  return { w, posts };
}

/**
 * LET AN IN-FLIGHT READ LAND.
 *
 * `agentAutomations` and `agentAutoHistory` are NAVIGATION functions: they set the
 * screen's state and START a read without awaiting it, exactly as `agentOpen` does
 * for a conversation. So `await`-ing the call itself awaits `undefined` and the
 * assertions run against a screen that still says "Loading…". A macrotask turn is
 * enough because every fixture answer resolves immediately — nothing about the
 * product's own timing is being waited on, which is why this is a turn and not a
 * poll.
 */
const settle = () => new Promise((r) => setTimeout(r, 0));

const ONE = {
  id: "AU1", agentId: "A", name: "Opening check", enabled: true, schedule: "manual",
  at: null, zone: "Europe/London", nextRunAt: null, updatedAt: "2026-09-16T10:00:00Z",
  steps: [{ id: "s1", type: "weekday", days: ["mon"] }, { id: "s2", type: "note", text: "morning" }],
};

test("the automations screen draws the list, the catalog and the next scheduled run", async () => {
  const daily = { ...ONE, schedule: "daily", at: "09:00", nextRunAt: "2026-09-17T08:00:00Z" };
  const { w } = await withAutomations({ automations: [daily] });
  const html = w.s.document.getElementById("viewAgents").innerHTML;
  assert.match(html, /Opening check/);
  assert.match(html, /Every day at 09:00 \(Europe\/London\)/, "the trigger is a sentence, not a cron line");
  assert.match(html, /next /, "the next scheduled run is shown");
  // THE STEPS READ AS WHAT THEY DO, not as the catalog's own description.
  assert.match(html, /1\. Only on Mon/);
  assert.match(html, /2\. Save a note: “morning”/);
  // AND THE FOUR THINGS A ROW OFFERS.
  for (const act of ["agent-auto-run", "agent-auto-toggle", "agent-auto-edit", "agent-auto-history"]) {
    assert.match(html, new RegExp(act), act);
  }
});

test("⚠ ADDING A STEP KEEPS WHAT WAS TYPED IN THE ONE ABOVE IT", async () => {
  // THE DEFECT THIS IS THE GUARD FOR, found in a real browser: pressing "+ Save a note"
  // builds a new draft with one more step and asks for a redraw — and the read-first
  // door ran FIRST, read the form still showing the OLD step list, and wrote it back
  // over the step just added. Zero steps, every time, with the whole suite green.
  const { w } = await withAutomations({ automations: [] });
  await w.ev('agentAutoNew()');
  let f = hydrateAuto(w);
  assert.equal(f.rows.length, 0, "a new automation starts with no steps");
  w.s.document.getElementById("agAutoName").value = "Morning";

  await w.ev('agentAutoStepAdd("note")');
  f = hydrateAuto(w);
  assert.equal(f.rows.length, 1, "the step was added");
  // The name typed BEFORE the structural change survived it.
  assert.equal(w.val("agentAutoDraft").name, "Morning");

  // Type into the step, then add a SECOND one — the case the browser found.
  f.rows[0].fields[0].value = "unlock the door";
  await w.ev('agentAutoStepAdd("weekday")');
  f = hydrateAuto(w);
  assert.equal(f.rows.length, 2, "the second step was added");
  assert.deepEqual(w.val("agentAutoDraft").steps.map((s) => s.type), ["note", "weekday"]);
  assert.equal(w.val("agentAutoDraft").steps[0].text, "unlock the door",
    "the note typed before the second step was added was eaten");
  // AND THE FORM DREW IT BACK, which is the half a state assertion cannot see.
  assert.equal(f.rows[0].fields[0].value, "unlock the door");
});

test("⚠ the read-back is gated on the drawing, and a generation is what gates it", async () => {
  const { w } = await withAutomations({ automations: [] });
  await w.ev("agentAutoNew()");
  const first = hydrateAuto(w);
  assert.equal(first.gen, 0, "a fresh form is the zeroth drawing");
  await w.ev('agentAutoStepAdd("note")');
  const second = hydrateAuto(w);
  assert.equal(second.gen, 1, "a structural change marks the drawing stale");
  // ⚠ AND THE FORM CARRIES IT, or nothing can tell the two apart. A STEP COUNT WOULD
  // NOT DO IT — reordering keeps the count — which is why this is a number and not a
  // length.
  assert.match(second.html, /id="agAutoForm" data-gen="1"/);
  await w.ev('agentAutoStepAdd("weekday")');
  await w.ev("agentAutoStepMove(0, 1)");
  const moved = hydrateAuto(w);
  assert.deepEqual(w.val("agentAutoDraft").steps.map((s) => s.type), ["weekday", "note"]);
  assert.equal(moved.gen, 3, "reordering marks it stale too, although the count did not change");
});

test("steps can be moved and taken out, and the order IS the workflow", async () => {
  const { w } = await withAutomations({ automations: [ONE] });
  await w.ev('agentAutoEdit("AU1")');
  hydrateAuto(w);
  assert.deepEqual(w.val("agentAutoForm()").steps.map((s) => s.type), ["weekday", "note"]);
  await w.ev("agentAutoStepMove(1, -1)");
  hydrateAuto(w);
  assert.deepEqual(w.val("agentAutoDraft").steps.map((s) => s.type), ["note", "weekday"]);
  await w.ev("agentAutoStepDrop(0)");
  hydrateAuto(w);
  assert.deepEqual(w.val("agentAutoDraft").steps.map((s) => s.type), ["weekday"]);
  // A MOVE OFF EITHER END DOES NOTHING, rather than losing a step.
  await w.ev("agentAutoStepMove(0, -1)");
  await w.ev("agentAutoStepMove(0, 1)");
  assert.equal(w.val("agentAutoDraft").steps.length, 1);
});

test("⚠ the save sends the steps and the schedule the form really shows", async () => {
  const { w, posts } = await withAutomations({ automations: [] });
  await w.ev("agentAutoNew()");
  hydrateAuto(w);
  w.s.document.getElementById("agAutoName").value = "Weekday note";
  w.s.document.getElementById("agAutoSched").value = "daily";
  w.s.document.getElementById("agAutoAt").value = "09:00";
  w.s.document.getElementById("agAutoZone").value = "Europe/London";
  await w.ev('agentAutoStepAdd("weekday")');
  await w.ev('agentAutoStepAdd("note")');
  const f = hydrateAuto(w);
  const fieldOf = (row, name) => f.rows[row].fields.find((x) => x.getAttribute("data-field") === name);
  fieldOf(1, "text").value = "shop opens at 9";
  // ⚠ AND THE NOTE'S ANSWER IS NAMED, in the box the form now draws for it — a step output
  // is the whole of what makes a later `{{opening}}` resolvable, so a box that existed and
  // never travelled would be a control that answers nothing.
  const outBox = fieldOf(1, "out");
  assert.ok(outBox, "the note step drew no box for naming its answer");
  outBox.value = "opening";
  for (const d of f.rows[0].days) d.checked = ["mon", "tue"].includes(d.getAttribute("data-day"));
  await w.ev("agentAutoSave()");
  const sent = posts.find((x) => x.path === "/api/agent/automation-create");
  assert.ok(sent, "the create was never sent");
  assert.equal(sent.body.agent, "A", "it names which agent it belongs to");
  assert.equal(sent.body.name, "Weekday note");
  assert.equal(sent.body.schedule, "daily");
  assert.equal(sent.body.at, "09:00");
  assert.equal(sent.body.zone, "Europe/London");
  // ⚠ RE-ANCHORED, NOT APPEASED: the note now carries an `out` box, because a step's answer
  // can be NAMED and a later step can use it — so an empty box really is part of what the
  // form shows. `""` is the server's "no name", which it stores as `null`; what must not
  // happen is the box existing and never being sent, which is a control that answers
  // nothing. The assertion is the whole body, so a field appearing or vanishing is red.
  assert.deepEqual(sent.body.steps, [
    { type: "weekday", days: ["mon", "tue"] },
    { type: "note", text: "shop opens at 9", out: "opening" },
  ]);
  // ⚠ THE SCREEN'S OWN BOOKKEEPING DOES NOT GO ON THE WIRE. `gen` says which drawing a
  // draft is, which is a fact about a browser; a body should say what it means.
  assert.equal(Object.hasOwn(sent.body, "gen"), false, "the generation went to the server");
  // A CREATE BECOMES AN EDIT of what it just made, so the next press adjusts it.
  assert.equal(w.val("agentAutoEditing"), "AU1");
  assert.equal(w.val("agentAutoSaved"), true);
});

test("the pause control is OFF, so the box and the value cannot disagree", async () => {
  const { w, posts } = await withAutomations({ automations: [] });
  await w.ev("agentAutoNew()");
  const f = hydrateAuto(w);
  assert.equal(f.offBox.checked, false, "a new automation is on");
  w.s.document.getElementById("agAutoName").value = "Off to start with";
  f.offBox.checked = true;
  await w.ev("agentAutoSave()");
  assert.equal(posts.find((x) => x.path === "/api/agent/automation-create").body.enabled, false);
});

test("⚠ a failed save keeps the whole configuration, not just the name", async () => {
  const w = loadScreen({
    answer: (p, init) => {
      const a = autoAnswer({ automations: [] })(p, init);
      if (p === "/api/agent/automation-create") return badRes("couldn’t save that");
      return a.ok ? okRes(a.body) : badRes(a.body.error);
    },
  });
  await w.ev("agentsLoad()");
  await w.ev('agentAutomations("A")'); await settle();
  await w.ev("agentAutoNew()");
  hydrateAuto(w);
  w.s.document.getElementById("agAutoName").value = "Morning";
  await w.ev('agentAutoStepAdd("note")');
  const f = hydrateAuto(w);
  f.rows[0].fields[0].value = "the words that failed";
  await w.ev("agentAutoSave()");
  assert.match(w.ev("agentAutoActErr"), /save/i);
  // THE DRAFT STAYS, so pressing Save again sends the same thing.
  assert.equal(w.val("agentAutoDraft").name, "Morning");
  assert.equal(w.val("agentAutoDraft").steps[0].text, "the words that failed");
  // AND THE REDRAW SHOWS THEM — the half a state assertion alone cannot see.
  const again = hydrateAuto(w);
  assert.equal(again.rows[0].fields[0].value, "the words that failed");
  assert.equal(w.val("agentAutoSaved"), false, "a failed save must not say Saved");
});

test("⚠ a save that lands after the screen moved on touches nothing", async () => {
  // ⚠ **`held()` HANDS BACK `{p, release}` AND THIS CASE ASKED FOR `gate.res`**, which
  // is `undefined` — so `apiFetch` resolved to nothing, the save fell into its own
  // catch, and the two assertions below were satisfied by a request that never
  // succeeded. It passed with the wall deleted, and a sweep is what said so. Every
  // other held-gate case in this file uses `gate.p`; this one is now one of them, and
  // the CONTROL underneath is what makes the negative mean anything.
  const open = async (release) => {
    const gate = held(okRes({ id: "AU9" }));
    const w = loadScreen({
      answer: (p, init) => {
        if (p === "/api/agent/automation-create") return gate.p;
        const a = autoAnswer({ automations: [] })(p, init);
        return a.ok ? okRes(a.body) : badRes(a.body.error);
      },
    });
    await w.ev("agentsLoad()");
    await w.ev('agentAutomations("A")'); await settle();
    await w.ev("agentAutoNew()");
    hydrateAuto(w);
    w.s.document.getElementById("agAutoName").value = "Morning";
    const saving = w.ev("agentAutoSave()");
    await release(w);
    gate.release();
    await saving;
    return w;
  };

  // The form is closed while the save is in the air.
  const moved = await open((w) => w.ev("agentAutoCancel()"));
  // A CREATE THAT LANDED ON A CLOSED FORM MUST NOT REOPEN IT as an edit of what it made.
  assert.equal(moved.val("agentAutoEditing"), null, "a save reopened a form nobody had open");
  assert.equal(moved.val("agentAutoSaved"), false, "it said Saved on a screen nobody was on");
  assert.equal(moved.val("agentAutoActErr"), "", "it wrote an error into another screen");

  // THE CONTROL: the same save, landing on the form it was pressed from, DOES become an
  // edit of what it made and DOES say Saved. Without this, "touches nothing" is
  // satisfied by a save that never works.
  const stayed = await open(async () => {});
  assert.equal(stayed.val("agentAutoEditing"), "AU9", "a create did not become an edit of what it made");
  assert.equal(stayed.val("agentAutoSaved"), true);
});

test("a failed list read is NOT an empty agent", async () => {
  const { w } = await withAutomations({ automations: [ONE] });
  assert.equal(w.val("agentAutoRows").length, 1);
  // The next read fails. The rows it had are left exactly as they were, so an error
  // does not look like everything having been deleted.
  w.ev('agentAutoLoadFails = 1');
  const w2 = loadScreen({
    answer: (p, init) => {
      const a = autoAnswer({ automations: [], listFails: true })(p, init);
      return a.ok ? okRes(a.body) : badRes(a.body.error);
    },
  });
  await w2.ev("agentsLoad()");
  await w2.ev('agentAutomations("A")'); await settle();
  assert.equal(w2.val("agentAutoRows"), null, "a read that never succeeded is not an empty list");
  assert.equal(w2.ev("agentAutoState"), "error");
  assert.match(w2.s.document.getElementById("viewAgents").innerHTML, /Couldn’t load the automations/);
});

test("a list answer for another agent is not written into this screen", async () => {
  // Same two fixture faults as the case above, and the same sweep found them: the gate
  // was asked for `gate.res` (undefined), and `agentAutomations` is a NAVIGATION
  // function that starts a read without returning it — so `await opening` awaited
  // `undefined` and the assertion ran before the answer could have landed either way.
  const body = { agent: "A", automations: [ONE], steps: STEP_CATALOG, days: DAY_LIST, max: 20 };
  const open = async (leave) => {
    const gate = held(okRes(body));
    const w = loadScreen({
      answer: (p, init) => {
        if (p.startsWith("/api/agent/automations")) return gate.p;
        const a = autoAnswer({})(p, init);
        return a.ok ? okRes(a.body) : badRes(a.body.error);
      },
    });
    await w.ev("agentsLoad()");
    w.ev('agentAutomations("A")');
    await leave(w);
    gate.release();
    await settle();
    return w;
  };

  // Somebody leaves before the answer lands.
  const left = await open((w) => w.ev("agentAutoBack()"));
  assert.equal(left.val("agentAutoRows"), null, "an answer for a screen nobody is on was written in");

  // THE CONTROL: the same answer, landing on the screen that asked for it, IS written.
  const stayed = await open(async () => {});
  assert.deepEqual(stayed.val("agentAutoRows").map((r) => r.id), ["AU1"],
    "the answer never landed at all, so the refusal above proves nothing");
});

test("⚠ the toggle sends what the row says, and its own narrow body", async () => {
  const { w, posts } = await withAutomations({ automations: [ONE] });
  const html = w.s.document.getElementById("viewAgents").innerHTML;
  // The row draws the OPPOSITE of what it is, because that is what pressing it does.
  assert.match(html, /data-act="agent-auto-toggle" data-id="AU1" data-on="off"/);
  await w.ev('agentAutoToggle("AU1", "off")');
  const sent = posts.find((x) => x.path === "/api/agent/automation-enable");
  assert.deepEqual(sent.body, { id: "AU1", enabled: false },
    "the toggle must carry nothing but which one and whether");
  await w.ev('agentAutoToggle("AU1", "on")');
  assert.equal(posts.filter((x) => x.path === "/api/agent/automation-enable").at(-1).body.enabled, true);
});

test("Run now opens the history and stops watching it", async () => {
  const { w, posts } = await withAutomations({ automations: [ONE] });
  await w.ev('agentAutoRun("AU1")');
  assert.ok(posts.some((x) => x.path === "/api/agent/automation-run"), "the run was never asked for");
  assert.equal(w.val("agentAutoRunsFor"), "AU1", "its history was opened");
  // THE WATCH IS BOUNDED AND STOPS ITSELF. A permanent poll would be a redraw every
  // couple of seconds for as long as the screen is open.
  assert.equal(w.ev("AUTO_WATCH_TRIES") > 0 && w.ev("AUTO_WATCH_TRIES") < 20, true);
  await w.ev("agentAutoWatchStop()");
  assert.equal(w.val("agentAutoWatch"), null);
});

test("an empty catalog says so rather than drawing a form nobody can save", async () => {
  // A REAL BRANCH: a Worker that predates the catalog answers no `steps` key.
  const { w } = await withAutomations({ automations: [], steps: [] });
  await w.ev("agentAutoNew()");
  const html = w.s.document.getElementById("viewAgents").innerHTML;
  assert.match(html, /no kinds of step to add yet/);
  assert.equal(/data-act="agent-auto-step-add"/.test(html), false, "it offered a step it has not got");
});

test("the history shows each step's outcome, and a skip is not a failure", async () => {
  const runs = [{
    id: "EX1", automationId: "AU1", trigger: "manual", occurrence: null, state: "skipped",
    result: null, why: "Wednesday isn't one of the days this runs on", error: null,
    on: "2026-09-16", missed: null, at: "2026-09-16T10:00:00Z", finishedAt: "2026-09-16T10:00:01Z",
    steps: ONE.steps,
    outcomes: [
      { id: "s1", type: "weekday", outcome: "skipped", why: "Wednesday isn't one of the days this runs on" },
      { id: "s2", type: "note", outcome: "skipped", why: "an earlier condition didn't match, so this one didn't run" },
    ],
  }];
  const w = loadScreen({
    answer: (p, init) => {
      if (p.startsWith("/api/agent/automation-history")) return okRes({ id: "AU1", executions: runs });
      const a = autoAnswer({ automations: [ONE] })(p, init);
      return a.ok ? okRes(a.body) : badRes(a.body.error);
    },
  });
  await w.ev("agentsLoad()");
  await w.ev('agentAutomations("A")'); await settle();
  await w.ev('agentAutoHistory("AU1")'); await settle();
  const html = w.s.document.getElementById("viewAgents").innerHTML;
  assert.match(html, /ag-chip-skipped/);
  assert.match(html, /Skipped/);
  // ⚠ NOTHING ANYWHERE READS AS A FAILURE, which is the requirement stated as a screen.
  assert.equal(/Failed/.test(html), false, "a skipped run is drawn as a failure");
  // EVERY STEP HAS A LINE, including the one that never got its turn, and the two say
  // different things.
  // THE APOSTROPHE ARRIVES ESCAPED, because `esc()` is the renderer doing its job — so
  // the needle allows every encoding rather than pinning one. *Assert the property, not
  // the spelling*, in a case about what a person reads.
  assert.match(html, /an earlier condition didn(&#39;|&#x27;|&apos;|’|')t match/);
  // ⚠ COUNTED ON A NEEDLE THAT CANNOT MATCH THE CONTAINER. `ag-run-step` is a prefix of
  // `ag-run-steps`, so the bare name counted the wrapper as a third step — the recorded
  // "a needle that can match a longer name cannot prove a class", met in a count.
  assert.equal((html.match(/class="ag-run-step ag-step-/g) || []).length, 2);
  // A SECOND PRESS CLOSES IT.
  await w.ev('agentAutoHistory("AU1")'); await settle();
  assert.equal(w.val("agentAutoRunsFor"), null);
});

test("⚠ AN EXECUTION ROW THAT DOES NOT CARRY THE THREE OPTIONAL LINES DRAWS NONE OF THEM", async () => {
  // **REPRODUCED IN A REAL RENDER BEFORE IT WAS FIXED.** The three lines were gated on
  // `!== null`, which is right for every row `executionRow` builds — it answers all
  // three as `string | null` — and `undefined !== null` is TRUE, so a row that simply
  // does not CARRY the keys drew the literal word `undefined` three times, the last of
  // them in the red error slot. MEASURED: 3 occurrences before, 0 after.
  //
  // **NO EXISTING CASE COULD SEE IT, because every fixture here is the real producer's
  // output** — which is the right way to build a fixture and is exactly why this one is
  // deliberately NOT. A renderer is where a row of some other shape eventually arrives:
  // an older Worker, a cached answer, a hand-built row in a future test.
  const bare = {
    id: "EX9", automationId: "AU1", trigger: "manual", occurrence: null, state: "done",
    at: "2026-09-16T10:00:00Z", outcomes: [],
    // `result`, `why` and `error` are ABSENT — not null.
  };
  const w = loadScreen({
    answer: (p, init) => {
      if (p.startsWith("/api/agent/automation-history")) return okRes({ id: "AU1", executions: [bare] });
      const a = autoAnswer({ automations: [ONE] })(p, init);
      return a.ok ? okRes(a.body) : badRes(a.body.error);
    },
  });
  await w.ev("agentsLoad()");
  await w.ev('agentAutomations("A")'); await settle();
  await w.ev('agentAutoHistory("AU1")'); await settle();
  const html = w.s.document.getElementById("viewAgents").innerHTML;
  assert.equal(/undefined/.test(html), false, `the history drew "undefined": ${html.slice(0, 400)}`);
  assert.equal(/ag-run-out|ag-run-why|ag-run-err/.test(html), false, "a line was drawn with nothing in it");
  // THE OBSERVER IS ALIVE: the row itself IS on screen, so the absence above is about
  // the three optional lines and not about the history failing to draw at all.
  assert.match(html, /ag-run-top/);
  assert.match(html, /ag-chip-done/);

  // AND AN EMPTY STRING IS THE SAME ANSWER AS ABSENT — "nothing was said" is one fact,
  // not three shapes every reader has to remember.
  await w.ev('agentAutoRuns = ' + JSON.stringify([{ ...bare, result: "", why: "", error: "" }]) + '; renderAgents();');
  assert.equal(/ag-run-out|ag-run-why|ag-run-err/.test(w.s.document.getElementById("viewAgents").innerHTML), false,
    "an empty sentence was drawn as a line");

  // THE CONTROL: a row that DOES carry a result draws it, so none of this is a renderer
  // that has simply stopped drawing the three lines.
  await w.ev('agentAutoRuns = ' + JSON.stringify([{ ...bare, result: "the note it saved" }]) + '; renderAgents();');
  assert.match(w.s.document.getElementById("viewAgents").innerHTML, /the note it saved/);
});

/** Capture the watch's own timer the way `catchPoll` captures the conversation poll. */
function catchWatch(w) {
  const every = w.ev("AUTO_WATCH_MS");
  assert.ok(Number.isFinite(every) && every > 0, `the watch interval read as ${every}`);
  let fn = null;
  w.s.setTimeout = (f, ms) => { if (ms === every) fn = f; return 1; };
  return { fire: () => { assert.ok(fn, "no watch was armed"); const f = fn; fn = null; return f(); },
           get armed() { return !!fn; } };
}

test("⚠ SAVE PRESSED STRAIGHT AFTER ADDING A STEP SENDS THE STEP", async () => {
  // The whole reason `agentAutoSave` goes through `agentAutoFormRead` + `agentAutoForm`
  // rather than reading the DOM directly: between a structural change and the next
  // hydration the screen holds a step the form elements have never carried, and a save
  // that read the elements would drop it — silently, with the screen showing it.
  const { w, posts } = await withAutomations({ automations: [ONE] });
  await w.ev('agentAutoEdit("AU1")');
  hydrateAuto(w);
  assert.equal(w.val("agentAutoForm().steps").length, 2);
  await w.ev('agentAutoStepAdd("note")');
  // DELIBERATELY NOT RE-HYDRATED: the drawn form now has three steps and the elements
  // this fixture holds still have two, which is exactly the gap the gate closes.
  assert.equal(w.val("agentAutoDraft.steps").length, 3, "the step was never added to the draft");
  await w.ev("agentAutoSave()");
  const sent = posts.find((x) => x.path === "/api/agent/automation-update");
  assert.ok(sent, "the save never went out");
  assert.equal(sent.body.steps.length, 3,
    `the save sent ${sent.body.steps.length} steps where the screen shows 3`);
  assert.equal(sent.body.name, "Opening check", "and it lost what was already in the form");
});

test("⚠ THE WATCH DOES NOT POLL WHILE THE FORM IS OPEN", async () => {
  // A redraw underneath somebody who is typing is the defect this screen has already
  // paid for once, in the conversation poll. The watch asks WHEN THE TIMER FIRES, not
  // when it was armed, because the form can be opened in between.
  const { w } = await withAutomations({ automations: [ONE] });
  // COUNTED OFF `calls`, NOT `posts`: the history is a GET, and the fixture's POST hook
  // never sees one — which is how the control below first read as a dead watch.
  const reads = () => w.calls.filter((x) => x.path.startsWith("/api/agent/automation-history")).length;
  const watch = catchWatch(w);
  await w.ev('agentAutoWatchSoon("AU1", 3)');
  assert.ok(watch.armed, "nothing was armed, so this case proves nothing");
  const before = reads();
  await w.ev('agentAutoRunsFor = "AU1"; agentAutoEditing = "AU1";');   // the form is opened
  await watch.fire();
  assert.equal(reads(), before, "the watch read the history while the form was open");
  assert.equal(watch.armed, false, "and it re-armed itself over an open form");

  // THE CONTROL: with the form closed, the same timer DOES read — so the refusal above
  // is about the form and not about the watch being dead.
  await w.ev('agentAutoEditing = null;');
  await w.ev('agentAutoWatchSoon("AU1", 3)');
  await watch.fire();
  assert.ok(reads() > before, "the watch never reads the history at all");
});

test("⚠ THE WATCH IS BOUNDED AND COUNTS DOWN", async () => {
  // Without the count-down it is a redraw every couple of seconds for as long as the
  // screen is open — a poll nobody asked for and nothing ever stops.
  const { w } = await withAutomations({ automations: [ONE] });
  const watch = catchWatch(w);
  await w.ev('agentAutoRunsFor = "AU1"; agentAutoEditing = null;');
  await w.ev('agentAutoWatchSoon("AU1", 2)');
  await watch.fire();
  assert.ok(watch.armed, "it gave up with tries left");
  await watch.fire();
  assert.equal(watch.armed, false, "the watch re-armed itself for ever");
  assert.equal(w.val("agentAutoWatch"), null, "and it left a timer behind");
});

// ════════════════════════════════════════════════════════════════════════════
// THE RICHER FORM IN A REAL PAGE SCOPE — inputs, branches, waits and approvals
//
// Every case below needs a catalog with nine steps in it, which is why the fixture is
// DERIVED from `agent-store.mjs` at the top of this file rather than typed. With the two-step
// catalog it replaced, none of these controls could be drawn at all.
// ════════════════════════════════════════════════════════════════════════════

test("every step in the catalog can be added, and each draws its OWN fields", async () => {
  // A CENSUS, not a sample: the form is built from the catalog, so a step added next month
  // is drawn by existing — and one whose fields the form cannot draw fails here.
  const { w } = await withAutomations({ automations: [] });
  await w.ev("agentAutoNew()");
  hydrateAuto(w);
  for (const step of STEP_CATALOG) {
    await w.ev(`agentAutoStepAdd(${JSON.stringify(step.type)})`);
  }
  const f = hydrateAuto(w);
  assert.equal(f.rows.length, STEP_CATALOG.length, "the form drew a different number of steps");
  for (let i = 0; i < STEP_CATALOG.length; i++) {
    const def = STEP_CATALOG[i];
    assert.equal(f.rows[i].getAttribute("data-step-type"), def.type, `row ${i + 1} is not ${def.type}`);
    // ⚠ A FIELD THAT APPLIES MUST HAVE A CONTROL. One that does not apply has none — that is
    // what `when` is for — so the comparison is against the fields the answers make relevant.
    const applies = (fd) => !fd.when || Object.entries(fd.when)
      .every(([on, allowed]) => allowed.includes(w.val("agentAutoDraft").steps[i][on]));
    const drawn = new Set([
      ...f.rows[i].fields.map((x) => x.getAttribute("data-field")),
      ...(f.rows[i].days.length ? ["days"] : []),
    ]);
    for (const fd of def.fields) {
      if (fd.kind === "choice") continue;   // a select, read by its own hook rather than a box
      if (!applies(fd)) { assert.ok(!drawn.has(fd.name), `${def.type}.${fd.name} was drawn and does not apply`); continue; }
      assert.ok(drawn.has(fd.name), `${def.type}.${fd.name} has no control`);
    }
    // AND A STEP WITH NO CONFIGURATION DRAWS NO BOXES, which is the `configless` half.
    if (def.configless) assert.equal(f.rows[i].fields.length + f.rows[i].days.length, 0, `${def.type} drew a box`);
  }
  // EVERY ROW CARRIES ITS DEPTH AS ONE NUMBER, which is what makes a branch readable with
  // no canvas. The catalog's own order puts `otherwise` straight after `if`, so nothing in
  // THIS list is inside a branch — the indent is asserted on a shape that has one, below.
  assert.match(f.html, /--ag-step-d:\s*0/, "the rows carry no depth at all");
});

test("⚠ the branch reads as two arms, because each row carries its own depth", async () => {
  // NO CANVAS, and this is the whole of what replaces one: `if` and `end` sit at the outer
  // depth, an `otherwise` sits at its own `if`'s depth, and the steps under either arm sit
  // one further in. A flat list of nine rows with no indent is unreadable as a branch.
  const { w } = await withAutomations({ automations: [] });
  await w.ev("agentAutoNew()");
  hydrateAuto(w);
  for (const t of ["if", "note", "otherwise", "note", "end", "note"]) await w.ev(`agentAutoStepAdd(${JSON.stringify(t)})`);
  const f = hydrateAuto(w);
  const depths = [...f.html.matchAll(/--ag-step-d:(\d+)/g)].map((m) => Number(m[1]));
  assert.deepEqual(depths, [0, 1, 0, 1, 0, 0],
    "if · note · otherwise · note · end · note did not read as a branch with two arms");
});

test("⚠ a wait draws minutes OR a time, never both, and switching redraws it", async () => {
  // `when` decides, and this is the one case where a control appearing is the whole feature:
  // a wait FOR a while and a wait UNTIL a time are two different questions.
  const { w, posts } = await withAutomations({ automations: [] });
  await w.ev("agentAutoNew()");
  hydrateAuto(w);
  w.s.document.getElementById("agAutoName").value = "Patient";
  await w.ev('agentAutoStepAdd("wait")');
  let f = hydrateAuto(w);
  const names = () => new Set(f.rows[0].fields.map((x) => x.getAttribute("data-field")));
  assert.ok(names().has("minutes"), "a new wait does not ask how long");
  assert.ok(!names().has("at"), "it asks for a time as well, which nothing will read");

  // ⚠ CHANGED THROUGH THE SELECT AND ITS OWN CHANGE HOOK, which is how a person does it —
  // and that hook was BOUND TO NOTHING until this round: `data-change="agent-auto-step-field"`
  // was in the markup and absent from `CHANGE_ACTIONS`, so picking "until a time" redrew
  // nothing, no time box appeared, and the save was refused naming a control that was not on
  // the screen. A dead control that ANSWERS, in the feature this milestone is about.
  const modeBox = f.rows[0].fields.find((x) => x.getAttribute("data-field") === "mode");
  assert.ok(modeBox, "the wait drew no control for which kind of wait it is");
  assert.equal(modeBox.value, "for", "a new wait does not start as a wait for a while");
  modeBox.value = "until";
  await w.ev("CHANGE_ACTIONS['agent-auto-step-field']()");
  f = hydrateAuto(w);
  assert.ok(names().has("at") && !names().has("minutes"), "the controls did not follow the kind of wait");
  f.rows[0].fields.find((x) => x.getAttribute("data-field") === "at").value = "09:00";
  await w.ev("agentAutoSave()");
  const sent = posts.find((x) => x.path === "/api/agent/automation-create");
  assert.deepEqual(sent.body.steps, [{ type: "wait", mode: "until", at: "09:00" }],
    "the wait carried the answer for the kind it is not");
});

test("what an automation asks for is edited on the same form, and travels with it", async () => {
  const { w, posts } = await withAutomations({ automations: [] });
  await w.ev("agentAutoNew()");
  hydrateAuto(w);
  w.s.document.getElementById("agAutoName").value = "Quote reply";
  await w.ev("agentAutoInputAdd()");
  await w.ev("agentAutoInputAdd()");
  let html = w.s.document.getElementById("viewAgents").innerHTML;
  const rows = [...html.matchAll(/data-input-row="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(rows, [0, 1], "the form drew a different number of things to ask for");
  // THE BOXES ARE READ BACK BY THEIR OWN HOOK, the same way a step's are — so a redraw
  // between typing and saving cannot lose them.
  const inputEls = [0, 1].map((i) => {
    const chunk = html.split(`data-input-row="${i}"`)[1].split("data-input-row=")[0];
    return [...chunk.matchAll(/data-in="([a-z]+)"/g)].map((m) => m[1]);
  });
  for (const got of inputEls) {
    for (const want of ["name", "label", "default", "required"]) assert.ok(got.includes(want), `${want} has no control`);
  }
  // FILL THE FIRST IN AND TAKE THE SECOND OUT, which is the ordinary thing somebody does.
  w.ev(`agentAutoDraft = { ...agentAutoDraft, inputs: [
    { name: "topic", label: "What it is about", required: true, default: "" },
    { name: "spare", label: "", required: false, default: "" },
  ] };`);
  await w.ev("agentAutoInputDrop(1)");
  assert.deepEqual(w.val("agentAutoDraft").inputs.map((d) => d.name), ["topic"]);
  await w.ev("agentAutoSave()");
  const sent = posts.find((x) => x.path === "/api/agent/automation-create");
  assert.deepEqual(sent.body.inputs, [{ name: "topic", label: "What it is about", required: true, default: "" }]);
});

test("⚠ Run now ASKS for what the automation asks for, and sends what was typed", async () => {
  // AND THE DEFAULTS ARE WHAT THE BOXES START WITH, so pressing Run twice is the same press
  // rather than a form to fill in again from nothing.
  const asking = {
    ...ONE, steps: [{ id: "s1", type: "note", text: "about {{topic}}" }],
    inputs: [{ name: "topic", label: "What it is about", required: true, default: "boiler service" }],
  };
  const { w, posts } = await withAutomations({ automations: [asking] });
  await w.ev('agentAutoRunPress("AU1")');
  const html = w.s.document.getElementById("viewAgents").innerHTML;
  assert.match(html, /What it is about/, "the form does not say what it is asking for");
  assert.match(html, /data-ask="topic"/, "there is no box to answer it in");
  assert.match(html, /value="boiler service"/, "the default is not in the box");
  assert.equal(posts.filter((x) => x.path === "/api/agent/automation-run").length, 0,
    "it ran before anybody answered");

  // ANSWER IT AND GO. The box is read by its own hook, off the element the form drew.
  w.ev(`agentAutoAsk = { ...agentAutoAsk, values: { topic: "gutter clean" } };`);
  await w.ev("agentAutoAskGo()"); await settle();
  const ran = posts.find((x) => x.path === "/api/agent/automation-run");
  assert.deepEqual(ran.body, { id: "AU1", input: { topic: "gutter clean" } });
  assert.equal(w.val("agentAutoAsk"), null, "the form stayed open over a run that started");

  // AND CANCELLING RUNS NOTHING — the one thing a dialog must be able to do.
  await w.ev('agentAutoRunPress("AU1")');
  await w.ev("agentAutoAskCancel()");
  assert.equal(w.val("agentAutoAsk"), null);
  assert.equal(posts.filter((x) => x.path === "/api/agent/automation-run").length, 1);

  // AN AUTOMATION THAT ASKS FOR NOTHING STILL RUNS ON ONE PRESS, which is the control that
  // makes the dialog about the inputs rather than about pressing Run.
  const { w: w2, posts: p2 } = await withAutomations({ automations: [{ ...ONE, inputs: [] }] });
  await w2.ev('agentAutoRunPress("AU1")'); await settle();
  assert.equal(w2.val("agentAutoAsk"), null);
  assert.equal(p2.filter((x) => x.path === "/api/agent/automation-run").length, 1);
});

test("⚠ a WAITING execution offers the one thing that helps, and says what is being asked", async () => {
  const waiting = {
    id: "R9", automationId: "AU1", trigger: "manual", state: "waiting", at: "2026-09-17T09:00:00Z",
    position: 7, values: { draft: "Dear customer" }, input: { topic: "boiler service" },
    waiting: { kind: "approval", step: "s8", ask: "Send this to the customer?", onTimeout: "reject", until: "2026-09-18T09:00:00Z" },
    outcomes: [], steps: [], decisions: {},
  };
  const { w, posts } = await withAutomations({
    automations: [ONE],
    history: [waiting],
  });
  await w.ev('agentAutoHistory("AU1")'); await settle();
  const html = w.s.document.getElementById("viewAgents").innerHTML;
  assert.match(html, /Send this to the customer\?/, "it does not say what is being approved");
  assert.match(html, /agent-auto-approve/, "there is nothing to approve with");
  assert.match(html, /agent-auto-reject/, "there is nothing to reject with");
  // ⚠ AND WHAT HAPPENS IF NOBODY ANSWERS, because that is the part somebody cannot guess.
  assert.match(html, /if nobody answers/i);

  // A NOTE IS KEPT PER EXECUTION, so typing under one waiting run cannot reach another.
  w.ev(`agentAutoNotes.set("R9", " prices look right ");`);
  await w.ev('agentAutoDecide("R9", "approved")'); await settle();
  const sent = posts.find((x) => x.path === "/api/agent/automation-approve");
  assert.deepEqual(sent.body, { run: "R9", step: "s8", verdict: "approved", note: "prices look right" });
});

test("⚠ a decision that FAILS keeps the words, and a refused one says what to do", async () => {
  const waiting = {
    id: "R9", automationId: "AU1", trigger: "manual", state: "waiting", at: "2026-09-17T09:00:00Z",
    waiting: { kind: "approval", step: "s8", ask: "Send it?", onTimeout: "reject", until: null },
    values: {}, input: {}, outcomes: [], steps: [], decisions: {},
  };
  // THE NOTE IS SOMEBODY'S OWN WRITING. A failure redraws the panel to show a sentence, and
  // a redraw that dropped the note would take it with it.
  const { w, posts } = await withAutomations({
    automations: [ONE], history: [waiting],
    fail: { "/api/agent/automation-approve": "that run isn’t waiting to be approved just now" },
  });
  await w.ev('agentAutoHistory("AU1")'); await settle();
  w.ev(`agentAutoNotes.set("R9", "keep me");`);
  await w.ev('agentAutoDecide("R9", "approved")'); await settle();
  // A `Map` DOES NOT SURVIVE `JSON.stringify`, so it is asked for the one value rather than
  // carried across the boundary — the recorded reason `val` round-trips JSON at all.
  assert.equal(w.val('agentAutoNotes.get("R9")'), "keep me", "a failed decision threw the note away");
  assert.match(w.val("agentAutoActErr"), /waiting to be approved/, "the refusal was not said");

  // ⚠ AND A RUN THAT IS NO LONGER WAITING IS REFUSED HERE, BEFORE A REQUEST — asserted as
  // "nothing was sent", never as the words. The first version of this matched the sentence,
  // and the FIXTURE's own refusal says the same thing: so a screen that sent the request
  // anyway and printed the server's answer passed it. Measured, by a sweep mutant that cut
  // the local guard and survived. The step comes off the row; with nothing to answer there
  // is nothing to send.
  const before = posts.filter((x) => x.path === "/api/agent/automation-approve").length;
  w.ev(`agentAutoRuns = [{ id: "R9", state: "done", waiting: null }]; agentAutoDeciding = "";`);
  await w.ev('agentAutoDecide("R9", "approved")'); await settle();
  assert.equal(posts.filter((x) => x.path === "/api/agent/automation-approve").length, before,
    "a decision was sent for a run that is not waiting");
  assert.match(w.val("agentAutoActErr"), /isn’t waiting/);
});

test("⚠ a TIMED wait offers nothing to press — it resumes itself", async () => {
  // A control that did nothing would be a dead control on the one screen that has to be
  // trusted about what is happening, and no decision is ever read from a timed wait.
  const ticking = {
    id: "R6", automationId: "AU1", trigger: "manual", state: "waiting", at: "2026-09-17T09:00:00Z",
    waiting: { kind: "wait", step: "s2", ask: null, onTimeout: null, until: "2026-09-17T09:30:00Z" },
    values: {}, input: {}, outcomes: [], steps: [], decisions: {},
  };
  const { w } = await withAutomations({ automations: [ONE], history: [ticking] });
  await w.ev('agentAutoHistory("AU1")'); await settle();
  const html = w.s.document.getElementById("viewAgents").innerHTML;
  assert.match(html, /Waiting, and carrying on by itself/, "it does not say it resumes itself");
  assert.match(html, /Carries on/, "it does not say when");
  assert.equal(/agent-auto-approve/.test(html), false, "a timed wait drew an Approve button");
  assert.equal(/agent-auto-reject/.test(html), false, "a timed wait drew a Reject button");
  assert.equal(/data-note="R6"/.test(html), false, "a timed wait drew a box for a reason nobody will read");
  // THE CONTROL, in the same fixture shape: an APPROVAL really does draw all three.
  const { w: w2 } = await withAutomations({
    automations: [ONE],
    history: [{ ...ticking, id: "R7", waiting: { kind: "approval", step: "s8", ask: "Send it?", onTimeout: "reject", until: null } }],
  });
  await w2.ev('agentAutoHistory("AU1")'); await settle();
  const h2 = w2.s.document.getElementById("viewAgents").innerHTML;
  for (const want of ["agent-auto-approve", "agent-auto-reject", 'data-note="R7"']) {
    assert.ok(h2.includes(want), `the control is not drawing ${want} for an approval either`);
  }
});

test("⚠ the approval note is read back on every redraw, so a poll cannot eat it", async () => {
  // The history refreshes itself every 1.5 seconds while something is running, so a note
  // being typed beside a waiting run would be wiped between keystrokes. `renderAgents` is
  // the ONE door and it reads all four forms back before it draws.
  const waiting = {
    id: "R9", automationId: "AU1", trigger: "manual", state: "waiting", at: "2026-09-17T09:00:00Z",
    waiting: { kind: "approval", step: "s8", ask: "Send it?", onTimeout: "reject", until: null },
    values: {}, input: {}, outcomes: [], steps: [], decisions: {},
  };
  const { w } = await withAutomations({ automations: [ONE], history: [waiting] });
  await w.ev('agentAutoHistory("AU1")'); await settle();
  // TYPE INTO THE BOX THE SCREEN REALLY DREW, then make it redraw for an unrelated reason.
  const box = w.s.document.getElementById("__note");
  assert.ok(box, "the fake DOM has no note box");
  box.setAttribute("data-note", "R9");
  box.value = "half a sentence";
  w.ev(`document.querySelectorAll = (sel) => (sel === "[data-note]" ? [document.getElementById("__note")] : []);`);
  await w.ev("renderAgents()");
  assert.equal(w.val('agentAutoNotes.get("R9")'), "half a sentence", "a redraw ate the note being typed");
  // AND IT IS DRAWN BACK INTO THE BOX, which is the half a state assertion cannot see.
  assert.match(w.s.document.getElementById("viewAgents").innerHTML, /value="half a sentence"/);
});

test("the history says which branch ran, what it is waiting for, and what it saved", async () => {
  // THE THREE THINGS THE MILESTONE ASKS A HISTORY TO SHOW, in one execution's own row.
  const done = {
    id: "R1", automationId: "AU1", trigger: "manual", state: "done", at: "2026-09-17T09:00:00Z",
    finishedAt: "2026-09-17T09:01:00Z", result: "SENT: Dear customer",
    position: 9, values: { draft: "Dear customer", facts: "Price list: £95" }, input: { topic: "boiler service" },
    waiting: null, decisions: { s8: { verdict: "approved", note: "fine", by: "u1" } },
    steps: [
      { id: "s1", type: "knowledge", query: "{{topic}}", out: "facts" },
      { id: "s2", type: "if", left: "{{tone}}", op: "is", right: "formal" },
      { id: "s3", type: "note", text: "Dear customer" },
      { id: "s4", type: "otherwise" },
      { id: "s5", type: "note", text: "Hi!" },
      { id: "s6", type: "end" },
    ],
    outcomes: [
      { id: "s1", outcome: "ran", why: "searched and found 1 passage", sources: [{ title: "Price list", version: 2 }] },
      { id: "s2", outcome: "ran", took: "first", why: "it matched" },
      { id: "s3", outcome: "ran", result: "Dear customer" },
      { id: "s4", outcome: "skipped", why: "the steps under \"If\" ran, so this arm didn't" },
      { id: "s5", outcome: "skipped", why: "the steps under \"If\" ran, so this arm didn't" },
      { id: "s6", outcome: "ran", why: "both arms rejoin here" },
    ],
  };
  const { w } = await withAutomations({ automations: [ONE], history: [done] });
  await w.ev('agentAutoHistory("AU1")'); await settle();
  const html = w.s.document.getElementById("viewAgents").innerHTML;
  // ⚠ WHICH ARM RAN, AS WORDS A PERSON READS. An `if` is always `ran` — it did its job,
  // which was to choose — so without this the history shows two identical-looking branch
  // rows and leaves somebody to work it out from which steps below were skipped.
  assert.match(html, /first arm/, "the branch does not say which arm it took");
  // WHERE AN ANSWER CAME FROM, with its version — an excerpt with no source is an assertion
  // nobody can check.
  assert.match(html, /Price list/);
  assert.match(html, /v2|version 2/i, "the source's version is not shown");
  // AND A SKIP READS AS A SKIP, never as a failure: nothing went wrong on that arm.
  assert.match(html, /didn/, "the skipped arm does not say why");
  assert.match(html, /SENT: Dear customer/, "what it saved is not shown");
});

test("⚠ EVERY HOOK THE MARKUP DECLARES IS BOUND TO SOMETHING — the census that was missing", () => {
  // ⚠ **THIS IS THE GUARD THE DEAD `agent-auto-step-field` HOOK NEEDED, and no case
  // anywhere was it.** The agent screen's markup declares its behaviour by name
  // (`data-act`, `data-change`, `data-input`, `data-keydown`) and four tables answer those
  // names; a name in the markup with no entry is a control that ANSWERS and is discarded —
  // the worst shape this repository records, because from outside it is indistinguishable
  // from the feature not working and there is nothing to read in the console.
  //
  // MEASURED before the fix: `agent-auto-step-field` occurred ONCE in the file, in the
  // markup, and never in `CHANGE_ACTIONS` — so picking "until a time" on a wait changed the
  // select, redrew nothing, and the save was refused naming a box that was not on screen.
  //
  // A CENSUS OVER THE SOURCE rather than over a rendered page, because a hook only
  // reachable from a state no fixture happens to draw is exactly the one that rots.
  // ⚠ **THE PAIRING IS DERIVED FROM THE `bind(...)` CALLS, never listed here.** Those calls
  // are the one place the page really says which attribute is answered by which table, so a
  // fifth attribute added next month is covered by existing — and a hand-kept list would go
  // stale in the direction that reports nothing, which is the failure this census is for.
  const tables = Object.fromEntries([...CHAT.matchAll(/bind\('(data-[a-z]+)',\s*'[a-z]+',\s*([A-Z_]+)\)/g)]
    .map((m) => [m[1], m[2]]));
  assert.ok(Object.keys(tables).length >= 4, `the bind census read ${Object.keys(tables).length} tables`);
  // The tables' own keys, read as declared — each is an object literal of `'name': fn`.
  const keysOf = (name) => {
    const at = CHAT.indexOf(`const ${name} = {`);
    assert.ok(at > 0, `${name} is not declared in chat.js — retarget this census`);
    // TO ITS OWN CLOSING BRACE, found at column zero, because the bodies contain braces.
    const end = CHAT.indexOf("\n};", at);
    assert.ok(end > at, `${name}'s closing brace moved`);
    return new Set([...CHAT.slice(at, end).matchAll(/^\s{2}'([a-z0-9-]+)':/gm)].map((m) => m[1]));
  };
  // ⚠ **SCOPED TO THE `agent-` FAMILY, AND THE REASON IS MEASURED RATHER THAN ASSUMED.**
  // `data-act` is answered by TWO dispatchers in this file: these tables, and the site
  // builder's own delegated handler, which reads `b.dataset.act` directly (`data-act="data"`
  // is that one's, handled and not dead). So "every name is in the table" is false for the
  // site builder's half and true for this screen's, and a census that claimed the wider
  // thing would be red about correct code. This screen owns every `agent-` name, which is
  // exactly the family this milestone added nineteen hooks to.
  let checked = 0;
  for (const [attr, table] of Object.entries(tables)) {
    const declared = [...CHAT.matchAll(new RegExp(`${attr}="(agent-[a-z0-9-]+)"`, "g"))].map((m) => m[1]);
    if (!declared.length) continue;          // an attribute this screen does not use
    const bound = keysOf(table);
    assert.ok(bound.size >= 1, `${table} answers nothing`);
    for (const name of new Set(declared)) {
      assert.ok(bound.has(name), `the markup declares ${attr}="${name}" and ${table} has no entry for it`);
      checked++;
    }
  }
  // THE OBSERVER, PROVED ALIVE: it really read the hooks, including the one this is about.
  assert.ok(checked >= 30, `the census only looked at ${checked} hooks`);
  assert.ok(CHAT.includes('data-change="agent-auto-step-field"'), "the hook this census exists for is gone");
});

// ────────────────────────────────────────────────────────────────────────────
// A TOOL CALL WAITING FOR A PERSON
//
// The same class again, and the reason it belongs here rather than in a route
// test: every one of these bugs produces a screen that is internally consistent
// and wrong, and a source read cannot see any of it.
// ────────────────────────────────────────────────────────────────────────────

const WAITING = [{
  id: "ap-1", run: "r1", agent: "A", tool: "pause_automation",
  args: { id: "auto-7", enabled: false }, step: 1, index: 0, requestedAt: "2026-09-17T09:00:00Z",
}];

test("⚠ WHAT IS WAITING IS DRAWN FOR THE CONVERSATION IT WAS READ FOR, and no other", async () => {
  const gate = held(okRes({ approvals: WAITING, agent: "A" }));
  const w = loadScreen({
    answer: (p) => (p.startsWith("/api/agent/tool-approvals") ? gate.p : okRes({ agents: [], approvals: [] })),
  });
  setRows(w);
  w.ev('agentThread = "A"; agentMsgs = []; agentMsgsFor = "A";');
  const reading = w.ev('agentApprovalsLoad("A")');
  // The screen moves to B while the read is in flight.
  w.ev('agentThread = "B"; agentMsgsFor = "B";');
  gate.release();
  await reading;
  // NOTHING WAS WRITTEN, because the answer is about a conversation nobody is looking
  // at. Showing B's reader a decision about A's agent is showing somebody a question
  // that is not theirs to answer.
  assert.equal(w.ev("agentApprovals"), null, "A's waiting calls were written into B's screen");
  assert.equal(w.ev("agentApprovalsFor"), null);
});

test("a failed check keeps the rows it had — and 'nothing waiting' is not what it says", async () => {
  // ⚠ `null` AND `[]` ARE DIFFERENT ANSWERS. A failed read that answered `[]` would tell
  // somebody there is nothing to do while their agent sits stopped — the one wrong answer
  // this screen can give, because it is the answer that ends the conversation.
  const w = loadScreen({ answer: () => ({ ok: false, status: 500, json: async () => ({ error: "boom" }) }) });
  setRows(w);
  w.ev('agentThread = "A"; agentMsgsFor = "A";');
  w.ev(`agentApprovals = ${JSON.stringify(WAITING)}; agentApprovalsFor = "A";`);
  await w.ev('agentApprovalsLoad("A")');
  assert.equal(w.ev("agentApprovals.length"), 1, "a failed read emptied the list");
  assert.ok(w.ev("agentApprovalsErr").length > 0, "a failed read said nothing");
});

test("⚠ THE PRESS SENDS THE ID AND THE VERDICT AND NOTHING ELSE", async () => {
  const sent = [];
  const w = loadScreen({
    answer: (p, init) => {
      sent.push({ p, body: init && init.body ? JSON.parse(init.body) : null });
      return p === "/api/agent/tool-approve"
        ? okRes({ id: "ap-1", verdict: "approved", repeat: false })
        : okRes({ agents: [], approvals: [], messages: [] });
    },
  });
  setRows(w);
  w.ev('agentThread = "A"; agentMsgsFor = "A";');
  w.ev(`agentApprovals = ${JSON.stringify(WAITING)}; agentApprovalsFor = "A";`);
  await w.ev('agentApprovalDecide("ap-1", "approved")');
  const press = sent.find((c) => c.p === "/api/agent/tool-approve");
  assert.ok(press, "the press never reached the server");
  // WHO DECIDED IS THE SERVER'S TO TAKE FROM THE SESSION. A screen that sent one would
  // be a screen that could be told to send somebody else's.
  assert.deepEqual(Object.keys(press.body).sort(), ["id", "verdict"]);
  assert.equal(press.body.id, "ap-1");
  assert.equal(press.body.verdict, "approved");
  // AND BOTH ARE RE-READ AFTERWARDS: the decision put the run back on the queue, so the
  // conversation is the thing that changes next, and this row is gone from the list
  // either way.
  assert.ok(sent.some((c) => c.p.startsWith("/api/agent/tool-approvals")), "the list was not re-read");
  assert.ok(sent.some((c) => c.p.startsWith("/api/agent/messages")), "the conversation was not re-read");
});

test("⚠ A PRESS WHOSE ANSWER LANDS AFTER THE SCREEN MOVED WRITES NOTHING", async () => {
  const gate = held(okRes({ id: "ap-1", verdict: "approved", repeat: false }));
  const asked = [];
  const w = loadScreen({
    answer: (p) => { asked.push(p); return p === "/api/agent/tool-approve" ? gate.p : okRes({ agents: [], approvals: [], messages: [] }); },
  });
  setRows(w);
  w.ev('agentThread = "A"; agentMsgsFor = "A";');
  w.ev(`agentApprovals = ${JSON.stringify(WAITING)}; agentApprovalsFor = "A";`);
  const pressing = w.ev('agentApprovalDecide("ap-1", "approved")');
  w.ev('agentThread = "B"; agentMsgsFor = "B";');
  gate.release();
  await pressing;
  // NEITHER RE-READ HAPPENED, because both would be about a conversation nobody is on.
  assert.equal(asked.filter((p) => p.startsWith("/api/agent/messages")).length, 0,
    "A's conversation was re-read into B's screen");
  assert.equal(w.ev("agentApprovalsErr"), "", "A's outcome was announced into B's screen");
});

test("⚠ THE LOSER OF A RACE IS TOLD WHOSE ANSWER STANDS", async () => {
  const w = loadScreen({
    answer: (p) => (p === "/api/agent/tool-approve"
      ? okRes({ id: "ap-1", verdict: "rejected", repeat: true, decidedBy: "them" })
      : okRes({ agents: [], approvals: [], messages: [] })),
  });
  setRows(w);
  w.ev('agentThread = "A"; agentMsgsFor = "A";');
  w.ev(`agentApprovals = ${JSON.stringify(WAITING)}; agentApprovalsFor = "A";`);
  await w.ev('agentApprovalDecide("ap-1", "approved")');
  // Somebody else's verdict, in their words — not a silent success that shows this
  // person their own answer standing when it is not.
  assert.match(w.ev("agentApprovalsErr"), /already answered/);
  assert.match(w.ev("agentApprovalsErr"), /rejected/);
});

test("a second press while one is in flight does nothing, and the buttons say so", async () => {
  const gate = held(okRes({ id: "ap-1", verdict: "approved", repeat: false }));
  const sent = [];
  const w = loadScreen({
    answer: (p) => { sent.push(p); return p === "/api/agent/tool-approve" ? gate.p : okRes({ agents: [], approvals: [], messages: [] }); },
  });
  setRows(w);
  w.ev('agentThread = "A"; agentMsgsFor = "A";');
  w.ev(`agentApprovals = ${JSON.stringify(WAITING)}; agentApprovalsFor = "A";`);
  const first = w.ev('agentApprovalDecide("ap-1", "approved")');
  assert.equal(w.ev("agentApprovalBusy"), "ap-1");
  // The drawn buttons are disabled while it is in flight, read off the real markup.
  assert.match(w.ev(`agentApprovalHtml(${JSON.stringify(WAITING[0])})`), /data-act="agent-tool-approve"[^>]*disabled/);
  await w.ev('agentApprovalDecide("ap-1", "rejected")');
  gate.release();
  await first;
  assert.equal(sent.filter((p) => p === "/api/agent/tool-approve").length, 1,
    "a second press sent a second, opposite decision");
});

test("⚠ THE BANNER IS DRAWN FOR THE CONVERSATION IT WAS READ FOR, and no other", () => {
  // The read's own binding check is one wall; this is the other, and they are not the
  // same. A read that landed correctly for A, followed by the screen opening B, would
  // otherwise draw A's waiting call under B's message box — somebody being offered a
  // decision about an agent they are not looking at.
  const w = loadScreen({ answer: () => okRes({ agents: [], approvals: [] }) });
  setRows(w);
  w.ev(`agentApprovals = ${JSON.stringify(WAITING)}; agentApprovalsFor = "A";`);
  w.ev('agentThread = "A"; agentMsgs = []; agentMsgsFor = "A"; renderAgents();');
  assert.match(w.s.document.getElementById("viewAgents").innerHTML, /ag-ap-t/,
    "the banner was not drawn for the conversation it belongs to");
  w.ev('agentThread = "B"; agentMsgs = []; agentMsgsFor = "B"; renderAgents();');
  assert.doesNotMatch(w.s.document.getElementById("viewAgents").innerHTML, /ag-ap-t/,
    "A's waiting call was drawn under B's message box");
});

test("⚠ A QUIET RELOAD CHECKS WHAT IS WAITING — a run that stops must not do so in silence", () => {
  // The gate takes effect WHILE somebody is looking at the conversation; that is the
  // whole point of it. A banner that only appeared on a deliberate reload would leave
  // them watching a run that has stopped and will not start again until they press
  // something — and nothing on the screen would say so.
  const asked = [];
  const w = loadScreen({ answer: (p) => { asked.push(p); return okRes({ agents: [], approvals: [], messages: [] }); } });
  setRows(w);
  return w.ev('agentThreadLoad("A", true)').then(() => {
    assert.ok(asked.some((p) => p.startsWith("/api/agent/tool-approvals")),
      `a quiet reload never asked what is waiting: ${asked.join(", ")}`);
  });
});

test("a press whose FAILURE lands after the screen moved says nothing into the new one", async () => {
  // The success path writes nothing anywhere, so it cannot see this wall at all: what
  // the binding check really protects is the SENTENCE — a red line about A's decision,
  // under B's message box, about something B's reader never pressed.
  const gate = held({ ok: false, status: 500, json: async () => ({ error: "that request isn’t waiting any more" }) });
  const w = loadScreen({
    answer: (p) => (p === "/api/agent/tool-approve" ? gate.p : okRes({ agents: [], approvals: [], messages: [] })),
  });
  setRows(w);
  w.ev('agentThread = "A"; agentMsgsFor = "A";');
  w.ev(`agentApprovals = ${JSON.stringify(WAITING)}; agentApprovalsFor = "A";`);
  const pressing = w.ev('agentApprovalDecide("ap-1", "approved")');
  w.ev('agentThread = "B"; agentMsgsFor = "B"; agentApprovalsErr = "";');
  gate.release();
  await pressing;
  assert.equal(w.ev("agentApprovalsErr"), "", "A's failure was announced into B's screen");

  // THE CONTROL, without which "it says nothing" is satisfied by a press that never
  // reports anything: the same failure, landing on the screen it was pressed from, IS said.
  const gate2 = held({ ok: false, status: 500, json: async () => ({ error: "that request isn’t waiting any more" }) });
  const w2 = loadScreen({
    answer: (p) => (p === "/api/agent/tool-approve" ? gate2.p : okRes({ agents: [], approvals: [], messages: [] })),
  });
  setRows(w2);
  w2.ev('agentThread = "A"; agentMsgsFor = "A";');
  w2.ev(`agentApprovals = ${JSON.stringify(WAITING)}; agentApprovalsFor = "A";`);
  const p2 = w2.ev('agentApprovalDecide("ap-1", "approved")');
  gate2.release();
  await p2;
  assert.match(w2.ev("agentApprovalsErr"), /waiting/, "the failure was swallowed on its own screen");
});

test("an argument that is not text is shown as what it is, not as [object Object]", () => {
  // A person deciding cannot act on `[object Object]`, and that is exactly what a model
  // writing a nested argument produces through `String()`.
  const w = loadScreen({ answer: () => okRes({ agents: [] }) });
  assert.equal(w.ev('agentApprovalValue({ a: 1 })'), '{"a":1}');
  assert.equal(w.ev('agentApprovalValue([1, "two"])'), '[1,"two"]');
  assert.equal(w.ev('agentApprovalValue("plain")'), "plain");
  assert.equal(w.ev('agentApprovalValue(null)'), "(nothing)");
  assert.equal(w.ev('agentApprovalValue(undefined)'), "(nothing)");
  assert.equal(w.ev('agentApprovalValue(false)'), "false");
});

test("⚠ THE EXAMPLE SEEDS THE SAME FORM AND IS EDITABLE THE INSTANT IT IS DRAWN", async () => {
  // ⚠ **WHAT MAKES IT A STARTING POINT RATHER THAN A DEMO IS THAT IT OPENS THE ORDINARY NEW
  // FORM WITH A DRAFT IN IT.** So this drives the real button and then EDITS what it drew.
  const { w } = await withAutomations({ automations: [] });
  const list = w.s.document.getElementById("viewAgents").innerHTML;
  assert.match(list, /agent-auto-example/, "the offer is on the empty screen");
  assert.match(list, /Start from an example/);

  await w.ev('agentAutoExample()');
  const f = hydrateAuto(w);
  // THE WHOLE EXAMPLE IS IN THE FORM: its name, its steps in order, and its inputs.
  assert.equal(w.s.document.getElementById("agAutoName").value, EXAMPLE_AUTOMATION.name);
  const typesOf = (h) => h.rows.map((r) => r.getAttribute("data-step-type"));
  assert.deepEqual(typesOf(f), EXAMPLE_AUTOMATION.steps.map((st) => st.type));
  assert.equal(w.val("agentAutoDraft").inputs.length, EXAMPLE_AUTOMATION.inputs.length);
  // ...AND IT IS THE SAME FORM A BLANK ONE OPENS, which is why nothing else had to be built.
  assert.ok(w.s.document.getElementById("agAutoForm"), "the ordinary automation form");

  // ⚠ **EDITABLE**: change a word and drop a step, and the draft follows — so nothing here is
  // read-only and the example is a place to start rather than a thing to accept.
  const body = f.rows[2].fields.find((x) => x.getAttribute("data-field") === "body");
  body.value = "my own words";
  await w.ev('agentAutoStepDrop(0)');
  const after = hydrateAuto(w);
  assert.deepEqual(typesOf(after), EXAMPLE_AUTOMATION.steps.slice(1).map((st) => st.type),
    "the first step really went");
  assert.equal(w.val("agentAutoDraft").steps.at(-1).body, "my own words",
    "and what was typed into the one below it survived the structural change");

  // ⚠ **THE SERVER'S ANSWER IS COPIED, NOT REFERENCED** — a second press must offer the
  // example as it came rather than whatever the last one was edited into.
  await w.ev('agentAutoCancel()');
  await w.ev('agentAutoExample()');
  const again = hydrateAuto(w);
  assert.deepEqual(typesOf(again), EXAMPLE_AUTOMATION.steps.map((st) => st.type));
  assert.equal(w.val("agentAutoCat").example.steps.length, EXAMPLE_AUTOMATION.steps.length,
    "the catalog's own copy was never edited");
});

const sendStepOf = (w) => (w.val("agentAutoDraft").steps.find((s) => s.type === "send") || {});

test("⚠ the example's send step is filled from the person's OWN account, and left empty when they have none", async () => {
  // ⚠ **A CONNECTION ID BELONGS TO ONE ACCOUNT AND CANNOT BE INVENTED.** So the example
  // carries none, the browser fills it from the person's own first account that could really
  // carry a send, and with none it stays empty — where the form's own refusal names the field,
  // which is actionable. Seeding it with anything else would be seeding somebody else's.
  const { w } = await withAutomations({ automations: [] });
  await w.ev('agentAutoExample()');
  assert.equal(sendStepOf(w).connection, "", "nothing connected yet, so nothing is guessed");

  // NOW THE PERSON HAS TWO, one of them no longer usable. The first USABLE one is taken.
  const { w: two } = await withAutomations({ automations: [], connections: [
    { id: "CXOFF", status: "disconnected", account: "old@example.test" },
    { id: "CXMINE", status: "active", account: "shop@example.test" },
  ] });
  await two.ev('agentAutoExample()');
  assert.equal(sendStepOf(two).connection, "CXMINE",
    "a disconnected account is not a place to send from");
});

test("⚠ AN ACCOUNT CONNECTED FOR READING ONLY IS NOT A PLACE TO SEND FROM", async () => {
  /**
   * ⚠ **STATUS ALONE WOULD OFFER IT, and it would save and then fail at its last step.** An
   * account granted `read` and not `send` is perfectly `active`: the credential works, the
   * provider has not withdrawn anything, nobody disconnected it. What it cannot do is the one
   * thing this step is for — `perform` asks the database for the action's own scope and is
   * refused — so a form seeded with it is a workflow that looks configured and does not run.
   *
   * WHICH PERMISSION IS READ FROM THE PROVIDER'S OWN `sendScope`, never from the word "send"
   * written here: the mapping from an action to the scope it needs lives on the adapter, and a
   * second provider may spell its own differently.
   */
  const { w } = await withAutomations({ automations: [], connections: [
    { id: "CXREAD", status: "active", scopes: ["read"], account: "inbox@example.test" },
  ] });
  await w.ev('agentAutoExample()');
  assert.equal(sendStepOf(w).connection, "", "an account that may only read was offered");

  // THE CONTROL: the very same account, granted the send permission, IS taken — so this case
  // is about the PERMISSION and not about anything else refusing every row.
  const { w: may } = await withAutomations({ automations: [], connections: [
    { id: "CXREAD", status: "active", scopes: ["read", "send"], account: "inbox@example.test" },
  ] });
  await may.ev('agentAutoExample()');
  assert.equal(sendStepOf(may).connection, "CXREAD");
});

test("⚠ THE ACCOUNTS ARE THIS AGENT'S, READ NOW — never whichever connections screen was last opened", async () => {
  /**
   * ⚠ **MEASURED DEFECT: the seed read `agentConnRows`, which belongs to the connected-accounts
   * SCREEN.** `agentAutomations` sets `agentConn = null` on the way in and does NOT clear those
   * rows, so they sit there holding whichever agent's accounts were last looked at — and an id
   * from another agent's list is one this agent cannot send through at all. With none ever
   * looked at, the variable is `null` and the example could never be seeded.
   *
   * So the rows are read from `/api/agent/connections?agent=<this one>` at the press: the same
   * route the screen itself reads, which is what makes it one answer to one question.
   */
  const { w } = await withAutomations({ automations: [], connections: [] });
  // A LEFTOVER SCREEN'S ROWS, in the shape the route really answers, naming another agent —
  // so nothing about the shape can be why they are ignored.
  await w.ev(`agentConnRows = ${JSON.stringify([connAnswer({ id: "CXOTHER", status: "active" })])};`);
  await w.ev('agentAutoExample()');
  assert.equal(sendStepOf(w).connection, "",
    "the seed took an account off a screen belonging to another agent");

  // THE CONTROL: with THIS agent's route answering one, it is taken — so the case is about
  // WHERE the rows come from rather than about the filter refusing everything.
  const { w: mine } = await withAutomations({ automations: [], connections: [
    { id: "CXMINE", status: "active" },
  ] });
  await mine.ev(`agentConnRows = ${JSON.stringify([connAnswer({ id: "CXOTHER", status: "active" })])};`);
  await mine.ev('agentAutoExample()');
  assert.equal(sendStepOf(mine).connection, "CXMINE", "and this agent's own account is used");
});

test("⚠ A READ WE COULD NOT MAKE SEEDS NO ACCOUNT, and still seeds the example", async () => {
  /**
   * ⚠ **CANNOT-TELL MUST NEVER READ AS A VALUE, and here the value would be somebody's
   * account.** An outage leaves us unable to say what this agent has connected, so nothing is
   * picked — and the example itself is still what the button is for, so the workflow is seeded
   * and the one field a person fills in is the one that stayed empty.
   */
  const { w } = await withAutomations({ automations: [], connFails: true,
    connections: [{ id: "CXMINE", status: "active" }] });
  await w.ev('agentAutoExample()');
  const draft = w.val("agentAutoDraft");
  assert.ok(draft, "the example was not seeded at all");
  assert.equal(draft.steps.length, EXAMPLE.steps.length, "the whole workflow is still there");
  assert.equal(sendStepOf(w).connection, "", "an account we could not establish was picked");
});

/** ONE CONNECTIONS ANSWER, AS THE ROUTE SENDS IT, for a case that has to hold one open. */
const connBody = (rows) => ({
  ok: true, connections: rows.map(connAnswer),
  providers: JSON.parse(JSON.stringify(AGENT_PROVIDERS)), max: MAX_CONNECTIONS,
});

test("⚠ TWO NOTHINGS MATCHING IS NOT A YES: an empty permission does not satisfy an empty requirement", async () => {
  /**
   * ⚠ **A SWEEP SURVIVOR IS WHY THIS EXISTS, and it is not the redundancy it looks like.**
   * Cutting the "we cannot tell which permission a send needs" line leaves `needs` as `''`,
   * and `[].includes('')` is false for every ordinary scope list — so over nine shapes the two
   * readings agree and the line reads as a second wall in front of the one below it.
   *
   * **TWO SHAPES SEPARATE THEM, and both are ones the answer can carry.** `connectionRow` keeps
   * any STRING in `scopes`, `""` included, so a row holding one against a provider that names no
   * send scope makes `includes('')` TRUE — and an account is offered on the strength of an empty
   * permission matching an empty requirement. Measured: identical on the other eight shapes and
   * different on these two.
   */
  const { w } = await withAutomations({ automations: [], noSendScope: true,
    connections: [{ id: "CXEMPTY", status: "active", scopes: [""] }] });
  await w.ev('agentAutoExample()');
  assert.equal(sendStepOf(w).connection, "",
    "an empty permission was read as satisfying an unknown requirement");

  // THE SAME ROW AGAINST A PROVIDER THAT DOES NAME ITS SEND SCOPE is refused too — for the
  // OTHER reason, which is the one the line below it carries.
  const { w: named } = await withAutomations({ automations: [],
    connections: [{ id: "CXEMPTY", status: "active", scopes: [""] }] });
  await named.ev('agentAutoExample()');
  assert.equal(sendStepOf(named).connection, "");

  // THE OBSERVER: the same fixture with a real grant IS offered, so neither refusal above is
  // "this case can never pick anything".
  const { w: real } = await withAutomations({ automations: [],
    connections: [{ id: "CXEMPTY", status: "active", scopes: ["send"] }] });
  await real.ev('agentAutoExample()');
  assert.equal(sendStepOf(real).connection, "CXEMPTY");
});

test("⚠ A READ THAT NEVER HAPPENED IS THE SAME ANSWER AS ONE THAT WAS REFUSED", async () => {
  // ⚠ **A REFUSAL ARRIVES AS A RESPONSE AND AN OUTAGE ARRIVES AS A REJECTION**, and only the
  // second reaches the `catch` — so the refusal case above it could not drive this branch at
  // all. Both must seed the example and neither may pick an account.
  const { w } = await withAutomations({ automations: [], connThrows: true,
    connections: [{ id: "CXMINE", status: "active" }] });
  await w.ev('agentAutoExample()');
  const draft = w.val("agentAutoDraft");
  assert.ok(draft, "a browser with no network got no example at all");
  assert.equal(draft.steps.length, EXAMPLE.steps.length, "the whole workflow is still there");
  assert.equal(sendStepOf(w).connection, "", "an account was picked out of a read that never happened");
});

test("⚠ A SEED THAT LANDS AFTER THE SCREEN HAS MOVED ON WRITES NOTHING", async () => {
  /**
   * ⚠ **THE SEED IS A REQUEST NOW, so it can land late — and what it would write is a whole
   * form.** Seeded into another agent's screen it is that agent's editor holding a workflow
   * naming an account it cannot send through; the form saves and the send is refused. So the
   * answer is admitted only while the agent it was asked for is still the one on screen.
   */
  const gate = held(okRes(connBody([{ id: "CXA", status: "active" }])));
  const { w } = await withAutomations({ automations: [], connGates: [gate] });
  const seeding = w.ev('agentAutoExample()');
  // THE SCREEN MOVES TO ANOTHER AGENT'S AUTOMATIONS while the read is in flight.
  await w.ev('agentAutomations("B")'); await settle();
  gate.release();
  await seeding;
  assert.equal(w.val("agentAutoDraft"), null, "A's example was seeded into B's screen");
  assert.equal(w.val("agentAutoEditing"), null, "and it opened a form there");
});

test("⚠ A SEED THAT LANDS AFTER SOMEBODY ELSE SIGNED IN WRITES NOTHING", async () => {
  // THE OTHER HALF OF THE SAME BINDING, and it is a different question: the agent id can be
  // unchanged while the person at the keyboard is not, and an id from the account that has
  // gone is one this one cannot use.
  const gate = held(okRes(connBody([{ id: "CXA", status: "active" }])));
  const { w } = await withAutomations({ automations: [], connGates: [gate] });
  const seeding = w.ev('agentAutoExample()');
  w.signIn("someone-else");
  gate.release();
  await seeding;
  assert.equal(w.val("agentAutoDraft"), null, "the previous account's account was seeded");
});

test("⚠ TWO PRESSES: THE LAST ONE DECIDES, and the earlier answer does not overwrite it", async () => {
  /**
   * ⚠ **AN EARLIER PRESS'S ANSWER LANDING SECOND WOULD PUT A STALE ACCOUNT INTO A FORM
   * SOMEBODY IS ALREADY LOOKING AT** — and by then they may have started editing it. The two
   * answers name DIFFERENT accounts, or "the last one decided" is satisfied by them agreeing.
   */
  const first = held(okRes(connBody([{ id: "CXFIRST", status: "active" }])));
  const second = held(okRes(connBody([{ id: "CXSECOND", status: "active" }])));
  const { w } = await withAutomations({ automations: [], connGates: [first, second] });
  const one = w.ev('agentAutoExample()');
  const two = w.ev('agentAutoExample()');
  // THE SECOND ANSWERS FIRST, which is the ordinary shape of two requests in flight.
  second.release();
  await two;
  assert.equal(sendStepOf(w).connection, "CXSECOND", "the newest press did not decide");
  first.release();
  await one;
  assert.equal(sendStepOf(w).connection, "CXSECOND",
    "the earlier press's answer overwrote the form that was already on screen");
});

test("⚠ A PROVIDER THAT NAMES NO SEND PERMISSION IS NOT ONE WE CAN SAY MAY SEND", async () => {
  /**
   * AN OLDER WORKER DESCRIBES ITS PROVIDERS WITHOUT `sendScope`, so there is nothing to look
   * for on the connection — and reading that silence as "any active account will do" is the
   * same defect through a different door. It fails closed, exactly as an unknown provider does.
   */
  const { w } = await withAutomations({ automations: [], noSendScope: true,
    connections: [{ id: "CXMINE", status: "active" }] });
  await w.ev('agentAutoExample()');
  assert.equal(sendStepOf(w).connection, "", "a provider we know nothing about was trusted");

  // AND A ROW NAMING A PROVIDER THE ANSWER DOES NOT DESCRIBE AT ALL is the same refusal.
  const { w: alien } = await withAutomations({ automations: [], connections: [
    { id: "CXALIEN", status: "active", provider: "nobodys-mail" },
  ] });
  await alien.ev('agentAutoExample()');
  assert.equal(sendStepOf(alien).connection, "");
});

test("⚠ a Worker that sends no example offers no button, rather than one that seeds nothing", async () => {
  // AN OLDER WORKER ANSWERS NO `example` KEY AT ALL, which is what this screen did before the
  // example existed. A button that seeded nothing would be a dead control.
  const { w } = await withAutomations({ automations: [], noExample: true });
  const html = w.s.document.getElementById("viewAgents").innerHTML;
  assert.doesNotMatch(html, /agent-auto-example/);
  assert.doesNotMatch(html, /Start from an example/);
  // AND PRESSING IT ANYWAY CHANGES NOTHING — the action is reachable from a stale page.
  await w.ev('agentAutoExample()');
  assert.equal(w.val("agentAutoEditing"), null, "no form was opened");
  assert.equal(w.val("agentAutoDraft"), null);
});

test("⚠ AN EXAMPLE THAT IS NOT A WHOLE WORKFLOW IS NO EXAMPLE, and is not offered", async () => {
  // ⚠ **A SWEEP SURVIVOR IS WHY THIS EXISTS.** `example: j.example || null` — a truthiness
  // check — passed every case, because the fixture only ever sent a WHOLE example or none at
  // all. A truthy answer carrying no steps seeds a form with a name and nothing in it: a
  // button that promises an example and delivers almost none. It fails closed on the shape.
  const { w } = await withAutomations({ automations: [], halfExample: true });
  assert.equal(w.val("agentAutoCat").example, null, "a half-read example is not an example");
  const html = w.s.document.getElementById("viewAgents").innerHTML;
  assert.doesNotMatch(html, /agent-auto-example/, "so nothing is offered");
  await w.ev('agentAutoExample()');
  assert.equal(w.val("agentAutoEditing"), null, "and pressing it from a stale page does nothing");
  // AND THE CONTROL: the whole one really is offered, so this is about the SHAPE.
  const { w: ok } = await withAutomations({ automations: [] });
  assert.ok(ok.val("agentAutoCat").example, "the whole example is kept");
  assert.match(ok.s.document.getElementById("viewAgents").innerHTML, /agent-auto-example/);
});

test("⚠ THE CATALOG'S OWN CAP REACHES THE FORM, rather than a number written here", async () => {
  // ⚠ **MEASURED DEFECT: `maxInputs` was dropped in the browser's own assignment**, so both
  // readers fell through to a hardcoded 8 — which agrees with the server today, which is
  // exactly what made it invisible. Two copies of one number, waiting for the cap to move.
  const { w } = await withAutomations({ automations: [] });
  assert.equal(w.val("agentAutoCat").maxInputs, MAX_AUTOMATION_INPUTS,
    "the cap the server sent is the cap the form holds");
});

test("⚠ THE MESSAGE A PERSON APPROVED IS ON THE HISTORY, and it says it is simulated", async () => {
  /**
   * ⚠ **THE BRIEF NAMES THIS IN AS MANY WORDS — *show the prepared message and the provider's
   * actual recorded outcome* — and `why`/`error`/`result` are all sentences ABOUT the send.**
   * None of them is the text, and the text is the thing somebody checks against what they
   * approved. The label rides BESIDE the message rather than only above the panel, because a
   * chip is gone the moment somebody copies an answer into an email.
   */
  const sent = {
    id: "R7", automationId: "AU1", trigger: "manual", state: "done", result: "sent to ada@example.test",
    outcomes: [
      { id: "s1", type: "knowledge", outcome: "ran", why: "found 1 passage",
        sources: [{ title: "Prices", version: 2 }] },
      { id: "s3", type: "send", outcome: "ran", sent: true, simulated: true,
        prepared: "Hello Ada — about your wheel truing: £95.", why: "sent to ada@example.test from shop@example.test" },
    ],
    steps: [], unresolved: [], why: null, error: null, at: "2026-09-19T06:00:00Z", finishedAt: "2026-09-19T06:00:09Z",
  };
  const w = loadScreen({
    answer: (p, init) => {
      if (p.startsWith("/api/agent/automation-history")) return okRes({ id: "AU1", executions: [sent] });
      const a = autoAnswer({ automations: [ONE] })(p, init);
      return a.ok ? okRes(a.body) : badRes(a.body.error);
    },
  });
  await w.ev("agentsLoad()");
  await w.ev('agentAutomations("A")'); await settle();
  await w.ev('agentAutoHistory("AU1")'); await settle();
  const html = w.s.document.getElementById("viewAgents").innerHTML;
  assert.match(html, /ag-step-msg/, "the prepared message has its own place");
  assert.match(html, /Hello Ada — about your wheel truing/, "and it is the words that went out");
  assert.match(html, /\[simulated\]/, "labelled, beside the message and not only above the panel");
  // THE PROVIDER'S OWN RECORDED OUTCOME, which is a different thing from the message.
  assert.match(html, /sent to ada@example\.test from shop@example\.test/);
  // AND WHERE THE LOOKUP'S ANSWER CAME FROM, with its version — an excerpt with no source is
  // an assertion nobody can check.
  assert.match(html, /Prices v2/);

  // ⚠ **THE LABEL IS READ FROM THE OUTCOME, NEVER WRITTEN AS A CONSTANT**, so connecting a
  // real provider stops it with no change to this renderer. The CONTROL is the same send with
  // `simulated` absent: the message is still drawn and the label is gone.
  const real = { ...sent, outcomes: sent.outcomes.map((o) => o.type === "send" ? { ...o, simulated: false } : o) };
  const w2 = loadScreen({
    answer: (p, init) => {
      if (p.startsWith("/api/agent/automation-history")) return okRes({ id: "AU1", executions: [real] });
      const a = autoAnswer({ automations: [ONE] })(p, init);
      return a.ok ? okRes(a.body) : badRes(a.body.error);
    },
  });
  await w2.ev("agentsLoad()");
  await w2.ev('agentAutomations("A")'); await settle();
  await w2.ev('agentAutoHistory("AU1")'); await settle();
  const html2 = w2.s.document.getElementById("viewAgents").innerHTML;
  assert.match(html2, /Hello Ada — about your wheel truing/, "the message is still drawn");
  assert.doesNotMatch(html2, /\[simulated\]/, "and nothing claims a simulation that is not one");

  // AND A STEP THAT PREPARED NOTHING DRAWS NO EMPTY BOX — the recorded defect of drawing the
  // word `undefined`, one field over.
  const plain = { ...sent, outcomes: [{ id: "s2", type: "note", outcome: "ran", result: "noted" }] };
  const w3 = loadScreen({
    answer: (p, init) => {
      if (p.startsWith("/api/agent/automation-history")) return okRes({ id: "AU1", executions: [plain] });
      const a = autoAnswer({ automations: [ONE] })(p, init);
      return a.ok ? okRes(a.body) : badRes(a.body.error);
    },
  });
  await w3.ev("agentsLoad()");
  await w3.ev('agentAutomations("A")'); await settle();
  await w3.ev('agentAutoHistory("AU1")'); await settle();
  const html3 = w3.s.document.getElementById("viewAgents").innerHTML;
  assert.doesNotMatch(html3, /ag-step-msg/);
  assert.doesNotMatch(html3, /undefined/);
});
