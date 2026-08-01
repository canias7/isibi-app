import { cn } from "@/lib/utils";
/**
 * The label that goes on the box — laid out the way a patient reads it.
 *
 * THE DIRECTIONS ARE THE LARGEST THING ON THE LABEL, not the drug name. The
 * patient already knows what they were given; what they cannot remember an hour
 * later is how many and how often. Pharmacy labels that lead with the brand are
 * designed for the shelf, not the person taking it.
 *
 * "TAKE AS DIRECTED" IS FLAGGED AS A DEFECT. It is the commonest thing printed
 * on a label and it tells the patient nothing at all — it means the directions
 * were never transcribed.
 *
 * THE PATIENT'S NAME IS SHOWN IN FULL AND NEVER ABBREVIATED, because the wrong
 * bag handed over is the error this field exists to prevent, and initials make
 * two family members at one address indistinguishable.
 *
 * WARNINGS ARE LISTED SEPARATELY FROM DIRECTIONS. "Do not drink alcohol" is not
 * a dosing instruction, and running the two together is how the warning gets
 * skimmed past.
 */
export function DispenseLabel({ patient, drug, strength, form, directions, warnings = [], quantity, unit, dispensedOn, pharmacy, className }: {
  patient: string;
  drug: string;
  strength?: string;
  form?: string;
  /** The largest text on the label. */
  directions?: string;
  warnings?: string[];
  quantity?: number;
  unit?: string;
  dispensedOn?: string;
  pharmacy?: string;
  className?: string;
}) {
  const vague = !directions || /^\s*(take|use)\s+as\s+directed\.?\s*$/i.test(directions);
  return (
    <div className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      <p className="text-base font-medium leading-snug">
        {directions ?? "Take as directed"}
      </p>
      {vague && (
        <p className="text-xs font-medium">
          "As directed" is not a direction. The patient has nothing to follow once they are home.
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="space-y-0.5 border-t border-border pt-2 text-xs font-medium">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <div className="space-y-0.5 border-t border-border pt-2 text-xs text-muted-foreground">
        <p className="tabular-nums">
          {drug}
          {strength ? ` ${strength}` : ""}
          {form ? ` ${form}` : ""}
          {quantity !== undefined ? ` · ${quantity.toLocaleString()}${unit ? ` ${unit}` : ""}` : ""}
        </p>
        <p className="font-medium text-foreground">{patient}</p>
        <p>
          {[pharmacy, dispensedOn].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}
