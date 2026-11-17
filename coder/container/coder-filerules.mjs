// READ(…) AND EDIT(…) RULES (Bash docs, the owner, 2026-11-10: "yea do all 4"): Claude Code's file permission rules, in its
// own pattern syntax. Its permissions docs, "Read and Edit": "Read and Edit rules both use gitignore pattern syntax with four
// distinct pattern types": `//path` "Absolute path from filesystem root", `~/path` "Path from home directory", `/path` "Path
// relative to the settings source", `path` or `./path` "Path relative to current directory". Coder keeps the owner's rules per
// repository, as Claude Code's local settings are, so `/path` counts from the project's folder ("Local settings rules anchor
// at the session's primary working directory"), `path` from the folder Coder's commands are in (its current folder, as
// Claude Code's), and `~/` is the AI's home on Coder's machine.
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
const join = (...parts) => normalize(parts.join("/"));

/** Claude Code's file tools whose rules take a path (its "Ur"): a `:*` in one is refused, in its words (ruleProblem). */
export const FILE_RULE_TOOLS = new Set(["Read", "Edit", "Write", "Glob", "Grep", "NotebookEdit", "MultiEdit"]);
/** Coder's own tools, by the names Claude Code's rules give them: a rule on the whole tool (`Write`, `Grep` …) matches each call. */
// (notebook_edit, Claude Code's NotebookEdit, by Edit rules as there: "Edit rules apply to all built-in tools that edit files". 2026-11-17.)
export const TOOL_RULE_NAMES = { read: "Read", edit: "Edit", write: "Write", notebook_edit: "NotebookEdit", grep: "Grep", glob: "Glob", lsp: "LSP" };
/**
 * THE TOOLS WHOSE ALLOW RULE `X(*)` OR `X()` IS A PATH RULE, "*" (Claude Code 2.1.325's Lg and yzs, its flag on by default,
 * and in its cloud): it covers the working directories only, not every path as `X` does. Round 3, 2026-11-14.
 */
export const STAR_PATH_TOOLS = new Set(["Read", "Edit", "Write", "NotebookEdit", "Grep", "Glob", "LSP"]);
/** The ones of them that change files (Claude Code's own set for its warning: Edit, Write, NotebookEdit). */
export const STAR_EDIT_TOOLS = new Set(["Edit", "Write", "NotebookEdit"]);
/** Whether an allow rule's text is one of those, `X(*)` or `X()` exactly: the tool's name, or "". */
export const starAllowTool = (text) => { const m = /^([A-Za-z]+)\((\*?)\)$/.exec(String(text ?? "").trim()); return m && STAR_PATH_TOOLS.has(m[1]) ? m[1] : ""; };

// ── CLAUDE CODE'S PATH MATCHER (round 4, 2026-11-14; the owner: "yes" to copying Claude Code 2.1.325's matching exactly) ──
/*
 * The path matching below is ported from node-ignore 5.x (https://github.com/kaelzhang/node-ignore), which Claude Code
 * bundles, under its MIT license:
 *
 * Copyright (c) 2013 Kael Zhang <i@kael.me>, contributors
 * http://kael.me/
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
// Claude Code matches a path rule with the `ignore` library (node-ignore, MIT), created with its defaults, so letters match
// in either case; this is that library's own way of turning a pattern into a test, copied from the copy inside Claude Code's
// program (/opt/claude-code/bin/claude 2.1.325), and its way of testing a path, folder by folder.

/** node-ignore's replacers, in its order (its `Id`): each pattern becomes a regular expression's text. */
const IG_REPLACERS = [
  [/^\uFEFF/, () => ""],
  [/((?:\\\\)*?)(\\?\s+)$/, (e, n, r) => n + (r.indexOf("\\") === 0 ? " " : "")],
  [/(\\+?)\s/g, (e, n) => { const { length: r } = n; return n.slice(0, r - r % 2) + " "; }],
  [/[\\$.|*+(){^]/g, (e) => `\\${e}`],
  [/(?!\\)\?/g, () => "[^/]"],
  [/^\//, () => "^"],
  [/\//g, () => "\\/"],
  [/^\^*\\\*\\\*\\\//, () => "^(?:.*\\/)?"],
  [/^(?=[^^])/, function () { return !/\/(?!$)/.test(this) ? "(?:^|\\/)" : "^"; }],
  [/\\\/\\\*\\\*(?=\\\/|$)/g, (e, n, r) => (n + 6 < r.length ? "(?:\\/[^\\/]+)*" : "\\/.+")],
  [/(^|[^\\]+)(\\\*)+(?=.+)/g, (e, n, r) => { const s = r.replace(/\\\*/g, "[^\\/]*"); return n + s; }],
  [/\\\\\\(?=[$.|*+(){^])/g, () => "\\"],
  [/\\\\/g, () => "\\"],
  [/(\\)?\[([^\]/]*?)(\\*)($|\])/g, (e, n, r, s, h) => (n === "\\" ? `\\[${r}${s.slice(0, s.length - s.length % 2)}${h}` : h === "]" ? (s.length % 2 === 0 ? `[${r.replace(/([0-z])-([0-z])/g, (m, a, b) => (a.charCodeAt(0) <= b.charCodeAt(0) ? m : ""))}${s}]` : "[]") : "[]")],
  [/(?:[^*])$/, (e) => (/\/$/.test(e) ? `${e}$` : `${e}(?=$|\\/$)`)],
];
/** Whether node-ignore takes a pattern at all (its `Ld`: not blank, not a comment, no lone backslash at its end). */
const igUsable = (e) => typeof e === "string" && !!e && !/^\s+$/.test(e) && !/(?:[^\\]|^)\\$/.test(e) && e.indexOf("#") !== 0;
/** One pattern as node-ignore's rule (its `jd` and `regex`): `{ pattern, negative, regex }`; throws as the library does. */
function igRule(pattern) {
  const known = IG_MADE.get(pattern);
  if (known) return known;
  let negative = false, h = pattern;
  if (h.indexOf("!") === 0) { negative = true; h = h.slice(1); }
  h = h.replace(/^\\!/, "!").replace(/^\\#/, "#");
  const prefix = IG_REPLACERS.reduce((n, [r, s]) => n.replace(r, (...a) => s.apply(h, a)), h);
  const source = prefix.replace(/(^|\\\/)?\\\*$/, (m, n) => `${n ? `${n}[^/]+` : "[^/]*"}(?=$|\\/$)`);
  const made = { pattern, negative, regex: new RegExp(source, "i") };
  // (Kept, as Claude Code keeps its compiled rules: a search checks each path it finds against the same rules.)
  if (IG_MADE.size >= 1000) IG_MADE.clear();
  IG_MADE.set(pattern, made);
  return made;
}
const IG_MADE = new Map();
/** node-ignore's `add` of a list: the patterns it takes, as rules. */
const igRules = (patterns) => patterns.filter(igUsable).map(igRule);
/**
 * node-ignore's test of one path against its rules, in order (its `Ki.test`, as its `test` calls it): `{ ignored, rule }`. A
 * rule that can't change the answer is passed over, so the rule given is the first that matched since the last `!` one did.
 */
function igTestOne(rules, path) {
  let ignored = false, unignored = false, rule;
  for (const k of rules) {
    const M = k.negative;
    if (unignored === M && ignored !== unignored) continue;
    if (!k.regex.test(path)) continue;
    ignored = !M; unignored = M; rule = M ? undefined : k;
  }
  return { ignored, rule };
}
/** node-ignore's `test` (its `_t`): each folder on the way first ("a/", "a/b/"), and a folder that is matched covers all in it. */
function igTest(rules, path) {
  const slices = path.split("/").filter(Boolean);
  const walk = (p, s) => {
    s.pop();
    if (!s.length) return igTestOne(rules, p);
    const up = walk(s.join("/") + "/", s);
    return up.ignored ? up : igTestOne(rules, p);
  };
  return walk(path, slices);
}
/** Whether node-ignore takes a path to test (its isPathValid): not empty, not `.`, `..`, or one starting `/`, `./` or `../`. */
const igPathValid = (p) => typeof p === "string" && !!p && !/^\.{0,2}\/|^\.{1,2}$/.test(p);
/** The test node-ignore can't make of a pattern (Claude Code's `rKn`): its error, or null. */
function igCompileError(e) {
  try { igRules([e]); return null; } catch (x) { return x instanceof Error ? x.message : String(x); }
}
/** Why a pattern is no use to node-ignore (Claude Code's `br`): skipped by it, or a test it can't make; null when it is fine. */
const igProblem = (e) => (/^\s*$|^#|(?:^|[^\\])\\$/.test(e) ? "skipped by the ignore library (blank, comment, or trailing backslash)" : igCompileError(e));

/**
 * A PATTERN AS CLAUDE CODE GIVES IT TO THE LIBRARY (its `_t`): `x/**` is the folder `x`, which the library matches at any
 * depth when it has no other slash; in an allow rule a single folder is anchored (`/x`). Its permissions docs: "Allow rules:
 * Edit(src/**) matches only <cwd>/src … Deny and ask rules: Read(secrets/**) matches a directory named secrets at any depth";
 * "Every other pattern shape matches at the same depth in every rule type: Edit(/src/**) and Edit(src/components/**) match
 * only at their anchored location".
 */
function ccTrim(e, allow) {
  if (e.endsWith("/**")) {
    const r = e.slice(0, -3);
    return /[^/]/.test(r) ? (r.includes("/") || !allow || /^[!#]/.test(r) ? r : "/" + r) : "/**";
  }
  return e;
}
/** A rule's pattern made plain (Claude Code's `At`): doubled slashes as one, and a byte-order mark before `!` or `#` escaped. */
function ccClean(e) {
  const n = e.replace(/\/{2,}/g, "/");
  if (/^\s*(?:\/\*\*)?$/.test(n)) return n;
  return n.replace(/^\uFEFF([!#]?)/, (r, s) => (s ? "\\" + s : "")).replace(/^\uFEFF/, "[\uFEFF]");
}
/** Claude Code's `EAe` and `NZn`: a path's characters the library would read as pattern characters, escaped. */
function ccEscape(e) {
  let t = e.replaceAll("\\", "\\\\").replace(/[[\]()|+^$]/g, (r) => `\\${r}`);
  if (t.startsWith("!") || t.startsWith("#")) t = `\\${t}`;
  return t.replace(/\s+$/, (r) => Array.from(r, (o) => `\\${o}`).join(""));
}
const ccUnescape = (e) => e.replace(/\\([^])/g, (n, t) => (/^[\\[\]!#()|+^$*?\s]$/.test(t) ? t : n));
/** A pattern as the literal path it spells (Claude Code's `Ci`), its `!` and `/**` kept. */
function ccLiteral(e) {
  const n = e.startsWith("!") ? "!" : "", r = e.endsWith("/**") ? "/**" : "", s = e.slice(n.length, e.length - r.length);
  return n + ccEscape(ccUnescape(s)) + r;
}
/**
 * WHAT CLAUDE CODE KEEPS OF A RULE'S PATTERN (its `Nr`): the pattern; or, for one the library can't use, in a deny or ask rule
 * the literal path it spells ("A deny or ask rule whose path isn't usable as a gitignore pattern still guards that exact
 * path"), or, when even that can't be used, everything below its anchor; nothing for an allow rule or a `!` one ("An allow
 * rule with an unusable pattern doesn't approve anything"; Claude Code 2.1.269: "a bare ! negation is ignored").
 */
function ccKept(e, allow) {
  const r = ccTrim(e, allow);
  const s = !allow && /^!\s*$/.test(r) ? "a negation of every path" : igProblem(r);
  if (s === null) return e;
  const neg = e.startsWith("!"), drop = neg ? !allow : allow;
  if (drop) return null;
  const v = ccLiteral(e);
  return igCompileError(ccTrim(v, false)) === null ? v : (neg ? "!" : "") + "**";
}

/**
 * WHERE A RULE'S PATH IS ANCHORED, and its pattern there (Claude Code's `Fc`): `{ root, pattern }`, `root` a full path for
 * `//path` (the machine's root), `~/path` (the home folder) and `/path` (the project), and null for `path` and `./path`, which
 * count from the current folder (and, for a deny or ask rule, from the other working folders: fileRuleHit). A pattern that
 * starts with "/" is anchored at its root; one without a slash before its end matches at any depth below it, as gitignore's.
 */
export function anchorOf(spec, kind, { root = "/", home = "" } = {}) {
  const s = String(spec);
  if (s.startsWith("//")) return { root: "/", pattern: s.slice(1) };
  if (s.startsWith("~/")) return home ? { root: home, pattern: s.slice(1) } : null;
  if (s.startsWith("/")) return { root, pattern: s };
  return { root: null, pattern: s.startsWith("./") ? s.slice(2) : s };
}

/** A full path, made plain (no `.`, `..` or doubled slashes, no trailing slash). */
export const plainPath = (p) => { const n = normalize(String(p || "/")); return n.length > 1 ? n.replace(/\/+$/, "") : n; };

/**
 * THE RULE OF ONE LIST THAT MATCHES A FILE OR FOLDER, for one of Claude Code's file rules (`Read` or `Edit`), or "":
 * `list` the owner's rules of one kind (`allow`, `ask` or `deny`, texts like "Read(./.env)"); `path` a full path; `ctx`
 * `{ root, cwd, home, roots, real, isDir }` (`real(p)`: where a path really leads, "" when unknown). A rule on the whole tool
 * (`Read`, `Read(*)`) matches every path; `Read(**)` is a path rule, as Claude Code's parser makes only an empty or "*"
 * content the whole tool. Claude Code's symlink rule: a deny or ask rule matches when the path asked for or the one it leads
 * to matches; an allow rule only when both do.
 */
export function fileRuleHit(list, tool, path, kind, ctx = {}) {
  // WHICH SETTINGS EACH RULE CAME FROM (Claude Code: "The carve-out reaches only rules from the same source"; Bash docs pass
  // 9, a repository's `!` rule had cancelled the owner's own deny rule): `ctx.sources`, the owner's and the repository's
  // texts per list; a rule in neither (a "don't ask again" one, a hook's) is the chat's own.
  const S = ctx.sources && typeof ctx.sources === "object" ? ctx.sources : null;
  const srcsOf = (t) => {
    if (!S || kind === "allow") return ["own"];
    const has = (x) => Array.isArray(x && x[kind]) && x[kind].some((y) => String(y || "").trim() === t);
    const out = [...(has(S.own) ? ["own"] : []), ...(has(S.repo) ? ["repo"] : [])];
    return out.length ? out : ["session"];
  };
  // (`ctx.pathOnly`: rules on a path only, as Claude Code's Grep, Glob and LSP read Read rules (2.1.325: its path matcher skips a
  // rule with no path, and `Read(*)` is the bare `Read`); a rule on the whole tool is that tool's alone. `Read(**)` is a path.)
  const rules = (Array.isArray(list) ? list : []).map((t) => String(t || "").trim()).map((t) => {
    const m = /^([A-Za-z]+)(?:\(([\s\S]*)\))?$/.exec(t);
    if (!m || m[1] !== tool) return null;
    // (An allow rule `Read(*)` or `Read()`: the working folders, not the whole tool: STAR_PATH_TOOLS, and below.)
    if (kind === "allow" && starAllowTool(t)) return { text: t, spec: "*", srcs: srcsOf(t), star: true };
    return { text: t, spec: m[2] === undefined ? null : m[2].trim(), srcs: srcsOf(t) };
  }).filter((r) => r && !(ctx.pathOnly === true && !r.star && (r.spec === null || r.spec === "*" || r.spec === "")));
  if (!rules.length) return "";
  const whole = rules.find((r) => !r.star && (r.spec === null || r.spec === "*"));
  if (whole) return whole.text;
  const p = plainPath(path);
  let to = p;
  if (typeof ctx.real === "function") { try { to = ctx.real(p) || ""; } catch { to = ""; } }
  // (An allow rule `X(*)` is no pattern in Claude Code 2.1.325: its `Lha` approves a path inside the working folders, the
  // project's and the chat's other ones (its `vy` over `pk`), before the path rules. Round 4, 2026-11-14.)
  const star = rules.find((r) => r.star);
  const paths = rules.filter((r) => !r.star);
  const work = [plainPath(ctx.root || "/"), ...(Array.isArray(ctx.roots) ? ctx.roots.filter((x) => typeof x === "string" && x.startsWith("/")).map(plainPath) : [])];
  const inWork = (x) => work.some((d) => x === d || x.startsWith(d === "/" ? "/" : d + "/"));
  const one = (x) => (star && inWork(x) ? star.text : "") || hitOne(paths, x, kind, ctx);
  const asked = one(p);
  if (kind === "allow") { if (!asked || !to || to === p) return asked; return one(plainPath(to)) ? asked : ""; }
  return asked || (to && to !== p ? hitOne(rules, plainPath(to), kind, ctx) : "");
}

/**
 * THE FOLDERS A RULE'S RELATIVE PATH (`path`, `./path`) COUNTS FROM (Claude Code 2.1.325's `wfn`): for an allow rule, the
 * current folder alone; for a deny or ask rule, the current folder, then the project's (its original folder and its project
 * root, each with the place its links lead) and each of the chat's other working folders ("relative deny and ask permission
 * rules (e.g. Read(./.env)) no longer covering the project after a cd; they now also apply in added directories"). `ctx.cwd`
 * is Coder's current folder (the project's when not given), `ctx.roots` the other working folders.
 */
function relativeBases(kind, ctx) {
  const root = plainPath(ctx.root || "/");
  const cwd = typeof ctx.cwd === "string" && ctx.cwd.startsWith("/") ? plainPath(ctx.cwd) : root;
  if (kind === "allow") return [cwd];
  // (Each folder's real place, looked up once for each `real` (Claude Code keeps its working folders' spellings too).)
  let known = typeof ctx.real === "function" ? SPELLINGS.get(ctx.real) : null;
  if (typeof ctx.real === "function" && !known) { known = new Map(); SPELLINGS.set(ctx.real, known); }
  const spell = (x) => {
    const out = [x];
    if (typeof ctx.real === "function") {
      let r = known.get(x);
      if (r === undefined) { try { r = ctx.real(x) || ""; } catch { r = ""; } known.set(x, r); }
      if (r && plainPath(r) !== x) out.push(plainPath(r));
    }
    return out;
  };
  const more = Array.isArray(ctx.roots) ? ctx.roots.filter((x) => typeof x === "string" && x.startsWith("/")).map(plainPath) : [];
  return [...new Set([cwd, ...[root, ...more, root].flatMap(spell).filter((x) => x !== cwd)])];
}
const SPELLINGS = new WeakMap();

/**
 * fileRuleHit for one path as it is (no link followed), as Claude Code's `Jt` and `ic`: the rules by where they are anchored
 * (one group for the relative ones), and in each group one library per settings source for deny and ask rules (a `!` rule
 * carves out of its own source's relative rules only), one for all allow rules; each anchor's groups in the order their rules
 * come, the relative group at each of its folders, a source's library from the last one made.
 */
function hitOne(rules, p, kind, ctx) {
  const root = plainPath(ctx.root || "/"), home = ctx.home ? plainPath(ctx.home) : "";
  const allow = kind === "allow";
  const groups = new Map();
  const groupOf = (base) => { const key = base === null ? "\u0000relative" : base; let g = groups.get(key); if (!g) { g = { base, matchers: [] }; groups.set(key, g); } return g; };
  const matcherOf = (g, src) => { let m = g.matchers.find((x) => x.src === src); if (!m) { m = { src, map: new Map(), lib: null }; g.matchers.push(m); } return m; };
  // (A deny or ask rule's pattern written again moves to its place; an allow list keeps the first place: Claude Code's `Jt`.)
  const put = (base, src, ce, text, again) => { const m = matcherOf(groupOf(base), src); if (again) m.map.delete(ce); m.map.set(ce, text); };
  // (Claude Code puts an allow `!` rule it can't use, nor its literal path, after the others: its `oc`.)
  const unusableNeg = (r) => { const c = String(r.spec); if (!/^(?:\.\/)?!/.test(c)) return false; const n = ccClean(c.replace(/^\.\//, "")); return igProblem(ccTrim(n, false)) !== null && igCompileError(ccTrim(ccLiteral(n), false)) !== null; };
  const ordered = allow ? [...rules.filter((r) => !unusableNeg(r)), ...rules.filter(unusableNeg)] : rules;
  for (const r of ordered) {
    const a = anchorOf(r.spec, kind, { root, home });
    if (!a) continue;
    const base = a.root === null ? null : plainPath(a.root);
    const J = ccClean(a.pattern);
    const ce = ccKept(J, allow);
    if (ce === null) continue;
    for (const src of allow ? ["*"] : r.srcs || ["own"]) put(base, src, ce, r.text, !allow || (ce === "!**" && ce !== J));
    // A DENY OR ASK RULE WRITTEN THROUGH A LINKED FOLDER (Claude Code: "a deny or ask rule written through a symlinked
    // directory with a //, ~/, or / pattern also applies at the directory's real location"): its fixed start, followed.
    if (!allow && base !== null && typeof ctx.real === "function" && ce === J && J.startsWith("/")) {
      const segs = J.slice(1).split("/");
      const k = segs.findIndex((s) => /[*?[\\]/.test(s));
      const fixed = segs.slice(0, k < 0 ? segs.length - 1 : k);
      if (fixed.length) {
        let real = "";
        try { real = ctx.real(join(base, ...fixed)) || ""; } catch { real = ""; }
        const realBase = real ? plainPath(real) : "";
        if (realBase && realBase !== plainPath(join(base, ...fixed))) {
          const twin = "/" + segs.slice(fixed.length).join("/");
          if (igProblem(ccTrim(twin, false)) === null) for (const src of r.srcs || ["own"]) { const m = matcherOf(groupOf(realBase), src); if (!m.map.has(twin)) m.map.set(twin, r.text); }
        }
      }
    }
  }
  for (const g of groups.values()) {
    for (const b of g.base === null ? relativeBases(kind, ctx) : [g.base]) {
      const rel = relative(b, p);
      if (!igPathValid(rel)) continue;
      const tested = ctx.isDir && igPathValid(rel + "/") ? rel + "/" : rel;
      for (let q = g.matchers.length - 1; q >= 0; q--) {
        const m = g.matchers[q];
        let res;
        try { if (!m.lib) m.lib = igRules(Array.from(m.map.keys(), (x) => ccTrim(x, allow))); res = igTest(m.lib, tested); } catch {
          // (A test the library can't make: Claude Code's allow approves nothing; its deny and ask take the source's first rule
          // that isn't a `!` one.)
          if (allow) return "";
          const first = Array.from(m.map).find(([x]) => !x.startsWith("!"));
          if (first !== undefined) return first[1];
          continue;
        }
        if (!res.ignored || !res.rule) continue;
        // (The rule the library matched, by its pattern: Claude Code's lookup, `x/**` first.)
        const oe = res.rule.pattern, pe = oe + "/**";
        if (m.map.has(pe) && (oe.includes("/") || !allow)) return m.map.get(pe);
        if (oe.startsWith("/") && m.map.has(oe.slice(1) + "/**")) return m.map.get(oe.slice(1) + "/**");
        const we = m.map.get(oe);
        if (we !== undefined || allow) return we || "";
      }
    }
  }
  return "";
}

/**
 * A PATH IN FULL AS CLAUDE CODE MAKES ONE (2.1.325's St): trimmed; `~` and `~/…` in the home folder; a relative one from
 * `base`; made plain. "" for an empty path.
 */
export function fullPathFrom(raw, base = "/", home = "") {
  const n = String(raw ?? "").trim();
  if (!n) return "";
  if (home && n === "~") return plainPath(home);
  if (home && n.startsWith("~/")) return plainPath(join(home, n.slice(2)));
  return plainPath(n.startsWith("/") ? n : join(base || "/", n));
}

/**
 * A HOOK'S `if` ON A FILE TOOL'S PATH, its pattern part (Claude Code 2.1.325's akt, the matcher its Read, Edit, Write and
 * NotebookEdit tools give a hook's `if`): the rule's pattern read as an allow rule's, anchored as a permission rule's (`//` the
 * machine's root, `~/` the home folder, `/` the project, as a rule of the session's own), and a relative one at the folder
 * Coder's commands are in (its current folder: "a single-segment directory pattern like "Edit(src/**)" matches only the src
 * directory in the working directory"), tested by the library on its own against `full`, the file's full path. (Round 5,
 * 2026-11-14: Coder had counted a relative one from the project.) What else matches (`*.ts` anywhere) is ifRuleMatches'.
 */
export function ifPathMatches(spec, full, { cwd = "", root = "/", home = "" } = {}) {
  const a = anchorOf(String(spec ?? ""), "allow", { root, home });
  if (!a || typeof full !== "string" || !full.startsWith("/")) return false;
  const kept = ccKept(ccClean(a.pattern), true);
  if (kept === null) return false;
  const base = plainPath(a.root !== null ? a.root : typeof cwd === "string" && cwd.startsWith("/") ? cwd : root);
  const rel = relative(base, plainPath(full));
  if (!rel || !igPathValid(rel)) return false;
  try { return igTest(igRules([ccTrim(kept, true)]), rel).ignored; } catch { return false; }
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
