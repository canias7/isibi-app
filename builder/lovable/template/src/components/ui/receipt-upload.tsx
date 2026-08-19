import { useState , useId } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * A receipt photo plus the two fields that make it usable.
 *
 * THE AMOUNT AND DATE ARE TYPED, NOT READ FROM THE IMAGE. Even where OCR is
 * available it is wrong often enough that an unchecked figure becomes a wrong
 * expense claim — and a component that only takes a photo pushes that typing
 * onto whoever processes it, days later, without the receipt in their hand.
 *
 * EXTRACTED VALUES ARE OFFERED, NEVER APPLIED. When the caller has a guess it
 * is shown as a suggestion to accept, which keeps the person the one who
 * confirms the number that ends up in the accounts.
 *
 * THE DATE IS CAPPED AT TODAY. A receipt dated next month is a typo every time,
 * and it is the sort of thing that fails validation somewhere in finance a
 * fortnight later.
 *
 * `inputMode="decimal"` on the amount, because a numeric keypad cannot type
 * 4.50 — the same reason `currency-input` gives.
 */
export function ReceiptUpload({ onSubmit, suggested, today, currencySymbol = "£", busy, className }: {
  onSubmit: (v: { file: File | null; amount: number | null; date: string }) => void;
  /** A guess from OCR, offered rather than applied. */
  suggested?: { amount?: number; date?: string };
  /** ISO date used as the latest selectable day. */
  today?: string;
  currencySymbol?: string;
  busy?: boolean;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const max = today ?? new Date().toISOString().slice(0, 10);
  const ready = file !== null && amount !== null && date !== "";
  const hasSuggestion = suggested && (suggested.amount !== undefined || suggested.date !== undefined);
  return (
    <form className={cn("space-y-3", className)}
      onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit({ file, amount, date }); }}>
      <div className="space-y-1">
        <label htmlFor={uid + "-receipt-file"} className="block text-sm font-medium">Photo of the receipt</label>
        <input id={uid + "-receipt-file"} type="file" accept="image/*,application/pdf" required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:me-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-transparent file:px-3 file:py-1.5 file:text-sm" />
      </div>
      {hasSuggestion && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            We read
            {suggested.amount !== undefined && <span className="text-foreground"> {currencySymbol}{suggested.amount.toFixed(2)}</span>}
            {suggested.amount !== undefined && suggested.date ? " on" : ""}
            {suggested.date && <span className="text-foreground"> {suggested.date}</span>}
            {" "}— please check it.
          </span>
          <button type="button" className="underline underline-offset-2"
            onClick={() => {
              if (suggested.amount !== undefined) setAmount(suggested.amount);
              if (suggested.date) setDate(suggested.date);
            }}>
            Use these
          </button>
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <label htmlFor={uid + "-receipt-amount"} className="block text-sm font-medium">Amount</label>
          <span className="inline-flex items-center gap-1">
            <span className="text-sm text-muted-foreground">{currencySymbol}</span>
            <input id={uid + "-receipt-amount"} type="number" inputMode="decimal" step="0.01" min={0} required
              value={amount ?? ""} onChange={(e) => setAmount(e.target.value === "" ? null : Number(e.target.value))}
              className="h-9 w-28 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
          </span>
        </div>
        <div className="space-y-1">
          <label htmlFor={uid + "-receipt-date"} className="block text-sm font-medium">Date on the receipt</label>
          <input id={uid + "-receipt-date"} type="date" required max={max} value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm" />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={!ready || busy}>{busy ? "Sending…" : "Add receipt"}</Button>
    </form>
  );
}
