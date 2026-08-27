import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Notifications split into "needs you" and "everything else".
 *
 * "NEEDS YOU" IS DEFINED BY WHETHER AN ACTION IS EXPECTED, not by importance.
 * A mention, an approval request and a failed payment need a reply; a comment on
 * something you follow does not. Sorting by a guess at importance produces a
 * top section nobody trusts, which is worse than no split at all.
 *
 * THE OTHER SECTION IS NOT HIDDEN. A collapsed "everything else" behind a link
 * is where notifications go to be missed, and the whole point of the split is
 * that both halves stay visible with different weights.
 *
 * AN EMPTY "NEEDS YOU" IS CELEBRATED, briefly, rather than showing a blank
 * region — that is the state people are working towards and it should be
 * legible at a glance.
 *
 * Counts are per section. One badge over both makes "12" ambiguous between
 * twelve things to do and twelve things to glance at.
 */
export function PriorityInbox({ needsYou, everythingElse, emptyMessage, className }: {
  needsYou: React.ReactNode[];
  everythingElse: React.ReactNode[];
  emptyMessage?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="priority-inbox" className={cn("flex flex-col gap-4", className)}>
      <section aria-labelledby="needs-you">
        <h2 id="needs-you" className="mb-1.5 flex items-baseline gap-2 text-[11px] font-semibold tracking-wide uppercase">
          Needs you
          {needsYou.length ? (
            <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[10px] text-background tabular-nums">
              {needsYou.length}
            </span>
          ) : null}
        </h2>
        {needsYou.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            {emptyMessage ?? "Nothing is waiting on you."}
          </p>
        ) : (
          <ul className="rounded-md border border-border">{needsYou}</ul>
        )}
      </section>

      <section aria-labelledby="everything-else">
        <h2 id="everything-else" className="mb-1.5 flex items-baseline gap-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Everything else
          {everythingElse.length ? (
            <span className="tabular-nums">{everythingElse.length}</span>
          ) : null}
        </h2>
        {/* Not collapsed: a hidden second section is where things go to be missed. */}
        {everythingElse.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Nothing else.</p>
        ) : (
          <ul className="rounded-md border border-border">{everythingElse}</ul>
        )}
      </section>
    </div>
  );
}
