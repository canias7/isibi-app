// The composed share card (2026-08-28, owner's call: "ok build it").
//
// `site-card.mjs` composes the strings and is driven directly; everything
// else here is the WIRING — the container's compose step, the worker's
// og:image fallback, the payload hops — which is the layer twelve features
// have died in, one silent link at a time, with the module itself fine every
// single time.

import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { cardHtml, cardColors, CARD_W, CARD_H } from "../builder/site-card.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
const render = fs.readFileSync(new URL("../builder/render-check.mjs", import.meta.url), "utf8");
const docker = fs.readFileSync(new URL("../builder/Dockerfile", import.meta.url), "utf8");

// Comments here spell the things being asserted (the prose-contains-the-
// spelling trap, nine-plus recorded instances), so source scans run over a
// length-preserving blank of the whole-line comments.
const blank = (src) => src.replace(/^\s*(?:\/\/|#)[^\n]*$/gm, (m) => " ".repeat(m.length));

/** A window from a landmark to another landmark — never a byte count. */
function windowOf(src, from, to) {
  const a = src.indexOf(from);
  assert.ok(a >= 0, "anchor missing: " + from);
  const b = src.indexOf(to, a);
  assert.ok(b > a, "closing landmark missing: " + to);
  return src.slice(a, b);
}

/* ── the module ──────────────────────────────────────────────────────────── */

test("the card is the size every unfurler wants, pinned outright", () => {
  // Pinned rather than derived (the RESUME_MAX_REFIRES lesson): 1200×630 is
  // the documented og:image size for WhatsApp, iMessage, Slack, Facebook and
  // X alike, and a derived assertion would move with a mistaken edit.
  assert.equal(CARD_W, 1200);
  assert.equal(CARD_H, 630);
});

test("the name and the description are ESCAPED — they are model and customer text landing in markup", () => {
  const h = cardHtml({ title: '<script>alert(1)</script>', description: 'a "quote" & <b>tag</b>' });
  assert.ok(!h.includes("<script"), "the title reached the card as live markup");
  assert.ok(!h.includes("<b>tag"), "the description reached the card as live markup");
  assert.ok(h.includes("&lt;script&gt;"), "the title was dropped rather than escaped");
});

test("the description is clamped and an absent one renders nothing", () => {
  const long = "x".repeat(1000);
  const h = cardHtml({ title: "T", description: long });
  assert.ok(!h.includes("x".repeat(230)), "a 1000-character description reached the card whole");
  const bare = cardHtml({ title: "T" });
  assert.ok(!/-webkit-line-clamp:3/.test(bare), "an empty description still renders its block");
});

test("a long name gets a smaller size, so it is not clipped mid-word", () => {
  const short = cardHtml({ title: "Forno" });
  const long = cardHtml({ title: "The Very Long Business Name Of A Shop That Kept Growing And Growing" });
  assert.match(short, /font-size:96px/);
  assert.match(long, /font-size:52px/);
});

test("a drawn wordmark rides as a data: URI image at its own aspect; without one the name is set in type", () => {
  const wm = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64"><rect width="240" height="64"/></svg>';
  const withWm = cardHtml({ title: "Markbook", wordmarkSvg: wm });
  assert.match(withWm, /src="data:image\/svg\+xml;base64,/, "the wordmark is not on the card");
  assert.ok(!withWm.includes(">Markbook<"), "the name is printed BESIDE the wordmark — most marks already contain it");
  const noWm = cardHtml({ title: "Markbook" });
  assert.ok(noWm.includes("Markbook"), "with no wordmark the card lost the name too");
  assert.ok(!noWm.includes("data:image"), "an absent wordmark still rendered an image");
});

test("cardColors: the theme's light half, as rgb(); overrides only through isColor", () => {
  // A real registry-shaped theme: OKLCH triples.
  const theme = { light: { paper: [0.97, 0.005, 90], ink: [0.2, 0.01, 60], accent: [0.5, 0.15, 30] } };
  const c = cardColors(theme, null);
  assert.match(c.paper, /^rgb\(\d+,\d+,\d+\)$/);
  assert.match(c.ink, /^rgb\(\d+,\d+,\d+\)$/);
  // No theme at all → the template's own defaults, never a throw.
  const d = cardColors(null, null);
  assert.equal(d.paper, "#ffffff");
  // A skew-era token patch overrides — and ONLY through isColor, because the
  // value lands in a style attribute of markup this module composes: a `;}`
  // would close the declaration and the rule.
  const o = cardColors(theme, { background: "#101418", foreground: "#f0f0ee" });
  assert.equal(o.paper, "#101418");
  assert.equal(o.ink, "#f0f0ee");
  const bad = cardColors(theme, { background: "red;}</div><script>x()</script>" });
  assert.equal(bad.paper, c.paper, "an unparseable token value reached the card's markup");
  assert.ok(!JSON.stringify(bad).includes("script"), "the junk value survived somewhere");
});

/* ── the container: composes on every build, best-effort ─────────────────── */

test("the container composes the card into the dist it is about to publish", () => {
  const s = blank(server);
  const w = windowOf(s, "let cardMade = false;", "const dist = collectDist(CLIENT_DIST);");
  // Written INTO dist/client, so collectDist publishes it and the per-build
  // DIST wipe makes a cross-build leak impossible by construction.
  assert.match(w, /fs\.writeFileSync\(path\.join\(CLIENT_DIST, "card\.png"\), shot\)/,
    "the card is not written where collectDist can publish it");
  // The browser drive goes through render-check's helper — build-server may
  // not `import(` anything at runtime (render-sandbox's boundary).
  assert.match(w, /await screenshotHtml\(html, \{ width: CARD_W, height: CARD_H \}\)/,
    "the compose is not rasterised at the pinned size");
  // Reported only once the bytes are down — the favicon's own rule, and the
  // wrong-occurrence lesson: the anchor is the ASSIGNMENT only the success
  // path has, not the `let … = false` declaration above it.
  const wrote = w.indexOf('path.join(CLIENT_DIST, "card.png")');
  const made = w.indexOf("cardMade = true;");
  assert.ok(wrote >= 0 && made > wrote, "the card is reported before the bytes are down");
  // BEST-EFFORT: the catch logs and never rethrows — a site whose data layer
  // is live must not be lost over a decoration.
  const after = s.slice(s.indexOf("let cardMade = false;"), s.indexOf("const dist = collectDist(CLIENT_DIST);"));
  const catchAt = after.indexOf("} catch (e) {");
  assert.ok(catchAt > 0, "the compose has no catch at all — a browser failure fails the build");
  assert.ok(!/\bthrow\b/.test(after.slice(catchAt)), "the compose catch rethrows — a browser failure fails the build");
  // …and the response says whether it happened, because a silent compose
  // failure reads exactly like the feature switched off.
  assert.match(s, /card: cardMade,/, "the response does not carry the card verdict");
});

test("the card reads THIS build's own theme, description and wordmark", () => {
  const s = blank(server);
  const w = windowOf(s, "let cardMade = false;", "const dist = collectDist(CLIENT_DIST);");
  assert.match(w, /cardColors\(resolveTheme\(payload\.theme\), payload\.tokens\)/,
    "the card is not painted with the site's own theme");
  assert.match(w, /description: payload\.description/,
    "the card has no sentence — the payload's description never reaches it");
  // The wordmark is read out of THIS build's dist (wiped per build), gated on
  // the report that says this build drew one — public/ would reopen the
  // staleness question the dist wipe closes.
  assert.match(w, /path\.join\(CLIENT_DIST, "logo\.svg"\)/,
    "the wordmark is read from somewhere a previous build could have written");
  assert.match(w, /brandUsed\.wordmark && fs\.existsSync\(wmPath\)/,
    "the wordmark read is not gated on this build having drawn one");
});

test("the rasteriser lives in render-check, launches through the shared launcher, and always closes", () => {
  const r = blank(render);
  const w = windowOf(r, "export async function screenshotHtml(", "\nexport ");
  assert.match(w, /await launchChromium\(chromium\)/, "the card's browser skips the sandbox-verdict launcher");
  assert.match(w, /finally \{ await browser\.close\(\); \}/,
    "a failed screenshot leaks a browser process in a container that serves every build");
  // setContent, never goto: the card is a self-contained document with nothing
  // external to fetch, and a served page would put a server on this path.
  assert.match(w, /page\.setContent\(/, "the card is fetched rather than set");
});

/* ── the worker: the fallback, under the person ──────────────────────────── */

test("siteOgImage: an owner upload first, then the composed card, never a visitor's file", () => {
  const at = worker.indexOf("async function siteOgImage(");
  assert.ok(at > 0, "siteOgImage is gone");
  const body = worker.slice(at, worker.indexOf("\nasync function ", at + 10));
  // The card URL exists and keys on the dist being published RIGHT NOW.
  assert.match(body, /dist && dist\["card\.png"\]/, "the fallback does not key on the published dist");
  assert.match(body, /\/card\.png"/, "the fallback does not point at the card's address");
  // PRECEDENCE: the upload return comes after the `.find`, and the card is
  // returned only when no owner upload exists — a person first, at every
  // surface (the logo's rule).
  const find = body.indexOf("objs.find((o) => o && !o.visitor)");
  const cardReturn = body.indexOf("if (!first) return card;");
  const uploadReturn = body.indexOf('"/u/" + slug');
  assert.ok(find > 0 && cardReturn > find && uploadReturn > cardReturn,
    "the composed card outranks the owner's own picture, or a visitor's upload is back in the running");
  // Positions cannot see an INSERTED early `return card` (a "simplification"
  // that hands the card the win while every ordering above stays green), so
  // the region before the `.find` is counted: exactly ONE `return card` may
  // precede it — the bucketless exit, which has no uploads to prefer.
  assert.equal((body.slice(0, find).match(/return card;/g) || []).length, 1,
    "something returns the card before the owner's uploads are even looked at");
  // A failed upload LISTING degrades TO the card, not past it: the site with a
  // working card must not lose it to an R2 blip.
  const catchAt = body.indexOf("catch (e)");
  assert.ok(catchAt > 0 && /return card;/.test(body.slice(catchAt)),
    "an upload-listing failure loses the composed card too");
  // And with no bucket at all the card still answers — the card is IN the dist
  // being handed over, so the bucket has nothing to do with it.
  assert.match(body, /if \(!env\.SITES_BUCKET\) return card;/,
    "a bucketless environment loses the card the build just composed");
});

test("the description rides every container payload the icon rides", () => {
  // Derived from the same hops the favicon and wordmark guards key on: every
  // owner-icon hop is a container payload, and a payload without the
  // description composes a card with the name and no sentence — on the spine,
  // that is every text fix republishing a thinner card than the build made.
  const w = blank(worker);
  const hops = [...w.matchAll(/icon: icon \|\| "",/g)];
  assert.ok(hops.length >= 2, "the icon hops moved — re-anchor this");
  for (const h of hops) {
    assert.match(w.slice(h.index, h.index + 1600), /description: /,
      "a container payload carries the icon and not the description");
  }
});

/* ── the image: a screenshot of TEXT needs font files ────────────────────── */

test("the container image installs real fonts, or every card is tofu", () => {
  // `--no-install-recommends` means chromium arrives with NO font files, and
  // the harness cannot see it — it runs build-server outside the image. The
  // apt line is the only guard there is. Matched in the blanked source so the
  // comment explaining this cannot satisfy it (the `--no-save` trap).
  const d = blank(docker);
  const run = windowOf(d, "RUN apt-get update", "rm -rf /var/lib/apt/lists");
  assert.match(run, /fonts-liberation/, "the Latin floor is gone — cards render as tofu in production");
  assert.match(run, /fonts-noto-core/, "the non-Latin floor is gone — a Greek or Arabic name renders as tofu");
  // And the module ships in the image — the guard that has caught a missing
  // COPY twice before this.
  assert.match(d, /site-card\.mjs/, "site-card.mjs is not COPY'd — the build service cannot start");
});
