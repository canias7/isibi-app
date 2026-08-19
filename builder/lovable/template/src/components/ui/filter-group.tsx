import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * One collapsible section of a filter panel.
 *
 * THE ACTIVE COUNT SURVIVES COLLAPSING, and that is the whole reason this is a
 * component rather than a `<details>`. Somebody sets three filters, collapses
 * the group to make room, and forgets — then reports that the list is missing
 * records. The badge on the closed header is the only thing standing between
 * that and a support ticket.
 *
 * IT OPENS ITSELF WHEN IT HAS ACTIVE FILTERS, on first render only. Restoring a
 * saved view with the relevant groups shut hides the very settings that explain
 * what is on screen. On FIRST render only, or a group could never be
 * deliberately collapsed while in use.
 *
 * CLEAR SITS ON THE HEADER and stops the header's own toggle from firing —
 * a nested button inside a button is invalid HTML, so the header is a flex row
 * containing two buttons rather than one wrapping the other.
 *
 * `aria-expanded` and a real `<h3>`, so the panel is navigable by heading.
 */
export function FilterGroup({ label, activeCount = 0, onClear, defaultOpen, children, className }: {
  label: string;
  activeCount?: number;
  onClear?: () => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen ?? activeCount > 0);
  return (
    <div className={cn("border-b border-border py-2 last:border-b-0", className)}>
      <h3 className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-start text-sm font-medium">
          <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")} aria-hidden="true" />
          <span className="min-w-0 truncate">{label}</span>
          {activeCount > 0 && (
            <span className="ms-auto shrink-0 rounded-full bg-foreground px-1.5 text-xs tabular-nums text-background">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && onClear && (
          <button type="button" onClick={onClear} className="shrink-0 text-xs underline underline-offset-2">
            Clear
          </button>
        )}
      </h3>
      {open && <div className="pb-1 ps-5 pt-1">{children}</div>}
    </div>
  );
}
