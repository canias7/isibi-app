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
  // WRITTEN AT ACTIVATION (stage 7, 2026-09-05): the publish composes the
  // sidecar before the gate, keeps it as the version's state, and hands its
  // live key to `activateBuild`, which writes it after the pointer moves and
  // before the script goes up. This read a direct put and went red for the
  // change; the property — the same key is read and written — holds through
  // `siteMetaKey(slug)` on both sides.
  assert.ok((WORKER.match(/sidecarKey: siteMetaKey\(slug\)/g) || []).length >= 2,
    "the publish paths no longer hand the sidecar's key to activation — every site would lose its share tags");
  const builds = fs.readFileSync(new URL("../site-builds.mjs", import.meta.url), "utf8");
  // RE-ANCHORED 2026-09-06: the write became a call through `reversible`, so
  // an activation whose script never lands puts the PREVIOUS head back — a
  // failed publish must not leave the old page wearing the new head. The
  // property is unchanged: the key handed in is the key written.
  assert.match(builds, /reversible\(sidecarKey, sidecar, "application\/json", "sidecar"\)/, "activation does not write the sidecar");
});

test("A FAILURE COSTS THE SHARE TAGS, NEVER THE PUBLISH", () => {
  // Every field in here is decoration on a document that renders perfectly
  // without it. Failing a publish over a preview card would trade a working site
  // for a link preview, which is the wrong way round — the same rule the theme
  // and font writers already live under.
  // THE WRITE LIVES IN `activateBuild` SINCE STAGE 7 (2026-09-05), fenced
  // there: a failed sidecar put is logged and the activation goes on to the
  // script, exactly the rule this held when the write was inline.
  const builds = fs.readFileSync(new URL("../site-builds.mjs", import.meta.url), "utf8");
  // RE-ANCHORED 2026-09-06: the inline try/catch became `reversible`, which
  // fences BOTH halves — the read of what it is replacing and the write itself
  // — and the rule is the one this case has always asserted: a share tag may
  // never fail a customer's publish. Read off the helper, whose two catches
  // name the write they belong to through its `what` argument.
  const at = builds.indexOf("const reversible = async (key, body, contentType, what) => {");
  assert.ok(at > 0, "the sidecar write moved — rescope this");
  const win = builds.slice(at, builds.indexOf("\n  };", at));
  assert.match(win, /catch \(e\) \{ if \(deps\.log\) deps\.log\(what \+ " write failed", slug, e && e\.message\); return; \}/,
    "the sidecar write is not fenced — a share tag can fail a customer's publish");
  assert.match(win, /catch \(e\) \{ if \(deps\.log\) deps\.log\(what \+ " read failed, its write will not be undone"/,
    "a read of the previous value that fails is not fenced, or guesses");
  assert.ok(builds.includes('reversible(sidecarKey, sidecar, "application/json", "sidecar")'), "the sidecar is not written through the fenced helper");
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
  // WRITTEN AT ACTIVATION, AT ITS OLD ADDRESS (stage 7, 2026-09-05). It rode
  // in the dist while the dist was written over the served prefix; a version's
  // prefix now carries only what that version serves, and the marker stays at
  // `sites/<slug>/site.live` — where every script, old and new, probes for it
  // — written by `activateBuild` on every activation (the spine, the build
  // path, the restore) and still under the prefix the take-down wipes.
  assert.equal((WORKER.match(/liveKey: "sites\/" \+ slug \+ "\/" \+ SITE_LIVE_FILE/g) || []).length, 3,
    "the marker is not handed to activation on every path that makes a site live");
  const builds = fs.readFileSync(new URL("../site-builds.mjs", import.meta.url), "utf8");
  // RE-ANCHORED 2026-09-06, same change: written through `reversible`, so a
  // first activation that never served does not leave a site marked live.
  assert.match(builds, /reversible\(liveKey, "1", "text\/plain", "live marker"\)/, "activation does not write the marker");
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
