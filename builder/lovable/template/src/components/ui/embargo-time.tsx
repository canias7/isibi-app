import { cn } from "@/lib/utils";
/**
 * When something may be published — with the zone spelled out.
 *
 * AN EMBARGO WITHOUT A TIME ZONE IS BROKEN BY SOMEBODY IN GOOD FAITH, every
 * time. A newsroom in another country publishes at the stated hour on their own
 * clock, and the story is out. The zone is not a detail; it is the whole
 * instruction.
 *
 * "UNDER EMBARGO UNTIL" AND "NOT FOR PUBLICATION" ARE DIFFERENT. One has a
 * time; the other is indefinite and needs releasing by somebody. Presenting the
 * second as the first invites a guess at when it lapses.
 *
 * IT SAYS WHAT COUNTS AS BREAKING IT. Social posts, newsletters and podcast
 * recordings all publish at different moments, and a recipient acting honestly
 * still needs to know which of those the embargo covers.
 *
 * A LIFTED EMBARGO SAYS SO PLAINLY. Journalists sit on stories past the lift
 * because nobody told them, which is a loss for everybody involved.
 */
export function EmbargoTime({ until, timeZone, lifted, indefinite, covers = ["publication", "social media", "newsletters"], contact, className }: {
  /** Free text — "14:00 on 16 August". */
  until?: string;
  /** Required — "BST", "UTC". */
  timeZone?: string;
  lifted?: boolean;
  /** True where there is no time, only a release by somebody. */
  indefinite?: boolean;
  covers?: string[];
  /** Who can release it. */
  contact?: string;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  if (lifted) {
    return (
      <div className={cn("space-y-0.5 text-sm", className)}>
        <p className="font-medium">The embargo has lifted. This can be published now.</p>
      </div>
    );
  }
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      {indefinite ? (
        <p className="font-medium">
          Not for publication until released
          {contact ? ` by ${contact}` : ""}. There is no time on this one.
        </p>
      ) : (
        <p className="font-medium tabular-nums">
          Under embargo until {until ?? "a time nobody has stated"}
          {timeZone ? ` ${timeZone}` : ""}.
        </p>
      )}
      {!indefinite && !timeZone && (
        <p className="text-xs font-medium">
          No time zone given — somebody in another country will publish at that hour on their own clock.
        </p>
      )}
      {covers.length > 0 && (
        <p className="text-xs text-muted-foreground">Covers {AND.format(covers)}.</p>
      )}
      {/* Not sentence-initial: this field takes a role as often as a name ("the
          press office"), and a lowercase word opening a sentence reads as a typo
          while capitalising it would rewrite what the caller wrote. */}
      {contact && !indefinite && (
        <p className="text-xs text-muted-foreground">Can be released early by {contact}.</p>
      )}
    </div>
  );
}
