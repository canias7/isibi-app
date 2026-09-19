/**
 * A DETERMINISTIC SCRIPTED SENDER — the milestone's own words: *"Use deterministic scripted
 * model responses to exercise this sequence."*
 *
 * ⚠ **THIS IS NOT A CHATBOT AND IT UNDERSTANDS NOTHING, and the file says so first because
 * that is the one claim a demonstration built on it must never make.** It does not read the
 * conversation, match a phrase, or decide anything. A caller ARMS the next run with the exact
 * answers that run's model calls will give, in order — the idiom `makeFakeProvider`'s own
 * `script`/`arm` already uses in this directory — and this plays them back. What the
 * demonstration proves is therefore about the PLATFORM: the routes, the queue, the tool
 * dispatch, the approval gate, the database. Nothing about language.
 *
 * **KEYED BY POSITION, NEVER BY THE WORDS.** A script keyed on the prompt's text would be
 * phrase matching wearing a fixture's clothes, and a reader would be entitled to think the
 * demonstration showed comprehension. The counter is the caller's: it arms, it sends, it arms
 * again.
 *
 * **EVERY ANSWER IS LABELLED `[simulated]`, in the TEXT.** The chrome's label is gone the
 * moment somebody copies an answer into an email, which is why the stand-in carries its label
 * in both places and why this does too. An answer that arrives here unlabelled is given the
 * label rather than passed through, because a scripted answer that reads like a real one is
 * the one outcome this file must not produce.
 *
 * **WHAT IT RECORDS IS THE EVIDENCE, AND `context` IS THE WHOLE OF IT.** A demonstration that
 * asserts a conversation survived something has to read what the model was really shown, not
 * what the run did afterwards — a run that finishes proves the queue worked and says nothing
 * about the turns. `asked[n].context` is the message list verbatim, roles included, so an
 * assertion can name the earlier request, the agent's own question and the new answer.
 *
 * **AND IT RUNS OUT LOUDLY.** A run that makes more model calls than were armed gets a
 * NAMED answer saying so, rather than a plausible one — an instrument that invents a reply
 * for an unscripted call reports a conversation nobody wrote.
 */

/** The label every answer carries, in its own text. */
export const SIMULATED = "[simulated]";

/** What one armed step may say: a final answer, or one tool call. */
export function makeScriptedModel() {
  let plan = [];
  let at = 0;
  const asked = [];

  /**
   * Arm the NEXT run. Each step is `{ text }` for a final answer or
   * `{ tool, args }` for one tool call; a `text` beside a `tool` is ignored, because a
   * provider's tool-call turn carries no prose.
   */
  const arm = (steps) => { plan = Array.isArray(steps) ? steps.slice() : []; at = 0; };

  /** How many steps of the current script are still unplayed — an observer, not a control. */
  const left = () => Math.max(0, plan.length - at);

  const label = (t) => (String(t ?? "").includes(SIMULATED) ? String(t) : `${SIMULATED} ${String(t ?? "")}`.trim());

  const send = async ({ system, messages, tools } = {}) => {
    const step = plan[at];
    at += 1;
    asked.push({
      at: at - 1,
      // WHAT THE MODEL WAS REALLY SHOWN, recorded so a demonstration can assert the
      // conversation reached it rather than assuming the snapshot did its job.
      prompt: [...(messages ?? [])].reverse().find((m) => m?.role === "user")?.content ?? null,
      turns: (messages ?? []).filter((m) => m?.role === "user").length,
      /**
       * ⚠ **THE WHOLE CONTEXT, ROLES AND ALL — because `prompt` and `turns` cannot say
       * whether the agent's OWN earlier words reached it.** A clarification question is an
       * ASSISTANT turn; a count of user turns is satisfied by a context that dropped every
       * one of them, and the last user message is satisfied by a context with nothing before
       * it. `journal.mjs` rebuilds this list from the snapshot in the database, so asserting
       * on it is asserting that the conversation really travelled — which is the one thing a
       * restart between two messages is supposed to show.
       */
      context: (messages ?? []).map((m) => ({ role: m?.role ?? null, content: m?.content ?? null })),
      instructions: typeof system === "string" ? system : null,
      offered: (tools ?? []).map((t) => t?.name).filter((n) => typeof n === "string"),
    });
    if (!step) {
      return {
        text: label("nothing further was scripted for this run — the script ran out"),
        toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 }, costMicros: 0,
      };
    }
    if (typeof step.tool === "string" && step.tool) {
      return {
        text: "",
        toolCalls: [{ id: `scripted-${at}`, name: step.tool, args: step.args ?? {} }],
        usage: { inputTokens: 2, outputTokens: 2 }, costMicros: 0,
      };
    }
    return {
      text: label(step.text),
      toolCalls: [], usage: { inputTokens: 2, outputTokens: 2 }, costMicros: 0,
    };
  };

  return { send, arm, asked, left };
}
