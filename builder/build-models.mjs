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
// ── `quick` — THE SMALL CALLS, AND WHY THEY ARE NOT HAIKU ANY MORE ──────────
//
// Owner's call 2026-08-31, straight after run 93: "we are gonna get rid of
// haiku routing, we are gonna use for routing the same model is picked, if grok
// is picked then that will be it."
//
// WHAT PROMPTED IT. Every classifier and cheap layer on the platform was
// hardcoded to `claude-haiku-4-5`, so a `css` edit — a lane that already runs on
// the PICKED model — never got as far as running: `pick_lanes` goes first, it
// went to Anthropic, and Anthropic answered a billing refusal. The edit came
// back 503 in 5.3 seconds having spent nothing, with the site untouched. That is
// the exact failure `DEFAULT_PICKER` was flipped to Grok for on 2026-08-22
// (reason (1) above), left in place on every small call for nine days.
//
// A THIRD KEY RATHER THAN REUSING `design`. The acting lanes already send
// `modelsFor(picker).design`, which WORKS and reads as a mistake: an intent
// router is not a design step, and the next person to change what `design`
// means would move the routers with it by accident. Its own name is what makes
// "run the classifiers on something cheaper" a one-line change in this table
// instead of a hunt through eight modules.
//
// SAME MODEL AS THE PICKER, WHICH IS THE OWNER'S ANSWER AND NOT A DEFAULT. It
// costs more than Haiku on the two Anthropic pickers — these are small calls, so
// the absolute number is small — and it buys the thing that matters: a customer
// who picked Grok now has NO Anthropic in their path at all, so an outage at one
// provider cannot take out the whole cheap ladder for everybody.
export const BUILD_MODELS = {
  sonnet: { design: "claude-sonnet-5", pages: "claude-sonnet-5", quick: "claude-sonnet-5" },
  opus: { design: "claude-opus-5", pages: "claude-opus-5", quick: "claude-opus-5" },
  grok: { design: "grok-4.6", pages: "grok-4.6", quick: "grok-4.6" },
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

// ── WHAT EACH MODEL WILL ACTUALLY ACCEPT ────────────────────────────────────
//
// Owner, 2026-09-13, pointing at the context-window column of the three
// providers' own docs: "THIS IS THE NUMBER I WANT."
//
// Until now the platform knew each model's NAME and nothing else about it. Every
// ceiling it sends — SITE_PAGES_MAX_TOKENS, LANE_EDIT_MAX_TOKENS, the eleven
// others — is a number somebody chose against no stated limit, and the same
// number goes out whichever of the three is picked. This table is the missing
// half: what the model on the other end is willing to take.
//
// KEYED BY MODEL ID, NEVER BY PICKER, and the reason is eighty lines up in this
// file: `design` and `pages` are kept as separate entries "for what a mixed
// picker would need". The moment one exists — `design: claude-opus-5,
// pages: grok-4.6` — a limit hung on the picker is wrong for one of the two
// calls, and wrong in the direction that looks fine. A limit is a fact about the
// model, so it is stored against the model and asked for by model id. That is
// this repository's own recorded "a lookup keyed at a different granularity than
// the thing you ask it" trap, which cost a session when `LANE_LAYER` was keyed
// by group and read by field.
//
// READ FROM THE PROVIDERS' OWN DOCS ON 2026-09-13, not from memory:
// platform.claude.com/docs/en/about-claude/models/overview and
// docs.x.ai/developers/grok-4-6. These numbers move — Claude was 200K a
// generation ago — so re-read them rather than trusting this block, exactly as
// the design-tool property order says to re-derive itself.
//
// THREE STATES FOR AN OUTPUT LIMIT, AND THEY MUST NOT COLLAPSE INTO TWO.
// A number is a stated cap. `Infinity` is a provider that states NO cap (xAI:
// "No text output limit"). `null` — the resolver's answer for a model with no
// entry — is WE DO NOT KNOW. Writing "no limit" as null too would be two nulls
// meaning opposite things, which is the exact shape that put a wrong link on a
// live site when `readAction` answered null for both "no button" and "a computed
// button". `Infinity` also makes every "does our ceiling fit" test plain
// arithmetic with no special case. Nothing serialises this table today; if
// something ever does, note that JSON turns Infinity into null and that is
// precisely the collapse this avoids.
export const MODEL_LIMITS = {
  "grok-4.6": { context: 500_000, maxOutput: Infinity },
  "claude-sonnet-5": { context: 1_000_000, maxOutput: 128_000 },
  "claude-opus-5": { context: 1_000_000, maxOutput: 128_000 },
};

// NOTHING IN THE PRODUCT READS THIS YET, AND THAT IS THE OWNER'S CALL: know the
// number first, spend it second. Said out loud because a value nothing reads is
// this repository's most repeated defect — twelve features have shipped dead
// with the module correct and one hop cut — so it is named here rather than left
// to be discovered as a mistake.
//
// WHAT KEEPS IT FROM BEING DEAD ON DAY ONE is `test/model-limits.test.mjs`: a
// census DERIVED from BUILD_MODELS in both directions, so a picker added next
// month naming a fourth model fails by existing, and a model that leaves takes
// its row with it. Plus the one assertion with teeth today — every output
// ceiling this platform sends must fit inside the SMALLEST maxOutput any picker
// can reach, because the ceiling is chosen once and the picker is chosen per
// request. Measured when this shipped: the largest we send is 30,000 against a
// floor of 128,000, so there is 4x of room and the guard is quiet until somebody
// takes it.
//
// WHAT THE CONTEXT NUMBER IS NOT, measured rather than assumed: a constraint.
// The biggest thing this platform sends is `design_schema` at 64,076 characters
// on a first build plus 1,962 of system — call it ~20,000 tokens against a
// 500,000 floor. The wall a build actually meets is the WIRE (`QUICK_CALL_MS`
// 240s against an egress that hangs up an idle connection at ~270s, 480s
// streamed), which run 40 proved by timing out a lane that had never reached its
// own token ceiling.

/**
 * The context window of one model, in tokens — or `null` if we have no entry.
 *
 * `null` MEANS WE DO NOT KNOW, and a caller must never read it as zero. Zero is
 * "there is no room", which would gate off a call to a perfectly healthy model;
 * not-knowing must fall through to sending the request, exactly as a config read
 * that fails lets an edit lane run rather than refusing it. The recorded rule is
 * "cannot-tell must never read as nothing-there", and this is its arithmetic
 * form.
 *
 * `Object.hasOwn` and a string test for the same reason `modelsFor` uses them:
 * `MODEL_LIMITS["constructor"]` is truthy, and `String(["grok-4.6"])` is
 * "grok-4.6", so coercion would resolve an array through a table that is
 * supposed to be an allow-list.
 */
export function contextWindow(model) {
  if (typeof model !== "string" || !Object.hasOwn(MODEL_LIMITS, model)) return null;
  return MODEL_LIMITS[model].context;
}

/**
 * The largest answer one model will produce, in tokens.
 *
 * A number is a stated cap; `Infinity` is a provider that states none; `null` is
 * a model we have no entry for. See the three-states note above — the whole
 * value of this resolver is that those three stay three.
 */
export function maxOutputTokens(model) {
  if (typeof model !== "string" || !Object.hasOwn(MODEL_LIMITS, model)) return null;
  return MODEL_LIMITS[model].maxOutput;
}
