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
  const wearing = files.filter((f) => read(f).includes("motion-enter"));
  assert.ok(wearing.length > 0, "nothing has an entrance");
  for (const f of wearing) {
    const src = read(f);
    assert.match(src, /if \([^)]*\)\s*return null;/,
      `${f} has motion-enter but nothing that unmounts it — the class is on a sub-element`);
    const at = src.indexOf("motion-enter");
    const guard = src.search(/if \([^)]*\)\s*return null;/);
    assert.ok(guard < at, `${f}: motion-enter appears before the unmount guard`);
  }
});
