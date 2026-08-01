import { cn } from "@/lib/utils";
/**
 * How long is left before something is late — in working hours, not wall time.
 *
 * WORKING HOURS ARE THE ONLY HONEST UNIT for a response deadline. "Due in 14
 * hours" at 6pm on a Friday is due Monday morning, and a countdown in real
 * hours makes a comfortable deadline look alarming and an impossible one look
 * fine. The caller supplies the working-hours figure; this refuses to invent it
 * from a clock.
 *
 * OVERDUE COUNTS UP, not down past zero. "−3 hours left" is a sentence nobody
 * parses; "3 hours late" is the number that goes in an apology.
 *
 * IT GOES QUIET WHEN THERE IS PLENTY. A permanent countdown on every row turns
 * a real deadline into wallpaper, which is the failure this exists to prevent.
 *
 * `role="status"` only once it is inside the warning window or late, so it
 * announces when it starts mattering rather than on every render.
 */
export function DueSoonNote({ hoursLeft, warnWithin = 4, unitWord = "working hours", className }: {
  /** Working hours remaining. Negative when late. */
  hoursLeft: number;
  warnWithin?: number;
  unitWord?: string;
  className?: string;
}) {
  if (!Number.isFinite(hoursLeft)) return null;
  const late = hoursLeft < 0;
  if (!late && hoursLeft > warnWithin) return null;
  const n = Math.abs(Math.round(hoursLeft * 10) / 10);
  const shown = n < 1 ? "less than an hour" : `${n % 1 === 0 ? n : n.toFixed(1)} ${unitWord}`;
  return (
    <span role="status" className={cn("text-sm font-medium", className)}>
      {late ? `${shown} late` : n < 1 ? "Due within the hour" : `${shown} left`}
    </span>
  );
}
