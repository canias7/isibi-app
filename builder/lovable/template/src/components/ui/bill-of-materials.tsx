import { cn } from "@/lib/utils";
/**
 * What goes into one unit — and how many units the stock actually supports.
 *
 * THE ANSWER IS "HOW MANY CAN I BUILD", NOT "WHAT IS IN IT". A parts list is a
 * reference; the useful output is the smallest number of finished units the
 * shortest component allows, and which component that is. Everything else on
 * the list is fine and irrelevant.
 *
 * QUANTITY PER UNIT IS SHOWN WITH THE TOTAL NEEDED. Four screws each is not the
 * same problem as one motor each when the run is 500, and a list showing only
 * per-unit quantities makes somebody do the arithmetic that decides the order.
 *
 * SCRAP ALLOWANCE IS PART OF THE LINE. Components with a known loss rate need
 * more bought than the maths says, and leaving it out is how a run stops three
 * units short.
 *
 * SUB-ASSEMBLIES ARE MARKED, not flattened. A component that is itself built
 * has a lead time of its own, and treating it as a purchased part hides a week.
 */
export type BomLine = {
  id: string;
  part: string;
  perUnit: number;
  inStock?: number;
  scrapPercent?: number;
  subAssembly?: boolean;
  unit?: string;
};

export function BillOfMaterials({ lines, buildQuantity, className }: {
  lines: BomLine[];
  /** How many finished units are planned. */
  buildQuantity?: number;
  className?: string;
}) {
  const supports = (l: BomLine) => {
    if (l.inStock === undefined || l.perUnit <= 0) return undefined;
    const per = l.perUnit * (1 + (l.scrapPercent ?? 0) / 100);
    return Math.floor(l.inStock / per);
  };
  const known = lines.map(supports).filter((n): n is number => n !== undefined);
  const buildable = known.length ? Math.min(...known) : undefined;
  const limiting = buildable === undefined ? null : lines.find((l) => supports(l) === buildable) ?? null;
  return (
    <div data-slot="bill-of-materials" className={cn("space-y-1.5", className)}>
      {buildable !== undefined && (
        <p className="text-sm">
          <span className="font-medium tabular-nums">{buildable} buildable</span>
          {limiting && <span className="text-muted-foreground"> — {limiting.part} runs out first</span>}
          {buildQuantity !== undefined && buildable < buildQuantity && (
            <span className="block text-xs font-medium tabular-nums">
              {buildQuantity - buildable} short of the {buildQuantity} planned.
            </span>
          )}
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {lines.map((l) => {
          const need = buildQuantity !== undefined
            ? Math.ceil(l.perUnit * buildQuantity * (1 + (l.scrapPercent ?? 0) / 100))
            : undefined;
          const short = need !== undefined && l.inStock !== undefined && l.inStock < need;
          return (
            <li key={l.id} className="px-3 py-1.5">
              <p className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1">
                  {l.part}
                  {l.subAssembly && <span className="text-muted-foreground"> · built, not bought</span>}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {l.perUnit}{l.unit ? ` ${l.unit}` : ""} each
                </span>
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {l.inStock !== undefined && `${l.inStock} in stock`}
                {need !== undefined && `${l.inStock !== undefined ? " · " : ""}${need} needed`}
                {l.scrapPercent ? ` · ${l.scrapPercent}% scrap allowed` : ""}
              </p>
              {short && need !== undefined && l.inStock !== undefined && (
                <p className="text-xs font-medium tabular-nums">{need - l.inStock} short.</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
