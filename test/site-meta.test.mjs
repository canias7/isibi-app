// What a published site looks like when somebody SHARES it.
//
// A generated site had a <title> and nothing else, and its <div id="root"> is
// empty until JavaScript runs. Google runs JavaScript. WhatsApp, iMessage,
// Slack, Facebook and LinkedIn do NOT — they fetch the HTML once, read the head,
// and render what is there. So a barber shop sending customers their own link
// got a bare URL.
import { test } from "node:test";
import assert from "node:assert/strict";
import { injectMeta, metaTags, pageMeta } from "../site-meta.mjs";

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
