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
// costs a placeholder. The split is kept even though both entries currently
// send one model to each: it is what a mixed picker would need, and collapsing
// it to a single `model` field would have to be undone to bring one back.
//
// Research (the web-search step) deliberately does NOT follow the picker — see
// the note at its call site in worker.js.

// GROK IS A THIRD OPTION AND NOT THE DEFAULT (owner's call, 2026-08-21), and
// that split is the whole safety of the change. It is a DIFFERENT PROVIDER —
// OpenAI-shaped, translated at the boundary by `model-xai.mjs` — and the entire
// pipeline rests on a forced tool call returning a well-formed object against a
// 23-field schema. Whether Grok holds up there is unknown until it has run, and
// making it the default before then would break every build on the platform at
// once rather than the one somebody deliberately picked.
//
// Why it is worth trying: output is ~92% of a build's cost and Grok 4.6 is
// $6/M against Sonnet's $15/M, so a build prices at roughly half. Measured
// against GatherHire's real token counts: cold ~34 credits of model spend
// against ~71, warm ~24 against ~50.
//
// Flipping DEFAULT_PICKER is one line once a build has been watched end to end.
export const BUILD_MODELS = {
  sonnet: { design: "claude-sonnet-5", pages: "claude-sonnet-5" },
  opus: { design: "claude-opus-5", pages: "claude-opus-5" },
  grok: { design: "grok-4.6", pages: "grok-4.6" },
};

// What a request that says nothing gets — and what the composer defaults to, so
// the two agree. A revise sent no `picker` at all until this shipped.
//
// SONNET, and `auto` IS GONE (owner's call, 2026-08-08, hours after the picker
// was wired). `auto` meant Opus for the schema, and that is what the change
// broke: a cold Opus schema call costs 15 credits, a new account is granted 20,
// and `publishPages` refuses to generate below 8 — so every new account's first
// build spent 15 credits and came back a placeholder. Caught by `build smoke`
// going red on the next run after the merge, with `stage: "credits"`.
//
// The tests could not have caught it. They assert the picker sends the right
// model and prices it correctly, which it did; nothing modelled a whole build
// against a real starting balance. That is the gap, not the option.
//
// Restoring `auto` is three lines once the free grant covers ~23 credits — kept
// written down here so it comes back as a decision rather than a rediscovery.
//
// ── GROK, FROM 2026-08-22 (owner's call). It was `sonnet` until then. ────────
//
// TWO REASONS, AND THE SECOND IS THE ONE THAT WOULD HOLD EVEN ON A FUNDED
// ACCOUNT.
//
// (1) The Anthropic balance was empty, so the DEFAULT build path answered 400
//     with `billing: true` in about a second — the platform's primary feature
//     down, silently, for anybody who did not know to change the picker.
//     `schema gen eval` had been red for three consecutive runs saying so.
//
// (2) A NEW ACCOUNT COULD NOT BUILD COLD ON SONNET, AND CAN ON GROK. Measured:
//     `buildFloor("claude-sonnet-5")` is 22 and `buildFloor("grok-4.6")` is 16,
//     against a free grant of 20 that the routing call has already taken 1 from.
//     So the default was 3 credits short of its own gate — the shortfall this
//     repo has had recorded as open since 2026-08-13, closed as a side effect.
//     This is why the flip is right rather than merely expedient: it is the same
//     class of bug `auto` was reverted for, in the opposite direction.
//
// EARNED, NOT ASSUMED. The line above says to flip once a build has been watched
// end to end; Grok has published two (`harbourside-roast` 37 credits,
// `fold-lane-bakery` 94), against Sonnet's ~128 on a comparable site.
//
// WHAT IT COSTS, STATED: Grok is ~3x slower on the pages call (156s measured
// against Sonnet's ~50s), so a build eats more of the wall-clock budget before
// the edge gives up — which is a real risk on a long brief and is why the
// Arabic runs are still unsolved. `sonnet` remains one click away in the
// composer, and `XAI_API_KEY` is REQUIRED now rather than optional, because a
// default picker whose key is missing is a platform outage wearing a 401.
export const DEFAULT_PICKER = "grok";

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
