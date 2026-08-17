// A PUBLISHED SITE, AS A WORKER. One of these per site, uploaded into a
// Workers-for-Platforms dispatch namespace and reached by the platform Worker.
//
// WHY THIS EXISTS AT ALL. A published site was static files on R2: an empty
// `<div id="root">` plus a bundle, with `prerender()` filling that div in at
// BUILD time so a link preview and a crawler see a real page. That step is
// best-effort by design, and on 2026-08-16 it produced nothing on a real
// build — the child was killed by SIGTERM 4.4s in, wrote nothing to either
// stream, and the site published blank to anything that does not run
// JavaScript. Nothing failed. Rendering at REQUEST time removes the step and
// therefore the failure: there is no build-time artefact left to be missing.
//
// NOT TANSTACK START, and the reason is worth keeping. Start is the obvious
// answer and it is a framework migration; `entry-server.tsx` has exported
// `render(pathname) => html` since the prerender shipped, so the template
// ALREADY server-renders and has done on every build. What was missing was
// somewhere to run it per request, which is this file. The generator, the
// component kit, the routes and the template are untouched.
//
// A WORKER CANNOT LOAD CODE AT RUNTIME — no eval, no dynamic import of
// anything not bundled at upload. So "one Worker that renders whichever site
// was asked for" is impossible, and that is what forces a script per site and
// therefore the dispatch namespace. Stated because it is the first design
// somebody reaches for and the runtime refuses it, not our architecture.
// EXTENSIONLESS, so vite resolves `entry-server.tsx` — the SOURCE — and the
// whole Worker is one build pass. Pointing at the already-built SSR output
// instead would need two passes and would make the Worker's contents depend on
// which of them ran last.
import { render } from "./entry-server";
import { SHELL, SLUG, ROUTES } from "./site-config.js";

// THE SHELL IS READ FROM R2, NOT BAKED IN — corrected 2026-08-17, and the note
// that stood here said the opposite at length: that it was "byte-identical for
// every request… known at upload time". Both halves were false, and the second
// one cost every published site its link preview. `injectMeta` adds the
// description and the Open Graph tags at PUBLISH time, which is after the
// container has produced the bundle this script is packaged from, so a baked
// shell is always the version from before the tags existed.
//
// `SHELL` survives as the FALLBACK for a transient read failure. See the fetch
// handler for why a MISS is treated completely differently from a throw.
const SLOT = '<div id="root">';

/**
 * Is this a request for a file rather than a page?
 *
 * The same rule the platform Worker's SPA fallback already uses: a path with
 * an extension is an asset, anything else is a route. Kept as a predicate
 * because the two must agree — a request classified as a page here and as an
 * asset there is a page that 404s on one mount and renders on the other.
 */
export function isAsset(pathname) {
  const last = String(pathname || "").split("/").pop() || "";
  return last.includes(".");
}

/**
 * Whether this path is one of the site's own routes.
 *
 * A site with no route list has no opinion — it renders everything, which is
 * what every site published before the manifest existed does. That is the
 * SAFE direction: being wrong here means a real page 404s, and a 404 on a
 * working page is worse than a 200 on a missing one.
 */
export function isKnownRoute(pathname) {
  if (!Array.isArray(ROUTES) || !ROUTES.length) return true;
  const p = String(pathname || "/").replace(/\/+$/, "") || "/";
  return ROUTES.includes(p);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ASSETS STAY ON R2, and this is a cost decision rather than a detail.
    // Putting a JavaScript bundle or a stylesheet through compute is paying
    // per request for something a CDN does for nothing, on the files that are
    // requested most. Only the document is rendered.
    if (isAsset(url.pathname)) {
      const key = "sites/" + SLUG + url.pathname;
      const obj = env.SITES && (await env.SITES.get(key));
      if (!obj) return new Response("Not found", { status: 404 });
      const h = new Headers();
      obj.writeHttpMetadata(h);
      h.set("cache-control", "public, max-age=31536000, immutable");
      return new Response(obj.body, { headers: h });
    }

    // ── THE SHELL COMES FROM R2, NOT FROM THIS BUNDLE ────────────────────────
    //
    // IT USED TO BE BAKED IN, and that lost every published site its link
    // preview. `injectMeta` runs in the platform Worker at PUBLISH time — the
    // description, the Open Graph tags, the twitter card — and the script bakes
    // whatever the CONTAINER produced, which is the raw vite output from before
    // any of that. Measured on the first live run: three failures, and a real
    // page whose whole head was `<title>Forno</title>`. WhatsApp, Slack and
    // iMessage fetch the HTML once and read the head; they do not run
    // JavaScript. That is the entire reason `injectMeta` exists.
    //
    // THE COST ARGUMENT THAT SETTLES IT: before this tier existed, serving a
    // page WAS one R2 get. The old note called the shell "known at upload time"
    // and refused to spend a round trip on it — but it is not known then, and
    // one get for the document is exactly what the static path always paid. So
    // this is not a new cost, it is the old one.
    //
    // PER ROUTE, so per-page previews survive too. Every route is prerendered
    // to its own document with its OWN meta; serving `index.html` for all of
    // them would put the home page's card on every address, which is the bug
    // the per-page injection was written to fix.
    const docKey = url.pathname === "/" || url.pathname === ""
      ? "index.html"
      : url.pathname.replace(/^\/+/, "").replace(/\/+$/, "") + ".html";
    let shell = SHELL, missing = false;
    try {
      // NO BUCKET IS "CANNOT TELL", NOT "GONE" — the same distinction as a
      // throw one line down, and the first draft got it wrong here: it used
      // `env.SITES && …`, which short-circuits to undefined rather than
      // throwing, so `missing` was set and every page of every site 404'd.
      // Caught by the existing runtime tests, all of which drive exactly that
      // env shape.
      //
      // BELT-AND-BRACES NOW, AND IT SAYS SO RATHER THAN BEING FALSELY
      // ASSERTED. With the check removed, `env.SITES.get` on undefined THROWS,
      // the catch below takes it, and the answer is the same 200 on the baked
      // shell — proved by a mutation that survived. It is kept because relying
      // on a TypeError to produce correct behaviour is one edit from not
      // working, and because a script is uploaded WITH the bucket, so an
      // absent one means something is wrong that this should not hide.
      if (env.SITES) {
        const doc = (await env.SITES.get("sites/" + SLUG + "/" + docKey))
          || (await env.SITES.get("sites/" + SLUG + "/index.html"));
        if (doc) shell = await doc.text();
        else missing = true;
      }
    } catch (e) {
      // A THROW IS TRANSIENT AND A MISS IS NOT, and the difference decides
      // whether a site stays up. An R2 blip must not take a live site down, so
      // this keeps the baked shell — degraded to no preview, still serving.
      console.error("shell read failed:", SLUG, url.pathname, String((e && e.message) || e));
    }

    // NOTHING PUBLISHED HERE MEANS THE SITE IS GONE, and answering 404 is the
    // safety net for the failure that produced this change. A delete removes
    // the files and then the script; a rollback and the offline switch remove
    // the script and then change the files. When the script REMOVAL fails —
    // measured live, twice — a baked shell would keep serving a site whose
    // every trace has been erased. Reading the document means the files get the
    // final say, so the take-down works even when the removal did not.
    //
    // No window to race: a publish OVERWRITES index.html rather than deleting
    // it first, so the old document is there until the new one replaces it.
    if (missing) return new Response("Not found", { status: 404 });

    const at = shell.indexOf(SLOT);
    const close = at < 0 ? -1 : shell.indexOf("</div>", at);
    const split = at < 0 || close < 0 ? null : { open: shell.slice(0, at + SLOT.length), close: shell.slice(close) };

    // A RENDER FAILURE MUST NEVER BE AN OUTAGE, and this matters far more here
    // than it did at build time. A prerender that failed cost a snapshot; a
    // render that fails now is a visitor looking at the site. So anything that
    // goes wrong falls back to the shell — the empty div plus the bundle,
    // which is exactly what every site served before this existed. The page
    // still works, it is merely blank to a crawler for that request.
    let body = "";
    try {
      if (split) body = await render(url.pathname);
    } catch (e) {
      // THE STACK, NOT JUST THE MESSAGE, and that is not verbosity. This
      // failure is silent by design — the shell still serves, the visitor sees
      // a working page, and the only trace is this line. `window is not
      // defined` names no module, and the bundle is one file of ~950,000
      // characters, so a message alone leaves nobody able to say WHICH
      // dependency reached for a browser global. Measured: the message cost a
      // separate diagnostic harness to answer a question the stack states.
      //
      // Safe to log: it goes to our own console, never to the response, and a
      // bundled stack carries module paths rather than anything a visitor sent.
      console.error("render failed:", SLUG, url.pathname, String((e && e.stack) || (e && e.message) || e));
    }

    // A document with no root div is one we did not build — served untouched
    // rather than guessed at, which is what the prerendered snapshot already is.
    const html = split ? split.open + body + split.close : shell;

    // 404 IS A STATUS, NOT A PAGE. The router draws its own not-found
    // component either way, so the body is unchanged — what changes is that a
    // crawler is told the address is not real. Serving 200 for every typo is
    // the soft-404 that made a deleted page's old link look alive.
    const status = isKnownRoute(url.pathname) ? 200 : 404;

    return new Response(html, {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // NOT `immutable`, and not long. The document is now produced per
        // request precisely so it can change when the owner edits their site;
        // caching it for a year would undo the whole point of moving here.
        "cache-control": "public, max-age=0, must-revalidate",
      },
    });
  },
};
