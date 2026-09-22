// The cheap rung of the `page` layer: change how ONE page looks, without
// rewriting it.
//
// WHAT IT IS FOR. "Make that heading bigger", "there's too much space above the
// prices", "show the gallery four across", "centre that", "put a line under it",
// "move the opening hours above the map". Every one of those was reachable only
// by REGENERATING the whole page — measured on a real 12,044-character page,
// 10 credits against 3 — and a regeneration also rewords the copy on the way
// past, which is not what anybody asked for.
//
// IT IS ONE GAP WEARING SIX HATS, which is why this is a rung rather than six
// features. Measured over the 329-page corpus: section ORDER (1040 sections,
// median 3 a page), a section's own background, and the layout props —
// `ratio=` 244, `columns=` 87, `size=` 27, `variant=` 20, `align=` 1, plus the
// 6,089 of 7,457 `className` values carrying a size or a spacing. All of them
// are "change a prop or a className in this file", so one cheap editor closes
// them together and the next "it cannot do X" of that shape needs no new
// machinery at all.
//
// THE PROMISE IS ENFORCED, NOT ASKED FOR. The model is told not to touch the
// words, and then `sameProse` CHECKS — because a promise a prompt makes is one
// a model eventually breaks quietly. Calibrated the way every check in this
// repo has to be, against the corpus: **1,657 real tweaks across 329 pages, 0
// of them moved the prose, and 329/329 deliberate rewordings were caught.** A
// guard that fires on a correct tweak would be worse than no guard.
//
// TRY-CHEAP-FIRST IS FREE WHEN IT FAILS, which is what makes it unconditional.
// A refusal is a few words of output, so it costs ~1 credit against the 10 the
// rewrite was going to cost anyway — there is no case where asking first is the
// expensive move, and so there is no new routing decision to get wrong.
//
// Plain module with no I/O, like `site-ask.mjs` and `site-rules.mjs`: the model
// call is injected, so every decision here is tested without a Worker.
import { extractText } from "./site-text.mjs";
// The page/component relationship, read off the page's own source — see
// `partEligible` below for why this rung needs it and why it may not ask a
// store for it. It reads the page's own import specifiers — the page/component
// RELATIONSHIP — and is not an analysis of what the code does; that question
// belongs to the parser `partEligible` is handed.
import { localParts } from "./site-files.mjs";
// The runtime-correctness check. Imported rather than injected because it is
// pure — no Worker, no container, no network — so importing it costs this
// module none of the properties above, and injecting it would put the one thing
// that makes the rung safe behind a caller remembering to pass it.
import { lintPages } from "./page-gen.mjs";
import { modelsFor } from "./build-models.mjs";

/** A small call: editing a className is not a design task, and the saving IS the point. */
/**
 * THE PICKED MODEL, NOT A HARDCODED ONE (owner, 2026-08-31).
 *
 * Every small call on this platform was pinned to `claude-haiku-4-5`, so a
 * customer who had picked Grok still had Anthropic in their path — and when
 * Anthropic refused on billing, the whole cheap ladder went down with it while
 * builds carried on fine. Run 93 measured that: a `css` edit answered 503 in
 * 5.3s having spent nothing, and the lane it was testing never ran.
 *
 * DERIVED FROM THE TABLE rather than restated, so it cannot drift from the
 * picker, and it resolves to DEFAULT_PICKER — which is what a caller that
 * forgets to thread the picker gets. That is deliberately the platform default
 * and never Haiku: a forgotten hop should land on the model everything else
 * uses, not quietly back on the provider this change exists to leave.
 */
export const TWEAK_MODEL = modelsFor().quick;

/**
 * Room for the page to come back whole, plus a little.
 *
 * The output IS the file, so this is not a cap on the answer's length — it is a
 * cap on the page, and `MAX_TWEAK_CHARS` is the one that really binds.
 */
export const TWEAK_MAX_TOKENS = 16000;

/**
 * The largest page this rung will attempt.
 *
 * MEASURED, NOT GUESSED: the biggest page in the 329-page corpus is ~50,000
 * characters and the median is far smaller. A page past this is one where the
 * output tokens stop being cheap — the whole file comes back — so the rewrite
 * it would fall through to is not much dearer, and guessing wrong costs the
 * customer twice.
 *
 * DOUBLED WITH `MAX_PAGE_CHARS` (2026-08-28). The one-page world makes a
 * 24-48k index.tsx the ORDINARY site, not the outlier — left at 24,000, every
 * cheap edit on such a site would silently escalate to the ~10-credit rewrite
 * (the cheap rung dead for exactly the sites the product now builds) and the
 * render-repair pass could not touch a crashed one either, since
 * `site-repair.mjs` gates on this same constant. A 48k echo is ~12k output
 * tokens, inside TWEAK_MAX_TOKENS' 16k, and still far cheaper than a rewrite
 * that re-sends the whole generator prompt.
 */
export const MAX_TWEAK_CHARS = 48000;

/**
 * ONE FILE IN, ONE FILE OUT.
 *
 * `cannot` IS A REAL ANSWER AND HAS TO BE, or the model does something
 * approximate rather than saying it needs a rewrite — and an approximate answer
 * to "add a section about our history" is the worst outcome here, because it
 * publishes and reads as the builder half-working. It is described as the
 * ordinary answer for anything structural so that saying it costs nothing.
 */
export const TWEAK_TOOL = {
  name: "write_tweak",
  description:
    "Return the page with ONE visual change made, or say you cannot make it here.",
  input_schema: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description:
          "The WHOLE file, byte-for-byte as it was given to you except for the change that was asked for. " +
          "Do not reformat, do not tidy, do not re-order imports, and do not improve anything you were not " +
          "asked about — every unrelated character must come back exactly as it went in.",
      },
      cannot: {
        type: "string",
        description:
          "Instead of `source`, when this change is not a visual tweak to what is already on the page: it needs " +
          "NEW words, a new section written from scratch, a form, a database table, or a different page. Say so " +
          "in one short sentence. This is a perfectly good answer and costs nothing — a page that needs writing " +
          "is handed to the model that writes pages, so guessing here helps nobody.",
      },
    },
  },
};

/**
 * What the model is told. Short on purpose — this is the saving.
 *
 * The `page` layer sends the whole ~36,000-token generator prompt because it
 * WRITES a page. This one edits an existing file, so the components in front of
 * it are already used correctly and the rules describing them buy nothing: on a
 * warm cache that block is ~$0.011 a call, which is most of the difference
 * between 3 credits and 10.
 *
 * SENDING SHORT RULES IS ONLY SAFE BECAUSE `lintPages` RUNS ON THE RESULT —
 * `tweakLint` below, in `readTweak`. This comment used to claim that as an
 * accomplished fact and it was false: `runTweak` returned, `worker.js` went
 * straight to `recompileAndPublish`, and no `validatePages`, no `lintPages` and
 * no `repairImports` ran anywhere on the path. So the ONE lane every page edit
 * tries first was the only one with no runtime-correctness check, on a rung
 * whose own rules invite prop changes — which is the invented-prop class the
 * lint was built for.
 */
export const TWEAK_RULES =
  "You are editing ONE file of a small business's website. The customer has asked for one visual change.\n\n" +
  "CHANGE ONLY WHAT THEY ASKED FOR. Everything else in the file comes back exactly as it went in — the same " +
  "words, the same order, the same imports, the same formatting. You are not reviewing this file.\n\n" +
  "DO NOT CHANGE ANY OF THE WORDS A VISITOR READS. Not a heading, not a sentence, not a button label, not a " +
  "price. This is checked, and a file that comes back with different wording is thrown away — so if the change " +
  "they asked for cannot be made without rewriting the copy, answer `cannot` instead.\n\n" +
  "DO NOT CHANGE THE PAGE'S ADDRESS. The `createFileRoute(\"…\")` line stays exactly as it is.\n\n" +
  "WHAT YOU CAN DO: sizes and spacing (the Tailwind classes), alignment, borders and rounding, which component " +
  "prop is passed (`columns`, `ratio`, `variant`, `size`, `align`), and MOVING a whole block up or down the " +
  "page. If a colour is asked for, answer `cannot` — colours are set elsewhere, for the whole site or the whole " +
  "page, and hard-coding one here would fight that.\n\n" +
  "WHAT TO ANSWER `cannot` FOR: anything needing new words or a new section, a new form or field, a change to " +
  "what the page LISTS, a colour, or anything about a different page.";

/**
 * The user half of the call.
 *
 * The instruction goes FIRST and the file second, so the thing being asked for
 * is not buried under ten thousand characters of TSX — the same ordering the
 * addon lane uses for the prior source, and for the same reason.
 *
 * `rules` AND `heading` ARE PARAMETERS SO A SECOND INTENT CAN REUSE THIS WHOLE
 * RUNG (2026-08-24), and they default to today's values so every existing call
 * is byte-identical — the tweak lane sends nothing it did not send before.
 *
 * WHAT MADE THAT NECESSARY: `site-repair.mjs` edits one file exactly the way
 * this does and wants every guard `readTweak` carries — the prose promise, the
 * route id, the differential lint, the truncation floor. What it cannot reuse
 * is `TWEAK_RULES`, which opens "the customer has asked for one visual change"
 * and lists `cannot` for anything that is not one. Handed a page that THREW,
 * those rules are an instruction to refuse. So the machinery is shared and only
 * the sentence at the top differs — the alternative was a second copy of eight
 * guards, which is how the five copies of one route mapping happened.
 */
export function tweakRequest({ instruction, path, source, rules = TWEAK_RULES, heading = "THE CHANGE THEY ASKED FOR", model = TWEAK_MODEL }) {
  const what = String(instruction == null ? "" : instruction).trim();
  const file = String(source == null ? "" : source);
  return {
    model,
    max_tokens: TWEAK_MAX_TOKENS,
    system: String(rules == null ? "" : rules) || TWEAK_RULES,
    tools: [TWEAK_TOOL],
    tool_choice: { type: "tool", name: TWEAK_TOOL.name },
    messages: [{
      role: "user",
      content:
        String(heading || "THE CHANGE THEY ASKED FOR") + "\n" + what.slice(0, 2000) +
        "\n\nTHE FILE (" + String(path || "this page") + ")\n" + file,
    }],
  };
}

/** What this call cost, in the shape the ledger prices. */
export function tweakUsage(reply, model = TWEAK_MODEL) {
  const u = reply && reply.usage;
  if (!u) return null;
  return {
    model,
    in: u.input_tokens || 0,
    out: u.output_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
  };
}

/**
 * Does the page still say exactly what it said?
 *
 * THE MULTISET, NOT THE POSITIONS. Moving a block down the page changes every
 * offset after it and is precisely the change this rung exists to allow, so
 * comparing anything positional would refuse the feature. Sorted and joined,
 * so a re-ordered page compares equal and a re-worded one does not.
 *
 * `extractText` IS REUSED RATHER THAN REIMPLEMENTED, and that is load-bearing:
 * it already knows the difference between a sentence a visitor reads and an
 * identifier that happens to be a string — a className, a route id, a column
 * name. A second reading of "what counts as words" would eventually disagree
 * with the free text editor about what is editable, and the direction it would
 * drift in is refusing correct tweaks.
 */
export function proseOf(source) {
  return extractText(source).map((w) => w.text).sort().join(" ");
}

export function sameProse(before, after) {
  return proseOf(before) === proseOf(after);
}

/**
 * Does the page still say EVERYTHING it said? (owner, 2026-09-04: an ask for
 * a section the site already has adds a second one, and the first is left
 * exactly as it is.)
 *
 * THE SUBSET, NOT THE EQUALITY. An addition says more, never less, so the
 * question is whether every word the page had is still on it — as a multiset,
 * by the same reading of "what counts as words" `sameProse` uses, for the
 * same reason: a second reading would drift toward refusing correct work.
 * Counts matter — a quote the page carried twice and now carries once has
 * lost one. Answers what was lost, by segment, so a refusal can name it.
 *
 * Run 35 (2026-09-04) is why: asked for a testimonials section a site already
 * had, the page writer kept the section and rewrote its three quotes shorter
 * under the same names, and the reply said `ok`.
 */
export function keptProse(before, after) {
  const had = new Map();
  for (const w of extractText(before)) had.set(w.text, (had.get(w.text) || 0) + 1);
  for (const w of extractText(after)) {
    const n = had.get(w.text);
    if (!n) continue;
    if (n === 1) had.delete(w.text); else had.set(w.text, n - 1);
  }
  const lost = [...had.keys()];
  return { ok: lost.length === 0, lost };
}

/**
 * The page's own address, which a tweak may never move.
 *
 * A route id is typed against the tree `tsr generate` emits, so a page that
 * quietly renames itself does not merely move — every `<Link>` to it on every
 * other page becomes a compile error and the whole edit is lost. `renameRoute`
 * exists for that and does it properly, rewriting the links and issuing the
 * redirect; this rung has no business anywhere near it.
 */
export function routeIdOf(source) {
  const m = /createFileRoute\(\s*["'`]([^"'`]*)["'`]\s*\)/.exec(String(source == null ? "" : source));
  return m ? m[1] : null;
}

/**
 * One page's problems, with no schema — the expensive half of `tweakLint`
 * (~4ms a call), exported so a caller sweeping many variants of ONE page can
 * hold its baseline instead of re-deriving it per variant.
 *
 * NOT A CHECK ON ITS OWN, and reading it as one is the trap: absolutely it
 * fires on nearly every page the generator has ever written. See `tweakLint`.
 *
 * `null` means the scanner could not ANSWER, which has to stay distinct from an
 * empty set — collapse the two and a crash reads as a clean page.
 */
export function lintOne(source) {
  try {
    // ONE path for every call, or the `path + ": "` prefix differs between the
    // two sides and nothing cancels — every problem would read as introduced.
    return new Set(lintPages([{ path: "page.tsx", source: String(source == null ? "" : source) }], undefined));
  } catch { return null; }
}

/**
 * What this tweak BROKE — never what the page was already carrying.
 *
 * WHY DIFFERENTIAL, AND IT IS NOT caution: it is the only honest question this
 * rung can ask. `lintPages(pages, spec)` judges table names, function names and
 * API names against the site's schema, and this lane has no schema — the route
 * reads `_meta` AFTER the cheap attempt, deliberately, so that a tweak costs
 * nothing when it works. Run absolutely with no spec, EVERY `useRows("menu")`
 * on the page reads as a table the schema does not declare. Measured over the
 * 329-page corpus: **326 of them carry at least one spec-less problem**, so an
 * absolute lint would refuse essentially every tweak on the platform and the
 * cheap rung would be dead — silently, as a permanent 10-credit fall-through.
 *
 * Differentially those cancel: the same problem string is produced before and
 * after, so what is left is exactly what this edit introduced. That is also the
 * only thing the rung is answerable for — it did not write the rest of the file.
 *
 * CALIBRATED THE WAY EVERY CHECK IN THIS REPO HAS TO BE, against the corpus:
 * **1,640 real tweaks across 329 pages, 0 differential false alarms**, and it
 * catches a `require(`, a literal colour class, a demo chart import, a
 * `location.hash` navigation and an invented prop on the first try. A guard that
 * fires on a correct tweak would turn the cheap path into a permanent
 * fall-through, which is worse than the miss it prevents.
 *
 * FAILS OPEN WHEN THE SCANNER CANNOT ANSWER, and that direction is deliberate.
 * This sits in front of a path that already works and that has never had a lint
 * at all, so a crash here must cost the CHECK rather than the rung: failing the
 * other way would make every page edit on the platform pay for the rewrite, for
 * ever, because of a bug in a scanner. And it is the false-alarm direction
 * twice over — with no baseline to subtract, every problem the page already had
 * would be blamed on this edit.
 */
export function tweakLint(before, after) {
  const b = lintOne(before), a = lintOne(after);
  if (!b || !a) return [];
  return [...a].filter((p) => !b.has(p));
}

/**
 * What came back, and whether to use it.
 *
 * EVERY REFUSAL ESCALATES rather than answering the customer, and the asymmetry
 * is the whole design. Falling through costs the rewrite they were going to get
 * anyway plus ~1 credit; refusing outright would tell somebody their perfectly
 * ordinary request is impossible, on a rung they never asked to be routed to.
 * So there is no `ok: false` here that a customer ever sees.
 */
export function readTweak(reply, { source, inPart, parse } = {}) {
  const before = String(source == null ? "" : source);
  // The raw API reply, read the way every other lane reads one — a forced tool
  // can still come back without a `tool_use` block when the call is cut short,
  // and that is `unreadable` rather than a throw.
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const i = (use && use.input && typeof use.input === "object") ? use.input : null;
  if (!i) return { ok: false, reason: "unreadable" };

  // SAID SO ITSELF. Taken at face value and reported, because the sentence is
  // the useful part — it is the model naming what this rung cannot do, which is
  // exactly what the rung above is for.
  const cannot = typeof i.cannot === "string" ? i.cannot.trim() : "";
  const after = typeof i.source === "string" ? i.source : "";
  if (!after) return { ok: false, reason: "cannot", why: cannot.slice(0, 300) || "" };

  // NOTHING MOVED. Ambiguous between "it already looks like that" and "I could
  // not do it", and this rung cannot tell them apart — so it goes up, where the
  // page model gets its own attempt. The look lane CAN separate the two because
  // its model names fields; this one hands back an opaque file.
  if (after === before) return { ok: false, reason: "no-change" };

  // A file that came back a fraction of its size is a truncated answer or a
  // summary, not an edit. Checked before the prose comparison so the reported
  // reason is the real one rather than "it reworded the page".
  if (after.length < before.length * 0.5) return { ok: false, reason: "truncated" };

  // THE ADDRESS. Before the prose check for the same reason: a moved route is a
  // specific, nameable failure and would otherwise be reported as a rewording.
  const wasRoute = routeIdOf(before);
  if (wasRoute !== null && routeIdOf(after) !== wasRoute) return { ok: false, reason: "moved-route" };

  // THE PROMISE. Measured over the corpus at a 0% false-alarm rate across 1,657
  // real tweaks, and it catches a rewording on 329 of 329 pages.
  if (!sameProse(before, after)) return { ok: false, reason: "reworded" };

  // ⚠ AND THE PROMISE ABOVE ONLY COVERS THIS FILE. On a page that renders the
  // site's own components, a change to what the page COMPUTES is a change whose
  // consequence lives in a file this rung never opened — run 17 shipped a full
  // day advertising space that way, and two later reproductions moved the same
  // change out of the call site to beat a scanner. Sits BELOW `sameProse` so a
  // rewording keeps its own name, and ABOVE `tweakLint` because it is the more
  // specific finding of the two and the one with a customer-visible
  // consequence. See `partEligible`.
  const fit = partEligible(before, after, { inPart, parse });
  if (!fit.ok) return { ok: false, reason: "needs-parts", parts: fit.parts, why: fit.why };

  // WHAT IT BROKE. Last, so the cheaper and more specific refusals above keep
  // their own names — a rewording reported as a lint problem sends whoever
  // reads it at the wrong thing.
  //
  // ESCALATES RATHER THAN ANSWERING, like every other refusal here, and that is
  // what makes this fixable inside this module: the rung above sends the full
  // generator rules and lints its own output, so a page this rung got wrong
  // gets a genuinely different attempt rather than a published fault. Reporting
  // instead would leave the customer a live site carrying a `require(` or a
  // hard-coded colour with nothing said about it, which is the state this was
  // in.
  //
  // `problems` IS CARRIED ON THE REFUSAL so the reason is nameable — "the cheap
  // rung keeps refusing" and "the cheap rung keeps breaking pages" want
  // opposite fixes, and without the strings they are one log line. Absent on
  // success, so a working tweak's result is unchanged.
  const problems = tweakLint(before, after);
  if (problems.length) return { ok: false, reason: "lint", problems };

  return { ok: true, source: after };
}

/**
 * ⚠ IS THIS RUNG ELIGIBLE FOR THIS REQUEST AT ALL — `{ok}` or
 * `{ok: false, parts, why}` (run 17 and the THREE reproductions after it).
 *
 * WHAT IT COST TO LEARN. Asked to make the *"Space on a preferred day"* box
 * count down the places left, the cheap rung changed ONE line of the page:
 *
 *     - bookingCount={Number(bookingCount ?? 0)}
 *     + bookingCount={6 - Number(bookingCount ?? 0)}
 *
 * `sameProse` perfect, `tweakLint` clean, published. The sentences that
 * interpret that number live in `-parts/day-space-lookup.tsx`, which this rung
 * never opened, so the live box read **"6 bookings already on this day"** on an
 * EMPTY day and **"No bookings on this day yet — it still has space"** on a
 * FULL one.
 *
 * ⚠ THREE SUCCESSIVE FIXES WERE APPROXIMATE READERS AND EACH WAS BEATEN BY A
 * SPELLING, ALL THREE REPORTED THROUGH THE REAL EDIT ROUTE:
 *
 *   1. Compare the prop's TEXT. Beaten by moving the arithmetic one line up
 *      into a `const`, leaving the call site byte-identical.
 *   2. Compare the prop's text PLUS the declarations it transitively reads.
 *      Beaten by a REASSIGNMENT — the call site untouched, the declaration
 *      untouched, a later statement changing the value.
 *   3. Compare the whole file's code tokens as a MULTISET. Beaten by operand
 *      order: `Number(bookingCount ?? 0)` → `Number(0 ?? bookingCount)` has the
 *      IDENTICAL multiset and always returns zero, so a fully booked day again
 *      advertised space.
 *
 * THE THIRD FAILURE IS THE ONE THAT SETTLES THE DESIGN, because it is not an
 * edge case: **a bag of tokens cannot see order, and order is the semantics.**
 * `a ?? 0` and `0 ?? a` are the same tokens and different programs, and so are
 * `f(x, y)` / `f(y, x)`, `a ? b : c` / `a ? c : b`, `a - b` / `b - a`. No
 * refinement of an unordered comparison can express what an operand position
 * means, so the multiset is GONE rather than patched (owner: *remove that
 * assumption rather than add another exception for this expression*).
 *
 * SO THE COMPARISON IS THE LANGUAGE'S OWN PARSER, AND NOTHING HERE PARSES
 * JAVASCRIPT. `ts.createSourceFile` builds the real syntax tree — the same
 * parser the compile step already runs over these files — and the two
 * signatures below are read off that tree. Operand order, argument order and
 * ternary arms are all recorded by construction, which is why the operand-order
 * case needed no rule of its own and why two shapes nobody enumerated (a
 * flipped ternary, a swapped argument list) are caught by the same code.
 *
 * THE LINE IS WHAT THIS RUNG *IS*, not what a particular answer did. `runTweak`
 * takes ONE page's source and answers ONE page's source. On a page that renders
 * the site's own components, therefore:
 *
 *   IT MAY CHANGE WHAT THE PAGE RENDERS — element nesting, element order, a new
 *     wrapper, spacing, and any QUOTED attribute value. All of that is settled
 *     inside the one file it holds, so `sameProse` plus `tweakLint` cover it.
 *   IT MAY NOT CHANGE WHAT THE PAGE COMPUTES. Every value flowing into a
 *     component is settled by code this rung cannot read the other half of, so
 *     a change there is one it cannot know it has finished.
 *
 * ONE SIGNATURE, IN TWO REGISTERS, AND THE JOIN BETWEEN THEM IS THE POINT:
 *
 *   OUTSIDE MARKUP it is the ORDERED structure of every construct — statements,
 *     declarations, hooks and their arguments, in source order — so the upstream
 *     and reassignment shapes differ and so does a renamed RPC.
 *   INSIDE MARKUP a JSX subtree collapses to a sorted MULTISET of every
 *     expression it carries, each keyed by its element's tag and the attribute
 *     it feeds. A multiset because re-ordering and re-wrapping elements must
 *     stay free; keyed by tag and attribute because a value swapped between two
 *     components is a change even when the same expressions are still there.
 *
 * ⚠ AND THE JOIN IS WHERE THE FIFTH BYPASS LIVED. A JSX subtree used to collapse
 * to the SAME OPAQUE LEAF wherever it stood, so the two arms of a ternary were
 * two identical placeholders and swapping them moved nothing — a loading state
 * and a live component exchanged, reported through the real route as a published
 * `tweak: true`. The multiset goes IN PLACE now, so each site's own contents are
 * part of the ordered structure around it, and branch position is associated
 * with what that branch renders and with the props it receives.
 *
 * WHY THAT LEAVES THE CHEAP PATH ALONE: a subtree's multiset is invariant under
 * exactly the changes a layout tweak makes. A new `<section>` wrapper carries no
 * braced expression, so it adds nothing; re-ordering siblings re-sorts to the
 * same list; moving a band between two wrappers inside one tree does not leave
 * the tree. A QUOTED attribute value never enters at all — it is a CHOICE the
 * receiving file already distinguishes, which is what keeps `className="text-xl"`
 * → `"text-3xl"` on the cheap path. A BRACED value always does, because that is
 * where computation lives.
 *
 * ⚠ WHAT IT COSTS, MEASURED RATHER THAN GUESSED. Associating a site with what it
 * renders necessarily makes MOVING a braced-prop element BETWEEN two executable
 * sites visible, and that is the one case this is dearer than the opaque leaf —
 * moving a component from one local render function to another. **Over the
 * 100-site corpus, 316 of 324 files (97.5%) have exactly ONE executable JSX
 * site**, so the case cannot arise in them at all; the other 8 have two (seven
 * of them) or six (one), and it needs a braced-prop element to cross between.
 * Against publishing a loading state where a live component belongs, that is the
 * direction to be wrong in.
 *
 * ⚠ CANNOT-TELL FAILS CLOSED, AND THE PARSER IS THE CANNOT-TELL. The parser is
 * `typescript`, which the container resolves from the template's own install
 * and which a Worker bundle may not carry, so it is loaded through
 * `tweakParser()` and INJECTED. With no parser this rung cannot establish that
 * the computation is unchanged — so on a component-bearing page it is not
 * eligible, and the request goes to the writer that can open both files. That
 * is the safe direction: it costs a rewrite, never a wrong publish.
 *
 * IT IS NOT A BAN ON PAGES WITH COMPONENTS, which is the thing this fix must
 * not be. `fretwork-1`'s home page renders three of them; a heading tweak, a
 * band reorder, a new `<section>` wrapper and added plain markup all leave both
 * signatures untouched and take the cheap path — asserted as positive controls
 * through the real route. A page that renders NONE of the site's own components
 * is not asked this question at all.
 *
 * WHAT IT COSTS, STATED. A tweak that legitimately changes a component-bearing
 * page's computation escalates and pays the rewrite it would otherwise have
 * skipped, roughly one credit over the tweak's own; so does one that rewrites a
 * BRACED value anywhere in the markup, including `className={cn(…)}`. Against
 * publishing a full day as having space, that is the direction to be wrong in —
 * and the rung it escalates to is the one SHOWN the component source
 * (`partsSent`) which folds its answer back (`mergeParts`), which is exactly
 * the writer such a request needs.
 */
export function partEligible(before, after, { inPart, parse } = {}) {
  const parts = localParts(before, inPart).concat(localParts(after, inPart));
  const names = [...new Set(parts.map((p) => p.name))].sort();
  // A page that renders none of the site's own components keeps every word of
  // its old contract: there is no file this rung cannot open, so nothing here
  // can be a change it is unable to finish.
  if (!names.length) return { ok: true };
  // THE PARSER IS THE EVIDENCE. Without it there is no claim to make, and the
  // absence of a claim is not a pass.
  if (typeof parse !== "function") return { ok: false, parts: names, why: "no-parser" };
  let a = null;
  let b = null;
  try {
    a = computeShape(before, parse);
    b = computeShape(after, parse);
  } catch {
    // A source neither side can parse is one this rung cannot reason about.
    return { ok: false, parts: names, why: "unparsed" };
  }
  if (a.shape !== b.shape) return { ok: false, parts: names, why: "compute" };
  return { ok: true };
}

/**
 * ONE SIGNATURE, read off the real syntax tree — `{shape}`.
 *
 * `sig` walks every construct IN ORDER; where it meets JSX it hands over to
 * `markup`, which collapses that whole subtree to a SORTED multiset of the
 * expressions it carries and hands the string straight back into the ordered
 * signature at the position the subtree stood in. That one join is what ties
 * executable context and branch position to the JSX they render.
 *
 * ⚠ IT USED TO RETURN TWO SIGNATURES AND A JSX SUBTREE WAS AN OPAQUE LEAF —
 * `"<jsx/>"` wherever it stood — with the multiset pooled across the whole file
 * beside it. That is exactly the fifth bypass: `cond ? <p>Checking</p> :
 * <DaySpaceLookup …/>` and its two arms swapped are two identical leaves in the
 * ordered half and one identical pool in the other, so a loading state and a
 * live component could be exchanged and published as a `tweak`. The pool is not
 * kept as a second value: once each site's own multiset rides in place, the
 * whole-file union is implied by this string, and a second copy of an implied
 * thing is this repository's own recorded drift.
 *
 * ⚠ `forEachChild` STOPS ON A TRUTHY CALLBACK RETURN, and the first cut of this
 * walked exactly one child of every node because `kids.push(…)` answers the new
 * LENGTH. Every one of the bypasses read as eligible against a comparison that
 * was structurally correct and simply had not looked. The callback returns
 * nothing on purpose, and the guard drives a shape whose difference is in the
 * SECOND operand so a re-introduction cannot pass.
 */
export function computeShape(source, parse) {
  const { file, k, isJsx, tagOf, openOf, attrsOf, childrenOf, exprOf, isSpread } = parse(String(source ?? ""));

  // A JSX subtree, as the sorted multiset of every expression it carries.
  // SORTED so re-ordering and re-wrapping markup answer the same string; KEYED
  // by tag and attribute so a value swapped between two components does not.
  const markup = (root) => {
    const bag = [];
    const take = (node) => {
      const tag = tagOf(node);
      for (const attr of attrsOf(openOf(node))) {
        // A SPREAD carries whatever the object holds, so it is a value by any
        // reading and is keyed as one rather than skipped.
        if (isSpread(attr)) {
          bag.push(tag + "\u0000...\u0000" + sig(attr.expression));
          continue;
        }
        const braced = exprOf(attr);
        if (braced) bag.push(tag + "\u0000" + (attr.name?.getText?.() ?? "?") + "\u0000" + sig(braced));
      }
      for (const child of childrenOf(node)) {
        const braced = exprOf(child);
        // A BRACED child goes through `sig`, which encodes any JSX inside it in
        // ORDER — so a ternary written as markup is positioned exactly as one
        // written as a return value. Descending as well would count it twice.
        if (braced) { bag.push(tag + "\u0000{}\u0000" + sig(braced)); continue; }
        if (isJsx(child)) take(child);
      }
    };
    take(root);
    return bag.sort().join(",");
  };

  const sig = (node) => {
    if (isJsx(node)) return "<jsx:" + markup(node) + ">";
    const kids = [];
    node.forEachChild((c) => {
      kids.push(sig(c));
    });
    if (!kids.length) return k(node) + ":" + (node.getText ? node.getText() : "");
    return k(node) + "(" + kids.join(",") + ")";
  };

  return { shape: sig(file) };
}

/**
 * Is this page even a candidate?
 *
 * Separate from `readTweak` so the caller can decide BEFORE paying for a model
 * call — a page too large to send cheaply should go straight up the ladder
 * rather than spending a call to be told so.
 */
export function tweakable(source) {
  const s = String(source == null ? "" : source);
  if (!s.trim()) return { ok: false, reason: "empty" };
  if (s.length > MAX_TWEAK_CHARS) return { ok: false, reason: "too-big" };
  return { ok: true };
}

/**
 * One cheap attempt, with the model call injected.
 *
 * NEVER THROWS. This sits in front of a path that already works, so a failure
 * here has exactly one correct outcome — carry on to the rewrite — and an
 * exception escaping would turn "the cheap rung was unavailable" into "the edit
 * failed", which is strictly worse than not having built it.
 */
export async function runTweak({ instruction, path, source, send, rules, heading, model = TWEAK_MODEL, inPart }) {
  const can = tweakable(source);
  if (!can.ok) return { ok: false, reason: can.reason, usage: null };
  let reply = null;
  try {
    reply = await send(tweakRequest({ instruction, path, source, rules, heading, model }));
  } catch (e) {
    // The provider, not the page. Reported as its own reason so a run of these
    // in a log reads as an outage rather than as the model refusing every tweak.
    return { ok: false, reason: "send", usage: null, error: e };
  }
  // THE USAGE IS KEPT ON EVERY PATH, including a refusal — the call really
  // happened and the customer is charged for what was used, which is the rule
  // the whole billing tier is built on. A refusal is ~1 credit; hiding it would
  // be a small silent undercharge on the commonest failure there is.
  // `inPart` IS FORWARDED, not re-derived: which spellings name a sibling
  // component depends on where the edited file itself lives, and the caller is
  // the only side that knows. Dropping it here is the wiring trap this
  // repository records twelve times over, so the guard drives the hop.
  // THE PARSER IS LOADED AT THIS EDGE because `readTweak` is synchronous and
  // twelve callers' worth of async would be the wrong change to make for one
  // gate. `tweakParser` caches, so this is one resolution per isolate; it
  // answers `null` where there is none and `partEligible` decides what that
  // absence means. `parse` IS FORWARDED, not re-derived — dropping it here is
  // the wiring trap this repository records twelve times over, so the guard
  // drives the hop and a mutant cutting it dies.
  const parse = await tweakParser();
  return { ...readTweak(reply, { source, inPart, parse }), usage: tweakUsage(reply, model) };
}

/**
 * What the customer is told when the cheap rung handled it.
 *
 * NAMES THE PAGE, because a tweak is invisible from anywhere else on the site —
 * "Updated the look" with no address sends somebody to the home page to look
 * for a change made on /book, which reads as a failure. Same reasoning as
 * `tokensPage` in the look lane.
 */
export function tweakReply(page) {
  const where = String(page || "").trim();
  return "✅ Done" + (where ? " on " + where : "") + " — I changed only that, and left your wording exactly as it was.";
}

/**
 * THE PARSER, LOADED OPTIONALLY AND CACHED — `null` when there is none.
 *
 * ⚠ THE SPECIFIER IS ASSEMBLED AT RUNTIME ON PURPOSE. `typescript` is a
 * DEVELOPMENT dependency of this package: the container resolves it from the
 * template's own `node_modules` (the template is a TypeScript project and
 * installs it), while the Worker's runtime is `npm ci --omit=dev` and its
 * bundle is built by Wrangler. A literal `import("typescript")` would ask a
 * bundler to pull a ~9 MB compiler into a Worker to run one gate; an assembled
 * specifier cannot be resolved statically, so it stays a runtime import that
 * either answers or throws. Both outcomes are handled and neither is a guess.
 *
 * A FAILURE HERE IS NOT AN ERROR, it is an absence — `partEligible` turns that
 * absence into an escalation on the pages where it matters and into nothing at
 * all on the pages where it does not. The result is cached including the
 * `null`, so a Worker isolate pays the failed resolution once.
 *
 * THE ADAPTER IS WHAT KEEPS THE RULE PARSER-AGNOSTIC: `computeShape` is handed
 * eight small readers and knows no TypeScript API, so the decision stays in
 * this module and the dependency stays at its edge.
 */
let PARSER = undefined;

export async function tweakParser() {
  if (PARSER !== undefined) return PARSER;
  PARSER = null;
  try {
    const name = ["type", "script"].join("");
    const mod = await import(/* @vite-ignore */ name);
    const ts = mod?.default ?? mod;
    if (!ts?.createSourceFile) return PARSER;
    const J = new Set([
      ts.SyntaxKind.JsxElement,
      ts.SyntaxKind.JsxSelfClosingElement,
      ts.SyntaxKind.JsxFragment,
    ]);
    PARSER = (text) => ({
      file: ts.createSourceFile("page.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
      k: (n) => ts.SyntaxKind[n.kind],
      isJsx: (n) => J.has(n.kind),
      openOf: (n) => (n.kind === ts.SyntaxKind.JsxSelfClosingElement ? n : n.openingElement),
      tagOf: (n) => {
        const o = n.kind === ts.SyntaxKind.JsxSelfClosingElement ? n : n.openingElement;
        return o?.tagName?.getText?.() ?? "#fragment";
      },
      attrsOf: (open) => open?.attributes?.properties ?? [],
      childrenOf: (n) => n.children ?? [],
      isSpread: (a) => a.kind === ts.SyntaxKind.JsxSpreadAttribute,
      // A QUOTED value answers null: it is a choice, not a computation.
      exprOf: (n) =>
        n?.kind === ts.SyntaxKind.JsxExpression
          ? n.expression ?? null
          : n?.initializer?.kind === ts.SyntaxKind.JsxExpression
            ? n.initializer.expression ?? null
            : null,
    });
  } catch {
    // No parser in this runtime. Named by its consumer, never swallowed.
  }
  return PARSER;
}
