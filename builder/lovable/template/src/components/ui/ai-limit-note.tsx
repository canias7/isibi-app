import { cn } from "@/lib/utils";
/**
 * How much of an allowance is left, and when it comes back.
 *
 * THE RESET TIME IS THE POINT. "You have used 40 of 50" tells somebody they are
 * running out and nothing about what to do; "40 of 50, resets tomorrow at 09:00"
 * tells them whether to wait or to upgrade. A limit with no stated reset reads
 * as permanent, which is why people email support about it.
 *
 * THREE STATES, NOT A GAUGE. Plenty left says nothing at all — a progress bar
 * on every screen makes an ordinary allowance feel like a countdown. It speaks
 * up near the end, and states plainly when there is nothing left.
 *
 * `role="status"` only when exhausted, so a screen reader hears about it at the
 * moment it starts refusing rather than on every render.
 *
 * NO UPGRADE BUTTON BUILT IN — the caller passes an action if it has one. A
 * component that always sells is one an internal tool cannot use.
 */
export function AiLimitNote({ used, limit, resetsAt, unit = "requests", warnAt = 0.8, action, className }: {
  used: number;
  limit: number;
  /** Free text — "tomorrow at 09:00", "in 20 minutes", "1 August". */
  resetsAt?: string;
  unit?: string;
  /** Fraction of the limit at which to start warning. */
  warnAt?: number;
  action?: React.ReactNode;
  className?: string;
}) {
  const left = Math.max(0, limit - used);
  const out = left === 0;
  const near = !out && used / limit >= warnAt;
  if (!out && !near) return null;
  return (
    <div {...(out ? { role: "status" } : {})}
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border px-3 py-2 text-sm",
        out && "border-foreground/40 bg-muted/40", className)}>
      <span className={cn(out && "font-medium")}>
        {out ? `No ${unit} left` : `${left} ${unit} left`}
      </span>
      {resetsAt && <span className="text-xs text-muted-foreground">Resets {resetsAt}</span>}
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );
}
