import * as React from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The numbered sources under an answer, and the little markers in the text.
 *
 * The DOMAIN is the headline, not the page title. A title is written by whoever
 * wants the click; the domain is what tells a reader whether this came from a
 * government page, a manufacturer or a forum, and that is most of what they use
 * to decide whether to believe the sentence above it.
 *
 * `rel="noreferrer"` and `target="_blank"` together — without `noreferrer` the
 * opened page can reach back through `window.opener`, and these are links to
 * pages nobody here has vetted. Same rule as `external-link`.
 *
 * `CitationMark` is a real anchor to the entry, so the marker in the sentence
 * actually goes somewhere. A superscript number that is not a link is
 * decoration, and it is the thing people try to click first.
 *
 * The list is numbered with `<ol>`, so the numbers in the text and the numbers
 * in the list cannot drift apart and a screen reader announces the count.
 */
export function CitationMark({ index, id, className }: { index: number; id?: string; className?: string }) {
  return (
    <a href={`#${id ?? "cite"}-${index}`}
      aria-label={`Source ${index}`}
      className={cn("ml-0.5 rounded-sm bg-muted px-1 align-super text-[10px] font-medium tabular-nums hover:bg-foreground hover:text-background", className)}>
      {index}
    </a>
  );
}

export function CitationList({ sources, id = "cite", title = "Sources", className }: {
  sources: { url: string; title?: React.ReactNode; snippet?: React.ReactNode; published?: React.ReactNode }[];
  id?: string;
  title?: React.ReactNode;
  className?: string;
}) {
  const host = (url: string) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  };
  if (sources.length === 0) return null;
  return (
    <section className={cn("flex flex-col gap-1.5", className)}>
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      <ol className="flex flex-col gap-1.5">
        {sources.map((s, i) => (
          <li key={s.url + i} id={`${id}-${i + 1}`} className="flex gap-2 text-xs">
            <span className="shrink-0 text-muted-foreground tabular-nums">{i + 1}.</span>
            <span className="min-w-0 flex-1">
              <a href={s.url} target="_blank" rel="noreferrer"
                className="inline-flex items-baseline gap-1 font-medium hover:underline">
                {host(s.url)}
                <ExternalLink aria-hidden className="size-2.5 translate-y-px" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              {s.published ? <span className="ml-1.5 text-muted-foreground">{s.published}</span> : null}
              {s.title ? <span className="block truncate text-muted-foreground">{s.title}</span> : null}
              {s.snippet ? <span className="mt-0.5 block text-muted-foreground">{s.snippet}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
