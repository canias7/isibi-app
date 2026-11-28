// FRONTMATTER YAML (the block subset skill and agent files use), with no imports, so the tools script can load it
// (coder-skills.mjs). coder-fmhooks.mjs uses it for frontmatter hooks. 2026-11-27.
/** A YAML scalar as frontmatter writes one: quoted strings, true/false, null, numbers, [a, b] and JSON-style {…}; else the text. */
function scalar(raw) {
  let v = String(raw).trim();
  if (v.startsWith('"')) { try { return JSON.parse(v); } catch { const e = v.lastIndexOf('"'); return e > 0 ? v.slice(1, e) : v.slice(1); } }
  if (v.startsWith("'")) { const e = v.lastIndexOf("'"); return (e > 0 ? v.slice(1, e) : v.slice(1)).replace(/''/g, "'"); }
  v = v.replace(/\s+#.*$/, "");
  if (v.startsWith("[") || v.startsWith("{")) {
    try { return JSON.parse(v); } catch { /* YAML flow style */ }
    if (v.startsWith("[") && v.endsWith("]")) return v.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean).map(scalar);
    if (v === "{}") return {};
  }
  if (/^(true|True|TRUE)$/.test(v)) return true;
  if (/^(false|False|FALSE)$/.test(v)) return false;
  if (/^(null|Null|NULL|~)$/.test(v) || v === "") return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}
const KEY_RE = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s:"'#-][^:]*?|-[^\s:][^:]*?)\s*:(?:\s+(.*)|\s*)$/;
const isDash = (t) => t === "-" || t.startsWith("- ");
const keyOf = (k) => (k.startsWith('"') || k.startsWith("'") ? scalar(k) : k.trim());

/**
 * THE YAML OF A FRONTMATTER (the block subset frontmatter uses: mappings, sequences, `- key: value` items, scalars, | and >
 * blocks): the value, or undefined when it doesn't parse.
 */
export function yamlParse(text) {
  const lines = [];
  for (const raw of String(text || "").replace(/\r\n?/g, "\n").split("\n")) {
    if (!raw.trim() || /^\s*#/.test(raw)) { lines.push({ blank: true, raw }); continue; }
    if (/^\t/.test(raw)) return undefined;
    const indent = raw.length - raw.trimStart().length;
    lines.push({ indent, text: raw.trim(), raw });
  }
  const L = lines.filter((l) => !l.blank);
  const rawAll = lines;
  if (!L.length) return null;
  let bad = false;
  const blockText = (from, indent, fold) => {
    // (The lines of a | or > block: those indented past the key, kept from the raw text.)
    const start = rawAll.indexOf(L[from - 1]) + 1;
    const out = [];
    let j = start, cut = -1;
    for (; j < rawAll.length; j++) {
      const r = rawAll[j];
      if (r.blank) { out.push(""); continue; }
      if (r.indent <= indent) break;
      if (cut < 0) cut = r.indent;
      out.push(r.raw.slice(cut));
    }
    while (out.length && out[out.length - 1] === "") out.pop();
    let used = 0;
    for (let k = from; k < L.length && L[k].indent > indent; k++) used++;
    return { value: fold ? out.join(" ").replace(/ {2,}/g, " ") : out.join("\n"), next: from + used };
  };
  const parseAt = (i, indent) => (isDash(L[i].text) ? seq(i, indent) : map(i, indent));
  const valueAfter = (rest, i, indent) => {
    if (rest === undefined || rest === "") {
      if (i + 1 < L.length && L[i + 1].indent > indent) return parseAt(i + 1, L[i + 1].indent);
      if (i + 1 < L.length && L[i + 1].indent === indent && isDash(L[i + 1].text)) return seq(i + 1, indent);
      return [null, i + 1];
    }
    if (/^[|>][+-]?$/.test(rest)) { const b = blockText(i + 1, indent, rest[0] === ">"); return [b.value, b.next]; }
    return [scalar(rest), i + 1];
  };
  function map(i, indent) {
    const obj = {};
    while (i < L.length && L[i].indent === indent && !isDash(L[i].text)) {
      const m = KEY_RE.exec(L[i].text);
      if (!m) { bad = true; return [obj, L.length]; }
      const [v, n] = valueAfter(m[2], i, indent);
      obj[keyOf(m[1])] = v;
      i = n;
    }
    if (i < L.length && L[i].indent > indent) bad = true;
    return [obj, i];
  }
  function seq(i, indent) {
    const arr = [];
    while (i < L.length && L[i].indent === indent && isDash(L[i].text)) {
      const rest = L[i].text === "-" ? "" : L[i].text.slice(2).trim();
      if (!rest) { const [v, n] = valueAfter("", i, indent); arr.push(v); i = n; continue; }
      if (KEY_RE.test(rest) && !/^["']/.test(rest.trim()) || /^["'][^"']*["']\s*:/.test(rest)) {
        // (`- key: value` opens a mapping whose keys line up after the dash.)
        const col = indent + (L[i].text.length - rest.length);
        L[i] = { indent: col, text: rest, raw: L[i].raw };
        const [v, n] = map(i, col);
        arr.push(v); i = n; continue;
      }
      arr.push(scalar(rest)); i++;
    }
    return [arr, i];
  }
  const [v, n] = parseAt(0, L[0].indent);
  if (bad || n < L.length) return undefined;
  return v;
}

/** A file's frontmatter, parsed (an object), or null (none, or it doesn't parse). */
export function frontmatterOf(text) {
  const s = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!s.startsWith("---\n")) return null;
  const end = s.indexOf("\n---", 3);
  if (end < 0) return null;
  const v = yamlParse(s.slice(4, end));
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

/** The `hooks:` of a frontmatter, as Claude Code's settings shape ({ PreToolUse: [ … ] }), or null. */
export function frontmatterHooks(text) {
  const fm = frontmatterOf(text);
  const h = fm && fm.hooks;
  return h && typeof h === "object" && !Array.isArray(h) && Object.keys(h).length ? h : null;
}

