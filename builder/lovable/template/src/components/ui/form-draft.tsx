import { TimeSince } from "@/components/ui/time-since";
import { cn } from "@/lib/utils";
/**
 * "Saved a moment ago" — the reassurance on a long form.
 *
 * THE SAVED STATE IS THE POINT, not the saving state. People do not need to
 * watch a spinner; they need to know, at the moment they close the laptop, that
 * it is safe. So the resting state is a timestamp and the transient one is brief.
 *
 * FAILURE IS LOUD AND STICKY. "Couldn't save" must not fade like a success
 * toast — it is the one state where the reader has to act, and a message that
 * vanishes after three seconds is one they will miss.
 *
 * `role="status"` for the ordinary states, and the failure carries its own retry
 * so the fix is where the problem is stated.
 */
export function FormDraft({ state, at, onRetry, className }: {
  state: "idle" | "saving" | "saved" | "failed";
  /** When it last saved. */
  at?: string | number | Date | null;
  onRetry?: () => void;
  className?: string;
}) {
  if (state === "failed") {
    return (
      <p role="alert" className={cn("flex flex-wrap items-baseline gap-x-2 text-xs", className)}>
        <span className="font-medium">Couldn&apos;t save your draft</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="cursor-pointer underline underline-offset-2">Try again</button>
        )}
      </p>
    );
  }
  return (
    <p role="status" className={cn("text-xs text-muted-foreground", className)}>
      {state === "saving" ? "Saving…"
        : state === "saved" && at ? <>Draft saved <TimeSince at={at} /></>
        : state === "saved" ? "Draft saved"
        : ""}
    </p>
  );
}
