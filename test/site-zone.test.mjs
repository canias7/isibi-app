// THE SITE ZONE — `<slug>.gofarther.app`.
//
// Most of this file guards ONE property, because it is the one that can take the
// platform down: the Worker route in `wrangler.jsonc` and `SITE_ZONE_LIVE` in
// `site-domains.mjs` must be turned on in the same commit. A route naming a zone
// the Cloudflare account does not hold fails the routes PUT and therefore the
// whole deploy (measured 2026-08-07 on the other zone, three merges lost); the
// flag on with no route hands every customer a link that times out. Neither
// half is safe alone, so both directions are asserted.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OWN_ZONES, APP_ZONE, SITE_ZONE, SITE_ZONE_LIVE,
  isOwnHostname, isAppHostname, siteHostSlug, siteHostFor, siteLabelFor, siteUrlFor, claimRefusal, servedAtRoot } from "../site-domains.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ── the switch ───────────────────────────────────────────────────────────────

test("the wrangler route and SITE_ZONE_LIVE agree, in both directions", () => {
  const w = read("wrangler.jsonc");
  // An UNCOMMENTED route line. The commented instructions in that file contain
  // the same text, so matching the string alone would pass while the route is
  // still off — the exact vacuous-assertion shape this repo keeps recording.
  const live = w.split("\n").some((l) => {
    const s = l.trim();
    return !s.startsWith("//") && s.includes('"zone_name": "' + SITE_ZONE + '"');
  });
  assert.equal(
    live, SITE_ZONE_LIVE,
    live
      ? `wrangler.jsonc routes ${SITE_ZONE} but SITE_ZONE_LIVE is false — sites serve there and nobody is given the address`
      : `SITE_ZONE_LIVE is true but wrangler.jsonc has no route for ${SITE_ZONE} — every pretty link times out`,
  );
});

test("the guard above can actually fail", () => {
  // Proving the matcher is not simply blind to the file. The app zone's route IS
  // uncommented today, so the same test applied to it must come out true — with
  // a broken matcher both answers would be false and the assertion above would
  // pass forever.
  const w = read("wrangler.jsonc");
  const appLive = w.split("\n").some((l) => {
    const s = l.trim();
    return !s.startsWith("//") && s.includes('"zone_name": "' + APP_ZONE + '"');
  });
  assert.equal(appLive, true, "the route matcher no longer sees the app zone's own live route");
});

test("the client's copy of the two constants matches the module", () => {
  // public/chat.js cannot import a Worker module and holds its own copy, so the
  // address the panel prints is a second source of truth. Read both.
  const c = read("public/chat.js");
  const zone = (c.match(/const SITE_ZONE = '([^']+)'/) || [])[1];
  const liveRaw = (c.match(/const SITE_ZONE_LIVE = (true|false)/) || [])[1];
  assert.equal(zone, SITE_ZONE, "public/chat.js names a different site zone");
  assert.equal(liveRaw, String(SITE_ZONE_LIVE), "public/chat.js disagrees about whether the zone is live");
});

// ── what may be claimed ──────────────────────────────────────────────────────

test("the site zone is ours and cannot be claimed as a custom domain", () => {
  assert.ok(OWN_ZONES.includes(SITE_ZONE), "the site zone must be in OWN_ZONES");
  // The apex, a subdomain, and the www — every shape somebody would try. A row
  // saying `sharp-fade.gofarther.app → some-other-slug` is two answers for one
  // hostname, and whichever the lookup finds first wins.
  for (const h of [SITE_ZONE, "www." + SITE_ZONE, "sharp-fade." + SITE_ZONE, "a.b." + SITE_ZONE]) {
    assert.equal(isOwnHostname(h), true, h);
    assert.ok(claimRefusal(h), "must be refused: " + h);
  }
  // …and the near-miss stays claimable by whoever really owns it.
  assert.equal(isOwnHostname("notgofarther.app"), false);
});

test("isAppHostname is the app zone ALONE, which isOwnHostname no longer is", () => {
  assert.equal(isAppHostname(APP_ZONE), true);
  assert.equal(isAppHostname("www." + APP_ZONE), true);
  // The property the mount root depends on. Both are "ours"; only one is the
  // workspace, and conflating them prefixes every asset on the site zone with
  // `/s/<slug>/` on a mount whose root is `/`.
  assert.equal(isOwnHostname("shop." + SITE_ZONE), true);
  assert.equal(isAppHostname("shop." + SITE_ZONE), false);
});

// ── the hostname ↔ slug mapping ──────────────────────────────────────────────

test("a one-label subdomain resolves to its slug", () => {
  assert.equal(siteHostSlug("sharp-fade." + SITE_ZONE), "sharp-fade");
  assert.equal(siteHostSlug("SHARP-FADE." + SITE_ZONE.toUpperCase()), "sharp-fade");
  assert.equal(siteHostSlug("cafe123." + SITE_ZONE + "."), "cafe123");  // root dot
});

test("everything that is not one ordinary site label answers null", () => {
  for (const h of [
    SITE_ZONE,                    // the apex is the zone, not a site
    "www." + SITE_ZONE,           // reserved
    "api." + SITE_ZONE,           // reserved
    "a.b." + SITE_ZONE,           // TWO labels: no wildcard certificate exists
    "-shop." + SITE_ZONE,         // not a legal DNS label
    "shop-." + SITE_ZONE,
    "." + SITE_ZONE,
    "shop." + APP_ZONE,           // the other zone entirely
    "shop.gofarther.app.evil.com",
    "gofarther.app.evil.com",     // suffix that only LOOKS like ours
    "", null, undefined,
  ]) {
    assert.equal(siteHostSlug(h), null, String(h));
  }
});

test("siteHostFor is the inverse of siteHostSlug", () => {
  // Two functions that disagree about which hostname belongs to which site is a
  // link the panel prints and the router does not recognise.
  for (const slug of ["sharp-fade", "cafe123", "a", "x".repeat(60)]) {
    const host = siteHostFor(slug);
    if (SITE_ZONE_LIVE) {
      assert.equal(host, slug + "." + SITE_ZONE, slug);
      assert.equal(siteHostSlug(host), slug, slug);
    } else {
      assert.equal(host, null, "dark zone offers no pretty host: " + slug);
    }
  }
});

test("a slug that cannot be a DNS label gets no pretty host", () => {
  // AGAINST `siteLabelFor`, NOT `siteHostFor`, and that is the whole point of
  // the split. Asserted through `siteHostFor` while the zone is dark, every one
  // of these passes because the flag returns null first — a mutation deleting
  // the label rules outright survived the entire suite. This drives the rules.
  //
  // The build filter permits `-shop` and `shop-`; DNS does not. Such a site
  // keeps `/s/<slug>/` and loses nothing — offering an address that cannot
  // resolve would be worse than offering none.
  for (const bad of ["-shop", "shop-", "", "x".repeat(64), "www", "api", "a.b", null, undefined]) {
    assert.equal(siteLabelFor(bad), null, String(bad));
  }
  // …and a good one really does come back, or the loop above proves nothing.
  assert.equal(siteLabelFor("sharp-fade"), "sharp-fade." + SITE_ZONE);
  // The flag is the only difference between the two functions.
  assert.equal(siteHostFor("sharp-fade"), SITE_ZONE_LIVE ? "sharp-fade." + SITE_ZONE : null);
});

test("siteUrlFor always returns a URL that works", () => {
  const u = siteUrlFor("sharp-fade", "https://" + APP_ZONE);
  assert.ok(u.startsWith("https://"), u);
  assert.equal(u.endsWith("/"), true, "the trailing slash is what makes relative assets load: " + u);
  if (SITE_ZONE_LIVE) assert.equal(u, "https://sharp-fade." + SITE_ZONE + "/");
  else assert.equal(u, "https://" + APP_ZONE + "/s/sharp-fade/");
  // A slug with no pretty host falls back rather than returning nothing.
  assert.equal(siteUrlFor("-shop", "https://" + APP_ZONE), "https://" + APP_ZONE + "/s/-shop/");
});

// ── the Worker ───────────────────────────────────────────────────────────────

test("the mount root asks isAppHostname, never isOwnHostname", () => {
  const w = read("worker.js");
  const i = w.indexOf("const mountRoot =");
  assert.ok(i > 0, "the mount-root line is gone");
  const line = w.slice(i, w.indexOf("\n", i));
  assert.match(line, /isAppHostname\(url\.hostname\)/, line);
  assert.doesNotMatch(
    line, /isOwnHostname/,
    "isOwnHostname covers both zones, so this would mount every site on the site zone under /s/<slug>/ and 404 every asset",
  );
});

test("the site zone is rewritten to /s/<slug>/ and root paths are left alone", () => {
  // THE EXCLUSION IS ASSERTED THROUGH `servedAtRoot`, NOT BY ITS SPELLING. This
  // test was pinned to the literal `!url.pathname.startsWith("/api/")` and so
  // described one member of a list rather than the rule — it passed for the whole
  // time `/u/` was missing from that list, which broke every uploaded image on
  // every pretty hostname. Assert the property, not the spelling.
  const w = read("worker.js");
  const i = w.indexOf("const zoneSlug = siteHostSlug(url.hostname);");
  assert.ok(i > 0, "the site-zone rewrite is gone from worker.js");
  const block = w.slice(i, i + 900);
  assert.match(block, /if \(zoneSlug && !servedAtRoot\(url\.pathname\)\)/,
    "a published bundle calls its own API and loads its own uploads same-origin; rewriting either breaks them");
  assert.match(block, /url\.pathname = "\/s\/" \+ zoneSlug \+/);
  // And the predicate really does answer for both, so the line above is not just
  // a well-named function that excludes nothing.
  assert.equal(servedAtRoot("/api/db/x/data/y"), true);
  assert.equal(servedAtRoot("/u/x/y.jpg"), true);
});

test("the site zone's rewrite is decided BEFORE the custom-domain lookup", () => {
  // Not style. `isOwnHostname` is true for the site zone, so the custom-domain
  // branch skips it — reaching that branch first would mean a `.app` host falls
  // through to the app instead of to its site. Both anchors are proved to exist
  // first: `indexOf(a) < indexOf(b)` passes vacuously when `a` is the thing
  // somebody deleted.
  const w = read("worker.js");
  const a = w.indexOf("const zoneSlug = siteHostSlug(url.hostname);");
  const b = w.indexOf("const mapped = await siteForHostname(env, url.hostname);");
  assert.ok(a > 0, "the site-zone rewrite is missing");
  assert.ok(b > 0, "the custom-domain lookup is missing");
  assert.ok(a < b, "the site-zone rewrite must come first");
});

test("the site zone's apex redirects to the app rather than serving it", () => {
  const w = read("worker.js");
  const i = w.indexOf("isOwnHostname(url.hostname) && !isAppHostname(url.hostname)");
  assert.ok(i > 0, "the apex branch is gone");
  // TO A LANDMARK, NEVER A BYTE COUNT. A window of N characters stops covering
  // what it was written for the moment somebody adds a comment above the code —
  // which is what happened here on the first run, and is the recurring bug in
  // this repo's source-reading guards. The next branch is the real end.
  const end = w.indexOf("if (!isOwnHostname(url.hostname) &&", i + 10);
  assert.ok(end > i, "the custom-domain branch that ends this block is gone");
  const block = w.slice(i, end);
  assert.match(block, /Response\.redirect\("https:\/\/" \+ APP_ZONE/,
    "the bare site zone must go to the workspace, not serve a second copy of it");
  assert.match(block, /!url\.pathname\.startsWith\("\/api\/"\)/,
    "a 301 on a POST is followed inconsistently, so /api/ must not be redirected");
});

test("og:url is the public address, not a hardcoded one", () => {
  const w = read("worker.js");
  assert.doesNotMatch(
    w, /url: "https:\/\/gofarther\.dev\/s\/"/,
    "a link preview must show the address a customer would hand out, and that moves with the zone",
  );
  assert.match(w, /url: siteUrlFor\(/);
});

// ── the setup path ───────────────────────────────────────────────────────────

test("the setup script exists and refuses to overwrite records it did not make", () => {
  const s = read(".github/scripts/site-zone-setup.mjs");
  assert.match(s, /REFUSED/, "it must refuse a pre-existing record rather than replacing it");
  assert.match(s, /content: "100::"|"100::"/, "the originless placeholder is Cloudflare's own");
  assert.match(s, /proxied: true/, "grey-clouded, 100:: is dialled directly and every site times out");
  // Apply is opt-in: it edits DNS on a live zone.
  assert.match(s, /const APPLY = process\.argv\.includes\("--apply"\)/);
  const wf = read(".github/workflows/site-zone-setup.yml");
  assert.match(wf, /default: false/, "the workflow must default to a dry run");
});

/* ------------------------------------------ uploads are served at the ROOT */

test("servedAtRoot covers the paths a pretty-hostname rewrite must not touch", () => {
  // `/u/<slug>/<file>` carries its own slug and is matched at the root, so
  // prefixing it with /s/<slug>/ produces a path no route matches. Measured live
  // 2026-08-09: a real uploaded photograph 404'd on forno-and-co.gofarther.app
  // and served 200 on gofarther.dev/s/forno-and-co/ — every image on every site
  // broken on the only address anybody shares.
  assert.equal(servedAtRoot("/u/forno-and-co/fbcf391f450fc6c91ed1ebf1d0cb7002.jpg"), true);
  assert.equal(servedAtRoot("/api/db/x/data/menu_items"), true);
  // …and NOT the site's own pages or assets, which is the whole point of the rewrite.
  assert.equal(servedAtRoot("/"), false);
  assert.equal(servedAtRoot("/book"), false);
  assert.equal(servedAtRoot("/assets/index-CWtgw2v9.js"), false);
  // ANCHORED AT THE START, and a mutation proved this needed saying. Written
  // with `includes`, every one of these stops being rewritten to its site and
  // 404s — and `/docs/api/reference` is an ordinary page for exactly the kind of
  // software company this platform builds for, not a contrived string.
  assert.equal(servedAtRoot("/uploads"), false);
  assert.equal(servedAtRoot("/users"), false);
  assert.equal(servedAtRoot("/apis"), false);
  assert.equal(servedAtRoot("/docs/api/reference"), false);
  assert.equal(servedAtRoot("/help/u/guide"), false);
  assert.equal(servedAtRoot("/menu#api/x"), false);
  assert.equal(servedAtRoot(""), false);
  assert.equal(servedAtRoot(undefined), false);
});

test("BOTH pretty-hostname rewrites ask the one question", () => {
  // The site-zone branch and the custom-domain branch had a copy of this
  // exclusion each and only ever agreed by coincidence — which is how /u/ ended
  // up excluded from neither. Two lists of the same paths is the failure this
  // codebase keeps recording, so the guard is that there is only one.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const zone = /if \(zoneSlug && !servedAtRoot\(url\.pathname\)\)/.test(src);
  const custom = /if \(!isOwnHostname\(url\.hostname\) && !servedAtRoot\(url\.pathname\)\)/.test(src);
  assert.ok(zone, "the site-zone rewrite does not use the shared predicate");
  assert.ok(custom, "the custom-domain rewrite does not use the shared predicate");
  // And neither may go back to its own hand-written copy.
  assert.doesNotMatch(src, /if \(zoneSlug && !url\.pathname\.startsWith\("\/api\/"\)\)/);
  assert.doesNotMatch(src, /if \(!isOwnHostname\(url\.hostname\) && !url\.pathname\.startsWith\("\/api\/"\)\)/);
});
