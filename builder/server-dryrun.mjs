// THE TEST RUN OF THE SITE'S OWN SERVER CODE (2026-10-28).
//
// Pages get a real browser before they go live; server code gets this. Each
// `server-<name>` part is transpiled on its own (server code imports nothing —
// `server-code.mjs` refuses an import) and run once in a sandboxed child
// (`server-dryrun-child.mjs`) against a fake `site` helper: a request for a
// visitor-callable function, the sample event for each hook. Nothing leaves:
// outside calls are answered in the child, no key exists, the database answers
// no rows. The result says whether it ran, what failed, which keys it asked for
// and which hosts it called — evidence for the reply and the fix loop.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { renderAs } from "./site-ssr.mjs";
import { isServerPart } from "./server-code.mjs";

export const DRYRUN_CHILD = path.join(path.dirname(fileURLToPath(import.meta.url)), "server-dryrun-child.mjs");
export const DRYRUN_MS = 30_000;

/** The `on` list a part's source declares (quoted items only). */
export function hooksIn(source) {
  const m = String(source || "").match(/export\s+const\s+on\s*(?::[^=]+)?=\s*\[([^\]]*)\]/);
  return m ? (m[1].match(/(["'])([^"']*)\1/g) || []).map((q) => q.slice(1, -1)) : [];
}

/** TypeScript to plain JavaScript; `ts` is handed in (the template's compiler). */
export function toJs(ts, source) {
  return ts.transpileModule(String(source || ""), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
}

/** Run every server part once. Never throws; `{ ran:false, why }` when it could not. */
export async function dryRunServerParts(parts, { ts = null, spawnFn = spawn, timeoutMs = DRYRUN_MS } = {}) {
  const list = (Array.isArray(parts) ? parts : []).filter(isServerPart);
  if (!list.length) return { ran: false, why: "none", results: [] };
  let compiler = ts;
  if (!compiler) {
    try { compiler = createRequire(import.meta.url)("typescript"); } catch { return { ran: false, why: "no compiler", results: [] }; }
  }
  const items = list.map((p) => ({ name: p.name.replace(/^server-/, ""), js: toJs(compiler, p.source), hooks: hooksIn(p.source) }));
  const as = renderAs();
  return new Promise((resolve) => {
    let out = "", done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    let child;
    try {
      child = spawnFn(process.execPath, ["--permission", "--allow-fs-read=" + DRYRUN_CHILD, DRYRUN_CHILD], {
        env: {}, stdio: ["pipe", "pipe", "ignore"], ...(as ? { uid: as.uid, gid: as.gid } : {}),
      });
    } catch (e) { return finish({ ran: false, why: "could not start: " + String((e && e.message) || e).slice(0, 120), results: [] }); }
    const timer = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* gone */ } finish({ ran: false, why: "timed out", results: [] }); }, timeoutMs);
    child.stdout.on("data", (d) => { out += d; if (out.length > 1_000_000) { try { child.kill("SIGKILL"); } catch { /* gone */ } } });
    child.on("error", (e) => { clearTimeout(timer); finish({ ran: false, why: String((e && e.message) || e).slice(0, 120), results: [] }); });
    child.on("close", () => {
      clearTimeout(timer);
      try { const j = JSON.parse(out); finish({ ran: true, unprivileged: !!as, results: Array.isArray(j.results) ? j.results : [] }); }
      catch { finish({ ran: false, why: "no answer", results: [] }); }
    });
    child.stdin.end(JSON.stringify(items));
  });
}
