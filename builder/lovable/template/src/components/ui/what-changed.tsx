import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * What is new since you were last here.
 *
 * SINCE THEIR LAST VISIT, not since the last release. A changelog shows
 * everything and is read by almost nobody; three items that appeared while you
 * were away is a list people finish.
 *
 * IT SAYS WHEN "LAST HERE" WAS. Without the date the reader cannot tell whether
 * they are seeing a week or a year of changes, and a long list with no anchor
 * reads as noise.
 *
 * Capped, with the overflow pointed at the full notes — the point is the
 * highlights, and a component that renders forty entries has become the
 * changelog it was meant to replace.
 */
export function WhatChanged({ items, since, allHref, max = 5, className }: {
  items: { title: string; note?: string }[];
  since?: string | number | Date;
  allHref?: string;
  max?: number;
  className?: string;
}) {
  if (!items.length) return null;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <section aria-label="What's new" className={cn("flex flex-col gap-2 rounded-md border border-border p-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">New since you were last here</h2>
        {since && (
          <span className="text-xs text-muted-foreground">
            <DateFormat date={since} />
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {shown.map((i) => (
          <li key={i.title}>
            <span className="font-medium">{i.title}</span>
            {i.note && <span className="text-muted-foreground"> — {i.note}</span>}
          </li>
        ))}
      </ul>
      {(rest > 0 || allHref) && allHref && (
        <a href={allHref} className="text-xs underline underline-offset-4">
          {rest > 0 ? `${rest} more · all changes` : "All changes"}
        </a>
      )}
    </section>
  );
}
