import { cn } from "@/lib/utils";
/**
 * What a machine is doing right now — and how long it has been doing it.
 *
 * THE DURATION IS THE INFORMATION, NOT THE STATE. "Stopped" is unremarkable;
 * "stopped for 40 minutes" is somebody standing next to a machine nobody has
 * come to. The board exists so a supervisor sees the second one from across the
 * shop.
 *
 * IDLE AND STOPPED ARE DIFFERENT AND BOTH ARE COUNTED. Idle is no work
 * scheduled — a planning problem; stopped is a fault — a maintenance one. A
 * board that shows one "not running" state sends the wrong person.
 *
 * STATE IS CARRIED BY THE WORD, and a stopped machine additionally by weight.
 * A colour-coded board is unreadable printed, in greyscale, and to a
 * significant minority of the people it is hung in front of.
 *
 * THE JOB AND THE OPERATOR ARE NAMED, because the first question after "why is
 * it stopped" is "who is on it", and a board that cannot answer sends somebody
 * walking.
 */
export type MachineState = "running" | "setup" | "idle" | "stopped" | "maintenance";

const WORDS: Record<MachineState, string> = {
  running: "Running",
  setup: "Being set up",
  idle: "Idle — nothing scheduled",
  stopped: "Stopped",
  maintenance: "Planned maintenance",
};

export function MachineStatus({ machine, state, sinceMinutes, job, operator, reason, className }: {
  machine: string;
  state: MachineState;
  /** How long it has been in this state. */
  sinceMinutes?: number;
  job?: string;
  operator?: string;
  /** Why it stopped. */
  reason?: string;
  className?: string;
}) {
  const fmt = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`);
  const bad = state === "stopped";
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1 font-medium">{machine}</span>
        <span className={cn("shrink-0", bad && "font-medium")}>{WORDS[state]}</span>
      </p>
      {sinceMinutes !== undefined && (
        <p className={cn("text-xs tabular-nums", bad ? "font-medium" : "text-muted-foreground")}>
          {fmt(sinceMinutes)} in this state
        </p>
      )}
      {reason && <p className="text-xs">{reason}</p>}
      <p className="text-xs text-muted-foreground">
        {job ? job : "No job loaded"}
        {operator ? ` · ${operator}` : " · nobody assigned"}
      </p>
    </li>
  );
}
