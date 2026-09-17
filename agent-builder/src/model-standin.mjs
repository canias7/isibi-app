/**
 * THE MODEL STAND-IN — no provider, no network, no spend.
 *
 * It exists so the whole pipe can be driven for real: a real request, real
 * storage, real auth, a real queue, and a model-shaped answer that costs nothing.
 * It reports usage and cost the way a provider does, so the meters and the budget
 * are exercised rather than bypassed.
 *
 * **IT IS NOT A MOCK OF A PROVIDER'S WIRE FORMAT.** `send` is the translator in
 * this design, so a stand-in and a real provider are two implementations of the
 * same one-function contract — which is exactly why swapping in the real one later
 * changes nothing above it.
 *
 * **IT CHOOSES WHAT TO DO FROM THE TOOLS IT IS OFFERED, which is the one thing
 * that makes it model-like rather than scripted.** One `send` serves every agent
 * in the registry, because that is how a deployment really works: there is one
 * model and several agents, and the model sees a different tool list each time. A
 * stand-in that had to be configured per agent would be a second registry.
 */

/**
 * The tools that mean "this agent's work takes time". See `agents.mjs`.
 *
 * TWO NAMES, ONE SHAPE. `wait` is repeatable and `commit` is not, which is the only
 * difference between them — and it is a difference the MODEL must not see, because
 * whether a tool may be retried is the platform's business and not something a model
 * decides. So the stand-in treats them identically.
 */
export const SLOW_TOOLS = Object.freeze(["wait", "commit"]);

/** Kept as its own name: the first is what a plain long run uses. */
export const SLOW_TOOL = SLOW_TOOLS[0];

/**
 * How a long run is shaped: this many rounds, each waiting this long.
 *
 * **SEVERAL ROUNDS RATHER THAN ONE LONG SLEEP, and that is the point.** Each round
 * writes a model entry and a tool result, so PROGRESS accumulates in the log and a
 * reader can watch it move. One sixty-second sleep would be a minute of silence
 * followed by an answer, which demonstrates nothing about progress.
 */
export const SLOW_ROUNDS = 8;
export const SLOW_STEP_MS = 8_000;

/** What a run of the slow shape lasts, at least. Derived, so the two cannot drift. */
export const SLOW_TOTAL_MS = SLOW_ROUNDS * SLOW_STEP_MS;

/**
 * WHAT EVERY STAND-IN ANSWER SAYS ABOUT ITSELF.
 *
 * **THE LABEL IS IN THE TEXT, not only in the screen that draws it**, and the
 * redundancy is deliberate: a label in the chrome is gone the moment somebody
 * copies the answer into an email, and a label in the text survives being quoted.
 * Neither replaces the other — the chrome's label is visible before you read a
 * word, and this one travels. Both are asserted.
 *
 * **IT IS NOT A DISCLAIMER BOLTED ON.** No model is connected, so there is no
 * answer here to soften: this text IS the whole of what the stand-in produced,
 * and saying anything that reads as an AI's reply would be the recorded
 * dead-control finding in its worst form — a control that ANSWERS, wrongly.
 */
export const SIMULATED = "[simulated]";

/** How much of an agent's own instructions an answer quotes back. A bound, not a style. */
export const SIMULATED_QUOTE = 120;

/**
 * The answer a customer-authored agent gets today.
 *
 * **IT QUOTES THE INSTRUCTIONS AND COUNTS THE HISTORY ON PURPOSE.** Those two are
 * the things this milestone connects, and they are invisible from outside unless
 * the answer says what arrived: a run that was handed the wrong snapshot, or none,
 * produces visibly different text rather than a plausible one nobody can check.
 * So this doubles as the verification's own instrument.
 */
export function simulatedAnswer({ system, messages, tool = null }) {
  const said = [...(messages ?? [])].reverse().find((m) => m.role === "user")?.content ?? "";
  const turns = (messages ?? []).filter((m) => m.role === "user").length - 1;
  const brief = String(system ?? "").trim().slice(0, SIMULATED_QUOTE);
  return [
    `${SIMULATED} No model is connected to this agent yet, so this is a stand-in test`,
    "result rather than an answer from an AI.",
    brief ? `\n\nYour instructions begin: "${brief}".` : "\n\nThis agent has no instructions.",
    `\nYou said: "${String(said).slice(0, SIMULATED_QUOTE)}".`,
    turns > 0 ? `\nIt was given ${turns} earlier ${turns === 1 ? "turn" : "turns"} of this conversation.`
              : "\nThis is the first message in the conversation.",
    // ⚠ WHICH TOOL REALLY RAN, SAID IN THE ANSWER — the same reasoning as the
    // instruction quote above it. Whether a selected tool was offered, chosen and
    // executed is otherwise only visible in the journal, and "the selection reached
    // the run" is exactly what a tool permission has to be checkable on. A run that
    // called nothing says nothing, so the sentence's presence is the evidence.
    tool
      ? (tool.failed
          ? `\nIt tried the ${tool.name} tool and could not use it: ${String(tool.said ?? "").slice(0, SIMULATED_QUOTE)}.`
          : `\nIt used the ${tool.name} tool, which answered: "${String(tool.said ?? "").slice(0, SIMULATED_QUOTE)}".`)
      : "",
  ].join(" ").replace(/ +\n/g, "\n").trimEnd();
}

/**
 * ⚠ ARGUMENTS FOR AN OFFERED TOOL, FILLED FROM ITS OWN SCHEMA.
 *
 * A real model reads a tool's input schema and writes arguments that fit it; a stand-in
 * that only ever knew `{text}` could call exactly one tool, which made every tool but
 * `echo` unreachable from this side and so untestable end to end. **It fills the REQUIRED
 * properties and nothing else**, from the prompt for a string and from the declared type
 * otherwise, which is the smallest thing that is honestly schema-driven.
 *
 * What it cannot invent is an IDENTIFIER — a source id, an automation id — because those
 * name real rows. A caller that wants one of those tools driven passes `toolArgs`, and
 * the brief allows exactly that: *scripted stand-in responses for integration tests,
 * clearly labeled as simulated.*
 */
export function standInArgs(tool, prompt) {
  // ⚠ THE WIRE NAME FIRST. What a model is handed is `wireTools`' shape —
  // `{name, description, input_schema}` — not the tool object, and reading `input` alone
  // found nothing, filled no arguments and made `echo` answer about an empty string. The
  // internal name is kept as a fallback so this is drivable with a tool object directly,
  // which is what the guards do.
  const schema = tool?.input_schema ?? tool?.input;
  const props = schema && typeof schema.properties === "object" ? schema.properties : {};
  const required = Array.isArray(schema?.required) ? schema.required : [];
  const said = String(prompt ?? "");
  const args = {};
  for (const name of required) {
    const type = props[name]?.type;
    // ⚠ WHAT THE REQUEST SAYS WINS, which is the half that makes this schema-driven
    // rather than a fixed shape. A request that writes `id=<something>` is answering a
    // declared property by name, exactly as a model reading the schema would — and it is
    // the only way a stand-in can ever fill a property that names a real row, because an
    // identifier is not a thing anything here can invent.
    const told = new RegExp(`\\b${name}=("[^"]*"|\\S+)`).exec(said);
    if (told) {
      const raw = told[1].startsWith('"') ? told[1].slice(1, -1) : told[1];
      if (type === "number" || type === "integer") args[name] = Number(raw);
      else if (type === "boolean") args[name] = raw === "true";
      else if (type === "object" || type === "array") { try { args[name] = JSON.parse(raw); } catch { args[name] = type === "array" ? [] : {}; } }
      else args[name] = raw;
      continue;
    }
    if (type === "number" || type === "integer") args[name] = 1;
    else if (type === "boolean") args[name] = true;
    else if (type === "object") args[name] = {};
    else if (type === "array") args[name] = [];
    else args[name] = said.slice(0, 200);
  }
  return args;
}

export function makeStandIn({ toolName = "echo", toolArgs = null, rounds = null, waitMs = null } = {}) {
  return async function send({ messages, step, tools, system }) {
    const offered = Array.isArray(tools) ? tools : [];

    // ── an agent with no tools at all ─────────────────────────────────────────
    //
    // **A MODEL WITH NOTHING TO CALL ANSWERS, and this branch is what makes that
    // shape reachable.** Without it the ordinary shape below asks for `echo` on
    // step 1 whatever it was offered, dispatch fails closed, and the run spends a
    // step and a tool slot discovering that a tool it was never shown does not
    // exist. That is a correct refusal and a wrong conversation.
    //
    // It is also the shape a CUSTOMER-AUTHORED agent runs in WHENEVER ITS OWNER HAS
    // TICKED NOTHING — which is every such agent until somebody chooses a tool, and
    // the default. The registered agent it executes under declares a CATALOG, and
    // `narrowTools` hands this loop only what that run's own journal recorded.
    if (!offered.length) {
      return {
        text: simulatedAnswer({ system, messages }),
        toolCalls: [],
        usage: { inputTokens: 24, outputTokens: 14 },
        costMicros: 70,
      };
    }

    // ── an agent whose work takes time ────────────────────────────────────────
    const slow = offered.find((t) => SLOW_TOOLS.includes(t?.name));
    if (slow) {
      const n = Number.isInteger(rounds) && rounds >= 1 ? rounds : SLOW_ROUNDS;
      const ms = Number.isFinite(waitMs) && waitMs > 0 ? waitMs : SLOW_STEP_MS;
      if (step <= n) {
        return {
          text: "", toolCalls: [{ id: `call-${step}`, name: slow.name, args: { ms } }],
          usage: { inputTokens: 10, outputTokens: 4 }, costMicros: 30,
        };
      }
      // How long it really waited, read back off the log rather than assumed — the
      // answer should be about what happened, not about what was planned.
      const waited = messages
        .filter((m) => m.role === "tool")
        .flatMap((m) => m.content ?? [])
        .reduce((sum, c) => sum + (Number(c?.result?.waited) || 0), 0);
      return {
        // LABELLED LIKE EVERY OTHER TERMINAL ANSWER. This shape is reached only by the
        // verification agents, and that is exactly why it was the one left unlabelled
        // — a text nobody customer-facing reads until the day somebody offers `wait`.
        text: `${SIMULATED} worked through ${n} stages over ${waited} ms`,
        toolCalls: [], usage: { inputTokens: 18, outputTokens: 9 }, costMicros: 50,
      };
    }

    // ── the ordinary shape: one tool call, then an answer ─────────────────────
    // So a driven run exercises a step, a tool, a second step and a stop, rather
    // than the shortest path through it.
    // ⚠ THE LATEST THING SAID, NOT THE FIRST — which is what a model answers, and what
    // this read for as long as a conversation was one message long. The moment a second
    // message reached an agent that holds tools, every later turn was answered against
    // the opening question: a run asked to list its sources searched them instead, for
    // the words somebody typed two turns ago. `simulatedAnswer` has always quoted the
    // LAST thing said, so the two halves of this file disagreed about which turn the
    // conversation was on.
    const asked = messages.filter((m) => m.role === "user");
    const first = asked.length ? asked[asked.length - 1].content ?? "" : "";
    const n = Number.isInteger(rounds) && rounds >= 1 ? rounds : 1;
    if (step <= n) {
      // ⚠ **IT CHOOSES FROM WHAT IT WAS OFFERED, which is the one thing that makes this
      // model-like rather than scripted** — and it was choosing a name it had not been
      // shown. Asking for `echo` while holding only `search_reference` spends a step and
      // a tool slot discovering a tool that was never offered: a correct refusal and a
      // wrong conversation, and it made every tool but one unreachable from this side.
      //
      // The caller's name wins when it is really on offer; otherwise a tool that needs no
      // arguments, because that is the one this side can always fill honestly; otherwise
      // the first thing there is.
      // ⚠ AND WHICH TOOL IS READ FROM THE REQUEST FIRST, which is the one thing that
      // makes this a CHOICE. A person writing "use search_reference to find the price"
      // has named a tool the agent holds, and a stand-in that ignored that could only
      // ever exercise one tool however many a customer had ticked.
      const named = offered.find((t) => typeof t?.name === "string" && new RegExp(`\\b${t.name}\\b`).test(String(first)));
      const pick = named
        ?? offered.find((t) => t?.name === toolName)
        ?? offered.find((t) => !((t?.input_schema ?? t?.input)?.required ?? []).length)
        ?? offered[0];
      return {
        text: "",
        toolCalls: [{
          id: `call-${step}`,
          name: pick.name,
          args: toolArgs && typeof toolArgs === "object" ? toolArgs : standInArgs(pick, first),
        }],
        usage: { inputTokens: 12, outputTokens: 5 },
        costMicros: 40,
      };
    }
    // ⚠ THE SAME ANSWER THE NO-TOOL SHAPE GIVES, PLUS WHAT THE TOOL SAID — and until
    // a customer could hold a tool this branch answered `stand-in answer. you said: …`
    // with **no `[simulated]` in it at all**. That was invisible while the only agents
    // reaching it were verification agents, and became a customer-facing unlabelled
    // answer the moment a selection could put `echo` on an authored run. The chrome's
    // chip would still have said "Simulated" and the TEXT would not, which is the half
    // that survives being copied into an email.
    const last = [...messages].reverse().find((m) => m.role === "tool");
    const result = last?.content?.[0]?.result ?? null;
    const name = last?.content?.[0]?.name ?? toolName;
    // The tool's own answer, whatever shape it has. `echoed` is `echo`'s field; a
    // different tool's result is stringified rather than read for a field it has not
    // got, so this cannot report an empty answer for a tool that answered.
    const said = result && typeof result === "object"
      ? (typeof result.echoed === "string" ? result.echoed : JSON.stringify(result))
      : String(result ?? "");
    // ⚠ A TOOL THAT FAILED IS NOT A TOOL THAT ANSWERED. `toolResultFor` puts the
    // error string in the same `result` field, so reading it without `ok` would
    // present a refusal — "not permitted for this tenant", "no such tool" — as the
    // tool's own reply, which is the one reading that makes a blocked tool look like
    // a working one.
    const failed = last?.content?.[0]?.ok === false;
    return {
      text: simulatedAnswer({ system, messages, tool: { name, said, failed } }),
      toolCalls: [],
      usage: { inputTokens: 20, outputTokens: 11 },
      costMicros: 60,
    };
  };
}
