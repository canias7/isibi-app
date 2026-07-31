import * as React from "react";
import { Check, X, Loader } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A toast for something that takes a while — an upload, an export, a batch.
 *
 * IT DOES NOT AUTO-DISMISS WHILE RUNNING, and it does not disappear the instant
 * it finishes either. A progress notice that vanishes on completion leaves
 * somebody who looked away with no evidence it worked, which is exactly the
 * case a background job exists for.
 *
 * A FAILURE never auto-dismisses at all. The one outcome that needs a decision
 * is the one a timer must not take away.
 *
 * Indeterminate progress is a real state, distinct from zero. Most long jobs
 * cannot say how far along they are, and a bar frozen at 0% reads as stuck
 * while a moving indeterminate one reads as working.
 *
 * The count is written as "12 of 40", never a bare percentage. For a batch,
 * knowing how many items remain is what lets somebody decide whether to wait.
 */
export function ProgressToast({
  title, detail, value, total, status = "running", onCancel, onDismiss, className,
}: {
  title: React.ReactNode;
  detail?: React.ReactNode;
  value?: number;
  total?: number;
  status?: "running" | "done" | "failed";
  onCancel?: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  React.useEffect(() => {
    if (status !== "done" || !onDismiss) return;
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [status, onDismiss]);

  const known = value != null && total != null && total > 0;
  const pct = known ? Math.min(100, Math.max(0, (value / total) * 100)) : null;
  const Icon = status === "done" ? Check : status === "failed" ? X : Loader;

  return (
    <div role="status" aria-live="polite"
      className={cn("flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-lg border border-border bg-background p-3 shadow-lg", className)}>
      <div className="flex items-start gap-2.5">
        <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0",
          status === "running" && "motion-safe:animate-spin",
          status === "done" && "text-muted-foreground")} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {known ? `${value.toLocaleString()} of ${total.toLocaleString()}` : null}
            {known && detail ? " · " : null}
            {detail}
          </p>
        </div>
        {status !== "running" && onDismiss ? (
          <button type="button" onClick={onDismiss} aria-label="Dismiss"
            className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </div>

      {status === "running" ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          {pct != null ? (
            <div className="h-full rounded-full bg-foreground transition-[width] motion-reduce:transition-none"
              style={{ width: `${pct}%` }} />
          ) : (
            <div className="h-full w-1/3 rounded-full bg-foreground motion-safe:animate-[pulse_1.4s_ease-in-out_infinite]" />
          )}
        </div>
      ) : null}

      {status === "running" && onCancel ? (
        <button type="button" onClick={onCancel}
          className="cursor-pointer self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Cancel
        </button>
      ) : null}
    </div>
  );
}
