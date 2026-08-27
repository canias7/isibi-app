import { cn } from "@/lib/utils";
/**
 * One person triaged — with the time of the assessment attached.
 *
 * A TRIAGE CATEGORY IS A SNAPSHOT AND GOES STALE, and the age of the assessment
 * is shown beside it always. Somebody categorised as walking wounded forty
 * minutes ago may not be now, and a list that shows the category without the
 * clock invites treating an old assessment as a current one.
 *
 * THE CATEGORY IS SHOWN AS A WORD, NOT A COLOUR. Triage systems are traditionally
 * colour-coded and the colour is exactly what fails under a head torch, in
 * smoke, and for the substantial number of responders who cannot distinguish red
 * from green.
 *
 * DETERIORATION IS ITS OWN FLAG. Somebody who has moved down a category is a
 * different priority from somebody who arrived at that category, and only the
 * change carries that.
 *
 * NO NAMES REQUIRED. Early triage happens before anybody knows who people are,
 * and a form demanding a name gets filled in with nonsense or not at all.
 */
export function TriageRow({ reference, category, assessedMinutesAgo, deterioratedFrom, whereAt, note, className }: {
  /** A tag number, not a name. Names come later. */
  reference: string;
  /** A word, deliberately. Colour fails under a head torch. */
  category: "immediate" | "urgent" | "delayed" | "walking" | "deceased";
  /** A triage category goes stale. */
  assessedMinutesAgo?: number;
  deterioratedFrom?: string;
  whereAt?: string;
  note?: string;
  className?: string;
}) {
  const urgent = category === "immediate" || category === "urgent";
  const stale = assessedMinutesAgo !== undefined && assessedMinutesAgo >= 20;
  return (
    <li data-slot="triage-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 tabular-nums">{reference}</span>
        <span className={cn("shrink-0", urgent ? "font-medium" : "text-muted-foreground")}>
          {category.charAt(0).toUpperCase() + category.slice(1)}
        </span>
      </p>
      {assessedMinutesAgo !== undefined && (
        <p className={cn("text-xs tabular-nums", stale ? "font-medium" : "text-muted-foreground")}>
          Assessed {assessedMinutesAgo} {assessedMinutesAgo === 1 ? "minute" : "minutes"} ago
          {stale ? " — old enough to need looking at again." : "."}
        </p>
      )}
      {deterioratedFrom && (
        <p className="text-xs font-medium">
          Was {deterioratedFrom}. Getting worse, which is not the same as arriving here.
        </p>
      )}
      <p className="text-xs text-muted-foreground">{[whereAt, note].filter(Boolean).join(" · ")}</p>
    </li>
  );
}
