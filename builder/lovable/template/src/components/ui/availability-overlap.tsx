import { cn } from "@/lib/utils";
/**
 * When two people are both free — with the time zones resolved.
 *
 * THE OVERLAP IS SHOWN IN BOTH LOCAL TIMES. Every remote scheduling failure is
 * a time-zone failure, and a single time on a shared page is wrong for one of
 * the two people reading it — usually the one who did not send the invitation.
 *
 * NO OVERLAP IS A REAL ANSWER AND IS STATED AS ONE. Two people eight hours
 * apart with ordinary working hours genuinely cannot meet, and a system that
 * keeps offering slots outside somebody's day is asking one of them to take a
 * call at 23:00 without saying so.
 *
 * A SLOT OUTSIDE NORMAL HOURS FOR ONE SIDE IS FLAGGED. It is sometimes the
 * right answer, and it should be a decision rather than something discovered on
 * the day.
 *
 * IT DOES NOT COMPUTE TIME ZONES ITSELF. Offsets change with daylight saving on
 * different dates in different places, and a component doing its own arithmetic
 * is confidently wrong twice a year.
 */
export type OverlapSlot = {
  id: string;
  /** Pre-formatted in each side's own local time. */
  yours: string;
  theirs: string;
  /** True where it falls outside somebody's stated hours. */
  outsideHoursFor?: "you" | "them";
};

export function AvailabilityOverlap({ slots, yourZone, theirZone, theirName, className }: {
  slots: OverlapSlot[];
  /** "Europe/London". */
  yourZone?: string;
  theirZone?: string;
  theirName?: string;
  className?: string;
}) {
  const awkward = slots.filter((s) => s.outsideHoursFor);
  return (
    <div className={cn("space-y-1.5", className)}>
      {(yourZone || theirZone) && (
        <p className="text-xs text-muted-foreground">
          Your time{yourZone ? ` (${yourZone})` : ""} first, then {theirName ?? "theirs"}
          {theirZone ? ` (${theirZone})` : ""}.
        </p>
      )}
      {slots.length === 0 ? (
        <p className="text-sm font-medium">
          There is no overlap in your working hours at all. One of you would have to move.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {slots.map((s) => (
            <li key={s.id} className="space-y-0.5 px-3 py-1.5">
              <p className="flex items-baseline gap-3 tabular-nums">
                <span className="min-w-0 flex-1">{s.yours}</span>
                <span className="shrink-0 text-muted-foreground">{s.theirs}</span>
              </p>
              {s.outsideHoursFor && (
                <p className="text-xs font-medium">
                  Outside {s.outsideHoursFor === "you" ? "your" : "their"} normal hours — worth asking before booking it.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {slots.length > 0 && awkward.length === slots.length && (
        <p className="text-xs font-medium">
          Every option is outside somebody's normal hours. That is a real constraint, not a scheduling puzzle.
        </p>
      )}
    </div>
  );
}
