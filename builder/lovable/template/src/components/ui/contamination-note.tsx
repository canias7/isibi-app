import { cn } from "@/lib/utils";
/**
 * Why a bin was not emptied — and what to do before next time.
 *
 * IT NAMES THE ITEM. "Contaminated" on a sticker is the standard notice and
 * teaches nothing; "a nappy in the recycling" is a specific fact somebody can
 * act on, and it is the difference between a repeat and a fix.
 *
 * THE CONSEQUENCE IS PROPORTIONATE AND STATED. One wrong item and a bin used
 * for the wrong purpose entirely are different, and treating them alike makes
 * people ignore the notice — which is what most contamination stickers achieve.
 *
 * IT SAYS WHETHER TO WAIT OR TO ACT. Whether the bin will be returned for, or
 * has to wait a fortnight, or should be taken to a tip, is the only practical
 * question and is almost never on the notice.
 *
 * NO PHOTOGRAPH OF SOMEBODY'S BIN. Photographing a household's waste as
 * evidence is a surveillance practice out of all proportion to a wrong yoghurt
 * pot.
 */
export function ContaminationNote({ bin, item, severity = "minor", whatNow, willReturn, returnOn, repeatCount, className }: {
  bin?: string;
  /** The specific thing found. */
  item?: string;
  severity?: "minor" | "load-spoiling";
  /** What the householder should do. */
  whatNow?: string;
  /** True where a crew comes back. */
  willReturn?: boolean;
  returnOn?: string;
  /** How many times this has happened. */
  repeatCount?: number;
  className?: string;
}) {
  return (
    <div data-slot="contamination-note" className={cn("space-y-0.5 text-sm", className)}>
      <p className="font-medium">
        {bin ? `Your ${bin} was not emptied` : "This bin was not emptied"}
      </p>
      <p className="text-xs">
        {item
          ? `We found ${item} in it.`
          : "Nothing specific was recorded, which makes this notice hard to act on."}
      </p>
      {severity === "load-spoiling" && (
        <p className="text-xs font-medium">
          One item like this spoils an entire lorry load, which then goes to incineration rather than recycling.
        </p>
      )}
      <p className="text-xs">
        {whatNow ??
          (willReturn
            ? "Take the item out and leave the bin where it is."
            : "Take the item out and put the bin out again on your next collection day.")}
      </p>
      {willReturn && (
        <p className="text-xs text-muted-foreground">
          {returnOn ? `A crew will come back on ${returnOn}.` : "A crew will come back for it."}
        </p>
      )}
      {repeatCount !== undefined && repeatCount > 1 && (
        <p className="text-xs text-muted-foreground tabular-nums">
          This has happened {repeatCount} times. If something here is unclear, tell us — it is usually the notice, not the person.
        </p>
      )}
    </div>
  );
}
