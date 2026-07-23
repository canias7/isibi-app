// Design system tests — style families are well-formed and WCAG-AA safe, family picking maps hints correctly,
// token emission works, the component/layout registries are sound, and the design brief renders. Pure.
import { makeTally } from "./harness.mjs";
import {
  STYLE_FAMILIES, getStyleFamily, COMPONENT_REGISTRY, LAYOUT_PATTERNS, RESPONSIVE_RULES,
  pickStyleFamily, tokensToCssVars, tokensToTailwindTheme, designBrief, wcagContrast, critiqueTokens,
} from "../../builder/design-system.mjs";

const t = makeTally("Design system");

// --- Families well-formed + WCAG AA ---
t.ok(STYLE_FAMILIES.length >= 4, `has style families (${STYLE_FAMILIES.length})`);
let allAA = true, structOk = true;
const ids = new Set();
for (const f of STYLE_FAMILIES) {
  if (!f.id || ids.has(f.id)) structOk = false; ids.add(f.id);
  for (const k of ["bg", "surface", "text", "muted", "accent", "accentFg", "border", "radius", "fontDisplay", "fontBody"]) if (f.tokens[k] == null) structOk = false;
  if (!critiqueTokens(f.id).ok) allAA = false;
}
t.ok(structOk, "every family has a complete token set + unique id");
t.ok(allAA, "every family meets WCAG AA (text-on-bg and accent-fg both ≥ 4.5:1)");

// --- wcagContrast sanity ---
t.eq(Math.round(wcagContrast("#000000", "#ffffff")), 21, "black on white is 21:1");
t.ok(wcagContrast("#777777", "#ffffff") < 4.5, "mid-grey on white fails AA");

// --- critiqueTokens flags a bad family ---
const bad = critiqueTokens({ tokens: { text: "#cccccc", bg: "#ffffff", accentFg: "#ffffff", accent: "#f0f0f0" } });
t.eq(bad.ok, false, "a low-contrast family is flagged");
t.ok(bad.issues.length >= 1, "…with issues listed");

// --- pickStyleFamily ---
t.eq(pickStyleFamily({ mode: "dark" }), "studio-dark", "dark hint → studio-dark");
t.eq(pickStyleFamily({ style: "minimal" }), "minimal-light", "minimal hint → minimal-light");
t.eq(pickStyleFamily({ style: "playful" }), "playful", "playful hint → playful");
t.eq(pickStyleFamily("a premium luxury dark brand"), "elegant-dark", "luxury+dark text → elegant-dark");
t.eq(pickStyleFamily({}), "minimal-light", "no hints → a sane default");

// --- Token emission ---
const css = tokensToCssVars("studio-dark");
t.ok(/--accent:#ff79c6/.test(css), "CSS vars carry the accent token");
t.ok(/:root\{/.test(css), "…as :root custom properties");
const tw = tokensToTailwindTheme("minimal-light");
t.ok(/colors:\{/.test(tw) && /accent:'#1d4ed8'/.test(tw), "tailwind theme carries the tokens");
t.ok(/fontFamily:\{/.test(tw), "…and the font families");
t.eq(tokensToCssVars("nope"), "", "an unknown family emits nothing");

// --- Component + layout registries ---
t.ok(COMPONENT_REGISTRY.length >= 10, "component registry is populated");
t.ok(COMPONENT_REGISTRY.some((c) => c.id === "EmptyState"), "…includes EmptyState (no blank screens)");
t.ok(new Set(COMPONENT_REGISTRY.map((c) => c.id)).size === COMPONENT_REGISTRY.length, "component ids are unique");
t.ok(LAYOUT_PATTERNS.length >= 5, "layout patterns are populated");
t.ok(RESPONSIVE_RULES.length >= 4, "responsive rules are present");

// --- Design brief renders the vocabulary ---
const brief = designBrief("studio-dark");
t.ok(/DESIGN FAMILY: Studio Dark/.test(brief), "brief names the family");
t.ok(/TOKENS:/.test(brief) && /COMPONENTS/.test(brief) && /LAYOUTS:/.test(brief) && /RESPONSIVE:/.test(brief), "brief has all sections");
t.ok(/#ff79c6/.test(brief), "…and the concrete accent token");

t.done();
