import { cn } from "@/lib/utils";
/**
 * A bank line matched against a book entry — with the difference.
 *
 * A PARTIAL MATCH IS ITS OWN STATE, and it is the state that matters. Same
 * amount, wrong date; right date, £2 out; one payment against three invoices —
 * these are the lines somebody must look at, and a matched/unmatched binary
 * pushes them into whichever bucket the algorithm guessed.
 *
 * THE DIFFERENCE IS SHOWN IN MONEY, not as a flag. A 3p discrepancy is a
 * rounding artefact to clear; a £300 one is a missing transaction, and only the
 * number distinguishes them.
 *
 * IT SAYS WHY IT MATCHED. An automatic match on reference is strong; one on
 * amount and date alone is a guess that pairs two identical £50 payments
 * wrongly and balances perfectly while being wrong.
 *
 * UNMATCHING IS ALWAYS AVAILABLE. A wrong match that cannot be undone is worse
 * than no match, and the reconciliation that most needs correcting is the one
 * already accepted.
 */
export function ReconciliationRow({ bankDescription, bankAmount, bookDescription, bookAmount, matchedOn, state = "unmatched", onUnmatch, currency = "GBP", locale = "en-GB", className }: {
  bankDescription: string;
  bankAmount: number;
  bookDescription?: string;
  bookAmount?: number;
  /** Why it matched — "reference", "amount and date". */
  matchedOn?: string;
  state?: "matched" | "partial" | "unmatched";
  onUnmatch?: () => void;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  const diff = bookAmount !== undefined ? Number((bankAmount - bookAmount).toFixed(2)) : undefined;
  const weak = matchedOn !== undefined && !/reference/i.test(matchedOn) && state === "matched";
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1">
          {bankDescription}
          <span className="block text-xs text-muted-foreground">On the statement</span>
        </span>
        <span className="shrink-0 tabular-nums">{money(bankAmount)}</span>
      </p>
      {bookDescription !== undefined && (
        <p className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1">
            {bookDescription}
            <span className="block text-xs text-muted-foreground">In the books</span>
          </span>
          {bookAmount !== undefined && <span className="shrink-0 tabular-nums">{money(bookAmount)}</span>}
        </p>
      )}
      {diff !== undefined && diff !== 0 && (
        <p className="text-xs font-medium tabular-nums">
          {money(Math.abs(diff))} {diff > 0 ? "more on the statement" : "more in the books"}.
        </p>
      )}
      <p className={cn("text-xs", state === "unmatched" ? "font-medium" : "text-muted-foreground")}>
        {state === "matched" ? "Matched" : state === "partial" ? "Partly matched — look at this one" : "Nothing matched"}
        {matchedOn && ` on ${matchedOn}`}
        {onUnmatch && state !== "unmatched" && (
          <button type="button" onClick={onUnmatch} className="ps-2 underline underline-offset-2">Unmatch</button>
        )}
      </p>
      {weak && (
        <p className="text-xs">
          Matched without a reference — two identical payments can pair up wrongly and still balance.
        </p>
      )}
    </li>
  );
}
