import { cn } from "@/lib/utils";
/**
 * What growth stage a crop is at — with the code, because that is what the
 * label says.
 *
 * THE GROWTH-STAGE CODE IS OPERATIONAL, NOT ACADEMIC. Product labels specify
 * application windows by stage — a fungicide cleared up to a particular stage
 * and not beyond — so the code is what makes a spray decision legal. A
 * component showing only "flowering" cannot support that.
 *
 * IT SHOWS THE STAGE AND WHAT IT MEANS. Nobody remembers what every code
 * corresponds to, and the plain description is what a person checks against the
 * plant in their hand.
 *
 * IT IS OBSERVED, NOT CALCULATED. Stage depends on weather, variety and soil,
 * so a date-based estimate is confidently wrong most seasons — the observation
 * date is shown so an old one can be distrusted.
 *
 * NO SCALE IS BUILT IN. There are several in use for different crops, so the
 * scale is named by the caller rather than assumed.
 */
export function CropStage({ crop, code, scale, means, observedOn, observedBy, className }: {
  crop: string;
  /** The stage code from the scale in use. */
  code: string;
  /** Which scale — the caller names it. */
  scale?: string;
  /** What that stage looks like. */
  means?: string;
  /** Free text — "3 days ago". */
  observedOn?: string;
  observedBy?: string;
  className?: string;
}) {
  return (
    <div data-slot="crop-stage" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{crop}</span>
        <span className="text-muted-foreground"> · </span>
        <code className="font-mono">{code}</code>
        {scale && <span className="text-xs text-muted-foreground"> ({scale})</span>}
      </p>
      {means && <p className="text-xs">{means}</p>}
      <p className="text-xs text-muted-foreground">
        {observedOn ? `Seen ${observedOn}` : "No observation date — this may be out of date"}
        {observedBy && ` by ${observedBy}`}
      </p>
    </div>
  );
}
