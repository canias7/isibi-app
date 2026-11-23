// CODER MADE TO MATCH CLAUDE CODE, SHEET ROWS "z4" (2026-11-23): Artifact's 16 MiB limit, its db capability and contract and
// result fields; /code-review --comment, /security-review, /team-onboarding, /rename and /autofix-pr; SendFeedback's review,
// send and dismiss; plugin marketplaces by Git URL with Claude Code's download and archive limits; the role picker's {}; the
// PushNotification facts; /clear on an ended chat. No paid calls: nothing reaches Grok or the network (fetch is faked).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { deflateRawSync } from "node:zlib";
import path from "node:path";

const ART = await import("../src/coder-artifacts.mjs");
const PG = await import("../src/gloopy-pages.mjs");
const R = await import("../container/coder-resources.mjs");
const ROUTES = await import("../src/coder-routes.mjs");
const PL = await import("../src/coder-plugins.mjs");
const MK = await import("../src/coder-marketplace.mjs");
const CP = await import("../container/coder-plugins.mjs");
const WT = await import("../container/coder-worktree.mjs");
const TOOLS = await import("../container/coder-tools.mjs");

const memBucket = () => { const m = new Map(); return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); } }; };
const KEY = { CODER_TOKEN_KEY: "k".repeat(40) };

// ── ARTIFACT ──
test("Z4-1 Artifact: pages up to 16 MiB (Claude Code's limit), Gloopy keeps 512 KB; the machine reads a file up to 16 MiB", async () => {
  assert.equal(ART.ARTIFACT_MAX, 16 * 1024 * 1024);
  assert.equal(PG.PAGE_MAX, 512 * 1024, "Gloopy's pages unchanged");
  const b = memBucket();
  const big = await ART.artifactNow(KEY, b, "u1", { kind: "coder" }, { html: "<p>" + "x".repeat(2 * 1024 * 1024) + "</p>", title: "Big" });
  assert.equal(big.ok, true);
  assert.match((await ART.artifactNow(KEY, b, "u1", { kind: "coder" }, { html: "x".repeat(ART.ARTIFACT_MAX + 1), title: "Too big" })).error, /at most 16 MiB/);
  assert.equal(TOOLS.FILE_READ_MAX, 16 * 1024 * 1024);
  assert.equal(R.ARTIFACT_FILE_MAX, 16 * 1024 * 1024);
  assert.match(R.ARTIFACT_DESCRIPTION, /16 MiB or smaller/);
});

test("Z4-2 Artifact capabilities: db is checked, stored, kept when left out, cleared by {}; an unknown one is refused; contract latest/1.0.0; the result's fields", async () => {
  const b = memBucket(), meta = { kind: "coder" };
  assert.match((await ART.artifactNow(KEY, b, "u1", meta, { html: "<p>a</p>", title: "A", capabilities: { camera: {} } })).error, /not one this account can use/);
  assert.match((await ART.artifactNow(KEY, b, "u1", meta, { html: "<p>a</p>", title: "A", capabilities: { db: { x: 1 } } })).error, /empty config/);
  assert.match((await ART.artifactNow(KEY, b, "u1", meta, { html: "<p>a</p>", title: "A", contract: "9.9.9" })).error, /not a runtime version Coder has/);
  const a = await ART.artifactNow(KEY, b, "u1", meta, { html: "<html><head><title>T</title></head><body>a</body></html>", title: "A", capabilities: { db: {} }, contract: "latest" }, { chat: "c1" });
  assert.equal(a.ok, true);
  assert.deepEqual([a.contract, a.capabilities, a.updated, a.liveSubscription, Array.isArray(a.warnings)], ["1.0.0", { db: {} }, false, false, true]);
  const a2 = await ART.artifactNow(KEY, b, "u1", meta, { html: "<p>a2</p>", title: "A", id: a.id, base: 1 }, { chat: "c1" });
  assert.deepEqual([a2.updated, a2.capabilities], [true, { db: {} }], "left out on a redeploy: kept");
  // The page gets window.claude.db and may call Coder's server; its database is shared and kept in R2.
  const served = await PG.withCapabilities(KEY, b, "u1", a.id, "<html><head></head><body></body></html>");
  assert.match(served.html, /window\.claude=Object\.assign/);
  assert.match(served.csp, /connect-src https:\/\/gofarther\.dev/);
  const t = await PG.dbPass(KEY, "u1", a.id);
  const call = (method, q, body) => PG.serveArtifactDb(new Request("https://x/?k=" + t + q, { method, ...(body ? { body: JSON.stringify(body) } : {}) }), KEY, b, "u1", a.id, new URL("https://x/?k=" + t + q));
  assert.equal((await call("PUT", "&collection=signups&doc=ana", { name: "Ana" })).status, 200);
  assert.equal((await call("PUT", "&collection=signups&doc=ana&merge=1", { team: "web" })).status, 200);
  assert.deepEqual((await (await call("GET", "&collection=signups&doc=ana")).json()).doc, { name: "Ana", team: "web" });
  assert.equal((await (await call("GET", "&collection=signups")).json()).docs.length, 1);
  assert.equal((await PG.serveArtifactDb(new Request("https://x/?k=bad"), KEY, b, "u1", a.id, new URL("https://x/?k=bad&collection=signups"))).status, 404);
  assert.equal((await ART.artifactNow(KEY, b, "u1", meta, { op: "db", id: a.id, dbOp: "get", collection: "signups", doc: "ana" })).doc.team, "web", "Coder reads it as the owner");
  // {} clears them, and the database stops answering.
  await ART.artifactNow(KEY, b, "u1", meta, { html: "<p>a3</p>", title: "A", id: a.id, base: 2, capabilities: {} }, { chat: "c1" });
  assert.equal((await call("GET", "&collection=signups")).status, 404);
  assert.equal((await PG.withCapabilities(KEY, b, "u1", a.id, "<p>x</p>")).csp, PG.PAGE_CSP);
});

// ── COMMANDS ──
test("Z4-3 /code-review --comment posts the findings on the pull request; /security-review and /team-onboarding are commands", () => {
  const c = ROUTES.slashTurn("/code-review --comment 42");
  assert.equal(c.comment, true);
  assert.match(c.text, /inline comments on the pull request with pr_comments/);
  assert.match(c.text, /The owner added .*: 42$/);
  assert.doesNotMatch(c.text, /--comment/);
  assert.equal(ROUTES.slashTurn("/code-review").comment, undefined);
  assert.match(ROUTES.slashTurn("/security-review").text, /^Do a security review/);
  assert.match(ROUTES.slashTurn("/team-onboarding").text, /ONBOARDING\.md[\s\S]*share_onboarding_guide/);
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  for (const c of ["/rename", "/security-review", "/team-onboarding", "/autofix-pr"]) assert.ok(page.includes("['" + c + "'"), c + " in the / list");
  assert.match(page, /function renameCmd/);
  assert.match(page, /function autofixCmd/);
});

// ── SENDFEEDBACK ──
test("Z4-4 SendFeedback: send moves a draft to Coder's inbox with a receipt (transcript only when asked), dismissal can turn drafting off", async () => {
  const b = memBucket();
  const q = await PL.queueFeedback(b, "u1", { title: "Grep slow", details: "It took a minute.", area: "grep" }, "chat-1");
  assert.equal(q.ok, true);
  const s = await PL.sendFeedback(b, "u1", q.id, { transcript: true, events: [{ type: "user", text: "hi" }, { type: "bash", command: "ls" }, { type: "done", text: "ok" }], model: "grok-4" });
  assert.equal(s.ok, true);
  assert.match(s.receipt, /^fbr_[0-9a-f]{16}$/);
  const sent = JSON.parse(b.m.get("coder-feedback/" + s.receipt + ".json"));
  assert.deepEqual(sent.transcript.map((e) => e.type), ["user", "done"]);
  assert.equal(sent.env.version, PL.CODER_VERSION);
  assert.equal(JSON.stringify(sent).includes("chat-1"), false, "the working folder (chat) isn't sent");
  assert.equal((await PL.readFeedback(b, "u1")).length, 0, "the draft is deleted");
  const q2 = await PL.queueFeedback(b, "u1", { title: "x", details: "y" });
  const s2 = await PL.sendFeedback(b, "u1", q2.id, { transcript: false, events: [{ type: "user", text: "secret" }] });
  assert.equal(JSON.parse(b.m.get("coder-feedback/" + s2.receipt + ".json")).transcript, undefined);
  // Turned off from the card: nothing is drafted.
  const r = await PL.handlePluginRoutes(new Request("https://x/", { method: "POST", body: JSON.stringify({ off: true }) }), b, "u1", ["feedback", "settings"]);
  assert.equal(r.status, 200);
  assert.match((await PL.queueFeedback(b, "u1", { title: "x", details: "y" })).error, /turned Claude-drafted feedback off/);
  assert.match(WT.SEND_FEEDBACK_DESCRIPTION, /2 twice to send/);
});

// ── MARKETPLACES ──
function zip(files) {
  const enc = new TextEncoder(), local = [], central = [];
  let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(enc.encode(text)), comp = deflateRawSync(raw), nb = Buffer.from(name);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(8, 8); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nb.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(8, 10); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(off, 42);
    local.push(h, nb, comp); central.push(c, nb); off += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(Object.keys(files).length, 8); e.writeUInt16LE(Object.keys(files).length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...local, cd, e]));
}
const resp = (bytes, { status = 200, headers = {} } = {}) => new Response(bytes, { status, headers });

test("Z4-5 marketplaces: added by Git URL (marketplace.json), a plugin installed from GitHub's zip of the repository, named plugin@marketplace", async () => {
  const mjson = JSON.stringify({ name: "acme-tools", owner: { name: "Acme" }, plugins: [{ name: "lint-fix", description: "Fix lint.", source: "./plugins/lint-fix" }, { name: "zipped", source: { source: "archive", url: "https://cdn.acme.dev/z.zip" } }] });
  const repoZip = zip({ "tools-main/.claude-plugin/marketplace.json": mjson, "tools-main/plugins/lint-fix/.claude-plugin/plugin.json": JSON.stringify({ name: "lint-fix", description: "Fix lint errors." }), "tools-main/plugins/lint-fix/skills/fix/SKILL.md": "---\nname: fix\ndescription: Fix lint errors\n---\nRun the linter and fix what it says.", "tools-main/plugins/lint-fix/commands/lint.md": "---\ndescription: Lint now\n---\nRun npm run lint.", "tools-main/plugins/lint-fix/agents/linter.md": "---\nname: linter\n---\nYou lint." });
  const seen = [];
  const fetchFn = async (url) => {
    seen.push(url);
    if (url === "https://raw.githubusercontent.com/acme/tools/HEAD/.claude-plugin/marketplace.json") return resp(mjson);
    if (url === "https://codeload.github.com/acme/tools/zip/HEAD") return resp(repoZip);
    return resp("", { status: 404 });
  };
  const b = memBucket();
  const add = await PL.addMarketplace(b, "u1", "https://github.com/acme/tools.git", { fetchFn });
  assert.equal(add.ok, true);
  assert.equal(add.marketplace.plugins.length, 2);
  const ins = await PL.installFromMarketplace(b, "u1", "lint-fix", "acme-tools", { fetchFn });
  assert.equal(ins.ok, true, ins.error);
  const kept = (await PL.readPlugins(b, "u1"))[0];
  assert.deepEqual([kept.name, kept.marketplace, kept.skills.map((s) => s.name), kept.commands.map((s) => s.name), kept.agents.length], ["lint-fix", "acme-tools", ["fix"], ["lint"], 1]);
  assert.ok((await PL.ownerSkills(b, "u1")).some((s) => s.name === "lint-fix:fix"), "its skills work in every chat");
  const api = await PL.pluginsApi({}, b, "u1", {}, { action: "plugins_search", keywords: ["zipped"] });
  assert.ok(api.plugins.some((p) => p.name === "zipped@acme-tools"));
  // The page's routes.
  const g = await (await PL.handlePluginRoutes(new Request("https://x/"), b, "u1", ["plugins"], { fetchFn })).json();
  assert.equal(g.marketplaces[0].plugins.find((p) => p.name === "lint-fix").installed, true);
  // A relative path in a marketplace added by URL fails as Claude Code's does.
  assert.match(MK.entryDownload({ source: { kind: "url" } }, { source: "./x" }).error, /does not stay inside the marketplace directory/);
  assert.match(MK.parseSource("https://gitlab.com/a/b.git").error, /cannot run git/);
  assert.deepEqual(MK.parseSource("acme/tools#stable"), { kind: "github", repo: "acme/tools", ref: "stable" });
});

test("Z4-6 download limits: marketplace.json 5 MiB / 10 s; archive 256 MiB / 120 s / five redirects, each https and not loopback, link-local or metadata", async () => {
  assert.deepEqual([MK.MARKETPLACE_JSON_MAX, MK.MARKETPLACE_JSON_MS, MK.ARCHIVE_MAX, MK.ARCHIVE_MS, MK.ARCHIVE_REDIRECTS], [5 * 1048576, 10_000, 256 * 1048576, 120_000, 5]);
  const big = await MK.fetchLimited("https://a.dev/m.json", { maxBytes: 10, timeoutMs: 1000, fetchFn: async () => resp("x".repeat(11)) });
  assert.match(big.error, /over/);
  const loop = await MK.fetchLimited("https://a.dev/z.zip", { maxBytes: 100, timeoutMs: 1000, maxRedirects: 5, fetchFn: async () => resp("", { status: 302, headers: { location: "https://a.dev/again" } }) });
  assert.match(loop.error, /more than 5 times/);
  for (const to of ["http://a.dev/z.zip", "https://127.0.0.1/z", "https://169.254.169.254/latest", "https://metadata.google.internal/x", "https://[::1]/z"]) {
    const r = await MK.fetchLimited("https://a.dev/z.zip", { maxBytes: 100, timeoutMs: 1000, fetchFn: async () => resp("", { status: 302, headers: { location: to } }) });
    assert.match(r.error, /redirected to an address/, to);
  }
  const slow = await MK.fetchLimited("https://a.dev/z.zip", { maxBytes: 100, timeoutMs: 50, fetchFn: (u, o) => new Promise((_, no) => { const keep = setTimeout(() => {}, 2000); o.signal.addEventListener("abort", () => { clearTimeout(keep); no(o.signal.reason); }); }) });
  assert.match(slow.error, /longer than 0.05 seconds/);
  const sha = await PL.addMarketplace(memBucket(), "u1", "https://a.dev/m.json", { fetchFn: async () => resp(JSON.stringify({ name: "m", plugins: [] })) });
  assert.equal(sha.ok, true);
});

test("Z4-7 archive extraction limits: 100,000 entries, 512 MiB a file, 1 GiB in all, 50 times the zip's size", () => {
  assert.deepEqual([MK.ZIP_ENTRIES_MAX, MK.ZIP_FILE_MAX, MK.ZIP_TOTAL_MAX, MK.ZIP_RATIO_MAX], [100_000, 512 * 1048576, 1024 * 1048576, 50]);
  const z = zip({ "a.txt": "hello" });
  assert.equal(MK.zipEntries(z).length, 1);
  const lie = (patch) => { const c = new Uint8Array(z); const dv = new DataView(c.buffer); const cd = dv.getUint32(c.length - 22 + 16, true); patch(dv, cd, c.length - 22); return c; };
  assert.match(MK.zipEntries(lie((dv, cd) => dv.setUint32(cd + 24, 600 * 1048576, true))).error, /over 512 MiB/);
  // (A zip's count field holds at most 65,535 without Zip64; past it, Coder refuses the directory as damaged before 100,000.)
  assert.match(MK.zipEntries(lie((dv, _cd, e) => dv.setUint16(e + 10, 0xffff, true))).error, /damaged/);
  assert.match(MK.zipEntries(lie((dv, cd) => dv.setUint32(cd + 24, 1_000_000, true))).error, /50 times/);
  assert.match(MK.zipEntries(new Uint8Array(40)).error, /not a zip/);
});

// ── SMALLER ROWS ──
test("Z4-8 the role picker answers {} when approved without a pick; PushNotification's facts carry localSent; /clear opens an ended chat", async () => {
  const out = [];
  await CP.pluginTool("show_onboarding_role_picker", { args: {}, id: "t1", emit: () => {}, reply: (t) => out.push(t), askQuestions: async () => ({ choice: "answers", picks: [{ options: [], other: "" }] }), canAsk: () => true });
  assert.equal(out[0], "{}");
  const agent = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(agent, /pushSent: true, localSent: true/);
  assert.match(WT.ENDED_TEXT, /\(or \/clear\)/);
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /meta\.convoEnded === true && !wake && !isClearCmd\(text\)/);
  assert.match(routes, /delete next\.convoEnded/);
});

// ── THE PAGE (Chromium): the feedback card's keys and the Marketplaces tab ──
const PUB = new URL("../public/", import.meta.url).pathname;
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const SHOTS = process.env.Z4_SHOTS || "";

test("Z4-9 page: the draft card's 1 / 2 twice / 0 keys; the Plugins panel's Marketplaces tab adds one by Git URL and installs", { skip: !chromium && "playwright not installed" }, async () => {
  const ORIGIN = "https://gofarther.test";
  const at = Date.now();
  const proj = { id: "a", title: "Chat a", repo: "ana/a", base: "main", branch: "coder/a", status: "idle", mode: "default", turn: 1, at };
  const events = [{ type: "user", text: "Grep was slow", at }, { type: "feedback", draftId: "fb0011223344", title: "Grep takes a minute on big repos", area: "grep", details: "grep over 40,000 files took 61 s.\nExpected: under 5 s.", at }];
  const posts = [];
  let markets = [];
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), onChange: () => {}, init: async () => {} };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 860 }, serviceWorkers: "block" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(ORIGIN + "/**", async (route) => {
      const u = new URL(route.request().url()), m = route.request().method();
      if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
      if (u.pathname.startsWith("/api/")) {
        let body = {};
        if (u.pathname === "/api/coder/feedback/fb0011223344/send" && m === "POST") { posts.push(JSON.parse(route.request().postData() || "{}")); body = { ok: true, receipt: "fbr_0123456789abcdef", sent: true }; }
        else if (u.pathname === "/api/coder/plugins/marketplaces" && m === "POST") { markets = [{ name: "acme-tools", owner: "Acme", source: { kind: "github", repo: "acme/tools", ref: "" }, plugins: [{ name: "lint-fix", description: "Fix lint errors.", category: "Quality", installed: false }, { name: "release-notes", description: "Write release notes from merged PRs.", category: "Docs", installed: false }] }]; body = { ok: true, marketplace: { name: "acme-tools", plugins: markets[0].plugins } }; }
        else if (u.pathname === "/api/coder/plugins" && m === "POST") { markets[0].plugins[0].installed = true; body = { ok: true, plugin: { name: "lint-fix" } }; }
        else if (u.pathname === "/api/coder/plugins") body = { ok: true, installed: [], catalog: [], marketplaces: markets };
        else if (u.pathname === "/api/coder/github") body = { connected: true, login: "ana" };
        else if (u.pathname === "/api/coder/projects") body = { projects: [proj] };
        else if (u.pathname === "/api/coder/projects/a" && m === "GET") body = { project: proj, events, queue: [] };
        else if (u.pathname === "/api/coder/settings") body = { prefs: {} };
        else if (/\/state$/.test(u.pathname)) body = { running: false, events, next: events.length, project: proj };
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
      }
      const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
      if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
    });
    await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
    await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await page.click('.gf-item[data-chat="a"]');
    await page.waitForSelector(".cd-fbcard-keys", { timeout: 10000 });
    if (SHOTS) mkdirSync(SHOTS, { recursive: true });
    await page.focus("#cdIn");
    await page.keyboard.press("1");
    await page.waitForSelector(".cd-fbcard-tr");
    assert.equal(await page.inputValue("#cdIn"), "", "the key acted on the card, not the box");
    await page.keyboard.press("2");
    await page.waitForSelector(".cd-fbcard-arm");
    if (SHOTS) await page.locator(".cd-fbcard").screenshot({ path: path.join(SHOTS, "z4-feedback-card-review.png") });
    await page.keyboard.press("2");
    await page.waitForFunction(() => document.querySelector(".cd-fbcard-h span").textContent.includes("✓ Sent"));
    assert.deepEqual(posts, [{ transcript: true, project: "a", model: posts[0].model }]);
    if (SHOTS) await page.locator(".cd-fbcard").screenshot({ path: path.join(SHOTS, "z4-feedback-card-sent.png") });
    // The Plugins panel's Marketplaces tab.
    await page.evaluate(() => window.CoderPluginsUI.pluginsPanel());
    await page.click('[data-pp-tab="markets"]');
    await page.fill('.cpx-mkadd .cpx-in', "https://github.com/acme/tools");
    await page.click('.cpx-mkadd button');
    await page.waitForSelector('[data-pp="mk-install"]');
    await page.click('[data-pp="mk-install"][data-pp-name="lint-fix"]');
    await page.waitForFunction(() => document.querySelector(".cpx-note") && document.querySelector(".cpx-note").textContent.includes("lint-fix@acme-tools is installed"));
    if (SHOTS) await page.locator(".cpx-panel").screenshot({ path: path.join(SHOTS, "z4-plugins-marketplaces.png") });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
