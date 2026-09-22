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
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { renderPart } from "./fixtures/render-part.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { TWEAK_TOOL, sameProse, partEligible, computeShape, tweakParser, readTweak, runTweak } from "../builder/site-tweak.mjs";

// ⚠ THE PARSER IS LOADED ONCE AND PROVED ALIVE, because every eligibility case
// below is VACUOUS without it: with no parser `partEligible` refuses a
// component-bearing page unconditionally, so the four bypass cases would pass
// for the wrong reason and the four controls would fail loudly enough to be
// noticed — which is the safe half. This file asserts the half that is not
// self-announcing: that a real syntax tree is what the refusals are read off.
const PARSE = await tweakParser();
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { localParts, PART_DIR } from "../builder/site-files.mjs";

const USER = { id: "u-contract-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const SRC_KEY = (slug) => "source/" + String(slug).toLowerCase() + "/pages.json";
const PARTS_KEY = (slug) => "source/" + String(slug).toLowerCase() + "/parts.json";
const F = (name) => readFileSync(new URL("./fixtures/run17/" + name, import.meta.url), "utf8");
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
        content: [{ type: "tool_use", name: tool, input: typeof a === "function" ? a(nth) : a }],
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

// ───────────────────────────────────────────────────────────────────────────
test("the instruction under test is run 17's, byte for byte", () => {
  // 159 characters, one non-ASCII codepoint (U+2014), sha256 prefix pinned
  // against `request.json` in the run's own evidence bundle.
  assert.equal(ASK.length, 159);
  assert.equal(sha(ASK), "622547386217ef0c", "the instruction has drifted from the one run 17 submitted");
  assert.deepEqual([...ASK].filter((c) => c.codePointAt(0) > 127), ["—"]);
});

test("the fixture is run 17's before-source and the tweak's answer is its real published one", () => {
  assert.equal(HOME_BEFORE.length, 26276, "index.before.tsx is not the 26,276-byte stored page");
  assert.equal(sha(HOME_BEFORE), "129b54600bd30720");
  assert.equal(LOOKUP_BEFORE.length, 1466, "day-space-lookup.before.tsx is not the 1,466-byte stored component");
  assert.equal(sha(LOOKUP_BEFORE), "5330fca7b88e5ac1");
  // The derived answer, against what the run really published.
  assert.equal(HOME_TWEAKED.length, 26280);
  assert.equal(sha(HOME_TWEAKED), "fbbb0de00096c3b2", "the derived tweak answer is not the source run 17 published");
});

test("the promise was KEPT and the change was still incomplete — both readings, on the real diff", () => {
  // THIS IS THE FINDING. `sameProse` is a page-scoped guarantee and the page is
  // no longer the whole of what a visitor reads, so a perfect pass is exactly
  // what the failure looks like.
  assert.equal(sameProse(HOME_BEFORE, HOME_TWEAKED), true,
    "the real diff moved the page's words, so this is not run 17's shape");

  const c = partEligible(HOME_BEFORE, HOME_TWEAKED, { inPart: false, parse: PARSE });
  assert.equal(c.ok, false, "the arithmetic-only tweak still qualified as completion");
  assert.ok(c.parts.includes("day-space-lookup"),
    "the refusal does not name the component whose file this rung cannot open: " + JSON.stringify(c));

  // AND `readTweak` IS WHERE IT LANDS, with its own reason rather than one of
  // the existing ones — "the cheap rung keeps rewording pages" and "the cheap
  // rung keeps finishing half a change" want opposite fixes.
  const reply = { content: [{ type: "tool_use", input: { source: HOME_TWEAKED } }] };
  const r = readTweak(reply, { source: HOME_BEFORE, inPart: false });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "needs-parts", "the refusal wears another reason's name: " + JSON.stringify(r));
  assert.ok(r.parts.includes("day-space-lookup"),
    "the refusal does not name the component this rung cannot open: " + JSON.stringify(r.parts));
});

test("the page/component relationship is read off the page's own imports", () => {
  // No store read: the three components come out of `index.tsx`'s specifiers,
  // which is what lets the cheap rung ask this question at all.
  assert.deepEqual(localParts(HOME_BEFORE, false).map((p) => p.name).sort(),
    ["chord-diagram", "day-space-lookup", "trial-booking-form"]);
});

test("localParts is specNames run backwards — the two readers of one path convention", async () => {
  // DERIVED, NOT RESTATED. Every name `localParts` answers for a specifier,
  // `importsPart` must accept for that same specifier and the same `inPart`.
  const { importsPart } = await import("../builder/site-files.mjs");
  const specs = [
    ["@/routes/-parts/band", false],
    ["./-parts/band", false],
    ["@/routes/-parts/band.tsx", false],
    ["./band", true],
    ["../-parts/band", true],
  ];
  for (const [spec, inPart] of specs) {
    const src = `import X from "${spec}"\n`;
    const got = localParts(src, inPart);
    assert.equal(got.length, 1, "no name for " + spec + " (inPart " + inPart + ")");
    assert.equal(importsPart(src, got[0].name, inPart), true,
      "the two readers disagree about " + spec + " -> " + got[0].name);
  }
  // And a PAGE's `./sibling` is another page, never a component.
  assert.deepEqual(localParts('import X from "./sibling";', false), []);
});

test("WHAT THE PAGE RENDERS may move; WHAT IT COMPUTES may not — the whole rule", () => {
  // ⚠ THIS CASE REPLACES A SCANNER. Two earlier shapes of this check read the
  // diff — the prop's text, then the prop's text plus the declarations it
  // reads — and each was beaten by writing the same change somewhere else. The
  // property below knows nothing about declarations, assignments or any other
  // construct, which is exactly why there is no next syntax to lose to.
  const page = (decl, el) => "import { createFileRoute } from '@tanstack/react-router'\n"
    + "import Band from \"@/routes/-parts/band\"\n"
    + "export const Route = createFileRoute('/')({ component: H })\n"
    + `function H(){${decl} return <div>${el}</div>}\n`;
  const D = "const n = rows.length;";

  // PRESENTATION MOVES FREELY. A class, an element's order, a wrapper: all
  // settled inside the one file this rung holds.
  for (const [a, b, what] of [
    ['<Band className="p-2" />', '<Band className="p-8" />', "a class swapped"],
    ['<Band tone="light" />', '<Band tone="dark" />', "a literal prop swapped"],
    ['<p>a</p><Band />', '<Band /><p>a</p>', "two elements reordered"],
  ]) {
    assert.equal(partEligible(page(D, a), page(D, b), { inPart: false, parse: PARSE }).ok, true,
      "a visual tweak was refused: " + what);
  }

  // ⚠ THE STATED COST MOVED WITH THE PARSER, AND THAT IS AN IMPROVEMENT
  // RECORDED RATHER THAN A SILENT ONE. Under the token multiset this check
  // replaces, ADDING markup escalated: a bag of tokens cannot tell a JSX tag
  // from an identifier, so a new `<section>` read as new computation. A real
  // syntax tree can, so wrapping and adding plain markup are now cheap. The
  // assertion is kept pointing the other way so the day somebody narrows the
  // instrument, this line says what changed.
  for (const [a, b, what] of [
    ["<Band />", "<section><Band /></section>", "wrapping in a section"],
    ["<Band />", "<p>Pick a day.</p><Band />", "adding plain markup"],
  ]) {
    assert.equal(partEligible(page(D, a), page(D, b), { inPart: false, parse: PARSE }).ok, true,
      "markup-only change escalated: " + what);
  }

  // COMPUTATION DOES NOT — wherever in the file it is written.
  for (const [ad, ae, bd, be, what] of [
    [D, "<Band count={n} />", D, "<Band count={6 - n} />", "at the call site"],
    [D, "<Band count={n} />", "const n = 6 - rows.length;", "<Band count={n} />", "in the declaration"],
    [D, "<Band count={n} />", "let n = rows.length; n = 6 - n;", "<Band count={n} />", "in a later assignment"],
    [D, "<Band />", D, "<Band count={n} />", "as a new computed prop"],
  ]) {
    const r = partEligible(page(ad, ae), page(bd, be), { inPart: false, parse: PARSE });
    assert.equal(r.ok, false, "a computation change was accepted: " + what);
    assert.deepEqual(r.parts, ["band"], "the refusal did not name the component it cannot open");
  }

  // ⚠ AND ORDER IS THE HALF A BAG OF TOKENS CANNOT HOLD — the fourth reported
  // bypass and the reason the token multiset is gone. Each pair below carries
  // an IDENTICAL multiset and means something different, which is asserted
  // here rather than argued: a check that passed these would be reading the
  // same bag twice. None of them has a rule of its own — a syntax tree reads
  // operand POSITION, so all four are one answer.
  //
  // ⚠ THE SECOND-OPERAND CASES ARE ALSO THIS CHECK'S OWN REGRESSION GUARD.
  // The prototype walked children with `forEachChild((c) => kids.push(...))`,
  // and `forEachChild` STOPS on a truthy return while `push` answers the new
  // length — so the walk halted after every node's FIRST child and all four
  // bypasses read as eligible against a comparison that had simply not looked.
  // A difference that lives in the second operand is what fails loudly there.
  const bag = (t) => (t.match(/[A-Za-z_$][\w$]*|\d+|[^\s\w$]/g) ?? []).sort().join("\u0000");
  for (const [a, b, what] of [
    ["{Number(n ?? 0)}", "{Number(0 ?? n)}", "?? operands swapped — the reported case"],
    ["{pick(a, b)}", "{pick(b, a)}", "two arguments swapped"],
    ["{ok ? a : b}", "{ok ? b : a}", "a ternary's branches flipped"],
    ["{n - 6}", "{6 - n}", "a subtraction reversed"],
  ]) {
    const A = page(D, "<Band count=" + a + " />"), B = page(D, "<Band count=" + b + " />");
    assert.equal(bag(A), bag(B), "the fixture is not an order-only change: " + what);
    assert.equal(partEligible(A, B, { inPart: false, parse: PARSE }).ok, false,
      "an order-only computation change was accepted: " + what);
  }

  // AND THE SAME VALUE MOVED BETWEEN TWO COMPONENTS IS A CHANGE, which is why
  // a subtree's bag is keyed by tag and attribute rather than pooled: the bag
  // of expressions is equal and each component now receives the other's.
  const two = (x, y) => page(D, `<Band count={${x}} /><Band total={${y}} />`);
  assert.equal(partEligible(two("n", "6"), two("6", "n"), { inPart: false, parse: PARSE }).ok, false,
    "two components swapping the values they receive was accepted");

  // ⚠ AND THAT PAIR PROVES THE ATTRIBUTE HALF ALONE — a red check said so, not
  // the design. `count` and `total` are already two keys, so dropping the TAG
  // from the key changes nothing about it. The tag is load-bearing exactly when
  // two DIFFERENT components are fed the SAME attribute name, which is the only
  // shape that separates the two readings and is therefore the one asserted.
  const named = (x, y) => page(D, `<Band count={${x}} /><Other count={${y}} />`);
  assert.equal(partEligible(named("n", "6"), named("6", "n"), { inPart: false, parse: PARSE }).ok, false,
    "two components swapping one attribute's values was accepted");
  assert.equal(partEligible(named("n", "6"), named("n", "6"), { inPart: false, parse: PARSE }).ok, true,
    "the tag case's own control refused an untouched page");

  // ⚠ AND A STRING THAT IS NOT AN ATTRIBUTE VALUE IS COMPUTATION — the red
  // check found this, not the design: reading the file fully masked dropped
  // every string's contents, so changing WHICH database function a page calls
  // moved no token at all. `sameProse` does not cover it either, because an
  // identifier-shaped string is correctly not words a visitor reads.
  const rpc = (fn) => "import Band from \"@/routes/-parts/band\"\n"
    + `function H(){const n = useRpc("${fn}"); return <div><Band count={n} /></div>}\n`;
  assert.equal(partEligible(rpc("bookings_on_day"), rpc("bookings_two"), { inPart: false, parse: PARSE }).ok, false,
    "a page calling a different database function was accepted");
  // …while the attribute whose value is quoted is still dropped whole, which
  // is what keeps the visual tweak above cheap. Both halves, one instrument.
  const shape = (t) => computeShape(t, PARSE).shape;
  assert.equal(shape('<h1 className="a">x</h1>'), shape('<h1 className="bbbb">x</h1>'));

  // AND INSIDE MARKUP IT IS A MULTISET, so reordering elements is a change to
  // none of it — `sameProse`'s own rule, one step over — while OUTSIDE markup
  // it is ORDERED, which is what the multiset could not be and why it fell.
  assert.equal(shape(page(D, "<p>a</p><Band />")), shape(page(D, "<Band /><p>a</p>")));
  assert.notEqual(shape(page(D, "<Band count={n} />")), shape(page(D, "<Band count={6 - n} />")));

  // ⚠ AND THAT REORDER PAIR CARRIES NO BRACED PROP AT ALL, so the SORT it is
  // meant to prove is invisible to it — a red check found that, not the design,
  // and it is this repository's own fixture-too-shallow trap. Re-ordering two
  // elements that each DO carry one is the shape the two readings differ on,
  // and it must stay cheap: a layout tweak is exactly this.
  assert.equal(shape(page(D, "<Band count={n} /><Other total={6} />")),
    shape(page(D, "<Other total={6} /><Band count={n} />")),
    "re-ordering two elements that carry braced props stopped being a cheap tweak");

  // ⚠ AND THE TWO REGISTERS MEET AT EVERY JSX SITE, which is the fifth bypass's
  // own property and the reason there is ONE signature rather than two. A
  // subtree's bag rides IN PLACE, so swapping the arms of a ternary moves the
  // ordered string even though both arms, and every expression in them, are
  // still on the page.
  const arms = (a, b) => page(D, `{n === undefined ? ${a} : ${b}}`);
  assert.notEqual(shape(arms("<p>Checking</p>", "<Band count={n} />")),
    shape(arms("<Band count={n} />", "<p>Checking</p>")),
    "a JSX subtree is still an opaque leaf, so branch position is invisible");
  // …and the same two arms, unswapped, are equal — without this the assertion
  // above is satisfied by a reader that calls every pair of pages different.
  assert.equal(shape(arms("<p>Checking</p>", "<Band count={n} />")),
    shape(arms("<p>Checking</p>", "<Band count={n} />")));
});

test("a page that renders none of the site's own components is not asked at all", () => {
  // THE SCOPE, AND IT IS MOST OF THE PLATFORM. Without this the change would
  // read as "every tweak now compares code tokens", which would refuse
  // legitimate logic tweaks on every page there is.
  const plain = (n) => "export const Route = createFileRoute('/')({ component: H })\n"
    + `function H(){const n = ${n}; return <p>{n}</p>}\n`;
  assert.deepEqual(localParts(plain(1), false), [], "the fixture renders a local component after all");
  assert.equal(partEligible(plain(1), plain("6 - rows.length"), { inPart: false, parse: PARSE }).ok, true,
    "a page with no local components was refused for changing its own logic");
  // And the two readings really do differ — without this the case above passes
  // for the wrong reason.
  const sh = (t) => computeShape(t, PARSE).shape;
  assert.notEqual(sh(plain(1)), sh(plain("6 - rows.length")));
});

test("NO PARSER IS CANNOT-TELL, and it fails closed on a component page alone", () => {
  // ⚠ THE PARSER IS THE CANNOT-TELL, and the two runtimes really differ.
  // `typescript` is a devDependency: the CONTAINER resolves it from the
  // template's own node_modules, and the Worker is bundled from `npm ci
  // --omit=dev`, so `tweakParser()` answers `null` there. That is not a
  // hypothetical — it is the ordinary state of one of the two places this
  // module runs, which is why it is driven rather than reasoned about.
  const page = (v) => "import Band from \"@/routes/-parts/band\"\n"
    + `export default function H(){const n=${v}; return <Band count={n} />}`;
  const plain = (v) => `export default function H(){const n=${v}; return <p>{n}</p>}`;

  // On a page that renders one of the site's own components: NOT eligible, and
  // the refusal NAMES why rather than wearing another reason's name.
  const shut = partEligible(page("1"), page("1"), { inPart: false, parse: null });
  assert.equal(shut.ok, false, "with no parser a component-bearing page stayed eligible");
  assert.equal(shut.why, "no-parser", "the refusal did not name the missing parser");
  assert.deepEqual(shut.parts, ["band"]);
  // ⚠ AND THE INPUTS ARE IDENTICAL, which is the whole point: it refuses
  // because it CANNOT LOOK, never because it looked and saw a difference.

  // On a page with no local components the question is never asked, so a
  // runtime with no parser behaves byte for byte as it always did.
  assert.equal(partEligible(plain("1"), plain("6 - rows.length"), { inPart: false, parse: null }).ok, true,
    "a page with no local components was refused for want of a parser");

  // AND A SOURCE THE PARSER CHOKES ON IS ITS OWN REASON, not the missing-parser
  // one — two facts, two names, because only one of them is about the runtime.
  const boom = partEligible(page("1"), page("1"), {
    inPart: false,
    parse: () => { throw new Error("no"); },
  });
  assert.equal(boom.ok, false);
  assert.equal(boom.why, "unparsed", "an unparsable source reported the runtime as the cause");
});

test("`parse` really travels from runTweak into readTweak", async () => {
  // THE SECOND WIRING HOP, DRIVEN — `runTweak` loads the parser and hands it
  // down, and a cut there leaves `partEligible` looking at `undefined` on
  // every real call while every module case goes on passing. This repository's
  // most repeated defect, in the hop this round added.
  const before = "import Band from \"@/routes/-parts/band\"\n"
    + "export default function H(){const n=rows.length; return <Band count={n} />}";
  // THE ORDER-ONLY SHAPE, deliberately: a reply that differs only in operand
  // position is invisible to anything but a real tree, so this case cannot
  // pass by accident on a comparison that never ran.
  const after = before.replace("count={n}", "count={0 ?? n}");
  const reply = async () => ({ content: [{ type: "tool_use", input: { source: after } }], usage: {} });
  const r = await runTweak({ instruction: "x", path: "index.tsx", source: before, send: reply, inPart: false });
  assert.equal(r.ok, false, "parse never reached readTweak: an order-only change was accepted");
  assert.equal(r.reason, "needs-parts");
  assert.deepEqual(r.parts, ["band"]);
  // AND THE CONTROL: the same route, a change to the markup alone, still cheap.
  const visual = before.replace("<Band count={n} />", "<section><Band count={n} /></section>");
  const ok = await runTweak({
    instruction: "x", path: "index.tsx", source: before, inPart: false,
    send: async () => ({ content: [{ type: "tool_use", input: { source: visual } }], usage: {} }),
  });
  assert.equal(ok.ok, true, "an ordinary visual tweak was refused through the same hop: " + ok.reason);
});

test("cannot-tell fails CLOSED here, which is the opposite of the old check", () => {
  // ⚠ A DELIBERATE INVERSION, NAMED. The scanner it replaces made no claim
  // when it could not read a component's props — correct there, because a
  // reading it could not take was not evidence. This asks a different
  // question: the rung cannot open the file, and an import clause it cannot
  // parse does not make the file openable. `localParts` reads the SPECIFIER,
  // so a namespace import still counts as rendering the site's own component.
  const ns = (v) => "import * as N from \"@/routes/-parts/band\"\n"
    + `export default function H(){const n=${v}; return <N.Band count={n} />}`;
  assert.deepEqual(localParts(ns("1"), false).map((p) => p.name), ["band"]);
  assert.equal(partEligible(ns("1"), ns("6 - 1"), { inPart: false, parse: PARSE }).ok, false,
    "an unreadable clause let a computation change through");
});

test("`inPart` really travels from runTweak into readTweak", async () => {
  // THE WIRING HOP, DRIVEN. A value computed and never forwarded is this
  // repository's most repeated defect, and from outside a dropped `inPart` and
  // a page with no sibling components are the same answer.
  const before = "import S from \"./spacer\"\nexport default function P(){const n=1; return <S count={n} />}";
  const after = "import S from \"./spacer\"\nexport default function P(){const n=1; return <S count={6 - n} />}";
  const send = async () => ({ content: [{ type: "tool_use", input: { source: after } }] }, { usage: {} });
  const reply = async () => ({ content: [{ type: "tool_use", input: { source: after } }], usage: { input_tokens: 1, output_tokens: 1 } });
  const inside = await runTweak({ instruction: "x", path: PART_DIR + "card.tsx", source: before, send: reply, inPart: true });
  assert.equal(inside.ok, false, "inPart never reached readTweak: a sibling contract change was accepted");
  assert.equal(inside.reason, "needs-parts");
  // The same answer from a PAGE, where `./spacer` is another page rather than
  // a component — so the refusal above really is `inPart` doing the work.
  const outside = await runTweak({ instruction: "x", path: "index.tsx", source: before, send: reply, inPart: false });
  assert.equal(outside.ok, true, "a page's `./spacer` was read as one of its own components");
  assert.ok(typeof send === "function");
});

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
  const store = bucket(slug, home);
  const c = installCompiler();
  try {
    await withWire({
      // The cheap rung answers what the reported run's did.
      [TWEAK_TOOL.name]: { source: tweakSource },
      // And the writer that CAN read components answers the corrected pair.
      [SITE_PAGES_TOOL.name]: {
        pages: [{ path: "src/routes/index.tsx", source: HOME_FIXED }],
        parts: [{ name: "day-space-lookup", source: LOOKUP_AFTER }],
      },
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
      assert.equal(st["index.tsx"], HOME_FIXED, "the store kept a different page");
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
    [["bookingCount === undefined ?", "the publish carried the branch-swapped guard"]],
  );
});

test("A SWAP BETWEEN TWO ARMS OF ONE COMPONENT IS CAUGHT TOO — the harder half", async () => {
  // THE OWNER'S OWN CONTROL. Both arms render the SAME component, so a reader
  // keyed on WHICH components appear answers "the same one twice"; both values
  // appear on both sides, so a reader keyed on WHICH expressions appear answers
  // "the same two". Only a reader that keeps each expression AT ITS POSITION
  // separates them — which is what a real tree, with each site's bag inlined in
  // source order, does.
  assert.ok(PARSE, "no parser: this case cannot establish anything");

  // The two sides really do carry the same components and the same values,
  // asserted rather than intended — a fixture that differed some other way
  // would be a case about something else.
  const names = (t) => (t.match(/<DaySpaceLookup\b/g) ?? []).length;
  assert.equal(names(SAME_COMPONENT_BEFORE), 2, "the control does not render the component twice");
  assert.equal(names(SAME_COMPONENT_AFTER), 2, "the control does not render the component twice");
  for (const v of ["bookingCount={0}", "bookingCount={Number(count)}"]) {
    assert.ok(SAME_COMPONENT_BEFORE.includes(v) && SAME_COMPONENT_AFTER.includes(v),
      "both values must appear on both sides, or the case is not about position");
  }
  assert.notEqual(SAME_COMPONENT_BEFORE, SAME_COMPONENT_AFTER, "the control swapped nothing");

  const r = partEligible(SAME_COMPONENT_BEFORE, SAME_COMPONENT_AFTER, { parse: PARSE });
  assert.equal(r.ok, false, "a value swapped between two arms of one component read as eligible");
  assert.equal(r.why, "compute", "the refusal did not name the computation");
  assert.deepEqual(r.parts, ["day-space-lookup"], "the refusal did not name the component");
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

test("THE CORRECTED PAIR, RENDERED: places left, and never a free day we could not read", () => {
  // SUPPLIED COUNTS, NOT CREATED BOOKINGS. `bookingCount` is an argument here,
  // exactly as the live RPC's answer is an argument on the page — so nothing is
  // written to any site and no booking-enforcement rule is involved.
  // AND THIS IS A CLAIM ABOUT WHAT SHIPS, not about a fixture standing beside
  // it: the route case above asserts the compiled payload AND the stored
  // component are `LOOKUP_AFTER` by equality, and this case renders that same
  // constant — so the wording read here is the wording the publish carried.
  // The tie is named rather than left for a reader to infer, because the two
  // halves are three hundred lines apart.
  const DAY = "2026-11-14";
  const at = (n, extra) => said(LOOKUP_AFTER, { preferredDay: DAY, bookingCount: n, ...extra });

  // THE OWNER'S OWN TABLE.
  assert.equal(at(0), "6 places left on this day.");
  assert.equal(at(2), "4 places left on this day.");
  assert.equal(at(6), "No places left on this day.");
  // 6 OR MORE, so the over-booked day is the same answer rather than a
  // negative one — run 17's arithmetic rendered `-1 bookings` at seven.
  assert.equal(at(7), "No places left on this day.");
  assert.equal(at(99), "No places left on this day.");
  // The in-between rungs, and the singular.
  assert.equal(at(1), "5 places left on this day.");
  assert.equal(at(5), "1 place left on this day.");

  // ⚠ LOADING AND FAILED MUST NOT ADVERTISE PLACES. `bookingCount` arrives as 0
  // while the request is in flight and again when it fails, and zero bookings
  // is the fullest-sounding answer this box has — so an outage would otherwise
  // read as six places going spare.
  for (const [what, extra] of [["loading", { loading: true }], ["failed", { failed: true }]]) {
    const t = renderPart(LOOKUP_AFTER, { preferredDay: DAY, bookingCount: 0, onPreferredDay() {}, ...extra }).text;
    assert.ok(!/\d+\s+places?\s+left/.test(t), what + " advertised places: " + JSON.stringify(t));
    assert.ok(!/still has space/.test(t), what + " advertised space: " + JSON.stringify(t));
  }
  // Loading says so; failed says so. Two sentences, because they are two facts.
  assert.match(said(LOOKUP_AFTER, { preferredDay: DAY, bookingCount: 0, loading: true }), /Checking/);
  assert.match(said(LOOKUP_AFTER, { preferredDay: DAY, bookingCount: 0, failed: true }), /try again/);
  // No day chosen is unchanged from the version the site has always served.
  assert.equal(said(LOOKUP_AFTER, { preferredDay: "", bookingCount: 0 }), "Choose a day to check space.");

  // THE WORD IS GONE FROM THE BOX. A rewrite that computed places left and
  // went on calling them bookings is the defect, so its absence is asserted
  // rather than assumed.
  assert.ok(!/booking/i.test(renderPart(LOOKUP_AFTER, { preferredDay: DAY, bookingCount: 2, onPreferredDay() {} }).text),
    "the corrected component still says 'booking'");
});

test("the render reader is alive: the SHIPPED pair is the defect it reports", () => {
  // THE OBSERVER'S OWN PROOF. Every assertion above is about wording, so a
  // reader that renders nothing would pass them all by answering the same
  // string everywhere. Driven against the component run 17 left in place, fed
  // the number the tweaked page really passed it: `6 - bookings`.
  const DAY = "2026-11-14";
  const asShipped = (real) => said(LOOKUP_BEFORE, { preferredDay: DAY, bookingCount: 6 - real });

  // An EMPTY day read as six bookings — the live reading, in a real browser,
  // on 2026-09-22.
  assert.equal(asShipped(0), "6 bookings already on this day.");
  // And a FULL day advertised space, which is the one that mattered.
  assert.equal(asShipped(6), "No bookings on this day yet — it still has space.");
  // The two differ from the corrected pair's answers, so the render really is
  // reading each component rather than one of them twice.
  assert.notEqual(asShipped(0), said(LOOKUP_AFTER, { preferredDay: DAY, bookingCount: 0 }));
});
