// What the designer eval ASKS of an answer, apart from the machinery that gets
// one.
//
// SPLIT OUT SO IT CAN BE DRIVEN WITHOUT A MODEL CALL. The checks are the whole
// judgement of the harness — if `seeded` cannot see an unseeded table, or
// `capacityFn` accepts a function with no lock, the eval reports a clean run on
// a broken schema and is worse than not measuring. Every one is exercised in
// `test/schema-checks.test.mjs` against fabricated answers, at zero cost, which
// is the only part of this harness that can be verified while the model account
// is empty.
import { resolveAccess, unguardedBookings } from "../../site-access.mjs";
import { normalizePlan } from "../../builder/site-plan.mjs";
import { parseStyle, ASKABLE, MAX_STYLE_BUILD } from "../../builder/site-style.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// THE SCENARIOS, each aimed at a failure this platform has really shipped.
export const SCENARIOS = [
  {
    key: "menu",
    brief: "A neighbourhood café in Leeds — the menu with prices, who we are, opening hours and how to find us. No online ordering.",
    // MEASURED FAILURE, twice this week: the designer left out `seed`, a field
    // its own tool marks required, and the site published with an empty price
    // list. Nothing can write to a display table after a build.
    expect: ["seeded"],
  },
  {
    key: "booking",
    brief: "A barber shop taking appointments online — customers pick a service and a time slot, one chair, and I want their name and phone.",
    // MEASURED FAILURE, 2026-07-28: two customers booked the same 14:00 and
    // both were accepted. The constraints became declarable; nothing checks
    // that a booking table came back carrying one.
    expect: ["seeded", "slotGuarded"],
  },
  {
    key: "marketplace",
    brief: "A local events marketplace: people post their own events to sell tickets, and anybody browsing the site can see what is on.",
    // MEASURED FAILURE, 2026-08-10: every table came back private per member,
    // so not one visitor could see a single event, there was no home page to
    // write, and the whole site published as the placeholder.
    expect: ["browsable"],
  },
  {
    key: "capacity",
    brief: "A yoga studio: each class has 12 places and people book a spot online. When a class is full it should say so.",
    // NOT a past failure — this one measures the change made 2026-08-12. The
    // capacity pattern (a function that locks, counts and refuses) was
    // unreachable until the tool described it, and no build has run since.
    expect: ["seeded", "capacityFn"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
/**
 * WHICH of the ways an answer can be useless was this one?
 *
 * FOUR OUTCOMES WORE ONE SENTENCE — "no tables" — and they need opposite fixes.
 * Measured 2026-08-13: the yoga-studio sample failed, the report said "no
 * tables", and the cause could not be established without paying for another
 * run. That is the `validatePages` lesson (2026-08-10) — where an absent list,
 * an empty one, a list of empty pages and a tool call that never happened all
 * printed one line — and this harness never got it.
 *
 * `stop_reason` is the one that CANNOT be worked out afterwards: `max_tokens`
 * means WE cut the model off and the budget is ours to fix, while `tool_use`
 * means it finished and meant what it said. Opposite responses, identical
 * summary line.
 *
 * The output-token count rides on every message, because it is the single
 * number separating "the model said almost nothing" from "it wrote a whole
 * schema and we dropped it".
 *
 * Returns "" when the answer really did carry tables — so a clean run's output
 * is unchanged.
 */
export function emptyReason(input, called, stopReason, outTokens) {
  const tail = " [stop=" + stopReason + ", out=" + outTokens + " tok]";
  // FIRST, because a truncated reply can also be missing its tool call and its
  // `tables` key — reporting either of those would name a symptom and hide the
  // cause, which is ours.
  if (stopReason === "max_tokens") return "the reply was CUT OFF at max_tokens — ours, not the model's" + tail;
  if (!called) return "the model never called the tool at all" + tail;
  if (!input || typeof input !== "object") return "the tool was called with no input object" + tail;
  if (!("tables" in input)) return "`tables` was MISSING — a required field the model skipped" + tail;
  // A STRING that parses is now recovered by `normalizeSchema`, so reaching
  // here with one means it did NOT parse — and those are different problems.
  // Recovered: the model serialised a good answer, nothing is lost, and this
  // function is never reached. Unparseable: the answer really is broken.
  // Saying "not a list" for both would describe a fixed bug as a live one.
  if (typeof input.tables === "string") {
    return "`tables` was a string that is NOT valid JSON — a stringified list would have been recovered" + tail;
  }
  if (!Array.isArray(input.tables)) return "`tables` came back as " + typeof input.tables + ", not a list" + tail;
  if (!input.tables.length) return "the model sent `tables: []` — it answered 'none' deliberately" + tail;
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * WHAT THE DESIGNER DID WITH THE 23 STYLE AXES.
 *
 * NOTHING HAS EVER MEASURED THIS HALF. The eval judges tables, seeds, access
 * and the plan; the style block is the other thing every `design_schema` call
 * answers, and the harness had no opinion about it at all — so the only
 * evidence about it is whatever a live build happens to publish.
 *
 * Measured on run 14 (`pierhead-lido`, 2026-08-22), the first build since the
 * axes became authorable: the model set roughly SEVEN of twenty-three, wrote
 * its own CSS for `backdrop`, named `plaster` for `decor`, and left `corner`
 * and `hover` at the template's defaults. One data point, and no way at all to
 * tell "the designer uses the axes sparingly" from "that build was quiet".
 *
 * DRIVEN THROUGH THE REAL `parseStyle` rather than counting keys, because the
 * question is not what the model NAMED — it is what SURVIVES, which is what a
 * customer's site gets. An axis the engine does not know, an option outside its
 * enum and a refused authored value are all answers spent on nothing, and none
 * of them is visible from the raw object.
 *
 * `MAX_STYLE_BUILD` because that is what the build path passes. It is
 * `ASKABLE.length` — a no-op by construction — so `dropped` here can never mean
 * "past the cap", which is exactly what makes every entry in it a real fault.
 *
 * THE ONE THING THIS CANNOT SEE, and it is stated so nobody reads a clean run
 * as more than it is: with no palette, an authored layer naming `var(--accent)`
 * is DEFERRED rather than refused — `normalizeSeeds` runs in the container, so
 * the Worker holds three hex seeds and none of the 31 derived tokens. So the
 * refusals this reports are the ones decidable from the TEXT (a `url()`, a
 * semicolon, an unbalanced bracket, a bad unit) and the container is still the
 * only place the rest are judged.
 */
export function styleReport(out) {
  const raw = (out && out.style && typeof out.style === "object" && !Array.isArray(out.style)) ? out.style : {};
  const asked = Object.keys(raw);
  const r = parseStyle(raw, { max: MAX_STYLE_BUILD });
  const kept = Object.keys(r.style || {});
  const authored = Object.keys(r.authored || {});
  const refused = r.refused || [];
  // `dropped` carries the axis name AFTER the `backdropCss` fold, so a refused
  // authored value appears in both bags under one name. Named apart here, or a
  // single refusal is reported twice and reads as two faults.
  const refusedNames = new Set(refused.map((x) => x.axis));
  return {
    asked: asked.length,
    kept, authored, refused,
    dropped: (r.dropped || []).filter((n) => !refusedNames.has(String(n).trim().toLowerCase())),
    total: ASKABLE.length,
  };
}

/** The per-sample line: how much of the look the designer actually authored. */
export function styleLine(out) {
  const s = styleReport(out);
  if (!s.asked) return "style: none of " + s.total;
  const set = s.kept.length + s.authored.length;
  return "style: " + set + "/" + s.total
    + (s.authored.length ? " (authored: " + s.authored.join(",") + ")" : "")
    + " · " + [...s.kept, ...s.authored].sort().join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// THE CHECKS. Each is a property that is true or false, never a judgement.
export const CHECKS = {
  seeded(out, spec) {
    const display = spec.tables.filter((t) => resolveAccess(t).read === "public" && resolveAccess(t).write === "none");
    if (!display.length) return { ok: null, why: "no display table to seed" };
    const seed = (out && out.seed) || {};
    const empty = display.filter((t) => !Array.isArray(seed[t.name]) || !seed[t.name].length);
    if (!empty.length) return { ok: true, why: "" };

    // WHICH SILENT SHAPE, because "unseeded: a,b" is true of five different
    // answers that need different fixes — and this harness has already paid
    // for that once, in `whyNoTables` above, for exactly the same reason.
    //
    // Measured 2026-08-15: the café brief came back unseeded on 3 of 5
    // samples, and every one of them had declared TWO display tables and
    // seeded NEITHER — which is not "forgot the second", it is "produced no
    // seed at all". That distinction decides whether the fix is a prompt
    // change or a key mismatch, and the report could not make it.
    //
    // The field's own tool description names three of these shapes (absent,
    // `{}`, an empty array). The one it does NOT name is the interesting one:
    // a `seed` full of rows under keys that are not table names, which reads
    // in the report as identical to not answering and is a completely
    // different bug. So the KEYS ARE PRINTED whenever there are any.
    const raw = out && out.seed;
    let shape;
    if (raw === undefined) shape = "no `seed` key at all";
    else if (raw === null) shape = "`seed` was null";
    else if (Array.isArray(raw)) shape = "`seed` came back as a LIST, not an object keyed by table";
    else if (typeof raw !== "object") shape = "`seed` came back as " + typeof raw;
    else {
      const keys = Object.keys(raw);
      if (!keys.length) shape = "`seed: {}` — the key was there and empty";
      else {
        // Named apart, because "the key is missing" and "the key is there
        // holding nothing" are a prompt problem and a truncation problem.
        const named = empty.map((t) => {
          const v = raw[t.name];
          if (v === undefined) return t.name + "=missing";
          if (Array.isArray(v)) return t.name + "=[] empty";
          return t.name + "=" + (v === null ? "null" : typeof v);
        });
        shape = named.join(" ") + " · seed keys present: " + keys.join(",");
      }
    }
    return { ok: false, why: "unseeded: " + empty.map((t) => t.name).join(",") + " — " + shape };
  },
  slotGuarded(out, spec) {
    const bad = unguardedBookings(spec);
    return { ok: !bad.length, why: bad.length ? "nothing holds the slot on: " + bad.join(",") : "" };
  },
  browsable(out, spec) {
    // Signed OUT. `publicView` counts, because that is the other honest route
    // to a page a stranger can open.
    const open = spec.tables.filter((t) => resolveAccess(t).read === "public" || t.publicView);
    return { ok: !!open.length, why: open.length ? "" : "no table a signed-out visitor can read" };
  },
  capacityFn(out, spec) {
    // The pattern the tool now describes: writes closed, and a function that
    // takes the lock. Either half alone is not it — a closed table with no
    // function cannot be booked at all, and a function beside an open table is
    // walked around by a direct POST.
    const closed = spec.tables.filter((t) => resolveAccess(t).write === "none");
    const fns = Array.isArray(out && out.functions) ? out.functions : [];
    const locking = fns.filter((f) => /pg_advisory_xact_lock/i.test(String((f && f.body) || "")));
    if (!fns.length) return { ok: false, why: "no functions declared at all" };
    if (!locking.length) return { ok: false, why: "a function, but none takes the lock — it races on the last place" };
    if (!closed.length) return { ok: false, why: "a locking function beside a table anyone can still insert into" };
    return { ok: true, why: "" };
  },
  // ALWAYS RUN, on every scenario — these are the ways an answer can be
  // structurally unusable rather than merely thin.
  // WAS `validFamily`, which asked whether the designer had named one of 100
  // trades. It answers a PLAN now, so the structural question is whether that
  // plan survives `normalizePlan` — an answer that does not is one where
  // `directiveFromPlan` returns null and the page generator is handed the bare
  // brief with no page list, no shape and no component manifest, silently.
  //
  // DRIVEN THROUGH THE REAL NORMALISER rather than restating its rules, because
  // a second copy of "what counts as a usable plan" drifts, and the direction it
  // drifts in is an eval reporting a clean run on an answer production drops.
  validPlan(out) {
    const plan = normalizePlan(out);
    if (!plan) {
      const why = !out || !String(out.purpose || "").trim() ? "no purpose" : "no usable page path";
      return { ok: false, why };
    }
    // The manifest is what the per-site signature block is built from, so an
    // empty one means the model writes pages against the cached core alone.
    // OPTIONAL ON THE NORMALISED SHAPE — it OMITS a field that came back empty
    // rather than emitting `[]` — so this reads through, or the check throws and
    // the whole sample reports as an infrastructure error instead of a thin plan.
    if (!(plan.components || []).length) return { ok: false, why: "a plan with no components named" };
    return { ok: true, why: "" };
  },
  tablesSurvive(out, spec) {
    const asked = Array.isArray(out && out.tables) ? out.tables.length : 0;
    return { ok: asked > 0 && spec.tables.length === asked,
             why: asked ? (spec.tables.length === asked ? "" : asked + " declared, " + spec.tables.length + " survived the normaliser") : "no tables" };
  },
  /**
   * EVERY AXIS THE DESIGNER NAMED SURVIVED THE ENGINE.
   *
   * SETTING FEW AXES IS NOT A FAILURE and is deliberately not judged here — how
   * much of a look to author is the designer's call, and this file's own rule is
   * that a check is a property and never a judgement. `styleLine` carries the
   * count so the series accumulates; only the count is not a verdict.
   *
   * What IS a property: an answer the engine threw away. An unknown axis, an
   * option outside its own enum, a non-string where a name belongs, or authored
   * CSS `site-css.mjs` refuses — each is a slot spent producing nothing, and the
   * customer is told the axis was refused on a site that then renders the
   * default. Exactly the class `seeded` catches one field over.
   *
   * REFUSALS ARE NAMED WITH THEIR REASON, because "dropped: backdrop" is true of
   * a misspelt enum option and of a gradient carrying a `url()`, and those want
   * opposite fixes — one is a prompt problem and one is the authored hint not
   * naming its own refusals. The `emptyReason` lesson, on the style half.
   */
  styleClean(out) {
    const s = styleReport(out);
    if (!s.asked) return { ok: null, why: "the designer named no style axis" };
    if (!s.dropped.length && !s.refused.length) return { ok: true, why: "" };
    const parts = [];
    if (s.refused.length) parts.push("REFUSED " + s.refused.map((x) => x.axis + " (" + x.why + ")").join("; "));
    if (s.dropped.length) parts.push("dropped " + s.dropped.join(","));
    return { ok: false, why: parts.join(" · ") + " — of " + s.asked + " named" };
  },
};
export const ALWAYS = ["validPlan", "tablesSurvive", "styleClean"];
