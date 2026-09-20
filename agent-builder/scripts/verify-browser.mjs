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

const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const DB = `agent_browser_${process.pid}`;
/** Account A is the customer. Account B is the one next door. TWO TENANTS. */
const A = { uid: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa", email: "shop@example.test", token: "tok-a" };
const B = { uid: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb", email: "next-door@example.test", token: "tok-b" };
const ZONE = "Europe/London";
/** The account a person connects, and who the example's workflow writes to. */
const ACCOUNT = "shop@example.test";
const RECIPIENT = "ada@example.test";
/** The two arms of journey 2's branch — one of them must be nowhere near the message. */
const FORMAL = "Dear {{who}}, regarding {{topic}}: {{facts}} (scripted, not written by a model)";
const CASUAL = "Hi {{who}} — about {{topic}}: {{facts}} (scripted, not written by a model)";
const ONLY = process.argv.slice(2).filter((s) => /^[1-6]$/.test(s)).map(Number);
const want = (n) => !ONLY.length || ONLY.includes(n);
/**
 * ⚠ **THE JOURNEYS ARE A SEQUENCE, AND A SELECTION THAT LEAVES OUT WHAT ONE RESTS ON IS
 * REFUSED BY NAME rather than crashing on a control that is not there.** Journey 1 creates the
 * agent, its reference material and its memory; 2–5 are that customer carrying on. Running `2`
 * on its own is a selection nobody can satisfy, and saying so beats a timeout on
 * `[data-id="null"]`.
 */
const RESTS_ON = { 2: [1], 3: [1, 2], 4: [1, 2], 5: [1] };
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
const disp = dispatcher({ worker, rest: stack.rest, model });
const site = await startLocalSite({
  rest: stack.rest,
  ring: disp.ring,
  tokens: new Map([[A.token, A.uid], [B.token, B.uid]]),
});
const mailbox = (account) => ADAPTERS[FAKE_PROVIDER].mailbox(account);
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
    check("1o. ...and no /api/agent/ call the page made was refused", agentFailures().length === 0,
      agentFailures().slice(0, 3).map((r) => `${r.status} ${r.url}`).join(" | "));
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
    check("2p. no page error anywhere in journey 2", pageProblems.length === 0, pageProblems.slice(0, 2).join(" | "));
    check("2q. ...and no /api/agent/ call the page made was refused", agentFailures().length === 0,
      agentFailures().slice(0, 3).map((r) => `${r.status} ${r.url}`).join(" | "));
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
    check("6j. ...and no /api/agent/ call the page made was refused", agentFailures().length === 0,
      agentFailures().slice(0, 3).map((r) => `${r.status} ${r.url}`).join(" | "));
  }

  head(failed ? `${failed} CHECK(S) FAILED` : "ALL CHECKS PASSED");
  if (fails.length) for (const f of fails) console.log(`  · ${f}`);
} finally {
  await browser.close();
  await site.close();
  await stack.tearDown();
}
process.exit(failed ? 1 : 0);
