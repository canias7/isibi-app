import * as React from "react";
import { cn, formatMinor } from "@/lib/utils";
/**
 * Part cash, part card, part voucher — with the remainder falling as you go.
 *
 * `split-amount` DIVIDES AMONG PEOPLE and `payment-picker` chooses ONE
 * method. Paying one bill with several instruments is neither, and it is
 * ordinary at any till: a gift card that does not cover it, then the rest on
 * a card.
 *
 * THE REMAINDER IS THE HEADLINE and it is computed, never typed. Every line
 * subtracts from it, and the component refuses to over-collect: a tender
 * larger than what is left is clamped with the reason shown, because taking
 * more than the bill is a refund somebody has to unpick later.
 *
 * CHANGE DUE IS ITS OWN LINE, not a negative remainder. On cash, over-paying
 * is normal and expected; showing it as "−£4.30 outstanding" reads as an
 * error when it is in fact the float coming back.
 *
 * Integer minor units throughout, and "settled" is `remaining === 0` exactly
 * — never a tolerance, because a penny out is a till that will not balance.
 */
export type Tender = { id: string; method: string; amount: number; cash?: boolean };

export function SplitTender({ total, tenders, methods, onAdd, onRemove, currency = "GBP", className }: {
  total: number;
  tenders: Tender[];
  methods: { key: string; label: string; cash?: boolean }[];
  onAdd: (method: string, amount: number, cash?: boolean) => void;
  onRemove: (id: string) => void;
  currency?: string;
  className?: string;
}) {
  const fmt = (m: number) => formatMinor(m, currency);
  const paid = tenders.reduce((s, t) => s + t.amount, 0);
  const remaining = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);
  const settled = paid >= total;

  const [method, setMethod] = React.useState(methods[0]?.key ?? "");
  const [amount, setAmount] = React.useState("");
  const chosen = methods.find((m) => m.key === method);
  const typed = Math.round(Number(amount || 0) * 100);
  // Only cash may exceed the remainder; everything else is clamped.
  const clamped = chosen?.cash ? typed : Math.min(typed, remaining);

  return (
    <div className={cn("flex max-w-sm flex-col gap-2", className)}>
      <ul className="flex flex-col gap-1">
        {tenders.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1 text-sm">
            <span>{methods.find((m) => m.key === t.method)?.label ?? t.method}</span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums">{fmt(t.amount)}</span>
              <button type="button" onClick={() => onRemove(t.id)} aria-label="Remove this payment"
                className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2">remove</button>
            </span>
          </li>
        ))}
      </ul>

      {!settled ? (
        <div className="flex items-end gap-1.5">
          <select value={method} onChange={(e) => setMethod(e.target.value)}
            className="h-8 cursor-pointer rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {methods.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder={(remaining / 100).toFixed(2)} aria-label="Amount"
            className="h-8 w-24 rounded-md border border-input bg-background px-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <button type="button" disabled={clamped <= 0}
            onClick={() => { onAdd(method, clamped, chosen?.cash); setAmount(""); }}
            className="cursor-pointer rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
            Take
          </button>
        </div>
      ) : null}

      {typed > remaining && !chosen?.cash ? (
        <p className="text-[11px] font-medium">Capped at {fmt(remaining)} — only cash can over-collect.</p>
      ) : null}

      <div className="flex items-baseline justify-between border-t border-border pt-1.5 text-sm">
        <span className="text-xs text-muted-foreground">Total {fmt(total)} · paid {fmt(paid)}</span>
        {settled
          ? change > 0
            ? <span className="font-semibold tabular-nums">Change {fmt(change)}</span>
            : <span className="font-semibold">Settled</span>
          : <span className="font-semibold tabular-nums">{fmt(remaining)} left</span>}
      </div>
    </div>
  );
}
