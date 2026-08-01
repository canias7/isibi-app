import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Something long-running, happening away from the page.
 *
 * A job the reader started and can walk away from — an import, an export, a
 * bulk update. The claim this makes is "you may leave", and it is only true if
 * the caller really does keep the work going; the wording says so explicitly
 * because a reader who stays and watches a progress bar for six minutes has
 * been failed by the interface, not by the job.
 *
 * STATE IS A WORD, never a colour. Queued, running, done and failed each read
 * as text, so the card survives greyscale and a screen reader gets the same
 * information as everybody else.
 *
 * Cancel disappears once the job is finished rather than greying out — a
 * disabled control invites a click and then explains nothing.
 */
export function BackgroundJob({
  name, state, progress, detail, onCancel, onView, className,
}: {
  name: string;
  state: "queued" | "running" | "done" | "failed";
  /** 0-1. Omit for work with no measurable total. */
  progress?: number;
  /** "412 of 5,000 rows" — the specifics under the bar. */
  detail?: string;
  onCancel?: () => void;
  onView?: () => void;
  className?: string;
}) {
  const WORD = { queued: "Queued", running: "Running", done: "Finished", failed: "Failed" };
  const pct = typeof progress === "number" ? Math.round(Math.min(Math.max(progress, 0), 1) * 100) : null;
  const live = state === "running" || state === "queued";

  return (
    <div className={cn("flex flex-col gap-2 rounded-md border border-border p-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{name}</p>
        <p role="status" className="text-sm text-muted-foreground">{WORD[state]}</p>
      </div>
      {pct !== null && live && (
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
        </div>
      )}
      {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
      {live && <p className="text-xs text-muted-foreground">This keeps going if you leave the page.</p>}
      <div className="flex flex-wrap gap-2">
        {onView && <Button size="sm" variant="outline" onClick={onView}>View</Button>}
        {onCancel && live && <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}
