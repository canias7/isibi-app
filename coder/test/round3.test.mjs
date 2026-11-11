// Round 3 of the live test (owner, 2026-11-11: "yea go ahead test all of it"): what it found, fixed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, isAbsolute } from "node:path";
import { commandAsk } from "../container/coder-agent.mjs";
import { ghRefused, GRAPHQL_REFUSED } from "../src/coder-egress.mjs";

test("CD508 a command writing to a sensitive file by ~ names it in the AI's home on the card, as Claude Code names it in its own (live: \"<project>/~/.zshrc\")", () => {
  const root = "/data/work/proj", home = "/data/home";
  const deps = { root, home, where: (p) => (isAbsolute(p) ? resolve(p) : resolve(root, p)), here: () => root };
  const said = (c) => { const a = commandAsk(c, deps, root); return a ? [a.kind, a.paths, a.why] : null; };
  assert.deepEqual(said("echo 'setopt KSH_OPTION_PRINT' >> ~/.zshrc"), ["protected", ["/data/home/.zshrc"], "Coder requested permissions to edit /data/home/.zshrc which is a sensitive file."]);
  assert.deepEqual(said("tee -a ~/.profile < /dev/null"), ["protected", ["/data/home/.profile"], "Coder requested permissions to edit /data/home/.profile which is a sensitive file."]);
  // A ~ path doesn't depend on a cd before it; a short one after a cd is still named as written.
  assert.deepEqual(said("cd sub && echo x > ~/.bashrc"), ["protected", ["/data/home/.bashrc"], "Coder requested permissions to edit /data/home/.bashrc which is a sensitive file."]);
  assert.deepEqual(said("cd sub && echo x > .bashrc"), ["protected", [".bashrc"], "Coder requested permissions to edit .bashrc which is a sensitive file."]);
  // Inside the project, as before; a plain file in the home folder is no sensitive file.
  assert.deepEqual(said("echo x > .zshrc"), ["protected", [".zshrc"], "Coder requested permissions to edit /data/work/proj/.zshrc which is a sensitive file."]);
  assert.equal(said("echo x >> ~/notes.txt"), null);
  // With no home known, the name as written (never the project's folder with ~ in it).
  const noHome = commandAsk("echo x >> ~/.zshrc", { ...deps, home: "" }, root);
  assert.deepEqual([noHome.kind, noHome.paths, noHome.why], ["protected", ["~/.zshrc"], "Coder requested permissions to edit ~/.zshrc which is a sensitive file."]);
});

test("CD509 gh's refusals are GitHub's JSON ({\"message\": …}), so gh shows why (live: a plain-text refusal came out as \"invalid character 'G' looking for beginning of value\")", async () => {
  const r = ghRefused("GitHub access to user is not enabled for this session: only this chat's repositories (ana/shop)", 403);
  assert.equal(r.status, 403);
  assert.match(r.headers.get("content-type"), /^application\/json/);
  const j = await r.json();
  assert.deepEqual(Object.keys(j), ["message", "documentation_url"]);
  assert.match(j.message, /^GitHub access to user is not enabled for this session/);
  assert.equal((await ghRefused(GRAPHQL_REFUSED).json()).message, GRAPHQL_REFUSED);
  assert.equal(ghRefused("x").status, 403, "403 unless told");
  // Every reply githubApi makes on its own is in that shape (none in plain text).
  const src = (await import("node:fs")).readFileSync(new URL("../src/coder-egress.mjs", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("export async function githubApi("), src.indexOf("\n}\n", src.indexOf("export async function githubApi(")));
  assert.equal((body.match(/return text\(/g) || []).length, 0);
  assert.ok((body.match(/return ghRefused\(/g) || []).length >= 9);
});

test("CD510 a hook's notice in the chat keeps its reason when its command is long: the command is cut short, never the reason (live: a 1,000-character hook filled the 600 characters and \"Hook returned incorrect event name\" never showed)", async () => {
  const { hookNoteText, hookResult, hooksOutcome } = await import("../container/coder-hooks.mjs");
  const hook = { type: "command", command: "i=$(cat); " + "x".repeat(1000) + "; exit 0" };
  const r = hookResult("PreToolUse", { code: 0, stdout: '{"hookSpecificOutput":{"permissionDecision":"deny"}}', stderr: "" }, hook);
  const n = hooksOutcome("PreToolUse", [{ hook, result: r }], { tool: "Bash" }).notices[0];
  assert.ok(n.length > 1000);
  const t = hookNoteText(n);
  assert.ok(t.length <= 620, String(t.length));
  assert.match(t, /^PreToolUse:Bash hook error: \[i=\$\(cat\); x+…\]: Hook returned incorrect event name: expected 'PreToolUse' but got 'undefined'\. Full stdout: \{/);
  // Short ones whole; a long reason itself cut at 1,400 characters; anything else in that shape cut at the end as before.
  assert.equal(hookNoteText("PreToolUse:Bash hook error: [echo x]: Timed out"), "PreToolUse:Bash hook error: [echo x]: Timed out");
  assert.match(hookNoteText("Stop hook error: [echo x]: " + "y".repeat(3000)), /^Stop hook error: \[echo x\]: y{1400}…$/);
  assert.equal(hookNoteText("z".repeat(900)), "z".repeat(600));
  // The chat's notes use it.
  const src = (await import("node:fs")).readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(src, /for \(const n of o\.notices\) emit\(\{ type: "note", text: hookNoteText\(scrub\(n\)\), hook: event \}\);/);
});
