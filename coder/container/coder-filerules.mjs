// READ(…) AND EDIT(…) RULES (Bash docs, the owner, 2026-11-10: "yea do all 4"): Claude Code's file permission rules, in its
// own pattern syntax. Its permissions docs, "Read and Edit": "Read and Edit rules both use gitignore pattern syntax with four
// distinct pattern types": `//path` "Absolute path from filesystem root", `~/path` "Path from home directory", `/path` "Path
// relative to the settings source", `path` or `./path` "Path relative to current directory". Coder keeps the owner's rules per
// repository, as Claude Code's local settings are, so `/path` and `path` both count from the project's folder ("Local settings
// rules anchor at the session's primary working directory"), and `~/` is the AI's home on Coder's machine.
// (No node: modules here: coder-perms.mjs uses this file, and Coder's Worker loads that one. Paths are the machine's, POSIX.)

/** A POSIX path without `.`, `..` or doubled slashes. */
function normalize(p) {
  const s = String(p), abs = s.startsWith("/"), out = [];
  for (const seg of s.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") { if (out.length && out[out.length - 1] !== "..") out.pop(); else if (!abs) out.push(".."); continue; }
    out.push(seg);
  }
  return (abs ? "/" : "") + out.join("/") || (abs ? "/" : ".");
}
/** The way from one full path to another (`..` to go up). */
function relative(from, to) {
  const a = normalize(from).split("/").filter(Boolean), b = normalize(to).split("/").filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return [...Array(a.length - i).fill(".."), ...b.slice(i)].join("/");
}
const isAbsolute = (p) => String(p).startsWith("/");
const join = (...parts) => normalize(parts.join("/"));

/** Claude Code's file tools whose rules take a path (its "Ur"): a `:*` in one is refused, in its words (ruleProblem). */
export const FILE_RULE_TOOLS = new Set(["Read", "Edit", "Write", "Glob", "Grep", "NotebookEdit", "MultiEdit"]);
/** Coder's own tools, by the names Claude Code's rules give them: a rule on the whole tool (`Write`, `Grep` …) matches each call. */
export const TOOL_RULE_NAMES = { read: "Read", edit: "Edit", write: "Write", grep: "Grep", glob: "Glob", lsp: "LSP" };

const esc = (c) => c.replace(/[.+^${}()|[\]\\*?]/g, "\\$&");

/** One segment of a gitignore pattern as a regular expression: `*` and `?` within the segment, `[…]` a class, `\x` literal. */
function segRe(seg) {
  let out = "";
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (c === "\\" && i + 1 < seg.length) { out += esc(seg[++i]); continue; }
    if (c === "*") { out += "[^/]*"; continue; }
    if (c === "?") { out += "[^/]"; continue; }
    if (c === "[") {
      const j = seg.indexOf("]", i + 2);
      if (j > i) { const body = seg.slice(i + 1, j); out += "[" + (body[0] === "!" ? "^" + body.slice(1) : body).replace(/\\/g, "\\\\") + "]"; i = j; continue; }
    }
    out += esc(c);
  }
  return out;
}

/**
 * A GITIGNORE PATTERN (relative to its anchor) as `{ re, dirOnly }`, or null when it can't be read as one: a pattern with a
 * slash at its start or in its middle is anchored, one without matches at any depth; `**` crosses folders (`**\/x`, `x/**`,
 * `x/**\/y`); a trailing `/` matches folders only.
 */
export function gitPattern(pattern) {
  let p = String(pattern);
  let dirOnly = false;
  if (p.length > 1 && p.endsWith("/") && !p.endsWith("\\/")) { dirOnly = true; p = p.replace(/\/+$/, ""); }
  const anchored = p.includes("/");
  if (p.startsWith("/")) p = p.slice(1);
  if (!p) return null;
  const segs = p.split("/");
  let re = "";
  segs.forEach((seg, k) => {
    const last = k === segs.length - 1;
    if (seg === "**") {
      if (segs.length === 1) re += ".*";
      else if (k === 0) re += "(?:.*/)?";
      else if (last) re += "/.*";
      else re += "/(?:.*/)?";
      return;
    }
    if (k > 0 && segs[k - 1] !== "**") re += "/";
    re += segRe(seg);
  });
  try { return { re: new RegExp((anchored ? "^" : "^(?:.*/)?") + re + "$"), dirOnly }; } catch { return null; }
}

/**
 * WHERE A RULE'S PATH IS ANCHORED, and its pattern there: `{ root, pattern }` (root a full path). `kind` matters for one shape
 * (Claude Code: "A relative pattern with a single directory segment, such as src/**, matches at different depths depending on
 * the rule type": an allow rule only at `<cwd>/src`, a deny or ask rule "a directory named secrets at any depth").
 */
export function anchorOf(spec, kind, { root = "/", home = "" } = {}) {
  const s = String(spec);
  if (s.startsWith("//")) return { root: "/", pattern: "/" + s.slice(2).replace(/^\/+/, "") };
  if (s === "~" || s.startsWith("~/")) return home ? { root: home, pattern: "/" + s.slice(2) } : null;
  if (s.startsWith("/")) return { root, pattern: s };
  let rel = s.startsWith("./") ? s.slice(2) : s;
  // (`src/**` as a deny or ask rule: `**/src/**`.)
  if (kind !== "allow" && /^[^/]+\/[^/]+$/.test(rel) && !rel.startsWith("**/")) rel = "**/" + rel;
  return { root, pattern: rel };
}

/** A full path, made plain (no `.`, `..` or doubled slashes, no trailing slash). */
export const plainPath = (p) => { const n = normalize(String(p || "/")); return n.length > 1 ? n.replace(/\/+$/, "") : n; };

/**
 * WHETHER ONE GROUP OF RULES (one anchor's, in order, `!` ones among them) COVERS A PATH, gitignore's way: the last rule that
 * matches decides; a folder that is covered covers everything in it (Claude Code: "A carve-out can't reopen a file inside a
 * directory that a rule blocks as a whole"). The rule that covers it, or null.
 */
function groupCovers(rules, rel, isDir) {
  const segs = rel.split("/");
  for (let i = 1; i <= segs.length; i++) {
    const part = segs.slice(0, i).join("/"), dir = i < segs.length || isDir;
    let hit = null;
    for (const r of rules) {
      if (r.exact !== undefined) { if (part === r.exact) hit = r.neg ? null : r; continue; }
      if (r.dirOnly && !dir) continue;
      if (r.re.test(part)) hit = r.neg ? null : r;
    }
    if (hit) return hit;
  }
  return null;
}

/**
 * THE RULE OF ONE LIST THAT MATCHES A FILE OR FOLDER, for one of Claude Code's file rules (`Read` or `Edit`), or "":
 * `list` the owner's rules of one kind (`allow`, `ask` or `deny`, texts like "Read(./.env)"); `path` a full path; `ctx`
 * `{ root, home, real, isDir }` (`real(p)`: where a path really leads, "" when unknown). A rule on the whole tool (`Read`,
 * `Read(*)`, `Read(**)`) matches every path. Claude Code's symlink rule: a deny or ask rule matches when the path asked for or
 * the one it leads to matches; an allow rule only when both do.
 */
export function fileRuleHit(list, tool, path, kind, ctx = {}) {
  const rules = (Array.isArray(list) ? list : []).map((t) => String(t || "").trim()).map((t) => {
    const m = /^([A-Za-z]+)(?:\(([\s\S]*)\))?$/.exec(t);
    return m && m[1] === tool ? { text: t, spec: m[2] === undefined ? null : m[2].trim() } : null;
  }).filter(Boolean);
  if (!rules.length) return "";
  const whole = rules.find((r) => r.spec === null || r.spec === "*" || r.spec === "**");
  if (whole) return whole.text;
  const p = plainPath(path);
  let to = p;
  if (typeof ctx.real === "function") { try { to = ctx.real(p) || ""; } catch { to = ""; } }
  const asked = hitOne(rules, p, kind, ctx);
  if (kind === "allow") { if (!asked || !to || to === p) return asked; return hitOne(rules, plainPath(to), kind, ctx) ? asked : ""; }
  return asked || (to && to !== p ? hitOne(rules, plainPath(to), kind, ctx) : "");
}

/** fileRuleHit for one path as it is (no link followed). */
function hitOne(rules, p, kind, ctx) {
  const root = plainPath(ctx.root || "/"), home = ctx.home ? plainPath(ctx.home) : "";
  // One group per anchor; the plain relative rules (`path`, `./path`) a group of their own, the only one a `!` rule reaches.
  const groups = new Map();
  const add = (key, base, r) => { if (!groups.has(key)) groups.set(key, { base, list: [] }); groups.get(key).list.push(r); };
  for (const r of rules) {
    // A `!` rule (deny and ask lists only): read from the project's folder whatever follows it (Claude Code: "reads a ! pattern
    // relative to the current directory even when /, ~/, or // follows the !, so the pattern can't reach a rule anchored with
    // one of those prefixes"); it carves out of the plain relative rules before it ("A ! rule listed first carves nothing out").
    if (r.spec.startsWith("!")) {
      if (kind === "allow") continue;
      const g = groups.get("rel");
      if (!g || !g.list.length) continue;
      const gp = gitPattern(r.spec.slice(1).replace(/^\.\//, ""));
      if (gp) add("rel", root, { ...gp, neg: true, text: r.text });
      continue;
    }
    const a = anchorOf(r.spec, kind, { root, home });
    if (!a) continue;
    const base = plainPath(a.root);
    const key = a.pattern.startsWith("/") ? "at:" + base : "rel";
    const gp = gitPattern(a.pattern);
    // ("A deny or ask rule whose path isn't usable as a gitignore pattern still guards that exact path. An allow rule with an
    // unusable pattern doesn't approve anything.")
    if (!gp) { if (kind !== "allow") add(key, base, { exact: a.pattern.replace(/^\/+/, ""), neg: false, text: r.text }); continue; }
    add(key, base, { ...gp, neg: false, text: r.text });
    // A DENY OR ASK RULE WRITTEN THROUGH A LINKED FOLDER (Claude Code: "a deny or ask rule written through a symlinked
    // directory with a //, ~/, or / pattern also applies at the directory's real location"): its fixed start, followed.
    if (kind !== "allow" && typeof ctx.real === "function" && a.pattern.startsWith("/")) {
      const segs = a.pattern.slice(1).split("/");
      const k = segs.findIndex((s) => /[*?[\\]/.test(s));
      const fixed = segs.slice(0, k < 0 ? segs.length - 1 : k);
      if (fixed.length) {
        let real = "";
        try { real = ctx.real(join(base, ...fixed)) || ""; } catch { real = ""; }
        const realBase = real ? plainPath(real) : "";
        if (realBase && realBase !== plainPath(join(base, ...fixed))) {
          const gp2 = gitPattern("/" + segs.slice(fixed.length).join("/"));
          if (gp2) add("at:" + realBase, realBase, { ...gp2, neg: false, text: r.text });
        }
      }
    }
  }
  for (const { base, list } of groups.values()) {
    const rel = relative(base, p);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) continue;
    const hit = groupCovers(list, rel, !!ctx.isDir);
    if (hit) return hit.text;
  }
  return "";
}

/**
 * A FOLDER'S READ RULE, as Claude Code saves one for a `cd` out of the project on "Yes, and don't ask again" ("Subcommands
 * like cd into a directory outside your working directories generate their own Read rule for that path"): `Read(//dir/**)`,
 * its pattern characters escaped ("Claude Code escapes gitignore pattern characters in that path, such as [, ], and *, so
 * the generated rule matches only the literal path you approved"); none for the root.
 */
export function readRuleFor(dir) {
  const d = plainPath(dir);
  if (!d.startsWith("/") || d === "/") return "";
  return "Read(/" + d.replace(/[[\]*?!\\]/g, "\\$&") + "/**)";
}

/** Whether a folder, or what is in it, is open to reading by one of the owner's Read allow rules (a `cd` there). */
export function folderReadAllowed(allow, dir, ctx = {}) {
  const d = plainPath(dir);
  return !!(fileRuleHit(allow, "Read", d, "allow", { ...ctx, isDir: true }) || fileRuleHit(allow, "Read", join(d, "coder-any-file"), "allow", ctx));
}
