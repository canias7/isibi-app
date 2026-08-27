import { cn } from "@/lib/utils";
/**
 * One item on a prescription, as the dispenser has to read it.
 *
 * THE DRUG NAME, STRENGTH AND FORM ARE THREE SEPARATE FIELDS AND ARE NEVER
 * CONCATENATED BY THE CALLER. "Amoxicillin 500mg capsules" as one string is how
 * a 500mg capsule gets dispensed against a 250mg/5ml suspension: the strengths
 * look similar inside a sentence and utterly different in a column.
 *
 * QUANTITY IS SHOWN WITH ITS UNIT, ALWAYS. "28" is tablets, millilitres or
 * days depending on the item, and a bare number is the single most common
 * dispensing error in every study that has looked.
 *
 * THE DIRECTIONS ARE SHOWN IN FULL, NEVER ABBREVIATED. "OD" is once daily to a
 * prescriber and right eye to an optician, and the abbreviation lists that
 * caused deaths are the reason plain English is now the rule.
 *
 * AN ITEM THAT CANNOT BE DISPENSED SAYS SO ON THE ROW rather than being
 * silently omitted — a patient who gets three of four items and no explanation
 * assumes the fourth was cancelled.
 */
export type PrescriptionItem = {
  drug: string;
  /** "500mg" — separate from the name on purpose. */
  strength?: string;
  /** "capsules", "oral suspension", "patch". */
  form?: string;
  quantity?: number;
  /** "tablets", "ml" — a bare number is not a quantity. */
  unit?: string;
  /** In full. Never "OD", "BD", "PRN". */
  directions?: string;
};

export function PrescriptionRow({ item, dispensed, unavailable, unavailableReason, className }: {
  item: PrescriptionItem;
  dispensed?: boolean;
  /** True where this item cannot be supplied today. */
  unavailable?: boolean;
  unavailableReason?: string;
  className?: string;
}) {
  return (
    <div data-slot="prescription-row" className={cn("space-y-0.5 border-b border-border py-2 text-sm last:border-b-0", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 font-medium">
          {item.drug}
          {item.strength && <span className="tabular-nums"> {item.strength}</span>}
          {item.form && <span className="font-normal text-muted-foreground"> {item.form}</span>}
        </span>
        {item.quantity !== undefined && (
          <span className="shrink-0 tabular-nums">
            {item.quantity.toLocaleString()}
            {item.unit ? ` ${item.unit}` : ""}
          </span>
        )}
      </p>
      {item.quantity !== undefined && !item.unit && (
        <p className="text-xs font-medium">
          No unit on the quantity — {item.quantity} of what?
        </p>
      )}
      {item.directions && <p className="text-xs text-muted-foreground">{item.directions}</p>}
      {unavailable ? (
        <p className="text-xs font-medium">
          Not dispensed today. {unavailableReason ?? "No reason recorded — the patient will assume it was cancelled."}
        </p>
      ) : dispensed ? (
        <p className="text-xs text-muted-foreground">Dispensed.</p>
      ) : null}
    </div>
  );
}
