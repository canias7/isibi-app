// CODER'S DARK THEME, MADE FROM ITS LIGHT ONE (the frontend audit of 2026-11-24: dark mode was mostly unthemed, and the few
// dark rules there were misfired, such as a pale tooltip on a light page). Every colour of the page's style sheets is
// carried into a dark copy of its rule, in Claude's dark look: the page #262624, cards a step lighter, text light, the
// dark buttons light with dark words. The hand-made dark rules (Tools, Plugins, Skills, the code colours) come last and win.
//
//   node make-dark-css.mjs          writes public/coder-dark.css
//   node make-dark-css.mjs --check  fails if public/coder-dark.css is not up to date (test/frontend-audit.test.mjs)
//
// Change a light colour, then run it again.
import { readFileSync, writeFileSync } from "node:fs";

const PUB = new URL("./public/", import.meta.url).pathname;
export const SOURCES = ["app.css", "coder.css", "gloopy.css", "coder-logo.css", "coder-plugins.css", "coder-projects.css"];
const DARK_MEDIA = /^@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*$/i;

// ── colours ──
const NAMED = { white: [255, 255, 255], black: [0, 0, 0] };
function parseColor(t) {
  const s = t.toLowerCase();
  if (NAMED[s]) return { rgb: NAMED[s], a: 1 };
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (m) return { rgb: [m[1], m[2], m[3]].map(Number), a: m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : Number(m[4]) };
  return null;
}
function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function fromHsl([h, s, l]) {
  if (!s) return [l, l, l].map((v) => Math.round(v * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/** One colour in its dark place, by what it paints: "bg" (a surface), "line" (a border, an outline, a shadow) or "text". */
export function darkColor(t, role) {
  const c = parseColor(t);
  if (!c) return t;
  const [h, s, l] = toHsl(c.rgb);
  const chroma = (Math.max(...c.rgb) - Math.min(...c.rgb)) / 255;
  // (A strong colour in the middle, an orange dot or a blue button, stays itself on a surface or a line.)
  if (role !== "text" && chroma > 0.35 && l > 0.3 && l < 0.75) return t;
  let L, S = chroma < 0.25 ? Math.min(s, 0.1) : Math.min(s, 0.6);
  if (role === "bg") {
    // Light surfaces turn dark (white is the page's #262624, tints a step lighter); dark ones (buttons, tooltips) turn light.
    if (l > 0.5) { L = 0.145 + (1 - l) * 0.62; S = Math.min(S, 0.04); } else L = clamp(0.93 - l * 0.45, 0.55, 0.93);
  } else if (role === "line") {
    if (l > 0.5) { L = 0.2 + (1 - l) * 0.75; S = Math.min(S, 0.05); } else L = clamp(1 - l, 0.45, 0.9);
    // (A shadow stays dark.)
    if (c.a < 1 && l < 0.2) L = l;
  } else {
    // Text: dark words turn light; white words (on a dark button, now light) turn dark; greys keep their distance from the page.
    if (l >= 0.9) L = 0.13; else L = clamp(1.04 - l, 0.5, 0.93);
    if (s > 0.35 && l > 0.2 && l < 0.8) L = clamp(Math.max(L, 0.62), 0.5, 0.82);
  }
  const rgb = fromHsl([h, S, L]);
  const hex = "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
  return c.a >= 1 ? hex : "rgba(" + rgb.join(", ") + ", " + +c.a.toFixed(3) + ")";
}
const COLOR_TOKEN = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/g;
function roleOf(prop) {
  if (/^background/.test(prop)) return "bg";
  if (/^(border|outline|box-shadow|column-rule|text-decoration)/.test(prop)) return "line";
  if (/^(color|fill|stroke|caret-color|-webkit-text-fill-color|text-shadow|accent-color)$/.test(prop)) return "text";
  return null;
}
/** A declaration's value with its colours made dark (never inside url(...)); null when it has none. */
function darkValue(prop, value) {
  const role = roleOf(prop);
  if (!role) return null;
  let found = false;
  const parts = value.split(/(url\([^)]*\))/);
  const out = parts.map((p, i) => (i % 2 ? p : p.replace(COLOR_TOKEN, (t) => { const c = parseColor(t); if (!c) return t; found = true; return darkColor(t, role); }))).join("");
  return found && out !== value ? out : null;
}

// ── style sheets ──
/** The rules of a style sheet, nested in at-rules: { sel, decls } or { at, rules } or { raw } (kept as written). */
function parse(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let i = 0;
  const block = () => {
    const rules = [];
    let buf = "";
    while (i < css.length) {
      const ch = css[i];
      if (ch === '"' || ch === "'") { const j = css.indexOf(ch, i + 1); buf += css.slice(i, j + 1); i = j + 1; continue; }
      if (ch === "}") { i++; return rules; }
      if (ch === "{") {
        const head = buf.trim(); buf = ""; i++;
        if (head.startsWith("@")) {
          if (/^@(media|supports)/i.test(head)) rules.push({ at: head, rules: block() });
          else { const st = i; skip(); rules.push({ raw: head + "{" + css.slice(st, i - 1) + "}" }); }
        } else {
          const st = i;
          let depth = 1;
          while (i < css.length && depth) { if (css[i] === "{") depth++; else if (css[i] === "}") depth--; i++; }
          rules.push({ sel: head, decls: css.slice(st, i - 1) });
        }
        continue;
      }
      if (ch === ";" && buf.trim().startsWith("@")) { buf = ""; i++; continue; }
      buf += ch; i++;
    }
    return rules;
  };
  const skip = () => { let depth = 1; while (i < css.length && depth) { if (css[i] === "{") depth++; else if (css[i] === "}") depth--; i++; } };
  return block();
}
function decls(text) {
  const out = [];
  let buf = "", par = 0;
  for (const ch of text) {
    if (ch === "(") par++; else if (ch === ")") par--;
    if (ch === ";" && !par) { out.push(buf); buf = ""; } else buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out.map((d) => { const k = d.indexOf(":"); return k < 0 ? null : { prop: d.slice(0, k).trim().toLowerCase(), value: d.slice(k + 1).trim() }; }).filter(Boolean);
}
const minify = (s) => s.replace(/\s+/g, " ").trim();
export function makeDark() {
  const made = [], kept = [];
  const walk = (rules, media, file) => {
    for (const r of rules) {
      if (r.at) {
        if (DARK_MEDIA.test(r.at)) { kept.push("/* " + file + " */\n" + r.rules.map((x) => (x.sel ? minify(x.sel) + " { " + minify(x.decls) + " }" : "")).join("\n")); continue; }
        if (/^@media/i.test(r.at) && !/prefers-color-scheme/i.test(r.at) && !r.at.includes(",")) walk(r.rules, (media ? media + " and " : "") + r.at.replace(/^@media\s*/i, ""), file);
        continue;
      }
      if (!r.sel || /@keyframes|^from$|^to$|^\d+%/.test(r.sel)) continue;
      const out = [];
      for (const d of decls(r.decls)) {
        const v = darkValue(d.prop, d.value);
        if (v !== null) out.push(d.prop + ": " + v);
      }
      if (out.length) made.push({ media, text: minify(r.sel) + " { " + out.join("; ") + " }" });
    }
  };
  for (const f of SOURCES) walk(parse(readFileSync(PUB + f, "utf8")), "", f);
  const groups = [];
  for (const m of made) { const g = groups.at(-1); if (g && g.media === m.media) g.items.push(m.text); else groups.push({ media: m.media, items: [m.text] }); }
  const q = (media) => "@media (prefers-color-scheme: dark)" + (media ? " and " + media : "");
  return "/* MADE BY make-dark-css.mjs FROM THE LIGHT STYLE SHEETS: do not edit by hand; change the light colours and run it again. */\n" +
    "@media (prefers-color-scheme: dark) {\n:root { color-scheme: dark; }\nhtml, body { background: #262624; color: #e8e6e1; }\n}\n" +
    groups.map((g) => q(g.media) + " {\n" + g.items.join("\n") + "\n}\n").join("") +
    "/* The hand-made dark rules, last. */\n@media (prefers-color-scheme: dark) {\n" + kept.join("\n") + "\n}\n";
}

if (process.argv[1] && new URL("file://" + process.argv[1]).pathname === new URL(import.meta.url).pathname) {
  const css = makeDark();
  if (process.argv.includes("--check")) {
    const now = readFileSync(PUB + "coder-dark.css", "utf8");
    if (now !== css) { console.error("public/coder-dark.css is out of date: run node make-dark-css.mjs"); process.exit(1); }
  } else writeFileSync(PUB + "coder-dark.css", css);
}
