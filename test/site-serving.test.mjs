// Serving a published site so a browser can actually render it.
//
// BOTH BUGS HERE PRODUCED THE SAME SYMPTOM — a white rectangle — and neither was
// visible from any layer that could be unit tested. The build succeeded, the
// files were in R2, every object answered 200, and every one of the 1,545 tests
// passed. What was wrong was how a BROWSER resolves and fetches those objects,
// which only a browser can tell you.
//
// worker.js cannot be imported, so these read the source. That is weaker than
// driving it and it is what is available; the real proof was a headless run
// against the published dist, recorded in the comments at each site.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

// The /s/ branch only, to its 404 fallthrough — a window run to a distant
// landmark swallows the /g/ branch below it, which is a near-identical copy and
// would satisfy every assertion here while /s/ was broken.
const siteBranch = (() => {
  const i = worker.indexOf('const sm = url.pathname.match(/^\\/s\\/');
  const end = worker.indexOf('if (sm) return new Response("Not found"', i);
  assert.ok(i > 0 && end > i, "the /s/ serving branch moved; this file checks nothing");
  return worker.slice(i, end);
})();

test("a bare /s/<slug> redirects to the trailing slash", () => {
  // IT ANSWERED 200 WITH THE RIGHT HTML, which is why nothing caught it. The
  // document references its bundle relatively (`./assets/index-x.js` — what Vite
  // emits), so from `/s/hey` the browser resolves `/s/assets/index-x.js` and
  // gets a 404: the page loads, the script and stylesheet do not, and the
  // visitor sees white. Measured live against gofarther.dev/s/hey.
  //
  // Nothing in the product produces the slashless form — the build response, the
  // share panel and the preview frame all carry the slash — so it was reachable
  // only by a person typing or pasting it. Which is exactly what an owner does
  // when telling a customer where their site is.
  assert.match(siteBranch, /if \(sm\[2\] === undefined\)/,
    "a slashless /s/<slug> is served directly again, and will render blank");
  assert.match(siteBranch, /Response\.redirect\(url\.toString\(\), 301\)/,
    "the redirect is gone or is not a permanent one");

  // EXACTLY the slashless case. `sm[2]` is undefined for `/s/hey` and "" for
  // `/s/hey/`, so a truthiness test here would redirect `/s/hey/` to itself
  // forever — a redirect loop on every published site.
  assert.ok(!/if \(!sm\[2\]\)/.test(siteBranch),
    "a falsy check also matches the trailing-slash form and loops");

  // Before the key is computed, or it redirects after doing the lookup work.
  const redir = siteBranch.indexOf("Response.redirect");
  const key = siteBranch.indexOf('key = "sites/"');
  assert.ok(redir > 0 && key > redir, "the redirect runs after the object lookup");
});

test("published assets carry a CORS header, or the preview is blank", () => {
  // THE SECOND WHITE-RECTANGLE BUG. The builder's preview frame is sandboxed
  // WITHOUT `allow-same-origin`, so its origin is `null` and every subresource
  // is cross-origin. Vite emits the entry as `<script type="module" crossorigin>`
  // and a module script is ALWAYS fetched in CORS mode — so with no header the
  // script and the stylesheet were both blocked and the frame rendered nothing.
  //
  // Measured: the same published dist in two iframes differing only by
  // `allow-same-origin` — one blank, one complete. With this header both render.
  assert.match(siteBranch, /"access-control-allow-origin": "\*"/,
    "published site assets have no CORS header; the sandboxed preview will render blank");

  // It has to sit on the SERVED response, not on the 404 or the redirect.
  //
  // Anchored on `"content-type": ctype` — the served response is the only one
  // that carries it — rather than on the variable being returned. This used to
  // name `new Response(obj.body`, and went red the moment that body became a
  // rewritten string for HTML: a guard that breaks on a rename is a guard that
  // gets "fixed" by loosening it.
  const hdr = siteBranch.indexOf('"access-control-allow-origin"');
  const served = siteBranch.indexOf('"content-type": ctype,');
  assert.ok(served > 0, "the served-file response moved — rescope this");
  assert.ok(hdr > served, "the header is not on the response that carries the file");

  // ONE served response, and this is the property the rename was made to keep.
  // HTML now leaves through the same construction as an asset — only the BODY
  // differs — because a second `new Response` for the HTML path is a second
  // header block, and two header blocks for one route is how the CORS header
  // comes back missing on exactly one of them.
  const responses = (siteBranch.match(/"content-type": ctype,/g) || []).length;
  assert.equal(responses, 1,
    "there is more than one served-file response in this branch — the headers can now " +
    "disagree between them, which is how this bug arrived the first time");

  // And the security property it exists to preserve: `*` opens the FILE, which
  // was already public to anyone who asked. The alternative was opening the
  // ORIGIN by adding allow-same-origin to the frame, which would hand
  // model-written page code the owner's session in localStorage. If the sandbox
  // ever gains that flag, this trade was reversed by accident.
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const frame = chat.match(/<iframe id="stFrame" sandbox="([^"]*)"/);
  assert.ok(frame, "the preview iframe lost its sandbox attribute entirely");
  assert.ok(!/allow-same-origin/.test(frame[1]),
    "the preview frame is same-origin with the builder — generated page code can read the owner's session");
});

// ── WHERE A PUBLISHED PAGE THINKS ITS ASSETS ARE ────────────────────────────
//
// vite builds with `base: "./"`, so the shell asks for `./assets/index-<hash>.js`
// and the browser resolves that against the DIRECTORY of the current URL. That
// is right at `/s/<slug>/book` and WRONG at `/s/<slug>/shop/item`, where it
// becomes `/s/<slug>/shop/assets/…` and every asset 404s. `SAFE_PATH` permits
// nested route files and the tool documents the directory form, so that is a
// shape the generator can really produce.
//
// The Worker is the only layer that can fix it: the same bytes serve at
// `/s/<slug>/` on our domain and at `/` on the owner's custom domain — the Host
// rewrite above turns the second into the first — so nothing baked into the file
// is correct in both.
test("html is rewritten to the mount it is actually being served from", () => {
  assert.match(siteBranch, /const mountRoot = isAppHostname\(url\.hostname\) \? "\/s\/" \+ slug \+ "\/" : "\/";/,
    "the mount root is no longer derived from the hostname — hardcode either side " +
    "and it is wrong on every custom domain, or wrong on every site of ours");

  // `isAppHostname` AND NOT `isOwnHostname`, which it used to be and which was
  // correct while there was one zone. `isOwnHostname` now covers the site zone
  // too, so it answers true for `<slug>.gofarther.app` — a mount whose root is
  // `/` — and every script and stylesheet on the new zone would be asked for at
  // `/s/<slug>/assets/…` and 404. Asserted as an absence as well as a presence:
  // only one of the two predicates can be right here.
  assert.doesNotMatch(siteBranch, /const mountRoot = isOwnHostname/,
    "isOwnHostname covers both zones and cannot decide the mount");

  // BOTH ARMS, named separately. A mutation collapsing the ternary to the /s/
    // form survived a first sweep: nothing asserted the custom-domain answer, and
  // that is the arm a customer's own address depends on.
  const m = siteBranch.match(/const mountRoot = [^;]+;/);
  assert.ok(m, "the mount root assignment is gone");
  assert.match(m[0], /"\/s\/" \+ slug \+ "\/"/, "our own domain's mount is not built from the slug");
  assert.match(m[0], /:\s*"\/"/, "a custom domain does not resolve to the site root");

  // And the rewrite itself. Removing it left every test green while deep links
  // at depth 2 lost their assets.
  // The fallback path buffers the shell to read its manifest (site-seo.mjs),
  // and a body reads ONCE — so the rewrite must reuse that buffer rather than
  // call .text() a second time, which throws on exactly the fallback path.
  assert.match(siteBranch, /\(shellText !== null \? shellText : await obj\.text\(\)\)\.replace\(/,
    "the relative-root rewrite is gone; a nested route's assets will 404");
  assert.match(siteBranch, /\$1="' \+ mountRoot\)/,
    "the rewrite no longer substitutes the mount root");

  // HTML ONLY. Running it over a bundle would corrupt JavaScript that happens to
  // contain the same characters, and it costs a full read of every asset.
  const guard = siteBranch.indexOf('ctype.startsWith("text/html")', siteBranch.indexOf("let served"));
  const rewrite = siteBranch.indexOf("(shellText !== null ? shellText : await obj.text()).replace(");
  assert.ok(guard > 0 && rewrite > guard,
    "the rewrite is not gated on html — it would run over every asset served");
});
