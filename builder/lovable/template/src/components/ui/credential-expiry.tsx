import { cn } from "@/lib/utils";
/**
 * When a licence runs out, warning before it does rather than after.
 *
 * THE WARNING WINDOW IS THE POINT. An expired insurance certificate or DBS
 * check discovered on the day is a job cancelled; discovered eight weeks out it
 * is a form. Renewals take weeks, so the default window is 60 days rather than
 * the 7 a generic date component would pick.
 *
 * EXPIRED IS STATED IN THE PAST TENSE, with how long ago. "Expires 3 March"
 * beside a date already gone is the sentence that gets misread as still valid,
 * and the tense is what stops that.
 *
 * NO EXPIRY IS A REAL ANSWER, not a blank. Plenty of qualifications never
 * expire, and an empty cell in a compliance list reads as missing data —
 * which sends somebody chasing a renewal that does not exist.
 *
 * `daysLeft` IS PASSED IN, not computed from a browser clock. Whether something
 * has expired is the server's judgement, and a component that disagrees with
 * the record on the boundary day is worse than one that says nothing.
 */
export function CredentialExpiry({ on, daysLeft, warnWithin = 60, neverExpires, className }: {
  /** ISO date. */
  on?: string;
  /** Negative when expired. */
  daysLeft?: number;
  warnWithin?: number;
  neverExpires?: boolean;
  className?: string;
}) {
  if (neverExpires) return <span className={cn("text-xs text-muted-foreground", className)}>Does not expire</span>;
  if (!on) return null;
  const d = new Date(on);
  const ok = !Number.isNaN(d.getTime());
  const date = ok
    ? <time dateTime={d.toISOString().slice(0, 10)}>{d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time>
    : on;
  const expired = daysLeft !== undefined && daysLeft < 0;
  const soon = daysLeft !== undefined && daysLeft >= 0 && daysLeft <= warnWithin;
  return (
    <span className={cn("text-xs", expired || soon ? "font-medium" : "text-muted-foreground", className)}>
      {expired ? <>Expired {date}<span className="font-normal text-muted-foreground"> · {Math.abs(daysLeft!)} days ago</span></>
        : <>Expires {date}{soon && <span className="font-normal text-muted-foreground"> · in {daysLeft} days</span>}</>}
    </span>
  );
}
