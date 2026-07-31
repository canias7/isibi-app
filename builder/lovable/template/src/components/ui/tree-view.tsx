import * as React from "react";
import { TreeItem } from "@/components/ui/tree-item";
import { cn } from "@/lib/utils";
export type TreeViewNode = { id: string; label: string; icon?: React.ReactNode; children?: TreeViewNode[] };
/**
 * A whole tree — files, categories, an org chart you can fold.
 *
 * ARROW KEYS ARE THE POINT. Right opens or descends, Left closes or goes to
 * the parent, Up and Down walk the VISIBLE rows. That is the standard tree
 * pattern, and without it a tree is forty tab stops — the reason most
 * hand-rolled ones are unusable without a mouse.
 *
 * Only one row is tabbable at a time (roving tabindex), so Tab enters the
 * tree once and leaves once rather than stepping through every node.
 */
export function TreeView({ nodes, selected, onSelect, defaultExpanded = [], className }: {
  nodes: TreeViewNode[]; selected?: string; onSelect?: (id: string) => void;
  defaultExpanded?: string[]; className?: string;
}) {
  const [open, setOpen] = React.useState<string[]>(defaultExpanded);
  const [focus, setFocus] = React.useState<string | null>(null);
  const flat: { node: TreeViewNode; depth: number; parent: string | null }[] = [];
  const walk = (list: TreeViewNode[], depth: number, parent: string | null) => {
    for (const n of list) {
      flat.push({ node: n, depth, parent });
      if (n.children?.length && open.includes(n.id)) walk(n.children, depth + 1, n.id);
    }
  };
  walk(nodes, 0, null);
  const here = focus ?? selected ?? flat[0]?.node.id;
  const idx = flat.findIndex((f) => f.node.id === here);

  const onKey = (e: React.KeyboardEvent) => {
    const row = flat[idx];
    if (!row) return;
    const has = !!row.node.children?.length;
    const isOpen = open.includes(row.node.id);
    if (e.key === "ArrowDown") { e.preventDefault(); setFocus(flat[Math.min(flat.length - 1, idx + 1)]?.node.id ?? here); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocus(flat[Math.max(0, idx - 1)]?.node.id ?? here); }
    else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (has && !isOpen) setOpen((o) => [...o, row.node.id]);
      else if (has) setFocus(flat[idx + 1]?.node.id ?? here);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (has && isOpen) setOpen((o) => o.filter((v) => v !== row.node.id));
      else if (row.parent) setFocus(row.parent);
    } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(row.node.id); }
  };

  return (
    <div role="tree" className={cn("text-sm", className)} onKeyDown={onKey}>
      {flat.map(({ node, depth }) => (
        <div key={node.id} tabIndex={node.id === here ? 0 : -1} onFocus={() => setFocus(node.id)}
          className="outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
          <TreeItem label={node.label} depth={depth} icon={node.icon}
            hasChildren={!!node.children?.length} expanded={open.includes(node.id)}
            selected={node.id === selected}
            onToggle={() => setOpen((o) => o.includes(node.id) ? o.filter((v) => v !== node.id) : [...o, node.id])}
            onSelect={() => onSelect?.(node.id)} />
        </div>
      ))}
    </div>
  );
}
