import { cn } from "@/lib/utils";
/**
 * A volunteer shift somebody can take — with what it actually involves.
 *
 * WHAT THE SHIFT PHYSICALLY REQUIRES IS STATED. Standing for four hours,
 * lifting, being outside, working alone — these decide whether somebody can do
 * it, and a shift list that hides them gets people who withdraw on the day or,
 * worse, who turn up and struggle.
 *
 * "STILL NEEDED" IS SHOWN AS A NUMBER. A shift with two of four filled recruits
 * far better than one presented as simply available, and a full shift stops
 * absorbing sign-ups that another shift needs.
 *
 * WHETHER SOMEBODY WOULD BE ALONE IS ITS OWN FIELD. Lone working is a
 * safeguarding and a safety question for the organiser and a comfort question
 * for the volunteer, and it is never in the shift title.
 *
 * WITHDRAWING IS AS EASY AS SIGNING UP. A rota people cannot leave is a rota
 * they stop joining, and an unnoticed non-attendance is worse for the
 * organiser than a week's notice.
 */
export function ShiftSignup({ role, when, where, filled = 0, needed, requirements = [], loneWorking, signedUp, onSignUp, onWithdraw, className }: {
  role: string;
  /** Free text — "Saturday 16 August, 09:00 to 13:00". */
  when: string;
  where?: string;
  filled?: number;
  needed?: number;
  /** "Mostly standing", "some lifting", "outdoors whatever the weather". */
  requirements?: string[];
  /** True where the volunteer would be on their own. */
  loneWorking?: boolean;
  /** Whether this person has taken it. */
  signedUp?: boolean;
  onSignUp?: () => void;
  onWithdraw?: () => void;
  className?: string;
}) {
  const short = needed !== undefined ? needed - filled : undefined;
  const full = short !== undefined && short <= 0;
  return (
    <li className={cn("space-y-1 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {role}
          <span className="block text-xs text-muted-foreground">
            {when}
            {where && ` · ${where}`}
          </span>
        </span>
        {short !== undefined && (
          <span className={cn("shrink-0 text-xs tabular-nums", !full && "font-medium")}>
            {full ? "Full" : `${short} still needed`}
          </span>
        )}
      </p>
      {requirements.length > 0 && (
        <p className="text-xs text-muted-foreground">{requirements.join(" · ")}</p>
      )}
      {loneWorking && (
        <p className="text-xs">You would be on your own for this one.</p>
      )}
      {signedUp ? (
        <p className="text-xs">
          You are down for this.
          {onWithdraw && (
            <button type="button" onClick={onWithdraw} className="pl-2 underline underline-offset-2">
              Can't make it any more
            </button>
          )}
        </p>
      ) : (
        onSignUp && !full && (
          <button type="button" onClick={onSignUp} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium">
            I can do this
          </button>
        )
      )}
    </li>
  );
}
