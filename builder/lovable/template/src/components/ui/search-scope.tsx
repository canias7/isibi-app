import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Search in: everything / bookings / customers" beside a search box.
 *
 * THE SCOPE IS VISIBLE WITHOUT OPENING ANYTHING. A scope hidden in a dropdown
 * is why somebody searches for a customer, gets nothing, and concludes the
 * customer is not there — when the box was scoped to bookings from a search
 * they ran an hour ago.
 *
 * Each scope shows its RESULT COUNT when one is known, so "nothing here, 12 in
 * customers" is visible before switching. That single number turns a dead end
 * into a next step.
 *
 * "Everything" is always present and is the default, because a scoped-by-default
 * search is the mechanism of the failure above.
 *
 * Real radio semantics — one tab stop, arrow keys — rather than a row of
 * buttons, since these are mutually exclusive choices of one setting.
 */
export function SearchScope({ scopes, value, onChange, className }: {
  scopes: { key: string; label: string; count?: number }[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  const move = (d: 1 | -1) => {
    const i = scopes.findIndex((s) => s.key === value);
    onChange(scopes[(i + d + scopes.length) % scopes.length].key);
  };
  return (
    <div role="radiogroup" aria-label="Search in"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      }}
      className={cn("flex flex-wrap items-center gap-1", className)}>
      <span className="mr-1 text-xs text-muted-foreground">Search in</span>
      {scopes.map((s) => {
        const on = s.key === value;
        return (
          <button key={s.key} type="button" role="radio" aria-checked={on}
            tabIndex={on ? 0 : -1} onClick={() => onChange(s.key)}
            className={cn("cursor-pointer rounded-full border px-2.5 py-1 text-xs",
              on ? "border-foreground bg-foreground font-medium text-background" : "border-border hover:bg-muted")}>
            {s.label}
            {s.count != null ? (
              <span className={cn("ml-1.5 tabular-nums", on ? "opacity-80" : "text-muted-foreground")}>
                {s.count.toLocaleString()}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
