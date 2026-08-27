import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The gaps in a record, each one a way to fix it.
 *
 * EVERY MISSING FIELD IS A LINK TO ITS OWN FIX (the error-summary-link
 * pattern, applied to data instead of form errors): press "photo" and
 * land in the editor with the photo field focused. A list that only
 * names the gaps makes the person navigate there themselves, which is
 * where most of them stop.
 *
 * WHY IT MATTERS IS PER FIELD, OPTIONAL: "no price - this service is
 * hidden from the site" converts a chore into a reason. Consequences
 * recruit; scolding does not.
 *
 * Renders nothing when nothing is missing - absence of nagging is the
 * steady state (the whats-new-dot rule).
 */
export function MissingFields({ fields, onFix, className }: {
  fields: { key: string; label: string; why?: React.ReactNode }[];
  onFix: (key: string) => void;
  className?: string;
}) {
  if (!fields.length) return null;
  return (
    <ul data-slot="missing-fields" className={cn("flex flex-col gap-1", className)}>
      {fields.map((f) => (
        <li key={f.key} className="flex items-baseline gap-2 text-sm">
          <button type="button" onClick={() => onFix(f.key)}
            className="cursor-pointer font-medium underline underline-offset-2">
            Add the {f.label}
          </button>
          {f.why ? <span className="text-xs text-muted-foreground">— {f.why}</span> : null}
        </li>
      ))}
    </ul>
  );
}
