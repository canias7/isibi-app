import { cn } from "@/lib/utils";
/**
 * "Did you mean this?" — with the correction ready to apply.
 *
 * THE ORIGINAL IS ALWAYS SHOWN BESIDE THE SUGGESTION. A correction offered
 * without the thing it replaces cannot be judged, and accepting blind is how a
 * confident autocorrect quietly changes a value that was right.
 *
 * ACCEPTING IS ONE PRESS AND SO IS DECLINING. A suggestion that can only be
 * accepted, with rejection meaning "ignore it and hope", leaves the prompt on
 * screen forever and trains people to stop reading it.
 *
 * `role="status"` because it accompanies a field the reader is working in.
 */
export function FixSuggestion({ was, suggestion, why, onAccept, onDismiss, className }: {
  was: string;
  suggestion: string;
  /** "that postcode isn't in Falmouth" */
  why?: string;
  onAccept: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <p data-slot="fix-suggestion" role="status" className={cn("flex flex-wrap items-baseline gap-x-2 text-xs", className)}>
      <span>
        <span className="text-muted-foreground line-through">{was}</span>
        {" → "}
        <span className="font-medium">{suggestion}</span>
      </span>
      {why && <span className="text-muted-foreground">{why}</span>}
      <button type="button" onClick={onAccept} className="cursor-pointer underline underline-offset-2">Use it</button>
      {onDismiss && (
        <button type="button" onClick={onDismiss}
          className="cursor-pointer text-muted-foreground underline underline-offset-2">Keep mine</button>
      )}
    </p>
  );
}
