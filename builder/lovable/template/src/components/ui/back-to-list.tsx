import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Back to bookings" at the top of a detail page.
 *
 * IT IS A LINK TO A KNOWN PLACE, never `history.back()`. Somebody who arrived
 * from a search result, an email or a bookmark has a history whose previous
 * entry is not the list — so a back button sends them out of the site
 * entirely, which is exactly the case a breadcrumb-style link exists to cover.
 *
 * It NAMES the list. "Back" alone gives no idea what is being returned to, and
 * on a page reached from three different lists that matters.
 *
 * It preserves the list's STATE when the caller supplies it — the filters, the
 * page, the scroll position — because returning to page 1 of an unfiltered list
 * after opening the fortieth result is the single most irritating thing a
 * detail page can do.
 *
 * The chevron is `aria-hidden`; the link text already says the direction.
 */
export function BackToList({ href, label, state, className }: {
  href: string;
  label: React.ReactNode;
  state?: React.ReactNode;
  className?: string;
}) {
  return (
    <a data-slot="back-to-list" href={href}
      className={cn("inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground", className)}>
      <ChevronLeft aria-hidden className="size-4 shrink-0" />
      <span>Back to {label}</span>
      {state ? <span className="text-xs">({state})</span> : null}
    </a>
  );
}
