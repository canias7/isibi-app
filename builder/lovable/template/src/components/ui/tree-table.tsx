import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn, labelText } from "@/lib/utils";
/**
 * A hierarchy AND columns at once.
 *
 * THE KIT HAS `tree-view` AND `data-table` SEPARATELY, and the thing people
 * actually need is both: a chart of accounts, a file browser with sizes, a
 * budget by department where the parent shows the roll-up. Nesting inside a
 * table is not a styling of either one — the indent has to live in the first
 * cell while the numeric columns stay aligned across every depth.
 *
 * A PARENT SHOWS ITS OWN ROLL-UP, and the component computes it rather than
 * trusting the caller to pre-sum: a parent whose number disagrees with its
 * children is the bug this shape exists to make impossible. `aggregate`
 * defaults to a sum; pass your own for averages or maxima.
 *
 * COLLAPSED CHILDREN ARE NOT IN THE DOM, so a 5000-row tree costs what is
 * open. Rows carry `aria-level` and `aria-expanded`, which is what makes a
 * nested table navigable at all.
 *
 * The indent is computed padding, never a `pl-${n}` class the Tailwind
 * scanner cannot see.
 */
export type TreeNode = { id: string; label: React.ReactNode; values?: Record<string, number>; children?: TreeNode[] };

function rollUp(node: TreeNode, col: string, agg: (xs: number[]) => number): number {
  if (!node.children?.length) return node.values?.[col] ?? 0;
  return agg(node.children.map((c) => rollUp(c, col, agg)));
}

export function TreeTable({ nodes, columns, format, aggregate, defaultOpen = [], className }: {
  nodes: TreeNode[];
  columns: { key: string; label: React.ReactNode }[];
  format?: (v: number, col: string) => React.ReactNode;
  aggregate?: (xs: number[]) => number;
  defaultOpen?: string[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(() => new Set(defaultOpen));
  const agg = aggregate ?? ((xs: number[]) => xs.reduce((s, x) => s + x, 0));
  const fmt = format ?? ((v: number) => v.toLocaleString());

  const rows: React.ReactNode[] = [];
  const walk = (list: TreeNode[], depth: number) => {
    for (const n of list) {
      const kids = n.children ?? [];
      const isOpen = open.has(n.id);
      rows.push(
        <tr key={n.id} aria-level={depth + 1} aria-expanded={kids.length ? isOpen : undefined}
          className="border-b border-border last:border-0">
          <td className="py-1" style={{ paddingLeft: `${depth * 16}px` }}>
            <span className="flex items-center gap-1">
              {kids.length ? (
                <button type="button" aria-label={`${isOpen ? "Collapse" : "Expand"} ${labelText(n.label)}`.trim()}
                  onClick={() => setOpen((s) => { const x = new Set(s); x.has(n.id) ? x.delete(n.id) : x.add(n.id); return x; })}
                  className="cursor-pointer p-0.5">
                  <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} aria-hidden />
                </button>
              ) : <span className="w-[18px]" aria-hidden />}
              <span className={cn("truncate", kids.length && "font-medium")}>{n.label}</span>
            </span>
          </td>
          {columns.map((c) => (
            <td key={c.key} className={cn("py-1 pl-3 text-right tabular-nums", kids.length && "font-medium")}>
              {fmt(rollUp(n, c.key, agg), c.key)}
            </td>
          ))}
        </tr>,
      );
      // Closed children are absent from the DOM, not hidden.
      if (kids.length && isOpen) walk(kids, depth + 1);
    }
  };
  walk(nodes, 0);

  return (
    <table className={cn("w-full text-xs", className)}>
      <thead>
        <tr className="border-b border-border">
          <th className="pb-1 text-left font-medium">Name</th>
          {columns.map((c) => <th key={c.key} className="pb-1 pl-3 text-right font-medium">{c.label}</th>)}
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}
