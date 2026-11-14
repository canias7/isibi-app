// CLAUDE CODE'S PLAN MODE AND EXITPLANMODE, WITH ITS PLAN FILE (the owner, 2026-11-14: "Do all the talk to you tools execpt
// for the notify one"): Coder's exit_plan_mode against Claude Code 2.1.325's own (its ExitPlanMode prompt, schema, checks,
// approval prompt, results and plan mode reminders, read from its program that day) and its docs (permission-modes,
// hooks, hooks-guide, permissions, settings-reference, changelog).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, symlink, link, stat, chown } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const P = await import("../container/coder-plan.mjs");
const PF = await import("../container/coder-plan-file.mjs");
const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");
const PERMS = await import("../container/coder-perms.mjs");
const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const tmp = (n) => mkdtemp(join(tmpdir(), "coder-plan-" + n + "-"));
const ROOT = "/work/shop";
/** A chat's plan store in a folder of its own; `rand: () => 0` names its file from Claude Code's first adjective and noun. */
const newStore = async (o = {}) => PF.planStore({ dir: await tmp("dir"), stateFile: join(await tmp("state"), "plan.json"), rand: () => 0, ...o });
const PLAN = "## Context\nThe cart total is wrong when a coupon is used.\n\n## Steps\n1. Fix total() in src/cart.js\n\n## Verification\nnpm test\n";

/** Coder's loop with a scripted Grok and a pretend machine whose file tools write real files (the plan store's among them). */
async function loop(steps, { mode = "plan", answers = [], hooks = null, hookRun = () => ({}), plan, text = "Fix the cart total please", extra = {}, modeOf = null, askWait = 0, deps: more = {} } = {}) {
  const events = [], seen = [], hookCalls = [], cards = [], ran = [];
  let n = 0, k = 0, modeSet = null;
  const box = plan === undefined ? await newStore() : plan;
  const r = await A.runCoder({
    send: async (req) => { seen.push(req); const s = steps[Math.min(n++, steps.length - 1)]; return typeof s === "function" ? s(req) : s; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        hookCalls.push(input);
        const a = (await hookRun(input)) || {};
        return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") };
      }
      const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (tm) {
        const req = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"));
        ran.push(req);
        if (req.tool === "write" && typeof req.args.path === "string" && req.args.path.startsWith("/") && !req.args.path.startsWith(ROOT)) { await writeFile(req.args.path, req.args.content); return { code: 0, output: "File created successfully at: " + req.args.path }; }
        if (req.tool === "read") return { code: 0, output: "1\tread it" };
        return { code: 0, output: "ok" };
      }
      ran.push({ command: x.command });
      return { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => ROOT, root: ROOT, chatId: "shop-pm", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async (pid) => { if (askWait) await new Promise((ok) => setTimeout(ok, askWait)); cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || null; },
    ...(box ? { plan: box } : {}),
    ...(modeOf ? { mode: () => modeSet || modeOf(n), setMode: (m) => { modeSet = m; } } : {}),
    // (Which plan tool is offered when, every tool upfront: ENABLE_TOOL_SEARCH=false. Under tool search, Claude Code's
    // default since 2026-11-14, exit_plan_mode and enter_plan_mode are deferred, as its ExitPlanMode and EnterPlanMode:
    // tool-search.test.mjs.)
    toolSearch: "false",
    ...more,
  }, { text, mode, messages: [], ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}), ...extra });
  const told = (id) => (r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content;
  return { r, events, seen, hookCalls, cards, ran, box, told };
}
const fileOf = async (box) => box.name("Fix the cart total please");

test("PM1 exit_plan_mode as the model sees it: Claude Code's ExitPlanMode prompt and schema with a plan file (no plan parameter, its deprecated allowedPrompts), and its own for a session with none", () => {
  assert.equal(P.EXIT_PLAN_DESC.split("\n")[0], "Use this tool when you are in plan mode and have finished writing your plan to the plan file and are ready for owner approval.");
  for (const line of ["- You should have already written your plan to the plan file specified in the plan mode system message", "- This tool does NOT take the plan content as a parameter - it will read the plan from the file you wrote", "- This tool simply signals that you're done planning and ready for the owner to review and approve", "- The owner will see the contents of your plan file when they review it",
    "IMPORTANT: Only use this tool when the task requires planning the implementation steps of a task that requires writing code. For research tasks where you're gathering information, searching files, reading files or in general trying to understand the codebase - do NOT use this tool.",
    "- If you have unresolved questions about requirements or approach, use ask_user first (in earlier phases)", '**Important:** Do NOT use ask_user to ask "Is this plan okay?" or "Should I proceed?" - that\'s exactly what THIS tool does. exit_plan_mode inherently requests owner approval of your plan.',
    '3. Initial task: "Add a new feature to handle user authentication" - If unsure about auth method (OAuth, JWT, etc.), use ask_user first, then use exit plan mode tool after clarifying the approach.'])
    assert.ok(P.EXIT_PLAN_DESC.includes(line), line);
  assert.ok(!/AskUserQuestion|ExitPlanMode|Claude\b|the user\b|user approval/.test(P.EXIT_PLAN_DESC), "Coder's names (its example's \"user authentication\" stays)");
  const t = P.EXIT_PLAN_TOOL.function;
  assert.equal(t.name, "exit_plan_mode");
  assert.deepEqual(Object.keys(t.parameters.properties), ["allowedPrompts"]);
  assert.equal(t.parameters.required, undefined, "nothing required: Claude Code's literal input is typically empty");
  assert.equal(t.parameters.properties.allowedPrompts.description, "Deprecated: no longer used.");
  assert.deepEqual(t.parameters.properties.allowedPrompts.items.properties.tool, { type: "string", enum: ["Bash"], description: "The tool this prompt applies to" });
  const n = P.EXIT_PLAN_TOOL_NO_FILE.function;
  assert.deepEqual([n.name, n.parameters.required, n.parameters.additionalProperties, n.parameters.properties.plan.description], ["exit_plan_mode", ["plan"], false, "The whole plan, in Markdown, as the owner will see it"]);
  assert.match(n.description, /^Use this tool when you are in plan mode and your plan is ready for the owner to approve\.\n\n- Pass the whole plan as `plan`, in Markdown\. This session has no plan file, so do not write the plan to a file\./);
  // The loop's own copies are these.
  assert.equal(A.EXIT_PLAN_TOOL, P.EXIT_PLAN_TOOL);
  assert.equal(A.EXIT_PLAN_TOOL_NO_FILE, P.EXIT_PLAN_TOOL_NO_FILE);
});

test("PM2 plan mode's note: Claude Code's full reminder with the plan file (where, whether it is there yet, the only file to edit, its 5 phases), its words without a plan file, and Coder's own last line kept", () => {
  const f = "/data/memory/c1.plans/fix-the-cart-total-abundant-aurora.md";
  const fresh = P.planModeNote({ file: f, exists: false });
  assert.ok(fresh.startsWith("Plan mode is active. The owner indicated that they do not want you to execute yet -- you MUST NOT make any edits (with the exception of the plan file mentioned below), run any non-readonly tools (including changing configs or making commits), or otherwise make any changes to the system. This supercedes any other instructions you have received.\n\n## Plan File Info:\nNo plan file exists yet. You should create your plan at " + f + " using the write tool.\nYou should build your plan incrementally by writing to or editing this file. NOTE that this is the only file you are allowed to edit - other than this you are only allowed to take READ-ONLY actions.\n\n## Plan Workflow\n\n### Phase 1: Initial Understanding\n"));
  assert.ok(P.planModeNote({ file: f, exists: true }).includes("\n## Plan File Info:\nA plan file already exists at " + f + ". You can read it and make incremental edits using the edit tool.\n"));
  for (const part of ["2. Read and explore the relevant files directly to efficiently understand the codebase.", "### Phase 2: Design\nGoal: Design an implementation approach based on the owner's intent and your exploration results from Phase 1.", "3. Use ask_user to clarify any remaining questions with the owner",
    "### Phase 4: Final Plan\nGoal: Write your final plan to the plan file (the only file you can edit).\n- Begin with a **Context** section", "- Ensure that the plan file is concise enough to scan quickly, but detailed enough to execute effectively", "(run the code, use MCP tools, run tests)",
    "### Phase 5: Call exit_plan_mode\nAt the very end of your turn, once you have asked the owner questions and are happy with your final plan file - you should always call exit_plan_mode to indicate to the owner that you are done planning.\nThis is critical - your turn should only end with either using the ask_user tool OR calling exit_plan_mode. Do not stop unless it's for these 2 reasons",
    "NOTE: At any point in time through this workflow you should feel free to ask the owner questions or clarifications using the ask_user tool. Don't make large assumptions about owner intent."])
    assert.ok(fresh.includes(part), part);
  assert.ok(fresh.endsWith("\n\n" + P.PLAN_QUESTION_LINE), "Coder's own line, kept for the owner to decide on");
  assert.equal(P.PLAN_QUESTION_LINE, "If the owner only asked a question, answer it in words, without a plan.");
  assert.ok(!/AskUserQuestion|ExitPlanMode|\bWrite tool|\bEdit tool|the user\b/.test(fresh), "Coder's names");
  // No plan file: Claude Code's reminder for a session without a disk.
  assert.ok(P.PLAN_NOTE.startsWith("Plan mode is active. The owner indicated that they do not want you to execute yet -- you MUST NOT make any edits, run any non-readonly tools"));
  assert.ok(P.PLAN_NOTE.includes("## Where Your Plan Goes:\nThis session has no plan file. Pass your plan to exit_plan_mode as its `plan` argument, and do not write it to a file."));
  assert.ok(P.PLAN_NOTE.includes("### Phase 4: Final Plan\nGoal: Settle your final plan.\n"));
  assert.ok(P.PLAN_NOTE.includes("### Phase 5: Call exit_plan_mode\nWhen your plan is final, call exit_plan_mode with the whole plan as its `plan` argument. The owner sees it on an approval card: if they approve, plan mode ends; if they decline, you stay in plan mode and revise the plan."));
  const noTool = P.planModeNote({ exitOffered: false });
  assert.ok(noTool.includes("This session has no plan file. Give your plan to the owner as text in your reply, and do not write it to a file."));
  assert.ok(noTool.includes("### Phase 5: Hand Over To The Owner\nWhen your plan is final, end your turn with it. You cannot leave plan mode yourself"));
  // The same, as coder-perms.mjs gives them on, and in the system's note of each round.
  assert.equal(PERMS.PLAN_NOTE, P.PLAN_NOTE);
  assert.equal(A.modeSystem("plan", { planFile: f }), "PERMISSION MODE: Plan (the owner's pick).\n" + fresh);
  assert.equal(A.modeSystem("plan"), "PERMISSION MODE: Plan (the owner's pick).\n" + P.PLAN_NOTE);
  assert.equal(A.modeSystem("plan", { exitOffered: false }), "PERMISSION MODE: Plan (the owner's pick).\n" + noTool);
});

test("PM3 what Coder is told back: Claude Code's results (with where the plan is kept, edited, an edit not saved, an empty plan), plan mode's end and re-entry, and its refusals", () => {
  const f = "/data/memory/c1.plans/p.md";
  assert.equal(P.planApproved("1. Fix it\n", { file: f }), "The owner has approved your plan. You can now start coding. Start with updating your todo list if applicable\n\nYour plan has been saved to: " + f + "\nYou can refer back to it if needed during implementation.\n\n## Approved Plan:\n1. Fix it\n");
  assert.equal(P.planApproved("1. Fix it", { file: f, edited: true }), "The owner has approved your plan. You can now start coding. Start with updating your todo list if applicable\n\nYour plan has been saved to: " + f + "\nYou can refer back to it if needed during implementation.\n\n## Approved Plan (edited by the owner):\n1. Fix it");
  assert.equal(P.planApproved("1. Fix it", { edited: true, unsaved: true }), "The owner has approved your plan. You can now start coding. Start with updating your todo list if applicable\n\nThe edit could not be saved to the plan file, so work from the text below.\n\n## Approved Plan (edited by the owner):\n1. Fix it");
  assert.equal(P.planApproved("1. Fix it"), "The owner has approved your plan. You can now start coding. Start with updating your todo list if applicable\n\n## Approved Plan:\n1. Fix it");
  assert.equal(P.planApproved("  \n"), "The owner has approved exiting plan mode. You can now proceed.");
  assert.equal(PERMS.planApproved, P.planApproved);
  assert.equal(P.PLAN_EXITED, "## Exited Plan Mode\n\nYou have exited plan mode. You can now make edits, run tools, and take actions.");
  assert.equal(P.planExitedNote(f, true), P.PLAN_EXITED + " The plan file is located at " + f + " if you need to reference it.");
  assert.equal(P.planExitedNote(f, false), P.PLAN_EXITED, "no file there: no line about it");
  assert.equal(P.planExitedNote(), P.PLAN_EXITED);
  const re = P.planReentryNote(f);
  assert.ok(re.startsWith("## Re-entering Plan Mode\n\nYou are returning to plan mode after having previously exited it. A plan file exists at " + f + " from your previous planning session.\n\n**Before proceeding with any new planning, you should:**\n1. Read the existing plan file to understand what was previously planned\n2. Evaluate the owner's current request against that plan"));
  assert.ok(re.includes("4. Continue on with the plan process and most importantly you should always edit the plan file one way or the other before calling exit_plan_mode"));
  assert.ok(re.endsWith("Treat this as a fresh planning session. Do not assume the existing plan is relevant without evaluating it first."));
  // (Claude Code's own words, now that Coder has enter_plan_mode: "To enter plan mode, call the EnterPlanMode tool first.")
  assert.equal(P.NOT_IN_PLAN_MODE, "error: You are not in plan mode. To enter plan mode, call the enter_plan_mode tool first. If your plan was already approved, continue with implementation.");
  assert.equal(P.PLAN_ARG_NEEDED, "error: Pass the whole plan as non-empty text in the `plan` argument, and pass no other argument. This session has no plan file to read it from.");
  assert.equal(P.planTooBig(40000), "error: The plan is 40000 bytes as JSON, over the 32768 that the owner's approval card can carry. A quote, backslash or line break counts as two bytes, and a non-ASCII character as two to four. Shorten the plan and call this tool again.");
  assert.equal(P.PLAN_SHOW_MAX, 200000);
  // The owner's change of mode, from Plan: plan mode's end with where the plan file is.
  assert.equal(A.modeChangeNote("plan", "acceptEdits", { planExited: P.planExitedNote(f, true) }), "(Note from Coder's app, not the owner:\n" + P.planExitedNote(f, true) + "\n\nThe owner's permission mode is now Accept edits.)");
  assert.match(A.modeChangeNote("auto", "plan", { planFile: true }), /The owner's permission mode is now Plan: plan mode is active; make no changes, and call exit_plan_mode when your plan is final\.\)$/);
  assert.match(A.modeChangeNote("auto", "plan"), /call exit_plan_mode with your plan when it is final\.\)$/);
});

test("PM4 its input, as Claude Code's normalizeToolInput and validateInput: the plan file's text and path put in (Coder's own `plan` dropped), refused out of plan mode, and with no plan file the plan must come as `plan`", () => {
  const f = "/data/memory/c1.plans/p.md";
  assert.deepEqual(P.planInput({ plan: "mine", planFilePath: "/etc/passwd", allowedPrompts: [] }, { file: f, text: "the file's" }), { allowedPrompts: [], plan: "the file's", planFilePath: f });
  assert.deepEqual(P.planInput({ plan: "mine" }, { file: f, text: null }), {}, "no file yet: no plan (Claude Code's 'No plan found')");
  assert.deepEqual(P.planInput({ plan: "mine" }, {}), { plan: "mine" }, "no plan file at all: as given");
  assert.deepEqual(P.checkPlanInput({}, { mode: "auto" }), { error: P.NOT_IN_PLAN_MODE });
  assert.deepEqual(P.checkPlanInput({}, { mode: "plan" }), { args: {} });
  for (const bad of [{}, { plan: "" }, { plan: "  " }, { plan: 3 }, { plan: "x", allowedPrompts: [] }]) assert.deepEqual(P.checkPlanInput(bad, { mode: "plan", noFile: true }), { error: P.PLAN_ARG_NEEDED }, JSON.stringify(bad));
  const big = { plan: "1.\n".repeat(8200) };
  assert.equal(Buffer.byteLength(JSON.stringify(big)), 32811);
  assert.deepEqual(P.checkPlanInput(big, { mode: "plan", noFile: true }), { error: P.planTooBig(32811) }, "a line break counts as two bytes");
  assert.deepEqual(P.checkPlanInput({ plan: "1. Fix it" }, { mode: "plan", noFile: true }), { args: { plan: "1. Fix it" } });
  // Its schema first (the deprecated allowedPrompts), in Claude Code's words (its w0, zod 4.6.2's issues, checked against zod
  // itself): a missing or mistyped parameter by name; only a value wrong, zod's own message.
  assert.deepEqual(P.checkPlanInput({ allowedPrompts: [{ tool: "Bash" }] }, { mode: "auto" }), { error: "error: InputValidationError: ExitPlanMode failed due to the following issue:\nThe required parameter `allowedPrompts[0].prompt` is missing" }, "before the mode check");
  assert.deepEqual(P.checkPlanInput({ allowedPrompts: "Bash" }, { mode: "plan" }), { error: "error: InputValidationError: ExitPlanMode failed due to the following issue:\nThe parameter `allowedPrompts` type is expected as `array` but provided as `string`" });
  assert.deepEqual(P.checkPlanInput({ allowedPrompts: [{ tool: "Grep", prompt: "x" }] }, { mode: "plan" }), { error: "error: InputValidationError: " + JSON.stringify([{ code: "invalid_value", values: ["Bash"], path: ["allowedPrompts", 0, "tool"], message: 'Invalid input: expected "Bash"' }], null, 2) });
  assert.deepEqual(P.checkPlanInput({ allowedPrompts: [{ tool: "Bash", prompt: "run tests" }] }, { mode: "plan" }), { args: { allowedPrompts: [{ tool: "Bash", prompt: "run tests" }] } });
});

test("PM5 the plan file's name, as Claude Code's since 2.1.111: the owner's first four words, then an adjective and a noun from its own lists; none: adjective, verb, noun", () => {
  assert.equal(P.planSlug("Fix the auth race in login.js", () => 0), "fix-the-auth-race-abundant-aurora");
  assert.equal(P.planSlug("Fix the auth race", () => 0.999999), "fix-the-auth-race-virtual-yao", "the last of each list");
  assert.equal(P.planSlug("", () => 0), "abundant-baking-aurora");
  assert.equal(P.planSlug("   ", () => 0), "abundant-baking-aurora");
  // (Claude Code's own steps: lower case, every run of other characters one dash, at most 40, no dash at either end.)
  assert.equal(P.planSlug("Ünïcode!! ### über-long-word-that-goes-on-and-on-and-on-for-ever", () => 0), "n-code-ber-long-word-that-goes-on-and-o-abundant-aurora");
  for (let i = 0; i < 50; i++) { const s = P.planSlug("Add a test for the cart", Math.random); assert.match(s, P.SLUG_RE); assert.ok(s.startsWith("add-a-test-for-"), s); }
});

test("PM6 the plan store on Coder's machine: one name for the chat, kept in root's file; the file read and written as the AI's own plain file only (never through a link, a hard link, or another user's file)", async () => {
  const dir = await tmp("dir"), state = join(await tmp("state"), "plan.json");
  const a = PF.planStore({ dir, stateFile: state, rand: () => 0 });
  assert.equal(a.current(), "", "no name before plan mode");
  assert.equal(await a.read(), null);
  assert.equal(await a.write("x"), false, "nothing to write to yet");
  const f = await a.name("Fix the cart total please");
  assert.equal(f, join(dir, "fix-the-cart-total-abundant-aurora.md"));
  assert.equal(await a.name("Something else entirely"), f, "named once");
  assert.equal((await stat(state)).mode & 0o777, 0o600, "root's own");
  const b = PF.planStore({ dir, stateFile: state, rand: () => 0.5 });
  assert.equal(b.current(), f, "the next message's store knows it");
  assert.equal(await b.read(), null, "not written yet");
  await writeFile(f, PLAN);
  assert.equal(await b.read(), PLAN);
  // A name already taken in the folder is not used again (Claude Code: ten tries).
  const c = PF.planStore({ dir, stateFile: join(await tmp("state"), "plan.json"), rand: () => 0 });
  const seq = [0, 0, 0.5, 0.5];
  const d = PF.planStore({ dir, stateFile: join(await tmp("state"), "plan.json"), rand: () => seq.shift() ?? 0.5 });
  assert.equal(await c.name("Fix the cart total please"), f, "ten tries, all taken: the last one kept");
  assert.notEqual(await d.name("Fix the cart total please"), f);
  // Flags.
  assert.deepEqual(b.flags(), { exited: false, on: false });
  b.setFlags({ on: true, exited: true, other: 1 });
  assert.deepEqual(PF.planStore({ dir, stateFile: state }).flags(), { exited: true, on: true });
  // A link where the file should be: not read, and an edit replaces the link without following it.
  const secret = join(await tmp("secret"), "s.txt");
  await writeFile(secret, "root's secret\n");
  const e = PF.planStore({ dir: await tmp("dir"), stateFile: join(await tmp("state"), "plan.json"), rand: () => 0 });
  const ef = await e.name("x");
  await symlink(secret, ef);
  assert.equal(await e.read(), null, "never through a link");
  assert.equal(await e.write("the owner's edit\n"), true);
  assert.equal(await readFile(secret, "utf8"), "root's secret\n", "the link's target is untouched");
  assert.equal(await e.read(), "the owner's edit\n");
  // A hard link: not read.
  const g = PF.planStore({ dir: await tmp("dir"), stateFile: join(await tmp("state"), "plan.json"), rand: () => 0 });
  const gf = await g.name("x");
  const other = join(await tmp("other"), "o.md");
  await writeFile(other, "elsewhere\n");
  await link(other, gf);
  assert.equal(await g.read(), null, "never a hard link");
  // Another user's file (as root only: the store reads the AI's own files alone).
  if (process.getuid && process.getuid() === 0) {
    const u = PF.planStore({ dir: await tmp("dir"), stateFile: join(await tmp("state"), "plan.json"), uid: 1001, gid: 1001, rand: () => 0 });
    const uf = await u.name("x");
    await writeFile(uf, "root wrote this\n");
    assert.equal(await u.read(), null, "not the AI's");
    await chown(uf, 1001, 1001);
    assert.equal(await u.read(), "root wrote this\n");
    assert.equal(await u.write("edited\n"), true);
    assert.equal((await stat(uf)).uid, 1001, "handed to the AI's user");
  }
});

test("PM7 in Plan mode Coder is told where its plan file is; it writes it without a card (the one file it may change); exit_plan_mode reads it, shows it on the card, and the approval ends plan mode with Claude Code's answer", async () => {
  const box = await newStore();
  const f = await fileOf(box);
  const t = await loop([
    say("", [call("write", { path: f, content: PLAN }, "w1")]),
    say("", [call("exit_plan_mode", {}, "x1")]),
    say("Done."),
  ], { plan: box, answers: [{ choice: "acceptEdits" }] });
  // Plan mode's reminder, Claude Code's whole one, in the conversation right after the owner's message (fix round 3: never in
  // the system message, which stays the same for the whole chat).
  assert.deepEqual(t.seen[0].messages[2], { role: "user", appNote: true, planReminder: "file", content: "(Note from Coder's app, not the owner:\n" + P.planModeNote({ file: f, exists: false }) + ")" });
  assert.ok(!t.seen[0].messages[0].content.includes("Plan mode is active") && !t.seen[0].messages[0].content.includes("PERMISSION MODE"));
  const exit0 = t.seen[0].tools.find((x) => x.function.name === "exit_plan_mode");
  assert.equal(exit0, P.EXIT_PLAN_TOOL, "Claude Code's tool: no plan parameter");
  assert.equal(t.cards.length, 1, "the plan file was written without a card");
  assert.ok(t.ran.some((x) => x.tool === "write" && x.args.path === f));
  // The plan file's first write changes nothing in the system message, nor in the tools (Claude Code: "Switching between
  // permission modes ... does not change the system prompt or tool definitions"); within the turn no new reminder comes.
  assert.equal(t.seen[1].messages[0].content, t.seen[0].messages[0].content);
  assert.equal(t.seen[1].messages.filter((m) => m.planReminder).length, 1);
  assert.deepEqual([t.cards[0].tool, t.cards[0].plan, t.cards[0].hookTool], ["plan", PLAN, "exit_plan_mode"]);
  assert.equal(t.told("x1"), "The owner has approved your plan. You can now start coding. Start with updating your todo list if applicable\n\nYour plan has been saved to: " + f + "\nYou can refer back to it if needed during implementation.\n\n## Approved Plan:\n" + PLAN);
  // "## Exited Plan Mode" as Claude Code places it: its own reminder (plan_mode_exit) before Coder's next step, not in the
  // tool's result; once.
  const exitNote = "(Note from Coder's app, not the owner:\n## Exited Plan Mode\n\nYou have exited plan mode. You can now make edits, run tools, and take actions. The plan file is located at " + f + " if you need to reference it.)";
  const last = t.seen[2].messages;
  // (Then Coder's own note for Accept edits, the mode the plan's approval chose: Claude Code has none for that mode.)
  assert.deepEqual(last.slice(-2), [{ role: "user", appNote: true, content: exitNote }, { role: "user", appNote: true, modeNote: "acceptEdits", content: "(Note from Coder's app, not the owner:\n" + A.modeSystem("acceptEdits") + ")" }]);
  assert.equal(last.filter((m) => m.content === exitNote).length, 1);
  assert.equal(last.filter((m) => typeof m.content === "string" && m.content.includes("## Exited Plan Mode")).length, 1, "nowhere else");
  assert.equal(t.r.mode, "acceptEdits");
  // Out of plan mode exit_plan_mode is still listed (Claude Code's is in every mode, and refuses a call there): the request's
  // system message and tools are the same in every step, across the plan file's first write and the mode's change.
  assert.ok(t.seen[2].tools.some((x) => x.function.name === "exit_plan_mode"));
  assert.equal(t.seen[2].messages[0].content, t.seen[0].messages[0].content);
  assert.deepEqual(t.seen[2].tools, t.seen[0].tools);
  assert.deepEqual(box.flags(), { exited: true, on: false }, "Claude Code's hasExitedPlanMode, for re-entering");
  assert.equal(readFileSync(f, "utf8"), PLAN, "an approval without edits leaves the file as it is");
});

test("PM8 hooks see Claude Code's ExitPlanMode input (the plan file's text and path, Coder's own `plan` dropped) and PostToolUse its result object; a decline fires no PostToolUse; out of plan mode it is refused before any hook", async () => {
  const box = await newStore();
  const f = await fileOf(box);
  await writeFile(f, PLAN);
  const hooks = { PreToolUse: [{ matcher: "ExitPlanMode", hooks: [{ type: "command", command: "pre.sh" }] }], PostToolUse: [{ matcher: "ExitPlanMode", hooks: [{ type: "command", command: "post.sh" }] }] };
  let t = await loop([say("", [call("exit_plan_mode", { plan: "Coder's own words", planFilePath: "/etc/passwd" }, "x1")]), say("Done.")], { plan: box, hooks, answers: [{ choice: "auto" }] });
  const pre = t.hookCalls.find((h) => h.hook_event_name === "PreToolUse");
  assert.deepEqual(pre.tool_input, { plan: PLAN, planFilePath: f });
  assert.equal(pre.tool_name, "ExitPlanMode");
  const post = t.hookCalls.find((h) => h.hook_event_name === "PostToolUse");
  assert.deepEqual(post.tool_input, { plan: PLAN, planFilePath: f });
  assert.deepEqual(post.tool_response, { plan: PLAN, isAgent: false, filePath: f });
  assert.equal(t.cards[0].plan, PLAN, "the card shows the file, not Coder's own words");
  // Declined with what to change: plan mode stays, and no PostToolUse hook runs (Claude Code: a permission denial).
  t = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("Revising.")], { plan: await (async () => { const b = await newStore(); await writeFile(await fileOf(b), PLAN); return b; })(), hooks, answers: [{ choice: "no", comment: "only the cart, not the coupon" }] });
  assert.equal(t.told("x1"), PERMS.REJECTED_SAID + "only the cart, not the coupon");
  assert.equal(t.hookCalls.some((h) => h.hook_event_name === "PostToolUse"), false);
  assert.ok(t.seen[1].tools.some((x) => x.function.name === "exit_plan_mode"), "still in plan mode");
  // Out of plan mode (the owner switched while Coder planned): refused before any hook, in Claude Code's words.
  t = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("ok")], { mode: "auto", hooks, plan: await newStore() });
  assert.equal(t.told("x1"), P.NOT_IN_PLAN_MODE);
  assert.equal(t.hookCalls.length, 0);
  assert.equal(t.cards.length, 0);
});

test("PM9 PermissionRequest hooks answer the plan's card, as Claude Code's hooks guide auto-approves ExitPlanMode: an allow needs updatedInput (else the card shows), restores the owner's start mode or sets its own; a deny's message goes to Coder; the card's Notification hook names ExitPlanMode", async () => {
  const stored = async () => { const b = await newStore(); await writeFile(await fileOf(b), PLAN); return b; };
  const PR = (cmd = "pr.sh") => ({ PermissionRequest: [{ matcher: "ExitPlanMode", hooks: [{ type: "command", command: cmd }] }] });
  const out = (decision) => ({ stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision } }) });
  // The guide's own: allow with updatedInput = tool_input. No card; back to the start mode (Accept edits here).
  let box = await stored();
  let t = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("Done.")], { plan: box, hooks: PR(), hookRun: (i) => out({ behavior: "allow", updatedInput: i.tool_input }), extra: { planExit: "acceptEdits" } });
  assert.equal(t.cards.length, 0);
  const prIn = t.hookCalls.find((h) => h.hook_event_name === "PermissionRequest");
  assert.deepEqual([prIn.tool_name, prIn.tool_input], ["ExitPlanMode", { plan: PLAN, planFilePath: await fileOf(box) }]);
  assert.equal(t.r.mode, "acceptEdits");
  assert.ok(t.told("x1").startsWith("The owner has approved your plan. You can now start coding. Start with updating your todo list if applicable\n\nYour plan has been saved to: "));
  assert.ok(t.told("x1").includes("\n\n## Approved Plan:\n" + PLAN), "the same plan: not edited");
  assert.deepEqual(box.flags(), { exited: true, on: false });
  assert.ok(t.events.some((e) => e.type === "mode" && e.mode === "acceptEdits" && e.by === "plan"), "the page's mode follows it");
  // Its allow with no input: ignored, the card shows.
  t = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("Done.")], { plan: await stored(), hooks: PR(), hookRun: () => out({ behavior: "allow" }), answers: [{ choice: "auto" }] });
  assert.equal(t.cards.length, 1);
  assert.equal(t.r.mode, "auto");
  // A changed plan in its input: saved to the plan file, said as edited; and its setMode is the mode after.
  box = await stored();
  t = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("Done.")], { plan: box, hooks: { ...PR(), PostToolUse: [{ matcher: "ExitPlanMode", hooks: [{ type: "command", command: "post.sh" }] }] }, hookRun: (i) => (i.hook_event_name === "PermissionRequest" ? out({ behavior: "allow", updatedInput: { ...i.tool_input, plan: "1. Only the cart\n" }, updatedPermissions: [{ type: "setMode", mode: "auto", destination: "session" }] }) : {}) });
  assert.equal(readFileSync(await fileOf(box), "utf8"), "1. Only the cart\n");
  assert.ok(t.told("x1").includes("\n\n## Approved Plan (edited by the owner):\n1. Only the cart\n"));
  assert.equal(t.r.mode, "auto");
  assert.equal(t.hookCalls.find((h) => h.hook_event_name === "PostToolUse").tool_response.planWasEdited, true);
  assert.deepEqual(box.flags(), { exited: false, on: false }, "its setMode left plan mode first: Claude Code sets no re-entry flag then");
  // Its deny: its message to Coder, plan mode stays.
  t = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("ok")], { plan: await stored(), hooks: PR(), hookRun: () => out({ behavior: "deny", message: "Plans need a test step." }) });
  assert.equal(t.told("x1"), "Plans need a test step.");
  assert.equal(t.cards.length, 0);
  assert.equal(t.r.mode, "plan");
  // The card's Notification hook, as Claude Code's "Claude needs your permission to use ExitPlanMode".
  t = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("ok")], { plan: await stored(), hooks: { Notification: [{ matcher: "permission_prompt", hooks: [{ type: "command", command: "n.sh" }] }] }, answers: [{ choice: "auto" }], askWait: 80, deps: { promptNotifyMs: 10 } });
  assert.deepEqual(t.hookCalls.map((h) => [h.hook_event_name, h.notification_type, h.message]), [["Notification", "permission_prompt", "Coder needs your permission to use ExitPlanMode"]]);
});

test("PM10 the owner edits the plan on its card: saved to the plan file, the answer says 'edited by the owner'; an edit that can't be saved says so; no plan says Coder wants to exit plan mode; one too long withholds approval", async () => {
  let box = await newStore();
  await writeFile(await fileOf(box), PLAN);
  let t = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("Done.")], { plan: box, answers: [{ choice: "acceptEdits", plan: "## Context\nThe owner's plan.\n" }] });
  const f = await fileOf(box);
  assert.equal(readFileSync(f, "utf8"), "## Context\nThe owner's plan.\n");
  assert.ok(t.told("x1").startsWith("The owner has approved your plan. You can now start coding. Start with updating your todo list if applicable\n\nYour plan has been saved to: " + f + "\nYou can refer back to it if needed during implementation.\n\n## Approved Plan (edited by the owner):\n## Context\nThe owner's plan.\n"));
  assert.equal(t.events.find((e) => e.type === "permanswer").plan, "## Context\nThe owner's plan.\n", "the card then shows the plan as approved");
  // The same text as the card: not an edit.
  box = await newStore();
  await writeFile(await fileOf(box), PLAN);
  t = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("Done.")], { plan: box, answers: [{ choice: "auto", plan: PLAN }] });
  assert.ok(t.told("x1").includes("## Approved Plan:\n"));
  // Not saved: Claude Code's line, and no "saved to".
  box = await newStore();
  await writeFile(await fileOf(box), PLAN);
  const broken = { ...box, write: async () => false, save: async () => ({ notice: "The approved plan could not be saved to " + (await fileOf(box)) + ": EACCES: permission denied" }) };
  t = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("Done.")], { plan: broken, answers: [{ choice: "auto", plan: "1. Mine\n" }] });
  assert.ok(t.told("x1").startsWith("The owner has approved your plan. You can now start coding. Start with updating your todo list if applicable\n\nThe edit could not be saved to the plan file, so work from the text below.\n\n## Approved Plan (edited by the owner):\n1. Mine\n"));
  assert.ok(t.events.some((e) => e.type === "note" && e.warn && e.text === "The approved plan could not be saved to " + box.current() + ": EACCES: permission denied"), "Claude Code's warning, with why");
  // No plan written: the card has none (the page says Coder wants to exit plan mode), and the approval is Claude Code's for it.
  t = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("Done.")], { answers: [{ choice: "auto" }] });
  assert.equal(t.cards[0].plan, "");
  assert.equal(t.told("x1"), "The owner has approved exiting plan mode. You can now proceed.");
  assert.ok(t.seen[1].messages.some((m) => m.appNote && m.content === "(Note from Coder's app, not the owner:\n" + P.PLAN_EXITED + ")"), "no plan file there: no line about it");
  // Past 200,000 characters: approval withheld (the card offers only No); a Yes is taken as a No.
  box = await newStore();
  await writeFile(await fileOf(box), "x".repeat(200_001));
  t = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("never")], { plan: box, answers: [{ choice: "auto" }] });
  assert.deepEqual([t.cards[0].plan, t.cards[0].withheld], ["", P.PLAN_WITHHELD]);
  assert.equal(t.told("x1"), PERMS.REJECTED);
  assert.equal(t.r.mode, "plan");
});

test("PM11 Claude Code's other plan mode notes: plan mode's end with where the plan file is when the owner switches mid-job, and between two messages; 'Re-entering Plan Mode' once after an approved plan whose file is there", async () => {
  // Mid-job: Plan, then the owner picks Accept edits.
  let box = await newStore();
  const f = await fileOf(box);
  await writeFile(f, PLAN);
  let t = await loop([say("", [call("bash", { command: "ls" }, "b1")]), say("Done.")], { plan: box, modeOf: (n) => (n < 1 ? "plan" : "acceptEdits") });
  assert.equal(t.seen[1].messages.at(-2).content, "(Note from Coder's app, not the owner:\n" + P.planExitedNote(f, true) + "\n\nThe owner's permission mode is now Accept edits.)");
  // (Then Coder's own note for Accept edits, once in that mode: fix round 3. No second "## Exited Plan Mode".)
  assert.equal(t.seen[1].messages.at(-1).modeNote, "acceptEdits");
  assert.equal(t.seen[1].messages.filter((m) => /Exited Plan Mode/.test(m.content)).length, 1);
  assert.equal(box.flags().on, false);
  // Between two messages: the last one was in Plan (on), this one starts in Auto: said at its start, once.
  box = await newStore();
  const f2 = await fileOf(box);
  await writeFile(f2, PLAN);
  box.setFlags({ on: true });
  t = await loop([say("", [call("bash", { command: "ls" }, "b1")]), say("Done.")], { plan: box, mode: "auto" });
  const notes = t.seen[0].messages.filter((m) => m.role === "user" && /Exited Plan Mode/.test(m.content));
  assert.deepEqual(notes.map((m) => m.content), ["(Note from Coder's app, not the owner:\n" + P.planExitedNote(f2, true) + ")"]);
  assert.equal(t.seen[1].messages.filter((m) => /Exited Plan Mode/.test(m.content)).length, 1, "once");
  assert.equal(box.flags().on, false);
  // Back in Plan after an approved plan, its file there: Claude Code's re-entry note, once; then plan mode is on.
  box = await newStore();
  const f3 = await fileOf(box);
  await writeFile(f3, PLAN);
  box.setFlags({ exited: true });
  t = await loop([say("", [call("bash", { command: "ls" }, "b1")]), say("Done.")], { plan: box });
  assert.deepEqual(t.seen[0].messages.filter((m) => /Re-entering Plan Mode/.test(m.content)).map((m) => m.content), ["(Note from Coder's app, not the owner:\n" + P.planReentryNote(f3) + ")"]);
  assert.equal(t.seen[1].messages.filter((m) => /Re-entering Plan Mode/.test(m.content)).length, 1);
  assert.deepEqual(box.flags(), { exited: false, on: true });
  // No file there: no re-entry note.
  box = await newStore();
  box.setFlags({ exited: true });
  t = await loop([say("Planning.")], { plan: box });
  assert.equal(t.seen[0].messages.some((m) => /Re-entering Plan Mode/.test(m.content)), false);
});

test("PM12 the file tools and the plan file: Plan asks before any other write, never for it; the write block and the read block let it through, as Claude Code's own plan files", async () => {
  const box = await newStore();
  const f = await fileOf(box);
  let t = await loop([say("", [call("write", { path: f, content: PLAN }, "w1"), call("write", { path: "notes.md", content: "x\n" }, "w2")]), say("Done.")], { plan: box, answers: [{ choice: "no", comment: "plan only" }] });
  assert.deepEqual(t.cards.map((c) => [c.tool, c.path]), [["write", "notes.md"]]);
  assert.equal(t.cards[0].why, "Plan mode is on: files change only after you approve the plan.");
  // The write block (CODER_BLOCK_WRITES_OUTSIDE_WORKING_DIRECTORIES) and the read block, in Auto.
  t = await loop([say("", [call("write", { path: f, content: "1. Again\n" }, "w1"), call("read", { path: f }, "r1"), call("write", { path: "/tmp/elsewhere.md", content: "x\n" }, "w2")]), say("Done.")], { plan: box, mode: "auto", extra: { writeBlock: true, readBlock: true } });
  assert.equal(readFileSync(f, "utf8"), "1. Again\n");
  assert.ok(!/blocked|refus|outside/i.test(t.told("w1")), t.told("w1"));
  assert.equal(t.told("r1"), "1\tread it");
  assert.match(t.told("w2"), /outside/i, "another file outside the project is still blocked");
});

test("PM13 a run with no plan file plans as Claude Code's sessions without a disk: the plan as `plan` (checked before any hook), shown on the card, echoed when approved; with exit_plan_mode denied, the plan goes in the reply", async () => {
  let t = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("", [call("exit_plan_mode", { plan: "1. Fix it", allowedPrompts: [] }, "x2")]), say("", [call("exit_plan_mode", { plan: "1. Fix it" }, "x3")]), say("Done.")], { plan: null, answers: [{ choice: "auto" }] });
  assert.deepEqual(t.seen[0].messages[2], { role: "user", appNote: true, planReminder: "exit", content: "(Note from Coder's app, not the owner:\n" + P.PLAN_NOTE + ")" });
  assert.equal(t.seen[0].tools.find((x) => x.function.name === "exit_plan_mode"), P.EXIT_PLAN_TOOL_NO_FILE);
  assert.equal(t.told("x1"), P.PLAN_ARG_NEEDED);
  assert.equal(t.told("x2"), P.PLAN_ARG_NEEDED);
  assert.equal(t.cards[0].plan, "1. Fix it");
  assert.equal(t.told("x3"), "The owner has approved your plan. You can now start coding. Start with updating your todo list if applicable\n\n## Approved Plan:\n1. Fix it");
  const after = t.seen[3].messages;
  assert.deepEqual(after[after.length - 2], { role: "user", appNote: true, content: "(Note from Coder's app, not the owner:\n" + P.PLAN_EXITED + ")" }, "plan mode's end as its own note, with no plan file");
  assert.equal(after[after.length - 1].modeNote, "auto", "then auto mode's, the mode the approval chose (Claude Code's auto_mode)");
  assert.equal(after.filter((m) => typeof m.content === "string" && m.content.includes("## Exited Plan Mode")).length, 1);
  t = await loop([say("", [call("exit_plan_mode", { plan: "x".repeat(40000) }, "x1")]), say("ok")], { plan: null });
  assert.equal(t.told("x1"), P.planTooBig(Buffer.byteLength(JSON.stringify({ plan: "x".repeat(40000) }))));
  t = await loop([say("Here is the plan.")], { plan: null, extra: { rules: { allow: [], ask: [], deny: ["ExitPlanMode"] } } });
  assert.ok(!t.seen[0].tools.some((x) => x.function.name === "exit_plan_mode"));
  assert.deepEqual([t.seen[0].messages[2].planReminder, t.seen[0].messages[2].content], ["reply", "(Note from Coder's app, not the owner:\n" + P.planModeNote({ exitOffered: false }) + ")"]);
});

test("PM14 the tools script opens the chat's plan file by its exact path (CODER_PLAN_FILE), outside the project, never through a link", async () => {
  const root = await tmp("root"), plans = await tmp("plans");
  const f = join(plans, "fix-it-abundant-aurora.md");
  const tool = (req, env = {}) => {
    const r = spawnSync("node", ["--no-warnings", new URL("../container/coder-tools.mjs", import.meta.url).pathname, Buffer.from(JSON.stringify(req)).toString("base64")], { cwd: root, encoding: "utf8", env: { ...process.env, ...env } });
    return String(r.stdout || "") + String(r.stderr || "");
  };
  assert.match(tool({ tool: "write", args: { path: f, content: PLAN } }), /outside the project/, "not without the variable");
  assert.equal(existsSync(f), false);
  tool({ tool: "write", args: { path: f, content: PLAN } }, { CODER_PLAN_FILE: f });
  assert.equal(readFileSync(f, "utf8"), PLAN);
  assert.match(tool({ tool: "read", args: { path: f } }, { CODER_PLAN_FILE: f }), /The cart total is wrong/);
  assert.match(tool({ tool: "write", args: { path: join(plans, "other.md"), content: "x" } }, { CODER_PLAN_FILE: f }), /outside the project/, "only that file");
  const g = join(plans, "linked.md");
  await symlink(join(root, "x.txt"), g);
  assert.match(tool({ tool: "write", args: { path: g, content: "x" } }, { CODER_PLAN_FILE: g }), /the plan file is not a plain file/);
});

test("PM15 Coder's machine: each chat's plan folder beside its memory (never in the project); the tools get the plan file's path, the AI's commands don't; the owner's edit on the card comes through /answer and is saved", async () => {
  const S = await import("../container/server.mjs");
  const http = (await import("node:http")).default;
  const r = { root: await tmp("root"), gitRoot: await tmp("git"), memRoot: await tmp("mem"), bgRoot: await tmp("bg"), home: await tmp("home") };
  const project = "pm-plan-" + Math.random().toString(36).slice(2, 8);
  const seen = [];
  let n = 0, file = "";
  const app = S.createApp({ ...r, send: async (req) => {
    seen.push(req);
    const k = n++;
    if (k === 0) { file = (/create your plan at (\S+) using the write tool/.exec(req.messages.map((m) => String(m.content)).join("\n")) || [])[1] || ""; return say("", [call("write", { path: file, content: PLAN }, "w1")]); }
    if (k === 1) return say("", [call("exit_plan_mode", {}, "x1")]);
    if (k === 2) return say("", [call("bash", { command: "echo \"[${CODER_PLAN_FILE:-none}]\"", description: "Look" }, "b1")]);
    return say("Done.");
  } });
  const srv = http.createServer(app);
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    const sent = await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, text: "Plan the cart fix", messages: [], mode: "plan" }) });
    assert.equal(sent.status, 200);
    let st, answered = new Set();
    for (let i = 0; i < 600; i++) {
      st = await (await fetch(base + "/state?project=" + project + "&since=0")).json();
      for (const e of st.events || []) {
        if (e.type !== "permission" || answered.has(e.pid)) continue;
        const a = await (await fetch(base + "/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, pid: e.pid, ...(e.tool === "plan" ? { choice: "acceptEdits", plan: "## Context\nThe owner's own plan.\n" } : { choice: "yes" }) }) })).json();
        if (a.ok) answered.add(e.pid);
      }
      if (st.result) break;
      await new Promise((ok) => setTimeout(ok, 50));
    }
    assert.ok(st && st.result, "the message ended");
    const dir = join(r.memRoot, project + ".plans");
    assert.ok(file.startsWith(dir + "/plan-the-cart-fix-") && file.endsWith(".md"), file);
    assert.ok(!file.startsWith(join(r.root, project)), "never in the project");
    const card = (st.events || []).find((e) => e.type === "permission" && e.tool === "plan");
    assert.equal(card.plan, PLAN, "the AI's write reached the plan file (through CODER_PLAN_FILE)");
    assert.equal(readFileSync(file, "utf8"), "## Context\nThe owner's own plan.\n", "the owner's edit saved");
    const approved = seen[2].messages.find((m) => m.role === "tool" && m.tool_call_id === "x1").content;
    assert.ok(approved.includes("Your plan has been saved to: " + file + "\n") && approved.includes("## Approved Plan (edited by the owner):\n## Context\nThe owner's own plan.\n"), approved);
    const echoed = (st.events || []).find((e) => e.type === "result" && e.id === "b1");
    assert.match(String(echoed && echoed.output), /\[none\]/, "the AI's commands don't get it");
    const state = JSON.parse(readFileSync(join(r.memRoot, project + ".plan.json"), "utf8"));
    assert.deepEqual([state.exited, state.on, file.endsWith("/" + state.slug + ".md")], [true, false, true]);
  } finally { srv.close(); }
});

test("PM16 the Worker hands the owner's plan edit to the machine; the page: the plan's card has Edit plan (kept through redraws, its number keys off while typing), says Coder wants to exit plan mode with no plan, withholds approval for one too long, and shows the plan as approved", () => {
  const routes = read("src/coder-routes.mjs");
  assert.match(routes, /post\("\/answer", \{ project: id, pid: String\(body\.pid \|\| ""\), choice: String\(body\.choice \|\| ""\), comment: [^\n]*\.\.\.\(typeof body\.plan === "string" \? \{ plan: body\.plan\.slice\(0, 200_000\) \} : \{\}\) \}\)/);
  const server = read("container/server.mjs");
  assert.match(server, /\.\.\.\(typeof body\.plan === "string" && \(choice === "auto" \|\| choice === "acceptEdits"\) \? \{ plan: body\.plan\.slice\(0, 200_000\) \} : \{\}\)/);
  assert.match(server, /CODER_MEMORY_FILE: memFile, \.\.\.\(planBox && planBox\.current\(\) \? \{ CODER_PLAN_FILE: planBox\.current\(\) \} : \{\}\), CODER_SEEN_DIR/);
  const page = read("public/coder.js");
  assert.match(page, /if \(e\.tool === 'plan' && e\.withheld\) return \[\['no', 'No, keep planning'\]\];/);
  assert.match(page, /<p class="cd-perm-desc">Coder wants to exit plan mode<\/p>/);
  assert.match(page, /data-plan-edit="' \+ esc\(e\.pid\) \+ '">Edit plan<\/button>/);
  assert.match(page, /<textarea class="cd-perm-note cd-plan-text" data-plan-text="/);
  assert.match(page, /if \(e\.target\.matches && e\.target\.matches\('input, textarea'\)\) return;/);
  assert.match(page, /const planAt = document\.activeElement && document\.activeElement\.dataset && document\.activeElement\.dataset\.planText/);
  assert.match(page, /ans && typeof ans\.plan === 'string' \? ans\.plan/);
  assert.match(read("public/coder.css"), /\.cd-plan-edit \{/);
  // The machine's copy holds the module (CD78 checks every import).
  const copy = read("container/Dockerfile").split("\n").find((l) => /^COPY package\.json /.test(l));
  assert.ok(copy.includes(" coder-plan.mjs "));
});

test("PM17 the plan's card as the page draws it (its own functions): the plan with Edit plan, then the plan as text to edit; none: 'Coder wants to exit plan mode'; too long: Claude Code's line and only No; once approved: the plan as approved", () => {
  const src = read("public/coder.js");
  const grab = (name) => src.slice(src.indexOf("  function " + name + "("), src.indexOf("\n  }\n", src.indexOf("  function " + name + "(")) + 4);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const prose = new Function("esc", grab("noColor") + grab("inline") + grab("blocks") + grab("prose") + "return prose;")(esc);
  const S = { events: [], running: true };
  const { permOptions, permHTML } = new Function("S", "esc", "prose", "ICON", "PERM_TITLE", "blockLeft", "ruleShown", grab("permOptions") + grab("permDone") + grab("permHTML") + "return { permOptions, permHTML };")(S, esc, prose, { plan: "P", term: "T" }, {}, () => "", (r) => r);
  const card = { type: "permission", pid: "p1abc", tool: "plan", plan: "## Context\nFix the cart.\n" };
  S.events = [card];
  let h = permHTML(card);
  assert.match(h, /<div class="cd-plan-body">.*Fix the cart\./s);
  assert.match(h, /<button type="button" class="cd-plan-edit" data-plan-edit="p1abc">Edit plan<\/button>/);
  assert.deepEqual(permOptions(card).map(([c, l]) => [c, l]), [["auto", "Yes, and use auto mode"], ["acceptEdits", "Yes, and accept edits"], ["no", "No, keep planning"]], "Coder's options as before");
  S.planEdits = { p1abc: "## Context\nFix the cart <now>.\n" };
  h = permHTML(card);
  assert.match(h, /<textarea class="cd-perm-note cd-plan-text" data-plan-text="p1abc" rows="14" spellcheck="false" aria-label="Edit the plan">## Context\nFix the cart &lt;now&gt;\.\n<\/textarea>/);
  assert.ok(!h.includes("cd-plan-body"), "the text in place of the plan while it is edited");
  // Sent with a Yes: the edited plan shows until the answer comes; then the answer's plan.
  S.permSent = { p1abc: "acceptEdits" };
  assert.match(permHTML(card), /Fix the cart &lt;now&gt;\./);
  S.events = [card, { type: "permanswer", pid: "p1abc", choice: "acceptEdits", plan: "## Context\nThe owner's plan.\n" }];
  h = permHTML(card);
  assert.match(h, /<div class="cd-plan-body"><h4>Context<\/h4><p>The owner&#39;s plan\.<\/p><\/div>/);
  assert.match(h, /✓ Approved · Accept edits/);
  assert.ok(!h.includes("Edit plan"), "nothing to edit once answered");
  // No plan; one too long.
  S.events = []; S.permSent = {}; S.planEdits = {};
  const none = { type: "permission", pid: "p2abc", tool: "plan", plan: "" };
  S.events = [none];
  assert.match(permHTML(none), /<p class="cd-perm-desc">Coder wants to exit plan mode<\/p>/);
  const long = { type: "permission", pid: "p3abc", tool: "plan", plan: "", withheld: P.PLAN_WITHHELD };
  S.events = [long];
  assert.ok(permHTML(long).includes('<p class="cd-perm-desc">' + esc(P.PLAN_WITHHELD) + "</p>"));
  assert.deepEqual(permOptions(long), [["no", "No, keep planning"]]);
  // Another card is drawn as before.
  const bash = { type: "permission", pid: "p4abc", tool: "bash", lines: ["npm test"], why: "This command requires approval" };
  S.events = [bash];
  assert.match(permHTML(bash), /<pre class="cd-perm-pre">npm test<\/pre>/);
  assert.ok(!permHTML(bash).includes("Edit plan"));
});

test("PM18 plan mode's words, tool and checks load without Node's modules (Coder's Worker loads them through coder-perms.mjs); the plan file's store, which needs them, is its own file the machine copies", () => {
  const src = (f) => read("container/" + f);
  const imports = (f) => [...src(f).matchAll(/^\s*(?:import|export)\b[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.deepEqual(imports("coder-plan.mjs").filter((x) => x.startsWith("node:")), []);
  assert.deepEqual(imports("coder-plan-file.mjs").filter((x) => x.startsWith("node:")).sort(), ["node:fs", "node:fs/promises", "node:path"]);
  assert.ok(src("coder-perms.mjs").includes('from "./coder-plan.mjs"') && !src("coder-perms.mjs").includes("coder-plan-file.mjs"));
  assert.ok(src("server.mjs").includes('import { planStore, plansDirectoryFor, plansDirWarning } from "./coder-plan-file.mjs";'));
  // (Claude Code's input-error words, coder-zodtext.mjs, which plan mode's checks use: no Node module either.)
  assert.deepEqual(imports("coder-zodtext.mjs"), []);
  assert.ok(src("coder-plan.mjs").includes('from "./coder-zodtext.mjs"'));
  assert.equal(typeof P.planStore, "undefined", "the store is not in the words' file");
  const copy = src("Dockerfile").split("\n").find((l) => /^COPY package\.json /.test(l));
  for (const f of ["coder-plan.mjs", "coder-plan-file.mjs", "coder-zodtext.mjs"]) assert.ok(copy.includes(" " + f + " "), f);
});

// ── ENTER_PLAN_MODE, CLAUDE CODE'S EnterPlanMode (the owner, 2026-11-14: "Fix base on Claude Code docs, please") ────────────
test("PM19 enter_plan_mode as the model sees it: Claude Code 2.1.325's EnterPlanMode prompt word for word (Coder's names, 'the owner', no Agent tool), no input, its result; after ask_user, never from GitHub, gone under denyInsteadOfPrompting; its name for hooks and rules; refused inputs in Claude Code's words", () => {
  const d = P.ENTER_PLAN_DESC;
  assert.ok(d.startsWith("Use this tool proactively when you're about to start a non-trivial implementation task. Getting owner sign-off on your approach before writing code prevents wasted effort and ensures alignment. This tool transitions you into plan mode where you can explore the codebase and design an implementation approach for owner approval.\n\n## When to Use This Tool\n\n**Prefer using enter_plan_mode** for implementation tasks unless they're simple. Use it when ANY of these conditions apply:\n\n1. **New Feature Implementation**: Adding meaningful new functionality\n"));
  for (const part of [
    "7. **Owner Preferences Matter**: The implementation could reasonably go multiple ways\n   - If you would use ask_user to clarify the approach, use enter_plan_mode instead\n   - Plan mode lets you explore first, then present options with context\n\n## When NOT to Use This Tool\n\nOnly skip enter_plan_mode for simple tasks:\n",
    "- Tasks where the owner has given very specific, detailed instructions\n- Pure research/exploration tasks\n\n## What Happens in Plan Mode\n\nIn plan mode, you'll:\n1. Thoroughly explore the codebase using glob, grep, and read\n2. Understand existing patterns and architecture\n3. Design an implementation approach\n4. Present your plan to the owner for approval\n5. Use ask_user if you need to clarify approaches\n6. Exit plan mode with exit_plan_mode when ready to implement\n\n## Examples\n\n### GOOD - Use enter_plan_mode:\nOwner: \"Add user authentication to the app\"\n",
    "Owner: \"Update the error handling in the API\"\n- Affects multiple files, owner should approve the approach\n\n### BAD - Don't use enter_plan_mode:\nOwner: \"Fix the typo in the README\"\n- Straightforward, no planning needed\n",
  ]) assert.ok(d.includes(part), part);
  assert.ok(d.endsWith("## Important Notes\n\n- This tool REQUIRES owner approval - they must consent to entering plan mode\n- If unsure whether to use it, err on the side of planning - it's better to get alignment upfront than to redo work\n- The owner appreciates being consulted before significant changes are made to their codebase\n"));
  assert.ok(!/EnterPlanMode|ExitPlanMode|AskUserQuestion|Agent tool|\bUser:|the user\b(?! profile)|\bUsers\b|Claude\b/.test(d), "Coder's names (its example's \"the user profile\" stays); no Agent tool");
  assert.deepEqual(P.ENTER_PLAN_TOOL, { type: "function", function: { name: "enter_plan_mode", description: d, parameters: { type: "object", properties: {}, additionalProperties: false } } });
  assert.equal(P.ENTERED_PLAN, "Entered plan mode. You should now focus on exploring the codebase and designing an implementation approach.");
  assert.equal(P.ENTERED_PLAN_TEXT, P.ENTERED_PLAN + "\n\nIn plan mode, you should:\n1. Thoroughly explore the codebase to understand existing patterns\n2. Identify similar features and architectural approaches\n3. Consider multiple approaches and their trade-offs\n4. Use ask_user if you need to clarify the approach\n5. Design a concrete implementation strategy\n6. When ready, use exit_plan_mode to present your plan for approval\n\nRemember: DO NOT write or edit any files yet. This is a read-only exploration and planning phase.");
  assert.equal(P.ENTERED_PLAN_SHOWN, "Entered plan mode\nCoder is now exploring and designing an implementation approach.", "Claude Code's own line in the chat");
  // Where it is offered.
  const names = A.CODER_TOOLS.map((t) => t.function.name);
  assert.equal(names[names.indexOf("ask_user") + 1], "enter_plan_mode");
  assert.equal(A.CODER_TOOLS[names.indexOf("enter_plan_mode")], P.ENTER_PLAN_TOOL);
  assert.ok(!A.GITHUB_TOOLS.some((t) => t.function.name === "enter_plan_mode"), "a job from GitHub is no one's to ask (Claude Code's non-interactive runs have no EnterPlanMode)");
  assert.deepEqual(A.PROMPT_TOOLS, ["ask_user", "enter_plan_mode", "exit_plan_mode"], "left out under denyInsteadOfPrompting, as Claude Code leaves out AskUserQuestion, EnterPlanMode and ExitPlanMode");
  // Claude Code's name, for hooks and rules (a rule on the whole tool only).
  assert.equal(H.ccTool("enter_plan_mode"), "EnterPlanMode");
  assert.deepEqual([PERMS.parseRule("EnterPlanMode"), PERMS.parseRule("EnterPlanMode(*)"), PERMS.parseRule("EnterPlanMode(x)")], [{ tool: "EnterPlanMode", spec: null }, { tool: "EnterPlanMode", spec: null }, null]);
  // Its input: none (Claude Code's strict empty object), refused before any hook in its words.
  assert.deepEqual(P.checkEnterPlanInput({}), { args: {} });
  assert.deepEqual(P.checkEnterPlanInput({ reason: "big task" }), { error: "error: InputValidationError: EnterPlanMode failed due to the following issue:\nAn unexpected parameter `reason` was provided" });
  assert.deepEqual(P.checkEnterPlanInput({ a: 1, b: 2 }), { error: "error: InputValidationError: EnterPlanMode failed due to the following issues:\nAn unexpected parameter `a` was provided\nAn unexpected parameter `b` was provided" });
  // And plan mode's own words now that Coder has it (Claude Code's "To enter plan mode, call the EnterPlanMode tool first.").
  assert.equal(P.NOT_IN_PLAN_MODE, "error: You are not in plan mode. To enter plan mode, call the enter_plan_mode tool first. If your plan was already approved, continue with implementation.");
});

test("PM20 enter_plan_mode in a chat: no card (a session with a disk), the chat goes into Plan as the owner's mode menu would (the page and the saved chat follow), Claude Code's line in the chat, its result to Coder, plan mode with its plan file from the next step; its hooks see EnterPlanMode", async () => {
  const box = await newStore();
  const hooks = { PreToolUse: [{ matcher: "EnterPlanMode", hooks: [{ type: "command", command: "pre.sh" }] }], PostToolUse: [{ matcher: "EnterPlanMode", hooks: [{ type: "command", command: "post.sh" }] }], PermissionRequest: [{ matcher: "EnterPlanMode", hooks: [{ type: "command", command: "pr.sh" }] }] };
  const t = await loop([say("", [call("enter_plan_mode", {}, "e1")]), say("", [call("bash", { command: "ls src" }, "b1")]), say("Planning.")], { mode: "acceptEdits", plan: box, hooks });
  assert.equal(t.cards.length, 0, "no card: Claude Code asks only a session without a disk");
  assert.equal(t.told("e1"), P.ENTERED_PLAN_TEXT);
  assert.equal(t.r.mode, "plan");
  assert.deepEqual(t.events.filter((e) => e.type === "mode").map((e) => [e.mode, e.by]), [["plan", "enterPlan"]]);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === P.ENTERED_PLAN_SHOWN));
  // Before it: Accept edits (Coder's own note for it); after it: plan mode's reminder with the chat's plan file, in the
  // conversation; exit_plan_mode is listed all along, and the system message and tools stay the same (fix round 3).
  assert.equal(t.seen[0].messages.find((m) => m.modeNote).modeNote, "acceptEdits");
  assert.equal(t.seen[0].tools.find((x) => x.function.name === "exit_plan_mode"), P.EXIT_PLAN_TOOL);
  const f = box.current();
  assert.ok(f.startsWith(box.dir + "/fix-the-cart-total-") && f.endsWith(".md"), f);
  assert.deepEqual(t.seen[1].messages.at(-1), { role: "user", appNote: true, planReminder: "file", content: "(Note from Coder's app, not the owner:\n" + P.planModeNote({ file: f, exists: false }) + ")" });
  assert.equal(t.seen[1].tools.find((x) => x.function.name === "exit_plan_mode"), P.EXIT_PLAN_TOOL);
  assert.equal(t.seen[1].messages[0].content, t.seen[0].messages[0].content);
  assert.deepEqual(t.seen[1].tools, t.seen[0].tools);
  assert.ok(!t.seen[1].messages.some((m) => m.role === "user" && /permission mode is now|Exited/.test(m.content)), "Coder's own switch: no note of the owner's");
  assert.deepEqual(box.flags(), { exited: false, on: true });
  assert.deepEqual(t.ran.filter((x) => x.command).map((x) => x.command), ["ls src"], "read-only commands still run in Plan");
  // Its hooks: Claude Code's name, its empty input, its result object; no permission hook (no card).
  const pre = t.hookCalls.find((h) => h.hook_event_name === "PreToolUse");
  assert.deepEqual([pre.tool_name, pre.tool_input], ["EnterPlanMode", {}]);
  const post = t.hookCalls.find((h) => h.hook_event_name === "PostToolUse");
  // (Claude Code's result object only, as for every tool but the shells since the hooks fix of 2026-11-14: no `output`.)
  assert.deepEqual([post.tool_name, post.tool_input, post.tool_response], ["EnterPlanMode", {}, { message: P.ENTERED_PLAN }]);
  assert.equal(t.hookCalls.some((h) => h.hook_event_name === "PermissionRequest"), false);
  // The Worker saves the chat's mode from it, and the page's mode button follows it while the job runs.
  assert.match(read("src/coder-routes.mjs"), /e\.by === "hook" \|\| e\.by === "enterPlan"\)\)\.at\(-1\);/);
  assert.match(read("public/coder.js"), /e\.by === 'autoOff' \|\| e\.by === 'enterPlan'\)\)\.at\(-1\) : null;/);
  // Called again in Plan: the same answer, still Plan.
  const t2 = await loop([say("", [call("enter_plan_mode", {}, "e1")]), say("ok")], { plan: await newStore() });
  assert.deepEqual([t2.told("e1"), t2.r.mode, t2.cards.length], [P.ENTERED_PLAN_TEXT, "plan", 0]);
});

test("PM21 enter_plan_mode refused: an input it doesn't take (before any hook), a job from GitHub (no such tool), permissions.denyInsteadOfPrompting (no such tool, nor ask_user or exit_plan_mode, even in Plan), a deny rule (not offered)", async () => {
  const hooks = { PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "pre.sh" }] }] };
  let t = await loop([say("", [call("enter_plan_mode", { reason: "big" }, "e1")]), say("ok")], { mode: "auto", hooks });
  assert.equal(t.told("e1"), "error: InputValidationError: EnterPlanMode failed due to the following issue:\nAn unexpected parameter `reason` was provided");
  assert.equal(t.hookCalls.length, 0);
  assert.equal(t.r.mode, "auto");
  // From GitHub.
  t = await loop([say("", [call("enter_plan_mode", {}, "e1")]), say("ok")], { mode: "auto", extra: { github: true } });
  assert.ok(!t.seen[0].tools.some((x) => x.function.name === "enter_plan_mode"));
  assert.equal(t.told("e1"), "error: No such tool available: enter_plan_mode");
  assert.equal(t.events.some((e) => e.type === "mode"), false);
  // Under denyInsteadOfPrompting: none of the three, in Plan too (Claude Code: "a session in plan mode can't leave it on its own").
  const box = await newStore();
  await writeFile(await fileOf(box), PLAN);
  t = await loop([say("", [call("enter_plan_mode", {}, "e1"), call("exit_plan_mode", {}, "x1"), call("ask_user", { questions: [{ question: "Which?", header: "Pick", options: [{ label: "A", description: "a" }, { label: "B", description: "b" }], multiSelect: false }] }, "q1")]), say("Here is the plan.")], { plan: box, hooks, extra: { denyInstead: true } });
  for (const n of ["enter_plan_mode", "exit_plan_mode", "ask_user"]) assert.ok(!t.seen[0].tools.some((x) => x.function.name === n), n);
  assert.deepEqual([t.told("e1"), t.told("x1"), t.told("q1")], ["error: No such tool available: enter_plan_mode", "error: No such tool available: exit_plan_mode", "error: No such tool available: ask_user"]);
  assert.deepEqual([t.hookCalls.length, t.cards.length, t.r.mode], [0, 0, "plan"]);
  // A deny rule on the whole tool: not offered.
  t = await loop([say("ok")], { mode: "auto", extra: { rules: { allow: [], ask: [], deny: ["EnterPlanMode"] } } });
  assert.ok(!t.seen[0].tools.some((x) => x.function.name === "enter_plan_mode"));
  assert.ok(t.seen[0].tools.some((x) => x.function.name === "ask_user"));
});

test("PM22 enter_plan_mode and the modes around it, as Claude Code's: from Auto with Plan's checks off, '## Exited Auto Mode' at the next step (none with them on); a hook's approval returns to the mode it came from; 'Re-entering Plan Mode' after an approved plan; a plan-mode-exit note still owed is dropped", async () => {
  const autoNote = "(Note from Coder's app, not the owner:\n" + PERMS.AUTO_EXITED + ")";
  assert.equal(PERMS.AUTO_EXITED, "## Exited Auto Mode\n\nYou have exited auto mode. The owner may now want to interact more directly. You should ask clarifying questions when the approach is ambiguous rather than making assumptions.");
  let t = await loop([say("", [call("enter_plan_mode", {}, "e1")]), say("Planning.")], { mode: "auto" });
  assert.equal(t.seen[1].messages.at(-1).content, autoNote);
  assert.equal(t.seen[1].messages.filter((m) => m.content === autoNote).length, 1);
  t = await loop([say("", [call("enter_plan_mode", {}, "e1")]), say("Planning.")], { mode: "auto", extra: { checker: true } });
  assert.ok(!t.seen[1].messages.some((m) => /Exited Auto Mode/.test(String(m.content))), "Plan's checks on: auto mode goes on under Plan");
  t = await loop([say("", [call("enter_plan_mode", {}, "e1")]), say("Planning.")], { mode: "acceptEdits" });
  assert.ok(!t.seen[1].messages.some((m) => /Exited Auto Mode/.test(String(m.content))));
  // A PermissionRequest hook's approval goes back to the mode Coder entered Plan from (Claude Code's prePlanMode), not the
  // owner's start mode.
  let box = await newStore();
  const f = await fileOf(box);
  const PR = { PermissionRequest: [{ matcher: "ExitPlanMode", hooks: [{ type: "command", command: "pr.sh" }] }] };
  t = await loop([say("", [call("enter_plan_mode", {}, "e1")]), say("", [call("write", { path: f, content: PLAN }, "w1")]), say("", [call("exit_plan_mode", {}, "x1")]), say("Done.")], { mode: "acceptEdits", plan: box, hooks: PR, hookRun: (i) => ({ stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow", updatedInput: i.tool_input } } }) }), extra: { planExit: "auto" } });
  assert.equal(t.cards.length, 0);
  assert.ok(t.told("x1").startsWith("The owner has approved your plan."));
  assert.equal(t.r.mode, "acceptEdits");
  // Back in Plan after an approved plan whose file is there: Claude Code's re-entry note, once.
  box = await newStore();
  const f3 = await fileOf(box);
  await writeFile(f3, PLAN);
  box.setFlags({ exited: true });
  t = await loop([say("", [call("enter_plan_mode", {}, "e1")]), say("", [call("bash", { command: "ls" }, "b1")]), say("Planning.")], { mode: "acceptEdits", plan: box });
  assert.deepEqual(t.seen[1].messages.filter((m) => /Re-entering Plan Mode/.test(String(m.content))).map((m) => m.content), ["(Note from Coder's app, not the owner:\n" + P.planReentryNote(f3) + ")"]);
  assert.equal(t.seen[2].messages.filter((m) => /Re-entering Plan Mode/.test(String(m.content))).length, 1);
  assert.deepEqual(box.flags(), { exited: false, on: true });
  // A plan approved, then plan mode entered again before the next step: plan mode's end is no longer owed (Claude Code clears
  // it on entering Plan), and auto mode's end is.
  t = await loop([say("", [call("exit_plan_mode", { plan: "1. Fix it" }, "x1"), call("enter_plan_mode", {}, "e1")]), say("Planning again.")], { plan: null, answers: [{ choice: "auto" }] });
  assert.equal(t.told("e1"), P.ENTERED_PLAN_TEXT);
  assert.ok(!t.seen[1].messages.some((m) => /Exited Plan Mode/.test(String(m.content))));
  assert.equal(t.seen[1].messages.at(-1).content, autoNote);
  assert.equal(t.r.mode, "plan");
});

// ── THE PLAN AFTER A SUMMARY (Claude Code's plan_file_reference) ────────────────────────────────────────────────────────
test("PM23 after a summary the chat's plan file is put back in front of Coder, in Claude Code's words: once, by the job that next reads a summary made between messages; in a summary made in the job; not from GitHub; nothing when there is no plan", async () => {
  const K = await import("../container/coder-compact.mjs");
  assert.equal(P.planFileReference("/p/x.md", "1. A\n"), "A plan file exists from plan mode at: /p/x.md\n\nPlan contents:\n\n1. A\n\n\nIf this plan is relevant to the current work and not already complete, continue working on it.");
  assert.equal(P.planFileReference("", "1. A"), "A plan exists from plan mode.\n\nPlan contents:\n\n1. A\n\nIf this plan is relevant to the current work and not already complete, continue working on it.");
  const sum = K.summaryMessage("We fixed half the cart.", "the earlier jobs of this chat, summarized to make room");
  assert.equal(sum.planRef, true, "every summary owes the plan to the job that next reads it");
  let box = await newStore();
  const f = await fileOf(box);
  await writeFile(f, PLAN);
  const ref = "(Note from Coder's app, not the owner:\n" + P.planFileReference(f, PLAN) + ")";
  let t = await loop([say("Done.")], { mode: "auto", plan: box, extra: { messages: [sum, { role: "assistant", content: "Half done." }] } });
  assert.deepEqual(t.seen[0].messages.filter((m) => m.content === ref).map((m) => [m.role, m.appNote]), [["user", true]]);
  assert.equal(t.r.messages[0].planRef, undefined, "given now, so no longer owed");
  assert.equal(t.r.messages[0].content, sum.content);
  // The next job: not again.
  const t2 = await loop([say("Done.")], { mode: "auto", plan: box, text: "next", extra: { messages: t.r.messages } });
  assert.equal(t2.seen[0].messages.filter((m) => m.content === ref).length, 1, "not again: only the first, in the chat's history");
  // From GitHub: left for the owner's next message.
  t = await loop([say("Done.")], { plan: box, extra: { github: true, messages: [sum, { role: "assistant", content: "Half done." }] } });
  assert.ok(!t.seen[0].messages.some((m) => m.content === ref));
  assert.equal(t.r.messages[0].planRef, true);
  // No plan written: nothing, and nothing owed.
  box = await newStore();
  await fileOf(box);
  t = await loop([say("Done.")], { mode: "auto", plan: box, extra: { messages: [sum, { role: "assistant", content: "Half done." }] } });
  assert.ok(!t.seen[0].messages.some((m) => /A plan file exists from plan mode/.test(String(m.content))));
  assert.equal(t.r.messages[0].planRef, undefined);
  // A summary made in the job: the plan right after it, in the same message.
  box = await newStore();
  const g = await fileOf(box);
  await writeFile(g, PLAN);
  let n = 0;
  const r = await A.runCoder({
    compactAt: 6000, plan: box,
    send: async (q) => {
      if (!q.tools || !q.tools.length) return { message: { role: "assistant", content: "SUMMARY" }, usage: { in: 1, out: 1 } };
      n++;
      return n <= 14 ? { message: { role: "assistant", content: "", tool_calls: [call("bash", { command: "echo " + n }, "b" + n)] } } : { message: { role: "assistant", content: "All done." } };
    },
    exec: async () => ({ code: 0, output: "z".repeat(900) }),
  }, { text: "Do the big job", mode: "auto" });
  const s = r.messages.find((m) => K.isSummary(m));
  assert.ok(s, "summarized");
  assert.ok(s.content.endsWith("\nSUMMARY\n\n(Note from Coder's app, not the owner:\n" + P.planFileReference(g, PLAN) + ")"), s.content);
  assert.equal(s.planRef, undefined);
});

// ── THE REPOSITORY'S plansDirectory (Claude Code 2.1.325's, with its fallback) ───────────────────────────────────────────
test("PM24 plansDirectory as Claude Code 2.1.325 takes it: resolved from the project's folder, used only inside it (no backslash, no link out); the plan file there, read and written only while its folder is shown to be in the project; else the default folder under a new name, kept from then on, with Claude Code's notice", async () => {
  const { mkdir, rm } = await import("node:fs/promises");
  const { dirname, basename } = await import("node:path");
  const root = await tmp("proj"), out = await tmp("out");
  assert.equal(await PF.plansDirectoryFor("plans", root), join(root, "plans"));
  assert.equal(await PF.plansDirectoryFor("docs/plans/", root), join(root, "docs/plans"), "not there yet: the nearest folder of it that is there is in the project");
  assert.equal(await PF.plansDirectoryFor(".", root), root);
  assert.equal(await PF.plansDirectoryFor(join(root, "abs"), root), join(root, "abs"), "an absolute path inside the project");
  for (const bad of ["../plans", "/etc/plans", "plans\\mine", "", "a/../../x"]) assert.equal(await PF.plansDirectoryFor(bad, root), null, bad);
  await symlink(out, join(root, "linked"));
  assert.equal(await PF.plansDirectoryFor("linked/plans", root), null, "a link out of the project");
  assert.equal(PF.plansDirWarning("../plans"), "plansDirectory must be within project root, with no backslash in its path off Windows: ../plans");
  assert.equal(PF.PLANS_DIR_UNCONTAINED, "Could not confirm the plansDirectory folder and plan file are inside this project. Check that the folder exists, that no link leads out of it, and that the plan file is not a link and has no hard link. If this system or drive cannot report that, remove plansDirectory from your settings to use the default plans folder.");
  // The plan file in it.
  const custom = join(root, "plans");
  await mkdir(custom);
  const dir = await tmp("dir"), stateFile = join(await tmp("state"), "plan.json");
  const open = () => PF.planStore({ dir, stateFile, rand: () => 0, custom: { dir: custom, root } });
  const box = open();
  const f = await box.name("Fix the cart total please");
  assert.equal(dirname(f), custom);
  await writeFile(f, PLAN);
  assert.equal(await box.read(), PLAN);
  assert.deepEqual(await box.save("1. Mine\n"), { saved: true });
  assert.equal(readFileSync(f, "utf8"), "1. Mine\n");
  // Its folder swapped for a link out of the project: not read through it, never written there; write() (no move) says no;
  // save() puts the plan in the default folder under a new name, which the chat keeps.
  await rm(custom, { recursive: true });
  await symlink(out, custom);
  await writeFile(join(out, basename(f)), "outside");
  assert.equal(await box.read(), null);
  assert.equal(await box.write("1. Again\n"), false);
  const r = await box.save("1. Again\n");
  assert.equal(dirname(r.savedTo), dir);
  assert.notEqual(basename(r.savedTo), basename(f), "a new name");
  assert.equal(r.notice, "The approved plan was saved to " + r.savedTo + ", which this session uses from now on. It could not be saved to " + f + ": " + PF.PLANS_DIR_UNCONTAINED);
  assert.equal(readFileSync(r.savedTo, "utf8"), "1. Again\n");
  assert.equal(readFileSync(join(out, basename(f)), "utf8"), "outside", "nothing written out of the project");
  assert.equal(box.current(), r.savedTo);
  assert.equal(open().current(), r.savedTo, "kept with the chat");
  assert.equal(await open().read(), "1. Again\n");
  // A plan file that is a hard link there: not read.
  const custom2 = join(root, "plans2");
  await mkdir(custom2);
  const box2 = PF.planStore({ dir, stateFile: join(await tmp("state"), "plan.json"), rand: () => 0, custom: { dir: custom2, root } });
  const f2 = await box2.name("x");
  await writeFile(join(root, "other.md"), "other");
  await link(join(root, "other.md"), f2);
  assert.equal(await box2.read(), null);
});

test("PM25 Coder's machine with a repository's plansDirectory: the chat's plan file in that folder of the project (the AI writes it, the owner's card shows it), kept inside the project by the tools script; one outside the project: the chat's own plans folder, with Claude Code's warning in the chat", async () => {
  const S = await import("../container/server.mjs");
  const http = (await import("node:http")).default;
  const { mkdir } = await import("node:fs/promises");
  // The tools script: a plan file in the project is kept inside it (no link out), and no hard link.
  const root = await tmp("root"), out = await tmp("out");
  const tool = (req, env = {}) => {
    const x = spawnSync("node", ["--no-warnings", new URL("../container/coder-tools.mjs", import.meta.url).pathname, Buffer.from(JSON.stringify(req)).toString("base64")], { cwd: root, encoding: "utf8", env: { ...process.env, ...env } });
    return String(x.stdout || "") + String(x.stderr || "");
  };
  const inside = join(root, "plans", "fix-it.md");
  tool({ tool: "write", args: { path: inside, content: PLAN } }, { CODER_PLAN_FILE: inside });
  assert.equal(readFileSync(inside, "utf8"), PLAN, "its folder made, as for any file of the project");
  await symlink(out, join(root, "away"));
  const away = join(root, "away", "fix-it.md");
  assert.match(tool({ tool: "write", args: { path: away, content: "x" } }, { CODER_PLAN_FILE: away }), /leads outside the project/);
  assert.equal(existsSync(join(out, "fix-it.md")), false);
  await writeFile(join(root, "twin.md"), "twin");
  const hard = join(root, "plans", "hard.md");
  await link(join(root, "twin.md"), hard);
  assert.match(tool({ tool: "write", args: { path: hard, content: "x" } }, { CODER_PLAN_FILE: hard }), /the plan file is not a plain file/);
  assert.equal(readFileSync(join(root, "twin.md"), "utf8"), "twin");
  // The machine.
  const run = async (plansDirectory, turns = 1) => {
    const r = { root: await tmp("root"), gitRoot: await tmp("git"), memRoot: await tmp("mem"), bgRoot: await tmp("bg"), home: await tmp("home") };
    const project = "pm-dir-" + Math.random().toString(36).slice(2, 8);
    await mkdir(join(r.root, project, ".claude"), { recursive: true });
    await writeFile(join(r.root, project, ".claude", "settings.json"), JSON.stringify({ plansDirectory }));
    const seen = [];
    let n = 0, file = "";
    const app = S.createApp({ ...r, send: async (req) => {
      seen.push(req);
      const k = n++;
      if (k === 0) { file = (/create your plan at (\S+) using the write tool/.exec(req.messages.map((m) => String(m.content)).join("\n")) || [])[1] || ""; return say("", [call("write", { path: file, content: PLAN }, "w1")]); }
      if (k === 1) return say("", [call("exit_plan_mode", {}, "x1")]);
      return say("Done.");
    } });
    const srv = http.createServer(app);
    await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
    const base = "http://127.0.0.1:" + srv.address().port;
    const sts = [];
    try {
      for (let turn = 0; turn < turns; turn++) {
        const sent = await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, text: "Plan the cart fix", messages: [], mode: "plan" }) });
        assert.equal(sent.status, 200);
        let st;
        const answered = new Set();
        for (let i = 0; i < 600; i++) {
          st = await (await fetch(base + "/state?project=" + project + "&since=0")).json();
          for (const e of st.events || []) {
            if (e.type !== "permission" || answered.has(e.pid)) continue;
            const a = await (await fetch(base + "/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, pid: e.pid, choice: "acceptEdits" }) })).json();
            if (a.ok) answered.add(e.pid);
          }
          if (st.result) break;
          await new Promise((ok) => setTimeout(ok, 50));
        }
        assert.ok(st && st.result, "the message ended");
        sts.push(st);
      }
      return { r, project, file, st: sts[0], sts, seen };
    } finally { srv.close(); }
  };
  let x = await run("plans");
  assert.ok(x.file.startsWith(join(x.r.root, x.project, "plans") + "/plan-the-cart-fix-") && x.file.endsWith(".md"), x.file);
  assert.equal(readFileSync(x.file, "utf8"), PLAN, "the AI's write reached it");
  assert.equal(x.st.events.find((e) => e.type === "permission" && e.tool === "plan").plan, PLAN);
  assert.ok(x.seen[2].messages.find((m) => m.role === "tool" && m.tool_call_id === "x1").content.includes("Your plan has been saved to: " + x.file + "\n"));
  assert.ok(!x.st.events.some((e) => e.type === "note" && /plansDirectory/.test(String(e.text))));
  x = await run("../elsewhere", 2);
  assert.ok(x.file.startsWith(join(x.r.memRoot, x.project + ".plans") + "/"), x.file);
  const warned = (st) => st.events.filter((e) => e.type === "note" && e.warn === true && e.text === "plansDirectory must be within project root, with no backslash in its path off Windows: ../elsewhere").length;
  assert.deepEqual(x.sts.map(warned), [1, 0], "told once a chat (Claude Code only logs it)");
  // The repository's setting as read: the later file's (settings.local.json over settings.json).
  const proj = await tmp("proj");
  await mkdir(join(proj, ".claude"));
  await writeFile(join(proj, ".claude", "settings.json"), JSON.stringify({ plansDirectory: "a" }));
  assert.equal(S.repoSettings(proj).plansDir, "a");
  await writeFile(join(proj, ".claude", "settings.local.json"), JSON.stringify({ plansDirectory: "b" }));
  assert.equal(S.repoSettings(proj).plansDir, "b");
  assert.equal(S.repoSettings(proj, { github: true }).plansDir, "", "none in a job from GitHub");
});

test("PM26 the words typed on the plan's card go to Coder with every Yes, 'Yes, and use auto mode' too (Claude Code 2.1.325: \"shift+tab to approve with this feedback\"); a command's card keeps Claude Code's: no note with 'don't ask again' or 'switch to auto mode'", async () => {
  const ui = read("public/coder.js");
  assert.match(ui, /const isPlan = !!\(card && card\.tool === 'plan'\);\n\s+const comment = !isPlan && \(choice === 'always' \|\| choice === 'auto'\) \? '' : String\(\(S\.permNotes && S\.permNotes\[pid\]\) \|\| ''\)\.trim\(\)\.slice\(0, 2000\);/);
  assert.ok(ui.includes("placeholder=\"' + (plan ? 'Tell Coder what to change' : 'Add a note for Coder (optional)') + '\""), "the plan's note is not only for No");
  // The machine passes it on with the approval, Yes and use auto mode included.
  const box = await newStore();
  await writeFile(await fileOf(box), PLAN);
  const t = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("Done.")], { plan: box, answers: [{ choice: "auto", comment: "start with the tests" }] });
  // (As Claude Code gives them, fix round 3: exactly as typed, as the owner's own text right after the round's results; never
  // wrapped in a sentence of Coder's, nor in the tool's result.)
  assert.ok(!t.told("x1").includes("start with the tests"));
  assert.equal(t.r.messages.find((m) => m.role === "tool" && m.tool_call_id === "x1").words, "start with the tests");
  const next = t.seen[1].messages, at = next.findIndex((m) => m.role === "tool" && m.tool_call_id === "x1");
  assert.deepEqual(next[at + 1], { role: "user", content: "start with the tests" });
  assert.equal(t.r.mode, "auto");
});

test("PM27 auto mode's note is Claude Code 2.1.325's reminder ('## Auto Mode Active', with its 'If the user, a skill, or the shape of the task suggests they want you to ask'), Coder's names; leaving it, its '## Exited Auto Mode'", () => {
  assert.equal(PERMS.AUTO_NOTE, "## Auto Mode Active\n\nBias toward working without stopping for clarifying questions — when you'd normally pause to check, make the reasonable call and keep going; they'll redirect you if needed. If the owner, a skill, or the shape of the task suggests they want you to ask (with ask_user or otherwise), do so. And even absent that signal, it's still fine to stop when you're genuinely blocked — unclear direction, missing input, a decision only they can make.\n\nBefore any command that could discard uncommitted work — `git checkout`/`restore`/`reset`/`clean`, `rm -rf` in the repo, restoring from a snapshot — run `git status` first and stash (with `-u` for untracked) or commit anything that's there. When staging or committing, review what's included (`git status` after a broad `git add`), and if you see anything suspicious that might reveal secrets — even if the filename looks innocuous — double-check the file's contents before pushing.");
  assert.equal(A.modeSystem("auto"), "PERMISSION MODE: Auto (the owner's pick).\n" + PERMS.AUTO_NOTE);
  assert.equal(PERMS.AUTO_EXITED, "## Exited Auto Mode\n\nYou have exited auto mode. The owner may now want to interact more directly. You should ask clarifying questions when the approach is ambiguous rather than making assumptions.");
  assert.equal(A.modeChangeNote("auto", "acceptEdits"), "(Note from Coder's app, not the owner:\n" + PERMS.AUTO_EXITED + "\n\nThe owner's permission mode is now Accept edits.)");
  assert.ok(!/AskUserQuestion|the user\b|Claude\b/.test(PERMS.AUTO_NOTE + PERMS.AUTO_EXITED));
});

test("PM28 fix round 3 (T4): plan mode's reminder as Claude Code 2.1.325 gives it: its short line word for word from its program (with a plan file, without one, with exit_plan_mode denied), and its cadence: at most once every 5 of the owner's messages, the whole of it the first time and every 5th time, the short line between; the whole of it again when where the plan goes changed, and after plan mode was left", () => {
  const f = "/data/memory/c1.plans/fix-the-cart-total-abundant-aurora.md";
  assert.equal(P.planModeSparse({ file: f }), "Plan mode still active (see full instructions earlier in conversation). Read-only except plan file (" + f + "). Follow 5-phase workflow. End turns with ask_user (for clarifications) or exit_plan_mode (for plan approval). Never ask about plan approval via text or ask_user.");
  assert.equal(P.planModeSparse(), "Plan mode still active (see full instructions earlier in conversation). Read-only, and there is no plan file. Follow 5-phase workflow. When the plan is final, call exit_plan_mode with it as `plan`. Never ask about plan approval via text or ask_user.");
  assert.equal(P.planModeSparse({ exitOffered: false }), "Plan mode still active (see full instructions earlier in conversation). Read-only, and there is no plan file. Follow 5-phase workflow. When the plan is final, give it in your reply. Only the owner can end plan mode, by changing the session's permission mode.");
  assert.deepEqual([P.PLAN_REMINDER_TURNS, P.PLAN_FULL_EVERY], [5, 5], "Claude Code's TURNS_BETWEEN_ATTACHMENTS and FULL_REMINDER_EVERY_N_ATTACHMENTS");
  assert.deepEqual([P.planKind({ file: f }), P.planKind({}), P.planKind({ exitOffered: false })], ["file", "exit", "reply"]);
  // The cadence, over a chat in plan mode: an owner's message, then the reminder due before the next step.
  const owner = (t) => ({ role: "user", content: t });
  const convo = [];
  const due = [];
  for (let n = 1; n <= 13; n++) {
    convo.push(owner("message " + n));
    const d = P.planReminderDue(convo, { kind: "file", skipFrom: convo.length - 1 });
    due.push(d || "-");
    if (d) convo.push({ role: "user", appNote: true, planReminder: "file", content: d });
    convo.push({ role: "assistant", content: "ok" });
  }
  assert.deepEqual(due, ["full", "-", "-", "-", "-", "-", "sparse", "-", "-", "-", "-", "-", "sparse"], "a job's first step counts the messages before its own (Claude Code decides before it adds it)");
  // Mid-turn (after a tool step) its own message counts: the 5th after the last reminder makes one due then.
  const mid = [owner("a"), { role: "user", appNote: true, planReminder: "file", content: "full" }, owner("b"), owner("c"), owner("d"), owner("e")];
  assert.equal(P.planReminderDue(mid, { kind: "file", skipFrom: mid.length - 1 }), null);
  assert.equal(P.planReminderDue([...mid, owner("f")], { kind: "file" }), "sparse");
  // The 5th reminder is short, the 6th whole again.
  const four = [owner("x"), ...[1, 2, 3, 4, 5].map(() => ({ role: "user", appNote: true, planReminder: "file", content: "r" }))];
  assert.equal(P.planReminderDue([...four.slice(0, 5), ...[1, 2, 3, 4, 5].map((i) => owner("m" + i))], { kind: "file" }), "sparse", "the 5th");
  assert.equal(P.planReminderDue([...four, ...[1, 2, 3, 4, 5].map((i) => owner("m" + i))], { kind: "file" }), "full", "the 6th");
  // Where the plan goes changed (a plan file came or went, exit_plan_mode denied): the whole one at once.
  assert.equal(P.planReminderDue([owner("a"), { role: "user", appNote: true, planReminder: "exit", content: "r" }], { kind: "file" }), "full");
  // After plan mode was left ("## Exited Plan Mode"): the whole one again, the count from there.
  assert.equal(P.planReminderDue([owner("a"), { role: "user", appNote: true, planReminder: "file", content: "r" }, { role: "user", appNote: true, content: "(Note from Coder's app, not the owner:\n" + P.PLAN_EXITED + ")" }, owner("b")], { kind: "file" }), "full");
  // Notes of Coder's app, summaries and messages sent while Coder worked are not the owner's messages (the caller says which).
  assert.equal(P.planReminderDue([owner("a"), { role: "user", appNote: true, planReminder: "file", content: "r" }, ...[1, 2, 3, 4, 5].map(() => ({ role: "user", appNote: true, content: "note" }))], { kind: "file" }), null);
  assert.equal(A.ownersMessage({ role: "user", content: A.queuedNote("x") }), false);
  assert.equal(A.ownersMessage({ role: "user", content: "fix it" }), true);
  assert.equal(A.ownersMessage({ role: "user", appNote: true, content: "x" }), false);
});

test("PM29 fix round 3 (T4, the coordinator's check): the system message is byte-identical for the whole chat, across the owner's mode changes mid-job and the plan file's first write, and so are the tools (exit_plan_mode listed in every mode); the notes of the modes are in the conversation, as Claude Code places them: plan mode's reminder, its end, auto mode's note and its end, each once; Coder's own Accept edits note once in that mode", async () => {
  const box = await newStore();
  const f = await fileOf(box);
  // Plan (the plan file written), then Auto, then Accept edits, then Auto again: the owner switches as Coder works.
  const t = await loop([
    say("", [call("write", { path: f, content: PLAN }, "w1")]),
    say("", [call("bash", { command: "ls" }, "b1")]),
    say("", [call("bash", { command: "ls src" }, "b2")]),
    say("", [call("bash", { command: "ls test" }, "b3")]),
    say("Done."),
  ], { plan: box, modeOf: (n) => (n < 2 ? "plan" : n < 3 ? "auto" : n < 4 ? "acceptEdits" : "auto") });
  assert.equal(t.seen.length, 5);
  for (const req of t.seen) {
    assert.equal(req.messages[0].content, t.seen[0].messages[0].content, "the system message never changes");
    assert.deepEqual(req.tools, t.seen[0].tools, "nor the tools");
  }
  assert.ok(!/PERMISSION MODE|Plan mode is active|Auto Mode Active/.test(t.seen[0].messages[0].content));
  assert.ok(t.seen[0].tools.some((x) => x.function.name === "exit_plan_mode"));
  const all = t.seen[4].messages;
  const kinds = all.filter((m) => m.role === "user" && m.appNote).map((m) => m.planReminder ? "plan:" + m.planReminder : m.modeNote ? "mode:" + m.modeNote : /The owner's permission mode is now (\w[\w ]*)/.test(m.content) ? "now:" + /The owner's permission mode is now (\w[\w ]*)/.exec(m.content)[1] : "other");
  assert.deepEqual(kinds, ["plan:file", "now:Auto", "mode:auto", "now:Accept edits", "mode:acceptEdits", "now:Auto", "mode:auto"]);
  assert.equal(all.filter((m) => typeof m.content === "string" && m.content.includes("## Exited Plan Mode")).length, 1);
  assert.equal(all.filter((m) => typeof m.content === "string" && m.content.includes("## Exited Auto Mode")).length, 1);
  // Between two messages: a chat left in Auto now in Accept edits is told auto mode's end (and Coder's Accept edits note) once.
  const next = await loop([say("", [call("bash", { command: "ls" }, "b9")]), say("Done.")], { plan: box, mode: "acceptEdits", extra: { messages: t.r.messages } });
  const told = next.seen[1].messages.slice(t.r.messages.length);
  assert.deepEqual(told.filter((m) => m.appNote).map((m) => (m.modeNote ? "mode:" + m.modeNote : m.content.includes("## Exited Auto Mode") ? "auto ended" : "other")), ["auto ended", "mode:acceptEdits"]);
  assert.equal(next.seen[1].messages[0].content, t.seen[0].messages[0].content);
});

test("PM30 fix round 3 (T4, T5): no note of a mode in a job from GitHub (its own note stays in the system message) nor at the first step after the owner's own command (Claude Code gives none for a shell-mode message); auto mode's note once while it lasts, kept off while planning with auto mode's checks; with tool search off exit_plan_mode is listed in every mode and refused out of plan mode in Claude Code's words", async () => {
  // A job from GitHub: no notes, its system message as before.
  const gh = await loop([say("Done.")], { mode: "auto", plan: null, extra: { github: true } });
  assert.ok(!gh.seen[0].messages.some((m) => m.modeNote || m.planReminder));
  assert.ok(gh.seen[0].messages[0].content.endsWith(A.GITHUB_NOTE));
  assert.ok(!gh.seen[0].tools.some((x) => x.function.name === "exit_plan_mode"), "Claude Code offers ExitPlanMode only where someone can be asked");
  // Auto: its note once, after the owner's message; not again in later steps or the next message.
  const a = await loop([say("", [call("bash", { command: "ls" }, "b1")]), say("Done.")], { mode: "auto", plan: null });
  assert.deepEqual(a.seen[0].messages.slice(1).map((m) => m.modeNote || m.role), ["user", "auto"]);
  assert.equal(a.seen[0].messages[2].content, "(Note from Coder's app, not the owner:\n" + PERMS.AUTO_NOTE + ")");
  assert.equal(a.seen[1].messages.filter((m) => m.modeNote === "auto").length, 1);
  const a2 = await loop([say("Done.")], { mode: "auto", plan: null, extra: { messages: a.r.messages } });
  assert.equal(a2.seen[0].messages.filter((m) => m.modeNote === "auto").length, 1, "still the one from before");
  // The owner's own command: no note at its first step, then as usual.
  const sh = await loop([say("", [call("bash", { command: "ls" }, "b1")]), say("Done.")], { mode: "auto", plan: null, text: "", extra: { shell: "npm test" } });
  assert.ok(!sh.seen[0].messages.some((m) => m.modeNote), "none at the first step after a shell-mode message");
  assert.equal(sh.seen[1].messages.filter((m) => m.modeNote === "auto").length, 1, "after the first tool step");
  // Planning with auto mode's checks on: auto mode goes on under plan mode, so no "## Exited Auto Mode" (Claude Code's).
  const pc = await loop([say("Planning.")], { mode: "plan", plan: null, extra: { messages: a.r.messages, checker: true } });
  assert.ok(!pc.seen[0].messages.some((m) => typeof m.content === "string" && m.content.includes("## Exited Auto Mode")));
  const po = await loop([say("Planning.")], { mode: "plan", plan: null, extra: { messages: a.r.messages } });
  assert.equal(po.seen[0].messages.filter((m) => typeof m.content === "string" && m.content.includes("## Exited Auto Mode")).length, 1);
  // T5: exit_plan_mode in Auto (tool search off), in the form the plan file asks for; a call there is refused, Claude Code's words.
  const box = await newStore();
  const x = await loop([say("", [call("exit_plan_mode", {}, "x1")]), say("Done.")], { mode: "auto", plan: box });
  assert.equal(x.seen[0].tools.find((y) => y.function.name === "exit_plan_mode"), P.EXIT_PLAN_TOOL);
  assert.equal(x.told("x1"), P.NOT_IN_PLAN_MODE);
  assert.equal(x.cards.length, 0);
  const nf = await loop([say("Done.")], { mode: "acceptEdits", plan: null });
  assert.equal(nf.seen[0].tools.find((y) => y.function.name === "exit_plan_mode"), P.EXIT_PLAN_TOOL_NO_FILE);
  // Denied by a rule, or under denyInsteadOfPrompting: not listed, in any mode.
  const dn = await loop([say("Done.")], { mode: "auto", plan: box, extra: { rules: { allow: [], ask: [], deny: ["ExitPlanMode"] } } });
  assert.ok(!dn.seen[0].tools.some((y) => y.function.name === "exit_plan_mode"));
  const di = await loop([say("Done.")], { mode: "auto", plan: box, extra: { denyInstead: true } });
  assert.ok(!di.seen[0].tools.some((y) => y.function.name === "exit_plan_mode"));
});
