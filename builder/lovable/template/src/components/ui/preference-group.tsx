import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A titled group of settings rows.
 *
 * A SETTING IS A ROW: label and control on one line, the explanation under
 * the LABEL (not under the control, where it reads as the control's output).
 * The row is the unit people scan for, so it is a component — every
 * hand-rolled settings page drifts into label-above-control-above-hint,
 * which triples the page height for nothing.
 *
 * THE LABEL IS TIED TO THE CONTROL (`htmlFor`/id, the form-row rule) so
 * clicking the words operates the switch and screen readers announce the
 * pair. `PreferenceRow` generates the id when the caller passes a control
 * that accepts one.
 *
 * Groups exist because "Notifications" and "Appearance" are how people
 * remember where a setting lives — a flat fifty-row list is searched, a
 * grouped one is found.
 */
export function PreferenceGroup({ title, description, children, className }: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-1", className)}>
      <div className="pb-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">{children}</div>
    </section>
  );
}

export function PreferenceRow({ label, hint, htmlFor, control, className }: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  htmlFor?: string;
  control: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 px-3.5 py-2.5", className)}>
      <div className="min-w-0">
        <label htmlFor={htmlFor} className={cn("text-sm font-medium", htmlFor && "cursor-pointer")}>{label}</label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
