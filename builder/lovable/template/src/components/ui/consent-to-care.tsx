import { cn } from "@/lib/utils";
/**
 * Consent — with capacity treated as the separate question it is.
 *
 * CAPACITY IS DECISION-SPECIFIC AND TIME-SPECIFIC, and a single "lacks capacity"
 * flag on a person is wrong in both directions. Somebody can decide what to eat
 * and not where to live; somebody can decide today and not this morning. The
 * component is scoped to ONE decision for that reason.
 *
 * WHERE THE PERSON CANNOT DECIDE, WHO DECIDED AND ON WHAT BASIS IS RECORDED.
 * A decision made for somebody with no name against it is one nobody can be
 * asked about, and it is what makes a later complaint unanswerable.
 *
 * CONSENT CAN BE WITHDRAWN AND THE COMPONENT SAYS SO. Consent recorded once and
 * treated as permanent is the commonest way a form becomes untrue — it is a
 * state, not an event.
 *
 * NO LEGAL TEST IS NAMED. What capacity means and who may decide differs
 * everywhere; the caller supplies the framework, and the component holds the
 * shape everybody's framework shares.
 */
export function ConsentToCare({ decision, given, givenOn, byPerson, decidedBy, basis, canBeWithdrawn = true, withdrawnOn, className }: {
  /** One decision. Capacity is not a property of a person. */
  decision: string;
  given?: boolean;
  givenOn?: string;
  /** True where the person themselves consented. */
  byPerson?: boolean;
  /** Named where somebody decided on their behalf. */
  decidedBy?: string;
  /** Under what framework, in the caller's own words. */
  basis?: string;
  canBeWithdrawn?: boolean;
  withdrawnOn?: string;
  className?: string;
}) {
  if (withdrawnOn) {
    return (
      <div className={cn("space-y-0.5 text-sm", className)}>
        <p className="font-medium">{decision}</p>
        <p className="text-sm">Consent withdrawn {withdrawnOn}. It no longer applies.</p>
      </div>
    );
  }
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="font-medium">{decision}</p>
      <p>
        {!given
          ? "Not agreed."
          : byPerson
            ? `Agreed by the person themselves${givenOn ? ` on ${givenOn}` : ""}.`
            : decidedBy
              ? `Decided by ${decidedBy} on their behalf${givenOn ? `, ${givenOn}` : ""}.`
              : "Recorded as agreed, but nobody is named as agreeing to it."}
      </p>
      {!byPerson && given && basis && <p className="text-xs text-muted-foreground">{basis}</p>}
      {!byPerson && given && !basis && (
        <p className="text-xs font-medium">
          No basis recorded for deciding on their behalf. That is the part somebody will be asked about.
        </p>
      )}
      {given && canBeWithdrawn && (
        <p className="text-xs text-muted-foreground">
          This can be withdrawn at any time, and does not need a reason.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        This covers one decision. Being able to make it says nothing about any other.
      </p>
    </div>
  );
}
