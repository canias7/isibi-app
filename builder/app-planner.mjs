// App planner — a standalone planning layer (ChatGPT meta-layer #2). Before any code is generated, planApp()
// turns a build intent into a COMPLETE, VALIDATED app spec: capabilities, tables, roles, pages, permissions,
// workflows, integrations, and design hints. It is deterministic and $0 — it reasons over the capability
// registry (#1) rather than calling a model — so it can run on every build as a cheap, structured first pass
// that the generator consumes. (A model refinement pass can layer on top later; the spec shape stays the same.)
import { selectCapabilities, getCapability } from "./capability-registry.mjs";

// A tiny keyword→integration hint map (deterministic; extend freely).
const INTEGRATION_HINTS = [
  [/instagram|ig\b|social media/i, "instagram"],
  [/stripe|payment|checkout|subscription|billing/i, "stripe"],
  [/email|newsletter|notify/i, "email"],
  [/map|location|geo|nearby/i, "maps"],
  [/calendar|schedule|booking|appointment/i, "calendar"],
];

// Turn a capability's access array into the roles that can WRITE to it.
function writersOf(cap) {
  const w = new Set();
  if (cap.access.includes("admin")) w.add("admin");
  if (cap.access.includes("member")) w.add("member");
  // public-write is rare in this API (mostly reads + collect); treat public as reader unless it's the only role.
  if (cap.access.length === 1 && cap.access[0] === "public") w.add("visitor");
  return [...w];
}

// planApp(intent, opts) → a full app spec.
//   opts.capabilityLimit (default 10) — how many capabilities to pull for the app.
//   opts.name — an app name (else derived).
export function planApp(intent, opts = {}) {
  const text = String(intent || "").trim();
  if (!text) return { ok: false, error: "an intent is required", spec: null };

  const limit = opts.capabilityLimit != null ? opts.capabilityLimit : 10;
  // A higher score floor keeps the spec focused on capabilities the intent actually implies (not weak 1-token hits).
  const minScore = opts.minScore != null ? opts.minScore : 3;
  const picked = selectCapabilities(text, { limit, minScore }).map((r) => r.capability);

  // Roles: derive from the union of capability access. Everyone gets 'visitor'; add member/admin as needed.
  const roleSet = new Set(["visitor"]);
  for (const c of picked) { if (c.access.includes("member")) roleSet.add("member"); if (c.access.includes("admin")) roleSet.add("admin"); }
  const roles = ["visitor", "member", "admin"].filter((r) => roleSet.has(r));

  // Tables: the union of every selected capability's tables (the data model the app will touch).
  const tables = [...new Set(picked.flatMap((c) => c.tables))].sort();

  // Permissions: for each role, which capabilities it may write.
  const permissions = roles.map((role) => ({
    role,
    can_write: picked.filter((c) => writersOf(c).includes(role)).map((c) => c.id),
    can_read: picked.filter((c) => c.access.includes("public") || (role === "member" && c.access.includes("member")) || role === "admin").map((c) => c.id),
  }));

  // Pages: a Home page, auth pages when membership is used, an admin console when admin caps exist, and one
  // feature page per capability (deduped by title). Keeps the spec concrete for the generator.
  const pages = [{ name: "Home", path: "/", purpose: "Landing + entry point", capabilities: [] }];
  if (roles.includes("member")) { pages.push({ name: "SignIn", path: "/signin", purpose: "Member auth", capabilities: ["auth"] }); }
  for (const c of picked) {
    if (c.id === "auth" || c.id === "rows") continue;
    pages.push({ name: pascal(c.id), path: "/" + c.id, purpose: c.title, capabilities: [c.id] });
  }
  if (roles.includes("admin")) pages.push({ name: "Admin", path: "/admin", purpose: "Admin console", capabilities: picked.filter((c) => c.access.includes("admin")).map((c) => c.id) });

  // Workflows: derive user-facing flows from the capability routes (verb per method).
  const workflows = [];
  for (const c of picked.slice(0, 8)) {
    for (const rt of c.routes.slice(0, 3)) {
      const actor = /ADMIN/i.test(rt.desc || "") ? "admin" : /member/i.test(rt.desc || "") ? "member" : "anyone";
      workflows.push({ actor, action: verb(rt.method) + " " + c.id, via: `${rt.method} ${rt.path}` });
    }
  }

  // Integrations from the intent.
  const integrations = INTEGRATION_HINTS.filter(([re]) => re.test(text)).map(([, name]) => name);

  const spec = {
    name: opts.name || deriveName(text),
    intent: text,
    capabilities: picked.map((c) => c.id),
    tables,
    roles,
    pages,
    permissions,
    workflows,
    integrations,
    design_hints: deriveDesignHints(text),
  };
  const validation = validateSpec(spec);
  return { ok: validation.ok, errors: validation.errors, spec };
}

// validateSpec — structural sanity of a spec (used before the spec is trusted downstream).
export function validateSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== "object") return { ok: false, errors: ["spec is not an object"] };
  if (!Array.isArray(spec.capabilities) || !spec.capabilities.length) errors.push("no capabilities selected");
  for (const id of spec.capabilities || []) if (!getCapability(id)) errors.push(`capability "${id}" is not real`);
  if (!Array.isArray(spec.pages) || !spec.pages.length) errors.push("no pages");
  if (!spec.pages?.some((p) => p.path === "/")) errors.push("no home page");
  const paths = new Set();
  for (const p of spec.pages || []) { if (paths.has(p.path)) errors.push(`duplicate page path ${p.path}`); paths.add(p.path); }
  if (!Array.isArray(spec.roles) || !spec.roles.includes("visitor")) errors.push("roles must include visitor");
  // Every page capability must be real + selected.
  for (const p of spec.pages || []) for (const c of p.capabilities || []) if (!spec.capabilities.includes(c) && c !== "auth") errors.push(`page ${p.name} references unselected capability ${c}`);
  return { ok: errors.length === 0, errors };
}

// specToPrompt — render the spec as a compact planning brief the generator can consume alongside its rules.
export function specToPrompt(spec) {
  if (!spec) return "";
  const L = [];
  L.push(`APP: ${spec.name}`);
  L.push(`GOAL: ${spec.intent}`);
  L.push(`ROLES: ${spec.roles.join(", ")}`);
  L.push(`CAPABILITIES: ${spec.capabilities.join(", ")}`);
  if (spec.integrations.length) L.push(`INTEGRATIONS: ${spec.integrations.join(", ")}`);
  L.push("PAGES:");
  for (const p of spec.pages) L.push(`  - ${p.name} (${p.path}) — ${p.purpose}${p.capabilities.length ? " [" + p.capabilities.join(", ") + "]" : ""}`);
  L.push("PERMISSIONS:");
  for (const pm of spec.permissions) L.push(`  - ${pm.role}: writes [${pm.can_write.join(", ") || "—"}]`);
  if (spec.workflows.length) { L.push("KEY WORKFLOWS:"); for (const w of spec.workflows.slice(0, 10)) L.push(`  - ${w.actor}: ${w.action}`); }
  return L.join("\n");
}

// ── helpers ──
function pascal(s) { return s.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(""); }
function verb(method) { return { GET: "view", POST: "create", PATCH: "update", PUT: "update", DELETE: "remove" }[method] || method.toLowerCase(); }
function deriveName(text) {
  const words = text.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !/^(with|that|your|this|from|make|build|create|want|need|able|they|them|will)$/i.test(w));
  return (words.slice(0, 2).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "App").slice(0, 40);
}
function deriveDesignHints(text) {
  const hints = {};
  if (/dark|night|studio|neon/i.test(text)) hints.mode = "dark";
  if (/minimal|clean|simple/i.test(text)) hints.style = "minimal";
  if (/playful|fun|kids|game/i.test(text)) hints.style = "playful";
  if (/luxury|premium|elegant/i.test(text)) hints.style = "elegant";
  const m = text.match(/\b(blue|red|green|pink|purple|orange|amber|teal|black|white)\b/i);
  if (m) hints.accent = m[1].toLowerCase();
  return hints;
}
