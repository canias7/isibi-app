/**
 * ONE EDITABLE VIEW OF A SITE'S SOURCE: its pages and its own components, in a
 * single list that every rung already knows how to read.
 *
 * WHY THIS EXISTS (2026-09-11). A site's source has always been two stores —
 * `source/<slug>/pages.json` as `{path, source}` and `source/<slug>/parts.json`
 * as `{name, source}` — and the cheap edit rungs only ever saw the first. That
 * cost nothing while a component was a rarity and every word on the page lived
 * in the page. It stopped being free the day the band split began writing each
 * SECTION to its own file: the prose a customer asks to change is now in the
 * parts, and a `text` lane that reads only `pages` would look at a shell of
 * imports, find none of the words, and escalate a one-credit wording change to
 * a full page rewrite. Every time.
 *
 * THE ADAPTER IS HERE AND NOT IN THE RUNGS, and that is the whole design.
 * `textItems` and `applyEdits` key on `p.path` and NEVER interpret it — read,
 * both of them — so a part presented with a path is a page as far as they are
 * concerned. Teaching each rung about a second shape would be the same
 * knowledge in several places, and this repository has a name for that; one
 * mapping, in one file, driven both ways.
 *
 * THE ROUND TRIP IS THE CONTRACT. `splitEditable(editableFiles(pages, parts))`
 * must give back exactly what went in, or an edit silently moves a component
 * into the page list — where it would be counted against the page cap, put in
 * the nav manifest, published in `sitemap.xml` and stubbed by salvage. The
 * guard drives that identity rather than asserting it in prose.
 *
 * DEPENDENCY-FREE, so it can be imported by the container as readily as by the
 * Worker, and so the guard can drive it with nothing stubbed.
 */

/** The directory a component written for this site lives in, under `src/routes`. */
export const PART_DIR = "-parts/";

/**
 * The editable path for a stored part.
 *
 * IT IS `safePart`'s ANSWER, MINUS THE `src/routes/` THE STORES DO NOT CARRY.
 * `pages.json` holds `index.tsx`, not `src/routes/index.tsx`, so a part shown
 * beside one has to be relative in the same way or the two halves of a list
 * disagree about what a path is.
 */
export function partPath(name) {
  const n = String(name == null ? "" : name).trim();
  return n ? PART_DIR + n + ".tsx" : "";
}

/**
 * The stored part name behind an editable path, or `""` when it is a page.
 *
 * ANCHORED AND SUFFIXED, never a substring test: a PAGE legitimately called
 * `my-parts/x.tsx` is not a component, and reading it as one would file it into
 * `parts.json` and drop it off the site.
 */
export function partNameOf(path) {
  const p = typeof path === "string" ? path : "";
  if (!p.startsWith(PART_DIR) || !p.endsWith(".tsx")) return "";
  return p.slice(PART_DIR.length, -".tsx".length);
}

/**
 * DOES THIS SOURCE IMPORT THAT COMPONENT — the ONE definition, and it lives
 * here because it is a fact about the path convention `PART_DIR` above states
 * and about nothing else.
 *
 * IT WAS A CLOSURE INSIDE `deadQrs` UNTIL 2026-09-20, which was right while it
 * had one caller. It has two now — the withholding cascade, and the file→route
 * association `routedSources` needs to say which PAGE a component's photograph
 * is on — and this repository's most-repeated defect is two lists of one thing
 * drifting apart. A second copy here would be a component the cascade withholds
 * and the reporting still credits to a page, or the reverse.
 *
 * WHICH SPELLINGS COUNT DEPENDS ON WHERE THE SOURCE ITSELF LIVES. From a PAGE
 * (`src/routes/<x>.tsx`) it is the `-parts/` form: both the `@/routes/-parts/x`
 * every prompt teaches and the relative `./-parts/x` TypeScript also resolves.
 * The leading `(^|["'/])` is what keeps a PAGE called `my-parts/x.tsx` from
 * reading as an import of `x` — the trap `partNameOf` above records.
 *
 * ⚠ FROM A COMPONENT A SIBLING IS ALSO `./x`, WITH NO `-parts/` IN IT AT ALL.
 * MEASURED before admitting it: the only spelling ANY prompt teaches is
 * `@/routes/-parts/<name>`, and the 100-site corpus contains ZERO `-parts/`
 * files at all — it predates components — so there is no evidence either way
 * about what a model writes between two siblings. What decides it is the
 * asymmetry rather than a guess: a relative `./x` from inside `-parts/` can
 * resolve to NOTHING BUT `-parts/x.tsx`, so admitting it has a false-alarm rate
 * of zero BY CONSTRUCTION, while missing it hands the compiler a dangling
 * import — and, here, silently detaches a nested component from its page.
 *
 * AND `inPart` IS THE DISCRIMINATOR THAT KEEPS IT SAFE: from a PAGE, `./x`
 * means `src/routes/x.tsx` — another page — so the sibling form is asked of
 * component sources and of nothing else.
 *
 * THE QUOTE AND THE DOT ARE BOTH WALLS, measured against the shapes a real
 * component carries: without the quote a COMMENT saying "the card is in
 * ./qr-card" reads as an import, and without the `./` any path ending in
 * `/qr-card` does — a link, a kit module of the same name, a sentence about a
 * print file.
 *
 * THE NAME IS ESCAPED BECAUSE THIS FUNCTION IS EXPORTED AND TAKES WHAT IT IS
 * HANDED. `validatePages` refuses any component name that is not
 * `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`, so no name reaching it through the product
 * can hold a regex metacharacter — but an unescaped name arriving from anywhere
 * else would become a PATTERN, and `qr.card` would match `qrxcard`.
 */
export function importsPart(src, name, inPart) {
  const s = typeof src === "string" ? src : "";
  const n = typeof name === "string" ? name : "";
  if (!s || !n) return false;
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp("(^|[\"'/])" + esc(PART_DIR) + esc(n) + "(?![\\w-])").test(s)) return true;
  return inPart === true && new RegExp("[\"']\\./" + esc(n) + "(?![\\w-])").test(s);
}

/**
 * The pages and the parts as ONE list of `{path, source}`.
 *
 * PAGES FIRST, PARTS AFTER, and the order is load-bearing for the text lane:
 * `textItems` walks this list and stops one past `MAX_TEXT_ITEMS`, so a site
 * big enough to hit the cap shows the page's own words before its components'.
 * Reversed, a long component could push every page string past the cap and send
 * an ordinary site to the expensive lane.
 *
 * A part with no usable name is DROPPED rather than given a made-up path — it
 * could not be written back under a name we invented, and a file that cannot
 * round-trip must never enter a list whose whole contract is that it does.
 */
export function editableFiles(pages, parts) {
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (p && typeof p.path === "string" && typeof p.source === "string") out.push({ path: p.path, source: p.source });
  }
  for (const p of Array.isArray(parts) ? parts : []) {
    if (!p || typeof p.source !== "string") continue;
    const path = partPath(p.name);
    if (path) out.push({ path, source: p.source });
  }
  return out;
}

/**
 * The one list, back into the two stores it came from.
 *
 * THE NAME COMES BACK OFF THE PATH, never carried alongside it. A second field
 * riding the entry would be a copy of the same fact, and the rungs in between
 * rebuild these objects freely (`applyEdits` maps to `{path, source}` twice) —
 * so anything but the path would not survive the trip that this function's
 * whole job is to complete.
 */
export function splitEditable(files) {
  const pages = [];
  const parts = [];
  for (const f of Array.isArray(files) ? files : []) {
    if (!f || typeof f.path !== "string" || typeof f.source !== "string") continue;
    const name = partNameOf(f.path);
    if (name) parts.push({ name, source: f.source });
    else pages.push({ path: f.path, source: f.source });
  }
  return { pages, parts };
}
