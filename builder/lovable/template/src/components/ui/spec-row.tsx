import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * One line of a specification list — label, value, and the unit.
 *
 * THE UNIT IS PART OF THE VALUE, never left to the label. "Weight: 2.4" with
 * "kg" in a heading somewhere is how a spec sheet gets misread, and the pairing
 * has to survive the row being copied out on its own.
 *
 * AN UNKNOWN VALUE IS "not stated", not a dash and not blank. On a spec sheet
 * those read as "none" or "zero", and for a dimension or a warranty that is a
 * materially different claim from "we do not know".
 *
 * A value can carry a NOTE for the qualification that would otherwise be lost —
 * "up to", "measured at 20°C", "not including the case". Those are where spec
 * sheets mislead, and the note keeps them attached to the number rather than in
 * a footnote nobody reads.
 *
 * `unit` is a SUFFIX — "2.4 kg", "50 GB". A currency symbol goes in the value
 * (`value="£28"`), not here, or it renders as "28 £". Rendered that way once
 * before anybody read it.
 *
 * `<dt>`/`<dd>` inside a `<dl>`, so the pairing is structural — a two-column
 * grid of divs is two lists of unrelated text to a screen reader.
 */
export function SpecRow({ label, value, unit, note, highlight, className }: {
  label: React.ReactNode;
  value?: React.ReactNode;
  unit?: React.ReactNode;
  note?: React.ReactNode;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[8rem_1fr] gap-x-3 border-b border-border py-1.5 last:border-0 sm:grid-cols-[12rem_1fr]", className)}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm", highlight && "font-medium")}>
        {value == null || value === "" ? (
          <span className="text-muted-foreground italic">not stated</span>
        ) : (
          <>
            <span className="tabular-nums">{value}</span>
            {/* The unit travels with the number, or the row is unreadable alone. */}
            {unit ? <span> {unit}</span> : null}
          </>
        )}
        {note ? <span className="block text-xs text-muted-foreground">{note}</span> : null}
      </dd>
    </div>
  );
}

export function SpecList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("m-0", className)}>{children}</dl>;
}
