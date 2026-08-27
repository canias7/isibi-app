import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Show sample data" — so an empty app can be seen with furniture in it.
 *
 * EVERY SAMPLE ROW IS MARKED, UNMISTAKABLY. A realistic fake booking gets
 * phoned back; realistic fake takings get reported to an accountant. The
 * SampleTag chip goes ON EACH ROW the caller renders, not only at the top
 * of the list, because rows travel (screenshots, exports, half-scrolled
 * screens) without their header.
 *
 * ONE SWITCH REMOVES EVERYTHING. Sample data the person has to delete
 * row-by-row is worse than none; the toggle owns the whole set.
 *
 * NEVER IN EXPORTS — the hook exposes `sample` for the caller to exclude
 * from any export/print path, and the header states the contract because
 * the component cannot reach into the caller's CSV writer.
 *
 * Off by default and NOT remembered: sample mode is a look, not a state
 * to resume into — coming back tomorrow to fake bookings you forgot were
 * fake is the failure this avoids.
 */
export function useSampleData<T>(samples: T[]) {
  const [sample, setSample] = React.useState(false);
  return { sample, setSample, rows: sample ? samples : [] };
}

export function SampleToggle({ sample, onChange, count, className }: {
  sample: boolean;
  onChange: (v: boolean) => void;
  count?: number;
  className?: string;
}) {
  return (
    <label data-slot="sample-toggle" className={cn("flex cursor-pointer items-center gap-2 text-xs", className)}>
      <input type="checkbox" checked={sample} onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 cursor-pointer accent-foreground" />
      Show sample data{count ? ` (${count} rows)` : ""}
      {sample ? <span className="text-muted-foreground">— none of it is real, nothing exports</span> : null}
    </label>
  );
}

export function SampleTag({ className }: { className?: string }) {
  return (
    <span data-slot="sample-tag" className={cn(
      "inline-flex items-center rounded-sm border border-dashed border-foreground/60 px-1 py-px text-[10px] uppercase tracking-wide text-muted-foreground",
      className)}>
      Sample
    </span>
  );
}
