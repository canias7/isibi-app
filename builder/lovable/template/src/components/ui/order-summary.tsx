import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
export type SummaryLine = { label: string; value: number | string; note?: string };
/**
 * Subtotal, delivery, discount, total.
 *
 * The total is a real total row rather than another line, and every figure is
 * tabular so the column reads down. A discount is shown as a negative, not as a
 * separate colour, so it survives print.
 */
export function OrderSummary({ lines, total, currency = "£", note, className }: {
  lines: SummaryLine[]; total: number | string; currency?: string;
  note?: string; className?: string;
}) {
  const money = (v: number | string) => (typeof v === "number" ? currency + v.toFixed(2) : v);
  return (
    <div data-slot="order-summary" className={cn("flex flex-col gap-2 text-sm", className)}>
      {lines.map((l) => (
        <div key={l.label} className="flex items-baseline justify-between gap-4">
          <span className="text-muted-foreground">{l.label}{l.note && <span className="ms-1 text-xs">({l.note})</span>}</span>
          <span className="tabular-nums">{money(l.value)}</span>
        </div>
      ))}
      <Separator className="my-1" />
      <div className="flex items-baseline justify-between gap-4 font-medium">
        <span>Total</span><span className="text-base tabular-nums">{money(total)}</span>
      </div>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
