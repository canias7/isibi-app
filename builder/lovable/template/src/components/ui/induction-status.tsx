import { cn } from "@/lib/utils";
/**
 * How far through joining somebody is — and what is blocking them.
 *
 * IT DISTINGUISHES WHAT THE VOLUNTEER MUST DO FROM WHAT THE ORGANISATION MUST
 * DO. Most stalled inductions are waiting on the organisation — a reference
 * nobody chased, a check nobody submitted — and a checklist presented as the
 * volunteer's homework blames somebody who is waiting patiently.
 *
 * WHAT THEY CAN DO MEANWHILE IS STATED. Somebody who has to wait six weeks for
 * a check can usually do plenty in the meantime, and telling them so is the
 * difference between keeping them and losing them.
 *
 * A CHECK HAS AN EXPIRY, and it is shown. Renewals are missed silently, and a
 * lapsed check means the same person cannot do the same role they did last
 * week.
 *
 * IT DOES NOT SHOW A PERCENTAGE. Four of six steps is not two thirds of the way
 * in when the outstanding one takes six weeks, and a progress bar promises a
 * pace that does not exist.
 */
export type InductionStep = {
  id: string;
  what: string;
  done?: boolean;
  /** True where the organisation is the blocker, not the volunteer. */
  onUs?: boolean;
  /** Free text — "expires 14 March 2028". */
  expires?: string;
  waitNote?: string;
};

export function InductionStatus({ volunteer, steps, canDoMeanwhile = [], className }: {
  volunteer?: string;
  steps: InductionStep[];
  /** Roles available before induction completes. */
  canDoMeanwhile?: string[];
  className?: string;
}) {
  const outstanding = steps.filter((s) => !s.done);
  const onUs = outstanding.filter((s) => s.onUs);
  const onThem = outstanding.filter((s) => !s.onUs);
  return (
    <div data-slot="induction-status" className={cn("space-y-1.5", className)}>
      {volunteer && <p className="text-sm">{volunteer}</p>}
      <p className="text-sm">
        {outstanding.length === 0 ? (
          "Fully inducted."
        ) : onThem.length === 0 ? (
          <span className="font-medium">Waiting on us, not on them.</span>
        ) : (
          <span className="font-medium">
            {onThem.length} {onThem.length === 1 ? "thing" : "things"} for them to do
            {onUs.length > 0 && `, ${onUs.length} for us`}.
          </span>
        )}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {steps.map((s) => (
          <li key={s.id} className="space-y-0.5 px-3 py-1.5">
            <p className="flex items-baseline gap-3">
              <span className={cn("min-w-0 flex-1", s.done && "text-muted-foreground")}>{s.what}</span>
              <span className={cn("shrink-0 text-xs", s.done ? "text-muted-foreground" : "font-medium")}>
                {s.done ? "Done" : s.onUs ? "With us" : "With them"}
              </span>
            </p>
            {s.expires && <p className="text-xs text-muted-foreground">{s.expires}</p>}
            {!s.done && s.waitNote && <p className="text-xs text-muted-foreground">{s.waitNote}</p>}
          </li>
        ))}
      </ul>
      {outstanding.length > 0 && canDoMeanwhile.length > 0 && (
        <p className="text-xs">
          Meanwhile they can already help with {canDoMeanwhile.join(", ")}.
        </p>
      )}
    </div>
  );
}
