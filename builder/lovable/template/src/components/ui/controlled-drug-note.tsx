import { cn } from "@/lib/utils";
/**
 * A controlled medicine, with the balance that has to reconcile.
 *
 * THE RUNNING BALANCE IS COMPUTED, NEVER SUPPLIED. A register whose balance is
 * typed in is a register that can be made to agree with itself while the stock
 * on the shelf does not. Opening minus dispensed is the only balance this shows.
 *
 * A DISCREPANCY IS STATED, NOT ROUNDED AWAY. One capsule out is the whole point
 * of the register; a component that only flags large gaps is a component that
 * hides exactly the pattern a slow diversion makes.
 *
 * TWO PEOPLE, AND THE SECOND IS NAMED. "Witnessed" as a tick means the witness
 * cannot be asked afterwards what they saw. A witness who is the same person as
 * the dispenser is refused outright.
 *
 * NO LEGAL CLASSIFICATION IS ASSERTED. Which schedule a medicine sits in, and
 * what that requires, differs by country and changes; the component carries
 * whatever the caller's jurisdiction says rather than inventing a rule.
 */
export function ControlledDrugNote({ drug, opening, dispensed, counted, unit = "units", dispensedBy, witnessedBy, register, className }: {
  drug: string;
  /** Balance at the start. */
  opening: number;
  dispensed: number;
  /** What was actually counted on the shelf. */
  counted?: number;
  unit?: string;
  dispensedBy?: string;
  /** Must be a different person. */
  witnessedBy?: string;
  /** Whatever the caller's jurisdiction calls this register. */
  register?: string;
  className?: string;
}) {
  // Computed. A supplied balance can be made to agree with itself while the
  // shelf disagrees, which is the failure the register exists to catch.
  const expected = opening - dispensed;
  const discrepancy = counted !== undefined ? counted - expected : undefined;
  const samePerson =
    !!dispensedBy && !!witnessedBy && dispensedBy.trim().toLowerCase() === witnessedBy.trim().toLowerCase();
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p>
        <span className="font-medium">{drug}</span>
        {register && <span className="text-xs text-muted-foreground"> · {register}</span>}
      </p>
      <dl className="grid grid-cols-3 gap-2 rounded-md border border-border p-2 text-xs tabular-nums">
        <div>
          <dt className="text-muted-foreground">Opening</dt>
          <dd>{opening.toLocaleString()} {unit}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dispensed</dt>
          <dd>{dispensed.toLocaleString()} {unit}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Should be</dt>
          <dd className="font-medium">{expected.toLocaleString()} {unit}</dd>
        </div>
      </dl>
      {counted !== undefined && (
        <p className={cn("text-xs tabular-nums", discrepancy === 0 ? "text-muted-foreground" : "font-medium")}>
          {discrepancy === 0
            ? `Counted ${counted.toLocaleString()} ${unit}. Agrees.`
            : `Counted ${counted.toLocaleString()} ${unit} — ${Math.abs(discrepancy ?? 0).toLocaleString()} ${unit} ${(discrepancy ?? 0) > 0 ? "more" : "fewer"} than the register says.`}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {dispensedBy ? `Dispensed by ${dispensedBy}` : "Nobody recorded as dispensing"}
        {witnessedBy ? `, witnessed by ${witnessedBy}` : ", no witness named"}.
      </p>
      {samePerson && (
        <p className="text-xs font-medium">
          The witness is the same person as the dispenser. That is not a witness.
        </p>
      )}
    </div>
  );
}
