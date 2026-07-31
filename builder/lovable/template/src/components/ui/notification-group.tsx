import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Many notifications about one thing, collapsed into a line.
 *
 * IT NAMES PEOPLE, NOT JUST A COUNT. "Ada, Grace and 4 others commented" is
 * useful; "6 new comments" is not, because whether to open it depends entirely
 * on who. Two names then a count is the shape every product converged on.
 *
 * GROUPING IS BY SUBJECT, never by time. Ten notifications about one booking
 * are one line; ten about ten bookings are ten lines. Time-bucketed grouping —
 * "this morning" — merges unrelated things and hides the one that matters.
 *
 * THE UNREAD COUNT IS PER GROUP and clearing the group clears them all, because
 * a collapsed group with three unread inside it that stays bold after being
 * opened is a badge nobody can get rid of.
 *
 * Expanding reveals the individual items; it does not navigate. The group line
 * is a summary, and pressing it to read the detail should not lose the list.
 */
export function NotificationGroup({
  subject, actors, verb, count, unread, at, expanded, onToggle, onOpen, children, className,
}: {
  subject: React.ReactNode;
  actors: string[];
  verb: string;
  count: number;
  unread?: number;
  at?: React.ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
  onOpen?: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  // Two names then a count: who it is decides whether to open it.
  const who = actors.length === 0 ? "Someone"
    : actors.length === 1 ? actors[0]
    : actors.length === 2 ? `${actors[0]} and ${actors[1]}`
    : `${actors[0]}, ${actors[1]} and ${actors.length - 2} ${actors.length - 2 === 1 ? "other" : "others"}`;

  return (
    <li className={cn("flex flex-col border-b border-border last:border-0", className)}>
      <div className="flex items-start gap-2 p-3">
        {unread ? <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground" /> : <span aria-hidden className="mt-1.5 size-1.5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen}
            className={cn("cursor-pointer text-left text-sm hover:underline", unread && "font-medium")}>
            {who} {verb} <strong className="font-semibold">{subject}</strong>
          </button>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            {at ? <span>{at}</span> : null}
            {count > 1 && onToggle ? (
              <button type="button" onClick={onToggle} aria-expanded={expanded}
                className="cursor-pointer underline underline-offset-2 hover:text-foreground">
                {expanded ? "Hide" : `Show all ${count}`}
              </button>
            ) : null}
            {unread ? <span className="tabular-nums">{unread} unread</span> : null}
          </p>
        </div>
      </div>
      {expanded ? <div className="border-t border-border bg-muted/30 px-3 py-2">{children}</div> : null}
    </li>
  );
}
