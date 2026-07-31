import * as React from "react";
import { BellOff, Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The empty notification list — three different empties, three messages.
 *
 * "ALL CAUGHT UP" AND "NOTHING YET" ARE NOT THE SAME. One is an achievement on
 * an account that has been using the product; the other is a new account where
 * the feature has never fired. Showing "all caught up" to somebody on day one
 * is a small lie that makes the whole screen feel generic.
 *
 * A LIST EMPTIED BY A FILTER SAYS SO and offers to clear it — the same failure
 * `search-empty` prevents. A filtered notification list showing "all caught up"
 * is how somebody misses everything in the category they filtered out.
 *
 * IT SAYS WHERE NOTIFICATIONS COME FROM on a new account, because the commonest
 * reason for a permanently empty list is that nothing has been turned on.
 *
 * `role="status"` so the transition into empty is announced — clearing the last
 * item is a moment worth hearing.
 */
export function NotificationEmpty({ reason = "caught-up", filterLabel, onClearFilter, settingsHref, className }: {
  reason?: "caught-up" | "new" | "filtered" | "muted";
  filterLabel?: React.ReactNode;
  onClearFilter?: () => void;
  settingsHref?: string;
  className?: string;
}) {
  const content = {
    "caught-up": {
      icon: <Check aria-hidden className="size-5" />,
      title: "All caught up",
      body: "Nothing new since you last looked.",
    },
    new: {
      icon: <BellOff aria-hidden className="size-5 text-muted-foreground" />,
      title: "No notifications yet",
      body: <>You&rsquo;ll be told here when somebody books, comments or mentions you.</>,
    },
    filtered: {
      icon: <BellOff aria-hidden className="size-5 text-muted-foreground" />,
      title: "Nothing matches this filter",
      body: <>There may be notifications in the other categories.</>,
    },
    muted: {
      icon: <BellOff aria-hidden className="size-5 text-muted-foreground" />,
      title: "Notifications are turned off",
      body: <>Nothing will appear here until you turn some back on.</>,
    },
  }[reason];

  return (
    <div role="status" className={cn("flex flex-col items-center gap-2 py-10 text-center", className)}>
      {content.icon}
      <p className="text-sm font-medium">{content.title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{content.body}</p>
      {reason === "filtered" && onClearFilter ? (
        <button type="button" onClick={onClearFilter}
          className="cursor-pointer text-xs underline underline-offset-2">
          Clear the {filterLabel ?? "filter"}
        </button>
      ) : null}
      {(reason === "new" || reason === "muted") && settingsHref ? (
        <a href={settingsHref} className="text-xs underline underline-offset-2">Choose what you get told about</a>
      ) : null}
    </div>
  );
}
