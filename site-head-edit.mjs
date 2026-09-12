// WHAT A SITE SAYS ABOUT ITSELF WHERE IT IS NOT THE SITE.
//
// The `SEO & social` tab decides three things a visitor never sees on the page:
// the title of a Google result, the grey sentence under it, and the picture a
// chat app unfurls when the link is pasted. This module owns the decisions in
// that tab; the route is worker.js's and the drawing is chat.js's.
//
// WHAT WAS THERE BEFORE was eleven lines of hardcoded markup — `<div>`s dressed
// as fields, two `disabled` buttons, and a title suffix (`— built with Go
// Farther`) that NO SITE HAS EVER SERVED. Measured on `hebden-bike-repair`
// 2026-09-12: the live page answers `<title>Hebden Bike Repair</title>`, a real
// 158-character description, and an `og:image` at a composed card that is 1200
// × 630 and has existed since the build. So the mockup was not a placeholder
// for something unbuilt — it stood in FRONT of finished machinery and stated
// three false facts about the customer's own site, which is worse than the dead
// controls this repo already tracks: a dead control does nothing, and this one
// answered a question wrongly.
//
// NOT `site-seo.mjs`, WHICH IS A DIFFERENT SUBJECT. That one is the PUBLISHED
// SITE's crawling surface — the sitemap, robots.txt, the route manifest and the
// honest 404 — and answers to a crawler. This one answers to the OWNER, about
// three fields of their own head. Two neighbours of one word, kept apart on
// purpose and named here so the next session does not fold them together.
//
// THE SPLIT BELOW IS THE WHOLE DESIGN, and it is `site-runtime.ts`'s own:
//
//   description  PUBLISH-TIME → lives in the sidecar → editable, live at once
//   image        PUBLISH-TIME → lives in the sidecar → the share route's, done
//   title        BUILD-TIME   → baked as SITE_NAME   → read-only here
//
// The site's own script reads its head out of the R2 sidecar on each request,
// so patching that one key IS the deployment — the rename lane's pattern, and
// the share picker's. A description therefore changes in seconds, for nothing.
//
// AND THE TITLE IS DELIBERATELY NOT EDITABLE HERE, which is a product decision
// rather than a missing hop. `SITE_NAME` is not the `<title>` — it is the
// BUSINESS'S NAME, and the same constant paints the site's own header, the
// composed share card and `og:site_name`. An override that reached only the
// `<title>` would leave Google calling the business one thing while its own
// header, its card and the little line above every unfurl called it another.
// Changing the name is the `brand` edit lane's job and it moves all four
// together. A SEO title that DIFFERS from the business name on purpose is a
// real and separate feature — it needs the sidecar to carry one and
// `__root.tsx` to prefer it for the two title tags only — and it is named in
// CLAUDE.md as the follow-up rather than half-built here.

/**
 * The longest description we will store.
 *
 * DERIVED FROM THE BUILD PATH'S OWN CAP rather than chosen again: worker.js
 * slices `look.description` at 300 when it composes a publish, so a panel that
 * accepted more would store what the next publish silently truncates — the
 * owner's words changing on their own, which is the shape this repo calls a
 * failure that cannot name itself.
 */
export const MAX_HEAD_DESCRIPTION = 300;

/**
 * What Google renders before it cuts a description off, and what a chat app
 * shows in full. ADVISORY ONLY — it decides no refusal, and the panel uses it
 * to colour a counter. A description outside it is a worse listing, not an
 * invalid one, and refusing an owner's own sentence over a style guide would be
 * this file's own "a false alarm is worse than a miss".
 */
export const GOOD_DESCRIPTION = { min: 50, max: 160 };

/**
 * Clean a description on the way in.
 *
 * REFUSES A NON-STRING RATHER THAN COERCING. `String(["hello"])` is `"hello"`,
 * and this codebase has shipped that coercion as a real bug three times — a
 * one-element array passing as a role, an access level, a language. A panel
 * posts JSON, and JSON is exactly where an array arrives looking like a string.
 *
 * AN EMPTY STRING IS A REAL ANSWER, not a refusal: it means "take the
 * description off", and `__root.tsx` already treats an absent description as a
 * tag it declines to emit — an empty `og:description` renders the empty string
 * in a preview rather than falling back, which is why the template omits it and
 * why clearing has to reach the same state as never having had one.
 */
export function cleanHeadDescription(value) {
  if (typeof value !== "string") return { ok: false, error: "send the description as text" };
  // Newlines and runs of space collapse: a meta description is rendered as one
  // line wherever it is shown, so storing the shape of a textarea stores
  // something no reader will honour.
  const v = value.replace(/\s+/g, " ").trim();
  if (v.length > MAX_HEAD_DESCRIPTION) {
    return { ok: false, error: `keep it under ${MAX_HEAD_DESCRIPTION} characters — that one is ${v.length}` };
  }
  return { ok: true, value: v };
}

/**
 * Is this description a good length? Advisory, for the counter.
 *
 * `""` IS ITS OWN ANSWER (`empty`), never `short`. A site with no description
 * and a site with a six-word one need different sentences: one is missing a
 * thing, the other has a weak version of it.
 */
export function describeLength(value) {
  const n = String(value || "").length;
  if (!n) return { state: "empty", chars: 0 };
  if (n < GOOD_DESCRIPTION.min) return { state: "short", chars: n };
  if (n > GOOD_DESCRIPTION.max) return { state: "long", chars: n };
  return { state: "good", chars: n };
}

/**
 * The owner's own pictures, as the share picker may offer them.
 *
 * TWO FILTERS AND BOTH ARE LOAD-BEARING. `visitor` drops anything a stranger
 * uploaded through a form on the site — the 2026-08-13 audit finding, which is
 * that a business's link preview must never become a photograph somebody else
 * sent them. And a document is dropped because an `og:image` pointing at a PDF
 * renders NOTHING in a chat app, silently; the share route refuses one with a
 * sentence, and offering it here would be inviting that refusal.
 *
 * `isImage` is INJECTED rather than imported so this module stays dependency-
 * free and the rule has exactly one home — worker.js's `uploadIsImage`, which
 * is the same function the share route validates against. Two copies of "what
 * counts as a picture" is this repo's recorded "two lists of the same thing",
 * and the two would drift the day a format is added.
 */
export function pickableImages(objects, isImage) {
  const list = Array.isArray(objects) ? objects : [];
  const ok = typeof isImage === "function" ? isImage : () => true;
  const out = [];
  for (const o of list) {
    if (!o || o.visitor) continue;
    const name = String(o.key || "").split("/").pop();
    if (!name || !ok(name)) continue;
    out.push({ name, size: Number(o.size) || 0 });
  }
  // Stable, by name, so two reads of an unchanged site draw the grid in the
  // same order — R2's listing has no order of its own and a picker that
  // reshuffles under the cursor is one a person cannot use.
  out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return out;
}

/**
 * The whole answer the panel reads, composed in one place.
 *
 * ONE CALL, because the tab needs four facts that live in three stores — the
 * name and the description in the site's config, the chosen file in the same
 * config's `share`, the resolved picture through `siteOgImage`'s precedence,
 * and the uploads in R2. Four round trips from the browser would each have
 * their own failure and their own half-drawn panel.
 *
 * `image` IS THE RESOLVED URL AND `share` IS THE CHOICE, and they are separate
 * fields on purpose: `share` empty with `image` set is the ordinary state — the
 * owner has chosen nothing and the platform's composed card is what serves — and
 * a panel that could not tell those apart would draw "no image" over a site that
 * has a perfectly good one, which is the mockup's own mistake one layer in.
 */
export function headAnswer({ title, description, image, share, uploads }) {
  return {
    ok: true,
    title: String(title || ""),
    description: String(description || ""),
    image: String(image || ""),
    share: String(share || ""),
    uploads: Array.isArray(uploads) ? uploads : [],
  };
}
