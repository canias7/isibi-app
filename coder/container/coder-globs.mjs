// FILE PATTERNS, AS CLAUDE CODE'S DOCS GIVE THEM (owner, 2026-11-07, item 10): for the repo's path
// rules (.coder/rules/) and its security rules (.coder/security-patterns.*).

/**
 * A RULE'S WHOLE PATTERN LIST WITH ITS BRACES EXPANDED, ONCE (Claude Code's: "a rule's whole `paths` list shares one budget of
 * 1,000 expanded patterns and 4 MiB, and patterns without braces don't count against it", and a pattern that would go past it
 * is used unexpanded, its literal braces matching no file). Before, every combination was tried at each match, doubling per
 * group, which could freeze the machine.
 */
export const BRACE_BUDGET = 1000, BRACE_BYTES = 4 * 1024 * 1024;
export function expandBraces(patterns) {
  const out = [];
  let count = 0, bytes = 0;
  for (const raw of Array.isArray(patterns) ? patterns : []) {
    const p = String(raw);
    if (!/\{[^{}]*\}/.test(p)) { out.push(p); continue; }
    let list = [p], over = false;
    for (;;) {
      const next = [];
      let grew = false;
      for (const q of list) {
        const b = /\{([^{}]*)\}/.exec(q);
        if (!b) { next.push(q); continue; }
        grew = true;
        for (const alt of b[1].split(",")) next.push(q.slice(0, b.index) + alt + q.slice(b.index + b[0].length));
        if (count + next.length > BRACE_BUDGET) { over = true; break; }
      }
      if (over) break;
      list = next;
      if (!grew) break;
    }
    const size = list.reduce((n, q) => n + q.length, 0);
    if (over || count + list.length > BRACE_BUDGET || bytes + size > BRACE_BYTES) { out.push(p); continue; }
    count += list.length; bytes += size;
    out.push(...list);
  }
  return out;
}
const expanded = new WeakMap();
/** Does any pattern of a rule's list match this file? The list is expanded once (expandBraces) and kept with it. */
export function globAny(patterns, rel) {
  if (!Array.isArray(patterns)) return false;
  let e = expanded.get(patterns);
  if (!e) { e = expandBraces(patterns); expanded.set(patterns, e); }
  return e.some((g) => globMatch(g, rel));
}

/**
 * DOES ONE (ALREADY EXPANDED) PATTERN MATCH THIS FILE (relative to the repository's top)? Claude Code's: `*.md` (no slash) any
 * such file anywhere; `/*.md` only at the top; `src/**` and `src/*.ts` from the top; `**` any folders; `[abc]` one of these
 * characters (`[!abc]` or `[^abc]` none of them); a `[` that can't be read so makes the pattern match nothing; `\[` a real `[`.
 * Braces here are plain characters: globAny expands them first.
 */
export function globMatch(pattern, rel) {
  let p = String(pattern), anchored = false;
  if (p.startsWith("/")) { anchored = true; p = p.slice(1); } else if (p.startsWith("./")) { anchored = true; p = p.slice(2); }
  const lit = (c) => c.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "\\" && i + 1 < p.length) { re += lit(p[++i]); }
    else if (c === "*" && p[i + 1] === "*") { i++; if (p[i + 1] === "/") { i++; re += "(?:.*/)?"; } else re += ".*"; }
    else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else if (c === "[") {
      let j = i + 1, neg = false;
      if (p[j] === "!" || p[j] === "^") { neg = true; j++; }
      let body = "";
      const s0 = j;
      for (; j < p.length && (p[j] !== "]" || j === s0); j++) {
        if (p[j] === "/") return false;
        if (p[j] === "\\" && j + 1 < p.length) { body += lit(p[++j]); continue; }
        if (p[j] === "-" && j > s0 && p[j + 1] && p[j + 1] !== "]") { body += "-"; continue; }
        body += lit(p[j]);
      }
      if (j >= p.length || !body) return false;
      re += neg ? "[^/" + body + "]" : "[" + body + "]";
      i = j;
    }
    else re += lit(c);
  }
  let r;
  try { r = new RegExp("^" + re + "$"); } catch { return false; }
  return anchored || p.includes("/") ? r.test(rel) : r.test(rel.split("/").pop());
}
