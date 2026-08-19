import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
export type TreeNode = { value: string; label: string; children?: TreeNode[] };
/**
 * Choose from a hierarchy — categories, folders, an org.
 *
 * A PARENT IS INDETERMINATE when only some of its children are ticked, and
 * that third state is the whole component. Rendering it as a plain checkbox
 * means a half-selected folder looks identical to an empty one, and ticking
 * it silently selects everything inside.
 *
 * Ticking a parent selects its whole subtree; unticking clears it. Only LEAF
 * values are reported, because a caller wanting "everything under Cuts"
 * cannot tell that from "Cuts itself" if branches are in the list too.
 */
function leaves(n: TreeNode): string[] {
  return n.children?.length ? n.children.flatMap(leaves) : [n.value];
}
export function TreeSelect({ nodes, value, onChange, className }: {
  nodes: TreeNode[]; value: string[]; onChange: (v: string[]) => void; className?: string;
}) {
  const [open, setOpen] = React.useState<string[]>(nodes.map((n) => n.value));
  const Row = ({ node, depth }: { node: TreeNode; depth: number }) => {
    const own = leaves(node);
    const on = own.filter((v) => value.includes(v)).length;
    const state = on === 0 ? false : on === own.length ? true : "indeterminate";
    const expanded = open.includes(node.value);
    return (
      <li>
        <div className="flex items-center gap-1.5 py-1" style={{ paddingInlineStart: depth * 18 }}>
          {node.children?.length ? (
            <button type="button" aria-expanded={expanded} aria-label={expanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
              onClick={() => setOpen((o) => expanded ? o.filter((v) => v !== node.value) : [...o, node.value])}
              className="cursor-pointer rounded p-0.5 hover:bg-muted">
              <ChevronRight className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
            </button>
          ) : <span className="w-[1.375rem]" />}
          <Checkbox id={`ts-${node.value}`} checked={state}
            onCheckedChange={(v) => onChange(v === true
              ? [...new Set([...value, ...own])]
              : value.filter((x) => !own.includes(x)))} />
          <label htmlFor={`ts-${node.value}`} className="cursor-pointer text-sm">{node.label}</label>
        </div>
        {expanded && node.children?.length ? (
          <ul>{node.children.map((c) => <Row key={c.value} node={c} depth={depth + 1} />)}</ul>
        ) : null}
      </li>
    );
  };
  return <ul className={cn("text-sm", className)}>{nodes.map((n) => <Row key={n.value} node={n} depth={0} />)}</ul>;
}
