// PLUGINS LIKE CLAUDE CODE'S (2026-11-28): the whole plugin kept, ${CLAUDE_PLUGIN_ROOT} and ${CLAUDE_PLUGIN_DATA}, MCP servers,
// versions and updates, the on/off switch, a repository's enabledPlugins, the trust warning, userConfig, removing a
// marketplace, custom component paths, agents in subfolders and name clashes. Claude Code's docs: plugins/overview.md,
// plugins/manifest-reference.md, plugins/components.md, plugins/loading.md, plugins/security.md, plugins/host-marketplace.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync, lstatSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { deflateRawSync } from "node:zlib";
import { tmpdir } from "node:os";
import path from "node:path";

const PL = await import("../src/coder-plugins.mjs");
const MK = await import("../src/coder-marketplace.mjs");
const PF = await import("../container/coder-pluginfiles.mjs");
const HK = await import("../container/coder-hooks.mjs");
const AG = await import("../container/coder-agents.mjs");
const CP = await import("../container/coder-plugins.mjs");
const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const ENV = { CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64") };

const bucket = () => { const m = new Map(); return { m, async get(k) { if (!m.has(k)) return null; const v = m.get(k); return { text: async () => (typeof v === "string" ? v : Buffer.from(v).toString("utf8")), body: typeof v === "string" ? v : new Blob([v]).stream() }; }, async put(k, v) { m.set(k, typeof v === "string" ? v : new Uint8Array(v)); }, async delete(k) { m.delete(k); } }; };
function zip(files, comment = "") {
  const enc = new TextEncoder(), local = [], central = [];
  let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(enc.encode(text)), comp = deflateRawSync(raw), nb = Buffer.from(name);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nb.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(off, 42);
    local.push(h, nb, comp); central.push(c, nb); off += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22), cm = Buffer.from(comment);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(Object.keys(files).length, 8); e.writeUInt16LE(Object.keys(files).length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16); e.writeUInt16LE(cm.length, 20);
  return new Uint8Array(Buffer.concat([...local, cd, e, cm]));
}
const resp = (bytes, status = 200) => new Response(bytes, { status });
const SHA1 = "a".repeat(40), SHA2 = "b".repeat(40);

/** A marketplace on GitHub (acme/tools) whose one plugin, deploy-tools, has every component kind. */
function market({ sha = SHA1, version = undefined, name = "acme-tools" } = {}) {
  const P = "tools-main/plugins/deploy/";
  const manifest = { name: "deploy-tools", description: "Deploy things.", ...(version ? { version } : {}), homepage: "https://acme.dev/deploy", defaultEnabled: true,
    skills: ["./extra-skills/"], commands: { status: { source: "./cmds/status.md", description: "Show status" }, about: { content: "Explain the plugin.", description: "About" } },
    hooks: "./config/extra-hooks.json", mcpServers: { "deploy-api": { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/server.js"] }, docs: { type: "http", url: "https://mcp.acme.dev/mcp" } },
    userConfig: { api_token: { type: "string", title: "API token", sensitive: true, required: true }, region: { type: "string", title: "Region", default: "eu", options: ["eu", "us"] } } };
  const files = {
    "tools-main/.claude-plugin/marketplace.json": "{}",
    [P + ".claude-plugin/plugin.json"]: JSON.stringify(manifest),
    [P + "skills/review/SKILL.md"]: "---\nname: review\ndescription: Review a deploy\n---\nRead ${CLAUDE_PLUGIN_ROOT}/skills/review/checklist.md, keep notes in ${CLAUDE_PLUGIN_DATA}, region ${user_config.region}, token ${user_config.api_token}.",
    [P + "skills/review/checklist.md"]: "1. Check the logs.",
    [P + "extra-skills/rollback/SKILL.md"]: "---\nname: rollback\ndescription: Roll back\n---\nRun bin/rollback.",
    [P + "cmds/status.md"]: "---\ndescription: ignored\n---\nShow the deploy status.",
    [P + "commands/ignored.md"]: "Not read: the manifest's commands replace this folder.",
    [P + "agents/review/security.md"]: "---\nname: security\ndescription: Checks security\n---\nYou check security.",
    [P + "agents/planner.md"]: "---\nname: planner\ndescription: Plans deploys\n---\nYou plan.",
    [P + "hooks/hooks.json"]: JSON.stringify({ hooks: { PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/format.sh" }] }] } }),
    [P + "config/extra-hooks.json"]: JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/scripts/start.js", "${user_config.region}"] }] }] } }),
    [P + ".mcp.json"]: JSON.stringify({ mcpServers: { "deploy-api": { command: "old" }, logs: { url: "https://logs.acme.dev/mcp" } } }),
    [P + "scripts/format.sh"]: "#!/bin/sh\necho formatted",
    [P + "bin/rollback"]: "#!/bin/sh\necho rolled back",
  };
  const mjson = JSON.stringify({ name, owner: { name: "Acme" }, plugins: [{ name: "deploy", description: "Deploys.", source: "./plugins/deploy" }] });
  const repoZip = zip(files, sha);
  const fetchFn = async (url) => (url === "https://raw.githubusercontent.com/acme/tools/HEAD/.claude-plugin/marketplace.json" ? resp(mjson) : url === "https://codeload.github.com/acme/tools/zip/HEAD" ? resp(repoZip) : resp("", 404));
  return { fetchFn, repoZip };
}

test("P1 the whole plugin: every file kept in its zip, custom component paths, inline commands, agents in subfolders, .mcp.json and mcpServers", async () => {
  const b = bucket(), m = market();
  assert.equal((await PL.addMarketplace(b, "u1", "acme/tools", { fetchFn: m.fetchFn })).ok, true);
  const r = await PL.installFromMarketplace(b, "u1", "deploy", "acme-tools", { fetchFn: m.fetchFn, accepted: true });
  assert.equal(r.ok, true, r.error);
  const p = (await PL.readPlugins(b, "u1"))[0];
  assert.equal(p.manifestName, "deploy-tools");
  assert.deepEqual(p.skills.map((s) => [s.name, s.dir]), [["review", "skills/review"], ["rollback", "extra-skills/rollback"]], "skills: the default folder and the manifest's");
  assert.deepEqual(p.commands.map((c) => c.name).sort(), ["about", "status"], "the manifest's commands replace commands/");
  assert.equal(p.commands.find((c) => c.name === "status").description, "Show status");
  assert.deepEqual(p.agents.map((a) => (a.sub ? a.sub + ":" : "") + PL.agentName(a)).sort(), ["planner", "review:security"]);
  assert.deepEqual(Object.keys(p.hooks).sort(), ["PostToolUse", "SessionStart"], "hooks/hooks.json and the manifest's hooks file");
  assert.deepEqual(Object.keys(p.mcpServers).sort(), ["deploy-api", "docs", "logs"]);
  assert.equal(p.mcpServers["deploy-api"].command, "node", "the manifest's server replaces .mcp.json's of the same name");
  assert.equal(p.version, SHA1.slice(0, 12), "no version field: the commit SHA, shortened to 12");
  // (The zip is kept whole, so scripts/, bin/ and the files beside SKILL.md reach the machine.)
  assert.ok(b.m.get(p.zip.key) instanceof Uint8Array);
  const names = MK.zipEntries(b.m.get(p.zip.key)).map((e) => e.name);
  for (const f of ["scripts/format.sh", "bin/rollback", "skills/review/checklist.md"]) assert.ok(names.includes(p.zip.base + f), f);
  // (Its remote MCP servers are the owner's connectors, named plugin:<plugin>:<server>; one that runs a command is listed.)
  const conns = JSON.parse(b.m.get("connectors/u1.json") || b.m.get([...b.m.keys()].find((k) => /connectors/.test(k) && /u1/.test(k))) || "[]");
  assert.deepEqual(conns.map((c) => c.name).sort(), ["plugin:deploy-tools:docs", "plugin:deploy-tools:logs"]);
  assert.ok(conns.every((c) => c.fromPlugin === "deploy@acme-tools" && c.status === "auth"));
  assert.deepEqual(p.localServers, ["deploy-api"]);
  // (Path rules.)
  assert.equal(MK.insidePath("./a/b"), "a/b");
  assert.equal(MK.insidePath("../shared"), null);
  assert.equal(MK.insidePath("a\\b"), null);
  assert.equal(MK.insidePath("/etc"), null);
});

test("P2 ${CLAUDE_PLUGIN_ROOT}, ${CLAUDE_PLUGIN_DATA} and ${user_config.*} in skills and agents; options and folders for hooks", async () => {
  const b = bucket(), m = market();
  await PL.addMarketplace(b, "u1", "acme/tools", { fetchFn: m.fetchFn });
  await PL.installFromMarketplace(b, "u1", "deploy", "acme-tools", { fetchFn: m.fetchFn, accepted: true });
  assert.equal((await PL.setPluginConfig(ENV, b, "u1", "deploy@acme-tools", { api_token: "s3cret-value", region: "us" })).ok, true);
  assert.equal((await PL.setPluginConfig(ENV, b, "u1", "deploy@acme-tools", { region: "mars" })).error, "Region must be one of eu, us.");
  const root = MK.pluginRootOf("acme-tools", "deploy", SHA1.slice(0, 12)), data = MK.pluginDataOf("deploy@acme-tools");
  assert.equal(root, "/opt/coder-plugins/cache/acme-tools/deploy/" + SHA1.slice(0, 12));
  assert.equal(data, "/opt/coder-plugins/data/deploy-acme-tools");
  const sk = (await PL.ownerSkills(b, "u1")).find((s) => s.name === "deploy-tools:review");
  assert.ok(sk, "namespaced by the manifest's name");
  assert.ok(sk.body.includes(root + "/skills/review/checklist.md") && sk.body.includes("notes in " + data), sk.body);
  assert.ok(sk.body.includes("region us") && sk.body.includes("[sensitive value: api_token]") && !sk.body.includes("s3cret"), "a sensitive value becomes a placeholder in skill text");
  assert.equal(sk.dir, root + "/skills/review");
  const parts = await PL.ownerPluginParts(b, "u1", ENV);
  assert.equal(parts.files[0].root, root);
  const h = parts.hooks[0];
  assert.deepEqual([h.root, h.data, h.options.region, h.options.api_token], [root, data, "us", "s3cret-value"], "hooks get every option, sensitive ones too (CLAUDE_PLUGIN_OPTION_<KEY>)");
  assert.deepEqual(parts.agents.map((a) => a.sub || "").sort(), ["", "review"]);
  // (The secret is sealed in storage and never on the page.)
  assert.ok(![...b.m.values()].some((v) => typeof v === "string" && v.includes("s3cret")), "never stored in plain text");
  const page = await (await PL.handlePluginRoutes(new Request("https://x/"), b, "u1", ["plugins"], { env: ENV })).json();
  assert.ok(!JSON.stringify(page).includes("s3cret"));
  assert.deepEqual(page.installed[0].userConfig.api_token.set, true);
  assert.equal(page.installed[0].userConfig.region.value, "us");
  // (On the machine: the hook's command and environment.)
  const shell = HK.hookShell({ command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/scripts/start.js", "${user_config.region}"], pluginRoot: root, pluginData: data, pluginOptions: { region: "us", api_token: "tok" } }, "M", "/work/a");
  assert.ok(shell.includes("'node' '" + root + "/scripts/start.js' 'us'"), shell);
  assert.match(shell, /CLAUDE_PLUGIN_ROOT='\/opt\/coder-plugins\/cache\/acme-tools\/deploy\/aaaaaaaaaaaa' CLAUDE_PLUGIN_DATA='\/opt\/coder-plugins\/data\/deploy-acme-tools' CLAUDE_PLUGIN_OPTION_REGION='us' CLAUDE_PLUGIN_OPTION_API_TOKEN='tok'/);
  const bad = HK.hookShell({ command: "curl -H ${user_config.api_token} x", pluginRoot: root, pluginData: data, pluginOptions: {} }, "M", "/work/a");
  assert.match(bad, /references \$\{user_config\.\*\} in a shell-form hook command/);
  assert.ok(!bad.includes("curl"), "it doesn't run");
  // (hooksForTurn hands the folders to each plugin hook.)
  assert.match(read("container/server.mjs"), /pluginRoot: p\.root, pluginData: p\.data/);
  // (Plugin agents in subfolders: plugin:sub:name.)
  const defs = AG.pluginAgentsFrom(parts.agents);
  assert.deepEqual(defs.map((d) => d.name).sort(), ["deploy-tools:planner", "deploy-tools:review:security"]);
  // (A plugin skill keeps its folder on the machine, so its files are found.)
  const sks = CP.withOwnerSkills([], [sk]);
  assert.equal(sks[0].dir, root + "/skills/review");
});

test("P3 versions and updates: manifest version first, then the entry's, then the commit SHA; Update refreshes the marketplace and keeps the copy when unchanged", async () => {
  assert.equal(MK.computeVersion({ manifestVersion: "1.2.0", entryVersion: "9", commit: SHA1 }), "1.2.0");
  assert.equal(MK.computeVersion({ entryVersion: "9", commit: SHA1 }), "9");
  assert.equal(MK.computeVersion({ sha256: "c".repeat(64) }), "cccccccccccc");
  assert.equal(MK.zipCommit(zip({ a: "b" }, SHA2)), SHA2);
  const b = bucket();
  let m = market();
  await PL.addMarketplace(b, "u1", "acme/tools", { fetchFn: m.fetchFn });
  await PL.installFromMarketplace(b, "u1", "deploy", "acme-tools", { fetchFn: m.fetchFn, accepted: true });
  await PL.setPluginEnabled(b, "u1", "deploy@acme-tools", false);
  let u = await PL.updatePlugin(b, "u1", "deploy@acme-tools", { fetchFn: m.fetchFn });
  assert.equal(u.same, true);
  assert.equal(u.note, "deploy@acme-tools is already at the latest version (aaaaaaaaaaaa).");
  const oldKey = (await PL.readPlugins(b, "u1"))[0].zip.key;
  m = market({ sha: SHA2 });
  u = await PL.updatePlugin(b, "u1", "deploy@acme-tools", { fetchFn: m.fetchFn });
  assert.equal(u.updated, true, u.error);
  const p = (await PL.readPlugins(b, "u1"))[0];
  assert.equal(p.version, "bbbbbbbbbbbb");
  assert.equal(p.enabled, false, "the owner's switch stays");
  assert.ok(!b.m.has(oldKey) && b.m.has(p.zip.key));
  // (A pinned version keeps the copy however many commits are pushed.)
  m = market({ sha: SHA1, version: "2.0.0" });
  await PL.updatePlugin(b, "u1", "deploy@acme-tools", { fetchFn: m.fetchFn });
  m = market({ sha: SHA2, version: "2.0.0" });
  assert.equal((await PL.updatePlugin(b, "u1", "deploy@acme-tools", { fetchFn: m.fetchFn })).same, true);
  // (Auto-update: on for Anthropic's official marketplaces, off for others and for knowledge-work-plugins; once an hour.)
  assert.equal(MK.autoUpdateDefault("claude-plugins-official"), true);
  assert.equal(MK.autoUpdateDefault("knowledge-work-plugins"), false);
  assert.equal(MK.autoUpdateDefault("acme-tools"), false);
  assert.equal((await PL.autoUpdatePlugins(b, "u1", { fetchFn: m.fetchFn, now: 1e12 })).updated.length, 0, "acme-tools auto-update is off");
  await PL.setMarketplaceAutoUpdate(b, "u1", "acme-tools", true);
  assert.deepEqual((await PL.autoUpdatePlugins(b, "u1", { fetchFn: m.fetchFn, now: 1e12 })).updated, [], "same version: nothing to update");
  assert.equal((await PL.autoUpdatePlugins(b, "u1", { fetchFn: m.fetchFn, now: 1e12 + 1000 })).skipped, true, "at most once an hour");
  m = market({ sha: SHA2, version: "2.1.0" });
  assert.deepEqual((await PL.autoUpdatePlugins(b, "u1", { fetchFn: m.fetchFn, now: 1e12 + PL.AUTO_UPDATE_EVERY + 1 })).updated, ["deploy@acme-tools"]);
  assert.match(read("src/coder-routes.mjs"), /autoUpdatePlugins\(bucket, uid, \{ fetchFn \}\)\.catch/);
});

test("P4 the on/off switch and defaultEnabled; the repository's enabledPlugins once trusted; extraKnownMarketplaces not read", async () => {
  const b = bucket(), m = market();
  await PL.addMarketplace(b, "u1", "acme/tools", { fetchFn: m.fetchFn });
  await PL.installFromMarketplace(b, "u1", "deploy", "acme-tools", { fetchFn: m.fetchFn, accepted: true });
  assert.ok((await PL.ownerSkills(b, "u1")).some((s) => s.name === "deploy-tools:review"));
  await PL.setPluginEnabled(b, "u1", "deploy@acme-tools", false);
  assert.ok(!(await PL.ownerSkills(b, "u1")).some((s) => s.plugin === "deploy@acme-tools"), "off: its skills leave every chat");
  assert.ok((await PL.ownerSkills(b, "u1", { off: true })).some((s) => s.name === "deploy-tools:review"));
  const conns = [...b.m.entries()].find(([k]) => /connectors/.test(k) && /u1/.test(k) && !/settings/.test(k));
  assert.ok(JSON.parse(conns[1]).every((c) => c.disabled === true), "and its connectors are switched off");
  const parts = await PL.ownerPluginParts(b, "u1", ENV);
  assert.ok(parts.hooks.every((h) => h.enabled === false) && parts.agents.every((a) => a.enabled === false));
  assert.equal(PL.isEnabled({ defaultEnabled: false }), false);
  assert.equal(PL.isEnabled({ defaultEnabled: false, enabled: true }), true);
  // (The repository's settings: settings.local.json over settings.json, over the owner's switch; only when trusted.)
  const dir = mkdtempSync(path.join(tmpdir(), "p4-"));
  try {
    mkdirSync(path.join(dir, ".claude"));
    writeFileSync(path.join(dir, ".claude/settings.json"), JSON.stringify({ enabledPlugins: { "deploy@acme-tools": false, "x@y": true }, extraKnownMarketplaces: { y: { source: { source: "github", repo: "y/y" } } } }));
    writeFileSync(path.join(dir, ".claude/settings.local.json"), JSON.stringify({ enabledPlugins: { "deploy@acme-tools": true } }));
    assert.deepEqual(PF.repoEnabledPlugins(dir, false), {});
    assert.deepEqual(PF.repoEnabledPlugins(dir, true), { "deploy@acme-tools": true, "x@y": true });
    const body = { pluginHooks: parts.hooks, pluginAgents: parts.agents, pluginFiles: parts.files, ownerSkills: await PL.ownerSkills(b, "u1"), pluginSkillsOff: await PL.ownerSkills(b, "u1", { off: true }) };
    PF.applyPluginSwitches(body, PF.repoEnabledPlugins(dir, true));
    assert.ok(body.ownerSkills.some((s) => s.name === "deploy-tools:review"), "the repository turns it on for its chats");
    assert.equal(body.pluginHooks.length, 1);
    assert.equal(body.pluginFiles[0].enabled, true);
    const off = { pluginHooks: parts.hooks.map((h) => ({ ...h, enabled: true })), ownerSkills: [{ name: "deploy-tools:review", body: "x", plugin: "deploy@acme-tools" }], pluginSkillsOff: [] };
    PF.applyPluginSwitches(off, { "deploy@acme-tools": false });
    assert.deepEqual([off.pluginHooks.length, off.ownerSkills.length], [0, 0], "and off");
  } finally { rmSync(dir, { recursive: true, force: true }); }
  assert.match(read("container/coder-pluginfiles.mjs"), /repository lists under extraKnownMarketplaces/);
  assert.match(read("container/server.mjs"), /applyPluginSwitches\(body, repoEnabledPlugins\(dir, !!\(body\.rules && body\.rules\.trust === true\)/);
});

test("P5 trust: Claude Code's warning before a marketplace install; an Anthropic name from another source is refused", async () => {
  const b = bucket(), m = market();
  await PL.addMarketplace(b, "u1", "acme/tools", { fetchFn: m.fetchFn });
  const no = await PL.installFromMarketplace(b, "u1", "deploy", "acme-tools", { fetchFn: m.fetchFn, accepted: false });
  assert.match(no.error, /^Read the trust warning/);
  assert.equal(no.trust, MK.TRUST_WARNING);
  assert.match(MK.TRUST_WARNING, /^Plugins can run code on your computer, with access to your files and shell\. Make sure you trust a plugin before installing, updating, or using it\./);
  const viaTool = await PL.pluginsApi({}, b, "u1", {}, { action: "plugins_install", name: "deploy@acme-tools" });
  assert.match(viaTool.error, /trust warning/, "Coder can't install from a marketplace without the owner's Install");
  const res = await PL.handlePluginRoutes(new Request("https://x/", { method: "POST", body: JSON.stringify({ name: "deploy@acme-tools" }) }), b, "u1", ["plugins"], { fetchFn: m.fetchFn });
  assert.equal(res.status, 400);
  const fake = market({ name: "claude-plugins-official" });
  assert.match((await PL.addMarketplace(b, "u1", "acme/tools", { fetchFn: fake.fetchFn })).error, /Marketplace is registered from an untrusted source/);
  assert.equal(MK.tierOf("claude-community"), "community");
  const page = read("public/coder-plugins.js");
  assert.match(page, /data-pp="trust-yes"/);
  assert.match(page, /accepted: true/);
});

test("P6 removing a marketplace uninstalls its plugins, their zips, secrets and connectors", async () => {
  const b = bucket(), m = market();
  await PL.addMarketplace(b, "u1", "acme/tools", { fetchFn: m.fetchFn });
  await PL.installFromMarketplace(b, "u1", "deploy", "acme-tools", { fetchFn: m.fetchFn, accepted: true });
  await PL.setPluginConfig(ENV, b, "u1", "deploy@acme-tools", { api_token: "zz" });
  await PL.installPlugin(b, "u1", "testing");
  const key = (await PL.readPlugins(b, "u1")).find((p) => p.marketplace).zip.key;
  const r = await PL.removeMarketplace(b, "u1", "acme-tools", ENV);
  assert.deepEqual(r.removed, ["deploy@acme-tools"]);
  assert.deepEqual((await PL.readPlugins(b, "u1")).map((p) => p.name), ["testing"], "a plugin from elsewhere stays");
  assert.ok(!b.m.has(key));
  assert.deepEqual(await PL.readPluginSecrets(ENV, b, "u1"), {});
  const conns = [...b.m.entries()].find(([k]) => /connectors/.test(k) && /u1/.test(k) && !/settings/.test(k));
  assert.ok(!conns || JSON.parse(conns[1]).every((c) => c.fromPlugin !== "deploy@acme-tools"));
});

test("P7 name clashes: a marketplace plugin before a built-in one of the same name; two of one name share the hooks", () => {
  const cat = { name: "testing", skills: [{ name: "a", body: "x" }], hooks: { Stop: [{ hooks: [{ type: "command", command: "x" }] }] } };
  const m1 = { name: "testing", marketplace: "m1", manifestName: "testing", hooks: cat.hooks };
  const m2 = { name: "testing", marketplace: "m2", manifestName: "testing", hooks: cat.hooks };
  const o = PL.loadOrder([cat, m1, m2]);
  assert.equal(o.find((p) => !p.marketplace).notLoaded, "the name \"testing\" is already taken by testing@m1, which takes precedence");
  assert.equal(o.find((p) => p.marketplace === "m2").hooksLeftOut, "testing@m1");
  assert.equal(PL.loadOrder([cat]).length, 1);
});

test("P8 the machine's side: links that leave the plugin dropped, the data folder its commands' user owns, the zip only for this owner, bin/ on the PATH", () => {
  const src = read("container/coder-pluginfiles.mjs");
  assert.match(src, /dropEscapingLinks\(from\)/);
  assert.match(src, /chownSync\(f\.data, uid/);
  const env = read("src/coder-envapi.mjs");
  assert.match(env, /body\.action === "plugin_zip"/);
  assert.match(env, /key\.startsWith\("coder\/" \+ uid \+ "\/plugin-zips\/"\)/);
  assert.match(read("container/server.mjs"), /env\.PATH \+= ":" \+ PLUGIN_BINS\.join\(":"\)/);
});

test("P8b unpacking for real into a scratch plugins root", async () => {
  // Run ensurePluginFiles against a temporary root: PLUGIN_HOME paths are rewritten through `home`.
  const home = mkdtempSync(path.join(tmpdir(), "p8b-"));
  try {
    const m = market();
    const base = "tools-main/plugins/deploy/";
    const files = [{ id: "deploy@acme-tools", key: "k", base, root: "/opt/coder-plugins/cache/acme-tools/deploy/v1", data: "/opt/coder-plugins/data/deploy-acme-tools" }];
    const r = await PF.ensurePluginFiles(files, async () => Buffer.from(m.repoZip), { home, map: (p) => p.replace("/opt/coder-plugins", home) });
    assert.deepEqual(r, []);
    assert.equal(readFileSync(path.join(home, "cache/acme-tools/deploy/v1/bin/rollback"), "utf8"), "#!/bin/sh\necho rolled back");
    assert.ok(existsSync(path.join(home, "cache/acme-tools/deploy/v1/skills/review/checklist.md")));
    assert.ok(statSync(path.join(home, "data/deploy-acme-tools")).isDirectory());
    // (Already there: not fetched again.)
    let n = 0;
    await PF.ensurePluginFiles(files, async () => { n++; return Buffer.from(m.repoZip); }, { home, map: (p) => p.replace("/opt/coder-plugins", home) });
    assert.equal(n, 0);
    // (Uninstalled: its data folder goes.)
    await PF.ensurePluginFiles([], async () => Buffer.alloc(0), { home, map: (p) => p.replace("/opt/coder-plugins", home) });
    assert.ok(!existsSync(path.join(home, "data/deploy-acme-tools")));
    void lstatSync;
  } finally { rmSync(home, { recursive: true, force: true }); }
});

let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const SHOTS = process.env.PLUGINS_SHOTS || "";
test("P9 page: Installed shows the switch, Update and Settings (sensitive fields never filled); a marketplace install shows the trust warning first", { skip: !chromium && "playwright not installed" }, async () => {
  const ORIGIN = "https://gofarther.test", PUB = new URL("../public/", import.meta.url).pathname;
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), onChange: () => {}, init: async () => {} };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
  const posts = [];
  const proj = { id: "a", title: "Chat a", repo: "ana/a", base: "main", branch: "coder/a", status: "idle", mode: "default", turn: 1, at: Date.now() };
  const installed = [{ id: "deploy@acme-tools", name: "deploy", ns: "deploy-tools", marketplace: "acme-tools", version: "2.1.0", enabled: true, installed: true, description: "Deploy commands, a review agent and a status monitor.", category: "", contents: "2 skills, 2 commands, 2 agents, 2 hooks", skills: ["review", "rollback"], commands: ["status", "about"], agents: ["planner", "review:security"], hooks: [], connectors: ["plugin:deploy-tools:docs"], localServers: ["deploy-api"],
    userConfig: { api_token: { type: "string", title: "API token", description: "Token for the deploy API", sensitive: true, required: true, set: true }, region: { type: "string", title: "Region", options: ["eu", "us"], value: "us" } } },
  { id: "code-review", name: "code-review", enabled: false, installed: true, description: "A careful review of the chat's changes before they are pushed.", category: "Quality", contents: "1 skill, 1 command, 1 agent", skills: ["review-changes"], commands: ["pre-push"], agents: ["code-reviewer"], hooks: [], connectors: [] }];
  const markets = [{ name: "acme-tools", owner: "Acme", tier: "third-party", autoUpdate: false, source: { kind: "github", repo: "acme/tools", ref: "" }, plugins: [{ name: "deploy", description: "Deploys.", installed: true }, { name: "release-notes", description: "Write release notes from merged PRs.", version: "1.0.0", homepage: "https://acme.dev/release-notes", installed: false }] }];
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2, serviceWorkers: "block" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(ORIGIN + "/**", async (route) => {
      const u = new URL(route.request().url()), m = route.request().method();
      if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
      if (u.pathname.startsWith("/api/")) {
        let body = {};
        if (u.pathname.startsWith("/api/coder/plugins") && m === "POST") { posts.push([u.pathname, JSON.parse(route.request().postData() || "{}")]); body = { ok: true, note: "deploy@acme-tools is already at the latest version (2.1.0).", same: true, enabled: false }; }
        else if (u.pathname === "/api/coder/plugins") body = { ok: true, trustWarning: MK.TRUST_WARNING, installed, catalog: [], marketplaces: markets };
        else if (u.pathname === "/api/coder/github") body = { connected: true, login: "ana" };
        else if (u.pathname === "/api/coder/projects") body = { projects: [proj] };
        else if (u.pathname === "/api/coder/projects/a" && m === "GET") body = { project: proj, events: [], queue: [] };
        else if (/\/state$/.test(u.pathname)) body = { running: false, events: [], next: 0, project: proj };
        else if (u.pathname === "/api/coder/settings") body = { prefs: {} };
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
      }
      const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
      if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
    });
    await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
    await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    if (SHOTS) mkdirSync(SHOTS, { recursive: true });
    await page.evaluate(() => window.CoderPluginsUI.pluginsPanel());
    await page.waitForSelector('[data-pp-on="deploy@acme-tools"]', { state: "attached" });
    assert.equal(await page.isChecked('[data-pp-on="deploy@acme-tools"]'), true);
    assert.equal(await page.isChecked('[data-pp-on="code-review"]'), false);
    assert.equal(await page.locator('[data-pp="update"]').count(), 1, "Update only for a marketplace plugin");
    // (The owner, 2026-11-28: the page counts only skills (commands count as skills) and connectors; no helpers or hooks.)
    const panel = await page.textContent(".cpx-panel");
    assert.ok(panel.includes("deploy@acme-tools: 4 skills · 1 connector") && panel.includes("code-review: 2 skills"), panel);
    assert.ok(!/hook|agent|helper/i.test(panel.replace("a review agent", "")), "no helpers or hooks on the page: " + panel);
    if (SHOTS) await page.locator(".cpx-panel").screenshot({ path: path.join(SHOTS, "plugins-installed.png") });
    await page.click('[data-pp="cfg"]');
    await page.waitForSelector('.cpx-cfg input[name="api_token"]');
    assert.equal(await page.inputValue('.cpx-cfg input[name="api_token"]'), "", "a sensitive value is never filled in");
    assert.equal(await page.getAttribute('.cpx-cfg input[name="api_token"]', "type"), "password");
    if (SHOTS) await page.locator(".cpx-panel").screenshot({ path: path.join(SHOTS, "plugins-settings.png") });
    await page.selectOption('.cpx-cfg select[name="region"]', "eu");
    await page.click('.cpx-cfg button[type="submit"]');
    await page.waitForFunction(() => document.querySelector(".cpx-note") && /Saved the settings/.test(document.querySelector(".cpx-note").textContent));
    await page.click('[data-pp="update"]');
    await page.waitForFunction(() => /already at the latest version/.test(document.querySelector(".cpx-note").textContent));
    await page.click('[data-pp-on="deploy@acme-tools"] + span');
    await page.waitForFunction(() => /is off/.test(document.querySelector(".cpx-note").textContent));
    await page.click('[data-pp-tab="markets"]');
    await page.click('[data-pp="mk-install"][data-pp-name="release-notes"]');
    await page.waitForSelector(".cpx-trust");
    assert.match(await page.textContent(".cpx-warn"), /^Plugins can run code on your computer/);
    if (SHOTS) await page.locator(".cpx-panel").screenshot({ path: path.join(SHOTS, "plugins-trust-warning.png") });
    await page.click('[data-pp="trust-yes"]');
    await page.waitForFunction(() => !document.querySelector(".cpx-trust"));
    assert.deepEqual(posts.map(([p]) => p), ["/api/coder/plugins/deploy%40acme-tools/config", "/api/coder/plugins/deploy%40acme-tools/update", "/api/coder/plugins/deploy%40acme-tools/enabled", "/api/coder/plugins"]);
    assert.deepEqual(posts[0][1], { values: { api_token: "", region: "eu" } });
    assert.deepEqual(posts[2][1], { enabled: false });
    assert.deepEqual(posts[3][1], { name: "release-notes", marketplace: "acme-tools", accepted: true });
    if (SHOTS) {
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
