import { cn } from "@/lib/utils";
/**
 * The marker on a row that has been written locally and not confirmed yet.
 *
 * Optimistic UI shows the row instantly and is right almost every time — the
 * cost is the almost. Without a marker the reader cannot tell a saved row from
 * one still in flight, and cannot tell either from one that FAILED and is
 * about to vanish on the next refresh. This is the smallest honest answer.
 *
 * THREE STATES, EACH WITH A WORD. Pending is muted italic text, failed is bold
 * with a retry, saved renders nothing at all — a permanent tick on every
 * confirmed row is noise on a hundred-row list, and "no marker" already means
 * "fine" everywhere else in the interface.
 *
 * The retry is a real button with the row named in its accessible label, or a
 * list of these gives a screen reader twenty controls all called "Retry".
 */
export function OptimisticNote({ state, what, onRetry, className }: {
  state: "pending" | "failed" | "saved";
  /** Names the row in the retry's accessible label. */
  what?: string;
  onRetry?: () => void;
  className?: string;
}) {
  if (state === "saved") return null;
  if (state === "pending") {
    return (
      <span data-slot="optimistic-note" role="status" className={cn("text-xs text-muted-foreground italic", className)}>
        Saving…
      </span>
    );
  }
  return (
    <span role="status" className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span className="font-medium">Not saved</span>
      {onRetry && (
        <button type="button" onClick={onRetry}
          aria-label={what ? `Retry saving ${what}` : "Retry saving"}
          className="cursor-pointer underline underline-offset-2">Retry</button>
      )}
    </span>
  );
}
