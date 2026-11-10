// A SHELL COMMAND, READ AS BASH READS IT, for Claude Code's checks on a command (tool 4, bash; the owner, 2026-11-09:
// "do all of those and double check again against the claude code docs pls"). Claude Code reads each command with a
// real shell grammar before it runs: its exit codes (the last command decides), its sleep block (the first command), the
// files its redirections and `tee` write (checked against the protected paths), and its dangerous-rm check (which "also
// looks inside" subshells, brace groups, `$(...)`, backticks, process substitution and `sh -c` scripts). This reads the
// same parts: every simple command, wherever it sits, with its words and its redirections, in the order they appear.
// `ok` is false when the command cannot be read through (an open quote, bracket or here-document): the shell may then
// read it differently than this did, which Claude Code's rm check treats as a danger of its own.

const SEPARATORS = ["&&", "||", ";;&", ";;", ";&", "|&", ";", "|", "&", "\n"];
const RESERVED_LEAD = new Set(["if", "then", "else", "elif", "do", "while", "until", "!", "{", "time", "coproc"]);
const RESERVED_END = new Set(["fi", "done", "esac", "}"]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "ash", "mksh", "busybox"]);
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * The command read through: `{ ok, commands }`. Each command: `{ words, redirects, depth, inScript, top }`, where a word
 * is `{ text, raw, quoted, expand, subst, glob, tilde, bare }`: `text` with quotes taken away and expansions kept as
 * written ($HOME stays "$HOME"), `raw` exactly as written, `expand` when it holds a $-expansion, `subst` when it holds a
 * command substitution, `glob` when it holds an unquoted * ? or [, `tilde` when it starts with an unquoted ~, `bare` when
 * it is only one variable ("$DIR", ${DIR}). A redirect is `{ op, fd, target }` (a word; none for a here-document).
 * `top`: the command's place among the top level's commands (0, 1, …), or -1 inside something.
 */
export function parseShell(source, { scriptDepth = 0 } = {}) {
  const s = String(source == null ? "" : source);
  const out = [];
  let ok = true;
  let i = 0;
  let topIndex = 0;
  const pendingHeredocs = [];
  // A LOOP'S OWN VARIABLE (`for NAME in …`, `select NAME in …`), and an OPERATOR WITH NOTHING AFTER IT (`npm test &&`): both
  // for Claude Code's permission checks (see readCommand in coder-perms.mjs).
  const loopVars = [];
  let dangling = false;

  const fail = () => { ok = false; };
  const peek = (n = 0) => s[i + n];
  const startsWith = (t) => s.startsWith(t, i);

  // A NESTED LIST: the text between matching brackets, read on its own (its commands go in the same list).
  function nested(text, depth, inScript = false) {
    const r = parseShell(text, { scriptDepth });
    if (!r.ok) fail();
    loopVars.push(...r.loopVars);
    if (r.dangling) dangling = true;
    for (const c of r.commands) out.push({ ...c, depth: c.depth + depth, inScript: c.inScript || inScript, top: -1 });
  }

  // From an opening "(" (already read), the text up to its matching ")", minding quotes and nesting.
  function readUntilClose(open, close) {
    let level = 1, start = i;
    while (i < s.length) {
      const ch = s[i];
      if (ch === "\\") { i += 2; continue; }
      if (ch === "'") { const e = s.indexOf("'", i + 1); if (e < 0) { fail(); i = s.length; return s.slice(start); } i = e + 1; continue; }
      if (ch === "\"") { i = skipDouble(i + 1); continue; }
      if (ch === "`") { const e = findBacktick(i + 1); if (e < 0) { fail(); i = s.length; return s.slice(start); } i = e + 1; continue; }
      if (ch === open) level++;
      else if (ch === close) { level--; if (level === 0) { const text = s.slice(start, i); i++; return text; } }
      i++;
    }
    fail();
    return s.slice(start);
  }
  function skipDouble(j) {
    while (j < s.length) {
      const ch = s[j];
      if (ch === "\\") { j += 2; continue; }
      if (ch === "\"") return j + 1;
      if (ch === "$" && s[j + 1] === "(") { const save = i; i = j + 2; readUntilClose("(", ")"); j = i; i = save; continue; }
      if (ch === "`") { const e = findBacktick(j + 1); if (e < 0) { fail(); return s.length; } j = e + 1; continue; }
      j++;
    }
    fail();
    return s.length;
  }
  function findBacktick(j) {
    while (j < s.length) { if (s[j] === "\\") { j += 2; continue; } if (s[j] === "`") return j; j++; }
    return -1;
  }

  // ONE WORD, from i: quotes taken away, expansions kept as written and marked, nested commands read.
  function readWord(depth) {
    const start = i;
    let text = "", quoted = false, expand = false, subst = false, glob = false, tilde = false;
    let parts = 0, varOnly = true;
    if (s[i] === "~") tilde = true;
    while (i < s.length) {
      const ch = s[i];
      if (/[\s;&|()<>]/.test(ch)) break;
      if (ch === "\\") { if (s[i + 1] === "\n") { i += 2; continue; } text += s[i + 1] || ""; i += 2; varOnly = false; parts++; continue; }
      if (ch === "'") { const e = s.indexOf("'", i + 1); if (e < 0) { fail(); text += s.slice(i + 1); i = s.length; break; } text += s.slice(i + 1, e); i = e + 1; quoted = true; varOnly = false; parts++; continue; }
      if (ch === "$" && s[i + 1] === "'") { // $'...'
        let j = i + 2, v = "";
        while (j < s.length && s[j] !== "'") { if (s[j] === "\\") { v += s[j + 1] === "n" ? "\n" : s[j + 1] === "t" ? "\t" : s[j + 1] || ""; j += 2; continue; } v += s[j]; j++; }
        if (j >= s.length) { fail(); i = s.length; break; }
        text += v; i = j + 1; quoted = true; varOnly = false; parts++; continue;
      }
      if (ch === "\"") {
        let j = i + 1;
        const inner = [];
        while (j < s.length && s[j] !== "\"") {
          if (s[j] === "\\") { const n = s[j + 1]; if (n === "\"" || n === "\\" || n === "$" || n === "`") { text += n; j += 2; varOnly = false; continue; } if (n === "\n") { j += 2; continue; } text += "\\"; j++; varOnly = false; continue; }
          if (s[j] === "$") {
            const save = i; i = j; const e = readDollar(depth); j = i; i = save;
            text += e.raw; expand = true; if (e.subst) subst = true; if (!e.variable) varOnly = false; inner.push(e); continue;
          }
          if (s[j] === "`") { const e = findBacktick(j + 1); if (e < 0) { fail(); j = s.length; break; } nested(s.slice(j + 1, e), depth + 1); text += s.slice(j, e + 1); expand = true; subst = true; varOnly = false; j = e + 1; continue; }
          text += s[j]; varOnly = false; j++;
        }
        if (j >= s.length) { fail(); i = s.length; break; }
        i = j + 1; quoted = true; parts++;
        if (!inner.length) varOnly = false;
        continue;
      }
      if (ch === "$") { const e = readDollar(depth); text += e.raw; expand = true; if (e.subst) subst = true; if (!e.variable) varOnly = false; parts++; continue; }
      if (ch === "`") { const e = findBacktick(i + 1); if (e < 0) { fail(); i = s.length; break; } nested(s.slice(i + 1, e), depth + 1); text += s.slice(i, e + 1); expand = true; subst = true; varOnly = false; i = e + 1; parts++; continue; }
      if (ch === "*" || ch === "?") glob = true;
      if (ch === "[" && s.indexOf("]", i + 1) > i) glob = true;
      if (ch === "{" && /^\{[^{}\s]*,[^{}\s]*\}/.test(s.slice(i))) glob = true; // a brace expansion stands for several words
      text += ch; varOnly = false; i++; parts++;
    }
    const raw = s.slice(start, i);
    return { text, raw, quoted, expand, subst, glob, tilde, bare: expand && varOnly && parts >= 1 && !subst };
  }

  // $NAME, ${...}, $(...), $((...)), $1, $@ …: `{ raw, subst, variable }` (a plain variable, not a substitution).
  function readDollar(depth) {
    const start = i;
    i++; // $
    const ch = s[i];
    if (ch === "(" && s[i + 1] === "(") { i += 2; readUntilClose("(", ")"); if (s[i] === ")") i++; return { raw: s.slice(start, i), subst: false, variable: false }; }
    if (ch === "(") { i++; const text = readUntilClose("(", ")"); nested(text, depth + 1); return { raw: s.slice(start, i), subst: true, variable: false }; }
    if (ch === "{") { const e = s.indexOf("}", i); if (e < 0) { fail(); i = s.length; return { raw: s.slice(start), subst: false, variable: true }; } const inner = s.slice(i + 1, e); i = e + 1; if (/\$\(|`/.test(inner)) { nested(inner.replace(/^[^$`]*/, ""), depth + 1); } return { raw: s.slice(start, i), subst: false, variable: true, inner }; }
    if (/[A-Za-z_]/.test(ch || "")) { while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++; return { raw: s.slice(start, i), subst: false, variable: true }; }
    if (/[0-9@*#?$!-]/.test(ch || "")) { i++; return { raw: s.slice(start, i), subst: false, variable: true }; }
    return { raw: "$", subst: false, variable: false };
  }

  // A REDIRECTION's operator at i (after an optional fd number already read): `{ op, len }` or null.
  function redirectOp() {
    for (const op of ["&>>", "&>", "<<<", "<<-", "<<", "<>", "<&", ">&", ">>", ">|", "<", ">"]) if (startsWith(op)) return op;
    return null;
  }

  function skipBlanks() { while (i < s.length && (s[i] === " " || s[i] === "\t" || (s[i] === "\\" && s[i + 1] === "\n"))) i += s[i] === "\\" ? 2 : 1; }
  function skipComment() { if (s[i] === "#") { while (i < s.length && s[i] !== "\n") i++; } }

  // HERE-DOCUMENTS waiting for the end of their line: their bodies are skipped (an unquoted one's $(...) still read).
  function takeHeredocs(depth) {
    while (pendingHeredocs.length) {
      const h = pendingHeredocs.shift();
      if (s[i] === "\n") i++;
      let found = false;
      while (i <= s.length) {
        const end = s.indexOf("\n", i);
        const line = s.slice(i, end < 0 ? s.length : end);
        const cmp = h.strip ? line.replace(/^\t+/, "") : line;
        if (cmp === h.delim) { i = end < 0 ? s.length : end; found = true; break; }
        if (!h.quoted && /\$\(|`/.test(line)) { const r = parseShell(line.replace(/^[^$`]*/, "").replace(/^([^$`]|\$[^(])+/, ""), { scriptDepth }); if (!r.ok) fail(); for (const c of r.commands) out.push({ ...c, depth: depth + 1, top: -1 }); }
        if (end < 0) { i = s.length; break; }
        i = end + 1;
      }
      if (!found) fail();
    }
  }

  // ONE SIMPLE COMMAND (or a compound's opening word), from i, until a separator or a closing bracket.
  function readCommand(depth, closer) {
    const words = [], redirects = [];
    let compoundSkip = false, some = false;
    for (;;) {
      skipBlanks();
      if (i >= s.length) break;
      const ch = s[i];
      if (ch === "#" && (i === 0 || /\s/.test(s[i - 1]))) { skipComment(); continue; }
      if (closer && ch === closer) break;
      if (SEPARATORS.some((sep) => startsWith(sep))) {
        // `&>` and `>&` are redirections, not separators.
        if (startsWith("&>")) { /* fall through to the redirect */ }
        else break;
      }
      // A SUBSHELL or a GROUP where a command starts: read on its own.
      if (ch === "(" && !words.length) {
        some = true;
        if (s[i + 1] === "(") { i += 2; readUntilClose("(", ")"); if (s[i] === ")") i++; continue; } // (( arithmetic ))
        i++; const text = readUntilClose("(", ")"); nested(text, depth + 1); continue;
      }
      if (ch === "(" && words.length) {
        // A FUNCTION'S DEFINITION, name() { …; }: the name is no command; the body that follows is read like any commands.
        if (/^\(\s*\)/.test(s.slice(i))) { i = s.indexOf(")", i) + 1; return { words: [], redirects, compoundSkip: false, some: true }; }
        // process substitution would have been <( or >(: anything else is a word bash would refuse
        i++; const text = readUntilClose("(", ")"); nested(text, depth + 1); continue;
      }
      if (ch === ")") { fail(); i++; continue; }
      // [[ … ]]: a test, not a command; its words are not run.
      if (startsWith("[[") && !words.length) { some = true; const e = s.indexOf("]]", i + 2); if (e < 0) { fail(); i = s.length; break; } const inner = s.slice(i + 2, e); if (/\$\(|`/.test(inner)) { const r = parseShell(inner.replace(/^[^$`]*/, ""), { scriptDepth }); for (const c of r.commands) out.push({ ...c, depth: depth + 1, top: -1 }); } i = e + 2; continue; }
      // A REDIRECTION, with or without an fd number before it.
      let fd = "";
      const m = /^(\d+|\{[A-Za-z_][A-Za-z0-9_]*\})(?=[<>])/.exec(s.slice(i));
      if (m) { fd = m[1]; i += m[0].length; }
      const op = (s[i] === "<" || s[i] === ">" || startsWith("&>")) ? redirectOp() : null;
      if (op) {
        i += op.length;
        // <( … ) and >( … ): process substitution, a command of its own.
        if ((op === "<" || op === ">") && s[i] === "(") { i++; const text = readUntilClose("(", ")"); nested(text, depth + 1); continue; }
        skipBlanks();
        if (op === "<<" || op === "<<-") {
          const w = readWord(depth);
          pendingHeredocs.push({ delim: w.text, quoted: w.quoted || /["'\\]/.test(w.raw), strip: op === "<<-" });
          redirects.push({ op, fd, heredoc: true });
          continue;
        }
        const target = readWord(depth);
        if (!target.raw) { fail(); continue; }
        redirects.push({ op, fd, target });
        continue;
      }
      if (fd) { // digits that were not a redirection's: an ordinary word
        i -= fd.length;
      }
      const w = readWord(depth);
      if (!w.raw) { i++; continue; }
      words.push(w);
      // A COMPOUND's own words end its first part: `for x in a b; do` names no command; `case … in` either.
      if (words.length === 1 && (w.text === "for" || w.text === "select" || w.text === "case") && !w.quoted) compoundSkip = true;
      // `function name { …; }`: the name is no command.
      if (words.length === 2 && words[0].text === "function" && !words[0].quoted) return { words: [], redirects, compoundSkip: false };
      // `case WORD in`: its patterns follow, read by readCase.
      if (compoundSkip && words[0].text === "case" && words.length === 3 && w.text === "in") break;
    }
    return { words, redirects, compoundSkip, some };
  }

  // THE LIST: commands and their separators, to the end or to the closer.
  function readList(depth, closer) {
    // (`&&`, `||`, `|` and `|&` join two commands: one with no command after it, before the end, a `)` or another
    // separator, leaves the shell a command it can't run; bash says "syntax error". A newline between is fine.)
    // (`lastSep`: the separator just before a command, so a command fed by a pipe is known: `afterPipe`.)
    let joining = false, lastSep = "";
    for (;;) {
      skipBlanks();
      if (i >= s.length) break;
      if (closer && s[i] === closer) break;
      if (s[i] === "\n") { lastSep = "\n"; i++; if (pendingHeredocs.length) { i--; takeHeredocs(depth); } continue; }
      const sep = SEPARATORS.find((x) => startsWith(x));
      if (sep && !startsWith("&>")) { if (joining) dangling = true; joining = ["&&", "||", "|", "|&"].includes(sep); lastSep = sep; i += sep.length; continue; }
      const before = i;
      const c = readCommand(depth, closer);
      if (pendingHeredocs.length && s[i] === "\n") takeHeredocs(depth);
      let words = c.words;
      // Reserved words that only open or close a compound are not the command.
      while (words.length && RESERVED_LEAD.has(words[0].text) && !words[0].quoted) words = words.slice(1);
      while (words.length && RESERVED_END.has(words[words.length - 1].text) && !words[words.length - 1].quoted && words.length === 1) words = [];
      if (c.compoundSkip) {
        // `for NAME in WORDS` / `case WORD in`: only words, no command; the body follows after `do` / the patterns.
        if (words[0] && words[0].text === "case") readCase(depth);
        if (words[0] && (words[0].text === "for" || words[0].text === "select") && words[1] && !words[1].quoted && NAME.test(words[1].text)) loopVars.push(words[1].text);
        words = [];
      }
      if (words.length || c.redirects.length || c.compoundSkip || c.some) joining = false;
      if (words.length || c.redirects.length) out.push({ words, redirects: c.redirects, depth, inScript: scriptDepth > 0, top: depth === 0 ? topIndex++ : -1, afterPipe: lastSep === "|" || lastSep === "|&" });
      if (i !== before) lastSep = "";
      if (i === before) i++;
    }
    if (joining) dangling = true;
  }

  // case WORD in PATTERN) LIST ;; … esac: the patterns are not commands; each LIST is.
  function readCase(depth) {
    // past `in`
    for (;;) {
      skipBlanks();
      while (s[i] === "\n" || s[i] === ";") i++;
      skipBlanks();
      if (i >= s.length) { fail(); return; }
      if (startsWith("esac")) { i += 4; return; }
      // the pattern, up to its )
      if (s[i] === "(") i++;
      const close = s.indexOf(")", i);
      if (close < 0) { fail(); return; }
      i = close + 1;
      // the list, up to ;; or esac
      const end = (() => { let j = i, lvl = 0; while (j < s.length) { if (s[j] === "'") { j = s.indexOf("'", j + 1); if (j < 0) return -1; j++; continue; } if (s[j] === "\"") { j = skipDouble(j + 1); continue; } if (s[j] === "(") lvl++; if (s[j] === ")") lvl--; if (lvl <= 0 && (s.startsWith(";;", j) || s.startsWith("esac", j))) return j; j++; } return -1; })();
      if (end < 0) { fail(); return; }
      nested(s.slice(i, end), depth);
      i = end;
      if (s.startsWith(";;", i)) i += 2;
    }
  }

  readList(0, null);
  if (pendingHeredocs.length) fail();

  // COMMANDS ANOTHER COMMAND RUNS: `find … -exec CMD … ;` (and -execdir, -ok, -okdir) and `xargs [options] CMD …`, read as
  // commands of their own (Claude Code's docs give `find . -name '*.tmp' -exec sh -c "rm -rf \"$1\"/*" _ {} \;` as one
  // its rm check catches).
  for (const c of [...out]) {
    const w = unwrapped(c.words);
    const prog = w[0] ? basename(w[0].text) : "";
    if (prog === "find") {
      for (let k = 1; k < w.length; k++) {
        if (!/^-(exec|execdir|ok|okdir)$/.test(w[k].text)) continue;
        let e = k + 1;
        while (e < w.length && w[e].text !== ";" && w[e].text !== "+") e++;
        if (e > k + 1) out.push({ words: w.slice(k + 1, e), redirects: [], depth: c.depth + 1, inScript: c.inScript, top: -1, ranBy: "find" });
        k = e;
      }
    } else if (prog === "xargs") {
      let k = 1;
      const withValue = new Set(["-a", "-d", "-E", "-I", "-i", "-L", "-l", "-n", "-P", "-s", "--arg-file", "--delimiter", "--max-args", "--max-procs", "--max-chars", "--replace"]);
      while (k < w.length && w[k].text.startsWith("-")) { if (withValue.has(w[k].text)) k++; k++; }
      if (k > 1 && k < w.length) out.push({ words: w.slice(k), redirects: [], depth: c.depth + 1, inScript: c.inScript, top: -1, ranBy: "xargs" });
    }
  }
  // SCRIPTS GIVEN TO A SHELL WITH -c: read as commands too (Claude Code: "a script passed to sh, bash, zsh, or a similar
  // POSIX shell with -c"); a double-quoted one's variables are the outer shell's, already in its text.
  if (scriptDepth < 3) {
    for (const c of [...out]) {
      const w = leadWords(c.words);
      const prog = w[0] ? basename(w[0].text) : "";
      if (!SHELLS.has(prog)) continue;
      let k = 1;
      if (prog === "busybox" && w[1] && SHELLS.has(w[1].text)) k = 2;
      for (; k < w.length; k++) {
        const a = w[k].text;
        if (a === "-c" || (/^-[A-Za-z]*c[A-Za-z]*$/.test(a) && !a.startsWith("--"))) {
          const script = w[k + 1];
          if (!script) break;
          const r = parseShell(script.text, { scriptDepth: scriptDepth + 1 });
          if (!r.ok) ok = false;
          loopVars.push(...r.loopVars);
          if (r.dangling) dangling = true;
          for (const sc of r.commands) out.push({ ...sc, depth: c.depth + 1, inScript: true, scriptQuote: script.raw.startsWith("\"") ? "double" : script.raw.startsWith("'") ? "single" : "none", scriptArgs: w.slice(k + 2).map((x) => x.text), top: -1 });
          break;
        }
        if (!a.startsWith("-")) break;
      }
    }
  }
  return { ok, commands: out, loopVars, dangling };
}

/** The words a command really runs, past leading `NAME=value` assignments. */
export function leadWords(words) {
  let k = 0;
  while (k < words.length && /^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(words[k].raw) && !words[k].raw.startsWith("=")) k++;
  return words.slice(k);
}
export const basename = (p) => String(p || "").replace(/\/+$/, "").split("/").pop();

/**
 * THE WRAPPERS CLAUDE CODE LOOKS PAST (its permissions docs: "timeout, time, nice, nohup, and stdbuf, plus the shell
 * builtins command and builtin, and zsh's noglob", and bare `xargs`; deny rules also "match commands wrapped in
 * env/sudo/watch/ionice/setsid and similar exec wrappers"): the words of the command each one runs.
 */
export function unwrapped(words) {
  let w = leadWords(words);
  for (let guard = 0; guard < 8 && w.length; guard++) {
    const p = basename(w[0].text);
    const opts = (from, withValue = new Set()) => { let k = from; while (k < w.length && w[k].text.startsWith("-") && w[k].text !== "--") { if (withValue.has(w[k].text)) k++; k++; } if (w[k] && w[k].text === "--") k++; return k; };
    if (p === "command" || p === "builtin" || p === "noglob" || p === "nohup" || p === "exec") { if (p === "command" && w[1] && /^-[vV]$/.test(w[1].text)) return []; w = w.slice(opts(1)); continue; }
    if (p === "time") { w = w.slice(opts(1)); continue; }
    if (p === "nice" || p === "ionice") { w = w.slice(opts(1, new Set(["-n", "-c"]))); continue; }
    if (p === "stdbuf") { w = w.slice(opts(1, new Set(["-i", "-o", "-e"]))); continue; }
    if (p === "timeout") { let k = opts(1, new Set(["-s", "-k", "--signal", "--kill-after"])); k++; w = w.slice(k); continue; }
    if (p === "sudo" || p === "doas") { w = w.slice(opts(1, new Set(["-u", "-g", "-C", "-D", "-h", "-p", "-r", "-t", "-U"]))); w = leadWords(w); continue; }
    if (p === "env") { let k = opts(1, new Set(["-u", "-C", "--unset", "--chdir", "-S"])); while (k < w.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[k].text)) k++; w = w.slice(k); continue; }
    if (p === "watch" || p === "setsid" || p === "flock" || p === "chrt" || p === "taskset" || p === "unbuffer") { let k = opts(1, new Set(["-n", "-d", "-w", "-x"])); if ((p === "flock") && w[k]) k++; if ((p === "chrt" || p === "taskset") && w[k]) k++; w = w.slice(k); continue; }
    if (p === "xargs") { if (w[1] && w[1].text.startsWith("-")) return w; w = w.slice(1); continue; }
    break;
  }
  return w;
}

/** The top-level commands' texts, as Claude Code splits a command at &&, ||, ;, |, & and new lines (its `jg`). */
export function topTexts(source) {
  const s = String(source == null ? "" : source);
  const parts = [];
  let cur = "", i = 0, lvl = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\") { cur += s.slice(i, i + 2); i += 2; continue; }
    if (ch === "'") { const e = s.indexOf("'", i + 1); const end = e < 0 ? s.length : e + 1; cur += s.slice(i, end); i = end; continue; }
    if (ch === "\"") { let j = i + 1; while (j < s.length && s[j] !== "\"") j += s[j] === "\\" ? 2 : 1; cur += s.slice(i, j + 1); i = j + 1; continue; }
    if (ch === "`") { let j = i + 1; while (j < s.length && s[j] !== "`") j += s[j] === "\\" ? 2 : 1; cur += s.slice(i, j + 1); i = j + 1; continue; }
    if (ch === "(" || ch === "{") lvl++;
    if ((ch === ")" || ch === "}") && lvl > 0) lvl--;
    if (lvl === 0) {
      const sep = ["&&", "||", "|&", ";", "|", "\n"].find((x) => s.startsWith(x, i)) || (ch === "&" && s[i + 1] !== ">" && s[i - 1] !== ">" && s[i - 1] !== "<" ? "&" : "");
      if (sep) { if (cur.trim()) parts.push(cur.trim()); cur = ""; i += sep.length; continue; }
    }
    cur += ch; i++;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

export { NAME as SHELL_NAME };
