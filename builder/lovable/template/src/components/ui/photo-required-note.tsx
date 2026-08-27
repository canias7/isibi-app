import { cn } from "@/lib/utils";
/**
 * "One photo of the damage is needed" — a photo requirement, counted.
 *
 * IT COUNTS TOWARDS THE REQUIREMENT AS FILES ARRIVE. "At least 2 photos" that
 * never updates leaves somebody guessing whether the two they added counted, so
 * they add four — or submit with one and are refused at the end.
 *
 * IT SAYS WHAT THE PHOTOS ARE FOR. "Upload photos" gets a picture of the whole
 * car; "a close-up of the damage and one showing the whole panel" gets the two
 * that are actually useful, which saves a round trip that costs days.
 *
 * MET IS STATED, not silently rendered as nothing. Disappearing on completion
 * removes the confirmation at the moment somebody wants it, and makes them
 * wonder whether the requirement was ever real.
 *
 * `role="status"` so the count is announced as files are added — this is the
 * kind of running total a screen reader user otherwise has no access to.
 */
export function PhotoRequiredNote({ have, need, of, examples = [], className }: {
  have: number;
  need: number;
  /** What of — "the damage". */
  of?: string;
  /** What each photo should show. */
  examples?: string[];
  className?: string;
}) {
  const met = have >= need;
  const left = Math.max(0, need - have);
  return (
    <div data-slot="photo-required-note" role="status" className={cn("space-y-0.5 text-sm", className)}>
      <p className={cn(!met && "font-medium")}>
        {met
          ? <>Enough photos — <span className="tabular-nums font-normal">{have}</span> added</>
          : <>
              <span className="tabular-nums">{left}</span> more {left === 1 ? "photo" : "photos"} needed
              {of ? ` of ${of}` : ""}
              <span className="font-normal text-muted-foreground"> · {have} of {need}</span>
            </>}
      </p>
      {!met && examples.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {examples.map((e) => (
            <li key={e} className="flex gap-2"><span aria-hidden="true">·</span><span>{e}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
