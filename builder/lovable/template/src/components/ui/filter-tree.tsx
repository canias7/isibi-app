import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/**
 * A nested category filter — Services › Cuts › Skin fade.
 *
 * A PARTLY-TICKED PARENT IS INDETERMINATE, not ticked. A checkbox that reads as
 * "all of this branch" while only two of six children are chosen is a lie about
 * what the filter will return, and the third visual state is the whole reason
 * the HTML property exists.
 *
 * Ticking a parent ticks its DESCENDANTS, and the value is stored as the
 * explicit leaf set rather than "the parent". Storing the parent means adding a
 * new child later silently widens every saved filter that used it.
 *
 * Each node shows its COUNT, and a zero-count branch is dimmed but still there
 * — the same rule as `jump-to`. Removing it changes the shape of the tree
 * between searches and makes it unlearnable.
 *
 * Real `role="treeitem"` semantics with `aria-expanded`, so the nesting is
 * announced. A visually-indented set of checkboxes is flat to a screen reader.
 */
export type FilterNode = { key: string; label: string; count?: number; children?: FilterNode[] };

function leaves(node: FilterNode): string[] {
  return node.children?.length ? node.children.flatMap(leaves) : [node.key];
}

export function FilterTree({ nodes, selected, onChange, className }: {
  nodes: FilterNode[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const chosen = new Set(selected);

  const render = (node: FilterNode, depth: number): React.ReactNode => {
    const kids = node.children ?? [];
    const all = leaves(node);
    const hit = all.filter((k) => chosen.has(k)).length;
    // The third state exists precisely for this.
    const state: boolean | "indeterminate" = hit === 0 ? false : hit === all.length ? true : "indeterminate";
    const expanded = open[node.key] ?? depth === 0;

    const toggle = () => {
      const next = new Set(chosen);
      if (state === true) all.forEach((k) => next.delete(k));
      else all.forEach((k) => next.add(k));
      onChange([...next]);
    };

    return (
      <li key={node.key} role="treeitem" aria-expanded={kids.length ? expanded : undefined}
        aria-selected={state === true}>
        <div className={cn("flex items-center gap-1.5 py-0.5", node.count === 0 && "opacity-50")}
          style={{ paddingInlineStart: `${depth * 1}rem` }}>
          {kids.length ? (
            <button type="button" onClick={() => setOpen((o) => ({ ...o, [node.key]: !expanded }))}
              aria-label={expanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
              className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground">
              <ChevronRight aria-hidden className={cn("size-3 transition-transform", expanded && "rotate-90")} />
            </button>
          ) : <span aria-hidden className="w-4 shrink-0" />}
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={state} onCheckedChange={toggle} />
            <span className="min-w-0 flex-1 truncate">{node.label}</span>
            {node.count != null ? (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{node.count.toLocaleString()}</span>
            ) : null}
          </label>
        </div>
        {kids.length && expanded ? <ul role="group">{kids.map((k) => render(k, depth + 1))}</ul> : null}
      </li>
    );
  };

  return (
    <ul role="tree" aria-label="Filter by category" className={cn("flex flex-col", className)}>
      {nodes.map((n) => render(n, 0))}
    </ul>
  );
}
