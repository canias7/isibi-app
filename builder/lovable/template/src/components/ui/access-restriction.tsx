import { cn } from "@/lib/utils";
/**
 * Why something cannot be seen — and when, or how, it can.
 *
 * A CLOSURE HAS AN END AND THE END IS THE HEADLINE. Records close for a fixed
 * period, and "closed until 2041" is a fact a researcher can plan a career
 * around. "Restricted" with no date is where an enquiry dies.
 *
 * THE REASON MATTERS BECAUSE IT DETERMINES THE ROUTE OUT. Personal data may be
 * openable on proof the subject has died; a depositor's condition needs the
 * depositor's permission; a legal exemption may be challengeable. Three
 * different actions behind one word.
 *
 * A REDACTED COPY IS OFTEN AVAILABLE AND IS OFFERED. Most researchers are told
 * "closed" when a version with names removed would have answered the question
 * entirely.
 *
 * THAT THE ITEM EXISTS IS ITSELF DISCLOSED. Describing a closed record is the
 * norm and is what makes it possible to ask; a catalogue that hides restricted
 * items makes them unfindable and unchallengeable.
 */
export type RestrictionReason = "personal-data" | "depositor" | "legal" | "condition" | "not-catalogued";

const WORDS: Record<RestrictionReason, string> = {
  "personal-data": "It contains personal information about people who may be living",
  depositor: "The depositor set a condition on access",
  legal: "It is exempt under access-to-information law",
  condition: "It is too fragile to produce",
  "not-catalogued": "It has not been catalogued yet",
};

export function AccessRestriction({ reference, reason, opensOn, redactedAvailable, surrogateAvailable, howToApply, className }: {
  reference?: string;
  reason: RestrictionReason;
  /** Free text — "2041". */
  opensOn?: string;
  /** True where a version with names removed can be seen. */
  redactedAvailable?: boolean;
  /** A digitised or microfilm copy, for fragile items. */
  surrogateAvailable?: boolean;
  /** How to ask for early access. */
  howToApply?: string;
  className?: string;
}) {
  return (
    <div data-slot="access-restriction" className={cn("space-y-0.5 text-sm", className)}>
      <p className="font-medium">
        {opensOn ? `Closed until ${opensOn}` : "Closed, with no opening date set"}
      </p>
      {reference && <p className="font-mono text-xs text-muted-foreground">{reference}</p>}
      <p className="text-xs">{WORDS[reason]}.</p>
      {redactedAvailable && (
        <p className="text-xs">A copy with personal details removed can be produced — ask for it.</p>
      )}
      {surrogateAvailable && (
        <p className="text-xs">A digitised copy is available instead of the original.</p>
      )}
      {howToApply && <p className="text-xs">{howToApply}</p>}
      <p className="text-xs text-muted-foreground">
        The record is described here so that it can be asked for — closure is not concealment.
      </p>
    </div>
  );
}
