// THE WORKER MODULE, IMPORTED UNDER NODE — the loader hooks that make it resolve.
//
// ── WHY THE WORKER'S OWN CODE RUNS IN THE CONTAINER (2026-09-04) ─────────────
//
// Owner: "most of the stuff should be in the users container, not our worker",
// and "yeah that stuff gotta run on container tho". The queue consumer held a
// Worker invocation for the whole of every edit and addon — routing, lanes, the
// page call, translation, the compile wait, the publish — under a fifteen-minute
// ceiling, 250 at a time per queue, and evicted by every deploy. Re-expressing
// that pipeline as resumable steps would have meant a second definition of it.
// Instead the SAME module runs where the work belongs: `worker.js` is imported
// inside the site's container under Node, with its bindings shimmed onto a
// job-scoped gateway back to the Worker (container-env.mjs, job-gateway.mjs),
// and the consumer only fires the job and returns. One definition; the whole
// suite still describes the thing that runs.
//
// ── WHAT THESE HOOKS DO, measured on the spike ─────────────────────────────
//
// `worker.js` imports in 555 ms under Node with exactly three things mapped:
//
//   `cloudflare:*`            → cloudflare-shim.mjs: the Durable Object base class
//                               as a shell; nothing instantiates one on this path.
//   `@cloudflare/containers`  → containers-shim.mjs: `getContainer(…).fetch` is a
//                               plain request to the build service on localhost.
//   `@cf-wasm/photon`         → the package's own Node build. The media side's
//                               image library; the job never calls it, but the
//                               module graph imports it at the top.
//
// And one repair: the containers library's internal `./lib/container` import has
// no extension, which workerd's bundler resolves and Node's resolver refuses.
// A relative specifier Node cannot find is retried with `.js`, `.mjs` and
// `/index.js` — only when the file exists, only for relative paths, so a genuine
// typo still fails as one.
//
// Registered by worker-register.mjs (`node --import`), which is how the runner
// is started. Nothing in the Worker's own code knows it is being loaded this way.

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = new URL(".", import.meta.url);
const CLOUDFLARE_SHIM = new URL("./cloudflare-shim.mjs", HERE).href;
const CONTAINERS_SHIM = new URL("./containers-shim.mjs", HERE).href;

/** Which shim, if any, a specifier maps to. Exported so the mapping is driven. */
export function shimFor(specifier) {
  if (typeof specifier !== "string") return null;
  if (specifier.startsWith("cloudflare:")) return CLOUDFLARE_SHIM;
  if (specifier === "@cloudflare/containers") return CONTAINERS_SHIM;
  return null;
}

/** The candidates tried for an extensionless relative import Node refused. */
export function extensionCandidates(specifier, parentURL) {
  if (typeof specifier !== "string" || !(specifier.startsWith("./") || specifier.startsWith("../"))) return [];
  if (!parentURL || !String(parentURL).startsWith("file:")) return [];
  const base = fileURLToPath(new URL(specifier, parentURL));
  return [base + ".js", base + ".mjs", base + "/index.js"];
}

export async function resolve(specifier, context, next) {
  const shim = shimFor(specifier);
  if (shim) return { url: shim, shortCircuit: true };
  if (specifier === "@cf-wasm/photon") {
    try { return await next("@cf-wasm/photon/node", context); } catch { /* the default export below */ }
  }
  try { return await next(specifier, context); }
  catch (e) {
    if (e && e.code === "ERR_MODULE_NOT_FOUND") {
      for (const cand of extensionCandidates(specifier, context && context.parentURL)) {
        if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
      }
    }
    throw e;
  }
}
