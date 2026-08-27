import { cn } from "@/lib/utils";
/**
 * Offering a different product for the same medicine.
 *
 * WHO MAY AGREE TO THE SWAP IS THE WHOLE QUESTION. A different manufacturer of
 * the same generic is usually the pharmacist's call; a different strength, form
 * or drug is the prescriber's. The component states which this is rather than
 * presenting every substitution as equivalent.
 *
 * IT NAMES WHAT ACTUALLY DIFFERS. "Equivalent" hides that the replacement is a
 * capsule rather than a tablet, or twice the strength at half the count — both
 * of which change what the patient does at home even when the medicine is
 * identical.
 *
 * A PATIENT WHO HAS BEEN STABLE ON ONE BRAND IS TREATED AS A REASON TO ASK, not
 * an obstacle. For a handful of medicines brand consistency genuinely matters,
 * and the pharmacist is the person who knows which.
 *
 * NO AUTOMATIC ACCEPT. The action is a decision somebody records, because a
 * substitution nobody agreed to is indistinguishable afterwards from a picking
 * error.
 */
export function StockSubstitute({ prescribed, offered, differs = [], needsPrescriber, brandCritical, reason, onAccept, onRefer, className }: {
  prescribed: string;
  offered: string;
  /** What is not the same — "capsule not tablet", "100mg × 14 not 50mg × 28". */
  differs?: string[];
  /** True where only the prescriber can agree to this. */
  needsPrescriber?: boolean;
  /** True where the patient has been kept on one brand deliberately. */
  brandCritical?: boolean;
  /** Why the substitution is being offered. */
  reason?: string;
  onAccept?: () => void;
  onRefer?: () => void;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  return (
    <div data-slot="stock-substitute" className={cn("space-y-1.5 rounded-md border border-border p-3 text-sm", className)}>
      <p>
        <span className="text-muted-foreground">Prescribed </span>
        <span className="font-medium">{prescribed}</span>
      </p>
      <p>
        <span className="text-muted-foreground">Offering </span>
        <span className="font-medium">{offered}</span>
      </p>
      {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
      {differs.length > 0 && (
        <p className="text-xs">
          Differs by {AND.format(differs)} — the patient will be doing something different at home.
        </p>
      )}
      <p className="text-xs font-medium">
        {needsPrescriber
          ? "Only the prescriber can agree to this one."
          : "A pharmacist can agree to this one."}
      </p>
      {brandCritical && (
        <p className="text-xs font-medium">
          This patient has been kept on one brand deliberately. Ask before switching.
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-0.5">
        {!needsPrescriber && onAccept && (
          <button
            type="button"
            onClick={onAccept}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
          >
            Record the swap
          </button>
        )}
        {onRefer && (
          <button
            type="button"
            onClick={onRefer}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
          >
            Ask the prescriber
          </button>
        )}
      </div>
    </div>
  );
}
