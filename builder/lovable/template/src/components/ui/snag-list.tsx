import { cn } from "@/lib/utils";
/**
 * A snag list's headline — the counts that decide whether handover happens.
 *
 * "SAYS FIXED BUT NOT CHECKED" IS THE NUMBER THAT MATTERS. It is the queue for
 * whoever is inspecting, and it is the one a summary of open-versus-closed
 * hides entirely — those items look done to a client and are not.
 *
 * IT COUNTS BY TRADE, because that is how the work gets chased. Ringing one
 * plasterer about eleven items is one call; a list sorted by location is
 * eleven conversations.
 *
 * DISPUTED ITEMS ARE COUNTED SEPARATELY, since they need a decision rather
 * than work — leaving them in the open pile makes a job look further behind
 * than it is, and hides that somebody has to adjudicate.
 *
 * IT DOES NOT SAY WHETHER HANDOVER CAN PROCEED. That depends on which snags
 * are critical, which is a judgement about the contract rather than a count.
 */
export function SnagList({ open, fixed, checked, disputed = 0, byTrade = [], className }: {
  open: number;
  /** Marked done by the trade, not yet inspected. */
  fixed: number;
  checked: number;
  disputed?: number;
  byTrade?: { trade: string; outstanding: number }[];
  className?: string;
}) {
  const total = open + fixed + checked + disputed;
  return (
    <div data-slot="snag-list" className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        <span className="font-medium tabular-nums">{fixed.toLocaleString()}</span> waiting to be checked
        <span className="text-muted-foreground tabular-nums">
          {" · "}{open.toLocaleString()} still open
          {disputed > 0 && ` · ${disputed.toLocaleString()} disputed`}
          {" · "}{checked.toLocaleString()} of {total.toLocaleString()} closed
        </span>
      </p>
      {byTrade.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {[...byTrade].sort((a, b) => b.outstanding - a.outstanding).map((t) => (
            <li key={t.trade} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <span>{t.trade}</span>
              <span className="tabular-nums">{t.outstanding.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
