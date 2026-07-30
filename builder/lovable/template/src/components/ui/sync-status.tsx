import { TimeAgo } from "@/components/ui/time-ago";
import { RefreshCw, Check, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Saved", "Saving…", "Couldn't save".
 *
 * The failed state keeps its retry visible and does NOT fade away on a timer:
 * an autosave that quietly gave up half an hour ago is the reason somebody
 * loses an afternoon's work.
 */
export function SyncStatus({ state, at, onRetry, className }: {
  state: "idle" | "syncing" | "saved" | "error";
  at?: string | number | Date | null; onRetry?: () => void; className?: string;
}) {
  if (state === "idle") return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)} aria-live="polite">
      {state === "syncing" && <><RefreshCw className="size-3.5 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Saving…</span></>}
      {state === "saved" && <><Check className="size-3.5 text-success" /><span className="text-muted-foreground">
        Saved{at ? <> <TimeAgo date={at} /></> : null}</span></>}
      {state === "error" && <>
        <TriangleAlert className="size-3.5 text-destructive" />
        <span className="text-destructive">Couldn&apos;t save</span>
        {onRetry && <button type="button" onClick={onRetry}
          className="cursor-pointer underline underline-offset-2 hover:no-underline">Retry</button>}
      </>}
    </span>
  );
}
