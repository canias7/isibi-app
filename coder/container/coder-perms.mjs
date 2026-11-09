// PERMISSION MODES AND RULES, LIKE CLAUDE CODE'S (the owner, 2026-11-09: "lets build the permission things", with the
// Claude app's mode menu: Auto "Claude handles permission decisions", Accept edits "Automatically accept all file edits",
// Plan "Create a plan before making changes"; "something like this").
//
// Claude Code's cloud sessions offer these three ("Cloud sessions support Accept edits, Plan, and Auto"). What runs
// without asking in each (its permission-modes docs, "Available modes"):
//   auto         everything, with Coder's own safety checks ("Everything, with background safety checks")
//   acceptEdits  reads, file edits, and the common file commands (mkdir, touch, rm, rmdir, mv, cp, sed) on paths inside
//                the project; any other command asks, except Claude Code's built-in read-only set
//   plan         reads and the read-only set; nothing changes until the owner approves the plan
// Rules (its permissions docs): `Bash(npm test *)`, `WebFetch(domain:example.com)`; deny first, then ask, then allow.
//
// THE READ-ONLY SET is Claude Code 2.1.319's own (its lists, read from it on 2026-11-09): commands that run with any
// arguments, commands with a list of safe options each (git log, grep, sed …), and a few exact ones; an unquoted glob is
// allowed only for the commands whose every option only reads.
import { parseShell, unwrapped, leadWords, basename } from "./coder-shell.mjs";
// (No node: modules here: Coder's Worker loads this file too, for the modes and the rules.)

export const MODES = ["auto", "acceptEdits", "plan"];
export const MODE_NAMES = { auto: "Auto", acceptEdits: "Accept edits", plan: "Plan" };
/** The menu's lines (the Claude app's, with Coder's name). */
export const MODE_INFO = { auto: "Coder handles permission decisions", acceptEdits: "Automatically accept all file edits", plan: "Create a plan before making changes" };
export function normMode(m) { return MODES.includes(m) ? m : "auto"; }

// ── CLAUDE CODE'S SAFE OPTIONS ───────────────────────────────────────────────
// Each option's kind: "none" (no value), "string", "number", "char", "{}" (xargs -I's), "EOF".
const G = {
  stat: { "--stat": "none", "--numstat": "none", "--shortstat": "none", "--name-only": "none", "--name-status": "none" },
  color: { "--color": "none", "--no-color": "none" },
  pretty: { "--oneline": "none", "--graph": "none", "--decorate": "none", "--no-decorate": "none", "--date": "string", "--relative-date": "none" },
  refs: { "--all": "none", "--branches": "none", "--tags": "none", "--remotes": "none" },
  since: { "--since": "string", "--after": "string", "--until": "string", "--before": "string" },
  count: { "--max-count": "number", "-n": "number" },
  patch: { "--patch": "none", "-p": "none", "--no-patch": "none", "--no-ext-diff": "none", "-s": "none" },
  who: { "--author": "string", "--committer": "string", "--grep": "string" },
};
const SUMS = { "-b": "none", "--binary": "none", "-t": "none", "--text": "none", "-c": "none", "--check": "none", "--ignore-missing": "none", "--quiet": "none", "--status": "none", "--strict": "none", "-w": "none", "--warn": "none", "--tag": "none", "-z": "none", "--zero": "none", "--help": "none", "--version": "none" };
const GREP = { "-e": "string", "--regexp": "string", "-f": "string", "--file": "string", "-F": "none", "--fixed-strings": "none", "-G": "none", "--basic-regexp": "none", "-E": "none", "--extended-regexp": "none", "-P": "none", "--perl-regexp": "none", "-i": "none", "--ignore-case": "none", "--no-ignore-case": "none", "-v": "none", "--invert-match": "none", "-w": "none", "--word-regexp": "none", "-x": "none", "--line-regexp": "none", "-c": "none", "--count": "none", "--color": "string", "--colour": "string", "-L": "none", "--files-without-match": "none", "-l": "none", "--files-with-matches": "none", "-m": "number", "--max-count": "number", "-o": "none", "--only-matching": "none", "-q": "none", "--quiet": "none", "--silent": "none", "-s": "none", "--no-messages": "none", "-b": "none", "--byte-offset": "none", "-H": "none", "--with-filename": "none", "-h": "none", "--no-filename": "none", "--label": "string", "-n": "none", "--line-number": "none", "-T": "none", "--initial-tab": "none", "-u": "none", "--unix-byte-offsets": "none", "-Z": "none", "--null": "none", "-z": "none", "--null-data": "none", "-A": "number", "--after-context": "number", "-B": "number", "--before-context": "number", "-C": "number", "--context": "number", "--group-separator": "string", "--no-group-separator": "none", "-a": "none", "--text": "none", "--binary-files": "string", "-I": "none", "-D": "string", "--devices": "string", "-d": "string", "--directories": "string", "--exclude": "string", "--exclude-from": "string", "--exclude-dir": "string", "--include": "string", "-r": "none", "--recursive": "none", "-R": "none", "--dereference-recursive": "none", "--line-buffered": "none", "-U": "none", "--binary": "none", "--help": "none", "-V": "none", "--version": "none" };

// git log and its kin: a format that checks signatures runs gpg; a named format other than git's own may be the
// repository's (its config); --sort, --group and --format values with expansions are refused too.
const SIGNATURE = /%[-+ ]?G|%\(\*?signature/;
const GIT_PRETTY = new Set(["oneline", "short", "medium", "full", "fuller", "email", "raw"]);
function gitFormatDanger(args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (SIGNATURE.test(a)) return true;
    for (const f of ["--format", "--pretty", "--sort", "--group"]) {
      let v;
      if (a === f && i + 1 < args.length) v = args[i + 1];
      else if (a.startsWith(f + "=")) v = a.slice(f.length + 1);
      if (v === undefined) continue;
      if (/[$`]/.test(v) || (v.includes("~") && v.includes("{")) || SIGNATURE.test(v) || v.includes("signature")) return true;
      if ((f === "--format" || f === "--pretty") && v !== "" && !v.includes("%") && !/^t?format:/.test(v) && !GIT_PRETTY.has(v)) return true;
    }
  }
  return false;
}
/** `git tag` / `git branch`: a name only with -l / --list (or right after --merged for branch), else it makes one. */
function listOnly(args, withValue, valueTakers = new Set()) {
  let listing = false, after = false, last = "";
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a) continue;
    if (a === "--" && !after) { after = true; last = ""; continue; }
    if (!after && a.startsWith("-")) {
      if (a === "--list" || a === "-l" || (a[1] !== "-" && a.length > 2 && !a.includes("=") && a.slice(1).includes("l"))) listing = true;
      if (a.includes("=")) last = a.split("=")[0];
      else if (withValue.has(a)) { last = a; i++; }
      else last = a;
      continue;
    }
    if (!listing && !valueTakers.has(last)) return true;
  }
  return false;
}
const SED_SAFE = (args) => !sedScriptsSafe(args);

const GIT = {
  "git diff": { flags: { ...G.stat, ...G.color, "--dirstat": "none", "--summary": "none", "--patch-with-stat": "none", "--word-diff": "none", "--word-diff-regex": "string", "--color-words": "none", "--no-renames": "none", "--no-ext-diff": "none", "--check": "none", "--ws-error-highlight": "string", "--full-index": "none", "--binary": "none", "--abbrev": "number", "--break-rewrites": "none", "--find-renames": "none", "--find-copies": "none", "--find-copies-harder": "none", "--irreversible-delete": "none", "--diff-algorithm": "string", "--histogram": "none", "--patience": "none", "--minimal": "none", "--ignore-space-at-eol": "none", "--ignore-space-change": "none", "--ignore-all-space": "none", "--ignore-blank-lines": "none", "--inter-hunk-context": "number", "--function-context": "none", "--exit-code": "none", "--quiet": "none", "--cached": "none", "--staged": "none", "--pickaxe-regex": "none", "--pickaxe-all": "none", "--no-index": "none", "--relative": "string", "--diff-filter": "string", "-p": "none", "-u": "none", "-s": "none", "-M": "none", "-C": "none", "-B": "none", "-D": "none", "-l": "none", "-S": "string", "-G": "string", "-O": "string", "-R": "none" } },
  "git log": { flags: { ...G.pretty, ...G.refs, ...G.since, ...G.count, ...G.stat, ...G.color, ...G.patch, ...G.who, "--abbrev-commit": "none", "--full-history": "none", "--dense": "none", "--sparse": "none", "--simplify-merges": "none", "--ancestry-path": "none", "--source": "none", "--first-parent": "none", "--merges": "none", "--no-merges": "none", "--reverse": "none", "--walk-reflogs": "none", "--skip": "number", "--max-age": "number", "--min-age": "number", "--no-min-parents": "none", "--no-max-parents": "none", "--follow": "none", "--no-walk": "none", "--left-right": "none", "--cherry-mark": "none", "--cherry-pick": "none", "--boundary": "none", "--topo-order": "none", "--date-order": "none", "--author-date-order": "none", "--pretty": "string", "--format": "string", "--diff-filter": "string", "-S": "string", "-G": "string", "--pickaxe-regex": "none", "--pickaxe-all": "none" }, danger: gitFormatDanger },
  "git show": { flags: { ...G.pretty, ...G.stat, ...G.color, ...G.patch, "--abbrev-commit": "none", "--word-diff": "none", "--word-diff-regex": "string", "--color-words": "none", "--pretty": "string", "--format": "string", "--first-parent": "none", "--raw": "none", "--diff-filter": "string", "-m": "none", "--quiet": "none" }, danger: gitFormatDanger },
  "git shortlog": { flags: { ...G.refs, ...G.since, "-s": "none", "--summary": "none", "-n": "none", "--numbered": "none", "-e": "none", "--email": "none", "-c": "none", "--committer": "none", "--group": "string", "--format": "string", "--no-merges": "none", "--author": "string" }, danger: gitFormatDanger },
  "git reflog": { flags: { ...G.pretty, ...G.refs, ...G.since, ...G.count, ...G.who }, danger: (a) => (a[0] && !a[0].startsWith("-") && !["show", "list"].includes(a[0])) || a.some((x) => ["expire", "delete", "exists", "drop", "write"].includes(x)) },
  "git stash list": { flags: { ...G.pretty, ...G.refs, ...G.count }, ddash: false },
  "git ls-remote": { flags: { "--branches": "none", "-b": "none", "--tags": "none", "-t": "none", "--heads": "none", "-h": "none", "--refs": "none", "--quiet": "none", "-q": "none", "--exit-code": "none", "--get-url": "none", "--symref": "none", "--sort": "string" }, danger: (a) => gitFormatDanger(a) || a.some((x) => x === "-o" || x === "--server-option" || x.startsWith("--server-option=")) || a.some((x, i) => x && !x.startsWith("-") && a[i - 1] !== "--sort") },
  "git status": { flags: { "--short": "none", "-s": "none", "--branch": "none", "-b": "none", "--porcelain": "none", "--long": "none", "--verbose": "none", "-v": "none", "--untracked-files": "string", "-u": "string", "--ignored": "none", "--ignore-submodules": "string", "--column": "none", "--no-column": "none", "--ahead-behind": "none", "--no-ahead-behind": "none", "--renames": "none", "--no-renames": "none", "--find-renames": "string", "-M": "string" } },
  "git blame": { flags: { ...G.color, "-L": "string", "--porcelain": "none", "-p": "none", "--line-porcelain": "none", "--incremental": "none", "--root": "none", "--show-stats": "none", "--show-name": "none", "--show-number": "none", "-n": "none", "--show-email": "none", "-e": "none", "-f": "none", "--date": "string", "-w": "none", "--ignore-rev": "string", "--ignore-revs-file": "string", "-M": "none", "-C": "none", "--score-debug": "none", "--abbrev": "number", "-s": "none", "-l": "none", "-t": "none" }, ddash: false },
  "git ls-files": { flags: { "--cached": "none", "-c": "none", "--deleted": "none", "-d": "none", "--modified": "none", "-m": "none", "--others": "none", "-o": "none", "--ignored": "none", "-i": "none", "--stage": "none", "-s": "none", "--killed": "none", "-k": "none", "--unmerged": "none", "-u": "none", "--directory": "none", "--no-empty-directory": "none", "--eol": "none", "--full-name": "none", "--abbrev": "number", "--debug": "none", "-z": "none", "-t": "none", "-v": "none", "-f": "none", "--exclude": "string", "-x": "string", "--exclude-from": "string", "-X": "string", "--exclude-per-directory": "string", "--exclude-standard": "none", "--error-unmatch": "none", "--recurse-submodules": "none" } },
  "git config --get": { flags: { "--local": "none", "--global": "none", "--system": "none", "--worktree": "none", "--default": "string", "--type": "string", "--bool": "none", "--int": "none", "--bool-or-int": "none", "--path": "none", "--expiry-date": "none", "-z": "none", "--null": "none", "--name-only": "none", "--show-origin": "none", "--show-scope": "none" } },
  "git remote show": { flags: { "-n": "none" }, danger: (a) => { const k = a.indexOf("--"), before = k < 0 ? a : a.slice(0, k), rest = k < 0 ? [] : a.slice(k + 1), names = before.filter((x) => x !== "-n").concat(rest); return names.length !== 1 || !before.includes("-n") || !/^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/.test(names[0]); } },
  "git remote": { flags: { "-v": "none", "--verbose": "none" }, danger: (a) => a.some((x) => x !== "-v" && x !== "--verbose") },
  "git merge-base": { flags: { "--is-ancestor": "none", "--fork-point": "none", "--octopus": "none", "--independent": "none", "--all": "none" } },
  "git rev-parse": { flags: { "--verify": "none", "--short": "string", "--abbrev-ref": "none", "--symbolic": "none", "--symbolic-full-name": "none", "--show-toplevel": "none", "--show-cdup": "none", "--show-prefix": "none", "--git-dir": "none", "--git-common-dir": "none", "--absolute-git-dir": "none", "--show-superproject-working-tree": "none", "--is-inside-work-tree": "none", "--is-inside-git-dir": "none", "--is-bare-repository": "none", "--is-shallow-repository": "none", "--is-shallow-update": "none", "--path-prefix": "none" } },
  "git rev-list": { flags: { ...G.refs, ...G.since, ...G.count, ...G.who, "--count": "none", "--reverse": "none", "--first-parent": "none", "--ancestry-path": "none", "--merges": "none", "--no-merges": "none", "--min-parents": "number", "--max-parents": "number", "--no-min-parents": "none", "--no-max-parents": "none", "--skip": "number", "--max-age": "number", "--min-age": "number", "--walk-reflogs": "none", "--oneline": "none", "--abbrev-commit": "none", "--pretty": "string", "--format": "string", "--abbrev": "number", "--full-history": "none", "--dense": "none", "--sparse": "none", "--source": "none", "--graph": "none" }, danger: gitFormatDanger },
  "git describe": { flags: { "--tags": "none", "--match": "string", "--exclude": "string", "--long": "none", "--abbrev": "number", "--always": "none", "--contains": "none", "--first-match": "none", "--exact-match": "none", "--candidates": "number", "--dirty": "none", "--broken": "none" } },
  "git cat-file": { flags: { "-t": "none", "-s": "none", "-p": "none", "-e": "none", "--batch-check": "none", "--allow-undetermined-type": "none" } },
  "git for-each-ref": { flags: { "--format": "string", "--sort": "string", "--count": "number", "--contains": "string", "--no-contains": "string", "--merged": "string", "--no-merged": "string", "--points-at": "string" }, danger: gitFormatDanger },
  "git grep": { flags: { "-e": "string", "-E": "none", "--extended-regexp": "none", "-G": "none", "--basic-regexp": "none", "-F": "none", "--fixed-strings": "none", "-P": "none", "--perl-regexp": "none", "-i": "none", "--ignore-case": "none", "-v": "none", "--invert-match": "none", "-w": "none", "--word-regexp": "none", "-n": "none", "--line-number": "none", "-c": "none", "--count": "none", "-l": "none", "--files-with-matches": "none", "-L": "none", "--files-without-match": "none", "-h": "none", "-H": "none", "--heading": "none", "--break": "none", "--full-name": "none", "--color": "none", "--no-color": "none", "-o": "none", "--only-matching": "none", "-A": "number", "--after-context": "number", "-B": "number", "--before-context": "number", "-C": "number", "--context": "number", "--and": "none", "--or": "none", "--not": "none", "--max-depth": "number", "--untracked": "none", "--no-index": "none", "--recurse-submodules": "none", "--cached": "none", "--threads": "number", "-q": "none", "--quiet": "none" } },
  "git stash show": { flags: { ...G.stat, ...G.color, ...G.patch, "--word-diff": "none", "--word-diff-regex": "string", "--diff-filter": "string", "--abbrev": "number" } },
  "git worktree list": { flags: { "--porcelain": "none", "-v": "none", "--verbose": "none", "--expire": "string" } },
  "git tag": { flags: { "-l": "none", "--list": "none", "-n": "number", "--contains": "string", "--no-contains": "string", "--merged": "string", "--no-merged": "string", "--sort": "string", "--format": "string", "--points-at": "string", "--column": "none", "--no-column": "none", "-i": "none", "--ignore-case": "none" }, danger: (a) => gitFormatDanger(a) || listOnly(a, new Set(["--contains", "--no-contains", "--merged", "--no-merged", "--points-at", "--sort", "--format", "-n"])) },
  "git branch": { flags: { "-l": "none", "--list": "none", "-a": "none", "--all": "none", "-r": "none", "--remotes": "none", "-v": "none", "-vv": "none", "--verbose": "none", "--color": "none", "--no-color": "none", "--column": "none", "--no-column": "none", "--abbrev": "number", "--no-abbrev": "none", "--contains": "string", "--no-contains": "string", "--merged": "none", "--no-merged": "none", "--points-at": "string", "--sort": "string", "--show-current": "none", "-i": "none", "--ignore-case": "none" }, danger: (a) => gitFormatDanger(a) || listOnly(a, new Set(["--contains", "--no-contains", "--points-at", "--sort"]), new Set(["--merged", "--no-merged"])) },
};
const SAFE = {
  xargs: { flags: { "-I": "{}", "-n": "number", "-P": "number", "-L": "number", "-s": "number", "-E": "EOF", "-0": "none", "-t": "none", "-r": "none", "-x": "none", "-d": "char" } },
  ...GIT,
  file: { flags: { "--brief": "none", "-b": "none", "--mime": "none", "-i": "none", "--mime-type": "none", "--mime-encoding": "none", "--apple": "none", "--check-encoding": "none", "-c": "none", "--exclude": "string", "--exclude-quiet": "string", "--print0": "none", "-0": "none", "-F": "string", "--separator": "string", "--help": "none", "--version": "none", "-v": "none", "--no-dereference": "none", "-h": "none", "--dereference": "none", "-L": "none", "--keep-going": "none", "-k": "none", "--list": "none", "-l": "none", "--no-buffer": "none", "-n": "none", "--preserve-date": "none", "-p": "none", "--raw": "none", "-r": "none", "-s": "none", "--special-files": "none" } },
  sed: { flags: { "--expression": "string", "-e": "string", "--quiet": "none", "--silent": "none", "-n": "none", "--regexp-extended": "none", "-r": "none", "--posix": "none", "-E": "none", "--line-length": "number", "-l": "number", "--zero-terminated": "none", "-z": "none", "--separate": "none", "-s": "none", "--unbuffered": "none", "-u": "none", "--debug": "none", "--help": "none", "--version": "none" }, danger: SED_SAFE },
  sort: { flags: { "--ignore-leading-blanks": "none", "-b": "none", "--dictionary-order": "none", "-d": "none", "--ignore-case": "none", "-f": "none", "--general-numeric-sort": "none", "-g": "none", "--human-numeric-sort": "none", "-h": "none", "--ignore-nonprinting": "none", "-i": "none", "--month-sort": "none", "-M": "none", "--numeric-sort": "none", "-n": "none", "--random-sort": "none", "-R": "none", "--reverse": "none", "-r": "none", "--sort": "string", "--stable": "none", "-s": "none", "--unique": "none", "-u": "none", "--version-sort": "none", "-V": "none", "--zero-terminated": "none", "-z": "none", "--key": "string", "-k": "string", "--field-separator": "string", "-t": "string", "--check": "none", "-c": "none", "--check-char-order": "none", "-C": "none", "--merge": "none", "-m": "none", "--buffer-size": "string", "-S": "string", "--parallel": "number", "--batch-size": "number", "--help": "none", "--version": "none" } },
  man: { flags: { "-a": "none", "--all": "none", "-d": "none", "-f": "none", "--whatis": "none", "-h": "none", "-k": "none", "--apropos": "none", "-w": "none", "-S": "string", "-s": "string" }, danger: (a) => a.some((x, i) => x.includes("/") || x.includes("\\") || x.includes("~") || ((a[i - 1] === "-S" || a[i - 1] === "-s") && !/^[0-9a-zA-Z:]+$/.test(x))) },
  help: { flags: { "-d": "none" }, danger: (a) => a.some((x) => x.includes("/") || x.includes("\\") || x.includes("~")) },
  netstat: { flags: { "-a": "none", "-L": "none", "-l": "none", "-n": "none", "-f": "string", "-g": "none", "-i": "none", "-I": "string", "-s": "none", "-r": "none", "-m": "none", "-v": "none" } },
  ps: { ddash: false, flags: { "-e": "none", "-A": "none", "-a": "none", "-d": "none", "-N": "none", "--deselect": "none", "-f": "none", "-F": "none", "-l": "none", "-j": "none", "-y": "none", "-w": "none", "-ww": "none", "--width": "number", "-c": "none", "-H": "none", "--forest": "none", "--headers": "none", "--no-headers": "none", "-n": "string", "--sort": "string", "-L": "none", "-T": "none", "-m": "none", "-C": "string", "-G": "string", "-g": "string", "-p": "string", "--pid": "string", "-q": "string", "--quick-pid": "string", "-s": "string", "--sid": "string", "-t": "string", "--tty": "string", "-U": "string", "-u": "string", "--user": "string", "--help": "none", "--info": "none", "-V": "none", "--version": "none" },
    // (BSD-style `e` prints each process's environment: `ps auxe`, `ps aux -e`; `ps -ef` and `ps aux` are fine.)
    danger: (a) => { const bsd = a.some((x) => !x.startsWith("-") && /[eE]/.test(x)), dashE = a.some((x) => /^-[a-zA-Z]*e/.test(x)), plain = a.every((x) => x === "--forest" || /^-[AacdeFfjlwHLTm]+$/.test(x)), tree = a.flatMap((x) => (x === "--forest" ? [x] : x.match(/[HLTm]/g) || [])); return bsd || (dashE && !(plain && tree.length <= 1)); } },
  base64: { ddash: false, flags: { "-d": "none", "-D": "none", "--decode": "none", "-b": "number", "--break": "number", "-w": "number", "--wrap": "number", "-i": "string", "--input": "string", "--ignore-garbage": "none", "-h": "none", "--help": "none", "--version": "none" } },
  grep: { flags: GREP }, egrep: { flags: GREP }, fgrep: { flags: GREP },
  rg: { flags: { "-e": "string", "--regexp": "string", "-f": "string", "-i": "none", "--ignore-case": "none", "-S": "none", "--smart-case": "none", "-F": "none", "--fixed-strings": "none", "-w": "none", "--word-regexp": "none", "-v": "none", "--invert-match": "none", "-c": "none", "--count": "none", "-l": "none", "--files-with-matches": "none", "--files-without-match": "none", "-n": "none", "--line-number": "none", "-o": "none", "--only-matching": "none", "-A": "number", "--after-context": "number", "-B": "number", "--before-context": "number", "-C": "number", "--context": "number", "-H": "none", "-h": "none", "--heading": "none", "--no-heading": "none", "-q": "none", "--quiet": "none", "--column": "none", "-g": "string", "--glob": "string", "-t": "string", "--type": "string", "-T": "string", "--type-not": "string", "--type-list": "none", "--hidden": "none", "--no-ignore": "none", "-u": "none", "-m": "number", "--max-count": "number", "-d": "number", "--max-depth": "number", "-a": "none", "--text": "none", "-L": "none", "--follow": "none", "--color": "string", "--json": "none", "--stats": "none", "--help": "none", "--version": "none", "--debug": "none" } },
  sha256sum: { flags: SUMS }, sha1sum: { flags: SUMS }, md5sum: { flags: SUMS },
  tree: { flags: { "-a": "none", "-d": "none", "-l": "none", "-f": "none", "-x": "none", "-L": "number", "-P": "string", "-I": "string", "--gitignore": "none", "--gitfile": "string", "--ignore-case": "none", "--matchdirs": "none", "--metafirst": "none", "--prune": "none", "--info": "none", "--infofile": "string", "--noreport": "none", "--charset": "string", "--filelimit": "number", "-q": "none", "-N": "none", "-Q": "none", "-p": "none", "-u": "none", "-g": "none", "-s": "none", "-h": "none", "--si": "none", "--du": "none", "-D": "none", "--timefmt": "string", "-F": "none", "--inodes": "none", "--device": "none", "-v": "none", "-t": "none", "-c": "none", "-U": "none", "-r": "none", "--dirsfirst": "none", "--filesfirst": "none", "--sort": "string", "-i": "none", "-A": "none", "-S": "none", "-n": "none", "-C": "none", "-X": "none", "-J": "none", "-H": "string", "--nolinks": "none", "--hintro": "string", "--houtro": "string", "-T": "string", "--hyperlink": "none", "--scheme": "string", "--authority": "string", "--fromfile": "none", "--fromtabfile": "none", "--fflinks": "none", "--help": "none", "--version": "none" } },
  date: { flags: { "-d": "string", "--date": "string", "-r": "string", "--reference": "string", "-u": "none", "--utc": "none", "--universal": "none", "-I": "none", "--iso-8601": "string", "-R": "none", "--rfc-email": "none", "--rfc-3339": "string", "--debug": "none", "--help": "none", "--version": "none" },
    // (Only a `+FORMAT`; any other word would set the clock.)
    danger: (a) => { const v = new Set(["-d", "--date", "-r", "--reference", "--rfc-3339"]); for (let i = 0; i < a.length; i++) { const x = a[i]; if (x.startsWith("--") && x.includes("=")) continue; if (x.startsWith("-")) { if (v.has(x)) i++; continue; } if (!x.startsWith("+")) return true; } return false; } },
  hostname: { flags: { "-f": "none", "--fqdn": "none", "--long": "none", "-s": "none", "--short": "none", "-i": "none", "--ip-address": "none", "-I": "none", "--all-ip-addresses": "none", "-a": "none", "--alias": "none", "-d": "none", "--domain": "none", "-A": "none", "--all-fqdns": "none", "-v": "none", "--verbose": "none", "-h": "none", "--help": "none", "-V": "none", "--version": "none" }, danger: (a) => a.some((x) => !x.startsWith("-")) },
  which: { flags: { "-a": "none", "--all": "none", "-s": "none", "-p": "none", "-w": "none", "--skip-dot": "none", "--skip-tilde": "none", "--show-dot": "none", "--show-tilde": "none", "--skip-alias": "none", "--skip-functions": "none", "-v": "none", "-V": "none", "--version": "none", "--help": "none" } },
  pgrep: { flags: { "-d": "string", "--delimiter": "string", "-l": "none", "--list-name": "none", "-a": "none", "--list-full": "none", "-v": "none", "--inverse": "none", "-w": "none", "--lightweight": "none", "-c": "none", "--count": "none", "-f": "none", "--full": "none", "-g": "string", "--pgroup": "string", "-G": "string", "--group": "string", "-i": "none", "--ignore-case": "none", "-n": "none", "--newest": "none", "-o": "none", "--oldest": "none", "-O": "string", "--older": "string", "-P": "string", "--parent": "string", "-s": "string", "--session": "string", "-t": "string", "--terminal": "string", "-u": "string", "--euid": "string", "-U": "string", "--uid": "string", "-x": "none", "--exact": "none", "-F": "string", "--pidfile": "string", "-L": "none", "--logpidfile": "none", "-r": "string", "--runstates": "string", "--ns": "string", "--nslist": "string", "--help": "none", "-V": "none", "--version": "none" } },
  // (test, and [ with its closing ]: no -v, -R, -a, -o or [ in its words; numbers on both sides of -eq and its kin.)
  test: { ddash: false, flags: { "-b": "string", "-c": "string", "-d": "string", "-e": "string", "-f": "string", "-g": "string", "-G": "string", "-h": "string", "-k": "string", "-L": "string", "-N": "string", "-O": "string", "-p": "string", "-r": "string", "-s": "string", "-S": "string", "-t": "string", "-u": "string", "-w": "string", "-x": "string", "-z": "string", "-n": "string", "-eq": "string", "-ne": "string", "-lt": "string", "-le": "string", "-gt": "string", "-ge": "string", "-nt": "string", "-ot": "string", "-ef": "string" },
    danger: (a) => { if (a.some((x) => x === "-v" || x === "-R" || x === "-a" || x === "-o" || /\[/.test(x))) return true; for (let i = 0; i < a.length; i++) { if (["-eq", "-ne", "-lt", "-le", "-gt", "-ge"].includes(a[i])) { for (const s of [a[i - 1], a[i + 1]]) if (s !== undefined && !/^-?(0[xX][0-9a-fA-F]+|[0-9]+#[0-9a-zA-Z]+|[0-9]+)$/.test(s)) return true; } if (a[i] === "-t" && a[i + 1] !== undefined && !/^-?[0-9]+$/.test(a[i + 1])) return true; } return false; } },
};
/** The targets xargs may run while staying read-only (Claude Code's). */
const XARGS_TARGETS = ["echo", "printf", "wc", "grep", "egrep", "fgrep", "head", "tail"];
/** Commands that read whatever their arguments (Claude Code's list), when no word has an expansion. */
const ANY_ARGS = new Set(["docker ps", "docker images", "cal", "uptime", "cat", "head", "tail", "wc", "stat", "strings", "hexdump", "od", "nl", "id", "uname", "free", "df", "du", "locale", "groups", "nproc", "basename", "dirname", "realpath", "cut", "paste", "tr", "column", "tac", "rev", "fold", "expand", "unexpand", "fmt", "comm", "cmp", "numfmt", "readlink", "diff", "true", "false", "sleep", "type", "expr", "seq", "tsort", "pr"]);
/** Only with no arguments. */
const NO_ARGS = new Set(["pwd", "whoami", "alias"]);
/** Exactly these. */
const EXACT = ["node -v", "node --version", "python --version", "python3 --version", "ip addr"];
/** An unquoted glob is allowed only for these (Claude Code: "commands whose every flag is read-only"). */
const GLOB_OK = new Set(["ls", "cat", "head", "tail", "wc", "stat", "grep", "egrep", "fgrep", "diff", "du", "df", "echo", "strings", "hexdump", "od", "nl", "cut", "column", "tr", "tac", "rev", "cmp", "basename", "dirname", "realpath", "readlink", "sha256sum", "sha1sum", "md5sum", "cd"]);
const FIND_ACTS = new Set(["-delete", "-rm", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprint0", "-fls", "-fprintf", "-files0-from"]);
/** Its `jq` (no file-reading or environment options; a filter and file names). */
const JQ = /^jq(?!.*(?:\s['"]?-[a-zA-Z]*[fL]|--from-file|--rawfile|--slurpfile|--run-tests|--library-path|\benv\b|\$ENV\b|\binclude\b|\bimport\b))(?:\s+(?:-[a-zA-Z]+|--[a-zA-Z-]+(?:=\S+)?))*(?:\s+'[^'`]*'|\s+"[^"`]*"|\s+[^-\s'"][^\s]*)+\s*$/;
/** Its `uniq`: options only (a second file name would be written). */
const UNIQ = /^uniq(?:\s+(?:-[a-zA-Z]+|--[a-zA-Z-]+(?:=\S+)?|-[fsw]\s+\d+))*(?:\s|$)\s*$/;

/** A sed script that only reads: addresses and p d q Q = n N l g G h H x z { } y, s with flags g p i I m M or a number (no w, e, r, W, R). */
function sedScriptSafe(script) {
  const s = String(script);
  let i = 0;
  const addr = () => {
    const one = () => {
      if (s[i] === "$") { i++; return true; }
      if (/[0-9]/.test(s[i] || "")) { while (/[0-9~]/.test(s[i] || "")) i++; return true; }
      if (s[i] === "/" || s[i] === "\\") { const d = s[i] === "\\" ? s[++i] : "/"; i++; while (i < s.length && s[i] !== d) { if (s[i] === "\\") i++; i++; } if (i >= s.length) return false; i++; while (/[IM]/.test(s[i] || "")) i++; return true; }
      return true;
    };
    if (!one()) return false;
    if (s[i] === ",") { i++; if (s[i] === "+" || s[i] === "~") i++; if (!one()) return false; }
    while (s[i] === " ") i++;
    if (s[i] === "!") i++;
    return true;
  };
  while (i < s.length) {
    while (i < s.length && /[\s;]/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s[i] === "}") { i++; continue; }
    if (s[i] === "#") { while (i < s.length && s[i] !== "\n") i++; continue; }
    if (!addr()) return false;
    while (s[i] === " ") i++;
    const c = s[i++];
    if (c === undefined) return false;
    if ("pdqQ=nNlgGhHxz{".includes(c)) { if ((c === "q" || c === "Q" || c === "l") && /[0-9]/.test(s[i] || "")) while (/[0-9]/.test(s[i] || "")) i++; continue; }
    if (c === "s" || c === "y") {
      const d = s[i++];
      if (!d || /[\s\\\n]/.test(d)) return false;
      for (let part = 0; part < 2; part++) { while (i < s.length && s[i] !== d) { if (s[i] === "\\") i++; i++; } if (i >= s.length) return false; i++; }
      if (c === "s") { const flags = /^[gpiImM0-9]*/.exec(s.slice(i))[0]; i += flags.length; if (/[we]/i.test(s[i] || "") && s[i] !== "i" && s[i] !== "I") return false; }
      continue;
    }
    return false;
  }
  return true;
}
/** Every script a sed command was given only reads (its -e / --expression values, else its first word). */
function sedScriptsSafe(args) {
  const scripts = [];
  let first = true;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-e" || a === "--expression") { scripts.push(args[i + 1] || ""); i++; first = false; continue; }
    if (a.startsWith("--expression=")) { scripts.push(a.slice(13)); first = false; continue; }
    if (/^-e./.test(a)) { scripts.push(a.slice(2)); first = false; continue; }
    if (a === "-l" || a === "--line-length") { i++; continue; }
    if (a.startsWith("-") && a.length > 1) continue;
    if (first) { scripts.push(a); first = false; }
  }
  return scripts.length > 0 && scripts.every(sedScriptSafe);
}

function isFlag(a) { return typeof a === "string" && a.startsWith("-") && a.length > 1; }
function valueOk(v, type) {
  if (type === "number") return /^\d+$/.test(v);
  if (type === "char") return /^(?:.|\\.)$/s.test(v);
  if (type === "{}") return v === "{}";
  return true;
}
/** Claude Code's walk through a command's options (its read-only check): every option on the list, with a value of its kind. */
function optionsOk(args, spec, prog) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a) continue;
    if (prog === "xargs" && (!a.startsWith("-") || a === "--")) { const t = a === "--" ? args[i + 1] : a; return XARGS_TARGETS.includes(t || ""); }
    if (a === "--") { if (spec.ddash !== false) return true; continue; }
    if (isFlag(a)) {
      const eq = a.indexOf("="), name = eq > 0 ? a.slice(0, eq) : a, given = eq > 0 ? a.slice(eq + 1) : null;
      const kind = spec.flags[name];
      if (!kind) {
        if (prog === "git" && /^-\d+$/.test(name)) continue;
        if (["grep", "egrep", "fgrep", "rg"].includes(prog) && !name.startsWith("--") && name.length > 2) {
          const base = spec.flags[name.slice(0, 2)];
          if ((base === "number" || base === "string") && /^\d+$/.test(name.slice(2))) continue;
        }
        if (!name.startsWith("--") && name.length > 2 && given === null) {
          if ([...name.slice(1)].every((ch) => spec.flags["-" + ch] === "none")) continue;
        }
        return false;
      }
      if (kind === "none") { if (given !== null) return false; continue; }
      let v = given;
      if (v === null) { if (i + 1 >= args.length || isFlag(args[i + 1])) return false; v = args[++i]; }
      if (kind === "string" && v.startsWith("-") && !(name === "--sort" && prog === "git" && /^-[a-zA-Z]/.test(v))) return false;
      if (!valueOk(v, kind)) return false;
    }
  }
  return true;
}

// ── ONE COMMAND, READ ONLY? ──────────────────────────────────────────────────
/** Environment variables a command may be given in front and stay read-only (or match an allow rule). */
const SAFE_ENV = /^(LANG|LANGUAGE|LC_[A-Z]+|NO_COLOR|FORCE_COLOR|CLICOLOR|CLICOLOR_FORCE|TERM|COLUMNS|LINES|TZ|CI|NODE_ENV|RUST_BACKTRACE|RUST_LOG|PYTHONUNBUFFERED|PYTHONDONTWRITEBYTECODE|DEBUG|VERBOSE)=/;
/** A command's words past safe `NAME=value` settings in front (null when one is not safe), and past a plain `timeout N`. */
export function readWords(words, { wrappers = false } = {}) {
  let k = 0;
  while (k < words.length && /^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(words[k].raw) && !words[k].raw.startsWith("=")) {
    if (!SAFE_ENV.test(words[k].raw) || words[k].expand || words[k].subst) return null;
    k++;
  }
  let w = words.slice(k);
  // (Claude Code 2.1.312: "Fixed needless permission prompts for read-only commands wrapped in a plain timeout DURATION".)
  for (let guard = 0; guard < 4 && w.length >= 2; guard++) {
    if (w[0].text === "timeout" && !w[0].quoted && /^\d+(\.\d+)?[smhd]?$/.test(w[1].text)) { w = w.slice(2); continue; }
    if (wrappers && ["time", "nice", "nohup", "stdbuf", "command", "builtin", "noglob"].includes(w[0].text) && !w[0].quoted) {
      const opts = w[0].text === "nice" ? new Set(["-n"]) : w[0].text === "stdbuf" ? new Set(["-i", "-o", "-e"]) : new Set();
      if (w[0].text === "command" && w[1] && /^-[vV]$/.test(w[1].text)) break;
      let j = 1; while (j < w.length && w[j].text.startsWith("-") && w[j].text !== "--") { if (opts.has(w[j].text)) j++; j++; } if (w[j] && w[j].text === "--") j++;
      w = w.slice(j); continue;
    }
    if (wrappers && w[0].text === "xargs" && !w[0].quoted && w[1] && !w[1].text.startsWith("-")) { w = w.slice(1); continue; }
    break;
  }
  return w;
}
/** Whether one simple command (coder-shell.mjs's) only reads, as Claude Code's read-only check says. */
export function commandReadOnly(cmd) {
  const w = readWords(cmd.words);
  if (!w || !w.length) return !!w; // a lone `NAME=value` changes nothing outside the command
  const prog = w[0].text;
  // The program as typed: a name, never a path (./ls could be anything) or an expansion.
  if (!/^[A-Za-z0-9_.+[-]+$/.test(prog) || w[0].expand || w[0].subst || prog.startsWith(".") || prog.startsWith("-")) return false;
  const rest = w.slice(1);
  // No expansion (Claude Code: an argument with `$` is never read-only) or brace expansion; a glob only where allowed.
  if (rest.some((x) => x.expand || x.subst)) return false;
  if (rest.some((x) => !x.quoted && /\{[^{}\s]*(,|\.\.)[^{}\s]*\}/.test(x.raw))) return false;
  if (rest.some((x) => x.glob) && !GLOB_OK.has(prog)) return false;
  const args = rest.map((x) => x.text), line = w.map((x) => x.text).join(" "), raw = w.map((x) => x.raw).join(" ");
  if (NO_ARGS.has(prog)) return !args.length;
  if (EXACT.includes(line)) return true;
  if (prog === "echo") return !rest.some((x) => !x.quoted && x.raw.includes("!"));
  if (prog === "printf") {
    if (args[0] && args[0].startsWith("-") && args[0] !== "--") return false;
    const f = args[args[0] === "--" ? 1 : 0] || "";
    return !/\\[0-7xXuU]|%[^%]*n/.test(f) && !args.some((x) => x.includes("`"));
  }
  if (prog === "ls") return true;
  if (prog === "cd") return args.length <= 1;
  if (prog === "find") {
    for (const a of args) if (FIND_ACTS.has(a)) return false;
    return true;
  }
  if (prog === "history") return args.length === 0 || (args.length === 1 && /^\d+$/.test(args[0]));
  if (prog === "arch") return args.length === 0 || (args.length === 1 && (args[0] === "-h" || args[0] === "--help"));
  if (prog === "jq") return JQ.test(raw);
  if (prog === "uniq") return UNIQ.test(raw);
  if (prog === "[") return args.at(-1) === "]" && SAFE.test.danger(args.slice(0, -1)) === false && optionsOk(args.slice(0, -1), SAFE.test, "test");
  for (let n = Math.min(3, w.length); n >= 1; n--) {
    const key = w.slice(0, n).map((x) => x.text).join(" ");
    if (ANY_ARGS.has(key)) return true;
    const spec = SAFE[key];
    if (!spec) continue;
    const after = args.slice(n - 1);
    if (!optionsOk(after, spec, prog)) return false;
    if (spec.danger && spec.danger(after)) return false;
    return true;
  }
  return false;
}

// ── PATHS ────────────────────────────────────────────────────────────────────
/** A path a command names, as a full path from where it runs ("" when it cannot be known: an expansion, a ~). */
function fullPath(word, cwd) {
  if (!word || word.expand || word.subst || word.tilde) return "";
  const p = word.text;
  if (!p) return "";
  // (A folder that can't be known before the command runs, `false`: a short path there has no known place.)
  if (cwd === false && !p.startsWith("/")) return "";
  return normalPath(p.startsWith("/") ? p : (cwd || "/") + "/" + p);
}
/** A full path with its `.` and `..` worked out and no trailing slash (a `..` at the top stays there, as for the shell). */
function normalPath(p) {
  const out = [];
  for (const seg of String(p).split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") { out.pop(); continue; }
    out.push(seg);
  }
  return "/" + out.join("/");
}
/** Whether a full path is inside one of the working folders (the project, the chat's other repositories). */
export function insideWork(path, workdirs) {
  if (!path) return false;
  return (workdirs || []).some((d) => d && (path === d || path.startsWith(d.replace(/\/+$/, "") + "/")));
}
/** The folder part of a glob's path, before its first wildcard ("src/*.js" → "src"). */
function globBase(text) { const k = text.search(/[*?[{]/); const head = k < 0 ? text : text.slice(0, k); return head.includes("/") ? head.slice(0, head.lastIndexOf("/")) || "/" : "."; }

// ── ACCEPT EDITS' FILE COMMANDS ──────────────────────────────────────────────
// Claude Code's permission-modes docs: "acceptEdits mode auto-approves common filesystem Bash commands: mkdir, touch, rm,
// rmdir, mv, cp, and sed. Except for touch, these commands are also auto-approved when prefixed with safe environment
// variables such as LANG=C or NO_COLOR=1, or process wrappers such as timeout, nice, or nohup. Like file edits,
// auto-approval applies only to paths inside your working directory"; "touch with anything beyond plain file paths, for
// example an option, a glob, or a prefix" prompts; so do writes to protected paths.
const FILE_OPTS = {
  mkdir: { none: /^-(?:[pv]+|-parents|-verbose)$/, value: new Set(["-m", "--mode"]) },
  rm: { none: /^-(?:[rRfvdI]+|-recursive|-force|-verbose|-dir)$/, value: new Set() },
  rmdir: { none: /^-(?:[pv]+|-parents|-verbose|-ignore-fail-on-non-empty)$/, value: new Set() },
  mv: { none: /^-(?:[fivnuT]+|-force|-interactive|-no-clobber|-verbose|-update|-no-target-directory)$/, value: new Set(["-t", "--target-directory"]) },
  cp: { none: /^-(?:[fivnurRapTLPH]+|-force|-interactive|-no-clobber|-verbose|-update|-recursive|-archive|-parents|-no-target-directory|-dereference|-no-dereference|-preserve)$/, value: new Set(["-t", "--target-directory"]) },
  sed: { none: /^-(?:[nErsuz]+|-quiet|-silent|-regexp-extended|-posix|-separate|-unbuffered|-zero-terminated|-debug)$/, value: new Set(["-e", "--expression", "-l", "--line-length"]) },
};
/**
 * The files one simple command changes, when it is one of Accept edits' file commands: `{ paths: [full paths], sure }`,
 * `sure` false when one cannot be checked (an option Coder does not know, an expansion, a ~). Null for any other command.
 */
export function fileCommandTargets(cmd, cwd) {
  const lead = leadWords(cmd.words);
  const hasPrefix = lead.length !== cmd.words.length;
  const w = readWords(cmd.words, { wrappers: true });
  if (!w || !w.length) return null;
  const prog = w[0].text;
  if (w[0].quoted || w[0].expand || !["mkdir", "touch", "rm", "rmdir", "mv", "cp", "sed"].includes(prog)) return null;
  const rest = w.slice(1);
  // touch: plain file paths only, nothing in front.
  if (prog === "touch") {
    const wrapped = w !== cmd.words && (hasPrefix || w[0] !== cmd.words[0]);
    if (wrapped || rest.some((x) => x.text.startsWith("-") || x.glob)) return { paths: [], sure: false };
    const paths = rest.map((x) => fullPath(x, cwd));
    return { paths, sure: paths.length > 0 && paths.every(Boolean) };
  }
  // sed changes files only with -i / --in-place (and then only with a script that only reads and substitutes).
  if (prog === "sed") {
    const inPlace = rest.some((x) => /^-[a-zA-Z]*i/.test(x.text) && !x.text.startsWith("--") || /^--in-place(=|$)/.test(x.text));
    if (!inPlace) return null;
    const args = rest.map((x) => x.text).filter((a) => !/^-i\S*$/.test(a) && !/^--in-place(=.*)?$/.test(a) && !/^-[nErsuz]*i\S*$/.test(a));
    if (!sedScriptsSafe(args)) return { paths: [], sure: false };
  }
  const opt = FILE_OPTS[prog];
  const paths = [];
  let sure = true, operands = false, scriptTaken = prog !== "sed";
  for (let i = 0; i < rest.length; i++) {
    const x = rest[i], t = x.text;
    if (!operands && t === "--") { operands = true; continue; }
    if (!operands && t.startsWith("-") && t.length > 1) {
      if (prog === "sed" && (/^-[nErsuz]*i\S*$/.test(t) || /^--in-place(=.*)?$/.test(t))) continue;
      const eq = t.indexOf("="), name = eq > 0 ? t.slice(0, eq) : t;
      if (opt.value.has(name)) {
        const v = eq > 0 ? { ...x, text: t.slice(eq + 1) } : rest[++i];
        if (prog === "sed" && (name === "-e" || name === "--expression")) { scriptTaken = true; continue; }
        if (name === "-t" || name === "--target-directory") { const p = fullPath(v, cwd); if (p) paths.push(p); else sure = false; }
        continue;
      }
      if (prog === "sed" && /^-e./.test(t)) { scriptTaken = true; continue; }
      if (!opt.none.test(t)) sure = false;
      continue;
    }
    if (!scriptTaken) { scriptTaken = true; continue; } // sed's script
    if (x.glob) {
      // A wildcard stays where its folder is; one that could reach a dot-folder (.git, .husky) or climb out is not sure.
      if (/(^|\/)\.[^/]*[*?[]|(^|\/)[*?[][^/]*\.\.|\.\./.test(t) || /(^|\/)\[/.test(t) || x.expand || x.tilde) { sure = false; continue; }
      const base = globBase(t), p = fullPath({ ...x, text: base }, cwd);
      if (p) paths.push(p + "/*"); else sure = false;
      continue;
    }
    const p = fullPath(x, cwd);
    if (p) paths.push(p); else sure = false;
  }
  if (!paths.length) sure = false;
  return { paths, sure };
}

// ── THE WHOLE COMMAND ────────────────────────────────────────────────────────
/**
 * A COMMAND THAT ONLY READS, AS A WHOLE (for the files a command changed: Claude Code, "Background commands and read-only
 * commands carry no diff"): it could be read through, writes no file by a redirection or tee, and each of its commands only
 * reads.
 */
export function wholeReadOnly(command) {
  const r = readCommand(command);
  return r.ok && !r.writes.length && r.cmds.length > 0 && r.cmds.every((c) => commandReadOnly(c));
}
/**
 * GIT COMMANDS THAT MOVE THE WORK TREE (Claude Code 2.1.319's own list; its hooks reference: "Set for a Git command that moves
 * the working tree, such as `git checkout` or `git stash`, so Claude Code takes no diff"): whether the command runs one,
 * anywhere in it (after sudo and git's own options such as -C).
 */
export const GIT_MOVES = ["checkout", "switch", "stash", "pull", "merge", "rebase", "reset", "restore", "clean", "cherry-pick", "revert"];
const GIT_TAKES_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env", "--super-prefix"]);
export function movesWorkTree(command) {
  const r = parseShell(String(command || ""));
  if (!r.ok) return new RegExp("\\bgit\\b[^\\n;&|]*\\b(" + GIT_MOVES.join("|") + ")\\b").test(String(command || ""));
  return r.commands.some((c) => {
    const w = unwrapped(c.words).map((x) => x.text);
    if (basename(w[0] || "") !== "git") return false;
    let k = 1;
    while (k < w.length && w[k].startsWith("-") && w[k] !== "--") { if (GIT_TAKES_VALUE.has(w[k])) k++; k++; }
    return GIT_MOVES.includes(w[k] || "");
  });
}

const NO_FILE = new Set(["/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty"]);
/**
 * A command, read the way Claude Code's checks read it: `{ ok, cmds, writes, reads, cdTo, cdAway }`. `cmds`: every simple
 * command, nested ones too; `writes`: each file it writes through a redirection or tee (`{ path, raw }`, path "" when
 * unknown); `reads`: each input redirection's file; `cdAway`: a cd out of the folder it starts in, before other commands.
 */
/**
 * A PATH WRITTEN FROM "$PWD" (Claude Code 2.1.321: "Fixed Bash reads such as `grep -r foo "$PWD/src"` asking for permission
 * when the same command with the path typed out runs without asking"; its own pattern: a word that is all one double-quoted
 * "$PWD/…" or "$(pwd)/…" with a plain path after it): read as that path, from the folder the command is in at that point.
 * Never when that folder can't be known, nor in a command that sets PWD itself.
 */
const PWD_WORD = /^"(?:\$PWD|\$\(pwd\))(\/[^"$`\\\n]*)"$/;
const SETS_PWD = /(^|[^A-Za-z0-9_])PWD\+?=|\b(?:export|declare|typeset|local|readonly|read|unset|mapfile|readarray|getopts|printf)\b[^;&|\n]*\bPWD\b/;
const pwdWord = (w, dir) => { const m = w && dir !== false && !w.tilde ? PWD_WORD.exec(String(w.raw || "")) : null; return m ? { ...w, text: normalPath(dir + m[1]), expand: false, subst: false, quoted: true } : w; };
export function readCommand(command, { cwd = "/" } = {}) {
  const r = parseShell(String(command || ""));
  const writes = [], reads = [];
  let dir = cwd, cdAway = false, unsureDir = false;
  const setsPwd = SETS_PWD.test(String(command || ""));
  for (const c of r.commands) {
    // THE FOLDER THIS PART RUNS IN (Claude Code 2.1.321: "Fixed a case where Bash permission checks judged a file write from
    // the wrong folder and didn't prompt"): where the cds before it at the top level left it, or unknown (`false`) once a cd
    // could have gone anywhere, or ran inside a subshell, a function or a $(…) (its folder is then not the one tracked here).
    c.dir = unsureDir ? false : dir;
    if (!setsPwd && c.dir !== false) { c.words = c.words.map((x) => pwdWord(x, c.dir)); for (const x of c.redirects) if (x.target) x.target = pwdWord(x.target, c.dir); }
    const w = unwrapped(c.words);
    const prog = w[0] ? basename(w[0].text) : "";
    for (const x of c.redirects) {
      if (x.heredoc || !x.target) continue;
      const t = x.target;
      if ((x.op === ">&" || x.op === "<&") && /^(\d+|-)$/.test(t.text)) continue;
      if (NO_FILE.has(t.text)) continue;
      const path = unsureDir && !t.text.startsWith("/") ? "" : fullPath(t, dir);
      if (x.op === "<" || x.op === "<<<" || x.op === "<&") reads.push({ path, raw: t.raw });
      else writes.push({ path, raw: t.raw });
    }
    if (prog === "tee") for (let k = 1; k < w.length; k++) { const t = w[k].text; if (t === "--" || (t.startsWith("-") && t.length > 1)) continue; writes.push({ path: unsureDir && !t.startsWith("/") ? "" : fullPath(w[k], dir), raw: w[k].raw }); }
    if ((prog === "cd" || prog === "pushd" || prog === "popd") && c.top >= 0) {
      const to = w[1] ? fullPath(w[1], unsureDir ? false : dir) : "";
      if (!to || prog !== "cd") unsureDir = true; else if (to !== dir) { dir = to; cdAway = true; }
    } else if (prog === "cd" || prog === "pushd" || prog === "popd" || prog === "chdir") unsureDir = true;
  }
  return { ok: r.ok, cmds: r.commands, writes, reads, cdAway, unsureDir };
}

// ── RULES ────────────────────────────────────────────────────────────────────
/** A rule's parts (`Bash(npm test *)`, `Bash`, `WebFetch(domain:x.com)`); null when Coder does not know it. */
export function parseRule(text) {
  const m = /^(Bash|WebFetch)(?:\(([\s\S]*)\))?$/.exec(String(text || "").trim());
  if (!m) return null;
  const spec = m[2] === undefined ? null : m[2].trim();
  if (m[1] === "WebFetch" && spec !== null && !/^domain:[A-Za-z0-9.*-]+$/.test(spec)) return null;
  if (spec === "" ) return null;
  return { tool: m[1], spec: spec === "*" && m[1] === "Bash" ? null : spec };
}
export const RULE_MAX = 300;
/** A rule as saved: its tool, and its specifier when it has one. */
export function ruleText(tool, spec) { return spec ? tool + "(" + spec + ")" : tool; }
/** Whether a Bash rule's specifier matches a command's text (Claude Code's: `*` is any text; a trailing ` *` also matches the bare command; `:*` at the end is ` *`). */
export function bashSpecMatches(spec, text) {
  if (spec === null) return true;
  const p = spec.endsWith(":*") ? spec.slice(0, -2) + " *" : spec;
  const re = new RegExp("^" + p.split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\S]*") + "$");
  if (re.test(text)) return true;
  return (p.match(/\*/g) || []).length === 1 && p.endsWith(" *") && text === p.slice(0, -2);
}
/** The texts a command is matched as: as written and with its quotes taken away, each with spaces made single. */
function textsOf(words) {
  if (!words || !words.length) return [];
  const raw = words.map((x) => x.raw).join(" "), plain = words.map((x) => x.text).join(" ");
  return raw === plain ? [raw] : [raw, plain];
}
/** For deny and ask rules: past every wrapper and setting in front (Claude Code: "A deny or ask rule matches past any leading assignment"). */
function denyTexts(cmd) { return textsOf(unwrapped(cmd.words)); }
/** For allow rules: past the safe wrappers and settings only; none when an unsafe setting is in front. */
function allowTexts(cmd) { const w = readWords(cmd.words, { wrappers: true }); return w ? textsOf(w) : []; }

/** The rules a list holds for one tool: `[{ text, spec }]`. */
function rulesFor(list, tool) {
  return (Array.isArray(list) ? list : []).map((t) => ({ t, r: parseRule(t) })).filter((x) => x.r && x.r.tool === tool).map((x) => ({ text: x.t, spec: x.r.spec }));
}

// ── "DON'T ASK AGAIN" ────────────────────────────────────────────────────────
// Claude Code saves a rule for each part of the command that needed asking (up to five), and offers the option only when
// those rules cover all of it: a prefix rule like `npm test *`, never one for code given inline (python -c), an exec
// wrapper (watch, setsid, flock) or a find that runs or deletes.
const SUBCOMMANDS = new Set(["git", "gh", "npm", "pnpm", "yarn", "bun", "deno", "cargo", "go", "docker", "podman", "kubectl", "helm", "pip", "pip3", "poetry", "uv", "pipenv", "conda", "dotnet", "mvn", "gradle", "gradlew", "mvnw", "make", "composer", "bundle", "rails", "rake", "mix", "flutter", "dart", "swift", "terraform", "tofu", "brew", "apt", "apt-get", "dnf", "yum", "apk", "systemctl", "gcloud", "aws", "az", "firebase", "vercel", "netlify", "wrangler", "supabase", "fly", "flyctl", "heroku", "rustup", "npx", "bunx", "pnpx", "corepack", "nx", "turbo"]);
const RUN_SCRIPT = new Set(["run", "run-script"]);
const INTERPRETERS = new Set(["python", "python3", "python2", "node", "ruby", "perl", "php", "bash", "sh", "zsh", "dash", "ksh", "lua", "Rscript", "tsx", "ts-node"]);
const INLINE_CODE = new Set(["-c", "-e", "-p", "--eval", "--print", "-E", "-r", "-i"]);
const EXEC_WRAPPERS = new Set(["watch", "setsid", "ionice", "flock", "chrt", "taskset", "unbuffer", "sudo", "doas", "su", "env", "exec", "eval", "source", ".", "nsenter", "chroot", "xargs", "parallel", "direnv", "devbox", "mise", "nix-shell"]);
/** Programs whose prefix rule would allow too much: their rule is the exact command. */
const EXACT_ONLY = new Set(["rm", "rmdir", "mv", "cp", "chmod", "chown", "chgrp", "dd", "kill", "pkill", "killall", "curl", "wget", "ssh", "scp", "sftp", "rsync", "awk", "gawk", "sed", "tee", "truncate", "shred", "ln", "mount", "umount", "crontab", "nc", "ncat", "socat", "telnet", "ftp", "mkfs", "fdisk", "iptables", "find", "tar", "unzip", "zip", "install", "patch"]);
/** The rule to save for one simple command, or null when none can be offered. */
export function suggestFor(cmd) {
  const w = readWords(cmd.words, { wrappers: true });
  if (!w || !w.length) return null;
  const p0 = w[0];
  if (p0.expand || p0.subst || p0.glob) return null;
  const prog = p0.text, name = basename(prog);
  if (EXEC_WRAPPERS.has(name)) return null;
  const rest = w.slice(1);
  if (rest.some((x) => x.subst)) return null;
  const raw = w.map((x) => x.raw).join(" ");
  if (name === "find" && rest.some((x) => FIND_ACTS.has(x.text))) return null;
  if (INTERPRETERS.has(name)) {
    let k = 0;
    while (k < rest.length && rest[k].text.startsWith("-") && rest[k].text !== "-m") { if (INLINE_CODE.has(rest[k].text)) return null; k++; }
    // No script, only options (node --test, python3 -V): the program and its first option.
    if (k >= rest.length) return rest.length && !rest[0].expand ? prog + " " + rest[0].raw + " *" : null;
    if (rest[k].text === "-m") return rest[k + 1] && !rest[k + 1].expand ? prog + " -m " + rest[k + 1].raw + " *" : null;
    return rest[k].expand ? null : prog + " " + rest[k].raw + " *";
  }
  if (EXACT_ONLY.has(name)) return raw;
  if (SUBCOMMANDS.has(name)) {
    if (name === "git" && rest[0] && rest[0].text.startsWith("-")) return null; // git -C / -c: as written only
    const k = rest.findIndex((x) => !x.text.startsWith("-"));
    if (k < 0) return raw;
    if (rest.slice(0, k).length && name !== "npx" && name !== "bunx" && name !== "pnpx") return null;
    const sub = rest[k];
    if (sub.expand) return null;
    if (RUN_SCRIPT.has(sub.text) && ["npm", "pnpm", "yarn", "bun"].includes(name) && rest[k + 1] && !rest[k + 1].text.startsWith("-")) return prog + " " + sub.raw + " " + rest[k + 1].raw + " *";
    return prog + " " + sub.raw + " *";
  }
  // A program the project holds (./scripts/test.sh, ./gradlew): it and its first word.
  if (prog.includes("/")) { const sub = rest.find((x) => !x.text.startsWith("-")); return prog + (sub && !sub.expand && rest.indexOf(sub) === 0 ? " " + sub.raw : "") + " *"; }
  return prog + " *";
}

// ── THE DECISION ─────────────────────────────────────────────────────────────
/**
 * WHAT HAPPENS TO A COMMAND (bash) in a mode, with the owner's rules (`{ allow, ask, deny }`, lists of rule texts):
 * `{ verdict: "allow" | "ask" | "deny", why, rule?, suggest: [rules] | null }`. `ctx`: `{ cwd, workdirs, isProtected }`
 * (`isProtected(fullPath)` names the protected file, or ""). Coder's own checks (control characters, long sleeps, dangerous
 * removals, protected files, very long commands) come first, in coder-agent.mjs.
 */
export function bashDecision(command, { mode = "auto", rules = {}, cwd = "/", workdirs = [], isProtected = () => "" } = {}) {
  const read = readCommand(command, { cwd });
  const deny = rulesFor(rules.deny, "Bash"), ask = rulesFor(rules.ask, "Bash"), allow = rulesFor(rules.allow, "Bash");
  // DENY, THEN ASK: any part of it, nested ones too (Claude Code: "including a command nested inside a subshell, a command
  // substitution, or a control-flow body").
  for (const c of read.cmds) for (const t of denyTexts(c)) { const d = deny.find((x) => bashSpecMatches(x.spec, t)); if (d) return { verdict: "deny", rule: d.text, why: "Permission to use Bash with command " + String(command).trim() + " has been denied.", suggest: null }; }
  for (const c of read.cmds) for (const t of denyTexts(c)) { const a = ask.find((x) => bashSpecMatches(x.spec, t)); if (a) return { verdict: "ask", rule: a.text, why: "Your rule " + a.text + " asks first for this command.", suggest: null, byRule: true }; }
  if (normMode(mode) === "auto") return { verdict: "allow", why: "", suggest: null };
  const editsOk = normMode(mode) === "acceptEdits";
  if (!read.ok) return { verdict: "ask", why: "This command can't be checked before it runs, so it needs your approval.", suggest: null };
  // EACH FILE IT WRITES (redirections, tee): in Accept edits, a file inside the project that is not protected; in Plan, none.
  const pathWhy = (p) => { const prot = p && insideWork(p, workdirs) ? isProtected(p) : ""; return prot ? "protected" : !p ? "unknown" : insideWork(p, workdirs) ? "" : "outside"; };
  const needs = [];
  let why = "";
  for (const x of read.writes) {
    const pw = pathWhy(x.path);
    if (!editsOk) { why = why || "This command writes " + x.raw + ", and Plan mode changes no files."; needs.push(null); continue; }
    if (pw === "protected") { why = why || "This command writes " + x.raw + ", a protected file."; needs.push(null); }
    else if (pw) { why = why || (pw === "outside" ? "This command writes " + x.raw + ", outside the project." : "This command writes a file whose place can't be known before it runs."); needs.push(null); }
  }
  // An input redirection from outside the project (Claude Code 2.1.257: "A target outside the working directories needs
  // your approval unless an allow rule covers it").
  for (const x of read.reads) if (!insideWork(x.path, workdirs)) { why = why || "This command reads " + x.raw + " from outside the project."; needs.push(null); }
  // EACH COMMAND: read-only, one of Accept edits' file commands on the project's files, or allowed by a rule.
  let gitAfterCd = false;
  const parts = [];
  for (const c of read.cmds) {
    if (c.ranBy === "xargs" && commandReadOnly({ words: c.words })) continue;
    const prog = c.words.length ? (readWords(c.words) || [])[0] : null;
    const name = prog ? prog.text : "";
    const ro = commandReadOnly(c);
    // A cd out of the project, or into another folder before git (its hooks), is asked about (Claude Code's docs).
    if (ro && name === "cd") {
      const to = c.words.length > 1 ? fullPath((readWords(c.words) || [])[1], c.dir === undefined ? cwd : c.dir) : "";
      if (!to || !insideWork(to, workdirs)) { why = why || "This command changes to a folder outside the project."; parts.push(c); continue; }
      continue;
    }
    if (ro && name === "git" && read.cdAway) { gitAfterCd = true; parts.push(c); continue; }
    if (ro) {
      // A read-only command run on a path outside the project still only reads (Claude Code runs it without asking).
      continue;
    }
    if (editsOk) {
      // (Its short paths from the folder this part runs in, not the one the command started in.)
      const fc = fileCommandTargets(c, c.dir === undefined ? cwd : c.dir);
      if (fc && fc.sure) {
        const bare = fc.paths.map((p) => p.replace(/\/\*$/, ""));
        // A protected file is never approved by a rule (Claude Code: "permissions.allow rules … do not pre-approve
        // protected-path writes"): asked each time.
        if (bare.some((p) => insideWork(p, workdirs) && isProtected(p))) { why = why || "This command changes a protected file."; needs.push(null); parts.push(c); continue; }
        if (bare.every((p) => insideWork(p, workdirs))) continue;
      }
    }
    parts.push(c);
  }
  if (gitAfterCd) why = why || "This command runs git after changing to another folder, where git may run that folder's hooks.";
  // THE PARTS LEFT: each allowed by one of the owner's rules, or the command is asked about.
  const left = parts.filter((c) => !allowTexts(c).some((t) => allow.some((x) => bashSpecMatches(x.spec, t))));
  if (!left.length && !needs.length) return { verdict: "allow", why: "", suggest: null };
  // What "Yes, and don't ask again" would save: a rule for each part left, when they cover it all (a cd out of the
  // project, or git after a cd, has no rule that could).
  let suggest = null;
  const cdLeft = left.some((c) => { const w = readWords(c.words) || []; return w[0] && w[0].text === "cd"; });
  if (!needs.length && left.length && left.length <= 5 && !gitAfterCd && !cdLeft) {
    const s = left.map((c) => suggestFor(c));
    if (s.every((x) => typeof x === "string" && x.length && x.length <= RULE_MAX)) suggest = [...new Set(s.map((x) => ruleText("Bash", x)))];
  }
  return { verdict: "ask", why: why || "This command requires approval", suggest };
}

// ── WEB FETCH ────────────────────────────────────────────────────────────────
// Claude Code's tools reference: "In Manual and acceptEdits permission modes, WebFetch prompts before fetching, except for
// domains your permission rules already allow or deny and a built-in set of preapproved documentation domains"; "The auto
// and bypassPermissions permission modes skip the prompt, except for a domain an explicit ask rule matches". Its set
// (2.1.319), a host or a host and the start of a path:
const DOC_SITES = ["platform.claude.com", "code.claude.com", "claude.dev", "www.claude.dev", "claude.com/docs", "modelcontextprotocol.io", "github.com/anthropics", "github.com/anthropic-experimental", "raw.githubusercontent.com/anthropics", "raw.githubusercontent.com/anthropic-experimental", "agentskills.io", "docs.python.org", "en.cppreference.com", "docs.oracle.com", "learn.microsoft.com", "developer.mozilla.org", "go.dev/doc", "go.dev/ref", "www.php.net", "docs.swift.org", "kotlinlang.org", "ruby-doc.org", "doc.rust-lang.org", "www.typescriptlang.org", "react.dev", "angular.io", "vuejs.org", "nextjs.org", "expressjs.com", "nodejs.org", "bun.sh", "jquery.com", "getbootstrap.com", "tailwindcss.com", "d3js.org", "threejs.org", "redux.js.org", "webpack.js.org", "jestjs.io", "reactrouter.com", "docs.djangoproject.com", "flask.palletsprojects.com", "fastapi.tiangolo.com", "pandas.pydata.org", "numpy.org", "www.tensorflow.org", "pytorch.org", "scikit-learn.org", "matplotlib.org", "requests.readthedocs.io", "jupyter.org", "laravel.com", "symfony.com", "wordpress.org/documentation", "docs.spring.io", "hibernate.org", "tomcat.apache.org", "gradle.org", "maven.apache.org", "asp.net", "dotnet.microsoft.com", "blazor.net", "reactnative.dev", "docs.flutter.dev", "developer.apple.com", "developer.android.com", "keras.io", "spark.apache.org", "huggingface.co/docs", "www.kaggle.com/docs", "www.mongodb.com", "redis.io", "www.postgresql.org", "dev.mysql.com", "www.sqlite.org", "graphql.org", "prisma.io", "docs.getdbt.com", "docs.aws.amazon.com", "cloud.google.com", "kubernetes.io", "www.docker.com", "www.terraform.io", "www.ansible.com", "vercel.com/docs", "docs.stripe.com", "docs.netlify.com", "devcenter.heroku.com", "dev.wix.com/docs", "cypress.io", "selenium.dev", "docs.unity.com", "docs.unrealengine.com", "git-scm.com", "nginx.org", "httpd.apache.org"];
const DOC_HOSTS = new Set(DOC_SITES.filter((x) => !x.includes("/")));
const DOC_PATHS = DOC_SITES.filter((x) => x.includes("/")).map((x) => ({ host: x.slice(0, x.indexOf("/")), path: x.slice(x.indexOf("/")) }));
/** Whether a page is one of the pre-approved documentation sites (its GitHub ones: a repository's page, or its main branch). */
export function docSite(url) {
  let u;
  try { u = new URL(String(url)); } catch { return false; }
  const host = u.hostname.toLowerCase(), path = u.pathname;
  if (DOC_HOSTS.has(host)) return true;
  if (/%(25)*(2f|5c|2e)/i.test(path)) return false;
  for (const d of DOC_PATHS) {
    if (d.host !== host || !(path === d.path || path.startsWith(d.path + "/"))) continue;
    if (host === "raw.githubusercontent.com") return /^\/[^/]+\/[^/]+\/refs\/heads\/main\/./.test(path);
    if (host === "github.com") return /^\/[^/]+\/[^/]+(\/?|\/(tree|blob)\/main(\/.*)?)$/.test(path) || path === d.path;
    return true;
  }
  return false;
}
/** Whether a WebFetch rule's `domain:` matches a host (`*` is any text). */
function domainMatches(spec, host) {
  if (spec === null) return true;
  const want = spec.slice("domain:".length).toLowerCase();
  if (want === "*") return true;
  return new RegExp("^" + want.split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$").test(host);
}
/** WHAT HAPPENS TO A WEB FETCH, like bashDecision. */
export function fetchDecision(url, { mode = "auto", rules = {} } = {}) {
  let host = "";
  try { host = new URL(String(url)).hostname.toLowerCase(); } catch { host = ""; }
  const pick = (list) => rulesFor(list, "WebFetch").find((x) => domainMatches(x.spec, host));
  const d = pick(rules.deny);
  if (d) return { verdict: "deny", rule: d.text, why: "Permission to use WebFetch on " + host + " has been denied.", suggest: null };
  const a = pick(rules.ask);
  if (a) return { verdict: "ask", rule: a.text, why: "Your rule " + a.text + " asks first for this site.", suggest: null, byRule: true };
  if (normMode(mode) === "auto") return { verdict: "allow", why: "", suggest: null };
  if (pick(rules.allow) || docSite(url)) return { verdict: "allow", why: "", suggest: null };
  return { verdict: "ask", why: "Coder wants to fetch a page from " + (host || "this site") + ".", suggest: host && !host.includes("*") ? [ruleText("WebFetch", "domain:" + host)] : null, host };
}

// ── WHAT CODER IS TOLD ───────────────────────────────────────────────────────
// Claude Code's own words (2.1.319), with "the owner" for the user.
export const REJECTED = "The owner doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the owner to tell you how to proceed.";
export const REJECTED_SAID = "The owner doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). To tell you how to proceed, the owner said:\n";
export const NOT_NOW = "The owner doesn't want to take this action right now. STOP what you are doing and wait for the owner to tell you how to proceed.";
/** Plan mode, each message while it is on (Claude Code's, for a plan given to ExitPlanMode as its `plan`). */
export const PLAN_NOTE = "Plan mode is active. The owner indicated that they do not want you to execute yet -- you MUST NOT make any edits, run any non-readonly tools (including changing configs or making commits), or otherwise make any changes to the system. This supercedes any other instructions you have received.\n\nRead and search the code, and run read-only commands, to understand the task; ask the owner with ask_user only to clarify requirements or choose between approaches. Your plan: start with the context (why the change is needed), then the approach, naming the files to change and the existing functions and utilities to reuse (with their paths; do not enumerate every file or line number), and end with a verification section describing how to test the changes end-to-end (run the code, run the tests).\n\nWhen your plan is final, call exit_plan_mode with the whole plan as its `plan` argument. The owner sees it on an approval card: if they approve, plan mode ends; if they decline, you stay in plan mode and revise the plan. Your turn should only end with ask_user (to clarify requirements or choose between approaches) or exit_plan_mode (to request plan approval). Do NOT ask about plan approval in any other way - no text questions, no ask_user. Phrases like \"Is this plan okay?\", \"Should I proceed?\", \"How does this plan look?\", \"Any changes before we start?\", or similar MUST use exit_plan_mode. If the owner only asked a question, answer it in words, without a plan.";
export const PLAN_EXITED = "## Exited Plan Mode\nYou have exited plan mode. You can now make edits, run tools, and take actions.";
/** Auto mode (Claude Code's "The user chose continuous, autonomous execution"), with Coder's names. */
export const AUTO_NOTE = "The owner chose continuous, autonomous execution (Auto mode). You should:\n1. **Execute immediately** — Start implementing right away. Make reasonable assumptions and proceed on low-risk work.\n2. **Minimize interruptions** — Prefer making reasonable assumptions over asking questions for routine decisions.\n3. **Prefer action over planning** — Do not ask to plan unless the owner explicitly asks. When in doubt, start coding.\n4. **Expect course corrections** — The owner may send suggestions or course corrections at any point; treat those as normal input.\n5. **Do not take overly destructive actions** — This is not a license to destroy. Anything that deletes data or modifies shared or production systems still needs explicit confirmation from the owner. If you reach such a decision point, ask and wait, or course correct to a safer method instead.\n6. **Avoid data exfiltration** — Post even routine messages to chat platforms or work tickets only if the owner has directed you to. You must not share secrets (e.g. credentials, internal documentation) unless the owner has explicitly authorized both that specific secret and its destination.";
export const AUTO_EXITED = "## Exited Auto Mode\nYou have exited auto mode. The owner may now want to interact more directly. You should ask clarifying questions when the approach is ambiguous rather than making assumptions.";
/** The answer to an approved plan (Claude Code's ExitPlanMode result). */
export function planApproved(plan, edited = false) {
  const p = String(plan || "").trim();
  if (!p) return "The owner has approved exiting plan mode. You can now proceed.";
  return "The owner has approved your plan. You can now start coding. Start with updating your todo list if applicable\n\n## " + (edited ? "Approved Plan (edited by the owner)" : "Approved Plan") + ":\n" + p;
}
