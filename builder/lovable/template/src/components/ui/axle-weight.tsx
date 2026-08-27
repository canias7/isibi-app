import { cn } from "@/lib/utils";
/**
 * The load spread across the axles — and whether any of them is over.
 *
 * A LEGAL GROSS WEIGHT CAN STILL BE AN ILLEGAL VEHICLE. The total is the number
 * everybody loads to, and the offence is per axle: a lorry 2t under its gross
 * limit with a front axle 400kg over is prohibited at the weighbridge. So a
 * component showing only the total shows the number that is never the problem.
 *
 * EACH AXLE IS SHOWN AGAINST ITS OWN LIMIT, because the limits differ — a
 * drive axle carries more than a steer — and a single shared figure would mark
 * the wrong axle.
 *
 * THE OVERLOAD IS STATED AS A WEIGHT, not a percentage. "Move 180kg back" is an
 * instruction a loader can act on; "4% over" is a number they then have to
 * convert, on a forklift, in the rain.
 *
 * OVER IS CARRIED BY WEIGHT AND THE WORD "over", never by colour alone — this
 * gets read on a phone in daylight and printed in black and white.
 */
export type Axle = { id: string; label: string; kg: number; limitKg: number };

export function AxleWeight({ axles, grossKg, grossLimitKg, className }: {
  axles: Axle[];
  /** Total, where the caller has one. */
  grossKg?: number;
  grossLimitKg?: number;
  className?: string;
}) {
  const over = axles.filter((a) => a.kg > a.limitKg);
  const grossOver = grossKg !== undefined && grossLimitKg !== undefined && grossKg > grossLimitKg;
  return (
    <div data-slot="axle-weight" className={cn("space-y-1.5", className)}>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {axles.map((a) => {
          const excess = a.kg - a.limitKg;
          return (
            <li key={a.id} className="px-3 py-1.5">
              <p className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1">{a.label}</span>
                <span className={cn("shrink-0 tabular-nums", excess > 0 && "font-medium")}>
                  {a.kg.toLocaleString()} kg
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  of {a.limitKg.toLocaleString()}
                </span>
              </p>
              {excess > 0 && (
                <p className="text-xs font-medium tabular-nums">
                  {excess.toLocaleString()} kg over this axle's limit
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {grossKg !== undefined && (
        <p className={cn("text-xs tabular-nums", grossOver ? "font-medium" : "text-muted-foreground")}>
          {grossKg.toLocaleString()} kg gross
          {grossLimitKg !== undefined && ` of ${grossLimitKg.toLocaleString()} kg`}
          {grossOver && grossLimitKg !== undefined && ` — ${(grossKg - grossLimitKg).toLocaleString()} kg over`}
        </p>
      )}
      <p className={cn("text-xs", over.length > 0 || grossOver ? "font-medium" : "text-muted-foreground")}>
        {over.length > 0
          ? `${over.length === 1 ? "One axle is" : `${over.length} axles are`} over — shift the load, don't take weight off.`
          : grossOver
            ? "Every axle is within limit but the vehicle is over its gross weight."
            : "Every axle is within its limit."}
      </p>
    </div>
  );
}
