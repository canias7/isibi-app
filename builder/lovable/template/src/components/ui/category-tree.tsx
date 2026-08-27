import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A nested category list you can open, close and choose from.
 *
 * OPENING AND CHOOSING ARE TWO DIFFERENT CONTROLS. Every tree that conflates
 * them makes a parent category unselectable — click "Drinks" and it merely
 * expands, so anything filed directly under it becomes unreachable. The chevron
 * opens; the label chooses.
 *
 * THE COUNT IS THE WHOLE SUBTREE, and it is what tells somebody whether opening
 * a branch is worth it. A parent showing 0 with 40 items beneath it is the
 * standard bug, and it makes people conclude a category is empty.
 *
 * `role="tree"` WITH `aria-expanded` AND `aria-level`, so a screen reader
 * announces depth and open state. A nested `<ul>` of divs conveys none of that,
 * and depth-by-indentation is exactly the information a visual reader gets free
 * and everybody else does not.
 *
 * OPEN STATE IS THE CALLER'S. A tree that manages its own collapses everything
 * whenever the parent re-renders, which is what makes a filtered tree snap shut
 * on every keystroke.
 */
export type Category = { id: string; label: string; count?: number; children?: Category[] };

function Branch({ nodes, level, open, onToggle, value, onSelect }: {
  nodes: Category[]; level: number; open: string[];
  onToggle: (id: string) => void; value?: string; onSelect: (id: string) => void;
}) {
  return (
    <ul data-slot="branch" role={level === 1 ? undefined : "group"}>
      {nodes.map((n) => {
        const kids = n.children ?? [];
        const isOpen = open.includes(n.id);
        return (
          <li key={n.id} role="treeitem" aria-level={level} aria-selected={value === n.id}
            {...(kids.length ? { "aria-expanded": isOpen } : {})}>
            <span className="flex items-center" style={{ paddingInlineStart: (level - 1) * 16 }}>
              {/* The toggle is NOT `tabIndex={-1}`. That is correct in a tree
                  implementing the ARIA keyboard pattern — one tab stop, arrows to
                  move — and this one has no key handling at all, so it only removed
                  the control. The label beside it stays tabbable, so a keyboard user
                  could select a category and never expand one. */}
              {kids.length > 0 ? (
                <button type="button" onClick={() => onToggle(n.id)}
                  aria-label={`${isOpen ? "Collapse" : "Expand"} ${n.label}`}
                  className="shrink-0 p-1 text-muted-foreground">
                  <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} aria-hidden="true" />
                </button>
              ) : <span className="w-[1.375rem] shrink-0" aria-hidden="true" />}
              <button type="button" onClick={() => onSelect(n.id)}
                className={cn("min-w-0 flex-1 rounded px-1.5 py-1 text-start text-sm hover:bg-muted",
                  value === n.id && "bg-muted font-medium")}>
                {n.label}
                {n.count !== undefined && (
                  <span className="ms-1.5 text-xs tabular-nums text-muted-foreground">{n.count}</span>
                )}
              </button>
            </span>
            {kids.length > 0 && isOpen && (
              <Branch nodes={kids} level={level + 1} open={open} onToggle={onToggle} value={value} onSelect={onSelect} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function CategoryTree({ categories, open, onToggle, value, onSelect, label = "Categories", className }: {
  categories: Category[];
  /** Ids of the open branches. */
  open: string[];
  onToggle: (id: string) => void;
  value?: string;
  onSelect: (id: string) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div data-slot="category-tree" role="tree" aria-label={label} className={cn("text-sm", className)}>
      <Branch nodes={categories} level={1} open={open} onToggle={onToggle} value={value} onSelect={onSelect} />
    </div>
  );
}
