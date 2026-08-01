import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * A number filter with an operator, not just a range.
 *
 * "IS EMPTY" IS AN OPERATOR AND IT MATTERS MORE THAN THE COMPARISONS. A price
 * of null and a price of zero are different facts, and every filter built on
 * min/max boxes silently drops the nulls — so "under £10" quietly hides every
 * record nobody has priced yet, which is usually the set somebody is hunting
 * for.
 *
 * THE VALUE FIELD DISAPPEARS FOR THE OPERATORS THAT TAKE NO VALUE, rather than
 * sitting there disabled. An enabled-looking box beside "is empty" invites a
 * number that will be ignored.
 *
 * `between` IS THE ONLY TWO-VALUE OPERATOR and gets a second input, so the
 * common case stays one box. A permanent pair of min/max fields makes every
 * simple "over 100" a puzzle about which one to fill in.
 *
 * `inputMode="decimal"`, not `numeric` — a numeric keypad has no decimal point,
 * which makes 4.50 untypeable on a phone.
 *
 * `unit` IS A SUFFIX — "kg", "days", "items". Not a currency symbol, which goes
 * before the number in most locales and belongs to `money`. It is tied to the
 * last input rather than sitting loose in the wrapping row: measured, a `£`
 * left to wrap landed alone on the line below and read as a stray character.
 */
export type NumericOp = "eq" | "gt" | "lt" | "between" | "empty" | "notEmpty";

const OPS: { id: NumericOp; label: string; values: 0 | 1 | 2 }[] = [
  { id: "eq", label: "is", values: 1 },
  { id: "gt", label: "is more than", values: 1 },
  { id: "lt", label: "is less than", values: 1 },
  { id: "between", label: "is between", values: 2 },
  { id: "empty", label: "is empty", values: 0 },
  { id: "notEmpty", label: "is not empty", values: 0 },
];

export function NumericFilter({ label, op, value, value2, onChange, unit, id, className }: {
  label: string;
  op: NumericOp;
  value: number | null;
  value2?: number | null;
  onChange: (next: { op: NumericOp; value: number | null; value2: number | null }) => void;
  unit?: string;
  id?: string;
  className?: string;
}) {
  const base = id ?? `nf-${label.replace(/\W+/g, "-").toLowerCase()}`;
  const spec = OPS.find((o) => o.id === op) ?? OPS[0];
  const num = (s: string) => (s === "" ? null : Number(s));
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={`${base}-op`} className="block text-sm font-medium">{label}</label>
      <div className="flex flex-wrap items-center gap-1.5">
        <NativeSelect id={`${base}-op`} value={op} className="h-9 w-auto text-sm"
          onChange={(e) => {
            const nextOp = e.target.value as NumericOp;
            const vals = OPS.find((o) => o.id === nextOp)?.values ?? 1;
            onChange({ op: nextOp, value: vals === 0 ? null : value, value2: vals === 2 ? (value2 ?? null) : null });
          }}>
          {OPS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </NativeSelect>
        {spec.values >= 1 && (
          <span className="inline-flex items-center gap-1.5">
            <input type="number" inputMode="decimal" step="any" value={value ?? ""} aria-label={`${label} value`}
              onChange={(e) => onChange({ op, value: num(e.target.value), value2: value2 ?? null })}
              className="h-9 w-24 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
            {unit && spec.values === 1 && <span className="text-sm text-muted-foreground">{unit}</span>}
          </span>
        )}
        {spec.values === 2 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">and</span>
            <input type="number" inputMode="decimal" step="any" value={value2 ?? ""} aria-label={`${label} upper value`}
              onChange={(e) => onChange({ op, value: value ?? null, value2: num(e.target.value) })}
              className="h-9 w-24 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
