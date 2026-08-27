import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Minimal syntax highlighting — a small regex tokeniser, not a library.
 *
 * `code-block` in this kit deliberately ships no highlighting, because shiki is
 * around a megabyte for something a business site uses once. This is the middle
 * ground: about eighty lines covering the four things worth telling apart —
 * strings, comments, numbers and keywords — for the handful of languages a
 * docs page or an API example actually contains.
 *
 * It is MONOCHROME, by the same rule as the rest of the kit. Comments are
 * muted, strings are italic, keywords are bold. That survives greyscale and
 * print, and it is genuinely most of the value: what a reader needs from
 * highlighting is to see where a string ends, not which of six colours a token
 * is.
 *
 * Order matters and is the only subtle part: comments and strings are matched
 * FIRST, in one pass, so a `#` inside a string is not a comment and a quote
 * inside a comment does not open a string. A tokeniser that runs the rules
 * separately gets both wrong and the mistake looks like a rendering bug.
 *
 * CASE-SENSITIVITY IS PER LANGUAGE, and it is not a detail. SQL is
 * conventionally written `SELECT … FROM`, so a case-sensitive match against a
 * lower-case keyword list highlights nothing at all — measured exactly that
 * way, on a query where only the strings came out marked. JavaScript and Python
 * are the other way: matching case-insensitively there would make `Const` and
 * `If` keywords, which they are not.
 *
 * Anything unrecognised renders as plain text. A language this does not know is
 * still perfectly readable code, which is why there is no list to keep current.
 */
const KEYWORDS: Record<string, string[]> = {
  js: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "await", "async", "import", "export", "from", "class", "new", "try", "catch", "throw", "typeof", "null", "undefined", "true", "false"],
  ts: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "await", "async", "import", "export", "from", "class", "new", "try", "catch", "throw", "typeof", "interface", "type", "as", "null", "undefined", "true", "false"],
  py: ["def", "return", "if", "elif", "else", "for", "while", "import", "from", "class", "try", "except", "raise", "with", "as", "None", "True", "False", "and", "or", "not", "in", "is"],
  sh: ["curl", "echo", "cd", "export", "sudo", "cat", "grep", "if", "then", "fi", "for", "do", "done"],
  sql: ["select", "from", "where", "insert", "into", "values", "update", "set", "delete", "join", "left", "inner", "on", "group", "order", "by", "limit", "and", "or", "not", "null"],
  json: ["true", "false", "null"],
};
const COMMENT: Record<string, RegExp> = {
  js: /\/\/[^\n]*|\/\*[\s\S]*?\*\//, ts: /\/\/[^\n]*|\/\*[\s\S]*?\*\//,
  py: /#[^\n]*/, sh: /#[^\n]*/, sql: /--[^\n]*/,
};
/** Languages whose keywords are not case-sensitive. SQL is the one that matters. */
const CASELESS = new Set(["sql"]);

type Token = { text: string; kind: "plain" | "string" | "comment" | "number" | "keyword" };

export function tokenize(code: string, lang: string): Token[] {
  const words = KEYWORDS[lang] ?? [];
  const comment = COMMENT[lang];
  // One pass, comments and strings first, so a # inside a string is not a
  // comment and a quote inside a comment does not open a string.
  const parts = [
    comment ? comment.source : null,
    `"(?:\\\\.|[^"\\\\])*"`,
    `'(?:\\\\.|[^'\\\\])*'`,
    "`(?:\\\\.|[^`\\\\])*`",
    `\\b\\d[\\d_.]*\\b`,
    words.length ? `\\b(?:${words.join("|")})\\b` : null,
  ].filter(Boolean);
  const flags = CASELESS.has(lang) ? "gi" : "g";
  const re = new RegExp(parts.join("|"), flags);

  const out: Token[] = [];
  let at = 0;
  for (const m of code.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > at) out.push({ text: code.slice(at, i), kind: "plain" });
    const t = m[0];
    const kind: Token["kind"] =
      comment && new RegExp(`^(?:${comment.source})$`, flags.replace("g", "")).test(t) ? "comment"
        : /^["'`]/.test(t) ? "string"
        : /^\d/.test(t) ? "number"
        : "keyword";
    out.push({ text: t, kind });
    at = i + t.length;
  }
  if (at < code.length) out.push({ text: code.slice(at), kind: "plain" });
  return out;
}

export function SyntaxHighlight({ code, lang = "js", className }: {
  code: string;
  lang?: string;
  className?: string;
}) {
  const tokens = React.useMemo(() => tokenize(code, lang), [code, lang]);
  return (
    <code data-slot="syntax-highlight" className={cn("font-mono text-xs whitespace-pre-wrap", className)}>
      {tokens.map((t, i) => (
        <span key={i} className={
          t.kind === "comment" ? "text-muted-foreground italic"
            : t.kind === "string" ? "italic"
            : t.kind === "keyword" ? "font-semibold"
            : t.kind === "number" ? "underline decoration-dotted underline-offset-2"
            : undefined}>
          {t.text}
        </span>
      ))}
    </code>
  );
}
