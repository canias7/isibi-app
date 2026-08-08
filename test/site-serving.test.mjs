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
  const hdr = siteBranch.indexOf('"access-control-allow-origin"');
  const body = siteBranch.indexOf("new Response(obj.body");
  assert.ok(body > 0 && hdr > body, "the header is not on the response that carries the file");

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
