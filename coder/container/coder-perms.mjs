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
import { psRuleMatches, psExactRule, psAllParts } from "./coder-ps.mjs";
import { psParseFail, psCommands, psRedirections, psFileRedirections, psPatterns, psCmdlet, psSafetyWhy, psProviderWhy, psDynamicArgs, psWritesState, psCommandReadOnly, psPathArgs, psRecurse, psRemovalDenied, psRemovalWorkdir, psNameType, PS_FORMATTERS } from "./coder-psparse.mjs";
import { parseShell, unwrapped, unwrapSteps, progName, leadWords, basename, wrapperDirs, processWrappers } from "./coder-shell.mjs";
import { FILE_RULE_TOOLS, TOOL_RULE_NAMES, fileRuleHit, folderReadAllowed, readRuleFor } from "./coder-filerules.mjs";
import { docSite, pickDomainRule, domainRuleMatches, webFetchRuleProblem } from "./coder-webfetch-sites.mjs";
export { fileRuleHit, readRuleFor } from "./coder-filerules.mjs";
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
 * COMMANDS THAT RUN THEIR WORDS AS CODE, AND THE OTHER ONES ONLY AN EXACT RULE APPROVES (Bash docs pass 9; Claude Code
 * 2.1.322's own check of each command, its `gNe`: "'eval' evaluates arguments as shell code", awk with system() or a pipe,
 * jq with system() or -f, a process's environ file in /proc): Claude Code asks for them whatever prefix rule matches, so `Bash(eval *)` or
 * `Bash(source *)` approve nothing. Its reason, or "".
 */
const EVAL_LIKE = new Set(["eval", "source", ".", "exec", "nocorrect", "fc", "coproc", "trap", "enable", "mapfile", "readarray", "hash", "bind", "complete", "compgen", "alias", "let"]);
/** Claude Code's zsh builtins that "can bypass security checks" (its ZSH_DANGEROUS_BUILTINS, 2.1.322; Bash docs pass 9). */
export const ZSH_DANGEROUS = new Set(["zmodload", "emulate", "sysopen", "sysread", "syswrite", "sysseek", "zpty", "ztcp", "zsocket", "zf_rm", "zf_mv", "zf_ln", "zf_chmod", "zf_chown", "zf_mkdir", "zf_rmdir", "zf_chgrp", "repeat", "foreach", "zcompile", "setopt", "unsetopt", "disable", "shopt", "autoload", "functions", "zformat", "zparseopts", "zstyle", "zregexparse", "getln", "vared", "strftime", "pcre_match", "zstat", "zselect", "zgetattr", "zlistattr", "ztie", "zuntie", "syserror", "zsystem", "zftp", "zcurses"]);
/** Claude Code's words for a cd given two folders (zsh's `cd OLD NEW`). */
export const CD_TWO_WHY = "cd with two or more directory arguments requires manual approval. zsh's \"cd OLD NEW\" form substitutes OLD\u2192NEW in $PWD, producing a target path that cannot be statically validated.";
const AWKS = new Set(["awk", "gawk", "mawk", "nawk"]);
function awkProgramWhy(e) {
  if (/(?<![A-Za-z_])system[\s\\]*\(/.test(e)) return "awk program contains system() which executes arbitrary commands";
  if (/(?:^|[^|])\|&?[^/|%";#{}]*"/.test(e) || /(?:^|[^|])\|&?[\s\\]*getline\b/.test(e)) return 'awk program contains a command pipe (| "cmd" or | getline) which executes arbitrary commands';
  if (/@[\s\\]*(?:load|include)\b|@[\s\\]*\w+(?:::\w+)?(?:\[[^\]]*\])*[\s\\]*\(/.test(e)) return "awk program contains @load/@include or an @indirect call which can execute arbitrary code";
  if (/(?<![A-Za-z_])extension[\s\\]*\(/.test(e)) return "awk program contains extension() which loads arbitrary native code (legacy gawk)";
  if (/"\/inet[46]?\//.test(e)) return "awk program opens a gawk /inet/ network socket which can exfiltrate data";
  return "";
}
export function semanticWhy(c) {
  let w = readWords(c.words, { wrappers: true }) || leadWords(c.words);
  // (env with settings or -i, -0, -v and -u NAME in front, as Claude Code's loop takes it away.)
  if (w[0] && w[0].text === "env" && !w[0].quoted) { let k = 1; while (k < w.length && ((w[k].text.includes("=") && !w[k].text.startsWith("-")) || ["-i", "-0", "-v"].includes(w[k].text) || (w[k].text === "-u" && w[k + 1] && k++))) k++; if (k < w.length) w = w.slice(k); }
  if (!w[0]) return "";
  const n = basename(w[0].text), args = w.slice(1).map((x) => x.text);
  if (n === "find") { const act = args.find((x) => FIND_ACTS.has(x)); if (act) return findActionWhy(act); }
  if (ZSH_DANGEROUS.has(n)) return "Zsh builtin '" + n + "' can bypass security checks";
  if (EVAL_LIKE.has(n) && !(n === "fc" && !args.some((x) => /^[+-].*[es]/.test(x))) && !(n === "compgen" && !args.some((x) => /^[+-].*[CFW]/.test(x)))) return "'" + n + "' evaluates arguments as shell code";
  if (EXACT_RULE_WRAPPERS.has(n) && args.length) return wrapperWhy(n);
  if (n === "jq") {
    for (const a of args) { if (/\bsystem\s*\(/.test(a)) return "jq command contains system() function which executes arbitrary commands"; if (/\b(?:include|import)\b/.test(a)) return 'jq command contains include/import \u2014 modules can load arbitrary .jq files via {search:"."} and call env or other builtins'; }
    if (args.some((a) => /^(?:-[A-Za-z]*[fL]|--(?:from-file|rawfile|slurpfile|library-path)(?:$|=))/.test(a))) return "jq command contains dangerous flags that could execute code or read arbitrary files";
  }
  if (AWKS.has(n)) {
    if (w.slice(1).some((x) => x.glob && !x.quoted)) return "awk command contains unquoted glob characters \u2014 could glob-expand to a planted program or flag before awk runs";
    for (const x of w.slice(1)) { const why = awkProgramWhy(x.text); if (why) return why; if (x.expand || x.subst) return "awk is given text that can't be checked before it runs"; }
    if (args.some((a) => /^-[bcCghIkMnNOPrsStV]*[fEileDW]/.test(a) || /^--(?:fil|e|i|lo|s|de)/.test(a))) return "awk has an option that can't be checked before it runs";
  }
  if ([...(c.words || []).map((x) => x.text), ...(c.redirects || []).filter((x) => x.target).map((x) => x.target.text)].some((x) => /\/proc\/.*environ/.test(String(x)))) return "Accesses /proc/*/environ which may expose secrets";
  return "";
}
/** Claude Code's words when a compound command with a cd writes (its JJo and RZt: where the write lands can't be known). */
export const CD_WRITE_WHY = "Commands that change directories and perform write operations require explicit approval to ensure paths are evaluated correctly. For security, Coder cannot automatically determine the final working directory when 'cd' is used in compound commands.";
export const CD_REDIRECT_WHY = "Commands that change directories and write via output redirection require explicit approval to ensure paths are evaluated correctly. For security, Coder cannot automatically determine the final working directory when 'cd' is used in compound commands.";
/** A path written ~user, ~+ or ~- (Claude Code's TU: "Tilde expansion variants (~user, ~+, ~-) in paths require manual approval"). */
export const TILDE_WHY = "Tilde expansion variants (~user, ~+, ~-) in paths require manual approval";
/** A word that sets a variable for the command after it (`A=1`, `A[0]=1`, `A+=x`). */
const ASSIGN_LEAD = /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/;
/** Claude Code's words for a relative read after a cd while a Read deny rule exists (its JJo, "cd-compound-read"). */
export const cdReadWhy = (prog) => prog + " reads a file by a relative path after a cd in a compound command; which file that is cannot be resolved statically while a Read() deny rule is configured, so this needs approval.";
/** A command that puts part of itself in the background with `&` (Claude Code 2.1.322's safety check). */
export const BG_OP_WHY = "This command uses the `&` background operator, which defers execution past approval-time safety checks. Approve only if you trust it.";
/** A write inside the working folders in Claude Code's "default" mode (Coder's cloud Accept edits): its `_en`. */
export const inWhy = (what, path, dirs) => what + " '" + path + "' needs approval. The path is inside the working directories for this session (" + dirsText(dirs) + "), and Coder asks before a shell command creates, changes or removes files there.";
/** A write command's target worked out only when it runs (Claude Code's JJo). */
export const runtimeTargetWhy = (cmd) => cmd + " target contains command-substitution or untracked-variable output \u2014 the path is runtime-determined and cannot be validated";
/** A word written ~name, ~+ or ~- (bash: another user's home, $PWD, $OLDPWD), not ~ or ~/…: Claude Code can't place it. */
const tildeOther = (x) => !!x && !!x.tilde && x.text !== "~" && !String(x.text).startsWith("~/");
/**
 * WHERE ONE cd GOES, as Claude Code's u8e works it out (Bash docs pass 9): a full path, or "" when it can't be known before it
 * runs: `cd -` with no earlier cd in the command (bash goes to $OLDPWD, which Coder read as a folder named "-"), `cd +1`, an
 * option other than -P, -L, -e or -@, ~user, a variable or a wildcard. `cd` alone goes home.
 */
function cdTarget(w, from, prev, home) {
  const args = w.slice(1);
  const ops = args.filter((x) => x.text !== "--" && (x.text === "-" || !x.text.startsWith("-")));
  if (args.some((x) => x.text !== "--" && x.text !== "-" && x.text.startsWith("-") && !/^-[PLe@]+$/.test(x.text))) return "";
  const t = ops.length === 1 ? ops[0] : ops.length === 0 ? { text: "~", raw: "~", tilde: true } : null;
  if (!t) return "";
  if (t.text === "-") return prev || "";
  if (/^[+-]\d+$/.test(t.text) || t.expand || t.subst || t.glob) return "";
  if (t.tilde) return (t.text === "~" || t.text.startsWith("~/")) && home ? normalPath(home + t.text.slice(1)) : "";
  return fullPath(t, from);
}
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
/**
 * A command's words past safe `NAME=value` settings in front (null when one is not safe), and past a plain `timeout N`. Safe:
 * Claude Code 2.1.322's own list and check, the read block's (rbEnvSafe; Bash docs pass 8: before, Coder's own list let DEBUG,
 * VERBOSE and every LC_ through and asked for GOOS, CGO_ENABLED, DEBIAN_FRONTEND and GIT_TERMINAL_PROMPT): a listed name, a
 * value that is no path, a locale for LANG, LC_ALL and LC_CTYPE; never one added to (`+=`) or worked out when it runs.
 */
export function readWords(words, { wrappers = false } = {}) {
  let k = 0;
  while (k < words.length && /^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(words[k].raw) && !words[k].raw.startsWith("=")) {
    const t = String(words[k].text), eq = t.indexOf("=");
    if (words[k].expand || words[k].subst || eq < 1 || t[eq - 1] === "+" || !rbEnvSafe(t.slice(0, eq), t.slice(eq + 1))) return null;
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
    // (`%n` writes a count into memory: only a real `%…n` conversion, its flags, width, precision and length between; Bash
    // docs pass 9: `%[^%]*n` also caught the `n` of `\n` in `printf '%s\n' hi`, which Claude Code runs.)
    return !/\\[0-7xXuU]|%[-+ #0'I]*(?:\d+|\*)?(?:\.(?:\d*|\*))?(?:hh|h|ll|l|L|q|j|z|Z|t)?n/.test(f) && !args.some((x) => x.includes("`"));
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
  // (cp and mv named by a path, /bin/cp, are cp and mv: Claude Code 2.1.321, "Changed cp and mv spelled by a path, such as
  // /bin/cp, to get the same path checks as cp and mv".)
  const prog = ["cp", "mv"].includes(progName(w[0].text)) ? progName(w[0].text) : w[0].text;
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
  let sure = true, operands = false, scriptTaken = prog !== "sed", intoDir = "";
  const ops = [];
  for (let i = 0; i < rest.length; i++) {
    const x = rest[i], t = x.text;
    if (!operands && t === "--") { operands = true; continue; }
    if (!operands && t.startsWith("-") && t.length > 1) {
      if (prog === "sed" && (/^-[nErsuz]*i\S*$/.test(t) || /^--in-place(=.*)?$/.test(t))) continue;
      const eq = t.indexOf("="), name = eq > 0 ? t.slice(0, eq) : t;
      if (opt.value.has(name)) {
        const v = eq > 0 ? { ...x, text: t.slice(eq + 1) } : rest[++i];
        if (prog === "sed" && (name === "-e" || name === "--expression")) { scriptTaken = true; continue; }
        if (name === "-t" || name === "--target-directory") { const p = fullPath(v, cwd); if (p) { paths.push(p); intoDir = p; } else sure = false; }
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
      if (p) { paths.push(p + "/*"); ops.push({ path: p + "/*", glob: true, name: "" }); } else sure = false;
      continue;
    }
    const p = fullPath(x, cwd);
    if (p) { paths.push(p); ops.push({ path: p, glob: false, name: x.text.replace(/\/+$/, "").split("/").pop(), text: x.text }); } else sure = false;
  }
  // THE FILE A cp OR mv INTO A FOLDER WRITES (Claude Code 2.1.321: "Fixed deny rules and protected-file prompts not applying
  // to the file that a cp or mv into a directory writes"): the folder (-t, or the last name) and, in it, each source's
  // name (anything in it for a wildcard source). The last name may be a file or a folder: both are checked.
  const maybe = [];
  if ((prog === "cp" || prog === "mv") && ops.length) {
    const last = ops[ops.length - 1];
    const dest = intoDir || (ops.length > 1 ? last.path : "");
    const sources = intoDir ? ops : ops.slice(0, -1);
    // (A folder for sure: -t, two sources or more, or a name ending in / or being . or ..; one that may be either: the
    // files in it count for the owner's rules only, `maybe`.)
    const clear = !!intoDir || sources.length > 1 || /\/$/.test(String(last.text || "")) || last.name === "." || last.name === "..";
    if (dest && !dest.endsWith("/*")) {
      // (Into a folder for sure: the files it writes there stand for it.)
      if (clear) { const di = paths.indexOf(dest); if (di >= 0) paths.splice(di, 1); }
      for (const src of sources) { const q = src.glob || !src.name || src.name === "." || src.name === ".." ? dest.replace(/\/+$/, "") + "/*" : dest.replace(/\/+$/, "") + "/" + src.name; if (!paths.includes(q) && !maybe.includes(q)) (clear ? paths : maybe).push(q); }
    }
  }
  if (!paths.length) sure = false;
  return maybe.length ? { paths, sure, maybe } : { paths, sure };
}

// ── THE WHOLE COMMAND ────────────────────────────────────────────────────────
/**
 * A COMMAND THAT ONLY READS, AS A WHOLE (for the files a command changed: Claude Code, "Background commands and read-only
 * commands carry no diff"): it could be read through, writes no file by a redirection or tee, and each of its commands only
 * reads.
 */
export function wholeReadOnly(command) {
  const r = readCommand(command);
  // (Never one too complex to check, nor one that sends part of itself to the background: Bash docs pass 9.)
  return r.ok && !r.complex.length && !r.background && !r.writes.length && r.cmds.length > 0 && r.cmds.every((c) => commandReadOnly(c) && !gitAfterCd(r, c) && !semanticWhy(c));
}
// (git after a cd that went elsewhere, in brackets too, is no read-only command: Claude Code asks, 2.1.309.)
const gitAfterCd = (r, c) => { const w = readWords(c.words) || []; return !!w[0] && basename(w[0].text) === "git" && (r.cdAway || c.dir !== "/"); };
/**
 * EVERY PART ALLOWED BY A RULE OR READ-ONLY (Bash docs pass 8; Claude Code 2.1.322: "All pipeline commands are individually
 * allowed, some only by the read-only allowlist", so no auto mode check): `rules` the allow rules auto mode keeps. A
 * command that writes a file by a redirection or tee needs every part allowed by a rule (a rule allows the command, and
 * the redirection is the command's).
 */
export function partsAllowedOrReadOnly(command, rules, ctx = null) {
  const r = readCommand(command);
  if (!r.ok || !r.cmds.length || r.complex.length || r.background) return false;
  // (With where it runs: every path check Claude Code makes before its rules, so a rule never covers a path outside the
  // project, a ~user, a write after a cd, eval or a `&`: Bash docs pass 9. A command's write inside the project is judged
  // as in Claude Code's "default", as its path check lets one through only in acceptEdits (`n.mode==="acceptEdits"`), so
  // `ls > out.txt` still needs the checker in Auto.)
  if (ctx) return bashDecision(command, { ...ctx, mode: "acceptEdits", byCommand: false, rules: { allow: (rules && rules.allow) || [], ask: [], deny: [] } }).verdict === "allow";
  const byRule = (c) => allowRuleCovers(c, rules);
  if (r.writes.length) return r.cmds.every(byRule);
  return r.cmds.every((c) => byRule(c) || (commandReadOnly(c) && !gitAfterCd(r, c)));
}
/**
 * EVERY PART APPROVED BY THE OWNER'S ALLOW RULES ALONE (the owner, 2026-11-13: "yea do those 2 things"). Claude Code's cloud
 * sessions, where auto mode's review runs on its server: "read-only and sandboxed shell commands wait for that review and are
 * blocked if it flags them". In 2.1.323 (its Puo, for Bash, PowerShell and Monitor) an allowed command is held for the review
 * ("Auto mode held this command for the server-side classifier to review") when any part of it was allowed only by the
 * read-only allowlist, "All pipeline commands are individually allowed, some only by the read-only allowlist" included; one
 * the rules approve in full, or an exact rule for the whole command, is not. With `ctx`, the same path checks as
 * partsAllowedOrReadOnly's.
 */
export function partsAllowedByRules(command, rules, ctx = null) {
  const r = readCommand(command);
  if (!r.ok || !r.cmds.length || r.complex.length || r.background) return false;
  const whole = String(command ?? "").trim().replace(/[ \t]+/g, " ");
  const exact = rulesFor(rules && rules.allow, "Bash").some((x) => typeof x.spec === "string" && !x.spec.includes("*") && x.spec.replace(/[ \t]+/g, " ").trim() === whole);
  if (!exact && !r.cmds.every((c) => allowRuleCovers(c, rules))) return false;
  return partsAllowedOrReadOnly(command, rules, ctx);
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

/**
 * A COMMAND THAT CAN DISCARD UNCOMMITTED WORK (Bash docs pass 8; Claude Code "runs `git status` itself before a command that
 * would discard uncommitted work, such as `git reset --hard` or `rm -rf`, and shows the classifier whether staged, modified, or
 * untracked work is present"; its list: "git reset --hard, git checkout -- ., git restore ., git clean -fd, git stash drop, or
 * git stash clear"): anywhere in it (after sudo, time and the rest; git's own options such as -C skipped).
 */
export function discardsWork(command) {
  const text = String(command || "");
  const r = parseShell(text);
  if (!r.ok) return /\bgit\b[^\n;&|]*\b(reset\s+[^\n;&|]*--hard|checkout\s+(--|\.)|restore\b|clean\s+[^\n;&|]*-[a-z]*f|stash\s+(drop|clear))|\brm\s+[^\n;&|]*(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)/i.test(text);
  return r.commands.some((c) => {
    const w = unwrapped(c.words).map((x) => x.text);
    const prog = basename(w[0] || "");
    if (prog === "rm") {
      const flags = w.slice(1).filter((x) => x.startsWith("-") && x !== "-" && x !== "--");
      const short = flags.filter((x) => !x.startsWith("--")).join("");
      return (/[rR]/.test(short) || flags.includes("--recursive")) && (/f/.test(short) || flags.includes("--force"));
    }
    if (prog !== "git") return false;
    let k = 1;
    while (k < w.length && w[k].startsWith("-") && w[k] !== "--") { if (GIT_TAKES_VALUE.has(w[k])) k++; k++; }
    const sub = w[k] || "", rest = w.slice(k + 1);
    if (sub === "reset") return rest.includes("--hard");
    if (sub === "checkout") return rest.includes("--") || rest.includes(".") || rest.includes("-f") || rest.includes("--force");
    if (sub === "restore") return !(rest.includes("--staged") || rest.includes("-S")) || rest.includes("--worktree") || rest.includes("-W");
    if (sub === "clean") return rest.some((x) => /^-[a-zA-Z]*f/.test(x) || x === "--force");
    if (sub === "stash") return rest[0] === "drop" || rest[0] === "clear";
    return false;
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
// A variable's value put into a word (readCommand's `vars`): every $NAME and ${NAME} in it known, none other, no single quote.
const VAR_REF = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;
function varWord(w, known, unknown) {
  const raw = String((w && w.raw) || "");
  if (!raw.includes("$") || raw.includes("'") || /\$\(|`/.test(raw)) return w;
  let ok = true;
  const out = raw.replace(VAR_REF, (m, a, b) => { const n = a || b; if (!known.has(n) || unknown.has(n)) { ok = false; return m; } return known.get(n); });
  if (!ok || out.includes("$")) return w;
  const text = out.replace(/\\(.)/g, "$1").replace(/"/g, "");
  return { ...w, text, expand: false, subst: false, quoted: true, bare: false };
}
// The variables a top-level part sets (readCommand's `vars`).
const DECLARES = new Set(["export", "declare", "typeset", "readonly", "local"]);
function noteVars(c, known, unknown) {
  const w = c.words;
  const set = (word) => {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)(\+?)=([\s\S]*)$/.exec(String(word.text || ""));
    if (!m) return;
    const literal = !word.subst && !/\$|`/.test(m[3]) && !(word.expand && !word.quoted && /\$/.test(String(word.raw || "")));
    if (!literal || unknown.has(m[1])) { known.delete(m[1]); unknown.add(m[1]); return; }
    known.set(m[1], m[2] && known.has(m[1]) ? known.get(m[1]) + m[3] : m[2] ? null : m[3]);
    if (known.get(m[1]) === null) { known.delete(m[1]); unknown.add(m[1]); }
  };
  if (w.length && w.every((x) => /^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(String(x.raw || "")))) { for (const x of w) set(x); return; }
  const words = unwrapped(w);
  const prog = words[0] ? basename(words[0].text) : "";
  const names = (from) => words.slice(from).filter((x) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(x.text)).map((x) => x.text);
  const lose = (list) => { for (const n of list) { known.delete(n); unknown.add(n); } };
  if (DECLARES.has(prog)) {
    const opts = words.slice(1).filter((x) => /^[-+][A-Za-z]+$/.test(x.text)).map((x) => x.text).join("");
    if (/[nNaA]/.test(opts)) { lose(words.slice(1).map((x) => String(x.text).split("=")[0]).filter((n) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n))); return; }
    // (A value set in front of it, `X=rm export X`: bash keeps it for a declaring builtin; Claude Code 2.1.290, "a variable
    // set as a prefix on declare, typeset, export or readonly". Bash docs pass 9.)
    const before = new Map();
    for (const x of w) { const m = /^([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/.exec(String(x.text || "")); if (!m) break; before.set(m[1], x); }
    for (const x of words.slice(1)) {
      if (/^[-+]/.test(x.text)) continue;
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(x.text) && before.has(x.text)) set(before.get(x.text));
      else set(x);
    }
    return;
  }
  if (prog === "unset") { for (const n of names(1)) { known.delete(n); unknown.delete(n); } return; }
  if (prog === "read" || prog === "mapfile" || prog === "readarray" || prog === "getopts" || prog === "printf") lose(names(1));
}
export function readCommand(command, { cwd = "/", home = "" , vars = false } = {}) {
  const r = parseShell(String(command || ""));
  const writes = [], reads = [];
  let dir = cwd, cdAway = false, unsureDir = false, cdSeen = false, prevDir = "";
  // THE FOLDER IN EACH BRACKET GROUP (a subshell, a $(…), a `…`, a <(…)), for deny and ask rules (`vars`): where it started,
  // then its own cds (Claude Code 2.1.309: "Fixed an Edit(path) deny rule not blocking a Bash redirect to that path in some
  // commands that also held a subshell"; `(cd src && echo x > ../.env)` writes .env). The other reading keeps such a folder
  // unknown, so a short path there asks in Claude Code's words (CD367).
  const groupDir = new Map();
  const dirFor = (c) => { if (!vars) return unsureDir ? false : dir; let d = unsureDir ? false : dir; for (const g of c.groups || []) { if (!groupDir.has(g)) groupDir.set(g, d); d = groupDir.get(g); } return d; };
  // THE VARIABLES THE COMMAND SETS BEFORE A PART (`vars`, for deny and ask rules only; Claude Code 2.1.290, 2.1.309): a
  // plain value set at the top level (NAME=value, or after export, declare, typeset, readonly or local) is put in where
  // a later part names it ($NAME, ${NAME}), so `F=.env; cat $F` meets a rule on .env and `C=curl; $C x` one on curl. A
  // name a loop, read, mapfile, getopts or printf -v sets, or one set by a command's output, is left as written.
  const known = new Map(), unknown = new Set(vars ? r.loopVars || [] : []);
  const setsPwd = SETS_PWD.test(String(command || ""));
  const homeAt = home && typeof home === "string" && home.startsWith("/") && !SETS_HOME.test(String(command || "")) ? home : "";
  for (const c of r.commands) {
    if (homeAt) { c.words = c.words.map((x) => homeWord(x, homeAt)); for (const x of c.redirects) if (x.target) x.target = homeWord(x.target, homeAt); }
    // THE FOLDER THIS PART RUNS IN (Claude Code 2.1.321: "Fixed a case where Bash permission checks judged a file write from
    // the wrong folder and didn't prompt"): where the cds before it at the top level left it, or unknown (`false`) once a cd
    // could have gone anywhere, or ran inside a subshell, a function or a $(…) (its folder is then not the one tracked here).
    c.dir = dirFor(c);
    if (vars && known.size) { c.words = c.words.map((x) => varWord(x, known, unknown)); for (const x of c.redirects) if (x.target) x.target = varWord(x.target, known, unknown); }
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
      const path = c.dir === false && !t.text.startsWith("/") ? "" : fullPath(t, c.dir === false ? "/" : c.dir);
      // `glob`: an unquoted * ? or [ (Claude Code: an output target that "contains a glob character needs your approval",
      // an input one too); `afterCd`: an input target given as a short path after a cd in the same command (Claude Code:
      // "a relative path that follows a cd in the same command, needs your approval even when an allow rule covers it").
      // (`cmd`: the part it belongs to, for Claude Code's "The following parts require approval: …".)
      if (x.op === "<" || x.op === "<&") reads.push({ path, raw: t.raw, glob: !!t.glob, afterCd: cdSeen && !t.text.startsWith("/"), cmd: c, expand: !!(t.expand || t.subst), tildeUser: tildeOther(t) });
      else writes.push({ path, raw: t.raw, glob: !!t.glob, cmd: c, expand: !!(t.expand || t.subst), tildeUser: tildeOther(t) });
    }
    // (A wrapper that runs the command in another folder, `env -C DIR`: its own words count from there; its redirections
    // above stay where the shell is. One that can't be placed leaves the folder unknown.)
    const moves = wrapperDirs(c.words);
    if (moves.length) { let d = c.dir === undefined ? cwd : c.dir; for (const m of moves) { if (d === false || m === false) { d = false; break; } d = fullPath(m, d) || false; } c.dir = d; }
    if (prog === "tee") for (let k = 1; k < w.length; k++) { const t = w[k].text; if (t === "--" || (t.startsWith("-") && t.length > 1)) continue; writes.push({ via: "tee", cmd: c, tildeUser: tildeOther(w[k]), expand: !!(w[k].expand || w[k].subst), path: c.dir === false && !t.startsWith("/") ? "" : fullPath(w[k], c.dir === false ? "/" : c.dir), raw: w[k].raw, glob: !!w[k].glob }); }
    if (prog === "cd" || prog === "pushd" || prog === "popd" || prog === "chdir") cdSeen = true;
    const inGroup = !!(c.groups && c.groups.length);
    if ((prog === "cd" || prog === "pushd" || prog === "popd") && inGroup && vars) {
      // (A cd in brackets: that group's folder only.)
      const to = prog === "cd" && c.dir !== false ? cdTarget(w, c.dir, "", home) : "";
      groupDir.set(c.groups[c.groups.length - 1], !to ? false : to);
    } else if ((prog === "cd" || prog === "pushd" || prog === "popd") && c.top >= 0) {
      // (Claude Code's u8e: `cd -` goes back to where an earlier cd in this command left, or nowhere known.)
      const to = prog === "cd" ? cdTarget(w, unsureDir ? false : dir, unsureDir ? "" : prevDir, home) : "";
      if (!to) unsureDir = true; else { if (to !== dir) { prevDir = dir; dir = to; cdAway = true; } }
    } else if (prog === "cd" || prog === "pushd" || prog === "popd" || prog === "chdir") unsureDir = true;
    if (vars && c.top >= 0 && !inGroup) noteVars(c, known, unknown);
  }
  // `loopVars`: each loop's own variable (`for NAME in …`); `dangling`: an operator with nothing after it (coder-shell.mjs).
  // (`complex`: Claude Code's reasons a command is too complex to check, coder-shell.mjs; `background`: a `&` that sends
  // part of it to the background.)
  return { ok: r.ok, cmds: r.commands, writes, reads, cdAway, unsureDir, loopVars: r.loopVars || [], dangling: !!r.dangling, complex: r.complex || [], background: !!r.background };
}

// ── RULES ────────────────────────────────────────────────────────────────────
/**
 * GREP'S AND GLOB'S INPUTS A RULE MAY NAME (Claude Code 2.1.323's schemas; never `path`, their "primary content field"), and a
 * rule's content read as one (Claude Code: the name before the first colon, the value after it, "Whitespace around the colon
 * is ignored"), or null.
 */
export const SEARCH_RULE_PARAMS = Object.freeze({ Grep: ["pattern", "glob", "output_mode", "-B", "-A", "-C", "context", "-n", "-i", "-o", "type", "head_limit", "offset", "multiline"], Glob: ["pattern"] });
function searchParamSpec(tool, spec) {
  const k = String(spec).indexOf(":");
  if (k <= 0) return null;
  const name = spec.slice(0, k).trim(), value = spec.slice(k + 1).trim();
  return name && value && (SEARCH_RULE_PARAMS[tool] || []).includes(name) ? { name, value } : null;
}
/** A Grep or Glob rule on its own `path` (one that never matches: ruleKept, ruleWarning). */
const searchPathSpec = (tool, spec) => (tool === "Grep" || tool === "Glob") && /^\s*path\s*:/.test(String(spec || ""));
/**
 * A rule's parts (`Bash(npm test *)`, `Bash`, `WebFetch(domain:x.com)`, `Read(./.env)`, `Edit(src/**)`, `Write`); null when
 * Coder does not apply it. FILE RULES (Bash docs, the owner, 2026-11-10: "yea do all 4"; coder-filerules.mjs): `Read` and
 * `Edit` with a path pattern or on the whole tool; Coder's other file tools by Claude Code's names (`Write`, `Grep`, `Glob`,
 * `LSP`) on the whole tool only (Claude Code: "Leave bare tool-name rules such as Write or Glob alone. Claude Code matches
 * them at the tool level"; one with a path is kept and never matches: ruleKept).
 */
export function parseRule(text) {
  // (A tool name with a wildcard, `*`, `B*`, `mcp__*`: see toolGlob.)
  if (toolGlob(text)) return { tool: String(text).trim(), spec: null, glob: true };
  // A CONNECTOR'S TOOL BY ITS OWN NAME, mcp__<server>__<tool>, OR ALL OF ONE CONNECTOR'S, mcp__<server> (since the connectors
  // were merged, 2026-11-13; Claude Code's MCP rules: "mcp__puppeteer matches any tool provided by the puppeteer server",
  // "mcp__puppeteer__puppeteer_navigate matches the puppeteer_navigate tool"): on the whole tool only, as Claude Code's.
  if (/^mcp__[A-Za-z0-9_-]+$/.test(String(text || "").trim())) return { tool: String(text).trim(), spec: null, mcp: true };
  // (TaskCreate, TaskGet, TaskList and TaskUpdate: Coder's task list since 2026-11-14, the owner: "Do all the talk to you
  // tools execpt for the notify one"; whole-tool rules, as TodoWrite's. EnterPlanMode, Coder's enter_plan_mode, too.)
  const m = /^(Bash|WebFetch|Read|Edit|Write|Grep|Glob|LSP|Monitor|WebSearch|TaskStop|KillShell|KillBash|AskUserQuestion|ExitPlanMode|EnterPlanMode|TodoWrite|TaskCreate|TaskGet|TaskList|TaskUpdate|PowerShell)(?:\(([\s\S]*)\))?$/.exec(String(text || "").trim());
  if (!m) return null;
  // (TaskStop's old names, KillShell and KillBash, name it still: Claude Code 2.1.322 keeps them as its aliases.)
  if (m[1] === "KillShell" || m[1] === "KillBash") m[1] = "TaskStop";
  const spec = m[2] === undefined ? null : m[2].trim();
  // (WebFetch's: `domain:` and its host pattern, Claude Code's rule check; the owner, 2026-11-14.)
  if (m[1] === "WebFetch" && spec !== null && !/^domain:\S+$/.test(spec)) return null;
  if (spec === "" ) return null;
  // (A rule on the command itself, Bash(command:…) or PowerShell(command:…), is never one: see ruleProblem.)
  if ((m[1] === "Bash" || m[1] === "PowerShell") && spec !== null && settingSpec(spec) && settingSpec(spec).name === "command") return null;
  if (m[1] === "Read" || m[1] === "Edit") {
    // (`:*` is Bash's alone: ruleProblem says so; a rule on the path itself, Read(file_path:…), is kept and never matches.)
    if (spec !== null && (spec.includes(":*") || /^file_path\s*:/.test(spec))) return null;
    return { tool: m[1], spec: spec === "*" || spec === "**" ? null : spec };
  }
  // A RULE ON ONE OF GREP'S OR GLOB'S INPUTS (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"; Claude
  // Code's permissions docs, "Match by input parameter": "Deny and ask rules can match a top-level input parameter on any
  // built-in tool with Tool(param:value)"; "You can't match a tool's primary content field this way: … path for Grep and
  // Glob"): `Grep(output_mode:content)`, `Glob(pattern:*.env)`, used by deny and ask lists (fileToolDecision); `param` its
  // name and value.
  if ((m[1] === "Grep" || m[1] === "Glob") && spec !== null) { const pr = searchParamSpec(m[1], spec); if (pr) return { tool: m[1], spec, param: pr }; }
  // (Coder's other tools by Claude Code's names, WebSearch for Grok's own web search: rules on the whole tool only.)
  if (m[1] === "Write" || m[1] === "Grep" || m[1] === "Glob" || m[1] === "LSP" || m[1] === "WebSearch" || m[1] === "TaskStop" || m[1] === "AskUserQuestion" || m[1] === "ExitPlanMode" || m[1] === "EnterPlanMode" || m[1] === "TodoWrite" || m[1] === "TaskCreate" || m[1] === "TaskGet" || m[1] === "TaskList" || m[1] === "TaskUpdate") return spec === null || spec === "*" ? { tool: m[1], spec: null } : null;
  return { tool: m[1], spec: spec === "*" && (m[1] === "Bash" || m[1] === "Monitor" || m[1] === "PowerShell") ? null : spec };
}
/**
 * A RULE ON TOOL NAMES BY WILDCARD (Bash docs pass 6, the owner, 2026-11-10: "yea do all of them"; Claude Code's "Tool name
 * wildcards": "Deny and ask rules also accept glob patterns in the tool-name position. The pattern must match the full tool
 * name: "*" matches every tool, and "mcp__*" matches every MCP tool across all servers. A tool matched by a bare-name glob
 * deny rule is removed from Claude's context, the same as a bare tool name"; "Allow rules accept tool-name globs only after a
 * literal mcp__<server>__ prefix … An unanchored allow glob such as "*", "B*", or "mcp__*" is skipped and doesn't
 * auto-approve anything"): a bare name with a `*`, matched against Claude Code's name for each of Coder's tools (Bash,
 * Monitor, Read, Write, Edit, Grep, Glob, LSP, WebFetch, WebSearch, TaskStop, AskUserQuestion, ExitPlanMode, TodoWrite, TaskCreate,
 * TaskGet, TaskList, TaskUpdate; Coder's own tools by their own names). Since the connectors were merged (2026-11-13), an allow
 * one anchored on a connector, mcp__<server>__*, approves that connector's tools; other allow wildcards still approve nothing.
 */
export const toolGlob = (t) => /^[A-Za-z0-9_-]*\*[A-Za-z0-9_*-]*$/.test(String(t ?? "").trim());
/** Whether a tool-name wildcard matches a tool's whole name. */
export function toolGlobMatches(glob, name) {
  return new RegExp("^" + String(glob).trim().split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$").test(String(name ?? ""));
}
/** An allow rule's wildcard that names one MCP server's tools (`mcp__github__*`), the only kind Claude Code applies. */
const anchoredGlob = (t) => /^mcp__[A-Za-z0-9-]+(?:_[A-Za-z0-9-]+)*__/.test(String(t ?? "").trim());
/**
 * MONITOR'S RULES (Bash docs, the owner, 2026-11-10: "yea do all of them"; Claude Code: "When Monitor runs a command, it uses
 * the same permission rules as Bash", and a rule naming Monitor covers its calls; "While auto mode is active, Claude Code sets
 * aside allow rules that name Monitor itself"): the rules for a monitor's command, Bash's and Monitor's together, Monitor's
 * written as Bash's (`Monitor` the whole tool, `Monitor(x)` as `Bash(x)`); in Auto, none of Monitor's allow rules.
 */
export function monitorRules(rules, mode = "auto") {
  // (`named`: each turned rule's own text as the owner wrote it, by "kind:turned text", so a card names "Monitor", not
  // "Bash": round 5 of the live test, 2026-11-12, the card said "Your rule Bash asks first" for the rule `ask: Monitor`.
  // Not when the owner has the same Bash rule too: then either may be the one that matched.)
  const out = { allow: [], ask: [], deny: [], named: {}, ...(rules && rules.sources ? { sources: rules.sources } : {}) };
  const own = (k, txt) => (Array.isArray(rules && rules[k]) ? rules[k] : []).some((r) => String(r).trim() === txt);
  const turned = (k, txt, from) => { out[k].push(txt); if (txt !== from && !own(k, txt)) out.named[k + ":" + txt] = String(from).trim(); };
  for (const k of ["allow", "ask", "deny"]) for (const r of Array.isArray(rules && rules[k]) ? rules[k] : []) {
    const x = parseRule(r);
    // (A wildcard naming Monitor but not Bash, `Mon*`, is a rule on all of Monitor; one naming Bash applies to it as it is.)
    if (x && x.glob) { if (k !== "allow" && toolGlobMatches(x.tool, "Monitor") && !toolGlobMatches(x.tool, "Bash")) turned(k, "Bash", r); else out[k].push(r); continue; }
    // (A rule on one of Bash's own settings, Bash(run_in_background:true), is on Bash calls, never on a monitor: Bash docs pass
    // 9, every monitor had been refused by one. A Monitor rule on one of the monitor's settings, Monitor(timeout_ms:*), is
    // matched against the monitor's own input: bashDecision's `settings`.)
    if (x && x.tool === "Bash" && x.spec !== null) { const sp = settingSpec(x.spec); if (sp && sp.name !== "command") continue; }
    if (!x || x.tool !== "Monitor") { out[k].push(r); continue; }
    if (k === "allow" && mode === "auto") continue;
    turned(k, x.spec === null ? "Bash" : "Bash(" + x.spec + ")", r);
  }
  return out;
}
/**
 * A MONITOR'S DECISION NAMING THE OWNER'S OWN RULE (monitorRules' `named`): the rule, and an ask's "Your rule … asks first"
 * sentence, as the owner wrote it. A deny's sentence stays Claude Code's, which says Bash for a monitor too.
 */
export function namedForMonitor(dec, rules) {
  const orig = dec && typeof dec.rule === "string" && rules && rules.named ? rules.named[dec.verdict + ":" + dec.rule] : "";
  if (!orig) return dec;
  return { ...dec, rule: orig, ...(dec.verdict === "ask" && typeof dec.why === "string" ? { why: dec.why.replace("Your rule " + dec.rule + " ", "Your rule " + orig + " ") } : {}) };
}
/** Claude Code's refusal of a Monitor call under a rule denying every Bash command (its tools reference). */
export const MONITOR_BASH_DENIED = "Permission to use Monitor has been denied: it runs code as Bash does, and a rule denies Bash.";
/** A rule of `kind` on all of a tool (`Bash`, `Bash(*)`, `Monitor`; a connector's `mcp__<server>__<tool>`, or `mcp__<server>` for all of
 * that connector's; an allow rule's wildcard only after a literal mcp__<server>__, as Claude Code's), or "". */
export const wholeRule = (rules, kind, tool) => (Array.isArray(rules && rules[kind]) ? rules[kind] : []).find((r) => { const x = parseRule(r); return !!x && x.spec === null && (x.glob ? (kind !== "allow" || anchoredGlob(x.tool)) && toolGlobMatches(x.tool, tool) : x.tool === tool || (x.mcp === true && String(tool).startsWith(x.tool + "__"))); }) || "";
/**
 * A WEBSOCKET WATCH'S QUESTION (Claude Code's Monitor `ws` source): a rule denying every Bash command refuses it, as one
 * denying Monitor does; one asking for every Bash command asks the owner, and only the owner (or a PermissionRequest hook)
 * may approve it ("You can't have an allow rule, a PreToolUse hook, bypassPermissions mode, or the auto mode classifier
 * approve it for you"): `strict`; a Monitor ask rule asks. Otherwise "Without a Monitor allow rule, you're prompted before
 * Claude opens a WebSocket; in auto mode the classifier decides instead" (`check`).
 */
export function wsDecision({ rules = {}, mode = "auto" } = {}) {
  if (wholeRule(rules, "deny", "Bash")) return { verdict: "deny", why: MONITOR_BASH_DENIED };
  if (wholeRule(rules, "deny", "Monitor")) return { verdict: "deny", why: "Permission to use Monitor has been denied." };
  const bashAsk = wholeRule(rules, "ask", "Bash");
  if (bashAsk) return { verdict: "ask", byRule: true, strict: true, rule: bashAsk, why: "Your rule " + bashAsk + " asks first for every command, and a WebSocket watch runs code as Bash does, so only you can approve it." };
  const monAsk = wholeRule(rules, "ask", "Monitor");
  if (monAsk) return { verdict: "ask", byRule: true, rule: monAsk, why: "Your rule " + monAsk + " asks first." };
  if (mode !== "auto" && wholeRule(rules, "allow", "Monitor")) return { verdict: "allow" };
  return mode === "auto" ? { verdict: "check" } : { verdict: "ask", why: "" };
}
/**
 * A MONITOR CALL'S `ws` INPUT CHECKED, in Claude Code's words (its Monitor tool's input): "" when it is right.
 */
const HIDDEN_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/;
export function wsProblem(args) {
  const a = args && typeof args === "object" ? args : {};
  if (a.command !== undefined && a.ws !== undefined) return "ws cannot be combined with command: give one of them";
  const ws = a.ws;
  if (!ws || typeof ws !== "object" || Array.isArray(ws)) return "ws must be an object with url (and protocols)";
  if (typeof ws.url !== "string") return "ws.url is required";
  if (HIDDEN_CHARS.test(ws.url)) return "url contains control characters that would be hidden in the approval dialog";
  let ok = false;
  try { const u = new URL(ws.url); ok = (u.protocol === "ws:" || u.protocol === "wss:") && !u.username && !u.password && !/[\t\n\r ]/.test(ws.url) && /^[\x00-\x7F]*$/.test(ws.url); } catch { ok = false; }
  if (!ok) return "url must be a valid ASCII ws:// or wss:// URL with no userinfo or whitespace";
  if (ws.protocols !== undefined) {
    if (!Array.isArray(ws.protocols) || ws.protocols.some((p) => typeof p !== "string" || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(p))) return "protocol must be an RFC 6455 token";
    if (new Set(ws.protocols).size !== ws.protocols.length) return "protocols must be unique";
  }
  if (typeof a.description !== "string" || !a.description.trim()) return "description is required";
  return "";
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
// (A monitor's own: Claude Code's Monitor(timeout_ms:*) is on the monitor's input, never Bash's; Bash docs pass 9.)
export const MONITOR_SETTINGS = ["description", "timeout_ms", "ws"];
/** A Bash (or Monitor) rule's specifier read as a rule on a setting, `{ name, value }`, or null when it is a command pattern. */
export function settingSpec(spec, names = BASH_SETTINGS) {
  const m = typeof spec === "string" ? /^\s*([A-Za-z_]+)\s*:\s*([\s\S]*?)\s*$/.exec(spec) : null;
  return m && (names.includes(m[1]) || m[1] === "command") ? { name: m[1], value: m[2] } : null;
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
  // (Claude Code, for its file tools: 'The ":*" syntax is only for Bash prefix rules'.)
  if (FILE_RULE_TOOLS.has(tool) && content !== null && content.includes(":*")) return say('The ":*" syntax is only for Bash prefix rules', 'Use glob patterns like "*" or "**" for file matching', [tool + "(*.ts) - matches .ts files", tool + "(src/**) - matches all files in src", tool + "(**/*.test.ts) - matches test files"]);
  // (WebFetch's own, Claude Code's rule check: "WebFetch permissions use domain format, not URLs", 'WebFetch permissions must
  // use "domain:" prefix'; the owner, 2026-11-14: "start fixing and filling in gaps on those tools".)
  if (tool === "WebFetch" && content !== null) { const w = webFetchRuleProblem(content); if (w) return say(w.error, w.suggestion, w.examples); }
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
  if ((r.tool === "Bash" || r.tool === "PowerShell") && r.content !== null) { const sp = settingSpec(r.content); return !!sp && sp.name === "command"; }
  // A FILE RULE CLAUDE CODE KEEPS BUT NEVER MATCHES: a path in a Write, NotebookEdit, MultiEdit, Glob or Grep rule (its
  // docs: "It checks file permissions against Edit and Read rules only, so it never consults a path rule that names one of the
  // other file tools. It keeps the rule"), and a rule on Read's or Edit's own path, `Read(file_path:…)`.
  if (r.content !== null && keptPathRule(r)) return true;
  return !CLAUDE_TOOLS.has(r.tool) && !r.tool.includes("_") && /^[A-Za-z][A-Za-z0-9-]*$/.test(r.tool);
}
/** A file rule with a path that never matches (see ruleKept), and the rule to write in its place, or "". */
function keptPathRule(r) {
  const c = String(r.content || "").trim();
  if (!c || c === "*" || c.includes(":*")) return "";
  if (r.tool === "Write" || r.tool === "NotebookEdit" || r.tool === "MultiEdit") return "Edit";
  // (A Grep or Glob rule on one of its inputs is applied, not kept; one on its `path` is kept, Claude Code's raw-string rule.)
  if ((r.tool === "Glob" || r.tool === "Grep") && searchParamSpec(r.tool, c)) return "";
  if (searchPathSpec(r.tool, c)) return r.tool;
  if (r.tool === "Glob" || r.tool === "Grep") return "Read";
  if ((r.tool === "Read" || r.tool === "Edit") && /^file_path\s*:/.test(c)) return r.tool;
  return "";
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
 * A BASH ALLOW RULE WITH A * IN A VARIABLE'S VALUE (Claude Code 2.1.323, its `Dh`; the owner, 2026-11-13: "Yes all 7";
 * its changelog: "Added a start-up warning for Bash allow rules with a * in a variable's value, such as
 * Bash(PORT=* npm run dev)"): the start of the word after the settings, up to its first *, or "" (no such *, a rule that
 * ends in :*, or an operator or a redirection after the settings).
 */
export function starInSettingValue(spec) {
  const s = String(spec ?? "");
  if (s.endsWith(":*")) return "";
  const words = s.trim().split(/\s+/).filter(Boolean);
  const r = words.findIndex((w) => !/^[A-Za-z_]\w*\+?=/.test(w));
  const next = words[r] ?? "";
  if (/^(?:[|&;<>]|\d+[<>])/.test(next) || !words.slice(0, r).some(hasStar)) return "";
  const m = /^[^*]+/.exec(next);
  return m ? m[0] : "";
}
// (Claude Code's word patterns for its `qpr`: the letters, marks and digits, and _ . + - : @ % , ~ of a plain word; a shell
// word with its quotes and backslashes; the whole words in front.)
const PLAIN_CH = String.raw`\p{L}\p{M}\p{N}_.+\-:@%,~`;
const PLAIN_WORD = new RegExp(`^[${PLAIN_CH}/]*$`, "u");
const QUOTE_OR_PATH = new RegExp(`^(?:['"]|(?!\\d+<)[${PLAIN_CH}]*[</])`, "u");
const SH_WORD = String.raw`(?:\\.|[^\\ '"]|'[^']*'|"(?:\\.|[^"\\])*")*`;
const LEAD_WORDS = new RegExp(`^(?:${SH_WORD} )*`, "s");
const ONE_WORD = new RegExp(`^${SH_WORD}$`, "s");
/** A rule's text as words, as Claude Code reads it (its `kE`): the first command's words, past its settings in front, up to a $. */
function specWords(text) {
  const c = parseShell(text).commands[0];
  if (!c) return [];
  let w = c.words;
  while (w.length && !w[0].quoted && /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/.test(w[0].raw)) w = w.slice(1);
  const k = w.findIndex((x, i) => i > 0 && (x.expand || x.subst));
  return k < 0 ? w : w.slice(0, k);
}
/**
 * AN ALLOW RULE WHOSE * IS JOINED TO THE PROGRAM'S NAME (Claude Code 2.1.323, its `qpr`; the owner, 2026-11-13: "Yes all 7";
 * its changelog: "Fixed Bash allow rules with an attached wildcard, such as Bash(ls*), skipping the permission prompt in
 * some cases; a rule that names a variable, such as Bash(NODE_ENV*), now asks", and "Fixed Bash allow rules written with
 * combined sudo flags skipping the permission prompt in some cases"): whether the rule's `*` would stretch the word the
 * command runs as its program into another kind of word, so that the rule does not approve this form of the command:
 * `Bash(NODE_ENV*)` meeting `NODE_ENV=1 rm -rf ~` (the word becomes a setting and any program runs after it), or `Bash(ls*)`
 * meeting `ls=1 rm x`. Letters, digits and _ . + - : @ % , ~ / after it are the same word (`Bash(ls*)` still approves
 * `lsof`); so is a word that starts with a quote or a path, unless env or sudo comes before it in the rule.
 */
export function starStretchesProgram(spec, text) {
  const r = (/^(?:\\[*\\]|[^*])*/.exec(String(spec ?? "").trim())[0]).replace(/\\([*\\])/g, "$1").replace(/[ \t]+/g, " ").replace(/^(?:xargs )+(?!-)/, "");
  const s = String(text ?? "").replace(/[ \t]+/g, " ").replace(/^(?:xargs )+(?!-)/, "");
  const h = r.slice(LEAD_WORDS.exec(r)[0].length);
  if (h === "" || h.includes("=") || !s.startsWith(r)) return false;
  const y = s.slice(r.length);
  const k = ONE_WORD.test(h) ? y.replace(/ .*/s, "") : y;
  const v = h + k;
  // (Claude Code also lets through a word holding its own stand-ins for $(…) and ${…}; Coder's command texts hold none.)
  if (PLAIN_WORD.test(k)) return false;
  const H = specWords(r);
  const q = H.findLastIndex((x, i) => i < H.length - 1 && /^(?:env|sudo)$/.test(progName(x.text)));
  if (q < 0 && QUOTE_OR_PATH.test(v)) return false;
  const bare = (t) => String(t).replace(/['"\\]/g, "");
  return [false, true].some((wide) => {
    const ne = unwrapped(H.slice(Math.max(q, 0)), { wide });
    return ne.length <= 1 && bare(r).endsWith(bare(ne[0] ? ne[0].text : ""));
  });
}
/** A Bash rule Claude Code reads as a wildcard (its `T5e`): a `*` that is not escaped, and not the `:*` prefix form. */
const wildcardSpec = (spec) => typeof spec === "string" && !/^[\s\S]+:\*$/.test(spec) && hasStar(spec);
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
  // AN ALLOW RULE WITH A WILDCARD TOOL NAME (Claude Code: "An unanchored allow glob such as "*", "B*", or "mcp__*" is skipped
  // and doesn't auto-approve anything"): saved, with that said.
  if (toolGlob(t)) return k === "allow" && !anchoredGlob(t) ? { warning: 'Allow rule "' + t + '" names tools with a wildcard. An allow rule takes a wildcard only after a literal mcp__<server>__ prefix, so this one is skipped and doesn\'t auto-approve anything.', notice: t + " is skipped · it approves nothing" } : null;
  // A DENY OR ASK RULE THAT CAN NEVER MATCH (Claude Code 2.1.322, its words: "Permission deny rule "Bash(command:rm *)"
  // targets command as a raw string and will not match — use Bash(…) for Bash's own matcher."; "Permission deny rule "Bsh"
  // matches no known tool — check for typos."). An allow one is kept without a word, as Claude Code keeps it.
  if (ruleKept(t)) {
    const r = ruleParts(t);
    // (A file tool's path rule: Claude Code's warning for every kind, its row for deny and ask: "Write(docs/**) is not matched
    // by file permission checks — only Edit(path) rules are. Use Edit(docs/**) instead (Edit rules cover all file-editing
    // tools)", "⚠ Deny rule Write(docs/**) never matches · use Edit(docs/**)".)
    const use = r.content !== null ? keptPathRule(r) : "";
    if (use && use !== r.tool) {
      const instead = use + "(" + r.content + ")";
      return { warning: t + " is not matched by file permission checks — only " + use + "(path) rules are. Use " + instead + " instead (" + use + " rules cover all file-" + (use === "Edit" ? "editing" : "reading") + " tools).", notice: k === "allow" ? "" : t + " never matches · use " + instead };
    }
    if (k !== "deny" && k !== "ask") return null;
    // (Grep's and Glob's own `path`, in Claude Code's words, 2.1.325's list: "Permission deny rule "Grep(path:src)" targets path
    // as a raw string and will not match.", and Glob's "… — use Read(…) to match file-read paths.")
    if (use && searchPathSpec(r.tool, r.content)) return r.tool === "Grep" ? { warning: "Permission " + k + ' rule "' + t + '" targets path as a raw string and will not match.', notice: t + " never matches" } : { warning: "Permission " + k + ' rule "' + t + '" targets path as a raw string and will not match \u2014 use Read(\u2026) to match file-read paths.', notice: t + " never matches \u00b7 use Read(\u2026)" };
    if (use) return { warning: "Permission " + k + ' rule "' + t + '" targets file_path as a raw string and will not match — use ' + r.tool + "(…) for " + r.tool + "'s own matcher.", notice: t + " never matches · use " + r.tool + "(…)" };
    if (r.tool === "Bash" || r.tool === "PowerShell") return { warning: "Permission " + k + ' rule "' + t + '" targets command as a raw string and will not match — use ' + r.tool + "(…) for " + r.tool + "'s own matcher.", notice: t + " never matches · use " + r.tool + "(…)" };
    return { warning: "Permission " + k + ' rule "' + t + '" matches no known tool — check for typos.', notice: t + " matches no tool · check for typos" };
  }
  const m = /^Bash\(([\s\S]*)\)$/.exec(t);
  if (!m || settingSpec(m[1])) return null;
  const g = m[1];
  // (Content that starts with a name and a colon, such as git:* status, is not checked, as Claude Code skips it.)
  { const c = g.indexOf(":"); if (c > 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(g.slice(0, c).trim()) && !/^[A-Za-z]:[\\/]/.test(g.trim())) return null; }
  if (kind === "allow") {
    // (First a * in a variable's value, then a * before the rest of the command: Claude Code's order, 2.1.323.)
    const m = starInSettingValue(g);
    if (m) return { warning: t + " has a * in a variable's value. A * also matches spaces, so this rule can also approve a different command that has " + m + " later in the line, without a prompt. Give the variable an exact value instead.", notice: t + " allows any command at the * in its value · use an exact value" };
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
/**
 * CLAUDE CODE'S WILDCARD FOR A RULE'S TEXT (2.1.323's dZ): `*` any text, `\*` a star itself, `\\` a backslash, `/**\/` any
 * folders between, a trailing ` *` after the only star also matching nothing; the whole text, across lines.
 */
export function ruleWildcardMatches(rule, text) {
  const c = String(rule ?? "");
  if (c.includes("\u0000")) return false;
  const s = c.trim();
  let f = "";
  for (let i = 0; i < s.length;) {
    if (s[i] === "\\" && i + 1 < s.length) {
      if (s[i + 1] === "*") { f += "\u0000ESCAPED_STAR\u0000"; i += 2; continue; }
      if (s[i + 1] === "\\") { f += "\u0000ESCAPED_BACKSLASH\u0000"; i += 2; continue; }
    }
    f += s[i++];
  }
  let b = f.replace(/[.+?^${}()|[\]\\'"]/g, "\\$&").replace(/\/(?:\*\*\/)+/g, "\u0000GLOBSTAR\u0000").replaceAll("*", ".*").replace(/\u0000GLOBSTAR\u0000/g, "/(?:.*/)?").replace(/\u0000ESCAPED_STAR\u0000/g, "\\*").replace(/\u0000ESCAPED_BACKSLASH\u0000/g, "\\\\");
  if (b.endsWith(" .*") && (f.match(/\*/g) || []).length === 1) b = b.slice(0, -3) + "( .*)?";
  try { return new RegExp("^" + b + "$", "s").test(String(text ?? "")); } catch { return false; }
}
/**
 * A HOOK'S `if` FILTER (Claude Code's hooks: "if uses permission rule syntax to match against the tool name and arguments
 * together, so "Bash(git *)" runs when any subcommand of the Bash input matches git * and "Edit(*.ts)" runs only for
 * TypeScript files"): whether one rule matches one tool call (`tool` by Claude Code's name, `input` its arguments, `ctx`
 * `{ cwd, root, home }`). A Bash pattern checks every part of the command, those in $() and backticks too; one that says
 * more than the program runs the hook anyway on $() , backticks or $VAR; a command it can't read runs the hook ("When
 * Claude Code can't determine which commands the Bash input runs, it runs your hook regardless of the pattern"). A file
 * tool's pattern is read as an allow rule's ("a single-segment directory pattern like Edit(src/**) matches only the src
 * directory in the working directory").
 */
export function ifRuleMatches(rule, tool, input = {}, { cwd = "/", root = "/", home = "" } = {}) {
  const m = /^([A-Za-z_][A-Za-z0-9_-]*)(?:\(([\s\S]*)\))?$/.exec(String(rule || "").trim());
  if (!m || m[1] !== tool) return false;
  const spec = m[2] === undefined ? null : m[2].trim();
  if (spec === null || spec === "*") return true;
  const args = input && typeof input === "object" ? input : {};
  if (tool === "Bash" || tool === "Monitor") {
    const sp = settingSpec(spec, tool === "Monitor" ? MONITOR_SETTINGS : BASH_SETTINGS);
    if (sp && sp.name !== "command") return settingMatches(sp.value, args[sp.name]);
    const command = String(args.command || "");
    const read = readCommand(command, { cwd, home });
    if (!read.ok || read.dangling) return true;
    if (read.cmds.some((c) => denyTexts(c).some((t) => bashSpecMatches(spec, t)))) return true;
    // (More than the program, and a part worked out when it runs: the hook runs anyway.)
    const words = spec.replace(/:\*$/, "").replace(/\s+\*$/, "").trim().split(/\s+/);
    return words.length > 1 && /\$\(|`|\$[A-Za-z_{]/.test(command);
  }
  // (A PowerShell pattern, Bash docs pass 8: Claude Code's own "PowerShell(Remove-Item *)" checks every command the input
  // runs, nested ones too, as permission rules match them: case-insensitive, aliases as their cmdlets; a command that can't be
  // split runs the hook.)
  if (tool === "PowerShell") {
    const sp = settingSpec(spec);
    if (sp && sp.name !== "command") return settingMatches(sp.value, args[sp.name]);
    const parts = psAllParts(String(args.command || ""));
    return !parts.length || parts.some((part) => psRuleMatches(spec, part));
  }
  if (tool === "WebFetch") { let host = ""; try { host = new URL(String(args.url || "")).hostname.toLowerCase(); } catch { host = ""; } return /^domain:/.test(spec) && !!host && domainRuleMatches(spec, host); }
  // GREP'S AND GLOB'S `if` ON THEIR PATTERN (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"; Claude
  // Code 2.1.323: their matcher for a hook's `if` compares the rule's content with the call's pattern, not its path):
  // `Grep(TODO*)` runs for a search of "TODO.*fix".
  if (tool === "Grep" || tool === "Glob") return typeof args.pattern === "string" && ruleWildcardMatches(spec, args.pattern);
  const path = typeof args.file_path === "string" ? args.file_path : typeof args.path === "string" ? args.path : "";
  if (!path) return false;
  const full = path.startsWith("/") ? path : (cwd.replace(/\/+$/, "") || "") + "/" + path;
  return !!fileRuleHit([tool + "(" + spec + ")"], tool, full, "allow", { root, home });
}
/** The texts a command is matched as: as written and with its quotes taken away, each with spaces made single. */
function textsOf(words) {
  if (!words || !words.length) return [];
  const raw = words.map((x) => x.raw).join(" "), plain = words.map((x) => x.text).join(" ");
  return raw === plain ? [raw] : [raw, plain];
}
/**
 * For deny and ask rules: every form Claude Code tries (its `hY` for deny and ask rules: "A deny or ask rule matches past
 * any leading assignment"; and "Bash deny rules now match commands wrapped in env/sudo/watch/ionice/setsid and similar
 * exec wrappers"): the command as written, past its settings in front, past each wrapper in turn, and the command the
 * wrappers run, that last also with its program named without a path (`/usr/bin/curl x` as `curl x`, its `II`).
 */
function denyTexts(cmd) {
  const out = new Set(textsOf(cmd.words));
  // (Both of Claude Code 2.1.323's readings, the usual one and the wide one, as it tries both: unwrapSteps.)
  for (const wide of [false, true]) {
    const steps = unwrapSteps(cmd.words, { wide });
    for (const s of steps) for (const t of textsOf(s)) out.add(t);
    const last = steps[steps.length - 1];
    if (last && last[0] && progName(last[0].text) !== last[0].text) for (const t of textsOf([{ ...last[0], text: progName(last[0].text), raw: progName(last[0].text) }, ...last.slice(1)])) out.add(t);
  }
  return [...out];
}
/** For allow rules: past the safe wrappers and settings only; none when an unsafe setting is in front. */
// THE TEXTS AN ALLOW RULE IS TRIED AGAINST (Claude Code's hY for an allow rule, 2.1.322: the part as typed, without its
// redirections, and the same past the variables in front it counts as safe and the wrappers it looks past, its CT, which
// takes `timeout` away with its own settings too. Bash docs pass 9: `Bash(NODE_ENV=production npm run *)` never matched its
// own command, nor `Bash(npm test *)` `timeout -s KILL 30 npm test`.)
function allowTexts(cmd) {
  const words = cmd.words || [];
  const out = words.length ? textsOf(words) : [];
  let w = readWords(words, { wrappers: true });
  for (let guard = 0; w && w.length && guard < 8; guard++) {
    out.push(...textsOf(w));
    const next = processWrappers(w);
    if (next === w) break;
    w = readWords(next, { wrappers: true });
  }
  return [...new Set(out)];
}

/**
 * Whether an allow rule approves one part of a command, as text `t`: an exec wrapper (watch, setsid, flock …) or a find that
 * runs, deletes or writes only by an exact rule, one with no * (Claude Code: "A prefix rule like Bash(watch *) or
 * Bash(find *) can't auto-approve" them).
 */
function exactOnly(c) { return !!semanticWhy(c); }
// (A wildcard rule whose * is joined to the program's name does not approve a form where it stretches that name into another
// kind of word: starStretchesProgram, Claude Code 2.1.323.)
function ruleApproves(c, x, t) { return (x.spec === null || !x.spec.includes("*") || !exactOnly(c)) && !(wildcardSpec(x.spec) && starStretchesProgram(x.spec, t)) && bashSpecMatches(x.spec, t); }
/** Whether one of the owner's allow rules approves this one part of a command (a simple command, coder-shell.mjs's). */
export function allowRuleCovers(cmd, rules) {
  const allow = rulesFor(rules && rules.allow, "Bash");
  return allowTexts(cmd).some((t) => allow.some((x) => ruleApproves(cmd, x, t)));
}
/** The rules a list holds for one tool: `[{ text, spec }]` (with `globs`, a deny or ask list: its tool-name wildcards too). */
function rulesFor(list, tool, globs = false) {
  return (Array.isArray(list) ? list : []).map((t) => ({ t, r: parseRule(t) })).filter((x) => x.r && (x.r.glob ? globs && toolGlobMatches(x.r.tool, tool) : x.r.tool === tool)).map((x) => ({ text: x.t, spec: x.r.spec }));
}

// ── "DON'T ASK AGAIN" ────────────────────────────────────────────────────────
/**
 * THE RULE "YES, AND DON'T ASK AGAIN" SAVES FOR ONE PART, Claude Code's own (Bash docs pass 9; its uPn, mso and ter in
 * 2.1.322, whose Bash tool passes no prefix helper, so this is always its rule; side by side over 38 commands, Coder's had
 * differed in 16): a heredoc's command and the word after it (`cat <<EOF …` → `cat *`); a part over several lines, its first
 * line and ` *`; the first two words and ` *` when the second looks like a subcommand (`npm install lodash` →
 * `npm install *`, `npm run build` → `npm run *`) and the first is no shell or wrapper, past the variables in front Claude
 * Code counts as safe (`NODE_ENV=test npm test` → `npm test *`); otherwise the part exactly as written (`ls -la`,
 * `pytest tests/`, `timeout 30 npm test`, `FOO=1 npm test`).
 * Kept from Coder: no rule for a part whose program is worked out when it runs, or that runs a command substitution (no rule
 * could approve it), nor an exact one with a `*` in it (it would match more than the card shows); eval, source and the rest
 * of Claude Code's list get the part exactly, as only an exact rule can approve them.
 */
// (Claude Code's shells and wrappers, its pve: the first word of a two-word rule is never one of them.)
const RULE_WRAPPERS = new Set(["sh", "bash", "zsh", "fish", "csh", "tcsh", "ksh", "dash", "cmd", "powershell", "pwsh", "env", "xargs", "command", "builtin", "noglob", "nice", "stdbuf", "nohup", "timeout", "time", "watch", "ionice", "chrt", "setsid", "taskset", "strace", "ltrace", "script", "flock", "unshare", "nsenter", "sudo", "doas", "pkexec", "su", "runuser"]);
const SUBCOMMAND_WORD = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
/** Whether Claude Code looks past `NAME=value` in front of a command (its FD, here rbEnvSafe: the same list and checks). */
export const safeLeadVar = (name, value) => rbEnvSafe(name, value);
/** How many words in front are safe variables (its y8e), or null when one is not. */
function leadVarCount(words) {
  let n = 0;
  while (n < words.length && /^[A-Za-z_]\w*=/.test(words[n])) { const eq = words[n].indexOf("="); if (!safeLeadVar(words[n].slice(0, eq), words[n].slice(eq + 1))) return null; n++; }
  return n;
}
/** The two words of a prefix rule (its mso), or null. */
function twoWordRule(text) {
  const n = String(text).trim().split(/\s+/).filter(Boolean);
  if (!n.length) return null;
  const r = leadVarCount(n);
  if (r === null) return null;
  const s = n.slice(r);
  if (s.length < 2 || RULE_WRAPPERS.has(s[0].split("/").pop()) || !SUBCOMMAND_WORD.test(s[1])) return null;
  return s.slice(0, 2).join(" ");
}
/** A heredoc's command (its ter), or null. */
function heredocRule(text) {
  const at = text.indexOf("<<");
  if (at <= 0) return null;
  const r = text.slice(0, at).trim();
  if (!r) return null;
  const two = twoWordRule(r);
  if (two) return two;
  const h = r.split(/\s+/).filter(Boolean), y = leadVarCount(h);
  if (y === null || y >= h.length || RULE_WRAPPERS.has(h[y].split("/").pop())) return null;
  return h.slice(y, y + 2).join(" ") || null;
}
/** Claude Code's rule for one part's text (its uPn): `prefix *`, or the text itself, an exact rule. */
export function ruleShape(text) {
  const t = String(text ?? "");
  const hd = t.includes("<<") ? heredocRule(t) : null;
  if (hd) return hd + " *";
  if (t.includes("\n")) { const first = t.split("\n")[0].trim(); if (first) return first + " *"; }
  const two = twoWordRule(t);
  return two ? two + " *" : t;
}
const exactRule = (t) => (t && !t.includes("*") ? t : null);
/** The rule to save for one simple command, or null when none can be offered. */
export function suggestFor(cmd) {
  const words = cmd.words || [];
  if (!words.length || words.some((x) => x.subst)) return null;
  const w = readWords(words, { wrappers: true }) || leadWords(words);
  if (!w || !w.length || w[0].expand || w[0].subst || w[0].glob) return null;
  const typed = words.map((x) => x.raw).join(" ");
  if (EVAL_LIKE.has(basename(w[0].text))) return exactRule(typed);
  // (A heredoc: its command and the marker, as Claude Code reads the part's text; the lines after it are not kept here, so
  // one that is no prefix rule gets none.)
  const doc = (cmd.redirects || []).some((r) => r.heredoc);
  const shape = ruleShape(doc ? typed + " <<" : typed);
  if (doc) return shape.endsWith(" *") ? shape : null;
  return shape === typed ? exactRule(typed) : shape;
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
export function bashDecision(command, { mode = "auto", rules = {}, cwd = "/", workdirs = [], isProtected = () => "", real = null, input = null, home = "", ownDirs = [], byCommand = true, scratch = [], settings = BASH_SETTINGS } = {}) {
  const read = readCommand(command, { cwd, home });
  // (For deny and ask rules, the command read a second time with the variables it sets put in: readCommand's `vars`.)
  const shadow = readCommand(command, { cwd, home, vars: true });
  const deny = rulesFor(rules.deny, "Bash", true), ask = rulesFor(rules.ask, "Bash", true), allow = rulesFor(rules.allow, "Bash");
  // DENY, THEN ASK: a rule on one of the call's settings (Bash(run_in_background:true), see settingSpec), or a rule on the
  // command matching any part of it, nested ones too (Claude Code: "including a command nested inside a subshell, a command
  // substitution, or a control-flow body"). A rule on a setting is no command pattern.
  // (`settings`: the names of the call's own settings, a monitor's for a monitor: MONITOR_SETTINGS.)
  const onSetting = (x) => { const sp = settingSpec(x.spec, settings); return sp && sp.name !== "command" ? sp : null; };
  const settingHit = (list) => (input && typeof input === "object" ? list.find((x) => { const sp = onSetting(x); return !!sp && settingMatches(sp.value, input[sp.name]); }) || null : null);
  // (Each part also with its redirections, as Claude Code splits a command: `Bash(echo hi > out.txt)` denies that part.)
  // (A part whose command name is written $'…' or $"…" is one no rule can name: Claude Code asks instead, "This command can't
  // be checked before it runs"; tried in its command-line version, 2026-11-11. In Auto, where that would go to the checker,
  // Coder still holds such a name to the owner's rules.)
  const ruleCmds = (cmds) => (normMode(mode) === "auto" ? cmds : cmds.filter((c) => !c.quotedHead));
  const commandHit = (list) => { const on = list.filter((x) => !settingSpec(x.spec, settings)); for (const c of ruleCmds([...read.cmds, ...shadow.cmds])) for (const t of [...denyTexts(c), partText(c)]) { const r = on.find((x) => bashSpecMatches(x.spec, t)); if (r) return r; } return null; };
  // THE WHOLE COMMAND AS ONE TEXT, for a rule with no wildcard (Claude Code's exact candidates, its `pXt`; Bash docs pass 9:
  // `Bash(git status && npm test)` as a deny rule never refused its own text, nor approved it as an allow rule).
  const whole = String(command ?? "").trim().replace(/[ \t]+/g, " ");
  const exactHit = (list) => list.find((x) => typeof x.spec === "string" && !x.spec.includes("*") && !settingSpec(x.spec, settings) && x.spec.replace(/[ \t]+/g, " ").trim() === whole) || null;
  const d = settingHit(deny) || exactHit(deny) || commandHit(deny);
  if (d) return { verdict: "deny", rule: d.text, why: "Permission to use Bash with command " + String(command).trim() + " has been denied.", suggest: null };
  // THE OWNER'S READ AND EDIT RULES ON THE FILES THE COMMAND NAMES (Bash docs, the owner, 2026-11-10: "yea do all 4"; Claude
  // Code: "Read and Edit deny rules apply … to file commands Claude Code recognizes in Bash, such as cat, head, tail, sed, and
  // tee, and to the targets of Bash redirections such as > file and < file"), in every mode: a deny rule refuses it, in
  // Claude Code's words for the path ("Output redirection to '…' was blocked. …"), an ask rule asks.
  const files = commandFiles({ ...read, cmds: ruleCmds(read.cmds) }, { cwd, home });
  const fctx = { root: workdirs[0] || cwd, home, sources: rules && rules.sources ? rules.sources : null, real: typeof real === "function" ? (p) => { try { return real(p) || ""; } catch { return ""; } } : null };
  const ruleFiles = [...files, ...commandFiles({ ...shadow, cmds: ruleCmds(shadow.cmds) }, { cwd, home })];
  const fileHit = (kind) => { for (const f of ruleFiles) { const r = fileProbes(f).map((pr) => fileRuleHit(rules[kind], f.tool, pr.p, kind, { ...fctx, isDir: pr.dir })).find(Boolean); if (r) return { f, rule: r }; } return null; };
  const fd = fileHit("deny");
  // (In Claude Code's own sentence for a whole command: it gave "Permission to use Bash with command cat prod.env has been
  // denied." for every way of naming the file tried, a variable, ./, a full path, < and >, head, cp, git diff and grep with
  // a wildcard; its "cat from '…' was blocked by a deny rule" is never reached. Tried in its command-line version,
  // 2026-11-11; the owner: "yes copy all of them".)
  if (fd) return { verdict: "deny", rule: fd.rule, why: "Permission to use Bash with command " + String(command).trim() + " has been denied.", suggest: null };
  const a = settingHit(ask) || exactHit(ask) || commandHit(ask);
  if (a) return { verdict: "ask", rule: a.text, why: "Your rule " + a.text + " asks first for this command.", suggest: null, byRule: true };
  const fa = fileHit("ask");
  if (fa) return { verdict: "ask", rule: fa.rule, why: "Your rule " + fa.rule + " asks first for this command.", suggest: null, byRule: true };
  if (normMode(mode) === "auto") return { verdict: "allow", why: "", suggest: null };
  // WHAT THE OWNER'S READ AND EDIT ALLOW RULES OPEN outside the project (Claude Code: an input redirect's "target outside the
  // working directories needs your approval unless an allow rule covers it"; the same for the paths a command reads, and, in
  // Accept edits, for the files it writes: "the check covers your Edit allow and deny rules"): never a protected file.
  const readOk = (p, dir = false) => !!p && (dir ? folderReadAllowed(rules.allow, p, fctx) : !!fileRuleHit(rules.allow, "Read", p, "allow", fctx));
  const editOk = (p) => !!p && !!fileRuleHit(rules.allow, "Edit", p, "allow", fctx);
  // (Accept edits lets commands change files only as Claude Code's real acceptEdits: in its cloud sessions the mode is
  // "default" for commands, unless the repository's settings say acceptEdits: `byCommand`, Bash docs pass 8.)
  const editsOk = normMode(mode) === "acceptEdits" && byCommand !== false;
  const cloudDefault = normMode(mode) === "acceptEdits" && byCommand === false;
  // (When Claude Code's checks of the whole text caught it first, theirs is the reason, as its ct() runs before its parser:
  // `ls <1-5>` asks with "Contains zsh <N-M> numeric-range glob", not "Parse error". Bash docs pass 9.)
  if (!read.ok) return { verdict: "ask", why: (Array.isArray(read.complex) && read.complex[0]) || PARSE_ERROR, suggest: null };
  // (An exact rule for the whole command, as Claude Code's: it approves it as written, once its paths check out.)
  const wholeAllow = exactHit(allow);
  // TOO COMPLEX TO CHECK (Claude Code's own reasons: a command hidden in arithmetic or a [[ ]] test, a no-break space …;
  // Bash docs pass 9): asked, unless an exact rule names the whole command.
  if (read.complex.length && !wholeAllow) return { verdict: "ask", why: read.complex[0], suggest: null };
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
  // A WRITE IN A COMMAND THAT ALSO CHANGES FOLDER (Claude Code's JJo and RZt; Bash docs pass 9: after `cd -`, or `cd name`
  // with CDPATH set, Coder judged a write from a folder the shell was not in): asked, whatever rule matches, unless the
  // command starts `cd DIR &&` with DIR a full path or ./…, inside the working folders (Claude Code's w8e), so the rest is
  // judged from there.
  const cdCmds = read.cmds.filter((c) => { const w = unwrapped(c.words); const p = w[0] ? basename(w[0].text) : ""; return p === "cd" || p === "pushd" || p === "popd" || p === "chdir"; });
  const leadCdSafe = (() => {
    if (cdCmds.length !== 1 || read.cmds[0] !== cdCmds[0] || cdCmds[0].top !== 0 || cdCmds[0].redirects.length) return false;
    const w = cdCmds[0].words;
    if (w.length !== 2 || w[0].text !== "cd" || w[1].expand || w[1].subst || w[1].glob || w[1].tilde) return false;
    const x = w[1].text;
    if (!(x.startsWith("/") || x === "." || x.startsWith("./"))) return false;
    if (!x.startsWith("/") && x.split("/").includes("..")) return false;
    if (!/^\s*cd\s+\S+\s*&&/.test(String(command ?? ""))) return false;
    // (Only when the rest is joined by && and pipes alone, as Claude Code's uve reads the raw text: no ||, ;, newline or a
    // lone &, quoted or not.)
    const raw = String(command ?? "");
    if (raw.includes("||") || raw.includes(";") || raw.includes("\n") || raw.replaceAll("&&", "").includes("&")) return false;
    return insideWork(fullPath(w[1], cwd), workdirs);
  })();
  const cdCompound = cdCmds.length > 0 && read.cmds.length > 1 && !leadCdSafe;
  // A RELATIVE READ AFTER SUCH A CD while one of the owner's Read deny rules exists (Claude Code's JJo, "cd-compound-read";
  // Bash docs pass 9): which file it reads can't be settled before it runs, so it asks, unless the command is a plain
  // `cd DIR` then only read-only commands with plain words whose paths stay inside the working folders from both folders
  // (Claude Code's Cer).
  const readDenies = (rules.deny || []).some((x) => /^Read(\(|$)/.test(String(x).trim()));
  const cdReadSafe = (() => {
    if (!cdCompound || !readDenies) return true;
    const [h, ...rest] = read.cmds;
    if (!h || !rest.length || cdCmds.length !== 1 || cdCmds[0] !== h || h.top !== 0 || h.redirects.length) return false;
    const w = h.words;
    if (w.length !== 2 || w[0].text !== "cd" || w[1].expand || w[1].subst || w[1].glob || w[1].tilde) return false;
    const x = w[1].text;
    if (x.startsWith("-") || !(x.startsWith("/") || x === "." || x === ".." || x.startsWith("./") || x.startsWith("../"))) return false;
    if (!x.startsWith("/") && x.split("/").includes("..")) return false;
    const to = fullPath(w[1], cwd);
    if (!insideWork(to, workdirs) || typeof real !== "function") return false;
    const canon = (p) => { try { return real(p) === p; } catch { return false; } };
    if (!canon(cwd) || !canon(to)) return false;
    const plain = (x2) => !x2.expand && !x2.subst && !x2.glob && !x2.tilde && !/[{}]/.test(x2.text) && basename(x2.text) !== "xargs";
    return rest.every((c) => c.top >= 0 && !(c.words[0] && ASSIGN_LEAD.test(c.words[0].text)) && c.words.every(plain) && commandReadOnly(c) && !semanticWhy(c)
      && c.redirects.every((r) => !r.heredoc && r.target && (r.op === ">&" ? /^\d+$/.test(r.target.text) : (r.op === ">" || r.op === ">>") && r.target.text === "/dev/null"))
      && pathArgs({ ...c, dir: undefined }, { cwd, home }).every((a) => !/^[/~]/.test(a.p) ? [cwd, to].every((d) => insideWork(normalPath(d + "/" + a.p), workdirs)) : a.full && insideWork(a.full, workdirs)));
  })();
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
  // THE CHAT'S SCRATCH FOLDER (Bash docs pass 9; Claude Code: "Scratchpad files for current session are allowed for
  // writing", and for reading): read and written without asking, after the deny rules; through a link, no.
  const scr = (Array.isArray(scratch) ? scratch : []).filter((x) => typeof x === "string" && x.startsWith("/"));
  const inScratch = (p) => !!p && scr.some((d) => (p === d || p.startsWith(d.replace(/\/+$/, "") + "/")) && (typeof real !== "function" || (() => { try { const to = real(p); return !to || to === p || to.startsWith(d.replace(/\/+$/, "") + "/"); } catch { return true; } })()));
  const own = [...(Array.isArray(ownDirs) ? ownDirs : []), ...scr].filter((x) => typeof x === "string" && x);
  const isOwn = (p) => own.some((d) => p === d || p.startsWith(d.replace(/\/+$/, "") + "/"));
  // EACH FILE IT WRITES (redirections, tee): in Accept edits, a file inside the project that is not protected, not named
  // with a wildcard (Claude Code: a target that "contains a glob character needs your approval"), and no link out of the
  // project or to a protected file; in Plan, none.
  // (In Coder's cloud Accept edits, Claude Code's "default", the same checks: Bash docs pass 9, pass 8 had let an allow rule
  // for the command approve its redirect anywhere, `echo x > /etc/passwd` under Bash(echo *). A redirect inside the project
  // asks there whatever rule matches, as Claude Code's RZt; a tee's target is a part an allow rule may approve.)
  const cloudWrites = [];
  for (const x of read.writes) {
    if (!editsOk && !cloudDefault) { needFor(x.cmd, "This command writes " + x.raw + ", and Plan mode changes no files."); continue; }
    if (cdCompound) { needFor(x.cmd, x.via === "tee" ? CD_WRITE_WHY : CD_REDIRECT_WHY); continue; }
    if (x.glob) { needFor(x.cmd, SHELL_EXPANSION); continue; }
    if (x.tildeUser) { needFor(x.cmd, TILDE_WHY); continue; }
    if (x.expand || !x.path) { needFor(x.cmd, VAR_UNCHECKED); continue; }
    if (inScratch(x.path)) continue;
    const pw = pathWhy(x.path);
    if (pw.why === "protected") needFor(x.cmd, sensitiveWhy(pw.to || x.path, pw.to ? x.path : ""), true);
    else if (pw.why === "outside" && !String(x.raw || "").startsWith("~") && editOk(x.path)) continue;
    else if (pw.why === "outside") needFor(x.cmd, pw.to ? linkOutWhy(x.path, pw.to) : needsWhy(x.via === "tee" ? "tee in" : "Output redirection to", x.path, workdirs));
    else if (pw.why === "lost") needFor(x.cmd, "This command writes " + x.raw + ", a link that can't be followed.");
    else if (pw.why) needFor(x.cmd, VAR_UNCHECKED);
    else if (cloudDefault && !editOk(x.path)) {
      if (x.via === "tee") { cloudWrites.push(x.cmd); if (!partWhy.has(x.cmd)) partWhy.set(x.cmd, inWhy("tee in", x.path, workdirs)); }
      else needFor(x.cmd, inWhy("Output redirection to", x.path, workdirs));
    }
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
    if (readOk(x.path)) continue;
    needFor(x.cmd, inside && to ? linkOutWhy(x.path, to) : inside ? "This command reads " + x.raw + ", a link that can't be followed." : inputBlockedWhy(x.path, workdirs));
  }
  // EACH COMMAND: read-only, one of Accept edits' file commands on the project's files, or allowed by a rule.
  let gitAfterCd = false;
  const parts = [];
  for (const c of read.cmds) {
    if (c.ranBy === "xargs" && commandReadOnly({ words: c.words })) continue;
    const prog = c.words.length ? (readWords(c.words) || [])[0] : null;
    const name = prog ? basename(prog.text) : "";
    // (The program past every wrapper, for Claude Code's words about its paths: `nohup cat /etc/passwd` is "cat in …".)
    const uname = basename(((unwrapped(c.words) || [])[0] || {}).text || "");
    const ro = commandReadOnly(c);
    // (Claude Code's own reason for one a prefix rule can't approve: eval, source, awk with system() …; Bash docs pass 9.)
    const sem = semanticWhy(c);
    if (sem) partWhy.set(c, sem);
    // (Two folders: zsh's `cd OLD NEW`, asked whatever rule matches, as Claude Code's path check does: Bash docs pass 9.)
    if (name === "cd" && (readWords(c.words) || []).slice(1).filter((x) => x.text !== "--" && !/^-[PLe@]+$/.test(x.text)).length >= 2) { needFor(c, CD_TWO_WHY); continue; }
    // A cd out of the project, or into another folder before git (its hooks), is asked about (Claude Code's docs).
    if (ro && name === "cd") {
      const cw = readWords(c.words) || [];
      // (`cd -` on its own: Claude Code checks a folder named "-", in the project; where it really lands is unknown, so what
      // asks is a later part's write or a short path going up: Bash docs pass 9.)
      if (cw.slice(1).some((x) => x.text === "-")) continue;
      const to = cdTarget(cw, c.dir === undefined ? cwd : c.dir, "", home);
      if (to && !insideWork(to, workdirs) && readOk(to, true)) continue;
      if (!to || !insideWork(to, workdirs)) { partWhy.set(c, to ? blockedWhy("cd", to, workdirs) : cw.slice(1).some(tildeOther) ? TILDE_WHY : VAR_UNCHECKED); parts.push(c); continue; }
      continue;
    }
    if (ro && name === "git" && (read.cdAway || c.dir !== cwd)) { gitAfterCd = true; partWhy.set(c, GIT_AFTER_CD); parts.push(c); continue; }
    // A FILE COMMAND (mkdir, touch, rm, rmdir, mv, cp, sed -i): Claude Code checks each path it changes before any rule (its
    // JJo), so an allow rule for the command never approves a path outside the project, one worked out when it runs, a
    // ~user, or a write in a command that also changes folder (Bash docs pass 9: with Bash(touch *), `touch /etc/x` ran).
    const fc = fileCommandTargets(c, c.dir === undefined || c.dir === false ? cwd : c.dir);
    if (fc) {
      if (cdCompound) {
        // (rm and rmdir: Claude Code's removal check follows the cd and names a protected file first, as seen in 2.1.322
        // for `cd .husky && rm pre-commit && cd ..`; any other write after such a cd asks in its words, CD_WRITE_WHY.)
        if ((uname === "rm" || uname === "rmdir") && fc.sure) {
          const hit = fc.paths.map((p) => p.replace(/\/\*$/, "")).map((p) => ({ p, pw: pathWhy(p) })).find((x) => x.pw.why === "protected");
          if (hit) { needFor(c, sensitiveWhy(hit.pw.to || hit.p, hit.pw.to ? hit.p : ""), true); parts.push(c); continue; }
        }
        needFor(c, CD_WRITE_WHY);
        continue;
      }
      const odd = pathArgs(c, { cwd, home }).find((a) => a.computed || a.tildeUser || a.dotdot);
      if (odd) { needFor(c, odd.tildeUser ? TILDE_WHY : odd.dotdot ? globDotDotWhy(odd.p, " against the working directories") : runtimeTargetWhy(uname || name)); continue; }
      if (fc.sure) {
        const bare = fc.paths.map((p) => p.replace(/\/\*$/, "")).filter((p) => !inScratch(p));
        // (Only the scratch folder: Accept edits' own, as inside the project; otherwise a part as any command is.)
        if (!bare.length && fc.paths.length) { if (editsOk || (ro && !sem)) continue; parts.push(c); continue; }
        const ways = bare.map((p) => pathWhy(p));
        // A protected file, by name or through a link, is never approved by a rule (Claude Code: "permissions.allow rules
        // … do not pre-approve protected-path writes"): asked each time.
        const prot = ways.findIndex((pw) => pw.why === "protected");
        if (prot >= 0) { needFor(c, sensitiveWhy(ways[prot].to || bare[prot], ways[prot].to ? bare[prot] : ""), true); parts.push(c); continue; }
        // Out of the project (named there, or through a link), a link that can't be followed: asked whatever Bash rule
        // matches; the owner's Edit rule for such a path still opens it (through a link, one matching both the path and
        // where it leads: Claude Code's "Allow rules: apply only when both the requested path and the file it resolves to
        // match").
        const k = ways.findIndex((pw, j) => pw.why && !(pw.why === "outside" && editOk(bare[j])));
        if (k >= 0) { const pw = ways[k]; needFor(c, pw.to ? linkOutWhy(bare[k], pw.to) : pw.why === "outside" ? needsWhy((uname || name) + " in", bare[k], workdirs) : pw.why === "lost" ? "This command changes " + bare[k] + ", a link that can't be followed." : VAR_UNCHECKED); continue; }
        // Inside: Accept edits' own (repository acceptEdits); in Claude Code's "default", asked unless a rule approves it.
        if (editsOk) continue;
        if (!partWhy.has(c) && bare.length && !bare.every((p) => editOk(p))) partWhy.set(c, inWhy((uname || name) + " in", bare.find((p) => !editOk(p)), workdirs));
        else if (bare.length && bare.every((p) => editOk(p))) continue;
      }
      parts.push(c);
      continue;
    }
    // THE PATHS IT READS, whatever reads them (read-only or not, past its wrappers: Claude Code's path check runs before the
    // rules too; Bash docs pass 9: `nohup cat /etc/passwd` and `awk 1 /etc/passwd` ran under Bash(cat *) and Bash(awk *)).
    // A READ OF A PATH OUTSIDE THE PROJECT ASKS (the live side-by-side, 2026-11-10: Claude Code 2.1.322 asked for
    // `cat /etc/hostname`, `ls /`, `head -1 /etc/passwd`, `ls ../` and `cat ~/.bashrc` in Accept edits, and in Plan without
    // its auto-mode checker; it had run them). Each path by the command's own rule for its paths (READ_PATHS, Claude
    // Code's); Coder's own folders (background logs, saved outputs) stay readable.
    // (A short path after a cd out of the project: that cd is asked about, and Claude Code names only it, as for
    // `cd /tmp && ls`; a full path is still checked: `cd /tmp && ls -d /tmp` names both parts.)
    // (After a cd that a Read rule opens, its short paths are checked from there.)
    // (A relative read after a cd while a Read deny rule exists, cdReadSafe above: a deny rule is checked from the folder the
    // command starts in, as Claude Code's REe, then it asks.)
    const relAfterCd = uname !== "tee" && (uname || name) !== "cd" && !cdReadSafe ? pathArgs(c, { cwd, home }).filter((a) => !/^[/~]/.test(a.p)) : [];
    for (const a of relAfterCd) {
      const at = normalPath(cwd + "/" + a.p);
      const r = fileRuleHit(rules.deny, "Read", at, "deny", fctx);
      if (r) return { verdict: "deny", rule: r, why: (uname || name) + " in '" + at + "' was blocked by a deny rule", suggest: null };
    }
    if (relAfterCd.length) needFor(c, cdReadWhy(uname || name));
    else if (uname !== "tee") {
      const movedOut = c.dir !== undefined && c.dir !== false && c.dir !== cwd && !insideWork(c.dir, workdirs) && !readOk(c.dir, true);
      for (const a of pathArgs(c, { cwd, home })) {
        if (movedOut && !/^[/~]/.test(a.p) && !/^\$\{?HOME\b/.test(a.p)) continue;
        if (a.tildeUser) { needFor(c, TILDE_WHY); break; }
        if (a.dotdot) { needFor(c, globDotDotWhy(a.p, " against the working directories")); break; }
        if (a.unknownDir) { if (a.updir) { needFor(c, (uname || name) + " in '" + a.p + "' requires manual approval: the path it names depends on a directory change in the same command."); break; } continue; }
        if (a.computed || !a.full) { needFor(c, VAR_UNCHECKED); break; }
        if (isOwn(a.full)) continue;
        const inside = insideWork(a.full, workdirs), to = inside ? leads(a.full) : a.full;
        if (inside && (to === a.full || insideWork(to, workdirs))) continue;
        // (A folder it lists or searches counts as read when the rule opens what is in it.)
        if (readOk(a.full, true)) continue;
        needFor(c, inside && to ? linkOutWhy(a.full, to) : blockedWhy(uname || name, a.full, workdirs));
        break;
      }
    }
    if (ro && !sem) continue;
    parts.push(c);
  }
  // (A file a command writes, in Accept edits as Claude Code's cloud "default": asked unless a rule covers the command.)
  for (const c of cloudWrites) if (!parts.includes(c)) parts.push(c);
  // THE PARTS LEFT: each allowed by one of the owner's rules (allowRuleCovers), or the command is asked about.
  const left = parts.filter((c) => !allowTexts(c).some((t) => allow.some((x) => ruleApproves(c, x, t))));
  // (A wrapper or a find action that a prefix rule matched but can't approve: Claude Code's own reason.)
  for (const c of left) if (!partWhy.has(c) && exactOnly(c) && allowTexts(c).some((t) => allow.some((x) => x.spec !== null && x.spec.includes("*") && bashSpecMatches(x.spec, t)))) partWhy.set(c, exactWhy(c));
  // (A part asked about only because a word is a variable: Claude Code's "A variable in this command can't be checked before it runs".)
  // (A `$(…)` alone is a command substitution, not a variable.)
  const isVar = (x) => !!x && !!x.expand && /\$(\{|[A-Za-z_@*#?$!0-9-])/.test(String(x.raw || ""));
  const hasVar = (c) => (c.words || []).some(isVar) || (c.redirects || []).some((x) => isVar(x.target));
  // (An exact rule for the whole command approves what no other rule did, never what its paths ask about: Claude Code's order.)
  const leftOver = wholeAllow && !needs.length ? [] : left;
  const items = [...needs, ...leftOver.filter((c) => !needs.some((n) => n.c === c)).map((c) => ({ c, why: partWhy.get(c) || (hasVar(c) ? VAR_UNCHECKED : "") }))];
  // (A `&` sending part of it to the background, in a command that would run: Claude Code's safety check asks. Bash docs pass 9.)
  if (!items.length) return multiCd ? { verdict: "ask", why: MULTI_CD, suggest: null } : read.background ? { verdict: "ask", why: BG_OP_WHY, suggest: null, safety: true } : { verdict: "allow", why: "", suggest: null };
  // WHICH REASON IS SAID, in Claude Code's order: a protected file ("a sensitive file") first, then more than one folder
  // change, then one part's own reason, or, when two or more parts need approval, Claude Code's list of them.
  const order = (c) => read.cmds.indexOf(c);
  const asked = [...new Set(items.map((x) => x.c).filter(Boolean))].sort((a, b) => order(a) - order(b));
  const safety = items.find((x) => x.safety);
  const why = safety ? safety.why : multiCd ? MULTI_CD : asked.length >= 2 ? MULTI_PARTS + asked.map(partText).join(", ") : (items[0].why || "This command requires approval");
  // What "Yes, and don't ask again" would save: a rule for each part left, when they cover it all (a cd out of the
  // project, or git after a cd, has no rule that could).
  // (A cd out of the project gets its own Read rule for that folder, as Claude Code's: "Subcommands like cd into a directory
  // outside your working directories generate their own Read rule for that path"; one whose folder is worked out when it
  // runs gets none, and then nothing is offered.)
  let suggest = null;
  const cdTo = (c) => { const w = readWords(c.words) || []; if (!w[0] || w[0].text !== "cd") return null; const to = w.length > 1 ? fullPath(w[1], c.dir === undefined ? cwd : c.dir) : ""; return to && !insideWork(to, workdirs) ? readRuleFor(to) : ""; };
  if (!needs.length && left.length && left.length <= 5 && !gitAfterCd && !multiCd) {
    const s = left.map((c) => { const cd = cdTo(c); return cd === null ? (suggestFor(c) === null ? null : ruleText("Bash", suggestFor(c))) : cd || null; });
    if (s.every((x) => typeof x === "string" && x.length && x.length <= RULE_MAX + 10)) suggest = [...new Set(s)];
  }
  return { verdict: "ask", why, suggest, ...(safety ? { safety: true } : {}) };
}
/**
 * WHAT THE OWNER'S RULES SAY OF ONE OF CODER'S FILE TOOLS on one full path (Bash docs, the owner, 2026-11-10: "yea do all 4";
 * Claude Code's permissions docs, "Read and Edit"): `{ verdict: "deny" | "ask" | "", rule, why }`, in Claude Code's words.
 * read, grep, glob and lsp go by Read rules ("Claude makes a best-effort attempt to apply Read(path) deny rules to all
 * built-in tools that read files like Grep and Glob"; "Grep and Glob search the directory the path argument resolves to.
 * Claude Code applies Read deny rules to that directory"); write and edit by Edit rules ("Edit rules apply to all built-in
 * tools that edit files"), and a Read deny rule refuses them too ("A Read deny rule also blocks the Edit and Write tools on
 * the same path, including creating a new file there"). A rule on the whole tool by Claude Code's name (Write, Grep, Glob,
 * LSP) matches each call. Deny, then ask; nothing here approves (Coder's file tools work inside the project only).
 */
export function fileToolDecision(tool, path, { rules = {}, root = "/", home = "", real = null, isDir = false, input = null } = {}) {
  const name = TOOL_RULE_NAMES[tool];
  if (!name) return { verdict: "", rule: "", why: "" };
  const ctx = { root, home, isDir, sources: rules && rules.sources ? rules.sources : null, real: typeof real === "function" ? (p) => { try { return real(p) || ""; } catch { return ""; } } : null };
  const edits = tool === "write" || tool === "edit";
  const whole = (kind) => wholeRule(rules, kind, name);
  // (A tool-name wildcard naming this tool, or the rules' tool for it, Read or Edit: a rule on the whole tool.)
  const globWhole = (kind) => (Array.isArray(rules[kind]) ? rules[kind] : []).find((r) => { const x = parseRule(r); return !!x && x.glob && [name, edits ? "Edit" : "Read"].some((n) => toolGlobMatches(x.tool, n)); }) || "";
  const isWhole = (r) => { const x = parseRule(r); return !!x && x.spec === null; };
  const p = typeof path === "string" && path ? path : root;
  // (A search's folder: the rule matches the folder, or what is in it.)
  const search = tool === "grep" || tool === "glob";
  const hit = (list, t, kind) => fileRuleHit(list, t, p, kind, search ? { ...ctx, isDir: true } : ctx) || (search ? fileRuleHit(list, t, p.replace(/\/+$/, "") + "/coder-any-file", kind, ctx) : "");
  // DENY.
  const wd = (name !== "Read" && name !== "Edit" ? whole("deny") : "") || globWhole("deny");
  if (wd) return { verdict: "deny", rule: wd, why: "Permission to use " + name + " has been denied." };
  // A GREP OR GLOB RULE ON ONE OF THE CALL'S INPUTS (the owner, 2026-11-14: "start fixing and filling in gaps on those tools";
  // Claude Code's "Match by input parameter": "A parameter rule matches when Claude calls the tool with that parameter set to
  // that exact value", "* … matches any sequence of characters", "A parameter the model omits is never matched"), denied in
  // its words, 2.1.325's: "Permission to use Grep with output_mode:content has been denied.".
  const paramHit = (kind) => (search && input && typeof input === "object" ? (Array.isArray(rules[kind]) ? rules[kind] : []).find((r) => { const x = parseRule(r); if (!x || x.tool !== name || !x.param) return false; const v = input[x.param.name]; return settingMatches(x.param.value, typeof v === "string" ? v.trim() : v); }) || "" : "");
  const pd = paramHit("deny");
  if (pd) return { verdict: "deny", rule: pd, why: "Permission to use " + name + " with " + parseRule(pd).spec + " has been denied." };
  if (edits) {
    const e = hit(rules.deny, "Edit", "deny");
    if (e) return { verdict: "deny", rule: e, why: isWhole(e) ? "Permission to use " + name + " has been denied." : "File is in a directory that is denied by your permission settings." };
    const r = hit(rules.deny, "Read", "deny");
    if (r) return { verdict: "deny", rule: r, why: "File is covered by a Read deny rule in your permission settings and cannot be " + (tool === "write" ? "written." : "edited.") };
  } else {
    const r = hit(rules.deny, "Read", "deny");
    if (r) return { verdict: "deny", rule: r, why: isWhole(r) ? "Permission to use " + name + " has been denied." : "Permission to read " + p + " has been denied." };
  }
  // ASK (the owner's rule asks each time: no "don't ask again" for it).
  // (Grep and Glob in Claude Code's words: a Read ask rule on the path, its read check's "Claude requested permissions to read
  // from <path>, but you haven't granted it yet."; a rule on the whole tool or on one of its inputs, "Claude requested
  // permissions to use Grep, but you haven't granted it yet."; "Claude" is Coder here.)
  if (search) {
    const ra = hit(rules.ask, "Read", "ask");
    if (ra) return { verdict: "ask", rule: ra, why: "Coder requested permissions to read from " + p + ", but you haven't granted it yet." };
    const sa = whole("ask") || globWhole("ask") || paramHit("ask");
    return sa ? { verdict: "ask", rule: sa, why: "Coder requested permissions to use " + name + ", but you haven't granted it yet." } : { verdict: "", rule: "", why: "" };
  }
  const wa = (name !== "Read" && name !== "Edit" ? whole("ask") : "") || globWhole("ask");
  const a = wa || hit(rules.ask, edits ? "Edit" : "Read", "ask");
  // (An lsp lookup reads its file: "reading", as for read. 2026-11-14.)
  if (a) return { verdict: "ask", rule: a, why: "Your rule " + a + " asks first for " + (edits ? (tool === "write" ? "writing " : "editing ") : tool === "read" || tool === "lsp" ? "reading " : "searching ") + p + "." };
  return { verdict: "", rule: "", why: "" };
}
/**
 * THE FILES A COMMAND NAMES, for the owner's Read and Edit rules: `{ tool: "Read" | "Edit", path, name, how, glob }` for each
 * path a reading command names (READ_PATHS: cat, head, tail, sed …), each input redirection (Read), each file an output
 * redirection or tee writes, and each path a file command changes (rm, mv, cp, mkdir, touch, sed -i: Edit). Paths worked out
 * only when it runs are left out (Claude Code's rules "don't apply to a command that reads files without naming them").
 */
export function commandFiles(read, { cwd = "/", home = "" } = {}) {
  const out = [];
  for (const c of read.cmds || []) {
    const w = readWords(c.words) || [];
    // (The program past its wrappers, as Claude Code names it: `stdbuf -o L cat x` is "cat in …".)
    const uw = unwrapped(c.words) || [];
    const name = uw[0] ? basename(uw[0].text) : w[0] ? basename(w[0].text) : "";
    for (const a of pathArgs(c, { cwd, home })) if (a.full) out.push({ tool: "Read", path: a.full, name, how: "cmd", glob: !!a.glob, raw: a.p });
    const fc = c.dir === false ? null : fileCommandTargets(c, c.dir === undefined ? cwd : c.dir);
    // (cp, mv and sed -i read what they change, so a Read rule on one of their files counts too.)
    if (fc) for (const p of [...fc.paths, ...(fc.maybe || [])]) if (p) for (const tool of ["cp", "mv", "sed"].includes(name) ? ["Edit", "Read"] : ["Edit"]) out.push({ tool, path: p.replace(/\/\*$/, ""), name, how: "cmd", glob: /\/\*$/.test(p) });
  }
  for (const x of read.reads || []) if (x.path && !x.expand) out.push({ tool: "Read", path: x.path, name: "", how: "in", glob: !!x.glob });
  for (const x of read.writes || []) if (x.path && !x.expand) out.push({ tool: "Edit", path: x.path, name: x.via === "tee" ? "tee" : "", how: x.via === "tee" ? "tee" : "out", glob: !!x.glob });
  return out;
}
/** The paths to try a rule on for one file: itself, and for a wildcard the folder before it, and anything in that folder. */
function fileProbes(f) {
  if (!f.glob) return [{ p: f.path, dir: false }];
  return [{ p: f.path, dir: true }, { p: f.path.replace(/\/+$/, "") + "/coder-any-file", dir: false }, ...(f.raw ? [{ p: f.path.replace(/\/+$/, "") + "/" + String(f.raw).split("/").pop(), dir: false }] : [])];
}
/**
 * Claude Code's words when one of the owner's Read or Edit deny rules refuses a file a command names (2.1.322's own, Bash docs
 * pass 9: "Output redirection to '…' was blocked by a deny rule.", "Input redirection from '…' …", "cat from '…' …" for a file
 * it reads, "rm to '…' …" for one it changes).
 */
export function fileBlockedWhy(f) {
  const what = f.how === "out" ? "Output redirection to" : f.how === "in" ? "Input redirection from" : f.how === "tee" ? "tee to" : (f.name || "The command") + (f.tool === "Read" ? " from" : " to");
  return what + " '" + f.path + "' was blocked by a deny rule.";
}
/** One part of a command as written, for Claude Code's list of the parts that need approval. */
function partText(c) {
  const w = (c.words || []).map((x) => x.raw).join(" ");
  const r = (c.redirects || []).filter((x) => !x.heredoc && x.target).map((x) => (x.fd === undefined || x.fd === null ? "" : String(x.fd)) + x.op + " " + x.target.raw).join(" ");
  return (w + (r ? " " + r : "")).trim();
}
/** Claude Code's reason when a prefix rule matched an exec wrapper or a find that runs, deletes or writes. */
function exactWhy(c) { return semanticWhy(c); }
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
  // (A wildcard the shell expands is files wherever it stands, the pattern's place or an option's value too: Claude Code
  // 2.1.271, "Fixed Bash permission checks skipping files a wildcard expands to when the wildcard sits in a command's
  // pattern or option value (for example grep -v dir/* file)".)
  const listed = rule(args.map((x) => x.text));
  for (const x of args) if (x.glob && !x.text.startsWith("-") && !listed.includes(x.text)) listed.push(x.text);
  for (const p of listed) {
    if (p === "-" || NOT_FILES.has(p)) continue;
    const word = args.find((x) => x.text === p) || args.find((x) => x.text.endsWith(p)) || {};
    // (~user, ~+ and ~-: Claude Code can't place them, and asks. Bash docs pass 9: `cat ~dev/.ssh/id_rsa` was read as a file
    // inside the project, past a deny rule on ~/.ssh.)
    if (tildeOther(word) && word.text === p) { out.push({ p, tildeUser: true }); continue; }
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
/**
 * A protected file ("a sensitive file"), and the link it was reached through. A settings file of Claude Code's (a .claude
 * folder's settings.json or settings.local.json), or a .claude folder itself, in Claude Code's own other words (its `y9`,
 * tried with Haiku on 2026-11-13: "Claude requested permissions to write to /tmp/cc-danger/work/.claude/settings.json, but
 * you haven't granted it yet.").
 */
export const settingsFileOf = (target) => /(^|\/)\.claude(\/settings(\.local)?\.json)?\/?$/i.test(String(target ?? ""));
export const sensitiveWhy = (target, from = "") => (settingsFileOf(target) ? "Coder requested permissions to write to " + target + ", but you haven't granted it yet." : "Coder requested permissions to edit " + target + " which is a sensitive file.") + (from ? " " + from + " resolves through a symlink to " + target + "." : "");
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
    // (Every word after diff that is no option, as Claude Code's own rule: `git diff --no-index /dev/null .env` prints .env,
    // and got past a Read deny rule on it. Bash docs pass 9.)
    let dd = false;
    for (const x of rest) { if (!dd && x === "--") { dd = true; continue; } if (dd || x === "-" || !x.startsWith("-")) { const y = at(x); if (!NOT_FILES.has(y)) out.push(y); } }
    return out;
  },
};
/**
 * PROGRAMS THAT RUN CODE GIVEN INLINE, and the option (or word) that gives it: Claude Code 2.1.322's own map (its nfn), the
 * name read without a version (python3.12 is python). Under the read block such code can't be checked, nor code on stdin.
 */
const RB_RUNNERS = new Map([["python", new Set(["-c"])], ["node", new Set(["-e", "--eval", "-p", "--print"])], ["nodejs", new Set(["-e", "--eval", "-p", "--print"])], ["bun", new Set(["-e", "--eval", "-p", "--print"])], ["perl", new Set(["-e", "-E"])], ["ruby", new Set(["-e"])], ["php", new Set(["-r"])], ["bash", new Set(["-c"])], ["sh", new Set(["-c"])], ["zsh", new Set(["-c"])], ["dash", new Set(["-c"])], ["ksh", new Set(["-c"])], ["lua", new Set(["-e"])], ["luajit", new Set(["-e"])], ["tsx", new Set(["-e", "--eval", "-p", "--print"])], ["deno", new Set(["eval"])], ["Rscript", new Set(["-e"])], ["julia", new Set(["-e", "-E"])], ["osascript", new Set(["-e"])]]);
/** The programs whose words the read block never checks (Claude Code's own twelve, its mer). */
const RB_EXEMPT = new Set(["echo", "printf", "test", "[", "[[", "true", "false", "which", "type", "basename", "dirname", "df"]);
/** Settings in front that the read block lets through (Claude Code's own list, its FD), when their value is not a path. */
const RB_SAFE_ENV = new Set(["GOEXPERIMENT", "GOOS", "GOARCH", "CGO_ENABLED", "GO111MODULE", "RUST_BACKTRACE", "RUST_LOG", "NODE_ENV", "PYTHONUNBUFFERED", "PYTHONDONTWRITEBYTECODE", "PYTEST_DISABLE_PLUGIN_AUTOLOAD", "PYTEST_DEBUG", "ANTHROPIC_API_KEY", "LANG", "LANGUAGE", "LC_ALL", "LC_CTYPE", "LC_TIME", "CHARSET", "TERM", "COLORTERM", "NO_COLOR", "FORCE_COLOR", "TZ", "LS_COLORS", "LSCOLORS", "GREP_COLOR", "GREP_COLORS", "GCC_COLORS", "TIME_STYLE", "BLOCK_SIZE", "BLOCKSIZE", "COLUMNS", "LINES", "CLICOLOR", "CLICOLOR_FORCE", "CI", "DEBIAN_FRONTEND", "GIT_TERMINAL_PROMPT"]);
const RB_PATHISH = /^[.~]*[/\\]|[/\\][/\\]|:[/\\.]|(?:^|[/\\])\.\.(?:[/\\]|$)/;
/** Whether a `NAME=value` in front passes the read block (Claude Code's FD: a listed name, a value that is no path, a locale for LANG). */
export function rbEnvSafe(name, value, computed = false) {
  const v = String(value ?? "");
  if (computed) return false;
  if (["LANG", "LC_ALL", "LC_CTYPE"].includes(name) && !/^(['"]?)(C|POSIX|UTF-?8|[\w-]+\.UTF-?8(@\w+)?)\1$/i.test(v) && !(name === "LANG" && v === "")) return false;
  if (RB_SAFE_ENV.has(name)) return !RB_PATHISH.test(v.replaceAll('"', "").replaceAll("'", ""));
  return false;
}
// THE READ BLOCK'S OWN WORDS (the owner, 2026-11-10: "ok do that": Claude Code's exactly), from Claude Code 2.1.322 run with
// permissions.blockReadsOutsideWorkingDirectories on (its nF, Q3 and dw), with Coder's name for the setting; Coder has no
// /add-dir, so only the setting is named.
export const RB_SETTING = "CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES";
export const RB_OUTSIDE = "Reads outside the working directories are blocked (" + RB_SETTING + "). Remove that setting to allow them.";
/** A command the parser can't trace (Claude Code's Q3: its reason, then "; under the read block (…) a command the shell parser cannot analyze asks the person"). */
export const rbUnsure = (why) => why + "; under the read block (" + RB_SETTING + ") a command the shell parser cannot analyze asks the person";
export const RB_SED = "This sed script is not on the allowlist and can read or write any file, which cannot be checked against the read block (" + RB_SETTING + ")";
/** A word whose path is known only when the command runs (Claude Code's dw). */
export const rbComputed = (prog) => prog + " names a path that is computed at run time, which cannot be checked against the read block (" + RB_SETTING + ")";
/** A word naming a file or folder outside (Claude Code's per and ger). */
export const rbNamesOutside = (prog, path) => prog + " names '" + path + "', outside the working directories, which the read block does not allow without asking (" + RB_SETTING + "). Remove that setting to allow them.";
/** Whether a path climbs with `..` after a name (Claude Code's S0e: such a word is checked even when nothing is there). */
const climbs = (p) => { let seen = false; for (const t of String(p).split("/")) { if (!t || t === ".") continue; if (t === "..") { if (seen) return true; } else seen = true; } return false; };
/** Whether a wildcard path could lead up with `..` (Claude Code's qEe and mNn): a part that matches "..", or ".." after a wildcard. */
function globClimbs(p) {
  const segs = String(p).split("/");
  const isGlob = (x) => /[*?[]/.test(x);
  const matchesUp = (x) => {
    if (!isGlob(x) || x.startsWith("*") || x.startsWith("?")) return false;
    let re = "^";
    for (let i = 0; i < x.length; i++) {
      const ch = x[i];
      if (ch === "*") re += ".*";
      else if (ch === "?") re += ".";
      else if (ch === "[") { const j = x.indexOf("]", i + 2); if (j < 0) re += "\\["; else { re += "[" + x.slice(i + 1, j).replace(/^[!^]/, "^").replace(/\\/g, "\\\\") + "]"; i = j; } }
      else re += ch.replace(/[.+^${}()|\\/]/g, "\\$&");
    }
    try { return new RegExp(re + "$").test(".."); } catch { return true; }
  };
  return segs.some(matchesUp) || segs.some((x, i) => x === ".." && segs.slice(0, i).some(isGlob));
}
/**
 * WHY THE READ BLOCK ASKS ABOUT A COMMAND, or "" (in every mode; the owner's Yes runs it). `ctx`: `{ cwd, workdirs, home,
 * real, ownDirs, exists }` (`real` follows a full path's links, "" when it can't; `ownDirs`: Coder's own folders a command
 * may read, such as a long output's file; `exists(fullPath)`: whether something is there, on Coder's machine).
 */
export function readBlockWhy(command, { cwd = "/", workdirs = [], home = "", real = null, ownDirs = [], exists = null } = {}) {
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
  const there = (p) => { if (typeof exists !== "function") return false; try { return !!exists(p); } catch { return false; } };
  const leadsTo = (p) => { if (typeof real !== "function") return p; try { return real(p) || p; } catch { return p; } };
  // Traced? A cd more than once, or a part run in a subshell ($(…), ( … ), <( … )), can't be (Claude Code's own examples).
  const cds = read.cmds.filter((c) => { const w = unwrapped(c.words); const p = w[0] ? basename(w[0].text) : ""; return p === "cd" || p === "pushd" || p === "popd" || p === "chdir"; });
  if (cds.length > 1) return rbUnsure("multiple directory changes cannot be checked against the read block");
  if (read.cmds.some((c) => c.depth > 0 && !c.inScript && c.ranBy !== "xargs" && c.ranBy !== "find")) return rbUnsure("a subshell cannot be checked against the read block");
  // An input redirection: a wildcard or a short path after a cd asks as in every mode (Claude Code checks those first);
  // one from outside is blocked.
  for (const x of read.reads) {
    if (x.glob || x.afterCd) return inputUnsureWhy(x.raw);
    if (x.expand || !x.path) return rbUnsure(VAR_UNCHECKED);
    if (!inside(x.path)) return RB_OUTSIDE;
  }
  // EACH WORD OF A PROGRAM THAT NAMES A FILE OR FOLDER THAT IS THERE (Claude Code's per and ger, 2.1.322; the owner,
  // 2026-11-10: "fix the still different stuff"): one outside the working folders asks; one worked out when it runs asks.
  // `-xVALUE` and `--opt=VALUE` give their value, `NAME=VALUE` both; a wildcard is checked by its folder.
  const namedWhy = (prog, args, c, fromFlags = null) => {
    const dir = c.dir === undefined ? cwd : c.dir;
    const list = fromFlags || args;
    for (const a of list) {
      const t = a.text;
      if (t === "") continue;
      if (a.expand || a.subst) return rbComputed(prog);
      const eq = t.indexOf("=");
      const cands = fromFlags ? [t] : t.startsWith("-") ? (eq > 0 ? [t.slice(eq + 1)] : !t.startsWith("--") && t.length > 2 ? [t.slice(2)] : []) : eq > 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(t.slice(0, eq)) ? [t, t.slice(eq + 1)] : [t];
      for (const c0 of cands) {
        if (!c0) continue;
        if (c0.startsWith("~") && c0 !== "~" && !c0.startsWith("~/")) return rbComputed(prog);
        const p = c0 === "~" || c0.startsWith("~/") ? (home ? home + c0.slice(1) : "") : c0;
        if (!p) return rbComputed(prog);
        if (!a.quoted && /\{[^{}]*(,|\.\.)[^{}]*\}/.test(p)) return rbComputed(prog);
        if (dir === false && !p.startsWith("/")) return rbComputed(prog);
        let base = p;
        const g = a.glob ? p.search(/[*?[]/) : -1;
        if (g >= 0) {
          if (fromFlags || globClimbs(p)) return rbComputed(prog);
          const st = p.slice(0, g);
          base = st.endsWith("/") ? st : st.replace(/\/[^/]*$/, "") || (st.startsWith("/") ? "/" : ".");
        }
        const full = base.startsWith("/") ? normalPath(base) : normalPath(dir + "/" + base);
        if (!climbs(base) && !there(full)) continue;
        if (inside(full)) continue;
        return rbNamesOutside(prog, leadsTo(full));
      }
    }
    return "";
  };
  for (const c of read.cmds) {
    // What xargs runs gets its words only when it runs (Claude Code: "xargs names a path that is computed at run time").
    if (c.ranBy === "xargs") return rbComputed("xargs");
    // A setting in front of the command, or given to env, outside Claude Code's safe list for the read block.
    const lead = [];
    for (const w of c.words) { if (/^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(w.raw) && !w.raw.startsWith("=")) lead.push(w); else break; }
    const assign = (w) => { const k = w.raw.indexOf("="); return { name: w.raw.slice(0, k).replace(/\+$/, ""), value: w.raw.slice(k + 1), computed: !!(w.expand || w.subst) }; };
    if (lead.map(assign).some((x) => !rbEnvSafe(x.name, x.value, x.computed))) return rbUnsure("an environment variable prefix outside the safe list cannot be checked against the read block");
    const first = c.words[lead.length];
    if (first && basename(first.text) === "env" && c.words.slice(lead.length + 1).filter((w) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(w.raw)).map(assign).some((x) => !rbEnvSafe(x.name, x.value, x.computed))) return rbUnsure("an environment variable assignment outside the safe list cannot be checked against the read block");
    const words = unwrapped(c.words);
    // (xargs among the wrappers in front: `xargs cat` is read as cat, its words to come from xargs.)
    const before = leadWords(c.words);
    if (before.slice(0, Math.max(0, before.length - words.length)).some((w) => basename(w.text) === "xargs")) return rbComputed("xargs");
    if (!words.length) continue;
    const prog = basename(words[0].text), args = words.slice(1);
    if (prog === "xargs") return rbComputed("xargs");
    if (RB_EXEMPT.has(prog)) continue;
    // A program given code inline, or code on stdin (`-`, piped in, a here-document or a here-string); then its words.
    const runner = RB_RUNNERS.get(prog.replace(/[\d.]+$/, ""));
    if (runner) {
      if (args.some((a) => a.text === "-")) return rbUnsure(prog + " runs code from stdin, which cannot be checked against the read block");
      const inline = (t) => runner.has(t) || [...runner].some((f) => (f.startsWith("--") ? t.startsWith(f + "=") : f.startsWith("-") && t.startsWith("-") && !t.startsWith("--") && t.length > 2 && t.includes(f.slice(1))));
      if (args.some((a) => inline(a.text))) return rbUnsure(prog + " runs inline code, which cannot be checked against the read block");
      const fed = c.afterPipe || (c.redirects || []).some((x) => x.heredoc || x.op === "<<<");
      if (fed && !args.some((a) => !a.text.startsWith("-"))) return rbUnsure("code on stdin cannot be checked against the read block");
    }
    const rule = READ_PATHS[prog];
    if (!rule) { const w = namedWhy(prog, args, c); if (w) return w; continue; }
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
    // (git's own folder and file options too: Claude Code checks -C, --git-dir, --work-tree, --file and -f with per.)
    if (prog === "git") {
      const flags = [];
      for (let k = 0; k < args.length; k++) {
        const t = args[k].text;
        if (["-C", "--git-dir", "--work-tree", "--file", "-f"].includes(t) && args[k + 1]) flags.push(args[k + 1]);
        else if (/^--(git-dir|work-tree|file)=/.test(t)) flags.push({ ...args[k], text: t.slice(t.indexOf("=") + 1) });
        else if (t.startsWith("-C") && t.length > 2) flags.push({ ...args[k], text: t.slice(2) });
      }
      const w = namedWhy("git", [], c, flags);
      if (w) return w;
    }
  }
  return "";
}

// ── WEB FETCH ────────────────────────────────────────────────────────────────
// Claude Code's tools reference: "In Manual and acceptEdits permission modes, WebFetch prompts before fetching, except for
// domains your permission rules already allow or deny and a built-in set of preapproved documentation domains"; "The auto
// and bypassPermissions permission modes skip the prompt, except for a domain an explicit ask rule matches". Its set and its
// domain matching are WebFetch's own (the owner, 2026-11-14: "start fixing and filling in gaps on those tools";
// coder-webfetch-sites.mjs, with no Node module, as this file has none): github.com/anthropics pre-approved whole, as
// Claude Code 2.1.323 has it; a rule's `*` within a part of the name (any depth only as a leading `*.`), its trailing dot
// dropped, in any case; an exact rule before a wildcard one.
export { docSite };
/** WHAT HAPPENS TO A WEB FETCH, like bashDecision; in Claude Code's words ("WebFetch denied access to domain:<host>."). */
export function fetchDecision(url, { mode = "auto", rules = {} } = {}) {
  let host = "";
  try { host = new URL(String(url)).hostname.toLowerCase(); } catch { host = ""; }
  // (A rule on the whole tool, or one whose domain covers the host: an exact one first.)
  const pick = (list, globs = false) => { const all = rulesFor(list, "WebFetch", globs); return all.find((x) => x.spec === null) || (host ? pickDomainRule(all, host) : undefined); };
  const d = pick(rules.deny, true);
  if (d) return { verdict: "deny", rule: d.text, why: d.spec === null ? "Permission to use WebFetch has been denied." : "WebFetch denied access to domain:" + host + ".", suggest: null };
  const a = pick(rules.ask, true);
  if (a) return { verdict: "ask", rule: a.text, why: "Coder wants to fetch content from " + (host || "this URL"), suggest: null, byRule: true };
  if (normMode(mode) === "auto") return { verdict: "allow", why: "", suggest: null };
  if (pick(rules.allow) || docSite(url)) return { verdict: "allow", why: "", suggest: null };
  return { verdict: "ask", why: "Coder wants to fetch content from " + (host || "this URL"), suggest: host && !host.includes("*") ? [ruleText("WebFetch", "domain:" + host)] : null, host };
}

/**
 * WHAT HAPPENS TO A POWERSHELL COMMAND (Bash docs pass 6; coder-ps.mjs, Claude Code's PowerShell rules: "the same shape as
 * Bash rules", aliases canonicalized, "Every subcommand must be allowed for the compound command to run without a prompt"):
 * a deny rule on any part refuses it, in Claude Code's words; an ask rule asks; in Auto it runs (the checker judges what
 * isn't read-only); in Accept edits and Plan a command whose parts all only read, or that allow rules cover, runs, and
 * anything else asks. `nativeReadOnly(part)`: whether a program's part only reads (Coder's bash check of it).
 */
/**
 * A POWERSHELL COMMAND'S DECISION (Bash docs pass 7: Claude Code's PowerShell permission check, read from PowerShell's
 * own parse of the command, coder-psparse.mjs; the owner, 2026-11-11: "we need to build the rest of the batch tool").
 * In Claude Code's order: a deny rule on the command, or on any command in it at any depth, refuses it; so does a
 * removal it never allows (a system path, a wildcard). An ask rule asks, in every mode. Its safety checks (a command it
 * could not parse, a sub-expression, a script block, .NET calls, Invoke-Expression and the rest, in its own words), a
 * provider or network path, a file redirection, git next to a cd or an archive, a write into .git, and a recursive
 * removal of the working folder ask; so does any command that neither a rule allows nor only reads (its table; its paths
 * inside the working folders) and, in Accept edits, is none of the file commands Claude Code runs there. In Auto, the
 * checker judges what would ask (a rule's question and a refusal stay). Returns { verdict, why, rule?, byRule?, suggest,
 * readOnly, covered }: `readOnly`, nothing for the checker to judge; `covered`, the owner's allow rules cover it all.
 * `pathAbs(p)` is a path as the machine resolves it (null when it cannot be told); `inside(p)`, inside the working folders.
 */
export function psDecision(command, { mode = "auto", rules = {}, nativeReadOnly = () => false, parsed = null, pathAbs = () => null, inside = () => false, cwd = "", home = "", byCommand = true, input = null, dirs = [] } = {}) {
  const cmd = String(command ?? "").trim();
  const m = normMode(mode), auto = m === "auto";
  if (!cmd) return { verdict: "allow", why: "", suggest: null, readOnly: true };
  const p = parsed && typeof parsed === "object" && Array.isArray(parsed.statements) ? parsed : psParseFail(cmd, "PowerShell is not available", "NoPowerShell");
  const all = psCommands(p).filter((c) => c.elementType === "CommandAst");
  // (A rule on one of the call's settings, PowerShell(run_in_background:true), as Bash's: Bash docs pass 8. It is no
  // command pattern: only deny and ask rules match it, "allow rules continue to use each tool's own specifier syntax".)
  const onSetting = (x) => { const sp = settingSpec(x.spec); return sp && sp.name !== "command" ? sp : null; };
  const settingHit = (list) => (input && typeof input === "object" ? list.find((x) => { const sp = onSetting(x); return !!sp && settingMatches(sp.value, input[sp.name]); }) || null : null);
  const hit = (list, texts) => { const on = list.filter((x) => !onSetting(x)); for (const t of texts) { const r = on.find((x) => psRuleMatches(x.spec, t)); if (r) return r; } return null; };
  const texts = [cmd, ...all.flatMap((c) => [c.text, [c.name, ...c.args].join(" ")])];
  // (A command PowerShell could not read: its pieces, split where a command could start, as Claude Code does.)
  const pieces = p.valid ? [] : cmd.replace(/<#[\s\S]*?#>/g, " ").replace(/`[\r\n]+\s*/g, "").split(/[;|\n\r{}()&]+/).map((x) => x.trim()).filter(Boolean);
  const d = settingHit(rulesFor(rules.deny, "PowerShell", true)) || hit(rulesFor(rules.deny, "PowerShell", true), [...texts, ...pieces]);
  if (d) return { verdict: "deny", rule: d.text, why: "Permission to use PowerShell with command " + cmd + " has been denied.", suggest: null };
  const gone = psRemovals(p, pieces, { pathAbs, cwd, home });
  if (gone.deny) return { verdict: "deny", why: gone.deny, suggest: null, removal: true };
  const a = settingHit(rulesFor(rules.ask, "PowerShell", true)) || hit(rulesFor(rules.ask, "PowerShell", true), [...texts, ...pieces]);
  if (a) return { verdict: "ask", rule: a.text, why: "Your rule " + a.text + " asks first for this command.", suggest: null, byRule: true };
  // (The "don't ask again" rule each question offers is Claude Code's: the command itself for its safety checks, provider
  // paths and file redirections; none for a command it cannot parse, the git, archive and .git checks, or deleting the
  // working folder; on the last question, each command that needs approval. See psExactRule.)
  const exact = psExactRule(cmd);
  // THE COMMAND'S OWN RULE (Claude Code 2.1.322): an allow rule that is exactly this command (no wildcard; case aside)
  // allows it once the checks below have nothing to ask; for a command PowerShell could not read, at once, unless its
  // first word is a program by path or with a dot, or it names a network (UNC) path.
  const allow = rulesFor(rules.allow, "PowerShell").filter((x) => !onSetting(x));
  const ownRule = allow.some((r) => typeof r.spec === "string" && !r.spec.includes("*") && r.spec.trim().toLowerCase() === cmd.toLowerCase());
  if (ownRule && !p.valid && psNameType(cmd.split(/\s+/)[0] || "") !== "application" && !/(\\\\|\/\/)[^\\/\s]/.test(cmd)) return { verdict: "allow", why: "", suggest: null, readOnly: false, covered: true };
  // (Only a rule short enough to be kept, as Bash's cards: RULE_MAX.)
  const asks = (why, suggest = []) => { const keep = suggest.filter((r) => r.length <= RULE_MAX + 10); return auto ? { verdict: "allow", why, suggest: null, readOnly: false, covered: false } : { verdict: "ask", why, suggest: keep.length ? keep : null }; };
  if (!p.valid) return asks("Command contains malformed syntax that cannot be parsed: " + ((p.errors[0] && p.errors[0].message) || "unknown error"));
  const safety = psSafetyWhy(p) || psProviderWhy(p);
  if (safety) return asks(safety, exact);
  const compound = psCompoundWhy(p);
  if (compound) return asks(compound);
  // A FOLDER CHANGE WITH ANY OTHER COMMAND (Claude Code 2.1.322's PowerShell path check, its "Compound command contains cd
  // with path operation"; Bash docs pass 9: `cd; Get-Content .ssh/id_rsa` ran unasked): asked, whatever rule matches.
  if (all.length > 1 && all.some((c) => psCdish(c.name))) return asks(PS_CD_COMPOUND_WHY);
  if (psFileRedirections(p).length) return asks("Command contains file redirections that could write to arbitrary paths", exact);
  if (gone.ask) return asks(gone.ask);
  if (ownRule && all.length) return { verdict: "allow", why: "", suggest: null, readOnly: false, covered: true };
  // EACH COMMAND: one an allow rule covers (read ahead in full), or one that only reads, inside the working folders. A
  // program by path or with a dot (dotnet.exe, ./build.ps1) only by a rule whose first word names it, as typed (Claude
  // Code 2.1.322: "PowerShell(dotnet.exe build *)" pre-approves it; PowerShell(*) or PowerShell(dot*) never do).
  let covered = all.length > 0, readOnly = true, needs = false, outsideWhy = "";
  const need = [];
  for (const c of all) {
    // (Never a path outside the working folders, as Claude Code's path check runs before its rules: Bash docs pass 9.)
    const outside = psPathArgs(c).find((x) => !inside(x));
    let byRule = !psDynamicArgs(c) && (c.nameType !== "application" ? !!hit(allow, [c.text, [c.name, ...c.args].join(" ")]) : psProgramRule(c, allow));
    if (byRule && outside !== undefined) { byRule = false; outsideWhy ||= (psCmdlet(c.name) || String(c.name)) + " targeting '" + (pathAbs(String(outside).replace(/^['"]|['"]$/g, "")) || outside) + "' was blocked. For security, Coder may only access files in the allowed working directories for this session" + (dirs && dirs.length ? ": " + dirsText(dirs) : "") + "."; }
    const reads = psCommandReadOnly(c, { nativeReadOnly }) && psPathArgs(c).every((x) => inside(x) && !psQuoted(x));
    if (!byRule) covered = false;
    if (!reads) readOnly = false;
    if (!byRule && !reads) { needs = true; need.push(c.text); }
  }
  // (A statement that is not a plain pipeline of commands, such as an assignment or an if: approval.)
  const odd = p.statements.filter((s) => s.statementType !== "PipelineAst" || !s.commands.length || s.commands.some((c) => c.elementType !== "CommandAst"));
  if (odd.length) { needs = true; readOnly = false; covered = false; if (!need.length) for (const s of odd) if (String(s.text || "").trim() === cmd) need.push(s.text); }
  if (!needs) return { verdict: "allow", why: "", suggest: null, readOnly, covered };
  // ACCEPT EDITS: Claude Code's file commands (Set-Content, Add-Content, Remove-Item, Clear-Content) run there, with
  // the reading ones beside them, when every path they are given is inside the working folders.
  if (m === "acceptEdits" && byCommand !== false && psEditsOnly(p, all, { nativeReadOnly, inside })) return { verdict: "allow", why: "", suggest: null, readOnly: false, covered: false };
  return auto ? { verdict: "allow", why: "", suggest: null, readOnly: false, covered: false } : asks(outsideWhy || (all.some((c) => psPathArgs(c).some(psQuoted)) ? PS_QUOTED_WHY : ""), [...new Set(need.flatMap(psExactRule))]);
}
/** Claude Code's words for a PowerShell command that changes folder beside another one. */
export const PS_CD_COMPOUND_WHY = "Compound command changes working directory (Set-Location/Push-Location/Pop-Location/New-PSDrive) \u2014 relative paths cannot be validated against the original cwd and require manual approval";
/** A PowerShell command that changes the current folder: cd and its forms, Set-Location, Push-Location, Pop-Location, New-PSDrive. */
function psCdish(n) {
  const t = String(n).toLowerCase();
  if (t === "cd.." || t === "cd\\" || t === "cd/" || t === "cd~" || /^[a-z]:$/.test(t)) return true;
  const c = psCmdlet(n);
  return c === "set-location" || c === "push-location" || c === "pop-location" || c === "new-psdrive";
}

/**
 * A PATH WITH A QUOTE CHARACTER IN IT (Claude Code 2.1.322's path check; its docs: "A positional argument that contains a quote
 * character, such as the apostrophe in Set-Content .\notes.txt "It's done", still prompts even on in-scope paths, because Claude
 * Code can't statically validate an argument whose quoted and unquoted readings differ. Pass the content through a named
 * parameter such as -Value to avoid the prompt"): never one that only reads or that Accept edits lets through.
 */
const psQuoted = (x) => /['"\u2018-\u201F]/.test(String(x ?? ""));
export const PS_QUOTED_WHY = "Paths containing quote characters cannot be statically validated and require manual approval";
/** A word without the quotes around it (straight or curly), lower case. */
const psUnquoted = (w) => String(w ?? "").replace(/^['"\u2018-\u201F]+|['"\u2018-\u201F]+$/g, "").toLowerCase();
/** A text's first word as Claude Code reads it: a quoted one whole, with its quotes. */
function psFirstWord(t) {
  const s = String(t ?? "").trimStart(), q = s[0];
  if (q === '"' || q === "'") { const k = s.indexOf(q, 1); return s.slice(0, k === -1 ? s.length : k + 1); }
  return s.split(/\s+/)[0] ?? "";
}
/**
 * WHETHER AN ALLOW RULE COVERS A PROGRAM BY PATH OR WITH A DOT (Claude Code 2.1.322): the command is typed as its name (no
 * `& ` before it), and a rule that matches it starts with that same name.
 */
export function psProgramRule(c, allow) {
  const name = String(c.name ?? "").toLowerCase();
  if (!name || psUnquoted(psFirstWord(c.text)) !== name) return false;
  return allow.some((r) => typeof r.spec === "string" && psRuleMatches(r.spec, c.text) && psUnquoted(psFirstWord(r.spec)) === name);
}
/** Claude Code's questions about a command made of several: git next to a cd or an archive, a write into .git. */
function psCompoundWhy(p) {
  const all = psCommands(p).filter((c) => c.elementType === "CommandAst");
  const cdish = psCdish;
  const git = all.some((c) => psCmdlet(c.name) === "git");
  if (all.length > 1 && all.some((c) => cdish(c.name)) && git) return "Compound commands with cd/Set-Location and git require approval to prevent bare repository attacks";
  const WRITERS = new Set(["new-item", "set-content", "add-content", "out-file", "copy-item", "move-item", "rename-item", "expand-archive", "invoke-webrequest", "invoke-restmethod", "tee-object", "export-csv", "export-clixml"]);
  const targets = [...psRedirections(p).filter((r) => !r.isMerging).map((r) => r.target), ...all.filter((c) => WRITERS.has(psCmdlet(c.name))).flatMap((c) => c.args)];
  const norm = (t) => String(t).replace(/^['"]|['"]$/g, "").replace(/\\/g, "/").toLowerCase();
  if (git && targets.some((t) => /(^|\/)(\.git(\/|$)|head$|objects(\/|$)|refs(\/|$)|hooks(\/|$))/.test(norm(t)))) return "Command writes to a git-internal path (HEAD, objects/, refs/, hooks/, .git/) and runs git. This could plant a malicious hook that git then executes.";
  const ARCHIVES = new Set(["tar", "bsdtar", "unzip", "7z", "7za", "gzip", "gunzip", "expand-archive"]);
  if (all.length > 1 && all.some((c) => { const n = String(c.name).toLowerCase(), b = n.slice(Math.max(n.lastIndexOf("\\"), n.lastIndexOf("/")) + 1).replace(/\.exe$/, ""); return ARCHIVES.has(b); })) return git ? "Compound command extracts an archive and runs git. Archive contents may plant bare-repository indicators (HEAD, hooks/, refs/) that git then treats as the repository root." : "Compound command extracts an archive followed by other commands. Archive contents (symlinks, config files) cannot be validated and may redirect subsequent path operations.";
  if (targets.some((t) => /(^|\/)\.git(\/|$)/.test(norm(t)))) return "Command writes to .git/ \u2014 hooks or config planted there execute on the next git operation.";
  return "";
}
/**
 * REMOVE-ITEM (Claude Code's "Remove-Item in PowerShell", with rm, del, erase, rd, ri and rmdir): a system path (the
 * root, a folder at the top level, the home folder) or a wildcard target is refused in every mode; a recursive removal
 * of the working folder or a folder above it asks. A variable in a target counts as empty ($dir/* reaches the root).
 */
export function psRemovals(p, pieces = [], { pathAbs = () => null, cwd = "", home = "" } = {}) {
  const out = { deny: "", ask: "" };
  const known = (t) => String(t).replace(/^\$(env:)?(HOME|USERPROFILE)\b|^\$\{(env:)?(HOME|USERPROFILE)\}/i, home || "~").replace(/^\$PWD\b|^\$\{PWD\}/i, cwd || ".");
  const bare = (t) => known(t).replace(/\$\{[^}]*\}|\$(env:)?[A-Za-z_][\w]*(:[\w]+)?/g, "");
  const system = (abs) => !!abs && (abs === "/" || /^\/[^/]+\/?$/.test(abs) || (!!home && (abs === home || abs === home + "/")));
  const removals = p && p.valid
    ? psCommands(p).filter((c) => c.elementType === "CommandAst" && psCmdlet(c.name) === "remove-item")
    : pieces.map((t) => { const w = t.split(/\s+/).filter(Boolean); return { name: w[0] || "", args: w.slice(1), elementType: "CommandAst" }; }).filter((c) => psCmdlet(c.name) === "remove-item");
  for (const c of removals) {
    for (const t0 of psPathArgs(c)) {
      const t = String(t0).replace(/^['"]|['"]$/g, ""), b = bare(t).replace(/\\/g, "/");
      if (b === "*" || /\/\*$/.test(b)) { out.deny = psRemovalDenied(t0); return out; }
      for (const v of new Set([known(t).replace(/\\/g, "/"), b])) { if (v && system(pathAbs(v))) { out.deny = psRemovalDenied(t0); return out; } }
      if (!out.ask && psRecurse(c) && cwd) { const abs = pathAbs(b || "."); if (abs && (abs === cwd || cwd.startsWith(abs.endsWith("/") ? abs : abs + "/"))) out.ask = psRemovalWorkdir(t0); }
    }
  }
  return out;
}
/** Claude Code's Accept edits rule for PowerShell: only its file commands, and readers, all of it read ahead, paths inside. */
function psEditsOnly(p, all, { nativeReadOnly, inside }) {
  const f = psPatterns(p);
  if (f.hasSubExpressions || f.hasScriptBlocks || f.hasMemberInvocations || f.hasSplatting || f.hasAssignments || f.hasStopParsing || f.hasExpandableStrings) return false;
  const EDITS = new Set(["set-content", "add-content", "remove-item", "clear-content"]);
  const link = (c) => psCmdlet(c.name) === "new-item" && c.args.some((a, i) => /^[-\u2013\u2014\u2015/]it/i.test(a) && /^(symboliclink|junction|hardlink)/i.test(String(a.includes(":") ? a.slice(a.indexOf(":") + 1) : c.args[i + 1] || "").replace(/^['"]/, "")));
  if (all.some(link)) return false;
  const cdish = (c) => ["set-location", "push-location", "pop-location", "new-psdrive"].includes(psCmdlet(c.name));
  if (all.length > 1 && all.some(cdish) && all.some((c) => EDITS.has(psCmdlet(c.name)))) return false;
  for (const c of all) {
    if (c.nameType === "application") return false;
    if (psDynamicArgs(c) || psWritesState(c)) return false;
    const n = psCmdlet(c.name);
    if (n === "out-null" && c.args.length === 0) continue;
    if (PS_FORMATTERS.has(n) || n === "measure-object" || n === "out-string" || n === "out-host") { if (psCommandReadOnly(c, { nativeReadOnly })) continue; return false; }
    if (psCommandReadOnly(c, { nativeReadOnly }) && psPathArgs(c).every((x) => inside(x) && !psQuoted(x))) continue;
    if (!EDITS.has(n)) return false;
    if (!psPathArgs(c).every((x) => inside(x) && !psQuoted(x))) return false;
  }
  return true;
}

// ── WHAT CODER IS TOLD ───────────────────────────────────────────────────────
// Claude Code's own words (2.1.319), with "the owner" for the user.
export const REJECTED = "The owner doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the owner to tell you how to proceed.";
export const REJECTED_SAID = "The owner doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). To tell you how to proceed, the owner said:\n";
export const NOT_NOW = "The owner doesn't want to take this action right now. STOP what you are doing and wait for the owner to tell you how to proceed.";
/**
 * Plan mode's note, its end, and an approved plan's answer: Claude Code's own words, in coder-plan.mjs since its plan file
 * (the owner, 2026-11-14: "Do all the talk to you tools execpt for the notify one"); given on here under their old names.
 */
export { PLAN_NOTE, PLAN_EXITED, planApproved } from "./coder-plan.mjs";
/**
 * Auto mode (Claude Code 2.1.325's auto mode reminder, "## Auto Mode Active", as a model not trained for auto mode gets it
 * whole), with Coder's names; its parts behind Anthropic's own server flags (the bash-first steer, finishing exposed work,
 * held consent asks) are left out. (Before 2026-11-14, Coder had the older "The user chose continuous, autonomous
 * execution" text, which 2.1.325 keeps only for its Proactive output style.)
 */
export const AUTO_NOTE = "## Auto Mode Active\n\nBias toward working without stopping for clarifying questions \u2014 when you'd normally pause to check, make the reasonable call and keep going; they'll redirect you if needed. If the owner, a skill, or the shape of the task suggests they want you to ask (with ask_user or otherwise), do so. And even absent that signal, it's still fine to stop when you're genuinely blocked \u2014 unclear direction, missing input, a decision only they can make.\n\nBefore any command that could discard uncommitted work \u2014 `git checkout`/`restore`/`reset`/`clean`, `rm -rf` in the repo, restoring from a snapshot \u2014 run `git status` first and stash (with `-u` for untracked) or commit anything that's there. When staging or committing, review what's included (`git status` after a broad `git add`), and if you see anything suspicious that might reveal secrets \u2014 even if the filename looks innocuous \u2014 double-check the file's contents before pushing.";
export const AUTO_EXITED = "## Exited Auto Mode\n\nYou have exited auto mode. The owner may now want to interact more directly. You should ask clarifying questions when the approach is ambiguous rather than making assumptions.";
