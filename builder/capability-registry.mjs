// Capability registry — the structured, machine-readable catalog of every per-site Data API capability, plus a
// SELECTION function so the generator can pull only the capabilities relevant to a build instead of dumping the
// entire ~236 KB BACKEND_RULES prompt. The data is generated from worker.js (the source of truth) by
// builder/build-capability-registry.mjs; this module adds lookup + ranked selection on top.
//
// Worker-safe: imports a plain JS data module (no fs, no JSON import attributes), so it runs on Cloudflare.
import { CAPABILITIES } from "./capability-registry.data.mjs";

export { CAPABILITIES };

// id → entry, for O(1) lookup.
const BY_ID = new Map(CAPABILITIES.map((c) => [c.id, c]));
export function getCapability(id) { return BY_ID.get(id) || null; }

// A small stop list so scoring keys on meaningful terms, not filler.
const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "that", "this", "your",
  "you", "it", "its", "is", "are", "be", "can", "each", "per", "all", "any", "one", "so", "but", "not", "no",
  "reads", "read", "write", "writes", "admin", "member", "public", "api", "db", "slug", "get", "post", "delete",
  "patch", "put", "row", "rows", "table", "returns", "return"]);

// Tokenize a blob of text into a de-duplicated set of lower-case word stems (naive: trailing-s stripped).
function tokens(text) {
  const out = new Set();
  for (let w of String(text || "").toLowerCase().match(/[a-z0-9]+/g) || []) {
    if (w.length < 2 || STOP.has(w)) continue;
    out.add(w);
    if (w.length > 3 && w.endsWith("s")) out.add(w.slice(0, -1)); // crude singular
  }
  return out;
}

// Pre-index each capability's searchable text once (id words weighted highest, then title, then summary/routes).
const INDEX = CAPABILITIES.map((c) => {
  const idWords = tokens(c.id.replace(/-/g, " "));
  const titleWords = tokens(c.title);
  const bodyWords = tokens((c.summary || "") + " " + c.routes.map((r) => r.desc || "").join(" "));
  return { cap: c, idWords, titleWords, bodyWords };
});

// selectCapabilities(intent, opts) — rank capabilities by how well they match a free-text intent.
//   opts.limit (default 12) — max results.  opts.minScore (default 1) — drop weak matches.
//   opts.access — if set (e.g. "admin"), only capabilities offering that access role.
// Scoring: an intent term matching a capability's id is worth 5, its title 3, its body 1. Deterministic.
export function selectCapabilities(intent, opts = {}) {
  const limit = opts.limit != null ? opts.limit : 12;
  const minScore = opts.minScore != null ? opts.minScore : 1;
  const want = tokens(intent);
  if (!want.size) return [];
  const scored = [];
  for (const entry of INDEX) {
    if (opts.access && !entry.cap.access.includes(opts.access)) continue;
    let score = 0;
    for (const w of want) {
      if (entry.idWords.has(w)) score += 5;
      else if (entry.titleWords.has(w)) score += 3;
      else if (entry.bodyWords.has(w)) score += 1;
    }
    if (score >= minScore) scored.push({ id: entry.cap.id, title: entry.cap.title, score, capability: entry.cap });
  }
  // Highest score first; ties broken alphabetically for stable output.
  scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  return scored.slice(0, limit);
}

// Render the selected capabilities as a compact prompt fragment (routes + a one-line summary each), so a build
// prompt can include ONLY the relevant slice of the catalog rather than the whole thing.
export function capabilityPrompt(ids) {
  const list = (Array.isArray(ids) ? ids : [ids]).map((x) => (typeof x === "string" ? getCapability(x) : x)).filter(Boolean);
  return list.map((c) => {
    const routes = c.routes.map((r) => `  ${r.method} ${r.path}${r.desc ? " — " + r.desc : ""}`).join("\n");
    return `### ${c.title} (${c.id}) [${c.access.join("/")}]\n${c.summary || ""}\n${routes}`.trim();
  }).join("\n\n");
}

// Registry-wide stats (used by tests + tooling).
export function registryStats() {
  return {
    count: CAPABILITIES.length,
    stateful: CAPABILITIES.filter((c) => c.stateful).length,
    stateless: CAPABILITIES.filter((c) => !c.stateful).length,
    withRoutes: CAPABILITIES.filter((c) => c.routes.length).length,
    withTests: CAPABILITIES.filter((c) => c.tests.length).length,
  };
}
