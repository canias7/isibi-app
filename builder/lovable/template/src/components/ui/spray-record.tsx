import { cn, toDate } from "@/lib/utils";
/**
 * A pesticide application — the legally required record, in the required shape.
 *
 * THIS RECORD IS A LEGAL OBLIGATION IN MOST PLACES and the fields are
 * prescribed: product, rate, area, date, operator, and the conditions.
 * Recording an application without them is a breach on its own, separate from
 * anything about the spraying.
 *
 * WIND SPEED IS RECORDED because it is what makes an application lawful. Above
 * the label's limit it is drift, and it is the condition an inspector asks
 * about first — while being the one nobody writes down.
 *
 * THE HARVEST INTERVAL IS DERIVED AND SHOWN HERE, at the moment of spraying,
 * because that is when it can still change the decision. Discovering it in
 * August is discovering that the crop cannot be cut.
 *
 * THE OPERATOR'S CERTIFICATE IS NAMED. Application by an uncertificated
 * operator invalidates the record whatever else is correct, and it is checked
 * nowhere else in most systems.
 */
export function SprayRecord({ product, rate, parcel, area, unit = "ha", date, operator, certificate, windSpeed, temperature, harvestFrom, className }: {
  product: string;
  /** "1.5 l/ha". */
  rate?: string;
  /** Which field. */
  parcel?: string;
  area?: number;
  unit?: string;
  /** ISO date. */
  date?: string;
  operator?: string;
  /** Their spraying certificate number. */
  certificate?: string;
  /** "6 mph". */
  windSpeed?: string;
  temperature?: string;
  /** Free text — earliest harvest date. */
  harvestFrom?: string;
  className?: string;
}) {
  const d = date ? toDate(date) : null;
  const ok = d && !Number.isNaN(d.getTime());
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1 font-medium">{product}</span>
        {rate && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{rate}</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        {parcel}
        {parcel && area !== undefined ? " · " : ""}
        {area !== undefined && <span className="tabular-nums">{area} {unit}</span>}
        {ok && (
          <> · <time dateTime={date}>{d!.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time></>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {operator ?? <span className="font-medium text-foreground">No operator recorded</span>}
        {certificate ? ` · cert ${certificate}` : operator ? <span className="font-medium text-foreground"> · no certificate recorded</span> : null}
      </p>
      <p className="text-xs text-muted-foreground">
        {windSpeed ? `Wind ${windSpeed}` : <span className="font-medium text-foreground">Wind not recorded</span>}
        {temperature && ` · ${temperature}`}
      </p>
      {harvestFrom && (
        <p className="text-xs">
          <span className="font-medium">Cannot be harvested before {harvestFrom}.</span>
        </p>
      )}
    </li>
  );
}
