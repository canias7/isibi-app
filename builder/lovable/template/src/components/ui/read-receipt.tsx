import { cn, isoAttr, toDate } from "@/lib/utils";
/**
 * Whether a message has been read, and by whom.
 *
 * "DELIVERED" AND "READ" ARE DIFFERENT CLAIMS and conflating them is how an
 * unanswered message gets treated as ignored. Delivered means it arrived; read
 * means somebody opened it. On a handover or an escalation, that distinction
 * decides whether to ring.
 *
 * WITH SEVERAL RECIPIENTS IT NAMES WHO HAS NOT READ IT, not who has. In a group
 * of six, the useful list is the two who have not seen it — that is who gets
 * chased, and every implementation shows the other four.
 *
 * NO BLUE TICKS. Two ticks versus one is a convention learnt from one app, it
 * is invisible in greyscale, and it says nothing to a screen reader. Words.
 *
 * IT NEVER GUESSES. Absent receipt data reads as "no read receipt", not as
 * unread — reporting somebody as not having read a message they read is worse
 * than saying nothing, because it gets them chased.
 */
export function ReadReceipt({ state, readBy = [], unreadBy = [], at, className }: {
  state: "sent" | "delivered" | "read" | "unknown";
  readBy?: string[];
  unreadBy?: string[];
  /** ISO date-time of the last state change. */
  at?: string;
  className?: string;
}) {
  const d = at ? toDate(at) : null;
  const ok = d && !Number.isNaN(d.getTime());
  const WORD = { sent: "Sent", delivered: "Delivered", read: "Read", unknown: "No read receipt" } as const;
  return (
    <p data-slot="read-receipt" className={cn("text-xs text-muted-foreground", className)}>
      <span className={cn(state === "read" && "text-foreground")}>{WORD[state]}</span>
      {ok && (
        <> · <time dateTime={isoAttr(d)}>
          {d!.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </time></>
      )}
      {unreadBy.length > 0 && (
        <span className="block">
          Not read by <span className="text-foreground">{unreadBy.join(", ")}</span>
        </span>
      )}
      {unreadBy.length === 0 && readBy.length > 0 && (
        <span className="block">Read by everyone — {readBy.join(", ")}</span>
      )}
    </p>
  );
}
