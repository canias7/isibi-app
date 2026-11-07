// FILE PATTERNS, AS CLAUDE CODE'S DOCS GIVE THEM (owner, 2026-11-07, item 10): for the repo's path
// rules (.coder/rules/) and its security rules (.coder/security-patterns.*).

/**
 * DOES A RULE'S PATTERN MATCH THIS FILE (relative to the repository's top)? Claude Code's: `*.md`
 * (no slash) any such file anywhere; `/*.md` only at the top; `src/**` and `src/*.ts` from the top;
 * `**` any folders; `{ts,tsx}` either.
 */
export function globMatch(pattern, rel) {
  const brace = /\{([^{}]*)\}/.exec(pattern);
  if (brace) return brace[1].split(",").some((alt) => globMatch(pattern.slice(0, brace.index) + alt + pattern.slice(brace.index + brace[0].length), rel));
  let p = String(pattern), anchored = false;
  if (p.startsWith("/")) { anchored = true; p = p.slice(1); } else if (p.startsWith("./")) { anchored = true; p = p.slice(2); }
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "*" && p[i + 1] === "*") { i++; if (p[i + 1] === "/") { i++; re += "(?:.*/)?"; } else re += ".*"; }
    else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  const r = new RegExp("^" + re + "$");
  return anchored || p.includes("/") ? r.test(rel) : r.test(rel.split("/").pop());
}
