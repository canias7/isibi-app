import * as React from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Who has seen this — the expanded form of `presence-bar`.
 *
 * IT SEPARATES "HERE NOW" FROM "HAS SEEN". Those are different facts and
 * merging them is misleading in both directions: somebody who read it
 * yesterday is not watching, and somebody watching may not have read the part
 * that matters. Two groups, each labelled.
 *
 * "NOT SEEN YET" IS SHOWN WHEN THE CALLER KNOWS THE FULL LIST. That is usually
 * the actionable half — the point of a read receipt is finding who to chase —
 * and a list of who HAS read it leaves that as arithmetic.
 *
 * Times are `<time datetime>` with a relative label, so a crawler and a screen
 * reader get the exact value. Same rule as `date-format`.
 *
 * There is no way to hide yourself from this, and the component does not
 * pretend otherwise — read receipts are a surveillance feature and whether to
 * have one at all is the caller's decision, not something to soften here.
 */
export function ViewerList({ here = [], seen = [], notSeen = [], className }: {
  here?: { id: string; name: string }[];
  seen?: { id: string; name: string; at?: React.ReactNode; iso?: string }[];
  notSeen?: { id: string; name: string }[];
  className?: string;
}) {
  const group = (title: React.ReactNode, rows: React.ReactNode, count: number) =>
    count === 0 ? null : (
      <section>
        <h3 className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {title} <span className="tabular-nums">({count})</span>
        </h3>
        <ul className="flex flex-col gap-0.5">{rows}</ul>
      </section>
    );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {group(<><Eye aria-hidden className="me-1 inline size-3" />Here now</>,
        here.map((p) => <li key={p.id} className="text-sm">{p.name}</li>), here.length)}
      {group("Has seen it",
        seen.map((p) => (
          <li key={p.id} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{p.name}</span>
            {p.at ? <time dateTime={p.iso} className="shrink-0 text-xs text-muted-foreground">{p.at}</time> : null}
          </li>
        )), seen.length)}
      {group("Not seen it yet",
        notSeen.map((p) => <li key={p.id} className="text-sm text-muted-foreground">{p.name}</li>), notSeen.length)}
    </div>
  );
}
