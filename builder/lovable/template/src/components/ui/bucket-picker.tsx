import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Day · week · month — how finely a time axis is cut.
 *
 * THE BUCKET CHANGES THE STORY AND THE PICKER SAYS SO. Weekly buckets
 * erase the Saturday spike a barber shop lives on; monthly erases the
 * school-holiday dip. The one-line note under the control names what the
 * CURRENT choice smooths over — a prop, because only the caller knows
 * which spike matters in this data.
 *
 * A segmented control, all options visible (three or four choices — the
 * group-by-picker premise), aria-pressed carrying state.
 */
export function BucketPicker({ options = ["day", "week", "month"], labels, value, onChange, note, className }: {
  options?: string[];
  labels?: Record<string, string>;
  value: string;
  onChange: (v: string) => void;
  /** What the current bucket hides, e.g. { week: "Weekly hides the Saturday spike." } */
  note?: Record<string, React.ReactNode>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="inline-flex self-start overflow-hidden rounded-md border border-border">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)} aria-pressed={value === o}
            className={cn("cursor-pointer border-e border-border px-2.5 py-1 text-xs capitalize last:border-e-0",
              value === o ? "bg-foreground font-medium text-background" : "hover:bg-muted")}>
            {labels?.[o] ?? o}
          </button>
        ))}
      </div>
      {note?.[value] ? <p className="text-[11px] text-muted-foreground">{note[value]}</p> : null}
    </div>
  );
}
