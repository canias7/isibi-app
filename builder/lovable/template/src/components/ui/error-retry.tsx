import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Something failed — here is what, and here is the button.
 *
 * THE RETRY IS THE POINT. Most failures on a page are transient, and a message
 * without a way to try again sends somebody to reload the whole page and lose
 * everything else they had open.
 *
 * The message is a SENTENCE, not a status code. "Couldn't load your bookings" is
 * what failed; a code belongs in `error-reference`, which exists for the support
 * conversation.
 *
 * ATTEMPTS ARE COUNTED once past the first, because "failed" and "failed for the
 * fourth time" call for different reactions — the second means stop pressing and
 * read the reason.
 *
 * `role="alert"` — it follows something the reader was waiting on.
 */
export function ErrorRetry({ message, detail, attempts, onRetry, busy, className }: {
  message: string; detail?: string; attempts?: number;
  onRetry?: () => void; busy?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="error-retry" role="alert" className={cn("flex flex-col items-start gap-2 rounded-md border border-border p-4", className)}>
      <p className="text-sm font-medium">{message}</p>
      {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
      {typeof attempts === "number" && attempts > 1 && (
        <p className="text-xs text-muted-foreground tabular-nums">{attempts} attempts so far</p>
      )}
      {onRetry && <Button size="sm" disabled={busy} onClick={onRetry}>{busy ? "Trying…" : "Try again"}</Button>}
    </div>
  );
}
