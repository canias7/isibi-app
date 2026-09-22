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
// WHAT IS ASSERTED, AND WHY EACH HALF IS NEEDED:
//
//   1. THE REFUSAL IS BESIDE THE PASS. `sameProse` still answers true on the
//      real diff and `partContract` refuses it BY NAME. Both readings in one
//      case, because the finding is precisely that the promise was kept and
//      the change was still incomplete.
//   2. THROUGH THE ROUTE. The stubbed `write_tweak` returns the exact source
//      run 17 published — derived from the before-source by its own one-line
//      edit, with the anchor asserted to occur exactly once — and the route
//      must NOT publish it.
//   3. THE POSITIVE CONTROL, on the SAME page, which carries three components
//      and eleven prop bindings: an ordinary visual tweak still takes the
//      cheap path. Without this the fix would read as "disable tweaks wherever
//      a page has components", which is not the fix.
//   4. THE CORRECTED PAIR, VERIFIED TOGETHER — the compiler payload, the
//      stored source, and the wording a visitor really reads, rendered with
//      real React against SUPPLIED booking counts. No rows are created and no
//      booking-enforcement rule is touched: the counts are arguments.
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
import { TWEAK_TOOL, sameProse, partContract, readTweak, runTweak } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { localParts, partProps, PART_DIR } from "../builder/site-files.mjs";

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

function bucket(slug) {
  const store = new Map([
    [SRC_KEY(slug), JSON.stringify([
      { path: "index.tsx", source: HOME_BEFORE },
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

  const c = partContract(HOME_BEFORE, HOME_TWEAKED, { inPart: false });
  assert.equal(c.ok, false, "the arithmetic-only tweak still qualified as completion");
  assert.equal(c.part, "day-space-lookup", "the refusal names the wrong component: " + JSON.stringify(c));
  assert.equal(c.prop, "bookingCount", "the refusal names the wrong prop: " + JSON.stringify(c));
  assert.equal(c.was, "{Number(bookingCount ?? 0)}");
  assert.equal(c.now, "{6 - Number(bookingCount ?? 0)}");

  // AND `readTweak` IS WHERE IT LANDS, with its own reason rather than one of
  // the existing ones — "the cheap rung keeps rewording pages" and "the cheap
  // rung keeps finishing half a change" want opposite fixes.
  const reply = { content: [{ type: "tool_use", input: { source: HOME_TWEAKED } }] };
  const r = readTweak(reply, { source: HOME_BEFORE, inPart: false });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "part-contract", "the refusal wears another reason's name: " + JSON.stringify(r));
  assert.equal(r.part, "day-space-lookup");
  assert.equal(r.prop, "bookingCount");
});

test("the page/component relationship is read off the page's own imports", () => {
  // No store read: the three components come out of `index.tsx`'s specifiers,
  // which is what lets the cheap rung ask this question at all.
  assert.deepEqual(localParts(HOME_BEFORE, false).map((p) => p.name).sort(),
    ["chord-diagram", "day-space-lookup", "trial-booking-form"]);
  const props = partProps(HOME_BEFORE, false);
  assert.equal(props.get("day-space-lookup").readable, true);
  assert.deepEqual(props.get("day-space-lookup").props.map((p) => p.prop),
    ["preferredDay", "bookingCount", "onPreferredDay"]);
  // Every binding on this real page is an EXPRESSION, which is the measured
  // reach of the check here: 6 expression bindings, 0 literal.
  const all = [...props.values()].flatMap((v) => v.props);
  assert.equal(all.length, 6);
  assert.equal(all.filter((p) => p.literal).length, 0);
});

test("localParts is specNames run backwards — the two readers of one path convention", async () => {
  // DERIVED, NOT RESTATED. Every name `localParts` answers for a specifier,
  // `importsPart` must accept for that same specifier and the same `inPart`.
  const { importsPart } = await import("../builder/site-files.mjs");
  const cases = [
    ["@/routes/-parts/day-space-lookup", false],
    ["./-parts/chord-diagram", false],
    ["../routes/-parts/trial-booking-form.tsx", false],
    ["./sibling", true],
  ];
  for (const [spec, inPart] of cases) {
    const src = `import X from "${spec}";\nexport default function P(){return <X/>}`;
    const got = localParts(src, inPart);
    assert.equal(got.length, 1, "localParts did not name " + spec);
    assert.equal(importsPart(src, got[0].name, inPart), true,
      "the two readers disagree about " + spec + " -> " + got[0].name);
  }
  // And a PAGE's `./sibling` is another page, never a component.
  assert.deepEqual(localParts('import X from "./sibling";', false), []);
});

test("a literal prop is a choice and stays cheap; an expression is a computation and does not", () => {
  const page = (el) => "import { createFileRoute } from '@tanstack/react-router'\n"
    + "import Band from \"@/routes/-parts/band\"\n"
    + "export const Route = createFileRoute('/')({ component: H })\n"
    + `function H(){const n = 3; return <div>${el}</div>}\n`;
  // A literal swap, a literal added, a bare flag added: all choices the
  // component already distinguishes.
  for (const [a, b, what] of [
    ['<Band tone="light" />', '<Band tone="dark" />', "a string literal swapped"],
    ['<Band columns={4} />', '<Band columns={3} />', "a numeric literal swapped"],
    ['<Band />', '<Band compact />', "a bare flag added"],
    ['<Band tone="light" />', '<Band tone="light" columns={2} />', "a literal prop added"],
    ['<Band a="x" b="y" />', '<Band b="y" a="x" />', "the same props reordered"],
  ]) {
    assert.equal(partContract(page(a), page(b), { inPart: false }).ok, true,
      "a visual tweak was refused: " + what);
  }
  // An expression, either direction.
  for (const [a, b, what] of [
    ['<Band count={n} />', '<Band count={6 - n} />', "an expression rewritten"],
    ['<Band count={n} />', '<Band count={2} />', "an expression replaced by a literal"],
    ['<Band count={2} />', '<Band count={n} />', "a literal replaced by an expression"],
    ['<Band />', '<Band count={n} />', "an expression prop added"],
    ['<Band {...{}} />', '<Band />', "a spread dropped"],
  ]) {
    const r = partContract(page(a), page(b), { inPart: false });
    assert.equal(r.ok, false, "a contract change was accepted: " + what);
    assert.equal(r.part, "band");
  }
});

test("cannot-tell makes no claim, in either half", () => {
  // An import clause whose bindings cannot be read: no evidence about its
  // props either way, so the check stays silent rather than refusing every
  // page that has one.
  const ns = (v) => "import * as N from \"@/routes/-parts/band\"\n"
    + `export default function H(){const n=1; return <N.Band count={${v}} />}`;
  assert.equal(partProps(ns("n"), false).get("band").readable, false);
  assert.equal(partContract(ns("n"), ns("6 - n"), { inPart: false }).ok, true,
    "an unreadable clause was read as a contract that moved");
  // A page that imports none of its own components is untouched.
  assert.equal(partContract("export default function H(){return <p>hi</p>}", "export default function H(){return <p>hi</p>}", {}).ok, true);
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
  assert.equal(inside.reason, "part-contract");
  // The same answer from a PAGE, where `./spacer` is another page rather than
  // a component — so the refusal above really is `inPart` doing the work.
  const outside = await runTweak({ instruction: "x", path: "index.tsx", source: before, send: reply, inPart: false });
  assert.equal(outside.ok, true, "a page's `./spacer` was read as one of its own components");
  assert.ok(typeof send === "function");
});

test("the arithmetic-only tweak does not publish — through the route, on run 17's own sources", async () => {
  const slug = "contract-repro";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    await withWire({
      // The cheap rung answers exactly what run 17's did.
      [TWEAK_TOOL.name]: { source: HOME_TWEAKED },
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
      //     longer holds the misleading arithmetic.
      const sentHome = sentOne(c, /index\.tsx$/);
      const sentPart = sentOne(c, /day-space-lookup\.tsx$/);
      assert.ok(!sentHome.includes("6 - Number(bookingCount"),
        "the publish carried the arithmetic-only change");
      assert.ok(sentHome.includes("bookingCount={Number(bookingCount ?? 0)}"),
        "the count stopped being the booking count");
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
