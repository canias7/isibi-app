// Which model writes which half of a build.
//
// THE COMPOSER'S "Builder" PICKER WAS READ ZERO TIMES. `body.picker` appeared
// nowhere in worker.js and both build calls hardcoded `claude-sonnet-5`, so all
// three options produced byte-identical requests: a shipped control, with a
// tooltip promising a choice, that could not change anything. Same class as the
// Attach button, one surface over. (Its neighbour, "Effort", still is exactly
// that — owner's call: visible, inert. Written down because "we forgot" and "we
// decided" look identical in a year.)
//
// TWO CALLS, NAMED SEPARATELY, because they are not the same job. `design`
// turns one sentence into a data model, and every page and the whole database
// are then built on its answer — a table it gets wrong is not something a revise
// can take back. `pages` writes ~10,000 tokens of TSX against rules that already
// state most of the answer, and a page it gets wrong fails the typecheck and
// costs a placeholder. That asymmetry is the whole of what `auto` buys: the
// expensive model where judgement is scarce, the cheaper one where volume is.
//
// Research (the web-search step) deliberately does NOT follow the picker — see
// the note at its call site in worker.js.

export const BUILD_MODELS = {
  auto: { design: "claude-opus-5", pages: "claude-sonnet-5" },
  sonnet: { design: "claude-sonnet-5", pages: "claude-sonnet-5" },
  opus: { design: "claude-opus-5", pages: "claude-opus-5" },
};

// What a request that says nothing gets — and what the composer defaults to, so
// the two agree. A revise sent no `picker` at all until this shipped.
export const DEFAULT_PICKER = "auto";

/**
 * Resolve a picker to the pair of models a build will actually send.
 *
 * AN ALLOW-LIST, not a lookup with a fallback bolted on. `picker` arrives in a
 * request body, so it is caller-controlled: an unknown value is not a model id
 * to hand to the API, it is a field to ignore. `Object.hasOwn` rather than a
 * truthiness test, because `BUILD_MODELS["constructor"]` is truthy and this
 * codebase has already shipped that exact bug once — `PLANS[String(body.plan)]`
 * accepted `"__proto__"` and sent Stripe `unit_amount: "undefined"`.
 *
 * A STRING, not anything stringifiable — `String(["opus"])` is `"opus"`, so a
 * body sending an array would pick a model through coercion rather than through
 * the allow-list. It happens to land somewhere valid here, which is exactly why
 * it is worth refusing: the same shortcut in `normalizeRole` would have made a
 * number a role.
 *
 * Returns the resolved `picker` alongside the models so a caller can report
 * which one it landed on rather than echoing back what it was sent.
 */
export function modelsFor(picker) {
  const key = typeof picker === "string" && Object.hasOwn(BUILD_MODELS, picker) ? picker : DEFAULT_PICKER;
  return { picker: key, ...BUILD_MODELS[key] };
}
