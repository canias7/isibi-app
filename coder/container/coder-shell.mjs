// A SHELL COMMAND, READ AS BASH READS IT, for Claude Code's checks on a command (tool 4, bash; the owner, 2026-11-09:
// "do all of those and double check again against the claude code docs pls"). Claude Code reads each command with a
// real shell grammar before it runs: its exit codes (the last command decides), its sleep block (the first command), the
// files its redirections and `tee` write (checked against the protected paths), and its dangerous-rm check (which "also
// looks inside" subshells, brace groups, `$(...)`, backticks, process substitution and `sh -c` scripts). This reads the
// same parts: every simple command, wherever it sits, with its words and its redirections, in the order they appear.
// `ok` is false when the command cannot be read through (an open quote, bracket or here-document): the shell may then
// read it differently than this did, which Claude Code's rm check treats as a danger of its own.

// (Bracket groups are numbered across every reading, so two never share a number.)
let groupSeq = 0;
const SEPARATORS = ["&&", "||", ";;&", ";;", ";&", "|&", ";", "|", "&", "\n"];
const RESERVED_LEAD = new Set(["if", "then", "else", "elif", "do", "while", "until", "!", "{", "time", "coproc"]);
const RESERVED_END = new Set(["fi", "done", "esac", "}"]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "ash", "mksh", "busybox"]);
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Claude Code's Unicode spaces (its `lon`): none of them separates words in bash. */
export const UNICODE_SPACE = /[\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u3000\uFEFF]/;
/** Claude Code's escaped blank (`\ `, `\<tab>`) and its joined lines (a backslash-newline inside a word), as it tests them. */
const ESCAPED_BLANK = /\\[ \t]/;
const JOINED_LINE = /(?:^|[^ \t\\])(?:\\\\)*\\\n|[ \t](?:\\\\)+\\\n|\\[ \t]\\\n/;
/**
 * A command's text with each `{` inside quotes or backquotes made a blank, escapes and comments kept (Claude Code's At), so a
 * brace with a quote after it shows only where the shell would expand it.
 */
export function quotedBracesBlanked(e) {
  if (!e.includes("{")) return e;
  const t = [];
  let sq = false, dq = false, bt = false, start = true, i = 0;
  while (i < e.length) {
    const u = e[i];
    if (bt) {
      if (u === "\\" && (e[i + 1] === "`" || e[i + 1] === "\\" || e[i + 1] === "$")) { t.push(u, e[i + 1]); i += 2; }
      else { if (u === "`") bt = false; t.push(u === "{" ? " " : u); i++; }
    } else if (sq) { if (u === "'") sq = false; t.push(u === "{" ? " " : u); i++; }
    else if (dq) {
      if (u === "\\" && (e[i + 1] === '"' || e[i + 1] === "\\" || e[i + 1] === "`")) { t.push(u, e[i + 1]); i += 2; }
      else if (u === "`") { bt = true; t.push(u); i++; }
      else { if (u === '"') dq = false; t.push(u === "{" ? " " : u); i++; }
    } else if (u === "\\" && i + 1 < e.length) { t.push(u, e[i + 1]); if (e[i + 1] !== "\n") start = false; i += 2; }
    else if (u === "#" && start) { while (i < e.length && e[i] !== "\n") { t.push(e[i]); i++; } start = true; }
    else if (u === "`") { bt = true; start = false; t.push(u); i++; }
    else { if (u === "'") sq = true; else if (u === '"') dq = true; start = " \t\n;|&()<>".includes(u); t.push(u); i++; }
  }
  return t.join("");
}
/** Claude Code's literal arithmetic piece (its `ir`): a number in any base, or operators. */
const ARITH_LITERAL = /^(?:[0-9]+|0[xX][0-9a-fA-F]+|[0-9]+#[0-9a-zA-Z]+|[-+*/%^&|~!<>=?:(),]+|<<|>>|\*\*|&&|\|\||[<>=!]=|\$\(\(|\)\))$/;
/** The first piece of an arithmetic expression that is no number or operator ("" when there is none). */
function arithNonLiteral(text) {
  const pieces = String(text).match(/0[xX][0-9a-fA-F]+|[0-9]+#[0-9a-zA-Z@_]+|[0-9]+[A-Za-z_][A-Za-z0-9_]*|[0-9]+|[A-Za-z_][A-Za-z0-9_]*|\$\{[^}]*\}|\$\(\(|\$\(|\$[A-Za-z_][A-Za-z0-9_]*|\$[0-9@*#?$!-]|`[^`]*`?|\[[^\]]*\]?|[-+*/%^&|~!<>=?:(),]+|\S/g) || [];
  return pieces.find((x) => !ARITH_LITERAL.test(x)) || "";
}

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
  // A `&` THAT SENDS A COMMAND TO THE BACKGROUND (Claude Code asks for one in a command it would otherwise allow: "defers
  // execution past approval-time safety checks"; Bash docs pass 9).
  let background = false;
  // WHAT MAKES IT TOO COMPLEX TO CHECK (Bash docs pass 9; Claude Code 2.1.322's own reasons, its parser's "too-complex"):
  // such a command asks, in every mode but Auto, where it goes to the checker; it is never one that only reads.
  const complex = [];
  const noteComplex = (why) => { if (!complex.includes(why)) complex.push(why); };
  // (Claude Code checks the whole text first: "Contains lone surrogate", "Contains Unicode whitespace". Bash splits words
  // only at spaces, tabs and new lines, so a no-break space in `cat<U+00A0>./evil` is part of one program's name.)
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s)) noteComplex("Contains lone surrogate");
  if (UNICODE_SPACE.test(s)) noteComplex("Contains Unicode whitespace");
  // (And where bash and zsh read a command differently, Claude Code 2.1.322's own patterns, its ct: an escaped blank or a
  // line joined in the middle of a word, zsh's ~[…] and =cmd expansions, its <N-M> globs, and a brace with a quote in it
  // outside quotes. Coder's commands run in zsh as Claude Code's cloud ones do: Bash docs pass 9.)
  if (ESCAPED_BLANK.test(s) || JOINED_LINE.test(s)) noteComplex("Contains backslash-escaped whitespace");
  if (/~\[/.test(s)) noteComplex("Contains zsh ~[ dynamic directory syntax");
  if (/(?:^|[\s;&|])=[a-zA-Z_]/.test(s)) noteComplex("Contains zsh =cmd equals expansion");
  if (/<\d*-\d*>/.test(s)) noteComplex("Contains zsh <N-M> numeric-range glob");
  if (/\{[^}]*['"]/.test(quotedBracesBlanked(s))) noteComplex("Contains brace with quote character (expansion obfuscation)");

  const fail = () => { ok = false; };
  const peek = (n = 0) => s[i + n];
  const startsWith = (t) => s.startsWith(t, i);

  // A NESTED LIST: the text between matching brackets, read on its own (its commands go in the same list), each command
  // marked with the brackets it is in, outermost first (`groups`: a subshell, a $(…), a `…` or a <(…) runs in a shell of
  // its own, so a cd there stays there; Bash docs pass 8).
  function nested(text, depth, inScript = false) {
    const r = parseShell(text, { scriptDepth });
    if (!r.ok) fail();
    loopVars.push(...r.loopVars);
    for (const why of r.complex) noteComplex(why);
    if (r.dangling) dangling = true;
    if (r.background) background = true;
    const id = ++groupSeq;
    for (const c of r.commands) out.push({ ...c, depth: c.depth + depth, inScript: c.inScript || inScript, top: -1, groups: [id, ...(c.groups || [])] });
  }
  // THE COMMANDS INSIDE SOME TEXT THAT IS NOT ITSELF COMMANDS (an arithmetic expression, a [[ … ]] test): its $( … ), `…`,
  // <( … ) and >( … ), read as commands of their own (Bash docs pass 9: `(( $(rm -rf ~) ))` was read by nothing, so no
  // rule and no rm check saw it, and bash runs it). How many there were.
  function subsOf(text, depth) {
    const r = parseShell(": " + text, { scriptDepth });
    if (!r.ok) fail();
    loopVars.push(...r.loopVars);
    for (const why of r.complex) noteComplex(why);
    if (r.background) background = true;
    const id = ++groupSeq;
    let n = 0;
    for (const c of r.commands) if (c.depth > 0) { n++; out.push({ ...c, depth: c.depth + depth, top: -1, groups: [id, ...(c.groups || [])] }); }
    return n;
  }
  // ARITHMETIC, $(( … )), $[ … ], (( … )) and for (( … )) (Bash docs pass 9; Claude Code: "Arithmetic expansion references
  // variable or non-literal: X" makes a command too complex to check, as bash works out a variable named there as an
  // expression of its own, which can hold a[$(cmd)] and run cmd): numbers and operators only, or it is too complex.
  // Whether it held a command.
  function arith(text, depth) {
    const subs = /\$\(|`|[<>]\(/.test(text) ? subsOf(text, depth) : 0;
    const bad = arithNonLiteral(text);
    if (bad) noteComplex("Arithmetic expansion references variable or non-literal: " + bad);
    return subs > 0;
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
      if (/[ \t\n;&|()<>]/.test(ch)) break;
      if (ch === "\\") { if (s[i + 1] === "\n") { i += 2; continue; } text += s[i + 1] || ""; i += 2; varOnly = false; parts++; continue; }
      if (ch === "'") { const e = s.indexOf("'", i + 1); if (e < 0) { fail(); text += s.slice(i + 1); i = s.length; break; } text += s.slice(i + 1, e); i = e + 1; quoted = true; varOnly = false; parts++; continue; }
      // ($"…": bash's translated string, a double-quoted one; Bash docs pass 9: `$"rm" -rf /` got past a deny rule on rm.)
      if (ch === "$" && s[i + 1] === "\"") { i++; continue; }
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
    if (ch === "(" && s[i + 1] === "(") { i += 2; const inner = readUntilClose("(", ")"); if (s[i] === ")") i++; const held = arith(inner.replace(/\)$/, ""), depth); return { raw: s.slice(start, i), subst: held, variable: false }; }
    if (ch === "[") { i++; const inner = readUntilClose("[", "]"); return { raw: s.slice(start, i), subst: arith(inner, depth), variable: false }; }
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
      if (ch === "#" && (i === 0 || /[ \t\n]/.test(s[i - 1]))) { skipComment(); continue; }
      if (closer && ch === closer) break;
      if (SEPARATORS.some((sep) => startsWith(sep))) {
        // `&>` and `>&` are redirections, not separators.
        if (startsWith("&>")) { /* fall through to the redirect */ }
        else break;
      }
      // A SUBSHELL or a GROUP where a command starts: read on its own.
      if (ch === "(" && !words.length) {
        some = true;
        if (s[i + 1] === "(") { i += 2; const inner = readUntilClose("(", ")"); if (s[i] === ")") i++; arith(inner.replace(/\)$/, ""), depth); continue; } // (( arithmetic ))
        i++; const text = readUntilClose("(", ")"); nested(text, depth + 1); continue;
      }
      if (ch === "(" && words.length === 1 && s[i + 1] === "(" && (words[0].text === "for") && !words[0].quoted) {
        i += 2; const inner = readUntilClose("(", ")"); if (s[i] === ")") i++; arith(inner.replace(/\)$/, ""), depth); return { words: [], redirects, compoundSkip: false, some: true };
      }
      if (ch === "(" && words.length) {
        // A FUNCTION'S DEFINITION, name() { …; }: the name is no command; the body that follows is read like any commands.
        if (/^\(\s*\)/.test(s.slice(i))) { i = s.indexOf(")", i) + 1; return { words: [], redirects, compoundSkip: false, some: true }; }
        // process substitution would have been <( or >(: anything else is a word bash would refuse
        i++; const text = readUntilClose("(", ")"); nested(text, depth + 1); continue;
      }
      if (ch === ")") { fail(); i++; continue; }
      // [[ … ]]: a test, not a command; its words are not run.
      // (Bash docs pass 9: its $( … ), `…`, <( … ) and >( … ) run; Claude Code: "[[ ]] … contains expansion / command /
      // process substitution" makes it too complex to check. `[[ -n <(rm -rf ~) ]] && ls` was read as `ls` alone.)
      if (startsWith("[[") && !words.length) { some = true; const e = s.indexOf("]]", i + 2); if (e < 0) { fail(); i = s.length; break; } const inner = s.slice(i + 2, e); if (/\$\(|`|[<>]\(/.test(inner)) { subsOf(inner, depth); noteComplex("[[ ]] test contains expansion / command / process substitution"); } i = e + 2; continue; }
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
      if (sep && !startsWith("&>")) { if (joining) dangling = true; if (sep === "&") background = true; joining = ["&&", "||", "|", "|&"].includes(sep); lastSep = sep; i += sep.length; continue; }
      const before = i;
      const c = readCommand(depth, closer);
      if (pendingHeredocs.length && s[i] === "\n") takeHeredocs(depth);
      let words = c.words;
      // Reserved words that only open or close a compound are not the command.
      // (bash's `time` keyword takes `-p`, and `--`, before the command: `time -p git push` runs `git push`. Pass 8: the -p
      // was left as the command, so a deny rule on `git push` missed it.)
      while (words.length && RESERVED_LEAD.has(words[0].text) && !words[0].quoted) { const lead = words[0].text; words = words.slice(1); if (lead === "time") while (words.length && !words[0].quoted && (words[0].text === "-p" || words[0].text === "--")) words = words.slice(1); }
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
      // (Past wrappers too, `sudo sh -c …`, `env bash -c …`, `timeout 5 sh -c …`, and past the shell's other options,
      // `bash -euo pipefail -c …`, `bash -c -- …`: Claude Code's `Ktn` and `$er`; Bash docs pass 9, its rm check missed them.)
      const w = unwrapped(c.words);
      const prog = w[0] ? basename(w[0].text) : "";
      if (!SHELLS.has(prog)) continue;
      let k = 1, wantC = false;
      if (prog === "busybox" && w[1] && SHELLS.has(w[1].text)) k = 2;
      for (; k < w.length; k++) {
        const a = w[k].text;
        if (a === "--" || a === "-") { k++; break; }
        if (/^--(rcfile|init-file)$/.test(a)) { k++; continue; }
        if (a.startsWith("--")) continue;
        if (/^[-+][A-Za-z]+$/.test(a)) { if (a[0] === "-" && a.includes("c")) wantC = true; k += (a.match(/[oO]/g) || []).length; continue; }
        break;
      }
      const script = wantC ? w[k] : null;
      if (!script) continue;
      const r = parseShell(script.text, { scriptDepth: scriptDepth + 1 });
      if (!r.ok) ok = false;
      loopVars.push(...r.loopVars);
      for (const why of r.complex) noteComplex(why);
      if (r.dangling) dangling = true;
      if (r.background) background = true;
      for (const sc of r.commands) out.push({ ...sc, depth: c.depth + 1, inScript: true, scriptQuote: script.raw.startsWith("\"") ? "double" : script.raw.startsWith("'") ? "single" : "none", scriptArgs: w.slice(k + 1).map((x) => x.text), top: -1 });
    }
  }
  return { ok, commands: out, loopVars, dangling, complex, background };
}

/** The words a command really runs, past leading `NAME=value` assignments. */
export function leadWords(words) {
  let k = 0;
  while (k < words.length && /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/.test(words[k].raw) && !words[k].raw.startsWith("=")) k++;
  return words.slice(k);
}
export const basename = (p) => String(p || "").replace(/\/+$/, "").split("/").pop();

/**
 * THE WRAPPERS CLAUDE CODE LOOKS PAST (its permissions docs: "timeout, time, nice, nohup, and stdbuf, plus the shell
 * builtins command and builtin, and zsh's noglob", and bare `xargs`; deny rules also "match commands wrapped in
 * env/sudo/watch/ionice/setsid and similar exec wrappers"): the words of the command each one runs.
 */
export function unwrapped(words) {
  const steps = unwrapSteps(words);
  return steps[steps.length - 1];
}
// CLAUDE CODE'S WRAPPER TABLES (its program, 2.1.322; Bash docs pass 8, the owner, 2026-11-11: "Yes pls"): for each exec
// wrapper, the settings that take a value (its `aer`); the settings whose value is itself a command (its `ler`: env -S,
// flock -c, script -c); a word that comes before the command (its `der`: chrt's priority, taskset's mask, flock's lock file,
// script's file). Pass 7's own table read watch -d, flock -n and setsid -w as taking a value, so `watch -d git push` and
// `time -p git push` got past a deny rule on `git push` (found by the pass 8 check).
const WRAP_VALUE = Object.freeze({
  env: ["-u", "-C", "--unset", "--chdir"],
  sudo: ["-u", "-g", "-U", "-C", "-D", "-h", "-p", "-r", "-R", "-t", "-T", "--user", "--group", "--other-user", "--close-from", "--chdir", "--host", "--prompt", "--role", "--chroot", "--type", "--command-timeout", "-a", "--auth-type"],
  doas: ["-a", "-u", "-C"], pkexec: ["--user"], watch: ["-n", "--interval", "--equexit"],
  ionice: ["-c", "-n", "-p", "-P", "-u", "--class", "--classdata", "--pid", "--pgid", "--uid"], setsid: [], taskset: ["-c", "--cpu-list"],
  chrt: ["-p", "--pid", "-T", "-P", "-D", "--sched-runtime", "--sched-period", "--sched-deadline"],
  strace: ["-e", "-o", "-p", "-s", "-E", "-P", "-S", "-a", "-b", "-I", "-u", "-X", "-O", "-U", "--output", "--trace", "--expr", "--attach", "--string-limit", "--env", "--trace-path", "--columns", "--user", "--interruptible", "--detach-on", "--const-print-style", "--summary-sort-by", "--summary-syscall-overhead", "--summary-columns"],
  ltrace: ["-a", "-A", "-e", "-l", "-n", "-o", "-p", "-s", "-u", "-x", "-D", "-F", "--align", "--config", "--debug", "--indent", "--library", "--output", "--string-max", "-w", "--where"],
  flock: ["-w", "-E", "--timeout", "--wait", "--conflict-exit-code"],
  script: ["-E", "-T", "-m", "-o", "-O", "-B", "-I", "--echo", "--log-timing", "--logging-format", "--output-limit", "--log-out", "--log-io", "--log-in"],
  unshare: ["-R", "-w", "-S", "-G", "--setuid", "--setgid", "--root", "--wd", "--propagation", "--setgroups", "--monotonic", "--boottime"],
  nsenter: ["-t", "-S", "-G", "--target", "--setuid", "--setgid"], exec: ["-a"], command: [], builtin: [], noglob: [], nocorrect: [],
});
const WRAP_COMMAND = Object.freeze({ env: ["-S", "--split-string"], flock: ["-c", "--command"], script: ["-c", "--command"] });
// THE WRAPPERS THAT RUN THEIR COMMAND IN ANOTHER FOLDER (Bash docs pass 9: `env -C /etc cat passwd` was judged as a read of
// ./passwd; Claude Code takes a wrapper's -C, -D, --chdir or a new root as a folder it can't place): the folder setting,
// and the ones that change the root.
const WRAP_CHDIR = Object.freeze({ env: ["-C", "--chdir"], sudo: ["-D", "--chdir"], unshare: ["-w", "--wd"] });
const WRAP_ROOT = Object.freeze({ sudo: ["-R", "--chroot"], unshare: ["-R", "--root"] });
/**
 * The folders a command's wrappers move it to, outermost first: each the word naming it, or false for one that can't be
 * placed (a new root). Empty when no wrapper moves it.
 */
export function wrapperDirs(words) {
  const out = [];
  for (const w of unwrapSteps(words)) {
    const r = w[0] ? progName(w[0].text) : "";
    const cd = ownOf(WRAP_CHDIR, r) || [], root = ownOf(WRAP_ROOT, r) || [];
    if (!cd.length && !root.length) continue;
    const all = [...cd, ...root], vals = ownOf(WRAP_VALUE, r) || [];
    const wordOf = (text, base) => ({ ...base, text, raw: text });
    let k = 1;
    while (k < w.length) {
      const K = w[k].text;
      if (K === "--") break;
      if (r === "env" && ASSIGN_WORD.test(K)) { k++; continue; }
      if (!K.startsWith("-") || K === "-") break;
      const eq = K.indexOf("=");
      if (K.startsWith("--") && eq > 0 && all.includes(K.slice(0, eq))) { out.push(root.includes(K.slice(0, eq)) ? false : wordOf(K.slice(eq + 1), w[k])); k++; continue; }
      if (all.includes(K)) { out.push(root.includes(K) || !w[k + 1] ? false : w[k + 1]); k += 2; continue; }
      const sh = all.find((o) => !o.startsWith("--") && K.startsWith(o) && K.length > o.length);
      if (sh) { out.push(root.includes(sh) ? false : wordOf(K.slice(sh.length), w[k])); k++; continue; }
      k += vals.includes(K) && k + 1 < w.length ? 2 : 1;
    }
  }
  return out;
}
const WRAP_POSITIONAL = Object.freeze({ chrt: (e) => /^\d+$/.test(e), taskset: (e) => /^(0x[\da-f]+|\d+)$/i.test(e), flock: () => true, script: () => true });
// (With a subscript too, `A[0]=1 rm -rf /`: Claude Code's `gve` takes `^([A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]*\])?)\+?=…` away; Bash
// docs pass 9, it got past a deny rule on rm.)
const ASSIGN_WORD = /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/;
const ownOf = (o, k) => (Object.hasOwn(o, k) ? o[k] : undefined);
/** A program's name as Claude Code compares it (its `II`): the last part of a path, without `.exe`. */
export const progName = (t) => String(t ?? "").replace(/^.*[\\/]/, "").replace(/\.exe$/i, "");
/** Where timeout's duration is (Claude Code's `W3e`): -1 when a setting it does not know comes first. */
function timeoutAt(n) {
  const VAL = /^[A-Za-z0-9_.+-]+$/;
  let k = 1;
  while (k < n.length) {
    const r = n[k], s = n[k + 1];
    if (r === "--foreground" || r === "--preserve-status" || r === "--verbose") k++;
    else if (/^--(?:kill-after|signal)=[A-Za-z0-9_.+-]+$/.test(r)) k++;
    else if ((r === "--kill-after" || r === "--signal") && s && VAL.test(s)) k += 2;
    else if (r === "--") { k++; break; }
    else if (r.startsWith("--")) return -1;
    else if (r === "-v") k++;
    else if ((r === "-k" || r === "-s") && s && VAL.test(s)) k += 2;
    else if (/^-[ks][A-Za-z0-9_.+-]+$/.test(r)) k++;
    else if (r.startsWith("-")) return -1;
    else break;
  }
  return k;
}
/** time [-p], nohup, timeout and `nice -n N` in front (Claude Code's `ier`); `w`: words, compared by their text. */
function processWrappers(w) {
  for (;;) {
    const r = progName(w[0] ? w[0].text : "");
    if (r === "time" || r === "nohup") {
      const s = r === "time" && w[1] && w[1].text === "-p" ? 2 : 1;
      if (w[s] && w[s].text.startsWith("-") && w[s].text !== "--") return w;
      w = w.slice(w[s] && w[s].text === "--" ? s + 1 : s);
    } else if (r === "timeout") {
      const s = timeoutAt(w.map((x) => x.text));
      if (s < 0 || !w[s] || !/^\d+(?:\.\d+)?[smhd]?$/.test(w[s].text)) return w;
      w = w.slice(s + 1);
    } else if (r === "nice") {
      // (Bare `nice` too: Claude Code's `CT` takes `^nice(?:[ \t]+-n[ \t]+-?\d+|[ \t]+-\d+)?[ \t]+(?:--[ \t]+)?` away. Bash docs
      // pass 9: pass 8 left `nice rm x` past a deny rule on rm, and `nice rm -rf ~` past the rm check.)
      let k = 1;
      if (w[1] && w[1].text === "-n" && w[2] && /^-?\d+$/.test(w[2].text)) k = 3;
      else if (w[1] && (/^-\d+$/.test(w[1].text) || /^--adjustment=-?\d+$/.test(w[1].text))) k = 2;
      if (w[k] && w[k].text === "--") k++;
      if (!w[k] || w[k].text.startsWith("-")) return w;
      w = w.slice(k);
    } else if (r === "stdbuf") {
      // (Its modes written on, apart, or long: `stdbuf -oL`, `stdbuf -o L`, `stdbuf --output=L`; Claude Code's file rules
      // take all three away, its `iZo`.)
      let k = 1, any = false;
      for (;;) {
        const a = w[k] ? w[k].text : "";
        if (/^-[ioe]\S+$/.test(a) || /^--(input|output|error)=\S+$/.test(a)) { k++; any = true; continue; }
        if ((/^-[ioe]$/.test(a) || /^--(input|output|error)$/.test(a)) && w[k + 1]) { k += 2; any = true; continue; }
        break;
      }
      if (!any) return w;
      if (w[k] && w[k].text === "--") k++;
      if (!w[k] || w[k].text.startsWith("-")) return w;
      w = w.slice(k);
    } else return w;
  }
}
/** A command string given to a wrapper (env -S '…', flock -c '…'), as words. */
const looseWords = (s) => s.trim().split(/\s+/).filter(Boolean).map((t) => ({ text: t, raw: t, quoted: false, expand: /\$/.test(t), subst: /\$\(|`/.test(t), glob: /[*?[]/.test(t), tilde: t.startsWith("~"), bare: false }));
/**
 * EVERY FORM A COMMAND IS MATCHED AS (Claude Code's deny and ask rules try each: the command, past its settings in front,
 * past each wrapper in turn, and, as the last, the command the wrappers run; its `Yut`, `ier` and `CT`), first to last.
 * Bare `xargs` is taken away too (its docs); `xargs` with settings is matched as itself.
 */
export function unwrapSteps(words) {
  let w = leadWords(words);
  const steps = [w];
  const push = (x) => { if (x !== steps[steps.length - 1]) steps.push(x); };
  for (let guard = 0; guard < 16 && w.length; guard++) {
    const before = w;
    while (w.length && ASSIGN_WORD.test(w[0].text) && !w[0].quoted) w = w.slice(1);
    push(w);
    w = processWrappers(w);
    push(w);
    // (stdbuf with its modes written on, and nice -N: the forms Claude Code's `CT` takes away from the text.)
    if (w[0] && progName(w[0].text) === "stdbuf") { let k = 1; while (w[k] && /^-[ioe][LN0-9]+$/.test(w[k].text)) k++; if (k > 1) { w = w.slice(w[k] && w[k].text === "--" ? k + 1 : k); push(w); } }
    if (w[0] && progName(w[0].text) === "nice" && w[1] && /^-\d+$/.test(w[1].text)) { w = w.slice(w[2] && w[2].text === "--" ? 3 : 2); push(w); }
    const r = w[0] ? progName(w[0].text) : "";
    const s = ownOf(WRAP_VALUE, r);
    if (s !== undefined) {
      const h = ownOf(WRAP_COMMAND, r), y = ownOf(WRAP_POSITIONAL, r);
      let k = 1, inner, H = false, stop = false;
      while (k < w.length) {
        const K = w[k].text;
        if (K === "--") { k++; if (!H && y !== undefined && k + 1 < w.length && y(w[k].text)) { H = true; k++; continue; } break; }
        if (h !== undefined) {
          if (h.includes(K) && w[k + 1] !== undefined) { const v = w[k + 1].text.trim(); if (v !== "") { inner = v; break; } k += 2; continue; }
          const eq = K.indexOf("=");
          if (eq > 0 && h.includes(K.slice(0, eq))) { const v = K.slice(eq + 1).trim(); if (v !== "") { inner = v; break; } k++; continue; }
          if (K.length > 2 && K[1] !== "-" && h.includes(K.slice(0, 2))) { const v = K.slice(2).trim(); if (v !== "") { inner = v; break; } k++; continue; }
        }
        if (K.startsWith("-") && (K !== "-" || y === undefined)) {
          if (r === "command" && /^-[pvV]+$/.test(K) && /[vV]/.test(K)) { stop = true; break; }
          k += s.includes(K) && k + 1 < w.length ? 2 : 1; continue;
        }
        if (r === "env" && ASSIGN_WORD.test(K)) { k++; continue; }
        if (!H && y && y(K) && k + 1 < w.length) { H = true; k++; continue; }
        break;
      }
      if (stop) { push(w); break; }
      if (inner !== undefined) { const iw = looseWords(inner); if (!iw.length) break; w = iw; push(w); continue; }
      if (k >= w.length) { push(w); break; }
      w = w.slice(k);
    } else if (r === "xargs" && !(w[1] && w[1].text.startsWith("-"))) w = w.slice(1);
    push(w);
    if (w === before) break;
  }
  return steps;
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
