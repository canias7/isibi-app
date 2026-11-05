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
export const MAX_COMMAND_CHARS = 8000;
export const MAX_OUTPUT_CHARS = 12000;
export const DEFAULT_TIMEOUT_S = 120;
export const MAX_TIMEOUT_S = 600;

// Each: [pattern, why]. Read against the command as typed.
const REFUSED = [
  [/\brm\s+(-[a-zA-Z]*\s+)*(\/|~|\/\*|\$HOME)(\s|$)/, "it would delete the whole machine or home folder"],
  [/\brm\s+(-[a-zA-Z]*\s+)*\.\.(\/|\s|$)/, "it would delete outside the project"],
  [/:\(\)\s*\{\s*:\|:&\s*\};:/, "it is a fork bomb"],
  [/\b(mkfs|fdisk|parted)\b/, "it formats disks"],
  [/\bdd\s+[^|;&]*of=\/dev\//, "it writes straight to a device"],
  [/\b(shutdown|reboot|halt|poweroff)\b/, "it stops the machine"],
  [/\/proc\/[0-9a-z]+\/environ\b/, "it reads another process's secrets"],
  [/\bkill\s+-9\s+1\b|\bkill\s+(-[A-Z0-9]+\s+)?-1\b|\bpkill\s+(-[a-z0-9]+\s+)*node\b/, "it would stop Coder itself"],
  [/\b(chmod|chown)\s+(-R\s+)?[^ ]*\s+\/(\s|$)/, "it changes the whole machine's permissions"],
  [/\b(sudo|su)\s/, "commands already run with the rights they need"],
];

/** Why this command may not run ("" when it may). */
export function commandProblem(command) {
  const c = typeof command === "string" ? command : "";
  if (!c.trim()) return "the command is empty";
  if (c.length > MAX_COMMAND_CHARS) return "the command is over " + MAX_COMMAND_CHARS + " characters; write long files in several steps";
  for (const [re, why] of REFUSED) if (re.test(c)) return "refused: " + why;
  return "";
}

/** The environment a command runs with: nothing from the container's own, so no key is ever in reach. */
export function cleanEnv(home) {
  return {
    PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    HOME: home || PROJECT_ROOT,
    LANG: "C.UTF-8",
    TERM: "dumb",
    CI: "1",
    NO_COLOR: "1",
    npm_config_update_notifier: "false",
    npm_config_fund: "false",
    npm_config_audit: "false",
  };
}

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

/** What a command printed, bounded: the head and the tail, the cut said. */
export function capOutput(text, max = MAX_OUTPUT_CHARS) {
  const t = scrub(text);
  if (t.length <= max) return t;
  const head = Math.floor(max * 0.6), tail = max - head;
  return t.slice(0, head) + "\n… [" + (t.length - head - tail) + " characters not shown] …\n" + t.slice(t.length - tail);
}

/** A project id: lowercase letters, digits and dashes. */
export const PROJECT_ID = /^[a-z0-9][a-z0-9-]{2,40}$/;
