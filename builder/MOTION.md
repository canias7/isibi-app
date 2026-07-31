# The house motion set — spec

What a generated site is allowed to move, why each one exists, and what is
deliberately absent. Sibling to `GENERATOR.md`; the implementation lives in
`src/styles.css` under `MOTION` and is guarded by `test/motion.test.mjs`.

## The position

**No animation runtime.** Not on principle — on measurement. Every capability an
animation library is normally installed for was probed in the build container and
all 13 were present: `@starting-style`, `transition-behavior: allow-discrete`,
`interpolate-size`, `calc-size()`, `animation-timeline: scroll()` and `view()`,
`linear()` easing, View Transitions, `@property`, the Popover API, the Web
Animations API. Motion is ~85 KB and GSAP ~78 KB, on pages that are a barber
shop's price list.

The catalogues — Aceternity, Magic UI, React Bits — are not libraries in the
install sense either; all three ship copy-paste components you then own. What
they actually sell is a house style, and theirs is glowing beams, particle
backgrounds and neon gradients. That is an AI-startup landing page. It is not a
dentist.

**So the set below is small, named, and built for the trades this platform
serves.** Eleven effects, each with one job.

## The rules every effect obeys

1. **Timed on the scale.** `--dur-1` 90ms acknowledgement · `--dur-2` 180ms state
   change · `--dur-3` 320ms movement · `--dur-4` 500ms arrival. Nothing invents a
   duration. A page where the banner, the panel and the toast each picked their
   own number is the thing this replaces.

2. **Reduced motion removes the travel, never the behaviour.** Every effect sits
   inside `prefers-reduced-motion: no-preference`. A panel still opens, a toast
   still appears, a reveal still shows its content — it simply arrives instead of
   travelling. **A reveal that fails to fire traps content invisible, which is
   worse than any missing animation.**

3. **Scroll-driven effects are guarded by `@supports`.** Scroll timelines are at
   roughly 84% globally: Chromium since 2023, Safari since 26 (September 2025),
   **Firefox still behind a flag as of June 2026** and an Interop 2026 priority.
   Without the guard the same keyframes bind to the document timeline and play
   once on load, parking the element at its END state — visibly wrong on exactly
   the browsers that could not do the effect. This is not theoretical: it is
   about one visitor in six.

4. **Motion marks meaning, never decoration.** An effect earns its place by
   telling the visitor something: this is new, this is loading, this is where you
   were. If it only looks nice, it is not in the set.

5. **Every effect is reachable.** Named in `PAGE_RULES` and lint-checked. This
   codebase has installed capability nobody could use three times — 27 blocks,
   196 examples, 882 chart primitives — each on disk, compiling, and reachable by
   nothing, because no rule mentioned it. An effect the model is never told about
   is an effect no generated page will ever have.

## The set

### Arrival — something that was not there is now there

| class | job | timing |
|---|---|---|
| `motion-enter` | Appears unannounced: a banner, an offline notice, a booking bar on scroll. Fades and rises 4px. | `--dur-2` |
| `motion-fade` | The same, for anything positioned with `translate`. **Not interchangeable** — `motion-enter` animates `translate`, so on an element centred with `-translate-x-1/2` the starting style overwrites the centring and it slides in from the wrong place. Two components in the kit position that way. | `--dur-2` |
| `motion-stagger` | A list arriving together: services, a menu, opening hours. One delay multiplied by an index — an orchestration API in one `calc()`. Capped at 8 items, because past that the last row is waiting half a second for no reason. | `--dur-2`, 45ms step |

### Departure — and it is a separate problem

| class | job | timing |
|---|---|---|
| `motion-inout` | Driven by `data-shown`, so the element stays in the tree and can animate OUT. `display` is a discrete property; without `allow-discrete` it vanishes on frame one and the fade never runs. **This is the reason libraries keep a node mounted after you removed it.** | `--dur-2` |

### Opening — something that was closed

| class | job | timing |
|---|---|---|
| `motion-collapse` | Height to `auto`, with nothing measured in JavaScript. `interpolate-size: allow-keywords` on the root. Replaces the `scrollHeight`/ref/ResizeObserver dance every accordion used to need. The open/closed state sits OUTSIDE the reduced-motion guard — only the travel goes. | `--dur-2` |

### Scroll — driven by position, not by a listener

| class | job | timing |
|---|---|---|
| `motion-reveal` | Content arriving as the page is read. `animation-timeline: view()`, `animation-range: entry 10% cover 34%`. No IntersectionObserver. | scroll-bound |
| `motion-stick` | A header that changes once it has stuck. Uses **`@container scroll-state(stuck: top)`** — CSS can now detect *stuck*, *snapped* and *scrollable* natively, which replaces the sentinel-plus-observer the kit currently uses. Verified present in the build container. | `--dur-2` |
| `motion-progress` | A reading-progress bar. `animation-timeline: scroll(root block)`, one scaled element. | scroll-bound |

### Feedback — the visitor did something

| class | job | timing |
|---|---|---|
| `motion-press` | The active state on anything tappable. Scale to 0.97. The shortest thing in the set on purpose: acknowledgement must feel instant or it reads as lag. | `--dur-1` |
| `motion-lift` | A card that is clickable says so on hover — rises 4px, border takes the accent. Hover only; it must never be the sole affordance, since a touch device never sees it. | `--dur-1` |

### State — one thing became another

| class | job | timing |
|---|---|---|
| `motion-swap` | Skeleton to content, pending to confirmed. The replacement fades in rather than snapping, so the eye is not asked to re-find the page. | `--dur-2` |

## Deliberately absent, and why

- **Parallax as a class.** It exists as the `Parallax` component and stays there.
  It needs a wrapper, a layer and a named timeline — not something to hand the
  model as a class it can put anywhere.
- **Page transitions.** View Transitions work, but Firefox support only landed
  partially in early 2026, and a cross-page transition that half-fires is worse
  than none. Revisit when Interop closes it.
- **Text-splitting effects** — per-word or per-letter reveals. They need
  JavaScript to split the text into spans, which puts markup generation in the
  middle of a motion system. The effect is also strongly editorial and does not
  suit a price list.
- **Decorative motion** — beams, particles, aurora, spotlight backgrounds,
  scrambling text. Wrong for the trades, and they are the reason a page reads as
  a template.
- **Physics with velocity.** `linear()` gives a spring CURVE, which is enough for
  everything here. A real simulation that carries a fling's velocity needs a
  runtime, and nothing on a booking page throws anything.
- **Lottie and Rive.** The one category CSS genuinely cannot reach — a designer
  authors the motion in a tool. But the Rive web runtime is ~200 KB gzipped
  including a WASM binary against lottie-web's ~60 KB, and the sources are blunt
  that for a single animated icon it is not worth it. Revisit only for a
  commissioned illustrated moment, never for UI.

## Definition of done

- All eleven defined in `src/styles.css`, timed on the scale, no raw durations.
- All eleven named in `PAGE_RULES`, with one line each saying when to use it.
- A lint rule flagging a conditionally-rendered element with no entrance, so
  "the model did not know" cannot silently return.
- `test/motion.test.mjs` covering: the scale exists; easings live in `@theme` and
  durations do not (a `--duration-*` token generates no utility and fails
  silently); no easing shadows a Tailwind built-in; every effect is inside a
  reduced-motion guard; every scroll effect is inside `@supports`; entrances sit
  on elements that actually mount.
- Each effect rendered and DRIVEN before it is called done. A screenshot of an
  animation is a screenshot of one of its states, and this session reported
  "broken" three times when the harness was simply looking at the wrong thing.
