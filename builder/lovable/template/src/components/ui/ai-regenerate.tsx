import * as React from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Try again — optionally with a nudge.
 *
 * A PLAIN RETRY USUALLY PRODUCES THE SAME THING. The useful version lets the
 * reader say what was wrong with it — "shorter", "less formal" — which is the
 * difference between rolling dice and steering.
 *
 * THE PREVIOUS ATTEMPT IS NOT DISCARDED. `generation-history` keeps them, and
 * this says how many there have been, because the third attempt is often worse
 * than the first and losing it is the frustration people remember.
 *
 * `BusyButton`-style guarding: regenerating twice by accident costs real money
 * and produces two answers where one was wanted.
 */
export function AiRegenerate({ attempt, onRegenerate, hints, busy, className }: {
  /** Which attempt this is, 1-based. */
  attempt?: number;
  onRegenerate: (hint?: string) => void;
  /** Quick steers — ["shorter", "less formal", "more detail"]. */
  hints?: string[];
  busy?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div data-slot="ai-regenerate" className={cn("flex flex-wrap items-center gap-2", className)}>
      <button type="button" disabled={busy} onClick={() => onRegenerate()}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50">
        <RefreshCw aria-hidden className={cn("size-3.5", busy && "animate-spin")} />
        {busy ? "Trying again…" : "Try again"}
      </button>
      {hints?.length ? (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className="cursor-pointer text-xs underline underline-offset-2">but different</button>
          {open && (
            <span className="flex flex-wrap gap-1">
              {hints.map((h) => (
                <button key={h} type="button" disabled={busy} onClick={() => onRegenerate(h)}
                  className="cursor-pointer rounded border border-border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-50">
                  {h}
                </button>
              ))}
            </span>
          )}
        </>
      ) : null}
      {typeof attempt === "number" && attempt > 1 && (
        <span className="text-xs text-muted-foreground tabular-nums">attempt {attempt}</span>
      )}
    </div>
  );
}
