import { cn } from "@/lib/utils";
/**
 * A date on food — with the two kinds kept apart, because one is safety.
 *
 * A USE-BY DATE IS ABOUT SAFETY AND A BEST-BEFORE IS ABOUT QUALITY. Food past
 * its best-before is usually perfectly fine; food past its use-by can make
 * somebody seriously ill. Rendering both as "expires" is the single most
 * consequential conflation in food handling, and it drives an enormous amount of
 * waste in the harmless direction and real risk in the other.
 *
 * THE ADVICE DIFFERS ACCORDINGLY. Past best-before it says to look at it; past
 * use-by it says not to, because judging by smell is exactly what does not work
 * for the organisms a use-by date exists for.
 *
 * ONCE OPENED, THE DATE ON THE PACKET IS USUALLY WRONG. A separate
 * after-opening life is the number that governs, and it is on the packet in
 * small type where nobody reads it.
 *
 * NO TRAFFIC LIGHTS. Colour alone cannot carry a safety distinction, and this is
 * the one place where getting the distinction across matters most.
 */
export function BestBefore({ kind, date, daysLeft, openedOn, daysAfterOpening, className }: {
  /** Not the same thing at all. */
  kind: "use by" | "best before";
  date: string;
  /** Negative means past it. */
  daysLeft?: number;
  openedOn?: string;
  /** Once opened this governs, not the packet date. */
  daysAfterOpening?: number;
  className?: string;
}) {
  const past = daysLeft !== undefined && daysLeft < 0;
  const safety = kind === "use by";
  return (
    <div data-slot="best-before" className={cn("space-y-0.5 text-sm", className)}>
      <p className={cn("tabular-nums", past && safety ? "font-medium" : "")}>
        <span className="font-medium">
          {kind === "use by" ? "Use by" : "Best before"} {date}
        </span>
        {daysLeft !== undefined && (
          <span className="text-muted-foreground">
            {" "}
            ·{" "}
            {past
              ? `${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? "day" : "days"} ago`
              : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
          </span>
        )}
      </p>
      <p className={cn("text-xs", safety ? "font-medium" : "text-muted-foreground")}>
        {safety
          ? past
            ? "Past a use-by date. Do not eat it and do not judge it by smell — the things this date exists for do not smell of anything."
            : "A use-by date is about safety, not quality."
          : past
            ? "Past a best-before date, which is about quality rather than safety. Look at it, smell it, and decide."
            : "A best-before date is about quality. Food is usually fine after it."}
      </p>
      {openedOn && daysAfterOpening !== undefined && (
        <p className="text-xs tabular-nums">
          Opened {openedOn} — once open it keeps {daysAfterOpening}{" "}
          {daysAfterOpening === 1 ? "day" : "days"}, and that governs rather than the date on the packet.
        </p>
      )}
    </div>
  );
}
