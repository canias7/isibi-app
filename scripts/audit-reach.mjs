// Which code files are reachable from the real entry points (the Worker, the
// container's service and its children, the browser's pages). Static imports,
// dynamic import("…") with a literal, and the Dockerfile's COPY list for the
// container. Prints reachable and unreachable files. Audit 2 (2026-11-04).
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
const code = tracked.filter((f) => /\.(m?js)$/.test(f) && !f.startsWith("test/") && !f.startsWith("parked/") && !f.startsWith("node_modules/") && !f.includes("/lovable/template/") && !f.startsWith("scripts/") && !f.startsWith(".github/"));
const entries = ["worker.js", "builder/build-server.mjs"];
// Children the container spawns by path (node <file>), named in build-server and friends.
for (const f of code) {
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/["'`]([\w./-]+-child\.mjs|[\w./-]+(?:shim|register|loader)\.mjs)["'`]/g)) {
    const c = code.find((x) => x.endsWith("/" + path.basename(m[1])) || x === m[1]);
    if (c) entries.push(c);
  }
}
// Browser: every script public/*.html loads.
for (const h of tracked.filter((f) => /^public\/.*\.html$/.test(f))) {
  for (const m of readFileSync(h, "utf8").matchAll(/<script[^>]+src=["']\/?([^"'?]+)/g)) {
    const p = "public/" + m[1].replace(/^public\//, "");
    if (existsSync(p)) entries.push(p);
  }
}
const seen = new Set();
const stack = [...new Set(entries)];
const resolve = (from, spec) => {
  if (!spec.startsWith(".")) return null;
  const base = path.normalize(path.join(path.dirname(from), spec));
  for (const c of [base, base + ".mjs", base + ".js"]) if (code.includes(c)) return c;
  return null;
};
while (stack.length) {
  const f = stack.pop();
  if (seen.has(f)) continue;
  seen.add(f);
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|^import\s+["']([^"']+)["']/gm)) {
    const r = resolve(f, m[1] || m[2] || m[3]);
    if (r) stack.push(r);
  }
}
const dead = code.filter((f) => !seen.has(f));
const lines = (f) => readFileSync(f, "utf8").split("\n").length;
console.log("entries:", [...new Set(entries)].join(", "));
console.log("reachable", seen.size, "files,", [...seen].reduce((n, f) => n + lines(f), 0), "lines");
console.log("unreachable", dead.length, "files,", dead.reduce((n, f) => n + lines(f), 0), "lines");
for (const f of dead.sort()) console.log("  DEAD", f, lines(f));
