// A SECURITY CHECK ON EACH EDIT, LIKE CLAUDE CODE'S (owner, 2026-11-07, item 12: "nothing checks each
// edit as Coder writes"; Claude Code's security-guidance docs, read 2026-11-07: "When Claude writes to a
// file, the plugin scans the new content for known risky patterns. This is a pattern match with no
// model call ... appends the warning to Claude's context for the next step. Each warning fires once per
// pattern per file per session"). What Coder writes (write) or puts in (edit) is matched against
// risky patterns; a warning goes back with that tool's answer, so Coder fixes it, or says why it is safe.
// It never blocks a write. A repo adds its own rules in .coder/security-patterns.json, .yaml or .yml
// (Claude Code's .claude/security-patterns.yaml, with the same fields), up to 50.

import { globMatch } from "./coder-globs.mjs";

export const RULES_MAX = 50;
export const REMINDER_MAX = 1024;

/** Coder's own rules (Claude Code names these kinds: dynamic code, unsafe deserialization, DOM injection, workflow files). */
export const BUILTIN_RULES = [
  { rule_name: "eval", regex: /(^|[^.\w$])eval\s*\(/m, reminder: "Dynamic code execution: eval() runs any text as code. Use a parser or a lookup instead; never let it see anything from outside." },
  { rule_name: "new_function", regex: /\bnew\s+Function\s*\(/, reminder: "Dynamic code execution: new Function() builds code from text, like eval(). Avoid it." },
  { rule_name: "os_system", regex: /\bos\.(system|popen)\s*\(/, reminder: "A shell command from Python (os.system/os.popen): anything joined into it can run commands. Use subprocess.run([...]) with a list and no shell." },
  { rule_name: "shell_true", regex: /\bsubprocess\.\w+\([^)]*\bshell\s*=\s*True/, reminder: "subprocess with shell=True: anything joined into the command can run other commands. Pass a list of arguments without the shell." },
  { rule_name: "child_process_exec", regex: /child_process\.exec(Sync)?\s*\(|require\(\s*["'](node:)?child_process["']\s*\)\.exec(Sync)?\b|\b(exec|execSync)\b[^;\n]*\bfrom\s+["'](node:)?child_process["']/, reminder: "child_process.exec runs a shell: anything joined into the command can run other commands. Use execFile/spawn with a list of arguments." },
  { rule_name: "pickle", regex: /\b(c?[Pp]ickle|marshal|shelve)\.(loads?|Unpickler)\b/, reminder: "Unsafe deserialization: loading pickle/marshal data can run code. Never load it from anywhere you do not control; use JSON." },
  { rule_name: "yaml_load", regex: /\byaml\.load\s*\((?![^)]*Loader\s*=\s*(yaml\.)?(Safe|Base)Loader)/, reminder: "Unsafe deserialization: yaml.load without SafeLoader can build any object. Use yaml.safe_load." },
  { rule_name: "dangerously_set_inner_html", regex: /dangerouslySetInnerHTML/, reminder: "DOM injection: dangerouslySetInnerHTML puts raw HTML on the page. Render text, or clean the HTML with a sanitizer first." },
  { rule_name: "inner_html", regex: /\.(inner|outer)HTML\s*\+?=(?!=)|\binsertAdjacentHTML\s*\(/, reminder: "DOM injection: setting innerHTML/outerHTML (or insertAdjacentHTML) with anything from outside runs its scripts. Use textContent, or build the elements." },
  { rule_name: "document_write", regex: /\bdocument\.write(ln)?\s*\(/, reminder: "DOM injection: document.write puts raw HTML on the page. Build the elements instead." },
  { rule_name: "sql_from_text", regex: /\.(execute|executemany|query|raw)\s*\(\s*(f["']|["'][^"'\n]*["']\s*(\+|%)|`[^`]*\$\{)/, reminder: "Injection: a database query built by joining text. Use the driver's placeholders (?, %s, $1) and pass the values separately." },
  { rule_name: "private_key", regex: /-----BEGIN (RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/, reminder: "A private key written into a file. Keys belong in Environment's saved keys, never in the repository." },
  { rule_name: "workflow_file", paths: [".github/workflows/**"], reminder: "A GitHub workflow file: it can give the repository's tokens and secrets to whatever it runs. Keep `permissions:` small, never put ${{ github.event.* }} text straight into a `run:` line (pass it through env), and avoid pull_request_target with the pull request's code." },
];

/** The new text of an edit (write: the whole file; edit: what goes in). */
export function editedText(tool, args) {
  const a = args || {};
  if (tool === "write") return typeof a.content === "string" ? a.content : "";
  if (tool === "edit") return typeof a.new_string === "string" ? a.new_string : "";
  return null;
}

/** A rule as the repo wrote it, checked: { rule_name, regex | substrings, paths?, exclude_paths?, reminder }; else null. */
export function cleanRule(r) {
  if (!r || typeof r !== "object") return null;
  const name = String(r.rule_name || "").trim().slice(0, 80);
  const reminder = String(r.reminder || "").trim().slice(0, REMINDER_MAX);
  if (!/^[\w.-]{1,80}$/.test(name) || !reminder) return null;
  const list = (x) => (Array.isArray(x) ? x : typeof x === "string" ? [x] : []).map((v) => String(v)).filter((v) => v && v.length <= 300).slice(0, 20);
  const out = { rule_name: "repo:" + name, reminder };
  if (typeof r.regex === "string" && r.regex) {
    if (r.regex.length > 500) return null;
    try { out.regex = new RegExp(r.regex.replace(/^\(\?i\)/, ""), /^\(\?i\)/.test(r.regex) ? "im" : "m"); } catch { return null; }
  } else {
    const subs = list(r.substrings);
    if (!subs.length) return null;
    out.substrings = subs;
  }
  const paths = list(r.paths), skip = list(r.exclude_paths);
  if (paths.length) out.paths = paths;
  if (skip.length) out.exclude_paths = skip;
  return out;
}

/**
 * THE REPO'S OWN RULES FILE: JSON ({ "patterns": [...] }), or the YAML Claude Code's docs show (a
 * `patterns:` list of `key: value` items; values quoted or not, lists [a, b] or "- a" lines).
 * Answers the rules, checked (cleanRule).
 */
export function parseRulesFile(text, kind) {
  let raw = [];
  if (kind === "json") {
    try { const j = JSON.parse(text); raw = Array.isArray(j) ? j : Array.isArray(j && j.patterns) ? j.patterns : []; } catch { raw = []; }
  } else raw = yamlPatterns(String(text));
  return raw.map(cleanRule).filter(Boolean).slice(0, RULES_MAX);
}

function scalar(v) {
  v = v.trim();
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) { try { return JSON.parse(v); } catch { return v.slice(1, -1); } }
  if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) return v.slice(1, -1).replace(/''/g, "'");
  return v.replace(/\s+#.*$/, "");
}
function flowList(v) {
  const inner = v.trim().replace(/^\[|\]$/g, "");
  const out = []; let cur = "", q = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (q) { cur += c; if (c === "\\" && q === '"') { cur += inner[++i] || ""; continue; } if (c === q) q = ""; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === ",") { if (cur.trim()) out.push(scalar(cur)); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(scalar(cur));
  return out;
}
function yamlPatterns(text) {
  const lines = text.split(/\r?\n/);
  const items = [];
  let inList = false, item = null, listKey = "";
  for (const line of lines) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (/^patterns\s*:\s*$/.test(line)) { inList = true; continue; }
    if (!inList) continue;
    if (/^\S/.test(line)) { inList = false; continue; }
    const start = /^\s*-\s+([\w-]+)\s*:\s*(.*)$/.exec(line);
    const kv = /^\s+([\w-]+)\s*:\s*(.*)$/.exec(line);
    const dash = /^\s+-\s+(.*)$/.exec(line);
    if (start) { item = {}; items.push(item); listKey = ""; set(start[1], start[2]); }
    else if (kv && item) { listKey = ""; set(kv[1], kv[2]); }
    else if (dash && item && listKey) item[listKey].push(scalar(dash[1]));
  }
  function set(k, v) {
    if (!v.trim()) { item[k] = []; listKey = k; return; }
    item[k] = v.trim().startsWith("[") ? flowList(v) : scalar(v);
  }
  return items;
}

/** Does a rule apply to this file (project-relative path)? */
function forFile(rule, rel) {
  if (rule.exclude_paths && rule.exclude_paths.some((g) => globMatch(g, rel))) return false;
  return !rule.paths || rule.paths.some((g) => globMatch(g, rel));
}

/**
 * THE CHECK OF ONE EDIT: `rel` the file (project-relative), `text` what went in. Each rule's warning
 * once a job for each file (`shown`). A rule with only `paths` (a workflow file) fires on any edit
 * there. Answers the text for Coder, or "".
 */
export function checkEdit(rel, text, rules, shown) {
  if (typeof text !== "string" || !rel) return "";
  const hits = [];
  for (const r of rules) {
    const key = r.rule_name + " " + rel;
    if (shown.has(key) || !forFile(r, rel)) continue;
    const hit = r.regex ? r.regex.test(text) : r.substrings ? r.substrings.some((s) => text.includes(s)) : !!r.paths;
    if (!hit) continue;
    shown.add(key);
    hits.push("- " + r.rule_name + ": " + r.reminder);
  }
  return hits.length ? "SECURITY CHECK of this edit to " + rel + " (Coder's check on each edit; it blocks nothing):\n" + hits.join("\n") + "\nFix it now unless it is safe here; if it is, say why in your answer." : "";
}
