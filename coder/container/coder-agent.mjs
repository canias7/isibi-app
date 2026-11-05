// CODER'S BRAIN (2026-11-05). The owner: "same style as the sites agent, but
// with a different container" and "like Claude Code": a developer at a
// terminal. Coder has ONE tool (the owner removed `ask` and `done`, 2026-11-05):
//
//   bash  run one command in the project's folder and read what it printed
//
// It finishes the way a person does: it stops running commands and answers in
// words. That answer is the summary, and the work then goes to GitHub.
//
// Everything else (reading, writing, editing, installing, testing, running) is
// done with ordinary Linux commands. Nothing here touches a file or the
// network itself: `deps.exec` runs a command (in the container), `deps.send`
// asks the model. Both are handed in, so the loop is tested with neither.
//
// The conversation is kept in the OpenAI chat shape (`messages`, with
// `tool_calls` and `tool` answers), which Grok speaks natively; the next
// message continues from the same messages.
import { commandProblem, capOutput, readTimeout, scrub } from "./coder-checks.mjs";

export const CODER_MAX_ROUNDS = 60;
export const CODER_MAX_MS = 45 * 60 * 1000;

export const CODER_TOOLS = Object.freeze([
  { type: "function", function: {
    name: "bash",
    description: "Run ONE shell command (bash) in the project's folder and get back what it printed and its exit code. Use it for everything: ls, cat, grep, find, writing files (cat > file <<'EOF' … EOF), editing (sed, or rewrite the file), npm/pip installs, tests, git. Commands run with no secrets in their environment. A command that could run forever (a dev server) must be started in the background (… > server.log 2>&1 &) and checked with curl. `timeout_s`: how long it may take (default 120, at most 600).",
    parameters: { type: "object", properties: { command: { type: "string" }, timeout_s: { type: "integer" } }, required: ["command"] },
  } },
]);

export const CODER_SYSTEM = `You are Coder, a software developer working for the owner in your own Linux machine.
The project lives in the current folder. You work like a developer at a terminal: look first (ls, cat, grep), then change files, then run and test what you changed.

HOW YOU WORK
- Use the bash tool for everything. One command per call; join small related commands with && or ;.
- Write a whole new file with a heredoc: cat > path <<'EOF' … EOF. For a small change, edit only those lines (sed) or rewrite the file, keeping every other line as it was.
- Read a file before you change it. Never guess what a file holds.
- Check your work: run the tests, build it, or start it and curl it. Fix what fails.
- Long-running servers go in the background (… > app.log 2>&1 &), then check them with curl.
- Keep command output small (head, tail, grep): every round costs the owner time.
- Stay inside the project folder. Never try to read secrets or the machine's environment.

TALKING TO THE OWNER
- Say in one short line what you are about to do, then do it.
- When a choice is open, make the sensible one yourself and say which at the end. Only when you truly cannot go on without the owner, say plainly what you need.
- To finish, stop calling bash and answer in plain words: what you made or changed, and how to use it. That answer ends your turn. Never claim something you did not run.
- If something cannot be done, say so plainly, with why.`;

/** The model's tool calls, read safely: `[{ id, name, args }]`; args `null` when they are not JSON. */
export function readCalls(msg) {
  const calls = Array.isArray(msg && msg.tool_calls) ? msg.tool_calls : [];
  return calls.map((c, i) => {
    const f = (c && c.function) || {};
    let args = null;
    try { args = typeof f.arguments === "string" ? JSON.parse(f.arguments || "{}") : (f.arguments && typeof f.arguments === "object" ? f.arguments : {}); } catch { args = null; }
    return { id: typeof c.id === "string" && c.id ? c.id : "call_" + i, name: String(f.name || ""), args };
  });
}

/**
 * ONE TURN OF CODER. `deps`: `send(req) → { message, usage }` (an OpenAI-shaped
 * assistant message), `exec({ command, timeoutS }) → { code, output, timedOut }`,
 * optional `stopped()`, `emit(event)`, `now()`. `messages`: the conversation so
 * far (without the system line); `text`: the owner's new message (or their answer).
 *
 * Answers `{ status, messages, summary, rounds, usage }`, `status` one of
 * `done`, `stopped`, `rounds`, `time`, `send`, `no-tool`. It never throws.
 */
export async function runCoder(deps, { messages = [], text = "", model = "", effort = "", maxRounds = CODER_MAX_ROUNDS, maxMs = CODER_MAX_MS } = {}) {
  const now = typeof deps.now === "function" ? deps.now : () => Date.now();
  const emit = (e) => { try { if (typeof deps.emit === "function") deps.emit({ at: now(), ...e }); } catch { /* the record never costs the run */ } };
  const stopped = async () => { try { return typeof deps.stopped === "function" && (await deps.stopped()) === true; } catch { return false; } };
  const convo = Array.isArray(messages) ? messages.slice() : [];
  if (typeof text === "string" && text.trim()) { convo.push({ role: "user", content: text.trim() }); emit({ type: "user", text: text.trim() }); }
  const usage = [];
  const started = now();
  let rounds = 0;
  const end = (status, extra = {}) => ({ status, messages: convo, rounds, usage, summary: "", ...extra });

  while (true) {
    if (await stopped()) { emit({ type: "stopped" }); return end("stopped"); }
    if (rounds >= maxRounds) { emit({ type: "error", text: "Coder reached its limit of " + maxRounds + " steps." }); return end("rounds"); }
    if (now() - started > maxMs) { emit({ type: "error", text: "Coder ran out of time." }); return end("time"); }
    rounds++;
    let answer;
    try { answer = await deps.send({ model, ...(effort ? { effort } : {}), messages: [{ role: "system", content: CODER_SYSTEM }, ...convo], tools: CODER_TOOLS, tool_choice: "auto" }); }
    catch (e) { emit({ type: "error", text: "The AI could not be reached." }); return end("send", { why: String((e && e.message) || e).slice(0, 200) }); }
    if (answer && answer.usage) usage.push(answer.usage);
    const msg = answer && answer.message ? answer.message : null;
    if (!msg) { emit({ type: "error", text: "The AI gave no answer." }); return end("no-tool"); }
    const said = typeof msg.content === "string" ? msg.content.trim() : "";
    const calls = readCalls(msg);
    convo.push({ role: "assistant", content: msg.content == null ? "" : msg.content, ...(Array.isArray(msg.tool_calls) && msg.tool_calls.length ? { tool_calls: msg.tool_calls } : {}) });
    // AN ANSWER IN WORDS WITH NO COMMAND finishes the turn: it is the summary
    // (or the answer to a question, or a greeting).
    if (!calls.length) { emit({ type: "done", text: scrub(said) }); return end("done", { summary: scrub(said).slice(0, 4000) }); }
    if (said) emit({ type: "text", text: scrub(said) });

    for (let i = 0; i < calls.length; i++) {
      const c = calls[i];
      const reply = (content) => convo.push({ role: "tool", tool_call_id: c.id, content: String(content) });
      if (c.args === null) { reply("error: the arguments were not valid JSON"); continue; }
      if (c.name === "bash") {
        const command = typeof c.args.command === "string" ? c.args.command : "";
        const why = commandProblem(command);
        emit({ type: "bash", id: c.id, command: scrub(command).slice(0, 2000) });
        if (why) { emit({ type: "result", id: c.id, code: -1, output: why }); reply(why); continue; }
        if (await stopped()) { reply("stopped by the owner"); emit({ type: "stopped" }); return end("stopped"); }
        let r;
        try { r = await deps.exec({ command, timeoutS: readTimeout(c.args.timeout_s) }); }
        catch (e) { r = { code: -1, output: "the command could not be run: " + String((e && e.message) || e).slice(0, 200) }; }
        const out = capOutput(String((r && r.output) || ""));
        const code = r && Number.isInteger(r.code) ? r.code : -1;
        emit({ type: "result", id: c.id, code, output: out, ...(r && r.timedOut ? { timedOut: true } : {}) });
        reply((r && r.timedOut ? "[stopped at the time limit]\n" : "") + "exit code " + code + "\n" + (out || "(no output)"));
      } else reply("error: no such tool: " + c.name.slice(0, 40) + " (the only tool is bash; to finish, answer in words)");
    }
  }
}
