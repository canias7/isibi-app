import { cn } from "@/lib/utils";
/**
 * One batch of stock — its code, quantity, and where it is.
 *
 * A LOT IS NOT INTERCHANGEABLE WITH ANOTHER LOT, which is the whole reason
 * batches are tracked. When a supplier recalls one, the question is which
 * customers got THAT batch, and a stock figure aggregated across lots cannot
 * answer it. Every row carries its code.
 *
 * THE CODE IS MONOSPACED AND SELECTABLE, because it gets copied into a supplier
 * email or typed into a scanner. A proportional font makes `LOT-1I0O` genuinely
 * ambiguous, which is the one place that matters.
 *
 * QUARANTINED IS A STATE, not an absence. Stock held pending a check exists, is
 * on the shelf, and must not be counted as available — showing it as zero makes
 * somebody reorder, and hiding the row makes them think it was thrown away.
 *
 * A `<li>` composing into a list, like `sign-off-row` and `credential-row`.
 */
export function LotRow({ code, quantity, unit = "units", location, state = "available", note, className }: {
  code: string;
  quantity: number;
  unit?: string;
  location?: string;
  state?: "available" | "reserved" | "quarantined";
  note?: React.ReactNode;
  className?: string;
}) {
  const WORD = { available: "", reserved: "Reserved", quarantined: "Quarantined" } as const;
  return (
    <li className={cn("flex items-start gap-3 px-3 py-2 text-sm", className)}>
      <span className="min-w-0 flex-1">
        <code className="block font-mono text-xs">{code}</code>
        <span className="block text-xs text-muted-foreground">
          {location}
          {location && note ? " · " : ""}
          {note}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={cn("block tabular-nums", state === "quarantined" && "text-muted-foreground")}>
          {quantity.toLocaleString()} <span className="text-xs text-muted-foreground">{unit}</span>
        </span>
        {WORD[state] && <span className="block text-xs font-medium">{WORD[state]}</span>}
      </span>
    </li>
  );
}
