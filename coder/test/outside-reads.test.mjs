// READS OUTSIDE THE WORKING FOLDERS, AS CLAUDE CODE'S (the owner, 2026-11-18: "Yes pls", to "Should I match Read, Grep and
// Glob to Claude Code on that too?"; Claude Code 2.1.327's docs, "File-access tools marked No, including Read, Grep, and Glob,
// still prompt for paths outside the working directory and additional directories, apart from files Claude Code itself needs",
// and "The first time Claude uses the Read, Grep, or Glob tool on a path outside them, Claude Code asks whether to allow that
// read", read with its program): the tools script reads outside only for a call Coder's loop allowed; in Accept edits and Plan
// the owner is asked, in Claude Code's words, offered a rule for the folder; in Auto it is read, with no question (the owner,
// 2026-11-18: "match claude code": Claude Code's one-time question isn't asked in its cloud sessions, tried on its own tools);
// the read block still refuses them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const A = await import("../container/coder-agent.mjs");
const P = await import("../container/coder-perms.mjs");
const T = await import("../container/coder-tools.mjs");
const HERE = (p) => new URL("../" + p, import.meta.url);
const TOOLS = new URL("../container/coder-tools.mjs", import.meta.url).pathname;

function project() {
  const dir = mkdtempSync(join(tmpdir(), "outside-"));
  writeFileSync(join(dir, "a.txt"), "inside\n");
  try { symlinkSync("/etc/hostname", join(dir, "link-out")); } catch { /* no links here */ }
  const run = (req) => { const r = spawnSync(process.execPath, ["--no-warnings", TOOLS, Buffer.from(JSON.stringify(req)).toString("base64")], { cwd: dir, env: { ...process.env, CODER_CWD: dir }, encoding: "utf8", maxBuffer: 64 << 20 }); return { code: r.status, output: r.stdout }; };
  return { dir, run };
}
const call = (name, args, id = "c1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
/** One job with a scripted Grok, its file tools run for real in a project folder; `answers`: the owner's answers to its cards, in turn. */
async function job(steps, { extra = {}, answers = null } = {}) {
  const { dir, run } = project();
  const events = [], cards = [];
  let n = 0, k = 0;
  const r = await A.runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => { const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command)); return tm ? run(tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"))) : { code: 0, output: "ok\n" }; },
    emit: (e) => events.push(e), here: () => dir, root: dir, chatId: "shop-or", where: (p) => (p.startsWith("/") ? p : dir + "/" + p),
    ...(answers ? { ask: async (card) => { cards.push(card); return { choice: answers[Math.min(k++, answers.length - 1)] }; } } : {}),
  }, { text: "look around", mode: "acceptEdits", messages: [], ...extra });
  const told = (id) => (r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content;
  return { dir, r, events, cards: events.filter((e) => e.type === "permission"), told };
}

test("OR1 the tools script reads outside the working folders only for a read, grep, glob or lsp call Coder's loop allowed (its ctx.outside); never writes there", () => {
  const { run } = project();
  assert.equal(run({ tool: "read", args: { path: "/etc/hostname" } }).output, "error: that path is outside the project");
  assert.match(run({ tool: "read", args: { path: "/etc/hostname" }, ctx: { outside: true } }).output, /^1\t/);
  assert.equal(run({ tool: "read", args: { path: "link-out" } }).output, "error: that path leads outside the project");
  assert.match(run({ tool: "read", args: { path: "link-out" }, ctx: { outside: true } }).output, /^1\t/);
  assert.match(run({ tool: "glob", args: { pattern: "host*", path: "/etc" }, ctx: { outside: true } }).output, /\/etc\/hostname/);
  assert.match(run({ tool: "grep", args: { pattern: ".", path: "/etc/hostname" }, ctx: { outside: true } }).output, /hostname/);
  assert.equal(run({ tool: "write", args: { path: "/tmp/or1-outside.txt", content: "x" }, ctx: { outside: true } }).output, "error: that path is outside the project", "a write: never");
  assert.deepEqual([...T.OUTSIDE_TOOLS].sort(), ["glob", "grep", "lsp", "lsp_file", "read"]);
});

test("OR2 Claude Code's words: its Read's ask for a path outside the working folders (a link out named with where it leads), the rule it offers for the folder; Auto's one-time question is gone (not asked in Claude Code's cloud sessions)", () => {
  assert.equal(P.outsideReadWhy("/etc/hostname"), "Coder requested permissions to read from /etc/hostname, but you haven't granted it yet.");
  assert.equal(P.outsideReadWhy("/w/link", "/etc/hostname"), "Coder requested permissions to read from /w/link, but you haven't granted it yet. /w/link resolves through a symlink to /etc/hostname, which is outside the allowed working directories.");
  assert.equal(P.outsideReadRule("/etc/hostname"), "Read(//etc/**)");
  assert.deepEqual([P.OUTSIDE_READS_TITLE, P.OUTSIDE_READS_QUESTION, P.OUTSIDE_READS_ANSWERS, P.OUTSIDE_READS_EXPLAINER], [undefined, undefined, undefined, undefined]);
  assert.doesNotMatch(readFileSync(HERE("container/coder-agent.mjs"), "utf8"), /outsideReads|outsidereads|outsideSeen/);
});

test("OR3 in Accept edits and Plan: a read, grep or glob outside the working folders asks first, in Claude Code's words, offering the folder's rule; Yes reads it; the rule's \"don't ask again\" covers the folder after; No refuses; a Read allow rule, or the project's own files, ask nothing; under the read block, refused", async () => {
  let t = await job([say("", [call("read", { file_path: "/etc/hostname" })]), say("Done.")], { answers: ["yes"] });
  assert.equal(t.cards.length, 1);
  assert.deepEqual([t.cards[0].tool, t.cards[0].path, t.cards[0].why, t.cards[0].rules], ["read", "/etc/hostname", "Coder requested permissions to read from /etc/hostname, but you haven't granted it yet.", ["Read(//etc/**)"]]);
  assert.match(t.told("c1"), /^1\t/, "read once allowed");
  t = await job([say("", [call("read", { file_path: "/etc/hostname" })]), say("", [call("read", { file_path: "/etc/hosts" }, "c2")]), say("Done.")], { answers: ["always"] });
  assert.equal(t.cards.length, 1, "the folder's rule covers the next read");
  assert.match(t.told("c2"), /^1\t/);
  t = await job([say("", [call("grep", { pattern: "localhost", path: "/etc/hosts" })]), say("Done.")], { answers: ["no"], extra: { mode: "plan" } });
  assert.deepEqual([t.cards[0].tool, t.cards[0].path], ["grep", "/etc/hosts"]);
  assert.equal(t.told("c1"), P.REJECTED);
  t = await job([say("", [call("read", { file_path: "/etc/hostname" }), call("read", { file_path: "a.txt" }, "c2")]), say("Done.")], { answers: ["yes"], extra: { rules: { allow: ["Read(//etc/**)"], ask: [], deny: [] } } });
  assert.equal(t.cards.length, 0, "a Read allow rule covers it; the project's own file asks nothing");
  t = await job([say("", [call("read", { file_path: "link-out" })]), say("Done.")], { answers: ["yes"] });
  assert.equal(t.cards[0].why, "Coder requested permissions to read from " + t.dir + "/link-out, but you haven't granted it yet. " + t.dir + "/link-out resolves through a symlink to /etc/hostname, which is outside the allowed working directories.");
  t = await job([say("", [call("read", { file_path: "/etc/hostname" })]), say("Done.")], { answers: ["yes"], extra: { readBlock: true } });
  assert.equal(t.cards.length, 0);
  assert.match(t.told("c1"), /^error: \/etc\/hostname is outside .*; the CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES setting blocks reads outside the working directories/);
});

test("OR4 in Auto: reads outside the working folders run without asking, as in Claude Code's cloud sessions (read, grep and glob, with someone to answer or not); under the read block, refused", async () => {
  const two = [say("", [call("read", { file_path: "/etc/hostname" })]), say("", [call("glob", { pattern: "host*", path: "/etc" }, "c2")]), say("", [call("grep", { pattern: ".", path: "/etc/hostname" }, "c3")]), say("Done.")];
  let t = await job(two, { answers: ["no"], extra: { mode: "auto" } });
  assert.equal(t.cards.length, 0, "no question, though someone can answer");
  assert.match(t.told("c1"), /^1\t/);
  assert.match(String(t.told("c2")), /\/etc\/hostname/);
  assert.match(String(t.told("c3")), /hostname/);
  assert.equal(t.events.filter((e) => e.type === "outsidereads").length, 0);
  t = await job(two, { extra: { mode: "auto" } });
  assert.equal(t.cards.length, 0, "no one to answer: read too");
  assert.match(t.told("c1"), /^1\t/);
  t = await job(two, { answers: ["yes"], extra: { mode: "auto", readBlock: true } });
  assert.equal(t.cards.length, 0);
  assert.match(t.told("c1"), /^error: \/etc\/hostname is outside .*; the CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES setting blocks reads outside the working directories/);
});

test("OR5 the read block a Settings switch (Claude Code's permissions.blockReadsOutsideWorkingDirectories), given to every later job; nothing of the one-time question kept by Coder's server any more", async () => {
  const L = await import("../src/coder-live.mjs");
  const R = await import("../src/coder-routes.mjs");
  const saved = { mode: "auto", blockOutsideReads: true, outsideReadsSeen: true };
  assert.equal(R.prefsOf(saved).blockOutsideReads, true);
  assert.equal(R.machinePrefs(saved).blockOutsideReads, true);
  assert.equal("outsideReadsSeen" in R.prefsOf(saved), false, "an answer kept before is not read any more");
  assert.equal("outsideReadsSeen" in R.machinePrefs(saved), false);
  assert.equal(R.prefsChange(saved, { blockOutsideReads: false }).prefs.blockOutsideReads, false, "turned off in Settings");
  assert.equal(R.prefsChange(saved, { blockOutsideReads: "yes" }).error, "Blocking reads outside the working folders is on or off.");
  assert.equal("outsideReadsSeen" in R.prefsChange(saved, { blockOutsideReads: true }).prefs, false);
  assert.equal(L.keepOutsideAnswers, undefined);
  const server = readFileSync(HERE("container/server.mjs"), "utf8");
  assert.match(server, /readBlock: varOn\(rawVars\.CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES\) \|\| repoSet\.blockReads \|\| PREFS\.blockOutsideReads === true, writeBlock: /);
  assert.match(server, /blockOutsideReads: x\.blockOutsideReads === true,\n/);
  assert.doesNotMatch(server, /outsideReadsSeen|outsideSeen/);
  assert.doesNotMatch(readFileSync(HERE("src/coder-live.mjs"), "utf8"), /keepOutsideAnswers|outsidereads/);
});

test("OR6 the page: no one-time question's card any more; the Settings switch stays; the machine and a paused job take only the usual answers", async () => {
  const js = readFileSync(HERE("public/coder.js"), "utf8");
  assert.doesNotMatch(js, /outsideReads|allow_once|ask_again/);
  assert.match(js, /\(e\.tool === 'web_fetch' \? '' : '<input type="text" class="cd-perm-note"/);
  assert.match(js, /id="cdSetBlockReads"[\s\S]{0,200}Block reads outside the working folders/);
  assert.match(js, /\$\('cdSetBlockReads'\)\.onchange = \(e\) => save\('blockOutsideReads', e\.currentTarget\.checked\);/);
  assert.match(readFileSync(HERE("container/server.mjs"), "utf8"), /\["yes", "always", "auto", "acceptEdits", "no", "saved", "answers", "skip", "approved", "refused"\]\.includes\(choice\)/);
  const { parkAnswer } = await import("../container/coder-park.mjs");
  assert.deepEqual(["allow", "block", "ask_again", "allow_once"].map((c) => parkAnswer("permission", { choice: c })), [null, null, null, null]);
  assert.equal(parkAnswer("permission", { choice: "yes" }).choice, "yes");
});
