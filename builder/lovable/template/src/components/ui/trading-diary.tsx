import { cn } from "@/lib/utils";

/**
 * Where a mobile business will actually be, by day.
 *
 * TODAY IS MARKED AND IT IS THE POINT. A van, a stall or a mobile clinic has
 * one perishable fact and it is where it is right now; a seven-row week where
 * the reader has to work out which row is today has answered a question nobody
 * asked. `todayIndex` is a required prop rather than a computed one, because a
 * component cannot know the site's timezone and a wrong "today" is worse than
 * none — it sends somebody to the wrong town.
 *
 * A CANCELLED PITCH STAYS ON THE LIST, struck through and labelled. Removing
 * it produces a diary that looks correct and quietly loses the one row a
 * regular customer needed to see, and they find out by driving there. This is
 * the same argument as the unavailable row in `service-availability`, and it
 * is wrong for the same reason both times.
 *
 * `note` carries what a map cannot: which end of the market, what to do if it
 * rains, when the pitch actually sells out. Colour is not used at all — today
 * is carried by weight and a written word, so it survives print, greyscale and
 * a reader who cannot see the difference.
 */
export type Pitch = {
  /** "Saturday 9 August" — free text, because a mobile trader's diary is read, not parsed. */
  day: string;
  /** Where. "Kelham Island Market". */
  place: string;
  /** "11:00 – 16:00". Omit where the stop is genuinely all day. */
  hours?: string | null;
  note?: string | null;
  cancelled?: boolean;
};

export function TradingDiary({ pitches, todayIndex, className }: {
  pitches: Pitch[];
  /**
   * Which entry is today. -1 for none — a diary published on a day the van is
   * not out is an ordinary state, not a missing value.
   */
  todayIndex: number;
  className?: string;
}) {
  if (!pitches.length) return null;
  return (
    <ul className={cn("divide-y divide-border border-y border-border", className)}>
      {pitches.map((p, i) => {
        const today = i === todayIndex;
        return (
          <li key={`${p.day}-${p.place}`} className={cn("py-4", today && "bg-muted/40 px-4")}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {/* Weight and a word, never a colour. */}
              {today && (
                <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-background">
                  Today
                </span>
              )}
              <span className={cn("text-sm", today ? "font-semibold" : "text-muted-foreground")}>{p.day}</span>
              <span className={cn("font-medium", p.cancelled && "line-through decoration-1")}>{p.place}</span>
              {p.hours && <span className="text-sm tabular-nums text-muted-foreground">{p.hours}</span>}
              {p.cancelled && <span className="text-sm font-medium">Not trading</span>}
            </div>
            {p.note && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{p.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}
