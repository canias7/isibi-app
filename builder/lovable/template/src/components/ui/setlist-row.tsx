import { cn } from "@/lib/utils";
/**
 * A song in a set — with the running total, which is the reason a set fails.
 *
 * THE CUMULATIVE TIME IS THE OUTPUT. Bands overrun because a set is planned as
 * a list of songs and played against a clock, and knowing you are at 41 minutes
 * of a 45-minute slot at song nine is the only useful thing this can tell you.
 *
 * GAPS BETWEEN SONGS ARE COUNTED. Tuning, talking and a guitar change are
 * several minutes across a set, and a running total of song durations alone is
 * reliably five minutes optimistic — which is exactly the amount that gets a
 * band cut off.
 *
 * KEY AND TUNING TRAVEL WITH THE SONG. A drop-tuned song in the middle of a set
 * needs either a second guitar or a pause, and that is a set-order decision
 * rather than a performance one.
 *
 * A CUT SONG STAYS IN THE LIST, struck through. Sets are cut live, and the
 * band needs to see what went rather than a renumbered list nobody recognises.
 */
export function SetlistRow({ position, title, seconds, gapSeconds = 0, cumulativeSeconds, slotSeconds, musicalKey, tuning, cut, note, className }: {
  position?: number;
  title: string;
  seconds?: number;
  /** Talking, tuning, changing instrument. */
  gapSeconds?: number;
  /** Total elapsed by the end of this song. */
  cumulativeSeconds?: number;
  /** The whole slot, for the overrun warning. */
  slotSeconds?: number;
  /** NOT named `key`: React reserves that prop and strips it, so the value
   *  would never reach this component. */
  musicalKey?: string;
  /** "Drop D". */
  tuning?: string;
  cut?: boolean;
  note?: string;
  className?: string;
}) {
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  const over = cumulativeSeconds !== undefined && slotSeconds !== undefined && cumulativeSeconds > slotSeconds;
  return (
    <li className={cn("space-y-0.5 px-3 py-1.5 text-sm", className)}>
      <p className="flex items-baseline gap-3">
        {position !== undefined && <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{position}</span>}
        <span className={cn("min-w-0 flex-1", cut && "text-muted-foreground line-through")}>
          {title}
          {(musicalKey || tuning) && (
            <span className="text-xs text-muted-foreground"> · {[musicalKey, tuning].filter(Boolean).join(", ")}</span>
          )}
        </span>
        {/* BOTH slots are always reserved. Rendered conditionally, a row with a
            duration and no running total pushes the duration into the
            cumulative column, where it reads as a running total — which is
            exactly what a cut song produces. */}
        <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">
          {seconds !== undefined ? fmt(seconds) : ""}
        </span>
        <span className={cn("w-14 shrink-0 text-right tabular-nums", over ? "font-medium" : "text-muted-foreground")}>
          {cumulativeSeconds !== undefined ? fmt(cumulativeSeconds) : ""}
        </span>
      </p>
      {gapSeconds > 0 && !cut && (
        <p className="pl-9 text-xs tabular-nums text-muted-foreground">
          plus {gapSeconds}s to get into the next one
        </p>
      )}
      {note && <p className="pl-9 text-xs">{note}</p>}
      {over && slotSeconds !== undefined && cumulativeSeconds !== undefined && (
        <p className="pl-9 text-xs font-medium tabular-nums">
          {fmt(cumulativeSeconds - slotSeconds)} over the slot by here.
        </p>
      )}
    </li>
  );
}
