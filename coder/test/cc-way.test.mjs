// ROUND 6 OF THE 2026-11-21 LIVE CHECKS (the owner: "do how Claude Code does it"): each failure from "Round 5 live checks" in
// docs/live-tests/2026-11-21-audit-fixes.md, fixed the way Claude Code does it, and kept fixed here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const FAKE = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";

async function bashCard(command) {
  const A = await import("../container/coder-agent.mjs");
  const events = []; let n = 0;
  const steps = [say("", [call("bash", { command }, "b1")]), say("ok")];
  await A.runCoder({ send: async () => steps[Math.min(n++, 1)], exec: async () => ({ code: 0, output: "ok" }), emit: (e) => events.push(e), here: () => "/work/shop", root: "/work/shop", where: (p) => p, ask: async () => ({ choice: "yes" }) }, { text: "go", mode: "acceptEdits", messages: [] });
  return events.find((e) => e.type === "permission");
}

test("CC1 a command holding a secret gets only a one-time Yes, and the secret is on no part of its card", async () => {
  const plain = await bashCard("curl -s -o /dev/null https://example.com");
  assert.ok(Array.isArray(plain.rules) && plain.rules.length, "an ordinary command still offers don't ask again");
  const card = await bashCard('curl -s -o /dev/null -H "Authorization: Bearer ' + FAKE + '" https://example.com');
  assert.ok(card, "asked");
  assert.equal(card.rules, undefined, "no saved-rule option");
  assert.equal(card.toAuto, undefined);
  assert.equal(card.secret, true);
  assert.ok(!JSON.stringify(card).includes(FAKE), "the token is nowhere on the card");
  // The page: only Yes and No, even if a rule came with it.
  const ui = read("public/coder.js");
  const a = ui.indexOf("  function permOptions(e) {"), b = ui.indexOf("\n  }\n", a);
  const permOptions = new Function("S", "esc", "ruleShown", "return " + ui.slice(a, b + 4).trim())({}, (x) => x, (x) => x);
  assert.deepEqual(permOptions({ tool: "bash", secret: true, rules: ["Bash(curl " + FAKE + ")"], toAuto: true }).map((o) => o[0]), ["yes", "no"]);
  assert.deepEqual(permOptions({ tool: "bash", lines: ["curl -H [hidden]"], rules: ["Bash(curl x)"] }).map((o) => o[0]), ["yes", "no"]);
  assert.deepEqual(permOptions({ tool: "bash", lines: ["npm test"], rules: ["Bash(npm test)"] }).map((o) => o[0]), ["yes", "always", "no"]);
});

test("CC3 the read tool opens files in .git, as Claude Code's Read; writes there are still refused", async () => {
  const src = read("container/coder-tools.mjs");
  assert.match(src, /const gitGuard = tool !== "read";/);
  // (Run for real in file-rules.test.mjs: read .git/config and .git/HEAD; write and edit there refused.)
  assert.doesNotMatch(src, /\n  if \(rel\.split\(sep\)\[0\] === "\.git"\) fail/);
});

test("CC4 the @ list offers folders with a trailing slash, as Claude Code's does", () => {
  const ui = read("public/coder.js");
  const a = ui.indexOf("  function rankMentions(list, q) {"), b = ui.indexOf("\n  }\n", a);
  const rankMentions = new Function("return " + ui.slice(a, b + 4).trim())();
  assert.deepEqual(rankMentions(["docs2/a.txt"], "docs"), ["docs2/", "docs2/a.txt"]);
});

test("CC5 a refused pull request says GitHub's own detail, from its errors[] entries", async () => {
  const G = await import("../src/coder-github.mjs");
  assert.equal(G.prRefusal({ message: "Validation Failed", errors: [{ resource: "PullRequest", code: "custom", message: "No commits between main and coder/x" }] }), "Validation Failed: No commits between main and coder/x");
  assert.equal(G.prRefusal({ message: "Validation Failed", errors: [{ resource: "PullRequest", field: "head", code: "invalid" }] }), "Validation Failed: PullRequest head is not valid (is that branch on GitHub?)");
  assert.equal(G.prRefusal({ message: "Validation Failed", errors: [{ resource: "PullRequest", code: "already_exists" }] }), "Validation Failed: PullRequest already exists");
});

test("CC2 a save holding a file with a token commits and pushes nothing, and names the file; without it, the save goes through", async () => {
  const { execFileSync } = await import("node:child_process");
  const { mkdtemp, writeFile, mkdir, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();
  const gh = await mkdtemp(join(tmpdir(), "coder-ghcc-")), work = await mkdtemp(join(tmpdir(), "coder-seedcc-"));
  git(work, "init", "-q", "-b", "main"); await writeFile(join(work, "README.md"), "# shop\n");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A"); git(work, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "first");
  await mkdir(join(gh, "ana"), { recursive: true });
  const bare = join(gh, "ana", "shop.git"); execFileSync("git", ["clone", "-q", "--bare", work, bare]);
  const S = await import("../container/server.mjs");
  const root = await mkdtemp(join(tmpdir(), "coder-rootcc-")), gitRoot = await mkdtemp(join(tmpdir(), "coder-gitcc-"));
  const dir = join(root, "shop-cc01");
  const branch = "coder/shop-cc01";
  assert.equal((await S.prepareRepo({ dir, repo: "ana/shop", base: "main", branch, token: "", remote: gh + "/", gitRoot, root })).ok, true);
  await writeFile(join(dir, "key.txt"), FAKE + "\n"); await writeFile(join(dir, "ok.js"), "x\n");
  const p = await S.pushRepo({ dir, repo: "ana/shop", branch, token: "", message: "m", remote: gh + "/", gitRoot, root });
  assert.equal(p.ok, false); assert.equal(p.pushed, false);
  assert.deepEqual(p.secretFiles, ["key.txt"]);
  assert.match(p.why, /key\.txt \(GitHub PAT\) looks like it holds a secret, so nothing was committed or pushed\. Remove the secret/);
  assert.ok(!p.why.includes(FAKE), "the secret is not repeated");
  assert.throws(() => git(bare, "rev-parse", "--verify", "-q", branch), "nothing reached GitHub");
  await rm(join(dir, "key.txt"));
  const p2 = await S.pushRepo({ dir, repo: "ana/shop", branch, token: "", message: "m", remote: gh + "/", gitRoot, root });
  assert.equal(p2.ok, true, p2.why);
  assert.deepEqual(git(bare, "ls-tree", "-r", "--name-only", branch).trim().split("\n").sort(), ["README.md", "ok.js"]);
});

async function worker() {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const m = new Map();
  const bucket = { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
  const uid = "user-1234567890abcdef", id = "shop-cc06";
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const mk = "coder/" + uid + "/" + id + "/meta.json";
  m.set(mk, JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 0, status: "running", at: Date.now(), title: "x" }));
  m.set("coder/" + uid + "/" + id + "/messages.json", JSON.stringify([{ role: "user", content: "fix the cart" }, { role: "assistant", content: "Fixed cart.js line 4." }]));
  m.set("coder/" + uid + "/" + id + "/events.json", JSON.stringify([{ type: "user", text: "fix the cart" }]));
  const asked = [];
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: () => ({ fetch: async () => Response.json({ ok: true }) }), sideAnswer: async (msgs, thread, q) => { asked.push({ msgs, thread, q }); return "It was cart.js."; } };
  const go = (path, init = {}) => R.handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
  return { R, m, uid, id, mk, go, asked };
}

test("CC6 /btw answers from the chat, while Coder works, without joining the chat; /init and /review run as Claude Code's", async () => {
  const w = await worker();
  const before = { msgs: w.m.get("coder/" + w.uid + "/" + w.id + "/messages.json"), evs: w.m.get("coder/" + w.uid + "/" + w.id + "/events.json") };
  const r = await w.go("projects/" + w.id + "/btw", { method: "POST", body: JSON.stringify({ question: "which file was it?" }) });
  assert.equal(r.status, 200, "answered even while the job runs");
  const j = await r.json();
  assert.equal(j.answer, "It was cart.js.");
  assert.equal(w.asked[0].msgs[1].content, "Fixed cart.js line 4.", "from the chat's conversation");
  assert.equal(w.m.get("coder/" + w.uid + "/" + w.id + "/messages.json"), before.msgs, "not in the history");
  assert.equal(w.m.get("coder/" + w.uid + "/" + w.id + "/events.json"), before.evs, "not in the chat");
  await w.go("projects/" + w.id + "/btw", { method: "POST", body: JSON.stringify({ question: "and the line?" }) });
  assert.deepEqual(w.asked[1].thread.map((x) => x.q), ["which file was it?"], "a later one sees the earlier ones");
  const g = await (await w.go("projects/" + w.id + "/btw")).json();
  assert.equal(g.thread.length, 2);
  // The request has no tools, and the system line says so.
  const { btwRequest } = await import("../src/coder-summary.mjs");
  const req = btwRequest([{ role: "user", content: "hi" }], [{ q: "a", a: "b" }], "c");
  assert.equal(req.tools, undefined);
  assert.match(req.messages[0].content, /You have no tools/);
  assert.equal(req.messages.at(-1).content, "/btw c");
  // /init and /review.
  assert.match(w.R.slashTurn("/init").text, /create a CLAUDE\.md file/);
  assert.equal(w.R.slashTurn("/init").label, "/init");
  assert.match(w.R.slashTurn("/review").text, /^Review the changes on this chat's branch/);
  assert.match(w.R.slashTurn("/review 12").text, /The owner added .*: 12$/);
  assert.equal(w.R.slashTurn("/autocompact"), null);
  assert.equal(w.R.slashTurn("please /init"), null);
  // The page lists them, and /autocompact too (2026-11-21, the owner: add it the Claude Code way; open-items-1121.test.mjs).
  const ui = read("public/coder.js");
  for (const c of ["/btw", "/init", "/review"]) assert.ok(ui.includes("['" + c + "', "), c);
  assert.ok(ui.includes("['/autocompact'"));
  assert.match(ui, /btwAsk\(text\.replace/);
});

test("CC7 archiving a chat only marks it: it leaves the main list, shows under Archived, and comes back on unarchive", async () => {
  const w = await worker();
  const keysBefore = [...w.m.keys()].sort();
  const a = await w.go("projects/" + w.id + "/archive", { method: "POST", body: JSON.stringify({ archived: true }) });
  assert.equal(a.status, 200);
  assert.ok(JSON.parse(w.m.get(w.mk)).archived > 0);
  assert.deepEqual([...w.m.keys()].sort(), keysBefore, "nothing deleted");
  const list = await (await w.go("projects")).json();
  assert.equal(list.projects.find((p) => p.id === w.id).archived, true);
  await w.go("projects/" + w.id + "/archive", { method: "POST", body: JSON.stringify({ archived: false }) });
  assert.equal(JSON.parse(w.m.get(w.mk)).archived, undefined);
  assert.equal((await (await w.go("projects")).json()).projects.find((p) => p.id === w.id).archived, undefined);
  assert.equal((await w.go("projects/" + w.id + "/archive", { method: "POST", body: "{}" })).status, 400);
  const ui = read("public/coder.js");
  assert.match(ui, /data-archive="/); assert.match(ui, /data-unarchive="/); assert.match(ui, /'Archived \(' \+ kept\.length/);
});
