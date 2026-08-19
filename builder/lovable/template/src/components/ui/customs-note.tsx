import { cn } from "@/lib/utils";
/**
 * What customs needs, and which of it is missing.
 *
 * A SHIPMENT STOPS FOR ONE MISSING FIELD. A commodity code, an origin, a value
 * or a signature — any one absent and the load sits at a border accruing
 * storage while nobody knows why. Listing what is required against what is
 * present is the whole component.
 *
 * THE COMMODITY CODE DRIVES DUTY AND IS THE MOST OFTEN WRONG. It is chosen once
 * by somebody guessing and reused for years; showing it plainly at least makes
 * it visible to whoever knows better.
 *
 * ORIGIN IS NOT THE SAME AS WHERE IT SHIPPED FROM, and that confusion is the
 * commonest declaration error. Goods made in one country and dispatched from
 * another have the first as origin, and preferential duty turns on it.
 *
 * IT MAKES NO CLASSIFICATION. Choosing a commodity code is a decision with
 * legal consequences and a component guessing one would be worse than no
 * guidance at all.
 */
export type CustomsField = { id: string; label: string; value?: string; required?: boolean };

export function CustomsNote({ fields, incoterm, dutyPayableBy, className }: {
  fields: CustomsField[];
  incoterm?: string;
  /** Who pays — "the buyer". */
  dutyPayableBy?: string;
  className?: string;
}) {
  const missing = fields.filter((f) => f.required && !f.value);
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        {missing.length === 0
          ? <span className="text-muted-foreground">Everything customs needs is here</span>
          : <>
              <span className="font-medium tabular-nums">{missing.length}</span> required{" "}
              {missing.length === 1 ? "field is" : "fields are"} missing — this will be held at the border
            </>}
      </p>
      <dl className="divide-y divide-border rounded-md border border-border text-sm">
        {fields.map((f) => (
          <div key={f.id} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <dt className="min-w-0 text-muted-foreground">
              {f.label}
              {f.required && !f.value && <span className="ms-1.5 text-xs font-medium text-foreground">required</span>}
            </dt>
            <dd className={cn("shrink-0 text-end", !f.value && "italic text-muted-foreground")}>
              {f.value || "not given"}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        {incoterm && <span>Terms {incoterm}. </span>}
        {dutyPayableBy && <span>Duty and import taxes are paid by {dutyPayableBy}. </span>}
        Origin is where the goods were made, not where they were sent from.
      </p>
    </div>
  );
}
