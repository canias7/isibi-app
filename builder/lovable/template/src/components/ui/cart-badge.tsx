import * as React from "react";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The basket count in the header — that announces its own changes.
 *
 * ADDING TO A BASKET USUALLY GIVES NO FEEDBACK TO A SCREEN READER: the
 * number silently changes in a corner. A polite live region on the count is
 * the whole fix, and it is why this is a component rather than a `count-badge`
 * on an icon.
 *
 * ZERO RENDERS NO BADGE, not a "0" — an empty basket is the resting state
 * and a zero chip is visual noise that means nothing.
 *
 * The count is capped in DISPLAY only ("99+") while the accessible name
 * carries the real number, because "ninety-nine plus items" is useless when
 * you are trying to work out whether the basket is wrong.
 */
export function CartBadge({ count, href = "#", cap = 99, className }: {
  count: number;
  href?: string;
  cap?: number;
  className?: string;
}) {
  return (
    <a data-slot="cart-badge" href={href} aria-label={`Basket, ${count} item${count === 1 ? "" : "s"}`}
      className={cn("relative inline-flex cursor-pointer items-center p-1.5", className)}>
      <ShoppingBag className="size-5" aria-hidden />
      {count > 0 ? (
        <span aria-hidden
          className="absolute -end-0.5 -top-0.5 min-w-4 rounded-full bg-foreground px-1 text-center text-[10px] font-bold leading-4 text-background tabular-nums">
          {count > cap ? `${cap}+` : count}
        </span>
      ) : null}
      {/* The silent-change problem, fixed. */}
      <span role="status" aria-live="polite" className="sr-only">
        {count} item{count === 1 ? "" : "s"} in the basket
      </span>
    </a>
  );
}
