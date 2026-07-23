// Persistent per-project memory — upgrade #6.
//
// A compact, STRUCTURED record of what a generated site IS: its routes, data tables, components, and design
// tokens — PLUS the things that accumulate over an editing conversation and can't be re-derived from files:
// DECISIONS ("dark studio theme, pink→amber accents"), USER PREFERENCES ("keep copy terse"), and DON'T-TOUCH
// rules ("never rename the booking form fields"). Injected into build/revise prompts so multi-turn edits stay
// coherent — the model stops re-deriving routes, drifting the palette, or violating a locked decision.
//
// Pairs with incremental-edit.mjs (#4): #4 decides WHICH files to send, #6 tells the model the project-level
// constraints those edits must respect. WORKER-SAFE: pure string/JSON, no node:module. $0-testable.

// ── Deterministic extractors ──
export function extractRoutes(files) {
  const app = files["src/App.jsx"] || "";
  return [...new Set([...app.matchAll(/path=["'`]([^"'`]+)["'`]/g)].map((m) => m[1]))];
}

export function extractTables(files) {
  const key = Object.keys(files).find((k) => /(^|\/)isibi\.schema\.json$/i.test(k));
  if (!key) return [];
  let spec = null; try { spec = JSON.parse(files[key]); } catch { return []; }
  if (!spec || !Array.isArray(spec.tables)) return [];
  return spec.tables.map((t) => ({
    name: String(t.name || ""),
    access: String(t.access || ""),
    columns: Array.isArray(t.columns) ? t.columns.map((c) => String(c.name || "")).filter(Boolean) : [],
  })).filter((t) => t.name);
}

export function extractComponents(files) {
  const out = [];
  for (const p of Object.keys(files)) {
    if (!/^src\/(components|pages)\/.+\.jsx$/.test(p)) continue;
    const src = files[p];
    const name = (src.match(/export default function\s+([A-Za-z0-9]+)/) || [])[1] || p.split("/").pop().replace(/\.jsx$/, "");
    out.push(name);
  }
  return [...new Set(out)];
}

export function extractTokens(files) {
  const tw = files["tailwind.config.js"] || "";
  const html = files["index.html"] || "";
  const css = files["src/index.css"] || "";
  // Colors: hex literals declared in the tailwind theme (fallback to any hex in the config/css).
  const colors = [...new Set([...(tw + css).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase()))].slice(0, 8);
  // Fonts: tailwind fontFamily entries + any Google Fonts family loaded in index.html.
  const fonts = new Set();
  for (const m of tw.matchAll(/["'`]([A-Z][A-Za-z0-9 ]+)["'`]\s*,\s*["'`]?(?:sans-serif|serif|monospace|system-ui)/g)) fonts.add(m[1].trim());
  for (const m of html.matchAll(/family=([A-Za-z0-9+]+)/g)) fonts.add(m[1].replace(/\+/g, " ").trim());
  return { colors, fonts: [...fonts].filter(Boolean).slice(0, 4) };
}

// buildProjectMemory(files, extra) — derive structural memory from the current files, merged with accumulated
// conversation context (decisions/preferences/dontTouch carried in `extra`).
export function buildProjectMemory(files = {}, extra = {}) {
  return {
    name: extra.name || (files["index.html"] || "").match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || "",
    routes: extractRoutes(files),
    tables: extractTables(files),
    components: extractComponents(files),
    tokens: extractTokens(files),
    decisions: dedupeStrings(extra.decisions),
    preferences: dedupeStrings(extra.preferences),
    dontTouch: dedupeStrings(extra.dontTouch),
  };
}

function dedupeStrings(a) { return [...new Set((Array.isArray(a) ? a : []).map((s) => String(s).trim()).filter(Boolean))]; }

// mergeProjectMemory(prev, files) — refresh the DERIVED structure from the latest files while CARRYING FORWARD the
// accumulated decisions/preferences/dontTouch (those don't live in the files).
export function mergeProjectMemory(prev = {}, files = {}) {
  return buildProjectMemory(files, { name: prev.name, decisions: prev.decisions, preferences: prev.preferences, dontTouch: prev.dontTouch });
}

// Accumulators (return a NEW memory; don't mutate).
export function recordDecision(memory, text) { return { ...memory, decisions: dedupeStrings([...(memory.decisions || []), text]) }; }
export function addPreference(memory, text) { return { ...memory, preferences: dedupeStrings([...(memory.preferences || []), text]) }; }
export function addDontTouch(memory, text) { return { ...memory, dontTouch: dedupeStrings([...(memory.dontTouch || []), text]) }; }

// memoryToPromptLine(memory, opts) — a compact block injected into a build/revise prompt so the model keeps the
// project consistent. Bounded length. Returns "" when there's nothing worth saying.
export function memoryToPromptLine(memory = {}, opts = {}) {
  const cap = opts.cap || 1400;
  const L = [];
  if (memory.routes && memory.routes.length) L.push("- Routes that already exist: " + memory.routes.join(", "));
  if (memory.tables && memory.tables.length) L.push("- Data tables: " + memory.tables.slice(0, 12).map((t) => t.name + "(" + (t.columns || []).slice(0, 8).join(", ") + ")").join("; "));
  if (memory.components && memory.components.length) L.push("- Components: " + memory.components.slice(0, 20).join(", "));
  const tk = memory.tokens || {};
  const tokBits = [tk.colors && tk.colors.length && ("palette " + tk.colors.slice(0, 6).join(" ")), tk.fonts && tk.fonts.length && ("fonts " + tk.fonts.join(", "))].filter(Boolean);
  if (tokBits.length) L.push("- Design tokens: " + tokBits.join("; "));
  if (memory.decisions && memory.decisions.length) L.push("- Established decisions (keep): " + memory.decisions.slice(0, 8).join("; "));
  if (memory.dontTouch && memory.dontTouch.length) L.push("- DO NOT change: " + memory.dontTouch.slice(0, 8).join("; "));
  if (memory.preferences && memory.preferences.length) L.push("- Owner preferences: " + memory.preferences.slice(0, 6).join("; "));
  if (!L.length) return "";
  const body = "PROJECT MEMORY (this site already exists — keep all of the following CONSISTENT unless the change request explicitly says otherwise):\n" + L.join("\n");
  return body.length > cap ? body.slice(0, cap) : body;
}
