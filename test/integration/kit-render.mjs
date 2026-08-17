// RENDER every component in the kit, four ways, and read what came out.
//
// WHY THIS EXISTS. `kit-typecheck.mjs` next door proves the kit COMPILES, and
// this repo has proven more times than it has fingers that compiling is not
// working: 158 chart components typechecked perfectly and crashed on an empty
// array; 70 charts typechecked and rendered grey; `message-scroller`
// typechecked, bundled, and hard-crashed the page. Every one of those was found
// by a person looking at a render, months later, and only after a customer's
// site had it.
//
// WHY SSR AND NOT A BROWSER. Production PRERENDERS every route through
// `src/server.ts` on every request, so `renderToString` IS the path a
// real customer's site takes — a component that throws here fails a real build.
// It is also ~100x faster than driving 2,000 components through Chromium, which
// is what makes running all of them on every change affordable.
//
// THE FOUR PASSES, and each is a state a real site is really in:
//   full  — realistic props. The ordinary page.
//   empty — every array `[]`, every optional omitted. The FIRST render of every
//           list, and the permanent state of a site whose owner has added
//           nothing yet. This is the pass that would have caught the 158.
//   zeros — every number 0. A limit nobody set, a threshold on a plan with no
//           cap, a max of 0. `Math.min(100, NaN)` is NaN, so the guards that
//           look like they clamp a division do not.
//   blank — every array prop `[]` INCLUDING the optional and defaulted ones,
//           with the other optionals filled in. `empty` omits an optional, so a
//           prop with a default is never seen empty at all — and that is a real
//           call: `bands` on `deposit-percent` defaults to six values and the
//           obvious page passes `bands={rows.map((r) => r.pct)}`, which is `[]`
//           until the query settles. That component rendered "Below the
//           smallest band most lenders price to (Infinity%)" and no pass here
//           could reach it.
//
// $0: no model call, no container, no Neon project.
import { CANNOT_RENDER, MODES, OUT, chartEntries, chartFiles, entries, files, renderAll, synthFailures } from "./kit-harness.mjs";
import fs from "node:fs";

let failed = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m, d) => { failed++; console.log("  FAIL " + m + (d ? "\n" + d : "")); };

console.log(`kit render — ${entries.length} components across ${files.length} modules`);

// THE CHECK MUST BE ABLE TO FAIL. A broken extractor yields an empty catalogue
// and every assertion below passes over nothing, reporting a clean kit — which
// is the most reassuring possible way to say that nothing was checked.
if (entries.length > files.length * 0.8) ok(`the catalogue covers ${entries.length} of ${files.length} modules`);
else bad(`the catalogue collapsed to ${entries.length} components — the extractor is broken, not the kit`);

const renderedClean = new Map(Object.keys(CANNOT_RENDER).map((k) => [k, new Set()]));

try {
  for (const mode of MODES) {
    const results = renderAll(mode);

    if (synthFailures.length) bad(`${mode}: ${synthFailures.length} could not be given props — the harness, not the kit`,
      synthFailures.slice(0, 6).map((m) => "    " + m).join("\n"));

    const threw = results.filter((r) => r.error && !CANNOT_RENDER[r.k]);
    if (threw.length === 0) ok(`${mode}: nothing threw (${results.length} components)`);
    else bad(`${mode}: ${threw.length} threw`,
      threw.slice(0, 12).map((r) => `    ${r.k} -> ${r.error}`).join("\n"));

    // An allow-listed component that has started WORKING should leave the list,
    // or the list grows into the thing it was written not to be. Judged over
    // ALL THREE passes rather than each: `empty` sends only the required props,
    // so a component the harness cannot drive with a full set legitimately
    // renders clean there, and reporting that per-mode cries wolf on an entry
    // that is doing its job. Rendering fine in every mode is the honest test.
    for (const k of Object.keys(CANNOT_RENDER)) {
      if (results.some((r) => r.k === k && !r.error)) renderedClean.get(k).add(mode);
    }

    const html = results.filter((r) => r.html).map((r) => r);

    // EVERY PASS, not just `zeros`. `Math.min`/`Math.max` pass NaN straight
    // through, so a site dividing by a limit nobody set writes `width: NaN%`
    // and the browser drops the declaration — the bar renders empty rather than
    // broken. But `zeros` is not where Infinity comes from: `Math.max(...xs)`
    // on an EMPTY array is -Infinity, which is the `empty` pass, and gating the
    // scan on one mode meant the check could not see the state it was named
    // after. It cost nothing to run everywhere and was found by asking why it
    // was gated at all.
    const nan = html.filter((r) => /NaN|-?Infinity/.test(r.html));
    if (nan.length === 0) ok(`${mode}: no NaN or Infinity reaches the page`);
    else bad(`${mode}: ${nan.length} render NaN or Infinity`, nan.slice(0, 10).map((r) => "    " + r.k).join("\n"));

    // WHAT REACT ITSELF SAID, which was being thrown away. A list rendered with
    // no `key` gets index identity, so React reuses the wrong DOM node and the
    // wrong state the moment the list reorders or filters — a checkbox stays
    // ticked beside a different row, a half-typed input jumps. Nothing else in
    // this repo looks for it.
    //
    // KEYS ONLY, and that is MEASURED rather than assumed. An earlier version
    // of this also claimed invalid DOM nesting; driving `<div>` inside a `<p>`
    // and `<button>` inside a `<button>` through `renderToString` on React
    // 19.2.8 produced NOTHING — server rendering does not run
    // `validateDOMNesting` at all. The nesting rules are checked statically in
    // test/page-gen.test.mjs instead. A check whose name covers more than it
    // can see reads as protection that is not there.
    // EVERYTHING IT SAYS, not just the keys. This was narrowed to the key
    // warning while the kit still had six "Invalid attribute name" reports in
    // it — so the check was scoped to what it happened to be clean on. With the
    // synthesiser fixed React is silent across all 2,071 components in every
    // pass, which makes the broad form free, and it covers the whole family for
    // nothing: an uncontrolled input becoming controlled, an unknown DOM
    // attribute, a bad prop type. The two allow-listed components warn about
    // their missing router, so they are excluded here as well.
    const complained = results.filter((r) => !CANNOT_RENDER[r.k] && (r.said || []).length);
    if (complained.length === 0) ok(`${mode}: React reported nothing about any component`);
    else bad(`${mode}: React complained about ${complained.length}`,
      complained.slice(0, 12).map((r) => `    ${r.k} -> ${(r.said[0] || "").replace(/\s+/g, " ").slice(0, 220)}`).join("\n"));

    if (mode === "full") {
      // `String(node)` on a prop typed `React.ReactNode` is "[object Object]",
      // and these are accessible names — the only name an icon button has.
      //
      // A GREEN RUN HERE IS NOT "THE KIT HAS NONE", and it took three escapes to
      // learn that. The props above are not SELF-CONSISTENT — an edge's `from`
      // names no node's `id` — so `String(at.get(e.from)?.label)` falls to its
      // `?? e.from` branch and the bug never renders; and `compare-table`'s made
      // the page show FEWER rows rather than a wrong string, so there was
      // nothing bad in the output to find at all. The source scan in
      // test/page-gen.test.mjs is the one that reads every site whether it
      // renders or not. Two checks, two blind spots, neither is the other's.
      const obj = html.filter((r) => r.html.includes("[object Object]"));
      if (obj.length === 0) ok("full: nothing stringifies a ReactNode into the page");
      else bad(`full: ${obj.length} render [object Object]`, obj.slice(0, 10).map((r) => "    " + r.k).join("\n"));

      const blank = html.filter((r) => r.html.length === 0);
      console.log(`  note ${blank.length} render nothing with props — conditional by design (a banner that is not showing)`);

      // A PROGRESS BAR THAT WILL NOT SAY HOW FAR. `role="progressbar"` with no
      // `aria-valuenow` announces "busy" and nothing else — which is what every
      // bar in the kit did, because `progress.tsx` destructured `value` out and
      // used it only in a CSS transform, so Radix was never told the number.
      // Read off the rendered output rather than the source: the whole failure
      // was that the value existed and did not travel.
      const bars = html.filter((r) => /role="progressbar"/.test(r.html));
      const mute = bars.filter((r) => !/aria-valuenow=/.test(r.html));
      if (bars.length === 0) bad("full: no component rendered a progressbar — this check is asserting nothing");
      else if (mute.length === 0) ok(`full: all ${bars.length} progress bars report a value`);
      else bad(`full: ${mute.length} of ${bars.length} progress bars announce no value`,
        mute.slice(0, 10).map((r) => "    " + r.k).join("\n"));
    }
  }
  // ---- THE CHART PRIMITIVES ------------------------------------------------
  //
  // A SECOND CATALOGUE, and the one this whole harness was arguably written
  // for. On 2026-07-31 a one-off sweep found 158 of these crashing on an empty
  // array — `rows.reduce((a, r) => …, rows[0])` seeds with undefined, returns
  // undefined, and the next property read throws — which React's error boundary
  // turns into "This page didn't load" rather than a missing chart. That is the
  // ORDINARY path, not an edge case: `useRows` hands back `[]` before the query
  // settles and on every site whose owner has added nothing yet. The sweep that
  // found them was never turned into a check, so nothing has stopped a 159th.
  //
  // `charts/lib` and not the 1,140 `chart-*.tsx` demos: a demo takes no props
  // and fabricates its own figures, so it can only ever prove itself. These 882
  // are what a generated page imports.
  console.log(`\nchart primitives — ${chartEntries.length} across ${chartFiles.length} domains`);
  if (chartEntries.length > chartFiles.length * 2) ok(`the chart catalogue covers ${chartEntries.length} components`);
  else bad(`the chart catalogue collapsed to ${chartEntries.length} — the extractor is broken, not the charts`);

  // ASSERTED ON THE EMPTY PASSES ONLY, and that is a scope rather than a
  // convenience. `empty` and `blank` are the states `useRows` really produces —
  // `[]` before the query settles, `[]` forever on a site whose owner has added
  // nothing — which is exactly the case the 158 crashed on.
  //
  // `full` and `zeros` are REPORTED AND NOT ASSERTED, with the reason measured
  // rather than assumed. `full` has to invent a value for every prop, and 15 of
  // these take a recursive tree (`children?: Node[]` on the type being built),
  // where any depth the synthesiser picks is arbitrary and several refuse an
  // input that is physically impossible — `FlightEnvelope` correctly rejects a
  // maximum speed below the stall speed. `zeros` hands a CHART a degenerate
  // drawing: 344 of 854 wrote NaN, nearly all of them answering a question
  // nobody asks. Asserting either would make this red on day one, and a check
  // that is always red is a check nobody reads.
  for (const mode of MODES) {
    const assertive = mode === "empty" || mode === "blank";
    // A truncated signature has fields the extractor cut off, so `full` would
    // hand a component an object missing a field it requires — a throw that is
    // the harness's fault. The empty passes fill every array with `[]`, where
    // those missing fields live, so they are unaffected.
    const list = mode === "full" ? chartEntries.filter((e) => !e.truncated) : chartEntries;
    const results = renderAll(mode, list);
    const say = assertive ? bad : (m, d) => console.log(`  note ${m}${d ? "\n" + d : ""}`);

    // OURS BEFORE THEIRS. A component sent no props throws on the first required
    // one, and reporting that as the component's fault is how a single wrong
    // path in the synthesiser read as 805 broken charts.
    if (synthFailures.length) bad(`charts ${mode}: ${synthFailures.length} could not be given props — the harness, not the charts`,
      synthFailures.slice(0, 6).map((m) => "    " + m).join("\n"));

    const threw = results.filter((r) => r.error && !CANNOT_RENDER[r.k]);
    if (threw.length === 0) ok(`charts ${mode}: nothing threw (${results.length})`);
    else say(`charts ${mode}: ${threw.length} threw`,
      threw.slice(0, 12).map((r) => `    ${r.k} -> ${r.error}`).join("\n"));

    const html = results.filter((r) => r.html);
    const nan = html.filter((r) => /NaN|-?Infinity/.test(r.html));
    if (nan.length === 0) ok(`charts ${mode}: no NaN or Infinity reaches the page`);
    else say(`charts ${mode}: ${nan.length} render NaN or Infinity`, nan.slice(0, 10).map((r) => "    " + r.k).join("\n"));

    const complained = results.filter((r) => !CANNOT_RENDER[r.k] && (r.said || []).length);
    if (complained.length === 0) ok(`charts ${mode}: React reported nothing`);
    else say(`charts ${mode}: React complained about ${complained.length}`,
      complained.slice(0, 10).map((r) => `    ${r.k} -> ${(r.said[0] || "").replace(/\s+/g, " ").slice(0, 200)}`).join("\n"));
  }

  const stale = [...renderedClean].filter(([, m]) => m.size === MODES.length).map(([k]) => k);
  if (stale.length) bad("allow-listed and renders fine in every pass — remove from CANNOT_RENDER", "    " + stale.join(", "));
  else ok(`the ${renderedClean.size} allow-listed components still cannot be driven here`);
} finally {
  fs.rmSync(OUT, { recursive: true, force: true });
}

console.log(`\n${failed ? failed + " failed" : "all passed"}`);
process.exit(failed ? 1 : 0);
