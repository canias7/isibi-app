// PARKED (2026-11-03, park-old-way): the old-way half of test/old-site-import.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// "Make my site like my old one" (ideas #25/#26, 2026-10-22): the extraction
// on fixture HTML, the guards (public host, same host, caps), the router's
// typed field, the brief block, the picture copy, and the route's sign-in —
// the real Worker route under a stubbed network. No real site is fetched.
import test from "node:test";
import assert from "node:assert/strict";
import {
  extractSite, importSite, importBriefBlock, readImportSite, publicUrl, sameSite, navLinks,
  brandColours, fontFamilies, findLogo, findPhotos, businessName, openingHours, contactDetails,
  placeImportedPhotos, importedImages, MAX_PAGES, MAX_PHOTOS, MAX_IMAGE_BYTES, MAX_PAGE_TEXT,
} from "../../../builder/site-import.mjs";
import { ASK_TOOL, readRouting } from "../builder/site-ask.mjs";
import { loadWorkerModule } from "../../../test/fixtures/worker-harness.mjs";

const HOME = `<!doctype html><html><head>
<title>Home | Fold Lane Bakery</title>
<meta name="description" content="Sourdough &amp; pastries baked every morning in Hebden Bridge.">
<meta name="theme-color" content="#B5532A">
<meta property="og:image" content="/img/shopfront.jpg">
<meta property="og:image:alt" content="The shop front">
<link rel="stylesheet" href="/css/site.css">
<link rel="stylesheet" href="https://cdn.other.net/lib.css">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Lato&display=swap" rel="stylesheet">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>:root{--brand-primary:#2f4b3a}</style>
<script type="application/ld+json">{"@type":"Bakery","telephone":"+44 1422 555 010","address":{"streetAddress":"3 Fold Lane","addressLocality":"Hebden Bridge","postalCode":"HX7 8AA"},"openingHours":["Tu-Sa 08:00-15:00"]}</script>
<script>var secret = "not text";</script>
</head><body>
<header><img src="/img/logo.svg" alt="Fold Lane Bakery logo" class="site-logo">
<nav><a href="/">Home</a><a href="/menu">Menu</a><a href="/about/">About us</a><a href="https://www.foldlane.co.uk/visit">Visit</a>
<a href="https://evil.example/phish">Elsewhere</a><a href="mailto:hello@foldlane.co.uk">Email</a><a href="/menu.pdf">PDF</a><a href="#top">Top</a></nav></header>
<h1>Bread worth the walk</h1><p>We bake &ldquo;slow&rdquo; sourdough.</p>
<img src="/img/loaves.jpg" alt="Loaves cooling" width="1200" height="800">
<img src="/img/tiny.png" width="16" height="16">
<img src="/img/loaves.jpg" alt="dup">
<img src="data:image/png;base64,AAAA">
<p style="color:#b5532a">Call us on <a href="tel:+441422555010">01422 555010</a></p>
</body></html>`;

const MENU = `<html><head><title>Menu | Fold Lane Bakery</title></head><body><h2>Breads</h2><p>Country loaf £4</p><img src="https://images.cdn.example/croissant.webp" alt="Croissant"></body></html>`;
const ABOUT = `<html><body><h1>About</h1><p>Family bakery since 1998.</p><p>Tuesday to Saturday 8am - 3pm</p></body></html>`;
const CSS = `body{font-family:"Inter", sans-serif;color:#333333} .btn{background:#b5532a} a{color:#b5532a} .x{color:rgb(47,75,58)}`;

function fakeSite(pages, log) {
  return async (url, cap) => {
    log.push({ url, cap });
    const p = pages[url];
    if (!p) return { ok: false, status: 404 };
    return { ok: true, status: 200, contentType: p.ct || "text/html", body: p.body, url: p.url || url };
  };
}

test("router: importSite is a typed field, read only on a build, checked against the message", () => {
  assert.equal(ASK_TOOL.input_schema.properties.importSite.type, "string");
  const reply = (input) => ({ content: [{ type: "tool_use", input }] });
  assert.equal(readRouting(reply({ intent: "build", importSite: "https://foldlane.co.uk" }), {}).importSite, "https://foldlane.co.uk");
  assert.equal(readRouting(reply({ intent: "ask", answer: "hi", importSite: "https://x.co.uk" }), {}).importSite, undefined);
  const msg = "Please rebuild my site foldlane.co.uk but nicer";
  assert.equal(readImportSite("foldlane.co.uk", msg), "https://foldlane.co.uk/");
  assert.equal(readImportSite("https://www.foldlane.co.uk/", msg), "https://www.foldlane.co.uk/");
  assert.equal(readImportSite("https://invented.co.uk/", msg), undefined, "an address the customer did not write is never fetched");
  assert.equal(readImportSite("http://169.254.169.254/", "copy 169.254.169.254"), undefined);
  assert.equal(readImportSite(["https://foldlane.co.uk"], msg), undefined, "a non-string is not coerced");
});

// ── THE ROUTE, end to end in the real Worker ────────────────────────────────
const W = await loadWorkerModule();
const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });
const call = (body, tok = "t") => W.default.fetch(new Request("https://gofarther.dev/api/site/import", {
  method: "POST", headers: { ...(tok ? { Authorization: "Bearer " + tok } : {}), "Content-Type": "application/json" }, body: JSON.stringify(body),
}), {}, { waitUntil() {}, passThroughOnException() {} });
