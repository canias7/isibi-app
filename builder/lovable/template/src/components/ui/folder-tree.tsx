import * as React from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Nested folders, expanded by choice.
 *
 * A STANDALONE RECURSIVE TYPE (`FolderNode`), the NavNode lesson: a
 * self-referential generic constraint cannot be satisfied by literal
 * nested arrays, so the type is concrete and exported for callers to
 * annotate their data with.
 *
 * EXPANSION STATE LIVES HERE, SELECTION LIVES WITH THE CALLER — two
 * different questions ("what am I looking at" vs "what did I pick"),
 * and conflating them is how selecting a deep folder collapses the
 * view of it. Expanding a folder does not select it; clicking its name
 * does; the chevron alone toggles.
 *
 * Depth is indentation via padding, computed — never a `pl-${n}` string
 * the scanner cannot see (the Tailwind runtime-class trap).
 */
export type FolderNode = { id: string; name: string; children?: FolderNode[] };

function Branch({ node, depth, open, toggle, selected, onSelect }: {
  node: FolderNode; depth: number;
  open: Set<string>; toggle: (id: string) => void;
  selected?: string; onSelect: (id: string) => void;
}) {
  const kids = node.children ?? [];
  const isOpen = open.has(node.id);
  return (
    <li data-slot="branch">
      <div
        className={cn("flex items-center gap-1 rounded px-1 py-0.5",
          selected === node.id && "bg-foreground text-background")}
        style={{ paddingInlineStart: `${depth * 16 + 4}px` }}
      >
        {kids.length ? (
          <button type="button" onClick={() => toggle(node.id)}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.name}`}
            className="cursor-pointer p-0.5">
            <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} aria-hidden />
          </button>
        ) : <span className="w-[18px]" aria-hidden />}
        <button type="button" onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-start text-sm">
          {isOpen && kids.length
            ? <FolderOpen className="size-4 shrink-0" aria-hidden />
            : <Folder className="size-4 shrink-0" aria-hidden />}
          <span className="truncate">{node.name}</span>
        </button>
      </div>
      {isOpen && kids.length ? (
        <ul>
          {kids.map((k) => (
            <Branch key={k.id} node={k} depth={depth + 1} open={open} toggle={toggle}
              selected={selected} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function FolderTree({ roots, selected, onSelect, defaultOpen = [], className }: {
  roots: FolderNode[];
  selected?: string;
  onSelect: (id: string) => void;
  defaultOpen?: string[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(() => new Set(defaultOpen));
  const toggle = (id: string) => setOpen((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return (
    <ul data-slot="folder-tree" className={cn("text-sm", className)}>
      {roots.map((r) => (
        <Branch key={r.id} node={r} depth={0} open={open} toggle={toggle}
          selected={selected} onSelect={onSelect} />
      ))}
    </ul>
  );
}
