import { cn } from "@/lib/utils";
/**
 * An exhibition in a list — running, ending soon, or already closed.
 *
 * "ENDING SOON" IS THE ONLY URGENCY THAT MATTERS and it is computed from the
 * closing date rather than set by a marketing flag. A what's-on list where
 * everything is flagged as unmissable tells a visitor nothing about what they
 * will miss.
 *
 * A CLOSED EXHIBITION STAYS LISTED, marked closed. People arrive from search
 * results and old links, and a page that simply 404s or silently omits it
 * leaves them assuming the museum is shut.
 *
 * TICKETED AND FREE IS THE FIRST PRACTICAL QUESTION and appears in the row.
 * Most museums run both at once, and a visitor planning a day needs it before
 * anything else.
 *
 * ADVANCE BOOKING BEING REQUIRED IS DIFFERENT FROM IT BEING PAID, and both are
 * shown — the free-but-must-book exhibition is where people are turned away at
 * the door.
 */
export function ExhibitionRow({ title, gallery, opensOn, closesOn, daysLeft, closed, free, price, mustBook, className }: {
  title: string;
  gallery?: string;
  /** Free text — "14 July". */
  opensOn?: string;
  closesOn?: string;
  /** Days until it closes, where the caller has computed it. */
  daysLeft?: number;
  closed?: boolean;
  free?: boolean;
  /** Pre-formatted — "£16, under 16s free". */
  price?: string;
  mustBook?: boolean;
  className?: string;
}) {
  const soon = !closed && daysLeft !== undefined && daysLeft <= 14 && daysLeft >= 0;
  return (
    <li data-slot="exhibition-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("min-w-0 flex-1", closed && "text-muted-foreground")}>
          {title}
          {gallery && <span className="block text-xs text-muted-foreground">{gallery}</span>}
        </span>
        <span className={cn("shrink-0 text-xs", soon ? "font-medium" : "text-muted-foreground")}>
          {closed
            ? "Closed"
            : soon
              ? daysLeft === 0 ? "Last day" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`
              : closesOn ? `Until ${closesOn}` : "Now on"}
        </span>
      </p>
      {opensOn && !closed && <p className="text-xs text-muted-foreground">Opens {opensOn}</p>}
      <p className="text-xs text-muted-foreground">
        {free ? "Free" : price ?? "Ticketed"}
        {mustBook && " · book in advance, including free tickets"}
      </p>
    </li>
  );
}
