import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Renders a safe subset of markdown, with no dependency.
 *
 * IT NEVER PRODUCES HTML FROM THE INPUT. Every branch builds React elements,
 * so a document containing `<script>` or `<img onerror=...>` renders as those
 * characters and cannot execute. A regex-based markdown-to-HTML function fed
 * into `dangerouslySetInnerHTML` — which is how this is usually written — is
 * stored XSS on any site that lets a visitor write anything.
 *
 * The subset is what people actually type: headings, bold, italic, inline
 * code, links, bullet and numbered lists, block quotes, fenced code and
 * rules. Anything else renders as its own text rather than disappearing,
 * which is the honest failure for a preview.
 *
 * Link hrefs are restricted to http, https and mailto — `javascript:` in a
 * markdown link is the other half of the same hole.
 */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[2] != null) out.push(<strong key={key}>{inline(m[2], key)}</strong>);
    else if (m[4] != null) out.push(<em key={key}>{inline(m[4], key)}</em>);
    else if (m[5] != null) out.push(<code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.9em]">{m[5]}</code>);
    else if (m[6] != null) {
      const href = m[7];
      const safe = /^(https?:|mailto:|\/|#)/i.test(href);
      out.push(safe
        ? <a key={key} href={href} rel="noreferrer" className="underline underline-offset-2">{m[6]}</a>
        : <span key={key}>{m[6]}</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
export function MarkdownPreview({ source, className }: { source: string; className?: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0, k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++} className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{body.join("\n")}</pre>);
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { blocks.push(<hr key={k++} className="border-border" />); i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const Tag = `h${h[1].length}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      const size = ["text-2xl", "text-xl", "text-lg", "text-base", "text-sm", "text-sm"][h[1].length - 1];
      blocks.push(<Tag key={k++} className={cn(size, "font-semibold")}>{inline(h[2], `h${k}`)}</Tag>);
      i++; continue;
    }
    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={k++} className="border-s-2 border-border ps-3 text-muted-foreground">{inline(body.join(" "), `q${k}`)}</blockquote>);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*+]\s+/, ""));
      blocks.push(<ul key={k++} className="list-disc space-y-1 ps-5">{items.map((t, n) => <li key={n}>{inline(t, `u${k}-${n}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(<ol key={k++} className="list-decimal space-y-1 ps-5">{items.map((t, n) => <li key={n}>{inline(t, `o${k}-${n}`)}</li>)}</ol>);
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>|\s*[-*+]\s|\s*\d+[.)]\s|```)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k++}>{inline(para.join(" "), `p${k}`)}</p>);
  }
  return <div data-slot="markdown-preview" className={cn("space-y-3 text-sm leading-relaxed", className)}>{blocks}</div>;
}
