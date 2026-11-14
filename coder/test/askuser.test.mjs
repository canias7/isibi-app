// CLAUDE CODE'S AskUserQuestion AS CODER'S ask_user (the owner, 2026-11-14: "Do all the talk to you tools execpt for the
// notify one"; Claude Code's tools reference, its hooks reference, the Agent SDK's "Handle approvals and user input", and its
// 2.1.325 program where the docs say nothing): what Grok is told (its description and inputs, word for word); its input check
// before any hook (its schema, in its words); the card Coder waits on while it works, whose answers are the tool's result in
// the same turn (Claude Code's words); its hooks (PreToolUse, PermissionRequest, Notification, PostToolUse with its result
// object); the auto mode checker's view; the machine's /answer and a reply typed in the chat; the Worker; and the page.
// Gloopy keeps its own ask_user, as before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const HERE = (p) => new URL("../" + p, import.meta.url);
const A = await import("../container/coder-agent.mjs");
const Q = await import("../container/coder-askuser.mjs");
const H = await import("../container/coder-hooks.mjs");
const call = (name, args, id = "c1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

const DB = { question: "Which database should the sign-up page save to?", header: "Database", options: [{ label: "Postgres (Recommended)", description: "Already in the project." }, { label: "SQLite", description: "A single file." }] };
const SIGN = { question: "Which ways to sign in should it offer?", header: "Sign-in", multiSelect: true, options: [{ label: "Email, password", description: "A form." }, { label: "Google", description: "One button." }, { label: "GitHub", description: "One button." }] };
const DBQ = DB.question, SIGNQ = SIGN.question;
const READ = { ...DB, multiSelect: false };

/** One job with a scripted Grok, its hooks run by a stub; `answers`: what the owner does on each card Coder waits on. */
async function job(steps, { hooks = null, hookRun = () => ({}), answers = [], extra = {}, deps = {} } = {}) {
  const events = [], seen = [], hookCalls = [], waited = [], ran = [];
  let n = 0, k = 0;
  const r = await A.runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        hookCalls.push(input);
        const a = (await hookRun(input)) || {};
        return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") };
      }
      ran.push(x.command);
      return { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", chatId: "shop-aq", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ask: async (pid, opts) => { waited.push({ pid, opts, card: events.find((e) => e.pid === pid) }); const a = answers[k++]; return typeof a === "function" ? a() : a || null; },
    ...deps,
  }, { text: "Build the sign-up page", mode: "auto", messages: [], ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}), ...extra });
  const msg = (id) => r.messages.find((m) => m.role === "tool" && m.tool_call_id === id);
  return { r, events, seen, hookCalls, waited, ran, told: (id) => (msg(id) || {}).content, msg };
}
const hooksOf = (event, cmd = "hook.sh") => ({ [event]: [{ matcher: "AskUserQuestion", hooks: [{ type: "command", command: cmd }] }] });
const out = (event, o) => ({ stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: event, ...o } }) });

test("AQ1 what Grok is told: Claude Code's AskUserQuestion description and inputs, word for word (\"the user\" as \"the owner\"); no plan-mode note, as Claude Code leaves it out without a tool to enter plan mode; the same from GitHub; Gloopy keeps its own ask_user", async () => {
  const tool = A.CODER_TOOLS.find((t) => t.function.name === "ask_user").function;
  assert.equal(tool.description, "Use this tool only when you are blocked on a decision that is genuinely the owner's to make: one you cannot resolve from the request, the code, or sensible defaults.\n\nUsage notes:\n- The owner will always be able to select \"Other\" to provide custom text input\n- Use multiSelect: true to allow multiple answers to be selected for a question\n- If you recommend a specific option, make that the first option in the list and add \"(Recommended)\" at the end of the label\n\nReserve this for decisions where the owner's answer changes what you do next — not for choices with a conventional default or facts you can verify in the codebase yourself. In those cases pick the obvious option, mention it in your response, and proceed.\n\nThe owner may see only the question dialog: tool results and text you wrote earlier in this turn may not be on their screen while it is open. Make each question stand on its own: if it depends on something you found, say so briefly, and name the items you are asking about in the question itself.\n");
  assert.ok(!A.CODER_TOOLS.some((t) => t.function.name === "enter_plan_mode"), "Coder has no tool to enter plan mode: the plan-mode note stays out");
  assert.doesNotMatch(tool.description, /plan mode|EnterPlanMode/);
  assert.deepEqual(tool.parameters, { type: "object", properties: Q.ASK_USER_PROPERTIES, required: ["questions"] });
  const p = tool.parameters.properties;
  assert.deepEqual(Object.keys(p), ["questions", "answers", "annotations", "metadata"]);
  assert.deepEqual([p.questions.type, p.questions.minItems, p.questions.maxItems, p.questions.description], ["array", 1, 4, "Questions to ask the owner (1-4 questions)"]);
  const q = p.questions.items;
  assert.deepEqual(Object.keys(q.properties), ["question", "header", "options", "multiSelect"]);
  assert.deepEqual(q.required, ["question", "header", "options"]);
  assert.equal(q.properties.question.description, "The complete question to ask the owner. Should be clear, specific, and end with a question mark. Example: \"Which library should we use for date formatting?\" If multiSelect is true, phrase it accordingly, e.g. \"Which features do you want to enable?\"");
  assert.equal(q.properties.header.description, "Very short label displayed as a chip/tag (max 12 chars). Examples: \"Auth method\", \"Library\", \"Approach\".");
  assert.deepEqual([q.properties.options.minItems, q.properties.options.maxItems], [2, 4]);
  assert.equal(q.properties.options.description, "The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically.");
  const o = q.properties.options.items;
  assert.deepEqual(o.required, ["label", "description"]);
  assert.equal(o.properties.label.description, "The display text for this option that the owner will see and select. Should be concise (1-5 words) and clearly describe the choice.");
  assert.equal(o.properties.description.description, "Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.");
  assert.equal(o.properties.preview.description, "Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help the owner compare options. See the tool description for the expected content format.");
  assert.deepEqual(q.properties.multiSelect, { type: "boolean", default: false, description: "Set to true to allow the owner to select multiple options instead of just one. Use when choices are not mutually exclusive." });
  assert.equal(p.answers.description, "Owner answers collected by the permission component");
  assert.equal(p.annotations.description, "Optional per-question annotations from the owner (e.g., notes on preview selections). Keyed by question text.");
  assert.deepEqual(p.annotations.additionalProperties.properties, { preview: { type: "string", description: "The preview content of the selected option, if the question used previews." }, notes: { type: "string", description: "Free-text notes the owner added to their selection." } });
  assert.equal(p.metadata.description, "Optional metadata for tracking and analytics purposes. Not displayed to the owner.");
  assert.equal(p.metadata.properties.source.description, "Optional identifier for the source of this question (e.g., \"remember\" for /remember command). Used for analytics tracking.");
  assert.deepEqual(A.GITHUB_TOOLS.find((t) => t.function.name === "ask_user"), A.CODER_TOOLS.find((t) => t.function.name === "ask_user"));
  // Gloopy's own, unchanged: its card ends the turn.
  const G = await import("../container/gloopy-agent.mjs");
  const g = G.GLOOPY_TOOLS.find((t) => t.function.name === "ask_user").function;
  assert.match(g.description, /^Ask the owner 1 to 4 questions at once, like Claude Code's[\s\S]*Your turn ends there; their answers come back as the next message\./);
  assert.deepEqual(Object.keys(g.parameters.properties.questions.items.properties), ["question", "header", "options", "multi_select"]);
  // The machine's copy holds the new module.
  const copy = readFileSync(HERE("container/Dockerfile"), "utf8").split("\n").find((l) => /^COPY package\.json /.test(l));
  assert.ok(copy.includes(" coder-askuser.mjs "));
});

test("AQ2 its input check, before any hook (Claude Code: \"Validation rejections … happen before hooks run\"): read as its schema reads it (multiSelect false when left out, unknown keys of a question or option dropped), or refused in its words: missing, unexpected and wrong-typed parameters; zod's own message for sizes and repeats; its steer first for a question of fewer than 2 options; no step in the chat for it", async () => {
  const ok = Q.checkAskUserInput({ questions: [{ ...DB, multi_select: true, extra: 1, options: [{ ...DB.options[0], icon: "x" }, DB.options[1]] }] });
  assert.deepEqual(ok, { args: { questions: [READ] } });
  assert.deepEqual(Q.checkAskUserInput({ questions: [DB], answers: { [DBQ]: ["a", "b"] }, metadata: { source: "x" } }).args.answers, { [DBQ]: "a, b" }, "a list of answers is joined with \", \"");
  const err = (x) => Q.checkAskUserInput(x).error;
  assert.equal(err({}), "error: InputValidationError: AskUserQuestion failed due to the following issue:\nThe required parameter `questions` is missing");
  assert.equal(err({ questions: [{ question: "Which?", options: [{ label: "A" }, { label: "B", description: 2 }], multiSelect: "yes" }], extra: true }),
    "error: InputValidationError: AskUserQuestion failed due to the following issues:\nThe required parameter `questions[0].header` is missing\nThe required parameter `questions[0].options[0].description` is missing\nAn unexpected parameter `extra` was provided\nThe parameter `questions[0].options[1].description` type is expected as `string` but provided as `number`\nThe parameter `questions[0].multiSelect` type is expected as `boolean` but provided as `string`");
  assert.equal(err({ questions: "Which?" }), "error: InputValidationError: AskUserQuestion failed due to the following issue:\nThe parameter `questions` type is expected as `array` but provided as `string`");
  assert.equal(err({ questions: [DB], answers: [] }), "error: InputValidationError: AskUserQuestion failed due to the following issue:\nThe parameter `answers` type is expected as `record` but provided as `array`");
  // Sizes and repeats alone: zod's message, its issues as JSON (Claude Code says nothing else of them).
  assert.equal(err({ questions: [DB, { ...DB, question: "B?" }, { ...DB, question: "C?" }, { ...DB, question: "D?" }, { ...DB, question: "E?" }] }), "error: InputValidationError: " + JSON.stringify([{ origin: "array", code: "too_big", maximum: 4, inclusive: true, path: ["questions"], message: "Too big: expected array to have <=4 items" }], null, 2));
  assert.equal(err({ questions: [{ ...DB, options: [...DB.options, ...["c", "d", "e"].map((l) => ({ label: l, description: "" }))] }] }), "error: InputValidationError: " + JSON.stringify([{ origin: "array", code: "too_big", maximum: 4, inclusive: true, path: ["questions", 0, "options"], message: "Too big: expected array to have <=4 items" }], null, 2));
  assert.equal(err({ questions: [DB, DB] }), "error: InputValidationError: " + JSON.stringify([{ code: "custom", path: [], message: "Question texts must be unique, option labels must be unique within each question" }], null, 2));
  assert.equal(err({ questions: [{ ...DB, options: [DB.options[0], DB.options[0]] }] }), "error: InputValidationError: " + JSON.stringify([{ code: "custom", path: [], message: Q.UNIQUE_MESSAGE }], null, 2));
  // Fewer than 2 options: its steer, then zod's message; a size issue lets the repeat check run too, as zod does.
  assert.equal(err({ questions: [{ ...DB, options: [DB.options[0]] }] }), "error: InputValidationError: " + Q.FEW_OPTIONS_STEER + "\n\n" + JSON.stringify([{ origin: "array", code: "too_small", minimum: 2, inclusive: true, path: ["questions", 0, "options"], message: "Too small: expected array to have >=2 items" }], null, 2));
  assert.match(err({ questions: [{ ...DB, options: [DB.options[0]] }, { ...DB, options: [DB.options[0]] }] }), /"code": "too_small"[\s\S]*"code": "too_small"[\s\S]*"code": "custom"/);
  assert.match(err({ questions: [{ question: "Q?", options: [] }] }), /^error: InputValidationError: This call included a question with fewer than 2 options[\s\S]*\n\nAskUserQuestion failed due to the following issues:\nThe required parameter `questions\[0\]\.header` is missing\nThe parameter `questions\[0\]\.options` is invalid: Too small: expected array to have >=2 items$/);
  assert.equal(Q.FEW_OPTIONS_STEER, "This call included a question with fewer than 2 options, so it was rejected and the person never saw it. A question with a single option has no decision in it. Do not retry this call and do not invent a filler second option. Instead, state the one path you were going to offer as the approach you are taking, then continue with the task. If this call also contained questions with 2 to 4 options (each with distinct labels), you may re-ask those questions alone in a new call. Ask a question only when the person has at least two genuinely distinct choices.");
  assert.equal(Q.checkAskUserInput({ questions: [DB] }).quiet, undefined);
  assert.equal(Q.checkAskUserInput({}).quiet, true, "no step in the chat for a refused question");
  // Gloopy's own ask_user is taken as it is.
  assert.deepEqual(Q.checkAskUserInput({ question: "Which?", options: ["a", "b"] }, { who: "Gloopy" }), { args: { question: "Which?", options: ["a", "b"] } });

  // IN THE LOOP: refused before any hook or card; Coder goes on; the chat shows no step.
  const t = await job([say("", [call("ask_user", { questions: [{ ...DB, options: [DB.options[0]] }] }, "q1")]), say("I'll go with Postgres.")], { hooks: hooksOf("PreToolUse"), answers: [{ choice: "skip" }] });
  assert.equal(t.hookCalls.length, 0, "no PreToolUse hook");
  assert.equal(t.waited.length, 0, "no card");
  assert.match(t.told("q1"), /^error: InputValidationError: This call included a question with fewer than 2 options/);
  assert.ok(!t.events.some((e) => (e.type === "bash" || e.type === "result") && e.id === "q1"));
  assert.equal(t.seen.length, 2);
});

test("AQ3 under permissions.denyInsteadOfPrompting Claude Code does not offer AskUserQuestion: ask_user is left out of Coder's tools, and a call to it anyway is no tool, before any check or hook", async () => {
  const t = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("ok")], { hooks: hooksOf("PreToolUse"), extra: { denyInstead: true } });
  assert.ok(!t.seen[0].tools.some((x) => x.function.name === "ask_user"));
  assert.ok(t.seen[0].tools.some((x) => x.function.name === "bash"));
  assert.equal(t.told("q1"), "error: No such tool available: ask_user");
  assert.deepEqual([t.hookCalls.length, t.waited.length], [0, 0]);
  const on = await job([say("ok")]);
  assert.ok(on.seen[0].tools.some((x) => x.function.name === "ask_user"), "offered otherwise");
});

test("AQ4 the card Coder waits on (Claude Code: the question dialog is its permission prompt, and the answers are the tool's result): the card shows with its pid while the step waits; the owner's picks come back as Claude Code's answers, told in its words in the same turn; the round's other calls run after it; PostToolUse hooks get Claude Code's tool_input and result object", async () => {
  const hooks = { ...hooksOf("PostToolUse", "post.sh") };
  const t = await job([say("Two choices first.", [call("ask_user", { questions: [DB, SIGN] }, "q1"), call("bash", { command: "echo after", description: "Say after" }, "b1")]), say("Done.")], { hooks, answers: [{ choice: "answers", picks: [{ options: [0] }, { options: [2, 1] }] }] });
  const card = t.events.find((e) => e.type === "question");
  assert.match(card.pid, /^p[0-9a-z]+$/);
  assert.deepEqual({ ...card, at: 0 }, { at: 0, type: "question", pid: card.pid, text: DBQ, header: "Database", options: DB.options, questions: [{ text: DBQ, header: "Database", options: DB.options }, { text: SIGNQ, header: "Sign-in", options: SIGN.options, multi: true }] });
  assert.equal(t.waited[0].pid, card.pid);
  assert.equal(t.waited[0].opts.chat, true, "a message typed meanwhile may answer it");
  assert.ok(!t.events.some((e) => e.type === "permission"), "no other card");
  assert.equal(t.told("q1"), 'Your questions have been answered: "' + DBQ + '"="Postgres (Recommended)", "' + SIGNQ + '"="Google, GitHub". You can now continue with these answers in mind.');
  assert.equal(t.msg("q1").ownerAnswer, true, "marked for the auto mode checker");
  assert.equal(t.seen.length, 2, "Coder went on in the same turn");
  assert.ok(t.ran.includes("echo after"), "the call after it ran");
  assert.deepEqual(t.events.find((e) => e.type === "permanswer"), { at: t.events.find((e) => e.type === "permanswer").at, type: "permanswer", pid: card.pid, choice: "answers", picks: [{ options: [0] }, { options: [2, 1] }] });
  const post = t.hookCalls.find((x) => x.hook_event_name === "PostToolUse" && x.tool_name === "AskUserQuestion");
  assert.deepEqual(post.tool_input, { questions: [READ, SIGN], answers: { [DBQ]: "Postgres (Recommended)", [SIGNQ]: "Google, GitHub" } });
  assert.deepEqual(post.tool_response, { questions: [READ, SIGN], answers: { [DBQ]: "Postgres (Recommended)", [SIGNQ]: "Google, GitHub" } });
  // A label with ", " in it is quoted where several are joined (Claude Code's join); Other's text with them: not one of the
  // choices, so Claude Code's other words.
  const u = await job([say("", [call("ask_user", { questions: [DB, SIGN] }, "q1")]), say("Done.")], { answers: [{ choice: "answers", picks: [{ options: [1] }, { options: [0], other: "  Apple  " }] }] });
  assert.equal(u.told("q1"), 'The owner answered: "' + DBQ + '"="SQLite", "' + SIGNQ + '"=""Email, password", Apple". Read the answers carefully \u2014 they may request clarification, changes, or that you not proceed \u2014 and follow what they actually say.');
  // One question left unanswered: only the other is told; hooks see it marked "skipped", as Claude Code's apps mark one.
  const v = await job([say("", [call("ask_user", { questions: [DB, SIGN] }, "q1")]), say("Done.")], { hooks, answers: [{ choice: "answers", picks: [{ options: [] }, { options: [0] }] }] });
  assert.equal(v.told("q1"), 'Your questions have been answered: "' + SIGNQ + '"=""Email, password"". You can now continue with these answers in mind.');
  assert.deepEqual(v.hookCalls.find((x) => x.hook_event_name === "PostToolUse").tool_response.annotations, { [DBQ]: { unanswered: "skipped" } });
  // A one-choice question answered under Other: Claude Code's other words.
  const w = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("Done.")], { answers: [{ choice: "answers", picks: [{ other: "MySQL" }] }] });
  assert.match(w.told("q1"), /^The owner answered: "Which database should the sign-up page save to\?"="MySQL"\. Read the answers carefully/);
  // The model's own answers are not the owner's (Claude Code's card shows its questions alone).
  const x = await job([say("", [call("ask_user", { questions: [DB], answers: { [DBQ]: "SQLite" } }, "q1")]), say("Done.")], { hooks: hooksOf("PermissionRequest"), answers: [{ choice: "answers", picks: [{ options: [0] }] }] });
  assert.equal(x.waited.length, 1, "the card all the same");
  assert.deepEqual(x.hookCalls.find((y) => y.hook_event_name === "PermissionRequest").tool_input, { questions: [READ] });
  assert.match(x.told("q1"), /="Postgres \(Recommended\)"\. You can now continue/);
});

test("AQ5 the card's other ways out: Skip (Claude Code's \"The user did not answer the questions.\"), a message typed while it waits (Claude Code's `response`: \"The user responded: …\", shown as the owner's message), Stop, no answer, and the job's time limit", async () => {
  const hooks = hooksOf("PostToolUse", "post.sh");
  const s = await job([say("", [call("ask_user", { questions: [DB, SIGN] }, "q1")]), say("I'll decide.")], { hooks, answers: [{ choice: "skip" }] });
  assert.equal(s.told("q1"), "The owner did not answer the questions.");
  assert.equal(s.seen.length, 2);
  assert.deepEqual(s.hookCalls.find((x) => x.hook_event_name === "PostToolUse").tool_response.annotations, { [DBQ]: { unanswered: "skipped" }, [SIGNQ]: { unanswered: "skipped" } });
  assert.equal(s.events.find((e) => e.type === "permanswer").choice, "skip");
  const c = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("MySQL it is.")], { hooks, answers: [{ choice: "chat", text: "Neither: use MySQL, the team knows it.", qid: "qabc1234" }] });
  assert.equal(c.told("q1"), "The owner responded: Neither: use MySQL, the team knows it.");
  assert.equal(c.msg("q1").ownerAnswer, true);
  const said = c.events.find((e) => e.type === "user" && e.queued);
  assert.deepEqual({ ...said, at: 0 }, { at: 0, type: "user", text: "Neither: use MySQL, the team knows it.", queued: true, qid: "qabc1234" });
  const resp = c.hookCalls.find((x) => x.hook_event_name === "PostToolUse").tool_response;
  assert.deepEqual([resp.response, resp.answers, resp.annotations], ["Neither: use MySQL, the team knows it.", {}, { [DBQ]: { unanswered: "replied_in_chat" } }]);
  assert.ok(!c.r.messages.some((m) => m.role === "user" && /use MySQL/.test(String(m.content))), "told as the tool's result only");
  const st = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("never")], { answers: [{ choice: "stop" }] });
  assert.deepEqual([st.r.status, st.told("q1"), st.seen.length], ["stopped", "stopped by the owner", 1]);
  const none = await job([say("", [call("ask_user", { questions: [DB] }, "q1"), call("bash", { command: "echo no" }, "b1")]), say("never")], { answers: [null] });
  assert.equal(none.told("q1"), "The owner doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the owner to tell you how to proceed.");
  assert.deepEqual([none.r.status, none.seen.length, none.ran.includes("echo no")], ["done", 1, false]);
  const late = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("never")], { extra: { maxMs: 300 }, answers: [() => new Promise((ok) => setTimeout(() => ok(null), 450))] });
  assert.equal(late.r.status, "time");
  assert.equal(late.told("q1"), "not run: Coder ran out of time waiting for the owner's answer");
  assert.ok(late.events.some((e) => e.type === "error" && e.text === "Coder ran out of time waiting for your answer."));
});

test("AQ6 its hooks as Claude Code's: a PreToolUse rewrite checked as Claude Code checks one; PermissionRequest hooks before the card (an allow answers it only with updatedInput; a deny is told, and Coder goes on); the Notification hook (\"permission_prompt\") once the card has waited", async () => {
  // PermissionRequest: allow with updatedInput answers it, no card; the hook sees the card's input.
  const ans = (answers) => () => out("PermissionRequest", { decision: { behavior: "allow", updatedInput: { questions: [READ], answers } } });
  let t = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("ok")], { hooks: hooksOf("PermissionRequest"), hookRun: ans({ [DBQ]: "SQLite" }) });
  assert.equal(t.waited.length, 0, "no card");
  assert.ok(!t.events.some((e) => e.type === "question"));
  const pr = t.hookCalls.find((x) => x.hook_event_name === "PermissionRequest");
  assert.deepEqual([pr.tool_name, pr.tool_input], ["AskUserQuestion", { questions: [READ] }]);
  assert.equal(t.told("q1"), 'Your questions have been answered: "' + DBQ + '"="SQLite". You can now continue with these answers in mind.');
  assert.equal(t.events.find((e) => e.type === "note" && e.hook === "PermissionRequest").text, 'A PermissionRequest hook answered Coder\'s question for you: "' + DBQ + '"="SQLite"');
  // The tool runs with the hook's input, its own questions too.
  t = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("ok")], { hooks: hooksOf("PermissionRequest"), hookRun: () => out("PermissionRequest", { decision: { behavior: "allow", updatedInput: { questions: [{ ...READ, question: "Which DB?" }], answers: { "Which DB?": "SQLite" } } } }) });
  assert.equal(t.told("q1"), 'Your questions have been answered: "Which DB?"="SQLite". You can now continue with these answers in mind.');
  // A rewrite that fails the schema: refused in Claude Code's words.
  t = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("ok")], { hooks: hooksOf("PermissionRequest"), hookRun: ans({ [DBQ]: 3 }) });
  assert.equal(t.told("q1"), "PermissionRequest hook for AskUserQuestion returned updatedInput that failed schema validation: AskUserQuestion failed due to the following issue:\nThe parameter `answers." + DBQ + "` type is expected as `string` but provided as `number`\nThe tool input from the model was valid; the hook's rewrite of it was not.");
  // Its allow alone: the card all the same (Claude Code: AskUserQuestion needs updatedInput with "allow").
  t = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("ok")], { hooks: hooksOf("PermissionRequest"), hookRun: () => out("PermissionRequest", { decision: { behavior: "allow" } }), answers: [{ choice: "answers", picks: [{ options: [0] }] }] });
  assert.equal(t.waited.length, 1);
  assert.match(t.told("q1"), /^Your questions have been answered: /);
  // A deny: its message is told (or Claude Code's "Permission denied by hook"), no card, Coder goes on; interrupt stops.
  t = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("ok")], { hooks: hooksOf("PermissionRequest"), hookRun: () => out("PermissionRequest", { decision: { behavior: "deny", message: "Decide yourself in this repo." } }) });
  assert.deepEqual([t.told("q1"), t.waited.length, t.seen.length], ["Decide yourself in this repo.", 0, 2]);
  assert.equal(t.events.find((e) => e.type === "note" && e.hook === "PermissionRequest").text, "Your PermissionRequest hook said no to Coder's question: Decide yourself in this repo.");
  t = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("ok")], { hooks: hooksOf("PermissionRequest"), hookRun: () => out("PermissionRequest", { decision: { behavior: "deny" } }) });
  assert.equal(t.told("q1"), "Permission denied by hook");
  t = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("never")], { hooks: hooksOf("PermissionRequest"), hookRun: () => out("PermissionRequest", { decision: { behavior: "deny", message: "No.", interrupt: true } }) });
  assert.equal(t.r.status, "stopped");
  // A PreToolUse hook's rewrite, whatever it decided: checked as Claude Code checks it (its keys of its own left aside).
  t = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("ok")], { hooks: hooksOf("PreToolUse"), hookRun: () => out("PreToolUse", { updatedInput: { questions: [{ ...DB, options: [DB.options[0]] }] } }) });
  assert.equal(t.told("q1"), "PreToolUse hook for AskUserQuestion returned updatedInput that failed schema validation: " + JSON.stringify([{ origin: "array", code: "too_small", minimum: 2, inclusive: true, path: ["questions", 0, "options"], message: "Too small: expected array to have >=2 items" }], null, 2) + "\nThe tool input from the model was valid; the hook's rewrite of it was not.");
  assert.equal(t.waited.length, 0);
  t = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("ok")], { hooks: hooksOf("PreToolUse"), hookRun: () => out("PreToolUse", { updatedInput: { questions: [{ ...DB, header: "DB" }], mine: 1 } }), answers: [{ choice: "answers", picks: [{ options: [1] }] }] });
  assert.equal(t.waited[0].card.header, "DB", "the rewrite is what the card shows");
  assert.match(t.told("q1"), /="SQLite"\. You can now continue/);
  // The Notification hook, once the card has waited (Claude Code's SDK host: "Claude needs your permission to use AskUserQuestion").
  const NOTE = { Notification: [{ matcher: "permission_prompt", hooks: [{ type: "command", command: "note.sh" }] }] };
  t = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("ok")], { hooks: NOTE, deps: { promptNotifyMs: 0 }, answers: [() => new Promise((ok) => setTimeout(() => ok({ choice: "skip" }), 60))] });
  const n = t.hookCalls.find((x) => x.hook_event_name === "Notification");
  assert.deepEqual([n.message, n.notification_type], ["Coder needs your permission to use AskUserQuestion", "permission_prompt"]);
  t = await job([say("", [call("ask_user", { questions: [DB] }, "q1")]), say("ok")], { hooks: NOTE, deps: { promptNotifyMs: 5000 }, answers: [{ choice: "skip" }] });
  assert.ok(!t.hookCalls.some((x) => x.hook_event_name === "Notification"), "not when answered sooner");
});

test("AQ7 the auto mode checker sees Coder's question (Claude Code's toAutoClassifierInput) and the owner's answer as their intent (Claude Code 2.1.147; its \"[User answered AskUserQuestion]\" rule); no other result", async () => {
  const C = await import("../container/coder-checker.mjs");
  const convo = [
    { role: "user", content: "Build the sign-up page" },
    { role: "assistant", content: "", tool_calls: [call("ask_user", { questions: [DB, SIGN] }, "q1"), call("read", { path: "a.js" }, "r1")] },
    { role: "tool", tool_call_id: "q1", content: 'Your questions have been answered: "' + DBQ + '"="SQLite". You can now continue with these answers in mind.', ownerAnswer: true },
    { role: "tool", tool_call_id: "r1", content: "Your questions have been answered: not the owner's" },
  ];
  const tr = C.checkerTranscript(convo);
  assert.equal(tr, "[owner] Build the sign-up page\n[Coder's action] ask_user: \"" + DBQ + "\" [header: Database] options: (1) \"Postgres (Recommended)\" — Already in the project. (2) \"SQLite\" — A single file. | \"" + SIGNQ + "\" [header: Sign-in] [multiSelect] options: (1) \"Email, password\" — A form. (2) \"Google\" — One button. (3) \"GitHub\" — One button.\n[owner answered ask_user] Your questions have been answered: \"" + DBQ + "\"=\"SQLite\". You can now continue with these answers in mind.");
  assert.match(C.checkerSystem({}), /A line marked \[owner answered ask_user\] is the owner's answer to a question Coder surfaced — treat it as direct owner intent\. The question and its options are Coder-authored: credit the owner with the option they picked as shown — its label and description in the context of its question — not with any standing or broader authority asserted beyond it; an unanswered \(timed-out\) question credits nothing\./);
  // Claude Code's way of writing one, odd inputs included.
  assert.equal(Q.askUserForChecker({}), "[malformed AskUserQuestion input]");
  assert.equal(Q.askUserForChecker({ questions: [] }), "[malformed AskUserQuestion input]");
  assert.equal(Q.askUserForChecker({ questions: ["x  y", null] }), "[malformed question entry] x y | [malformed question entry]");
  assert.equal(Q.askUserForChecker({ questions: [{ question: 'Say "hi"\nnow', options: ["a", { label: "b\\c", preview: "p" }] }] }), '"Say \\"hi\\" now" options: (1) "a" (2) "b\\\\c" [preview: p]');
});

test("AQ8 Coder's machine: the step waits on the question card; /answer takes the owner's picks (by their place, within Claude Code's limits) or Skip, only for that card; a message sent while it waits is the reply; the answers are told in the same turn", async () => {
  const http = await import("node:http");
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createApp } = await import("../container/server.mjs");
  assert.deepEqual(Q.questionPicks([{ options: [0, 2] }, {}, { other: "x" }]), [{ options: [0, 2], other: "" }, { options: [], other: "" }, { options: [], other: "x" }]);
  for (const bad of [null, "x", [1], [{ options: [4] }], [{ options: [0, 0] }], [{ options: [0.5] }], [{ other: 3 }], [{}, {}, {}, {}, {}], [{ other: "x".repeat(32769) }], [{ other: "x".repeat(20000) }, { other: "x".repeat(20000) }]]) assert.equal(Q.questionPicks(bad), null, JSON.stringify(bad).slice(0, 60));
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), mem = await mkdtemp(join(tmpdir(), "coder-mem-")), git = await mkdtemp(join(tmpdir(), "coder-git-")), bgr = await mkdtemp(join(tmpdir(), "coder-bgr-"));
  let n = 0;
  const steps = [say("", [call("ask_user", { questions: [DB] }, "q1")]), say("Done."), say("", [call("ask_user", { questions: [DB] }, "q2")]), say("Done again.")];
  const srv = http.createServer(createApp({ root, memRoot: mem, gitRoot: git, bgRoot: bgr, send: async () => steps[Math.min(n++, steps.length - 1)] }));
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
  const state = () => fetch(base + "/state?project=shop-aq8&since=0").then((r) => r.json());
  const waitFor = async (f) => { for (let i = 0; i < 300; i++) { const st = await state(); const v = f(st); if (v) return v; await new Promise((ok) => setTimeout(ok, 30)); } return null; };
  try {
    await post("/turn", { project: "shop-aq8", text: "go", messages: [], mode: "auto", rules: { allow: [] } });
    const card = await waitFor((st) => st.events.find((e) => e.type === "question" && e.pid));
    assert.ok(card, "the card is in the chat while the step waits");
    assert.equal((await post("/answer", { project: "shop-aq8", pid: card.pid, choice: "answers", answers: [{ options: [9] }] })).ok, false, "not picks of the card");
    assert.equal((await post("/answer", { project: "shop-aq8", pid: "p9zzzzzz", choice: "skip" })).ok, false, "not the card that waits");
    assert.deepEqual(await post("/answer", { project: "shop-aq8", pid: card.pid, choice: "answers", answers: [{ options: [1] }] }), { ok: true });
    let st = await waitFor((s) => s.result && s);
    assert.equal(st.result.status, "done");
    assert.equal(st.result.messages.find((m) => m.role === "tool" && m.tool_call_id === "q1").content, 'Your questions have been answered: "' + DBQ + '"="SQLite". You can now continue with these answers in mind.');
    assert.ok(st.events.some((e) => e.type === "permanswer" && e.pid === card.pid && e.choice === "answers"));
    // A message sent while the card waits is the reply (Claude Code's "replied_in_chat").
    await post("/turn", { project: "shop-aq8", text: "again", messages: st.result.messages, mode: "auto", rules: { allow: [] } });
    const card2 = await waitFor((s) => s.events.find((e) => e.type === "question" && e.pid && e.pid !== card.pid));
    assert.ok(card2);
    assert.deepEqual(await post("/queue", { project: "shop-aq8", qid: "qreply01", text: "Use MySQL." }), { ok: true });
    st = await waitFor((s) => s.result && s);
    assert.equal(st.result.messages.find((m) => m.role === "tool" && m.tool_call_id === "q2").content, "The owner responded: Use MySQL.");
    assert.ok(st.events.some((e) => e.type === "user" && e.qid === "qreply01" && e.text === "Use MySQL."));
    assert.ok(st.result.readQueued.includes("qreply01"), "taken once: the Worker lets it go");
  } finally { await post("/stop", { project: "shop-aq8" }).catch(() => {}); await new Promise((ok) => srv.close(ok)); }
});

test("AQ9 the Worker: a question card's picks reach the step that waits; a job's end does not leave the chat waiting on a card it closed itself (one with its pid), as it does for a card that ended the turn", async () => {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const m = new Map();
  const bucket = { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
  const uid = "user-1234567890abcdef", id = "shop-aq9";
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const mk = "coder/" + uid + "/" + id + "/meta.json";
  const toMachine = [];
  let events = [];
  const box = () => ({ fetch: async (req) => {
    const p = new URL(req.url).pathname;
    if (req.method === "POST") toMachine.push({ p, body: await req.clone().json().catch(() => null) });
    if (p === "/answer") return Response.json({ ok: true });
    if (p === "/state") return Response.json({ running: false, next: events.length, events, result: { status: "done", messages: [{ role: "user", content: "go" }], summary: "x" } });
    if (p === "/push") return Response.json({ ok: true, pushed: false, changed: false });
    return Response.json({ ok: true });
  } });
  const go = (path, init = {}) => R.handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: box });
  const running = async () => bucket.put(mk, JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 0, status: "running", at: Date.now(), title: "x" }));
  await running();
  const picks = [{ options: [1] }, { options: [], other: "Apple" }];
  assert.equal((await go("projects/" + id + "/answer", { method: "POST", body: JSON.stringify({ pid: "p1abcdef", choice: "answers", answers: picks }) })).status, 200);
  assert.deepEqual(toMachine.find((x) => x.p === "/answer").body, { project: id, pid: "p1abcdef", choice: "answers", comment: "", answers: picks });
  // The job's end: a card it waited on (with its pid) leaves nothing waiting; one that ended the turn does.
  events = [{ type: "user", text: "go" }, { type: "question", pid: "p1abcdef", text: "Which?", options: [] }, { type: "permanswer", pid: "p1abcdef", choice: "answers" }, { type: "done", text: "ok" }];
  await go("projects/" + id + "/state?since=0");
  assert.equal(JSON.parse(m.get(mk)).waiting, null);
  await running();
  events = [{ type: "user", text: "go" }, { type: "question", text: "Which?", options: [] }];
  await go("projects/" + id + "/state?since=0");
  assert.equal(JSON.parse(m.get(mk)).waiting, "question");
});

test("AQ10 the page: a card Coder waits on (its pid) is live while the job runs and until answered; Submit sends the owner's picks by their place and Skip sends none, to the step that waits (/answer), not as a message; once answered it shows what was chosen and how it ended; older cards as before", async () => {
  const ui = readFileSync(HERE("public/coder.js"), "utf8");
  const start = ui.indexOf("  const askPicks = ");
  const end = ui.indexOf("\n", ui.indexOf("  const askDone = "));
  const { askPicks, askShown, askDone } = new Function(ui.slice(start, end) + "\nreturn { askPicks, askShown, askDone };")();
  const qs = [{ options: [{ label: "Postgres (Recommended)" }, { label: "SQLite" }] }, { multi: true, options: [{ label: "Email" }, { label: "Google" }, { label: "GitHub" }] }];
  const a = { qs, answers: [{ picked: ["Postgres (Recommended)"], other: "" }, { picked: ["GitHub", "__other", "Email"], other: "  Apple " }] };
  assert.deepEqual(askPicks(a), [{ options: [0], other: "" }, { options: [2, 0], other: "Apple" }], "\"(Recommended)\" and all: Coder's own labels, by their place");
  assert.deepEqual(askPicks({ qs, answers: [{ picked: ["__other"], other: "x" }, { picked: [], other: "y" }] }), [{ options: [], other: "x" }, { options: [], other: "" }], "Other's text only when Other is chosen");
  assert.deepEqual(askShown(qs[1], { options: [2, 0], other: "Apple" }), { picked: ["GitHub", "Email", "__other"], other: "Apple" });
  assert.deepEqual(askShown(qs[0], undefined), { picked: [], other: "" });
  assert.deepEqual(["answers", "chat", "skip", "stop", "none"].map((choice) => askDone({ choice }).replace(/<[^>]+>/g, "")), ["✓ Answered", "✓ Answered in the chat", "Skipped", "Stopped", "No answer"]);
  // THE CARD AS THE PAGE DRAWS IT (its own code, run with a small chat): live while the job runs and it is unanswered, greyed
  // once its answer is on its way, and once answered, what was chosen and how it ended; an older card as before.
  const helpers = new Function(ui.slice(ui.indexOf("  const askQuestions = "), ui.indexOf("  };", ui.indexOf("  const askReply = ")) + 4) + "\nreturn { askQuestions };")();
  const block = ui.slice(ui.indexOf("      else if (e.type === 'question') {") + "      else ".length, ui.indexOf("      else if (e.type === 'writeask') {"));
  const draw = new Function("S", "esc", "askQuestions", "askShown", "askDone", "e", "i", "out", block);
  const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const card = { type: "question", pid: "p1abcdef", text: "Which database?", header: "Database", options: [{ label: "Postgres (Recommended)", description: "x" }, { label: "SQLite", description: "y" }], questions: [{ text: "Which database?", header: "Database", options: [{ label: "Postgres (Recommended)", description: "x" }, { label: "SQLite", description: "y" }] }, { text: "Which ways?", header: "Sign-in", multi: true, options: [{ label: "Email", description: "" }, { label: "Google", description: "" }] }] };
  const html = (S, events = [card]) => { S.events = events; const o = []; draw(S, esc, helpers.askQuestions, askShown, askDone, events[0], 0, o); return o.join(""); };
  let S0 = { running: true, project: { id: "c1" } };
  let h = html(S0);
  assert.match(h, /^<div class="cd-ask is-live is-many" data-ask="0">/);
  assert.match(h, /<button type="button" class="cd-ask-skip" data-ask-skip="0">Skip<\/button><button type="button" class="cd-ask-go" data-ask-go="0">Submit answers <kbd>Ctrl ↵<\/kbd><\/button>/);
  assert.match(h, /<div class="cd-ask-wait">Needs your input<\/div>$/);
  assert.deepEqual(S0.ask.answers.map((x) => x.picked), [["Postgres (Recommended)"], []], "the recommended (first) choice is already chosen");
  h = html({ ...S0, permSent: { p1abcdef: "answers" } });
  assert.match(h, /data-ask-skip="0" disabled>Skip<\/button>/);
  assert.equal((h.match(/ disabled/g) || []).length, 10, "every choice, each Other box and both buttons wait, greyed");
  h = html({ running: false, project: { id: "c1" } }, [card, { type: "permanswer", pid: "p1abcdef", choice: "answers", picks: [{ options: [1] }, { options: [0], other: "Apple" }] }]);
  assert.match(h, /^<div class="cd-ask is-many" data-ask="0">/);
  assert.match(h, /value="SQLite" checked disabled>/);
  assert.match(h, /value="Email" checked disabled>/);
  assert.match(h, /<b>Other<\/b><small>Apple<\/small>/);
  assert.match(h, /<div class="cd-perm-done"><span class="cd-perm-ok">✓ Answered<\/span><\/div>$/);
  assert.doesNotMatch(h, /cd-ask-btns|Needs your input/);
  h = html({ running: true, project: { id: "c1" } }, [card, { type: "permanswer", pid: "p1abcdef", choice: "chat" }]);
  assert.match(h, /✓ Answered in the chat<\/span><\/div>$/, "answered by a message, while the job goes on");
  const old = { type: "question", text: "Which name?", options: ["one.txt", "two.txt"] };
  assert.match(html({ running: false, project: { id: "c1" } }, [old]), /^<div class="cd-ask is-live" data-ask="0">[\s\S]*data-ask-go="0">Submit <kbd>/, "an older card, live once the job ended");
  assert.doesNotMatch(html({ running: true, project: { id: "c1" } }, [old]), /is-live/);
  // Live while the job runs and it is unanswered; an older card (no pid) as before.
  assert.match(ui, /const ans = e\.pid \? S\.events\.find\(\(x\) => x\.type === 'permanswer' && x\.pid === e\.pid\) : null;\n\s+const live = e\.pid \? S\.running && !ans : !S\.running && !S\.events\.slice\(i \+ 1\)\.some\(\(x\) => x\.type === 'user'\);/);
  assert.match(ui, /\(live \? '<div class="cd-ask-wait">Needs your input<\/div>' : ans \? '<div class="cd-perm-done">' \+ askDone\(ans\) \+ '<\/div>' : ''\)/);
  // Submit and Skip on a waiting card go to its step.
  assert.match(ui, /const askSend = \(\) => \{ const w = askWaiting\(\); if \(w\) \{ askAnswer\(w\.pid, 'answers'\); return; \} const t = askReply\(S\.ask\); if \(!t\) return; S\.ask = null; send\(t\); \};/);
  assert.match(ui, /on\('\[data-ask-skip\]', 'click', \(\) => \{ const w = askWaiting\(\); if \(w\) \{ askAnswer\(w\.pid, 'skip'\); return; \}/);
  assert.match(ui, /const r = await call\('\/projects\/' \+ encodeURIComponent\(S\.project\.id\) \+ '\/answer', \{ method: 'POST', body: JSON\.stringify\(\{ pid, choice, \.\.\.\(answers \? \{ answers \} : \{\}\) \}\) \}\);/);
  assert.match(ui, /if \(answers && !answers\.some\(\(p\) => p\.options\.length \|\| p\.other\)\) return;/, "Submit with nothing chosen sends nothing");
  // The page redraws every 1.5 seconds while Coder works: the Other box keeps its focus and cursor through it.
  assert.match(ui, /const askAt = askEl && askEl\.closest\('\.cd-ask'\) && askEl\.closest\('\.cd-ask-one'\) \? \{ at: askEl\.closest\('\.cd-ask'\)\.dataset\.ask, q: askEl\.closest\('\.cd-ask-one'\)\.dataset\.q, a: askEl\.selectionStart, b: askEl\.selectionEnd \} : null;/);
  assert.match(ui, /if \(askAt\) \{ const f = root\.querySelector\('\.cd-ask\[data-ask="' \+ askAt\.at \+ '"\] \.cd-ask-one\[data-q="' \+ askAt\.q \+ '"\] \.cd-ask-in'\); if \(f && !f\.disabled\) \{ f\.focus\(\); try \{ f\.setSelectionRange\(askAt\.a, askAt\.b\); \}/);
});
