// READS OUTSIDE THE WORKING FOLDERS, AS CLAUDE CODE'S (the owner, 2026-11-18: "Yes pls", to "Should I match Read, Grep and
// Glob to Claude Code on that too?"; Claude Code 2.1.327's docs, "File-access tools marked No, including Read, Grep, and Glob,
// still prompt for paths outside the working directory and additional directories, apart from files Claude Code itself needs",
// and "The first time Claude uses the Read, Grep, or Glob tool on a path outside them, Claude Code asks whether to allow that
// read", read with its program): the tools script reads outside only for a call Coder's loop allowed; in Accept edits and Plan
// the owner is asked, in Claude Code's words, offered a rule for the folder; in Auto the first such read asks Claude Code's
// one-time question, its four answers kept in the owner's Settings; the read block still refuses them.
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

test("OR2 Claude Code's words: its Read's ask for a path outside the working folders (a link out named with where it leads), the rule it offers for the folder; its one-time question's title, question and four answers in its order (read in its program, 2.1.327), its explanation with Coder's names", () => {
  assert.equal(P.outsideReadWhy("/etc/hostname"), "Coder requested permissions to read from /etc/hostname, but you haven't granted it yet.");
  assert.equal(P.outsideReadWhy("/w/link", "/etc/hostname"), "Coder requested permissions to read from /w/link, but you haven't granted it yet. /w/link resolves through a symlink to /etc/hostname, which is outside the allowed working directories.");
  assert.equal(P.outsideReadRule("/etc/hostname"), "Read(//etc/**)");
  assert.equal(P.OUTSIDE_READS_TITLE, "Read outside the working directories");
  assert.equal(P.OUTSIDE_READS_QUESTION, "Allow this read outside the working directories?");
  assert.deepEqual(P.OUTSIDE_READS_ANSWERS, [["allow", "Yes, and keep allowing any reads outside the working directories"], ["block", "No, and block reads outside the working directories from now on"], ["ask_again", "No, and ask again next time"], ["allow_once", "Yes, but ask again next time"]]);
  assert.match(P.OUTSIDE_READS_EXPLAINER, /^Auto mode reads outside the working directories without asking\. Yes or No answers for this read; the rest is for later reads\. Block: the file tools refuse reads outside the working directories in every chat\. Auto mode asks before each shell command it can't check\. To undo, turn off “Block reads outside the working folders” in Settings\.$/);
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

test("OR4 in Auto: reads outside the working folders run without asking, the first after Claude Code's one-time question (read, grep and glob, where someone can answer): keep allowing (not asked again, kept), allow once (asked next time), ask again (refused), block (refused, the read block on, kept); answered before, or no one to answer: no question", async () => {
  const two = [say("", [call("read", { file_path: "/etc/hostname" })]), say("", [call("glob", { pattern: "host*", path: "/etc" }, "c2")]), say("Done.")];
  let t = await job(two, { answers: ["allow"], extra: { mode: "auto" } });
  assert.equal(t.cards.length, 1);
  const q = t.cards[0];
  assert.deepEqual([q.outsideReads, q.title, q.question, q.path], [true, "Read outside the working directories", "Allow this read outside the working directories?", "/etc/hostname"]);
  assert.deepEqual(q.options.map((o) => o.value), ["allow", "block", "ask_again", "allow_once"]);
  assert.match(t.told("c1"), /^1\t/);
  assert.match(String(t.told("c2")), /\/etc\/hostname/, "not asked again");
  assert.deepEqual(t.events.filter((e) => e.type === "outsidereads").map((e) => e.answer), ["allow"]);
  t = await job(two, { answers: ["allow_once", "allow_once"], extra: { mode: "auto" } });
  assert.equal(t.cards.length, 2, "asked again next time");
  assert.equal(t.events.filter((e) => e.type === "outsidereads").length, 0, "nothing kept");
  t = await job(two, { answers: ["ask_again"], extra: { mode: "auto" } });
  assert.equal(t.told("c1"), P.REJECTED);
  t = await job(two, { answers: ["block"], extra: { mode: "auto" } });
  assert.equal(t.told("c1"), P.REJECTED);
  assert.deepEqual(t.events.filter((e) => e.type === "outsidereads").map((e) => e.answer), ["block"]);
  t = await job(two, { answers: ["allow"], extra: { mode: "auto", outsideSeen: true } });
  assert.equal(t.cards.length, 0, "answered \"keep allowing\" before");
  assert.match(t.told("c1"), /^1\t/);
  t = await job(two, { extra: { mode: "auto" } });
  assert.equal(t.cards.length, 0, "no one to answer: read, as Claude Code's background sessions do");
  assert.match(t.told("c1"), /^1\t/);
});

test("OR5 the answers kept in the owner's Settings by Coder's server (\"keep allowing\" its hasSeenAutoModeOutsideReadPrompt, \"block\" its permissions.blockReadsOutsideWorkingDirectories), given to every later job; the read block a Settings switch", async () => {
  const L = await import("../src/coder-live.mjs");
  const R = await import("../src/coder-routes.mjs");
  const m = new Map();
  const b = { get: async (k) => (m.has(k) ? { text: async () => m.get(k) } : null), put: async (k, v) => { m.set(k, v); } };
  m.set("coder/u1/settings.json", JSON.stringify({ mode: "auto", denyInstead: false }));
  assert.equal(await L.keepOutsideAnswers(b, "u1", [{ type: "text" }]), false);
  assert.equal(await L.keepOutsideAnswers(b, "u1", [{ type: "outsidereads", answer: "allow" }]), true);
  assert.deepEqual(JSON.parse(m.get("coder/u1/settings.json")), { mode: "auto", denyInstead: false, outsideReadsSeen: true });
  await L.keepOutsideAnswers(b, "u1", [{ type: "outsidereads", answer: "block" }]);
  const saved = JSON.parse(m.get("coder/u1/settings.json"));
  assert.deepEqual([saved.outsideReadsSeen, saved.blockOutsideReads], [true, true]);
  assert.deepEqual([R.prefsOf(saved).blockOutsideReads, R.prefsOf(saved).outsideReadsSeen], [true, true]);
  assert.deepEqual([R.machinePrefs(saved).blockOutsideReads, R.machinePrefs(saved).outsideReadsSeen], [true, true]);
  assert.equal(R.prefsChange(saved, { blockOutsideReads: false }).prefs.blockOutsideReads, false, "turned off in Settings");
  assert.equal(R.prefsChange(saved, { blockOutsideReads: "yes" }).error, "Blocking reads outside the working folders is on or off.");
  const server = readFileSync(HERE("container/server.mjs"), "utf8");
  assert.match(server, /readBlock: varOn\(rawVars\.CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES\) \|\| repoSet\.blockReads \|\| PREFS\.blockOutsideReads === true, outsideSeen: PREFS\.outsideReadsSeen === true,/);
  assert.match(server, /blockOutsideReads: x\.blockOutsideReads === true,\n    outsideReadsSeen: x\.outsideReadsSeen === true,/);
  assert.match(readFileSync(HERE("src/coder-live.mjs"), "utf8"), /await keepOutsideAnswers\(bucket, uid, fresh\)\.catch\(\(\) => false\);/);
});

test("OR6 the page: the one-time question's card (Claude Code's title, question, explanation and four answers) and how it ended; the Settings switch; the machine and a paused job take its answers", async () => {
  const js = readFileSync(HERE("public/coder.js"), "utf8");
  assert.match(js, /if \(e\.outsideReads && Array\.isArray\(e\.options\)\) return e\.options\.filter/);
  assert.match(js, /e\.outsideReads && e\.title \? esc\(e\.title\)/);
  assert.match(js, /e\.outsideReads && e\.question \? esc\(e\.question\)/);
  assert.match(js, /if \(c === 'block'\) return '<span class="cd-perm-no">✕ Not allowed<\/span> · reads outside the working folders are blocked from now on \(Settings\)';/);
  assert.match(js, /\(e\.tool === 'web_fetch' \|\| e\.outsideReads \? '' : '<input type="text" class="cd-perm-note"/, "no note on it: its answers carry none in Claude Code");
  assert.match(js, /id="cdSetBlockReads"[\s\S]{0,200}Block reads outside the working folders/);
  assert.match(js, /\$\('cdSetBlockReads'\)\.onchange = \(e\) => save\('blockOutsideReads', e\.currentTarget\.checked\);/);
  assert.match(readFileSync(HERE("container/server.mjs"), "utf8"), /"approved", "refused", "allow", "block", "ask_again", "allow_once"\]\.includes\(choice\)/);
  const { parkAnswer } = await import("../container/coder-park.mjs");
  assert.deepEqual(["allow", "block", "ask_again", "allow_once"].map((c) => parkAnswer("permission", { choice: c }).choice), ["allow", "block", "ask_again", "allow_once"]);
});
