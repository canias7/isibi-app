import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A row of primary destinations pinned to the bottom on a phone.
 *
 * IT SITS ABOVE THE SAFE AREA, using `env(safe-area-inset-bottom)`. Without it,
 * a dock on an iPhone has its bottom third behind the home indicator — the part
 * with the labels — and taps near the edge get swallowed by the system gesture.
 *
 * Every item keeps a VISIBLE LABEL, not just an icon. An icon-only bar is a row
 * of guesses; the labels are why people can find the second tab. `nav-badge`
 * counts go on top of the icon, not the label.
 *
 * FIVE ITEMS MAXIMUM is the honest limit and the header says so, because the
 * component cannot enforce what a caller passes: past five, the touch targets
 * fall below the 44px anyone can hit reliably.
 *
 * `aria-current="page"` marks the active one, and the active state is weight
 * plus a bar — not colour, and not size, since a growing icon shifts its
 * neighbours.
 */
export function Dock({ items, className }: {
  items: { key: string; label: string; icon: React.ReactNode; href?: string; active?: boolean; badge?: React.ReactNode; onClick?: () => void }[];
  className?: string;
}) {
  return (
    <nav data-slot="dock"
      aria-label="Main"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      className={cn("sticky bottom-0 z-30 border-t border-border bg-background md:hidden", className)}
    >
      <ul className="flex">
        {items.slice(0, 5).map((i) => {
          const body = (
            <>
              <span className="relative">
                {i.icon}
                {i.badge ? (
                  <span className="absolute -top-1 -end-2 rounded-full bg-foreground px-1 text-[9px] leading-4 font-medium text-background">
                    {i.badge}
                  </span>
                ) : null}
              </span>
              <span className="text-[10px]">{i.label}</span>
            </>
          );
          const cls = cn("flex min-h-11 w-full flex-col items-center justify-center gap-0.5 py-1.5",
            i.active ? "font-medium" : "text-muted-foreground");
          return (
            <li key={i.key} className="relative flex-1">
              {i.active ? <span aria-hidden className="absolute inset-x-4 top-0 h-0.5 bg-foreground" /> : null}
              {i.href ? (
                <a href={i.href} aria-current={i.active ? "page" : undefined} className={cls}>{body}</a>
              ) : (
                <button type="button" onClick={i.onClick} aria-current={i.active ? "page" : undefined}
                  className={cn(cls, "cursor-pointer")}>{body}</button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
