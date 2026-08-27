import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * A target and how far off it may be — 250 g ± 5%.
 *
 * TOLERANCE IS EITHER ABSOLUTE OR A PERCENTAGE, and the two are not
 * interchangeable: ±5 g on a 250 g target is 2%, and ±5% on a 5 kg target is
 * 250 g. Storing one and displaying the other is how a spec drifts, so the mode
 * is part of the value rather than a display choice.
 *
 * THE RESULTING RANGE IS SHOWN, computed here. "250 ± 5%" requires the reader
 * to do arithmetic to learn the thing they actually care about, which is that
 * anything from 237.5 to 262.5 passes. Printing it removes the whole class of
 * misread specifications.
 *
 * Rounded to a sensible number of places rather than shown raw, because
 * 237.50000000000003 in a specification destroys confidence in the rest of the
 * form.
 */
export function ToleranceField({ target, tolerance, mode, unit, onChange, id, className }: {
  target: number | null;
  tolerance: number | null;
  mode: "abs" | "pct";
  unit?: string;
  onChange: (next: { target: number | null; tolerance: number | null; mode: "abs" | "pct" }) => void;
  id?: string;
  className?: string;
}) {
  const base = id ?? "tol";
  const num = (v: string) => (v === "" ? null : Number(v));
  const spread = target !== null && tolerance !== null
    ? mode === "pct" ? (target * tolerance) / 100 : tolerance
    : null;
  const round = (n: number) => Number(n.toFixed(4)).toString();

  return (
    <div data-slot="tolerance-field" className={cn("flex flex-col gap-1.5", className)}>
      <span className="flex flex-wrap items-end gap-2">
        <span className="flex flex-col gap-1">
          <label htmlFor={`${base}-t`} className="text-xs text-muted-foreground">Target</label>
          <input id={`${base}-t`} type="number" inputMode="decimal" step="any" value={target ?? ""}
            onChange={(e) => onChange({ target: num(e.target.value), tolerance, mode })}
            className="h-9 w-24 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
        </span>
        <span aria-hidden className="pb-2 text-muted-foreground">±</span>
        <span className="flex flex-col gap-1">
          <label htmlFor={`${base}-v`} className="text-xs text-muted-foreground">Tolerance</label>
          <input id={`${base}-v`} type="number" inputMode="decimal" step="any" min={0} value={tolerance ?? ""}
            onChange={(e) => onChange({ target, tolerance: num(e.target.value), mode })}
            className="h-9 w-24 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
        </span>
        <NativeSelect value={mode} aria-label="Tolerance mode" className="h-9 w-auto text-sm"
          onChange={(e) => onChange({ target, tolerance, mode: e.target.value as "abs" | "pct" })}>
          <option value="abs">{unit ?? "units"}</option>
          <option value="pct">%</option>
        </NativeSelect>
      </span>
      {spread !== null && target !== null && (
        <p className="text-xs text-muted-foreground tabular-nums">
          Accepts {round(target - spread)} to {round(target + spread)}{unit ? ` ${unit}` : ""}
        </p>
      )}
    </div>
  );
}
