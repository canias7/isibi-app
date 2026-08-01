import { cn } from "@/lib/utils";
/**
 * A total that adds up as you go, showing its working.
 *
 * THE RUNNING COLUMN IS THE POINT. A list of amounts with one total at the
 * bottom makes the reader add up to find where a figure crossed a limit; a
 * running column answers "when did this pass £500" by eye.
 *
 * Right-aligned `tabular-nums` in both columns, which is what makes a column of
 * figures comparable at all — proportional digits put 1.40 and 11.40 at
 * different offsets.
 *
 * NEGATIVES KEEP THEIR SIGN and are not styled apart. A refund in a running
 * total is ordinary, and colouring it turns a normal row into an alarm.
 */
export function RunningTotal({ lines, unit = "", label = "Running total", className }: {
  lines: { label: string; amount: number; note?: string }[];
  unit?: string; label?: string;
  className?: string;
}) {
  if (!lines.length) return null;
  let sum = 0;
  const rows = lines.map((l) => { sum += l.amount; return { ...l, sum }; });
  const fmt = (n: number) => `${n < 0 ? "−" : ""}${unit}${Math.abs(n).toLocaleString()}`;
  return (
    <table className={cn("w-full text-sm", className)}>
      <thead>
        <tr className="border-b border-border text-xs text-muted-foreground">
          <th scope="col" className="py-1.5 text-left font-normal">Item</th>
          <th scope="col" className="py-1.5 text-right font-normal">Amount</th>
          <th scope="col" className="py-1.5 text-right font-normal">{label}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="py-1.5">
              {r.label}
              {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
            </td>
            <td className="py-1.5 text-right tabular-nums">{fmt(r.amount)}</td>
            <td className="py-1.5 text-right font-medium tabular-nums">{fmt(r.sum)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
