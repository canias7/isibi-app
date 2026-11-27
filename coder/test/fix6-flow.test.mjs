// ROUND 6, FLOW (the owner, 2026-11-14, to the questions left from rounds 4 and 5: "do what claude code does"), each item as
// Claude Code 2.1.325's program does it (read from its raw program):
// - IN: the mark of an interrupted turn, "[Request interrupted by user for tool use]" ("by the owner" in Coder's words), a user
//   message of its own after the round's results, after a No or a Stop; "[Request interrupted by user]" for a Stop that came
//   while the model answered (or between two answers); none after a pause or a check's denial.
// - CK: the auto mode checker's no-verdict stop: the calls beside it that started keep their results, those not started are told
//   "[Tool call skipped: …]".
// - FV: the file tools' own checks (their validateInput) before their PreToolUse hooks and their card, in Claude Code's order.
// - BMP, TIF and TIFF refused by read as binary (Claude Code's Read's image kinds are png, jpg, jpeg, gif and webp).
// Stand-ins only: no Grok, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, truncateSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const A = await import("../container/coder-agent.mjs");
const P = await import("../container/coder-parallel.mjs");
const PK = await import("../container/coder-park.mjs");
const H = await import("../container/coder-hooks.mjs");
const T = await import("../container/coder-tools.mjs");
const { REJECTED, NOT_NOW } = await import("../container/coder-perms.mjs");
const TOOLS = join(import.meta.dirname, "../container/coder-tools.mjs");
const ROOT = "/work/shop";
const CHECKER = /^You are the safety checker of Coder's auto mode/;
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const MARK = { role: "user", appNote: true, content: "[Request interrupted by the owner for tool use]" };
const MARK_MODEL = { role: "user", appNote: true, content: "[Request interrupted by the owner]" };

/**
 * ONE JOB WITH STAND-INS: Grok's replies in turn (`steps`, after `sendMs`); each run takes `ms(tag)` and is logged; the tools
 * script's own check before the hooks ("file_check") answers `check(req)` ({ code, output }); hooks answer `hookOut(input)`;
 * the checker answers `verdict(action)`; a command, `bash(x, run)` when given.
 */
async function job(steps, { mode = "acceptEdits", rules = null, hooks = null, checker = false, verdict = () => '{"decision":"allow"}', ms = () => 5, sendMs = 0, answer = () => ({ choice: "yes" }), check = () => ({ code: 0, output: "ok" }), hookOut = () => "", bash = null, messages = [], text = "go", deps: more = {}, opts = {} } = {}) {
  const log = [], events = [], cards = [], requests = [], hookIns = [], checks = [];
  let n = 0;
  const t0 = Date.now();
  const at = () => Date.now() - t0;
  const run = async (tag, out) => { log.push({ ev: "start", tag, at: at() }); try { await wait(ms(tag)); return out; } finally { log.push({ ev: "end", tag, at: at() }); } };
  const r = await A.runCoder({
    send: async (req) => {
      const sys = String((req.messages && req.messages[0] && req.messages[0].content) || "");
      if (CHECKER.test(sys)) {
        const action = String(req.messages[1].content).split("THE ACTION TO JUDGE:\n")[1] || "";
        await wait(20);
        return { message: { role: "assistant", content: verdict(action) }, usage: { in: 100, out: 5 } };
      }
      requests.push(req);
      if (sendMs) await wait(sendMs);
      return steps[Math.min(n++, steps.length - 1)];
    },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        hookIns.push(input);
        return { code: 0, output: String(hookOut(input) || "") + "\n" + mark[0] + "\n" };
      }
      const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (tm) {
        const req = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"));
        if (req.tool === "file_check") { checks.push(req.args); return check(req.args); }
        const tag = req.tool + ":" + (req.args.pattern || req.args.path || req.args.url || "");
        return run(tag, { code: 0, output: "result of " + tag });
      }
      if (typeof bash === "function") return bash(x, run);
      return run("bash:" + x.command, { code: 0, output: "ran " + x.command + "\n" });
    },
    emit: (e) => events.push(e), sleep: async () => {},
    here: () => ROOT, root: ROOT, home: "/home/dev", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async (pid) => { const card = events.find((e) => e.type === "permission" && e.pid === pid); cards.push(card); return answer(card); },
    ...(typeof more === "function" ? more({ log, at }) : more),
  }, { text, messages, mode, checker, checkWhere: { key: "f6-" + Math.random().toString(36).slice(2) }, ...(rules ? { rules } : {}), ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}), ...opts });
  const when = (ev, tag) => { const x = log.find((e) => e.ev === ev && e.tag === tag); return x ? x.at : -1; };
  const told = (id) => { for (const m of r.messages || []) if (m && m.role === "tool" && m.tool_call_id === id) return String(m.content); return undefined; };
  return { r, log, events, cards, requests, hookIns, checks, when, told };
}
/** The job's last message (the saved record ends with it). */
// (The chat's record of the tools a stopped request carried rides on its mark, as its answer is not kept: the cache fix of
// 2026-11-14, test/cache-prefix.test.mjs. The mark itself is compared here.)
const last = (t) => { const { toolLocks: _l, toolLocksV: _v, toolsDeclared: _d, ...m } = t.r.messages[t.r.messages.length - 1]; return m; };
/** The interrupt marks in a record. */
const marks = (msgs) => msgs.filter((m) => m && m.role === "user" && /^\[Request interrupted by the owner/.test(String(m.content)));

test("IN1 Claude Code 2.1.325's marks of an interrupted turn and its words for a call a check's denial skipped, word for word ('the owner' for 'user', as REJECTED has it); the mark is a user message of its own, never the owner's words", () => {
  assert.equal(P.INTERRUPTED_TOOL_USE, "[Request interrupted by the owner for tool use]");
  assert.equal(P.INTERRUPTED, "[Request interrupted by the owner]");
  assert.deepEqual(P.interruptedNote(), MARK);
  assert.deepEqual(P.interruptedNote(false), MARK_MODEL);
  assert.equal(P.SKIPPED_BY_CHECK, "[Tool call skipped: the turn was stopped before this call ran, by the check whose denial is on another call in this batch. Nothing refused this call and it had no effects; re-run it if still needed.]");
  // (Claude Code's own, from its raw program: the same with "user".)
  assert.equal(P.INTERRUPTED_TOOL_USE.replace("the owner", "user"), "[Request interrupted by user for tool use]");
  assert.equal(REJECTED.startsWith("The owner doesn't want"), true, "the same swap as its rejection's");
  // The checker's closing: a call that had its result keeps its turn; one still running is aborted (its turn, for a command
  // moved to the background, or Claude Code's abort words); one not started is skipped.
  assert.deepEqual(["done", "running", "waiting", "none"].map((s) => P.closedAs("checker", s)), ["turn", "interrupted", "skipped", "skipped"]);
  // Not the owner's message: Coder's counts and summaries pass it by.
  assert.equal(A.ownersMessage(P.interruptedNote()), false);
});

test("IN2 the owner's No on a card: after the round's results, the mark '… for tool use' is the record's last message; the next message's conversation has it between the results and the owner's new words; Grok is not asked again", async () => {
  const rules = { allow: [], deny: [], ask: ["Read(ask.txt)"] };
  const t = await job([say("", [call("read", { path: "ask.txt" }, "r1"), call("read", { path: "b.txt" }, "r2"), call("edit", { path: "c.txt", old_string: "a", new_string: "b" }, "e1")]), say("never")], { rules, answer: async () => { await wait(30); return { choice: "no" }; } });
  assert.equal(t.r.status, "done");
  assert.equal(t.requests.length, 1);
  assert.deepEqual(["r1", "r2", "e1"].map((id) => t.told(id)), [REJECTED, "result of read:b.txt", REJECTED]);
  assert.deepEqual(last(t), MARK, "after the round's results, as Claude Code's query loop yields it");
  assert.equal(marks(t.r.messages).length, 1);
  // The next message: the record as saved, then the owner's words.
  const next = await job([say("OK.")], { messages: t.r.messages, text: "use the other file" });
  const sent = next.requests[0].messages.slice(1);
  const at = sent.findIndex((m) => m.content === MARK.content);
  assert.ok(at > 0 && sent[at - 1].role === "tool", "right after the round's results");
  assert.equal(sent[at].role, "user");
  assert.ok(sent.findIndex((m) => m.role === "user" && m.content === "use the other file") > at, "before the owner's new words");
  assert.equal(marks(next.r.messages).length, 1, "no second one");
});

test("IN3 the owner's Stop while a call runs: its 'stopped while running' rejection, then the mark '… for tool use'; Stop on an open card too; a Stop seen at a call's turn after Grok's answer came ('between calls') the same", async () => {
  let stopAt = 0;
  setTimeout(() => { stopAt = Date.now(); }, 60);
  const t = await job([say("", [call("read", { path: "slow.txt" }, "r1"), call("read", { path: "fast.txt" }, "r2"), call("edit", { path: "y.txt", old_string: "a", new_string: "b" }, "e1")]), say("never")], { ms: (tag) => (tag === "read:fast.txt" ? 5 : 250), deps: { stopped: async () => stopAt > 0, stoppedAt: () => stopAt } });
  assert.equal(t.r.status, "stopped");
  assert.deepEqual(["r1", "r2", "e1"].map((id) => t.told(id)), [A.STOPPED_RUNNING, "result of read:fast.txt", REJECTED]);
  assert.deepEqual(last(t), MARK);
  // Stop on a card while its job runs.
  const rules = { allow: [], deny: [], ask: ["Read(ask.txt)"] };
  const c = await job([say("", [call("read", { path: "ask.txt" }, "r1"), call("read", { path: "b.txt" }, "r2")]), say("never")], { rules, answer: async () => { await wait(20); return { choice: "stop" }; } });
  assert.equal(c.r.status, "stopped");
  assert.deepEqual([c.told("r1"), c.told("r2"), last(c)], [REJECTED, "result of read:b.txt", MARK]);
  // Seen at the first call's turn, after Grok's answer came (no time of the Stop known: now): every call its rejection, the mark.
  let on = false;
  const b = await job([say("", [call("edit", { path: "a.txt", old_string: "a", new_string: "b" }, "e1"), call("edit", { path: "b.txt", old_string: "a", new_string: "b" }, "e2")]), say("never")], { deps: () => ({ stopped: async () => on, stoppedAt: () => 0 }), opts: {} , hookOut: () => "", ms: () => 5, check: () => { on = true; return { code: 0, output: "ok" }; } });
  assert.equal(b.r.status, "stopped");
  assert.deepEqual([b.told("e1"), b.told("e2"), last(b)], [REJECTED, REJECTED, MARK]);
  assert.equal(b.when("start", "edit:a.txt"), -1, "nothing ran after it");
});

test("IN4 a Stop that came while Grok was still answering: its answer cut (none of it kept, its calls never run), then '[Request interrupted by the owner]', as Claude Code's mark when its model's answer was cut; between two answers: the same, or '… for tool use' when it came while the last round's calls ran", async () => {
  let stopAt = 0;
  setTimeout(() => { stopAt = Date.now(); }, 20);
  const t = await job([say("", [call("read", { path: "a.txt" }, "r1"), call("edit", { path: "b.txt", old_string: "a", new_string: "b" }, "e1")]), say("never")], { sendMs: 80, deps: { stopped: async () => stopAt > 0, stoppedAt: () => stopAt } });
  assert.equal(t.r.status, "stopped");
  // (Its answer came after the Stop's time: as one Claude Code's Stop would have cut, round 6's follow-up.)
  assert.deepEqual(last(t), MARK_MODEL);
  assert.equal(t.r.messages.filter((m) => m.role === "assistant").length, 0, "nothing of its answer kept");
  assert.deepEqual([t.told("r1"), t.told("e1")], [undefined, undefined], "no call of an answer that is not kept");
  assert.equal(t.log.length, 0, "nothing ran");
  // Between two answers: the Stop seen at the next round's start. Its time after the last round's calls were done: the model's mark.
  let at2 = 0;
  const u = await job([say("", [call("bash", { command: "ls" }, "b1")]), say("never")], { deps: { stopped: async () => at2 > 0, stoppedAt: () => at2, bg: { stalls: async () => { await wait(5); at2 = Date.now(); return []; } } } });
  assert.equal(u.r.status, "stopped");
  assert.deepEqual([u.told("b1"), last(u)], ["ran ls", MARK_MODEL]);
  assert.equal(u.requests.length, 1);
  // Its time while the last round's call still ran (the call kept its result): '… for tool use'.
  let at3 = 0, ranAt = 0;
  const v = await job([say("", [call("bash", { command: "ls" }, "b1")]), say("never")], { deps: ({ log }) => ({ stopped: async () => at3 > 0, stoppedAt: () => at3, bg: { stalls: async () => { ranAt = (log.find((e) => e.ev === "start") || {}).at; at3 = Date.now() - 1000; return []; } } }) });
  assert.equal(v.r.status, "stopped");
  assert.ok(ranAt >= 0);
  assert.deepEqual(last(v), MARK);
  // Right after the owner's message, before Grok's first answer: the model's mark, after their message.
  const w = await job([say("never")], { deps: { stopped: async () => true, stoppedAt: () => 0 } });
  assert.equal(w.r.status, "stopped");
  assert.equal(w.requests.length, 0);
  assert.deepEqual(w.r.messages.slice(-2).map((m) => m.content), ["go", MARK_MODEL.content]);
});

test("IN5 a No on the plan's card and a question card left with no answer end the round as the owner's No: the mark after the results; none after a pause, a No with words, or a job that ends on its own", async () => {
  const plan = await job([say("My plan.", [call("exit_plan_mode", { plan: "1. A\n2. B" }, "x1")]), say("never")], { mode: "plan", answer: () => ({ choice: "no" }) });
  assert.equal(plan.r.status, "done");
  assert.deepEqual([plan.told("x1"), last(plan)], [REJECTED, MARK]);
  const q = await job([say("", [call("ask_user", { questions: [{ question: "Which database?", header: "DB", multiSelect: false, options: [{ label: "Postgres", description: "SQL" }, { label: "Mongo", description: "documents" }] }] }, "q1"), call("bash", { command: "ls" }, "b1")]), say("never")], { answer: () => ({ choice: "none" }) });
  assert.equal(q.r.status, "done");
  assert.deepEqual([q.told("q1"), q.told("b1"), last(q)], [REJECTED, REJECTED, MARK]);
  // A pause: no mark (the round goes on when the card is answered).
  const rules = { allow: [], deny: [], ask: ["Read(ask.txt)"] };
  const pz = await job([say("", [call("read", { path: "ask.txt" }, "r1")]), say("never")], { rules, answer: () => ({ choice: "park" }) });
  assert.equal(pz.r.status, "parked");
  assert.equal(marks(pz.r.messages).length, 0);
  // A No with words goes on (Claude Code's deny without interrupt): no mark.
  const said = await job([say("", [call("read", { path: "ask.txt" }, "r1")]), say("Done.")], { rules, answer: () => ({ choice: "no", comment: "read b.txt instead" }) });
  assert.equal(said.r.status, "done");
  assert.equal(marks(said.r.messages).length, 0);
  // A job that ends with its answer: none.
  const plain = await job([say("", [call("bash", { command: "ls" }, "b1")]), say("Done.")]);
  assert.equal(marks(plain.r.messages).length, 0);
});

test("IN6 a paused card answered No later: the job that takes the round up again gives its results, then the mark, then what waited for them; Stop on a paused card (the Worker's stopParked): the results, then the mark; the owner's next message closing it: no mark", async () => {
  // The loop as Coder's Worker starts it for a card's answer.
  const loop = async (steps, opts, ask) => {
    let n = 0;
    const r = await A.runCoder({ send: async () => steps[Math.min(n++, steps.length - 1)], exec: async (x) => ({ code: 0, output: "ran: " + x.command + "\n" }), emit: () => {}, ask, here: () => ROOT, root: ROOT, chatId: "f6-in6" }, { text: "go", messages: [], mode: "acceptEdits", ...opts });
    return r;
  };
  const first = await loop([say("I'll lint it.", [call("bash", { command: "npm run lint" }, "b1"), call("bash", { command: "git status" }, "b2")])], {}, async () => ({ choice: "park" }));
  assert.equal(first.status, "parked");
  const no = await loop([say("never")], { text: "", messages: first.messages, takeUp: { ...first.parked, answer: { choice: "no" } } }, async () => { throw new Error("no card"); });
  assert.equal(no.status, "done");
  const tail = no.messages.slice(-3);
  assert.deepEqual(tail.map((m) => m.role + ":" + (m.tool_call_id || m.content)), ["tool:b1", "tool:b2", "user:" + MARK.content]);
  // The Worker's Stop on the paused card.
  const rec = first.parked;
  const stopped = PK.stopParked(first.messages, rec);
  // (Each call without a result: Claude Code's words for every call of a turn its Stop hands back stopped, its KR, NOT_NOW.)
  assert.deepEqual(stopped.slice(-3), [{ role: "tool", tool_call_id: "b1", content: NOT_NOW }, { role: "tool", tool_call_id: "b2", content: NOT_NOW }, MARK]);
  assert.equal(PK.stopParked(stopped, rec), stopped, "nothing more when the round is closed already");
  // The owner's next message: Claude Code's "approval request … closed" words, no mark (its turn was not interrupted).
  const byMessage = PK.closeParked(first.messages, rec, PK.CARD_CLOSED);
  assert.equal(marks(byMessage).length, 0);
  // The Worker uses it for a Stop only.
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /byMessage \? closeParked\(msgs, mine, CARD_CLOSED\) : stopParked\(msgs, mine\)/);
});

test("IN7 the mark in a summary, a Rewind and the saved chat: never a cut point or the owner's words (the summary calls it a note of Coder's app), kept whole by the Worker's trims; Gloopy's jobs keep their own ways (no mark)", async () => {
  const C = await import("../container/coder-compact.mjs");
  const { capHistory, wholeSteps } = await import("../src/coder-routes.mjs").then(async (m) => ({ capHistory: m.capHistory, wholeSteps: (await import("../src/coder-live.mjs")).wholeSteps }));
  const msgs = [
    { role: "user", content: "fix the cart " + "x".repeat(3000) },
    { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "bash", arguments: "{\"command\":\"ls\"}" } }] },
    { role: "tool", tool_call_id: "c1", content: REJECTED },
    P.interruptedNote(),
    { role: "user", content: "use the other file" },
    { role: "assistant", content: "OK." },
  ];
  // The Worker's trim starts again at one of the owner's messages, never at the mark.
  const capped = capHistory(msgs, 1500);
  assert.equal(capped[0].content, "use the other file");
  assert.deepEqual(wholeSteps(msgs.slice(0, 4)), msgs.slice(0, 4), "a closed round with its mark is kept whole");
  // A summary's transcript names it a note of Coder's app.
  const req = C.summaryRequest(msgs.slice(0, 4));
  assert.match(req.messages[1].content, /NOTE FROM CODER'S APP: \[Request interrupted by the owner for tool use\]/);
  assert.doesNotMatch(req.messages[1].content, /OWNER: \[Request interrupted/);
  // Gloopy: its Stop and No as before.
  const src = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(src, /if \(await stopped\(\)\) \{ if \(!offered && !shellCut\) convo\.push\(interruptedNote\(stopTime\(\) <= roundDoneAt\)\); emit\(\{ type: "stopped" \}\); return end\("stopped"\); \}/);
  assert.match(src, /if \(offered\) \{ emit\(\{ type: "stopped" \}\); return end\("stopped"\); \}\n\s+throw closeRound\("stop"\);/);
});

test("CK1 the auto mode checker's tenth response in a row with no verdict ends the turn as Claude Code's denial ends it ('permission-stop'): that call told so, a call beside it still running aborted ('[Request interrupted by the owner for tool use]'), one not started told '[Tool call skipped: …]'; the owner's line; no mark of an interrupted turn", async () => {
  const steps = [...Array.from({ length: 9 }, (_, i) => say("", [call("bash", { command: "npm install " + i }, "c" + i)])), say("", [call("bash", { command: "cat a.txt" }, "c9"), call("read", { path: "slow.txt" }, "r9"), call("edit", { path: "x.txt", old_string: "a", new_string: "b" }, "e9")]), say("never")];
  const t = await job(steps, { mode: "auto", checker: true, verdict: () => "hmm", ms: (tag) => (tag === "read:slow.txt" ? 200 : 5) });
  assert.equal(t.r.status, "failed", "audit M-g-22: ends as failed, not done");
  assert.equal(t.requests.length, 10, "Grok is not asked again");
  assert.equal(t.told("c9"), "Auto mode is unavailable: the server returned no safety verdict for 10 responses in a row, so bash was not run and this turn has ended. Wait for the owner's next message before doing anything further.");
  // (Round 6's follow-up: Claude Code aborts a call still running at that denial; its tools' answer then, "by the owner" here.)
  assert.equal(t.told("r9"), P.INTERRUPTED_TOOL_USE, "it had started beside it: aborted");
  assert.ok(t.when("start", "read:slow.txt") >= 0);
  assert.ok(t.events.some((e) => e.type === "result" && e.id === "r9" && e.output === "(stopped when the turn ended)"));
  assert.equal(t.told("e9"), P.SKIPPED_BY_CHECK);
  assert.equal(t.when("start", "edit:x.txt"), -1);
  assert.deepEqual(t.events.filter((e) => e.type === "error").map((e) => e.text), ["Auto mode is unavailable — the server returned no safety verdict for the last 10 responses, so Coder stopped. Send a message to try again, or switch out of auto mode."]);
  assert.equal(marks(t.r.messages).length, 0);
  assert.equal(last(t).role, "tool");
});

test("FV1 the file tools' own checks before their hooks, in Claude Code 2.1.325's order and words (its Read, Write and Edit validateInput): the inputs, a null byte, a path over 4,096 characters or ending in white space once resolved, read's pages, edit's 'No changes to make' (before the deny rules), read's binary kinds (after them); pages as its Read takes them", () => {
  const f = T.fileInputProblem;
  assert.equal(f("read", { path: "" }), "give a path");
  assert.equal(f("read", { path: "a\0.txt" }), "Read file_path cannot contain null bytes (\\0). Remove the null byte and try again.");
  // A path over 4,096 characters, and one that ends in white space once its "." and ".." are resolved (Claude Code's own two
  // checks after the null byte; white space around what was given is trimmed, as its tools take a path: toolPath).
  assert.equal(T.PATH_MAX, 4096);
  assert.equal(f("read", { path: "a/".repeat(2048) + "b" }), "read path has 4097 characters, and read takes at most 4096. Resolve any \"./\" and \"../\" parts, drop any white space around the path, and send it again.");
  assert.equal(f("write", { path: "notes /.", content: "x" }), "write path ends in white space once its \".\" and \"..\" are resolved, and write refuses such a path. If the white space is not meant, send the path without it. write cannot open a file whose own name ends in white space.");
  assert.ok(f("edit", { path: "a.txt /x/..", old_string: "a", new_string: "b" }).startsWith("edit path ends in white space once its \".\" and \"..\" are resolved, and edit refuses such a path."));
  assert.deepEqual([f("read", { path: " a.txt " }), f("edit", { path: "d /..", old_string: "a", new_string: "b" }), f("read", { path: "~/notes.md" })], ["", "", ""], "trimmed, or a white space that a \"..\" takes away: taken");
  assert.equal(f("read", { path: "a\0" + "x".repeat(5000) }).slice(0, 34), "Read file_path cannot contain null", "the null byte first");
  assert.equal(f("read", { path: " pic.bmp " }, "after"), T.BINARY_REFUSED(".bmp"), "its kind from the path as the tool opens it");
  assert.equal(f("read", { path: "doc.pdf", pages: "1,3" }), 'Invalid pages parameter: "1,3". Give one page ("3") or one range ("1-5"), not a list. To read several pages or ranges, read each one separately. Pages are 1-indexed.');
  assert.equal(f("read", { path: "a.zip", pages: "0" }).slice(0, 25), "Invalid pages parameter: ", "pages before the binary kind, as there");
  assert.equal(f("read", { path: "pic.bmp" }), "", "the binary kinds come after the deny rules");
  assert.deepEqual(["pic.bmp", "scan.TIF", "fax.tiff", "app.zip", "x.png", "x.webp", "doc.pdf", "notes.txt"].map((p) => f("read", { path: p }, "after")), [T.BINARY_REFUSED(".bmp"), T.BINARY_REFUSED(".tif"), T.BINARY_REFUSED(".tiff"), T.BINARY_REFUSED(".zip"), "", "", "", ""]);
  assert.equal(f("edit", { path: "a.txt", new_string: "b" }), "give old_string: the exact text to replace");
  assert.equal(f("edit", { path: "a\0", old_string: "x", new_string: "x" }), "Edit file_path cannot contain null bytes (\\0). Remove the null byte and try again.", "a null byte before 'No changes', as there");
  assert.equal(f("edit", { file_path: "a.txt", old_str: "x", new_str: "x" }), "No changes to make: old_string and new_string are exactly the same.");
  assert.equal(f("write", { path: "a.txt" }), "give the file's content");
  assert.equal(f("write", { path: "a.txt", content: "x", file_text: "y" }), "write failed due to the following issue: An unexpected parameter `file_text` was provided");
  assert.equal(f("write", { path: "b\0.txt", content: "x" }), "Write file_path cannot contain null bytes (\\0). Remove the null byte and try again.");
  assert.equal(f("write", { path: "ok.txt", content: "x" }), "");
  // Read's pages, as Claude Code's Read takes them: one page or one range ("3-" to the end), at most 20; "" as none.
  assert.deepEqual(["3", "1-20", " 2 - 4 ", "", null].map(T.pagesProblem), ["", "", "", "", ""]);
  assert.equal(T.pagesProblem("1-21"), 'Page range "1-21" exceeds maximum of 20 pages per request. Please use a smaller range.');
  assert.equal(T.pagesProblem("3-"), 'Page range "3-" exceeds maximum of 20 pages per request. Please use a smaller range.');
  for (const bad of ["0", "5-3", "2–4", "1-2-3", "x"]) assert.match(T.pagesProblem(bad), /^Invalid pages parameter: /, bad);
  // Edit's size limit in Claude Code's words (its sizes as it writes them), with Coder's limit.
  assert.deepEqual([T.ccSize(900), T.ccSize(1536), T.ccSize(300 * 1048576), T.ccSize(1073741824)], ["900 bytes", "1.5KB", "300MB", "1GB"]);
  assert.equal(T.editTooBig(300 * 1048576), "File is too large to edit (300MB). Maximum editable file size is 256MB.");
});

test("FV2 in Coder's loop: a call its own checks refuse runs no PreToolUse hook and shows no card (its step and failure shown as its run showed them); write and edit ask the machine's part first (file_check), whose refusal comes before their hooks and Plan's card; edit's 'No changes' before a deny rule, read's deny rule before its binary kind; at a group's start such a read runs nothing, not even its hooks", async () => {
  const hooks = { PreToolUse: [{ matcher: "Read|Write|Edit", hooks: [{ type: "command", command: "pre.sh" }] }] };
  const steps = [say("", [
    call("read", { path: "logo.bmp" }, "r1"),
    call("read", { path: "a.txt" }, "r2"),
    call("read", { path: "doc.pdf", pages: "1,2" }, "r3"),
    call("edit", { path: "same.txt", old_string: "x", new_string: "x" }, "e1"),
    call("edit", { path: "gone.txt", old_string: "x", new_string: "y" }, "e2"),
    call("write", { path: "sub", content: "x" }, "w1"),
    call("edit", { path: "ok.txt", old_string: "x", new_string: "y" }, "e3"),
  ]), say("Done.")];
  const check = (req) => (req.args.path === "gone.txt" ? { code: 1, output: "error: File does not exist. Note: your current working directory is /work/shop.\n" } : req.args.path === "sub" ? { code: 1, output: "error: sub is a directory, not a file. To create a file inside it, include the file name in path." } : { code: 0, output: "ok" });
  const t = await job(steps, { mode: "plan", hooks, check, answer: () => ({ choice: "yes" }) });
  assert.deepEqual(t.hookIns.filter((h) => h.hook_event_name === "PreToolUse").map((h) => h.tool_use_id).sort(), ["e3", "r2"], "only the calls their checks let through");
  assert.equal(t.told("r1"), "error: " + T.BINARY_REFUSED(".bmp"));
  assert.match(t.told("r3"), /^error: Invalid pages parameter: "1,2"\./);
  assert.equal(t.told("e1"), "error: No changes to make: old_string and new_string are exactly the same.");
  assert.equal(t.told("e2"), "error: File does not exist. Note: your current working directory is /work/shop.");
  assert.equal(t.told("w1"), "error: sub is a directory, not a file. To create a file inside it, include the file name in path.");
  assert.equal(t.cards.length, 1, "Plan's card only for the edit that passed its checks");
  assert.equal(t.cards[0].tool, "edit");
  assert.deepEqual(t.checks.map((c) => [c.tool, c.args.path]), [["edit", "gone.txt"], ["write", "sub"], ["edit", "ok.txt"]], "the machine's part only for write and edit, after their own input checks");
  assert.equal(t.when("start", "read:logo.bmp"), -1);
  // As its run showed them: the step, then its failure (not "Not run").
  const r1 = t.events.filter((e) => e.id === "r1").map((e) => [e.type, e.ran === false ? "not run" : e.code]);
  assert.deepEqual(r1, [["bash", undefined], ["result", 1]]);
  // A deny rule's words come after edit's 'No changes', before read's binary kind (Claude Code's order).
  const rules = { allow: [], deny: ["Edit(same.txt)", "Read(secret.bmp)"], ask: [] };
  const d = await job([say("", [call("edit", { path: "same.txt", old_string: "x", new_string: "x" }, "e1"), call("read", { path: "secret.bmp" }, "r1")]), say("Done.")], { rules });
  assert.equal(d.told("e1"), "error: No changes to make: old_string and new_string are exactly the same.");
  assert.equal(d.told("r1"), "File is in a directory that is denied by your permission settings.");
  // At a group's start: the .bmp read is refused there (no hook, no run), the others go on beside each other.
  const g = await job([say("", [call("read", { path: "a.txt" }, "r1"), call("read", { path: "b.tiff" }, "r2"), call("read", { path: "c.txt" }, "r3")]), say("Done.")], { hooks, ms: () => 30 });
  assert.deepEqual(g.hookIns.map((h) => h.tool_use_id).sort(), ["r1", "r3"]);
  assert.equal(g.when("start", "read:b.tiff"), -1);
  assert.ok(g.when("start", "read:c.txt") < g.when("end", "read:a.txt"), "the others ran side by side");
  assert.equal(g.told("r2"), "error: " + T.BINARY_REFUSED(".tiff"));
});

test("FV3 the tools script's part, for real (its file_check and each run, the same checks in Claude Code's order and words): write's folder; edit's size (Claude Code's words), folder, missing file, 'Cannot create new file', notebook, changed since read where the old text is not there once (before 'not text'), not text (before 'not found'), not found, more than once; a path refused after the hooks is left for then; read's binary kinds and pages, before the path's own checks", () => {
  const dir = mkdtempSync(join(tmpdir(), "f6-fv3-"));
  const seen = mkdtempSync(join(tmpdir(), "f6-fv3-seen-"));
  const tool = (name, args) => String(spawnSync("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool: name, args })).toString("base64")], { cwd: dir, encoding: "utf8", env: { ...process.env, CODER_SEEN_DIR: seen } }).stdout || "");
  const chk = (name, args) => tool("file_check", { tool: name, args });
  try {
    writeFileSync(join(dir, "a.txt"), "hello world\nhello again\n");
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, "nb.ipynb"), "{}\n");
    writeFileSync(join(dir, "bin.txt"), Buffer.from("zz\0zz\n"));
    writeFileSync(join(dir, "big.txt"), "");
    truncateSync(join(dir, "big.txt"), 300 * 1048576);
    assert.equal(chk("write", { path: "sub" }), "error: sub is a directory, not a file. To create a file inside it, include the file name in path.");
    assert.equal(chk("write", { path: "new.txt" }), "ok");
    assert.equal(chk("write", { path: "/etc/hosts" }), "ok", "outside the project: refused after its hooks, as before");
    assert.equal(tool("write", { path: "/etc/hosts", content: "x" }), "error: that path is outside the project");
    assert.equal(chk("edit", { path: "big.txt", old_string: "a", new_string: "b" }), "error: File is too large to edit (300MB). Maximum editable file size is 256MB.");
    assert.equal(chk("edit", { path: "sub", old_string: "a", new_string: "b" }), "error: " + join(dir, "sub") + " is a folder, not a file: list what is in it with glob, or a command such as ls");
    assert.equal(chk("edit", { path: "gone.txt", old_string: "a", new_string: "b" }), "error: File does not exist. Note: your current working directory is " + dir + ".");
    assert.equal(chk("edit", { path: "gone.txt", old_string: "", new_string: "b" }), "ok", "no old text, no file: made by the run");
    assert.equal(chk("edit", { path: "a.txt", old_string: "", new_string: "b" }), "error: Cannot create new file - file already exists.");
    assert.equal(chk("edit", { path: "nb.ipynb", old_string: "{}", new_string: "[]" }), "error: " + T.EDIT_NOTEBOOK);
    assert.equal(chk("edit", { path: "bin.txt", old_string: "nope", new_string: "b" }), "error: bin.txt " + T.notTextRefused("nul"), "not text before not found");
    assert.equal(chk("edit", { path: "a.txt", old_string: "nope", new_string: "b" }), "error: String to replace not found in file.\nString: nope");
    assert.equal(chk("edit", { path: "a.txt", old_string: "hello", new_string: "bye" }), "error: Found 2 matches of the string to replace, but replace_all is false. To replace all occurrences, set replace_all to true. To replace only one occurrence, please provide more context to uniquely identify the instance.\nString: hello");
    assert.equal(chk("edit", { path: "a.txt", old_string: "hello", new_string: "bye", replace_all: true }), "error: " + T.EDIT_NOT_READ, "it would go through, but it was never read (live test, 2026-11-24)");
    // Changed since read: refused where its old text is not there once (before 'not text' and 'not found'); applied where it is.
    tool("read", { path: "a.txt" });
    writeFileSync(join(dir, "a.txt"), "hello world\nchanged line\n");
    assert.equal(chk("edit", { path: "a.txt", old_string: "nope", new_string: "b" }), "error: " + T.WRITE_CHANGED + ".");
    assert.equal(chk("edit", { path: "a.txt", old_string: "changed line", new_string: "b" }), "error: " + T.WRITE_CHANGED + ".", "refused even where it applies (2026-11-27, as Claude Code)");
    // The run's own order is the same (its checks first): a changed file whose old text is gone.
    assert.equal(tool("edit", { path: "a.txt", old_string: "nope", new_string: "b" }), "error: " + T.WRITE_CHANGED + ".");
    // Its path's own checks: Claude Code's words, before anything else on the machine.
    assert.equal(tool("read", { path: "sub /." }), "error: read path ends in white space once its \".\" and \"..\" are resolved, and read refuses such a path. If the white space is not meant, send the path without it. read cannot open a file whose own name ends in white space.");
    assert.match(tool("write", { path: "x".repeat(5000), content: "a" }), /^error: write path has 5000 characters, and write takes at most 4096\./);
    // Read: binary kinds and pages first, before the path's own checks (a missing .bmp is refused as binary, as there).
    assert.equal(tool("read", { path: "missing.bmp" }), "error: " + T.BINARY_REFUSED(".bmp"));
    assert.equal(tool("read", { path: "missing.pdf", pages: "9-40" }), 'error: Page range "9-40" exceeds maximum of 20 pages per request. Please use a smaller range.');
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(seen, { recursive: true, force: true }); }
});

test("FV4 read shows only Claude Code's picture kinds (png, jpg, jpeg, gif, webp) and PDFs; .bmp, .tif and .tiff are refused in its words for a binary kind; the read tool's description and the docs page say so", () => {
  assert.deepEqual(Object.keys(T.PIC_KINDS), [".png", ".jpg", ".jpeg", ".gif", ".webp"]);
  for (const e of [".bmp", ".tif", ".tiff"]) assert.ok(T.BINARY_EXTS.has(e), e + " is on Claude Code's binary list");
  const src = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.ok(src.includes("A picture (PNG, JPG, GIF, WebP; a screenshot you took, say): shown to you as a picture."));
  const page = readFileSync(new URL("../public/docs.html", import.meta.url), "utf8");
  assert.ok(page.includes("PNG, JPEG, GIF and WebP, up to 128 MB.") && page.includes("BMP and TIFF files are not opened as pictures (as in Claude Code)"));
});

// ── ROUND 6'S FOLLOW-UP (the coordinator's items 1 to 5; the owner: "do what claude code does") ─────────────────────────────

test("IN8 the owner's own '!' command cut short by their Stop: Claude Code's note, the command and '[Request interrupted by the owner]', what it printed dropped (the chat still shows it), no answer, and no second mark; one that ended before the Stop keeps its output", async () => {
  let stopAt = 0, sent = 0;
  const events = [];
  const notice = { id: "job1", desc: "Build the site", command: "npm run build", log: "/x/bg-1.log", code: 0, why: "exit" };
  // (The machine kills it at the Stop: a failed exit.)
  const cut = await A.runCoder({ send: async () => { sent++; return say("never"); }, exec: async () => { stopAt = Date.now(); await wait(5); return { code: 137, output: "half of the build\n" }; }, stopped: async () => stopAt > 0, stoppedAt: () => stopAt, emit: (e) => events.push(e), here: () => ROOT, root: ROOT }, { shell: "npm run build", notices: [notice] });
  assert.equal(sent, 0, "no answer");
  assert.equal(cut.status, "stopped");
  assert.deepEqual(cut.messages.slice(0, 3).map((m) => m.content), [A.SHELL_CAVEAT, "<bash-input>npm run build</bash-input>", MARK_MODEL.content]);
  assert.deepEqual(cut.messages[2], MARK_MODEL, "a message of Coder's app, not the owner's");
  assert.equal(marks(cut.messages).length, 1, "no second one at the next round's start (the background command's news came)");
  assert.ok(!cut.messages.some((m) => /half of the build/.test(String(m.content))), "what it printed is not kept");
  assert.ok(events.some((e) => e.type === "result" && /half of the build/.test(e.output)), "the chat shows what it printed, as before");
  // Ended (failed) before the Stop came: its output kept, with the note; no answer, no mark.
  const before = await A.runCoder({ send: async () => { sent++; return say("never"); }, exec: async () => ({ code: 1, output: "1 failing\n" }), stopped: async () => true, stoppedAt: () => Date.now() + 60_000, emit: () => {}, here: () => ROOT, root: ROOT }, { shell: "npm test" });
  assert.equal(sent, 0);
  assert.deepEqual(before.messages.map((m) => m.content), [A.SHELL_CAVEAT, "<bash-input>npm test</bash-input>", "<bash-stdout>1 failing</bash-stdout><bash-stderr>Exit code 1</bash-stderr>"]);
  // One that finished well while the Stop came: its output kept (Claude Code's success path).
  const ok = await A.runCoder({ send: async () => { sent++; return say("never"); }, exec: async () => ({ code: 0, output: "a.txt\n" }), stopped: async () => true, stoppedAt: () => 1, emit: () => {}, here: () => ROOT, root: ROOT }, { shell: "ls" });
  assert.deepEqual(ok.messages.map((m) => m.content), [A.SHELL_CAVEAT, "<bash-input>ls</bash-input>", "<bash-stdout>a.txt</bash-stdout><bash-stderr></bash-stderr>"]);
});

test("IN9 a Stop while Grok answers: its request aborted within moments (its answer, words only here, never kept or shown), then '[Request interrupted by the owner]'; coderSend sends nothing once the job's signal is aborted, nor any retry", async () => {
  let stopAt = 0;
  setTimeout(() => { stopAt = Date.now(); }, 30);
  const t0 = Date.now();
  const t = await job([say("Here is the whole plan, in words.")], { sendMs: 5000, deps: { stopped: async () => stopAt > 0, stoppedAt: () => stopAt } });
  assert.ok(Date.now() - t0 < 2000, "not after the answer came");
  assert.equal(t.r.status, "stopped");
  assert.equal(t.requests[0].signal.aborted, true, "its request cut");
  assert.deepEqual(last(t), MARK_MODEL);
  assert.equal(t.r.messages.filter((m) => m.role === "assistant").length, 0, "nothing of its answer kept");
  assert.ok(!t.events.some((e) => e.type === "text"), "none of its words shown");
  assert.ok(t.events.some((e) => e.type === "stopped"));
  // The same answer with no Stop: the turn's answer.
  const plain = await job([say("Here is the whole plan, in words.")], { sendMs: 300, deps: { stopped: async () => false } });
  assert.equal(plain.r.status, "done");
  assert.equal(plain.r.summary, "Here is the whole plan, in words.");
  // coderSend: nothing sent once aborted; aborted while it waits to retry: no second request.
  const { coderSend } = await import("../container/coder-model.mjs");
  const req = { model: "m", messages: [{ role: "user", content: "hi" }] };
  let fetches = 0;
  const gone = new AbortController(); gone.abort();
  await assert.rejects(coderSend({ XAI_API_KEY: "stand-in" }, { fetchFn: async () => { fetches++; return new Response("busy", { status: 503 }); }, wait: async () => {} })({ ...req, signal: gone.signal }), (e) => e.name === "AbortError");
  assert.equal(fetches, 0);
  const later = new AbortController();
  let sig = null;
  await assert.rejects(coderSend({ XAI_API_KEY: "stand-in" }, { fetchFn: async (u, init) => { fetches++; sig = init.signal; return new Response("busy", { status: 503 }); }, wait: async () => { later.abort(); } })({ ...req, signal: later.signal }), (e) => e.name === "AbortError");
  assert.equal(fetches, 1, "the first request only");
  assert.equal(sig.aborted, true, "the job's signal reaches the request, beside its own time limit");
});

test("RS1 refusals in a row under denyInsteadOfPrompting, as Claude Code 2.1.325 counts them: its checker's blocks and the calls its check declines to judge, a call let through ending the count; the 20th told Claude Code's words, and the turn ends as a check's denial ends it (the calls not started skipped, the owner's line, no mark); none counted with the setting off", async () => {
  assert.equal(A.refusedStreakTold("bash"), "20 actions were refused and no work went ahead in between, so bash was not run and this turn is ending.");
  assert.equal(A.REFUSED_STREAK_SHOWN, "20 actions were refused and no work went ahead in between, so Coder stopped.");
  const many = Array.from({ length: 22 }, (_, k) => call("bash", { command: "npm publish --tag t" + k }, "p" + k));
  const declines = () => "I can't help with that.";
  const t = await job([say("", many), say("never")], { mode: "auto", checker: true, verdict: declines, opts: { denyInstead: true } });
  assert.equal(t.r.status, "done");
  assert.equal(t.requests.length, 1, "Grok is not asked again");
  assert.match(t.told("p18"), /declined to judge this action/);
  assert.equal(t.told("p19"), A.refusedStreakTold("bash"));
  assert.deepEqual([t.told("p20"), t.told("p21")], [P.SKIPPED_BY_CHECK, P.SKIPPED_BY_CHECK]);
  assert.deepEqual(t.events.filter((e) => e.type === "error").map((e) => e.text), [A.REFUSED_STREAK_SHOWN]);
  assert.equal(marks(t.r.messages).length, 0);
  assert.equal(t.log.length, 0, "nothing ran");
  // The setting off: no count, the turn goes on.
  const off = await job([say("", many), say("Nothing was published.")], { mode: "auto", checker: true, verdict: declines });
  assert.equal(off.requests.length, 2);
  // A call let through between them: the count starts again.
  const mixed = [...many.slice(0, 19), call("bash", { command: "ls" }, "l1"), ...many.slice(19)];
  const reset = await job([say("", mixed), say("Nothing was published.")], { mode: "auto", checker: true, verdict: (action) => (/\bls\b/.test(action) ? '{"decision":"allow"}' : "I can't help with that."), opts: { denyInstead: true } });
  assert.equal(reset.requests.length, 2, "the turn went on");
  assert.equal(reset.told("l1"), "ran ls");
  // The checker's blocks count too (each counted, and blocked), Gloopy's runs keep their own count: the source.
  const src = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.equal(src.split("refusedReply(c, reply, autoDenied(why0) + await deniedHooks(c, why0))").length - 1, 4, "the four places a check blocks a call");
  // (A block at auto mode's limit, which falls back to asking, counted too, before that fallback, as Claude Code counts it.)
  assert.equal(src.split("refusedAtLimit(c, reply, v);").length - 1, 4);
  assert.match(src, /if \(offered\) \{ deniedRow\+\+; deniedLast = true; \}/);
});

test("CK2 the check's denial that ends the turn with calls still running beside it (Claude Code's 'permission-stop'): a command goes on in the background (the machine moves it, moveRunning), told as Claude Code tells one moved there as its turn ended, what it printed so far first; a read still running told '[Request interrupted by the owner for tool use]'; one not started skipped; none moved where commands may not go to the background", async () => {
  const d = Array.from({ length: 20 }, (_, k) => call("bash", { command: "cat f" + k + ".txt" }, "d" + k));
  const steps = [say("", [...d, call("bash", { command: "echo started; sleep 30" }, "s1"), call("read", { path: "slow.txt" }, "r1"), call("edit", { path: "x.txt", old_string: "a", new_string: "b" }, "e1")]), say("never")];
  const verdict = (action) => (/sleep 30/.test(action) ? '{"decision":"allow"}' : "I can't help with that.");
  const once = async (opts) => {
    let pending = null, moved = 0;
    const t = await job(steps, {
      // (The command an allow rule of the owner's covers: it starts at once, with no check, beside the others' checks.)
      mode: "auto", checker: true, verdict, rules: { allow: ["Bash(echo:*)", "Bash(sleep:*)"], deny: [], ask: [] }, ms: (tag) => (tag === "read:slow.txt" ? 300 : 5), opts,
      bash: (x, run) => (/sleep 30/.test(x.command) ? new Promise((ok) => { pending = ok; }) : run("bash:" + x.command, { code: 0, output: "ran\n" })),
      deps: { moveRunning: () => { if (!pending) return 0; moved++; pending({ code: -1, background: true, byTurnEnd: true, pid: 4242, log: "/srv/coder-bg/shop/bg-7.log", jobId: "job7", output: "started\n", size: 8 }); pending = null; return 1; } },
    });
    return { t, moved };
  };
  const { t, moved } = await once({ denyInstead: true });
  assert.equal(t.r.status, "done");
  assert.equal(moved, 1);
  assert.equal(t.told("d19"), A.refusedStreakTold("bash"));
  assert.equal(t.told("s1"), "started\nCommand running in background with ID: job7. Output is being written to: /srv/coder-bg/shop/bg-7.log. " + A.BG_NOTICE + " " + A.BG_MOVED_LIMIT + " It is running now: do not start a second copy while it runs. If it is no longer needed, stop it with stop_job. To check interim output, use read on that file path.");
  assert.ok(t.events.some((e) => e.type === "result" && e.id === "s1" && e.background === true && e.job === "job7"));
  assert.equal(t.told("r1"), P.INTERRUPTED_TOOL_USE);
  assert.equal(t.told("e1"), P.SKIPPED_BY_CHECK);
  assert.equal(t.when("start", "edit:x.txt"), -1);
  assert.deepEqual(t.events.filter((e) => e.type === "error").map((e) => e.text), [A.REFUSED_STREAK_SHOWN]);
  assert.equal(marks(t.r.messages).length, 0);
  // No command may go to the background (CODER_DISABLE_BACKGROUND_TASKS): none moved; it is told as the read is.
  const off = await once({ denyInstead: true, noBg: true });
  assert.equal(off.moved, 0);
  assert.deepEqual([off.t.told("s1"), off.t.told("r1")], [P.INTERRUPTED_TOOL_USE, P.INTERRUPTED_TOOL_USE]);
});

test("MV1 Coder's machine, for real: a command moved as the turn ends says so (execIn's move \"turn\": byTurnEnd, not the owner's, not its timeout); a job whose check's denial ends its turn moves the command still running beside it, which goes on in the background, and Coder is told so", async () => {
  const S = await import("../container/server.mjs");
  const dir = mkdtempSync(join(tmpdir(), "f6-mv-"));
  let mover = null;
  const p = S.execIn(dir, "echo started; sleep 30", 60, { bgDir: join(dir, "bg"), onMove: (fn) => { mover = fn; } });
  await wait(300);
  assert.equal(typeof mover, "function");
  assert.equal(mover("turn"), true);
  const r = await p;
  try {
    assert.deepEqual([r.background, r.byTurnEnd, r.byUser, r.timedOut], [true, true, undefined, false]);
    assert.match(String(r.output), /started/);
  } finally { try { process.kill(-r.pid, "SIGKILL"); } catch { /* gone */ } }
  // The whole job on a machine.
  const http = await import("node:http");
  const root = mkdtempSync(join(tmpdir(), "f6-root-")), mem = mkdtempSync(join(tmpdir(), "f6-mem-")), git = mkdtempSync(join(tmpdir(), "f6-git-")), bgr = mkdtempSync(join(tmpdir(), "f6-bgr-"));
  const d = Array.from({ length: 20 }, (_, k) => call("bash", { command: "cat f" + k + ".txt" }, "d" + k));
  const steps = [say("", [...d, call("bash", { command: "echo started; sleep 30" }, "s1")]), say("never")];
  let n = 0;
  const send = async (req) => {
    const sys = String((req.messages[0] && req.messages[0].content) || "");
    if (CHECKER.test(sys)) { const action = String(req.messages[1].content).split("THE ACTION TO JUDGE:\n")[1] || ""; return { message: { role: "assistant", content: /sleep 30/.test(action) ? '{"decision":"allow"}' : "I can't help with that." }, usage: { in: 1, out: 1 } }; }
    return steps[Math.min(n++, steps.length - 1)];
  };
  const srv = http.createServer(S.createApp({ root, memRoot: mem, gitRoot: git, bgRoot: bgr, send, checker: true }));
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  const post = (path, b) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  try {
    assert.equal((await post("/turn", { project: "shop-mv", text: "go", messages: [], mode: "auto", prefs: { denyInstead: true }, rules: { allow: ["Bash(echo:*)", "Bash(sleep:*)"], deny: [], ask: [] } })).status, 200);
    let st; for (let i = 0; i < 200; i++) { st = await (await fetch(base + "/state?project=shop-mv&since=0")).json(); if (st.result) break; await wait(50); }
    assert.ok(st.result, "the job ended");
    const told = (id) => (st.result.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content;
    assert.equal(told("d19"), A.refusedStreakTold("bash"));
    assert.match(told("s1"), /^(started\n)?Command running in background with ID: job1\. Output is being written to: [^ ]+\. You will be notified when it completes\. If it is still running after 30m in the background, it will be stopped and you will be notified\. It is running now: do not start a second copy while it runs\. If it is no longer needed, stop it with stop_job\. To check interim output, use read on that file path\.$/);
    assert.ok(st.result.background.some((b) => b.id === "job1"), "it goes on in the background");
    assert.equal(n, 1, "Grok is not asked again");
  } finally {
    await post("/bgstop", { project: "shop-mv", id: "job1" }).catch(() => {});
    await new Promise((ok) => srv.close(ok));
    S.usePrefs({});
  }
});

// ── ROUND 6'S FOLLOW-UP, ITEM 6: the file tools' own checks Coder still lacked (Claude Code 2.1.325's validateInput) ───────────

test("FV5 the tools script, for real: a pipe in the project refused by write and edit in Claude Code's words (never waited on); edit's 'Did you mean …?'; the read-first rule where the change would need the owner's approval (guard); a settings file an edit would leave invalid; a secret written to Coder's memory file; a device or a process's file refused by read", () => {
  const dir = mkdtempSync(join(tmpdir(), "f6-fv5-"));
  const seen = mkdtempSync(join(tmpdir(), "f6-fv5-seen-"));
  const mem = mkdtempSync(join(tmpdir(), "f6-fv5-mem-"));
  const memFile = join(mem, "MEMORY.md");
  const tool = (name, args, env = {}) => String(spawnSync("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool: name, args })).toString("base64")], { cwd: dir, encoding: "utf8", timeout: 20_000, env: { ...process.env, CODER_SEEN_DIR: seen, CODER_MEMORY_FILE: memFile, ...env } }).stdout || "");
  const chk = (name, args, guard = false) => tool("file_check", { tool: name, args, ...(guard ? { guard: true } : {}) });
  try {
    // A pipe: refused at once (Claude Code: "… exists but is not a regular file (a device, FIFO or socket). …").
    assert.equal(spawnSync("mkfifo", [join(dir, "pipe")]).status, 0);
    const t0 = Date.now();
    assert.equal(chk("write", { path: "pipe" }), "error: pipe exists but is not a regular file (a device, FIFO or socket). Write only creates or overwrites regular files.");
    assert.equal(tool("write", { path: "pipe", content: "x" }), "error: pipe exists but is not a regular file (a device, FIFO or socket). Write only creates or overwrites regular files.");
    assert.equal(chk("edit", { path: "pipe", old_string: "a", new_string: "b" }), "error: pipe exists but is not a regular file (a device, FIFO or socket). Edit only changes regular files.");
    assert.ok(Date.now() - t0 < 15_000, "never waited on the pipe");
    // Did you mean: a file beside it with another extension; the same path under the commands' folder (a subfolder here).
    writeFileSync(join(dir, "app.js"), "a\n");
    assert.equal(chk("edit", { path: "app.ts", old_string: "a", new_string: "b" }), "error: File does not exist. Note: your current working directory is " + dir + ". Did you mean app.js?");
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, "sub", "notes.md"), "a\n");
    assert.equal(chk("edit", { path: join(dir, "notes.md"), old_string: "a", new_string: "b" }, false), "error: File does not exist. Note: your current working directory is " + dir + ".");
    assert.equal(tool("file_check", { tool: "edit", args: { path: join(dir, "notes.md"), old_string: "a", new_string: "b" } }, { CODER_CWD: join(dir, "sub") }), "error: File does not exist. Note: your current working directory is " + join(dir, "sub") + ". Did you mean " + join(dir, "sub", "notes.md") + "?");
    // The read-first rule (Claude Code: "File has not been read yet. Read it first before writing to it."), where it would ask.
    writeFileSync(join(dir, "b.txt"), "one\ntwo\nthree\n");
    assert.equal(T.EDIT_NOT_READ, "File has not been read yet. Read it first before writing to it.");
    assert.equal(chk("edit", { path: "b.txt", old_string: "one", new_string: "1" }, true), "error: " + T.EDIT_NOT_READ);
    assert.equal(chk("edit", { path: "b.txt", old_string: "one", new_string: "1" }), "error: " + T.EDIT_NOT_READ, "never read: refused even where no approval is needed (live test, 2026-11-24)");
    tool("read", { path: "b.txt", limit: 1 });
    assert.equal(chk("edit", { path: "b.txt", old_string: "one", new_string: "1" }, true), "ok", "read with a limit, as asked: read (Claude Code's readFileState has it, not as a partial view)");
    // Read whole but given only its first part (a PARTIAL view, Claude Code's isPartialView): not read yet.
    writeFileSync(join(dir, "long.txt"), "one\n" + "x".repeat(60).concat("\n").repeat(2000));
    tool("read", { path: "long.txt" });
    assert.equal(chk("edit", { path: "long.txt", old_string: "one", new_string: "1" }, true), "error: " + T.EDIT_NOT_READ, "only part of it shown");
    assert.equal(chk("edit", { path: "long.txt", old_string: "one", new_string: "1" }), "ok");
    writeFileSync(join(dir, "c.txt"), "x\n");
    assert.equal(chk("write", { path: "c.txt" }, true), "error: c.txt " + T.WRITE_NOT_READ + ".");
    assert.equal(chk("write", { path: "c.txt" }), "ok");
    assert.equal(chk("write", { path: "new.txt" }, true), "ok", "a new file needs no read");
    // A settings file left invalid (Claude Code: "Claude Code settings.json validation failed after edit: …").
    mkdirSync(join(dir, ".claude"));
    writeFileSync(join(dir, ".claude", "settings.json"), '{\n  "permissions": { "allow": ["Bash(ls)"] }\n}\n');
    tool("read", { path: ".claude/settings.json" });
    const bad = chk("edit", { path: ".claude/settings.json", old_string: '["Bash(ls)"]', new_string: '"Bash(ls)"' });
    assert.ok(bad.startsWith("error: Claude Code settings.json validation failed after edit:\nSettings validation failed:\n- permissions.allow: Expected array, but received string\n\nFull schema:\n{"), bad.slice(0, 200));
    assert.ok(bad.endsWith("\nIMPORTANT: Do not update the env unless explicitly instructed to do so."));
    assert.match(chk("edit", { path: ".claude/settings.json", old_string: '"Bash(ls)"]', new_string: '"Bash(ls)",' }), /^error: Claude Code settings\.json validation failed after edit:\nInvalid JSON: /);
    assert.equal(chk("edit", { path: ".claude/settings.json", old_string: "Bash(ls)", new_string: "Bash(npm test)" }), "ok");
    writeFileSync(join(dir, ".claude", "settings.local.json"), "{ not json");
    tool("read", { path: ".claude/settings.local.json" });
    assert.equal(chk("edit", { path: ".claude/settings.local.json", old_string: "not", new_string: "still not" }), "ok", "invalid before: not checked, as Claude Code");
    // A secret written to Coder's memory file (Claude Code's words for its memory, synced to the account).
    assert.equal(tool("write", { path: memFile, content: "Style: short answers\ntoken ghp_" + "a".repeat(36) + "\n" }), "error: Content contains potential secrets (GitHub PAT) and cannot be written to memory. Memory is synced to your account. Remove the sensitive content and try again.");
    assert.match(tool("write", { path: memFile, content: "Style: short answers\n" }), /^File created successfully at: /);
    assert.equal(tool("edit", { path: memFile, old_string: "short answers", new_string: "AKIAABCDEFGHIJKLMNOP" }), "error: Content contains potential secrets (AWS Access Token) and cannot be written to memory. Memory is synced to your account. Remove the sensitive content and try again.");
    assert.match(tool("write", { path: "notes.txt", content: "ghp_" + "a".repeat(36) }), /^File created successfully at: /, "not the memory file: not checked");
    // A device or a process's file: read refuses it in Claude Code's words.
    assert.equal(tool("read", { path: "/dev/zero" }), "error: Cannot read '/dev/zero': this path names a device or process file that this tool does not read.");
    assert.equal(tool("read", { path: "/proc/self/environ" }), "error: Cannot read '/proc/self/environ': this path names a device or process file that this tool does not read.");
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(seen, { recursive: true, force: true }); rmSync(mem, { recursive: true, force: true }); }
});

test("FV6 Claude Code 2.1.325's device and process files (its Read's list), its secret rules on the same samples, and in Coder's loop: those checks before the hooks; the read-first guard sent for a file whose reading would ask (a Read ask rule), as Claude Code waives the rule for newer models only where the file could be read freely", async () => {
  for (const p of ["/dev/zero", "/dev/urandom", "/dev/stdin", "/dev/tty", "/dev/pts/3", "/proc/kcore", "/proc/self/environ", "/proc/42/cmdline", "/proc/42/fd/7", "/proc/self/fd/0", "/proc/42/task/43/status", "/proc/42/root/dev/zero", "/dev/fd/3/x"]) assert.equal(T.deviceFile(p), true, p);
  for (const p of ["/dev/null", "/proc/self/fd/5", "/proc/cpuinfo", "/work/shop/a.txt", "/dev/sda"]) assert.equal(T.deviceFile(p), false, p);
  const S = await import("../container/coder-secretscan.mjs");
  assert.equal(S.SECRET_RULES.length, 52);
  assert.deepEqual(S.secretsIn("ghp_" + "a".repeat(36) + " AKIAABCDEFGHIJKLMNOP"), ["AWS Access Token", "GitHub PAT"], "in its rules' order");
  assert.deepEqual(S.secretsIn("gh​p_" + "a".repeat(36)), ["GitHub PAT"], "split by an invisible character");
  assert.deepEqual(S.secretsIn("-----BEGIN RSA PRIVATE KEY-----\n" + "A".repeat(80) + "\n-----END RSA PRIVATE KEY-----"), ["Private Key"]);
  assert.deepEqual(S.secretsIn("Style: keep answers short"), []);
  // In Coder's loop: refused before any hook (no hook ran, no machine check).
  const hooks = { PreToolUse: [{ matcher: "Read|Write|Edit", hooks: [{ type: "command", command: "pre.sh" }] }] };
  const memFile = "/srv/coder-mem/shop/MEMORY.md";
  const t = await job([say("", [call("read", { path: "/dev/zero" }, "r1"), call("write", { path: memFile, content: "key ghp_" + "a".repeat(36) }, "w1")]), say("Done.")], { hooks, deps: { memFile } });
  assert.equal(t.told("r1"), "error: Cannot read '/dev/zero': this path names a device or process file that this tool does not read.");
  assert.equal(t.told("w1"), "error: Content contains potential secrets (GitHub PAT) and cannot be written to memory. Memory is synced to your account. Remove the sensitive content and try again.");
  assert.equal(t.hookIns.length, 0);
  assert.equal(t.checks.length, 0);
  // An edit of a file a Read ask rule covers: the machine's check is told to apply the read-first rule (its answer refuses it,
  // before any card).
  const rules = { allow: [], deny: [], ask: ["Read(x.txt)", "Edit(x.txt)"] };
  const g = await job([say("", [call("edit", { path: "x.txt", old_string: "a", new_string: "b" }, "e1")]), say("Done.")], { rules, check: (a) => (a.guard === true ? { code: 1, output: "error: " + T.EDIT_NOT_READ } : { code: 0, output: "ok" }) });
  assert.equal(g.checks[0].guard, true);
  assert.equal(g.told("e1"), "error: " + T.EDIT_NOT_READ);
  assert.equal(g.cards.length, 0, "refused before its card");
  // A file that can be read freely: no guard, even where its edit asks (an Edit ask rule, Plan mode).
  const n = await job([say("", [call("edit", { path: "y.txt", old_string: "a", new_string: "b" }, "e2")]), say("Done.")], { rules: { allow: [], deny: [], ask: ["Edit(y.txt)"] }, answer: () => ({ choice: "no" }) });
  assert.equal(n.checks[0].guard, undefined);
  assert.equal(n.cards.length, 1, "its card, as before");
  const pl = await job([say("", [call("edit", { path: "y.txt", old_string: "a", new_string: "b" }, "e3")]), say("Done.")], { mode: "plan", answer: () => ({ choice: "no" }) });
  assert.equal(pl.checks[0].guard, undefined);
});
