import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * A generation that did not work, said in a way that tells somebody what to do.
 *
 * THE KIND DECIDES THE SENTENCE, because these four failures need four
 * different responses and the usual "Something went wrong" covers all of them
 * with the one message that helps in none. Rate-limited means wait; too-long
 * means shorten the input; refused means the request itself will never work, so
 * offering "try again" there is a lie that costs somebody three more attempts.
 *
 * RETRY IS OFFERED ONLY WHERE RETRYING CAN WORK — absent on `refused`, present
 * on the rest. A button that cannot succeed is worse than no button.
 *
 * `role="alert"`, because unlike an applied change this genuinely did interrupt
 * what the person was doing and they are waiting on an answer that is not
 * coming.
 *
 * NO PROVIDER TEXT PASSED THROUGH. Raw upstream errors quote the request, and
 * the request is whatever the customer just typed — plus they read as
 * jargon. The caller can put anything genuinely useful in `detail`.
 */
const SENTENCE: Record<string, string> = {
  failed: "That did not work.",
  rate_limited: "Too many requests just now.",
  too_long: "That is too long to process.",
  refused: "This request cannot be answered.",
};

export function AiErrorNote({ kind = "failed", detail, onRetry, retryLabel = "Try again", className }: {
  kind?: "failed" | "rate_limited" | "too_long" | "refused";
  /** One extra sentence of the caller's own words. */
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  const canRetry = kind !== "refused" && Boolean(onRetry);
  return (
    <div data-slot="ai-error-note" role="alert"
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-foreground/40 bg-muted/40 px-3 py-2 text-sm", className)}>
      <span className="font-medium">{SENTENCE[kind] ?? SENTENCE.failed}</span>
      {detail && <span className="text-muted-foreground">{detail}</span>}
      {canRetry && (
        <Button type="button" variant="outline" size="sm" className="ms-auto" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
