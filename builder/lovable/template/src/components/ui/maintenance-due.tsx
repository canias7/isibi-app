import { cn } from "@/lib/utils";
/**
 * A maintenance item — due on whichever limit arrives first.
 *
 * CALENDAR TIME, HOURS AND CYCLES RUN IN PARALLEL AND THE FIRST ONE WINS. An
 * item due at 500 hours or 12 months is due at whichever comes sooner, and a
 * system tracking one of them lets the other pass unnoticed. Showing which
 * limit is driving it is the whole job.
 *
 * A GROUNDING ITEM IS SEPARATED FROM ONE THAT MERELY NEEDS BOOKING. Some
 * overdue items stop the vehicle immediately and some are advisory, and treating
 * them alike means either grounding needlessly or flying something that should
 * not be.
 *
 * THE TOLERANCE IS SHOWN WHERE ONE EXISTS. Many schedules permit a small
 * overrun, and a component ignoring it reports an item as overdue while it is
 * legitimately within limits.
 *
 * A DEFERRED ITEM CARRIES ITS DEFERRAL AND ITS OWN DEADLINE. Deferral is
 * normal and time-limited, and a deferred item with no expiry is how something
 * is deferred permanently.
 */
export function MaintenanceDue({ item, dueAtHours, currentHours, dueAtCycles, currentCycles, dueOn, daysToDue, toleranceNote, grounding, deferredUntil, className }: {
  item: string;
  dueAtHours?: number;
  currentHours?: number;
  dueAtCycles?: number;
  currentCycles?: number;
  /** Free text calendar limit. */
  dueOn?: string;
  daysToDue?: number;
  /** "Plus or minus 10 hours." */
  toleranceNote?: string;
  /** True where being overdue stops it operating. */
  grounding?: boolean;
  /** Free text — where the item has been deferred. */
  deferredUntil?: string;
  className?: string;
}) {
  const hoursLeft = dueAtHours !== undefined && currentHours !== undefined ? dueAtHours - currentHours : undefined;
  const cyclesLeft = dueAtCycles !== undefined && currentCycles !== undefined ? dueAtCycles - currentCycles : undefined;
  // Whichever limit arrives first is the one that matters; the others are noise.
  // Each limit carries its own NOUN. Deriving one by stripping the number off
  // the label gave "the days limit arrives first", which is not English.
  const limits: { label: string; noun: string; left: number }[] = [
    ...(hoursLeft !== undefined ? [{ label: `${hoursLeft} hours`, noun: "hours", left: hoursLeft }] : []),
    ...(cyclesLeft !== undefined ? [{ label: `${cyclesLeft} cycles`, noun: "cycles", left: cyclesLeft }] : []),
    ...(daysToDue !== undefined ? [{ label: `${daysToDue} ${daysToDue === 1 ? "day" : "days"}`, noun: "calendar", left: daysToDue }] : []),
  ];
  const driving = limits.length > 0 ? limits.reduce((a, l) => (l.left < a.left ? l : a)) : undefined;
  const overdue = driving !== undefined && driving.left < 0;
  return (
    <li data-slot="maintenance-due" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">{item}</span>
        {driving && (
          <span className={cn("shrink-0 tabular-nums", overdue && "font-medium")}>
            {overdue ? "Overdue" : `${driving.label} left`}
          </span>
        )}
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {[
          dueAtHours !== undefined ? `due at ${dueAtHours} hours` : null,
          dueAtCycles !== undefined ? `${dueAtCycles} cycles` : null,
          dueOn ? `or ${dueOn}` : null,
        ].filter(Boolean).join(" · ")}
      </p>
      {driving && !overdue && limits.length > 1 && (
        <p className="text-xs text-muted-foreground">
          The {driving.noun} limit arrives first — that is the one that matters.
        </p>
      )}
      {toleranceNote && <p className="text-xs text-muted-foreground">{toleranceNote}</p>}
      {overdue && (
        <p className="text-xs font-medium">
          {grounding
            ? "Overdue and grounding — this must not operate until it is done."
            : "Overdue. Book it, but it does not stop operation."}
        </p>
      )}
      {deferredUntil && (
        <p className="text-xs">Deferred until {deferredUntil} — deferral is time-limited, not indefinite.</p>
      )}
    </li>
  );
}
