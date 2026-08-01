import { cn } from "@/lib/utils";
/**
 * A risk, what is done about it, and who accepted what is left.
 *
 * THE RISK OF DOING NOTHING IS A FIELD. Every assessment lists what could go
 * wrong if somebody walks to the shop, and none of them lists what goes wrong if
 * they stop — which is how a document meant to keep people safe ends up removing
 * the thing that keeps them well.
 *
 * THE PERSON'S OWN VIEW IS RECORDED. A risk somebody has decided to take,
 * knowing it, is a decision. Overriding it needs a reason that survives being
 * read back to them, and the field is where that reason has to go.
 *
 * SOMEBODY ACCEPTS THE RESIDUAL RISK BY NAME. Controls never reduce a risk to
 * zero, and an assessment with no accepting name is one where nobody has agreed
 * to anything — which is discovered only after something happens.
 *
 * NO LIKELIHOOD × SEVERITY NUMBER. The multiplied score is the most-used and
 * least-defensible artefact in the genre: it turns two guesses into one figure
 * that then gets sorted, compared and put in a report as though it were measured.
 */
export function RiskAssessmentRow({ risk, ifNothingDone, controls = [], personsView, personAccepts, acceptedBy, acceptedOn, className }: {
  risk: string;
  /** What is lost by preventing it. Rarely written down and always relevant. */
  ifNothingDone?: string;
  controls?: string[];
  /** What the person themselves says about it. */
  personsView?: string;
  /** True where they have chosen to take it. */
  personAccepts?: boolean;
  /** Somebody has to. */
  acceptedBy?: string;
  acceptedOn?: string;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="font-medium">{risk}</p>
      {ifNothingDone ? (
        <p className="text-xs">If it is prevented: {ifNothingDone}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nothing recorded about what is lost by preventing it — usually the more important half.
        </p>
      )}
      {controls.length > 0 && (
        <p className="text-xs text-muted-foreground">What is done: {AND.format(controls)}.</p>
      )}
      {personsView && (
        <p className="text-sm italic">"{personsView}"</p>
      )}
      {/* "and by them" is a clause, not a field — joined with the others by a
          middle dot it reads as a third separate fact rather than as part of the
          sentence it belongs to. */}
      <p className={cn("text-xs", acceptedBy ? "text-muted-foreground" : "font-medium")}>
        {acceptedBy
          ? `Remaining risk accepted by ${acceptedBy}${acceptedOn ? ` on ${acceptedOn}` : ""}${
              personAccepts ? ", and by them too" : ""
            }.`
          : "Nobody has accepted what is left. Controls never take a risk to zero."}
      </p>
    </li>
  );
}
