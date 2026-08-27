import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * An empty list that says what to do FIRST — one action, not a menu.
 *
 * ONE PRIMARY ACTION. An empty state offering three buttons has moved the
 * blank-page problem into the empty state; the component takes a single
 * `action` and an optional quiet `learn` link, and the type makes a third
 * option somewhere else's problem on purpose.
 *
 * THE HEADLINE SAYS WHAT WILL BE HERE, the line under it says what doing
 * the action gets them — "No bookings yet / Your first booking appears
 * the moment a customer picks a slot" beats "Nothing to display", which
 * reads as an error wearing better fonts.
 *
 * HOW IT DIFFERS from content-placeholder: that one separates owner from
 * visitor on a PUBLISHED site; this is the app's own empty screen for its
 * own user, where the first action is always theirs to take.
 */
export function EmptyCta({ what, why, action, learn, className }: {
  what: React.ReactNode;
  why?: React.ReactNode;
  action: React.ReactNode;
  learn?: { href: string; label: React.ReactNode };
  className?: string;
}) {
  return (
    <div data-slot="empty-cta" className={cn("flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center", className)}>
      <div>
        <p className="text-sm font-semibold">{what}</p>
        {why ? <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{why}</p> : null}
      </div>
      {action}
      {learn ? (
        <a href={learn.href} className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2">
          {learn.label}
        </a>
      ) : null}
    </div>
  );
}
