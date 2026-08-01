import { cn } from "@/lib/utils";
/**
 * Choosing an entry slot — with what the time actually commits you to.
 *
 * IT SAYS WHETHER THE SLOT IS AN ENTRY WINDOW OR A FIXED START. Visitors treat
 * every timed ticket as a deadline and arrive an hour early in the rain; most
 * are a window with a grace period, and saying so removes a real anxiety and a
 * real queue.
 *
 * IT SAYS WHETHER STAYING ON IS ALLOWED. "10:30 entry" and "10:30 to 11:30
 * visit" are wholly different products, and the difference is discovered by
 * being asked to leave.
 *
 * REMAINING PLACES ARE SHOWN AS A COUNT ONLY WHEN GENUINELY LOW. Displaying
 * "3 left" on every slot is a pressure tactic; showing real scarcity is
 * information, and mixing them destroys the credibility of both.
 *
 * A SOLD-OUT SLOT STAYS VISIBLE AND DISABLED, because removing it makes the day
 * look sparse and hides the pattern that would tell somebody to try earlier.
 */
export type EntrySlot = { id: string; time: string; left?: number; soldOut?: boolean };

export function TimedEntry({ slots, windowMinutes, stayAsLongAsYouLike = true, lowThreshold = 10, selected, onSelect, className }: {
  slots: EntrySlot[];
  /** Grace period on the stated time. */
  windowMinutes?: number;
  /** False where the ticket is for a fixed-length visit. */
  stayAsLongAsYouLike?: boolean;
  /** Below this, the remaining count is shown. */
  lowThreshold?: number;
  selected?: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs text-muted-foreground">
        {windowMinutes
          ? `Arrive any time within ${windowMinutes} minutes of your slot.`
          : "Please arrive at your slot time."}
        {stayAsLongAsYouLike
          ? " Once in, stay as long as you like."
          : " The visit ends at the stated time."}
      </p>
      <ul className="flex flex-wrap gap-2">
        {slots.map((s) => {
          const low = !s.soldOut && s.left !== undefined && s.left <= lowThreshold;
          const isSel = selected === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={s.soldOut}
                aria-pressed={isSel}
                onClick={() => onSelect?.(s.id)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm tabular-nums",
                  isSel ? "border-foreground font-medium" : "border-border",
                  s.soldOut && "text-muted-foreground line-through",
                )}
              >
                {s.time}
                {low && <span className="block text-xs font-medium">{s.left} left</span>}
                {s.soldOut && <span className="sr-only"> — sold out</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
