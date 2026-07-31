import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A collapsible group header inside a table body — "Saturday (14)" with its
 * rows underneath.
 *
 * The COUNT is in the header and stays there when the group is collapsed. That
 * is the whole reason to group rather than sort: collapsed, the table becomes
 * a summary of how much is in each bucket, and a header without its number is
 * a summary with the answer removed.
 *
 * A `<tbody>` per group, not `<tr>`s in one body: a table may have many
 * bodies, and it means a collapsed group is a container with nothing in it
 * rather than rows that have to be filtered out of a flat list.
 *
 * `summary` sits on the right for a total or an aggregate — the number that
 * makes a collapsed group worth reading on its own.
 */
export function RowGroup({
  label, count, columns, open, onToggle, summary, children, className,
}: {
  label: React.ReactNode;
  count?: number;
  columns: number;
  open: boolean;
  onToggle: () => void;
  summary?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <tbody className={className}>
      <tr className="border-b border-border bg-muted/60">
        <td colSpan={columns} className="px-2 py-1.5">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onToggle} aria-expanded={open}
              className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-sm font-medium hover:bg-muted">
              <ChevronRight aria-hidden className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")} />
              <span>{label}</span>
              {count != null ? (
                <span className="text-xs font-normal text-muted-foreground tabular-nums">({count.toLocaleString()})</span>
              ) : null}
            </button>
            <span className="flex-1" />
            {summary ? <span className="text-xs text-muted-foreground tabular-nums">{summary}</span> : null}
          </div>
        </td>
      </tr>
      {open ? children : null}
    </tbody>
  );
}
