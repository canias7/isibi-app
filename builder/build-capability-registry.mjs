// Build a structured, machine-readable capability registry by extracting it from worker.js — the single source
// of truth for the per-site Data API. Each capability entry captures its routes, tables, access roles, GDPR
// footprint, a human summary, and the batch tests that cover it. Run: `node builder/build-capability-registry.mjs`.
//
// Output: builder/capability-registry.json  (consumed by builder/capability-registry.mjs at runtime).
//
// This is generated, never hand-edited: keeping the registry derived from worker.js means it can never drift
// from the actual routes. A coverage test (test/backend/registry.test.mjs) fails if any route lacks an entry.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const workerSrc = readFileSync(join(ROOT, "worker.js"), "utf8");
const lines = workerSrc.split("\n");

// ── 1. Map every ensureX(env, uuid) helper to the tables it CREATEs.
const ensureTables = {};
{
  const re = /async function (ensure[A-Za-z0-9_]+)\s*\(/g;
  let m;
  while ((m = re.exec(workerSrc))) {
    const name = m[1];
    // Grab the function body (from the match to the next "async function" or a dozen lines, whichever first).
    const start = m.index;
    const nextFn = workerSrc.indexOf("\nasync function ", start + 10);
    const body = workerSrc.slice(start, nextFn === -1 ? start + 4000 : Math.min(nextFn, start + 4000));
    const tables = [...body.matchAll(/CREATE TABLE IF NOT EXISTS (_[a-z0-9_]+)/gi)].map((t) => t[1]);
    ensureTables[name] = [...new Set(tables)];
  }
}

// ── 2. Tables cleared on GDPR account erase (the erase loop is DELETE/UPDATE lines on _tables).
const gdprTables = new Set();
for (const ln of lines) {
  const mm = ln.match(/^\s*\[\s*"(?:DELETE FROM|UPDATE)\s+(_[a-z0-9_]+)/i);
  if (mm) gdprTables.add(mm[1]);
}

// ── 3. Tables a member can export their own rows from (DATA_EXPORT_TABLES).
const exportTables = new Set();
{
  const block = workerSrc.match(/const DATA_EXPORT_TABLES = \[([\s\S]*?)\];/);
  if (block) for (const t of block[1].matchAll(/\["(_[a-z0-9_]+)"/g)) exportTables.add(t[1]);
}

// ── 4. Map each capability segment → the batch test files that exercise it.
const testDir = join(ROOT, "test", "backend");
const testFiles = readdirSync(testDir).filter((f) => /^batch\d+\.test\.mjs$/.test(f));
const testsBySegment = {};
for (const f of testFiles) {
  const src = readFileSync(join(testDir, f), "utf8");
  for (const seg of src.matchAll(/\/api\/db\/\$\{slug\}\/([a-z0-9-]+)/g)) {
    (testsBySegment[seg[1]] ||= new Set()).add(f.replace(".test.mjs", ""));
  }
}

// ── 5. Walk worker.js; each `const X = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/<segment>.../i);` is a
//      capability anchor. Pull the preceding comment header (title + summary + route list) and the block body.
const ANCHOR = /const\s+(\w+)\s*=\s*url\.pathname\.match\(\/\^\\\/api\\\/db\\\/\(\[a-z0-9-\]\{1,60\}\)\\\/([a-z0-9-]+)/;
const ROUTE_LINE = /^\s*\/\/\s+(GET|POST|PATCH|PUT|DELETE)\s+(\/api\/db\/\S+)(?:\s+(.*))?$/;

const caps = {};
for (let i = 0; i < lines.length; i++) {
  const a = lines[i].match(ANCHOR);
  if (!a) continue;
  const varName = a[1], segment = a[2];

  // Collect the contiguous comment block directly above.
  const comment = [];
  for (let j = i - 1; j >= 0 && /^\s*\/\//.test(lines[j]); j--) comment.unshift(lines[j].replace(/^\s*\/\/\s?/, ""));

  // Title + summary from the header prose (everything before the first "METHOD /api/db" route line).
  const routeDescs = [];
  const prose = [];
  for (const cl of comment) {
    const rl = ("// " + cl).match(ROUTE_LINE);
    if (rl) { routeDescs.push({ method: rl[1], path: rl[2], desc: (rl[3] || "").replace(/^→\s*/, "").trim() || null }); }
    else prose.push(cl);
  }
  const proseText = prose.join(" ").replace(/\s+/g, " ").trim();
  let title = null, summary = proseText;
  const dash = proseText.match(/^([A-Z0-9][A-Z0-9 /+&→-]*?)\s+[—-]\s+(.*)$/);
  if (dash) { title = dash[1].trim(); summary = dash[2].trim(); }

  // Block body: from the anchor to the next anchor / dead-letter comment (cap at 400 lines).
  let bodyEnd = i + 1;
  for (; bodyEnd < lines.length && bodyEnd < i + 400; bodyEnd++) {
    if (ANCHOR.test(lines[bodyEnd]) || /WEBHOOK DEAD-LETTER \+ RETRY —/.test(lines[bodyEnd])) break;
  }
  const body = lines.slice(i, bodyEnd).join("\n");

  // Tables via ensureX(...) calls inside the body.
  const tables = new Set();
  for (const e of body.matchAll(/\b(ensure[A-Za-z0-9_]+)\s*\(env,\s*uuid\)/g)) for (const tbl of ensureTables[e[1]] || []) tables.add(tbl);

  // Access roles: from the code (admin gate / auth requirement) + the comment role tags.
  const roles = new Set();
  if (/\(public\)/i.test(comment.join(" ")) || (!/needAdmin|role === "admin"|sign in first|admins only/.test(body))) roles.add("public");
  if (/member\)/i.test(comment.join(" ")) || /sign in first/.test(body)) roles.add("member");
  if (/needAdmin|role === "admin"|admins only|\(ADMIN\)/i.test(body + comment.join(" "))) roles.add("admin");
  if (roles.size === 0) roles.add("public");

  const tbls = [...tables];
  const entry = caps[segment] || {
    id: segment,
    title: title || segment,
    summary: summary || null,
    routes: [],
    tables: [],
    stateful: false,
    access: [],
    gdpr_erased: [],
    exportable: [],
    tests: [],
    source_var: varName,
  };
  entry.title = entry.title || title || segment;
  entry.summary = entry.summary || summary || null;
  for (const rd of routeDescs) if (!entry.routes.some((x) => x.method === rd.method && x.path === rd.path)) entry.routes.push(rd);
  for (const t of tbls) if (!entry.tables.includes(t)) entry.tables.push(t);
  for (const r of roles) if (!entry.access.includes(r)) entry.access.push(r);
  entry.stateful = entry.tables.length > 0;
  entry.gdpr_erased = entry.tables.filter((t) => gdprTables.has(t));
  entry.exportable = entry.tables.filter((t) => exportTables.has(t));
  entry.tests = [...(testsBySegment[segment] || [])].sort();
  caps[segment] = entry;
}

const registry = Object.values(caps).sort((x, y) => (x.id < y.id ? -1 : 1));
const out = {
  generated_from: "worker.js",
  count: registry.length,
  capabilities: registry,
};
// (a) A readable JSON artifact for humans + tests.
writeFileSync(join(ROOT, "builder", "capability-registry.json"), JSON.stringify(out, null, 2) + "\n");
// (b) An ESM data module — the RUNTIME source of truth, importable from worker.js on Cloudflare (no fs there).
const banner = "// GENERATED by builder/build-capability-registry.mjs from worker.js — do not edit by hand.\n" +
  "// Regenerate: node builder/build-capability-registry.mjs\n";
writeFileSync(join(ROOT, "builder", "capability-registry.data.mjs"), banner + "export const CAPABILITIES = " + JSON.stringify(registry) + ";\n");
console.log("capabilities:", registry.length);
console.log("stateful:", registry.filter((c) => c.stateful).length, "| stateless:", registry.filter((c) => !c.stateful).length);
console.log("with routes documented:", registry.filter((c) => c.routes.length).length);
console.log("with tests:", registry.filter((c) => c.tests.length).length);
console.log("no summary:", registry.filter((c) => !c.summary).map((c) => c.id).join(", ") || "(none)");
