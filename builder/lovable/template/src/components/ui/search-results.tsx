import { HighlightMatch } from "@/components/ui/highlight-match";
import { cn } from "@/lib/utils";
/** A list of hits: title, one line of context, where it came from. */
export function SearchResults({ results, query, className }: {
  results: { title: string; snippet?: string; href?: string; kind?: string }[];
  query?: string; className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-border", className)}>
      {results.map((r, i) => (
        <li key={r.href ?? `${r.title}-${i}`} className="py-3">
          <div className="flex items-baseline gap-2">
            {r.href
              ? <a href={r.href} className="text-sm font-medium hover:underline">
                  <HighlightMatch text={r.title} query={query ?? ""} />
                </a>
              : <span className="text-sm font-medium"><HighlightMatch text={r.title} query={query ?? ""} /></span>}
            {r.kind && <span className="text-xs text-muted-foreground">{r.kind}</span>}
          </div>
          {r.snippet && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              <HighlightMatch text={r.snippet} query={query ?? ""} />
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
