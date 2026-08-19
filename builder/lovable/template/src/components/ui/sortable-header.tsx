import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
/** A column header that sorts, and says which way it is sorting. */
export function SortableHeader({ label, direction, onSort, numeric, className }: {
  label: React.ReactNode; direction?: "asc" | "desc" | null;
  onSort: () => void; numeric?: boolean; className?: string;
}) {
  const Icon = direction === "asc" ? ChevronUp : direction === "desc" ? ChevronDown : ChevronsUpDown;
  return (
    <button type="button" onClick={onSort}
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
      className={cn("group flex cursor-pointer items-center gap-1 font-medium", numeric && "ms-auto", className)}>
      {label}
      <Icon className={cn("size-3.5", direction ? "text-foreground" : "text-muted-foreground/50")} />
    </button>
  );
}
