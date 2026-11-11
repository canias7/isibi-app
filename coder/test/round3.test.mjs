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

test("CD510 a hook's notice in the chat keeps its reason when its command is long (live: a 1,000-character hook filled the 600 characters and the reason never showed); in the cloud's words the hook is named \"[command hook]\", never by its command", async () => {
  const { hookNoteText, hookResult, hooksOutcome } = await import("../container/coder-hooks.mjs");
  const hook = { type: "command", command: "i=$(cat); " + "x".repeat(1000) + "; exit 0" };
  const r = hookResult("PreToolUse", { code: 0, stdout: '{"hookSpecificOutput":{"permissionDecision":"deny"}}', stderr: "" }, hook);
  const n = hooksOutcome("PreToolUse", [{ hook, result: r }], { tool: "Bash" }).notices[0];
  assert.ok(!n.includes("xxxx"), "the hook's command is never shown");
  const t = hookNoteText(n);
  assert.ok(t.length <= 1500, String(t.length));
  assert.match(t, /^PreToolUse:Bash hook error: \[command hook\]: Hook JSON output validation failed — hookSpecificOutput is missing required field "hookEventName"\n\nThe hook's output was: \{/);
  // Short ones whole; a long reason itself cut at 1,400 characters; anything else in that shape cut at the end as before.
  assert.equal(hookNoteText("PreToolUse:Bash hook error: [echo x]: Timed out"), "PreToolUse:Bash hook error: [echo x]: Timed out");
  assert.match(hookNoteText("Stop hook error: [echo x]: " + "y".repeat(3000)), /^Stop hook error: \[echo x\]: y{1400}…$/);
  assert.equal(hookNoteText("z".repeat(900)), "z".repeat(600));
  // The chat's notes use it.
  const src = (await import("node:fs")).readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(src, /for \(const n of o\.notices\) emit\(\{ type: "note", text: hookNoteText\(scrub\(n\)\), hook: event \}\);/);
});

test("CD511 a failed Grok call is tried again as Claude Code does (the owner: \"use the same claude code wording\"): 10 more times by default, for 408, 409, 429, 5xx and a lost connection, after retry-after or 500 ms doubling to 32 s, with Claude Code's line in the chat", async () => {
  const { coderSend, retryWaitMs, retryLine, maxRetriesOf, retryable, MAX_RETRIES } = await import("../container/coder-model.mjs");
  const ok = () => new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: "hi" }] }] }));
  const run = async (answers, env = {}) => {
    const seen = [], waits = [], told = [];
    let n = 0;
    const fetchFn = async () => { const a = answers[Math.min(n, answers.length - 1)]; n++; seen.push(n); if (a instanceof Error) throw a; return typeof a === "number" ? new Response("boom " + a, { status: a, headers: a === 429 ? { "retry-after": "3" } : {} }) : ok(); };
    const send = coderSend({ XAI_API_KEY: "k", ...env }, { fetchFn, wait: async (ms) => { waits.push(ms); }, rand: () => 0 });
    let r = null, err = null;
    try { r = await send({ messages: [], tools: [], onRetry: (x) => told.push(retryLine(x)) }); } catch (e) { err = e; }
    return { calls: seen.length, waits, told, r, err };
  };
  // Ten tries more, then the error, as Claude Code (its CLAUDE_CODE_MAX_RETRIES is 10 by default).
  assert.equal(MAX_RETRIES, 10);
  const all500 = await run([500]);
  assert.equal(all500.calls, 11);
  assert.match(String(all500.err && all500.err.message), /^AI call failed: 500 boom 500$/);
  assert.deepEqual(all500.waits, [500, 1000, 2000, 4000, 8000, 16000, 32000, 32000, 32000, 32000]);
  assert.deepEqual(all500.told.slice(0, 3), ["API error · Retrying in 1s · attempt 1/10", "API error · Retrying in 1s · attempt 2/10", "AI call failed: 500 boom 500 · Retrying in 2s · attempt 3/10"]);
  assert.equal(all500.told[9], "AI call failed: 500 boom 500 · Retrying in 32s · attempt 10/10");
  // Twice an error, then an answer (the live test's "Internal error during token generation" twice).
  const twice = await run([500, 500, "ok"]);
  assert.deepEqual([twice.calls, twice.r && twice.r.message.content], [3, "hi"]);
  // Which answers are tried again: 408, 409, 429 (after its retry-after), 5xx and a lost connection; not 4xx else, nor a call
  // that ran past its own time limit.
  assert.deepEqual([408, 409, 429, 500, 502, 503, 529, 400, 401, 403, 404].map(retryable), [true, true, true, true, true, true, true, false, false, false, false]);
  assert.deepEqual((await run([429, "ok"])).waits, [3000]);
  assert.equal((await run([404])).calls, 1);
  assert.equal((await run([new TypeError("fetch failed"), "ok"])).calls, 2);
  const late = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  assert.equal((await run([late, "ok"])).calls, 1);
  // The wait: retry-after first; else 500 ms doubling to 32 s, plus up to a quarter more at random.
  assert.deepEqual([1, 2, 3, 7, 10].map((a) => retryWaitMs(a, null, () => 0)), [500, 1000, 2000, 32000, 32000]);
  assert.equal(retryWaitMs(1, null, () => 1), 625);
  assert.equal(retryWaitMs(4, "2", () => 0), 2000);
  // CODER_MAX_RETRIES as Claude Code's CLAUDE_CODE_MAX_RETRIES: a number, at most 15.
  assert.deepEqual([undefined, "", "0", "3", "99", "x"].map((v) => maxRetriesOf({ CODER_MAX_RETRIES: v })), [10, 10, 0, 3, 15, 10]);
  assert.equal((await run([500], { CODER_MAX_RETRIES: "0" })).calls, 1);
  assert.equal((await run([503], { CODER_MAX_RETRIES: "2" })).calls, 3);
  // The chat shows each wait (a note), as Claude Code's line does.
  const src = (await import("node:fs")).readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(src, /onRetry: \(x\) => emit\(\{ type: "note", text: retryLine\(x\), retry: true \}\)/);
});

test("CD512 Claude Code's cloud words (the owner: \"use the same claude code wording\"): a private address is refused with its proxy's 403 and no note; a repository the chat doesn't have, in its GitHub proxy's sentence", async () => {
  const X = await import("../container/coder-proxy.mjs");
  const S = await import("../container/coder-secrets.mjs");
  assert.equal(X.LOCAL_REFUSED(), "Destination IP is in a private/reserved range");
  assert.equal(X.LOCAL_DENY_REASON, "private_dest_ip");
  assert.match(S.REPO_NOT_ENABLED, /^GitHub access to this repository is not enabled for this session\. /);
  assert.match(S.API_PATH_NOT_AVAILABLE, /^This GitHub API path is not available: sessions are bound to their configured repositories\. Use repository-scoped endpoints \(repos\/\{owner\}\//);
  // The gate keeps no "blocked" record for a private address any more (Claude Code's cloud adds no note to the command).
  const src = (await import("node:fs")).readFileSync(new URL("../container/coder-proxy.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /blocked\(host, "resolved to a /);
  assert.doesNotMatch(src, /blocked\(host, "a source archive/);
});
