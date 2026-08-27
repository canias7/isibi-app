import { cn } from "@/lib/utils";
/**
 * How many comment threads are still open, as a filter.
 *
 * IT FILTERS RATHER THAN JUST REPORTING. The count exists so somebody can see
 * only the open ones — that is what anybody wants from it — and a badge with no
 * action leaves them scrolling a document hunting for pins.
 *
 * ZERO IS SAID, NOT HIDDEN. "All resolved" is the state people are working
 * towards, and a component that vanishes at zero removes the confirmation at
 * exactly the moment it is earned. It also stops the count reading as
 * "comments are broken".
 *
 * RESOLVED ARE COUNTED TOO, quietly, because "3 open" out of 4 and out of 40
 * are different situations — the second says a document has been through a
 * proper review.
 *
 * `aria-pressed` on a real button, so the filter state is announced rather than
 * being a highlight only some people can see.
 */
export function UnresolvedCount({ open, resolved = 0, filtering, onToggle, className }: {
  open: number;
  resolved?: number;
  /** Whether the list is currently filtered to open threads. */
  filtering?: boolean;
  onToggle?: (next: boolean) => void;
  className?: string;
}) {
  const text = open === 0
    ? "All resolved"
    : `${open.toLocaleString()} ${open === 1 ? "comment" : "comments"} open`;
  const detail = resolved > 0 ? `${resolved.toLocaleString()} resolved` : null;
  if (!onToggle) {
    return (
      <p data-slot="unresolved-count" className={cn("text-sm", className)}>
        <span className={cn(open > 0 && "font-medium")}>{text}</span>
        {detail && <span className="text-muted-foreground"> · {detail}</span>}
      </p>
    );
  }
  return (
    <button type="button" aria-pressed={Boolean(filtering)} onClick={() => onToggle(!filtering)}
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm",
        filtering ? "border-foreground bg-foreground text-background" : "border-border", className)}>
      <span className={cn(open > 0 && !filtering && "font-medium")}>{text}</span>
      {detail && <span className={cn("text-xs", !filtering && "text-muted-foreground")}>{detail}</span>}
    </button>
  );
}
