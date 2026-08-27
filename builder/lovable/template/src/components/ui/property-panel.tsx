import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The inspector — labelled controls for whatever is selected.
 *
 * A MIXED VALUE ACROSS A MULTI-SELECTION IS ITS OWN STATE, shown as "Mixed"
 * rather than as the first item's value or as blank. Showing the first one's
 * value is a lie that gets committed the moment anybody touches an unrelated
 * field; showing blank reads as "not set" and clears all of them on save.
 *
 * Labels sit BESIDE their controls in a narrow two-column grid, so twelve
 * properties fit without scrolling — which is what an inspector is for. They
 * are still real `<label for>` pairs; the layout is a grid, not a table of
 * unassociated text.
 *
 * A section can COLLAPSE and the state is per section, so somebody working on
 * typography can fold away layout without losing it on the next selection.
 *
 * Numeric fields are `inputMode="decimal"`, which is the difference between a
 * usable and an unusable inspector on a tablet.
 */
export function PropertyRow({ label, htmlFor, mixed, children, hint, className }: {
  label: React.ReactNode;
  htmlFor?: string;
  mixed?: boolean;
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="property-row" className={cn("grid grid-cols-[5.5rem_1fr] items-center gap-2 py-1", className)}>
      <label htmlFor={htmlFor} className="truncate text-xs text-muted-foreground">{label}</label>
      <div className="min-w-0">
        {mixed ? (
          <p className="rounded border border-dashed border-border px-2 py-1 text-xs text-muted-foreground italic">
            Mixed
          </p>
        ) : children}
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

export function PropertySection({ title, children, defaultOpen = true, className }: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section data-slot="property-section" className={cn("border-b border-border last:border-0", className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-start text-[11px] font-semibold tracking-wide uppercase hover:bg-muted">
        {title}
        <span aria-hidden className="text-muted-foreground">{open ? "–" : "+"}</span>
      </button>
      {open ? <div className="px-3 pb-2">{children}</div> : null}
    </section>
  );
}

export function PropertyPanel({ children, label = "Properties", className }: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-col overflow-y-auto", className)}>
      {children}
    </div>
  );
}
