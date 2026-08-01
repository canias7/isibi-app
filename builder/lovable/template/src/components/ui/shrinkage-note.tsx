import { cn } from "@/lib/utils";
/**
 * The gap between what the system says and what was counted.
 *
 * BOTH DIRECTIONS ARE REPORTED. Every shrinkage display assumes stock only goes
 * missing, but counting MORE than expected is just as much a data problem — it
 * usually means a delivery was never booked in, and treating it as good news is
 * how a supplier goes unpaid.
 *
 * THE SHARE MATTERS MORE THAN THE COUNT. Three missing out of forty is a
 * problem; three out of four thousand is a rounding error, and the raw number
 * reads identically. Both are shown, with the percentage doing the judging.
 *
 * NO CAUSE IS IMPLIED. Discrepancy is not theft — miscounts, breakages and
 * unrecorded samples are far commoner — and a component that says "shrinkage"
 * in accusatory language gets pointed at whoever did the count.
 *
 * A MATCHING COUNT IS WORTH SAYING. "No difference" confirms the count actually
 * ran, which an empty component cannot.
 */
export function ShrinkageNote({ expected, counted, unit = "units", value, className }: {
  expected: number;
  counted: number;
  unit?: string;
  /** Pre-formatted money value of the difference. */
  value?: string;
  className?: string;
}) {
  const diff = counted - expected;
  const pct = expected > 0 ? Math.abs(diff / expected) * 100 : null;
  if (diff === 0) {
    return (
      <p className={cn("text-sm", className)}>
        <span className="font-medium">No difference</span>
        <span className="text-muted-foreground"> · counted {counted.toLocaleString()} {unit}, as expected</span>
      </p>
    );
  }
  const short = diff < 0;
  return (
    <p className={cn("text-sm", className)}>
      <span className="font-medium tabular-nums">
        {Math.abs(diff).toLocaleString()} {short ? "fewer" : "more"}
      </span>
      <span className="text-muted-foreground">
        {" "}than expected
        {pct !== null && <span className="tabular-nums"> · {pct < 0.1 ? "<0.1" : pct.toFixed(1)}%</span>}
        {value && <span> · {value}</span>}
      </span>
      <span className="block text-xs text-muted-foreground">
        Counted {counted.toLocaleString()}, system said {expected.toLocaleString()}.
        {!short && " A delivery may not have been booked in."}
      </span>
    </p>
  );
}
