import { cn } from "@/lib/utils";
/**
 * The final check before a bag is handed over.
 *
 * THE CHECKER IS A DIFFERENT PERSON FROM THE DISPENSER, and the component
 * refuses to record it otherwise. Self-checking is the single condition under
 * which a check stops finding anything — you read what you meant to write.
 *
 * EACH THING CHECKED IS ITS OWN LINE. One "checked" tick covering right patient,
 * right drug, right quantity and right label means the busiest of the four got
 * the least attention and nobody can tell which.
 *
 * AN UNCHECKED ITEM IS NAMED. "3 of 4 checked" leaves the person picking it up
 * to guess; the outstanding one is the only actionable fact on the screen.
 *
 * IT IS NOT A CLINICAL CHECK. This is the accuracy check — right thing in the
 * right bag — and saying so keeps it from standing in for the pharmacist's
 * judgement about whether the medicine is right for the patient at all.
 */
export type CheckPoint = { id: string; what: string; checked?: boolean; note?: string };

export function PharmacistCheck({ points, dispensedBy, checkedBy, onCheck, className }: {
  points: CheckPoint[];
  dispensedBy?: string;
  /** Must not be the dispenser. */
  checkedBy?: string;
  onCheck?: (id: string) => void;
  className?: string;
}) {
  const outstanding = points.filter((p) => !p.checked);
  const samePerson =
    !!dispensedBy && !!checkedBy && dispensedBy.trim().toLowerCase() === checkedBy.trim().toLowerCase();
  return (
    <div data-slot="pharmacist-check" className={cn("space-y-1.5", className)}>
      <p className={cn("text-sm", outstanding.length > 0 ? "font-medium" : "text-muted-foreground")}>
        {outstanding.length === 0
          ? "All checked."
          : `Still to check: ${outstanding.map((p) => p.what).join(", ")}.`}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {points.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-baseline gap-3 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={!!p.checked}
                onChange={() => onCheck?.(p.id)}
                className="mt-1 accent-foreground"
              />
              <span className="min-w-0 flex-1">
                {p.what}
                {p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {dispensedBy ? `Dispensed by ${dispensedBy}` : "Dispenser not recorded"}
        {checkedBy ? `, checked by ${checkedBy}` : ", checker not recorded"}.
      </p>
      {samePerson && (
        <p className="text-xs font-medium">
          The same person dispensed and checked this. A check by the person who made it finds nothing.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        This is the accuracy check — right thing, right bag. It is not a decision about whether the medicine suits the patient.
      </p>
    </div>
  );
}
