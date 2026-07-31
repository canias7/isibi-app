// The motion system, and the two ways it fails silently.
//
// Motion is the one design layer where a mistake looks like nothing at all. A
// duration token that Tailwind never generated leaves the markup correct and the
// timing wrong; an entrance class on the wrong element animates something that
// was already on screen. Neither shows up in a typecheck, a screenshot, or any
// other test in this repo — so both are asserted here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MOTION, PAGE_RULES, lintPages } from "../builder/page-gen.mjs";
import path from "node:path";

const TEMPLATE = "builder/lovable/template";
const UI = path.join(TEMPLATE, "src/components/ui");
const styles = fs.readFileSync(path.join(TEMPLATE, "src/styles.css"), "utf8");
const files = fs.readdirSync(UI).filter((f) => f.endsWith(".tsx"));
const read = (f) => fs.readFileSync(path.join(UI, f), "utf8");

test("the scale exists, and every step of it", () => {
  for (const step of [1, 2, 3, 4]) {
    assert.match(styles, new RegExp(`--dur-${step}:\\s*\\d+ms`), `--dur-${step} is not defined`);
  }
  for (const ease of ["emphasis", "standard", "spring"]) {
    assert.match(styles, new RegExp(`--ease-${ease}:`), `--ease-${ease} is not defined`);
  }
});

test("the easings live in @theme and the durations do not", () => {
  // NOT a style preference — it is the difference between a class that works and
  // one that silently does nothing. Tailwind v4 derives an `ease-*` utility from
  // the @theme namespace but has no namespace for a named duration: putting
  // `--duration-fast` in @theme generates no class at all, and the element keeps
  // the 150ms default while the markup still reads as if it were timed.
  const theme = styles.slice(styles.indexOf("@theme {"), styles.indexOf("@theme inline"));
  assert.match(theme, /--ease-emphasis:/, "the easings must be in @theme to become utilities");
  assert.ok(!/--duration-\w+:/.test(styles),
    "a --duration-* token generates no Tailwind utility and would fail silently");
});

test("the easings do not shadow Tailwind's own", () => {
  // `--ease-out` in @theme would redefine the built-in `ease-out`, silently
  // re-timing everything already using it anywhere in the kit.
  for (const builtin of ["--ease-out:", "--ease-in:", "--ease-in-out:", "--ease-linear:"]) {
    assert.ok(!styles.includes(builtin), `${builtin} shadows a Tailwind built-in`);
  }
});

test("no component carries an ad-hoc duration any more", () => {
  const offenders = [];
  for (const f of files) {
    for (const m of read(f).matchAll(/\bduration-(\d+)\b/g)) {
      // 1000ms is input-otp's caret BLINK — an animation loop, not a transition.
      // Putting it on a transition scale would be tokenising for its own sake.
      if (m[1] === "1000" && f === "input-otp.tsx") continue;
      offenders.push(`${f}: duration-${m[1]}`);
    }
  }
  assert.deepEqual(offenders, [], "these should use duration-(--dur-N)");
});

test("no component carries a raw easing class any more", () => {
  const offenders = [];
  for (const f of files) {
    // As a CLASS only. `ease-in` inside a template literal is part of a CSS
    // animation shorthand that the browser parses, and rewriting that to a
    // Tailwind class name would break it.
    for (const m of read(f).matchAll(/(?<=["'\s])(ease-(?:linear|in-out|out))(?=[\s"'`])/g)) {
      offenders.push(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual(offenders, [], "these should use ease-standard / ease-emphasis");
});

test("the entrance classes are defined, and behind @starting-style", () => {
  // `motion-enter` without @starting-style is a transition with no from-state,
  // which means no animation at all — and the class name still reads as if
  // there were one.
  assert.match(styles, /\.motion-enter\s*\{/);
  assert.match(styles, /@starting-style\s*\{[\s\S]*?\.motion-enter/);
  assert.match(styles, /\.motion-inout\[data-shown="false"\][\s\S]*?display:\s*none/);
  assert.match(styles, /display\s+var\(--dur-2\)\s+allow-discrete/,
    "leaving the DOM needs allow-discrete or the exit never runs");
});

test("every motion rule is inside a reduced-motion guard", () => {
  // The one rule that matters more than any effect: a visitor who asked for less
  // movement gets the content, not a stuck animation.
  const section = styles.slice(styles.indexOf("   MOTION"));
  const transitions = [...section.matchAll(/^\s*transition:/gm)].length;
  assert.ok(transitions > 0, "the motion section has no transitions — did it move?");
  assert.ok(section.includes("prefers-reduced-motion: no-preference"),
    "motion must be opt-in behind prefers-reduced-motion");
  // …and the collapse must still OPEN with motion off. Only the travelling goes.
  const collapse = section.slice(section.indexOf(".motion-collapse"));
  assert.match(collapse, /\.motion-collapse\[data-open="true"\]\s*\{\s*height:\s*auto/,
    "the open state must sit outside the motion guard");
});

test("the parallax timeline is behind @supports", () => {
  // Without the guard the same keyframes attach to the DOCUMENT timeline in a
  // browser lacking scroll timelines and play once on load, parking the layer at
  // its end position — visibly wrong on exactly the browsers that could not do
  // the effect.
  const at = styles.indexOf("@keyframes motion-parallax");
  assert.ok(at > 0, "the parallax keyframes are gone");
  const before = styles.slice(0, at);
  assert.match(before.slice(before.lastIndexOf("@supports")),
    /@supports \(animation-timeline: view\(\)\)/,
    "the parallax animation is not guarded by @supports");
});

test("parallax no longer reads layout on scroll", () => {
  // The whole point of the migration. getBoundingClientRect in a scroll path is
  // a forced synchronous layout, and it was running per frame per element.
  // Comments stripped first. The header describes exactly what this component no
  // longer does, so a raw substring search finds every banned name in the prose
  // explaining their absence — a test failing on its own documentation.
  const src = read("parallax.tsx").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  for (const banned of ["getBoundingClientRect", "requestAnimationFrame", "addEventListener", "IntersectionObserver"]) {
    assert.ok(!src.includes(banned), `parallax still uses ${banned}`);
  }
});

test("an entrance is on a root that actually appears, not on a sub-element", () => {
  // THE MISTAKE A SCRIPT MADE AND A PERSON WOULD NOT. Looking for "the first
  // element rendered behind a condition" is syntactic; "the thing that appears"
  // is semantic. That heuristic put the class on a banner's optional TITLE, a
  // toast's optional DETAIL LINE, and a dozen hints and badges — sub-elements of
  // components that were already on screen, where the effect is a flicker
  // inside something static. 32 files, essentially all wrong.
  //
  // So each one is checked to sit on a root guarded by an early `return null`,
  // which is what makes it a component that genuinely arrives and departs.
  // TWO SHAPES COUNT AS ARRIVING, and the first version of this test only knew
  // one. An early `return null` is the obvious case. The other is an element
  // rendered from a `.map()` over state — a toast in a stack mounts when it is
  // pushed and unmounts when it is dismissed, which is the most canonical
  // arrival in the kit, and the test flagged it as a mistake. Asserting a proxy
  // for the property you care about is fine right up until the proxy is wrong.
  const wearing = files.filter((f) => /motion-(enter|fade)/.test(read(f)));
  assert.ok(wearing.length > 0, "nothing has an entrance");
  for (const f of wearing) {
    const src = read(f);
    const at = src.search(/motion-(enter|fade)/);
    const guard = src.search(/if \([^)]*\)\s*return null;/);
    const mapped = /\.map\(\([^)]*\)\s*=>\s*</.test(src);
    assert.ok((guard >= 0 && guard < at) || mapped,
      `${f}: the entrance is on an element that never mounts or unmounts — ` +
      `no early return null before it, and nothing rendered from a list`);
  }
});

test("every effect is reachable, and every named effect exists", () => {
  // BOTH DIRECTIONS, because each failure is silent in its own way and this
  // codebase has had both. An effect in styles.css that the prompt never
  // mentions is dead weight — the 27 blocks, the 196 examples and the 882 chart
  // primitives were each on disk, compiling, and used by nothing for exactly
  // this reason. An effect named in the prompt that styles.css does not define
  // is worse: the model writes the class, the browser ignores it, and the page
  // looks static with no error anywhere.
  // Leading whitespace allowed: every one of these lives inside a @media or
  // @supports block, so a selector anchored to column zero finds none of them —
  // and the test then reports the whole set as missing from the stylesheet that
  // in fact defines all of it.
  const inCss = [...styles.matchAll(/^[ \t]*\.(motion-[a-z-]+)/gm)].map((m) => m[1]);
  const declared = MOTION.map(([n]) => n);
  for (const n of new Set(inCss)) {
    assert.ok(declared.includes(n), `${n} is defined in styles.css but the model is never told about it`);
  }
  for (const n of declared) {
    assert.ok(inCss.includes(n), `${n} is named in the rules but styles.css does not define it`);
    assert.ok(PAGE_RULES.includes(n), `${n} is in MOTION but not in the prompt text`);
  }
  assert.equal(declared.length, 11);
});

test("a page that invents its own timing is refused", () => {
  // Narrow on purpose. Since the kit was tokenised there is exactly one scale,
  // so a raw duration is always a real defect rather than a style opinion — and
  // it is the failure that never announces itself: a page where the banner, the
  // panel and the toast each picked a different number looks right in every
  // screenshot and merely feels unconsidered.
  const lint = (s) => lintPages([{ path: "index.tsx", source: s }], { tables: [] });
  assert.match(lint('<div className="duration-300" />')[0] || "", /one timing scale/);
  assert.match(lint('<div className="ease-linear" />')[0] || "", /ease-emphasis/);
  assert.match(lint('import { motion } from "framer-motion";')[0] || "", /no animation library/);
  assert.match(lint('import gsap from "gsap";')[0] || "", /no animation library/);
  // The scale itself, and the classes, must pass clean.
  assert.deepEqual(lint('<div className="duration-(--dur-2) motion-enter" />'), []);
  // A comment is not code.
  assert.deepEqual(lint('// className="duration-300"'), []);
});
