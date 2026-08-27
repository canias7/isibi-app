import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Sam is editing this" — who holds a record, and whether you can take it.
 *
 * IT NAMES SOMEBODY. A lock with no name is a wall: the only recourse is to
 * wait an unknown time or find an administrator. With a name, the person does
 * the obvious human thing and asks — which is faster than any override button.
 *
 * THE OVERRIDE IS OPT-IN AND CONFIRMED. Taking a lock discards work somebody
 * else is in the middle of, so it exists only when the caller passes `onTakeOver`
 * and it asks first. A one-click steal on a shared record is a data-loss
 * feature.
 *
 * `role="status"` rather than `alert` — a locked record is a fact about the
 * page, not an interruption, and locks change hands often enough that alerting
 * each time would make a shared document unusable with a screen reader.
 *
 * `since` is free text on purpose. "2 minutes ago" is what a person needs, and
 * relative-time formatting belongs to the caller's own clock, not to a
 * presence badge.
 */
export function EditingLock({ name, since, onTakeOver, takeOverLabel = "Take over", takeOverWarning = "This will discard their unsaved changes. Continue?", className }: {
  name: string;
  /** Free text — "2 minutes ago". */
  since?: string;
  onTakeOver?: () => void;
  takeOverLabel?: string;
  takeOverWarning?: string;
  className?: string;
}) {
  return (
    <div data-slot="editing-lock" role="status"
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm", className)}>
      <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span><span className="font-medium">{name}</span> is editing this</span>
      {since && <span className="text-xs text-muted-foreground">since {since}</span>}
      {onTakeOver && (
        <button type="button"
          className="ms-auto text-xs font-medium underline underline-offset-2"
          onClick={() => { if (window.confirm(takeOverWarning)) onTakeOver(); }}>
          {takeOverLabel}
        </button>
      )}
    </div>
  );
}
