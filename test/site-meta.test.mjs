// What a published site looks like when somebody SHARES it.
//
// A generated site had a <title> and nothing else, and its <div id="root"> is
// empty until JavaScript runs. Google runs JavaScript. WhatsApp, iMessage,
// Slack, Facebook and LinkedIn do NOT — they fetch the HTML once, read the head,
// and render what is there. So a barber shop sending customers their own link
// got a bare URL.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { injectMeta, metaTags, pageMeta, setTitle } from "../site-meta.mjs";
import { routeOf, fileForRoute } from "../builder/site-addon.mjs";

const PAGE = `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>Sharp Fade</title><link rel="stylesheet" href="./a.css"></head><body><div id="root"></div></body></html>`;
const META = { brand: "Sharp Fade Barbershop", description: "Skin fades and hot-towel shaves in Lisbon. Book online.", url: "https://gofarther.dev/s/sharp-fade/", image: "/u/sharp-fade/abc.png" };

test("a shared link gets a name, a description and a picture", async () => {
  const out = injectMeta(PAGE, META);
  assert.match(out, /<meta name="description" content="Skin fades[^"]*">/);
  assert.match(out, /<meta property="og:title" content="Sharp Fade Barbershop">/);
  assert.match(out, /<meta property="og:description" content="Skin fades/);
  assert.match(out, /<meta property="og:url" content="https:\/\/gofarther\.dev\/s\/sharp-fade\/">/);
  assert.match(out, /<meta property="og:image" content="\/u\/sharp-fade\/abc\.png">/);
});

test("the card type follows whether there is actually a picture", () => {
  // summary_large_image with no image renders an empty box.
  const withImg = metaTags(META), without = metaTags({ ...META, image: null });
  assert.match(withImg, /twitter:card" content="summary_large_image"/);
  assert.match(without, /twitter:card" content="summary"/);
  assert.ok(!without.includes("og:image"));
  // Exactly ONE card tag either way. Two contradictory ones is not "the right
  // one is present" — it is undefined behaviour in whichever scraper reads it,
  // and asserting only on presence let a mutation emit both.
  assert.equal((withImg.match(/twitter:card/g) || []).length, 1, withImg);
  assert.equal((without.match(/twitter:card/g) || []).length, 1, without);
});

test("the rest of the document is untouched", () => {
  const out = injectMeta(PAGE, META);
  // The dist is Vite's output; this is not the place to be clever with it.
  for (const keep of ['<meta charset="UTF-8" />', '<link rel="stylesheet" href="./a.css">', '<div id="root"></div>', "<title>Sharp Fade</title>"]) {
    assert.ok(out.includes(keep), keep);
  }
});

test("republishing does not stack another copy", async () => {
  // A site is republished on every revise.
  let out = injectMeta(PAGE, META);
  for (let i = 0; i < 5; i++) out = injectMeta(out, META);
  assert.equal((out.match(/og:title/g) || []).length, 1);
  assert.equal((out.match(/isibi:meta/g) || []).length, 2, "one open, one close");
});

test("republishing with NEW text replaces the old, it does not keep both", async () => {
  const first = injectMeta(PAGE, META);
  const second = injectMeta(first, { ...META, brand: "Renamed Shop" });
  assert.match(second, /og:title" content="Renamed Shop"/);
  assert.ok(!second.includes("Sharp Fade Barbershop"), "the old name is gone");
});

// ───────────────────────────────────────────────────────────────── escaping

test("a quote in the name cannot break out of the attribute", () => {
  // brand and description are model-written and go straight into an attribute.
  const out = injectMeta(PAGE, { brand: `Bob's "Best" Cuts`, description: `<script>alert(1)</script> & more` });
  assert.ok(!/content="[^"]*"[^">]*=/.test(out.split("isibi:meta")[1] || ""), "no attribute escape");
  assert.ok(!out.includes("<script>alert(1)</script>"), out);
  assert.match(out, /&quot;Best&quot;/);
  assert.match(out, /&#39;/);
  assert.match(out, /&lt;script&gt;/);
});

test("a newline in the description does not produce a broken tag", () => {
  const out = injectMeta(PAGE, { brand: "X", description: "line one\nline two\t and   more" });
  assert.match(out, /content="line one line two and more"/);
});

// ────────────────────────────────────────────────────────────────── limits

test("a very long name or description is cut, not shipped whole", () => {
  const out = metaTags({ brand: "b".repeat(300), description: "d".repeat(900) });
  const title = out.match(/og:title" content="(b+)"/)[1];
  const desc = out.match(/name="description" content="(d+)"/)[1];
  assert.ok(title.length <= 70, title.length);
  assert.ok(desc.length <= 200, desc.length);
});

// ──────────────────────────────────────────────────── it can only ever no-op

test("nothing to say means the page is returned unchanged", () => {
  for (const meta of [undefined, {}, { brand: "", description: "  " }, null]) {
    assert.equal(injectMeta(PAGE, meta), PAGE, JSON.stringify(meta));
  }
});

test("a document with no head is left exactly as it is", () => {
  // A site published without a description is a far smaller problem than a site
  // published broken, so this can never be an error.
  const odd = "not really html at all";
  assert.equal(injectMeta(odd, META), odd);
  assert.equal(injectMeta("", META), "");
  assert.equal(injectMeta(null, META), "");
});

test("a page with a head but no title still gets its tags", () => {
  const noTitle = `<html><head><meta charset="UTF-8"></head><body></body></html>`;
  const out = injectMeta(noTitle, META);
  assert.match(out, /og:title/);
  assert.ok(out.indexOf("isibi:meta") > out.indexOf("<head>"), "inside the head");
  assert.ok(out.indexOf("isibi:meta") < out.indexOf("</head>"), "inside the head");
});

test("the tags land inside the head, after the title", () => {
  const out = injectMeta(PAGE, META);
  assert.ok(out.indexOf("isibi:meta") > out.indexOf("</title>"));
  assert.ok(out.indexOf("isibi:meta") < out.indexOf("</head>"));
});

// ─────────────────────────────────────────────────────────────────────────────
// A SUB-PAGE'S OWN TITLE, when the page has no `<h1>`.
//
// MEASURED ON A REAL SITE 2026-08-13: `/work` served the HOME page's title. The
// cause is structural rather than bad luck — only 11 of the kit's components
// render an `<h1>` and 49 render an `<h2>`, so a page assembled from SECTIONS
// has none. That barber shop's work page was `SiteChrome > SectionHeader +
// Gallery + CtaBand`, and `SectionHeader` is an `<h2>` on purpose.
//
// Confirmed independently against the generator's own committed output: of the
// 9 real pages under docs/auth-audit/pages, the one with no `<h1>` source is
// `work.tsx` — different site, different brief, same page.

const BASE = { brand: "Fade & Co Barbershop", description: "A barber shop in Leeds." };
const doc = (body) => "<html><body>" + body + "</body></html>";

test("a page whose only heading is an h2 gets its own title", () => {
  const work = doc("<h2>Our work</h2><p>A gallery of recent cuts and fades from the chair, updated weekly.</p>");
  assert.equal(pageMeta(work, BASE).brand, "Our work · Fade & Co Barbershop",
    "a section-built page still carries the site name as its title");
});

test("an h1 still wins over an h2 on the same page", () => {
  // The fallback must not overtake the real thing: a page with both has the h1
  // as its subject and the h2 as a section within it.
  const both = doc("<h1>Book a chair</h1><h2>Available today</h2><p>Pick a time that suits you and we will hold it.</p>");
  assert.match(pageMeta(both, BASE).brand, /^Book a chair/,
    "the h2 fallback overtook a real h1");
});

test("a page with no heading at all is left alone, and so is home", () => {
  // A no-op is the right answer for both — same rule as the tags. A page with a
  // plain title is a far smaller problem than a broken one, and the home page
  // keeps the site-level title the designer wrote for it.
  assert.equal(pageMeta(doc("<div>no headings</div>"), BASE).brand, BASE.brand);
  assert.equal(pageMeta(doc("<h2>Our work</h2>"), BASE, { home: true }).brand, BASE.brand,
    "the home page picked up a section heading as its title");
});

test("the brand is not repeated when the heading already contains it", () => {
  const h = doc("<h2>Fade &amp; Co Barbershop — the work</h2>");
  const got = pageMeta(h, BASE).brand;
  assert.ok(!/Barbershop[\s\S]*Barbershop/.test(got), "the site name appears twice: " + got);
});

// ─────────────────────────────────────────────────────────────────────────────
// STRING.REPLACE'S $-PATTERNS ARE NOT PART OF A TITLE (2026-08-13 audit, each
// case verified against this module before the fix): "Win $$$ prizes" published
// as "Win $$ prizes", `$&` re-inserted the old title inside the new one, and
// "Mo$'s Cuts" — an ordinary stylised trading name — spliced everything after
// the old title back into the head, doubling it. A function replacer inserts
// its return verbatim, which closes the whole class.
test("setTitle survives every $-sequence a trading name can carry", () => {
  const page = "<html><head><title>Old</title><meta name=x></head><body>tail</body></html>";
  for (const t of ["Win $$$ prizes", "Mo$'s Cuts", "A $& B", "$` before"]) {
    const out = setTitle(page, t);
    const tags = out.match(/<title>/g) || [];
    assert.equal(tags.length, 1, JSON.stringify(t) + " produced " + tags.length + " title tags");
    const got = (out.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
    // Unescape the entities the escaper legitimately makes, then demand the
    // dollars survived byte-for-byte.
    const back = got.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    assert.equal(back, t, JSON.stringify(t) + " came out as " + JSON.stringify(got));
    assert.ok(!out.includes("Old"), "the old title leaked back into the page for " + JSON.stringify(t));
  }
});

test("og:url names the page, not the site's home page", () => {
  // A REPEAT FINDING: raised 2026-08-09 and still true five days later. Every
  // prerendered page of every published site carried the site's own root as its
  // og:url — so a booking page shared into WhatsApp previewed with the right
  // title and description over an address pointing somewhere else, and a crawler
  // was told two addresses are one page.
  const base = { brand: "Sharp Fade Barbershop", description: "A barber shop in Leeds.", url: "https://sharp-fade.gofarther.app/" };
  const html = "<h1>Book a chair</h1><p>Walk in or book a chair online today, seven days a week at our Leeds shop.</p>";

  assert.equal(pageMeta(html, base, { home: false, route: "/book" }).url,
    "https://sharp-fade.gofarther.app/book");
  assert.equal(pageMeta(html, base, { home: false, route: "/about/team" }).url,
    "https://sharp-fade.gofarther.app/about/team", "a nested route loses its path");

  // THE HOME PAGE KEEPS THE SITE URL, and it must — appending "/" to a base that
  // already ends in one would give a second slash on the one address everybody
  // shares.
  assert.equal(pageMeta(html, base, { home: true, route: "/" }).url, base.url);

  // AN UNKNOWN ROUTE IS TODAY'S BEHAVIOUR, never a wrong per-page claim. This is
  // reachable: `routeOf` does not lowercase and `siteRoutes` does, so a
  // mixed-case page path misses the lookup — the safe direction, deliberately.
  assert.equal(pageMeta(html, base, { home: false }).url, base.url, "a page with no route gets a made-up URL");
  assert.equal(pageMeta(html, base, { home: false, route: undefined }).url, base.url);

  // A base with no url stays without one rather than gaining "undefined/book".
  assert.equal(pageMeta(html, { brand: "X" }, { home: false, route: "/book" }).url, undefined);

  // AND IT REACHES THE TAG — the module is correct and unread if metaTags drops it.
  assert.match(metaTags(pageMeta(html, base, { home: false, route: "/book" })),
    /<meta property="og:url" content="https:\/\/sharp-fade\.gofarther\.app\/book">/);
});

test("the mapping the publish path keys on is the one the container writes", () => {
  // Two readings of one mapping is this repo's "path-shape mismatch" family, and
  // it has already shipped a bug twice. `fileForRoute` is the inverse of
  // `routeOf` and lives beside it; this drives the real pair round-trip so a
  // future edit to either cannot silently stop them agreeing.
  for (const [file, route] of [["index.tsx", "/"], ["book.tsx", "/book"], ["about.team.tsx", "/about/team"]]) {
    assert.equal(routeOf(file), route, `routeOf(${file})`);
    assert.equal(fileForRoute(route), route === "/" ? "index.html" : file.replace(/\.tsx$/, "").replace(/\./g, "/") + ".html",
      `fileForRoute(${route})`);
  }
});

// ── setTitle ────────────────────────────────────────────────────────────────
//
// THE ONE EXPORT IN THIS MODULE THAT HAD NO BEHAVIOURAL TEST, and it is where
// the medium-severity corruption bug sat. Its only guard anywhere was a
// source-read in `publish-pages.test.mjs` asserting the Worker CALLS it — the
// wiring layer watching the layer below the break, which is this repo's most
// recorded failure. Its escaping, its no-op rule, its truncation and its
// replacement were asserted by nothing.
test("setTitle replaces the title and escapes what goes in it", () => {
  const html = `<!doctype html><html><head><title>Old</title></head><body>x</body></html>`;
  assert.match(setTitle(html, "Sharp Fade"), /<title>Sharp Fade<\/title>/);
  assert.doesNotMatch(setTitle(html, "Sharp Fade"), /<title>Old<\/title>/);
  // A brand is model-written and lands between two tags, so the four characters
  // that can close one are escaped.
  assert.match(setTitle(html, `A & B <script> "x"`), /<title>A &amp; B &lt;script&gt; &quot;x&quot;<\/title>/);
  // Whitespace is collapsed — a newline inside a tag is a title nobody can read
  // in a browser tab and a difference between two otherwise identical pages.
  assert.match(setTitle(html, "  Sharp\n\tFade  "), /<title>Sharp Fade<\/title>/);
  assert.ok(setTitle(html, "x".repeat(200)).match(/<title>(x+)<\/title>/)[1].length === 70,
    "a title is capped at 70");
});

test("setTitle is a NO-OP rather than a guess when there is nothing to replace", () => {
  // Both directions matter: an empty title must not blank a real one, and a
  // document with no <title> must not gain one in the wrong place. This runs on
  // every prerendered page of every published site, so "do nothing" is the only
  // safe answer to an input it was not built for.
  const html = `<!doctype html><html><head><title>Old</title></head><body>x</body></html>`;
  for (const bad of ["", "   ", null, undefined]) assert.equal(setTitle(html, bad), html, JSON.stringify(bad));
  const noTitle = `<!doctype html><html><head><meta charset="utf-8"></head><body>x</body></html>`;
  assert.equal(setTitle(noTitle, "Sharp Fade"), noTitle);
  assert.equal(setTitle(null, "Sharp Fade"), "");
  assert.equal(setTitle(undefined, "Sharp Fade"), "");
});

test("a $ in the brand does not corrupt the page — the replacement is VERBATIM", () => {
  // THE BUG THIS MODULE ACTUALLY HAD (2026-08-13 audit). `String.replace` reads
  // `$$`, `$&`, `$'` and `` $` `` in a REPLACEMENT STRING as patterns, so:
  //   "Win $$$ prizes"  published as "Win $$ prizes"
  //   "$& Cuts"         re-inserted the OLD title inside the new one
  //   "Mo$'s Cuts"      spliced everything after the old title back in, DOUBLING
  //                     the head of the document
  // Each is an ordinary stylised trading name, and each was verified against
  // this module. A function replacer inserts its return value literally, which
  // closes the whole class — so these assert the class, not the three spellings.
  //
  // Compared through an UNESCAPE rather than against the raw name: `$&` contains
  // an ampersand, which `setTitle` correctly turns into `&amp;`, and asserting
  // the raw string would fail on the escaping this test is not about. Four
  // entities, written as the inverse of the thing under test rather than as a
  // copy of it.
  const unesc = (s) => s.replace(/&(amp|lt|gt|quot);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"' }[e]));
  const html = `<!doctype html><html><head><title>Old</title></head><body>tail</body></html>`;
  for (const name of ["Win $$$ prizes", "$& Cuts", "Mo$'s Cuts", "Back$` Bar", "A $1 haircut"]) {
    const out = setTitle(html, name);
    const titles = out.match(/<title>/g) || [];
    assert.equal(titles.length, 1, `${name} produced ${titles.length} titles`);
    assert.equal(unesc(out.match(/<title>([\s\S]*?)<\/title>/)[1]), name, `${name} round-trips verbatim`);
    // The rest of the document is untouched — the `$'` case used to duplicate it.
    assert.equal((out.match(/tail/g) || []).length, 1, `${name} duplicated the body`);
    assert.doesNotMatch(out, /Old/, `${name} left the old title in the document`);
  }
});

test("the title pattern is written ONCE, which is what makes the presence check honest", () => {
  // The check that there IS a title cannot change the ANSWER — `String.replace`
  // with no match returns the string unchanged, so both paths give back `src`.
  // Measured by mutation: deleting it survives every behavioural test there is,
  // and no behavioural test could ever catch it, because nothing observable
  // separates "returned early" from "replaced nothing".
  //
  // So it is held STRUCTURALLY instead of being deleted or pretended-to-be-tested
  // — the repo's own treatment for a guard that holds by an emergent property.
  // The property is that the tested pattern and the replaced pattern are the SAME
  // one: two literals that happen to agree is a coincidence one edit away from
  // ending, and what it would produce is a page gaining a `<title>` somewhere
  // nobody wanted one. This assertion covers both — a broader test pattern and a
  // deleted check each leave the count wrong.
  const src = fs.readFileSync(new URL("../site-meta.mjs", import.meta.url), "utf8");
  const at = src.indexOf("export function setTitle(");
  assert.ok(at > 0, "setTitle moved — rescope this");
  const body = src.slice(at, src.indexOf("\n}", at));
  assert.ok(body.length > 300, "the setTitle window is empty — rescope this");
  assert.equal((body.match(/<title\[\^>\]\*>/g) || []).length, 0,
    "setTitle writes the title pattern inline again — the presence check is now a coincidence");
  assert.equal((body.match(/TITLE_TAG/g) || []).length, 2, "both uses must go through the one pattern");
});
