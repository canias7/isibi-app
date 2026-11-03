// PARKED (2026-11-03, park-old-way): the old-way half of test/edit-page-contract.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// ⚠ A TWEAK THAT CHANGED WHAT A COMPONENT IS PASSED, WITHOUT BEING ABLE TO
// READ WHAT THAT COMPONENT SAYS ABOUT IT — run 17, 2026-09-22.
//
// THE DEFECT, REPRODUCED HERE ON THE RUN'S OWN BEFORE-SOURCE AND EXACT
// INSTRUCTION. Asked to make the *"Space on a preferred day"* box count down
// the places left instead of the bookings, the cheap rung changed one line of
// `index.tsx` — `bookingCount={Number(bookingCount ?? 0)}` to
// `bookingCount={6 - Number(bookingCount ?? 0)}` — and nothing else. Four
// bytes. `sameProse` perfect: zero tokens lost, two gained. `tweakLint` clean.
// Published as a success, `tweak: true`, cost 8.
//
// The sentences that interpret that number live in
// `-parts/day-space-lookup.tsx`, which `runTweak` cannot open: it takes ONE
// page's source and answers ONE page's source. So the live box read
// **"6 bookings already on this day"** on an EMPTY day, and — because the
// component words zero as *"it still has space"* — would read **"No bookings
// on this day yet — it still has space"** on a FULL one. A full day
// advertising space, shipped, reported done.
//
// ⚠ AND IT HAS A SECOND SPELLING, REPORTED FROM THE REAL ROUTE AFTER THE FIRST
// FIX SHIPPED. Move the arithmetic one line UP the page —
//
//     const { data: rawBookingCount } = useRpc(…);
//     const bookingCount = 6 - Number(rawBookingCount ?? 0);
//
// — and leave `bookingCount={Number(bookingCount ?? 0)}` byte-identical, and a
// check that compares prop EXPRESSIONS matches itself: `ok: true`, `tweak:
// true`, the wrong page in the compiler and in the store, the component's old
// wording untouched. The value a component receives is its expression PLUS the
// definition of every page name that expression reads, so the comparison is
// keyed on the expression and that closure. Both spellings are driven here,
// through the route, against the same sources.
//
// WHAT IS ASSERTED, AND WHY EACH HALF IS NEEDED:
//
//   1. THE REFUSAL IS BESIDE THE PASS. `sameProse` still answers true on the
//      real diff — on ALL THREE spellings — and `partEligible` refuses each BY
//      NAME. Both readings in one case, because the finding is precisely that
//      the promise was kept and the change was still incomplete.
//   2. THROUGH THE ROUTE, TWICE. The stubbed `write_tweak` returns the exact
//      source run 17 published, and then the upstream form — each derived from
//      the before-source by its own stated edit, with the anchor asserted to
//      occur exactly once — and the route must publish NEITHER. One shared
//      body, so the two cannot drift.
//   3. THE POSITIVE CONTROL, on the SAME page, which carries three components
//      and eleven prop bindings: an ordinary visual tweak still takes the
//      cheap path. Without this the fix would read as "disable tweaks wherever
//      a page has components", which is not the fix. Beside it, at the module,
//      a literal bound to a name stays a choice: `columns={cols}` over
//      `const cols = 3` → `4` is a literal swap one indirection out.
//   4. THE CORRECTED PAIR, VERIFIED TOGETHER — the compiler payload, the
//      stored source, and the wording a visitor really reads, rendered with
//      real React against SUPPLIED booking counts. No rows are created and no
//      booking-enforcement rule is touched: the counts are arguments.
//
// ⚠ WHAT THE ROUTE CASES DO NOT ESTABLISH. The corrected pair is a SUPPLIED
// model answer, so what is proven is the EXECUTION PATH — that a request of
// this class is not published by the rung that cannot finish it, and reaches
// the writer that can open both files — and never that a real model produces a
// correct component once it gets there.
//
// Nothing here reaches a model and nothing is spent.

import test from "node:test";
import { tweakInput, asEdits } from "../../../test/fixtures/tweak-edits.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "../../../test/fixtures/cf-containers.mjs";
import { renderPart } from "../../../test/fixtures/render-part.mjs";
import { CONFIG_KEY } from "../../../site-config.mjs";
import { TWEAK_TOOL, sameProse, partEligible, computeShape, tweakParser, readTweak as readTweakRaw, runTweak } from "../../../builder/site-tweak.mjs";
import { asEditsReply } from "../../../test/fixtures/tweak-edits.mjs";
// The tool answers with exact edits (idea #18): a whole-file answer here is turned into them.
const readTweak = (r, o) => readTweakRaw(asEditsReply(r, o && o.source), o);

// ⚠ THE PARSER IS LOADED ONCE AND PROVED ALIVE, because every eligibility case
// below is VACUOUS without it: with no parser `partEligible` refuses a
// component-bearing page unconditionally, so the four bypass cases would pass
// for the wrong reason and the four controls would fail loudly enough to be
// noticed — which is the safe half. This file asserts the half that is not
// self-announcing: that a real syntax tree is what the refusals are read off.
const PARSE = await tweakParser();
import { SITE_PAGES_TOOL } from "../../../builder/page-gen.mjs";
import { localParts, PART_DIR } from "../../../builder/site-files.mjs";

const USER = { id: "u-contract-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const SRC_KEY = (slug) => "source/" + String(slug).toLowerCase() + "/pages.json";
const PARTS_KEY = (slug) => "source/" + String(slug).toLowerCase() + "/parts.json";
const F = (name) => readFileSync(new URL("../../../test/fixtures/run17/" + name, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const sha = (s) => createHash("sha256").update(String(s), "utf8").digest("hex").slice(0, 16);

// ── THE RUN'S OWN ARTIFACT ──────────────────────────────────────────────────
// `index.before.tsx` and `day-space-lookup.before.tsx` are the stored sources
// out of run 17's evidence bundle, byte for byte.
const HOME_BEFORE = F("index.before.tsx");
const LOOKUP_BEFORE = F("day-space-lookup.before.tsx");
const LOOKUP_AFTER = F("day-space-lookup.after.tsx");

// Two unrelated pages and two unrelated components of the same site, so
// "nothing else moved" is a claim about real neighbours rather than a fixture.
const GEAR = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/gear')({ component: Gear })\n"
  + "function Gear(){return <section><h1>Gear Board</h1></section>}\n";
const PRICES = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/prices')({ component: Prices })\n"
  + "function Prices(){return <section><h1>Current lesson rates</h1></section>}\n";
const CHORD = "export default function ChordDiagram(){return <svg data-slot=\"chord\" />}";
const TRIAL = "export default function TrialBookingForm(){return <form data-slot=\"trial\" />}";

/**
 * THE EXACT INSTRUCTION, WITH ITS HASH PINNED.
 *
 * ⚠ RUN 14 IS WHY THE HASH IS HERE. That run submitted a request nobody made,
 * because a blank field fell through to a default — and the retry was very
 * nearly prepared from a REMEMBERED sentence rather than the given one. A
 * paraphrase of this ask is a different ask: drop "six lesson slots a day" and
 * the capacity goes; drop the box's own name and nothing ties it to a thing on
 * the page. The hash is the one thing a later edit cannot quietly get wrong.
 */
const ASK = "The \"Space on a preferred day\" box counts bookings. Make it count down the places left instead — six lesson slots a day, so an empty day reads six places left.";

/** A replacement that REFUSES when its anchor is not there exactly once. */
function once(src, from, to, what) {
  const n = src.split(from).length - 1;
  assert.equal(n, 1, `${what}: the anchor occurs ${n} times in the fixture, expected exactly 1`);
  return src.split(from).join(to);
}

/**
 * THE SOURCE RUN 17 REALLY PUBLISHED, derived from the before-source rather
 * than stored as a second 26 KB copy of it — and the derivation is pinned by
 * hash, so this is the real artifact and not an approximation of it. Measured
 * against the run's own `after/source.json`: 26,280 bytes, byte-identical.
 */
const HOME_TWEAKED = once(
  HOME_BEFORE,
  "bookingCount={Number(bookingCount ?? 0)}",
  "bookingCount={6 - Number(bookingCount ?? 0)}",
  "the tweak's one line",
);

/**
 * THE SAME DEFECT SPELLED UPSTREAM — reported from a real edit-route run, and
 * the reason the check below reads a closure rather than a prop's text.
 *
 * The cheap rung moves the arithmetic into a page-local binding one line above
 * the element and leaves `bookingCount={Number(bookingCount ?? 0)}` BYTE-
 * IDENTICAL. Every prop expression matches, `sameProse` is perfect, and the
 * component still words the number as bookings — the same live page, reached by
 * a spelling no comparison of call sites can see.
 *
 * DERIVED FROM THE SAME BEFORE-SOURCE, through `once`, so it is the run's own
 * artifact with one stated edit and not a second hand-written page.
 */
const HOME_UPSTREAM = (() => {
  const s = once(
    HOME_BEFORE,
    "  const { data: bookingCount } = useRpc(\"bookings_on_day\", {\n    preferred_day: preferredDay,\n  });",
    "  const { data: rawBookingCount } = useRpc(\"bookings_on_day\", {\n    preferred_day: preferredDay,\n  });\n  const bookingCount = 6 - Number(rawBookingCount ?? 0);",
    "the useRpc read run 17's page makes",
  );
  // THE PROP IS UNTOUCHED, ASSERTED RATHER THAN INTENDED — without this the
  // fixture could drift into the inline shape and every case would still pass.
  assert.ok(s.includes("bookingCount={Number(bookingCount ?? 0)}"),
    "the upstream fixture moved the prop, which is the other case");
  assert.ok(s.includes("6 - Number(rawBookingCount ?? 0)"), "the upstream fixture computes nothing");
  return s;
})();

/**
 * AND THE SAME DEFECT SPELLED AS A REASSIGNMENT — reported through the real
 * edit route against the closure check, which is why that check is gone.
 *
 * The call site is untouched AND so is the declaration; what moves is a
 * statement after it. A reader that followed the prop to its declaration saw
 * two identical declarations and accepted the page. There is no third scanner
 * here: `partEligible` asks whether the page's COMPUTATION moved at all, so
 * this and the two before it are one answer rather than three cases.
 */
const HOME_REASSIGN = (() => {
  const s = once(
    HOME_BEFORE,
    "  const { data: bookingCount } = useRpc(\"bookings_on_day\", {\n    preferred_day: preferredDay,\n  });",
    "  let { data: bookingCount } = useRpc(\"bookings_on_day\", {\n    preferred_day: preferredDay,\n  });\n  bookingCount = 6 - Number(bookingCount ?? 0);",
    "the useRpc read run 17's page makes",
  );
  // BOTH the call site and the declaration are untouched, asserted rather than
  // intended — without this the fixture could drift into one of the other two.
  assert.ok(s.includes("bookingCount={Number(bookingCount ?? 0)}"),
    "the reassignment fixture moved the prop, which is the inline case");
  assert.ok(s.includes("bookingCount = 6 - Number(bookingCount ?? 0);"),
    "the reassignment fixture reassigns nothing");
  return s;
})();

/**
 * AND THE SAME DEFECT SPELLED AS OPERAND ORDER — reported through the real edit
 * route against the TOKEN MULTISET, which is why that instrument is gone.
 *
 * `Number(bookingCount ?? 0)` and `Number(0 ?? bookingCount)` carry the SAME
 * BAG OF TOKENS. Only their ORDER differs, and order is the whole of what `??`
 * means: the second always answers zero, so a fully booked day reads "No
 * bookings on this day yet — it still has space."
 *
 * ⚠ A BAG CANNOT EXPRESS POSITION, so no refinement of an unordered comparison
 * could have caught this — which is why the multiset was DELETED rather than
 * given a rule for `??`. The same argument covers `f(x,y)` against `f(y,x)`,
 * `a?b:c` against `a?c:b`, and `a-b` against `b-a`; all four are ONE answer
 * now, from a real syntax tree, and only this one needed a fixture.
 */
const HOME_OPERAND = (() => {
  const s = once(
    HOME_BEFORE,
    "bookingCount={Number(bookingCount ?? 0)}",
    "bookingCount={Number(0 ?? bookingCount)}",
    "the prop run 17's page passes the component",
  );
  // THE TOKEN MULTISET IS EQUAL, ASSERTED RATHER THAN ARGUED — this is the
  // property that made the old instrument blind, and a fixture whose bags
  // differed would be testing something else entirely.
  const bag = (t) => (t.match(/[A-Za-z_$][\w$]*|\d+|[^\s\w$]/g) ?? []).sort().join("\u0000");
  assert.equal(bag(s), bag(HOME_BEFORE),
    "the operand fixture moved a token, so it is not the reported case");
  assert.notEqual(s, HOME_BEFORE, "the operand fixture changed nothing at all");
  return s;
})();

/**
 * AND THE FIFTH SPELLING — A CONDITIONAL BRANCH POSITION, reported through the
 * real edit route against the parser-based check, which is why a JSX subtree is
 * no longer an opaque leaf.
 *
 * The page gains a loading guard, and the tweak SWAPS its two arms:
 *
 *     bookingCount === undefined ? <p>Checking…</p> : <DaySpaceLookup …/>
 *     bookingCount === undefined ? <DaySpaceLookup …/> : <p>Checking…</p>
 *
 * Every statement, declaration and hook is untouched; every prop expression is
 * untouched; the file's tokens are a permutation of themselves. What moves is
 * WHICH BRANCH RENDERS WHICH COMPONENT — so the page advertises availability
 * exactly while the data is missing, and shows the loading line once it
 * arrives.
 *
 * ⚠ THE OLD READER WAS BLIND TO IT BY CONSTRUCTION, TWICE OVER: every JSX node
 * answered the SAME placeholder, so the ternary's own shape could not move; and
 * the props rode in a FILE-WIDE bag, so both arms' expressions were in one pool
 * wherever they stood. Each half alone is sufficient to miss this, which is why
 * the fix is the JOIN — each JSX site's sorted multiset now rides IN PLACE
 * inside the ordered signature.
 */
const HOME_LOOKUP_EL = "          <DaySpaceLookup\n            preferredDay={preferredDay}\n            bookingCount={Number(bookingCount ?? 0)}\n            onPreferredDay={setPreferredDay}\n          />";
const HOME_CHECKING = "            <p>Checking availability</p>";

/** The BEFORE side: the guard as a writer would sensibly have written it. */
const HOME_GUARDED = once(
  HOME_BEFORE,
  HOME_LOOKUP_EL,
  "          {bookingCount === undefined ? (\n" + HOME_CHECKING + "\n          ) : (\n" + HOME_LOOKUP_EL + "\n          )}",
  "the DaySpaceLookup element run 17's page renders",
);

/** The AFTER side: the accepted tweak, with the two arms swapped and nothing else. */
const HOME_BRANCH_SWAPPED = (() => {
  const s = once(
    HOME_BEFORE,
    HOME_LOOKUP_EL,
    "          {bookingCount === undefined ? (\n" + HOME_LOOKUP_EL + "\n          ) : (\n" + HOME_CHECKING + "\n          )}",
    "the DaySpaceLookup element run 17's page renders",
  );
  // ⚠ THE TWO SIDES DIFFER ONLY IN BRANCH POSITION, ASSERTED RATHER THAN
  // INTENDED. A fixture whose token bags differed would be one of the four
  // earlier cases wearing this one's name, and the case would pass for the
  // wrong reason. The bag is over the WHOLE file, so the guard itself is
  // untouched by markup nesting.
  const bag = (t) => (t.match(/[A-Za-z_$][\w$]*|\d+|[^\s\w$]/g) ?? []).sort().join("\u0000");
  assert.equal(bag(s), bag(HOME_GUARDED),
    "the branch fixture moved a token, so it is not the reported case");
  assert.notEqual(s, HOME_GUARDED, "the branch fixture swapped nothing at all");
  return s;
})();

/**
 * AND THE SAME SWAP WITH ONE COMPONENT ON BOTH SIDES — the owner's own control,
 * and the harder half. Here the two arms render the SAME component and differ
 * only in the VALUE it is passed, so a reader keyed on which components appear
 * answers "the same two" and a reader keyed on which expressions appear answers
 * "the same two". Only a reader that keeps each expression AT ITS POSITION can
 * tell them apart, which is exactly the property this round installed.
 */
const SAME_COMPONENT_BEFORE = "import DaySpaceLookup from \"@/routes/-parts/day-space-lookup\"\n"
  + "function Panel({ count }){\n"
  + "  return <div>{count === undefined ? <DaySpaceLookup bookingCount={0} /> : <DaySpaceLookup bookingCount={Number(count)} />}</div>\n"
  + "}\n";
const SAME_COMPONENT_AFTER = "import DaySpaceLookup from \"@/routes/-parts/day-space-lookup\"\n"
  + "function Panel({ count }){\n"
  + "  return <div>{count === undefined ? <DaySpaceLookup bookingCount={Number(count)} /> : <DaySpaceLookup bookingCount={0} />}</div>\n"
  + "}\n";

/**
 * AND THE SIXTH SPELLING — A PROP-FREE CUSTOM COMPONENT, reported through the
 * real edit route against the branch-position fix, which is why the bag now
 * carries identities as well as expressions.
 *
 * The page gains a guard around a component that takes NO PROPS, and the tweak
 * swaps its arms:
 *
 *     preferredDay ? <TrialBookingForm /> : <p>Choose a day first</p>
 *     preferredDay ? <p>Choose a day first</p> : <TrialBookingForm />
 *
 * ⚠ THE FIFTH FIX WORKED EXACTLY AS DESIGNED AND STILL MISSED IT. Each JSX
 * site's multiset rides in place, so branch position IS recorded — but the
 * multiset is of EXPRESSIONS, and this component carries none, so both arms
 * collapsed to the same EMPTY bag. A correct mechanism over a subtree with
 * nothing in it.
 *
 * `<TrialBookingForm />` IS THE RUN'S OWN PROP-FREE RENDER, not one invented
 * for this fixture: the real page renders three of its own components and this
 * is the one that takes no props, asserted below.
 */
const HOME_TRIAL_EL = "<TrialBookingForm />";

/** The BEFORE side: the guard as a writer would sensibly have written it. */
const HOME_PROPFREE = once(
  HOME_BEFORE,
  HOME_TRIAL_EL,
  "{preferredDay ? <TrialBookingForm /> : <p>Choose a day first</p>}",
  "the prop-free component run 17's page renders",
);

/** The AFTER side: the accepted tweak, arms swapped and nothing else. */
const HOME_PROPFREE_SWAPPED = (() => {
  const s = once(
    HOME_BEFORE,
    HOME_TRIAL_EL,
    "{preferredDay ? <p>Choose a day first</p> : <TrialBookingForm />}",
    "the prop-free component run 17's page renders",
  );
  // ⚠ THE COMPONENT REALLY CARRIES NO PROPS, ASSERTED RATHER THAN INTENDED.
  // With a single braced prop this case would be round five wearing this one's
  // name, and would have passed against the very reader it is here to falsify.
  assert.ok(HOME_BEFORE.includes(HOME_TRIAL_EL), "the page stopped rendering the component prop-free");
  const bag = (t) => (t.match(/[A-Za-z_$][\w$]*|\d+|[^\s\w$]/g) ?? []).sort().join("\u0000");
  assert.equal(bag(s), bag(HOME_PROPFREE),
    "the prop-free fixture moved a token, so it is not the reported case");
  assert.notEqual(s, HOME_PROPFREE, "the prop-free fixture swapped nothing at all");
  return s;
})();

/**
 * AND THE OWNER'S OWN CONTROL: TWO DIFFERENT prop-free custom components
 * exchanged between the branches. Neither arm gains or loses a component, and
 * neither carries a prop — so a reader keyed on *which components appear*
 * answers "the same two" and one keyed on *which expressions appear* answers
 * "none, both times". Only identity AT ITS POSITION separates them.
 *
 * BOTH NAMES ARE THE PAGE'S OWN IMPORTS, asserted, so the fixture cannot drift
 * into naming a component this site has not got.
 */
const CONTROL_PAIR = (() => {
  const names = localParts(HOME_BEFORE, false).map((p) => p.name);
  for (const n of ["trial-booking-form", "day-space-lookup"]) {
    assert.ok(names.includes(n), "the control names a component the page does not import: " + n);
  }
  const mk = (a, b) => once(
    HOME_BEFORE,
    HOME_TRIAL_EL,
    `{preferredDay ? <${a} /> : <${b} />}`,
    "the prop-free component run 17's page renders",
  );
  return { before: mk("TrialBookingForm", "DaySpaceLookup"), after: mk("DaySpaceLookup", "TrialBookingForm") };
})();

/**
 * THE CORRECTED PAGE. The count keeps its meaning — the subtraction moves to
 * the component, beside the words that name its result — and the two states
 * that must never read as free space travel with it.
 *
 * `isPending` AND `isError` ARE THE KIT'S OWN, not invented for this fixture:
 * `useRpc` (`src/lib/rows.ts:875`) returns TanStack Query's `useQuery` result,
 * which carries both. A fixture that named fields the real hook does not have
 * would be a page no writer could produce — this repository's own
 * fixture-in-a-shape-reality-has-not trap.
 */
const HOME_FIXED = (() => {
  let s = once(
    HOME_BEFORE,
    "  const { data: bookingCount } = useRpc(\"bookings_on_day\", {\n    preferred_day: preferredDay,\n  });",
    "  const {\n    data: bookingCount,\n    isPending: bookingsPending,\n    isError: bookingsFailed,\n  } = useRpc(\"bookings_on_day\", {\n    preferred_day: preferredDay,\n  });",
    "the useRpc read",
  );
  return once(
    s,
    "          <DaySpaceLookup\n            preferredDay={preferredDay}\n            bookingCount={Number(bookingCount ?? 0)}\n            onPreferredDay={setPreferredDay}\n          />",
    "          <DaySpaceLookup\n            preferredDay={preferredDay}\n            bookingCount={Number(bookingCount ?? 0)}\n            slotsPerDay={6}\n            loading={bookingsPending}\n            failed={bookingsFailed}\n            onPreferredDay={setPreferredDay}\n          />",
    "the DaySpaceLookup element",
  );
})();

function bucket(slug, home = HOME_BEFORE) {
  const store = new Map([
    [SRC_KEY(slug), JSON.stringify([
      { path: "index.tsx", source: home },
      { path: "gear.tsx", source: GEAR },
      { path: "prices.tsx", source: PRICES },
    ])],
    [PARTS_KEY(slug), JSON.stringify([
      { name: "chord-diagram", source: CHORD },
      { name: "day-space-lookup", source: LOOKUP_BEFORE },
      { name: "trial-booking-form", source: TRIAL },
    ])],
    [CONFIG_KEY(slug), JSON.stringify({
      look: {
        brand: "Fretwork", slug, description: "Guitar lessons", theme: "broadsheet",
        tsx: [
          { name: "chord-diagram", does: "a chord diagram", props: "name, strings, fingers" },
          { name: "day-space-lookup", does: "space on a preferred day", props: "preferredDay, bookingCount" },
          { name: "trial-booking-form", does: "the trial booking form", props: "none" },
        ],
      },
      css: ":root{--background:oklch(100% 0 0)}",
    })],
  ]);
  const writes = [];
  return {
    store, writes,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v }; },
    async put(k, v) { writes.push([k, String(v)]); store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

function withWire(answers, run) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/rpc/use_credits")) {
      let want = 0;
      try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      return new Response(String(want), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_project")) return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/rest/v1/site_backends")) return new Response(JSON.stringify([{ uid: USER.id, brief: "" }]), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/v1/messages")) {
      let body = {};
      try { body = JSON.parse(String(init && init.body) || "{}"); } catch { body = {}; }
      const tool = body.tool_choice?.name || "";
      calls.push({ tool, body });
      if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      const a = answers[tool];
      const nth = calls.filter((c) => c.tool === tool).length - 1;
      return new Response(JSON.stringify({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", name: tool, input: tool === "write_tweak" ? tweakInput(typeof a === "function" ? a(nth) : a, body) : (typeof a === "function" ? a(nth) : a) }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  return (async () => {
    try { return await run(calls); } finally { globalThis.fetch = real; }
  })();
}

async function edit(slug, instruction, { store }) {
  const worker = await loadWorker();
  const req = new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: TOKEN },
    body: JSON.stringify({ layer: "page", page: "/", remove: false, rename: "", tab: false, instruction, picker: "sonnet" }),
  });
  const res = await worker.fetch(req, { SITES_BUCKET: store, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", ...dispatchEnv() }, makeCtx());
  return { status: res.status, body: await res.clone().json().catch(() => null) };
}

/** Every file the publish spine sent, pages and components in one map. */
function sentFiles(c) {
  assert.ok(c.calls.length >= 1, "nothing was compiled at all");
  const body = c.calls[c.calls.length - 1].body || {};
  const out = { ...(body.files || {}) };
  for (const p of Array.isArray(body.parts) ? body.parts : []) {
    if (p && typeof p.name === "string") out[PART_DIR + p.name + ".tsx"] = String(p.source || "");
  }
  return out;
}
const sentOne = (c, re) => {
  const f = sentFiles(c);
  const k = Object.keys(f).find((x) => re.test(x));
  assert.ok(k, "the compiler payload has no " + re + ": " + JSON.stringify(Object.keys(f)));
  return f[k];
};
function stored(store, slug) {
  const out = {};
  for (const p of JSON.parse(store.store.get(SRC_KEY(slug)) || "[]")) out[p.path] = p.source;
  for (const p of JSON.parse(store.store.get(PARTS_KEY(slug)) || "[]")) out[PART_DIR + p.name + ".tsx"] = p.source;
  return out;
}

/**
 * THE BOX'S ANSWER PARAGRAPH — its last `<p>`, read off the markup.
 *
 * ⚠ NOT "the last sentence of the text". The `<label>` between the blurb and
 * the answer carries no full stop, so splitting the flattened text on sentence
 * boundaries glues *"Preferred day"* onto the front of the answer — which is a
 * reading of the layout rather than of the sentence. The element is the thing
 * that means something here.
 */
const said = (src, props) => {
  const { html } = renderPart(src, { onPreferredDay() {}, ...props });
  const ps = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  assert.ok(ps.length, "the component rendered no paragraph at all: " + html.slice(0, 160));
  return ps.at(-1).replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
};

/**
 * ONE ROUTE CASE, DRIVEN TWICE — once for each spelling of the same defect.
 *
 * ⚠ IT IS A SHARED BODY AND NOT TWO CASES, deliberately. The two differ only in
 * what the cheap rung answers; everything that must hold — did not publish,
 * reached the component-capable writer, the writer was SHOWN the component's
 * wording, the payload, the store, the untouched neighbours — is the same claim
 * about both. Written out twice they drift, and the half that drifts is the one
 * nobody reads again.
 *
 * ⚠ AND THE CLAIM IS SCOPED: the corrected pair here is a SUPPLIED answer, so
 * what this establishes is the EXECUTION PATH — that the request reaches a
 * writer able to open both files — and never that a real model produces a
 * correct component when it gets there.
 */
async function doesNotPublish(slug, tweakSource, home = HOME_BEFORE, absent = []) {
  // Preserve the supplied before-page's loading branch. Fixing the component
  // does not authorize deleting that page text on the way past.
  const fixedPage = home === HOME_BEFORE ? HOME_FIXED : home;
  const store = bucket(slug, home);
  const c = installCompiler();
  try {
    await withWire({
      // The cheap rung answers what the reported run's did.
      [TWEAK_TOOL.name]: { source: tweakSource },
      // And the writer that CAN read components answers the corrected pair.
      [SITE_PAGES_TOOL.name]: {
        pages: [{ path: "src/routes/index.tsx", source: fixedPage }],
        parts: [{ name: "day-space-lookup", source: LOOKUP_AFTER }],
      },
      // THE COMPONENT'S OWN CHECK (audit A21-2, 2026-10-22): the corrected
      // component rewords the box the request is about (one line changed, the
      // empty-state line replaced), so a reading judge answers both asked.
      keep_check: { answers: [1, 2].map((n) => ({ n, asked: true, quote: "The \"Space on a preferred day\" box counts bookings. Make it count down the places left instead" })) },
    }, async (calls) => {
      const { body } = await edit(slug, ASK, { store });
      assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));

      // (a) IT DID NOT QUALIFY AS COMPLETION. The cheap rung was tried — the
      //     call really went out — and its answer was not published.
      assert.ok(calls.some((x) => x.tool === TWEAK_TOOL.name), "the cheap rung was never asked");
      assert.notEqual(body.tweak, true, "the arithmetic-only tweak was published as a success");

      // (b) IT REACHED THE WRITER THAT CAN READ THE COMPONENT, and that writer
      //     was SHOWN the component's source — otherwise it could not fix the
      //     wording even having been reached.
      const rewrite = calls.find((x) => x.tool === SITE_PAGES_TOOL.name);
      assert.ok(rewrite, "the rewrite rung was never reached");
      assert.ok(JSON.stringify(rewrite.body).includes("already on this day"),
        "the writer was not shown the component's own wording");

      // (c) THE COMPILER PAYLOAD carries the corrected pair, and the page no
      //     longer holds the misleading arithmetic — in EITHER spelling.
      const sentHome = sentOne(c, /index\.tsx$/);
      const sentPart = sentOne(c, /day-space-lookup\.tsx$/);
      assert.ok(!/6 - Number\((?:raw)?bookingCount/.test(sentHome),
        "the publish carried the arithmetic-only change");
      assert.ok(!sentHome.includes("rawBookingCount"),
        "the publish carried the upstream binding the tweak invented");
      assert.ok(!sentHome.includes("Number(0 ?? bookingCount)"),
        "the publish carried the operand-order change, which always answers zero");
      assert.ok(sentHome.includes("bookingCount={Number(bookingCount ?? 0)}"),
        "the count stopped being the booking count");
      // A SPELLING THE SHARED NEGATIVES CANNOT SEE gets its own, because the
      // branch swap leaves every expression above byte-identical — the shared
      // checks would pass on the very page it publishes.
      for (const [needle, why] of absent) {
        assert.ok(!sentHome.includes(needle), why);
      }
      assert.ok(sentPart.includes("placesLeft"), "the compiled component is not the corrected one");
      assert.ok(!/already on this day/.test(sentPart), "the compiled component still words the count as bookings");

      // (d) THE STORED SOURCE agrees, so the next edit starts from the fix.
      const st = stored(store, slug);
      assert.equal(st["index.tsx"], fixedPage, "the store kept a different page");
      assert.equal(st[PART_DIR + "day-space-lookup.tsx"], LOOKUP_AFTER, "the store kept a different component");

      // (e) UNRELATED PAGES AND COMPONENTS ARE BYTE-IDENTICAL, in the payload
      //     and in the store.
      for (const [path, was] of [["gear.tsx", GEAR], ["prices.tsx", PRICES]]) {
        assert.equal(st[path], was, path + " moved");
      }
      for (const [name, was] of [["chord-diagram", CHORD], ["trial-booking-form", TRIAL]]) {
        assert.equal(st[PART_DIR + name + ".tsx"], was, name + " moved");
        assert.equal(sentFiles(c)[PART_DIR + name + ".tsx"], was, name + " moved in the payload");
      }
    });
  } finally { c.uninstall(); }
}

test("the arithmetic-only tweak does not publish — through the route, on run 17's own sources", async () => {
  await doesNotPublish("contract-repro", HOME_TWEAKED);
});

test("THE REASSIGNMENT does not publish either — through the route, same sources", async () => {
  // The third reported spelling: neither the call site nor the declaration
  // moves, only a statement between them. One rule answers all three.
  await doesNotPublish("contract-repro-reassign", HOME_REASSIGN);
});

test("THE UPSTREAM CALCULATION does not publish either — through the route, same sources", async () => {
  // THE SAME REQUEST AND THE SAME ROUTE; only the cheap rung's answer differs.
  // It moves the six-minus into a page-local binding and leaves the prop
  // byte-identical, which is the spelling a check on call-site text cannot see.
  await doesNotPublish("contract-repro-upstream", HOME_UPSTREAM);
});

test("THE OPERAND ORDER does not publish either — through the route, same sources", async () => {
  // THE FOURTH REPORTED SPELLING, and the one that killed the token multiset:
  // `Number(0 ?? bookingCount)` carries the identical BAG of tokens and always
  // answers zero. No exception for `??` was added — a real syntax tree reads
  // operand POSITION, so this is the same answer the other three get.
  await doesNotPublish("contract-repro-operand", HOME_OPERAND);
});

test("THE CONDITIONAL BRANCH SWAP does not publish either — through the route, same sources", async () => {
  // THE FIFTH REPORTED SPELLING, and the one that killed the opaque JSX leaf.
  // Every statement, declaration, hook and prop expression is byte-identical;
  // what moves is which ARM of a ternary renders the component, so the page
  // advertises availability exactly while the data is missing.
  //
  // ⚠ THE BEFORE-SOURCE IS THIS CASE'S OWN. The guard is what the tweak is
  // swapping, so the store has to hold the guarded page — handing this case the
  // ordinary before-source would compare the swap against a page with no
  // ternary at all, which is a different and much easier question.
  //
  // ⚠ AND THE SHARED NEGATIVES CANNOT SEE THIS ONE. `HOME_BRANCH_SWAPPED` still
  // carries `bookingCount={Number(bookingCount ?? 0)}` and none of the four
  // arithmetic spellings, so every check the other cases lean on passes on the
  // very page this one must refuse. The ternary is named here instead.
  await doesNotPublish(
    "contract-repro-branch",
    HOME_BRANCH_SWAPPED,
    HOME_GUARDED,
    [["bookingCount === undefined ? (\n" + HOME_LOOKUP_EL, "the publish carried the branch-swapped guard"]],
  );
});

test("THE PROP-FREE COMPONENT SWAP does not publish either — through the route, same sources", async () => {
  // THE SIXTH REPORTED SPELLING, and the one that killed an expressions-only
  // bag. `<TrialBookingForm />` takes no props, so the fifth fix's multiset was
  // EMPTY on both arms and the swap was invisible to a mechanism that was
  // otherwise doing exactly what it was designed to do.
  //
  // Its before-source is the guarded page, for round five's reason: the tweak
  // swaps a ternary, so a store holding a page with no ternary asks an easier
  // question. And the shared negatives cannot see it — every arithmetic
  // spelling is absent from both sides — so the swapped arm is named here.
  await doesNotPublish(
    "contract-repro-propfree",
    HOME_PROPFREE_SWAPPED,
    HOME_PROPFREE,
    [["<p>Choose a day first</p> : <TrialBookingForm />", "the publish carried the swapped prop-free guard"]],
  );
});

test("TWO DIFFERENT PROP-FREE COMPONENTS EXCHANGED does not publish — the owner's control", async () => {
  // Both arms render one of the site's own components, NEITHER carries a prop,
  // and the two are exchanged. Nothing is added and nothing is removed, so a
  // reader keyed on which components appear answers "the same two" and one
  // keyed on which expressions appear answers "none, both times". Only
  // identity AT ITS POSITION separates them — and the writer this must reach
  // is the one shown BOTH component files.
  await doesNotPublish(
    "contract-repro-twoparts",
    CONTROL_PAIR.after,
    CONTROL_PAIR.before,
    [["<DaySpaceLookup /> : <TrialBookingForm />", "the publish carried the exchanged components"]],
  );
});

test("AN ORDINARY VISUAL TWEAK STILL TAKES THE CHEAP PATH — the positive control", async () => {
  // THE SAME PAGE, three components and six prop bindings, and a tweak that
  // touches none of them. Without this case the change would read as
  // "disable the cheap rung wherever a page has components", which is the
  // thing the fix must NOT be.
  const slug = "contract-control";
  const store = bucket(slug);
  const c = installCompiler();
  // ⚠ THE ANCHOR CARRIES THE HEADING'S OWN WORDS, because the CLASS is not
  // unique: this page wears `text-xl font-semibold text-foreground` on BOTH of
  // its `<h2>`s, so a class-only anchor is two edits wearing one name and
  // `once` refuses it. The text is what identifies the heading a customer
  // would point at.
  const bigger = once(
    HOME_BEFORE,
    "text-xl font-semibold text-foreground\">\n            The first eight chords",
    "text-3xl font-semibold text-foreground\">\n            The first eight chords",
    "the chords heading on the real page",
  );
  try {
    await withWire({
      [TWEAK_TOOL.name]: { source: bigger },
      // A STUB THE CHEAP PATH MUST NOT NEED. If the rewrite is reached at all
      // this answer publishes something recognisably different, so the
      // assertions below cannot pass by accident.
      [SITE_PAGES_TOOL.name]: {
        pages: [{ path: "src/routes/index.tsx", source: HOME_BEFORE + "\n// the rewrite ran\n" }],
        parts: [],
      },
    }, async (calls) => {
      const { body } = await edit(slug, "Make the \"The first eight chords\" heading a bit bigger.", { store });
      assert.equal(body && body.ok, true, "the visual tweak did not go through: " + JSON.stringify(body));
      assert.equal(body.tweak, true, "an ordinary visual tweak fell through to the rewrite: " + JSON.stringify(body));
      assert.equal(calls.filter((x) => x.tool === SITE_PAGES_TOOL.name).length, 0,
        "the expensive writer ran for a heading change");
      const sent = sentOne(c, /index\.tsx$/);
      assert.ok(sent.includes("text-3xl"), "the tweak's own change was not published");
      assert.ok(!sent.includes("the rewrite ran"), "the rewrite's answer was published instead");
      // And the components are untouched, which is true of a tweak by
      // construction — asserted so the control cannot go quiet.
      assert.equal(stored(store, slug)[PART_DIR + "day-space-lookup.tsx"], LOOKUP_BEFORE);
    });
  } finally { c.uninstall(); }
});
