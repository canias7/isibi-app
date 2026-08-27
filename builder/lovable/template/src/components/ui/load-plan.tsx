import { cn } from "@/lib/utils";
/**
 * How full a vehicle is — by weight AND by space, because either can stop it.
 *
 * TWO CONSTRAINTS AND EITHER BINDS FIRST. A load of insulation fills a trailer
 * at a third of its weight limit; a load of tiles hits the weight limit with
 * the trailer half empty. A single "capacity" bar is wrong for one of them, and
 * it is the one somebody is planning right now.
 *
 * IT NAMES WHICH IS BINDING. That is the actionable output — "you can add more
 * weight but not more pallets" tells somebody what to look for in the next
 * order.
 *
 * OVER IS SHOWN, NOT CLAMPED, ON BOTH BARS. An overloaded vehicle is a
 * prohibition and a fine at the roadside; a load with more pallets than floor
 * simply does not go on. A bar that stops at 100% renders both of those exactly
 * like a vehicle that is comfortably full, so over is carried by a hatched fill
 * AND by the sentence underneath — never by the bar length, which cannot say it.
 *
 * BARS ARE `aria-hidden` WITH THE NUMBERS IN TEXT — the same discipline as
 * `allocation-bar`, and here the numbers are the legal position.
 */
export function LoadPlan({ weight, weightLimit, weightUnit = "kg", spaces, spaceLimit, spaceNoun = "pallet spaces", className }: {
  weight: number;
  weightLimit: number;
  weightUnit?: string;
  spaces: number;
  spaceLimit: number;
  spaceNoun?: string;
  className?: string;
}) {
  const wShare = weightLimit > 0 ? weight / weightLimit : 0;
  const sShare = spaceLimit > 0 ? spaces / spaceLimit : 0;
  const over = weight > weightLimit;
  const overSpace = spaces > spaceLimit;
  const binding = wShare >= sShare ? "weight" : "space";
  const bar = (share: number, over: boolean) => (
    <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full border border-border">
      <span style={{ width: `${Math.min(100, share * 100)}%` }}
        className={cn("block h-full", over
          ? "bg-[repeating-linear-gradient(45deg,var(--color-foreground)_0_3px,transparent_3px_6px)]"
          : "bg-foreground")} />
    </div>
  );
  return (
    <div data-slot="load-plan" className={cn("space-y-2", className)}>
      <div className="space-y-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="text-muted-foreground">Weight</span>
          <span className={cn("tabular-nums", over && "font-medium")}>
            {weight.toLocaleString()} of {weightLimit.toLocaleString()} {weightUnit}
          </span>
          <span className={cn("ms-auto text-xs tabular-nums", over ? "font-medium" : "text-muted-foreground")}>{Math.round(wShare * 100)}%</span>
        </p>
        {bar(wShare, over)}
      </div>
      <div className="space-y-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="text-muted-foreground">Space</span>
          <span className={cn("tabular-nums", overSpace && "font-medium")}>{spaces} of {spaceLimit} {spaceNoun}</span>
          <span className={cn("ms-auto text-xs tabular-nums", overSpace ? "font-medium" : "text-muted-foreground")}>{Math.round(sShare * 100)}%</span>
        </p>
        {bar(sShare, overSpace)}
      </div>
      <p className={cn("text-xs", over || overSpace ? "font-medium" : "text-muted-foreground")}>
        {over && overSpace
          ? `Overweight by ${(weight - weightLimit).toLocaleString()} ${weightUnit} and ${spaces - spaceLimit} ${spaceNoun} too many — this cannot go out.`
          : over
          ? `Overweight by ${(weight - weightLimit).toLocaleString()} ${weightUnit} — this cannot go out.`
          : overSpace
          ? `${spaces - spaceLimit} ${spaceNoun} more than the vehicle has — this cannot go out.`
          : binding === "weight"
            ? "Weight is the limit here — you have space left but not payload."
            : "Space is the limit here — you have payload left but nowhere to put it."}
      </p>
    </div>
  );
}
