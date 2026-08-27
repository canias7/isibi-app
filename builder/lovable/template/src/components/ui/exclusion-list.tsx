import { cn } from "@/lib/utils";
/**
 * What the policy will not pay for — in the words a person would use.
 *
 * EACH EXCLUSION IS RESTATED AS A SITUATION, not quoted from the wording.
 * "Gradual deterioration" excludes nothing that anybody can picture; "a leak
 * that has been dripping for months rather than a pipe that burst last night"
 * is the same clause and can actually be checked against your own house.
 *
 * THE COMMON ONES COME FIRST, not the legally weighty ones. The exclusions that
 * defeat real claims are wear and tear, gradual damage and unoccupancy — and
 * they are usually buried below war, nuclear risk and terrorism, which have
 * never affected a single domestic claim.
 *
 * A CONDITIONAL EXCLUSION SAYS WHAT REMOVES IT. Many are lifted by a security
 * device, a maintenance record or telling the insurer in advance, and that is
 * an action rather than a disappointment.
 *
 * THE ORIGINAL WORDING IS REACHABLE, because the restatement is a summary and
 * the policy is the contract.
 */
export type Exclusion = {
  id: string;
  /** In plain words, as a situation. */
  plain: string;
  /** The clause name, for looking up. */
  clause?: string;
  /** What lifts it. */
  liftedBy?: string;
  common?: boolean;
};

export function ExclusionList({ exclusions, wordingNote, className }: {
  exclusions: Exclusion[];
  /** Where to read the actual policy wording. */
  wordingNote?: string;
  className?: string;
}) {
  // Common ones first: the exclusions that defeat real claims are ordinary, and
  // burying them under war and nuclear risk is how a summary becomes useless.
  const ordered = [...exclusions].sort((a, b) => Number(Boolean(b.common)) - Number(Boolean(a.common)));
  return (
    <div data-slot="exclusion-list" className={cn("space-y-1.5", className)}>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {ordered.map((e) => (
          <li key={e.id} className="space-y-0.5 px-3 py-2">
            <p>{e.plain}</p>
            {e.liftedBy && <p className="text-xs">This does not apply if {e.liftedBy}.</p>}
            {e.clause && <p className="text-xs text-muted-foreground">{e.clause}</p>}
          </li>
        ))}
      </ul>
      {wordingNote && <p className="text-xs text-muted-foreground">{wordingNote}</p>}
    </div>
  );
}
