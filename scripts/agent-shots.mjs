#!/usr/bin/env node
/**
 * SCREENSHOTS OF THE AGENT SCREEN, from the real page and the real stylesheet.
 *
 * **THE OWNER REVIEWS EVERY UI CHANGE AS A PICTURE**, and the agent screen is behind a
 * sign-in that needs a service key this session has not got. So the page is served from
 * disk and its `fetch` is replaced IN THE BROWSER with fixture answers — everything else
 * is the real thing: `index.html`, `styles.css`, `chat.js`, and Chromium laying them out.
 *
 * **IT TOUCHES NOTHING LIVE.** No credential, no network, no account: `Auth` is stubbed
 * signed-in and every `/api/agent/*` call is answered from the fixtures below. What it
 * can therefore show is LAYOUT and WORDS — which is what a design review is about — and
 * what it cannot show is whether the server would really answer that way, which is what
 * the suites and the demonstration are for.
 *
 *   node scripts/agent-shots.mjs [outDir]
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "shots"));
fs.mkdirSync(OUT, { recursive: true });

// ── the fixtures, in the shapes the real routes answer ──────────────────────
const { AUTOMATION_STEPS, AUTOMATION_DAYS } = await import(path.join(ROOT, "agent-store.mjs"));
const AGENT = { id: "A", name: "Bike shop", instructions: "Answer about the shop.", created: 1, updated: 1, preview: "", status: "active", tools: [] };
const AUTO = {
  id: "AU1", agentId: "A", name: "Quote reply", enabled: true, schedule: "manual",
  at: null, zone: "Europe/London", nextRunAt: null, updatedAt: "2026-09-17T10:00:00Z",
  inputs: [{ name: "topic", label: "What it is about", required: true, default: "boiler service" }],
  steps: [
    { id: "s1", type: "knowledge", query: "{{topic}}", out: "facts" },
    { id: "s2", type: "memory", key: "tone", out: "tone" },
    { id: "s3", type: "if", left: "{{tone}}", op: "is", right: "formal" },
    { id: "s4", type: "note", text: "Dear customer, regarding {{topic}}.", out: "draft" },
    { id: "s5", type: "otherwise" },
    { id: "s6", type: "note", text: "Hi! About your {{topic}} —", out: "draft" },
    { id: "s7", type: "end" },
    { id: "s8", type: "approval", ask: "Send this to the customer?", hours: 24, on_timeout: "reject" },
    { id: "s9", type: "note", text: "SENT: {{draft}} Our notes say: {{facts}}" },
  ],
};
const WAITING = {
  id: "R9", automationId: "AU1", trigger: "manual", occurrence: null, state: "waiting",
  at: "2026-09-17T10:02:00Z", finishedAt: null, position: 7,
  values: { facts: "Price list: Boiler service is £95 including parts.", tone: "formal", draft: "Dear customer, regarding boiler service." },
  input: { topic: "boiler service" }, decisions: {},
  waiting: { kind: "approval", step: "s8", ask: "Send this to the customer?", onTimeout: "reject", until: "2026-09-18T10:02:00Z" },
  steps: AUTO.steps,
  outcomes: [
    { id: "s1", type: "knowledge", outcome: "ran", why: 'searched for "boiler service" and found 1 passage in 1 source', sources: [{ title: "Price list", version: 2 }] },
    { id: "s2", type: "memory", outcome: "ran", why: 'remembered under "tone"' },
    { id: "s3", type: "if", outcome: "ran", took: "first", why: "it matched" },
    { id: "s4", type: "note", outcome: "ran", result: "Dear customer, regarding boiler service." },
    { id: "s5", type: "otherwise", outcome: "skipped", why: 'the steps under "If" ran, so this arm didn\'t' },
    { id: "s6", type: "note", outcome: "skipped", why: 'the steps under "If" ran, so this arm didn\'t' },
    { id: "s7", type: "end", outcome: "ran", why: "both arms rejoin here" },
    { id: "s8", type: "approval", outcome: "waiting", why: "waiting to be approved: Send this to the customer?" },
  ],
};
const DONE = {
  ...WAITING, id: "R8", state: "done", at: "2026-09-17T09:40:00Z", finishedAt: "2026-09-17T09:41:00Z",
  result: "SENT: Dear customer, regarding boiler service. Our notes say: Price list: Boiler service is £95 including parts.",
  waiting: null, position: 9,
  decisions: { s8: { verdict: "approved", note: "prices look right", by: "u1" } },
  outcomes: [...WAITING.outcomes.slice(0, 7),
    { id: "s8", type: "approval", outcome: "ran", why: "approved: prices look right" },
    { id: "s9", type: "note", outcome: "ran", result: "SENT: Dear customer, regarding boiler service." }],
};
const REJECTED = {
  ...DONE, id: "R7", state: "rejected", result: null, why: "rejected: wrong customer",
  decisions: { s8: { verdict: "rejected", note: "wrong customer", by: "u1" } },
  outcomes: [...WAITING.outcomes.slice(0, 7),
    { id: "s8", type: "approval", outcome: "ran", why: "rejected: wrong customer" },
    { id: "s9", type: "note", outcome: "skipped", why: "it wasn't approved, so this one didn't run" }],
};
const SOURCES = [
  { id: "K1", title: "Price list", format: "text", version: 2, at: "2026-09-16T09:00:00Z", updatedAt: "2026-09-17T08:00:00Z" },
  { id: "K2", title: "Opening hours", format: "markdown", version: 1, at: "2026-09-16T09:10:00Z", updatedAt: "2026-09-16T09:10:00Z" },
];
const MEMORIES = [
  { id: "M1", key: "tone", value: "formal", source: "person", version: 2, at: "2026-09-16T09:00:00Z", updatedAt: "2026-09-17T08:30:00Z" },
  { id: "M2", key: "callback_hours", value: "weekdays before five", source: "person", version: 1, at: "2026-09-16T09:05:00Z", updatedAt: "2026-09-16T09:05:00Z" },
];

/**
 * CONNECTED ACCOUNTS, in the four states a screen has to be able to explain — and the
 * catalog beside them, because the form draws its permissions from the answer rather than
 * from a list of its own.
 */
const { AGENT_PROVIDERS, connectionRow } = await import(path.join(ROOT, "agent-store.mjs"));
const CONNS = [
  connectionRow({ id: "8f3c1e20-0000-4000-8000-00000000c001", agent_id: "A", provider: "fakemail",
    label: "The shop", account: "shop@example.test", scopes: ["read", "send"],
    status: "active", refreshable: false, created_at: "2026-09-18T09:00:00Z" }),
  connectionRow({ id: "8f3c1e20-0000-4000-8000-00000000c002", agent_id: "A", provider: "fakemail",
    label: "Old address", account: "old@example.test", scopes: ["send"],
    status: "expired", refreshable: true, expires_at: "2026-09-18T12:00:00Z",
    created_at: "2026-09-10T09:00:00Z" }),
  connectionRow({ id: "8f3c1e20-0000-4000-8000-00000000c003", agent_id: "A", provider: "fakemail",
    label: "Workshop", account: "workshop@example.test", scopes: ["send"],
    status: "revoked", stopped_why: "the provider said no", created_at: "2026-09-11T09:00:00Z" }),
];

const ANSWERS = {
  "/api/agent/list": { ok: true, agents: [AGENT], tools: [{ name: "echo", label: "Echo", does: "Repeats a short piece of text back." }] },
  "/api/agent/messages": { ok: true, id: "A", messages: [] },
  "/api/agent/automations": { ok: true, agent: "A", automations: [AUTO], steps: AUTOMATION_STEPS, days: AUTOMATION_DAYS, max: 20 },
  "/api/agent/automation-history": { ok: true, id: "AU1", executions: [WAITING, DONE, REJECTED] },
  "/api/agent/knowledge": { ok: true, agent: "A", sources: SOURCES, max: 20, bodyMax: 200000, formats: ["text", "markdown"] },
  "/api/agent/memory": { ok: true, agent: "A", memories: MEMORIES, max: 100, valueMax: 4000 },
  "/api/agent/connections": { ok: true, agent: "A", connections: CONNS, providers: AGENT_PROVIDERS, max: 20 },
};

// ── serve `public/` on a loopback port, so the page loads exactly as it ships ─
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  const name = (req.url || "/").split("?")[0];
  const file = path.join(ROOT, "public", name === "/" ? "index.html" : name.replace(/^\/+/, ""));
  if (!file.startsWith(path.join(ROOT, "public")) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("no"); return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));

// EVERYTHING IS STUBBED BEFORE THE PAGE'S OWN SCRIPTS RUN, so nothing ever reaches out.
await page.addInitScript(({ answers }) => {
  const real = window.fetch;
  window.fetch = async (u, init) => {
    const p = String(typeof u === "string" ? u : u.url).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (Object.prototype.hasOwnProperty.call(answers, p)) {
      return new Response(JSON.stringify(answers[p]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (p.startsWith("/api/")) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    return real(u, init);
  };
  window.__AGENT_SHOTS = true;
}, { answers: ANSWERS });

await page.goto(`${origin}/index.html`, { waitUntil: "load" });
// SIGNED IN, IN THE PAGE'S OWN TERMS. `Auth` is the page's sibling script and this is a
// stub of it, exactly as the unit guard stubs it — the one thing a screenshot cannot have.
await page.evaluate(() => {
  window.Auth = {
    isSignedIn: () => true, userId: () => "u1", email: () => "owner@example.com",
    token: async () => "t", signOut: async () => {}, onChange: () => {},
  };
  document.getElementById("marketing")?.style.setProperty("display", "none");
  if (typeof enterApp === "function") enterApp();
  if (typeof showView === "function") showView("agents");
});
await page.waitForTimeout(400);

/**
 * ⚠ **THE ELEMENT, NEVER `fullPage`.** This app is a fixed-height layout with its own
 * scrolling panel, so `fullPage: true` grows the VIEWPORT, the panel does not follow, and
 * the capture is the first 530px of the screen above a page-height field of background —
 * measured, on the first run of this script. What the owner needs to see is the panel, so
 * the panel is what is captured, with the viewport made tall enough to hold it first.
 */
const shot = async (name, prepare) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(prepare);
  await page.waitForTimeout(350);
  // ⚠ **THE INNER SCROLLERS ARE OPENED FOR THE CAPTURE, and this is the second half of the
  // same problem.** The panel's own height is the viewport's, because the list inside it
  // scrolls — so measuring `#viewAgents` alone gives 948 every time and a history of three
  // executions is photographed as one and a half. A capture-time override, declared here
  // rather than left as a mystery, and it changes nothing about the product: the page is
  // reloaded for nothing, the style is set on the DOM in front of the camera only.
  const need = await page.evaluate(() => {
    const root = document.getElementById("viewAgents");
    if (!root) return 0;
    for (const el of [root, ...root.querySelectorAll("*")]) {
      const st = getComputedStyle(el);
      if (st.overflowY === "auto" || st.overflowY === "scroll" || st.maxHeight !== "none") {
        el.style.setProperty("max-height", "none", "important");
        el.style.setProperty("height", "auto", "important");
        el.style.setProperty("overflow", "visible", "important");
      }
    }
    return Math.ceil(root.scrollHeight);
  });
  await page.setViewportSize({ width: 1280, height: Math.max(700, Math.min(need + 160, 6000)) });
  await page.waitForTimeout(250);
  const el = await page.$("#viewAgents");
  const file = path.join(OUT, `${name}.png`);
  await (el ?? page).screenshot({ path: file });
  const box = el ? await el.boundingBox() : null;
  console.log(`  ${name}.png  ${box ? `${Math.round(box.width)}×${Math.round(box.height)}` : "page"}  ${fs.statSync(file).size} bytes`);
};

// ⚠ EACH SHOT CLOSES WHATEVER THE LAST ONE OPENED. The form, the history and the ask
// dialog are three states of one screen, and leaving one open makes the next five
// pictures the same picture — measured, on the second run of this script.
console.log("agent screen:");
await shot("1-agents", () => { agentsLoad(); });
await page.waitForTimeout(400);
await shot("2-automations-list", () => { agentAutomations("A"); });
await page.waitForTimeout(500);
await shot("3-workflow-form", () => { agentAutoEdit("AU1"); });
await shot("4-run-now-asks", () => { agentAutoCancel(); agentAutoRunPress("AU1"); });
await shot("5-history", () => { agentAutoAskCancel(); agentAutoHistory("AU1"); });
await page.waitForTimeout(500);
await shot("6-knowledge", () => { agentAutoBack(); agentKnows("A"); });
await page.waitForTimeout(500);
await shot("7-knowledge-edit", () => { agentKnowEdit("K1"); });
await page.waitForTimeout(400);
// ⚠ CONNECTED ACCOUNTS: the list first, with all three states side by side, so the reasons
// one cannot be used are readable beside a working one — then the connect form, which is the
// one place a person grants permissions and the one place it has to be plain that no
// credential is being asked for.
await shot("8-connections", () => { agentKnowCancel(); agentConnections("A"); });
await page.waitForTimeout(500);
await shot("9-connect-form", () => { agentConnNewOpen(); });
await page.waitForTimeout(400);

await browser.close();
server.close();
console.log(`\nwritten to ${OUT}`);
