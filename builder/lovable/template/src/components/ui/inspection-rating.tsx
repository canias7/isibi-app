import { cn } from "@/lib/utils";
/**
 * A regulator's rating, the DATE it was given, and a link to the report.
 *
 * A RATING WITH NO DATE IS A RATING FROM ANY YEAR AT ALL, which is why `when`
 * is required rather than optional. "CQC — Good" on a care home's homepage is
 * the single most load-bearing claim on the site, and the version families
 * actually need to evaluate it is "Good, inspected March 2024" — a four-year-old
 * Good and last month's Good are different facts, and only one of them is being
 * offered when the date is left off.
 *
 * `reportUrl` IS THE POINT, not a courtesy. Every one of these ratings is
 * published, in full, by the regulator; a provider linking straight to it is
 * saying it expects to be read. Same discipline as the registration number on
 * `practitioner-card`.
 *
 * NOT COLOUR-CODED. CQC's own four ratings run green to red and reproducing
 * that would make Outstanding and Good one shade in greyscale, and Requires
 * improvement and Inadequate another. The rating is a WORD at weight, which is
 * how it is written in the report.
 *
 * A POOR RATING RENDERS EXACTLY LIKE A GOOD ONE, deliberately. A component that
 * quietly styled Inadequate smaller would be a component for hiding it, and any
 * provider willing to publish the bad one has earned the same layout. `note` is
 * where "we were re-inspected in June and are awaiting the report" belongs.
 *
 * DOMAINS ARE THE SUB-RATINGS — safe, effective, caring, responsive, well-led.
 * A home rated Good overall and Requires improvement on safe is a real and
 * common shape, and the overall word alone conceals it.
 */
export function InspectionRating({
  body, rating, when, reportUrl, domains, note, className,
}: {
  /** The regulator: "CQC", "Ofsted", "Food Standards Agency". */
  body: string;
  /** Their word for it: "Good", "Outstanding", "Requires improvement", "5". */
  rating: string;
  /** REQUIRED. When it was given: "March 2024". A rating with no date is any year at all. */
  when: string;
  /** Where the full report is. Published by the regulator; link it. */
  reportUrl?: string | null;
  /** The sub-ratings, where the regulator gives them. */
  domains?: { name: string; rating: string }[];
  note?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border p-5", className)}>
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{body}</p>
      {/* THE WORD, at size. Not a colour, not a badge — the regulator writes it
          as a word and greyscale is where a four-colour scale collapses. */}
      <p className="mt-1 text-2xl font-semibold tracking-tight">{rating}</p>
      <p className="mt-1 text-sm text-muted-foreground">Inspected {when}</p>

      {domains && domains.length > 0 && (
        <dl className="mt-4 divide-y divide-border border-y border-border text-sm">
          {domains.map((d) => (
            <div key={d.name} className="flex items-baseline justify-between gap-3 py-2">
              <dt className="text-muted-foreground">{d.name}</dt>
              <dd className="font-medium">{d.rating}</dd>
            </div>
          ))}
        </dl>
      )}

      {note && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{note}</p>}

      {reportUrl && (
        <p className="mt-3 text-sm">
          <a href={reportUrl} className="font-medium underline underline-offset-4">Read the full report</a>
          <span className="text-muted-foreground"> — published by {body}</span>
        </p>
      )}
    </div>
  );
}
