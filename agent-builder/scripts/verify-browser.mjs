/**
 * SIX CUSTOMER JOURNEYS THROUGH A REAL BROWSER, on the real screen.
 *
 * ⚠ **WHAT MAKES THIS DIFFERENT FROM EVERY OTHER `verify:*` IN THIS FOLDER, said first.**
 * The others drive ROUTES: they build a request, hand it to the real handler, and read the
 * answer. That proves what a request does and says **nothing about whether a person can
 * make that request by pressing the thing on screen** — the gap this repository has paid
 * for repeatedly (a dead control that answers, a field with no control, a control whose
 * hook nothing is bound to). So here Chromium loads `public/index.html`, runs the real
 * `chat.js` against the real `styles.css`, and **every `/api/agent/*` call the page makes
 * goes to the real site route, the real store, a real PostgreSQL and the real engine.**
 *
 * ── ⚠ SIMULATED, ALL OF IT, NAMED HERE ──────────────────────────────────────────
 *
 *   1. **`public/auth.js` IS REPLACED, and nothing else is.** It is the one file that talks
 *      to GoTrue over the network, and there is no GoTrue on a laptop and no account of
 *      anybody's. The stub answers a fixed token; the SERVER maps that token to a tenant.
 *      **What that substitutes is the proof that a token belongs to an account. It
 *      substitutes nothing the tenant then does** — which is exactly why handing two
 *      contexts two different tokens is a real two-account test.
 *   2. **THE MODEL, where a conversation is necessary** — `scripts/lib/scripted-model.mjs`,
 *      armed with the answers a run will give IN ORDER, keyed by POSITION and never by the
 *      words. **Nothing here is a phrase-matching chatbot and nothing here claims language
 *      understanding.** Journeys 1–6 need it for nothing but journey 4's conversation.
 *   3. **THE PROVIDER** — `fakemail`, no network, no credential.
 *   4. **THE TWO TRANSPORTS** — PostgREST is `scripts/local-rest.mjs` and the queue is an
 *      in-process doorbell. Durability is unchanged: the work is a ROW.
 *
 * **NOT SIMULATED**: the page, the stylesheet, `chat.js`, `worker.js`'s own `/api/agent/*`
 * dispatch, `handleAgentApi`, `makeAgentStore`, the tenant filter, `worker.queue`,
 * `worker.scheduled`, the lease, the fence, the journal, the operation record, the
 * approval's argument binding and every refusal the database makes.
 *
 * ⚠ **IT NEVER TOUCHES THE HOSTED PROJECT.** Throwaway database, loopback ports, no
 * credential, no external request, no paid call.
 *
 *   node scripts/verify-browser.mjs           # all six
 *   node scripts/verify-browser.mjs 1 6       # only those
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import worker, { ADAPTERS } from "../src/worker.mjs";
import { haveCluster, standUp, dispatcher } from "./lib/local-stack.mjs";
import { startLocalSite, SITE_ROOT } from "./lib/local-site.mjs";
import { makeScriptedModel, SIMULATED } from "./lib/scripted-model.mjs";
import { FAKE_PROVIDER } from "../src/fake-provider.mjs";
import { signDelivery, SIG_HEADER, TS_HEADER, ID_HEADER } from "../src/webhooks.mjs";
import { handleAgentApi, makeAgentStore, AGENT_ROUTES } from "../../agent-store.mjs";

const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const DB = `agent_browser_${process.pid}`;
/** Account A is the customer. Account B is the one next door. TWO TENANTS. */
const A = { uid: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa", email: "shop@example.test", token: "tok-a" };
const B = { uid: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb", email: "next-door@example.test", token: "tok-b" };
const ZONE = "Europe/London";
/** The account a person connects, and who the example's workflow writes to. */
const ACCOUNT = "shop@example.test";
const RECIPIENT = "ada@example.test";
/** Journey 7's SECOND send goes somewhere else, so the mailbox can say WHICH one went. */
const RECIPIENT2 = "bev@example.test";
/** The two arms of journey 2's branch — one of them must be nowhere near the message. */
const FORMAL = "Dear {{who}}, regarding {{topic}}: {{facts}} (scripted, not written by a model)";
const CASUAL = "Hi {{who}} — about {{topic}}: {{facts}} (scripted, not written by a model)";
/** The event journey 3 binds an automation to and then delivers from outside. */
const EVENT = "order.paid";
const ONLY = process.argv.slice(2).filter((s) => /^[1-7]$/.test(s)).map(Number);
const want = (n) => !ONLY.length || ONLY.includes(n);
/**
 * ⚠ **THE JOURNEYS ARE A SEQUENCE, AND A SELECTION THAT LEAVES OUT WHAT ONE RESTS ON IS
 * REFUSED BY NAME rather than crashing on a control that is not there.** Journey 1 creates the
 * agent, its reference material and its memory; 2–5 are that customer carrying on. Running `2`
 * on its own is a selection nobody can satisfy, and saying so beats a timeout on
 * `[data-id="null"]`.
 */
const RESTS_ON = { 2: [1], 3: [1, 2], 4: [1], 5: [1], 7: [1, 2] };
for (const [n, on] of Object.entries(RESTS_ON)) {
  if (!want(Number(n))) continue;
  const missing = on.filter((m) => !want(m));
  if (missing.length) {
    console.log(`Journey ${n} continues journey ${missing.join(" and ")}, which this selection leaves out.`);
    console.log(`  run them together:  node scripts/verify-browser.mjs ${[...on, Number(n)].join(" ")}`);
    process.exit(2);
  }
}

let failed = 0;
const fails = [];
const check = (what, cond, detail = "") => {
  if (!cond) { failed++; fails.push(what + (detail ? ` — ${detail}` : "")); }
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);
};
const head = (s) => console.log(`\n${s}`);

if (!haveCluster()) {
  console.log("No local PostgreSQL that `su postgres` can reach — nothing to verify against.");
  console.log("  start one with:  pg_ctlcluster 16 main start");
  process.exit(0);
}
if (!fs.existsSync(CHROME)) {
  console.log(`No Chromium at ${CHROME} — this verification is a BROWSER one and cannot stand in for itself.`);
  console.log("  the route-level equivalents are: npm run verify:journeys / verify:conversation / verify:send");
  process.exit(0);
}

/**
 * ⚠ THE STUB FOR `public/auth.js`, AND THE ONLY FILE REPLACED.
 *
 * Served in place of the real one by a route interception, so it survives a RELOAD the way
 * the real script does — which journeys 1 and 4 both turn on. `accessToken` is what
 * `apiFetch` really calls; the rest of the surface is what `chat.js` really reads, read off
 * `chat.js` rather than guessed.
 */
const authStub = (who) => `
window.__SIMULATED_AUTH = true;
window.Auth = {
  isSignedIn: () => true,
  userId: () => ${JSON.stringify(who.uid)},
  email: () => ${JSON.stringify(who.email)},
  accessToken: async () => ${JSON.stringify(who.token)},
  token: async () => ${JSON.stringify(who.token)},
  signOut: async () => {},
  signOutEverywhere: async () => {},
  onChange: () => {},
  storageWipeOwn: () => {},
  checkPassword: async () => true,
  updatePassword: async () => {},
  sendCode: async () => {},
  verifyCode: async () => {},
  recover: async () => {},
  signUp: async () => {},
  deleteAccount: async () => {},
};
`;

const stack = await standUp({ db: DB });
const model = makeScriptedModel();
/**
 * ⚠ **THE ENGINE IS A HOLDER, BECAUSE JOURNEY 4 RESTARTS IT — and a restart is the whole
 * claim.** `dispatcher()` is a brand-new env with a brand-new doorbell and no memory of
 * anything, which is the same state a deploy leaves behind. The SITE is long-lived, so binding
 * its `ring` to the first one would leave every press after the restart ringing a queue nobody
 * consumes — the work would sit until a tick found it, and the journey would be measuring the
 * sweeper rather than the doorbell.
 */
let disp = dispatcher({ worker, rest: stack.rest, model });
/** Throw the engine away and stand a new one up. Nothing is carried across. */
const restartEngine = () => { disp = dispatcher({ worker, rest: stack.rest, model }); return disp; };
const site = await startLocalSite({
  rest: stack.rest,
  ring: (runId) => disp.ring(runId),
  tokens: new Map([[A.token, A.uid], [B.token, B.uid]]),
});
const mailbox = (account) => ADAPTERS[FAKE_PROVIDER].mailbox(account);
/**
 * ⚠ **THE ROUTES THAT HAVE NO SCREEN, NAMED — a declared copy of the site's own
 * `NO_SCREEN_YET`,** which `test/agent-builder-view.test.mjs` is the authority on. A person is
 * exactly who makes an inbound endpoint, copies its secret, takes a tool away or stops a run;
 * the backend landed first on the standing instruction that the frontend stays as it is. So
 * these are the only things this file may reach past the browser, and the list shrinks as the
 * screen arrives rather than being forgotten.
 */
/**
 * ⚠ **READ OUT OF THE SITE'S OWN GUARD, NOT TYPED AGAIN — and it had already drifted.**
 *
 * `test/agent-builder-view.test.mjs` keeps the authoritative list and it SHRINKS as each screen
 * arrives. This file held a copy, and when `/api/agent/run-cancel` and the four endpoint routes
 * got screens the copy kept them — so `siteApi` went on admitting five routes a person can now
 * press, which is exactly how a demonstration keeps calling a route instead of pressing the
 * control it is supposed to be proving. **The list is the drift; the door is fine.**
 *
 * So it is parsed from that file's own declaration. A test file is not a module and cannot be
 * imported, and duplicating the list is what just failed — reading it is the remaining option,
 * and it fails LOUDLY (the throw below) rather than quietly falling back to a copy.
 */
const VIEW_GUARD = path.join(SITE_ROOT, "test", "agent-builder-view.test.mjs");
const NO_SCREEN_YET = (() => {
  const src = fs.readFileSync(VIEW_GUARD, "utf8");
  const at = src.indexOf("const NO_SCREEN_YET = [");
  if (at === -1) throw new Error(`verify-browser: ${VIEW_GUARD} no longer declares NO_SCREEN_YET`);
  const end = src.indexOf("]", at);
  if (end === -1) throw new Error("verify-browser: NO_SCREEN_YET's declaration does not close");
  const names = [...src.slice(at, end).matchAll(/"(\/api\/agent\/[a-z-]+)"/g)].map((m) => m[1]);
  if (!names.length) throw new Error("verify-browser: NO_SCREEN_YET parsed as empty");
  return names;
})();
// ⚠ EVERY NAME HAS TO BE A REAL ROUTE, so a typo cannot quietly exempt one that does exist.
for (const p of NO_SCREEN_YET) {
  if (!Object.hasOwn(AGENT_ROUTES, p)) throw new Error(`NO_SCREEN_YET names ${p}, which is not a route`);
}

/**
 * ⚠ **THE SITE'S OWN ROUTE, FOR THE ONES WITH NO SCREEN — declared, walled, not a shortcut.**
 * It REFUSES any other path, because *a wall nobody can drive is a wall nobody is guarding* and
 * the wall here is on my own instrument: without it this door is one line away from becoming
 * how an awkward check skips the browser, which is the whole point of the file. What it
 * verifies is ROUTE-level and says so — every other check presses something a person presses.
 */
const siteApi = async (path, body = null, query = {}) => {
  if (!NO_SCREEN_YET.includes(path)) {
    throw new Error(`${path} has a screen — press it in the browser rather than calling it here`);
  }
  const answer = await handleAgentApi({
    path, method: body ? "POST" : "GET", query: new URLSearchParams(query), body: body ?? {},
    // ⚠ **THE STORE'S OWN REASON IS PRINTED, NEVER SWALLOWED.** A `log: () => {}` here cost a
    // whole run: `/api/agent/webhooks` came back with the route's generic "couldn't save that
    // just now" and the reason — which the store had logged — went nowhere. *A failure that
    // cannot name itself*, in the one door this file has for a route with no screen.
    tenant: A.uid, ring: disp.ring, log: (...a) => console.log("  route:", ...a),
    store: makeAgentStore({ fetch: (u, o) => fetch(u, o), url: stack.rest.url, key: "local-service-role" }),
  });
  return { status: answer.status, body: answer.body };
};
const browser = await chromium.launch({ executablePath: CHROME });
const shotDir = path.join(SITE_ROOT, "shots", "browser");
fs.mkdirSync(shotDir, { recursive: true });

/** Everything a page said went wrong, so a green journey over a throwing page is impossible. */
const pageProblems = [];
/**
 * ⚠ EVERY NON-2xx THE PAGE FETCHED, WITH ITS URL — because Chromium's console says only
 * "Failed to load resource: 404" and a failure that cannot name itself is one nobody can
 * act on. Kept apart from `pageProblems` rather than filtered into it: an `/api/` call that
 * failed is the product's and is asserted; anything else is NAMED so it is visible rather
 * than silently dropped.
 */
const badResponses = [];
/**
 * ⚠ WHAT THIS HARNESS DELIBERATELY DOES NOT SERVE, and the 404s are therefore ITS scope
 * rather than the product's. `enterApp()` is the site builder's own entry and reads the
 * credit balance and the site list; `local-site.mjs` serves static files and `/api/agent/*`
 * and nothing else, because inventing answers for a product this journey is not about is how
 * a fixture becomes more capable than reality. **DECLARED rather than filtered**: anything
 * NOT on this list that 404s is a failure, so a route that stops being served shows up.
 */
const OUT_OF_SCOPE = ["/api/credits", "/api/site/list", "/favicon.ico"];
const agentFailures = () => badResponses.filter((r) => r.url.startsWith("/api/agent/"));
/**
 * The `/api/agent/*` calls refused in ONE journey's own sessions, by label.
 *
 * ⚠ **SCOPED, BECAUSE `badResponses` IS THE WHOLE RUN'S AND JOURNEY 5'S REFUSALS ARE THE
 * POINT.** Asserted globally, every journey after it would go red on the fourteen things the
 * account next door is supposed to be refused — and a journey run on its own and the same
 * journey run after others would be asserting two different things, which is the worse half.
 * A journey answers for its own sessions.
 */
const refusedIn = (prefix) => agentFailures().filter((r) => r.label.startsWith(prefix));
const unexpected404s = () => badResponses.filter((r) =>
  !r.url.startsWith("/api/agent/") && !OUT_OF_SCOPE.includes(r.url));

/**
 * One browser session. **A CONTEXT IS A SESSION AND A TOKEN IS AN ACCOUNT** — two contexts
 * with one token are two sessions of one account (journey 5's first half), and two contexts
 * with two tokens are two accounts (its second half).
 */
async function openApp(who, label) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.route("**/auth.js", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript; charset=utf-8", body: authStub(who) }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageProblems.push(`${label}: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400) badResponses.push({ label, url: new URL(r.url()).pathname, status: r.status() });
  });
  // Console errors are kept, because a throw inside `chat.js` reaches here and nowhere else.
  // A failed FETCH is the one class left out, and it is ROUTED rather than dropped: Chromium
  // says only "Failed to load resource: 404" while `badResponses` above has the URL, which is
  // what the two checks below read.
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/Failed to load resource/i.test(m.text())) return;
    pageProblems.push(`${label} console: ${m.text()}`);
  });
  await enterAgents(page);
  return { ctx, page, label, who };
}

/** Land on the agent builder, the way the profile menu's row does. */
async function enterAgents(page) {
  await page.goto(`${site.origin}/index.html`, { waitUntil: "load" });
  await page.waitForFunction(() => typeof window.showView === "function" && window.Auth);
  await page.evaluate(() => {
    document.getElementById("marketing")?.style.setProperty("display", "none");
    enterApp();
    showView("agents");
  });
  await page.waitForSelector("#viewAgents", { timeout: 10_000 });
  // The list is a fetch; wait for it to have settled into one of its three states.
  await page.waitForFunction(() => {
    const v = document.getElementById("viewAgents");
    return v && !/Loading/.test(v.textContent || "");
  }, { timeout: 10_000 });
}

/**
 * Open one agent's CONVERSATION, which is the only screen its four doors are on.
 *
 * ⚠ **THE PENCIL, THE AUTOMATIONS, THE CONNECTED ACCOUNTS AND "WHAT IT KNOWS" ARE ALL
 * DRAWN INSIDE THE THREAD** — read off `chat.js` rather than assumed, after a first draft
 * pressed `agent-knows` on the LIST and timed out on a control that is not there. So a
 * journey that configures an agent goes through the row, exactly as a person does.
 */
async function openAgent(page, id) {
  // ⚠ THE FORM STAYS OPEN AFTER A SAVE — deliberately, and recorded: it says "Saved." where
  // the button is and a create becomes an edit of what it just made. So the list is not on
  // screen, and `Back` is how a person gets to it. Pressed only when a form is really open,
  // because a Back from the list is a control that is not there.
  if (await has(page, '[data-act="agent-cancel"]')) {
    await press(page, "agent-cancel");
    await page.waitForFunction(() => !document.getElementById("agName"), { timeout: 10_000 });
  }
  await press(page, "agent-open", "id", id);
  await page.waitForSelector("#agMsg", { timeout: 10_000 });
}

const sel = (act, attr, val) => attr ? `[data-act="${act}"][data-${attr}="${val}"]` : `[data-act="${act}"]`;
/** Press a control by the name the markup gives it, never by position. */
const press = async (page, act, attr, val) => {
  const s = sel(act, attr, val);
  await page.waitForSelector(s, { timeout: 10_000 });
  await page.click(s);
};
/** Type into a control, the way a person does — so every input hook really fires. */
const type = async (page, id, value) => {
  const s = `#${id}`;
  await page.waitForSelector(s, { timeout: 10_000 });
  await page.fill(s, "");
  if (value) await page.type(s, value, { delay: 1 });
};
/**
 * Fill the fields of one step in the form, by the names the step catalog gives them —
 * never by position inside the row, and `<select>` through `selectOption` because a choice
 * field is a real select and typing into one does nothing.
 */
async function setStep(page, at, fields) {
  for (const [name, value] of Object.entries(fields)) {
    // ⚠ A LOCATOR RATHER THAN AN ELEMENT HANDLE, and the reason is the form being right.
    // `renderAgents` rebuilds from `innerHTML`, and choosing a value in a gated `<select>` is
    // a STRUCTURAL change — so a handle taken before a fill is detached by the redraw after
    // it. A locator resolves at the moment it is used. The first draft used handles and died
    // with "Element is not attached to the DOM" on the second field of the second step.
    const el = page.locator(".ag-step").nth(at).locator(`[data-field="${name}"]`);
    await el.waitFor({ timeout: 10_000 });
    const tag = await el.evaluate((e) => e.tagName.toLowerCase());
    if (tag === "select") await el.selectOption(String(value));
    else await el.fill(String(value));
  }
}

/** Add a step of one type, and answer for it. Appended, which is what the form does. */
async function addStep(page, type, fields = {}) {
  const before = (await page.$$(".ag-step")).length;
  await press(page, "agent-auto-step-add", "type", type);
  await page.waitForFunction((n) => document.querySelectorAll(".ag-step").length === n + 1, before, { timeout: 10_000 });
  if (Object.keys(fields).length) await setStep(page, before, fields);
}

/**
 * Retype the automation's name box. A thin name over `type` so journey 5's two sessions read
 * the same way as the sentence describing them.
 */
const page5Name = (page, name) => type(page, "agAutoName", name);

/** One automation of this account, found BY NAME from the server rather than by position. */
const autoNamed = (page, agent, name) => page.evaluate(async ([a, n]) => {
  const r = await fetch("/api/agent/automations?agent=" + a, { headers: { authorization: "Bearer " + (await Auth.accessToken()) } });
  return ((await r.json()).automations || []).find((x) => x.name === n) ?? null;
}, [agent, name]);
const autoIdNamed = async (page, agent, name) => (await autoNamed(page, agent, name))?.id ?? null;

/** One automation's executions, as the screen's own history route answers them. */
const page5Runs = (page, id) => page.evaluate(async (a) => {
  const r = await fetch("/api/agent/automation-history?id=" + a, { headers: { authorization: "Bearer " + (await Auth.accessToken()) } });
  return (await r.json()).executions || [];
}, id);

/** A remembered fact's own row, found by the name the markup puts in `data-key`. */
const memRow = (name) => `.ag-auto:has([data-act="agent-mem-delete"][data-key="${name}"])`;
const memValue = (page, name) =>
  page.$eval(`${memRow(name)} .ag-auto-s`, (el) => el.textContent || "").catch(() => null);
const memHas = async (page, name, value) => (await memValue(page, name)) === value;

/** The account's first agent, asked of the SERVER — so a journey can be run on its own. */
const firstAgent = (page) => page.evaluate(async () => {
  const r = await fetch("/api/agent/list", { headers: { authorization: "Bearer " + (await Auth.accessToken()) } });
  return (await r.json())?.agents?.[0]?.id ?? null;
});

const text = (page, s = "#viewAgents") => page.$eval(s, (el) => el.textContent || "").catch(() => "");

/**
 * Wait for the panel to say something, and **on a timeout say what it DOES say.**
 * `waitForFunction`'s own message is "Timeout 30000ms exceeded" and a line number, which is a
 * failure that cannot name itself — this repository's own most-recorded instrument fault.
 */
async function waitText(page, pattern, what, ms = 20_000) {
  try {
    await page.waitForFunction(
      (src) => new RegExp(src).test(document.getElementById("viewAgents")?.textContent || ""),
      pattern.source, { timeout: ms });
  } catch {
    const said = (await text(page)).replace(/\s+/g, " ").slice(0, 600);
    throw new Error(`waiting for ${what} (${pattern}) — the screen says: ${said}`);
  }
}
const has = async (page, s) => !!(await page.$(s));

/**
 * Leave the automation FORM, so the list below it is on screen.
 *
 * ⚠ **THE FORM STAYS OPEN AFTER A SAVE** — deliberately, and recorded in the site's own
 * notes: it says "Saved." where the button is and a create becomes an edit of what it just
 * made. So nothing under it is drawn, and a journey that saves an automation and then wants
 * its ROW has to close the form exactly as a person does. Pressed only when a form is
 * really open, because Cancel is not a control the list has.
 */
async function closeAutoForm(page) {
  if (!(await has(page, '[data-act="agent-auto-cancel"]'))) return;
  await press(page, "agent-auto-cancel");
  await page.waitForFunction(() => !document.getElementById("agAutoName"), { timeout: 10_000 });
}

/** One automation's own row, found by the id the markup puts on its buttons. */
const autoRow = (id) => `.ag-auto:has([data-act="agent-auto-history"][data-id="${id}"])`;

/**
 * Open one automation's execution history, the way a person does.
 *
 * ⚠ **THE ROW IS A TOGGLE** — `agentAutoHistory` closes the panel on a second press — so
 * this asks whether THIS automation's panel is already drawn rather than pressing blind and
 * closing what it wanted. Scoped to the row, not to `.ag-auto-runs` anywhere on the page: a
 * journey that has made more than one automation would otherwise read a neighbour's panel
 * as this one's and press nothing.
 */
/**
 * Wait for the SITE's ring to reach the engine, which is the press having really landed.
 *
 * ⚠ **A DECISION DOES NOT CHANGE THE EXECUTION'S STATE BY ITSELF, and a first draft waited for
 * one as though it did.** `agent.decide_automation_approval` records the verdict and calls
 * `requeue_run`; the row still reads `waiting` until a DELIVERY picks it up and the workflow
 * moves past the step. So the honest signal after pressing Approve is the doorbell — which also
 * asserts the route really rang rather than leaving the work for the next cron tick.
 */
const waitRung = async (n = 1, ms = 20_000) => {
  const until = Date.now() + ms;
  while (disp.rung.length < n) {
    if (Date.now() > until) throw new Error(`the doorbell never rang (${disp.rung.length} of ${n})`);
    await new Promise((r) => setTimeout(r, 50));
  }
};

/**
 * Open one automation's EDIT form, which needs the list on screen to press Edit from.
 *
 * ⚠ **THE SAVE LEAVES THE FORM OPEN**, so a journey that saves and then edits something has to
 * close it first, exactly as a person does — and a first draft of journey 5 timed out on an
 * Edit button that was not there because the create's own form was still up.
 */
async function openEdit(page, id) {
  await closeAutoForm(page);
  await press(page, "agent-auto-edit", "id", id);
  await page.waitForSelector("#agAutoName", { timeout: 10_000 });
}

/** Close and re-open one automation's history, which is how a person re-reads it. */
async function refreshHistory(page, id) {
  if (await has(page, `${autoRow(id)} .ag-auto-runs`)) {
    await press(page, "agent-auto-history", "id", id);
    await page.waitForFunction((s) => !document.querySelector(s), `${autoRow(id)} .ag-auto-runs`, { timeout: 10_000 });
  }
  await openHistory(page, id);
}

async function openHistory(page, id) {
  await closeAutoForm(page);
  if (!(await has(page, `${autoRow(id)} .ag-auto-runs`))) await press(page, "agent-auto-history", "id", id);
  await page.waitForSelector(`${autoRow(id)} .ag-auto-runs`, { timeout: 10_000 });
}
const shot = async (page, name) => {
  const el = await page.$("#viewAgents");
  await (el ?? page).screenshot({ path: path.join(shotDir, `${name}.png`) });
};

try {
  console.log(SIMULATED);
  console.log(`  site on ${site.origin}   database ${DB}   chromium ${CHROME.split("/").slice(-3)[0]}`);

  // ════════════════════════════════════════════════════════════════════════════
  // JOURNEY 1 — create an agent, configure every part of it, reload, read it back
  // ════════════════════════════════════════════════════════════════════════════
  let agentId = null;
  if (want(1)) {
    head("JOURNEY 1 — create and configure an agent, then reload");
    const { page } = await openApp(A, "J1");

    check("1a. the agent builder opened with nothing in it", /No agents yet|Nothing here yet|no agents/i.test(await text(page)) || !(await has(page, "[data-act=\"agent-open\"]")),
      (await text(page)).slice(0, 60).replace(/\s+/g, " "));

    await press(page, "agent-new");
    await page.waitForSelector("#agName");
    await type(page, "agName", "Bike shop");
    await type(page, "agInstr", "Answer questions about the workshop. Keep it short.");
    await type(page, "agZone", ZONE);
    // PERMISSIONS: tick the tools by the catalog's own names, off the form it drew.
    const tools = await page.$$eval("#viewAgents input[type=checkbox][data-tool]", (els) => els.map((e) => e.dataset.tool));
    check("1b. the form drew the server's tool catalog", tools.length > 0, `${tools.length} offered`);
    for (const t of ["search_reference", "remember"]) {
      if (tools.includes(t)) await page.check(`#viewAgents input[data-tool="${t}"]`);
    }
    await press(page, "agent-save");
    await page.waitForFunction(() => /Saved\./.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    check("1c. it saved and said so", /Saved\./.test(await text(page)));

    const listed = await page.evaluate(async () => {
      const r = await fetch("/api/agent/list", { headers: { authorization: "Bearer " + (await Auth.accessToken()) } });
      return r.json();
    });
    agentId = listed?.agents?.[0]?.id ?? null;
    check("1d. the account has exactly one agent, from the server", listed?.agents?.length === 1, String(listed?.agents?.length));

    // REFERENCE MATERIAL and MEMORY, both on the "what it knows" screen — which is
    // reached from inside the conversation, the way a person reaches it.
    await openAgent(page, agentId);
    await press(page, "agent-knows", "id", agentId);
    await page.waitForFunction(() => /What it knows|reference/i.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    await press(page, "agent-know-new");
    await page.waitForSelector("#agKnowTitle");
    await type(page, "agKnowTitle", "Price list");
    await type(page, "agKnowBody", "A service is 95 pounds including parts. A puncture is 12 pounds.");
    await press(page, "agent-know-save");
    await page.waitForFunction(() => /Price list/.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    check("1e. a source was saved and is listed", /Price list/.test(await text(page)));

    await type(page, "agMemName", "tone");
    await type(page, "agMemValue", "formal");
    await press(page, "agent-mem-save");
    // ⚠ READ OFF THE ROW, NEVER OFF THE PANEL. `agMemName`'s placeholder is "tone" and
    // `agMemValue`'s is "formal", so a needle over the panel's text matches whether or not
    // anything was ever saved — which is exactly what the first draft of this check did, and
    // it was green over a memory that had not arrived. The row carries its own name in
    // `data-key` and its value in `.ag-auto-s`.
    await page.waitForSelector(memRow("tone"), { timeout: 10_000 });
    check("1f. a memory was saved and is listed as its own row", await memHas(page, "tone", "formal"),
      JSON.stringify(await memValue(page, "tone")));
    await shot(page, "j1-configured");

    // ⚠ THE RELOAD IS THE POINT: a fresh page, a fresh script, nothing in memory.
    await enterAgents(page);
    await openAgent(page, agentId);
    await press(page, "agent-edit", "id", agentId);
    await page.waitForSelector("#agName");
    const back = await page.evaluate(() => ({
      name: document.getElementById("agName")?.value,
      instr: document.getElementById("agInstr")?.value,
      zone: document.getElementById("agZone")?.value,
      paused: !!document.getElementById("agPaused")?.checked,
      ticked: [...document.querySelectorAll("#viewAgents input[type=checkbox][data-tool]")].filter((e) => e.checked).map((e) => e.dataset.tool),
    }));
    check("1g. ⚠ AFTER A RELOAD the name is still there", back.name === "Bike shop", JSON.stringify(back.name));
    check("1h. ...and the instructions", /workshop/.test(back.instr || ""), JSON.stringify((back.instr || "").slice(0, 40)));
    check("1i. ...and the TIME ZONE, which only this form can set", back.zone === ZONE, JSON.stringify(back.zone));
    check("1j. ...and the permissions, exactly the two that were ticked",
      back.ticked.length === 2 && back.ticked.includes("search_reference") && back.ticked.includes("remember"), JSON.stringify(back.ticked));
    check("1k. ...and it is not paused, which nobody asked for", back.paused === false);

    await press(page, "agent-cancel");
    await page.waitForSelector("#agMsg", { timeout: 10_000 });
    await press(page, "agent-knows", "id", agentId);
    await page.waitForFunction(() => /Price list/.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    const knows = await text(page);
    check("1l. ...and the reference material survived the reload", /Price list/.test(knows));
    check("1m. ...and the memory did too, read off its own row", await memHas(page, "tone", "formal"),
      JSON.stringify(await memValue(page, "tone")));
    check("1n. no page error anywhere in journey 1", pageProblems.length === 0, pageProblems.slice(0, 2).join(" | "));
    check("1o. ...and no /api/agent/ call this journey's own session made was refused",
      refusedIn("J1").length === 0,
      refusedIn("J1").slice(0, 3).map((r) => `${r.status} ${r.url}`).join(" | "));
    check("1p. ...and nothing else 404d either, beyond what this harness declines to serve",
      unexpected404s().length === 0, unexpected404s().slice(0, 3).map((r) => `${r.status} ${r.url}`).join(" | "));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // JOURNEY 2 — connect an account, build the worked example, run it, approve the
  //             exact message, and read the fake provider's own mailbox
  // ════════════════════════════════════════════════════════════════════════════
  let connId = null;
  if (want(2)) {
    head("JOURNEY 2 — a useful workflow, from the example, through the fake provider");
    const { page } = await openApp(A, "J2");
    agentId = agentId ?? (await firstAgent(page));
    check("2-pre. there is an agent to work on", !!agentId, String(agentId));
    await openAgent(page, agentId);

    // ── CONNECT AN ACCOUNT, on the screen, with the permissions a person grants ──
    await press(page, "agent-connections", "id", agentId);
    await page.waitForSelector("[data-act=\"agent-conn-new\"]", { timeout: 10_000 });
    await press(page, "agent-conn-new");
    await page.waitForSelector("#agConnForm", { timeout: 10_000 });
    await page.fill('#agConnForm [data-field="account"]', ACCOUNT);
    await page.fill('#agConnForm [data-field="label"]', "The shop");
    await page.check('#agConnForm input[data-scope="read"]');
    await page.check('#agConnForm input[data-scope="send"]');
    await press(page, "agent-conn-save");
    await page.waitForSelector('[data-act="agent-conn-off"]', { timeout: 10_000 });
    connId = await page.getAttribute('[data-act="agent-conn-off"]', "data-id");
    const connPanel = await text(page);
    check("2a. the account is connected, with the two permissions the person ticked",
      connPanel.includes(ACCOUNT) && /Can: read · send/.test(connPanel),
      (connPanel.match(/Can: [^\n]{0,30}/) || [""])[0]);
    // ⚠ NOTHING THAT LOOKS LIKE A CREDENTIAL IS ANYWHERE ON THE SCREEN. The platform mints
    // it, keeps it and never answers it, so a long hex run in this panel would be one having
    // escaped — which is the one thing this whole surface is built to make impossible.
    check("2b. ...and no credential is on the screen", !/[0-9a-f]{32,}/i.test(connPanel),
      (connPanel.match(/[0-9a-f]{32,}/i) || [""])[0]);

    // ── THE WORKED EXAMPLE, seeded into the form a person edits ──────────────
    await press(page, "agent-conn-back");
    await page.waitForSelector("#agMsg", { timeout: 10_000 });
    await press(page, "agent-automations", "id", agentId);
    await page.waitForSelector('[data-act="agent-auto-example"]', { timeout: 10_000 });
    await press(page, "agent-auto-example");
    await page.waitForSelector("#agAutoName", { timeout: 10_000 });
    const seeded = await page.evaluate(() => ({
      name: document.getElementById("agAutoName")?.value,
      steps: [...document.querySelectorAll(".ag-step")].map((e) => e.dataset.stepType),
      asks: [...document.querySelectorAll('[data-field="input-name"], [data-input-name]')].length,
      conn: document.querySelector('.ag-step [data-field="connection"]')?.value ?? null,
    }));
    check("2c. the example seeded the form with its own steps", seeded.steps.join(",") === "knowledge,note,send",
      seeded.steps.join(","));
    check("2d. ⚠ ...and the connection is the account this person just connected",
      seeded.conn === connId, `${seeded.conn} vs ${connId}`);
    await press(page, "agent-auto-save");
    await page.waitForFunction(() => /Saved\./.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    check("2e. it saved from the form unedited", /Saved\./.test(await text(page)));

    // ── RUN IT, answering the inputs it declares ─────────────────────────────
    // ⚠ `agent-auto-cancel` IS THE FORM'S OWN Back and `agent-auto-back` IS THE SCREEN'S —
    // read off `chat.js`, after a first draft pressed the second and landed in the thread.
    await press(page, "agent-auto-cancel");
    await page.waitForSelector('[data-act="agent-auto-run"]', { timeout: 10_000 });
    const autoId = await page.getAttribute('[data-act="agent-auto-run"]', "data-id");
    await press(page, "agent-auto-run", "id", autoId);
    await page.waitForSelector('[data-ask="who"]', { timeout: 10_000 });
    check("2f. Run now asked for the inputs the example declares",
      (await has(page, '[data-ask="who"]')) && (await has(page, '[data-ask="topic"]')));
    await page.fill('[data-ask="who"]', RECIPIENT);
    await page.fill('[data-ask="topic"]', "service");
    await press(page, "agent-auto-ask-go");

    // The site route rang the queue; nothing here runs a consumer, so this is the engine.
    await waitText(page, /Queued|Running|Waiting/, "the run to appear in the history", 10_000);
    await disp.drain();
    await waitText(page, /Waiting/, "the execution to hold for a person");
    const waitingPanel = await text(page);
    check("2g. ⚠ it is WAITING for a person rather than reading as working",
      /Waiting/.test(waitingPanel) && !/^Done/.test(waitingPanel));
    check("2h. ...and nothing is in the provider's mailbox while it waits",
      mailbox(ACCOUNT).length === 0, String(mailbox(ACCOUNT).length));

    // ⚠ WHAT THE PERSON IS SHOWN, read off the screen rather than composed here.
    const shownAsk = await page.$eval(".ag-run-wait .ag-run-why", (el) => el.textContent || "").catch(() => "");
    check("2i. ⚠ the screen names the recipient and the account it would send from",
      shownAsk.includes(RECIPIENT) && shownAsk.includes(ACCOUNT), JSON.stringify(shownAsk.slice(0, 90)));
    await shot(page, "j2-waiting");

    // ── APPROVE IT, and only then does anything go ───────────────────────────
    const runId = await page.getAttribute('[data-act="agent-auto-approve"]', "data-run");
    await page.fill(`[data-note="${runId}"]`, "looks right");
    await press(page, "agent-auto-approve", "run", runId);
    await page.waitForFunction(() => !/Sending…/.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    await disp.drain();
    await waitText(page, /Done/, "the execution to finish");

    const box = mailbox(ACCOUNT);
    check("2j. ⚠ EXACTLY ONE message reached the fake provider's mailbox", box.length === 1, String(box.length));
    check("2k. ⚠ ...and its RECIPIENT is the one the screen showed before the approval",
      box[0]?.to === RECIPIENT, JSON.stringify(box[0]?.to));
    // The prepared body is on the send step's own outcome, which is where a person reads it.
    const prepared = await page.$eval(".ag-step-msg", (el) => el.textContent || "").catch(() => "");
    check("2l. ⚠ ...and its BODY is character for character what the screen shows as prepared",
      !!box[0]?.body && prepared.includes(box[0].body), JSON.stringify((prepared || "").slice(0, 80)));
    check("2m. ...and the message really used the reference material this person saved",
      /95/.test(box[0]?.body || ""), JSON.stringify((box[0]?.body || "").slice(0, 90)));
    const donePanel = await text(page);
    check("2n. the history says which steps ran and that the send is simulated",
      /knowledge|Look something up|Use what it knows/i.test(donePanel) && /simulated/i.test(donePanel));
    // ⚠ **THE OUTCOME IS WHAT THE HISTORY SHOWS, AND THE NOTE IS NOT — recorded rather than
    // asserted away.** A send's approval is a TOOL approval, so the words a person typed here
    // are stored on the REQUEST (`agent.tool_approvals.decided_note`) and the execution's own
    // `decisions` map — which is what this screen draws — never holds them. So a person's note
    // on a send is written and shown back nowhere. The first draft of this check demanded it
    // and was red about a screen doing what it was built to do.
    check("2o. ...and the send step's own outcome says what went where",
      /sent to ada@example\.test/.test(donePanel), (donePanel.match(/sent to [^\n]{0,50}/) || [""])[0]);
    await shot(page, "j2-sent");

    // ══════════════════════════════════════════════════════════════════════════
    // AND THE FULLER WORKFLOW THE MILESTONE NAMES — inputs → reference material →
    // memory → branch → approval → send — built step by step on the real form.
    // ══════════════════════════════════════════════════════════════════════════
    await press(page, "agent-auto-new");
    await page.waitForSelector("#agAutoName", { timeout: 10_000 });
    await type(page, "agAutoName", "Reply in the shop's own voice");
    const asks = [["who", "Who it is for"], ["topic", "What they asked about"]];
    for (let i = 0; i < asks.length; i++) {
      await press(page, "agent-auto-input-add");
      await page.waitForFunction((n) => document.querySelectorAll(".ag-auto-in").length === n, i + 1, { timeout: 10_000 });
      const row = `[data-input-row="${i}"]`;
      await page.fill(`${row} [data-in="name"]`, asks[i][0]);
      await page.fill(`${row} [data-in="label"]`, asks[i][1]);
      await page.check(`${row} [data-in="required"]`);
    }
    // ⚠ BOTH ARMS BIND `reply`, because only what both produce survives the rejoin — so a
    // workflow whose `send` reads `{{reply}}` after the `end` is one the validator accepts.
    await addStep(page, "memory", { key: "tone", out: "tone" });
    await addStep(page, "knowledge", { query: "{{topic}}", out: "facts" });
    await addStep(page, "if", { left: "{{tone}}", op: "is", right: "formal" });
    await addStep(page, "note", { text: FORMAL, out: "reply" });
    await addStep(page, "otherwise");
    await addStep(page, "note", { text: CASUAL, out: "reply" });
    await addStep(page, "end");
    await addStep(page, "send", { connection: connId, to: "{{who}}", body: "{{reply}}" });
    check("2r. eight steps are on the form, in the order they were added",
      (await page.$$eval(".ag-step", (els) => els.map((e) => e.dataset.stepType).join(","))) ===
        "memory,knowledge,if,note,otherwise,note,end,send",
      await page.$$eval(".ag-step", (els) => els.map((e) => e.dataset.stepType).join(",")));

    // ── READ IT THROUGH BEFORE SAVING, which is the Check button's whole job ──
    await press(page, "agent-auto-check");
    await page.waitForFunction(() => /Nothing is missing|has to be in place|couldn|needs a change/i.test(
      document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    const checked = await text(page);
    check("2s. ⚠ Check read the branch through and found nothing wrong with it",
      !/needs a change/i.test(checked), (checked.match(/Step \d+ needs a change/i) || [""])[0]);

    await press(page, "agent-auto-save");
    await page.waitForFunction(() => /Saved\./.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    check("2t. ...and the validator accepted a branch built on the screen", /Saved\./.test(await text(page)));

    await press(page, "agent-auto-cancel");
    await page.waitForSelector('[data-act="agent-auto-run"]', { timeout: 10_000 });
    // ⚠ BY NAME, NOT BY POSITION — there are two automations now and nothing here decides
    // which order the list draws them in.
    const voiceId = await page.evaluate(async (agent) => {
      const r = await fetch("/api/agent/automations?agent=" + agent, { headers: { authorization: "Bearer " + (await Auth.accessToken()) } });
      const rows = (await r.json()).automations || [];
      return (rows.find((a) => a.name === "Reply in the shop's own voice") || {}).id ?? null;
    }, agentId);
    check("2t2. the automation just built is on the account, found by its name", !!voiceId, String(voiceId));
    await press(page, "agent-auto-run", "id", voiceId);
    await page.waitForSelector('[data-ask="who"]', { timeout: 10_000 });
    await page.fill('[data-ask="who"]', RECIPIENT);
    await page.fill('[data-ask="topic"]', "puncture");
    await press(page, "agent-auto-ask-go");
    // ⚠ WAIT FOR THE RUN TO BE THERE BEFORE DRAINING. `press` returns when the click is
    // dispatched, not when the request has landed — so a drain straight after it finds an
    // empty doorbell and the execution sits on `Queued` for ever. Measured: that is exactly
    // what the first draft did, and the screen said `Queued` while the wait timed out.
    await waitText(page, /Queued|Running|Waiting/, "the branch run to appear in the history", 10_000);
    await disp.drain();
    await waitText(page, /Waiting/, "the branch workflow to hold for a person");
    const runId2 = await page.getAttribute('[data-act="agent-auto-approve"]', "data-run");
    await press(page, "agent-auto-approve", "run", runId2);
    await page.waitForFunction(() => !/Sending…/.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    await disp.drain();
    await waitText(page, /Done/, "the branch workflow to finish");

    const box2 = mailbox(ACCOUNT);
    check("2u. ⚠ a second message went, and only one more", box2.length === 2, String(box2.length));
    // ⚠ WHICH ARM RAN IS READ OFF THE MESSAGE, not off the history's word for it — the memory
    // this person saved in journey 1 says `formal`, so the formal arm is the one that must have
    // bound `reply`, and the OTHER arm's words must be nowhere near it.
    check("2v. ⚠ ...and the branch took the arm the remembered fact chose",
      (box2[1]?.body || "").startsWith("Dear ") && !/^Hi /.test(box2[1]?.body || ""),
      JSON.stringify((box2[1]?.body || "").slice(0, 60)));
    check("2w. ...and it quoted the reference material for what was really asked about",
      /puncture/.test(box2[1]?.body || "") && /12/.test(box2[1]?.body || ""),
      JSON.stringify((box2[1]?.body || "").slice(0, 110)));
    const voicePanel = await text(page);
    check("2x. ...and the history says which arm it took and that the other was skipped",
      /first arm/.test(voicePanel) && /skipped/.test(voicePanel),
      (voicePanel.match(/(first arm|other arm)/) || [""])[0]);
    await shot(page, "j2-branch-sent");

    // ═════════════════════════════════════════════════════════════════════════
    // ⚠ THE WORDS ARE READ OFF THE APPROVAL SCREEN **BEFORE** ANYBODY PRESSES APPROVE
    //
    // Every check above this compares the mailbox with what the history shows AFTERWARDS —
    // and that could not tell "the person approved these words" from "the platform sent
    // something and later drew it". The defect was real: the screen offered Approve showing
    // the sender and the recipient out of the pause's own sentence and **not one word of the
    // message**. So this captures the account, the recipient and the body from the waiting
    // panel, proves nothing has gone, and only then approves and compares.
    //
    // ⚠ **AND THE WORKFLOW HAS NO `note` STEP, deliberately.** The two above it both bind
    // their message with a note, whose text is on the form and whose outcome is drawn in the
    // finished history — so a body found on screen could have come from either, and the check
    // would pass with the payload never drawn at all. Here the body is the send's OWN field
    // and the only place its resolved form exists is the approval request.
    // ═════════════════════════════════════════════════════════════════════════
    await closeAutoForm(page);
    await press(page, "agent-auto-new");
    await page.waitForSelector("#agAutoName", { timeout: 10_000 });
    await type(page, "agAutoName", "Quote straight out, no note step");
    for (let i = 0; i < 2; i++) {
      await press(page, "agent-auto-input-add");
      await page.waitForFunction((n) => document.querySelectorAll(".ag-auto-in").length === n, i + 1, { timeout: 10_000 });
      const row = `[data-input-row="${i}"]`;
      await page.fill(`${row} [data-in="name"]`, ["who", "topic"][i]);
      await page.fill(`${row} [data-in="label"]`, ["Who it is for", "What they asked about"][i]);
      await page.check(`${row} [data-in="required"]`);
    }
    await addStep(page, "memory", { key: "tone", out: "tone" });
    await addStep(page, "knowledge", { query: "{{topic}}", out: "facts" });
    // ⚠ THE BODY IS THE SEND'S OWN FIELD AND CARRIES ALL THREE KINDS OF SUBSTITUTION — an
    // INPUT somebody typed, a remembered FACT and the REFERENCE MATERIAL — so what appears on
    // the approval screen is either the resolved message or it is nothing.
    // ⚠ **`{{topic}}` IS IN IT SO THE TWO RUNS' PAYLOADS REALLY DIFFER.** The reference
    // material answers the whole price list whichever topic is asked, so without the topic in
    // the body both runs read identically and the check below claiming to be "about what was
    // asked this time" would be satisfied by the first run's words — an assertion that cannot
    // fail. The first draft of this had exactly that, and it passed.
    const QUOTE = "Quote for {{who}} about {{topic}} — {{facts}} — tone: {{tone}} (scripted, not written by a model)";
    await addStep(page, "send", { connection: connId, to: "{{who}}", body: QUOTE });
    const bare = await page.$$eval(".ag-step", (els) => els.map((e) => e.dataset.stepType).join(","));
    check("2y. ⚠ the workflow is memory → reference material → send, with NO note step to show a body",
      bare === "memory,knowledge,send", bare);
    await press(page, "agent-auto-save");
    await page.waitForFunction(() => /Saved\./.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    const quoteId = await autoIdNamed(page, agentId, "Quote straight out, no note step");
    check("2z. it saved, and is on the account under its own name", !!quoteId, String(quoteId));

    /** Run it, and hold at the approval. Used twice: once to approve, once to reject. */
    const holdAtApproval = async (topic) => {
      await closeAutoForm(page);
      await press(page, "agent-auto-run", "id", quoteId);
      await page.waitForSelector('[data-ask="who"]', { timeout: 10_000 });
      await page.fill('[data-ask="who"]', RECIPIENT);
      await page.fill('[data-ask="topic"]', topic);
      await press(page, "agent-auto-ask-go");
      await waitText(page, /Queued|Running|Waiting/, "the quote run to appear in the history", 10_000);
      await disp.drain();
      await waitText(page, /Waiting/, "the quote workflow to hold for a person");
    };
    /**
     * WHAT THE PERSON IS SHOWN, read off the argument list the approval panel draws.
     *
     * ⚠ **OFF THE LIST AND NOT OFF THE PANEL**, because the pause's sentence above it names
     * the recipient and the account too — so a search over the whole panel would find that
     * sentence's copy and report the payload as present when it is not drawn at all.
     */
    const shownPayload = (pg) => pg.evaluate(() => {
      const ul = document.querySelector(".ag-run-wait .ag-ap-args");
      if (!ul) return null;
      const out = {};
      for (const li of ul.querySelectorAll("li")) {
        const k = li.querySelector(".ag-ap-k")?.textContent ?? "";
        const v = li.querySelector(".ag-ap-v")?.textContent ?? "";
        if (k) out[k] = v;
      }
      return out;
    });

    await holdAtApproval("service");
    const before = mailbox(ACCOUNT).length;
    const shown = await shownPayload(page);
    check("2aa. ⚠ THE MESSAGE IS ON THE APPROVAL SCREEN, with the account and the recipient",
      !!shown && !!shown.body && shown.account === ACCOUNT && shown.to === RECIPIENT,
      JSON.stringify(shown).slice(0, 160));
    check("2ab. ⚠ ...and it is the RESOLVED message — the input, the remembered fact and the material",
      !!shown?.body && shown.body.includes(`Quote for ${RECIPIENT} about service —`)
        && /tone: formal/.test(shown.body) && /95/.test(shown.body),
      JSON.stringify((shown?.body || "").slice(0, 140)));
    check("2ac. ⚠ ...with no template left in it, so nothing unresolved is being approved",
      !!shown?.body && !/\{\{/.test(shown.body), JSON.stringify((shown?.body || "").slice(0, 140)));
    /**
     * ⚠ **AND NOTHING ELSE ON THE SCREEN COULD BE SHOWING IT**, which is what makes the three
     * checks above about the payload rather than about the panel happening to contain a string.
     * `.ag-step-msg` is the send step's own outcome and is drawn only once it has SENT.
     */
    // ⚠ THE DETAIL IS THE READING AND NOT THE FAILURE SENTENCE: `check` prints it either way,
    // so a sentence describing the bad outcome reads on a PASS as though it had happened.
    check("2ad. ⚠ ...and the sent-message element is nowhere on screen, because nothing has sent",
      !(await has(page, ".ag-step-msg")),
      `.ag-step-msg present: ${await has(page, ".ag-step-msg")}`);
    check("2ae. ...and the provider's mailbox has not grown", mailbox(ACCOUNT).length === before,
      `${mailbox(ACCOUNT).length} vs ${before}`);
    await shot(page, "j2-payload-before-approve");

    // ── A RELOAD WHILE IT WAITS SHOWS THE SAME WORDS ────────────────────────
    // The browser holds no state about a run, so this is an ordinary read of a conversation
    // that happens to have work in it — and the payload comes from the persisted request, so
    // a reload that lost it would mean the screen had been drawing something it had cached.
    await enterAgents(page);
    await openAgent(page, agentId);
    await press(page, "agent-automations", "id", agentId);
    await page.waitForSelector('[data-act="agent-auto-history"]', { timeout: 10_000 });
    await press(page, "agent-auto-history", "id", quoteId);
    await waitText(page, /Waiting/, "the reloaded screen to show the waiting run");
    const again = await shownPayload(page);
    check("2af. ⚠ A RELOAD WHILE IT WAITS SHOWS THE SAME PAYLOAD, character for character",
      !!again && again.body === shown?.body && again.to === shown?.to && again.account === shown?.account,
      JSON.stringify(again).slice(0, 160));
    await shot(page, "j2-payload-after-reload");

    // ── APPROVE, AND COMPARE THE MAILBOX WITH WHAT WAS ON SCREEN ─────────────
    const quoteRun = await page.getAttribute('[data-act="agent-auto-approve"]', "data-run");
    await press(page, "agent-auto-approve", "run", quoteRun);
    await page.waitForFunction(() => !/Sending…/.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    await disp.drain();
    await waitText(page, /Done/, "the quote workflow to finish");
    const box3 = mailbox(ACCOUNT);
    check("2ag. ⚠ one more message went, and only one", box3.length === before + 1, `${box3.length} vs ${before + 1}`);
    check("2ah. ⚠ ITS RECIPIENT IS EXACTLY WHAT WAS ON THE APPROVAL SCREEN",
      box3[box3.length - 1]?.to === shown?.to, JSON.stringify(box3[box3.length - 1]?.to));
    check("2ai. ⚠ ITS BODY IS EXACTLY WHAT WAS ON THE APPROVAL SCREEN, character for character",
      box3[box3.length - 1]?.body === shown?.body,
      JSON.stringify((box3[box3.length - 1]?.body || "").slice(0, 140)));
    await shot(page, "j2-payload-sent");

    // ── AND A REFUSAL SENDS NOTHING, on a run whose words were read the same way ────
    await holdAtApproval("puncture");
    const held = await shownPayload(page);
    // ⚠ **AND IT IS THIS RUN'S WORDS RATHER THAN THE LAST RUN'S.** Asserted as the topic the
    // person typed AND as being DIFFERENT from what the approved run showed — without the second
    // half, a screen drawing a cached payload from the previous approval satisfies the first.
    check("2aj. the second run's message is on screen too, and is about what was asked THIS time",
      !!held?.body && held.body.includes(`Quote for ${RECIPIENT} about puncture —`)
        && held.body !== shown?.body,
      JSON.stringify((held?.body || "").slice(0, 140)));

    /**
     * ⚠ **THE ACCOUNT NEXT DOOR CANNOT READ THE PENDING PAYLOAD AND CANNOT APPROVE IT**, asked
     * of the routes from a session holding B's own token. **NOT FOUND, NEVER FORBIDDEN**: the
     * tenant is inside the locked lookup, so another account's request and one that does not
     * exist answer identically — "you may not touch that" would tell a stranger the id is real.
     *
     * ⚠ **THE LABEL DELIBERATELY DOES NOT START WITH `J2`.** `refusedIn` matches by prefix and
     * journey 2 asserts it had NO refused calls; these 404s are the point, so they belong to a
     * session of their own rather than to this journey's tally.
     */
    const waitingRuns = await page5Runs(page, quoteId);
    const heldRun = waitingRuns.find((r) => r.state === "waiting");
    const heldReq = heldRun?.waiting?.request ?? null;
    check("2ak. the waiting run names the request its approval is bound to", !!heldReq, String(heldReq));
    const { ctx: nextDoor, page: nd } = await openApp(B, "NEXTDOOR-PAYLOAD");
    const peek = await nd.evaluate(async ([auto, req]) => {
      const tok = "Bearer " + (await Auth.accessToken());
      const h = await fetch("/api/agent/automation-history?id=" + auto, { headers: { authorization: tok } });
      const read = { status: h.status, body: await h.text() };
      const a = await fetch("/api/agent/tool-approve", {
        method: "POST", headers: { authorization: tok, "Content-Type": "application/json" },
        body: JSON.stringify({ id: req, verdict: "approved" }),
      });
      return { read, approve: { status: a.status, body: await a.text() } };
    }, [quoteId, heldReq]);
    await nextDoor.close();
    check("2al. ⚠ the account next door cannot READ the pending payload",
      peek.read.status === 404 && !peek.read.body.includes(held?.body ?? "\u0000"),
      `${peek.read.status} ${peek.read.body.slice(0, 80)}`);
    check("2am. ⚠ ...and cannot APPROVE it either", peek.approve.status === 404,
      `${peek.approve.status} ${peek.approve.body.slice(0, 80)}`);
    check("2an. ⚠ ...and nothing was sent by the attempt", mailbox(ACCOUNT).length === before + 1,
      `${mailbox(ACCOUNT).length} vs ${before + 1}`);

    await press(page, "agent-auto-reject", "run", heldRun.id);
    await page.waitForFunction(() => !/Sending…/.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    await disp.drain();
    await waitText(page, /Rejected|Not approved|rejected/, "the refused run to stop");
    check("2ao. ⚠ A REFUSAL SENT NOTHING", mailbox(ACCOUNT).length === before + 1,
      `${mailbox(ACCOUNT).length} vs ${before + 1}`);
    await shot(page, "j2-payload-rejected");

    check("2p. no page error anywhere in journey 2", pageProblems.length === 0, pageProblems.slice(0, 2).join(" | "));
    check("2q. ...and no /api/agent/ call this journey's own session made was refused",
      refusedIn("J2").length === 0,
      refusedIn("J2").slice(0, 3).map((r) => `${r.status} ${r.url}`).join(" | "));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // JOURNEY 3 — the three ways in: by hand, on a schedule, and from an event.
  //             Plus a duplicate delivery, and turning it off.
  // ════════════════════════════════════════════════════════════════════════════
  if (want(3)) {
    head("JOURNEY 3 — run it by hand, on a schedule, and from an event");
    const { page } = await openApp(A, "J3");
    agentId = agentId ?? (await firstAgent(page));
    await openAgent(page, agentId);
    await press(page, "agent-automations", "id", agentId);
    await page.waitForSelector('[data-act="agent-auto-new"]', { timeout: 10_000 });

    // ── A DAILY SCHEDULE, SET ON THE FORM. One note step, so what is under test is the
    //    trigger rather than an approval.
    await press(page, "agent-auto-new");
    await page.waitForSelector("#agAutoName", { timeout: 10_000 });
    await type(page, "agAutoName", "Morning check");
    await page.selectOption("#agAutoSched", "daily");
    await page.fill("#agAutoAt", "09:00");
    await page.fill("#agAutoZone", ZONE);
    await addStep(page, "note", { text: "the shop opens at nine", out: "opened" });
    await press(page, "agent-auto-save");
    await waitText(page, /Saved\./, "the schedule to save", 10_000);

    const scheduled = await page.evaluate(async (agent) => {
      const r = await fetch("/api/agent/automations?agent=" + agent, { headers: { authorization: "Bearer " + (await Auth.accessToken()) } });
      return ((await r.json()).automations || []).find((a) => a.name === "Morning check") ?? null;
    }, agentId);
    // ⚠ **`HH:MM` ON THE WIRE, NOT `HH:MM:SS`, AND THAT IS THE PRODUCT BEING RIGHT.** The
    // COLUMN holds `09:00:00` — `cleanSchedule` appends the seconds — and `automationRow`
    // slices them off so one shape leaves that file, which is what lets the form's own box
    // and `agent.patch_automation`'s `^HH:MM$` read the same value. My first draft asserted
    // the column's shape and reported a correct round trip as broken; what this asks is the
    // ROUND TRIP, which is the property: what the form put in is what comes back.
    check("3a. a daily schedule saved from the form, with its own zone",
      scheduled?.schedule === "daily" && scheduled?.at === "09:00" && scheduled?.zone === ZONE,
      JSON.stringify({ s: scheduled?.schedule, at: scheduled?.at, z: scheduled?.zone }));
    check("3b. ...and the database armed a next run for it", !!scheduled?.nextRunAt, String(scheduled?.nextRunAt));
    const AU3 = scheduled.id;

    // ⚠ THE CLOCK IS PUSHED, NOT WAITED OUT, and it is the only thing simulated here — a
    // daily schedule is a day away. What it does NOT simulate is the DECISION:
    // `tick_automations` still selects on `next_run_at <= now()` and the instant it moves to
    // is `automation_next_run`'s own arithmetic.
    const due = () => stack.q(`update agent.automations set next_run_at = now() - interval '2 minutes' where id='${AU3}';`);
    due();
    const tick1 = await disp.tick();
    await disp.drain();
    // ⚠ THE SAVE LEFT THE FORM OPEN, so nothing under it is on screen — and the history is a
    // row a person presses rather than a panel that appears. A first draft waited for the
    // word `Scheduled` straight after the tick and timed out on a screen that was showing
    // the FORM, with the execution having run perfectly.
    await openHistory(page, AU3);
    await waitText(page, /Scheduled/, "the scheduled execution to appear", 25_000);
    const runs3 = () => page.evaluate(async (id) => {
      const r = await fetch("/api/agent/automation-history?id=" + id, { headers: { authorization: "Bearer " + (await Auth.accessToken()) } });
      return (await r.json()).executions || [];
    }, AU3);
    let hist3 = await runs3();
    check("3c. ⚠ the REAL cron filed it and it ran", hist3.length === 1 && hist3[0].state === "done",
      JSON.stringify(hist3.map((e) => [e.trigger, e.state])));
    check("3d. ...and the history says it was SCHEDULED rather than pressed", /Scheduled/.test(await text(page)));

    // ── A DUPLICATE DELIVERY OF THE SAME OCCURRENCE IS ONE EXECUTION ──────────
    due();
    await disp.tick();
    await disp.drain();
    hist3 = await runs3();
    check("3e. ⚠ the same occurrence asked for twice is still ONE execution", hist3.length === 1,
      JSON.stringify(hist3.map((e) => [e.trigger, e.occurrence ?? null])));
    // AND A DUPLICATE QUEUE DELIVERY OF THE RUN ITSELF, which the claim is what refuses.
    await disp.ring(hist3[0].id);
    await disp.drain();
    const again = await runs3();
    check("3f. ...and re-ringing the finished run changed nothing",
      again.length === 1 && again[0].state === "done" &&
        JSON.stringify(again[0].outcomes) === JSON.stringify(hist3[0].outcomes),
      JSON.stringify(again.map((e) => e.state)));

    // ── TURNING IT OFF ON THE SCREEN PREVENTS NEW WORK ───────────────────────
    await press(page, "agent-auto-toggle", "id", AU3);
    await page.waitForFunction((id) => {
      const b = document.querySelector(`[data-act="agent-auto-toggle"][data-id="${id}"]`);
      return b && /Turn on/i.test(b.textContent || "");
    }, AU3, { timeout: 10_000 });
    due();
    const tickOff = await disp.tick();
    await disp.drain();
    check("3g. ⚠ turned off on the screen, the cron starts nothing", (await runs3()).length === 1,
      JSON.stringify((await runs3()).map((e) => e.trigger)));
    // AND TURNING IT BACK ON RE-ARMS IT FORWARD rather than leaving a due-in-the-past row —
    // the defect the M13-2 round fixed, in a browser this time.
    await press(page, "agent-auto-toggle", "id", AU3);
    await page.waitForFunction((id) => {
      const b = document.querySelector(`[data-act="agent-auto-toggle"][data-id="${id}"]`);
      return b && /Turn off/i.test(b.textContent || "");
    }, AU3, { timeout: 10_000 });
    const rearmed = await page.evaluate(async (agent) => {
      const r = await fetch("/api/agent/automations?agent=" + agent, { headers: { authorization: "Bearer " + (await Auth.accessToken()) } });
      return ((await r.json()).automations || []).find((a) => a.name === "Morning check")?.nextRunAt ?? null;
    }, agentId);
    check("3h. ⚠ ...and turning it back on re-armed it in the FUTURE, not in the past",
      !!rearmed && Date.parse(rearmed) > Date.now(), String(rearmed));

    // ── AN EVENT, BOUND ON THE FORM AND DELIVERED FROM OUTSIDE ───────────────
    await press(page, "agent-auto-edit", "id", AU3);
    await page.waitForSelector("#agAutoEvent", { timeout: 10_000 });
    await page.fill("#agAutoEvent", EVENT);
    await press(page, "agent-auto-save");
    await waitText(page, /Saved\./, "the event binding to save", 10_000);
    const bound = await page.evaluate(async (agent) => {
      const r = await fetch("/api/agent/automations?agent=" + agent, { headers: { authorization: "Bearer " + (await Auth.accessToken()) } });
      return ((await r.json()).automations || []).find((a) => a.name === "Morning check")?.onEvent ?? null;
    }, agentId);
    check("3i. an event binding saved from the form", bound === EVENT, String(bound));

    /**
     * ⚠ **THE ENDPOINT IS MADE ON THE SCREEN NOW, AND THAT IS A CORRECTION TO THIS BLOCK.**
     * It used to go through `siteApi` under a paragraph saying `webhooks`, `webhook-create`,
     * `webhook-enable` and `webhook-delete` were on `NO_SCREEN_YET` — true when it was
     * written and false since those four got a screen. The route door is walled to that list
     * precisely so this cannot be a shortcut, and the list is now READ from the site's own
     * guard rather than copied here, which is what made the drift visible.
     *
     * So the whole of it is pressed: the door on the agent's row, Make the address, the two
     * fields, Save — and the key is read off the screen that shows it once.
     */
    /**
     * ⚠ **THE THREE PANEL DOORS ARE IN THE THREAD'S OWN HEADER, so a panel has to be LEFT
     * before another can be opened** — Automations, Connected accounts and Where things arrive
     * all sit beside the agent's name. A first draft pressed straight through and timed out on
     * a control that is really there and is simply not on this screen. The form is closed the
     * way a person closes it, then the screen's own Back.
     */
    await closeAutoForm(page);
    await press(page, "agent-auto-back");
    await page.waitForSelector('[data-act="agent-webhooks"]', { timeout: 10_000 });
    await press(page, "agent-webhooks", "id", agentId);
    await page.waitForSelector('[data-act="agent-wh-new"]', { timeout: 10_000 });
    await press(page, "agent-wh-new");
    await page.waitForSelector("#agWhForm", { timeout: 10_000 });
    await page.fill('#agWhForm [data-field="name"]', "The shop\u2019s orders");
    await page.fill('#agWhForm [data-field="event"]', EVENT);
    await press(page, "agent-wh-save");
    /**
     * ⚠ **THE KEY IS READ OFF THE SCREEN, which is the only place it ever exists.** `create_webhook`
     * answers it once and `list_webhooks` never selects the column, so this is not a convenience:
     * a journey that wanted to sign a delivery has to take it here or not at all. The two readonly
     * boxes are the PATH and then the KEY, in the order the labels put them.
     */
    await page.waitForSelector('[data-act="agent-wh-secret-done"]', { timeout: 10_000 });
    const shown = await page.$$eval('.ag-form input.ag-in[readonly]', (els) => els.map((e) => e.value));
    const made = { body: { id: (shown[0] || "").split("/").pop(), secret: shown[1] } };
    check("3j. ⚠ an endpoint made ON THE SCREEN, whose key is shown exactly once",
      typeof made.body.secret === "string" && made.body.secret.length >= 32 &&
        /^\/deliver\/[0-9a-f-]{36}$/.test(shown[0] || ""),
      JSON.stringify({ path: shown[0], keyLen: (made.body.secret || "").length }));
    /**
     * ⚠ **AND THE SCREEN SAYS THE KEY IS NOT COMING BACK, which is the half a stored value cannot
     * say.** A person who reads *"copy this now"* and does not is in a state the platform cannot
     * rescue them from, so the sentence is the product rather than decoration.
     */
    check("3j2. ...and it says so, rather than leaving somebody to find out",
      /only time it is shown/i.test(await text(page)) && /delete this address and make another/i.test(await text(page)));
    await press(page, "agent-wh-secret-done");
    /**
     * ⚠ **THE OBSERVER IS PROVED ALIVE, because "no secret on the screen" is a NEGATIVE.** An
     * earlier draft of this check asked only `!/secret/` of a ROUTE's answer — and a FAILED read
     * satisfies that perfectly: it passed over a body of `{"error":"couldn't save that just
     * now"}`, which is *a negative assertion whose observer is dead*. So the endpoint has to be
     * FOUND on the list first, and only then is the absence of its key worth anything.
     */
    await page.waitForSelector('[data-act="agent-wh-enable"]', { timeout: 10_000 });
    const listPanel = await text(page);
    check("3k. ⚠ ...and the list FINDS it and never shows the key again",
      listPanel.includes(EVENT) && listPanel.includes("/deliver/") &&
        !listPanel.includes(made.body.secret),
      JSON.stringify({ found: listPanel.includes(EVENT), key: listPanel.includes(made.body.secret) }));
    const WH3 = await page.getAttribute('[data-act="agent-wh-enable"]', "data-id");
    await shot(page, "j3-endpoint");
    await press(page, "agent-wh-back");
    await page.waitForSelector('[data-act="agent-automations"]', { timeout: 10_000 });
    await press(page, "agent-automations", "id", agentId);
    await page.waitForSelector('[data-act="agent-auto-new"]', { timeout: 10_000 });

    const payload = JSON.stringify({ amount: 42, tenant: B.uid, name: "evil.event" });
    const ts = String(Date.now());
    /**
     * ⚠ **THE JSON IS READ, and a first draft did not read it.** `worker.fetch` answers a
     * `Response`, whose `.body` is a ReadableStream — so `res.body?.repeat` is `undefined` and
     * `JSON.stringify` prints it as `{}`. The duplicate-delivery check asserted
     * `body.repeat === true` against that and reported a correct platform as broken, with the
     * detail line reading `{"status":202,"body":{}}` — which looks like an empty answer rather
     * than an unread one.
     */
    const deliver = async (delivery) => {
      const res = await worker.fetch(new Request(`https://x/deliver/${made.body.id}`, {
        method: "POST", body: payload,
        headers: { [SIG_HEADER]: sig, [TS_HEADER]: ts, [ID_HEADER]: delivery },
      }), disp.env, { waitUntil() {} });
      return { status: res.status, body: await res.json().catch(() => null) };
    };
    const sig = await signDelivery(made.body.secret, ts, payload);
    const one = await deliver("dlv-1");
    check("3l. a signed delivery is accepted", one.status === 202, String(one.status));
    await disp.tick();
    await disp.drain();
    await page.reload({ waitUntil: "load" });
    await enterAgents(page);
    await openAgent(page, agentId);
    await press(page, "agent-automations", "id", agentId);
    await openHistory(page, AU3);
    await waitText(page, /the shop opens at nine/, "the event-started execution to be listed", 20_000);
    hist3 = await runs3();
    const fromEvent = hist3.filter((e) => e.trigger === "event");
    check("3m. ⚠ the event started an execution and it ran", fromEvent.length === 1 && fromEvent[0].state === "done",
      JSON.stringify(hist3.map((e) => [e.trigger, e.state])));
    // ⚠ AND THE BODY'S OWN CLAIMS ARE NOT BELIEVED: the event belongs to the ENDPOINT's
    // account under the ENDPOINT's name, and the tenant the payload named gets nothing.
    const ev = JSON.parse(stack.q(
      `select coalesce(json_agg(json_build_object('t',tenant_id,'n',name)::json)::text,'[]') from agent.events;`));
    check("3n. ⚠ ...under the endpoint's own account and event name, not the body's",
      ev.length === 1 && ev[0].t === A.uid && ev[0].n === EVENT, JSON.stringify(ev));

    const twice = await deliver("dlv-1");
    await disp.tick();
    await disp.drain();
    check("3o. ⚠ the same delivery twice is ONE event and ONE execution",
      twice.status === 202 && twice.body?.repeat === true &&
        (await runs3()).filter((e) => e.trigger === "event").length === 1,
      JSON.stringify({ status: twice.status, body: twice.body }));

    /**
     * ⚠ **WHAT THE SCREEN SAYS ABOUT HOW IT STARTED, and this is the defect journey 3 found.**
     * Three triggers exist and both layers had two words for them: `executionRow` collapsed
     * anything that was not `schedule` into `manual`, and the row drew
     * `trigger === 'schedule' ? 'Scheduled' : 'Run now'`. So an execution an inbound ENDPOINT
     * started read as one a PERSON had pressed — a claim about somebody's own action, about an
     * action nobody took. MEASURED here before the fix:
     * `ag-run-how">Run now | ag-run-how">Scheduled · 2026-09-21`.
     *
     * Asserted POSITIVELY, with the scheduled row beside it as the OBSERVER: "it does not say
     * Run now" is satisfied by a panel that says nothing at all.
     */
    const howWords = await page.$$eval(`${autoRow(AU3)} .ag-run-how`, (els) =>
      els.map((e) => (e.textContent || "").trim()));
    check("3p. ⚠ an event-started execution says so, rather than claiming somebody pressed Run now",
      howWords.some((w) => /^From an event$/.test(w)) &&
        howWords.some((w) => /^Scheduled/.test(w)) &&
        !howWords.some((w) => /Run now/.test(w)),
      howWords.join(" | "));
    await shot(page, "j3-triggers");

    /**
     * ⚠ **CLOSING THE ADDRESS IS A THIRD THING, and none of the three above it covers this.**
     * Journey 3 has already disabled the AUTOMATION (3g/3h) — which stops the automation
     * whatever arrives — and the requirement asks for the other end: the address itself
     * closed, so a delivery is turned away before anything is even considered. The two are
     * different acts with different remedies, which is why the panel has its own control.
     */
    await closeAutoForm(page);
    await press(page, "agent-auto-back");
    await page.waitForSelector('[data-act="agent-webhooks"]', { timeout: 10_000 });
    await press(page, "agent-webhooks", "id", agentId);
    await page.waitForSelector(`[data-act="agent-wh-enable"][data-id="${WH3}"]`, { timeout: 10_000 });
    const openedWord = await page.textContent(`[data-act="agent-wh-enable"][data-id="${WH3}"]`);
    check("3s. ⚠ an OPEN address offers to close it rather than to open it again",
      /close/i.test(openedWord || ""), JSON.stringify(openedWord));
    await press(page, "agent-wh-enable", "id", WH3);
    await page.waitForFunction((id) => /open/i.test(
      document.querySelector(`[data-act="agent-wh-enable"][data-id="${id}"]`)?.textContent || ""),
      WH3, { timeout: 10_000 });
    const shutRow = await page.$eval(`.ag-auto:has([data-act="agent-wh-enable"][data-id="${WH3}"])`,
      (el) => (el.textContent || "").trim());
    check("3t. ⚠ ...and once closed it says so and offers to open it",
      /closed/i.test(shutRow), shutRow.replace(/\s+/g, " ").slice(0, 120));

    const afterShut = await deliver("dlv-2");
    await disp.tick();
    await disp.drain();
    const runsAfterShut = (await page5Runs(page, AU3)).filter((e) => e.trigger === "event").length;
    /**
     * ⚠ **REFUSED WITH THE SAME SENTENCE EVERY OTHER REFUSAL GETS, which is deliberate.** A
     * closed address, an unknown one, a wrong key and a stale timestamp all answer one line, so
     * the route is not an oracle for which ids exist. What says it was CLOSED rather than
     * broken is the row above, which the person can read.
     */
    check("3u. ⚠ a delivery to a CLOSED address is refused, and starts nothing",
      afterShut.status === 401 && runsAfterShut === 1,
      JSON.stringify({ status: afterShut.status, runs: runsAfterShut }));
    /**
     * ⚠ **AND THE ARRIVAL IS NOT EVEN RECORDED, which is the honest half.** `agent.events` is
     * what a delivery the platform ACCEPTED leaves behind; a refused one never reaches it, so
     * the arrivals list is about what got in rather than about everything that knocked. The
     * list says so in as many words, because an empty panel would otherwise read as *nothing
     * has been rejected*, which is a claim nobody can make.
     *
     * ⚠ **AND THE LIST HAS TO BE FOUND BEFORE ITS SILENCE MEANS ANYTHING — a first draft asked
     * only for that sentence and it PASSED OVER A PANEL THAT NEVER LOADED.** The sentence is
     * the panel's CHROME and is drawn whether the read worked or not, so with the shim missing
     * `list_events` the arrivals read answered 400, the panel drew its own error, and this check
     * was green. *A negative assertion whose observer is dead*, and what caught it was the
     * run's own refused-call census rather than anything asserted here. So the ACCEPTED arrival
     * is found on screen first, by the event's own name.
     */
    const events3 = Number(stack.q(`select count(*) from agent.events;`).trim());
    const arrivals3 = await text(page);
    check("3v. ⚠ the arrivals list really loaded and shows the ONE that got in",
      /Started a run|Nothing was listening|Waiting to be picked up/i.test(arrivals3) &&
        arrivals3.includes(EVENT) && !/Couldn.t load the arrivals/i.test(arrivals3),
      arrivals3.replace(/\s+/g, " ").slice(0, 140));
    check("3v2. ⚠ ...and the refused delivery left no arrival behind, which the list says out loud",
      events3 === 1 && /refused|turned away|never reach/i.test(arrivals3),
      JSON.stringify({ events: events3 }));
    await shot(page, "j3-endpoint-closed");
    await press(page, "agent-wh-back");

    check("3q. no page error anywhere in journey 3", pageProblems.length === 0, pageProblems.slice(0, 2).join(" | "));
    check("3r. ...and no /api/agent/ call this journey's own session made was refused",
      refusedIn("J3").length === 0,
      refusedIn("J3").slice(0, 3).map((r) => `${r.status} ${r.url}`).join(" | "));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // JOURNEY 4 — reload while it waits, restart the engine, then decide
  // ════════════════════════════════════════════════════════════════════════════
  if (want(4)) {
    head("JOURNEY 4 — reload while waiting, restart the engine, then approve or reject");
    const { page } = await openApp(A, "J4");
    agentId = agentId ?? (await firstAgent(page));
    await openAgent(page, agentId);
    await press(page, "agent-automations", "id", agentId);
    await page.waitForSelector('[data-act="agent-auto-new"]', { timeout: 10_000 });

    /**
     * ⚠ **AN APPROVAL **STEP**, WHICH IS THE OTHER MECHANISM — and the two are not one.**
     * Journey 2 approved a `send`, whose request is bound to the exact payload a person was
     * shown and is answered through `agent.decide_tool_approval`. This is the step a workflow
     * AUTHOR configures, answered through `agent.decide_automation_approval`, keyed by the run
     * and the step. A screen that sent one where the other was meant would answer somebody
     * else's question, which is why `chat.js` keeps them as four separate controls.
     *
     * A note either side of it, so there is work BEFORE (which must not run twice) and work
     * AFTER (which must not run at all until somebody says yes).
     */
    await press(page, "agent-auto-new");
    await page.waitForSelector("#agAutoName", { timeout: 10_000 });
    await type(page, "agAutoName", "Before we send");
    await addStep(page, "note", { text: "the price list was read", out: "checked" });
    await addStep(page, "approval", { ask: "May I write to {{checked}}?", hours: "24", on_timeout: "fail" });
    await addStep(page, "note", { text: "acted on: {{checked}}", out: "acted" });
    await press(page, "agent-auto-save");
    await waitText(page, /Saved\./, "the approval workflow to save", 10_000);
    const AU4 = await page.evaluate(async (agent) => {
      const r = await fetch("/api/agent/automations?agent=" + agent, { headers: { authorization: "Bearer " + (await Auth.accessToken()) } });
      return ((await r.json()).automations || []).find((a) => a.name === "Before we send")?.id ?? null;
    }, agentId);
    check("4a. a workflow with an approval step in the middle of it saved from the form",
      typeof AU4 === "string" && AU4.length > 0, String(AU4));

    // ── IT HOLDS, HALF WAY, WITH THE FIRST STEP DONE AND THE LAST ONE UNTOUCHED ───
    await closeAutoForm(page);
    await press(page, "agent-auto-run", "id", AU4);
    await waitRung(1);
    await disp.drain();
    await openHistory(page, AU4);
    await waitText(page, /Waiting/, "the execution to hold for a person", 20_000);
    const hist4 = () => page.evaluate(async (id) => {
      const r = await fetch("/api/agent/automation-history?id=" + id, { headers: { authorization: "Bearer " + (await Auth.accessToken()) } });
      return (await r.json()).executions || [];
    }, AU4);
    let held = (await hist4())[0];
    check("4b. ⚠ it is WAITING for a person rather than reading as working or queued",
      held?.state === "waiting", JSON.stringify({ state: held?.state, waiting: held?.waiting?.kind }));
    const outcomeOf = (ex, id) => (ex?.outcomes || []).find((o) => o.id === id) ?? null;
    check("4c. ...the step BEFORE it has already run, and the one AFTER it has not",
      outcomeOf(held, "s1")?.outcome === "ran" && outcomeOf(held, "s3") === null,
      JSON.stringify((held?.outcomes || []).map((o) => [o.id, o.outcome])));
    check("4d. ⚠ ...and the question on screen is the one the workflow asks, with its value filled in",
      /May I write to the price list was read\?/.test(await text(page)),
      (await text(page)).replace(/\s+/g, " ").slice(0, 200));
    // ⚠ NOTHING IS ON THE QUEUE WHILE IT WAITS. The work row is DONE — there is nothing to
    // redeliver until somebody answers — so a tick must not find it either.
    await disp.tick();
    check("4e. ⚠ ...and neither the doorbell nor the cron has anything to deliver while it waits",
      disp.rung.length === 0 && (await hist4())[0].state === "waiting",
      JSON.stringify({ rung: disp.rung.length }));

    // ── A RELOAD WHILE IT WAITS: the browser remembers nothing about it ──────
    const before = JSON.stringify(outcomeOf(held, "s1"));
    await page.reload({ waitUntil: "load" });
    await enterAgents(page);
    await openAgent(page, agentId);
    await press(page, "agent-automations", "id", agentId);
    await openHistory(page, AU4);
    await waitText(page, /Waiting/, "the wait to still be on screen after a reload", 20_000);
    check("4f. ⚠ A RELOAD MID-WAIT NEEDS NO RECOVERY — the question is on screen again",
      /May I write to the price list was read\?/.test(await text(page)) &&
        (await hist4())[0].state === "waiting",
      (await text(page)).replace(/\s+/g, " ").slice(0, 160));
    check("4g. ...and both buttons are there, so it can be answered",
      (await has(page, `[data-act="agent-auto-approve"][data-run="${held.id}"]`)) &&
        (await has(page, `[data-act="agent-auto-reject"][data-run="${held.id}"]`)));

    /**
     * ⚠ **THE ENGINE IS RESTARTED, AND A BRAND-NEW DISPATCHER IS THE WHOLE CLAIM.** It has a
     * brand-new doorbell, a brand-new env and no memory of anything — the same state a deploy
     * leaves behind — so whatever finishes this execution came out of the DATABASE rather than
     * out of the process that started it. The old doorbell is asserted EMPTY first, so nothing
     * is being carried across.
     */
    check("4h. ⚠ nothing was held open across the restart — the old doorbell is empty",
      disp.rung.length === 0, JSON.stringify(disp.rung));
    restartEngine();
    check("4i. ...and the new engine has delivered nothing and has nothing to deliver",
      disp.rung.length === 0 && disp.delivered.length === 0,
      JSON.stringify({ rung: disp.rung.length, delivered: disp.delivered.length }));

    // ── APPROVED, ON THE SCREEN, AFTER THE RESTART ──────────────────────────
    await press(page, "agent-auto-approve", "run", held.id);
    // ⚠ THE PRESS PUT IT BACK ON THE QUEUE, which is the doorbell ringing on the NEW engine —
    // so this also says the decision route rang rather than leaving the work for a cron tick.
    await waitRung(1);
    check("4i2. ⚠ ...and the approval rang the NEW engine's doorbell, not the one that started it",
      disp.rung.length === 1 && disp.rung[0] === held.id, JSON.stringify(disp.rung));
    await disp.drain();
    await refreshHistory(page, AU4);
    let done4 = (await hist4()).find((e) => e.id === held.id);
    check("4j. ⚠ APPROVED AFTER A RESTART, and it finished — on the new engine",
      done4?.state === "done", JSON.stringify({ state: done4?.state, by: disp.delivered.length }));
    check("4k. ...and the step after the approval ran, quoting what the first step produced",
      outcomeOf(done4, "s3")?.outcome === "ran" &&
        /acted on: the price list was read/.test(JSON.stringify(outcomeOf(done4, "s3"))),
      JSON.stringify(outcomeOf(done4, "s3")));
    /**
     * ⚠ **NOTHING RAN TWICE, AND THE EVIDENCE IS THE RECORDED OUTCOME ITSELF.** The step before
     * the approval finished before the restart, so its outcome is a fact the resumed delivery
     * must not touch: identical bytes, and exactly ONE outcome per step. A count of attempts
     * would not do — `requeue_run` sets `attempts = 0` deliberately, because a person asking is
     * new information rather than a retry, so that column reads 1 however many times it paused.
     */
    check("4l. ⚠ ...and the work BEFORE the approval was not repeated — its outcome is untouched",
      JSON.stringify(outcomeOf(done4, "s1")) === before,
      `${before} → ${JSON.stringify(outcomeOf(done4, "s1"))}`);
    check("4m. ...one outcome per step, so nothing was recorded twice",
      (done4?.outcomes || []).length === new Set((done4?.outcomes || []).map((o) => o.id)).size &&
        (done4?.outcomes || []).length === 3,
      JSON.stringify((done4?.outcomes || []).map((o) => o.id)));
    check("4n. ⚠ ...and there is still exactly ONE execution, not a second one from the resume",
      (await hist4()).length === 1, String((await hist4()).length));

    // ── REJECTED: a second run, and a rejection is NOT a failure ─────────────
    await press(page, "agent-auto-run", "id", AU4);
    await waitRung(1);
    await disp.drain();
    await refreshHistory(page, AU4);
    await waitText(page, /Waiting/, "the second run to hold", 20_000);
    const second = (await hist4()).find((e) => e.state === "waiting");
    await press(page, "agent-auto-reject", "run", second.id);
    await waitRung(1);
    await disp.drain();
    await refreshHistory(page, AU4);
    await waitText(page, /Rejected/, "the rejection to be on screen", 20_000);
    const rejected = (await hist4()).find((e) => e.id === second.id);
    check("4o. ⚠ SOMEBODY SAID NO, and that is `rejected` rather than `failed`",
      rejected?.state === "rejected", JSON.stringify({ state: rejected?.state, why: rejected?.why }));
    check("4p. ...the step after it was SKIPPED rather than run, and its own note says why",
      outcomeOf(rejected, "s3")?.outcome === "skipped" &&
        typeof outcomeOf(rejected, "s3")?.why === "string",
      JSON.stringify(outcomeOf(rejected, "s3")));
    // ⚠ AND THE SCREEN DOES NOT CALL IT A FAILURE, which is the requirement as a screen: the
    // automation did exactly what it was asked, and somebody's own decision is not a fault.
    const rejHtml = await page.evaluate(() => document.getElementById("viewAgents").innerHTML);
    check("4q. ⚠ ...and nothing on screen calls a rejection a failure",
      /ag-chip-rejected/.test(rejHtml) && !/ag-chip-failed/.test(rejHtml),
      (rejHtml.match(/ag-chip-[a-z]+/g) || []).join(" "));

    /**
     * ⚠ **CANCELLATION HAS A SCREEN NOW, SO THIS IS A PRESS — and the list shrinking is what
     * moved the check.** This block used to call `/api/agent/run-cancel` through `siteApi` and
     * read the RESULT in the browser, on the honest grounds that no control anywhere in
     * `chat.js` reached that route. M16 gave it one, so `NO_SCREEN_YET` no longer names it —
     * and because that list is PARSED out of the site's own guard rather than copied here,
     * `siteApi` refused this call the moment the screen landed. *A derived list falsifies the
     * checks that were true only while it was shorter*, which is the derivation working.
     *
     * So the properties are unchanged and every one of them is read from the SCREEN or from
     * the DATABASE instead of from a route's answer body — which is the stronger reading
     * anyway: the counts are asserted where `agent.cancel_run` really wrote them.
     */
    // ⚠ **ONE HANDLER, AND IT ACCEPTS — the REFUSAL half is journey 7's and is not repeated
    // here.** Playwright's default is to DISMISS a dialog nobody handles, which is exactly a
    // person pressing Cancel, so journey 7 gets that arm free and drives it as its own control.
    // What journey 4 is about is the counts and what survives, so it confirms once.
    const asked4 = [];
    page.on("dialog", async (d) => { asked4.push(d.message()); await d.accept(); });

    await press(page, "agent-auto-run", "id", AU4);
    await waitRung(1);
    await disp.drain();
    await refreshHistory(page, AU4);
    await page.waitForSelector(`${autoRow(AU4)} .ag-run`, { timeout: 20_000 });
    await waitText(page, /Waiting/, "the third run to hold", 20_000);
    const third = (await hist4()).find((e) => e.state === "waiting");
    check("4r. ⚠ the waiting run offers Stop, and the row says what stopping reaches before the press",
      (await has(page, `${autoRow(AU4)} [data-act="agent-auto-stop"][data-run="${third.id}"]`)) &&
        /one run and nothing else/i.test(await text(page)));
    // ⚠ A REASON TYPED THE WAY A PERSON TYPES ONE — into the row's own box, and then the
    // button, with nothing re-rendering in between. That order is what found the note-reader
    // defect in journey 7, and it is the order a person really performs.
    await page.fill(`[data-note="${third.id}"]`, "we handled it by phone");
    await press(page, "agent-auto-stop", "run", third.id);
    await waitText(page, /Stopped\./, "the screen to say it stopped", 20_000);
    const stopSaid = await text(page);
    check("4r2. ⚠ ...and the press really asked first, naming what stopping cannot take back",
      asked4.length === 1 && /cannot take a message back/i.test(asked4[0]),
      JSON.stringify((asked4[0] || "").slice(0, 100)));

    /**
     * ⚠ **THE COUNT IS EXACT, AND `>= 1` WAS NOT ENOUGH TO CATCH WHAT WAS WRONG.** This read
     * **0** before the fix — `cancel_run` counted `model` entries as completed steps, which is
     * the agent loop's vocabulary, and an automation execution's journal holds none of them.
     * Then it read **2**, because the executor's `done` counts the PAUSED step's own outcome.
     * The truth is ONE: the note before the approval ran, and the approval itself did not.
     * A floor would have passed both wrong answers.
     *
     * ⚠ **AND IT IS ASSERTED WHERE THE FUNCTION WROTE IT rather than off the answer it
     * returned.** `agent.project_entry` reads the `stopped` entry's nested `stop`, so
     * `agent.runs.stop` holds the counts a person was shown — one fact, read from the journal
     * the run really left, which a route's reply cannot be wrong about separately from.
     */
    const stopRow = JSON.parse(stack.q(
      `select coalesce(to_json((select json_build_object(
         'reason', r.stop->>'reason', 'why', r.stop->>'note',
         'steps', (r.stop->>'completedSteps')::int, 'calls', (r.stop->>'completedCalls')::int,
         'stops', (select count(*) from agent.run_entries e where e.run_id=r.id and e.kind='stopped'),
         'waiting', (select ar.waiting from agent.automation_runs ar where ar.id=r.id)
       ) from agent.runs r where r.id='${third.id}'))::text,'null');`));
    check("4s. ⚠ STOPPED, and it counts what had ALREADY run — exactly one step, and no tool calls",
      stopRow?.reason === "cancelled" && stopRow?.steps === 1 && stopRow?.calls === 0 &&
        stopRow?.stops === 1, JSON.stringify(stopRow));
    // ⚠ THE WAIT IS RELEASED, asserted as the ROW rather than as the answer's own
    // `releasedWait`: what matters to a customer is that nothing is waiting for them any
    // more, and a function reporting that it released one is a weaker claim than the column.
    check("4s2. ⚠ ...and nothing is waiting for a person any more — the wait itself is gone",
      stopRow?.waiting === null, JSON.stringify({ waiting: stopRow?.waiting }));
    /**
     * ⚠ **AND IT SAYS THE COMPLETED WORK STANDS — asserted POSITIVELY, which is the whole
     * point.** "It does not say undone" is satisfied by an answer that says nothing at all —
     * and worse: the honest sentence is *"what had already run has already run and was not
     * undone"*, so a needle over the bare word `undone` goes RED about the one thing it was
     * written to demand. **This repository records that exact mistake in `verify:send` and I
     * made it again here**, and it cost a run.
     */
    check("4s3. ⚠ ...and the SCREEN says how far it got and never claims a rollback",
      /1 step had already run\./.test(stopSaid) && /was not undone/i.test(stopSaid) &&
        !/(was|were|has been|have been) (undone|rolled back|reversed)/i.test(stopSaid),
      (stopSaid.match(/Stopped\.[\s\S]{0,140}/) || [""])[0].replace(/\s+/g, " "));
    // ⚠ LATER STEPS DO NOT RUN, and neither a delivery nor a tick changes that.
    await disp.ring(third.id);
    await disp.drain();
    await disp.tick();
    await disp.drain();
    const stopped = (await hist4()).find((e) => e.id === third.id);
    check("4t. ⚠ ...the step after the approval never ran, and a delivery and a tick did not start it",
      outcomeOf(stopped, "s3") === null || outcomeOf(stopped, "s3")?.outcome !== "ran",
      JSON.stringify((stopped?.outcomes || []).map((o) => [o.id, o.outcome])));
    check("4u. ...and the step BEFORE it still says it ran — a cancellation undoes nothing",
      outcomeOf(stopped, "s1")?.outcome === "ran", JSON.stringify(outcomeOf(stopped, "s1")));
    await page.reload({ waitUntil: "load" });
    await enterAgents(page);
    await openAgent(page, agentId);
    await press(page, "agent-automations", "id", agentId);
    await openHistory(page, AU4);
    await waitText(page, /Stopped/, "the cancellation to be on screen", 20_000);
    check("4v. ⚠ ...and the SCREEN says somebody stopped it, in their own words, not that it broke",
      /we handled it by phone/.test(await text(page)) &&
        !/ag-chip-failed/.test(await page.evaluate(() => document.getElementById("viewAgents").innerHTML)),
      (await text(page)).replace(/\s+/g, " ").slice(0, 240));
    check("4v2. ⚠ ...and a stopped run offers no Stop at all",
      !(await has(page, `${autoRow(AU4)} [data-act="agent-auto-stop"][data-run="${third.id}"]`)));

    await shot(page, "j4-approval");
    check("4w. no page error anywhere in journey 4", pageProblems.length === 0, pageProblems.slice(0, 2).join(" | "));
    check("4x. ...and no /api/agent/ call this journey's own session made was refused",
      refusedIn("J4").length === 0,
      refusedIn("J4").slice(0, 3).map((r) => `${r.status} ${r.url}`).join(" | "));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // JOURNEY 5 — two sessions of one account, and the account next door
  // ════════════════════════════════════════════════════════════════════════════
  if (want(5)) {
    head("JOURNEY 5 — two browser sessions, and the account next door");
    /**
     * ⚠ **A CONTEXT IS A SESSION AND A TOKEN IS AN ACCOUNT, and the journey is the pair.**
     * `one` and `two` hold the SAME token, so they are one person with the app open twice —
     * two laptops, or two tabs of one browser, which is the commonest thing a customer does.
     * `next` holds a different token and is a different account. **Neither half means much
     * alone**: both-edits-survive is satisfied by a platform with no isolation at all, and
     * every-refusal is satisfied by one that refuses everybody. Each is the other's control.
     */
    const one = await openApp(A, "J5-one");
    const two = await openApp(A, "J5-two");
    agentId = agentId ?? (await firstAgent(one.page));
    check("5-pre. both sessions are the same account, and there is an agent to work on",
      !!agentId && (await firstAgent(two.page)) === agentId,
      `${agentId} / ${await firstAgent(two.page)}`);

    // ── ONE AUTOMATION, MADE IN THE FIRST SESSION ───────────────────────────
    await openAgent(one.page, agentId);
    await press(one.page, "agent-automations", "id", agentId);
    await press(one.page, "agent-auto-new");
    await page5Name(one.page, "Two of us");
    await addStep(one.page, "note", { text: "the first version", out: "said" });
    await press(one.page, "agent-auto-save");
    await waitText(one.page, /Saved\./, "the first session's save", 10_000);
    const AU5 = await autoIdNamed(one.page, agentId, "Two of us");
    check("5a. the first session made it", typeof AU5 === "string" && AU5.length > 0, String(AU5));

    // ── THE SECOND SESSION SEES IT, which is what one account means ─────────
    await openAgent(two.page, agentId);
    await press(two.page, "agent-automations", "id", agentId);
    await waitText(two.page, /Two of us/, "the second session to see the same automation", 10_000);
    check("5b. ⚠ the OTHER SESSION of the same account sees it — one account, one set of work",
      /Two of us/.test(await text(two.page)));

    /**
     * ⚠ **BOTH SESSIONS HAVE A FORM OPEN, AND THE SECOND ONE'S IS STALE BY THE TIME IT SAVES.**
     * This is the lost-update property in a real browser for the first time: the edit route is a
     * PATCH, and the form sends only what the person CHANGED — so session two, whose form was
     * drawn before session one renamed anything, must not carry its stale copy of the name back
     * over session one's edit. A full replace built from a cached row would.
     */
    await openEdit(two.page, AU5);
    const staleName = await two.page.$eval("#agAutoName", (el) => el.value);
    check("5c. the second session's form is open, holding the name as it was then", staleName === "Two of us", staleName);

    // SESSION ONE renames it — and touches nothing else.
    await openEdit(one.page, AU5);
    await page5Name(one.page, "Two of us (renamed)");
    await press(one.page, "agent-auto-save");
    await waitText(one.page, /Saved\./, "the rename", 10_000);
    check("5d. the first session renamed it",
      (await autoNamed(two.page, agentId, "Two of us (renamed)"))?.name === "Two of us (renamed)");

    // SESSION TWO, from its stale form, changes only the STEP.
    await setStep(two.page, 0, { text: "the second version" });
    await press(two.page, "agent-auto-save");
    await waitText(two.page, /Saved\./, "the second session's save", 10_000);
    const after5 = await autoNamed(one.page, agentId, "Two of us (renamed)");
    check("5e. ⚠ BOTH EDITS SURVIVED — the stale form did not carry the old name back over",
      after5?.name === "Two of us (renamed)" && after5?.steps?.[0]?.text === "the second version",
      JSON.stringify({ name: after5?.name, text: after5?.steps?.[0]?.text }));

    // AND THE OTHER WAY ROUND, so neither order is the one that happens to work.
    await openEdit(one.page, AU5);
    await openEdit(two.page, AU5);
    await setStep(two.page, 0, { text: "the third version" });
    await press(two.page, "agent-auto-save");
    await waitText(two.page, /Saved\./, "the second session's step edit", 10_000);
    await page5Name(one.page, "Two of us (renamed twice)");
    await press(one.page, "agent-auto-save");
    await waitText(one.page, /Saved\./, "the first session's rename", 10_000);
    const both5 = await autoNamed(one.page, agentId, "Two of us (renamed twice)");
    check("5f. ⚠ ...and in the other order too, so neither session's edit is the lucky one",
      both5?.name === "Two of us (renamed twice)" && both5?.steps?.[0]?.text === "the third version",
      JSON.stringify({ name: both5?.name, text: both5?.steps?.[0]?.text }));

    /**
     * ⚠ **AND A SAVE FROM A FORM WHOSE STEPS ARE REALLY STALE STILL LANDS — with the LATER one
     * winning, which is what a patch means rather than what a merge would mean.** Session one's
     * form still holds "the second version" in its step box; saving its steps writes them,
     * because a person editing a step is asking for that step. What must not happen is a save
     * that touched no step reverting one, which is the pair above.
     */
    await closeAutoForm(one.page);
    await closeAutoForm(two.page);

    // ── AN EXECUTION ONE SESSION STARTED IS THE OTHER'S TOO ─────────────────
    await press(one.page, "agent-auto-run", "id", AU5);
    await waitRung(1);
    await disp.drain();
    /**
     * ⚠ **`agent-auto-reload` IS THE ERROR SCREEN'S "Try again" AND IS NOT A REFRESH BUTTON** —
     * it is drawn only where the list failed to load, so a first draft timed out on a control
     * that correctly is not there when everything is working. What a person does instead is
     * re-open the history, which is a fresh read of the SERVER's own answer.
     */
    await openHistory(two.page, AU5);
    await waitText(two.page, /Done/, "the second session to see the run", 20_000);
    check("5g. ⚠ an execution one session started is on the OTHER session's screen too",
      /the third version/.test(await text(two.page)),
      (await text(two.page)).replace(/\s+/g, " ").slice(0, 200));

    /**
     * ⚠ **AND NOW AN AUTOMATION THAT HOLDS, so the account next door has something to try to
     * approve.** A rejection or an approval from a stranger is the one refusal that cannot be
     * demonstrated without a real request waiting for a real person.
     */
    await openEdit(one.page, AU5);
    await addStep(one.page, "approval", { ask: "May the other account see this?", hours: "24", on_timeout: "fail" });
    await press(one.page, "agent-auto-save");
    await waitText(one.page, /Saved\./, "the approval step to save", 10_000);
    await closeAutoForm(one.page);
    await press(one.page, "agent-auto-run", "id", AU5);
    await waitRung(1);
    await disp.drain();
    await refreshHistory(one.page, AU5);
    await waitText(one.page, /Waiting/, "the execution to hold for a person", 20_000);
    const waitingRun = await page5Runs(one.page, AU5).then((rs) => rs.find((e) => e.state === "waiting"));
    check("5h. something of this account's is waiting for a person",
      typeof waitingRun?.id === "string", JSON.stringify({ id: waitingRun?.id, state: waitingRun?.state }));

    // ── THE ACCOUNT NEXT DOOR ───────────────────────────────────────────────
    const next = await openApp(B, "J5-next");
    /**
     * ⚠ **ITS OWN SCREEN IS THE FIRST CHECK, AND IT IS A PRESS.** Opening the agent builder is
     * something a person does, and what the other account sees there is the whole of what it may
     * read: nothing. No control anywhere in `chat.js` names another account's agent, which is
     * exactly why the refusals below are REQUESTS rather than presses — and that is said out
     * loud rather than dressed up as a click.
     */
    await waitText(next.page, /No agents yet/, "the other account's own empty screen", 10_000);
    check("5i. ⚠ THE ACCOUNT NEXT DOOR SEES ITS OWN SCREEN, and there is nothing on it",
      /No agents yet/.test(await text(next.page)) && !/Bike shop|Two of us/.test(await text(next.page)),
      (await text(next.page)).replace(/\s+/g, " ").slice(0, 120));
    check("5j. ...and its own list, from the server, holds nothing of this account's",
      (await firstAgent(next.page)) === null, String(await firstAgent(next.page)));

    /**
     * Every request A's own screen makes, made from B's page with B's own token and A's ids.
     * **THIS IS WHAT AN OUTSIDER REALLY DOES** — there is no control to press, so the honest
     * shape is the request, issued in B's page scope through the page's own `Auth.accessToken()`
     * so the token is the one B's browser holds.
     */
    const asNextDoor = (path, body = null) => next.page.evaluate(async ([p, b]) => {
      const r = await fetch(p, {
        method: b ? "POST" : "GET",
        headers: { authorization: "Bearer " + (await Auth.accessToken()), ...(b ? { "content-type": "application/json" } : {}) },
        ...(b ? { body: JSON.stringify(b) } : {}),
      });
      let parsed = null;
      try { parsed = await r.json(); } catch { parsed = null; }
      return { status: r.status, body: parsed };
    }, [path, body]);

    const OUTSIDER = [
      /**
       * ⚠ **EACH BODY IS THE SHAPE ITS OWN ROUTE READS, and three of these were wrong first —
       * which is why 5k demands a 404 and not merely a refusal.** `messages` reads `id` from the
       * QUERY (not `agent`), `update` is a PATCH that still requires a name AND an instruction,
       * and `send` reads `id` rather than `agent`. All three answered **400** — the route
       * refusing MY body — and *a refusal from the wrong gate looks exactly like the wall
       * working*. A check that accepted any non-2xx would have passed on three requests that
       * never reached the ownership test at all.
       */
      ["read the agent's conversation", `/api/agent/messages?id=${agentId}`, null],
      ["edit the agent itself", "/api/agent/update",
        { id: agentId, name: "mine now", instructions: "answer as me" }],
      ["send it a message", "/api/agent/send", { id: agentId, body: "hello", key: "j5-outsider" }],
      ["delete the agent", "/api/agent/delete", { id: agentId }],
      ["read its automations", `/api/agent/automations?agent=${agentId}`, null],
      ["read one automation's history", `/api/agent/automation-history?id=${AU5}`, null],
      ["read a workflow through", "/api/agent/automation-check", { agent: agentId, steps: [] }],
      ["edit it", "/api/agent/automation-update", { id: AU5, name: "mine now" }],
      ["turn it off", "/api/agent/automation-enable", { id: AU5, enabled: false }],
      ["run it", "/api/agent/automation-run", { id: AU5 }],
      ["DELETE it", "/api/agent/automation-delete", { id: AU5 }],
      ["approve what it is waiting for", "/api/agent/automation-approve",
        { run: waitingRun.id, step: "s2", verdict: "approved" }],
      ["read what it remembers", `/api/agent/memory?agent=${agentId}`, null],
      ["read what it knows", `/api/agent/knowledge?agent=${agentId}`, null],
    ];
    /**
     * ⚠ **EVERY PATH HAS TO BE A REAL ROUTE, and this wall exists because the first draft got it
     * wrong.** It tried `/api/agent/automation-read`, which does not exist — so `local-site.mjs`
     * fell through to the static file server and answered a 404 in PLAIN TEXT, and the check
     * "all ten were refused" passed on a 404 that had nothing to do with isolation. *A refusal
     * from the wrong gate looks exactly like the wall working*, and here the wrong gate was the
     * file server. Caught by the observer below asking for a JSON body.
     */
    for (const [what, path] of OUTSIDER) {
      const route = path.split("?")[0];
      if (!Object.hasOwn(AGENT_ROUTES, route)) {
        throw new Error(`"${what}" names ${route}, which is not a route — a 404 from it proves nothing`);
      }
    }
    const tries = {};
    for (const [what, path, body] of OUTSIDER) tries[what] = await asNextDoor(path, body);
    /**
     * ⚠ **NOT FOUND, NEVER FORBIDDEN — and the status is the assertion.** "Forbidden" tells a
     * stranger the id they hold is real, which is information; a missing thing and somebody
     * else's thing answer the same 404. A 200 with an empty list would be worse still: it would
     * read as *this account has none of these*, which is a claim about the wrong account.
     */
    const refused = Object.entries(tries).filter(([, r]) => r.status !== 404);
    check(`5k. ⚠ NOT ONE of the ${OUTSIDER.length} things the other account tried was allowed, and each is a 404`,
      refused.length === 0,
      refused.map(([what, r]) => `${what}: ${r.status} ${JSON.stringify(r.body).slice(0, 60)}`).join(" | ")
        || `all ${OUTSIDER.length} answered 404`);
    /**
     * ⚠ **THE OBSERVER, AND IT EARNED ITS PLACE ON THE FIRST RUN.** Each one really has to have
     * reached the SITE and been answered by the `/api/agent/*` handler — which answers JSON —
     * rather than by anything else that can produce a 404. It is what caught the invented route
     * above, and it is also what stops a helper that quietly did nothing reading as ten
     * refusals. **Derived from the list rather than a hardcoded count**, so an eleventh try
     * cannot be added without being counted.
     */
    check(`5l. ...and all ${OUTSIDER.length} really reached the agent handler rather than some other 404`,
      Object.keys(tries).length === OUTSIDER.length &&
        Object.values(tries).every((r) => r.body !== null && typeof r.body === "object"),
      JSON.stringify(Object.entries(tries).map(([w, r]) => [w, r.status, r.body === null ? "NOT JSON" : "json"])));

    /**
     * ⚠ **AND NOTHING THE OUTSIDER DID WROTE ANYTHING**, which a status code cannot say. A 404
     * with a write behind it is a wall that refuses and moves `updated_at` on the way past.
     */
    const still = await autoNamed(one.page, agentId, "Two of us (renamed twice)");
    check("5m. ⚠ ...and nothing it tried changed anything — the name, the step and the switch stand",
      still?.name === "Two of us (renamed twice)" && still?.steps?.[0]?.text === "the third version" &&
        still?.enabled === true,
      JSON.stringify({ name: still?.name, text: still?.steps?.[0]?.text, enabled: still?.enabled }));
    const heldAfter = (await page5Runs(one.page, AU5)).find((e) => e.id === waitingRun.id);
    check("5n. ⚠ ...and what was waiting for a person is STILL waiting — a stranger decided nothing",
      heldAfter?.state === "waiting", JSON.stringify({ state: heldAfter?.state }));

    // ── AND THE OWNER CAN, WHICH IS WHAT MAKES ALL OF THAT ABOUT ISOLATION ──
    await refreshHistory(one.page, AU5);
    await press(one.page, "agent-auto-approve", "run", waitingRun.id);
    await waitRung(1);
    await disp.drain();
    await refreshHistory(one.page, AU5);
    const ownerDid = (await page5Runs(one.page, AU5)).find((e) => e.id === waitingRun.id);
    check("5o. ⚠ THE CONTROL: the OWNER approves the very same thing and it finishes",
      ownerDid?.state === "done", JSON.stringify({ state: ownerDid?.state }));

    await shot(one.page, "j5-two-sessions");
    await shot(next.page, "j5-next-door");
    check("5p. no page error in any of the three sessions", pageProblems.length === 0, pageProblems.slice(0, 3).join(" | "));
    /**
     * ⚠ **THE OTHER ACCOUNT'S 404s ARE EXPECTED AND ARE DECLARED, rather than filtered.**
     * Every other journey asserts that no `/api/agent/` call was refused; here the outsider's are
     * the point. So they are counted by SESSION LABEL and the count has to be exactly the length
     * of the list above — one more refusal, or one from the owner's own sessions, is a failure.
     */
    const ownerRefused = refusedIn("J5-one").concat(refusedIn("J5-two"));
    const strangerRefused = refusedIn("J5-next");
    check("5q. ⚠ ...and no /api/agent/ call the OWNER's two sessions made was refused",
      ownerRefused.length === 0, ownerRefused.map((r) => `${r.status} ${r.url}`).join(" | "));
    check(`5r. ⚠ ...while the other account's are exactly the ${OUTSIDER.length} it tried, all 404`,
      strangerRefused.length === OUTSIDER.length && strangerRefused.every((r) => r.status === 404),
      strangerRefused.map((r) => `${r.status} ${r.url}`).join(" | "));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // JOURNEY 6 — the two fixes from the last round, in a browser this time
  // ════════════════════════════════════════════════════════════════════════════
  if (want(6)) {
    head("JOURNEY 6 — typing while Save is pending, and correcting while Check is pending");
    const { page } = await openApp(A, "J6");
    agentId = agentId ?? (await firstAgent(page));
    check("6-pre. there is an agent to work on", !!agentId, String(agentId));

    await openAgent(page, agentId);
    await press(page, "agent-automations", "id", agentId);
    await page.waitForFunction(() => /Automations|automation/i.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    await press(page, "agent-auto-new");
    await page.waitForSelector("#agAutoName");
    await type(page, "agAutoName", "Nightly note");
    // One step, valid, so Check has something to say.
    await press(page, "agent-auto-step-add", "type", "note");
    await page.waitForSelector(".ag-step");
    await page.fill('.ag-step [data-field="text"]', "Hello there");
    await page.fill('.ag-step [data-field="out"]', "greeting");
    await press(page, "agent-auto-save");
    await page.waitForFunction(() => /Saved\./.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    check("6a. a one-step automation saved from the form", /Saved\./.test(await text(page)));

    // ── SAVE PENDING, then type a newer name ────────────────────────────────
    // The response is held by the ROUTE, in the browser, so the press is real and the
    // answer lands late — which is the only way this defect exists at all.
    await page.evaluate(() => {
      window.__hold = {};
      window.__hold.p = new Promise((r) => { window.__hold.release = r; });
    });
    await page.route("**/api/agent/automation-update", async (route) => {
      await page.evaluate(() => window.__hold.p).catch(() => {});
      await route.continue();
    });
    await type(page, "agAutoName", "Nightly note v2");
    await press(page, "agent-auto-save");
    await page.waitForTimeout(150);
    await page.fill("#agAutoName", "Nightly note v3");
    const caretBefore = await page.evaluate(() => {
      const el = document.getElementById("agAutoName");
      el.focus(); el.setSelectionRange(5, 5);
      return { id: document.activeElement?.id, at: el.selectionStart };
    });
    await page.evaluate(() => window.__hold.release());
    await page.waitForFunction(() => !/Saving/.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    await page.unroute("**/api/agent/automation-update");

    const after = await page.evaluate(() => ({
      value: document.getElementById("agAutoName")?.value,
      focus: document.activeElement?.id,
      at: document.getElementById("agAutoName")?.selectionStart,
      saved: /Saved\./.test(document.getElementById("viewAgents")?.textContent || ""),
    }));
    check("6b. ⚠ the newer name typed while Save was pending SURVIVED", after.value === "Nightly note v3", JSON.stringify(after.value));
    check("6c. ...and it is NOT reported as saved, because it was not sent", after.saved === false);
    check("6d. ...and the caret and the focus stayed where the person left them",
      after.focus === "agAutoName" && after.at === caretBefore.at, `${after.focus}@${after.at} vs @${caretBefore.at}`);

    // Pressing Save again must really send it — the defect's other half was a dead press.
    await press(page, "agent-auto-save");
    await page.waitForFunction(() => /Saved\./.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    const stored = await page.evaluate(async (id) => {
      const r = await fetch("/api/agent/automations?agent=" + id, { headers: { authorization: "Bearer " + (await Auth.accessToken()) } });
      return (await r.json()).automations?.[0]?.name;
    }, agentId);
    check("6e. ...and the next press really stored it", stored === "Nightly note v3", JSON.stringify(stored));

    // ── CHECK PENDING, then correct the step ────────────────────────────────
    // Break the workflow, hold Check's answer, fix it, release: the stale refusal must go.
    await page.fill('.ag-step [data-field="text"]', "Hello {{missing}}");
    await press(page, "agent-auto-check");
    await page.waitForFunction(() => /needs|missing|isn|nothing is missing/i.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    const refused = await text(page);
    check("6f. Check refused the broken reference and said which step", /step 1/i.test(refused) || /missing/i.test(refused),
      (refused.match(/step 1[^<]{0,60}/i) || [""])[0]);

    await page.evaluate(() => {
      window.__hold2 = {};
      window.__hold2.p = new Promise((r) => { window.__hold2.release = r; });
    });
    await page.route("**/api/agent/automation-check", async (route) => {
      await page.evaluate(() => window.__hold2.p).catch(() => {});
      await route.continue();
    });
    await press(page, "agent-auto-check");
    await page.waitForTimeout(150);
    await page.fill('.ag-step [data-field="text"]', "Hello there again");
    await page.evaluate(() => window.__hold2.release());
    await page.waitForTimeout(400);
    await page.unroute("**/api/agent/automation-check");
    const corrected = await text(page);
    check("6g. ⚠ the stale refusal did NOT land on the corrected workflow", !/\{\{missing\}\}/.test(corrected) && !/step 1:/i.test(corrected),
      (corrected.match(/step 1:[^<]{0,50}/i) || [""])[0]);
    check("6h. ...and the corrected text is what is on screen",
      (await page.inputValue('.ag-step [data-field="text"]')) === "Hello there again");
    await shot(page, "j6-after-corrections");
    check("6i. no page error anywhere in journey 6", pageProblems.length === 0, pageProblems.slice(0, 2).join(" | "));
    check("6j. ...and no /api/agent/ call this journey's own session made was refused",
      refusedIn("J6").length === 0,
      refusedIn("J6").slice(0, 3).map((r) => `${r.status} ${r.url}`).join(" | "));
  }


  // ════════════════════════════════════════════════════════════════════════════
  // JOURNEY 7 — stopping a run, from the history, with one action already gone
  //
  // ⚠ **TWO SENDS, AND THAT IS WHAT MAKES THIS ONE JOURNEY RATHER THAN TWO.** The
  // milestone asks for *start → wait for approval → stop → attempt a late approval →
  // confirm no send*, and for *start → complete one action → stop → preserve that result
  // and prevent later actions*. A workflow that sends twice is both at once: the first
  // send really goes out, the second is the one somebody stops, and the mailbox
  // afterwards is the only reading that can tell "preserved" from "never happened".
  //
  // ⚠ **AND THE CONFIRMATION IS A REAL `window.confirm`, so Playwright's DEFAULT is the
  // refusal half — free.** It dismisses a dialog nobody handles, which is exactly a person
  // pressing Cancel, and a first pass that forgot to accept one would report the button as
  // dead rather than reporting itself as unhandled. So the refusal is DRIVEN first, with
  // the acceptance after it, and the two are each other's control.
  // ════════════════════════════════════════════════════════════════════════════
  if (want(7)) {
    head("JOURNEY 7 — one action goes, then somebody stops the run");
    const { page } = await openApp(A, "J7");
    agentId = agentId ?? (await firstAgent(page));
    connId = connId ?? (await page.evaluate(async (a) => {
      const r = await fetch("/api/agent/connections?agent=" + a, { headers: { authorization: "Bearer " + (await Auth.accessToken()) } });
      return ((await r.json()).connections || []).find((c) => c.status === "active")?.id ?? null;
    }, agentId));
    await openAgent(page, agentId);
    await press(page, "agent-automations", "id", agentId);
    await page.waitForSelector('[data-act="agent-auto-new"]', { timeout: 10_000 });

    /**
     * ⚠ **THE DIALOG IS ANSWERED BY ONE HANDLER WHOSE ANSWER THIS JOURNEY CHANGES**, rather
     * than by adding and removing listeners around each press. Playwright queues dialogs, so
     * a second listener would leave the first one answering too and the two would race for
     * which verdict the page sees.
     */
    let sayYes = false;
    const asked = [];
    page.on("dialog", async (d) => { asked.push(d.message()); await (sayYes ? d.accept() : d.dismiss()); });

    // ── A WORKFLOW THAT SENDS TWICE, built on the form ───────────────────────
    await press(page, "agent-auto-new");
    await page.waitForSelector("#agAutoName", { timeout: 10_000 });
    await type(page, "agAutoName", "Two notices");
    await addStep(page, "send", { connection: connId, to: RECIPIENT, body: "the first notice" });
    await addStep(page, "send", { connection: connId, to: RECIPIENT2, body: "the second notice" });
    await press(page, "agent-auto-save");
    await waitText(page, /Saved\./, "the two-send workflow to save", 10_000);
    const AU7 = await autoIdNamed(page, agentId, "Two notices");
    check("7a. a workflow with two sends saved from the form", !!AU7, String(AU7));

    const before7 = mailbox(ACCOUNT).length;
    await closeAutoForm(page);
    await press(page, "agent-auto-run", "id", AU7);
    await waitText(page, /Queued|Running|Waiting/, "the run to appear", 10_000);
    await disp.drain();
    await waitText(page, /Waiting/, "the first send to hold for a person");

    /**
     * ⚠ **STOP IS OFFERED BECAUSE THE RUN IS IN ONE OF THE THREE STATES IT CAN BE STOPPED
     * IN — `AUTO_STOPPABLE` — and the row says what stopping would reach BEFORE the press.**
     * The confirm is gone the instant somebody answers it, so a scope named only there is a
     * scope named too late. Asserted on the row's own hint rather than on the dialog.
     */
    const row7 = autoRow(AU7);
    check("7b. ⚠ the waiting run offers Stop", await has(page, `${row7} [data-act="agent-auto-stop"]`));
    const hint7 = await page.$$eval(`${row7} .ag-hint`, (els) => els.map((e) => (e.textContent || "").trim()).join(" | "));
    /**
     * ⚠ **THE THREE REMEDIES, not the word "run" — a first draft asked `/this run/` and the
     * sentence says "this one run", so it went red about a screen that is right.** What the
     * requirement asks for is that stopping ONE run, disabling the automation and pausing the
     * agent are told apart, and the property is therefore the three things to DO, each of which
     * names a different control.
     */
    check("7c. ⚠ ...and the row names all three scopes by what each one takes — the run, the automation, the agent",
      /one run and nothing else/i.test(hint7) && /turn the automation off/i.test(hint7) &&
        /pause the agent/i.test(hint7), hint7.replace(/\s+/g, " ").slice(0, 200));

    // ── THE REFUSAL HALF, FIRST, and it is the dialog's own default ──────────
    const run7 = await page.getAttribute(`${row7} [data-act="agent-auto-stop"]`, "data-run");
    sayYes = false;
    await press(page, "agent-auto-stop", "run", run7);
    await page.waitForTimeout(400);
    check("7d. ⚠ the press really asked, and named what stopping cannot take back",
      asked.length === 1 && /cannot take a message back/i.test(asked[0]), JSON.stringify((asked[0] || "").slice(0, 120)));
    const stillWaiting = JSON.parse(stack.q(
      `select coalesce(to_json((select json_build_object('s', status) from agent.runs where id='${run7}'))::text,'null');`));
    check("7e. ⚠ ...and answering NO stopped nothing at all", stillWaiting?.s === "running", JSON.stringify(stillWaiting));

    // ── APPROVE THE FIRST SEND, so one action really goes out ────────────────
    await press(page, "agent-auto-approve", "run", run7);
    await page.waitForFunction(() => !/Sending…/.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 10_000 });
    await disp.drain();
    await waitText(page, /Waiting/, "the SECOND send to hold");
    const afterFirst = mailbox(ACCOUNT);
    check("7f. ⚠ ONE action has gone, and it is the first", afterFirst.length === before7 + 1 &&
      afterFirst[afterFirst.length - 1]?.to === RECIPIENT, JSON.stringify(afterFirst.map((m) => m.to)));
    check("7g. ...and the second send is holding rather than having gone",
      !afterFirst.some((m) => m.to === RECIPIENT2), JSON.stringify(afterFirst.map((m) => m.to)));

    /**
     * ⚠ **A SECOND TAB, OPENED WHILE APPROVE IS STILL DRAWN — because that is what a late
     * approval really is.** `siteApi` refuses `/api/agent/automation-approve`, and it is right
     * to: that route has a screen, so calling it here would be the shortcut the door exists to
     * forbid. What a person can actually do is leave a tab open, have somebody stop the run in
     * another, and press the Approve that is still sitting in the first tab's DOM. So the stale
     * control is REAL rather than fabricated, and the check below presses it.
     */
    const stale = await openApp(A, "J7-stale");
    await openAgent(stale.page, agentId);
    await press(stale.page, "agent-automations", "id", agentId);
    await openHistory(stale.page, AU7);
    await waitText(stale.page, /Waiting/, "the second tab to show the run still waiting");
    check("7g2. ⚠ a second tab of the same account shows Approve while it is still waiting",
      await has(stale.page, `[data-act="agent-auto-approve"][data-run="${run7}"]`));

    // ── NOW STOP IT, with a reason typed the way a person types one ──────────
    await refreshHistory(page, AU7);
    await page.fill(`[data-note="${run7}"]`, "we posted it instead");
    sayYes = true;
    await press(page, "agent-auto-stop", "run", run7);
    await waitText(page, /Stopped\./, "the screen to say it stopped", 15_000);
    const said7 = await text(page);
    /**
     * ⚠ **WHAT IT SAYS IS THE COUNTS AND NEVER A ROLLBACK, asserted POSITIVELY.** Forbidding
     * the word `undone` is what a first draft of `verify:send` did, and it goes red on the
     * honest sentence — which says the completed work was *not* undone. So the claim is that
     * the *not undone* half is SAID, beside a phrase no honest answer carries.
     */
    /**
     * ⚠ **ONE STEP, AND NO "actions had gone out" CLAUSE — which is the product being right and
     * my own expectation being wrong.** `completedCalls` counts the journal's `tool` entries,
     * which is the AGENT loop's vocabulary; a workflow execution writes none, so it is 0 and the
     * clause is correctly left off. The send really did go — through the connection, recorded as
     * the step's own outcome — and `completedSteps` is what counts it. A screen that said
     * "1 action had already gone out" here would be reading an agent's tool budget onto an
     * automation, which is two different things wearing one number.
     */
    check("7h. ⚠ it says how far it got — one step, and no tool-call clause a workflow cannot have",
      /1 step had already run\./.test(said7) && !/action(s)? had already gone out/.test(said7),
      (said7.match(/Stopped\.[\s\S]{0,150}/) || [""])[0].replace(/\s+/g, " "));
    check("7i. ⚠ ...and never claims a rollback", /was not undone/i.test(said7) &&
      !/(reversed|rolled back|taken back|recalled)/i.test(said7));
    /**
     * ⚠ **AND NOTHING WAS WORKING ON IT, SO THE DELAY SENTENCE IS CORRECTLY ABSENT.** A run
     * suspended for a person has released its work row, so `heldByWorker` is false and saying
     * *"the step it had already started may finish"* would be this screen inventing a delay
     * the platform does not have. **The `true` half cannot be arranged from a browser** — it
     * needs a worker holding a claim mid-flight — and is driven at the route and at the
     * renderer instead (`agent-api` and `agent-binding`), which is said rather than glossed.
     */
    check("7j. ⚠ ...and does not warn of a step still finishing, because nothing held it",
      !/may finish/i.test(said7));

    const stopped7 = JSON.parse(stack.q(
      `select coalesce(to_json((select json_build_object(
         's', r.status, 'stops', (select count(*) from agent.run_entries e where e.run_id=r.id and e.body->>'kind'='stopped'),
         'reason', r.stop->>'reason', 'why', r.stop->>'note',
         'work', (select count(*) from agent.run_work w where w.run_id=r.id and w.done_at is null)
       ) from agent.runs r where r.id='${run7}'))::text,'null');`));
    /**
     * ⚠ **THE PERSON'S OWN WORDS ARE ASSERTED, AND THAT IS THE DEFECT THIS JOURNEY FOUND.**
     * `agentAutoNotes` was filled only by `renderAgents`, so a reason typed and followed
     * straight by the button was read from the box's PREVIOUS contents — measured here as
     * `note: null`. Both handlers read the box at the point of use now. The words being in the
     * row is what makes this check about the reason rather than about the stop.
     */
    check("7k. ⚠ the run is stopped in the database, with ONE ending and the person's own words",
      stopped7?.s === "stopped" && stopped7?.stops === 1 && stopped7?.reason === "cancelled" &&
      stopped7?.why === "we posted it instead" && stopped7?.work === 0, JSON.stringify(stopped7));

    // ── THE LATE APPROVAL, PRESSED IN THE STALE TAB ─────────────────────────
    await press(stale.page, "agent-auto-approve", "run", run7);
    await stale.page.waitForFunction(() => !/Sending…/.test(document.getElementById("viewAgents")?.textContent || ""), { timeout: 15_000 });
    await disp.tick();
    await disp.drain();
    const staleSaid = await text(stale.page);
    /**
     * ⚠ **REFUSED, AND THE STALE TAB IS TOLD — which is the half that matters to a person.** A
     * press that answered `ok` and changed nothing would be the dead control that ANSWERS; what
     * the screen has to do is say the decision did not take. Asserted on the SENTENCE and on the
     * mailbox, because either alone is weak: a refusal with a message sent is the defect, and a
     * silent nothing is a screen that lied about the press.
     */
    check("7l. ⚠ A LATE APPROVAL IS REFUSED, and the stale tab says so rather than claiming it took",
      /(isn.t waiting|already|stopped|couldn.t)/i.test(staleSaid) && !/Done/.test(staleSaid.slice(0, 400)),
      staleSaid.replace(/\s+/g, " ").slice(0, 200));
    const afterLate = mailbox(ACCOUNT);
    check("7m. ⚠ ...and NOTHING was sent — the first message stands and the second never went",
      afterLate.length === before7 + 1 && !afterLate.some((m) => m.to === RECIPIENT2),
      JSON.stringify(afterLate.map((m) => m.to)));
    /**
     * ⚠ **AND THE DATABASE HAS NO SECOND VERDICT, which is what says the refusal happened at
     * the wall rather than in the screen's own wording.** A decision recorded against a stopped
     * run would be a row nothing will ever act on, sitting there as evidence somebody approved
     * something that never ran.
     */
    /**
     * ⚠ **THE REQUEST STILL SAYS IT WAS WITHDRAWN BY THE CANCELLATION, which is what says the
     * refusal happened at the WALL rather than in the screen's own wording.** `cancel_run`
     * withdraws anything waiting for a person (`verdict = 'revoked'`, carrying the reason they
     * typed), and `decide_tool_approval` only ever writes `where verdict is null` — so a late
     * approval that had landed would have overwritten the record of WHY the run stopped with an
     * approval nobody acted on. Asserted as `revoked` AND not `approved`, and with the person's
     * own words still on it.
     *
     * ⚠ NO NESTED SINGLE QUOTES, AND NO `jsonb_array_length` EITHER — `stack.q` hands the
     * statement to `psql -c` inside single quotes, so a `'[]'::jsonb` literal closes it and the
     * shell reports a syntax error as a crash; and `automation_runs.decisions` is an OBJECT
     * keyed by step, so asking for an array's length raises. Both were mine.
     */
    const req7 = JSON.parse(stack.q(
      `select coalesce(to_json((select json_build_object('v', verdict, 'n', note)
         from agent.tool_approvals where run_id='${run7}' order by requested_at desc limit 1))::text, 'null');`));
    check("7m2. ⚠ ...and the request still reads as WITHDRAWN by the cancellation, not approved",
      req7?.v === "revoked" && req7?.n === "we posted it instead", JSON.stringify(req7));

    /**
     * ⚠ **A SECOND STOP IS IMPOSSIBLE FROM THE SCREEN, which is stronger than harmless.** The
     * button is drawn only for a stoppable state, so once the run has stopped there is nothing
     * to press — the dead control that ANSWERS cannot exist here. The ROUTE's own duplicate is
     * a different question and is driven in `verify:tools`, where a second stop answers what
     * really happened and writes no second ending.
     */
    /**
     * ⚠ **THE PANEL IS DRAWN BEFORE ITS ROWS ARE, so waiting for the panel is not waiting for
     * the history.** `refreshHistory` closes and re-opens, and the re-open renders the container
     * immediately and fills it when the read lands — so a check that ran straight after it read
     * an EMPTY panel and reported a working screen as having no chip and no Stop button.
     * Measured: `runs: 1` container, `.ag-run: 0` rows. The wait belongs here rather than in the
     * shared helper, because an automation with no executions legitimately has an empty panel
     * and a helper that waited for a row would hang on one.
     */
    await refreshHistory(page, AU7);
    await page.waitForSelector(`${row7} .ag-run`, { timeout: 15_000 });
    check("7n. ⚠ a stopped run offers no Stop at all", !(await has(page, `${row7} [data-act="agent-auto-stop"]`)));
    const chips7 = await page.$$eval(`${row7} .ag-chip`, (els) => els.map((e) => e.className + "=" + (e.textContent || "").trim()));
    check("7o. ...and the row reads as stopped by somebody rather than as a failure",
      chips7.some((c) => /ag-chip-cancelled/.test(c)) && !chips7.some((c) => /ag-chip-failed/.test(c)),
      chips7.join(" | "));
    const tickAfter = await disp.tick();
    check("7p. ⚠ ...and a tick afterwards does not offer it again",
      !JSON.stringify(tickAfter ?? {}).includes(run7), JSON.stringify(tickAfter ?? {}).slice(0, 120));

    await shot(page, "j7-stopped");
    check("7q. no page error anywhere in journey 7", pageProblems.length === 0, pageProblems.slice(0, 2).join(" | "));
    /**
     * ⚠ **SCOPED TO THE FIRST TAB, BECAUSE THE STALE TAB'S REFUSAL IS THE POINT.** `refusedIn`
     * matches by label PREFIX and `J7-stale` starts with `J7`, so asking about `J7` would go red
     * on the one call this journey exists to have refused. The stale tab answers for itself: its
     * ONLY refused call may be the late approval, which is asserted rather than excused.
     */
    const mine7 = refusedIn("J7").filter((r) => !r.label.startsWith("J7-stale"));
    check("7r. ...and no /api/agent/ call the FIRST tab made was refused",
      mine7.length === 0, mine7.slice(0, 3).map((r) => `${r.status} ${r.url}`).join(" | "));
    /**
     * ⚠ **AND THE STALE TAB'S REFUSAL IS IN THE ANSWER RATHER THAN IN THE STATUS, which is the
     * product being right and my own expectation being wrong.** `decide_tool_approval` writes
     * only `where verdict is null`, so a request already decided answers `ok: true, repeat:
     * true` — *the first answer stands* — and that is a 200, because nothing went wrong and the
     * request was well formed. A 4xx there would tell a person their press was malformed when
     * what happened is that somebody had already answered. So the refusal is asserted on the
     * SENTENCE (7l) and on the mailbox (7m); what this asks is that nothing was refused at the
     * transport, which is a different claim and would be red if the route had started erroring.
     */
    const stale7 = refusedIn("J7-stale");
    check("7s. ⚠ ...and the stale tab was answered rather than refused — the first answer stands is a 200",
      stale7.length === 0, stale7.map((r) => `${r.status} ${r.url}`).join(" | ") || "none");
  }

  head(failed ? `${failed} CHECK(S) FAILED` : "ALL CHECKS PASSED");
  if (fails.length) for (const f of fails) console.log(`  · ${f}`);
} finally {
  await browser.close();
  await site.close();
  await stack.tearDown();
}
process.exit(failed ? 1 : 0);
