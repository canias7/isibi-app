import { cn } from "@/lib/utils";
/**
 * The information that comes with the medicine, in a readable order.
 *
 * THE ORDER IS WHAT THE PATIENT NEEDS, NOT WHAT THE FORMAT DICTATES. How to take
 * it and what to do about a missed dose come first; the full side-effect list —
 * which is what makes people stop reading, and sometimes stop taking it — comes
 * last and collapsed.
 *
 * "WHAT IF I MISS A DOSE" IS A FIRST-CLASS SECTION because it is the single most
 * looked-up thing in any leaflet and is usually buried in a wall of text at
 * three in the morning.
 *
 * SERIOUS EFFECTS ARE SEPARATED FROM COMMON ONES. A list that runs "nausea,
 * headache, swelling of the face" flattens the difference between put up with it
 * and go to hospital, which is the only distinction that matters at the moment
 * somebody is reading.
 *
 * IT IS NOT A REPLACEMENT FOR THE PRINTED LEAFLET and says so once, plainly,
 * without a wall of disclaimer.
 */
export function PatientLeaflet({ drug, howToTake, missedDose, seriousEffects = [], commonEffects = [], storage, expanded, onToggle, className }: {
  drug: string;
  howToTake?: string;
  /** First class, because it is the most looked-up thing in any leaflet. */
  missedDose?: string;
  /** Stop and get help. */
  seriousEffects?: string[];
  /** Put up with, or mention next time. */
  commonEffects?: string[];
  storage?: string;
  expanded?: boolean;
  onToggle?: () => void;
  className?: string;
}) {
  return (
    <div data-slot="patient-leaflet" className={cn("space-y-2 text-sm", className)}>
      <p className="font-medium">{drug}</p>
      {howToTake && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">How to take it</p>
          <p>{howToTake}</p>
        </div>
      )}
      <div>
        <p className="text-xs font-medium text-muted-foreground">If you miss a dose</p>
        <p>{missedDose ?? "Not stated here — ask the pharmacy rather than guessing or doubling up."}</p>
      </div>
      {seriousEffects.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Stop and get help if</p>
          <ul className="space-y-0.5">
            {seriousEffects.map((e) => (
              <li key={e} className="font-medium">
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
      {storage && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Keeping it</p>
          <p className="text-xs">{storage}</p>
        </div>
      )}
      {commonEffects.length > 0 && (
        <div>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!!expanded}
            className="text-xs font-medium underline underline-offset-2"
          >
            {expanded ? "Hide" : "Show"} the {commonEffects.length} common side effects
          </button>
          {expanded && (
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {commonEffects.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        A summary. The printed leaflet in the box is the full version.
      </p>
    </div>
  );
}
