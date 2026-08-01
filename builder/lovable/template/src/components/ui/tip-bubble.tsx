import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A short hint attached to something on the page.
 *
 * DISMISSIBLE, AND THE DISMISS IS A REAL BUTTON with an accessible name. A tip
 * that cannot be closed is an obstruction, and one closed by clicking anywhere
 * is closed by accident before it is read.
 *
 * IT DOES NOT TRAP FOCUS and is not a dialog. A hint is not modal — treating it
 * as one stops the reader doing the very thing the hint is about, which is the
 * commonest fault in guided tours.
 *
 * `of` numbers it within a sequence ("2 of 4"), because a tip with no sense of
 * how many follow is one people dismiss to make it stop rather than read.
 */
export function TipBubble({ children, step, of, onDismiss, onNext, className }: {
  children: React.ReactNode;
  step?: number; of?: number;
  onDismiss?: () => void;
  onNext?: () => void;
  className?: string;
}) {
  return (
    <div role="note" className={cn("flex max-w-xs items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm shadow-xs", className)}>
      <div className="min-w-0 flex-1">
        {step && of && (
          <p className="mb-0.5 text-xs text-muted-foreground tabular-nums">{step} of {of}</p>
        )}
        <div>{children}</div>
        {onNext && (
          <button type="button" onClick={onNext}
            className="mt-1.5 cursor-pointer text-xs font-medium underline underline-offset-4">Next</button>
        )}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss tip"
          className="shrink-0 cursor-pointer rounded p-0.5 hover:bg-muted">
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
