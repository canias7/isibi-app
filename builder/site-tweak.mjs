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
// The runtime-correctness check. Imported rather than injected because it is
// pure — no Worker, no container, no network — so importing it costs this
// module none of the properties above, and injecting it would put the one thing
// that makes the rung safe behind a caller remembering to pass it.
import { lintPages } from "./page-gen.mjs";

/** Haiku. Editing a className is not a design task, and the saving IS the model. */
export const TWEAK_MODEL = "claude-haiku-4-5";

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
 */
export const MAX_TWEAK_CHARS = 24000;

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
export function tweakRequest({ instruction, path, source, rules = TWEAK_RULES, heading = "THE CHANGE THEY ASKED FOR" }) {
  const what = String(instruction == null ? "" : instruction).trim();
  const file = String(source == null ? "" : source);
  return {
    model: TWEAK_MODEL,
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
export function tweakUsage(reply) {
  const u = reply && reply.usage;
  if (!u) return null;
  return {
    model: TWEAK_MODEL,
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
export function readTweak(reply, { source } = {}) {
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
export async function runTweak({ instruction, path, source, send, rules, heading }) {
  const can = tweakable(source);
  if (!can.ok) return { ok: false, reason: can.reason, usage: null };
  let reply = null;
  try {
    reply = await send(tweakRequest({ instruction, path, source, rules, heading }));
  } catch (e) {
    // The provider, not the page. Reported as its own reason so a run of these
    // in a log reads as an outage rather than as the model refusing every tweak.
    return { ok: false, reason: "send", usage: null, error: e };
  }
  // THE USAGE IS KEPT ON EVERY PATH, including a refusal — the call really
  // happened and the customer is charged for what was used, which is the rule
  // the whole billing tier is built on. A refusal is ~1 credit; hiding it would
  // be a small silent undercharge on the commonest failure there is.
  return { ...readTweak(reply, { source }), usage: tweakUsage(reply) };
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
