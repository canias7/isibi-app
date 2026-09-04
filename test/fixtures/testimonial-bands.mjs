// THE TWO TESTIMONIALS BANDS AS fretwork-1 SERVES THEM (run 36, 2026-09-04).
//
// Read off the served document through a local mirror, svg icon bodies
// emptied. The first is the kit's `TestimonialGrid` (a grid, three across);
// the second is three bare `Card`s stacked with `space-y-6` — two designs of
// one thing on one page, which is what the owner's rule ("new components
// should copy existing design") now forbids.
//
// ONE COPY, shared by test/copy-design.test.mjs and test/addon-sweep.test.mjs.
// A band typed twice drifts, and the drift this replaced was real: the
// component case's guard held a snapshot with no `html` at all (the harness's
// carries one, and reads `text` off it) and a quote typed `“First…`, where
// the served page is `“<!-- -->First…` — React's SSR marker between two text
// nodes, which strips to a space. A fixture is derived from its producer; when
// the producer is a live site, from what it served.
export const card = (quote, initials, name) =>
  `<div data-slot="card" class="rounded-xl border bg-card text-card-foreground shadow"><div class="p-6 flex flex-col gap-4 pt-6"><p class="text-balance">“<!-- -->${quote}<!-- -->”</p><div class="flex items-center gap-3"><span class="relative flex shrink-0 overflow-hidden rounded-full size-8"><span class="flex h-full w-full items-center justify-center rounded-full bg-muted text-xs">${initials}</span></span><div class="text-sm"><div class="font-medium">${name}</div><div class="text-muted-foreground">Beginner</div></div></div></div></div>`;
export const FIRST_QUOTES = [
  ["Couldn’t hold a pick last month — now I play three chords.", "SH", "Sam H."],
  ["First lesson and the fretboard stopped looking like a puzzle.", "PN", "Priya N."],
  ["Two weeks from zero and I played a song for my mum.", "JP", "Jordan P."],
];
export const SECOND_QUOTES = [
  ["I had never held a guitar, and after six weeks I can play three songs my kids recognise.", "S", "Sam"],
  ["Lessons go at my pace. I was worried I would be behind, but I am not.", "P", "Priya"],
  ["I booked because a slot was free that week, and I am still coming and still enjoying it.", "J", "Jordan"],
];
export const gridBand = (quotes) =>
  `<section><div class="mx-auto max-w-6xl px-6 py-8"><div data-slot="testimonial-grid" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${quotes.map((q) => card(...q)).join("")}</div></div></section>`;
export const stackedBand = (quotes) =>
  `<section><div class="mx-auto max-w-6xl px-6 py-8 space-y-6">${quotes.map((q) => card(...q)).join("")}</div></section>`;
export const FIRST_BAND = gridBand(FIRST_QUOTES);
export const SECOND_BAND_AS_SERVED = stackedBand(SECOND_QUOTES);
export const HERO = `<section><div class="mx-auto max-w-6xl px-6 py-16"><h1>Book a guitar lesson</h1><p>Lessons in Crookes for complete beginners.</p></div></section>`;
export const page = (...bands) => `<html><body><main>${HERO}${bands.join("")}</main></body></html>`;
