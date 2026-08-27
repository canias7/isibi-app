import { cn } from "@/lib/utils";
/**
 * The syntax the search box actually understands.
 *
 * ONLY DOCUMENT WHAT IS IMPLEMENTED. A help panel listing operators the backend
 * ignores is worse than none — people write a careful query, get wrong results
 * and conclude the search is broken rather than that the documentation lied.
 *
 * EACH ONE HAS A WORKED EXAMPLE, because "supports field prefixes" is not usable
 * and `status:open` is. The example is the documentation; the description is the
 * caption.
 *
 * Rendered as a definition list so a screen reader pairs each operator with what
 * it does, rather than reading two disconnected columns.
 */
export function SearchOperators({ operators, className }: {
  operators: { syntax: string; does: string }[];
  className?: string;
}) {
  if (!operators.length) return null;
  return (
    <dl data-slot="search-operators" className={cn("flex flex-col gap-1 text-sm", className)}>
      {operators.map((o) => (
        <div key={o.syntax} className="flex flex-wrap items-baseline gap-x-2">
          <dt><code className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{o.syntax}</code></dt>
          <dd className="text-muted-foreground">{o.does}</dd>
        </div>
      ))}
    </dl>
  );
}
