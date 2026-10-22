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
} from "../builder/site-import.mjs";
import { ASK_TOOL, readRouting } from "../builder/site-ask.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";

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

test("extraction: name, description, pages, contact, hours, colours, fonts, logo, photos", () => {
  const x = extractSite([
    { url: "https://foldlane.co.uk/", html: HOME },
    { url: "https://foldlane.co.uk/menu", html: MENU },
  ], [CSS]);
  assert.equal(x.name, "Fold Lane Bakery");
  assert.equal(x.description, "Sourdough & pastries baked every morning in Hebden Bridge.");
  assert.deepEqual(x.pages.map((p) => p.path), ["/", "/menu"]);
  assert.ok(x.pages[0].headings.includes("Bread worth the walk"));
  assert.match(x.pages[0].text, /We bake “slow” sourdough\./);
  assert.ok(!/not text/.test(x.pages[0].text), "script text is not page text");
  assert.ok(x.contact.phones.includes("+44 1422 555 010"));
  assert.ok(x.contact.emails.includes("hello@foldlane.co.uk"));
  assert.equal(x.contact.address, "3 Fold Lane, Hebden Bridge, HX7 8AA");
  assert.deepEqual(x.hours, ["Tu-Sa 08:00-15:00"]);
  assert.equal(x.colours[0], "#b5532a", "theme-color first");
  assert.ok(x.colours.includes("#2f4b3a"), "the brand custom property");
  assert.ok(x.colours.indexOf("#333333") > x.colours.indexOf("#2f4b3a"), "neutrals last");
  assert.deepEqual(x.fonts.slice(0, 3), ["Playfair Display", "Lato", "Inter"]);
  assert.equal(x.logo.url, "https://foldlane.co.uk/img/logo.svg");
  assert.deepEqual(x.photos.map((p) => p.url), [
    "https://foldlane.co.uk/img/shopfront.jpg",
    "https://foldlane.co.uk/img/loaves.jpg",
    "https://images.cdn.example/croissant.webp",
  ], "og:image, then large images, deduped; icons, data: and the logo left out");
  assert.equal(x.photos[0].alt, "The shop front");
});

test("helpers: title name, hours from text, logo fallback, photo cap", () => {
  assert.equal(businessName("<title>Welcome - Harbourside Roast</title>"), "Harbourside Roast");
  assert.equal(businessName('<meta property="og:site_name" content="Oak &amp; Ash">'), "Oak & Ash");
  assert.deepEqual(openingHours("", "Tuesday to Saturday 8am - 3pm\nnothing here"), ["Tuesday to Saturday 8am - 3pm"]);
  assert.deepEqual(findLogo('<link rel="apple-touch-icon" href="/t.png">', "https://a.co.uk/"), { url: "https://a.co.uk/t.png", alt: "" });
  const many = Array.from({ length: 30 }, (_, i) => `<img src="/p${i}.jpg">`).join("");
  assert.equal(findPhotos(many, "https://a.co.uk/").length, MAX_PHOTOS);
  assert.deepEqual(contactDetails("", "write to a@b.co.uk").emails, ["a@b.co.uk"]);
  assert.deepEqual(brandColours('<div style="color:#abc">'), ["#aabbcc"]);
  assert.deepEqual(fontFamilies("<style>h1{font-family:Arial, sans-serif}</style>"), [], "generic stacks are not a brand font");
});

test("text is capped per page", () => {
  const big = "<body><p>" + "word ".repeat(5000) + "</p></body>";
  const x = extractSite([{ url: "https://a.co.uk/", html: big }]);
  assert.equal(x.pages[0].text.length, MAX_PAGE_TEXT);
  assert.equal(x.pages[0].cut, true);
});

test("SSRF guard: only public http(s) hosts, no credentials", () => {
  for (const bad of ["http://127.0.0.1/", "http://localhost/", "http://10.0.0.5/", "http://192.168.1.1/", "http://169.254.169.254/latest",
    "http://[::1]/", "file:///etc/passwd", "ftp://a.co.uk/", "javascript:alert(1)", "https://user:pw@a.co.uk/", "http://0x7f000001/"]) {
    assert.equal(publicUrl(bad), null, bad);
  }
  assert.equal(publicUrl("https://foldlane.co.uk/x#y").href, "https://foldlane.co.uk/x");
});

test("same host: nav links stay on the site, files and other hosts left out, capped", () => {
  assert.equal(sameSite("https://www.a.co.uk/x", "http://a.co.uk/"), true);
  assert.equal(sameSite("https://a.co.uk.evil.net/", "https://a.co.uk/"), false);
  const links = navLinks(HOME, "https://foldlane.co.uk/");
  assert.deepEqual(links, ["https://foldlane.co.uk/menu", "https://foldlane.co.uk/about/", "https://www.foldlane.co.uk/visit"]);
  const many = "<nav>" + Array.from({ length: 20 }, (_, i) => `<a href="/p${i}">p</a>`).join("") + "</nav>";
  assert.equal(navLinks(many, "https://a.co.uk/").length, MAX_PAGES - 1);
});

function fakeSite(pages, log) {
  return async (url, cap) => {
    log.push({ url, cap });
    const p = pages[url];
    if (!p) return { ok: false, status: 404 };
    return { ok: true, status: 200, contentType: p.ct || "text/html", body: p.body, url: p.url || url };
  };
}

test("importSite: fetches the home page, its menu pages and same-site CSS only, with caps", async () => {
  const log = [];
  const got = await importSite("https://foldlane.co.uk/", {
    fetchText: fakeSite({
      "https://foldlane.co.uk/": { body: HOME },
      "https://foldlane.co.uk/menu": { body: MENU },
      "https://foldlane.co.uk/about/": { body: ABOUT },
      "https://www.foldlane.co.uk/visit": { body: "<body><p>Off site now</p></body>", url: "https://evil.example/visit" },
      "https://foldlane.co.uk/css/site.css": { body: CSS, ct: "text/css" },
    }, log),
  });
  assert.equal(got.ok, true);
  const asked = log.map((l) => l.url);
  assert.ok(!asked.some((u) => /evil\.example|cdn\.other\.net|fonts\.googleapis/.test(u)), "no other host fetched: " + asked.join(" "));
  assert.deepEqual(got.extract.pages.map((p) => p.path), ["/", "/menu", "/about/"], "a page redirected off the site is dropped");
  assert.ok(got.extract.fonts.includes("Inter"), "the linked stylesheet was read");
  assert.ok(log.every((l) => Number.isFinite(l.cap) && l.cap > 0 && l.cap <= 1_500_000), "every fetch is capped");
});

test("importSite refuses private addresses without fetching, and says why a site can't be read", async () => {
  const log = [];
  const r = await importSite("http://127.0.0.1/", { fetchText: fakeSite({}, log) });
  assert.equal(r.ok, false);
  assert.equal(log.length, 0);
  assert.equal((await importSite("https://gone.co.uk/", { fetchText: fakeSite({}, log) })).reason, "that page wasn't there");
  assert.equal((await importSite("https://img.co.uk/", { fetchText: fakeSite({ "https://img.co.uk/": { body: "x", ct: "image/png" } }, []) })).reason, "that address isn't a web page");
  assert.equal((await importSite("https://t.co.uk/", { fetchText: async () => { throw new Error("boom"); } })).ok, false, "never throws");
});

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

test("the brief block: THEIR CURRENT SITE with text, pages, colours, fonts and picture ids", () => {
  const x = extractSite([{ url: "https://foldlane.co.uk/", html: HOME }, { url: "https://foldlane.co.uk/menu", html: MENU }], [CSS]);
  const b = importBriefBlock(x);
  assert.match(b, /^\n\nTHEIR CURRENT SITE \(https:\/\/foldlane\.co\.uk\/\)/);
  assert.match(b, /THE DESIGN IS OURS/);
  assert.match(b, /Business name: Fold Lane Bakery/);
  assert.match(b, /Brand colours, most telling first: #b5532a/);
  assert.match(b, /Fonts: Playfair Display, Lato/);
  assert.match(b, /PAGE \/menu — "Menu \| Fold Lane Bakery"/);
  assert.match(b, /Country loaf £4/);
  assert.match(b, /imported-logo — their logo/);
  assert.match(b, /imported-1 — a photograph \("The shop front"\)/);
  assert.equal(importBriefBlock(null), "");
});

test("pictures: only placed ones are copied, as owner uploads; bad types, caps and refusals are said", async () => {
  const x = extractSite([{ url: "https://foldlane.co.uk/", html: HOME }]);
  const ids = importedImages(x).map((i) => i.id);
  assert.deepEqual(ids, ["imported-logo", "imported-1", "imported-2"]);
  const fetched = [], stored = [];
  const bytes = { "https://foldlane.co.uk/img/shopfront.jpg": ["image/jpeg", 100], "https://foldlane.co.uk/img/loaves.jpg": ["image/jpeg", MAX_IMAGE_BYTES], "https://foldlane.co.uk/img/logo.svg": ["image/svg+xml", 10] };
  const r = await placeImportedPhotos([
    { page: "/", describe: "shop", attached: "imported-1" },
    { page: "/about", describe: "shop again", attached: "imported-1" },
    { page: "/", describe: "loaves", attached: "imported-2" },
    { page: "/", describe: "logo", attached: "imported-logo" },
    { page: "/", describe: "made up", attached: "imported-9" },
    { page: "/", describe: "drawn" },
    { page: "/", describe: "theirs", attached: "attachment-0" },
  ], x, {
    fetchBytes: async (u, cap) => { fetched.push(u); assert.equal(cap, MAX_IMAGE_BYTES); const b = bytes[u]; return b ? { ok: true, contentType: b[0], bytes: new Uint8Array(b[1]) } : { ok: false }; },
    store: async (name, b) => { stored.push(name); return { url: "/u/foldlane/" + name }; },
  });
  assert.deepEqual(stored, ["imported-1.jpg"], "stored once though placed twice");
  assert.equal(fetched.filter((u) => u.endsWith("shopfront.jpg")).length, 1);
  assert.deepEqual(r.placed.map((p) => p.page), ["/", "/about"]);
  assert.deepEqual(r.missing.map((m) => m.reason), ["it's too large", "it isn't a photo we can use", "no picture from your old site has that id"]);
  assert.deepEqual(r.images.map((e) => e.describe), ["shop", "shop again", "drawn", "theirs"], "an attached file and a drawn picture pass through");
  assert.equal(r.images[0].src, "/u/foldlane/imported-1.jpg");
});

// ── THE ROUTE, end to end in the real Worker ────────────────────────────────
const W = await loadWorkerModule();
const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });
const call = (body, tok = "t") => W.default.fetch(new Request("https://gofarther.dev/api/site/import", {
  method: "POST", headers: { ...(tok ? { Authorization: "Bearer " + tok } : {}), "Content-Type": "application/json" }, body: JSON.stringify(body),
}), {}, { waitUntil() {}, passThroughOnException() {} });

test("route: signed out is refused and nothing is fetched", async () => {
  const asked = [];
  globalThis.fetch = async (u) => { asked.push(String(u)); return new Response("{}", { status: 401 }); };
  const r = await call({ url: "https://foldlane.co.uk/" }, "");
  assert.equal(r.status, 401);
  assert.equal(asked.length, 0);
});

test("route: signed in reads the site; a private address is refused before any fetch of it", async () => {
  const asked = [];
  globalThis.fetch = async (u) => {
    const s = String(u);
    asked.push(s);
    if (s.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "u1" }), { status: 200 });
    if (s.includes("/rpc/use_quota")) return new Response("true", { status: 200 });
    if (s === "https://foldlane.co.uk/") return new Response(HOME, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    return new Response("nope", { status: 404 });
  };
  const ok = await call({ url: "https://foldlane.co.uk/" });
  assert.equal(ok.status, 200);
  const j = await ok.json();
  assert.equal(j.extract.name, "Fold Lane Bakery");
  assert.ok(!asked.some((u) => /evil\.example/.test(u)));
  asked.length = 0;
  const bad = await call({ url: "http://10.0.0.1/admin" });
  assert.equal(bad.status, 400);
  assert.ok(!asked.some((u) => u.includes("10.0.0.1")));
});
