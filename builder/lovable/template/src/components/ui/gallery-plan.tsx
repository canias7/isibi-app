import { cn } from "@/lib/utils";
/**
 * The rooms, in the order somebody walks them — as a list, not a map image.
 *
 * IT IS TEXT BECAUSE A MAP IMAGE IS UNUSABLE TO ANYONE WHO CANNOT SEE IT, and
 * a floor plan is exactly the content most often shipped as an unlabelled
 * picture. A named sequence of rooms with the route between them answers the
 * same question and works on a phone, in a screen reader and in print.
 *
 * STEP-FREE ACCESS IS PER ROOM, not a single badge on the building. Museums are
 * old and mixed: a building described as accessible routinely has three rooms
 * up a flight of stairs, and the visitor finds out on the day.
 *
 * IT SAYS WHICH ROOMS ARE CLOSED. Gallery closures for rehangs and staff
 * shortages are constant and are the single most common cause of a wasted
 * journey to see one object.
 *
 * THE ROUTE IS SUGGESTED, NOT PRESCRIBED. Numbered rooms imply a required order
 * that most collections do not have, so the sequence is presented as a walk
 * that works rather than as instructions.
 */
export type GalleryRoom = {
  id: string;
  name: string;
  floor?: string;
  about?: string;
  stepFree?: boolean;
  closed?: boolean;
  closedNote?: string;
};

export function GalleryPlan({ rooms, routeNote, className }: {
  rooms: GalleryRoom[];
  /** "This order works well and takes about 90 minutes." */
  routeNote?: string;
  className?: string;
}) {
  const closed = rooms.filter((r) => r.closed);
  const noStepFree = rooms.filter((r) => r.stepFree === false);
  return (
    <div data-slot="gallery-plan" className={cn("space-y-1.5", className)}>
      {routeNote && <p className="text-xs text-muted-foreground">{routeNote}</p>}
      {closed.length > 0 && (
        <p className="text-sm font-medium">
          {closed.length === 1 ? "One room is" : `${closed.length} rooms are`} closed today.
        </p>
      )}
      <ol className="divide-y divide-border rounded-md border border-border text-sm">
        {rooms.map((r, i) => (
          <li key={r.id} className="px-3 py-2">
            <p className="flex items-baseline gap-3">
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
              <span className={cn("min-w-0 flex-1", r.closed && "text-muted-foreground")}>
                {r.name}
                {r.floor && <span className="text-muted-foreground"> · {r.floor}</span>}
              </span>
              {r.closed && <span className="shrink-0 text-xs font-medium">Closed</span>}
            </p>
            {r.about && <p className="ps-6 text-xs text-muted-foreground">{r.about}</p>}
            {r.closed && r.closedNote && <p className="ps-6 text-xs">{r.closedNote}</p>}
            {r.stepFree === false && (
              <p className="ps-6 text-xs font-medium">Not step-free — reached by stairs only.</p>
            )}
          </li>
        ))}
      </ol>
      {noStepFree.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {noStepFree.length} of {rooms.length} rooms cannot be reached without stairs.
        </p>
      )}
    </div>
  );
}
