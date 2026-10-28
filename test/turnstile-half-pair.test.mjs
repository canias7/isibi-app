// Audit A30-7 asked that a site with TURNSTILE_SECRET and no TURNSTILE_SITE_KEY
// read as off, and that a refused verdict be logged. Both lived in the
// platform's Turnstile gate and config reader, which were deleted on
// 2026-10-28: spam protection is off for every site by the owner's decision
// ("a future addition"), and visitor writes go to the site's own Worker
// (2026-10-28: the site's own Worker). What stands of the property is that the
// check reads as off everywhere: the platform's `spamCheckOn` answers false, and
// the site's own Worker answers its widget's config request with `{}` (no site
// key, so no widget and no token are ever asked for).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const server = readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");

test("the platform reads the spam check as off for every site", () => {
  const defs = worker.match(/async function spamCheckOn\([^)]*\) \{[^\n]*\}/g) || [];
  assert.equal(defs.length, 1, "one spamCheckOn definition");
  assert.match(defs[0], /\{ return false; \}$/, "spamCheckOn answers false");
  for (const gone of ["async function turnstileGate(", "const siteTurnstileKeys", "async function turnstileConfig(", "async function enableSpamCheck(", "function forgetSiteConfig("]) {
    assert.ok(!worker.includes(gone), gone + " is back: the platform gates spam again");
  }
});

test("the platform sends /api/db/<slug>/turnstile to the site's own Worker", () => {
  const re = worker.match(/const vm = url\.pathname\.match\(\/\^\\\/api\\\/db\\\/[^\n]*\|turnstile\)\$\/i\);/);
  assert.ok(re, "the site-route pattern carries turnstile");
});

test("the site's own Worker answers its widget's config with {} (2026-10-28: the site's own Worker)", () => {
  const i = server.indexOf('"/api/db/" + SITE_SLUG + "/turnstile"');
  assert.ok(i > 0, "the route exists in the template");
  const line = server.slice(i, server.indexOf("\n", i));
  assert.match(line, /\? Response\.json\(\{\}, \{ headers: \{ "x-site-data": "own"/, "answers {} marked as the site's own");
  assert.doesNotMatch(line, /secret|siteKey/i, "no key is served");
});
