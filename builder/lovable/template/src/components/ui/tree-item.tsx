import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * One row of a tree — the disclosure, the indent, the label.
 *
 * INDENTED WITH PADDING, not with nested containers. Nesting divs means the
 * click target shrinks at every level and the deepest rows become a sliver
 * on the right; padding keeps every row full width and clickable across all
 * of it.
 *
 * `aria-level` and `aria-expanded` are what make the depth audible. Visual
 * indentation alone conveys nothing to a screen reader, so a tree without
 * them is a flat list of names.
 */
export function TreeItem({ label, depth = 0, expanded, hasChildren, selected, icon, trailing, onToggle, onSelect, className }: {
  label: React.ReactNode; depth?: number; expanded?: boolean; hasChildren?: boolean;
  selected?: boolean; icon?: React.ReactNode; trailing?: React.ReactNode;
  onToggle?: () => void; onSelect?: () => void; className?: string;
}) {
  return (
    <div data-slot="tree-item" role="treeitem" aria-level={depth + 1} aria-expanded={hasChildren ? !!expanded : undefined}
      aria-selected={selected}
      className={cn("flex items-center gap-1 rounded", selected ? "bg-muted" : "hover:bg-muted/60", className)}
      style={{ paddingLeft: depth * 16 }}>
      {/* The toggle is NOT `tabIndex={-1}` — see category-tree. No arrow-key
          navigation exists here either, so it removed the only control that
          expands a branch. */}
      {hasChildren ? (
        <button type="button" onClick={onToggle}
          aria-label={expanded ? `Collapse ${typeof label === "string" ? label : ""}` : `Expand ${typeof label === "string" ? label : ""}`}
          className="shrink-0 cursor-pointer rounded p-1 hover:bg-background">
          <ChevronRight className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
        </button>
      ) : <span className="w-[1.625rem] shrink-0" />}
      <button type="button" onClick={onSelect}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1 pe-2 text-start text-sm">
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
        <span className="truncate">{label}</span>
      </button>
      {trailing}
    </div>
  );
}
