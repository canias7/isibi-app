import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Highlighted text with a comment attached to it.
 *
 * A `<mark>`, not a styled span: it is the element that means "this passage
 * is called out", so it survives copy-paste into another document and is
 * announced as a highlight rather than as ordinary prose.
 *
 * A RESOLVED comment keeps its text and drops the highlight entirely. Fading
 * it instead leaves a page speckled with grey marks nobody can clear, which
 * is why people stop resolving them.
 */
export function CommentAnchor({ id, resolved, active, count = 1, onSelect, children, className }: {
  id: string | number; resolved?: boolean; active?: boolean; count?: number;
  onSelect?: (id: string | number) => void; children?: React.ReactNode; className?: string;
}) {
  if (resolved) return <>{children}</>;
  return (
    <mark
      className={cn("rounded-sm bg-warning/25 px-0.5 text-inherit",
        active && "bg-warning/50 ring-1 ring-warning", className)}>
      {/* The click was on the `<mark>` itself, which is not focusable and had no
          role, tabIndex or key handler — so a comment could be opened with a
          mouse and never with a keyboard. A real button INSIDE the mark keeps
          the highlight semantics (a screen reader still announces the passage as
          marked) and makes the control reachable, which wrapping the mark in a
          button would not: `<button>` around a phrase of running text takes the
          text out of the sentence. */}
      {onSelect
        ? <button type="button" onClick={() => onSelect(id)}
            className="cursor-pointer text-inherit underline-offset-2 hover:underline">{children}</button>
        : children}
      {count > 1 && <sup className="ms-0.5 text-[10px] tabular-nums text-muted-foreground">{count}</sup>}
    </mark>
  );
}
