// CODER'S CARDS STAY OPEN UNTIL ANSWERED, AND A JOB PAUSES WHILE ONE WAITS (A4 of the recheck of 2026-11-14, the owner: "Fix
// base on Claude Code docs, please"), AND THE ENVIRONMENT CARDS WAIT IN THE TURN (A5).
// Claude Code's side, from its docs of 2026-11-14: "Questions stay open until you answer them"; "permission prompts, including
// plan approval, never auto-resolve on idle" (tools-reference); "If Claude asks a question and the session sits idle, you can
// still answer when you come back, up to environment expiry, and the session continues from your answer"
// (claude-code-on-the-web); "after a few minutes without activity, a session's VM pauses with its files saved"
// (cloud-environments). Its environment tools' calls are the approval prompt, and what the owner decides is their result.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const A = await import("../container/coder-agent.mjs");
const P = await import("../container/coder-park.mjs");
const H = await import("../container/coder-hooks.mjs");
const E = await import("../container/coder-envtools.mjs");
const { REJECTED, REJECTED_SAID, NOT_NOW } = await import("../container/coder-perms.mjs");
const HERE = (p) => new URL("../" + p, import.meta.url);
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const PARK = async () => ({ choice: "park" });
const NO_ASK = async () => { throw new Error("no card should be asked here"); };

/** Coder's loop with a stand-in model: `ask` answers its cards (by default the job pauses), commands "run", hooks are recorded. */
async function loop(steps, opts = {}, { ask = PARK, deps = {} } = {}) {
  const events = [], seen = [], ran = [], hookCalls = [], asked = [];
  let n = 0;
  const r = await A.runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { hookCalls.push(JSON.parse(x.payload)); return { code: 0, output: "\n" + mark[0] + "\n" }; }
      ran.push(x.command);
      return { code: 0, output: "ran: " + x.command + "\n" };
    },
    emit: (e) => events.push(e),
    ask: async (pid, o) => { asked.push({ pid, o }); return ask(pid, o); },
    here: () => "/work/shop", root: "/work/shop", chatId: "shop-cp1",
    ...deps,
  }, { text: "go", messages: [], mode: "acceptEdits", ...opts });
  return { r, events, seen, ran, hookCalls, asked };
}
/** The same chat's turn taken up again with the owner's answer (as Coder's Worker starts it: no message of the owner's). */
const takeUp = (first, answer, opts = {}, more = {}) => loop([say("Done.")], { text: "", messages: first.r.messages, takeUp: { ...first.r.parked, answer }, ...opts }, { ask: NO_ASK, ...more });
const tools = (r) => r.messages.filter((m) => m.role === "tool").map((m) => [m.tool_call_id, m.content]);

test("CP1 the paused job's record (coder-park.mjs): a card of each kind, the answers each takes, where it was asked; Stop's words for the call and the round's later calls (Claude Code 2.1.325's for every call of a paused turn its Stop closes: REJECTED); the owner's next message's (CARD_CLOSED, raw binary); no Node module, and the machine's image copies it", () => {
  assert.equal(P.PARK_MS, 5 * 60 * 1000, "a few minutes, as Claude Code's idle VM");
  const rec = { pid: "p1abcdef", kind: "permission", site: "bash", call: { id: "b1", name: "bash", args: { command: "npm i" } }, rest: ["b2"], mode: "acceptEdits", told: "acceptEdits", rounds: 3, notes: ["n"], shown: [], at: 5 };
  const ok = P.parkRecord(rec);
  assert.deepEqual([ok.pid, ok.kind, ok.site, ok.call.id, ok.rest, ok.rounds, ok.held], ["p1abcdef", "permission", "bash", "b1", ["b2"], 3, []]);
  for (const bad of [null, {}, { ...rec, pid: "x" }, { ...rec, kind: "approval" }, { ...rec, site: "browser" }, { ...rec, call: { id: "", name: "bash" } }, { ...rec, call: null }]) assert.equal(P.parkRecord(bad), null, JSON.stringify(bad));
  // The answers each card takes (the machine's /answer's choices for it).
  assert.deepEqual(P.parkAnswer("permission", { choice: "yes", comment: "go" }), { choice: "yes", comment: "go" });
  assert.deepEqual(P.parkAnswer("permission", { choice: "auto", plan: "edited" }), { choice: "auto", comment: "", plan: "edited" });
  assert.equal(P.parkAnswer("permission", { choice: "saved" }), null);
  assert.deepEqual(P.parkAnswer("question", { choice: "answers", picks: [{ options: [0], other: "" }] }), { choice: "answers", picks: [{ options: [0], other: "" }] });
  assert.deepEqual(P.parkAnswer("question", { choice: "chat", text: "use mysql", qid: "qabc1234" }), { choice: "chat", text: "use mysql", qid: "qabc1234" });
  assert.equal(P.parkAnswer("question", { choice: "yes" }), null);
  assert.deepEqual([P.parkAnswer("secret", { choice: "saved" }), P.parkAnswer("secret", { choice: "no" }), P.parkAnswer("secret", { choice: "yes" })], [{ choice: "saved" }, { choice: "no" }, null]);
  assert.deepEqual(P.parkAnswer("envchange", { choice: "approved", result: "Approved: x." }), { choice: "approved", result: "Approved: x." });
  assert.deepEqual([P.parkAnswer("envchange", { choice: "no" }), P.parkAnswer("envchange", { choice: "approved" })], [{ choice: "no" }, null]);
  // Where a permission card was asked: its step shows before it for these.
  assert.deepEqual(["bash", "powershell", "monitor", "web_search", "write", "web_fetch", "lsp", "plan", "connector", "pull_request"].map((t) => P.siteOfCard({ tool: t })), ["bash", "bash", "monitor", "web_search", "file", "file", "file", "plan", "connector", "tool"]);
  assert.deepEqual([...P.STEP_SITES], ["bash", "monitor", "web_search", "file"]);
  // The open round, and Stop's words for it.
  const msgs = [{ role: "user", content: "go" }, { role: "assistant", content: "x", tool_calls: [{ id: "b0" }, { id: "b1" }, { id: "b2" }] }, { role: "tool", tool_call_id: "b0", content: "ran" }];
  assert.equal(P.parkedRound(msgs, rec).at, 1);
  const closed = P.closeParked(msgs, rec);
  assert.deepEqual(closed.slice(3), [{ role: "tool", tool_call_id: "b1", content: REJECTED }, { role: "tool", tool_call_id: "b2", content: REJECTED }], "Claude Code's Stop on a paused card: its \"user-rejected\" words for every call of that turn");
  assert.equal(REJECTED, "The owner doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the owner to tell you how to proceed.");
  assert.notEqual(REJECTED, NOT_NOW);
  // The owner's next message: Claude Code 2.1.325's words for it (its "new_input", raw binary), "owner" for "user".
  assert.equal(P.CARD_CLOSED, "[Tool call not completed: an approval request was still unanswered when the message that follows arrived and was closed, so the action awaiting approval did not run. Nobody refused it, so this is not the owner's decision; ask again if it is still needed.]");
  assert.deepEqual(P.closeParked(msgs, rec, P.CARD_CLOSED).slice(3).map((m) => [m.tool_call_id, m.content]), [["b1", P.CARD_CLOSED], ["b2", P.CARD_CLOSED]]);
  assert.deepEqual([...P.CLOSED_BY_MESSAGE], ["permission"], "a permission card and the plan's; a question card's reply is its answer; the key and environment cards keep the message in line");
  assert.deepEqual(P.closedEvents(rec, 9), [{ at: 9, type: "permanswer", pid: "p1abcdef", choice: "closed" }, { at: 9, type: "result", id: "b1", code: -1, ran: false, output: "Not run: you sent a new message before answering." }]);
  assert.deepEqual(P.closedEvents({ pid: "p1abcdef", kind: "permission", site: "plan", call: "x1" }, 9).map((e) => e.type), ["permanswer"], "the plan's card has no step of its own");
  assert.deepEqual(P.closedEvents({ pid: "bad" }), []);
  assert.equal(P.parkedRound(closed, rec), null, "closed: no round waits any more");
  assert.equal(P.closeParked(closed, rec), closed, "nothing to close twice");
  const at = 9;
  assert.deepEqual(P.stoppedEvents(rec, at), [{ at, type: "permanswer", pid: "p1abcdef", choice: "stop" }, { at, type: "result", id: "b1", code: -1, ran: false, output: "Not run: stopped." }, { at, type: "stopped" }]);
  assert.deepEqual(P.stoppedEvents({ pid: "p1abcdef", kind: "question", site: "question", call: "a1" }, at).map((e) => e.type), ["permanswer", "stopped"], "a card with no step of its own");
  assert.deepEqual(P.parkedMeta(rec), { pid: "p1abcdef", kind: "permission", site: "bash", call: "b1", at: 5 });
  assert.deepEqual(P.parkedOf({ parked: P.parkedMeta(rec) }).pid, "p1abcdef");
  assert.equal(P.parkedOf({ parked: null }), null);
  // The Worker loads it: no Node module. The machine's image copies it (CD78 checks every import).
  assert.doesNotMatch(readFileSync(HERE("container/coder-park.mjs"), "utf8"), /from "node:/);
  assert.match(readFileSync(HERE("container/Dockerfile"), "utf8"), / coder-park\.mjs /);
});

test("CP2 a card waits in its job while the owner is there (an answer within the job's time is used at once); unanswered after PARK_MS, or at the job's time limit, the job pauses: it ends \"parked\" with the call as its checks and hooks left it, the round's later calls, its notes and modes, and nothing of that call has run", async () => {
  const round = [say("I'll install it.", [call("bash", { command: "ls", description: "List" }, "b0"), call("bash", { command: "npm install left-pad", description: "Install" }, "b1"), call("bash", { command: "npm test", description: "Test" }, "b2")]), say("Installed and tested.")];
  // The owner there: answered at once, in the same job, as before.
  const now = await loop(round, {}, { ask: async () => ({ choice: "yes" }) });
  assert.equal(now.r.status, "done");
  assert.deepEqual(now.ran, ["ls", "npm install left-pad", "npm test"]);
  // No answer: the card stays open and this job pauses.
  const t = await loop(round);
  assert.equal(t.r.status, "parked");
  assert.equal(t.r.summary, "I'll install it.");
  assert.deepEqual(t.ran, ["ls"], "the card's call and the ones after it never ran");
  const card = t.events.find((e) => e.type === "permission");
  const rec = t.r.parked;
  assert.deepEqual([rec.pid, rec.kind, rec.site, rec.call, rec.rest, rec.mode, rec.told, rec.rounds], [card.pid, "permission", "bash", { id: "b1", name: "bash", args: { command: "npm install left-pad", description: "Install" } }, ["b2"], "acceptEdits", "acceptEdits", 1]);
  assert.ok(!t.events.some((e) => e.type === "permanswer"), "the card is still open");
  // The chat's history ends on the open round: the call before it answered, the card's and the later one not yet.
  assert.deepEqual(tools(t.r), [["b0", "ran: ls"]]);
  assert.ok(P.parkedRound(t.r.messages, rec));
  // How long it waits: PARK_MS (or deps.parkMs), never past the job's time limit; no time limit closes it.
  const clock = { t: 1_000_000 };
  const short = await loop(round, { maxMs: 60_000 }, { deps: { now: () => clock.t } });
  assert.deepEqual(short.asked[0].o, { park: 1_000_000 + 60_000 }, "the job's time limit comes first: it pauses then");
  const set = await loop(round, {}, { deps: { now: () => clock.t, parkMs: 1500 } });
  assert.deepEqual(set.asked[0].o, { park: 1_000_000 + 1500 });
  assert.deepEqual((await loop(round, {}, { deps: { now: () => clock.t } })).asked[0].o, { park: 1_000_000 + P.PARK_MS });
  // A machine that can't pause a job (an answer of none at the time limit) still ends it as before.
  const late = await loop(round, { maxMs: 60_000 }, { ask: async () => { clock.t += 61_000; return null; }, deps: { now: () => clock.t } });
  assert.equal(late.r.status, "time");
  // Gloopy's cards wait to the job's time limit, as before (its turn ends on its own cards): no pause.
  const { GLOOPY_TOOLS, GLOOPY_SYSTEM } = await import("../container/gloopy-agent.mjs");
  const g = await loop([say("", [call("write", { path: "/work/shop/.git/hooks/pre-commit", content: "x" }, "w1")]), say("ok")], { tools: GLOOPY_TOOLS, system: GLOOPY_SYSTEM, who: "Gloopy", nudges: false }, { ask: async () => null, deps: { now: () => clock.t } });
  assert.ok(g.asked.every((x) => x.o.park === undefined && x.o.until > 0), JSON.stringify(g.asked.map((x) => x.o)));
  assert.notEqual(g.r.status, "parked");
});

test("CP3 the owner's answer, minutes or hours later, takes the turn up again at that call (\"the session continues from your answer\"): Yes runs it with no new answer from Grok, its hooks and card not again, the round's later calls run and the turn goes on; the mode is the one its card was shown in for that call, then the chat's own", async () => {
  const hooks = H.hooksFrom({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "pre.sh" }] }], PermissionRequest: [{ matcher: "", hooks: [{ type: "command", command: "perm.sh" }] }], PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "post.sh" }] }], Notification: [{ matcher: "", hooks: [{ type: "command", command: "note.sh" }] }] } }, "settings").list;
  const first = await loop([say("I'll lint it.", [call("bash", { command: "npm run lint", description: "Lint" }, "b1"), call("bash", { command: "npm run build", description: "Build" }, "b2")])], { hooks }, { deps: { promptNotifyMs: 1_000_000 } });
  assert.equal(first.r.status, "parked");
  assert.deepEqual(first.hookCalls.map((x) => x.hook_event_name), ["PreToolUse", "PermissionRequest"]);
  // The chat's mode is Auto now (the owner switched while it waited): the card's call is still the card's.
  let chatMode = "auto";
  const back = await takeUp(first, { choice: "yes", comment: "go ahead" }, { hooks, mode: "auto" }, { deps: { mode: () => chatMode, setMode: (m) => { chatMode = m; } } });
  assert.equal(back.r.status, "done");
  assert.equal(back.seen.length, 1, "Grok is asked only after the round");
  assert.deepEqual(back.ran, ["npm run lint", "npm run build"]);
  assert.deepEqual(back.hookCalls.map((x) => x.hook_event_name + ":" + x.tool_input.command), ["PostToolUse:npm run lint", "PreToolUse:npm run build", "PostToolUse:npm run build"], "the card's call: its PreToolUse and PermissionRequest hooks ran before its card, and not again");
  // The owner's words with their Yes (fix round 3, 2026-11-14; Claude Code's acceptFeedback): not wrapped in a sentence, not in
  // the result, but kept with it and given as their own text after the round's results.
  const b1 = back.r.messages.find((m) => m.role === "tool" && m.tool_call_id === "b1");
  assert.deepEqual([b1.content, b1.words], ["ran: npm run lint", "go ahead"]);
  // The chat: the answer, the call's result under its step (not a second step), the next step; the card never again.
  const ev = back.events.map((e) => e.type + ":" + (e.id || e.pid || ""));
  assert.deepEqual(ev.filter((x) => /^(permission|permanswer|bash|result)/.test(x)), ["permanswer:" + first.r.parked.pid, "result:b1", "bash:b2", "result:b2"]);
  // Grok gets the round whole, then answers.
  // (Less tool search's note on the chat's deferred tools, after the owner's first message: tool-search.test.mjs.)
  const sent = back.seen[0].messages.filter((m) => m.role !== "system" && !m.toolsAnnounced);
  assert.deepEqual(sent.map((m) => m.role + ":" + (m.tool_call_id || "")), ["user:", "user:", "assistant:", "tool:b1", "tool:b2", "user:", "user:", "user:"]);
  assert.equal(sent[1].modeNote, "acceptEdits", "the first job's note of its mode, in the conversation (never the system message)");
  assert.deepEqual(sent[5], { role: "user", content: "go ahead" }, "the owner's words exactly as typed, right after the round's results");
  assert.ok(sent.every((m) => !("words" in m)), "never sent as a field of the result");
  // (Then, as at any round, the mode the owner picked meanwhile, as Claude Code says a mode change, and auto mode's note.)
  assert.equal(sent[6].content, A.modeChangeNote("acceptEdits", "auto"));
  assert.equal(sent[7].modeNote, "auto");
  // In Accept edits the second command asked; in the chat's Auto it ran at once: the card's mode was for its own call only.
  assert.equal(back.asked.length, 0);
  // "Yes, and don't ask again" saves its rule; "Yes, and switch to auto mode" switches, as on the card while the job ran.
  const always = await takeUp(first, { choice: "always" });
  assert.deepEqual(always.r.rulesAdded, ["Bash(npm run *)"]);
  const toAuto = await takeUp(first, { choice: "auto" });
  assert.equal(toAuto.r.mode, "auto");
  assert.ok(toAuto.events.some((e) => e.type === "mode" && e.mode === "auto" && e.by === "card"));
});

test("CP4 No without a note ends the turn in Claude Code's words, the round's later calls cancelled, with no call to Grok; No with a note goes on with it; a plan's No keeps planning", async () => {
  const first = await loop([say("I'll lint it.", [call("bash", { command: "npm run lint" }, "b1"), call("bash", { command: "git status" }, "b2")])]);
  const no = await takeUp(first, { choice: "no" });
  assert.equal(no.r.status, "done");
  assert.equal(no.seen.length, 0, "no call to Grok");
  assert.deepEqual(tools(no.r), [["b1", REJECTED], ["b2", NOT_NOW]]);
  assert.equal(no.r.summary, "stopped: the owner said no");
  assert.deepEqual(no.events.map((e) => [e.type, e.id || e.pid, e.output || e.choice]), [["permanswer", first.r.parked.pid, "no"], ["result", "b1", "Not run: you said no."]]);
  assert.deepEqual(no.ran, []);
  const said = await takeUp(first, { choice: "no", comment: "use pnpm" });
  assert.equal(said.r.status, "done");
  assert.deepEqual(tools(said.r), [["b1", REJECTED_SAID + "use pnpm"], ["b2", "ran: git status"]]);
  assert.deepEqual(said.ran, ["git status"]);
  assert.ok(said.events.some((e) => e.type === "permanswer" && e.choice === "no" && e.comment === "use pnpm"));
  // The plan's card: No with what to change keeps planning; the call is refused for its hooks.
  const plan = await loop([say("My plan.", [call("exit_plan_mode", { plan: "1. A\n2. B" }, "x1")])], { mode: "plan" });
  assert.deepEqual([plan.r.status, plan.r.parked.site, plan.r.parked.mode], ["parked", "plan", "plan"]);
  const keep = await takeUp(plan, { choice: "no", comment: "add tests" }, { mode: "plan" });
  assert.deepEqual(tools(keep.r), [["x1", REJECTED_SAID + "add tests"]]);
  assert.equal(keep.r.mode, "plan");
});

test("CP5 a question card (AskUserQuestion), the key card (request_credential) and the plan's card pause and are taken up the same way: the owner's picks, Skip, a reply typed in the chat, Saved, Decline, an approved plan switching the mode", async () => {
  const q = { questions: [{ question: "Which database?", header: "DB", options: [{ label: "Postgres", description: "SQL" }, { label: "SQLite", description: "a file" }], multiSelect: false }] };
  const ask = await loop([say("Let me ask.", [call("ask_user", q, "a1"), call("bash", { command: "echo after" }, "b1")])]);
  assert.deepEqual([ask.r.status, ask.r.parked.kind, ask.r.parked.site, ask.r.parked.rest], ["parked", "question", "question", ["b1"]]);
  assert.equal(ask.asked[0].o.chat, true, "a message typed while it waits is its reply");
  const picked = await takeUp(ask, { choice: "answers", picks: [{ options: [1], other: "" }] });
  assert.equal(picked.r.messages.find((m) => m.tool_call_id === "b1").content, "ran: echo after", "the round goes on");
  assert.match(picked.r.messages.find((m) => m.tool_call_id === "a1").content, /^Your questions have been answered: "Which database\?"="SQLite"\./);
  assert.equal((await takeUp(ask, { choice: "skip" })).r.messages.find((m) => m.tool_call_id === "a1").content, "The owner did not answer the questions.");
  const reply = await takeUp(ask, { choice: "chat", text: "use mysql", qid: "qabc1234" });
  assert.equal(reply.r.messages.find((m) => m.tool_call_id === "a1").content, "The owner responded: use mysql");
  assert.ok(reply.events.some((e) => e.type === "user" && e.text === "use mysql" && e.qid === "qabc1234"), "shown as the owner's message");
  // The key card.
  const key = await loop([say("I need a key.", [call("request_secret", { host: "api.stripe.com", reason: "The balance check got 401." }, "k1")])]);
  assert.deepEqual([key.r.status, key.r.parked.kind], ["parked", "secret"]);
  assert.equal((await takeUp(key, { choice: "saved" })).r.messages.find((m) => m.tool_call_id === "k1").content, "saved");
  assert.equal((await takeUp(key, { choice: "no" })).r.messages.find((m) => m.tool_call_id === "k1").content, A.SECRET_DENIED);
  // The plan's card, approved after the owner left plan mode meanwhile: approved as on its card, and the mode it picks.
  const plan = await loop([say("My plan.", [call("exit_plan_mode", { plan: "1. A\n2. B" }, "x1")])], { mode: "plan" });
  let chatMode = "acceptEdits";
  const yes = await takeUp(plan, { choice: "auto" }, { mode: "acceptEdits" }, { deps: { mode: () => chatMode, setMode: (m) => { chatMode = m; } } });
  assert.match(yes.r.messages.find((m) => m.tool_call_id === "x1").content, /^The owner has approved your plan\./);
  assert.deepEqual([yes.r.mode, chatMode], ["auto", "auto"]);
});

test("CP6 A5: the environment cards wait in the turn, as request_secret's does: an approval comes back as the call's result (what Coder's server did), a refusal as an error, Decline as Claude Code's denial; Coder goes on in the same turn; Stop stops; paused and taken up, the card is not checked again", async () => {
  const card = { kind: "update", tool: "update_environment", name: "Default", appliesTo: E.APPLIES_TO, change: { add: ["api.foo.com"], remove: [], level: "", packageManagers: null, network: null, set: {}, unset: [], script: null, rename: "" }, args: {}, summary: "Change \"Default\": allow api.foo.com" };
  const checks = [];
  const envApi = async (b) => { checks.push(b.action); return { card }; };
  const upd = { environment_name: "Default", applies_to: E.APPLIES_TO, reason: "The build fetches its schema from api.foo.com.", add_allowed_hosts: ["api.foo.com"] };
  const steps = [say("I'll allow api.foo.com.", [call("update_environment", upd, "u1"), call("bash", { command: "curl -s https://api.foo.com/schema" }, "b1")]), say("Done.")];
  const result = E.envResultText(card);
  assert.equal(result, "Approved: the environment \"Default\" was changed: allow api.foo.com. Host and network changes take effect in this chat within seconds.");
  for (const [answer, told, code] of [[{ choice: "approved", result }, result, 0], [{ choice: "refused", result: "error: what the card shows no longer matches the environment as it is now; nothing was changed" }, "error: what the card shows no longer matches the environment as it is now; nothing was changed", 1], [{ choice: "no" }, A.SECRET_DENIED, 1]]) {
    const t = await loop(steps, { mode: "auto" }, { ask: async () => answer, deps: { envApi } });
    assert.equal(t.r.status, "done", answer.choice);
    assert.equal(t.r.messages.find((m) => m.tool_call_id === "u1").content, told);
    assert.equal(t.r.messages.find((m) => m.tool_call_id === "b1").content, "ran: curl -s https://api.foo.com/schema", "the round goes on");
    const shown = t.events.find((e) => e.type === "envchange");
    assert.match(shown.pid, /^p[0-9a-z]{2,24}$/);
    assert.equal(shown.reason, undefined, "the card never shows the reason");
    assert.ok(t.events.some((e) => e.type === "permanswer" && e.pid === shown.pid && e.choice === answer.choice));
    assert.equal(t.events.find((e) => e.type === "result" && e.id === "u1").code, code);
  }
  const stop = await loop(steps, { mode: "auto" }, { ask: async () => ({ choice: "stop" }), deps: { envApi } });
  assert.equal(stop.r.status, "stopped");
  // Paused, then taken up with what Coder's server did: not checked again (the change is already made).
  checks.length = 0;
  const first = await loop(steps, { mode: "auto" }, { deps: { envApi } });
  assert.deepEqual([first.r.status, first.r.parked.kind, first.r.parked.site, first.r.parked.card.summary], ["parked", "envchange", "env", card.summary]);
  assert.deepEqual(checks, ["check"]);
  const back = await takeUp(first, { choice: "approved", result }, { mode: "auto" }, { deps: { envApi: async () => { throw new Error("not checked again"); } } });
  assert.equal(back.r.messages.find((m) => m.tool_call_id === "u1").content, result);
  assert.equal(back.events.filter((e) => e.type === "envchange").length, 0, "its card is not shown again");
  // The result's words, from Claude Code's descriptions ("the result says what to do next"; "exactly what changed on this
  // machine and what did not"; "that the session stayed where it is, and why").
  const cre = { kind: "create", name: "shop-api", repos: ["ana/shop"], from: "Default", args: { switch_session: "network_only" }, stayWhy: "" };
  assert.equal(E.envResultText(cre, { moved: true, name: "shop-api", from: "Default" }), "Approved: the environment \"shop-api\" was created, and this chat moved onto it. What changed on this machine: requests through this chat's proxy follow its allowed hosts within seconds, and network secrets saved on \"Default\" stop being used. What did not: its variables are set from this chat's next message, and its setup script does not run on this machine. New chats of ana/shop start in it.");
  assert.equal(E.envResultText({ ...cre, stayWhy: "its network is Full" }, { moved: false, stayWhy: "its network is Full" }), "Approved: the environment \"shop-api\" was created. This chat stays on \"Default\": its network is Full. New chats of ana/shop start in it.");
  assert.equal(E.envResultText({ ...cre, repos: [], args: { switch_session: "none" } }), "Approved: the environment \"shop-api\" was created; this chat stays on \"Default\". To move this chat onto it, call switch_environment.");
  assert.equal(E.envResultText({ kind: "switch", name: "shop", from: "Default" }), "Approved: this chat moved to the environment \"shop\". What changed on this machine: requests through this chat's proxy follow its allowed hosts within seconds, and network secrets saved on \"Default\" stop being used. What did not: its variables are set from this chat's next message, and its setup script does not run on this machine.");
});

test("CP7 what the job's start says while a round is taken up (a SessionStart hook's context, background news, an environment note) waits until the round's results are in; pictures a read opened in the round are said gone; a record that no longer fits the chat closes its round as a Stop does", async () => {
  const first = await loop([say("x", [call("bash", { command: "npm install left-pad" }, "b1")])]);
  const hooks = H.hooksFrom({ hooks: { SessionStart: [{ matcher: "", hooks: [{ type: "command", command: "start.sh" }] }] } }, "settings").list;
  const back = await loop([say("Done.")], { text: "", messages: first.r.messages, hooks, resumed: true, notices: [{ id: "job1", desc: "the server", command: "npm start", log: "/tmp/x.log", code: 0 }], takeUp: { ...first.r.parked, answer: { choice: "yes" }, note: "(Note from Coder's app, not the owner: since the last message, the owner changed the network setting (now limited) in Environment.)" } }, { ask: NO_ASK, deps: { exec: async (x) => { if (x.hook === true) { const m = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command)); return { code: 0, output: JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "REMEMBER THE STYLE" } }) + "\n" + m[0] + "\n" }; } return { code: 0, output: "ran\n" }; } } });
  const sent = back.seen[0].messages.filter((m) => m.role !== "system");
  const at = sent.findIndex((m) => m.role === "tool" && m.tool_call_id === "b1");
  assert.equal(sent[at - 1].role, "assistant", "the call's result right after the call");
  const later = sent.slice(at + 1).map((m) => String(m.content)).join("\n");
  assert.match(later, /REMEMBER THE STYLE/);
  assert.match(later, /background command/i);
  assert.match(later, /the owner changed the network setting \(now limited\) in Environment/);
  // A read's pictures in the round: too big to keep with the record, so Coder is told to read them again.
  const { PICS_MARK } = await import("../container/coder-tools.mjs");
  const png = "iVBORw0KGgo=";
  const pic = await loop([say("x", [call("read", { path: "/work/shop/a.png" }, "r1"), call("bash", { command: "npm run lint" }, "b1")])], {}, { deps: { exec: async (x) => (x.tool === true ? { code: 0, output: PICS_MARK + JSON.stringify({ text: "the picture", pictures: [{ type: "image/png", data: png }] }) } : { code: 0, output: "ran\n" }) } });
  assert.equal(pic.r.status, "parked");
  assert.deepEqual(pic.r.parked.notes, ["The picture your read opened earlier in this round (/work/shop/a.png) is no longer attached, as this job paused for the owner's answer: read it again if you need to see it."]);
  assert.doesNotMatch(JSON.stringify(pic.r.parked), new RegExp(png), "never kept with the record");
  // A record that no longer fits the chat (it moved on): its round, if still open, is closed as a Stop closes it.
  const odd = await loop([say("never")], { text: "", messages: first.r.messages, takeUp: { ...first.r.parked, call: { ...first.r.parked.call, id: "zz" }, answer: { choice: "yes" } } }, { ask: NO_ASK });
  assert.equal(odd.seen.length, 0);
  assert.ok(odd.events.some((e) => e.type === "error" && /could not take up your answer/.test(e.text)));
  const bad = await loop([say("never")], { text: "", messages: first.r.messages, takeUp: { ...first.r.parked, answer: { choice: "maybe" } } }, { ask: NO_ASK });
  assert.deepEqual(tools(bad.r), [["b1", REJECTED]], "every call has its answer again, in the words of Claude Code's Stop on a paused turn");
});

test("CP8 Coder's machine: a card's job pauses after its time with the card open (/state says which card waits; /answer says the job paused); a turn taken up again (resume) goes on from that call, with the messages that waited for the card; a bad resume is refused", async () => {
  const http = await import("node:http");
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createApp, resumeFrom, queuedFrom } = await import("../container/server.mjs");
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), mem = await mkdtemp(join(tmpdir(), "coder-mem-")), git = await mkdtemp(join(tmpdir(), "coder-git-")), bgr = await mkdtemp(join(tmpdir(), "coder-bgr-"));
  const seen = [];
  let n = 0;
  const steps = [say("I'll run it.", [call("bash", { command: "node -e \"console.log(6*7)\"", description: "Print" }, "b1"), call("bash", { command: "echo after", description: "Echo" }, "b2")]), say("It printed 42.")];
  const srv = http.createServer(createApp({ root, memRoot: mem, gitRoot: git, bgRoot: bgr, parkMs: 400, send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; } }));
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, data: await r.json() }));
  const state = () => fetch(base + "/state?project=shop-cp8&since=0").then((r) => r.json());
  const waitFor = async (f) => { for (let i = 0; i < 400; i++) { const st = await state(); const v = f(st); if (v) return v; await new Promise((ok) => setTimeout(ok, 25)); } return null; };
  try {
    await post("/turn", { project: "shop-cp8", text: "print it", messages: [], mode: "acceptEdits", rules: { allow: [] } });
    const card = await waitFor((st) => st.events.find((e) => e.type === "permission" && e.pid));
    assert.ok(card);
    assert.equal((await state()).asking, card.pid, "which card waits, for Coder's Worker");
    // No answer: after parkMs the job pauses, its card open.
    const st = await waitFor((s) => s.result && s);
    assert.equal(st.result.status, "parked");
    assert.equal(st.result.parked.pid, card.pid);
    assert.equal(st.running, false);
    assert.equal(st.asking, undefined);
    assert.ok(!st.events.some((e) => e.type === "permanswer"));
    assert.deepEqual((await post("/answer", { project: "shop-cp8", pid: card.pid, choice: "yes" })).data, { ok: false, parked: true, why: "Coder paused while that card waited; your answer takes it up again." });
    assert.deepEqual((await post("/claim", { project: "shop-cp8" })).data, { ok: true });
    // A bad resume is refused before anything starts.
    assert.equal((await post("/turn", { project: "shop-cp8", text: "", messages: st.result.messages, mode: "acceptEdits", resume: { ...st.result.parked, answer: { choice: "maybe" } } })).status, 400);
    // Taken up again: the call runs, the round goes on, the message that waited is read in the turn.
    const r = await post("/turn", { project: "shop-cp8", text: "", shown: "", messages: st.result.messages, mode: "acceptEdits", rules: { allow: [] }, resume: { ...st.result.parked, answer: { choice: "yes", comment: "" } }, queued: [{ qid: "qwait0001", text: "Then say the number in words.", at: Date.now() }] });
    assert.equal(r.status, 200);
    const done = await waitFor((s) => s.result && s);
    assert.equal(done.result.status, "done");
    assert.equal(seen.length, 2, "one answer from Grok before the card, one after the round");
    const msgs = seen[1].messages.filter((m) => m.role !== "system");
    assert.match(msgs.find((m) => m.role === "tool" && m.tool_call_id === "b1").content, /42/);
    assert.match(msgs.find((m) => m.role === "tool" && m.tool_call_id === "b2").content, /after/);
    assert.ok(msgs.some((m) => m.role === "user" && /Then say the number in words\./.test(m.content)), "the message that waited for the card");
    assert.ok(done.result.readQueued.includes("qwait0001"));
    assert.ok(done.events.some((e) => e.type === "permanswer" && e.pid === card.pid && e.choice === "yes"));
    assert.equal(done.events.filter((e) => e.type === "bash" && e.id === "b1").length, 0, "its step is in the chat already");
  } finally { await post("/stop", { project: "shop-cp8" }).catch(() => {}); await new Promise((ok) => srv.close(ok)); }
  // The checks: a record and an answer a card takes (a question's picks as the machine's /answer checks them).
  const rec = { pid: "p1abcdef", kind: "question", site: "question", call: { id: "a1", name: "ask_user", args: {} }, rest: [] };
  assert.deepEqual(resumeFrom({ ...rec, answer: { choice: "answers", picks: [{ options: [1] }] } }).answer, { choice: "answers", picks: [{ options: [1], other: "" }] });
  assert.equal(resumeFrom({ ...rec, answer: { choice: "answers", picks: [{ options: [9] }] } }), null);
  assert.equal(resumeFrom({ ...rec, answer: { choice: "saved" } }), null);
  assert.deepEqual(queuedFrom([{ qid: "qwait0001", text: "x", at: 5 }, { qid: "bad", text: "y" }, { qid: "qwait0002", text: " " }]), [{ qid: "qwait0001", text: "x", at: 5, read: false }]);
});

// ── CODER'S WORKER ──
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
/** A chat on Coder's Worker with a stand-in machine (`mc`: what it says; `toMachine`: what it was sent). */
async function worker(meta0 = {}) {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef", id = "shop-cp9";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const key = (f) => "coder/" + uid + "/" + id + "/" + f;
  await bucket.put(key("meta.json"), JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 0, status: "running", at: Date.now(), title: "x", mode: "acceptEdits", marks: [{ turn: 1, ev: 0, msg: 0 }], ...meta0 }));
  const mc = { running: false, result: null, events: [], asking: "", claimed: false, answer: (b) => ({ ok: false, why: "That card is no longer waiting for an answer." }) };
  const toMachine = [];
  const box = () => ({ fetch: async (req) => {
    const p = new URL(req.url).pathname;
    const body = req.method === "POST" ? await req.clone().json().catch(() => null) : null;
    if (req.method === "POST" || p === "/bgstate") toMachine.push({ p, body });
    if (p === "/state") return Response.json({ running: mc.running, events: mc.events, next: mc.events.length, ...(mc.result ? { result: mc.result } : {}), ...(mc.running && mc.asking ? { asking: mc.asking } : {}) });
    if (p === "/claim") { const first = !mc.claimed && !!mc.result; mc.claimed = true; return Response.json({ ok: first }); }
    if (p === "/push") return Response.json({ ok: true, pushed: false });
    if (p === "/turn") { mc.running = true; mc.result = null; mc.claimed = false; mc.events = []; return Response.json({ ok: true }); }
    if (p === "/answer") return Response.json(mc.answer(body));
    if (p === "/stop") { mc.running = false; return Response.json({ ok: true, running: false }); }
    if (p === "/bgstate") return Response.json({ ok: true, background: [], untold: 0, running: mc.running });
    return Response.json({ ok: true });
  } });
  const go = async (path, init = {}) => { const r = await R.handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: box }); return { status: r.status, data: await r.json() }; };
  const json = (f, d) => (bucket.m.has(key(f)) ? JSON.parse(bucket.m.get(key(f))) : d);
  return { R, env, bucket, uid, id, key, go, mc, toMachine, meta: () => json("meta.json"), json, turns: () => toMachine.filter((x) => x.p === "/turn").map((x) => x.body) };
}
/** A job that paused on a card (as the machine ends one), and the Worker's save of it. */
const OPEN = [{ role: "user", content: "lint it" }, { role: "assistant", content: "I'll lint it.", tool_calls: [{ id: "b1", type: "function", function: { name: "bash", arguments: "{\"command\":\"npm run lint\"}" } }, { id: "b2", type: "function", function: { name: "bash", arguments: "{\"command\":\"git status\"}" } }] }];
const recOf = (kind = "permission", site = "bash") => ({ pid: "p1abcdef", kind, site, call: { id: "b1", name: kind === "question" ? "ask_user" : "bash", args: { command: "npm run lint" } }, rest: ["b2"], mode: "acceptEdits", told: "acceptEdits", rounds: 1, notes: [], shown: [], at: 1 });
async function parked(kind = "permission", site = "bash", card = null) {
  const w = await worker();
  w.mc.result = { status: "parked", parked: { ...recOf(kind, site), ...(card ? { card } : {}) }, messages: OPEN, summary: "I'll lint it.", mode: "acceptEdits" };
  w.mc.events = [{ type: "user", text: "lint it" }, { type: "bash", id: "b1", command: "npm run lint" }, kind === "question" ? { type: "question", pid: "p1abcdef", text: "Which?" } : kind === "envchange" ? { ...card, type: "envchange", pid: "p1abcdef" } : { type: "permission", pid: "p1abcdef", tool: "bash", id: "b1", lines: ["npm run lint"] }];
  await w.bucket.put(w.key("queue.json"), JSON.stringify([{ qid: "qwait0001", text: "and fix what it finds", at: 1 }]));
  const s = await w.go("projects/" + w.id + "/state?since=0");
  return { w, s };
}

test("CP9 the Worker: a paused job is saved as waiting on its card (the chat idle, parked and waiting; its record beside it; what was queued waits for the card); its answer starts the job that takes the turn up again (resume, the queue, no new Rewind mark); a message meanwhile is a question card's reply, or waits for the key or an environment card (a permission card's: CP12); Stop, Rewind and Undo close the card as Claude Code's Stop does; its background is not asked about", async () => {
  const { w, s } = await parked();
  assert.equal(s.data.running, false);
  const m = w.meta();
  assert.deepEqual([m.status, m.waiting, m.parked], ["idle", "permission", { pid: "p1abcdef", kind: "permission", site: "bash", call: "b1", at: 1 }]);
  assert.equal(w.json("parked.json").call.id, "b1");
  assert.deepEqual(w.json("messages.json"), OPEN, "the round stays open for the answer");
  assert.equal(w.turns().length, 0, "what was queued waits for the card");
  // The chat list says so (the desktop app's notification).
  const list = (await w.go("projects")).data.projects.find((x) => x.id === w.id);
  assert.equal(list.waiting, "permission");
  // A message meanwhile, to the key card (or an environment card): it waits for the card, as one sent while Coder works;
  // pictures, line comments, /compact can't. (To a permission card or the plan's, it closes the card: CP12.)
  const kc = await parked("secret", "secret");
  const q = await kc.w.go("projects/" + kc.w.id + "/message", { method: "POST", body: JSON.stringify({ text: "also run the tests" }) });
  assert.deepEqual([q.status, q.data.queued, q.data.queue.map((x) => x.text)], [200, true, ["and fix what it finds", "also run the tests"]]);
  assert.equal(kc.w.turns().length, 0);
  assert.equal(kc.w.meta().parked.pid, "p1abcdef", "the card still waits");
  for (const body of [{ text: "/compact" }, { text: "x", images: [{ type: "image/png", data: "iVBORw0KGgo=" }] }]) assert.equal((await kc.w.go("projects/" + kc.w.id + "/message", { method: "POST", body: JSON.stringify(body) })).status, 409);
  // Its background is not asked about (its machine may have stopped).
  const bg = await w.go("projects/" + w.id + "/background");
  assert.deepEqual([bg.data.ok, bg.data.untold, bg.data.background], [true, 0, []]);
  assert.equal(w.toMachine.filter((x) => x.p === "/bgstate").length, 0);
  // Not another card's answer, nor one this card does not take.
  assert.equal((await w.go("projects/" + w.id + "/answer", { method: "POST", body: JSON.stringify({ pid: "p9zzzzzz", choice: "yes" }) })).status, 409);
  assert.equal((await w.go("projects/" + w.id + "/answer", { method: "POST", body: JSON.stringify({ pid: "p1abcdef", choice: "saved", host: "api.x.com" }) })).status, 409);
  assert.equal((await w.go("projects/" + w.id + "/answer", { method: "POST", body: JSON.stringify({ pid: "p1abcdef", choice: "approved" }) })).status, 400, "an environment card's approval is the server's to make");
  // The answer: the job that takes the turn up again.
  const marks = w.meta().marks;
  const a = await w.go("projects/" + w.id + "/answer", { method: "POST", body: JSON.stringify({ pid: "p1abcdef", choice: "yes", comment: "go" }) });
  assert.deepEqual([a.status, a.data.ok, a.data.project.status], [200, true, "running"]);
  const turn = w.turns()[0];
  assert.deepEqual([turn.text, turn.shown, turn.resume.pid, turn.resume.call.id, turn.resume.answer], ["", "", "p1abcdef", "b1", { choice: "yes", comment: "go" }]);
  assert.deepEqual(turn.messages, OPEN);
  assert.deepEqual(turn.queued.map((x) => x.text), ["and fix what it finds"]);
  assert.deepEqual([w.meta().parked, w.meta().waiting, w.meta().marks], [null, null, marks], "no Rewind mark: no message of the owner's starts it");
  assert.equal(w.bucket.m.has(w.key("parked.json")), false);
  // A question card: a message is its reply ("replied_in_chat").
  const qq = await parked("question", "question");
  const reply = await qq.w.go("projects/" + qq.w.id + "/message", { method: "POST", body: JSON.stringify({ text: "Use MySQL." }) });
  assert.equal(reply.status, 200);
  const rt = qq.w.turns()[0];
  assert.deepEqual([rt.resume.answer.choice, rt.resume.answer.text], ["chat", "Use MySQL."]);
  assert.match(rt.resume.answer.qid, /^q[0-9a-z]{6,20}$/);
  // Stop closes the card as Claude Code's Stop on a paused card does (its "user-rejected" words for every call of that turn);
  // what waited goes out next.
  const st = await parked();
  const stop = await st.w.go("projects/" + st.w.id + "/stop", { method: "POST" });
  assert.deepEqual(stop.data, { ok: true, reload: true });
  assert.deepEqual(st.w.json("messages.json").slice(2), [{ role: "tool", tool_call_id: "b1", content: REJECTED }, { role: "tool", tool_call_id: "b2", content: REJECTED }]);
  assert.deepEqual(st.w.json("events.json").slice(-3).map((e) => [e.type, e.pid || e.id || "", e.choice || e.output || ""]), [["permanswer", "p1abcdef", "stop"], ["result", "b1", "Not run: stopped."], ["stopped", "", ""]]);
  assert.equal(st.w.turns()[0].text, "and fix what it finds", "sent next, as after any job's end");
  assert.equal(st.w.turns()[0].resume, undefined);
  // Rewind and Undo close it first, then do theirs on a whole history.
  const rw = await parked();
  await rw.w.go("projects/" + rw.w.id + "/rewind", { method: "POST", body: JSON.stringify({ turn: 1, chat: true }) });
  assert.deepEqual([rw.w.meta().parked, rw.w.json("messages.json")], [null, []]);
  const un = await parked();
  await un.w.bucket.put(un.w.key("meta.json"), JSON.stringify({ ...un.w.meta(), commits: [{ sha: "abc1234", turn: 1, title: "lint" }] }));
  await un.w.go("projects/" + un.w.id + "/undo", { method: "POST" });
  const um = un.w.json("messages.json");
  assert.deepEqual(um.slice(2, 4).map((x) => x.tool_call_id), ["b1", "b2"], "every call answered before Undo's note");
  // The race: the card's job paused just as the owner answered, before it was saved: saved now, then taken up.
  const race = await worker();
  race.mc.running = false;
  race.mc.result = { status: "parked", parked: recOf(), messages: OPEN, summary: "x", mode: "acceptEdits" };
  race.mc.answer = () => ({ ok: false, parked: true });
  const ra = await race.go("projects/" + race.id + "/answer", { method: "POST", body: JSON.stringify({ pid: "p1abcdef", choice: "yes" }) });
  assert.equal(ra.status, 200);
  assert.equal(race.turns()[0].resume.pid, "p1abcdef");
});

test("CP10 the Worker's environment card answers (A5): approved while its step waits in the running job (checked with the machine, made, then the call told), refused when the change no longer fits; for a paused job, kept with its record and taken up; Decline answers the call", async () => {
  const { envState } = await import("../src/coder-envapi.mjs");
  const { readEnvData } = await import("../src/coder-environments.mjs");
  const args = { environment_name: "Default", applies_to: E.APPLIES_TO, reason: "The build fetches its schema.", add_allowed_hosts: ["api.foo.com"] };
  const shownFor = async (w) => E.envCard(await envState(w.env, w.bucket, w.uid, w.meta()), "update_environment", args).card;
  // Running, its step waiting on this card.
  const w = await worker();
  w.mc.running = true; w.mc.asking = "p1abcdef";
  w.mc.answer = (b) => (b.pid === "p1abcdef" ? { ok: true } : { ok: false });
  const shown = await shownFor(w);
  const r = await w.go("projects/" + w.id + "/envchange", { method: "POST", body: JSON.stringify({ tool: "update_environment", args, shown, pid: "p1abcdef" }) });
  assert.deepEqual([r.status, r.data.ok, r.data.envId], [200, true, "default"]);
  assert.deepEqual(w.toMachine.find((x) => x.p === "/answer").body, { project: w.id, pid: "p1abcdef", choice: "approved", result: "Approved: the environment \"Default\" was changed: allow api.foo.com. Host and network changes take effect in this chat within seconds." });
  assert.ok((await readEnvData(w.env, w.bucket, w.uid, "default")).network.hosts.includes("api.foo.com"), "made");
  // Refused: what the card showed no longer fits (the host is allowed now): the call is told why, nothing changes.
  const again = await w.go("projects/" + w.id + "/envchange", { method: "POST", body: JSON.stringify({ tool: "update_environment", args, shown, pid: "p1abcdef" }) });
  assert.equal(again.data.refused.length > 0, true);
  const told = w.toMachine.filter((x) => x.p === "/answer").at(-1).body;
  assert.deepEqual([told.choice, /^error: /.test(told.result)], ["refused", true]);
  // Not the card that waits: nothing is changed, the call not told.
  const v = await worker();
  v.mc.running = true; v.mc.asking = "p2other1";
  const no = await v.go("projects/" + v.id + "/envchange", { method: "POST", body: JSON.stringify({ tool: "update_environment", args, shown: await shownFor(v), pid: "p1abcdef" }) });
  assert.deepEqual([no.status, no.data.error], [409, "That card is no longer waiting for an answer."]);
  assert.ok(!(await readEnvData(v.env, v.bucket, v.uid, "default")).network.hosts.includes("api.foo.com"));
  // Paused on the card: made, kept with the record, and the turn taken up with what was done.
  const p = await worker();
  const card = await shownFor(p);
  const envParked = { status: "parked", parked: { ...recOf("envchange", "env"), call: { id: "u1", name: "update_environment", args }, rest: [], card }, messages: [{ role: "user", content: "x" }, { role: "assistant", content: "", tool_calls: [{ id: "u1", type: "function", function: { name: "update_environment", arguments: JSON.stringify(args) } }] }], summary: "x", mode: "acceptEdits" };
  p.mc.result = envParked;
  p.mc.events = [{ ...card, type: "envchange", pid: "p1abcdef" }];
  await p.go("projects/" + p.id + "/state?since=0");
  assert.equal(p.meta().waiting, "envchange");
  const pa = await p.go("projects/" + p.id + "/envchange", { method: "POST", body: JSON.stringify({ tool: "update_environment", args, shown: card, pid: "p1abcdef" }) });
  assert.deepEqual([pa.status, pa.data.project.status, pa.data.envId], [200, "running", "default"]);
  assert.deepEqual(p.turns()[0].resume.answer, { choice: "approved", result: "Approved: the environment \"Default\" was changed: allow api.foo.com. Host and network changes take effect in this chat within seconds." });
  // Decline on a paused card: Claude Code's denial, taken up.
  const d = await worker();
  d.mc.result = envParked;
  d.mc.events = [{ ...card, type: "envchange", pid: "p1abcdef" }];
  await d.go("projects/" + d.id + "/state?since=0");
  const dn = await d.go("projects/" + d.id + "/answer", { method: "POST", body: JSON.stringify({ pid: "p1abcdef", choice: "no" }) });
  assert.equal(dn.status, 200);
  assert.deepEqual(d.turns()[0].resume.answer, { choice: "no" });
});

test("CP11 the page: a card a paused job waits on stays live (permission, question, key and environment cards) and its answer follows the job that takes the turn up again; an environment card waits for its answer and shows how it ended; a message while the key card or an environment card waits goes to the queue; one while a permission or plan card waits goes out now and the card shows closed (fix round 3)", () => {
  const ui = readFileSync(HERE("public/coder.js"), "utf8");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  // The key card (keyCardHTML): live while its paused job waits on it, and only that card.
  const from = ui.indexOf("  const KEY_WORDS = "), to = ui.indexOf("\n  function permHTML(e) {");
  const keyCard = (S) => new Function("GLOOPY", "S", "esc", "ICON", ui.slice(from, to) + "\nreturn keyCardHTML;")(false, S, esc, { lock: "<svg></svg>" });
  const ev = { type: "secret", pid: "p1abcdef", host: "api.stripe.com", reason: "x", header: "Authorization", prefix: "Bearer", kind: "bearer" };
  const S = { running: false, events: [{ type: "user", text: "go" }, ev], project: { id: "shop", parked: { pid: "p1abcdef", kind: "secret" } }, envInfo: { name: "Default" } };
  assert.match(keyCard(S)(ev, 1), /is-live/);
  assert.doesNotMatch(keyCard({ ...S, project: { id: "shop", parked: null } })(ev, 1), /is-live/);
  assert.doesNotMatch(keyCard({ ...S, project: { id: "shop", parked: { pid: "p2other1", kind: "secret" } } })(ev, 1), /is-live/);
  // The permission card and the question card: the same.
  assert.match(ui, /function permHTML\(e\) \{\n    const ans = S\.events\.find\(\(x\) => x\.type === 'permanswer' && x\.pid === e\.pid\);\n    const live = \(S\.running \|\| !!\(S\.project && S\.project\.parked && S\.project\.parked\.pid === e\.pid\)\) && !ans;/);
  assert.match(ui, /const live = e\.pid \? \(S\.running \|\| !!\(S\.project && S\.project\.parked && S\.project\.parked\.pid === e\.pid\)\) && !ans : !S\.running/);
  // Its answer: the job that takes the turn up again is followed, as after a message.
  assert.match(ui, /function followTakenUp\(r\) \{\n    const p = r && r\.status === 200 && r\.data \? r\.data\.project : null;\n    if \(!p \|\| p\.status !== 'running' \|\| !S\.project \|\| p\.id !== S\.project\.id \|\| S\.running\) return false;\n    S\.project = p; S\.running = true; syncEntry\(\); S\.next = 0; stopBgWatch\(\); startPoll\(\); draw\(true\);/);
  assert.equal((ui.match(/followTakenUp\(/g) || []).length, 7, "the permission and question cards' answers, the key card's Save and Decline, the environment card's Approve and Decline");
  // The environment card (A5): Approve has Coder's server make it and answer the waiting call; Decline answers it; once
  // answered, how it ended.
  const a = ui.indexOf("  const ENV_CARD_KINDS = "), b = ui.indexOf("\n  }\n", ui.indexOf("  function envCardHtml("));
  const { envCardHtml } = new Function("esc", "ICON", "S", ui.slice(a, b + 4) + "\nreturn { envCardHtml };")(esc, { cloud: '<svg width="15" height="15"></svg>' }, { envChangeMsg: "" });
  const card = { kind: "update", tool: "update_environment", name: "Default", appliesTo: E.APPLIES_TO, change: { add: ["api.foo.com"], remove: [], set: {}, unset: [], packageManagers: null }, pid: "p1abcdef" };
  assert.match(envCardHtml(card, 3, false, { choice: "approved" }), /<div class="cd-perm-done"><span class="cd-perm-ok">✓ Approved<\/span><\/div>/);
  assert.match(envCardHtml(card, 3, false, { choice: "refused", why: "what the card shows no longer matches" }), /✕ Not changed<\/span>: what the card shows no longer matches/);
  assert.match(envCardHtml(card, 3, false, { choice: "no" }), /✕ Declined/);
  assert.match(envCardHtml({ ...card, kind: "create" }, 3, false, { choice: "no" }), /✕ Denied/);
  assert.match(envCardHtml({ ...card, kind: "switch" }, 3, false, { choice: "approved" }), /✓ Moved/);
  assert.match(envCardHtml(card, 3, false, { choice: "stop" }), /Stopped/);
  assert.match(ui, /if \(x\.pid && ENV_CARD_KINDS\.includes\(x\.kind\)\) \{\n\s+const r = await call\('\/projects\/' \+ encodeURIComponent\(S\.project\.id\) \+ '\/envchange', \{ method: 'POST', body: JSON\.stringify\(\{ tool: x\.tool, args: x\.args, shown: x, pid: x\.pid \}\) \}\);/);
  assert.match(ui, /const r = await call\('\/projects\/' \+ encodeURIComponent\(S\.project\.id\) \+ '\/answer', \{ method: 'POST', body: JSON\.stringify\(\{ pid: x\.pid, choice: 'no' \}\) \}\);/);
  assert.match(ui, /const live = e\.pid \? \(S\.running \|\| !!\(S\.project && S\.project\.parked && S\.project\.parked\.pid === e\.pid\)\) && !ans : !S\.running && !S\.events\.slice\(i \+ 1\)\.some\(\(x\) => x\.type === 'user'\);\n\s+const host = e\.kind === 'allow_host'/);
  // A message while the key card or an environment card waits: to the queue (the Worker keeps it for the card's turn). While a
  // question card waits it is the reply; while a permission card or the plan's waits, it goes out now and closes the card.
  assert.match(ui, /const parkedWait = !S\.running && !GLOOPY && S\.project && S\.project\.parked && !\['question', 'permission'\]\.includes\(S\.project\.parked\.kind\);\n\s+if \(S\.running \|\| parkedWait\) \{/);
  // The card the message closed is drawn closed at once, before the message (or after a start that failed); a start that
  // took the messages waiting in line with it loads the chat, as after a job's end.
  assert.match(ui, /const closed = r\.data && Array\.isArray\(r\.data\.closed\) \? r\.data\.closed : \[\];\n\s+if \(closed\.length && S\.project\) S\.project = \{ \.\.\.S\.project, parked: null, waiting: null \};\n\s+if \(r\.status !== 200\) \{\n\s+S\.events = S\.events\.slice\(0, base\)\.concat\(closed\);/);
  assert.match(ui, /if \(r\.data\.reload && r\.data\.project\) \{ S\.events = S\.events\.slice\(0, base\); S\.project = r\.data\.project; syncEntry\(\); return reloadChat\(r\.data\.project\.id\); \}\n\s+if \(closed\.length\) S\.events\.splice\(base, 0, \.\.\.closed\);/);
  // How a closed card reads: no longer answerable, and why.
  const pd = ui.indexOf("  function permDone(e, ans) {"), pe = ui.indexOf("\n  }\n", pd);
  const permDone = new Function("esc", "ruleShown", ui.slice(pd, pe + 4) + "\nreturn permDone;")(esc, (r) => r);
  assert.equal(permDone({ tool: "bash" }, { choice: "closed" }), '<span class="cd-perm-no">Closed</span> · you sent a new message before answering');
  assert.equal(permDone({ tool: "plan" }, { choice: "closed" }), '<span class="cd-perm-no">Closed</span> · you sent a new message before answering');
  assert.equal(permDone({ tool: "bash" }, { choice: "stop" }), '<span class="cd-perm-no">Stopped</span>');
  // The step its card waits on shows as waiting, not as cut off.
  assert.match(ui, /waitingIds\.has\(e\.id\) && S\.project && S\.project\.parked && S\.project\.parked\.call === e\.id \? 'wait' : 'gone'/);
});

test("CP12 fix round 3 (T1): the owner's next message to a paused permission or plan card closes it, as Claude Code 2.1.325's cloud does (its \"new_input\": the card withdrawn, every call of that round told \"[Tool call not completed: … the message that follows arrived and was closed …]\"), and is answered at once; what waited in line goes first, in the order typed; a start that fails leaves the card closed and says so; not a job from GitHub", async () => {
  const CLOSED_LINE = "Not run: you sent a new message before answering.";
  const closedRound = [...OPEN, { role: "tool", tool_call_id: "b1", content: P.CARD_CLOSED }, { role: "tool", tool_call_id: "b2", content: P.CARD_CLOSED }];
  // Nothing waiting in line: the card closes, and the message starts its job now.
  const a = await parked();
  await a.w.bucket.put(a.w.key("queue.json"), "[]");
  const marks = a.w.meta().marks;
  const r = await a.w.go("projects/" + a.w.id + "/message", { method: "POST", body: JSON.stringify({ text: "skip the lint, just build", mid: "m1closed01" }) });
  assert.deepEqual([r.status, r.data.ok, r.data.project.status, r.data.queued], [200, true, "running", undefined]);
  assert.deepEqual(r.data.closed.map((e) => [e.type, e.pid || e.id, e.choice || e.output]), [["permanswer", "p1abcdef", "closed"], ["result", "b1", CLOSED_LINE]], "the page draws the card closed at once");
  assert.deepEqual([a.w.meta().parked, a.w.meta().waiting], [null, null]);
  assert.equal(a.w.bucket.m.has(a.w.key("parked.json")), false);
  assert.deepEqual(a.w.json("messages.json"), closedRound, "every call of the round has its answer: Claude Code's words for it");
  assert.deepEqual(a.w.json("events.json").slice(-2).map((e) => [e.type, e.choice || e.output]), [["permanswer", "closed"], ["result", CLOSED_LINE]]);
  const t = a.w.turns()[0];
  assert.deepEqual([t.text, t.resume, t.queued], ["skip the lint, just build", undefined, undefined], "a job of its own, with the owner's message: no turn taken up");
  assert.deepEqual(t.messages, closedRound);
  assert.equal(a.w.meta().marks.length, marks.length + 1, "the owner's message: a new Rewind mark");
  // The same message again (a browser sends it twice): answered as its first copy was.
  const again = await a.w.go("projects/" + a.w.id + "/message", { method: "POST", body: JSON.stringify({ text: "skip the lint, just build", mid: "m1closed01" }) });
  assert.deepEqual([again.status, a.w.turns().length], [200, 1]);
  // What waited in line for the card goes first, in the order typed, this message with it; the page loads the chat.
  const b = await parked();
  const rb = await b.w.go("projects/" + b.w.id + "/message", { method: "POST", body: JSON.stringify({ text: "also run the tests" }) });
  assert.deepEqual([rb.status, rb.data.reload, rb.data.queue], [200, true, []]);
  assert.equal(b.w.turns()[0].text, "and fix what it finds\n\nalso run the tests");
  assert.deepEqual(b.w.turns()[0].messages, closedRound);
  assert.deepEqual(b.w.json("queue.json"), []);
  // The plan's card: closed the same way; it has no step of its own to mark.
  const pl = await parked("permission", "plan");
  await pl.w.bucket.put(pl.w.key("queue.json"), "[]");
  const rp = await pl.w.go("projects/" + pl.w.id + "/message", { method: "POST", body: JSON.stringify({ text: "Actually, plan the checkout too." }) });
  assert.deepEqual([rp.status, rp.data.closed.map((e) => e.type)], [200, ["permanswer"]]);
  assert.equal(pl.w.turns()[0].messages.at(-2).content, P.CARD_CLOSED);
  // Pictures too (not in line: they go now, and what waited goes after this job, as at any job's end).
  const pc = await parked();
  const rc = await pc.w.go("projects/" + pc.w.id + "/message", { method: "POST", body: JSON.stringify({ text: "like this", images: [{ type: "image/png", data: "iVBORw0KGgo=" }] }) });
  assert.deepEqual([rc.status, pc.w.turns()[0].images.length, pc.w.json("queue.json").map((x) => x.text)], [200, 1, ["and fix what it finds"]]);
  // A start that fails after the card closed: the card stays closed (the page is told), the message is given back.
  const f = await parked();
  await f.w.bucket.put(f.w.key("queue.json"), "[]");
  const { forgetConnection } = await import("../src/coder-github.mjs");
  await forgetConnection(f.w.bucket, f.w.uid);
  const rf = await f.w.go("projects/" + f.w.id + "/message", { method: "POST", body: JSON.stringify({ text: "go on" }) });
  assert.deepEqual([rf.status, rf.data.connect, rf.data.closed.map((e) => e.type)], [409, true, ["permanswer", "result"]]);
  assert.deepEqual([f.w.meta().parked, f.w.meta().status, f.w.turns().length], [null, "idle", 0]);
  // Not a job from GitHub (strangers write there): the card still waits for the owner, as before.
  const g = await parked();
  const rg = await g.w.go("projects/" + g.w.id + "/message", { method: "POST", body: JSON.stringify({ text: "@coder do it", fromGithub: true }) });
  assert.equal(rg.status, 409);
  assert.equal(g.w.meta().parked.pid, "p1abcdef");
  // While its job still runs, Claude Code keeps the card and the message waits in line (its live prompt is closed by no
  // message): Coder's queue, as before (the running job reads it when its tool calls finish).
  const live = await worker({ status: "running" });
  live.mc.running = true;
  const rl = await live.go("projects/" + live.id + "/message", { method: "POST", body: JSON.stringify({ text: "and then deploy" }) });
  assert.deepEqual([rl.status, rl.data.queued], [200, true]);
  assert.deepEqual(live.toMachine.filter((x) => x.p === "/queue").map((x) => x.body.text), ["and then deploy"]);
});

test("CP13 fix round 3 (T3): the owner's words with a Yes go to Grok exactly as typed, as their own text after the round's results (Claude Code 2.1.325: a Yes's \"acceptFeedback\" is a text of its own after the call's result, and its API takes a message's results first, its texts after them); kept with the call's result in the chat, never wrapped in a sentence; Gloopy's keep their own", async () => {
  const round = [{ role: "user", content: "go" }, { role: "assistant", content: "", tool_calls: [{ id: "b1" }, { id: "b2" }] }, { role: "tool", tool_call_id: "b1", content: "ran 1", words: "only the cart ones" }, { role: "tool", tool_call_id: "b2", content: "ran 2", words: "" }, { role: "user", appNote: true, content: "(Note from Coder's app, not the owner: x)" }];
  assert.deepEqual(P.wordsAfterResults(round), [round[0], round[1], { role: "tool", tool_call_id: "b1", content: "ran 1" }, { role: "tool", tool_call_id: "b2", content: "ran 2" }, { role: "user", content: "only the cart ones" }, round[4]]);
  const plain = [{ role: "user", content: "go" }];
  assert.equal(P.wordsAfterResults(plain), plain, "nothing to move: the same list");
  // A round at the end of the chat: the words still come after its last result.
  assert.deepEqual(P.wordsAfterResults(round.slice(0, 3)).at(-1), { role: "user", content: "only the cart ones" });
  // In the loop: a Yes with words on a command's card (the job still running).
  const t = await loop([say("", [call("bash", { command: "npm run lint", description: "Lint" }, "b1"), call("bash", { command: "npm run build", description: "Build" }, "b2")]), say("Done.")], {}, { ask: async () => ({ choice: "yes", comment: "only the cart ones" }) });
  const b1 = t.r.messages.find((m) => m.role === "tool" && m.tool_call_id === "b1");
  assert.deepEqual([b1.content, b1.words], ["ran: npm run lint", "only the cart ones"]);
  assert.doesNotMatch(JSON.stringify(t.r.messages), /approved this with a note/);
  const sent = t.seen[1].messages;
  const last = sent.findIndex((m) => m.role === "tool" && m.tool_call_id === "b2");
  assert.deepEqual(sent[last + 1], { role: "user", content: "only the cart ones" });
  assert.ok(sent.every((m) => !("words" in m)));
  // Its PostToolUse hooks get the call's own result, without the owner's words (Claude Code's tool_response).
  const hooks = H.hooksFrom({ hooks: { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "post.sh" }] }] } }, "settings").list;
  const h = await loop([say("", [call("bash", { command: "npm run lint", description: "Lint" }, "b1")]), say("Done.")], { hooks }, { ask: async () => ({ choice: "yes", comment: "only the cart ones" }) });
  assert.equal(h.hookCalls.find((x) => x.hook_event_name === "PostToolUse").tool_response.output, "ran: npm run lint");
  // "Don't ask again" and "switch to auto mode" take no words, as before.
  const al = await loop([say("", [call("bash", { command: "npm run lint", description: "Lint" }, "b1")]), say("Done.")], {}, { ask: async () => ({ choice: "always", comment: "ignored" }) });
  assert.equal(al.r.messages.find((m) => m.role === "tool").words, undefined);
  // Gloopy's own sentence stays as it was (Gloopy is unchanged).
  assert.match(readFileSync(HERE("container/coder-agent.mjs"), "utf8"), /if \(offered\) return "\\n\\n\(The owner approved this with a note: " \+ a\.comment \+ "\)";/);
});
