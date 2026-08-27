import { cn } from "@/lib/utils";
/**
 * What a policy covers, to what limit — and what it does not.
 *
 * THE LIMIT SITS ON EVERY LINE. "Contents covered" without a figure is not
 * cover anybody can rely on, and the gap between a sum insured and what
 * replacing everything actually costs is the commonest cause of a shortfall at
 * claim time.
 *
 * NOT-COVERED ITEMS SIT IN THE SAME LIST AS COVERED ONES. Exclusions on a
 * separate page are read by nobody; interleaving them is the only presentation
 * where somebody notices that escape of water is in and flood is out.
 *
 * A SUB-LIMIT IS SHOWN AS A SUB-LIMIT. A £50,000 contents policy with a £1,500
 * cap on any single item is two very different numbers, and the second is the
 * one that decides a jewellery claim.
 *
 * "UNLIMITED" IS RENDERED AS THE WORD, not as a large number, because a large
 * number invites the question of whether it is enough and the word does not.
 */
export type CoverLine = {
  id: string;
  what: string;
  covered: boolean;
  /** Pre-formatted — "£50,000". */
  limit?: string;
  /** "£1,500 for any one item". */
  subLimit?: string;
  note?: string;
};

export function CoverLevel({ lines, className }: { lines: CoverLine[]; className?: string }) {
  const notCovered = lines.filter((l) => !l.covered);
  return (
    <div data-slot="cover-level" className={cn("space-y-1.5", className)}>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {lines.map((l) => (
          <li key={l.id} className="space-y-0.5 px-3 py-1.5">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className={cn("min-w-0 flex-1", !l.covered && "text-muted-foreground")}>{l.what}</span>
              <span className={cn("shrink-0 text-xs tabular-nums", !l.covered && "font-medium")}>
                {l.covered ? l.limit ?? "Covered, no limit stated" : "Not covered"}
              </span>
            </p>
            {l.covered && l.subLimit && (
              <p className="text-xs font-medium tabular-nums">But {l.subLimit}.</p>
            )}
            {l.note && <p className="text-xs text-muted-foreground">{l.note}</p>}
          </li>
        ))}
      </ul>
      {notCovered.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {notCovered.length} of these {notCovered.length === 1 ? "is" : "are"} not covered — they are listed here rather than on a separate page for a reason.
        </p>
      )}
    </div>
  );
}
