import { cn } from "@/lib/utils";
/**
 * A suggestion to move a line somewhere better — with what it saves.
 *
 * THE SAVING IS STATED IN TIME OR DISTANCE, because a slotting change costs a
 * physical move and nobody agrees to that for "it would be better". "Saves
 * about 90 minutes of walking a week" is an argument.
 *
 * THE REASON IS SHOWN AND IS USUALLY VELOCITY. A line picked forty times a day
 * sitting at the far end of the last aisle is the whole of slotting, and the
 * pick frequency is what makes the suggestion checkable rather than magic.
 *
 * THE MOVE'S OWN COST IS ACKNOWLEDGED. Relocating a fast line means both bins
 * are wrong for the duration and every open pick list points at the old one —
 * so the component says when it is safe to do it rather than pretending the
 * change is free.
 *
 * IT IS A SUGGESTION AND SAYS SO. Slotting engines are confidently wrong about
 * anything seasonal, and a note phrased as an instruction gets actioned in
 * November for a line that sells in December.
 */
export function SlottingNote({ item, currentLocation, suggestedLocation, picksPerWeek, savingNote, doWhen, className }: {
  item: string;
  currentLocation: string;
  suggestedLocation: string;
  /** What makes it worth moving. */
  picksPerWeek?: number;
  /** Pre-formatted — "about 90 minutes of walking a week". */
  savingNote?: string;
  /** Free text — "between shifts, when no pick lists are open". */
  doWhen?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{item}</span>
        <span className="block text-xs">
          <span className="font-mono">{currentLocation}</span>
          <span className="text-muted-foreground"> → </span>
          <span className="font-mono">{suggestedLocation}</span>
        </span>
      </p>
      {picksPerWeek !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Picked {picksPerWeek} times a week from its current bin.
        </p>
      )}
      {savingNote && <p className="text-xs font-medium">Would save {savingNote}.</p>}
      {doWhen && <p className="text-xs text-muted-foreground">Move it {doWhen}.</p>}
      <p className="text-xs text-muted-foreground">
        A suggestion, not a job — check it against what sells next month.
      </p>
    </div>
  );
}
