import { cn } from "@/lib/utils";
/**
 * A day's material arriving — with whether it is safe yet.
 *
 * BACKED UP TWICE IS THE ONLY SAFE STATE, and it is what this reports. Footage
 * on one drive is footage one drop from gone, and the window between the card
 * being offloaded and the second copy existing is where whole days are lost.
 *
 * A CARD IS NOT WIPED UNTIL BOTH COPIES VERIFY. The component shows the card
 * status separately for that reason: reformatting early is the single most
 * expensive mistake anybody makes on set, and it is always made under time
 * pressure.
 *
 * CHECKSUM-VERIFIED IS DIFFERENT FROM COPIED. A copy that completed is not a
 * copy that matches, and file-count comparisons miss silent corruption — which
 * is the failure that shows up in the grade months later.
 *
 * SOUND IS TRACKED SEPARATELY FROM PICTURE. They come from different recorders
 * on different cards, and a day is only complete when both have landed.
 */
export function DailiesRow({ day, date, clips, sizeGb, copies = 0, verified, soundReceived, cardWiped, note, className }: {
  day?: string | number;
  date?: string;
  clips?: number;
  sizeGb?: number;
  /** How many independent copies exist. */
  copies?: number;
  /** True where the copies have been checksum-verified, not just written. */
  verified?: boolean;
  soundReceived?: boolean;
  /** True where the camera card has been reformatted. */
  cardWiped?: boolean;
  note?: string;
  className?: string;
}) {
  const safe = copies >= 2 && verified === true;
  const wipedEarly = cardWiped && !safe;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {day !== undefined ? `Day ${day}` : "Dailies"}
          {date && <span className="text-muted-foreground"> · {date}</span>}
        </span>
        <span className={cn("shrink-0 text-xs", safe ? "text-muted-foreground" : "font-medium")}>
          {safe ? "Safe" : "Not safe yet"}
        </span>
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {clips !== undefined && `${clips} clips`}
        {clips !== undefined && sizeGb !== undefined ? " · " : ""}
        {sizeGb !== undefined && `${sizeGb} GB`}
        {` · ${copies} ${copies === 1 ? "copy" : "copies"}`}
      </p>
      <p className={cn("text-xs", verified ? "text-muted-foreground" : "font-medium")}>
        {verified
          ? "Copies checksum-verified."
          : "Copies written but not verified — a completed copy is not a matching copy."}
      </p>
      {soundReceived === false && <p className="text-xs font-medium">Sound has not arrived for this day.</p>}
      {wipedEarly && (
        <p className="text-xs font-medium">
          The card has been wiped and this material is not yet safe. Stop and check the copies now.
        </p>
      )}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </li>
  );
}
