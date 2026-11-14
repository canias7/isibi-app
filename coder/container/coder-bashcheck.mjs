// CLAUDE CODE'S CHECKS ON A COMMAND, BEFORE AND AFTER IT RUNS (tool 4, bash; the owner, 2026-11-09: "do all of those and
// double check again against the claude code docs pls"). Each is read from Claude Code's docs and from Claude Code 2.1.319
// itself (its words, tried for real on 2026-11-09), on the command as coder-shell.mjs reads it.
import { posix } from "node:path";
import { lstatSync, readlinkSync, statSync } from "node:fs";
import { parseShell, unwrapped, leadWords, topTexts, basename } from "./coder-shell.mjs";

// ── WHAT AN EXIT CODE MEANS ──────────────────────────────────────────────────
// Claude Code's tools reference: "A command that exits 1 counts as a valid result for the Bash tool only when Claude Code
// recognizes exit code 1 as a benign outcome for that command: grep, rg, egrep, fgrep, find, diff, test, and [, plus git
// diff and git grep. Every other command that exits 1 counts as a failure". Its own table (2.1.319): grep, rg, egrep and
// fgrep "No matches found", find "Some directories were inaccessible", diff "Files differ", test and [ "Condition is
// false"; git diff "Files differ", git grep "No matches found"; for these an exit code of 2 or more is the failure. The
// command that decides is the last one (`jg(e).at(-1)`).
const BENIGN_ONE = new Map([["grep", "No matches found"], ["rg", "No matches found"], ["egrep", "No matches found"], ["fgrep", "No matches found"], ["find", "Some directories were inaccessible"], ["diff", "Files differ"], ["test", "Condition is false"], ["[", "Condition is false"]]);
/** git's own options before its subcommand (git -C dir diff, git -c a=b grep …). */
const GIT_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env", "--super-prefix"]);
export function gitSubcommand(words) {
  for (let k = 1; k < words.length; k++) {
    const t = words[k];
    if (GIT_WITH_VALUE.has(t)) { k++; continue; }
    if (t.startsWith("-")) continue;
    return t;
  }
  return "";
}
/** `{ isError, message }` for a command's exit code, as Claude Code reads it. */
export function exitMeaning(command, code) {
  if (!Number.isInteger(code)) return { isError: true, message: "" };
  const last = topTexts(command).at(-1) || String(command || "");
  const words = unwrapped(parseShell(last).commands.find((c) => c.top === 0)?.words || []).map((w) => w.text);
  const prog = basename(words[0] || "");
  let meaning = BENIGN_ONE.get(prog);
  if (prog === "git") { const sub = gitSubcommand(words); meaning = sub === "diff" ? "Files differ" : sub === "grep" ? "No matches found" : undefined; }
  if (meaning !== undefined) return { isError: code >= 2, message: code === 1 ? meaning : "" };
  return { isError: code !== 0, message: code !== 0 ? "Command failed with exit code " + code : "" };
}

// ── SLEEP ────────────────────────────────────────────────────────────────────
// Claude Code 2.1.319 refuses a foreground command whose first part is `sleep N` with N of 25 seconds or more (tried:
// "Blocked: standalone sleep 30. …", "Blocked: sleep 26 followed by: echo hi. …"), and never moves a command that
// starts with `sleep` to the background at its timeout (its docs: "unless the command starts with sleep").
export const SLEEP_BLOCK_S = 25;
export function sleepBlocked(command) {
  const parts = topTexts(command);
  if (!parts.length) return "";
  const m = /^sleep\s+(\d+(?:\.\d*)?)\s*$/.exec(parts[0].trim());
  if (!m) return "";
  const n = parseFloat(m[1]);
  if (!(n >= SLEEP_BLOCK_S)) return "";
  const rest = parts.slice(1).join(" ").trim();
  const what = rest ? "sleep " + n + " followed by: " + rest : "standalone sleep " + n;
  // (Claude Code 2.1.322's words, with Coder's name for its Monitor tool; Bash docs pass 9.)
  return "Blocked: " + what + ". To wait for a condition, use monitor with an until-loop (e.g. `until <check>; do sleep 2; done`). To wait for a command you started, use run_in_background: true. Do not chain shorter sleeps to work around this block.";
}
export function leadsWithSleep(command) {
  const parts = topTexts(command);
  const first = parts[0] ? parts[0].trim().split(/\s+/)[0] : "";
  return first === "sleep";
}

// ── THE FILES A COMMAND WRITES ───────────────────────────────────────────────
// Claude Code's permissions docs, Redirections: "for > file, >> file, or 2> file, the check covers … protected paths, and
// the working directories"; "Claude Code also checks the files a tee command writes, including in a pipeline such as
// make | tee build.log"; "Targets with no file behind them aren't checked: /dev/null, file-descriptor forms such as 2>&1".
// `afterCd`: a `cd` (or pushd) ran earlier in the same command, so a relative target's folder is not certain.
const NO_FILE = new Set(["/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty"]);
export function writeTargets(command) {
  const r = parseShell(command);
  const out = [];
  let cdSeen = false;
  const add = (word, how) => {
    if (!word || NO_FILE.has(word.text) || /^&?-?\d*$/.test(word.text) && how === "dup") return;
    out.push({ path: word.text, raw: word.raw, unsure: word.expand || word.glob || word.subst, afterCd: cdSeen, how });
  };
  for (const c of r.commands) {
    const w = unwrapped(c.words);
    const prog = w[0] ? basename(w[0].text) : "";
    for (const x of c.redirects) {
      if (x.heredoc || !x.target) continue;
      if (x.op === ">&" || x.op === "<&") { if (/^\d+$|^-$/.test(x.target.text)) continue; if (x.op === "<&") continue; }
      if (x.op.includes(">") || x.op === "<>") add(x.target, x.op);
    }
    if (prog === "tee") {
      for (let k = 1; k < w.length; k++) { const t = w[k].text; if (t === "--") continue; if (t.startsWith("-") && t.length > 1) continue; add(w[k], "tee"); }
    }
    if (prog === "cd" || prog === "pushd" || prog === "popd" || prog === "chdir") cdSeen = true;
  }
  return { ok: r.ok, targets: out };
}

// ── WHERE A PATH REALLY LEADS ────────────────────────────────────────────────
/**
 * A PATH WITH ITS LINKS FOLLOWED (Bash docs pass 3, the owner, 2026-11-10: "Ok yes do that"; Claude Code's permissions
 * docs, Symlinks: "When a file path Claude requests goes through a symlink, the permission check covers two paths: the one
 * Claude requested and the file it resolves to"; a write through a link that "resolves outside the working directories", or
 * "to a protected path that the requested path doesn't name", is asked about). Every link on the way is followed, the last
 * one too (a link to nothing yet still says where a write would land); what isn't there yet is kept as written. "" when it
 * can't be worked out: a loop, more than 40 links, a link that can't be read. Read on Coder's machine, where the AI's
 * commands see the same folders at the same places (the admin sandbox shows them where they are).
 */
/** Whether something is at a full path on this machine, its links followed (the read block checks only words that name one). */
export function pathExists(p) {
  if (typeof p !== "string" || !p.startsWith("/")) return false;
  try { statSync(p); return true; } catch { return false; }
}
export function realPath(p, { lstat = lstatSync, readlink = readlinkSync, max = 40 } = {}) {
  if (typeof p !== "string" || !p.startsWith("/")) return "";
  const todo = p.split("/").filter((x) => x && x !== ".");
  let cur = "", hops = 0;
  while (todo.length) {
    const seg = todo.shift();
    if (seg === "..") { cur = cur.slice(0, cur.lastIndexOf("/")); continue; }
    const next = cur + "/" + seg;
    let st = null;
    try { st = lstat(next); } catch { st = null; }
    if (!st) {
      const out = cur.split("/").filter(Boolean);
      for (const r of [seg, ...todo]) { if (r === "..") out.pop(); else if (r !== ".") out.push(r); }
      return "/" + out.join("/");
    }
    if (st.isSymbolicLink()) {
      if (++hops > max) return "";
      let to = "";
      try { to = String(readlink(next)); } catch { return ""; }
      if (!to) return "";
      if (to.startsWith("/")) cur = "";
      todo.unshift(...to.split("/").filter((x) => x && x !== "."));
      continue;
    }
    cur = next;
  }
  return cur || "/";
}
/**
 * WHERE A PATH LEADS, as the chat's folders name it: `realPath`, given back under a working folder's own name when that
 * folder is itself reached through a link (so its files don't look as if they led out of it). "" as realPath.
 */
export function leadsTo(full, workdirs = [], real = realPath) {
  const to = real(full);
  if (!to) return "";
  for (const w of workdirs) {
    if (typeof w !== "string" || !w) continue;
    const rw = real(w);
    if (rw && rw !== w && (to === rw || to.startsWith(rw + "/"))) return w + to.slice(rw.length);
  }
  return to;
}

// ── DANGEROUS REMOVALS ───────────────────────────────────────────────────────
// Claude Code's permission-modes docs, Critical paths: "Critical paths are the directories Claude Code protects from rm
// and rmdir commands, such as the filesystem root, your home directory, and your working directory". In auto mode, away
// from a terminal, Claude Code "denies it"; Coder asks no one about commands, so it does the same. Claude Code's own
// words (2.1.319) for each kind; those of a variable target, a backslash, a top-level name and a mounted drive, and "rmdir"
// for an rmdir, as Claude Code 2.1.325's raw program has them (2026-11-14, round 3).
const NEEDS = " This requires explicit approval and cannot be auto-allowed by permission rules.";
export const RM_UNCHECKED = "This command could not be checked for dangerous rm operations: the shell may read it differently than it was parsed. This requires explicit approval.";
const SYSTEM_WHY = "This command would remove a critical system directory.";
const WORKSPACE_WHY = "This command would remove a workspace directory (the working directory, an additional working directory, or one of their parent directories).";
const MOUNT_WHY = "This command would remove a mounted drive, the folder that holds mounted drives, or a file or folder at the top level of a drive.";
const GLOB_DEEP_WHY = "This command's glob pattern traverses directories that cannot be statically enumerated.";
const CD_GLOB_WHY = "This command changes directories before the removal, so the relative glob target cannot be statically resolved.";
const SUBST_WHY = "Dangerous rm operation detected: the target is the output of a command substitution (`$(...)` or backticks) and cannot be checked before the command runs." + NEEDS + "\n\nRun the substitution on its own first, then remove the literal paths it prints.";
const SCRIPT_WHY = "Dangerous rm operation in a shell -c script: its target is built from a variable or command output known only when it runs, and if that is empty the rm can reach a directory like / or your home directory." + NEEDS + " Pass a literal path, or guard the value with ${NAME:?}.";
const BACKSLASH_WHY = "A backslash-only target is the drive root in Git Bash on Windows.";
/** Names a variable may stand before, which make a removal of a top-level folder when the variable is empty (Claude Code: "such as mnt, tmp, usr, or Users"). */
const TOP_NAMES = new Set(["bin", "boot", "data", "dev", "etc", "home", "lib", "lib32", "lib64", "media", "mnt", "opt", "proc", "root", "run", "sbin", "snap", "srv", "sys", "tmp", "usr", "var", "work", "Users", "Applications", "Library", "System", "Volumes", "private"]);
/** Substitutions that print a folder: a variable set from one names the working directory or the repository's root. */
const DIR_SUBST = /^\$\(\s*(pwd(\s+-[LP])?|git\s+rev-parse\s+--show-(toplevel|cdup|prefix)|dirname\b[^)]*|realpath\b[^)]*|readlink\s+-f\b[^)]*|cd\b[^)]*&&\s*pwd)\s*\)$|^`\s*pwd\s*`$/;

// (Claude Code 2.1.325's raw program, 2026-11-14, round 3: "rm" or "rmdir", as the command is; after the backslash-only,
// top-level-name and mounted-drive refusals a paragraph of advice of their own, `then`.)
const say = (target, why, prog = "rm", then = "") => "Dangerous " + prog + " operation detected: '" + target + "'\n\n" + why + NEEDS + (then ? "\n\n" + then : "");
const BACKSLASH_THEN = "Write the directory you mean as a path, for example /c/work/build or C:/work/build.";
const LITERAL_THEN = "Use a literal absolute path instead.";
const MOUNT_THEN = "If you meant something deeper inside, name it by its full path.";

// ── A TARGET THAT IS A SHELL VARIABLE, IN CLAUDE CODE 2.1.325'S WORDS (its jRe, from its raw program; 2026-11-14, round 3) ─────
// The command as written from rm on ("Dangerous rm operation detected in `rm -rf "$DIR"/*`"), what the variable is set from
// when the command sets it from a folder, and its advice: guard the variable, bind a positional, or use a literal path.
/** Variables that are normally set: a `${NAME:?}` guard on one would not stop the removal (Claude Code's list). */
const NORMALLY_SET = new Set(["HOME", "USERPROFILE", "HOMEPATH", "HOMEDRIVE", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME", "APPDATA", "LOCALAPPDATA", "SYSTEMDRIVE", "SYSTEMROOT", "WINDIR", "PROGRAMFILES", "PROGRAMW6432", "PROGRAMDATA", "ALLUSERSPROFILE", "PUBLIC", "HOMESHARE", "XDG_RUNTIME_DIR", "PWD", "OLDPWD", "TMPDIR", "TMP", "TEMP"]);
/** The most of the command, or of a variable's value, shown (Claude Code's 120 characters, then "…"). */
const SHOWN_MAX = 120;
const cutShown = (s) => { let c = s.slice(0, SHOWN_MAX); if (/[\uD800-\uDBFF]$/.test(c)) c = c.slice(0, -1); return c; };
/**
 * Words as Claude Code shows them: each unquoted $( … ) or `…` as "$(…)", white space and control characters as one space.
 * (Inside quotes it keeps them as written, as Claude Code's first reading does.)
 */
export function shownWords(text) {
  const s = String(text);
  let out = "", q = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && q !== "'") { out += ch + (s[i + 1] ?? ""); i++; continue; }
    if (q) { if (ch === q) q = null; out += ch; continue; }
    if (ch === "'" || ch === "\"") { q = ch; out += ch; continue; }
    if (ch === "`") { const e = s.indexOf("`", i + 1); if (e > i) { out += "$(\u2026)"; i = e; continue; } }
    if (ch === "$" && s[i + 1] === "(" && s[i + 2] !== "(") {
      let level = 0, j = i + 1;
      for (; j < s.length; j++) { if (s[j] === "(") level++; else if (s[j] === ")" && --level === 0) break; }
      if (j < s.length) { out += "$(\u2026)"; i = j; continue; }
    }
    out += ch;
  }
  return out.replace(/[\s\p{Cc}]+/gu, " ");
}
/** A target without its closing quotes' trailing "/", "/*" or "/." (Claude Code's ffn). */
function withoutTail(e) {
  let n = e.length;
  while (n > 0 && /["']/.test(e[n - 1])) n--;
  let r = n;
  while (r > 0 && /[/*.]/.test(e[r - 1])) r--;
  return r < n && e[r] === "/" ? e.slice(0, r) : e;
}
/** The variable a word is, quoted or not ($D, "${D}", ${D:?}), or undefined (Claude Code's mfn). */
const onlyVariable = (e) => { const m = /^["']*\$(?:\{([A-Za-z_][A-Za-z0-9_]*)(?::?[?-][^}]*)?\}|([A-Za-z_][A-Za-z0-9_]*))["']*$/.exec(e); return m ? m[1] ?? m[2] : undefined; };
/** The quote a place in a word is inside: '"', "'" or null (Claude Code's URe). */
function quoteAt(s, n) {
  let q = null;
  for (let i = 0; i < n; i++) {
    const h = s[i];
    if (h === "\\" && (q === null || (q === "\"" && /["\\$`]/.test(s[i + 1] ?? "")))) { i++; continue; }
    if (q === null) { if (h === "\"" || h === "'") q = h; } else if (h === q) q = null;
  }
  return q;
}
/**
 * What a variable set from a folder-printing command or $PWD is (Claude Code's `becomes`): pwd "prints the current directory",
 * git rev-parse "prints a git value such as the repository root", dirname and cd its own words. (realpath and readlink -f, and
 * a dirname or a cd of a plain folder, are caught by Coder only: Claude Code does not count them; said as they are.)
 */
function folderValue(value) {
  const x = value.replace(/^"|"$/g, "");
  if (/^\$\{?PWD\}?\/?$/.test(x)) return { value, becomes: "is the current directory" };
  if (!DIR_SUBST.test(x)) return null;
  const inner = x.startsWith("`") ? x.slice(1, -1) : x.slice(2, -1);
  let becomes = "prints a folder";
  if (/^\s*git\s+rev-parse\b/.test(inner)) becomes = "prints a git value such as the repository root";
  else if (/^\s*pwd(?![A-Za-z0-9_-])/.test(inner)) becomes = "prints the current directory";
  else {
    const m = /^\s*(cd|dirname)(?![A-Za-z0-9_-])/.exec(inner);
    if (m) {
      const arg = (/^\s*(?:cd|dirname)\s+(?:--?\w*\s+)*([^\s;&|]*)/.exec(inner) || [])[1];
      const plain = arg !== undefined && arg !== "" && !/[$`]/.test(arg) && !/^(?:""|'')$/.test(arg);
      const up = (p) => p.replace(/\/+[^/]*\/*$/, "") || (p.startsWith("/") ? "/" : ".");
      if (m[1] === "dirname") becomes = plain ? "prints " + up(arg.replace(/^(["'])(.*)\1$/, "$2")) : "prints the current directory (as `.`) when its input is empty";
      else becomes = plain ? "prints the current directory" : "prints the current directory when its input is empty (`cd \"\"` stays put)";
    }
  }
  return { value, becomes };
}
/**
 * CLAUDE CODE'S REFUSAL OF A VARIABLE TARGET: `prog` rm or rmdir, `words` the command's words from rm on, `at` the target's
 * place among them, `inSubst` the command is inside a $( … ), `reparsed` it is read again before it runs (a double-quoted
 * shell -c script), `derived` { value, becomes } when the command set the variable from a folder.
 */
function variableRmWhy({ prog, words, at, inSubst = false, reparsed = false, derived = null }) {
  const raws = words.map((x) => x.raw);
  const all = shownWords(raws.join(" "));
  const s = shownWords(raws[at]);
  let h = all;
  if (all.length > SHOWN_MAX) h = cutShown(all) + "\u2026" + (shownWords(raws.slice(0, at + 1).join(" ")).length <= SHOWN_MAX ? "" : " " + s);
  const names = [], parts = [];
  const guarded = s.replace(/\$(?:\{([A-Za-z_][A-Za-z0-9_]*|[0-9]+|[@*!])(?::?-(?:["']{2}|"?\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?"?)?)?\}|([A-Za-z_][A-Za-z0-9_]*|[0-9]+|[@*!]))/g, (written, braced, fallback, bare, offset) => {
    const name = braced ?? bare;
    names.push(name);
    let g = "${" + name + ":?}";
    if (fallback !== undefined) { names.push(fallback); g = "${" + name + ":-${" + fallback + ":?}}"; }
    if (quoteAt(s, offset) === null) g = "\"" + g + "\"";
    parts.push({ name, written, guarded: g });
    return g;
  });
  const list = names.length ? [...new Set(names)] : ["VAR"];
  const vars = list.map((n) => "$" + n).join(" or ");
  const where = inSubst ? " (inside a command substitution)" : "";
  const head = "Dangerous " + prog + " operation detected in `" + h + "`" + where + ". ";
  if (derived) {
    const name = onlyVariable(withoutTail(s)) ?? list[0];
    const value = derived.value.replace(/[\s\p{Cc}]+/gu, " ");
    const shown = value.length > SHOWN_MAX ? cutShown(value) + "\u2026" : value;
    return head + "This command sets $" + name + " from `" + shown + "`, which " + derived.becomes + ", so this " + prog + " can remove that directory. A `${" + name + ":?}` guard does not help, because $" + name + " is not empty." + NEEDS + "\n\n" + LITERAL_THEN;
  }
  const hint = (() => {
    const normally = list.filter((n) => NORMALLY_SET.has(n.toUpperCase())).map((n) => "$" + n).join(" or ");
    if (normally) return "use a literal absolute path: " + normally + " is normally set, so a guard on it would not stop this " + prog;
    const positional = (n) => /^(?:[0-9]+|[@*!])$/.test(n);
    const bound = list.filter(positional);
    if (bound.length) {
      const rewrite = parts.filter((p) => !positional(p.name) && !reparsed).map((p) => "`" + p.written + "` as `" + p.guarded + "`").join(" and ");
      return "bind " + bound.map((n) => "$" + n).join(" or ") + (rewrite ? " and rewrite its " + rewrite : "") + " (in an inline `sh -c` script, single-quote the script so this shell does not expand the positional) or use a literal absolute path";
    }
    if (reparsed) return "use a literal absolute path: this " + prog + " is parsed again before it runs (it is inside a quoted string or after eval), so a pasted guard's quotes would not protect it";
    const rest = parts.reduce((t, p) => t.replace(p.guarded, ""), guarded);
    if (!parts.length || rest.includes("$")) return "use a literal absolute path: this check cannot verify part of this target";
    return "rewrite it as `" + guarded + "`, which makes the shell stop with an error instead of running " + prog + " when " + vars + " is unset or empty, or use a literal absolute path";
  })();
  return head + "The target '" + s + "' is a shell variable expansion: when " + vars + " is unset or empty it becomes `/`, `/*` or a top-level path." + NEEDS + "\n\nThis check does not fire on a target that cannot expand to the filesystem root: " + hint + ".";
}

/**
 * Why this command is a dangerous removal ("" when it is not). `cwd`: where the command starts. `home`: the AI's home.
 * `workdirs`: the project's folder first, then the chat's other repositories (Claude Code's additional working
 * directories).
 */
/**
 * (`off`: the environment's switches, Claude Code's CLAUDE_CODE_DISABLE_SUBSTITUTION_RM_PROMPT, …_INLINE_SHELL_RM_PROMPT
 * and …_MOUNTED_DRIVE_RM_PROMPT, here CODER_: `subst`, a target that is only a substitution's output; `inline`, a
 * critical path typed directly in a -c script; `mounted`, the mounted drive prompt.)
 */
export function dangerousRm(command, { cwd = "/", home = "/home/dev", workdirs = [], off = {} } = {}) {
  const src = String(command || "");
  const r = parseShell(src);
  // (Any command the shell may read differently, rm in it or not: Claude Code's docs, "a removal could sit in an unchecked
  // part, even with no rm present". Bash docs pass 9: Coder said so only when the text named rm.)
  if (!r.ok) return RM_UNCHECKED;
  const work = workdirs.filter((d) => typeof d === "string" && d.startsWith("/")).map((d) => posix.normalize(d).replace(/\/$/, "") || "/");
  const primary = work[0] || "";
  // Variables the command itself sets: to a folder-printing substitution (never safe), or to something else.
  // (Each with what it was set from and what that is, in Claude Code 2.1.325's words: folderValue.)
  const fromDirSubst = new Map(), assigned = new Set();
  // Where the command's own `cd`s take it: a literal folder, or unknown.
  let here = posix.normalize(cwd || "/"), hereKnown = true, cdSeen = false;
  const homeDir = posix.normalize(home || "/home/dev");
  // (Bash docs pass 9, Claude Code 2.1.281: "a variable derived from the working directory" too: one set from $PWD, after
  // export, local, declare, typeset or readonly, or a copy of one: `D=$PWD; rm -rf "$D"` was not caught.)
  // (A copy of one is what its source was set from, as in Claude Code.)
  const derived = (v) => { const x = v.replace(/^"|"$/g, ""); const copy = /^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?\/?$/.exec(x); return folderValue(v) || (copy && copy[1] !== "PWD" ? fromDirSubst.get(copy[1]) || null : null); };
  for (const c of r.commands) {
    const lw = leadWords(c.words);
    const decl = !!lw[0] && !lw[0].quoted && /^(export|local|declare|typeset|readonly)$/.test(lw[0].text);
    const words = decl ? [...c.words.slice(0, c.words.length - lw.length), ...lw.slice(1).filter((x) => !/^[-+]/.test(x.text))] : c.words;
    for (const w of words) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s.exec(w.raw);
      if (!m) { if (decl) continue; break; }
      assigned.add(m[1]);
      const d = derived(m[2]);
      if (d) fromDirSubst.set(m[1], d); else fromDirSubst.delete(m[1]);
    }
  }
  // (A positional parameter the command gives a value itself, with `set -- …` or in a function it defines: Claude Code
  // flags `$1` only when nothing does.)
  const positionalGiven = /(^|[;&|\n({]\s*)set\s+--\s+[^\s;&|$`]/.test(src) || /(^|[\s;&|({])[A-Za-z_][A-Za-z0-9_]*\s*\(\s*\)\s*\{|(^|[\s;&|({])function\s+[A-Za-z_]/.test(src);
  for (const c of r.commands) {
    const w = unwrapped(c.words);
    const prog = w[0] ? basename(w[0].text) : "";
    if (prog === "cd" || prog === "pushd" || prog === "chdir") {
      cdSeen = true;
      const t = w.find((x, k) => k > 0 && !x.text.startsWith("-"));
      if (c.top >= 0 && t && !t.expand && !t.glob && !t.subst) { here = t.text.startsWith("/") ? posix.normalize(t.text) : t.tilde ? posix.normalize(homeDir + t.text.slice(1)) : posix.join(here, t.text); }
      else hereKnown = false;
      continue;
    }
    if (prog === "popd") { hereKnown = false; cdSeen = true; continue; }
    // (Read the wide way too, as Claude Code 2.1.323 reads commands for deny and ask rules (unwrapSteps): settings written
    // together whose last letter takes a value. The owner, 2026-11-13, "Yes all 7": `sudo -nu root rm -rf /` and
    // `env -iu FOO rm -rf ~` were read as running `root` and `FOO`, so this check never saw the rm, and in Auto they ran.)
    const ww = unwrapped(c.words, { wide: true });
    for (const v of ww.length !== w.length || ww.some((x, k) => x !== w[k]) ? [w, ww] : [w]) {
      const why = rmWhy(v, c);
      if (why) return why;
    }
  }
  return "";
  function rmWhy(w, c) {
    const prog = w[0] ? basename(w[0].text) : "";
    if (prog !== "rm" && prog !== "rmdir") return "";
    const args = [];
    let opts = true, recursive = prog === "rmdir";
    for (let k = 1; k < w.length; k++) {
      const a = w[k];
      if (opts && a.text === "--") { opts = false; continue; }
      if (opts && /^-[A-Za-z]+$/.test(a.text) && !a.quoted) { if (/[rR]/.test(a.text)) recursive = true; continue; }
      if (opts && a.text.startsWith("--") && !a.quoted) { if (a.text === "--recursive") recursive = true; continue; }
      args.push(a);
    }
    for (const a of args) {
      const why = targetDanger(a, { c, prog, words: w, recursive, here, hereKnown: hereKnown && c.top >= 0, cdSeen, homeDir, work, primary, fromDirSubst, assigned, positionalGiven, off: off || {} });
      if (why) return why;
    }
    return "";
  }
}

function targetDanger(a, { c, prog = "rm", words = [a], recursive, here, hereKnown, cdSeen, homeDir, work, primary, fromDirSubst, assigned, positionalGiven = false, off = {} }) {
  // (Claude Code 2.1.325's refusal of a variable target names the command from rm on: variableRmWhy.)
  const varWhy = (derived = null) => variableRmWhy({ prog, words, at: Math.max(0, words.indexOf(a)), inSubst: !!c.inSubst, reparsed: !!c.inScript && c.scriptQuote === "double", derived });
  const raw = a.raw, text = a.text;
  // INSIDE A SHELL -c SCRIPT: a double-quoted script's variables are the outer shell's (empty $1 there); a single-quoted
  // one's are its own, and a $1 the script is given counts as given.
  if (c.inScript && /\$|`/.test(text)) {
    const positional = /^\$\{?([0-9@*])\}?/.exec(text);
    const given = c.scriptQuote === "single" && positional && Array.isArray(c.scriptArgs) && c.scriptArgs.length >= 2;
    if (!given && !/\$\{[A-Za-z_][A-Za-z0-9_]*:\?[^}]*\}/.test(text)) return SCRIPT_WHY;
    // "A single-quoted script that binds $1 to a real value, as sh -c 'rm -rf "$1"/*' _ {} does, isn't flagged."
    if (given) return "";
  }
  // A CRITICAL PATH TYPED DIRECTLY IN A -c SCRIPT, with CODER_DISABLE_INLINE_SHELL_RM_PROMPT: not checked.
  if (off.inline && c.inScript && !/\$|`/.test(text)) return "";
  // ONLY A SUBSTITUTION'S OUTPUT, when recursive (Claude Code: rm -rf "$(pwd)"); not with CODER_DISABLE_SUBSTITUTION_RM_PROMPT.
  if (recursive && a.subst && /^(\$\([^]*\)|`[^`]*`)$/.test(text)) return off.subst ? "" : SUBST_WHY;
  // ONLY BACKSLASHES.
  if (/^\\+$/.test(text)) return say(raw, BACKSLASH_WHY, prog, BACKSLASH_THEN);
  // A VARIABLE FROM A FOLDER-PRINTING SUBSTITUTION ("A ${D:?} guard doesn't clear this check, because the variable isn't empty").
  // (Only the folder itself, `$D`, `$D/` or `$D/*`, as Claude Code's: `"$ROOT/dist"` is a folder inside it.)
  const v = /^\$\{?([A-Za-z_][A-Za-z0-9_]*)(:\?[^}]*)?\}?(.*)$/s.exec(text);
  if (v && fromDirSubst.has(v[1]) && /^(\/|\/\*)?$/.test(v[3])) return varWhy(fromDirSubst.get(v[1]));
  // A GLOB OR TRAILING SLASH DIRECTLY UNDER A VARIABLE, unguarded ("rm -rf "$DIR"/*": "The command becomes a removal from
  // the filesystem root when the variable is empty"); positional parameters the same, when nothing gives them a value.
  const under = /^\$\{?([A-Za-z_][A-Za-z0-9_]*|[0-9@*])(:\?[^}]*)?\}?\/(\*\/?|\.\*|)$/s.exec(text);
  if (under && !under[2] && !(positionalGiven && !c.inScript && /^[0-9@*]$/.test(under[1]))) return varWhy();
  // A VARIABLE FOLLOWED BY A TOP-LEVEL FOLDER'S NAME ("rm -rf "$TMPDIR/mnt"": when it is empty, /mnt goes).
  const top = /^\$\{?([A-Za-z_][A-Za-z0-9_]*|[0-9@*])(:\?[^}]*)?\}?\/([^/]+)\/?$/s.exec(text);
  if (top && !top[2] && TOP_NAMES.has(top[3]) && top[1] !== "HOME") return say(raw, "The target starts with a shell expansion this check cannot read and ends in a top-level directory name: if the expansion is empty, this removes '/" + top[3] + "'.", prog, LITERAL_THEN);
  // WHERE IT IS: ~ and $HOME are the home folder; a trailing substitution counts as empty ("rm -rf ~/$(cmd)": the home
  // folder); a relative target counts from where the command is.
  let path = text.replace(/^\$\{?HOME\}?(?=\/|$)/, homeDir);
  if (a.tilde) path = path.replace(/^~(?=\/|$)/, homeDir);
  if (/\$\(|`/.test(path)) path = path.replace(/\$\([^]*\)|`[^`]*`/g, "");
  if (/\$/.test(path)) return ""; // another variable: not known before it runs, and none of the cases above
  const relative = !path.startsWith("/");
  // A RELATIVE GLOB AFTER A cd IN THE SAME COMMAND (Claude Code's example: "cd logs && rm -rf a/*").
  if (relative && a.glob && cdSeen) return say(raw, CD_GLOB_WHY, prog);
  if (relative) {
    if (!hereKnown) return /^\.\.?(\/|$)/.test(path) ? say(raw, "This command's removal target cannot be statically resolved to a directory.", prog) : "";
    path = posix.join(here, path);
  }
  let target = posix.normalize(path).replace(/\/$/, "") || "/", whole = false;
  if (a.glob && /[*?[]/.test(path)) {
    const parts = path.split("/");
    const trailing = parts[parts.length - 1] === "";
    if (trailing) parts.pop();
    const firstGlob = parts.findIndex((x) => /[*?[]/.test(x));
    // Through folders it cannot list first ("rm -rf logs/*/*", "rm -rf logs/*/").
    if (firstGlob < parts.length - 1 || trailing) return say(raw, GLOB_DEEP_WHY, prog);
    // Only a glob that takes a folder's whole contents counts as removing that folder ("rm -rf <dir>/*"); "*.log" does not.
    if (!/^(\*|\.\*|\*\.\*|\.\[!.\]\*|\{\*,\.\*\}|\.\?\*)$/.test(parts[parts.length - 1])) return "";
    target = posix.normalize(parts.slice(0, -1).join("/") || "/").replace(/\/$/, "") || "/";
    whole = true;
  }
  // THE ROOT, A TOP-LEVEL FOLDER, THE HOME FOLDER (and the folders above it).
  if (target === "/" || /^\/[^/]+$/.test(target)) return say(raw, SYSTEM_WHY, prog);
  if (target === homeDir || homeDir.startsWith(target + "/")) return say(raw, SYSTEM_WHY, prog);
  // THE WORKING DIRECTORY AND ITS PARENTS; another working directory and its parents only for a glob under them.
  if (primary && (target === primary || primary.startsWith(target + "/"))) return say(raw, WORKSPACE_WHY, prog);
  if (whole) for (const d of work.slice(1)) if (target === d || d.startsWith(target + "/")) return say(raw, WORKSPACE_WHY, prog);
  // MOUNTED DRIVES (a recursive removal, or a /* under one).
  // (Claude Code 2.1.325: "Dangerous rm operation detected: '<the path, as resolved>'", then its advice; "on mounted drive
  // path: …" is only its reason's line.)
  if (!off.mounted && (recursive || whole) && mountShape(target)) return say(path, MOUNT_WHY, prog, MOUNT_THEN);
  return "";
}
function mountShape(p) {
  const s = p.split("/").filter(Boolean);
  if (s[0] === "mnt") return s.length === 2 || (s.length === 3 && /^[a-z]$/.test(s[1]));
  if (s[0] === "media") return s.length >= 2 && s.length <= 4;
  if (s[0] === "run" && s[1] === "media") return s.length >= 2 && s.length <= 5;
  if (s[0] === "Volumes") return s.length >= 2 && s.length <= 3;
  return false;
}

export { leadWords };
