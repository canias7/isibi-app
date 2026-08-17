// A published site served by its OWN Worker, rendered per request.
//
// WHAT THIS FILE USED TO BE. Most of it drove a hand-written runtime
// (`site-worker/entry.js`) and the pure function that fed it
// (`siteConfigModule`), which spliced rendered bodies into an HTML shell read
// out of R2. TanStack Start replaced the whole tier: the document is
// `__root.tsx` rendered per request by `src/server.ts`, which Start's own build
// bundles, so there is no shell, no config module and no splicing.
//
// WHAT SURVIVES IS THE PART THAT IS STILL OURS: the one build setting that
// decides whether a site renders at all, the ABSENCE of the shell (asserted
// rather than deleted, so restoring the packager without its guard goes red),
// the no-slug refusal, and the script's name.
//
// The one thing no unit test here can prove is that the server bundle really
// runs inside the Workers runtime. `test/integration/site-build.mjs` executes it
// against a fake R2 — a one-way filter, since Node is not workerd — and a real
// upload is the only complete answer.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { scriptNameFor } from "../builder/site-worker.mjs";

/* ------------------------------------------------------------- the build */

test("THE WORKER BUILD ASKS FOR THE `workerd` CONDITION", () => {
  // WITHOUT IT EVERY SITE RENDERS NOTHING, silently. `ssr.target: "webworker"`
  // alone puts `browser` in the condition set, `@tanstack/router-core` then
  // resolves `./isServer` to its CLIENT variant, `RouterCore.update` believes
  // it is in a browser, and `createRouter` throws `window is not defined`.
  // Start's handler catches a render failure and streams a shell, so the site
  // answers 200 with none of its own words — a working status code over exactly
  // the blank page this whole tier exists to end.
  //
  // Both libraries that decide it ship the answer under this one name:
  // router-core maps `workerd` to its server build, react-dom maps it to
  // `server.edge.js`. Neither pure choice works alone — webworker conditions
  // break the router, node conditions pull `node:stream` into react-dom.
  //
  // READ OFF `vite.config.ts`, because the separate worker config went with the
  // second vite pass: Start's own build produces the server bundle now, so this
  // is where the setting lives.
  const cfg = fs.readFileSync(new URL("../builder/lovable/template/vite.config.ts", import.meta.url), "utf8");
  const m = cfg.match(/\bconditions:\s*\[([^\]]*)\]/);
  assert.ok(m, "the SSR build no longer names its resolve conditions at all");
  const list = m[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  assert.ok(list.includes("workerd"),
    "`workerd` is gone from the condition set — every generated site would render nothing: " + list.join(" "));
  // `react-server` selects react-dom's RSC build, which is not what this
  // renders, and it is the FIRST key in that package's map — so its presence
  // would win over `workerd` and change what gets bundled.
  assert.ok(!list.includes("react-server"),
    "`react-server` outranks `workerd` in react-dom's export map and selects the RSC build");
});

test("THE SHELL IS GONE, and so is what it could get wrong", () => {
  // These guards protected the `[object Object]` failure: the caller passed
  // `dist["index.html"]`, which `collectDist` returns as `{t: "…"}`, `String()`
  // turned it into fifteen literal characters, and every page of the site served
  // those as its whole document — past a typecheck, a bundle, a size check, and
  // an assertion that matched the entry file's own copy of the string it was
  // looking for. It was found by EXECUTING a bundle.
  //
  // Under Start there is no shell to hand over at all. So the guard is replaced
  // by its PREMISE rather than deleted — the `@/examples/*` lint precedent,
  // where a rule whose justification evaporated with the feature was removed and
  // the absence asserted instead, because restoring the feature without the rule
  // brings the silent failure straight back.
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  // Comments blanked first: the note explaining that the splicing is gone NAMES
  // it, so a bare scan finds the word it was written to forbid and fails against
  // a correct file. Recorded three times in this repo already.
  const code = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/packageWorker\s*\(/.test(code), "the shell packager is back without its shell guard");
  assert.ok(!/dist\["index\.html"\]/.test(code), "the build reads a shell out of the dist again");
  // AND THE FILES THEMSELVES. The template's own `index.html` was Vite's entry
  // and Start emits none; a restored one would be built, published, and served
  // at `/` ahead of the rendered document by the platform's own asset branch —
  // a blank page at the one address everybody is given.
  for (const gone of ["index.html", "src/main.tsx", "src/entry-server.tsx"]) {
    assert.ok(!fs.existsSync(new URL("../builder/lovable/template/" + gone, import.meta.url)),
      gone + " is back — Start renders the document, so this is a second answer to the same question");
  }
});

test("a worker is REFUSED without a slug, rather than packaged with an empty one", () => {
  // `packageWorker`'s own first rule, which had to be restored when it went. The
  // slug is baked into `site-brand.ts` and the server entry builds every R2 key
  // from it, so a script without one answers 404 to every stylesheet, every
  // bundle and its own meta — a page that renders and then looks broken, which
  // is worse than the static path it would have replaced.
  //
  // VERIFIED BY EXECUTION, not by reading: a bundle built with an empty slug
  // served `sites//assets/…`, every asset 404'd, and the share tags were
  // silently absent while the document still returned 200.
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  assert.match(src, /payload\.worker && !brandUsed\.slug/,
    "a worker can be packaged for a site with no slug — every asset on it would 404");
  assert.match(src, /payload\.worker && brandUsed\.slug\) worker = readSiteWorker\(\)/,
    "the script is read without the slug having been checked");
});

/* ------------------------------------------------------------ the name */

test("the script name is derived from the slug and prefixed", () => {
  assert.equal(scriptNameFor("forno"), "site-forno");
  assert.equal(scriptNameFor("sharp-fade"), "site-sharp-fade");
  // A slug that cleans to nothing gets NO name rather than the bare prefix,
  // which would be one script every such site uploaded over.
  assert.equal(scriptNameFor(""), "");
  assert.equal(scriptNameFor("!!!"), "");
  assert.equal(scriptNameFor(null), "");
});

test("the name cannot be steered outside the slug's own alphabet", () => {
  // The name addresses an upload. A slug is already filtered to [a-z0-9-] on
  // the way in, so this changes nothing today — it is here because the value
  // decides which script gets overwritten, and a guarantee held only by a
  // filter in another file is one edit from being held by nothing.
  assert.equal(scriptNameFor("../other"), "site-other");
  assert.equal(scriptNameFor("A B/C"), "site-abc");
});
