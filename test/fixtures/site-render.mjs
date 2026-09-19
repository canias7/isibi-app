// A GENERATED PAGE, RENDERED THROUGH THE REAL HOOK AND THE REAL PUBLIC ROUTE.
//
// ⚠ WHAT THIS EXISTS FOR, and it is the difference between two claims. A page
// rendered with `@/lib/rows` stubbed proves the page reads the right FIELD
// NAMES — which is the defect the whole declared-shape tier is about, and is
// worth having. It proves nothing about the two hops between the page and the
// service: the url `useApi` builds, the parameters it forwards, and what the
// platform's own route does with them. Those are where a connection that is
// perfectly declared and perfectly rendered still answers nothing.
//
// So here the ONLY stub is the third-party service. Everything between it and
// the page is the product:
//
//   the page source  ──►  the real `useApi` from the kit's own rows.ts
//                    ──►  the real `/api/db/<slug>/api/<name>` in worker.js
//                    ──►  `takeParams`, `missingRequired`, `fill`, `callApi`
//                    ──►  the stub, which stands in for the service alone
//
// WHAT IS STILL STUBBED, NAMED RATHER THAN GLOSSED: Supabase (the site's row
// and its owner's project), Neon (the stored schema and the vault row), the
// third-party service, and `@tanstack/react-router`'s `createFileRoute` — the
// router is not the subject and the real one needs a generated route tree. The
// component is taken from `Route.options.component`, which is where the real
// router takes it from, so the page needs no test-only export.
//
// AND A DECLARED SHAPE IS STILL NOT A VERIFIED RESPONSE. The stub answers what
// the case says the service sends; whether the owner's real service sends that
// is a different claim and is closed by a real call, nowhere in this repo.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { loadWorker, makeCtx } from "./worker-harness.mjs";

const ROOT = new URL("../../", import.meta.url);
const TEMPLATE = path.join(ROOT.pathname, "builder/lovable/template");
const rootRequire = createRequire(import.meta.url);
const ts = rootRequire("typescript");

/**
 * The template's own packages first — the shape the real bundle sees — then the
 * root's, which CI installs. NEITHER IS A SKIP: `@tanstack/react-query` is a
 * root devDependency for exactly this reason, beside `react`, `react-dom` and
 * `react-hook-form`, which are there for the other render guards. A guard that
 * never runs in CI proves nothing there.
 */
function resolver() {
  const tries = [];
  try {
    const r = createRequire(path.join(TEMPLATE, "package.json"));
    r.resolve("react"); r.resolve("react-dom/server"); r.resolve("@tanstack/react-query");
    tries.push(r);
  } catch { /* not installed here */ }
  tries.push(rootRequire);
  return (id) => {
    let last;
    for (const r of tries) { try { return r(id); } catch (e) { last = e; } }
    throw new Error("cannot load " + id + " from the template or the root: " + (last && last.message));
  };
}

function transpile(src, fileName) {
  return ts.transpileModule(src, {
    fileName,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
}

let rowsJs = null;
/**
 * The kit's own `rows.ts`, compiled to something Node can run.
 *
 * ⚠ `import.meta` IS THE ONE SUBSTITUTION, and it is Node's limitation rather
 * than the product's: TypeScript emits `import.meta.env?.VITE_SITE_SLUG`
 * verbatim under CommonJS, which is a SyntaxError outside a module. The line it
 * appears on is `siteSlug()`'s LAST fallback, reached only when neither the
 * `/s/<slug>` path nor the `<meta name="site-slug">` tag answers — and this
 * render supplies the path, exactly as the platform's own `/s/<slug>/` serving
 * does. Asserted afterwards: no `import.meta` survives, so a second one added
 * to that file cannot slip through unhandled.
 */
function rowsModule() {
  if (rowsJs) return rowsJs;
  const src = fs.readFileSync(path.join(TEMPLATE, "src/lib/rows.ts"), "utf8");
  const js = transpile(src, "rows.ts").split("import.meta").join("({ env: {} })");
  assert.doesNotMatch(js, /import\.meta/, "rows.ts carries an import.meta this render does not handle");
  rowsJs = js;
  return js;
}

/** Run one CommonJS body with a `require` that answers only what it should. */
function run(js, local) {
  const mod = { exports: {} };
  new Function("require", "module", "exports", js)(local, mod, mod.exports);
  return mod.exports;
}

/**
 * The fetch every hop shares, and the ONLY thing in it that stands in for a
 * third party is the last branch.
 *
 * `upstream` collects every request that left the platform, so "the service was
 * never called" is an assertion rather than a hope — which is the whole of what
 * the required-parameter refusal and the missing-key refusal are about.
 */
export async function platformFetch({ slug, api, vault = {}, service, origin = "https://gofarther.dev" }) {
  const worker = await loadWorker();
  const upstream = [];
  const routed = [];
  const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  const fetch_ = async (input, init) => {
    const raw = String(input && input.url ? input.url : input);
    // THE PAGE'S OWN CALL. `send()` asks for a RELATIVE url because a published
    // site is same-origin with its API — which Node's fetch cannot parse, and
    // which is the hop a stubbed `@/lib/rows` skips entirely.
    if (raw.startsWith("/api/")) {
      routed.push(raw);
      const req = new Request(origin + raw, { method: (init && init.method) || "GET", headers: init && init.headers, body: init && init.body });
      return worker.fetch(req, { SITE_SECRETS_KEY: vault.key, SUPABASE_SERVICE_KEY: "k", SUPABASE_ANON_KEY: "a" }, makeCtx());
    }
    // `SUPABASE_URL` IS A MODULE CONSTANT, not an env binding — match on the
    // PATH, which is what the route really asks for whatever host it asks.
    if (raw.includes("/rest/v1/")) {
      if (raw.includes("site_backends")) return json([{ uid: "u-1", brief: "", neon_db: slug.replace(/-/g, "_") }]);
      if (raw.includes("site_project")) return json([{ uid: "u-1", neon_conn: "postgres://u:p@ep-render.neon.tech/neondb" }]);
      return json([{ uid: "u-1" }]);
    }
    if (raw.includes("neon.tech/sql")) {
      const q = (() => { try { return String(JSON.parse(String(init && init.body) || "{}").query || ""); } catch { return ""; } })();
      const name = (() => { try { return (JSON.parse(String(init && init.body) || "{}").params || [])[0]; } catch { return null; } })();
      // ROWS ARE ARRAYS WITH `fields`, which is Neon's own wire shape, and the
      // COLUMN NAME is what the driver maps them onto — a fixture naming the
      // cipher column `v` answers `undefined` and reads as a site with no key.
      const wantSecret = /_secrets/i.test(q);
      const rows = wantSecret
        ? (name && vault.rows && vault.rows[name] ? [[vault.rows[name]]] : [])
        : [[JSON.stringify({ tables: [], apis: [api] })]];
      return json({ command: "SELECT", rowCount: rows.length, rows, fields: [{ name: wantSecret ? "cipher" : "v", dataTypeID: 25 }] });
    }
    upstream.push(raw);
    return service ? service(raw, init) : json({});
  };
  return { fetch: fetch_, upstream, routed };
}

/** A vault the route can really decrypt — `readSecret` DECRYPTS, so a literal
 *  cipher reads as a site whose key does not open rather than one with a key. */
export async function makeVault(secrets, key = "test-vault-key-0123456789") {
  const { encryptSecret } = await import("../../site-secrets.mjs");
  const rows = {};
  for (const [k, v] of Object.entries(secrets || {})) rows[k] = await encryptSecret({ SITE_SECRETS_KEY: key }, v);
  return { key, rows };
}

/**
 * Render one generated page against the real hook and the real route.
 *
 * TWO RENDERS, and the first is not a formality: `renderToStaticMarkup` runs no
 * effects, so the hook's own pending state is what a server render really
 * produces — that IS the loading branch, taken from the product rather than
 * from a stub answering `{isLoading:true}`. Between them every query the render
 * REGISTERED is fetched through its own `queryFn`, which is the one `useApi`
 * built: the key, the url and the parameters are all the hook's.
 *
 * ⚠ TWO HARNESS SETTINGS, BOTH DECLARED AS SETTINGS RATHER THAN SLIPPED IN.
 * `retry: false` — a real site takes TanStack's default of three, which is
 * measured behaviour recorded elsewhere and a delay a test has no reason to sit
 * through. `retryOnMount: false` — MEASURED, and without it the error state is
 * unreachable here: a fresh observer over an errored query presents
 * OPTIMISTICALLY as pending, because a real client would refetch it on mount,
 * so the second render draws the loading branch for ever (status `error`,
 * `isLoading` true). That is react-query's own SSR behaviour and not the page's;
 * a real browser mounts, retries, fails again and draws the error branch, which
 * is the thing this stands in for. A SUCCESS is surfaced with neither setting,
 * so the known-values case owes nothing to either.
 */
export async function renderRouteSource(src, { slug, api, secrets, service, fetch: given } = {}) {
  const req = resolver();
  const React = req("react");
  const server = req("react-dom/server");
  const rq = req("@tanstack/react-query");

  const vault = await makeVault(secrets);
  const plat = given || (await platformFetch({ slug, api, vault, service }));

  const realFetch = globalThis.fetch;
  const realWindow = globalThis.window;
  const realDocument = globalThis.document;
  globalThis.fetch = plat.fetch;
  // WHAT `siteSlug()` READS on a published site served at `/s/<slug>/`, which
  // is the platform's own internal addressing scheme.
  globalThis.window = { location: { pathname: "/s/" + slug + "/", href: "https://gofarther.dev/s/" + slug + "/" } };
  globalThis.document = { querySelector: () => null };
  try {
    const rows = run(rowsModule(), (id) => {
      if (id === "react") return React;
      if (id === "@tanstack/react-query") return rq;
      throw new Error("rows.ts reached for " + id + ", which this render does not provide");
    });
    const page = run(transpile(src, "page.tsx"), (id) => {
      if (id === "@/lib/rows") return rows;
      // THE ROUTER IS SCAFFOLDING HERE and is the one seam that is not the
      // subject: the real `createFileRoute` needs a generated route tree.
      if (id === "@tanstack/react-router") return { createFileRoute: () => (options) => ({ options }) };
      if (id === "react/jsx-runtime") return req("react/jsx-runtime");
      if (id === "react") return React;
      throw new Error("the page reached for " + id + ", which this render does not provide");
    });
    const Page = (page.Route && page.Route.options && page.Route.options.component) || page.Page || page.default;
    assert.equal(typeof Page, "function", "the page source exposes no component: " + Object.keys(page).join(", "));

    const client = new rq.QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
    const tree = React.createElement(rq.QueryClientProvider, { client }, React.createElement(Page));
    const loading = server.renderToStaticMarkup(tree);
    const queries = client.getQueryCache().getAll();
    await Promise.all(queries.map((q) => q.fetch().catch(() => {})));
    const html = server.renderToStaticMarkup(tree);
    return {
      loading, html,
      upstream: plat.upstream, routed: plat.routed,
      keys: queries.map((q) => q.queryKey),
      errors: queries.map((q) => q.state.error).filter(Boolean),
    };
  } finally {
    globalThis.fetch = realFetch;
    if (realWindow === undefined) delete globalThis.window; else globalThis.window = realWindow;
    if (realDocument === undefined) delete globalThis.document; else globalThis.document = realDocument;
  }
}
