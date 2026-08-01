import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The filter panel as a full-height sheet, for narrow screens.
 *
 * IT APPLIES ON CLOSE, NOT ON EVERY CHANGE, and that is the point of it being a
 * drawer at all. On a phone the drawer covers the list, so live filtering
 * re-queries repeatedly for results nobody can see — and the result count is
 * the only feedback there is, which is why it sits on the button rather than
 * behind the sheet.
 *
 * THE RESULT COUNT IS ON THE APPLY BUTTON. "Show 38 results" is checkable
 * before committing; "Apply" is a leap, and on a small screen it is a leap
 * somebody takes blind.
 *
 * IT LOCKS THE PAGE BEHIND IT while open, or the list scrolls under the drawer
 * on touch and the person loses their place in the thing they were filtering.
 * The lock is restored on unmount, so a drawer closed by navigation cannot
 * leave the page unscrollable.
 *
 * `role="dialog" aria-modal`, with Escape closing it. A filter sheet that traps
 * somebody with no keyboard way out is the version that ships most often.
 */
export function FilterDrawer({ open, onClose, onApply, onClear, resultCount, activeCount = 0, title = "Filters", children, className }: {
  open: boolean;
  onClose: () => void;
  /** Called when the drawer is dismissed by the apply button. */
  onApply?: () => void;
  onClear?: () => void;
  resultCount?: number;
  activeCount?: number;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={cn("fixed inset-0 z-50 flex", className)}>
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={title}
        className="relative ml-auto flex h-full w-full max-w-sm flex-col bg-background shadow-lg">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium">{title}</h2>
          {activeCount > 0 && (
            <span className="rounded-full bg-foreground px-1.5 text-xs tabular-nums text-background">{activeCount}</span>
          )}
          {activeCount > 0 && onClear && (
            <button type="button" onClick={onClear} className="ml-auto text-xs underline underline-offset-2">Clear</button>
          )}
          <button type="button" onClick={onClose} aria-label="Close filters"
            className={cn("text-sm text-muted-foreground", !(activeCount > 0 && onClear) && "ml-auto")}>×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        <div className="border-t border-border p-3">
          <Button type="button" className="w-full" onClick={() => { onApply?.(); onClose(); }}>
            {resultCount === undefined ? "Show results"
              : resultCount === 0 ? "No results" : `Show ${resultCount.toLocaleString()} results`}
          </Button>
        </div>
      </div>
    </div>
  );
}
