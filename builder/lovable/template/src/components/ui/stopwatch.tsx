import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Start · pause · lap · reset — the one clock that earns a seconds tick.
 *
 * PAUSE IS BOOKKEEPING, NOT A STOPPED COUNTER: accumulated time is
 * (finished stretches) + (now - the running stretch's start), all from
 * timestamps — the elapsed-timer discipline with a pause ledger. A
 * background tab changes nothing because nothing accumulates per tick.
 *
 * LAPS RECORD SPLITS (this lap's time), newest first, with the total
 * beside — the two numbers a person timing haircuts actually compares.
 * Lap while paused is refused by disabling, not ignored: a button that
 * swallows presses teaches distrust (the busy-button family).
 *
 * The tick runs ONLY while running — a mounted-but-paused stopwatch
 * costs nothing.
 */
function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function Stopwatch({ className }: { className?: string }) {
  const [running, setRunning] = React.useState(false);
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  const base = React.useRef(0);          // finished stretches, ms
  const startedAt = React.useRef<number | null>(null);
  const lastLapAt = React.useRef(0);     // elapsed-ms when the last lap was cut
  const [laps, setLaps] = React.useState<{ n: number; split: number; total: number }[]>([]);

  const elapsed = base.current + (startedAt.current != null ? Date.now() - startedAt.current : 0);

  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running]);

  const toggle = () => {
    if (running) {
      base.current += Date.now() - (startedAt.current ?? Date.now());
      startedAt.current = null;
      setRunning(false);
    } else {
      startedAt.current = Date.now();
      setRunning(true);
    }
  };
  const lap = () => {
    const total = base.current + (startedAt.current != null ? Date.now() - startedAt.current : 0);
    setLaps((l) => [{ n: l.length + 1, split: total - lastLapAt.current, total }, ...l]);
    lastLapAt.current = total;
  };
  const reset = () => {
    base.current = 0; startedAt.current = null; lastLapAt.current = 0;
    setRunning(false); setLaps([]);
  };

  return (
    <div data-slot="stopwatch" className={cn("flex flex-col gap-2", className)}>
      <p className="font-mono text-2xl tabular-nums" data-stopwatch-time>{fmt(elapsed)}</p>
      <div className="flex gap-2">
        <button type="button" onClick={toggle}
          className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          {running ? "Pause" : elapsed > 0 ? "Resume" : "Start"}
        </button>
        <button type="button" onClick={lap} disabled={!running}
          className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40">
          Lap
        </button>
        <button type="button" onClick={reset} disabled={elapsed === 0}
          className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40">
          Reset
        </button>
      </div>
      {laps.length ? (
        <ol className="divide-y divide-border rounded-md border border-border text-sm">
          {laps.map((l) => (
            <li key={l.n} className="flex justify-between gap-3 px-2.5 py-1 tabular-nums">
              <span className="text-muted-foreground">Lap {l.n}</span>
              <span>{fmt(l.split)} <span className="text-xs text-muted-foreground">· at {fmt(l.total)}</span></span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
