import { cn } from "@/lib/utils";
/**
 * A proportion, as two numbers — 1 : 4.
 *
 * NOT A DECIMAL. Mixing ratios, aspect ratios, gear ratios and dilutions are
 * all quoted as a pair, and 0.25 is both harder to read and ambiguous about
 * which way round it goes. Two boxes with a colon between them are unmistakable.
 *
 * THE SIMPLIFIED FORM IS SHOWN when it differs — 2 : 8 reads back as "same as
 * 1 : 4". People type what they measured, and seeing the reduced form is how
 * they notice that two recipes quoted differently are in fact the same, or that
 * they meant 1 : 40 and typed 10 : 40.
 *
 * Reduction is by greatest common divisor on integers only; a decimal pair is
 * left exactly as typed rather than being turned into an ugly approximation.
 *
 * Zero on either side renders no simplification instead of dividing by zero,
 * which is the crash every naive version of this has.
 */
function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }

export function RatioInput({ a, b, onChange, labels, id, className }: {
  a: number | null;
  b: number | null;
  onChange: (next: { a: number | null; b: number | null }) => void;
  /** Names for the two sides — ["Concentrate", "Water"]. */
  labels?: [string, string];
  id?: string;
  className?: string;
}) {
  const base = id ?? "ratio";
  const num = (v: string) => (v === "" ? null : Number(v));
  const whole = a !== null && b !== null && a > 0 && b > 0
    && Number.isInteger(a) && Number.isInteger(b);
  const d = whole ? gcd(a, b) : 1;
  const reduced = whole && d > 1 ? `${a / d} : ${b / d}` : null;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="inline-flex items-end gap-2">
        <span className="flex flex-col gap-1">
          <label htmlFor={`${base}-a`} className="text-xs text-muted-foreground">{labels?.[0] ?? "Part"}</label>
          <input id={`${base}-a`} type="number" inputMode="decimal" step="any" min={0} value={a ?? ""}
            onChange={(e) => onChange({ a: num(e.target.value), b })}
            className="h-9 w-20 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
        </span>
        <span aria-hidden className="pb-2 text-muted-foreground">:</span>
        <span className="flex flex-col gap-1">
          <label htmlFor={`${base}-b`} className="text-xs text-muted-foreground">{labels?.[1] ?? "Part"}</label>
          <input id={`${base}-b`} type="number" inputMode="decimal" step="any" min={0} value={b ?? ""}
            onChange={(e) => onChange({ a, b: num(e.target.value) })}
            className="h-9 w-20 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
        </span>
      </span>
      {reduced && (
        <p className="text-xs text-muted-foreground tabular-nums">Same as {reduced}</p>
      )}
    </div>
  );
}
