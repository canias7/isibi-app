import { cn } from "@/lib/utils";
/**
 * Who else gets this data, and what they get.
 *
 * WHAT THEY RECEIVE IS PER-RECIPIENT, not a blanket statement. "We share data
 * with our partners" is the sentence that makes people distrust privacy pages;
 * "the card processor receives your name and the amount, never the items" is
 * one they can weigh. The specificity is the entire component.
 *
 * WHERE THE DATA GOES IS NAMED where the caller knows it, because for a good
 * many readers that is the deciding fact and it is invisible everywhere else.
 * Optional, since a small business often genuinely does not know.
 *
 * "NOBODY" IS A REAL ANSWER AND WORTH PRINTING. A site that shares with no one
 * gets no credit for an absent list, and an empty section reads as unfinished
 * rather than as a claim.
 *
 * A LINK TO EACH RECIPIENT'S OWN POLICY, with `rel="noreferrer"` — following it
 * should not tell them which page of ours the reader came from.
 */
export type ThirdParty = {
  id: string;
  name: string;
  /** What they do for us — "takes card payments". */
  role?: string;
  /** What they receive. */
  receives: string;
  /** Where they process it — "the EU", "the United States". */
  location?: string;
  policyUrl?: string;
};

export function ThirdPartyList({ parties, noneNote = "Your data is not shared with anyone else.", className }: {
  parties: ThirdParty[];
  noneNote?: string;
  className?: string;
}) {
  if (!parties.length) return <p className={cn("text-sm", className)}>{noneNote}</p>;
  return (
    <ul className={cn("divide-y divide-border rounded-md border border-border text-sm", className)}>
      {parties.map((p) => (
        <li key={p.id} className="px-3 py-2">
          <p>
            <span className="font-medium">{p.name}</span>
            {p.role && <span className="text-muted-foreground"> — {p.role}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            Receives {p.receives}
            {p.location && <span> · processed in {p.location}</span>}
          </p>
          {p.policyUrl && (
            <a href={p.policyUrl} target="_blank" rel="noreferrer"
              className="text-xs underline underline-offset-2">
              Their privacy policy
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
