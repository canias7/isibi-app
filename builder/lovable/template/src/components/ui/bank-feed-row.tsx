import { cn } from "@/lib/utils";
/**
 * A transaction arriving from the bank — with how confident the guess is.
 *
 * A SUGGESTED CATEGORY IS SHOWN AS A SUGGESTION, WITH ITS BASIS. "Because the
 * last four payments to this payee went to Software" is checkable; a
 * pre-selected dropdown is accepted without reading, and one wrong rule then
 * miscodes a year of transactions before anybody notices.
 *
 * THE RAW BANK NARRATIVE IS ALWAYS SHOWN. Cleaned-up payee names are how a
 * transaction gets attributed to the wrong company with a similar name, and
 * the original text is the only thing that can settle it.
 *
 * A DUPLICATE IS FLAGGED RATHER THAN HIDDEN. Feeds re-import, and two identical
 * payments on one day are sometimes real — deciding is the bookkeeper's job and
 * silently dropping one is how a genuine payment vanishes.
 *
 * A FEED GAP IS SURFACED. Bank connections break quietly, and a missing week is
 * invisible in a list that simply has fewer rows in it.
 */
export function BankFeedRow({ date, rawNarrative, amount, suggestedAccount, suggestedBecause, confidence, possibleDuplicate, feedGapNote, currency = "GBP", locale = "en-GB", className }: {
  date?: string;
  /** Exactly as the bank sent it. */
  rawNarrative: string;
  amount: number;
  suggestedAccount?: string;
  /** Why it was suggested. */
  suggestedBecause?: string;
  confidence?: "high" | "low";
  possibleDuplicate?: boolean;
  /** "No transactions received between 3 and 11 July." */
  feedGapNote?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(amount));
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-3">
        {date && <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">{date}</span>}
        <span className="min-w-0 flex-1 font-mono text-xs">{rawNarrative}</span>
        <span className="shrink-0 tabular-nums">
          {amount < 0 ? "−" : ""}{money}
        </span>
      </p>
      {suggestedAccount && (
        <p className={cn("text-xs", confidence === "low" ? "font-medium" : "text-muted-foreground")}>
          Suggested: {suggestedAccount}
          {suggestedBecause && <span className="block font-normal text-muted-foreground">{suggestedBecause}</span>}
          {confidence === "low" && <span className="block">Low confidence — check this one.</span>}
        </p>
      )}
      {possibleDuplicate && (
        <p className="text-xs font-medium">
          Looks like a duplicate of another line — sometimes it really is two payments.
        </p>
      )}
      {feedGapNote && <p className="text-xs font-medium">{feedGapNote}</p>}
    </li>
  );
}
