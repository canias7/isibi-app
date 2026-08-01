import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Everything that collided, waiting to be sorted out.
 *
 * The empty state is the one that matters and it is PHRASED AS GOOD NEWS —
 * "Nothing to resolve" rather than an empty box. This list is reached by
 * somebody who has been told there is a problem, and arriving at a blank panel
 * leaves them unsure whether it is fixed or still loading.
 *
 * Each row says WHAT and WHEN, because "3 conflicts" is a number and "Booking
 * for Tuesday, changed by Sam an hour ago" is something a person can decide
 * about. Resolving happens per row: a "resolve all" button on records that
 * genuinely differ is a way to lose several people's work with one press.
 *
 * The count is in the heading rather than a badge, so it is read out as part of
 * the section name instead of as a stray number.
 */
export type SyncConflict = { key: string; what: string; by?: string; when?: string };

export function SyncConflictList({ items, onResolve, empty = "Nothing to resolve.", className }: {
  items: SyncConflict[];
  onResolve: (key: string) => void;
  empty?: string;
  className?: string;
}) {
  if (!items.length) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{empty}</p>;
  }
  return (
    <section aria-label={`${items.length} to resolve`} className={cn("flex flex-col gap-2", className)}>
      <h2 className="text-sm font-medium tabular-nums">
        {items.length} {items.length === 1 ? "conflict" : "conflicts"} to resolve
      </h2>
      <ul className="divide-y divide-border rounded-md border border-border">
        {items.map((c) => (
          <li key={c.key} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{c.what}</p>
              {(c.by || c.when) && (
                <p className="text-sm text-muted-foreground">
                  {[c.by && `Changed by ${c.by}`, c.when].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => onResolve(c.key)}>
              Resolve<span className="sr-only"> {c.what}</span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
