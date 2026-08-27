import { cn } from "@/lib/utils";
/**
 * Whether a property is on supply, and with whom.
 *
 * A SUPPLY HAS A REGISTERED SUPPLIER AND A NETWORK OPERATOR AND THEY ARE
 * DIFFERENT COMPANIES. The supplier bills; the operator owns the wires and is
 * who to ring when the power is off. Customers ring the wrong one constantly,
 * because only the supplier's name is on anything they own.
 *
 * THE METER IDENTIFIER IS SHOWN AND IS COPYABLE. It is the only unambiguous
 * name for the supply — addresses are ambiguous in flats — and every transfer,
 * query and fault report needs it.
 *
 * A SWITCH IN PROGRESS IS ITS OWN STATE. During a transfer neither company
 * behaves as the supplier, which is exactly when something goes wrong and
 * exactly when a page saying only "supplied by X" misleads.
 *
 * THE PRIORITY REGISTER IS SHOWN AS A FACT ABOUT THE PROPERTY, because whether
 * somebody is on it is a thing they should be able to check without ringing to
 * ask.
 */
export function SupplyStatus({ kind = "electricity", meterId, supplier, networkOperator, networkPhone, switchTo, switchOn, onPriorityRegister, className }: {
  kind?: "electricity" | "gas" | "water";
  /** MPAN, MPRN or equivalent. */
  meterId?: string;
  supplier?: string;
  /** Who owns the network — who to call in a fault. */
  networkOperator?: string;
  networkPhone?: string;
  /** Set during a transfer. */
  switchTo?: string;
  /** Free text — "14 August". */
  switchOn?: string;
  onPriorityRegister?: boolean;
  className?: string;
}) {
  const KIND = { electricity: "Electricity", gas: "Gas", water: "Water" }[kind];
  return (
    <div data-slot="supply-status" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{KIND}</span>
        {supplier && <span className="text-muted-foreground"> · supplied by {supplier}</span>}
      </p>
      {meterId && (
        <p className="text-xs">
          <span className="text-muted-foreground">Supply number </span>
          <code className="font-mono">{meterId}</code>
        </p>
      )}
      {switchTo && (
        <p className="text-xs font-medium">
          Switching to {switchTo}{switchOn ? ` on ${switchOn}` : ""} — neither company can change your account until it completes.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {networkOperator
          ? `If the supply fails, call ${networkOperator}${networkPhone ? ` on ${networkPhone}` : ""} — not your supplier.`
          : "Faults go to the network operator, not your supplier."}
      </p>
      {onPriorityRegister !== undefined && (
        <p className="text-xs">
          {onPriorityRegister
            ? "This property is on the priority services register."
            : "This property is not on the priority services register."}
        </p>
      )}
    </div>
  );
}
