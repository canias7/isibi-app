import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The count on a navigation item.
 *
 * IT CAPS AT 99+. A four-digit badge is wider than the item it sits on and
 * pushes the layout around, and nobody acts differently on 1,284 unread than on
 * "lots". The exact number belongs on the page, not on the tab to it.
 *
 * ZERO RENDERS NOTHING. A badge showing 0 is a permanent mark that trains
 * people to ignore badges, which is a problem the next time one means something.
 *
 * `dot` is the version for "something is there" without a count — deliberately
 * a different prop rather than passing a count of 1, because a count is a claim
 * about how many and a dot is not.
 *
 * The accessible name says what the number IS. A bare "12" read after a link
 * label is ambiguous between unread, total and a position; "12 unread" is not.
 */
export function NavBadge({ count, dot, noun = "new", max = 99, className }: {
  count?: number;
  dot?: boolean;
  noun?: string;
  max?: number;
  className?: string;
}) {
  if (dot) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
        <span className="sr-only">Something {noun}</span>
      </span>
    );
  }
  if (!count || count <= 0) return null;
  return (
    <span className={cn("inline-flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] leading-4 font-medium text-background tabular-nums", className)}>
      <span aria-hidden>{count > max ? `${max}+` : count}</span>
      <span className="sr-only">{count.toLocaleString()} {noun}</span>
    </span>
  );
}
