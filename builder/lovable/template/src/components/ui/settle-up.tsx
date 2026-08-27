import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * The shortest set of payments that clears everything.
 *
 * THE POINT IS FEWER TRANSFERS, not a full reconciliation. Four people who each
 * owe two others is twelve payments; the minimal set is usually three, and
 * working that out by hand is what stops a shared bill ever being settled.
 *
 * THE PAYMENTS ARE THE CALLER'S. Computing a minimal settlement is a real
 * algorithm over the whole group, not a rendering concern — a component that did
 * it would be a feature with a data model behind it, which the kit's own bar
 * rules out.
 *
 * EACH ROW IS A SENTENCE, "Ana pays Sam £24", not two names and a number in
 * columns. It is read aloud across a table, and that is the form it has to
 * survive in.
 */
export function SettleUp({ payments, currency = "GBP", onMark, settledNote = "Everyone is square.", className }: {
  payments: { key: string; from: string; to: string; amount: number; done?: boolean }[];
  currency?: string;
  onMark?: (key: string) => void;
  settledNote?: string;
  className?: string;
}) {
  if (!payments.length) {
    return <p data-slot="settle-up" className={cn("text-sm font-medium", className)}>{settledNote}</p>;
  }
  return (
    <ul className={cn("flex flex-col gap-1 text-sm", className)}>
      {payments.map((p) => (
        <li key={p.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className={cn("min-w-0", p.done && "text-muted-foreground line-through")}>
            {p.done && <span className="sr-only">Done: </span>}
            <span className="font-medium">{p.from}</span> pays <span className="font-medium">{p.to}</span>{" "}
            <span className="tabular-nums"><Money amount={p.amount} currency={currency} /></span>
          </span>
          {onMark && !p.done && (
            <button type="button" onClick={() => onMark(p.key)}
              aria-label={`Mark ${p.from} paying ${p.to} as done`}
              className="shrink-0 cursor-pointer text-xs underline underline-offset-2">Mark as paid</button>
          )}
        </li>
      ))}
    </ul>
  );
}
