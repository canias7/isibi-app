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
const { REJECTED } = await import("../container/coder-perms.mjs");
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
 * the checker answers `verdict(action)`.
 */
async function job(steps, { mode = "acceptEdits", rules = null, hooks = null, checker = false, verdict = () => '{"decision":"allow"}', ms = () => 5, sendMs = 0, answer = () => ({ choice: "yes" }), check = () => ({ code: 0, output: "ok" }), hookOut = () => "", messages = [], text = "go", deps: more = {}, opts = {} } = {}) {
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
const last = (t) => t.r.messages[t.r.messages.length - 1];
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
  // The checker's closing: a call that had its result or still ran keeps its turn; one not started is skipped.
  assert.deepEqual(["done", "running", "waiting", "none"].map((s) => P.closedAs("checker", s)), ["turn", "turn", "skipped", "skipped"]);
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

test("IN4 a Stop that came while Grok was still answering: its calls their rejection, then '[Request interrupted by the owner]', as Claude Code's mark when its model's answer was cut; between two answers: the same, or '… for tool use' when it came while the last round's calls ran", async () => {
  let stopAt = 0;
  setTimeout(() => { stopAt = Date.now(); }, 20);
  const t = await job([say("", [call("read", { path: "a.txt" }, "r1"), call("edit", { path: "b.txt", old_string: "a", new_string: "b" }, "e1")]), say("never")], { sendMs: 80, deps: { stopped: async () => stopAt > 0, stoppedAt: () => stopAt } });
  assert.equal(t.r.status, "stopped");
  assert.deepEqual([t.told("r1"), t.told("e1"), last(t)], [REJECTED, REJECTED, MARK_MODEL]);
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
  assert.deepEqual(stopped.slice(-3), [{ role: "tool", tool_call_id: "b1", content: REJECTED }, { role: "tool", tool_call_id: "b2", content: REJECTED }, MARK]);
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
  assert.match(src, /if \(await stopped\(\)\) \{ if \(!offered\) convo\.push\(interruptedNote\(stopTime\(\) <= roundDoneAt\)\); emit\(\{ type: "stopped" \}\); return end\("stopped"\); \}/);
  assert.match(src, /if \(offered\) \{ emit\(\{ type: "stopped" \}\); return end\("stopped"\); \}\n\s+throw closeRound\("stop"\);/);
});

test("CK1 the auto mode checker's tenth response in a row with no verdict ends the turn as Claude Code's denial ends it ('permission-stop'): that call told so, a call beside it that had started goes on and keeps its result, one not started told '[Tool call skipped: …]'; the owner's line; no mark of an interrupted turn", async () => {
  const steps = [...Array.from({ length: 9 }, (_, i) => say("", [call("bash", { command: "npm install " + i }, "c" + i)])), say("", [call("bash", { command: "cat a.txt" }, "c9"), call("read", { path: "slow.txt" }, "r9"), call("edit", { path: "x.txt", old_string: "a", new_string: "b" }, "e9")]), say("never")];
  const t = await job(steps, { mode: "auto", checker: true, verdict: () => "hmm", ms: (tag) => (tag === "read:slow.txt" ? 200 : 5) });
  assert.equal(t.r.status, "done");
  assert.equal(t.requests.length, 10, "Grok is not asked again");
  assert.equal(t.told("c9"), "Auto mode is unavailable: the server returned no safety verdict for 10 responses in a row, so bash was not run and this turn has ended. Wait for the owner's next message before doing anything further.");
  assert.equal(t.told("r9"), "result of read:slow.txt", "it had started beside it: it goes on, its result kept");
  assert.ok(t.when("end", "read:slow.txt") > 0);
  assert.equal(t.told("e9"), P.SKIPPED_BY_CHECK);
  assert.equal(t.when("start", "edit:x.txt"), -1);
  assert.deepEqual(t.events.filter((e) => e.type === "error").map((e) => e.text), ["Auto mode is unavailable — the server returned no safety verdict for the last 10 responses, so Coder stopped. Send a message to try again, or switch out of auto mode."]);
  assert.equal(marks(t.r.messages).length, 0);
  assert.equal(last(t).role, "tool");
});

test("FV1 the file tools' own checks before their hooks, in Claude Code 2.1.325's order and words (its Read, Write and Edit validateInput): the inputs, a null byte, read's pages, edit's 'No changes to make' (before the deny rules), read's binary kinds (after them); pages as its Read takes them", () => {
  const f = T.fileInputProblem;
  assert.equal(f("read", { path: "" }), "give a path");
  assert.equal(f("read", { path: "a\0.txt" }), "read path cannot contain null bytes (\\0). Remove the null byte and try again.");
  assert.equal(f("read", { path: "doc.pdf", pages: "1,3" }), 'Invalid pages parameter: "1,3". Give one page ("3") or one range ("1-5"), not a list. To read several pages or ranges, read each one separately. Pages are 1-indexed.');
  assert.equal(f("read", { path: "a.zip", pages: "0" }).slice(0, 25), "Invalid pages parameter: ", "pages before the binary kind, as there");
  assert.equal(f("read", { path: "pic.bmp" }), "", "the binary kinds come after the deny rules");
  assert.deepEqual(["pic.bmp", "scan.TIF", "fax.tiff", "app.zip", "x.png", "x.webp", "doc.pdf", "notes.txt"].map((p) => f("read", { path: p }, "after")), [T.BINARY_REFUSED(".bmp"), T.BINARY_REFUSED(".tif"), T.BINARY_REFUSED(".tiff"), T.BINARY_REFUSED(".zip"), "", "", "", ""]);
  assert.equal(f("edit", { path: "a.txt", new_string: "b" }), "give old_string: the exact text to replace");
  assert.equal(f("edit", { path: "a\0", old_string: "x", new_string: "x" }), "edit path cannot contain null bytes (\\0). Remove the null byte and try again.", "a null byte before 'No changes', as there");
  assert.equal(f("edit", { file_path: "a.txt", old_str: "x", new_str: "x" }), "No changes to make: old_string and new_string are exactly the same.");
  assert.equal(f("write", { path: "a.txt" }), "give the file's content");
  assert.equal(f("write", { path: "a.txt", content: "x", file_text: "y" }), "write failed due to the following issue: An unexpected parameter `file_text` was provided");
  assert.equal(f("write", { path: "b\0.txt", content: "x" }), "write path cannot contain null bytes (\\0). Remove the null byte and try again.");
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
    assert.equal(chk("edit", { path: "a.txt", old_string: "hello", new_string: "bye", replace_all: true }), "ok");
    // Changed since read: refused where its old text is not there once (before 'not text' and 'not found'); applied where it is.
    tool("read", { path: "a.txt" });
    writeFileSync(join(dir, "a.txt"), "hello world\nchanged line\n");
    assert.equal(chk("edit", { path: "a.txt", old_string: "nope", new_string: "b" }), "error: a.txt " + T.WRITE_CHANGED + ".");
    assert.equal(chk("edit", { path: "a.txt", old_string: "changed line", new_string: "b" }), "ok");
    // The run's own order is the same (its checks first): a changed file whose old text is gone.
    assert.equal(tool("edit", { path: "a.txt", old_string: "nope", new_string: "b" }), "error: a.txt " + T.WRITE_CHANGED + ".");
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
