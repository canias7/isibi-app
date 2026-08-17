// Forwarding a published site to its own Worker — and what happens when it
// has none.
//
// WHY THIS IS DRIVEN THROUGH THE REAL ROUTER rather than unit-tested one layer
// down: the decision lives in `worker.js`, which is where this repo has
// recorded twelve dead features. The property being asserted is not "the
// helper is correct" — it is "the request reaches it, and the request that
// should NOT reach it goes somewhere sane instead".
import { test } from "node:test";
import assert from "node:assert/strict";
import { hit } from "./fixtures/worker-harness.mjs";

// The static path, stood up with just enough R2 to answer.
const r2 = (files) => ({
  get: async (key) => (files[key] === undefined ? null : {
    body: files[key],
    async text() { return files[key]; },
    writeHttpMetadata() {},
    httpMetadata: {},
  }),
});

const SHELL = "<html><body><div id=\"root\"></div>STATIC</body></html>";
// THE SITE ZONE, not the app zone. `/s/<slug>/` on gofarther.dev 301s to the
// site's own hostname — the one-public-address rule — so a test that posts
// there is testing the redirect. A visitor arrives here, and the hostname
// rewrite turns `/` into `/s/<slug>/` before any of this is reached.
const AT = (slug) => ({ origin: "https://" + slug + ".gofarther.app" });
const BUCKET = r2({ "sites/forno/index.html": SHELL, "sites/forno/book.html": SHELL });

/** A dispatch namespace holding exactly the named scripts. */
function namespace(scripts, seen = []) {
  return {
    seen,
    get(name) {
      if (!Object.hasOwn(scripts, name)) {
        // The shape Cloudflare uses for a script that is not in the namespace.
        throw new Error("Worker not found");
      }
      return { fetch: async (req) => { seen.push(new URL(req.url).pathname); return scripts[name](req); } };
    },
  };
}

const RENDERED = async () => new Response("RENDERED", { headers: { "content-type": "text/html" } });

/* ------------------------------------------------- the fall-through */

test("A SITE WITH NO SCRIPT IS SERVED FROM R2, exactly as before", async () => {
  // THE PROPERTY THAT DECIDES WHETHER THIS IS SAFE TO DEPLOY. Every published
  // site on the platform has no script and will have none until packaging is
  // switched on per build — so "not found" has to be indistinguishable from
  // the binding not existing at all. Get it wrong and the deploy that adds
  // the binding 404s every site at once.
  const seen = [];
  const res = await hit("/", { ...AT("forno"), env: { SITES_BUCKET: BUCKET, SITE_WORKERS: namespace({}, seen) } });
  assert.equal(res.status, 200);
  assert.match(res.text, /STATIC/);
});

test("…and so is a site served with no binding at all", async () => {
  // The state of production until this deploys. Asserted beside the case
  // above, because "the binding is absent" and "the script is absent" must
  // produce the same page and only one of them is the ordinary future.
  const res = await hit("/", { ...AT("forno"), env: { SITES_BUCKET: BUCKET } });
  assert.equal(res.status, 200);
  assert.match(res.text, /STATIC/);
});

test("a script that EXISTS is what answers", async () => {
  const res = await hit("/", { ...AT("forno"), env: { SITES_BUCKET: BUCKET, SITE_WORKERS: namespace({ "site-forno": RENDERED }) } });
  assert.equal(res.status, 200);
  assert.equal(res.text, "RENDERED");
  assert.doesNotMatch(res.text, /STATIC/, "the static file must not have been read at all");
});

/* ------------------------------------------------------ the rewrite */

test("THE MOUNT PREFIX IS STRIPPED before the site's script sees the path", async () => {
  // `/s/<slug>/book` is our INTERNAL addressing — both hostname rewrites
  // produce it — and the site's own script knows nothing about it: its routes
  // are `/book`. Forwarded unrewritten, every page renders the not-found
  // component and the site looks broken in a way nothing else would explain.
  const seen = [];
  await hit("/book", { ...AT("forno"), env: { SITES_BUCKET: BUCKET, SITE_WORKERS: namespace({ "site-forno": RENDERED }, seen) } });
  assert.deepEqual(seen, ["/book"]);
});

test("the home page arrives as /", async () => {
  const seen = [];
  await hit("/", { ...AT("forno"), env: { SITES_BUCKET: BUCKET, SITE_WORKERS: namespace({ "site-forno": RENDERED }, seen) } });
  assert.deepEqual(seen, ["/"]);
});

test("an asset keeps its own path", async () => {
  // The site's script serves its own assets out of R2 under its slug, so the
  // path it is handed has to be the one the file is stored under.
  const seen = [];
  await hit("/assets/main-abc.js", { ...AT("forno"), env: { SITES_BUCKET: BUCKET, SITE_WORKERS: namespace({ "site-forno": RENDERED }, seen) } });
  assert.deepEqual(seen, ["/assets/main-abc.js"]);
});

/* --------------------------------------------------- which script */

test("a site is only ever forwarded to ITS OWN script", async () => {
  // The name addresses which customer's code runs. A slug that resolved to
  // another site's script is one customer's site served under another's
  // address — the worst outcome this path has available to it.
  const seen = [];
  const ns = namespace({ "site-forno": RENDERED }, seen);
  const res = await hit("/", { ...AT("other"), env: { SITES_BUCKET: r2({ "sites/other/index.html": SHELL }), SITE_WORKERS: ns } });
  assert.deepEqual(seen, [], "nothing should have been dispatched");
  assert.match(res.text, /STATIC/);
});

/* ------------------------------------------------- a broken script */

test("a script that THROWS still serves the customer their site", async () => {
  // While both paths exist, the last published build beats a 503. The site's
  // own entry already falls back to the shell on a render failure, so an error
  // escaping to here is structural — and the visitor should not pay for that.
  const boom = () => { throw new Error("exceeded CPU"); };
  const res = await hit("/", { ...AT("forno"), env: { SITES_BUCKET: BUCKET, SITE_WORKERS: namespace({ "site-forno": boom }) } });
  assert.equal(res.status, 200);
  assert.match(res.text, /STATIC/);
});

/* --------------------------------------------------- the source rule */

test("the dispatch sits IN FRONT OF the R2 read, not instead of it", async () => {
  // The behavioural tests above can all pass with the dispatch placed after
  // the static read, which would serve every site from R2 forever and make the
  // whole feature dead — the shape this repo has recorded twelve times. So the
  // ordering is asserted on the source as well.
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("env.SITE_WORKERS");
  assert.ok(at > 0, "the dispatch is gone from worker.js");
  const r2read = src.indexOf('let obj = await env.SITES_BUCKET.get(key);', at);
  assert.ok(r2read > at, "the R2 read for /s/ no longer follows the dispatch");
});

test("scriptNameFor is IMPORTED, not merely called", async () => {
  // A call to a name that was never imported is a ReferenceError on the serve
  // path — the OWN_ZONES outage, where every custom-domain call threw for days
  // because the constant was read and never imported. It was missing here too,
  // on the first draft of this change.
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(src, /import \{[^}]*\bscriptNameFor\b[^}]*\} from "\.\/builder\/site-worker\.mjs"/);
});
