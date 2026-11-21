// THE OPEN ITEMS FROM THE 2026-11-21 LIVE ROUND (the owner: "yes pls"): an unknown / command, the chat's memory folder read by
// commands, and /autocompact. (The leftover branch section: CD153h in setup-copy.test.mjs.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");

function slashFns(S) {
  const start = ui.indexOf("  const SLASH = [");
  const end = ui.indexOf("\n  }\n", ui.indexOf("  function unknownSlash(")) + 4;
  return new Function("S", "GLOOPY", "esc", ui.slice(start, end) + "\nreturn { slashMatches, unknownSlash, SLASH };")(S, false, esc);
}

test("OI1 an unknown / command, as Claude Code's (\"Enter submits your text as typed and reports Unknown command\"): the box empties and the chat says Unknown command, with Did you mean when one is close; known ones and skills are not caught", () => {
  const S = { draft: "", events: [{ type: "skills", list: [{ name: "deploy-docs", description: "d" }] }] };
  const { unknownSlash } = slashFns(S);
  assert.deepEqual(unknownSlash("/nosuchthing"), { name: "nosuchthing", near: "" });
  assert.deepEqual(unknownSlash("/rev"), { name: "rev", near: "/review" }, "a near one is offered");
  for (const known of ["/compact keep the tests", "/init", "/review", "/btw what?", "/undo", "/deploy-docs", "/autocompact 500k", "/signins"]) assert.equal(unknownSlash(known), null, known);
  assert.equal(unknownSlash("/etc/hosts is odd"), null, "a path is a message, not a command");
  assert.equal(unknownSlash("hello /x"), null, "only at the start");
  S.events = [];
  assert.equal(unknownSlash("/nosuchthing"), null, "before the skills are known, it goes as typed");
  assert.match(ui, /if \(u\) \{ boxEmpty\(\); note\('Unknown command: \/' \+ u\.name/);
});

test("OI2 the chat's own memory folder is listed and read by commands without asking (Claude Code's memory folder), never another chat's, never through a link out, and writing there is not opened by it", async () => {
  const P = await import("../container/coder-perms.mjs");
  const W = "/work/shop", M = "/data/memory/ana__shop.memory";
  const ctx = (extra = {}) => ({ mode: "acceptEdits", cwd: W, workdirs: [W], home: "/home/dev", memoryDir: M, ...extra });
  assert.equal(P.bashDecision("ls -la " + M, ctx({ memoryDir: "" })).verdict, "ask", "without it: asked, as in the live test");
  for (const c of ["ls -la " + M, "cat " + M + "/MEMORY.md", "head -5 " + M + "/feedback_tests.md"]) assert.equal(P.bashDecision(c, ctx()).verdict, "allow", c);
  assert.equal(P.bashDecision("ls /data/memory/bob__other.memory", ctx()).verdict, "ask", "another repository's");
  assert.equal(P.bashDecision("ls /data/memory", ctx()).verdict, "ask", "not the folder above it");
  assert.equal(P.bashDecision("cat " + M + "/link", ctx({ real: (p) => (p === M + "/link" ? "/etc/passwd" : p) })).verdict, "ask", "a link out of it");
  for (const c of ["echo x > " + M + "/MEMORY.md", "cp a.txt " + M + "/b.md"]) for (const mode of ["default", "acceptEdits"]) assert.deepEqual(P.bashDecision(c, ctx({ mode })), P.bashDecision(c, ctx({ mode, memoryDir: "" })), "writing there is as before: " + c);
  const agent = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.equal(agent.split('memoryDir: typeof deps.memFile === "string" && deps.memFile ? pathPosix.dirname(deps.memFile) : ""').length - 1, 3, "every command check gets it");
});

test("OI3 /autocompact [auto|<tokens>], Claude Code's: its sizes (100K or more; k and M; a bare 100 to 1000 is thousands), auto, per chat, sent with each message, the owner's own variable still beating it; in the / list", async () => {
  const R = await import("../src/coder-routes.mjs");
  assert.deepEqual(R.parseAutoCompact("500k"), { window: 500_000 });
  assert.deepEqual(R.parseAutoCompact("1M"), { window: 1_000_000 });
  assert.deepEqual(R.parseAutoCompact("200000"), { window: 200_000 });
  assert.deepEqual(R.parseAutoCompact("200"), { window: 200_000 }, "a bare 200 is 200,000");
  assert.deepEqual(R.parseAutoCompact("auto"), { window: null });
  for (const bad of ["50k", "99999", "lots", ""]) assert.ok(R.parseAutoCompact(bad).error, bad);
  assert.deepEqual(R.parseAutoCompact("5M"), { window: 1_000_000 }, "at most 1M");
  // The route keeps it on the chat.
  const { saveConnection } = await import("../src/coder-github.mjs");
  const m = new Map();
  const bucket = { m, async get(k) { return m.has(k) ? { text: async () => m.get(k), json: async () => JSON.parse(m.get(k)) } : null; }, async put(k, v) { m.set(k, String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  const uid = "user-1234567890abcdef";
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const fetchFn = async (url) => (String(url) === "https://api.github.com/repos/ana/shop" ? Response.json({ default_branch: "main", permissions: { push: true } }) : Response.json({ message: "Not Found" }, { status: 404 }));
  const deps = { fetchFn, authUser: async () => ({ id: uid, email: "me@x.y" }), container: () => ({ fetch: async () => Response.json({}) }) };
  const go = (path, init = {}) => R.handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
  const id = (await (await go("projects", { method: "POST", body: JSON.stringify({ repo: "ana/shop" }) })).json()).project.id;
  const set = await (await go("projects/" + id + "/autocompact", { method: "POST", body: JSON.stringify({ value: "500k" }) })).json();
  assert.deepEqual([set.window, set.project.autoCompactWindow], [500_000, 500_000]);
  assert.equal((await go("projects/" + id + "/autocompact", { method: "POST", body: JSON.stringify({ value: "10" }) })).status, 400);
  const back = await (await go("projects/" + id + "/autocompact", { method: "POST", body: JSON.stringify({ value: "auto" }) })).json();
  assert.equal("autoCompactWindow" in back.project, false);
  assert.match(readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8"), /extra: extraFor\(meta\), autoCompactWindow: Number\.isInteger\(meta\.autoCompactWindow\) \? meta\.autoCompactWindow : 0, /, "sent with each message");
  // The machine: over the repository's setting, under the owner's own variable.
  const S = await import("../container/server.mjs");
  assert.match(readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8"), /if \(!gloopy\) Object\.assign\(rawVars, withChatWindow\(rawVars, ownerRaw, Number\(body\.autoCompactWindow\)\)\);/);
  assert.equal(S.withChatWindow({ CODER_AUTO_COMPACT_WINDOW: "300000" }, {}, 500_000).CODER_AUTO_COMPACT_WINDOW, "500000");
  assert.equal(S.withChatWindow({ CODER_AUTO_COMPACT_WINDOW: "300000" }, { CODER_AUTO_COMPACT_WINDOW: "300000" }, 500_000).CODER_AUTO_COMPACT_WINDOW, "300000");
  assert.deepEqual(S.withChatWindow({}, {}, NaN), {});
  const { compactSettings } = await import("../container/coder-compact.mjs");
  assert.equal(compactSettings(S.compactVarsFor(S.withChatWindow({}, {}, 500_000))).window, 500_000);
  // The / list.
  const { slashMatches } = slashFns({ draft: "/autoc", events: [] });
  assert.deepEqual(slashMatches().map((x) => x[0]), ["/autocompact"]);
  assert.match(ui, /if \(!GLOOPY && \/\^\\\/autocompact\(\?:\\s\|\$\)\/i\.test\(text\)\) \{ boxEmpty\(\); autoCompactCmd\(/);
});
