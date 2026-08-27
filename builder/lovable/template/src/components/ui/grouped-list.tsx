import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A list broken into labelled sections, with STICKY headings.
 *
 * The heading sticking is the whole point: scrolled past, an unstuck section
 * label leaves somebody looking at rows with no idea which group they belong
 * to, which is exactly when they need to know.
 *
 * Grouping happens here from a key function rather than in the caller,
 * because the order of the groups and the order within them are two different
 * decisions and doing it inline gets one of them wrong.
 */
export function GroupedList<T>({ items, groupBy, renderItem, sortGroups, empty = "Nothing here.", className }: {
  items: T[]; groupBy: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  sortGroups?: (a: string, b: string) => number;
  empty?: string; className?: string;
}) {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = groupBy(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  const keys = [...map.keys()];
  if (sortGroups) keys.sort(sortGroups);
  if (!items.length) return <p data-slot="grouped-list" className={cn("py-8 text-center text-sm text-muted-foreground", className)}>{empty}</p>;
  return (
    <div className={cn("relative", className)}>
      {keys.map((k) => (
        <section key={k}>
          <h3 className="sticky top-0 z-10 border-b border-border bg-background/95 px-1 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground backdrop-blur">
            {k} <span className="ms-1 tabular-nums">{map.get(k)!.length}</span>
          </h3>
          <div>{map.get(k)!.map((it, i) => <React.Fragment key={i}>{renderItem(it, i)}</React.Fragment>)}</div>
        </section>
      ))}
    </div>
  );
}
