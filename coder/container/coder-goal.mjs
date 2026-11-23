/**
 * CLAUDE CODE'S /goal (its docs, "Keep Claude working toward a goal", 2026-11-23): a completion condition for the chat, up to
 * 4,000 characters. Setting one starts a turn with the condition itself as the message. After each turn a model (Coder's own,
 * at Low effort, as a session-scoped prompt-based Stop hook) checks the condition against the conversation and answers one
 * of three verdicts:
 *   - not yet met: Coder keeps working, with the reason as guidance for the next turn;
 *   - met: the goal clears, and an achieved entry shows in the chat;
 *   - impossible: the goal clears, and a failed entry shows with the reason.
 * A turn that ends while a background command or agent still runs is not checked (the next one is). When Coder answers the
 * evaluator without using a tool GOAL_IDLE_MAX times in a row, the loop stops with a warning and the goal stays set.
 * `/goal` alone shows its status; `/goal clear` (or stop, off, reset, none, cancel) clears it; /clear removes it too.
 * Used by Coder's machine (coder-agent.mjs) and its Worker (src/coder-routes.mjs).
 */

/** The longest condition (Claude Code's: "The condition can be up to 4,000 characters"). */
export const GOAL_MAX = 4000;
/** Not-met verdicts in a row with no tool use before the loop stops (Claude Code's "several turns in a row"). */
export const GOAL_IDLE_MAX = 3;
/** The words that clear a goal. */
export const GOAL_CLEAR_WORDS = Object.freeze(["clear", "stop", "off", "reset", "none", "cancel"]);

/**
 * The owner's /goal command read: null when the text is not one; else `{ kind: "status" }`, `{ kind: "clear" }`,
 * `{ kind: "set", condition }` or `{ kind: "error", error }`.
 */
export function parseGoalCmd(text) {
  const m = /^\/goal(?:\s+([\s\S]*))?$/i.exec(String(text || "").trim());
  if (!m) return null;
  const arg = String(m[1] || "").trim();
  if (!arg) return { kind: "status" };
  if (GOAL_CLEAR_WORDS.includes(arg.toLowerCase())) return { kind: "clear" };
  if (arg.length > GOAL_MAX) return { kind: "error", error: "A goal condition can be up to " + GOAL_MAX.toLocaleString("en-US") + " characters (this one has " + arg.length.toLocaleString("en-US") + ")." };
  return { kind: "set", condition: arg };
}

/** How long, said short: "45s", "12m", "1h 5m". */
export function goalAge(ms) {
  const s = Math.max(0, Math.round(Number(ms) / 1000) || 0);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m";
  return Math.floor(m / 60) + "h " + (m % 60) + "m";
}

/** `/goal` alone: the active goal's condition, how long it has run, its turns, tokens and last reason; or the achieved one. */
export function goalStatus(goal, done, now = Date.now()) {
  if (goal && typeof goal.condition === "string") {
    const lines = ["◎ /goal active · " + goalAge(now - Number(goal.at || now)), "Condition: " + goal.condition];
    if (Number(goal.turns) > 0) lines.push("Turns evaluated: " + goal.turns, "Tokens: " + (Number(goal.tokens) || 0).toLocaleString("en-US"));
    if (goal.reason) lines.push("Last check: " + goal.reason);
    return lines.join("\n");
  }
  if (done && typeof done.condition === "string" && done.state === "met") return "No goal set. Achieved earlier: " + done.condition + "\n" + goalAge(Number(done.ms) || 0) + " · " + (Number(done.turns) || 0) + " turns · " + (Number(done.tokens) || 0).toLocaleString("en-US") + " tokens";
  return "No goal set";
}

/** The evaluator's instructions (Claude Code's prompt-based Stop hook verdicts: met, not yet met, impossible). */
export const GOAL_JUDGE = "You judge whether an AI coding agent has reached the goal its owner set. You do not run commands or read files: judge only from what the conversation below shows. Answer with one JSON object and nothing else: {\"ok\": true, \"reason\": \"<one sentence>\"} when the condition holds; {\"ok\": false, \"reason\": \"<one or two sentences on what is still missing>\"} when it does not yet hold; add \"impossible\": true when the condition can never be met.";

/** The conversation as the evaluator reads it: its newest part, at most `max` characters. */
export function goalTranscript(convo, max = 60000) {
  const part = (x, n) => { const t = typeof x === "string" ? x : Array.isArray(x) ? x.map((p) => (p && typeof p.text === "string" ? p.text : "")).join("\n") : ""; return t.length > n ? t.slice(0, n) + " …" : t; };
  const lines = [];
  for (const m of Array.isArray(convo) ? convo : []) {
    if (!m || typeof m !== "object") continue;
    if (m.role === "user") lines.push((m.appNote ? "[Coder's app] " : "[Owner] ") + part(m.content, 4000));
    else if (m.role === "assistant") {
      const said = part(m.content, 4000);
      if (said.trim()) lines.push("[Agent] " + said);
      for (const c of Array.isArray(m.tool_calls) ? m.tool_calls : []) lines.push("[Agent calls " + String((c && c.function && c.function.name) || "tool") + "] " + part(String((c && c.function && c.function.arguments) || ""), 1000));
    } else if (m.role === "tool") lines.push("[Result] " + part(m.content, 3000));
  }
  let out = lines.join("\n");
  if (out.length > max) out = "…\n" + out.slice(out.length - max);
  return out;
}

/** What the evaluator is asked. */
export const goalAsk = (condition, convo) => "The goal's condition:\n" + String(condition) + "\n\nThe conversation so far:\n" + goalTranscript(convo);

/** The note Coder gets when the goal is not yet met. */
export const goalNotMetNote = (condition, reason) => "(Note from Coder's app, not the owner: the goal set with /goal is not yet met" + (reason ? ": " + reason : ".") + " Keep working toward it. The goal: " + condition + ")";

/** The chat's goal after a turn, from the turn's `goal` result: `{ goal, goalDone }` for the chat's record. */
export function goalAfter(goal, out, now = Date.now()) {
  if (!goal || typeof goal.condition !== "string" || !out || typeof out !== "object") return {};
  const turns = (Number(goal.turns) || 0) + (Number(out.turns) || 0);
  const tokens = (Number(goal.tokens) || 0) + (Number(out.tokens) || 0);
  const reason = typeof out.reason === "string" ? out.reason.slice(0, 1000) : goal.reason || "";
  if (out.state === "met" || out.state === "impossible") return { goal: null, goalDone: { condition: goal.condition, state: out.state, reason, turns, tokens, ms: Math.max(0, now - Number(goal.at || now)) } };
  return { goal: { ...goal, turns, tokens, reason } };
}
