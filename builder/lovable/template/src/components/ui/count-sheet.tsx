import { cn } from "@/lib/utils";
/**
 * A stocktake row: type what you counted, without seeing what was expected.
 *
 * THE EXPECTED FIGURE IS HIDDEN UNTIL THE COUNT IS ENTERED, and that is the
 * whole design. Showing it first produces confirmation bias in its purest form
 * — somebody who can see "40" counts to about forty and stops. Every serious
 * stocktake procedure calls this a blind count, and every stock screen breaks
 * it by displaying the number.
 *
 * THE DIFFERENCE APPEARS THE MOMENT A COUNT IS TYPED, because that is when it
 * is useful: a large gap is worth recounting on the spot, which is far cheaper
 * than discovering it in a report tomorrow.
 *
 * `inputMode="numeric"` AND NO SPINNER, since these are typed on a phone in a
 * stockroom and the up/down arrows are a way to be one out without noticing.
 *
 * A `<tr>` for the caller's own table, so the column set and header stay
 * theirs — the same shape as `size-chart-row`.
 */
export function CountSheetRow({ name, expected, counted, onChange, unit, revealed, className }: {
  name: string;
  expected: number;
  /** null until somebody types. */
  counted: number | null;
  onChange: (v: number | null) => void;
  unit?: string;
  /** Force the expected figure visible — for a supervisor's recount. */
  revealed?: boolean;
  className?: string;
}) {
  const show = revealed || counted !== null;
  const diff = counted === null ? null : counted - expected;
  return (
    <tr data-slot="count-sheet-row" className={className}>
      <th scope="row" className="px-3 py-2 text-start text-sm font-normal">
        {name}
        {unit && <span className="ms-1.5 text-xs text-muted-foreground">{unit}</span>}
      </th>
      <td className="px-3 py-2">
        <input type="number" inputMode="numeric" min={0} value={counted ?? ""}
          aria-label={`Counted ${name}`}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="h-9 w-24 rounded-md border border-input bg-transparent px-2 text-end text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      </td>
      <td className="px-3 py-2 text-end text-sm tabular-nums text-muted-foreground">
        {show ? expected.toLocaleString() : <span className="italic">hidden</span>}
      </td>
      <td className={cn("px-3 py-2 text-end text-sm tabular-nums", diff !== null && diff !== 0 && "font-medium")}>
        {diff === null ? "" : diff === 0 ? "—" : `${diff > 0 ? "+" : "−"}${Math.abs(diff).toLocaleString()}`}
      </td>
    </tr>
  );
}
