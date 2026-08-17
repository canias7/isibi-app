// THE PUBLISH-TIME HALF OF A SITE'S HEAD, and the one key that carries it.
//
// `injectMeta` used to patch the description, the share image and the SEO
// manifest into a built shell. Under TanStack Start there is no shell — the
// document is `__root.tsx` rendered per request — so the platform writes them to
// a sidecar in R2 and the site's own Worker reads them back.
//
// THAT MAKES THE KEY A SEAM BETWEEN TWO SEPARATELY-BUILT PROGRAMS, and the
// failure mode is silent: a mismatch reads as a site whose designer wrote no
// description, not as an error. The template cannot import `site-meta.mjs` (it
// is built on its own), so this holds the two spellings together.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { siteMetaKey, SITE_LIVE_FILE } from "../site-meta.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const ENTRY = fs.readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");

test("the key is one expression, and the template's copy agrees with it", () => {
  assert.equal(siteMetaKey("fold-coffee"), "sitemeta/fold-coffee.json");
  // Driven through the real function rather than restating the string, then
  // matched against how the entry BUILDS it — so neither side can be corrected
  // without the other going red.
  const built = /"(sitemeta\/)"\s*\+\s*SITE_SLUG\s*\+\s*"(\.json)"/.exec(ENTRY);
  assert.ok(built, "the site's Worker no longer builds the meta key from its slug");
  assert.equal(built[1] + "fold-coffee" + built[2], siteMetaKey("fold-coffee"),
    "the template and the platform disagree about where a site's meta lives — " +
    "which reads as a site with no description, never as an error");
});

test("OUTSIDE the served prefix, and outside what the publish sweep wipes", () => {
  // Two separate hazards and one line answers both. Under `sites/<slug>/` this
  // file would be fetchable at `/site-meta.json` — a file the site never meant
  // to publish — AND `deleteSitePrefix` would remove the thing every request
  // reads on the next publish of the very site that depends on it.
  const key = siteMetaKey("x");
  assert.ok(!key.startsWith("sites/"), "the meta sidecar is inside the served, swept prefix");
  assert.match(key, /^[a-z]+\//, "the sidecar has no prefix of its own to keep it out of the way");
});

test("the publish WRITES it and reads the previous one from the same place", () => {
  // The redirect map is derived by DIFFING against the previous publish, so the
  // reader and the writer must agree or every accumulated redirect is lost on
  // the first publish after this lands — a hard 404 for every address that was
  // 301ing a moment earlier.
  assert.match(WORKER, /const po = await env\.SITES_BUCKET\.get\(siteMetaKey\(slug\)\)/,
    "the previous manifest is no longer read from the sidecar");
  assert.match(WORKER, /await env\.SITES_BUCKET\.put\(siteMetaKey\(slug\)/,
    "the publish no longer writes the sidecar — every site would lose its share tags");
});

test("A FAILURE COSTS THE SHARE TAGS, NEVER THE PUBLISH", () => {
  // Every field in here is decoration on a document that renders perfectly
  // without it. Failing a publish over a preview card would trade a working site
  // for a link preview, which is the wrong way round — the same rule the theme
  // and font writers already live under.
  const at = WORKER.indexOf("await env.SITES_BUCKET.put(siteMetaKey(slug)");
  assert.ok(at > 0, "the sidecar write moved — rescope this");
  const open = WORKER.lastIndexOf("try {", at);
  const win = WORKER.slice(open, WORKER.indexOf("\n", WORKER.indexOf("catch", at)));
  assert.match(win, /catch \(e\) \{ console\.error\("site meta sidecar failed:"/,
    "the sidecar write is not fenced — a share tag can fail a customer's publish");
});

test("DELETING A SITE TAKES IT WITH THEM", () => {
  // Keyed by slug and by nothing else, so a leftover is invisible AND would be
  // INHERITED: whoever claims the slug next serves the previous site's
  // description and redirect map until their own first publish overwrites it.
  // The same class as the orphan marker and the version archive, both of which
  // have their own line in that block for the same reason.
  assert.match(WORKER, /await env\.SITES_BUCKET\.delete\(siteMetaKey\(dslug\)\)/,
    "a deleted site leaves its meta behind for the next claimant of the slug");
});

test("THE LIVENESS MARKER IS THE TAKE-DOWN, and both sides spell it the same", () => {
  // Start took the old signal away. A published site used to BE a document in
  // R2, so wiping `sites/<slug>/` made every route 404 and that miss was the
  // take-down — which both site deletion and the offline switch rest on. Under
  // Start the document renders from the script's own bundle and needs no R2, so
  // a site whose files are gone kept serving: the container harness measured it
  // as "200 — a deleted site is still serving".
  //
  // A MISMATCH HERE IS SILENT IN THE WORST DIRECTION: the probe misses forever
  // and every page of every site 404s.
  const inEntry = /const LIVE_FILE = "([^"]+)"/.exec(ENTRY);
  assert.ok(inEntry, "the site's Worker no longer names a liveness marker");
  assert.equal(inEntry[1], SITE_LIVE_FILE,
    "the platform publishes a different marker than the site probes for");
  // PUBLISHED WITH THE DIST, not written separately — so it rides the same
  // ordering, the same sweep keep-set and the same prefix wipe as every other
  // file, and no second path can leave it behind.
  assert.match(WORKER, /dist\[SITE_LIVE_FILE\] = \{ t: "1" \}/,
    "the marker is not published with the site's files");
});

test("A MISS IS PERMANENT AND A THROW IS TRANSIENT", () => {
  // The distinction the R2-shell entry drew explicitly and which was lost with
  // it. An R2 blip must not take every published site down; an absent marker
  // means somebody deleted the site. Being wrong toward "live" serves a page
  // that should be gone for a few seconds; being wrong the other way takes the
  // whole platform's published sites down during an R2 incident.
  const at = ENTRY.indexOf("const LIVE_FILE");
  const probe = ENTRY.slice(ENTRY.indexOf('env.SITES.head(', at));
  assert.match(probe, /catch \{[\s\S]{0,600}?live = true;/,
    "an R2 failure is treated as a take-down — a blip would 404 every site at once");
  assert.match(probe, /if \(!live\) return new Response\("Not found", \{ status: 404 \}\)/,
    "an absent marker no longer takes the site down");
  // NOT CACHED, or "take this site offline" waits for an isolate to recycle.
  assert.ok(!/if \(liveChecked\)|liveCache/.test(ENTRY),
    "liveness is cached — an offline switch would not take effect until the isolate recycles");
});
