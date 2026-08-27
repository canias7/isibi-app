import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * A proposed change, offered rather than applied.
 *
 * NOTHING IS APPLIED WITHOUT A PRESS. A suggestion that writes itself into the
 * field and offers an undo has already changed the reader's work, and the
 * commonest outcome is that they do not notice.
 *
 * DISMISS IS AS EASY AS ACCEPT. A suggestion with only an accept button stays on
 * screen for ever and trains people to stop reading them — which costs the good
 * suggestions along with the bad.
 *
 * IT SHOWS WHAT IT IS REPLACING. Accepting blind is how a confident model
 * quietly overwrites something that was correct, and the original beside the
 * proposal is what makes the choice a choice.
 */
export function AiSuggestion({ suggestion, replaces, why, onAccept, onDismiss, busy, className }: {
  suggestion: React.ReactNode;
  /** The current text it would replace. */
  replaces?: string;
  /** Why it is suggested. */
  why?: string;
  onAccept: () => void;
  onDismiss: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="ai-suggestion" className={cn("flex flex-col gap-2 rounded-md border border-dashed border-border p-3", className)}>
      <p className="text-xs text-muted-foreground">Suggested{why ? ` — ${why}` : ""}</p>
      {replaces && (
        <p className="text-sm text-muted-foreground line-through">{replaces}</p>
      )}
      <div className="text-sm">{suggestion}</div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={onAccept}>Use this</Button>
        <Button size="sm" variant="outline" onClick={onDismiss}>No thanks</Button>
      </div>
    </div>
  );
}
