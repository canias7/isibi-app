import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Top 5 · 10 · 20 · All — and what happens to the rest.
 *
 * "GROUP THE REST AS OTHER" IS OFFERED WHENEVER N IS FINITE, because a
 * top-5 without it silently DROPS data — the repo's no-silent-caps rule
 * as a control: a chart of the top five services that quietly omits a
 * third of takings reads as "covered everything" when it did not. The
 * checkbox disables (not hides) on All, where there is no rest to group.
 *
 * Emits {n, other} as one value — the pair is one decision, like
 * aggregate-picker's fn+column.
 */
export function TopNPicker({ choices = [5, 10, 20], n, other, onChange, className }: {
  choices?: number[];
  /** null means All. */
  n: number | null;
  other: boolean;
  onChange: (v: { n: number | null; other: boolean }) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="inline-flex overflow-hidden rounded-md border border-border">
        {[...choices.map((c) => ({ label: `Top ${c}`, val: c as number | null })), { label: "All", val: null }].map((o) => (
          <button key={o.label} type="button" aria-pressed={n === o.val}
            onClick={() => onChange({ n: o.val, other })}
            className={cn("cursor-pointer border-e border-border px-2.5 py-1 text-xs last:border-e-0",
              n === o.val ? "bg-foreground font-medium text-background" : "hover:bg-muted")}>
            {o.label}
          </button>
        ))}
      </div>
      <label className={cn("flex items-center gap-1.5 text-xs", n === null ? "cursor-default text-muted-foreground" : "cursor-pointer")}>
        <input type="checkbox" checked={n !== null && other} disabled={n === null}
          onChange={(e) => onChange({ n, other: e.target.checked })}
          className="size-3.5 cursor-pointer accent-foreground disabled:cursor-not-allowed" />
        group the rest as “Other”
      </label>
      {n !== null && !other ? (
        <span className="text-[11px] text-muted-foreground">everything past {n} is dropped from the view</span>
      ) : null}
    </div>
  );
}
