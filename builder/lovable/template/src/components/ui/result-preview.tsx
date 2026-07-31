import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A search result with the matching words marked in its snippet.
 *
 * THE QUERY IS ESCAPED BEFORE IT BECOMES A REGEX. An unescaped bracket throws —
 * a crash triggered by somebody typing `(` into a search box — and this is the
 * one place a raw user string reliably reaches a regex. Same guard as
 * `highlight-match`.
 *
 * It marks with `<mark>`, which is the element that means this, and it is
 * styled monochrome — a yellow highlight is the browser default and the only
 * colour on an otherwise black-and-white page.
 *
 * The snippet is CENTRED ON THE FIRST MATCH rather than being the opening of
 * the document. A result whose preview never contains the searched word is a
 * result nobody can judge.
 *
 * The whole card is one link with a `line-clamp`, so a long snippet cannot make
 * one result four times the height of its neighbours.
 */
export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function snippetAround(text: string, query: string, radius = 90) {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return text.slice(0, radius * 2);
  const first = text.toLowerCase().indexOf(words[0].toLowerCase());
  if (first < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, first - radius);
  return (start > 0 ? "…" : "") + text.slice(start, start + radius * 2) + (start + radius * 2 < text.length ? "…" : "");
}

export function ResultPreview({ href, title, snippet, query, meta, kind, className }: {
  href?: string;
  title: string;
  snippet?: string;
  query: string;
  meta?: React.ReactNode;
  kind?: React.ReactNode;
  className?: string;
}) {
  const mark = (text: string) => {
    const words = query.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
    if (!words.length) return text;
    const re = new RegExp(`(${words.join("|")})`, "gi");
    return text.split(re).map((part, i) =>
      re.test(part) && words.some((w) => new RegExp(`^${w}$`, "i").test(part))
        ? <mark key={i} className="bg-muted font-medium text-foreground">{part}</mark>
        : <React.Fragment key={i}>{part}</React.Fragment>);
  };

  const body = (
    <>
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{mark(title)}</span>
        {kind ? <span className="shrink-0 text-[11px] text-muted-foreground">{kind}</span> : null}
      </span>
      {snippet ? (
        <span className="line-clamp-2 text-xs text-muted-foreground">{mark(snippetAround(snippet, query))}</span>
      ) : null}
      {meta ? <span className="text-[11px] text-muted-foreground">{meta}</span> : null}
    </>
  );
  const shared = cn("flex flex-col gap-1 rounded-lg border border-border p-3", className);
  return href
    ? <a href={href} className={cn(shared, "hover:bg-muted")}>{body}</a>
    : <div className={shared}>{body}</div>;
}
