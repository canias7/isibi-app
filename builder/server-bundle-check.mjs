// THE SITE'S SERVER CODE, ASKED THROUGH THE BUILT SITE (2026-10-30).
//
// After a good `vite build`, each server function is asked once through the
// bundle the site will really run (`dist/server/server.js`), in a sandboxed
// child (`server-bundle-child.mjs`) where every network call, key, file and row
// is faked. The dry run (`server-dryrun.mjs`) runs each part alone; this catches
// what only the built site shows — the real route, the real `site` helper, a
// part the bundle left out. Its results are folded into the dry run's
// (`mergeBundleResults`), so the reply, the evidence and the one repair round
// read them as they read the dry run's. Evidence only: never a refusal.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderAs } from "./site-ssr.mjs";
import { isServerPart, keysAsked } from "./server-code.mjs";
import { hooksIn } from "./server-dryrun.mjs";

export const BUNDLE_CHILD = path.join(path.dirname(fileURLToPath(import.meta.url)), "server-bundle-child.mjs");
export const BUNDLE_CHECK_MS = 30_000;

/** Ask each server part once through the built bundle. Never throws; `{ ran:false, why }` when it could not. */
export async function bundleCheckServerParts(bundle, slug, parts, { spawnFn = spawn, timeoutMs = BUNDLE_CHECK_MS } = {}) {
  const list = (Array.isArray(parts) ? parts : []).filter(isServerPart);
  if (!list.length) return { ran: false, why: "none", results: [] };
  const s = /^[a-z0-9][a-z0-9-]{0,80}$/i.test(String(slug || "")) ? String(slug).toLowerCase() : "";
  if (!s) return { ran: false, why: "no site address to ask", results: [] };
  const fns = list.map((p) => ({
    name: p.name.replace(/^server-/, ""), keys: keysAsked(p.source), hooks: hooksIn(p.source),
    visitors: /export\s+const\s+visitors\s*=\s*true/.test(String(p.source || "")),
  }));
  const as = renderAs();
  return new Promise((resolve) => {
    let out = "", done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    let child;
    try {
      child = spawnFn(process.execPath, ["--permission", "--allow-fs-read=" + BUNDLE_CHILD, "--allow-fs-read=" + path.dirname(String(bundle)) + "/*", BUNDLE_CHILD, String(bundle)], {
        env: {}, stdio: ["pipe", "pipe", "ignore"], ...(as ? { uid: as.uid, gid: as.gid } : {}),
      });
    } catch (e) { return finish({ ran: false, why: "could not start: " + String((e && e.message) || e).slice(0, 120), results: [] }); }
    const timer = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* gone */ } finish({ ran: false, why: "timed out", results: [] }); }, timeoutMs);
    child.stdout.on("data", (d) => { out += d; if (out.length > 1_000_000) { try { child.kill("SIGKILL"); } catch { /* gone */ } } });
    child.on("error", (e) => { clearTimeout(timer); finish({ ran: false, why: String((e && e.message) || e).slice(0, 120), results: [] }); });
    child.on("close", () => {
      clearTimeout(timer);
      let j;
      try { j = JSON.parse(out); } catch { return finish({ ran: false, why: "no answer", results: [] }); }
      if (j && j.fatal) return finish({ ran: false, why: String(j.fatal).slice(0, 200), results: [] });
      finish({ ran: true, unprivileged: !!as, results: Array.isArray(j && j.results) ? j.results : [] });
    });
    child.stdin.end(JSON.stringify({ slug: s, fns }));
  });
}

/**
 * The dry run's results with the built site's folded in: a function the dry run
 * passed but the built site failed takes the built site's failure (`via:
 * "bundle"`); a dry-run failure stays (it names the part's own fault). The
 * bundle's own state rides along as `bundle`.
 */
export function mergeBundleResults(dry, bundle) {
  if (!bundle || bundle.why === "none") return dry;
  // What the built site itself said, by name, beside the folded results.
  const b = bundle.ran
    ? { ran: true, passed: bundle.results.filter((r) => r.ok).map((r) => r.name), failed: bundle.results.filter((r) => !r.ok).map((r) => r.name) }
    : { ran: false, why: String(bundle.why || "") };
  if (!dry || !dry.ran) return bundle.ran ? { ran: true, results: bundle.results.map((r) => (r.ok ? r : { ...r, via: "bundle" })), bundle: b } : { ...(dry || { ran: false, why: "none", results: [] }), bundle: b };
  const byName = new Map(bundle.ran ? bundle.results.map((r) => [r.name, r]) : []);
  const results = (dry.results || []).map((r) => {
    const x = byName.get(r.name);
    return r && r.ok && x && !x.ok ? { ...r, ok: false, error: "through the built site: " + x.error, kind: x.kind, via: "bundle", ...(x.status ? { status: x.status } : {}) } : r;
  });
  return { ...dry, results, bundle: b };
}
