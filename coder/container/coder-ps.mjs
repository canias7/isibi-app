// THE POWERSHELL TOOL (Bash docs pass 6, the owner, 2026-11-10: "yea do all of them"): Claude Code's PowerShell tool, which
// is opt-in on Linux ("Linux, macOS, and WSL: the tool is opt-in"; "Set CLAUDE_CODE_USE_POWERSHELL_TOOL=1"; "the tool requires
// PowerShell 7 or later: install pwsh"), here with the environment's CODER_USE_POWERSHELL_TOOL, on the full machine image,
// which has pwsh. Its description (Claude Code 2.1.322's own, with Coder's tool names), its rules ("PowerShell permission rules
// use the same shape as Bash rules … Common aliases are canonicalized before matching … Matching is case-insensitive"; "Pipeline
// operators |, statement separators ;, and on PowerShell 7+ the chain operators && and || split a compound command into
// subcommands. Every subcommand must be allowed"), and how it runs: "-ExecutionPolicy Bypass at process scope only" unless
// CODER_POWERSHELL_RESPECT_EXECUTION_POLICY, -NonInteractive, stdin from the null device, no profile, plain-text errors, and
// "Working directory persists between commands; shell state (variables, functions) does not".
//
// No node: modules here (Coder's Worker loads coder-perms.mjs, which uses this file).

/** Claude Code's common aliases, canonicalized before a rule matches ("PowerShell(Get-ChildItem *) matches gci, ls, and dir"). */
export const PS_ALIASES = Object.freeze({
  ls: "get-childitem", dir: "get-childitem", gci: "get-childitem",
  cd: "set-location", sl: "set-location", chdir: "set-location",
  cat: "get-content", gc: "get-content", type: "get-content",
  rm: "remove-item", del: "remove-item", erase: "remove-item", rd: "remove-item", ri: "remove-item", rmdir: "remove-item",
  cp: "copy-item", copy: "copy-item", cpi: "copy-item", mv: "move-item", move: "move-item", mi: "move-item",
  echo: "write-output", write: "write-output", pwd: "get-location", gl: "get-location", sls: "select-string",
  gi: "get-item", gp: "get-itemproperty", ni: "new-item", sort: "sort-object", select: "select-object", where: "where-object",
  "?": "where-object", foreach: "foreach-object", "%": "foreach-object", measure: "measure-object", ft: "format-table",
  fl: "format-list", gm: "get-member", gcm: "get-command", ps: "get-process", gps: "get-process", kill: "stop-process",
  spps: "stop-process", iex: "invoke-expression", icm: "invoke-command", saps: "start-process", start: "start-process",
  ac: "add-content", clc: "clear-content", cls: "clear-host", clear: "clear-host", h: "get-history", history: "get-history",
  irm: "invoke-restmethod", iwr: "invoke-webrequest", man: "get-help", help: "get-help", diff: "compare-object",
  compare: "compare-object", tee: "tee-object", sleep: "start-sleep",
});
/** A command word as a rule sees it: its cmdlet's name for an alias, lowercase. */
export const psCanon = (w) => { const x = String(w || "").toLowerCase(); return PS_ALIASES[x] || x; };

/**
 * A COMMAND'S PARTS: split at |, ;, && and || and new lines, outside quotes ('…' with '' inside, "…" with ` escapes),
 * braces and parentheses (a script block or a sub-expression stays whole with its part).
 */
export function psParts(command) {
  const s = String(command ?? ""), out = [];
  let cur = "", q = "", depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      cur += ch;
      if (q === '"' && ch === "`" && i + 1 < s.length) { cur += s[++i]; continue; }
      if (ch === q) { if (q === "'" && s[i + 1] === "'") { cur += s[++i]; continue; } q = ""; }
      continue;
    }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if (ch === "`" && i + 1 < s.length) { cur += ch + s[++i]; continue; }
    if (ch === "{" || ch === "(") { depth++; cur += ch; continue; }
    if ((ch === "}" || ch === ")") && depth > 0) { depth--; cur += ch; continue; }
    if (depth === 0) {
      const two = s.slice(i, i + 2);
      if (two === "&&" || two === "||") { out.push(cur); cur = ""; i++; continue; }
      if (ch === "|" || ch === ";" || ch === "\n" || ch === "\r") { out.push(cur); cur = ""; continue; }
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}
/**
 * EVERY PART OF A POWERSHELL COMMAND, those inside $( ), @( ) and { } too (Bash docs pass 8: a hook's `if`, such as Claude
 * Code's own example "PowerShell(Remove-Item *)", checks each command the input runs, as a Bash `if` does). Single-quoted text
 * is never looked into (PowerShell never expands it); double-quoted text is, as PowerShell runs a $( ) there.
 */
export function psAllParts(command) {
  const out = [];
  const walk = (text, depth) => {
    if (depth > 6 || out.length > 400) return;
    for (const part of psParts(text)) {
      out.push(part);
      const s = String(part);
      for (let i = 0; i < s.length; i++) {
        const opens = s[i] === "{" ? "{" : s[i] === "(" && (s[i - 1] === "$" || s[i - 1] === "@") ? "(" : "";
        if (!opens) { if (s[i] === "'") { const k = s.indexOf("'", i + 1); if (k < 0) break; i = k; } continue; }
        const shut = opens === "(" ? ")" : "}";
        let d = 0, j = i;
        for (; j < s.length; j++) {
          if (s[j] === "'") { const k = s.indexOf("'", j + 1); if (k < 0) { j = s.length; break; } j = k; continue; }
          if (s[j] === opens) d++;
          else if (s[j] === shut && --d === 0) break;
        }
        if (j >= s.length) break;
        walk(s.slice(i + 1, j), depth + 1);
        i = j;
      }
    }
  };
  walk(String(command || ""), 0);
  return out;
}
/** A part's first word, as typed. */
export const psFirst = (part) => (String(part || "").trim().match(/^[^\s]+/) || [""])[0];

// (What only reads is decided from PowerShell's own parse of a command: coder-psparse.mjs, Bash docs pass 7.)
/** A glob of a rule's command (`*` any text; a trailing " *" also matches the bare command), its first word canonicalized. */
function ruleRegex(spec) {
  // (The old prefix form `Remove-Item:*` is `Remove-Item *`, as for Bash rules: Bash docs pass 9, a deny rule written so
  // never matched, and `Remove-Item x.txt` ran.)
  const t = String(spec).trim().replace(/:\*$/, " *");
  const w = psFirst(t), rest = t.slice(w.length);
  const words = (w === "*" ? "*" : psCanon(w)) + rest;
  const tail = / \*$/.test(words);
  const core = tail ? words.slice(0, -2) : words;
  const re = core.split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\S]*");
  return new RegExp("^" + re + (tail ? "(?:\\s[\\s\\S]*)?" : "") + "$", "i");
}
/** Whether a rule's command matches one part of a command (case-insensitive, aliases as their cmdlets). */
export function psRuleMatches(spec, part) {
  if (spec === null || spec === undefined || String(spec).trim() === "*") return true;
  const w = psFirst(part);
  return ruleRegex(spec).test(psCanon(w) + String(part).trim().slice(w.length));
}
/**
 * THE "DON'T ASK AGAIN" RULE FOR A POWERSHELL COMMAND (Claude Code's Le; live test 30, 2026-11-11: Coder offered
 * PowerShell(Write-Output *), a rule for every Write-Output, where Claude Code offers the command itself): the exact
 * text, trimmed, as a rule; none when the text has a `*` (a rule would read it as a wildcard) or a line break.
 */
export function psExactRule(text) {
  const raw = String(text ?? "");
  if (raw.includes("\n") || raw.includes("*")) return [];
  const t = raw.replace(/^[\s\u0085\u180e]+|[\s\u0085\u180e]+$/g, "");
  return t ? ["PowerShell(" + t + ")"] : [];
}

/** Claude Code's Start-Sleep check (its "standalone Start-Sleep N", "Start-Sleep N followed by: …"), with Coder's sleep message. */
export function psSleepWhat(command, min = 25) {
  const s = String(command ?? "").trim();
  const first = (s.split(/[;|&\r\n]/)[0] || "").trim();
  const m = /^(?:start-sleep|sleep)(?:\s+-s(?:econds)?)?\s+(\d+(?:\.\d*)?)\s*$/i.exec(first);
  if (!m) return "";
  const n = parseFloat(m[1]);
  if (!(n >= min)) return "";
  const rest = s.slice(first.length).replace(/^[\s;|&]+/, "");
  return rest ? "Start-Sleep " + n + " followed by: " + rest : "standalone Start-Sleep " + n;
}

/** UTF-16LE base64, for pwsh's -EncodedCommand (without Buffer: this file loads in the Worker too). */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function utf16Base64(text) {
  const bytes = [];
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    const units = cp > 0xffff ? [0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff)] : [cp];
    for (const u of units) bytes.push(u & 0xff, u >> 8);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b, c] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)] + (b === undefined ? "=" : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]) + (c === undefined ? "=" : B64[c & 63]);
  }
  return out;
}
/**
 * CLAUDE CODE'S LINE BEFORE A POWERSHELL COMMAND (2.1.323, its own, word for word): UTF-8 for files and pipes, and output as
 * plain text (Claude Code "captures error output without ANSI escape sequences"), none of it in restricted language mode.
 */
export const PS_PREAMBLE = "try { $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8' } catch {}; if ($ExecutionContext.SessionState.LanguageMode -eq 'FullLanguage') { try { $OutputEncoding = [System.Text.UTF8Encoding]::new() } catch {}; if ($null -ne $PSStyle) { try { $PSStyle.OutputRendering = 'PlainText' } catch {} } }; ";
/**
 * A COMMAND THAT MUST OPEN ITS SCRIPT, so it gets no line before it (Claude Code 2.1.323 leaves its own out for these): `using`,
 * `param(`, an attribute such as `[CmdletBinding()]` (not a type like `[Math]::`), or a begin, process, end, clean or
 * dynamicparam block, after blank space, `;` and comments.
 */
export function psMustLead(command) {
  const e = String(command ?? "");
  let n = 0;
  for (;;) {
    while (n < e.length && /[\s;]/.test(e[n])) n++;
    if (e[n] === "#") { while (n < e.length && e[n] !== "\n") n++; continue; }
    if (e.startsWith("<#", n)) { const end = e.indexOf("#>", n + 2); n = end === -1 ? e.length : end + 2; continue; }
    break;
  }
  const r = e.slice(n);
  return /^using\s+(namespace|module|assembly)\b/i.test(r) || /^param\s*\(/i.test(r) || /^(begin|process|end|clean|dynamicparam)\s*\{/i.test(r) || (/^\[\w/.test(r) && !/^\[[\w.]+\]::/.test(r));
}
/**
 * THE SCRIPT A COMMAND RUNS IN: Claude Code's line, the command, then its folder saved for the next command ("Working directory
 * persists between commands") and its exit code: a program's own, else 1 when the last step failed (Claude Code: "the cmdlet
 * failure still causes this tool to report exit 1"). It ends as Claude Code 2.1.323's does, with `$host.SetShouldExit` (`exit`
 * only in restricted language mode): an `exit` stopped PowerShell before it had printed a table (live test, 2026-11-13: Coder's
 * `Get-ChildItem` gave "(PowerShell completed with no output)", and `| Out-String` only the "Directory:" heading).
 */
export function psScript(command) {
  const c = String(command ?? "");
  return [
    (psMustLead(c) ? "" : PS_PREAMBLE) + c,
    "$__coderOk = $?",
    "$__coderCode = if (-not $__coderOk) { if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) { $LASTEXITCODE } else { 1 } } else { 0 }",
    "if ($env:CODER_PS_CWD) { try { (Get-Location).ProviderPath | Set-Content -NoNewline -LiteralPath $env:CODER_PS_CWD } catch {} }",
    "if ($ExecutionContext.SessionState.LanguageMode -eq 'FullLanguage') { $host.SetShouldExit($__coderCode) } else { exit $__coderCode }",
  ].join("\n");
}
/**
 * THE SHELL COMMAND THAT RUNS IT (in Coder's own shell, so its folder, timeouts, background and output work as a bash command's):
 * pwsh with no profile, non-interactive, stdin from /dev/null, the script encoded; then the shell moves to where it ended.
 */
export function psCommand(command, { bypass = true } = {}) {
  return "export CODER_PS_CWD=\"$(mktemp 2>/dev/null || echo /tmp/coder-ps-cwd-$$)\"; pwsh -NoProfile -NonInteractive" + (bypass ? " -ExecutionPolicy Bypass" : "") +
    " -EncodedCommand " + utf16Base64(psScript(command)) + " </dev/null; __coderPs=$?; __coderTo=\"$(cat \"$CODER_PS_CWD\" 2>/dev/null)\"; rm -f \"$CODER_PS_CWD\"; unset CODER_PS_CWD; " +
    "if [ -n \"$__coderTo\" ] && [ -d \"$__coderTo\" ]; then cd \"$__coderTo\"; fi; (exit $__coderPs)";
}

/** Claude Code's PowerShell tool description (2.1.322, PowerShell 7+), with Coder's tool names and timeouts. */
export function psDescription({ defaultMs = 120000, maxMs = 600000, outMax = 30000, background = true } = {}) {
  return "Executes a given PowerShell command with optional timeout. Working directory persists between commands; shell state (variables, functions) does not.\n\n" +
    "IMPORTANT: This tool is for terminal operations via PowerShell: git, npm, docker, and PS cmdlets. DO NOT use it for file operations (reading, writing, editing, searching, finding files) - use the specialized tools for this instead.\n\n" +
    "PowerShell edition: PowerShell 7+ (pwsh)\n   - Pipeline chain operators `&&` and `||` ARE available and work like bash. Prefer `cmd1 && cmd2` over `cmd1; cmd2` when cmd2 should only run if cmd1 succeeds.\n   - Ternary (`$cond ? $a : $b`), null-coalescing (`??`), and null-conditional (`?.`) operators are available.\n   - Default file encoding is UTF-8 without BOM.\n\n" +
    "Before executing the command, please follow these steps:\n\n1. Directory Verification:\n   - If the command will create new directories or files, first use `Get-ChildItem` (or `ls`) to verify the parent directory exists and is the correct location\n\n2. Command Execution:\n   - Always quote file paths that contain spaces with double quotes\n   - Capture the output of the command.\n\n" +
    "PowerShell Syntax Notes:\n   - Variables use $ prefix: $myVar = \"value\"\n   - Escape character is backtick (`), not backslash\n   - Use Verb-Noun cmdlet naming: Get-ChildItem, Set-Location, New-Item, Remove-Item\n   - Common aliases: ls (Get-ChildItem), cd (Set-Location), cat (Get-Content), rm (Remove-Item)\n   - Pipe operator | works similarly to bash but passes objects, not text\n   - Use Select-Object, Where-Object, ForEach-Object for filtering and transformation\n   - String interpolation: \"Hello $name\" or \"Hello $($obj.Property)\"\n   - Registry access uses PSDrive prefixes: `HKLM:\\SOFTWARE\\...`, `HKCU:\\...` \u2014 NOT raw `HKEY_LOCAL_MACHINE\\...`\n   - Environment variables: read with `$env:NAME`, set with `$env:NAME = \"value\"` (NOT `Set-Variable` or bash `export`)\n   - Call native exe with spaces in path via call operator: `& \"C:\\Program Files\\App\\app.exe\" arg1 arg2`\n\n" +
    "Unix commands that DO NOT exist in PowerShell \u2014 use the equivalent instead:\n   - head / tail \u2192 `Get-Content file -TotalCount N` / `-Tail N`; piped: `| Select-Object -First N` / `-Last N`\n   - which \u2192 `(Get-Command name).Source`\n   - touch \u2192 `if (-not (Test-Path path)) { New-Item -ItemType File path }` (NEVER use `New-Item -Force` on a file \u2014 it truncates existing content)\n   - wc -l \u2192 `(Get-Content file | Measure-Object -Line).Lines`\n   - mkdir -p \u2192 `New-Item -ItemType Directory -Force path` (`-p` is not a PowerShell flag)\n   - rm -rf \u2192 `Remove-Item -Recurse -Force path`\n   - ln -s \u2192 `New-Item -ItemType SymbolicLink -Path link -Target target`\n   - chmod / chown \u2192 not applicable on Windows; use `icacls` only if ACL changes are required\n   - 2>/dev/null \u2192 `2>$null` (but stderr is captured for you \u2014 usually unnecessary)\n   - VAR=x cmd \u2192 `$env:VAR = 'x'; cmd` (PowerShell has no inline env-var prefix)\n   - Bash control flow (`if [ -f x ]`, `for x in *`, backtick ``cmd`` substitution) is a parser error \u2014 use `if (Test-Path x)`, `foreach ($x in ...)`, `$(cmd)`\n\n" +
    "Exit-code note: `-ErrorAction SilentlyContinue` suppresses error OUTPUT but the cmdlet failure still causes this tool to report exit 1. To make a cmdlet failure truly non-fatal, promote it to terminating and swallow it: `try { Cmdlet ... -ErrorAction Stop } catch {}` (without `-ErrorAction Stop`, non-terminating errors skip the `catch` and still exit 1).\n\n" +
    "Interactive and blocking commands (this tool runs with -NonInteractive and stdin attached to the null device — console prompts read EOF or error immediately; GUI prompts can still block until timeout):\n   - NEVER use `Read-Host`, `Get-Credential`, `Out-GridView`, `$Host.UI.PromptForChoice`, or `pause`\n   - Destructive cmdlets (`Remove-Item`, `Stop-Process`, `Clear-Content`, etc.) may prompt for confirmation. Add `-Confirm:$false` when you intend the action to proceed. Use `-Force` for read-only/hidden items.\n   - Never use `git rebase -i`, `git add -i`, or other commands that open an interactive editor\n\n" +
    "Passing multiline strings (commit messages, file content) to native executables:\n   - Use a single-quoted here-string so PowerShell does not expand `$` or backticks inside. The closing `'@` MUST be at column 0 (no leading whitespace) on its own line — indenting it is a parse error: <example>\ngit commit -m @'\nCommit message here.\nSecond line with $literal dollar signs.\n'@\n</example>\n   - Use `@'...'@` (single-quoted, literal) not `@\"...\"@` (double-quoted, interpolated) unless you need variable expansion\n   - For arguments containing `-`, `@`, or other characters PowerShell parses as operators, use the stop-parsing token: `git log --% --format=%H`\n\n" +
    "Usage notes:\n  - The command argument is required.\n  - You can specify an optional timeout in milliseconds (up to " + maxMs + "ms / " + maxMs / 60000 + " minutes for a foreground command). If not specified, commands will timeout after " + defaultMs + "ms (" + defaultMs / 60000 + " minutes).\n  - It is very helpful if you write a clear, concise description of what this command does.\n  - If the output exceeds " + outMax + " characters, output will be truncated before being returned to you.\n" +
    (background ? "  - You can use the `run_in_background` parameter to run the command in the background, as with bash: you are told when it ends.\n" : "") +
    "  - Avoid using PowerShell to run commands that have dedicated tools, unless explicitly instructed:\n    - File search: Use glob (NOT Get-ChildItem -Recurse)\n    - Content search: Use grep (NOT Select-String)\n    - Read files: Use read (NOT Get-Content)\n    - Edit files: Use edit\n    - Write files: Use write (NOT Set-Content/Out-File)\n    - Communication: Output text directly (NOT Write-Output/Write-Host)\n" +
    "  - When issuing multiple commands:\n    - If the commands are independent and can run in parallel, make multiple powershell tool calls in a single message.\n    - If the commands depend on each other and must run sequentially, chain them in a single powershell call (see edition-specific chaining syntax above).\n    - Use `;` only when you need to run commands sequentially but don't care if earlier commands fail.\n    - DO NOT use newlines to separate commands (newlines are ok in quoted strings and here-strings)\n" +
    "  - Do NOT prefix commands with `cd` or `Set-Location` -- the working directory is already set to the correct project directory automatically.\n" +
    "  - For git commands:\n    - Prefer to create a new commit rather than amending an existing commit.\n    - Before running destructive operations (e.g., git reset --hard, git push --force, git checkout --), consider whether there is a safer alternative that achieves the same goal. Only use destructive operations when they are truly the best approach.\n    - Never skip hooks (--no-verify) or bypass signing (--no-gpg-sign, -c commit.gpgsign=false) unless the user has explicitly asked for it. If a hook fails, investigate and fix the underlying issue.";
}
