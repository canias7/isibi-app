import * as React from "react";
import { AvatarName } from "@/components/ui/avatar-name";
import { cn } from "@/lib/utils";
export type OrgNode = { id: string | number; name: string; role?: string; avatar?: string | null; reports?: OrgNode[] };
/**
 * Who reports to whom.
 *
 * Nested lists with indentation, NOT a canvas of boxes and connector lines.
 * A drawn chart needs a layout engine, does not fit a phone, and is opaque to
 * a screen reader; a nested `<ul>` is the same information as a real tree
 * that can be navigated, searched with the browser's own find, and printed.
 *
 * Recursion is bounded by `maxDepth`, because an org chart built from a
 * `manager_id` column with an accidental cycle in it otherwise recurses until
 * the tab dies — and that cycle is easy to create and invisible in the data.
 */
export function OrgChart({ nodes, maxDepth = 8, className }: {
  nodes: OrgNode[]; maxDepth?: number; className?: string;
}) {
  const seen = new Set<string | number>();
  const render = (list: OrgNode[], depth: number): React.ReactNode => {
    if (depth > maxDepth) return null;
    return (
      <ul className={cn(depth > 0 && "ml-4 border-l border-border pl-4")}>
        {list.map((n) => {
          if (seen.has(n.id)) return null;      // a cycle, or the same person twice
          seen.add(n.id);
          return (
            <li key={n.id} className="py-1.5">
              <AvatarName name={n.name} subtitle={n.role} src={n.avatar} size="sm" />
              {n.reports?.length ? render(n.reports, depth + 1) : null}
            </li>
          );
        })}
      </ul>
    );
  };
  return <div className={className}>{render(nodes, 0)}</div>;
}
