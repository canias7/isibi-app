// Design system (ChatGPT meta-layer #3) — the documented design engine the review flagged as missing. It gives
// the generator a consistent, contrast-checked design vocabulary instead of ad-hoc styling per build:
//   • STYLE_FAMILIES  — named token sets (colors/type/radius/shadow), each WCAG-AA safe
//   • COMPONENT_REGISTRY — the reusable component patterns + when to use each
//   • LAYOUT_PATTERNS — named page layouts + when to use each
//   • RESPONSIVE_RULES — breakpoint behavior
//   • pickStyleFamily / tokensToCssVars / tokensToTailwindTheme / designBrief — pick + emit + document
//   • wcagContrast / critiqueTokens — verify a family's own contrast (the deterministic part of "screenshot critique")
// The vision-based screenshot critique + automatic visual repair is a live step (renders + a vision model) and
// layers on top of this; the token/family system is what makes generated apps consistently look intentional.

// ── Style families. Each is a small, deliberate token set. Colors are chosen so body text on the base background
//    and the accent's foreground on the accent both meet WCAG AA (enforced by critiqueTokens + the test suite).
export const STYLE_FAMILIES = [
  { id: "studio-dark", name: "Studio Dark", mood: "sleek, modern, night-mode creative tool",
    tokens: { bg: "#08070c", surface: "#16141c", text: "#f5f3f7", muted: "#a09aad", accent: "#ff79c6", accentFg: "#0a0710", border: "#2a2733", radius: "0.75rem", shadow: "0 8px 30px rgba(0,0,0,.4)", fontDisplay: "'Space Grotesk', system-ui, sans-serif", fontBody: "system-ui, -apple-system, sans-serif" } },
  { id: "minimal-light", name: "Minimal Light", mood: "clean, product, lots of whitespace",
    tokens: { bg: "#ffffff", surface: "#f7f7f8", text: "#18181b", muted: "#5b616e", accent: "#1d4ed8", accentFg: "#ffffff", border: "#e5e7eb", radius: "0.5rem", shadow: "0 1px 3px rgba(0,0,0,.1)", fontDisplay: "system-ui, sans-serif", fontBody: "system-ui, -apple-system, sans-serif" } },
  { id: "warm-editorial", name: "Warm Editorial", mood: "magazine, warm paper, serif headings",
    tokens: { bg: "#faf7f2", surface: "#ffffff", text: "#1c1917", muted: "#6b6259", accent: "#b45309", accentFg: "#ffffff", border: "#e7e2d9", radius: "0.375rem", shadow: "0 2px 8px rgba(0,0,0,.06)", fontDisplay: "Georgia, 'Times New Roman', serif", fontBody: "system-ui, sans-serif" } },
  { id: "playful", name: "Playful", mood: "friendly, rounded, consumer",
    tokens: { bg: "#fffdf7", surface: "#ffffff", text: "#1f2937", muted: "#5b6472", accent: "#7c3aed", accentFg: "#ffffff", border: "#efe9e0", radius: "1rem", shadow: "0 6px 20px rgba(124,58,237,.15)", fontDisplay: "'Poppins', system-ui, sans-serif", fontBody: "system-ui, sans-serif" } },
  { id: "elegant-dark", name: "Elegant Dark", mood: "premium, gold accent, restrained",
    tokens: { bg: "#0c0c0e", surface: "#17171a", text: "#ededed", muted: "#9a9aa2", accent: "#c9a227", accentFg: "#0c0c0e", border: "#26262b", radius: "0.25rem", shadow: "0 10px 40px rgba(0,0,0,.5)", fontDisplay: "'Playfair Display', Georgia, serif", fontBody: "system-ui, sans-serif" } },
];
const FAMILY_BY_ID = new Map(STYLE_FAMILIES.map((f) => [f.id, f]));
export function getStyleFamily(id) { return FAMILY_BY_ID.get(id) || null; }

// ── Component registry — the shared UI vocabulary. Keeps generated apps using a consistent set of patterns.
export const COMPONENT_REGISTRY = [
  { id: "Button", when: "any primary/secondary action", variants: ["primary", "secondary", "ghost", "danger"], note: "accent bg + accentFg text for primary; never a bare unstyled <button>" },
  { id: "Card", when: "group related content in a surface", note: "surface bg, border, radius, subtle shadow" },
  { id: "Input", when: "single-line text entry", note: "label + input + helper/error; border, focus ring in accent" },
  { id: "Select", when: "choose from a fixed set", note: "styled native select or a listbox" },
  { id: "Nav", when: "top-level navigation", note: "logo + links (Link to=), active state in accent" },
  { id: "Table", when: "tabular data", note: "header row muted, zebra optional, right-align numbers (tabular-nums)" },
  { id: "Modal", when: "focused task / confirmation", note: "overlay + surface panel, Esc + backdrop close, focus trap" },
  { id: "EmptyState", when: "a list/collection is empty", note: "icon + one-line explanation + a primary action; never a blank screen" },
  { id: "Toast", when: "transient success/error feedback", note: "bottom-center, auto-dismiss, semantic color (not the accent)" },
  { id: "Badge", when: "status / category label", note: "small, semantic color for state" },
  { id: "Avatar", when: "represent a user", note: "image or initials fallback, rounded-full" },
  { id: "Skeleton", when: "loading a known layout", note: "shaped placeholders, not a spinner, for content that has a layout" },
];

// ── Layout patterns — named page structures.
export const LAYOUT_PATTERNS = [
  { id: "marketing-hero", when: "a landing/home page", structure: "hero (headline + subcopy + primary CTA) → feature grid → footer" },
  { id: "dashboard-grid", when: "an authed overview", structure: "sidebar or top nav → KPI stat row → cards/charts grid" },
  { id: "list-detail", when: "browse then inspect", structure: "a filterable list on the left/top → a detail panel/page" },
  { id: "form-centered", when: "sign-in / create / single-focus form", structure: "a centered card, max-w-md, one primary action" },
  { id: "gallery-grid", when: "images/media", structure: "responsive masonry/grid → lightbox on click" },
  { id: "settings", when: "account/preferences", structure: "sectioned rows (label left, control right), grouped in cards" },
];

// ── Responsive rules.
export const RESPONSIVE_RULES = [
  "Mobile-first: base styles target small screens; add sm:/md:/lg: to scale up.",
  "Grids collapse to one column on mobile (grid-cols-1 md:grid-cols-2 lg:grid-cols-3).",
  "Tap targets ≥ 44px; nav collapses to a menu button under md.",
  "Wide content (tables, code) scrolls inside its own overflow-x-auto container; the page body never scrolls sideways.",
  "Use relative units + max-w-* for readable line length (~65ch for prose).",
];

// pickStyleFamily(hints) — map planner design_hints (or a raw intent) to a family id.
export function pickStyleFamily(hints = {}) {
  const h = typeof hints === "string" ? { _text: hints } : hints;
  const text = (h._text || "").toLowerCase();
  if (h.style === "elegant" || /luxur|premium|elegant|gold/.test(text)) return h.mode === "dark" || /dark/.test(text) ? "elegant-dark" : "warm-editorial";
  if (h.style === "playful" || /playful|fun|kids|friendly/.test(text)) return "playful";
  if (h.style === "minimal" || /minimal|clean|simple/.test(text)) return "minimal-light";
  if (h.mode === "dark" || /dark|night|studio|neon/.test(text)) return "studio-dark";
  if (/magazine|editorial|blog|news|serif|paper/.test(text)) return "warm-editorial";
  return "minimal-light";
}

// tokensToCssVars(id) — emit the family as CSS custom properties (drop into :root / index.css @layer base).
export function tokensToCssVars(id) {
  const f = getStyleFamily(id); if (!f) return "";
  const t = f.tokens;
  return `:root{--bg:${t.bg};--surface:${t.surface};--text:${t.text};--muted:${t.muted};--accent:${t.accent};--accent-fg:${t.accentFg};--border:${t.border};--radius:${t.radius}}`;
}

// tokensToTailwindTheme(id) — emit a tailwind.config theme.extend object (as a JS-literal string) using the tokens.
export function tokensToTailwindTheme(id) {
  const f = getStyleFamily(id); if (!f) return "";
  const t = f.tokens;
  return `theme:{extend:{colors:{bg:'${t.bg}',surface:'${t.surface}',ink:'${t.text}',muted:'${t.muted}',accent:'${t.accent}',accentfg:'${t.accentFg}',line:'${t.border}'},fontFamily:{display:[${jsFont(t.fontDisplay)}],body:[${jsFont(t.fontBody)}]},borderRadius:{DEFAULT:'${t.radius}'},boxShadow:{soft:'${t.shadow}'}}}`;
}
function jsFont(stack) { return stack.split(",").map((s) => `'${s.trim().replace(/^'|'$/g, "")}'`).join(","); }

// designBrief(id, opts) — a compact design brief the generator consumes: family tokens + component vocabulary +
// the chosen layout + responsive rules. Keeps styling consistent + intentional across a build.
export function designBrief(id, opts = {}) {
  const f = getStyleFamily(id) || STYLE_FAMILIES[0];
  const t = f.tokens;
  const layouts = (opts.layouts || LAYOUT_PATTERNS.map((l) => l.id)).map((lid) => LAYOUT_PATTERNS.find((l) => l.id === lid)).filter(Boolean);
  const L = [];
  L.push(`DESIGN FAMILY: ${f.name} — ${f.mood}`);
  L.push(`TOKENS: bg ${t.bg} · surface ${t.surface} · text ${t.text} · muted ${t.muted} · accent ${t.accent} (fg ${t.accentFg}) · border ${t.border} · radius ${t.radius}`);
  L.push(`TYPE: display ${t.fontDisplay} · body ${t.fontBody}`);
  L.push("COMPONENTS (use these, don't reinvent): " + COMPONENT_REGISTRY.map((c) => c.id).join(", "));
  L.push("LAYOUTS:");
  for (const l of layouts) L.push(`  - ${l.id}: ${l.structure}`);
  L.push("RESPONSIVE:");
  for (const r of RESPONSIVE_RULES) L.push(`  - ${r}`);
  return L.join("\n");
}

// ── WCAG contrast (deterministic "does this look right" check on the tokens themselves).
export function relLuminance(hex) {
  const h = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
export function wcagContrast(a, b) {
  const la = relLuminance(a), lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
// critiqueTokens(family) — the family passes if body text on bg and accentFg on accent both meet AA (≥ 4.5:1).
export function critiqueTokens(id) {
  const f = typeof id === "object" ? id : getStyleFamily(id); if (!f) return { ok: false, issues: ["no such family"] };
  const t = f.tokens, issues = [];
  const textBg = wcagContrast(t.text, t.bg);
  const accent = wcagContrast(t.accentFg, t.accent);
  if (textBg < 4.5) issues.push(`text on bg is ${textBg.toFixed(2)}:1 (need ≥ 4.5)`);
  if (accent < 4.5) issues.push(`accentFg on accent is ${accent.toFixed(2)}:1 (need ≥ 4.5)`);
  return { ok: issues.length === 0, issues, textBgContrast: +textBg.toFixed(2), accentContrast: +accent.toFixed(2) };
}
