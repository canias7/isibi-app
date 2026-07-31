import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A table row that opens a detail panel underneath itself.
 *
 * The detail is a second `<tr>` spanning every column, not a nested table —
 * a table inside a cell loses column alignment and reads as a separate object.
 * `colSpan` therefore has to be passed in; there is no way to count it here.
 */
export function ExpandableRow({ colSpan, summary, detail, defaultOpen, className }: {
  colSpan: number; summary: React.ReactNode; detail: React.ReactNode;
  defaultOpen?: boolean; className?: string;
}) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <>
      <tr className={cn("border-b border-border", className)}>
        <td className="w-8 py-2 pl-2 align-middle">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            className="flex size-6 cursor-pointer items-center justify-center rounded hover:bg-muted">
            <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
            <span className="sr-only">{open ? "Hide details" : "Show details"}</span>
          </button>
        </td>
        {summary}
      </tr>
      {open && (
        <tr className="border-b border-border bg-muted/30">
          <td colSpan={colSpan + 1} className="px-4 py-3 text-sm">{detail}</td>
        </tr>
      )}
    </>
  );
}
