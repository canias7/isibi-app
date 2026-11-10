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
/** fd's (and fdfind's) listing options, 2.1.321's own: none runs a command. */
const FD_FLAGS = { "-h": "none", "--help": "none", "-V": "none", "--version": "none", "-H": "none", "--hidden": "none", "-I": "none", "--no-ignore": "none", "--no-ignore-vcs": "none", "--no-ignore-parent": "none", "-s": "none", "--case-sensitive": "none", "-i": "none", "--ignore-case": "none", "-g": "none", "--glob": "none", "--regex": "none", "-F": "none", "--fixed-strings": "none", "-a": "none", "--absolute-path": "none", "-L": "none", "--follow": "none", "-p": "none", "--full-path": "none", "-0": "none", "--print0": "none", "-d": "number", "--max-depth": "number", "--min-depth": "number", "--exact-depth": "number", "-t": "string", "--type": "string", "-e": "string", "--extension": "string", "-S": "string", "--size": "string", "--changed-within": "string", "--changed-before": "string", "-o": "string", "--owner": "string", "-E": "string", "--exclude": "string", "--ignore-file": "string", "-c": "string", "--color": "string", "-j": "number", "--threads": "number", "--max-buffer-time": "string", "--max-results": "number", "-1": "none", "-q": "none", "--quiet": "none", "--show-errors": "none", "--strip-cwd-prefix": "none", "--one-file-system": "none", "--prune": "none", "--search-path": "string", "--base-directory": "string", "--path-separator": "string", "--batch-size": "number", "--no-require-git": "none", "--hyperlink": "string", "--and": "string", "--format": "string" };
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
  // ── ADDED IN CLAUDE CODE SINCE 2.1.319 (Bash docs pass 4, the owner, 2026-11-10: "Ok do that too"), from 2.1.321's map,
  // each with its own check: lsof (not +m, no -i@NAME, a name it would look up), ss (no filter naming a host), tput (no
  // capability that changes the terminal, no -S), fd/fdfind (its listing options; -x and -X, which run commands, are none),
  // docker logs and docker inspect (not pointed at another daemon, no ~ to expand).
  lsof: { flags: { "-?": "none", "-h": "none", "-v": "none", "-a": "none", "-b": "none", "-C": "none", "-l": "none", "-n": "none", "-N": "none", "-O": "none", "-P": "none", "-Q": "none", "-R": "none", "-t": "none", "-U": "none", "-V": "none", "-X": "none", "-H": "none", "-E": "none", "-F": "none", "-g": "none", "-i": "none", "-K": "none", "-L": "none", "-o": "none", "-r": "none", "-s": "none", "-S": "none", "-T": "none", "-x": "none", "-A": "string", "-c": "string", "-d": "string", "-e": "string", "-k": "string", "-p": "string", "-u": "string" },
    danger: (a) => {
      const named = (v) => /[a-zA-Z]/.test(String(v).slice(String(v).indexOf("@") + 1).split(":")[0]);
      for (let i = 0; i < a.length; i++) {
        const s = a[i];
        if (s.startsWith("+m")) return true;
        if (/^-[a-zA-Z]*i\S*@/.test(s) && named(s)) return true;
        if (/^-[a-zA-Z]*i$/.test(s)) { const v = String(a[i + 1] ?? ""); if (v.includes("~") || (v.includes("@") && named(v))) return true; }
      }
      return false;
    } },
  ss: { flags: { "-h": "none", "--help": "none", "-V": "none", "--version": "none", "-n": "none", "--numeric": "none", "-a": "none", "--all": "none", "-l": "none", "--listening": "none", "-o": "none", "--options": "none", "-e": "none", "--extended": "none", "-m": "none", "--memory": "none", "-p": "none", "--processes": "none", "-i": "none", "--info": "none", "-s": "none", "--summary": "none", "-4": "none", "--ipv4": "none", "-6": "none", "--ipv6": "none", "-0": "none", "--packet": "none", "-t": "none", "--tcp": "none", "-M": "none", "--mptcp": "none", "-S": "none", "--sctp": "none", "-u": "none", "--udp": "none", "-d": "none", "--dccp": "none", "-w": "none", "--raw": "none", "-x": "none", "--unix": "none", "--tipc": "none", "--vsock": "none", "-f": "string", "--family": "string", "-A": "string", "--query": "string", "--socket": "string", "-Z": "none", "--context": "none", "-z": "none", "--contexts": "none", "-b": "none", "--bpf": "none", "-E": "none", "--events": "none", "-H": "none", "--no-header": "none", "-O": "none", "--oneline": "none", "--tipcinfo": "none", "--tos": "none", "--cgroup": "none", "--inet-sockopt": "none" },
    danger: (a) => {
      const word = /^(dst|src|dport|sport|and|or|not|eq|ne|ge|le|gt|lt|autobound|state|exclude|dev|fwmark|cgroup)$/, takes = /^(state|exclude|dport|sport|dev|fwmark|cgroup)$/, valued = /^(-f|--family|-A|--query|--socket)$/;
      const words = [];
      let after = false;
      for (let k = 0; k < a.length; k++) { const y = a[k]; if (!after && y === "--") { after = true; continue; } if (!after && y.startsWith("-")) { if (valued.test(y)) k++; continue; } words.push(y); }
      if (words.some((w) => w.includes("~"))) return true;
      let skip = false;
      for (const t of words.join(" ").split(/[\s()=!<>&|,]+/).filter(Boolean)) {
        if (skip) { skip = false; continue; }
        if (word.test(t)) { skip = takes.test(t); continue; }
        if (/[g-zG-Z]/.test(t) || (/[a-fA-F]/.test(t) && (t.includes(".") || !t.includes(":")))) return true;
      }
      return false;
    } },
  tput: { flags: { "-T": "string", "-V": "none", "-x": "none" },
    danger: (a) => {
      const changes = new Set(["init", "reset", "rs1", "rs2", "rs3", "is1", "is2", "is3", "iprog", "if", "rf", "clear", "flash", "mc0", "mc4", "mc5", "mc5i", "mc5p", "pfkey", "pfloc", "pfx", "pfxl", "smcup", "rmcup"]);
      let k = 0, after = false;
      while (k < a.length) {
        const x = a[k];
        if (x === "--") { after = true; k++; }
        else if (!after && x.startsWith("-")) { if (x === "-S" || (!x.startsWith("--") && x.length > 2 && x.includes("S"))) return true; k += x === "-T" ? 2 : 1; }
        else { if (changes.has(x)) return true; k++; }
      }
      return false;
    } },
  fd: { flags: FD_FLAGS }, fdfind: { flags: FD_FLAGS },
  "docker logs": { flags: { "--follow": "none", "-f": "none", "--tail": "string", "-n": "string", "--timestamps": "none", "-t": "none", "--since": "string", "--until": "string", "--details": "none" }, danger: (a) => otherDaemon(a) || tildeArg(a) },
  "docker inspect": { flags: { "--format": "string", "-f": "string", "--type": "string", "--size": "none", "-s": "none" }, danger: (a) => otherDaemon(a) || tildeArg(a) },
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
/**
 * A LOOP OVER ONE OF THE SHELL'S OWN VARIABLES (Bash docs pass 3, the owner, 2026-11-10: "Ok yes do that"; Claude Code's
 * permissions docs: "a command that sets, unsets, or loops over certain special shell variables, such as PATH or IFS,
 * prompts even when the rest of the command is read-only"; 2.1.321's check, "<NAME> as loop variable bypasses assignment
 * validation"): its names, from its code (four lists, a lower-case one, and the LD_, DYLD_ and BASH_FUNC_ prefixes).
 */
const SHELL_VARS = new Set(["PS4", "IFS", "BASH_ARGV0",
  "BASHOPTS", "BASH_VERSINFO", "EUID", "PPID", "SHELLOPTS", "UID", "FUNCNAME", "GROUPS", "BASH_ARGC", "BASH_ARGV", "BASH_LINENO", "BASH_SOURCE", "BASHPID",
  "RANDOM", "SECONDS", "LINENO", "OPTIND", "MAILCHECK", "HISTCMD", "SRANDOM", "EPOCHSECONDS", "EPOCHREALTIME", "BASH_MONOSECONDS", "BASH_TRAPSIG", "COLUMNS", "LINES", "SHLVL", "ERRNO", "TMOUT", "HISTSIZE", "SAVEHIST", "TRY_BLOCK_ERROR", "TRY_BLOCK_INTERRUPT", "KEYTIMEOUT", "LISTMAX", "LOGCHECK", "PERIOD", "FUNCNEST", "GID", "EGID", "REPORTTIME", "REPORTMEMORY", "DIRSTACKSIZE", "BAUD", "ZLE_RPROMPT_INDENT", "MBEGIN", "MEND", "ARGC", "ZSH_SUBSHELL", "TTYIDLE", "status",
  "HOME", "PWD", "OLDPWD", "USER", "LOGNAME", "SHELL", "PATH", "HOSTNAME", "TMPDIR", "BASH_VERSION", "HISTFILE",
  "_", "BASH_COMMAND", "REPLY", "reply", "PIPESTATUS", "pipestatus", "DIRSTACK", "BASH_SUBSHELL", "BASH_REMATCH", "MATCH", "match", "mbegin", "mend", "OPTARG", "argv", "FIGNORE", "fignore", "PSVAR", "psvar", "WATCH", "watch", "HISTCHARS", "histchars", "PS1", "PROMPT", "prompt", "PS2", "PROMPT2", "PS3", "PROMPT3", "PROMPT4", "RPS1", "RPROMPT", "RPS2", "RPROMPT2"]);
const SHELL_VARS_ANY_CASE = new Set(["path", "home", "dirstack", "tmpprefix", "bash_env", "env", "cdpath", "globignore", "shell", "fpath", "bash_loadables_path", "module_path", "manpath", "mailpath", "readnullcmd", "nullcmd", "histfile", "zdotdir", "functions", "commands", "aliases", "galiases", "saliases", "bash_cmds", "bash_aliases", "execignore", "bash_source_path", "lang", "language", "lc_all", "lc_ctype", "lc_collate", "lc_messages", "lc_numeric", "lc_time", "histchars", "textdomain", "textdomaindir"]);
export function shellVariable(name) {
  const n = String(name || ""), l = n.toLowerCase();
  return SHELL_VARS.has(n) || SHELL_VARS_ANY_CASE.has(l) || l.startsWith("ld_") || l.startsWith("dyld_") || l.startsWith("bash_func_");
}
/**
 * EXEC WRAPPERS AND find's ACTIONS, APPROVED ONLY BY AN EXACT RULE (Claude Code's permissions docs: "A prefix rule like
 * Bash(watch *) or Bash(find *) can't auto-approve the following commands … Exec wrappers: such as watch, setsid, ionice,
 * and flock … find: with an action that runs commands, deletes files, or writes files … To approve a specific invocation
 * that has no * in it, write an exact-match rule for the full command string"): 2.1.321's own list of exec wrappers.
 */
const EXACT_RULE_WRAPPERS = new Set(["watch", "ionice", "chrt", "setsid", "taskset", "strace", "ltrace", "script", "flock", "unshare", "nsenter"]);
/**
 * DOCKER POINTED AT ANOTHER MACHINE (Claude Code's permissions docs, read-only commands: "read-only forms of docker prompt
 * when the command carries a flag that selects a different daemon, such as -H, --context, or Podman's --url and
 * --connection"): 2.1.321's own check and list, wherever the flag is (before the subcommand it already asks): the flag, the
 * flag with `=value` or a short one with its value joined (-Htcp://x), or a group of short flags holding H, c or r (-Hc).
 */
const DAEMON_FLAGS = ["-H", "-c", "-r", "--host", "--context", "--config", "--tlscacert", "--tlscert", "--tlskey", "--url", "--connection", "--identity", "--remote", "--module", "--out"];
const DAEMON_LETTERS = new Set(DAEMON_FLAGS.filter((f) => f.length === 2).map((f) => f[1]));
export function otherDaemon(args) {
  return (args || []).some((n) => {
    if (DAEMON_FLAGS.some((f) => n === f || n.startsWith(f + "=") || (f.length === 2 && n.length > 2 && n.startsWith(f)))) return true;
    const group = (/^-([A-Za-z]+)/.exec(n) || [])[1];
    return group !== undefined && group.length >= 2 && [...group].some((c) => DAEMON_LETTERS.has(c));
  });
}
/** An argument the shell would expand a ~ in (Claude Code 2.1.321's check for docker's: "~" first or after = or :, or with a {). */
const tildeArg = (args) => (args || []).some((n) => /(?:^|[=:])~/.test(n) || (n.includes("~") && n.includes("{")));
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
  if (prog === "docker" && otherDaemon(args)) return false;
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
// `$HOME/…` as the home folder it names (Claude Code 2.1.322 read `ls -la $HOME/../` as "ls in '/'"), unless the command
// sets HOME itself.
const HOME_WORD = /^(?:"(?:\$HOME|\$\{HOME\})(\/[^"$`\\\n]*)?"|(?:\$HOME|\$\{HOME\})(\/[^"'$`\\\s*?[{]*)?)$/;
const SETS_HOME = /(^|[^A-Za-z0-9_])HOME\+?=|\b(?:export|declare|typeset|local|readonly|read|unset|mapfile|readarray|getopts|printf)\b[^;&|\n]*\bHOME\b/;
const homeWord = (w, home) => { const m = w && home && !w.tilde ? HOME_WORD.exec(String(w.raw || "")) : null; return m ? { ...w, text: normalPath(home + (m[1] || m[2] || "")), expand: false, subst: false, quoted: true } : w; };
const pwdWord = (w, dir) => { const m = w && dir !== false && !w.tilde ? PWD_WORD.exec(String(w.raw || "")) : null; return m ? { ...w, text: normalPath(dir + m[1]), expand: false, subst: false, quoted: true } : w; };
export function readCommand(command, { cwd = "/", home = "" } = {}) {
  const r = parseShell(String(command || ""));
  const writes = [], reads = [];
  let dir = cwd, cdAway = false, unsureDir = false, cdSeen = false;
  const setsPwd = SETS_PWD.test(String(command || ""));
  const homeAt = home && typeof home === "string" && home.startsWith("/") && !SETS_HOME.test(String(command || "")) ? home : "";
  for (const c of r.commands) {
    if (homeAt) { c.words = c.words.map((x) => homeWord(x, homeAt)); for (const x of c.redirects) if (x.target) x.target = homeWord(x.target, homeAt); }
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
      // (A here-string's word is text, not a file: Claude Code checks no "here-docs and here-strings".)
      if (x.op === "<<<") continue;
      const path = unsureDir && !t.text.startsWith("/") ? "" : fullPath(t, dir);
      // `glob`: an unquoted * ? or [ (Claude Code: an output target that "contains a glob character needs your approval",
      // an input one too); `afterCd`: an input target given as a short path after a cd in the same command (Claude Code:
      // "a relative path that follows a cd in the same command, needs your approval even when an allow rule covers it").
      // (`cmd`: the part it belongs to, for Claude Code's "The following parts require approval: …".)
      if (x.op === "<" || x.op === "<&") reads.push({ path, raw: t.raw, glob: !!t.glob, afterCd: cdSeen && !t.text.startsWith("/"), cmd: c, expand: !!(t.expand || t.subst) });
      else writes.push({ path, raw: t.raw, glob: !!t.glob, cmd: c, expand: !!(t.expand || t.subst) });
    }
    if (prog === "tee") for (let k = 1; k < w.length; k++) { const t = w[k].text; if (t === "--" || (t.startsWith("-") && t.length > 1)) continue; writes.push({ via: "tee", cmd: c, expand: !!(w[k].expand || w[k].subst), path: unsureDir && !t.startsWith("/") ? "" : fullPath(w[k], dir), raw: w[k].raw, glob: !!w[k].glob }); }
    if (prog === "cd" || prog === "pushd" || prog === "popd" || prog === "chdir") cdSeen = true;
    if ((prog === "cd" || prog === "pushd" || prog === "popd") && c.top >= 0) {
      const to = w[1] ? fullPath(w[1], unsureDir ? false : dir) : "";
      if (!to || prog !== "cd") unsureDir = true; else if (to !== dir) { dir = to; cdAway = true; }
    } else if (prog === "cd" || prog === "pushd" || prog === "popd" || prog === "chdir") unsureDir = true;
  }
  // `loopVars`: each loop's own variable (`for NAME in …`); `dangling`: an operator with nothing after it (coder-shell.mjs).
  return { ok: r.ok, cmds: r.commands, writes, reads, cdAway, unsureDir, loopVars: r.loopVars || [], dangling: !!r.dangling };
}

// ── RULES ────────────────────────────────────────────────────────────────────
/** A rule's parts (`Bash(npm test *)`, `Bash`, `WebFetch(domain:x.com)`); null when Coder does not know it. */
export function parseRule(text) {
  const m = /^(Bash|WebFetch)(?:\(([\s\S]*)\))?$/.exec(String(text || "").trim());
  if (!m) return null;
  const spec = m[2] === undefined ? null : m[2].trim();
  if (m[1] === "WebFetch" && spec !== null && !/^domain:[A-Za-z0-9.*-]+$/.test(spec)) return null;
  if (spec === "" ) return null;
  // (A rule on the command itself, Bash(command:…), is never one: see ruleProblem.)
  if (m[1] === "Bash" && spec !== null && settingSpec(spec) && settingSpec(spec).name === "command") return null;
  return { tool: m[1], spec: spec === "*" && m[1] === "Bash" ? null : spec };
}
/**
 * RULES ON ONE OF THE COMMAND'S SETTINGS (Bash docs pass 3, the owner, 2026-11-10: "Ok yes do that"; Claude Code's
 * permissions docs, "Match by input parameter": "Deny and ask rules can match a top-level input parameter on any built-in
 * tool with Tool(param:value)", such as Bash(run_in_background:true), "Bash calls that run in the background"; "allow rules
 * continue to use each tool's own specifier syntax"; "The value supports * as a wildcard that matches any sequence of
 * characters … Without * the match is exact"; "A parameter the model omits is never matched"; "The value is compared
 * against the literal input Claude sends, before any normalization"; "Whitespace around the colon is ignored"). Coder's bash
 * takes these besides its command.
 */
export const BASH_SETTINGS = ["description", "timeout", "run_in_background"];
/** A Bash rule's specifier read as a rule on a setting, `{ name, value }`, or null when it is a command pattern. */
export function settingSpec(spec) {
  const m = typeof spec === "string" ? /^\s*([A-Za-z_]+)\s*:\s*([\s\S]*?)\s*$/.exec(spec) : null;
  return m && (BASH_SETTINGS.includes(m[1]) || m[1] === "command") ? { name: m[1], value: m[2] } : null;
}
/** Whether a setting's value, as Grok sent it, fits a rule's (a scalar only; `*` is any text). */
export function settingMatches(pattern, value) {
  if (value === undefined || value === null) return false;
  const text = typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : null;
  if (text === null) return false;
  return new RegExp("^" + String(pattern).split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\S]*") + "$").test(text);
}
/**
 * WHY A RULE CAN'T BE USED, or "" (Claude Code: "You can't match a tool's primary content field this way: command for
 * Bash … A rule like Bash(command:rm *) would be bypassable by a compound command, so Claude Code ignores it and emits a
 * startup warning. Use Bash(rm *) … instead").
 */
export function ruleProblem(text) {
  const t = String(text ?? "").trim();
  // CLAUDE CODE'S OWN CHECKS OF A RULE'S SHAPE (Bash docs pass 5: its rule check, 2.1.321, and its error reference,
  // "Malformed Tool(content) rule"), in its words: error, then what to do, then examples.
  const say = (error, suggestion, examples) => error + (suggestion ? ". " + suggestion : "") + (examples && examples.length ? ". Examples: " + examples.join(", ") : "");
  if (!t) return say("Permission rule cannot be empty");
  const open = t.indexOf("(");
  if ((open < 0 && t.includes(")")) || (open >= 0 && !t.endsWith(")"))) return say("Malformed Tool(content) rule", 'Rules take the form Tool or Tool(content) and must end at the closing ")"; parentheses inside the content are literal');
  const tool = open < 0 ? t : t.slice(0, open), content = open < 0 ? null : t.slice(open + 1, -1);
  if (content === "") return tool ? say("Empty parentheses", 'Either specify a pattern or use just "' + tool + '" without parentheses', [tool, tool + "(some-pattern)"]) : say("Empty parentheses with no tool name", "Specify a tool name before the parentheses");
  if (!tool) return say("Tool name cannot be empty");
  if (!tool.includes("_") && tool[0] !== tool[0].toUpperCase()) return say("Tool names must start with uppercase", 'Use "' + tool[0].toUpperCase() + tool.slice(1) + '"');
  if (tool === "Bash" && content === ":*") return say("Prefix cannot be empty before :*", "Specify a command prefix before :*", ["Bash(npm *)", "Bash(git *)"]);
  return "";
}
/**
 * CLAUDE CODE'S OWN TOOL NAMES (2.1.322's list, and its old ones): a rule naming one of these that Coder doesn't apply
 * (Read, Edit …) is refused with Coder's own message; a rule naming no known tool is kept, as Claude Code keeps it, and
 * never matches (a deny or ask one with Claude Code's warning, "matches no known tool — check for typos").
 */
const CLAUDE_TOOLS = new Set(["Agent", "Artifact", "AskUserQuestion", "Bash", "CronCreate", "CronDelete", "CronList", "Edit", "EndConversation", "EnterPlanMode", "EnterWorktree", "ExitPlanMode", "ExitWorktree", "Glob", "Grep", "ListAgents", "ListMcpResourcesTool", "LSP", "Monitor", "NotebookEdit", "PowerShell", "PushNotification", "Read", "ReadMcpResourceTool", "RemoteTrigger", "ReportFindings", "ScheduleWakeup", "SendFeedback", "SendMessage", "SendUserFile", "ShareOnboardingGuide", "Skill", "SubagentHandback", "TaskCreate", "TaskGet", "TaskList", "TaskOutput", "TaskStop", "TaskUpdate", "TodoWrite", "ToolSearch", "WaitForMcpServers", "WebFetch", "WebSearch", "Workflow", "Write", "MultiEdit", "Task", "NotebookRead"]);
/** A rule's tool name and content, as Claude Code splits it (null when its shape is not a rule's: ruleProblem). */
function ruleParts(text) {
  const t = String(text ?? "").trim();
  if (ruleProblem(t)) return null;
  const open = t.indexOf("(");
  return { tool: open < 0 ? t : t.slice(0, open), content: open < 0 ? null : t.slice(open + 1, -1) };
}
/**
 * WHETHER CODER KEEPS A RULE IT CAN'T APPLY, as Claude Code keeps it (the owner, 2026-11-10: "ok do that"): a rule on the
 * command itself, Bash(command:…), which "will not match", and one naming no known tool. Neither ever matches.
 */
export function ruleKept(text) {
  const r = ruleParts(text);
  if (!r) return false;
  if (r.tool === "Bash" && r.content !== null) { const sp = settingSpec(r.content); return !!sp && sp.name === "command"; }
  return !CLAUDE_TOOLS.has(r.tool) && !r.tool.includes("_") && /^[A-Za-z][A-Za-z0-9-]*$/.test(r.tool);
}
/** Whether a rule is saved: one Coder applies (parseRule), or one it keeps as Claude Code does (ruleKept). */
export const ruleSaved = (text) => !!parseRule(text) || ruleKept(text);
/** Whether a rule's text has a `*` that is not escaped (`\*` is a literal star): Claude Code's Hr. */
function hasStar(s) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "*") continue;
    let back = 0;
    for (let j = i - 1; j >= 0 && s[j] === "\\"; j--) back++;
    if (back % 2 === 0) return true;
  }
  return false;
}
/**
 * THE PROGRAM OF A BASH ALLOW RULE WHOSE * COMES BEFORE A LATER WORD THAT SAYS WHICH COMMAND IT IS, or "" (Claude Code's
 * l_; its error reference, "Has a wildcard before the rest of the command": `Bash(git * main)` "also approves
 * `git -c core.fsmonitor=<script> diff main`, where `-c` makes git run a program the command names"). Options (`-x`) between
 * don't end the search; an operator or a redirection does.
 */
export function starBeforeCommand(spec) {
  const s = String(spec ?? "");
  if (s.endsWith(":*")) return "";
  const words = s.trim().split(/\s+/).filter(Boolean), first = words[0];
  if (words.length < 3 || first === undefined || hasStar(first)) return "";
  let seen = false;
  for (const w of words.slice(1)) {
    if (/^(?:[|&;<>]|\d+[<>])/.test(w)) return "";
    if (hasStar(w)) { seen = true; continue; }
    if (w.startsWith("-")) continue;
    return seen ? first : "";
  }
  return "";
}
/**
 * WHAT CLAUDE CODE WARNS ABOUT A BASH RULE THAT IT STILL KEEPS (Bash docs pass 5; its rule check, 2.1.321, and its error
 * reference): `{ warning, notice }` in its words (the warning in full; the notice is its short row, "⚠ Allow rule … allows
 * any option at its * · use an exact value", given only where Claude Code shows that row), or null.
 */
export function ruleWarning(kind, text) {
  const w = ruleWarningOf(kind, text);
  // (Claude Code's short row: the kind, "rule", then its notice: "Allow rule Bash(git * main) allows any option …".)
  return w && w.notice ? { ...w, notice: kind.charAt(0).toUpperCase() + kind.slice(1) + " rule " + w.notice } : w;
}
function ruleWarningOf(kind, text) {
  const t = String(text ?? "").trim();
  const k = String(kind || "");
  // A DENY OR ASK RULE THAT CAN NEVER MATCH (Claude Code 2.1.322, its words: "Permission deny rule "Bash(command:rm *)"
  // targets command as a raw string and will not match — use Bash(…) for Bash's own matcher."; "Permission deny rule "Bsh"
  // matches no known tool — check for typos."). An allow one is kept without a word, as Claude Code keeps it.
  if (ruleKept(t)) {
    if (k !== "deny" && k !== "ask") return null;
    const r = ruleParts(t);
    if (r.tool === "Bash") return { warning: "Permission " + k + ' rule "' + t + '" targets command as a raw string and will not match — use Bash(…) for Bash\'s own matcher.', notice: t + " never matches · use Bash(…)" };
    return { warning: "Permission " + k + ' rule "' + t + '" matches no known tool — check for typos.', notice: t + " matches no tool · check for typos" };
  }
  const m = /^Bash\(([\s\S]*)\)$/.exec(t);
  if (!m || settingSpec(m[1])) return null;
  const g = m[1];
  // (Content that starts with a name and a colon, such as git:* status, is not checked, as Claude Code skips it.)
  { const c = g.indexOf(":"); if (c > 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(g.slice(0, c).trim()) && !/^[A-Za-z]:[\\/]/.test(g.trim())) return null; }
  if (kind === "allow") {
    const prog = starBeforeCommand(g);
    if (prog) {
      const git = prog === "git";
      return {
        warning: t + " has a wildcard before the rest of the command, so it also matches any options inserted at that position and approves them without a prompt." + (git ? " For git, options such as -c and --exec-path can run arbitrary commands." : "") + " Replace that * with the exact value you mean, or only use * after the subcommand" + (git ? " (for example Bash(git status *))" : "") + ".",
        notice: t + " allows any option at its * · use an exact value",
      };
    }
  }
  const pre = /^([\s\S]+):\*$/.exec(g);
  if (pre) {
    const p = pre[1].trimEnd();
    if (!hasStar(p)) return null;
    // (Claude Code's oMo: the prefix ends in an unescaped *.)
    let back = 0;
    for (let j = p.length - 2; j >= 0 && p[j] === "\\"; j--) back++;
    const endsStar = p.endsWith("*") && back % 2 === 0;
    const y = endsStar ? p : p + "*";
    const what = endsStar ? "matches only commands containing a literal * at that position" : "will likely never match";
    const tail = kind === "allow" ? " Replace that * with the exact value you mean." : y.endsWith(":*") ? "" : " Use Bash(" + y + ") for wildcard matching.";
    return { warning: t + " mixes * with the trailing :* prefix syntax, so it is matched as a literal prefix (the * is not expanded) and " + what + "." + tail, notice: kind === "allow" ? "" : t + " reads its * literally" + (y.endsWith(":*") ? "" : " · use Bash(" + y + ")") };
  }
  if (g.includes(":*")) {
    return { warning: t + " has a :* that is not at the end, so it is matched as a * wildcard (the : is literal), not as the trailing :* prefix syntax. " + (kind === "allow" ? "Replace that :* with the exact value you mean." : "It already matches as a * wildcard; moving :* to the end would make it a literal prefix and change which commands match."), notice: kind === "allow" ? t + " reads its :* as a wildcard · use an exact value" : "" };
  }
  return null;
}
export const RULE_MAX = 300;
/** A rule as saved: its tool, and its specifier when it has one. */
export function ruleText(tool, spec) { return spec ? tool + "(" + spec + ")" : tool; }
/**
 * Whether a Bash rule's specifier matches a command's text (Claude Code's: `*` is any text; a trailing ` *` also matches the
 * bare command; `…:*` at the end is its prefix form: the command, or the command and more words, the part before `:*` read
 * literally, a `*` in it included: Claude Code's b4e, "matched as a literal prefix (the * is not expanded)", Bash docs pass 5).
 */
export function bashSpecMatches(spec, text) {
  if (spec === null) return true;
  const pre = /^([\s\S]+):\*$/.exec(spec);
  if (pre) return text === pre[1] || text.startsWith(pre[1] + " ");
  const p = spec;
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

/**
 * Whether an allow rule approves one part of a command, as text `t`: an exec wrapper (watch, setsid, flock …) or a find that
 * runs, deletes or writes only by an exact rule, one with no * (Claude Code: "A prefix rule like Bash(watch *) or
 * Bash(find *) can't auto-approve" them).
 */
function exactOnly(c) { const w = readWords(c.words, { wrappers: true }); const n = w && w[0] ? basename(w[0].text) : ""; return EXACT_RULE_WRAPPERS.has(n) || (n === "find" && w.slice(1).some((x) => FIND_ACTS.has(x.text))); }
function ruleApproves(c, x, t) { return (x.spec === null || !x.spec.includes("*") || !exactOnly(c)) && bashSpecMatches(x.spec, t); }
/** Whether one of the owner's allow rules approves this one part of a command (a simple command, coder-shell.mjs's). */
export function allowRuleCovers(cmd, rules) {
  const allow = rulesFor(rules && rules.allow, "Bash");
  return allowTexts(cmd).some((t) => allow.some((x) => ruleApproves(cmd, x, t)));
}
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
 * `{ verdict: "allow" | "ask" | "deny", why, rule?, suggest: [rules] | null }`. `ctx`: `{ cwd, workdirs, isProtected, real,
 * input }` (`isProtected(fullPath)` names the protected file, or ""; `real(fullPath)`: where a path really leads, its links
 * followed, "" when that can't be worked out, from Coder's machine; `input`: the call's settings as Grok sent them, for rules
 * on a setting). Coder's own checks (control characters, long sleeps, dangerous removals, protected files, very long
 * commands, writes through a link) come first, in coder-agent.mjs.
 */
export function bashDecision(command, { mode = "auto", rules = {}, cwd = "/", workdirs = [], isProtected = () => "", real = null, input = null, home = "", ownDirs = [] } = {}) {
  const read = readCommand(command, { cwd, home });
  const deny = rulesFor(rules.deny, "Bash"), ask = rulesFor(rules.ask, "Bash"), allow = rulesFor(rules.allow, "Bash");
  // DENY, THEN ASK: a rule on one of the call's settings (Bash(run_in_background:true), see settingSpec), or a rule on the
  // command matching any part of it, nested ones too (Claude Code: "including a command nested inside a subshell, a command
  // substitution, or a control-flow body"). A rule on a setting is no command pattern.
  const onSetting = (x) => { const sp = settingSpec(x.spec); return sp && sp.name !== "command" ? sp : null; };
  const settingHit = (list) => (input && typeof input === "object" ? list.find((x) => { const sp = onSetting(x); return !!sp && settingMatches(sp.value, input[sp.name]); }) || null : null);
  const commandHit = (list) => { const on = list.filter((x) => !settingSpec(x.spec)); for (const c of read.cmds) for (const t of denyTexts(c)) { const r = on.find((x) => bashSpecMatches(x.spec, t)); if (r) return r; } return null; };
  const d = settingHit(deny) || commandHit(deny);
  if (d) return { verdict: "deny", rule: d.text, why: "Permission to use Bash with command " + String(command).trim() + " has been denied.", suggest: null };
  const a = settingHit(ask) || commandHit(ask);
  if (a) return { verdict: "ask", rule: a.text, why: "Your rule " + a.text + " asks first for this command.", suggest: null, byRule: true };
  if (normMode(mode) === "auto") return { verdict: "allow", why: "", suggest: null };
  const editsOk = normMode(mode) === "acceptEdits";
  if (!read.ok) return { verdict: "ask", why: PARSE_ERROR, suggest: null };
  // ONE THAT CAN'T BE CHECKED EITHER (Bash docs pass 3): an operator with nothing after it (Claude Code: "When && or || has
  // nothing after it, such as in npm test &&, Claude Code treats the command as unparseable and doesn't split it into
  // subcommands for allow-rule matching"), or a loop over one of the shell's own variables (shellVariable).
  if (read.dangling) return { verdict: "ask", why: PARSE_ERROR, suggest: null };
  const loopVar = read.loopVars.find((n) => shellVariable(n));
  if (loopVar) return { verdict: "ask", why: loopVarWhy(loopVar), suggest: null };
  // MORE THAN ONE FOLDER CHANGE IN ONE COMMAND (found in the live side-by-side, 2026-11-10: Claude Code 2.1.322 asks for
  // `cd docs && cd ..`, `cd a; cd ../b` and `pushd a && popd` in Accept edits, in its words, MULTI_CD; one `cd` runs as
  // before). Asked as the last reason: a part's own reason (a protected file, a folder outside) is said first, as Claude
  // Code returns its parts' own results before this one.
  const multiCd = read.cmds.filter((c) => { const w = unwrapped(c.words); const p = w[0] ? basename(w[0].text) : ""; return p === "cd" || p === "pushd" || p === "popd"; }).length > 1;
  // WHERE EACH PATH REALLY LEADS (Bash docs pass 3; Claude Code's permissions docs, Symlinks: "the permission check covers
  // two paths: the one Claude requested and the file it resolves to"; a write that "resolves outside the working
  // directories … isn't auto-approved in acceptEdits mode", and one that resolves to a protected path gets that path's
  // outcome). Given back as the working folder names it, so a folder reached through a link of its own still counts.
  const realWork = workdirs.map((w) => { if (!w || typeof real !== "function") return w; try { return real(w) || w; } catch { return w; } });
  const leads = (p) => {
    if (!p || typeof real !== "function") return p;
    let to = "";
    try { to = real(p) || ""; } catch { to = ""; }
    for (let k = 0; to && k < workdirs.length; k++) { const rw = realWork[k]; if (rw && rw !== workdirs[k] && (to === rw || to.startsWith(rw + "/"))) return workdirs[k] + to.slice(rw.length); }
    return to;
  };
  const shown = (p) => { const w = workdirs.find((x) => x && (p === x || p.startsWith(x.replace(/\/+$/, "") + "/"))); return w ? (p === w ? "." : p.slice(w.replace(/\/+$/, "").length + 1)) : p; };
  const pathWhy = (p) => {
    if (!p) return { why: "unknown" };
    const inside = insideWork(p, workdirs);
    if (inside && isProtected(p)) return { why: "protected" };
    const to = leads(p);
    if (to !== p) {
      if (!to) return { why: "lost" };
      if (insideWork(to, workdirs) && isProtected(to)) return { why: "protected", to };
      if (inside && !insideWork(to, workdirs)) return { why: "outside", to };
    }
    return { why: inside ? "" : "outside" };
  };
  // EACH THING THAT ASKS, WITH ITS PART AND ITS REASON in Claude Code's words (see PARSE_ERROR …): `needs` no allow rule
  // approves; a part in `parts` asks unless one of the owner's allow rules covers it (`partWhy`: its own reason).
  const needs = [], partWhy = new Map();
  const needFor = (c, why, safety = false) => needs.push({ c, why, safety });
  const own = (Array.isArray(ownDirs) ? ownDirs : []).filter((x) => typeof x === "string" && x);
  const isOwn = (p) => own.some((d) => p === d || p.startsWith(d.replace(/\/+$/, "") + "/"));
  // EACH FILE IT WRITES (redirections, tee): in Accept edits, a file inside the project that is not protected, not named
  // with a wildcard (Claude Code: a target that "contains a glob character needs your approval"), and no link out of the
  // project or to a protected file; in Plan, none.
  for (const x of read.writes) {
    if (!editsOk) { needFor(x.cmd, "This command writes " + x.raw + ", and Plan mode changes no files."); continue; }
    if (x.glob) { needFor(x.cmd, SHELL_EXPANSION); continue; }
    if (x.expand || !x.path) { needFor(x.cmd, VAR_UNCHECKED); continue; }
    const pw = pathWhy(x.path);
    if (pw.why === "protected") needFor(x.cmd, sensitiveWhy(pw.to || x.path, pw.to ? x.path : ""), true);
    else if (pw.why === "outside") needFor(x.cmd, pw.to ? linkOutWhy(x.path, pw.to) : needsWhy(x.via === "tee" ? "tee in" : "Output redirection to", x.path, workdirs));
    else if (pw.why === "lost") needFor(x.cmd, "This command writes " + x.raw + ", a link that can't be followed.");
    else if (pw.why) needFor(x.cmd, VAR_UNCHECKED);
  }
  // An input redirection from outside the project (Claude Code 2.1.257: "A target outside the working directories needs
  // your approval unless an allow rule covers it"; "A target that contains a glob pattern, or a relative path that follows
  // a cd in the same command, needs your approval even when an allow rule covers it"), or through a link out of it.
  for (const x of read.reads) {
    if (x.glob || x.afterCd) { needFor(x.cmd, inputUnsureWhy(x.raw)); continue; }
    if (x.expand || !x.path) { needFor(x.cmd, VAR_UNCHECKED); continue; }
    if (isOwn(x.path)) continue;
    const inside = insideWork(x.path, workdirs), to = inside ? leads(x.path) : x.path;
    if (inside && (to === x.path || insideWork(to, workdirs))) continue;
    needFor(x.cmd, inside && to ? linkOutWhy(x.path, to) : inside ? "This command reads " + x.raw + ", a link that can't be followed." : inputBlockedWhy(x.path, workdirs));
  }
  // EACH COMMAND: read-only, one of Accept edits' file commands on the project's files, or allowed by a rule.
  let gitAfterCd = false;
  const parts = [];
  for (const c of read.cmds) {
    if (c.ranBy === "xargs" && commandReadOnly({ words: c.words })) continue;
    const prog = c.words.length ? (readWords(c.words) || [])[0] : null;
    const name = prog ? basename(prog.text) : "";
    const ro = commandReadOnly(c);
    // A cd out of the project, or into another folder before git (its hooks), is asked about (Claude Code's docs).
    if (ro && name === "cd") {
      const to = c.words.length > 1 ? fullPath((readWords(c.words) || [])[1], c.dir === undefined ? cwd : c.dir) : "";
      if (!to || !insideWork(to, workdirs)) { partWhy.set(c, to ? blockedWhy("cd", to, workdirs) : VAR_UNCHECKED); parts.push(c); continue; }
      continue;
    }
    if (ro && name === "git" && read.cdAway) { gitAfterCd = true; partWhy.set(c, GIT_AFTER_CD); parts.push(c); continue; }
    if (ro) {
      // A READ OF A PATH OUTSIDE THE PROJECT ASKS (the live side-by-side, 2026-11-10: Claude Code 2.1.322 asked for
      // `cat /etc/hostname`, `ls /`, `head -1 /etc/passwd`, `ls ../` and `cat ~/.bashrc` in Accept edits, and in Plan without
      // its auto-mode checker, which Coder doesn't have; it had run them). Each path by the command's own rule for its
      // paths (READ_PATHS, Claude Code's); Coder's own folders (background logs, saved outputs) stay readable.
      // (A short path after a cd out of the project: that cd is asked about, and Claude Code names only it, as for
      // `cd /tmp && ls`; a full path is still checked: `cd /tmp && ls -d /tmp` names both parts.)
      const movedOut = c.dir !== undefined && c.dir !== false && c.dir !== cwd && !insideWork(c.dir, workdirs);
      for (const a of pathArgs(c, { cwd, home })) {
        if (movedOut && !/^[/~]/.test(a.p) && !/^\$\{?HOME\b/.test(a.p)) continue;
        if (a.dotdot) { needFor(c, globDotDotWhy(a.p, " against the working directories")); break; }
        if (a.unknownDir) { if (a.updir) { needFor(c, name + " in '" + a.p + "' requires manual approval: the path it names depends on a directory change in the same command."); break; } continue; }
        if (a.computed || !a.full) { needFor(c, VAR_UNCHECKED); break; }
        if (isOwn(a.full)) continue;
        const inside = insideWork(a.full, workdirs), to = inside ? leads(a.full) : a.full;
        if (inside && (to === a.full || insideWork(to, workdirs))) continue;
        needFor(c, inside && to ? linkOutWhy(a.full, to) : blockedWhy(name, a.full, workdirs));
        break;
      }
      continue;
    }
    if (editsOk) {
      // (Its short paths from the folder this part runs in, not the one the command started in.)
      const fc = fileCommandTargets(c, c.dir === undefined ? cwd : c.dir);
      if (fc && fc.sure) {
        const bare = fc.paths.map((p) => p.replace(/\/\*$/, ""));
        const ways = bare.map((p) => pathWhy(p));
        // A protected file, by name or through a link, is never approved by a rule (Claude Code: "permissions.allow rules
        // … do not pre-approve protected-path writes"): asked each time.
        const prot = ways.findIndex((pw) => pw.why === "protected");
        if (prot >= 0) { needFor(c, sensitiveWhy(ways[prot].to || bare[prot], ways[prot].to ? bare[prot] : ""), true); parts.push(c); continue; }
        // Not approved by the mode when a path leads out of the project (through a link, or named there); an allow rule still may.
        const k = ways.findIndex((pw) => pw.why);
        if (k < 0) continue;
        const pw = ways[k];
        partWhy.set(c, pw.to ? linkOutWhy(bare[k], pw.to) : pw.why === "outside" ? needsWhy(name + " in", bare[k], workdirs) : pw.why === "lost" ? "This command changes " + bare[k] + ", a link that can't be followed." : VAR_UNCHECKED);
      }
    }
    parts.push(c);
  }
  // THE PARTS LEFT: each allowed by one of the owner's rules (allowRuleCovers), or the command is asked about.
  const left = parts.filter((c) => !allowTexts(c).some((t) => allow.some((x) => ruleApproves(c, x, t))));
  // (A wrapper or a find action that a prefix rule matched but can't approve: Claude Code's own reason.)
  for (const c of left) if (!partWhy.has(c) && exactOnly(c) && allowTexts(c).some((t) => allow.some((x) => x.spec !== null && x.spec.includes("*") && bashSpecMatches(x.spec, t)))) partWhy.set(c, exactWhy(c));
  // (A part asked about only because a word is a variable: Claude Code's "A variable in this command can't be checked before it runs".)
  // (A `$(…)` alone is a command substitution, not a variable.)
  const isVar = (x) => !!x && !!x.expand && /\$(\{|[A-Za-z_@*#?$!0-9-])/.test(String(x.raw || ""));
  const hasVar = (c) => (c.words || []).some(isVar) || (c.redirects || []).some((x) => isVar(x.target));
  const items = [...needs, ...left.filter((c) => !needs.some((n) => n.c === c)).map((c) => ({ c, why: partWhy.get(c) || (hasVar(c) ? VAR_UNCHECKED : "") }))];
  if (!items.length) return multiCd ? { verdict: "ask", why: MULTI_CD, suggest: null } : { verdict: "allow", why: "", suggest: null };
  // WHICH REASON IS SAID, in Claude Code's order: a protected file ("a sensitive file") first, then more than one folder
  // change, then one part's own reason, or, when two or more parts need approval, Claude Code's list of them.
  const order = (c) => read.cmds.indexOf(c);
  const asked = [...new Set(items.map((x) => x.c).filter(Boolean))].sort((a, b) => order(a) - order(b));
  const safety = items.find((x) => x.safety);
  const why = safety ? safety.why : multiCd ? MULTI_CD : asked.length >= 2 ? MULTI_PARTS + asked.map(partText).join(", ") : (items[0].why || "This command requires approval");
  // What "Yes, and don't ask again" would save: a rule for each part left, when they cover it all (a cd out of the
  // project, or git after a cd, has no rule that could).
  let suggest = null;
  const cdLeft = left.some((c) => { const w = readWords(c.words) || []; return w[0] && w[0].text === "cd"; });
  if (!needs.length && left.length && left.length <= 5 && !gitAfterCd && !cdLeft && !multiCd) {
    const s = left.map((c) => suggestFor(c));
    if (s.every((x) => typeof x === "string" && x.length && x.length <= RULE_MAX)) suggest = [...new Set(s.map((x) => ruleText("Bash", x)))];
  }
  return { verdict: "ask", why, suggest };
}
/** One part of a command as written, for Claude Code's list of the parts that need approval. */
function partText(c) {
  const w = (c.words || []).map((x) => x.raw).join(" ");
  const r = (c.redirects || []).filter((x) => !x.heredoc && x.target).map((x) => (x.fd === undefined || x.fd === null ? "" : String(x.fd)) + x.op + " " + x.target.raw).join(" ");
  return (w + (r ? " " + r : "")).trim();
}
/** Claude Code's reason when a prefix rule matched an exec wrapper or a find that runs, deletes or writes. */
function exactWhy(c) {
  const w = readWords(c.words, { wrappers: true }) || [];
  const n = w[0] ? basename(w[0].text) : "";
  if (n === "find") { const act = w.slice(1).find((x) => FIND_ACTS.has(x.text)); return findActionWhy(act ? act.text : "-exec"); }
  const outer = (readWords(c.words) || [])[0];
  return wrapperWhy(outer ? basename(outer.text) : n);
}
/**
 * The paths a command names, by its own rule for them (READ_PATHS, Claude Code's): `{ p, full, glob }`, or `{ p, computed }`
 * for one worked out when it runs. `$HOME` and `~` are the AI's home (Claude Code showed `ls -la $HOME/../` as "ls in '/'");
 * a wildcard is checked by the folder before it.
 */
export function pathArgs(c, { cwd = "/", home = "" } = {}) {
  const words = unwrapped(c.words);
  if (!words.length) return [];
  const rule = READ_PATHS[basename(words[0].text)];
  if (!rule) return [];
  const args = words.slice(1), dir = c.dir === undefined ? cwd : c.dir, out = [];
  for (const p of rule(args.map((x) => x.text))) {
    if (p === "-" || NOT_FILES.has(p)) continue;
    const word = args.find((x) => x.text === p) || args.find((x) => x.text.endsWith(p)) || {};
    let text = p;
    const homeVar = /^\$(HOME|\{HOME\})(?=\/|$)/;
    if ((word.expand || word.subst) && home && homeVar.test(text) && !/[$`]/.test(text.replace(homeVar, ""))) text = home + text.replace(homeVar, "");
    else if (word.expand || word.subst) { out.push({ p, computed: true }); continue; }
    const g = word.glob ? text.search(/[*?[]/) : -1;
    // (A `..` after a wildcard: where it leads is known only once the shell expands it.)
    if (g >= 0 && /(^|\/)\.\.(\/|$)/.test(text.slice(g))) { out.push({ p, dotdot: true }); continue; }
    // (A short path where the folder is not known, after a cd in ( … ), a function or $( … ): that cd is checked on its own;
    // `updir` when the path climbs with `..`, so it could leave the project from there.)
    if (dir === false && !text.startsWith("/") && !(text === "~" || text.startsWith("~/"))) { out.push({ p, unknownDir: true, updir: /(^|\/)\.\.(\/|$)/.test(text) }); continue; }
    const base = g >= 0 ? (text.slice(0, g).replace(/\/[^/]*$/, "") || (text.startsWith("/") ? "/" : ".")) : text;
    const full = base.startsWith("/") ? normalPath(base) : base === "~" || base.startsWith("~/") ? (home ? normalPath(home + base.slice(1)) : "") : dir === false ? "" : normalPath(dir + "/" + base);
    out.push({ p, full, glob: g >= 0 });
  }
  return out;
}
/** Claude Code's words for a command that changes folder more than once (see bashDecision). */
export const MULTI_CD = "Multiple directory changes in one command require approval for clarity";

// ── CLAUDE CODE'S OWN WORDS FOR WHY A COMMAND ASKS ───────────────────────────
// (The owner, 2026-11-10: "ok do that": copy Claude Code exactly.) Each from Claude Code 2.1.322 itself, run with the same
// commands that day (claude -p, Accept edits, Plan without its auto-mode checker, and auto mode with the read block), with
// "Claude Code" read as "Coder" and its setting's name as Coder's.
export const PARSE_ERROR = "Parse error";
export const VAR_UNCHECKED = "A variable in this command can't be checked before it runs";
export const SHELL_EXPANSION = "Shell expansion syntax in paths requires manual approval";
export const GIT_AFTER_CD = "This command changes directory before running a version-control command, which can pick up untrusted hooks or repository configuration from the target directory. Approve only if you trust it.";
export const MULTI_PARTS = "This Bash command contains multiple operations. The following parts require approval: ";
export const loopVarWhy = (name) => name + " as loop variable bypasses assignment validation";
export const findActionWhy = (act) => "find with '" + act + "' executes commands or modifies files — cannot be auto-allowed by a Bash(find:*) prefix rule";
export const wrapperWhy = (w) => "What '" + w + "' starts can't be checked before it runs";
/** The working folders as Claude Code lists them: 'a', 'b' (and how many more past five). */
export function dirsText(dirs) {
  const d = (Array.isArray(dirs) ? dirs : []).filter((x) => typeof x === "string" && x);
  const q = (x) => "'" + x + "'";
  return d.length <= 5 ? d.map(q).join(", ") : d.slice(0, 5).map(q).join(", ") + ", and " + (d.length - 5) + " more";
}
/** What each command whose paths Claude Code checks may do in the working folders (its own table, 2.1.322). */
export const PATH_VERBS = { cd: "change directories to", ls: "list files in", find: "search files in", mkdir: "create directories in", touch: "create or modify files in", rm: "remove files from", rmdir: "remove directories from", mv: "move files to/from", cp: "copy files to/from", cat: "concatenate files from", head: "read the beginning of files from", tail: "read the end of files from", sort: "sort contents of files from", uniq: "filter duplicate lines from files in", wc: "count lines/words/bytes in files from", cut: "extract columns from files in", paste: "merge files from", column: "format files from", tr: "transform text from files in", file: "examine file types in", stat: "read file stats from", diff: "compare files from", awk: "process text from files in", gawk: "process text from files in", mawk: "process text from files in", nawk: "process text from files in", strings: "extract strings from files in", hexdump: "display hex dump of files from", od: "display octal dump of files from", base64: "encode/decode files from", nl: "number lines in files from", tac: "read files (reversed) from", man: "read manual page files from", rev: "read files (reversed lines) from", fold: "wrap lines of files from", expand: "convert tabs in files from", unexpand: "convert spaces in files from", fmt: "reformat files from", comm: "compare files from", cmp: "compare files from", pr: "paginate files from", numfmt: "reformat numbers in files from", tsort: "sort files from", grep: "search for patterns in files from", egrep: "search for patterns in files from", fgrep: "search for patterns in files from", rg: "search for patterns in files from", sed: "edit files in", git: "access files with git from", jq: "process JSON from files in", sha256sum: "compute SHA-256 checksums for files in", sha1sum: "compute SHA-1 checksums for files in", md5sum: "compute MD5 checksums for files in", tee: "write to files in" };
/** A read (or cd) of a path outside the working folders: "cat in '/etc/hostname' was blocked. For security, …". */
export const blockedWhy = (cmd, path, dirs) => cmd + " in '" + path + "' was blocked. For security, Coder may only " + (PATH_VERBS[cmd] || "access files in") + " the allowed working directories for this session: " + dirsText(dirs) + ".";
/** A write outside them: "rm in '/tmp/x' needs approval. …", "Output redirection to '/tmp/x' needs approval. …". */
export const needsWhy = (what, path, dirs) => what + " '" + path + "' needs approval. The path is outside the working directories for this session (" + dirsText(dirs) + "). Allowing runs the command as written.";
export const inputBlockedWhy = (path, dirs) => "Input redirection from '" + path + "' was blocked. For security, Coder may only read files in the allowed working directories for this session: " + dirsText(dirs) + ".";
export const inputUnsureWhy = (raw) => "Input redirection from '" + raw + "' requires manual approval: the file it names depends on glob expansion or a directory change in the same command.";
/** A protected file ("a sensitive file"), and the link it was reached through. */
export const sensitiveWhy = (target, from = "") => "Coder requested permissions to edit " + target + " which is a sensitive file." + (from ? " " + from + " resolves through a symlink to " + target + "." : "");
/** A wildcard before a `..` (Claude Code: "A glob before the '..' in '…' is expanded by the shell before the path is opened, so the target cannot be checked …"). */
export const globDotDotWhy = (p, against) => "A glob before the '..' in '" + p + "' is expanded by the shell before the path is opened, so the target cannot be checked" + against + ". Spell the path without the glob.";
export const linkOutWhy = (from, to) => from + " resolves through a symlink to " + to + ", which is outside the allowed working directories";

// ── THE READ BLOCK ───────────────────────────────────────────────────────────
/**
 * READS OUTSIDE THE PROJECT, BLOCKED (Bash docs pass 4, the owner, 2026-11-10: "Ok do that too"; Claude Code's
 * permissions.blockReadsOutsideWorkingDirectories, under Coder's name CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES in the
 * environment's variables, off unless set: "recognized file-reading Bash commands prompt even in auto mode", and "A command
 * the shell parser can't trace, such as one that changes directory more than once or runs a subshell, prompts the same way
 * even when it names no outside path"; the file tools refuse such reads, in coder-agent.mjs). Which paths each command
 * names: 2.1.321's own rules for its "path-restricted" commands (its map of them, with its helpers), on the words as the
 * shell gives them.
 */
const posArgs = (a) => { const out = []; let dd = false, seen = false; for (const h of a) { if (dd || seen) out.push(h); else if (h === "--") dd = true; else if (h === "-" || !h.startsWith("-")) { out.push(h); seen = true; } } return out; };
const attachedValue = (h, names) => {
  if (!h.startsWith("-")) return undefined;
  const k = h.indexOf("=");
  if (k >= 0) return names.includes(h.slice(0, k)) ? h.slice(k + 1) : undefined;
  for (const n of names) if (n.length === 2 && n[0] === "-" && h.startsWith(n) && h !== n) return h.slice(2);
  return undefined;
};
function optionAware(spec) {
  const kind = (r) => {
    if (r.startsWith("--")) { if (r.includes("=")) return "attached"; if (spec.booleanLong.has(r)) return "boolean"; if (spec.attachedLong && spec.attachedLong.has(r)) return "attached"; return spec.valuedLong.has(r) ? "valued" : "unknown"; }
    if (/^-\d+$/.test(r)) return "attached";
    for (let k = 1; k < r.length; k++) { const h = r[k]; if (spec.booleanShort.includes(h)) continue; if (spec.attachedShort && spec.attachedShort.includes(h)) return "attached"; if (!spec.valuedShort.includes(h)) return "unknown"; return k === r.length - 1 ? "valued" : "attached"; }
    return "boolean";
  };
  return (r) => { const out = []; let dd = false, seen = false, known = true; for (let w = 0; w < r.length; w++) { const h = r[w]; if (h === undefined || h === null) continue; if (dd || seen) out.push(h); else if (h === "--") dd = true; else if (h !== "-" && h.startsWith("-")) { if (!known) continue; const k = kind(h); if (k === "valued") w++; else if (k === "unknown") known = false; } else { out.push(h); seen = true; } } return out; };
}
function patternPaths(e, valued, dflt = []) {
  const out = [];
  let pat = false, dd = false, seen = false;
  for (let w = 0; w < e.length; w++) {
    const h = e[w];
    if (h === undefined || h === null) continue;
    if (!dd && !seen && h === "--") { dd = true; continue; }
    if (!dd && !seen && h !== "-" && h.startsWith("-")) {
      const k = h.indexOf("="), y = k >= 0 ? h.slice(0, k) : h;
      if (["-e", "--regexp", "-f", "--file"].includes(y)) { pat = true; if (y === "-f" || y === "--file") { const v = k >= 0 ? h.slice(k + 1) : e[w + 1]; if (v) out.push(v); } }
      if (/^-[a-zA-Z]*f$/.test(y) && y !== "-f" && k < 0 && e[w + 1] !== undefined) { pat = true; out.push(e[w + 1]); w++; continue; }
      if (["--exclude-from", "--include-from", "--ignore-file"].includes(y)) { const v = k >= 0 ? h.slice(k + 1) : e[w + 1]; if (v) out.push(v); if (k < 0) w++; continue; }
      if (k < 0) { const v = attachedValue(h, ["-f", "--file"]); if (v !== undefined) { pat = true; out.push(v); continue; } if (h.length > 2 && h.startsWith("-e")) { pat = true; continue; } }
      if (valued.has(y) && k < 0) w++;
      continue;
    }
    if (seen && !dd) { const v = attachedValue(h, ["-f", "--file"]); if (v !== undefined) out.push(v); }
    seen = true;
    if (!pat) { pat = true; continue; }
    out.push(h);
  }
  return out.length ? out : dflt;
}
const GREP_VALUED = new Set(["-e", "--regexp", "-f", "--file", "--exclude", "--include", "--exclude-dir", "--include-dir", "-m", "--max-count", "-A", "--after-context", "-B", "--before-context", "-C", "--context"]);
const grepPaths = (e) => { const r = patternPaths(e, GREP_VALUED); return !r.length && e.some((x) => ["-r", "-R", "--recursive"].includes(x)) ? ["."] : r; };
const awkPaths = (e) => {
  const valued = new Set(["-F", "--field-separator", "-v", "--assign", "-e", "--source"]), progs = new Set(["-f", "--file", "-E", "--exec"]);
  const out = [];
  let dd = false, prog = false, seen = false;
  for (let w = 0; w < e.length; w++) {
    const h = e[w];
    if (h === undefined || h === null) continue;
    if (!dd && !seen && h === "--") { dd = true; continue; }
    if (!dd && !seen && h !== "-" && h.startsWith("-")) {
      const k = h.indexOf("="), y = k >= 0 ? h.slice(0, k) : h;
      if (valued.has(y)) { if (y === "-e" || y === "--source") prog = true; if (k < 0) w++; continue; }
      if (progs.has(y)) { prog = true; if (k >= 0) out.push(h.slice(k + 1)); else { const v = e[w + 1]; if (v !== undefined) { out.push(v); w++; } } continue; }
      continue;
    }
    if (seen && !dd) { const v = attachedValue(h, ["-f", "--file", "-E", "--exec"]); if (v !== undefined) out.push(v); }
    seen = true;
    if (!prog) { prog = true; continue; }
    out.push(h);
  }
  return out;
};
const NOT_FILES = new Set(["/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty"]);
const READ_PATHS = {
  cd: (e) => { const n = posArgs(e); if (!n.length) return e.at(-1) === "-" ? ["-"] : ["~"]; return [n[0]]; },
  ls: (e) => { const n = posArgs(e); return n.length ? n : ["."]; },
  find: (e) => {
    const out = [], named = new Set(["-newer", "-anewer", "-cnewer", "-mnewer", "-samefile", "-path", "-wholename", "-ilname", "-lname", "-ipath", "-iwholename"]);
    let opts = false, dd = false;
    for (let k = 0; k < e.length; k++) {
      const w = e[k];
      if (!w) continue;
      if (dd) { out.push(w); continue; }
      if (w === "--") { dd = true; continue; }
      if (w.startsWith("-")) { if (["-H", "-L", "-P"].includes(w)) continue; opts = true; if (named.has(w) || /^-newer[acmBt][acmtB]$/.test(w)) { const v = e[k + 1]; if (v) { out.push(v); k++; } } continue; }
      if (!opts) out.push(w);
    }
    return out.length ? out : ["."];
  },
  mkdir: posArgs, touch: posArgs, rm: posArgs, rmdir: posArgs, mv: posArgs, cp: posArgs, cat: posArgs, head: posArgs, tail: posArgs, sort: posArgs, uniq: posArgs, wc: posArgs,
  cut: optionAware({ booleanShort: "nswz", valuedShort: "bcdf", booleanLong: new Set(["--complement", "--only-delimited", "--zero-terminated"]), valuedLong: new Set(["--bytes", "--characters", "--delimiter", "--fields", "--output-delimiter"]) }),
  paste: optionAware({ booleanShort: "sz", valuedShort: "d", booleanLong: new Set(["--serial", "--zero-terminated"]), valuedLong: new Set(["--delimiters"]) }),
  column: optionAware({ booleanShort: "txdemLJhV", valuedShort: "cosNOClEHRTWrip", booleanLong: new Set(["--table", "--fillrows", "--table-noheadings", "--table-header-repeat", "--table-maxout", "--keep-empty-lines", "--json"]), valuedLong: new Set(["--separator", "--output-separator", "--output-width", "--table-name", "--table-order", "--table-column", "--table-columns", "--table-columns-limit", "--table-noextreme", "--table-hide", "--table-right", "--table-truncate", "--table-wrap", "--tree", "--tree-id", "--tree-parent"]) }),
  file: posArgs, stat: posArgs, diff: posArgs, awk: awkPaths, gawk: awkPaths, mawk: awkPaths, nawk: awkPaths, strings: posArgs, hexdump: posArgs, od: posArgs, base64: posArgs, nl: posArgs, sha256sum: posArgs, sha1sum: posArgs, md5sum: posArgs,
  tee: (e) => posArgs(e).filter((x) => !NOT_FILES.has(x)),
  tr: (e) => { const del = e.some((x) => x === "-d" || x === "--delete" || (x.startsWith("-") && x.includes("d"))); return posArgs(e).slice(del ? 1 : 2); },
  grep: grepPaths, egrep: grepPaths, fgrep: grepPaths,
  tac: optionAware({ booleanShort: "br", valuedShort: "s", booleanLong: new Set(["--before", "--regex"]), valuedLong: new Set(["--separator"]) }),
  rev: posArgs,
  fold: optionAware({ booleanShort: "bs", valuedShort: "w", booleanLong: new Set(["--bytes", "--spaces"]), valuedLong: new Set(["--width"]) }),
  expand: optionAware({ booleanShort: "i", valuedShort: "t", booleanLong: new Set(["--initial"]), valuedLong: new Set(["--tabs"]) }),
  unexpand: optionAware({ booleanShort: "af", valuedShort: "t", booleanLong: new Set(["--all", "--first-only"]), valuedLong: new Set(["--tabs"]) }),
  fmt: optionAware({ booleanShort: "csumn", valuedShort: "wgdl", booleanLong: new Set(["--crown-margin", "--split-only", "--tagged-paragraph", "--uniform-spacing"]), valuedLong: new Set(["--width", "--goal", "--prefix"]) }),
  comm: optionAware({ booleanShort: "123iz", valuedShort: "", booleanLong: new Set(["--check-order", "--nocheck-order", "--total", "--zero-terminated"]), valuedLong: new Set(["--output-delimiter"]) }),
  cmp: optionAware({ booleanShort: "blsvxzh", valuedShort: "", booleanLong: new Set(["--print-bytes", "--verbose", "--quiet", "--silent"]), valuedLong: new Set(["--ignore-initial", "--bytes"]) }),
  pr: optionAware({ booleanShort: "acdFfJmprtTv", attachedShort: "einsS", valuedShort: "hlwWoND", booleanLong: new Set(["--across", "--show-control-chars", "--double-space", "--form-feed", "--join-lines", "--merge", "--no-file-warnings", "--omit-header", "--omit-pagination", "--show-nonprinting"]), attachedLong: new Set(["--expand-tabs", "--output-tabs", "--number-lines", "--separator", "--sep-string"]), valuedLong: new Set(["--header", "--length", "--width", "--page-width", "--indent", "--first-line-number", "--date-format", "--columns"]) }),
  numfmt: optionAware({ booleanShort: "z", valuedShort: "d", booleanLong: new Set(["--grouping", "--zero-terminated", "--debug"]), attachedLong: new Set(["--header"]), valuedLong: new Set(["--from", "--to", "--from-unit", "--to-unit", "--format", "--padding", "--delimiter", "--field", "--round", "--suffix", "--invalid"]) }),
  tsort: posArgs,
  man: (e) => {
    const local = e.some((r) => r === "--local-file" || (/^-[^-]/.test(r) && r.includes("l")));
    return e.flatMap((r, k) => {
      if (k > 0 && (e[k - 1] === "-C" || e[k - 1] === "--config-file")) return [r];
      const at = r.search(/[\\/~]/);
      const parts = !r.startsWith("-") ? [r] : [...(r.includes("=") ? [r.slice(r.indexOf("=") + 1)] : []), ...(r.length > 2 && !r.startsWith("--") ? [r.slice(2)] : []), ...(at > 0 ? [r.slice(at)] : [])];
      return parts.filter((x) => x !== "" && (local || /[\\/]/.test(x) || x.startsWith("~") || x.startsWith(".")));
    });
  },
  rg: (e) => patternPaths(e, new Set(["-e", "--regexp", "-f", "--file", "-t", "--type", "-T", "--type-not", "-g", "--glob", "-m", "--max-count", "--max-depth", "-r", "--replace", "-A", "--after-context", "-B", "--before-context", "-C", "--context"]), ["."]),
  sed: (e) => {
    const out = [];
    let skip = false, script = false, dd = false, started = false;
    for (let k = 0; k < e.length; k++) {
      if (skip) { skip = false; continue; }
      const w = e[k];
      if (!w) continue;
      if (!dd && !started && w === "--") { dd = true; continue; }
      if (!dd && !started && w !== "-" && w.startsWith("-")) {
        if (["-f", "--file"].includes(w)) { const v = e[k + 1]; if (v) out.push(v); skip = true; script = true; }
        else if (["-e", "--expression"].includes(w)) { skip = true; script = true; }
        else if (w.includes("e") || w.includes("f")) script = true;
        continue;
      }
      started = true;
      if (!script) { script = true; continue; }
      out.push(w);
    }
    return out;
  },
  jq: (e) => {
    const out = [], valued = new Set(["-e", "--expression", "--arg", "--argjson", "--args", "--jsonargs", "-L", "--library-path", "--indent", "--tab"]);
    let filter = false, dd = false;
    for (let k = 0; k < e.length; k++) {
      const w = e[k];
      if (w === undefined || w === null) continue;
      if (!dd && w === "--") { dd = true; continue; }
      if (!dd && w.startsWith("-")) {
        const q = w.indexOf("="), name = q >= 0 ? w.slice(0, q) : w;
        if (["-e", "--expression"].includes(name)) filter = true;
        if (["-f", "--from-file"].includes(name)) { filter = true; if (q >= 0) out.push(w.slice(q + 1)); else { const v = e[k + 1]; if (v !== undefined) { out.push(v); k++; } } continue; }
        if (["--slurpfile", "--rawfile"].includes(name)) { const v = e[k + 2]; if (v !== undefined) out.push(v); k += 2; continue; }
        if (valued.has(name) && q < 0) k++;
        continue;
      }
      if (!filter) { filter = true; continue; }
      out.push(w);
    }
    return out;
  },
  // (git: its -C and --work-tree folders, git grep's files, and git diff's paths after -- or plainly paths: from 2.1.321's
  // rule, whose own option reader is not readable in its build; a branch such as origin/main is never taken for a path.)
  git: (e) => {
    let base = "", k = 0;
    while (k < e.length && e[k].startsWith("-")) {
      const w = e[k];
      if (w === "-C" || w === "--work-tree" || w === "--git-dir" || w === "-c" || w === "--namespace") { if ((w === "-C" || w === "--work-tree") && e[k + 1] !== undefined) base = base && !e[k + 1].startsWith("/") && !e[k + 1].startsWith("~") ? base.replace(/\/+$/, "") + "/" + e[k + 1] : e[k + 1]; k += 2; continue; }
      if (w.startsWith("--work-tree=")) base = w.slice(12);
      k++;
    }
    const at = (x) => (base === "" || x.startsWith("/") || x.startsWith("~") ? x : base.replace(/\/+$/, "") + "/" + x);
    const sub = e[k], rest = e.slice(k + 1);
    const out = base ? [base] : [];
    if (sub === "grep") { const g = patternPaths(rest, new Set(["-e", "--regexp", "-f", "--file", "-A", "--after-context", "-B", "--before-context", "-C", "--context", "-m", "--max-count", "--max-depth", "--threads"])); return [...out, ...(g.length ? g.map(at) : [])]; }
    if (sub !== "diff") return out;
    let dd = false;
    for (const x of rest) { if (!dd && x === "--") { dd = true; continue; } if (dd || x.startsWith("/") || x.startsWith("~") || x.startsWith("../")) out.push(at(x)); }
    return out;
  },
};
/** Programs that run code given inline or from stdin, which the read block can't see into (2.1.321: "runs inline code, which cannot be checked against the read block"; "runs code from stdin"). */
const CODE_RUNNERS = new Set(["python", "python3", "python2", "node", "ruby", "perl", "php", "lua", "Rscript", "tsx", "ts-node", "deno", "bun"]);
// THE READ BLOCK'S OWN WORDS (the owner, 2026-11-10: "ok do that": Claude Code's exactly), from Claude Code 2.1.322 run with
// permissions.blockReadsOutsideWorkingDirectories on (its nF, Q3 and dw), with Coder's name for the setting; Coder has no
// /add-dir, so only the setting is named.
export const RB_SETTING = "CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES";
export const RB_OUTSIDE = "Reads outside the working directories are blocked (" + RB_SETTING + "). Remove that setting to allow them.";
/** A command the parser can't trace (Claude Code's Q3: its reason, then "; under the read block (…) a command the shell parser cannot analyze asks the person"). */
export const rbUnsure = (why) => why + "; under the read block (" + RB_SETTING + ") a command the shell parser cannot analyze asks the person";
export const RB_SED = "This sed script is not on the allowlist and can read or write any file, which cannot be checked against the read block (" + RB_SETTING + ")";
/**
 * WHY THE READ BLOCK ASKS ABOUT A COMMAND, or "" (in every mode; the owner's Yes runs it). `ctx`: `{ cwd, workdirs, home,
 * real, ownDirs }` (`real` follows a full path's links, "" when it can't; `ownDirs`: Coder's own folders a command may read,
 * such as a long output's file).
 */
export function readBlockWhy(command, { cwd = "/", workdirs = [], home = "", real = null, ownDirs = [] } = {}) {
  const read = readCommand(command, { cwd, home });
  if (!read.ok || read.dangling) return rbUnsure(PARSE_ERROR);
  const dirs = [...workdirs, ...ownDirs].filter((x) => typeof x === "string" && x);
  const realDirs = dirs.map((w) => { if (typeof real !== "function") return w; try { return real(w) || w; } catch { return w; } });
  // Inside means inside as written AND where its links lead (a link in the project to /etc is outside; with no resolver,
  // as on the Worker, the path as written).
  const inside = (p) => {
    if (!insideWork(p, dirs) && !insideWork(p, realDirs)) return false;
    if (typeof real !== "function") return true;
    let to = "";
    try { to = real(p) || ""; } catch { to = ""; }
    return !!to && (insideWork(to, dirs) || insideWork(to, realDirs));
  };
  // Traced? A cd more than once, or a part run in a subshell ($(…), ( … ), <( … )), can't be (Claude Code's own examples).
  const cds = read.cmds.filter((c) => { const w = unwrapped(c.words); const p = w[0] ? basename(w[0].text) : ""; return p === "cd" || p === "pushd" || p === "popd" || p === "chdir"; });
  if (cds.length > 1) return rbUnsure("multiple directory changes cannot be checked against the read block");
  if (read.cmds.some((c) => c.depth > 0 && !c.inScript)) return rbUnsure("a subshell cannot be checked against the read block");
  // An input redirection: a wildcard or a short path after a cd asks as in every mode (Claude Code checks those first);
  // one from outside is blocked.
  for (const x of read.reads) {
    if (x.glob || x.afterCd) return inputUnsureWhy(x.raw);
    if (x.expand || !x.path) return rbUnsure(VAR_UNCHECKED);
    if (!inside(x.path)) return RB_OUTSIDE;
  }
  for (const c of read.cmds) {
    const words = unwrapped(c.words);
    if (!words.length) continue;
    const prog = basename(words[0].text), args = words.slice(1);
    // A program given code inline, or code on stdin (piped in, a here-document or here-string, or `-`).
    if (CODE_RUNNERS.has(prog)) {
      let k = 0;
      while (k < args.length && args[k].text.startsWith("-") && args[k].text !== "-") { if (INLINE_CODE.has(args[k].text) || /^--(eval|print)=/.test(args[k].text)) return rbUnsure(prog + " runs inline code, which cannot be checked against the read block"); k++; }
      if (args.some((a) => a.text === "-")) return rbUnsure(prog + " runs code from stdin, which cannot be checked against the read block");
      const fed = c.afterPipe || (c.redirects || []).some((x) => x.heredoc || x.op === "<<<");
      if (k >= args.length && fed) return rbUnsure("code on stdin cannot be checked against the read block");
      continue;
    }
    const rule = READ_PATHS[prog];
    if (!rule) continue;
    // (A setting in front that is not a safe one: Claude Code, "an environment variable prefix outside the safe list cannot
    // be checked against the read block".)
    if (readWords(c.words) === null) return rbUnsure("an environment variable prefix outside the safe list cannot be checked against the read block");
    if (prog === "sed" && !sedScriptsSafe(args.map((x) => x.text))) return RB_SED;
    const dir = c.dir === undefined ? cwd : c.dir;
    for (const p of rule(args.map((x) => x.text))) {
      if (p === "-" || NOT_FILES.has(p)) { if (prog === "cd" && p === "-") return rbUnsure(VAR_UNCHECKED); continue; }
      const word = args.find((x) => x.text === p) || args.find((x) => x.text.endsWith(p)) || {};
      if (word.expand || word.subst) return rbUnsure(VAR_UNCHECKED);
      // A wildcard: checked by the folder before it (Claude Code: `cat /etc/*.conf` is a read outside), unless a `..` follows it.
      const g = word.glob ? p.search(/[*?[]/) : -1;
      if (g >= 0 && /(^|\/)\.\.(\/|$)/.test(p.slice(g))) return globDotDotWhy(p, " against the read block (" + RB_SETTING + ")");
      const base = g >= 0 ? (p.slice(0, g).replace(/\/[^/]*$/, "") || (p.startsWith("/") ? "/" : ".")) : p;
      const full = base.startsWith("/") ? normalPath(base) : base === "~" || base.startsWith("~/") ? (home ? normalPath(home + base.slice(1)) : "") : dir === false ? "" : normalPath(dir + "/" + base);
      if (!full) return rbUnsure(VAR_UNCHECKED);
      if (!inside(full)) return RB_OUTSIDE;
    }
  }
  return "";
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
