import { cn } from "@/lib/utils";
/**
 * One operation in the sequence — where the job is and where it goes next.
 *
 * SETUP AND RUN TIME ARE SEPARATE, and that separation is the whole of small-
 * batch scheduling. A twenty-minute setup on a two-minute part means ten pieces
 * cost 40 minutes and a hundred cost 220 — a single "time" figure gets batching
 * decisions wrong in both directions.
 *
 * THE QUEUE IN FRONT OF THE MACHINE IS SHOWN. Most of a job's lead time is
 * waiting, not cutting, and a routing that shows only process time promises a
 * date the shop floor cannot meet.
 *
 * THE NEXT STEP IS NAMED. A finished operation with nowhere stated to go is a
 * trolley parked beside a machine, which is where work-in-progress accumulates.
 *
 * A STEP OUT OF SEQUENCE IS SAID SO, not silently allowed. Skipping an
 * inspection because the next machine was free is the ordinary way a batch
 * reaches dispatch unchecked. It is suppressed on a step that has not started —
 * a job that has not begun cannot have begun early, and rendering both makes
 * the whole row read as unreliable.
 */
export function RoutingStep({ number, operation, workCentre, setupMinutes, runMinutesEach, quantity, queueAhead, nextStep, state = "todo", outOfSequence, className }: {
  number?: number;
  operation: string;
  workCentre?: string;
  setupMinutes?: number;
  /** Per piece. */
  runMinutesEach?: number;
  quantity?: number;
  /** Jobs waiting at this work centre. */
  queueAhead?: number;
  nextStep?: string;
  state?: "done" | "running" | "todo";
  outOfSequence?: boolean;
  className?: string;
}) {
  const total = setupMinutes !== undefined && runMinutesEach !== undefined && quantity !== undefined
    ? setupMinutes + runMinutesEach * quantity
    : undefined;
  // "17h 0m" is noise on a figure somebody is scanning — an exact hour reads as
  // an hour.
  const fmt = (m: number) => {
    if (m < 60) return `${Math.round(m)}m`;
    const h = Math.floor(m / 60);
    const rest = Math.round(m % 60);
    return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
  };
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        {number !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{number}.</span>}
        <span className={cn("min-w-0 flex-1", state === "running" && "font-medium", state === "done" && "text-muted-foreground")}>
          {operation}
          {workCentre && <span className="text-muted-foreground"> · {workCentre}</span>}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {state === "done" ? "Done" : state === "running" ? "Running" : "To come"}
        </span>
      </p>
      {(setupMinutes !== undefined || runMinutesEach !== undefined) && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {setupMinutes !== undefined && `${fmt(setupMinutes)} setup`}
          {runMinutesEach !== undefined && `${setupMinutes !== undefined ? " · " : ""}${runMinutesEach}m each`}
          {total !== undefined && ` · ${fmt(total)} for ${quantity}`}
        </p>
      )}
      {queueAhead !== undefined && queueAhead > 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {queueAhead} {queueAhead === 1 ? "job" : "jobs"} waiting at this machine.
        </p>
      )}
      {nextStep && state !== "todo" && (
        <p className="text-xs text-muted-foreground">Goes to {nextStep} next.</p>
      )}
      {outOfSequence && state !== "todo" && (
        <p className="text-xs font-medium">Started before the step before it finished.</p>
      )}
    </li>
  );
}
