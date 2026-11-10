// CODER'S SAFETY CHECKS (2026-11-05, the owner: "make sure u do everything in a
// different files, dont mix with the sites agent"). Plain functions, no I/O.
//
// Coder works like a developer at a terminal: one `bash` command at a time,
// inside its own container, in its project's folder. These checks are what
// stands between the model's command and the shell:
//
//   commandProblem  a command that could break the sandbox, read its secrets,
//                   or never end is refused before it runs, with the reason.
//   cleanEnv        every command runs with a bare environment: the container's
//                   own keys (the model key) are never visible to a command.
//   capOutput       what a command printed is cut to a bounded head and tail,
//                   the cut said in words, never silent.
//   scrub           anything shaped like a key is blanked before the model or
//                   the owner sees it.

export const PROJECT_ROOT = "/work";
/**
 * A COMMAND OVER 10,000 CHARACTERS IS ASKED ABOUT (Claude Code's permissions docs: "Commands longer than 10,000 characters
 * always prompt because they exceed what the analysis parses"; Coder refused any over 8,000), on a card; one past
 * COMMAND_HARD_MAX is never run (write long files with the write tool).
 */
export const MAX_COMMAND_CHARS = 10_000;
export const COMMAND_HARD_MAX = 100_000;
export const MAX_OUTPUT_CHARS = 12000;
export const DEFAULT_TIMEOUT_S = 120;
export const MAX_TIMEOUT_S = 600;
/**
 * THE SETUP SCRIPT'S LIMIT, 64 KB (like Claude Code's): what Environment takes is all that runs.
 * (Live comparison, 2026-11-07: settings took 64 KB, but the machine ran only the first 20,000 characters.)
 */
export const SETUP_SCRIPT_MAX = 65536;

// Each: [pattern, why]. Read against the command as typed.
const REFUSED = [
  // Removals are read as Claude Code reads them (coder-bashcheck.mjs, dangerousRm), with its words.
  [/:\(\)\s*\{\s*:\|:&\s*\};:/, "it is a fork bomb"],
  [/\b(mkfs|fdisk|parted)\b/, "it formats disks"],
  [/\bdd\s+[^|;&]*of=\/dev\//, "it writes straight to a device"],
  [/\b(shutdown|reboot|halt|poweroff)\b/, "it stops the machine"],
  [/\/proc\/[0-9a-z]+\/environ\b/, "it reads another process's secrets"],
  // (`pkill node` was refused here too, from before the commands' own sandbox: they can't see Coder's service, and Claude
  // Code refuses only a pkill pattern that matches its own process. Bash docs pass 5.)
  [/\bkill\s+-9\s+1\b|\bkill\s+(-[A-Z0-9]+\s+)?-1\b/, "it would stop Coder itself"],
  [/\b(chmod|chown)\s+(-R\s+)?[^ ]*\s+\/(\s|$)/, "it changes the whole machine's permissions"],
  // `sudo` reaches only the master key's checked jobs (step 4, tools/sudo); `su` stays refused.
  [/\bsu\s/, "commands already run with the rights they need"],
];

/** Why this command may not run ("" when it may). */
/**
 * A RAW CONTROL CHARACTER IN A COMMAND (Claude Code: its Bash tool refuses "a raw control character other than a tab or
 * newline": "Command contains control characters that would be hidden in the approval dialog"). In Coder the owner reads
 * the command in the chat and on its card, where such a character would hide part of it.
 */
export const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/;
export const CONTROL_REFUSED = "Command contains control characters that would be hidden in the approval dialog (in Coder, the chat and the owner's card show the command). Write them as escapes instead, such as printf '\\033[1m' or $'\\r'.";
export function commandProblem(command) {
  const c = typeof command === "string" ? command : "";
  if (!c.trim()) return "the command is empty";
  if (c.length > COMMAND_HARD_MAX) return "the command is over " + COMMAND_HARD_MAX.toLocaleString("en-US") + " characters; write long files with the write tool, in several steps";
  if (CONTROL_CHARS.test(c)) return CONTROL_REFUSED;
  for (const [re, why] of REFUSED) if (re.test(c)) return "refused: " + why;
  return "";
}

/** Root's own folders: the only ones on the PATH of a command run as root. */
export const SYSTEM_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
/** The AI's home on Coder's machine, unless the service is given another (Fly.io: one on the chat's kept disk). */
export const DEV_HOME = "/home/dev";

/**
 * The environment a command runs with: nothing from the container's own, so no
 * key is ever in reach.
 *
 * ALL OF CLAUDE CODE'S TOOLS (owner, 2026-11-07: "can we install all the tools
 * we need?"): the AI's commands find every tool on the machine (Node 22 first,
 * like Claude Code's machine; Ruby through rbenv; Go; Rust; Java; Chrome;
 * Docker without admin rights), and what they install for themselves (npm -g,
 * pip, gem, cargo install, go install) and every download cache go in their
 * own home, never in the project. The home was the project folder itself, so a
 * cache could have been saved to the branch.
 *
 * A command run as root (`root: true`: the setup script's apt lines) gets
 * root's own folders only, never a folder the AI's user can write to, where it
 * could leave a program for root to run.
 */
export function cleanEnv(home, { root = false } = {}) {
  const base = {
    LANG: "C.UTF-8",
    TERM: "dumb",
    CI: "1",
    NO_COLOR: "1",
    npm_config_update_notifier: "false",
    npm_config_fund: "false",
    npm_config_audit: "false",
  };
  if (root) return { PATH: SYSTEM_PATH, HOME: "/root", ...base };
  const h = home || DEV_HOME;
  return {
    // Ubuntu's own end of a user's PATH too (live test, 2026-11-08: cowsay, installed with apt-get, is in /usr/games).
    PATH: [h + "/.local/bin", h + "/.npm-global/bin", h + "/.cargo/bin", h + "/go/bin", "/opt/rbenv/shims", "/opt/node22/bin", "/opt/cargo/bin", "/usr/local/go/bin", SYSTEM_PATH, "/usr/games", "/usr/local/games"].join(":"),
    HOME: h,
    ...base,
    npm_config_prefix: h + "/.npm-global",
    PIP_BREAK_SYSTEM_PACKAGES: "1",
    RBENV_ROOT: "/opt/rbenv",
    RUSTUP_HOME: "/opt/rustup",
    CARGO_HOME: h + "/.cargo",
    GOPATH: h + "/go",
    JAVA_HOME: "/usr/lib/jvm/java-21-openjdk-amd64",
    CHROME_PATH: "/usr/bin/google-chrome",
    // require("playwright") from any folder, with the browsers the image installed (like Claude Code's machine).
    NODE_PATH: "/opt/node22/lib/node_modules",
    PLAYWRIGHT_BROWSERS_PATH: "/opt/pw-browsers",
    NVM_DIR: h + "/.nvm",
    XDG_RUNTIME_DIR: h + "/.docker-run",
    DOCKER_HOST: "unix://" + h + "/.docker-run/docker.sock",
  };
}

/**
 * PGREP, PKILL AND PIDWAIT LEAVE THE COMMAND'S OWN SHELLS OUT (Bash docs pass 5; Claude Code 2.1.321: "Fixed `pkill`,
 * `pgrep` and `pidwait` in cloud sessions matching the session's own parent processes"; its shell snapshot shadows them
 * with functions that add procps' --ignore-ancestors when the installed one knows it). Each command runs as
 * `bash -c "<the command>"`, so before this `pgrep -f vite` always found its own shell, and `pkill -f "npm run dev"` ended the
 * very command that ran it. (Here, not in server.mjs, whose root never runs these: a root-safety test keeps it so.)
 */
export const PROC_WRAPPERS = ["pkill", "pgrep", "pidwait"].map((n) => [
  "unalias " + n + " 2>/dev/null || true",
  "if command -v " + n + " >/dev/null 2>&1; then",
  "  function " + n + " {",
  '    case "$(command ' + n + ' --help 2>&1)" in',
  '      *--ignore-ancestors*) set -- --ignore-ancestors ${1+"$@"} ;;',
  "    esac",
  "    command " + n + ' ${1+"$@"}',
  "  }",
  "fi",
].join("\n")).join("\n") + "\n";
/** A timeout in seconds the model asked for, bounded. */
export function readTimeout(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_S;
  return Math.min(Math.round(n), MAX_TIMEOUT_S);
}

const KEYISH = [
  /\b(?:sk|pk|rk|whsec)_(?:live|test)_[A-Za-z0-9]{6,}\b/g,
  /\b(?:xai|sk-ant|sk-proj|sk)-[A-Za-z0-9_-]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g,
];
/** Anything shaped like a key, blanked. */
export function scrub(text) {
  let t = String(text == null ? "" : text);
  for (const re of KEYISH) t = t.replace(re, "[hidden]");
  return t;
}

/**
 * A COMMAND'S RESULT, AS CLAUDE CODE GIVES IT (its tools reference, Output limits, and Claude Code 2.1.319 itself, tried
 * on 2026-11-09): a command that worked comes back inline up to 30,000 characters ("(Bash completed with no output)"
 * when it printed nothing); past that, "<persisted-output>\nOutput too large (38KB). Full output saved to: <file>\n\n
 * Preview (first 2KB):\n…\n...\n</persisted-output>". A failure is "Exit code N" and its output, up to 10,000
 * characters; past that the first and last 5,000 of the first 30,000 read back, "... [N characters truncated] ...",
 * with no file. `isError`: from exitMeaning (grep's exit 1 is no failure).
 */
export const BASH_INLINE_MAX = 30_000, BASH_FAIL_MAX = 10_000, BASH_READ_BACK = 30_000, BASH_PREVIEW = 2_000;
export function kbSize(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  const one = (x) => x.toFixed(1).replace(/\.0$/, "");
  return n < 1024 ? n + " bytes" : n < 1024 * 1024 ? one(n / 1024) + "KB" : n < 1024 ** 3 ? one(n / 1024 / 1024) + "MB" : one(n / 1024 ** 3) + "GB";
}
/**
 * `inlineMax` and `readBack`: the environment's sizes (Coder's machine, bashOutputLimits; Claude Code's bashOutputMaxChars and
 * BASH_MAX_OUTPUT_LENGTH), 30,000 each by default. A read-back window smaller than what a command that worked printed keeps
 * its start, " ... [N lines truncated] ...", as Claude Code 2.1.319 does.
 */
export function bashResultText({ output = "", isError = false, code = 0, size = null, file = "", inlineMax = BASH_INLINE_MAX, readBack = BASH_READ_BACK }) {
  // The output's last line break is no part of what is shown (Claude Code, tried: "2c2\n< b\n---\n> c" from diff).
  const text = scrub(output).replace(/\n+$/, "");
  const total = Number.isFinite(size) && size !== null ? size : Buffer.byteLength(text);
  const inline = Number.isInteger(inlineMax) && inlineMax > 0 ? inlineMax : BASH_INLINE_MAX;
  const back = Number.isInteger(readBack) && readBack > 0 ? readBack : BASH_READ_BACK;
  if (!isError) {
    if (!text.length) return "(Bash completed with no output)";
    if (text.length <= inline && !(file && total > inline)) {
      if (text.length <= back) return text;
      const rest = text.slice(back).split("\n").length;
      return text.slice(0, back) + " ... [" + rest + " lines truncated] ...";
    }
    const preview = text.slice(0, BASH_PREVIEW);
    return file
      ? "<persisted-output>\nOutput too large (" + kbSize(total) + "). Full output saved to: " + file + "\n\nPreview (first 2KB):\n" + preview + "\n...\n</persisted-output>"
      : capOutput(text, inline);
  }
  const full = "Exit code " + code + "\n" + text.slice(0, back);
  if (full.length <= BASH_FAIL_MAX) return full.replace(/\n$/, "");
  return full.slice(0, BASH_FAIL_MAX / 2) + "\n\n... [" + (full.length - BASH_FAIL_MAX) + " characters truncated] ...\n\n" + full.slice(-BASH_FAIL_MAX / 2);
}

/** What a command printed, bounded: the head and the tail, the cut said. */
export function capOutput(text, max = MAX_OUTPUT_CHARS) {
  const t = scrub(text);
  if (t.length <= max) return t;
  const head = Math.floor(max * 0.6), tail = max - head;
  return t.slice(0, head) + "\n… [" + (t.length - head - tail) + " characters not shown] …\n" + t.slice(t.length - tail);
}

/** A project id: lowercase letters, digits and dashes. */
export const PROJECT_ID = /^[a-z0-9][a-z0-9-]{2,40}$/;

// SYSTEM PACKAGES IN THE SETUP SCRIPT (owner, 2026-11-06: "do the 3 of them";
// like Claude Code, where the setup script runs as root and `apt install`
// works). Coder's setup script runs as `dev`, so that a script can never reach
// the GitHub token or the owner's keys, which live on the same machine as root.
// Instead, its plain package lines are taken out and done by Coder's service
// itself, as root: only checked package names reach apt, never a shell line
// from the script. Everything else in the script still runs as `dev`.
/** A Debian package name (optionally with =version). */
export const APT_NAME_RE = /^[a-z0-9][a-z0-9+.-]{1,99}(?:=[A-Za-z0-9.+~:-]{1,60})?$/;
const APT_FLAG_RE = /^(?:-y|--yes|--assume-yes|-q|-qq|--quiet|--no-install-recommends)$/;
/** One `apt-get update` / `apt-get install -y …` (with sudo or env settings in front), or null. */
function aptPart(part) {
  const w = part.trim().split(/\s+/).filter(Boolean);
  while (w.length && (w[0] === "sudo" || w[0] === "-E" || /^[A-Z_][A-Z0-9_]*=[\w.:/-]*$/.test(w[0]))) w.shift();
  if (w[0] !== "apt-get" && w[0] !== "apt") return null;
  const rest = w.slice(1);
  if (!rest.every((x) => !x.startsWith("-") || APT_FLAG_RE.test(x))) return null;
  const words = rest.filter((x) => !x.startsWith("-"));
  if (words[0] === "update" && words.length === 1) return [];
  if (words[0] === "install" && words.length > 1 && words.slice(1).every((x) => APT_NAME_RE.test(x))) return words.slice(1);
  return null;
}
/** The setup script split in two: the packages its plain apt lines install (done as root by Coder's service) and the rest (run as `dev`). */
export function splitSetup(script) {
  const packages = [], rest = [];
  const lines = String(script == null ? "" : script).replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    // A command over several lines (ending in \) is read as one; anything that
    // is not a package line is kept exactly as written.
    const group = [lines[i]];
    while (/\\$/.test(group[group.length - 1]) && i + 1 < lines.length) group.push(lines[++i]);
    const t = group.map((l) => l.replace(/\\$/, "")).join(" ").replace(/\s+#.*$/, "").trim();
    const parts = t ? t.split(/\s*(?:&&|;)\s*/).filter(Boolean) : [];
    const got = parts.map(aptPart);
    if (parts.length && got.every((x) => x !== null)) { for (const g of got) packages.push(...g); continue; }
    rest.push(...group);
  }
  return { packages: [...new Set(packages)].slice(0, 50), script: rest.join("\n").trim() };
}
