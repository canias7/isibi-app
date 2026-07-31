import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * One setting: name, explanation, control.
 *
 * Broader than `SwitchRow`, which is the toggle case. The control is a child,
 * so a select, a button or a whole sub-form sits in the same row shape and a
 * settings page stays aligned down its right edge.
 */
export function SettingItem({ label, description, htmlFor, children, className }: {
  label: string; description?: string; htmlFor?: string;
  children?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4 border-b border-border py-4 last:border-0", className)}>
      <div className="min-w-0 flex-1">
        {htmlFor
          ? <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
          : <p className="text-sm font-medium">{label}</p>}
        {description && <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}
