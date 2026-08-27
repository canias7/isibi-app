import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Choosing an export format, with its consequences spelled out.
 *
 * IT NAMES WHAT EACH FORMAT LOSES. That is the part nobody tells people: CSV
 * drops formatting and formulas, PDF cannot be edited, JSON is not going to
 * open in Excel. Somebody discovers this after the export, and the discovery
 * costs them the work of redoing it.
 *
 * The RECOMMENDED format is marked with a reason rather than being merely
 * preselected. "Recommended" alone is an assertion; "Recommended — keeps every
 * column" is a fact somebody can disagree with.
 *
 * Options are RADIOS with real semantics, since this is one mutually exclusive
 * choice and the arrow keys should move through it.
 *
 * A format that cannot represent the current data is disabled with a reason —
 * "the sheet has images, which CSV cannot hold" — never silently missing.
 */
export function ExportFormat({ formats, value, onChange, className }: {
  formats: { key: string; label: string; describes?: React.ReactNode; loses?: React.ReactNode; recommended?: React.ReactNode; disabled?: boolean; reason?: React.ReactNode }[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  const name = React.useId();
  return (
    <div data-slot="export-format" role="radiogroup" aria-label="Export format" className={cn("flex flex-col gap-2", className)}>
      {formats.map((f) => {
        const on = f.key === value;
        return (
          <label key={f.key}
            className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg border p-3",
              on ? "border-foreground bg-muted/50" : "border-border hover:bg-muted/40",
              f.disabled && "cursor-default opacity-60 hover:bg-transparent")}>
            <input type="radio" name={name} value={f.key} checked={on} disabled={f.disabled}
              onChange={() => onChange(f.key)}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-2 text-sm font-medium">
                {f.label}
                {f.recommended ? (
                  <span className="text-xs font-normal text-muted-foreground">Recommended &mdash; {f.recommended}</span>
                ) : null}
              </span>
              {f.describes ? <span className="mt-0.5 block text-xs text-muted-foreground">{f.describes}</span> : null}
              {/* The half nobody is told until after the export. */}
              {f.loses ? <span className="mt-0.5 block text-xs">Loses: {f.loses}</span> : null}
              {f.disabled && f.reason ? <span className="mt-0.5 block text-xs font-medium">{f.reason}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
