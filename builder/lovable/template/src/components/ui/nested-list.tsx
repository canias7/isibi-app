import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * An outline — nested ordered or bulleted lists, arbitrarily deep.
 *
 * REAL nested `<ul>`/`<ol>`, not flat rows with padding. The nesting is the
 * meaning here: a screen reader announces "list, 3 items, list, 2 items" and
 * the browser's own numbering handles 1.2.1 without any counting in the
 * component.
 *
 * Depth is capped, because an outline built from a parent id with an
 * accidental cycle in it otherwise recurses until the tab dies — the same
 * guard `org-chart` needs and for the same reason.
 */
export type OutlineNode = { id: string | number; label: React.ReactNode; children?: OutlineNode[] };
export function NestedList({ nodes, ordered, maxDepth = 8, className }: {
  nodes: OutlineNode[]; ordered?: boolean; maxDepth?: number; className?: string;
}) {
  const seen = new Set<string | number>();
  const render = (list: OutlineNode[], depth: number): React.ReactNode => {
    if (depth > maxDepth) return null;
    const Tag = ordered ? "ol" : "ul";
    return (
      <Tag className={cn(ordered ? "list-decimal" : "list-disc", "space-y-1 ps-5", depth > 0 && "mt-1")}>
        {list.map((n) => {
          if (seen.has(n.id)) return null;
          seen.add(n.id);
          return (
            <li key={n.id}>
              {n.label}
              {n.children?.length ? render(n.children, depth + 1) : null}
            </li>
          );
        })}
      </Tag>
    );
  };
  return <div className={cn("text-sm", className)}>{render(nodes, 0)}</div>;
}
