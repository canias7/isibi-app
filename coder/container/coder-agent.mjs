// CODER'S BRAIN (2026-11-05). The owner: "same style as the sites agent, but
// with a different container" and "like Claude Code": a developer at a
// terminal. Its tools (the owner removed `ask` and `done`; then added Claude
// Code's file and web tools, 2026-11-05):
//
//   bash  run one command in the project's folder and read what it printed
//   read, edit, write, grep, glob, web_fetch  (coder-tools.mjs); web search is Grok's own (xAI)
//   todo  a checklist the owner sees;  pull_request  only when asked
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
import { fileURLToPath } from "node:url";
import { okHost, HEADER_RE, PREFIXES } from "./coder-secrets.mjs";

// THE TOOLS (owner, 2026-11-05: "you can add all of this"): besides bash, the
// file and web tools of Claude Code. They run through the same exec as bash
// (as `dev`, in the project), via container/coder-tools.mjs.
// WHAT A REVIEW LOOKS FOR (moved from the page's Review menu, owner 2026-11-06).
export const REVIEW_TEXT = {
  code: "REVIEW CHECKLIST: look for bugs, broken edge cases, missing tests and anything a careful reviewer would flag. Run the tests if there are any. Do NOT change any files: answer with a short list of findings, most serious first, each with the file and line and a one-line fix. If everything looks fine, say so.",
  security: "SECURITY REVIEW CHECKLIST: injection, unsafe input handling, secrets in code, auth or permission mistakes, unsafe dependencies, path traversal, XSS, SSRF. Do NOT change any files: answer with a short list of real risks, most serious first, each with the file and line, why it matters and a one-line fix. If you find nothing serious, say so.",
};
export const TOOLS_SCRIPT = fileURLToPath(new URL("./coder-tools.mjs", import.meta.url));
/** The most a Write may hold in one call (it travels as one command argument). */
export const WRITE_MAX = 1_000_000;
const fn = (name, description, properties, required) => ({ type: "function", function: { name, description, parameters: { type: "object", properties, required } } });
export const RUN_TOOLS = {
  read: { verb: "Read", label: (a) => a.path + (a.offset ? " from line " + a.offset : "") },
  write: { verb: "Wrote", label: (a) => a.path },
  edit: { verb: "Edited", label: (a) => a.path },
  grep: { verb: "Searched", label: (a) => JSON.stringify(a.pattern || "") + (a.path && a.path !== "." ? " in " + a.path : "") },
  glob: { verb: "Found", label: (a) => String(a.pattern || "") },
  lsp: { verb: "Looked up", label: (a) => String(a.action || "") + " " + String(a.path || "") + (a.line ? ":" + a.line + (a.column ? ":" + a.column : "") : "") },
  web_fetch: { verb: "Fetched", label: (a) => String(a.url || "") },
};

export const CODER_MAX_ROUNDS = 60;
export const CODER_MAX_MS = 45 * 60 * 1000;

export const CODER_TOOLS = Object.freeze([
  fn("read", "Read a file in the project, with line numbers (400 lines at a time; use offset for more). Use this instead of cat.", { path: { type: "string" }, offset: { type: "integer" }, limit: { type: "integer" } }, ["path"]),
  fn("edit", "Change a file by replacing an exact piece of text (old_string) with new text (new_string). old_string must match the file exactly (read it first) and appear once, unless replace_all is true. Use this instead of sed.", { path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" }, replace_all: { type: "boolean" } }, ["path", "old_string", "new_string"]),
  fn("write", "Write a whole file (new, or replacing everything in it). At most about 90,000 characters per call; for a longer file write the start, then add the rest with edit.", { path: { type: "string" }, content: { type: "string" } }, ["path", "content"]),
  fn("grep", "Search the project's files for text or a regular expression (ripgrep). Gives file:line:text.", { pattern: { type: "string" }, path: { type: "string" }, glob: { type: "string" }, ignore_case: { type: "boolean" } }, ["pattern"]),
  fn("glob", "List the project's files whose path matches a pattern, e.g. src/**/*.js or **/*.md.", { pattern: { type: "string" }, path: { type: "string" } }, ["pattern"]),
  fn("lsp", "Ask a real language server (JavaScript/TypeScript, Python) about the code: definition (where a name is defined), references (everywhere it is used), hover (its type and docs), diagnostics (the file's errors and warnings). line and column count from 1, as read shows them; point them at the name.", { action: { type: "string", enum: ["definition", "references", "hover", "diagnostics"] }, path: { type: "string" }, line: { type: "integer" }, column: { type: "integer" } }, ["action", "path"]),
  fn("web_fetch", "Read a public web page (documentation, an API's reference) as plain text.", { url: { type: "string" } }, ["url"]),
  fn("monitor", "Read what a background job (from bash with run_in_background) has printed: the newest lines, and whether it is still running. wait_s (0-60) waits first, to let it get going.", { job: { type: "string" }, wait_s: { type: "integer" }, lines: { type: "integer" } }, ["job"]),
  fn("stop_job", "Stop a background job by its id. Every job is also stopped when your turn ends.", { job: { type: "string" } }, ["job"]),
  fn("request_secret", "Ask the owner for an API key for ONE host (e.g. api.stripe.com) when the work needs real calls to that API and no secret is saved for it. A secure card pops up for the owner; the key is saved for this repo and a proxy adds it to your HTTPS requests to that host, so you never see it. Your turn ends there; the next message says whether they saved it. Never ask for keys in the chat.", { host: { type: "string", description: "exact host, e.g. api.stripe.com" }, reason: { type: "string", description: "one sentence: what needs it" }, name: { type: "string", description: "a short label, e.g. Stripe test key" }, header: { type: "string", description: "the header the API reads (default Authorization)" }, prefix: { type: "string", enum: ["Bearer", "Token", "Key", "Basic", ""], description: "the word before the key (default Bearer)" } }, ["host", "reason"]),
  fn("propose_env", "Propose a change to this repo's environment; the owner approves or declines it on a card, and your turn ends there (their answer is the next message). kind setup_script: the WHOLE new setup script (it runs once per machine before you start; it cannot read the owner's variables or keys); use it to keep an install you needed (e.g. add `npm ci`), or to fix a setup script that failed. kind allow_host: one exact host to add to the repo's network list, when a request was blocked by it. Never change these any other way.", { kind: { type: "string", enum: ["setup_script", "allow_host"] }, script: { type: "string", description: "setup_script: the whole new script" }, host: { type: "string", description: "allow_host: e.g. api.example.com" }, reason: { type: "string", description: "one sentence: why" } }, ["kind", "reason"]),
  fn("review", "Review the changes on this chat's branch (against the base branch, plus anything not saved yet): returns the diff and the checklist to follow. kind code: bugs, edge cases, missing tests. kind security: injection, secrets, auth, XSS, SSRF... Use it when the owner asks for a review or a security review; then answer with findings only and change nothing.", { kind: { type: "string", enum: ["code", "security"] } }, ["kind"]),
  fn("undo_last_job", "Undo the last job that changed files in this chat: its commit is reverted on the branch and pushed when your turn ends. Use it only when the owner asks to undo or revert what you did last; do not make other changes in the same turn. Your turn ends here.", {}, []),
  fn("ask_user", "Ask the owner ONE multiple-choice question when you truly cannot choose for them (e.g. which of two designs, whether to delete something). Give 2 to 4 short options. Your turn ends there; their pick comes back as the next message. Do not use it for things you can decide yourself.", { question: { type: "string" }, options: { type: "array", items: { type: "string" } } }, ["question", "options"]),
  fn("todo", "Your checklist for a job with several steps: the whole list each time, each item with a status (pending, in_progress, done). The owner sees it. Skip it for small jobs.", { items: { type: "array", items: { type: "object", properties: { text: { type: "string" }, status: { type: "string", enum: ["pending", "in_progress", "done"] } }, required: ["text", "status"] } } }, ["items"]),
  { type: "function", function: {
    name: "bash",
    description: "Run ONE shell command (bash) in the project's folder and get back what it printed and its exit code: installs, tests, builds, scripts, git status/log/diff. Commands run with no secrets in their environment. A command that runs on (a dev server, a watcher) goes in the background with run_in_background: true (not with &): you get a job id to read with monitor and end with stop_job. `timeout_s`: how long it may take (default 120, at most 600).",
    parameters: { type: "object", properties: { command: { type: "string" }, timeout_s: { type: "integer" }, run_in_background: { type: "boolean" } }, required: ["command"] },
  } },
  // OWNER, 2026-11-05 ("b"): the owner asks for a pull request in the chat,
  // and Coder makes it. Coder only writes the title and description; our
  // server pushes and opens it after the turn (Coder never holds the GitHub key).
  { type: "function", function: {
    name: "pull_request",
    description: "Ask for a pull request of this chat's branch. Use it ONLY when the owner asks for a pull request (\"make a PR\", \"open a pull request\"). Write a clear title and a description: what changed, why, how to test it. It opens after your turn ends, once your changes are pushed; if one is already open, it is updated with your new work.",
    parameters: { type: "object", properties: { title: { type: "string" }, body: { type: "string" } }, required: ["title", "body"] },
  } },
]);

export const CODER_SYSTEM = `You are Coder, a software developer working for the owner in your own Linux machine.
The project lives in the current folder. You work like a developer at a terminal: look first (ls, cat, grep), then change files, then run and test what you changed.

HOW YOU WORK
- Your tools: read, edit, write (files), grep, glob (finding things), bash (running anything: installs, tests, servers, git status), web search (built into you: search whenever you need current facts or docs) and web_fetch (reading a page), todo (your checklist on bigger jobs), pull_request (only when asked).
- Use read, edit, write, grep and glob for files (write takes up to about 1 MB at once), not cat, sed, heredocs or find: they are safer and clearer to the owner. Use bash for running things.
- To change a file: read it, then edit the exact lines. Use write for a new file or a full rewrite.
- Read a file before you change it. Never guess what a file holds.
- Check your work: run the tests, build it, or start it and curl it. Fix what fails.
- Long-running servers and watchers: bash with run_in_background: true, then monitor to read their output (and curl to check a server), stop_job when done. Never use & yourself. A command still running at its time limit keeps running in the background. Everything in the background is stopped when your turn ends.
- Keep command output small (head, tail, grep): every round costs the owner time.
- Stay inside the project folder. Never try to read secrets or the machine's environment.
- Git history is read-only for you: look with git log, git diff, git status, but never commit, push or change git settings. When you finish, your changes are committed and saved to this chat's branch for you.
- Pull requests: only when the owner asks for one, call the pull_request tool (look at git diff first). Its description says what changed, why, how you checked it (the commands and their results), and any risks or things the reviewer should look at.
- Code comments: add them only where the code is not obvious (a tricky line, a workaround, a "why"), or when the owner asks. Never comment what the code plainly says.

HOW YOU TALK (owner, 2026-11-05)
- Lead with the answer or the result in the first sentence. No preamble, no "Sure!", no recap of what the owner just said.
- Default (owner, 2026-11-05: explanatory): after the result, explain in plain words what you changed and WHY you did it that way, and point out anything worth knowing (an "Insight: …" line for a non-obvious choice, a trade-off, or how the pieces fit). Say what you checked and anything that did not work. Name files and commands exactly. Explain, but don't pad: no repeating yourself, no filler.
- Show evidence, not just claims: "npm test: 12 passing", "curl / answered 200", the error line. Never say "all tests pass" without the command and its result. Never claim something you did not run. If something failed, say so first.
- Match the owner's style requests, in their own words:
  • "explain more…" → go deeper, step by step, in plain language.
  • "teach me…" → walk them through it; leave small parts for them to try and say exactly what to do.
  • "just do it" / "keep it short" / "less explaining" → the result in one or two lines, no explanation.
  • any other style they describe → follow it.
- A style request lasts for the rest of the chat. If they say "always" or "from now on", also save it in your memory file for this repo as ONE line starting with "Style: " (e.g. "Style: keep answers short"), replacing any older Style: line, so new chats follow it too. To drop it, delete that line.
- THE OWNER'S STYLE, when it is given to you below, overrides the default above: follow it in every answer, as if they just asked for it.
- While working, a short line before a group of steps says what you are doing; no running commentary on every command.
- API KEYS: when the work needs real calls to an API that needs a key (Stripe, OpenAI, ...) and no NETWORK SECRET is saved for its host, call request_secret for that exact host RIGHT AWAY (e.g. api.stripe.com, prefix Bearer). Do not tell the owner to export a variable, add it to the Environment panel, or set it up some other way: the card IS how they give you a key. Never ask the owner to paste a key into the chat; if they do, tell them to roll it. With a secret saved, call the host with no key in the command (the proxy adds it); only commands that honour HTTPS_PROXY get it (curl, Python, git; Node 22 fetch with NODE_USE_ENV_PROXY).
- THE REPO'S ENVIRONMENT (setup script, network list) is changed only with propose_env, which the owner approves on a card: (a) when you had to install something the project needs every time (npm ci, pip install -r requirements.txt...), finish the task, then propose the whole setup script with that line added; (b) when THE SETUP SCRIPT FAILED, say which command failed and its exit code, then propose a fixed script; (c) when a request was "Blocked by this repo's network list" (curl shows it as "CONNECT tunnel failed, response 403"), propose allow_host for that exact host. Never tell the owner to edit settings themselves instead.
- When a choice is open, make the sensible one yourself and say which. Only when you truly cannot go on without the owner, use ask_user with 2 to 4 options.
- To finish, stop calling tools and answer in words. That answer ends your turn. If something cannot be done, say so plainly, with why.
- If you are told the owner is coming back after a break, start your answer with a one-line recap of where this chat stands (under 400 characters), then answer.`;

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
export async function runCoder(deps, { messages = [], text = "", shown, images = [], model = "", effort = "", context = "", github = false, base = "", setupScript = "", maxRounds = CODER_MAX_ROUNDS, maxMs = CODER_MAX_MS } = {}) {
  const now = typeof deps.now === "function" ? deps.now : () => Date.now();
  const emit = (e) => { try { if (typeof deps.emit === "function") deps.emit({ at: now(), ...e }); } catch { /* the record never costs the run */ } };
  const stopped = async () => { try { return typeof deps.stopped === "function" && (await deps.stopped()) === true; } catch { return false; } };
  const convo = Array.isArray(messages) ? messages.slice() : [];
  // PICTURES (owner, 2026-11-05): sent to Grok with this message only; the saved
  // history keeps a note in their place (so it stays small).
  const pics = (Array.isArray(images) ? images : []).filter((x) => x && /^image\/(png|jpeg|webp|gif)$/.test(x.type) && typeof x.data === "string").slice(0, 4);
  if (typeof text === "string" && text.trim()) {
    convo.push({ role: "user", content: text.trim(), ...(pics.length ? { images: pics.map((x) => "data:" + x.type + ";base64," + x.data) } : {}) });
    // The chat shows what the owner typed (`shown`); Coder also gets the notes added to it.
    emit({ type: "user", text: (typeof shown === "string" && shown.trim() ? shown : text).trim(), ...(pics.length ? { images: pics.length } : {}) });
  }
  const usage = [];
  const started = now();
  let rounds = 0;
  let prRequest = null, undoRequest = false, lastSaid = "";
  // INSTALLS THE SETUP SCRIPT DOES NOT DO YET (owner, 2026-11-06, "2"): Coder is
  // reminded once, before it finishes, to offer them for the setup script.
  const installs = new Set(); let nudged = false;
  const INSTALL_RE = /(?:^|[;&|(]\s*|\s)((?:npm (?:ci|install|i)|pnpm (?:install|i)|yarn(?: install)?|pip3? install -r [^\s;&|]+|pip3? install -e \.|poetry install|bundle install|go mod download|cargo fetch)(?=$|[\s;&|)]))/g;
  // BACKGROUND JOBS this turn (bash with run_in_background): id → { pid, log, command }.
  const jobs = new Map();
  const end = (status, extra = {}) => ({ status, messages: convo.map((m) => (m.images ? { role: m.role, content: m.content + "\n[" + m.images.length + " picture" + (m.images.length > 1 ? "s" : "") + " attached]" } : m)), rounds, usage, summary: "", ...(prRequest ? { prRequest } : {}), ...(undoRequest ? { undoRequest } : {}), ...extra });

  while (true) {
    if (await stopped()) { emit({ type: "stopped" }); return end("stopped"); }
    if (rounds >= maxRounds) { emit({ type: "error", text: "Coder reached its limit of " + maxRounds + " steps." }); return end("rounds"); }
    if (now() - started > maxMs) { emit({ type: "error", text: "Coder ran out of time." }); return end("time"); }
    rounds++;
    let answer;
    try { answer = await deps.send({ model, ...(effort ? { effort } : {}), messages: [{ role: "system", content: CODER_SYSTEM + (context ? "\n\n" + context : "") }, ...convo], tools: CODER_TOOLS, tool_choice: "auto" }); }
    catch (e) { emit({ type: "error", text: "The AI could not be reached: " + scrub(String((e && e.message) || e)).slice(0, 220) }); return end("send", { why: String((e && e.message) || e).slice(0, 200) }); }
    if (answer && answer.usage) usage.push(answer.usage);
    // PICTURES STAY FOR THE WHOLE JOB (live test, 2026-11-05: sending them only
    // in the first round made Grok invent a picture when it answered after a few
    // steps). They leave only the SAVED history (see end()).
    // GROK'S OWN WEB SEARCHES (done on xAI's side) are shown like the other steps.
    for (const sr of Array.isArray(answer && answer.searches) ? answer.searches : []) {
      const id = "ws" + Math.random().toString(36).slice(2, 9);
      emit({ type: "bash", id, tool: "web_search", verb: "Searched the web for", command: scrub(JSON.stringify(sr.query || "")).slice(0, 300) });
      emit({ type: "result", id, code: 0, output: (sr.sources || []).join("\n") || "(searched)" });
    }
    const msg = answer && answer.message ? answer.message : null;
    if (!msg) { emit({ type: "error", text: "The AI gave no answer." }); return end("no-tool"); }
    const said = typeof msg.content === "string" ? msg.content.trim() : "";
    const calls = readCalls(msg);
    convo.push({ role: "assistant", content: msg.content == null ? "" : msg.content, ...(Array.isArray(msg.tool_calls) && msg.tool_calls.length ? { tool_calls: msg.tool_calls } : {}) });
    // AN ANSWER IN WORDS WITH NO COMMAND finishes the turn: it is the summary
    // (or the answer to a question, or a greeting).
    const missing = [...installs].filter((x) => !String(setupScript).includes(x));
    if (!calls.length && missing.length && !nudged && !github && !undoRequest) {
      nudged = true;
      if (said) { emit({ type: "text", text: scrub(said) }); lastSaid = scrub(said).slice(0, 4000); }
      convo.push({ role: "user", content: "(Note from Coder's app, not the owner: this job ran " + missing.map((x) => "`" + x + "`").join(", ") + ", which the repo's setup script does not do. If every new chat will need it, propose the whole setup script with it added, using propose_env (kind setup_script). If not, just say you are done.)" });
      continue;
    }
    if (!calls.length) { emit({ type: "done", text: scrub(said) }); return end("done", { summary: scrub(said).slice(0, 4000) }); }
    if (said) { emit({ type: "text", text: scrub(said) }); lastSaid = scrub(said).slice(0, 4000); }

    for (const c of calls) if (c.name === "bash" && c.args && typeof c.args.command === "string") for (const m of c.args.command.matchAll(INSTALL_RE)) installs.add(m[1]);
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
        // THE TIME LIMIT IS CHECKED BEFORE EACH COMMAND, not only between rounds (the audit).
        if (now() - started > maxMs) { reply("not run: Coder ran out of time"); emit({ type: "error", text: "Coder ran out of time." }); return end("time"); }
        let r;
        const inBg = c.args.run_in_background === true;
        try { r = await deps.exec({ command, timeoutS: inBg ? 1 : readTimeout(c.args.timeout_s) }); }
        catch (e) { r = { code: -1, output: "the command could not be run: " + String((e && e.message) || e).slice(0, 200) }; }
        const out = capOutput(String((r && r.output) || ""));
        const code = r && Number.isInteger(r.code) ? r.code : -1;
        const bg = !!(r && r.background);
        let job = "";
        if (bg && r.pid && r.log) { job = "job" + (jobs.size + 1); jobs.set(job, { pid: r.pid, log: r.log, command }); }
        emit({ type: "result", id: c.id, code, output: out, ...(bg ? { background: true, ...(job ? { job } : {}) } : r && r.timedOut ? { timedOut: true } : {}) });
        reply(bg ? (job ? "[running in the background as " + job + ": read it with monitor, end it with stop_job]\n" : "") + out : (r && r.timedOut ? "[stopped at the time limit]\n" : "") + "exit code " + code + "\n" + (out || "(no output)"));
      } else if (c.name === "monitor" || c.name === "stop_job") {
        // A BACKGROUND JOB: read its log, or stop it (as `dev`, like any command).
        const j = jobs.get(String(c.args.job || ""));
        emit({ type: "bash", id: c.id, tool: c.name, verb: c.name === "monitor" ? "Checked" : "Stopped", command: String(c.args.job || "") + (j ? " (" + scrub(j.command.split("\n")[0]).slice(0, 80) + ")" : "") });
        if (!j) { const m = "error: no background job " + String(c.args.job || "").slice(0, 20) + " (jobs: " + ([...jobs.keys()].join(", ") || "none") + ")"; emit({ type: "result", id: c.id, code: 1, output: m }); reply(m); continue; }
        const wait = Math.min(60, Math.max(0, Number(c.args.wait_s) || 0));
        const lines = Math.min(200, Math.max(5, Number(c.args.lines) || 40));
        const cmd = c.name === "monitor"
          ? (wait ? "sleep " + wait + "; " : "") + "tail -n " + lines + " " + j.log + "; if kill -0 " + j.pid + " 2>/dev/null; then echo '[still running]'; else echo '[not running]'; fi"
          : "kill -TERM -- -" + j.pid + " 2>/dev/null; sleep 1; kill -KILL -- -" + j.pid + " 2>/dev/null; echo '[stopped " + String(c.args.job) + "]'";
        let r;
        try { r = await deps.exec({ command: cmd, timeoutS: wait + 15, tool: true }); }
        catch (e) { r = { code: -1, output: String((e && e.message) || e).slice(0, 200) }; }
        const out = capOutput(String((r && r.output) || ""));
        emit({ type: "result", id: c.id, code: r && Number.isInteger(r.code) ? r.code : -1, output: out });
        reply(out || "(nothing yet)");
      } else if (c.name === "request_secret") {
        // A KEY FOR ONE HOST (owner, 2026-11-06, like Claude Code): a secure card for the owner; the turn ends here.
        if (github) { reply("error: keys cannot be asked for in a job started from GitHub (it is public and gets no saved keys); say in your answer that the owner can give one in Coder's chat"); continue; }
        const host = okHost(c.args.host);
        const header = String(c.args.header || "Authorization").trim();
        const prefix = c.args.prefix === undefined ? "Bearer" : String(c.args.prefix);
        if (!host) { reply("error: give an exact public host name like api.stripe.com (no https://, path, IP address or wildcard)"); continue; }
        if (!HEADER_RE.test(header) || !PREFIXES.includes(prefix)) { reply("error: header is Authorization or a name ending in Key/Token/Auth/Secret (e.g. X-Api-Key); prefix is Bearer, Token, Key, Basic or empty"); continue; }
        reply("asked the owner for a key for " + host + "; the next message says whether it was saved");
        for (const rest of calls.slice(i + 1)) convo.push({ role: "tool", tool_call_id: rest.id, content: "not run: you asked the owner for a key first" });
        emit({ type: "secret", host, reason: scrub(String(c.args.reason || "")).trim().slice(0, 300), name: scrub(String(c.args.name || "")).trim().slice(0, 60), header, prefix });
        return end("done", { summary: lastSaid || "asked for a key for " + host });
      } else if (c.name === "review") {
        // A REVIEW, CALLED BY CODER ITSELF (owner, 2026-11-06: "tools called by the model, not front-end stuff").
        const kind = c.args.kind === "security" ? "security" : "code";
        const b = /^[\w./-]{1,200}$/.test(base) && !base.startsWith("-") ? base : "main";
        emit({ type: "bash", id: c.id, tool: "review", verb: kind === "security" ? "Security review" : "Reviewed", command: "git diff " + b + "...HEAD" });
        let r;
        try { r = await deps.exec({ command: "git --no-pager diff --stat 'origin/" + b + "...HEAD' 2>/dev/null || git --no-pager diff --stat '" + b + "...HEAD'; echo '--- committed changes ---'; git --no-pager diff 'origin/" + b + "...HEAD' 2>/dev/null || git --no-pager diff '" + b + "...HEAD'; echo '--- not saved yet ---'; git --no-pager diff; git status --short", timeoutS: 60, tool: true }); }
        catch (e) { r = { code: -1, output: String((e && e.message) || e).slice(0, 200) }; }
        const diff = capOutput(String((r && r.output) || ""));
        emit({ type: "result", id: c.id, code: r && Number.isInteger(r.code) ? r.code : -1, output: diff.slice(0, 4000) });
        reply(REVIEW_TEXT[kind] + "\n\n" + (diff.trim() || "(no changes on this branch yet)"));
      } else if (c.name === "undo_last_job") {
        // UNDO, CALLED BY CODER ITSELF (owner, 2026-11-06): done by Coder's app when the turn ends.
        if (github) { reply("error: undo is not available in a job started from GitHub"); continue; }
        undoRequest = true;
        reply("the last job will be undone when this turn ends; say so in one line and stop");
        for (const rest of calls.slice(i + 1)) convo.push({ role: "tool", tool_call_id: rest.id, content: "not run: you asked to undo the last job" });
        emit({ type: "bash", id: c.id, tool: "undo", verb: "Undo", command: "the last job" });
        emit({ type: "result", id: c.id, code: 0, output: "" });
        convo.push({ role: "assistant", content: "Undoing the last job." });
        emit({ type: "text", text: "Undoing the last job." });
        return end("done", { summary: "undo the last job" });
      } else if (c.name === "propose_env") {
        // AN ENVIRONMENT CHANGE, APPROVED BY THE OWNER ON A CARD (owner, 2026-11-06, like Claude Code).
        if (github) { reply("error: environment changes cannot be proposed in a job started from GitHub; mention it in your answer instead"); continue; }
        const kind = String(c.args.kind || "");
        const reason = scrub(String(c.args.reason || "")).trim().slice(0, 300);
        let change = null;
        if (kind === "setup_script") {
          const script = String(c.args.script || "").replace(/\r/g, "").trim();
          if (!script || script.length > 20000) { reply("error: give the whole new setup script (under 20000 characters)"); continue; }
          change = { kind, script };
        } else if (kind === "allow_host") {
          const host = okHost(c.args.host);
          if (!host) { reply("error: give one exact public host name like api.example.com (no https://, path, IP address or wildcard)"); continue; }
          change = { kind, host };
        } else { reply("error: kind is setup_script or allow_host"); continue; }
        reply("proposed to the owner; their answer is the next message");
        for (const rest of calls.slice(i + 1)) convo.push({ role: "tool", tool_call_id: rest.id, content: "not run: you proposed an environment change first" });
        emit({ type: "envchange", ...change, reason });
        return end("done", { summary: lastSaid || (kind === "allow_host" ? "asked to allow " + change.host : "proposed a new setup script") });
      } else if (c.name === "ask_user") {
        // A QUESTION FOR THE OWNER: the turn ends here; their pick is the next message.
        const question = scrub(String(c.args.question || "")).trim().slice(0, 500);
        const options = (Array.isArray(c.args.options) ? c.args.options : []).map((o) => scrub(String(o)).trim().slice(0, 120)).filter(Boolean).slice(0, 4);
        if (!question || options.length < 2) { reply("error: give a question and 2 to 4 options"); continue; }
        reply("asked the owner; their answer comes as the next message");
        for (const rest of calls.slice(i + 1)) convo.push({ role: "tool", tool_call_id: rest.id, content: "not run: you asked the owner a question first" });
        emit({ type: "question", text: question, options });
        return end("done", { summary: lastSaid || question });
      } else if (RUN_TOOLS[c.name]) {
        // A FILE OR WEB TOOL, run like a command (as `dev`, in the project).
        const spec = RUN_TOOLS[c.name];
        const args = c.args || {};
        emit({ type: "bash", id: c.id, tool: c.name, verb: spec.verb, command: scrub(String(spec.label(args) || "")).slice(0, 300) });
        if (c.name === "write" && typeof args.content === "string" && args.content.length > WRITE_MAX) { const m = "error: that is over " + WRITE_MAX + " characters; write the start, then add the rest with edit"; emit({ type: "result", id: c.id, code: 1, output: m }); reply(m); continue; }
        if (await stopped()) { reply("stopped by the owner"); emit({ type: "stopped" }); return end("stopped"); }
        if (now() - started > maxMs) { reply("not run: Coder ran out of time"); emit({ type: "error", text: "Coder ran out of time." }); return end("time"); }
        const b64 = Buffer.from(JSON.stringify({ tool: c.name, args })).toString("base64");
        let r;
        // Big requests (a long file) travel in a file, not on the command line (the audit: Linux caps one argument at 128 KB).
        try { r = await deps.exec({ command: "node --no-warnings " + TOOLS_SCRIPT + " " + (b64.length > 100_000 ? "@REQUEST" : b64), timeoutS: c.name === "lsp" ? 90 : 60, tool: true, ...(b64.length > 100_000 ? { payload: JSON.stringify({ tool: c.name, args }) } : {}) }); }
        catch (e) { r = { code: -1, output: "the tool could not be run: " + String((e && e.message) || e).slice(0, 200) }; }
        const out = capOutput(String((r && r.output) || ""));
        const code = r && Number.isInteger(r.code) ? r.code : -1;
        emit({ type: "result", id: c.id, code, output: out });
        reply(out || "(nothing)");
      } else if (c.name === "todo") {
        const items = (Array.isArray(c.args.items) ? c.args.items : []).slice(0, 30).map((x) => ({ text: scrub(String((x && x.text) || "")).slice(0, 200), status: ["pending", "in_progress", "done"].includes(x && x.status) ? x.status : "pending" })).filter((x) => x.text);
        emit({ type: "todo", items });
        reply("ok: the owner sees the checklist");
      } else if (c.name === "pull_request") {
        const title = String(c.args.title || "").trim().slice(0, 200);
        const body = String(c.args.body || "").trim().slice(0, 8000);
        if (!title) { reply("error: the pull request needs a title"); continue; }
        prRequest = { title: scrub(title), body: scrub(body) };
        emit({ type: "pr", text: prRequest.title });
        reply("ok: the pull request opens when your turn ends, after your changes are pushed. Finish by telling the owner.");
      } else reply("error: no such tool: " + c.name.slice(0, 40) + " (the tools are bash, read, edit, write, grep, glob, lsp, web_fetch, monitor, stop_job, ask_user, request_secret, propose_env, review, undo_last_job, todo and pull_request, plus your own web search; to finish, answer in words)");
    }
  }
}
