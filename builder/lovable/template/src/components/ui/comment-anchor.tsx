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
      onClick={() => onSelect?.(id)}
      className={cn("rounded-sm bg-warning/25 px-0.5 text-inherit",
        active && "bg-warning/50 ring-1 ring-warning",
        onSelect && "cursor-pointer", className)}>
      {children}
      {count > 1 && <sup className="ml-0.5 text-[10px] tabular-nums text-muted-foreground">{count}</sup>}
    </mark>
  );
}
