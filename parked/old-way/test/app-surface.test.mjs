// PARKED (2026-11-03, park-old-way): the old-way half of test/app-surface.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// An app is its own product, made by the same process as a site (2026-10-20,
// owner: "you don't need to have a website. You can just build an app" and
// "everything the same as the site … it's literally just the same process").
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageRulesFor, APP_PAGE_RULES } from "../../../builder/page-gen.mjs";

const page = readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
const worker = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");

// PHONE APPS ARE PARKED (2026-10-21, owner: "customer cant access it yet, we are
// gonna open a different branch later"). Three switches, all closed.
test("parked: apps are off in the page, the router and the Worker, and the Worker's doors answer 404", async () => {
  assert.match(page, /^const APPS_OPEN = false;$/m, "the page's switch is closed");
  assert.match(page, /const BUILD_KINDS = APPS_OPEN \? \{[\s\S]*?\} : \{\n  site: +\{ label: 'Website'/, "only Website is offered");
  assert.match(page, /if \(!APPS_OPEN\) return '';/, "no Make: chip");
  assert.match(page, /\(APPS_OPEN && inside !== words && madeFor\(v\) \? '<button/, "no app button in the phones");
  const ask = await import("../builder/site-ask.mjs");
  assert.equal(ask.APPS_OPEN, false, "the router's switch is closed");
  assert.match(worker, /const appsOpen = \(env\) => !!env && env\.APPS_OPEN === "1";/);
  assert.doesNotMatch(readFileSync(new URL("../../../wrangler.jsonc", import.meta.url), "utf8"), /APPS_OPEN/, "the deploy leaves it unset, so closed");
  const { loadWorkerModule } = await import("../../../test/fixtures/worker-harness.mjs");
  const w = (await loadWorkerModule()).default;
  for (const path of ["/api/site/harbour-loaf/app/android", "/api/site/harbour-loaf/app/preview", "/api/site/harbour-loaf/app/builder", "/api/site/harbour-loaf/app/selftest", "/app-preview/harbour-loaf/" + "a".repeat(32) + "/"]) {
    for (const method of ["GET", "POST"]) {
      const r = await w.fetch(new Request("https://gofarther.dev" + path, { method }), {}, { waitUntil() {}, passThroughOnException() {} });
      assert.equal(r.status, 404, method + " " + path);
    }
  }
});
