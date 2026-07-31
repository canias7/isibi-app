import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "You might also like" — links to sibling content.
 *
 * IT RENDERS NOTHING WHEN THERE IS NOTHING RELATED. An empty "Related" heading
 * over a blank strip is the commonest way this block appears broken, and it
 * happens on every new site before there is enough content to relate.
 *
 * Each item says WHY it is related when the caller knows — "also in Beard
 * care", "by the same barber". A row of unexplained links is guesswork, and the
 * reason is usually the deciding factor in whether it is clicked.
 *
 * The heading is a real `<h2>` inside a `<section aria-labelledby>`, so it is a
 * landmark a screen reader can skip. Related content at the foot of a long
 * article is exactly what somebody wants to jump past.
 *
 * A `max` cap, because a relatedness query with no limit returns forty and the
 * block becomes a second page under the first.
 */
export function RelatedNav({ items, title = "Related", max = 4, className }: {
  items: { href: string; title: React.ReactNode; reason?: React.ReactNode; meta?: React.ReactNode }[];
  title?: React.ReactNode;
  max?: number;
  className?: string;
}) {
  const id = React.useId();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-2", className)}>
      <h2 id={id} className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.slice(0, max).map((i) => (
          <li key={i.href}>
            <a href={i.href} className="flex flex-col gap-0.5 rounded-lg border border-border p-3 hover:bg-muted">
              <span className="text-sm font-medium">{i.title}</span>
              {i.reason ? <span className="text-xs text-muted-foreground">{i.reason}</span> : null}
              {i.meta ? <span className="text-xs text-muted-foreground">{i.meta}</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
