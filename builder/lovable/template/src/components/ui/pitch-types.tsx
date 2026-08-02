import { cn } from "@/lib/utils";
/**
 * A pitch, described by what it PHYSICALLY takes.
 *
 * A FAMILY IN A 7.5-METRE MOTORHOME IS ASKING ONE QUESTION, and every campsite
 * site in the country answers "we are in a lovely valley". Whether the vehicle
 * fits, whether there is electric, and whether the ground is grass in February
 * decide the booking; the photograph decides nothing, because they all look the
 * same and none of them are of the pitch you get.
 *
 * `maxLength` IS THE FIELD THAT MATTERS and it is stated in metres as a NUMBER
 * rather than as "suitable for large units". Large is a judgement; 8 metres is
 * a fact somebody can measure their van against, and getting it wrong means
 * arriving, not fitting, and having nowhere to go at six in the evening.
 *
 * WHAT IT TAKES IS A LIST, NOT A SENTENCE. A pitch that takes a tent and a
 * campervan but not a caravan is extremely common — the towing turn is too
 * tight — and prose hides that behind a comma. Naming each unit type makes the
 * absence of one visible, which is the whole point.
 *
 * HOOKUP AND HARDSTANDING ARE SAID EITHER WAY, never left off when absent. An
 * omitted amenity reads as an oversight and gets assumed present; "no electric"
 * printed is a decision the reader can make from their armchair. Same rule as
 * `amenity-list` showing what is out of order rather than removing it.
 *
 * NO COLOUR CARRIES ANYTHING. Fits and does-not-fit are a word and a weight,
 * because this is read on a phone in a lay-by in daylight.
 */
export type Pitch = {
  name: string;
  /** Per night, for the pitch. Say what a pitch includes in `note`. */
  price: number;
  /** "10m × 8m". Free text — sites measure inconsistently and pretending otherwise is worse. */
  size?: string | null;
  /** Longest unit that fits, in metres. A NUMBER, because "large" is not one. */
  maxLength?: number | null;
  /** Which of tent / campervan / caravan / motorhome it takes. Absence is information. */
  takes?: string[];
  electric?: boolean;
  hardstanding?: boolean;
  /** How many are of this type, when it is worth knowing they are scarce. */
  count?: number | null;
  note?: string | null;
};
export function PitchTypes({
  pitches, currency = "GBP", locale = "en-GB", heading = "The pitches", note, className,
}: {
  pitches: Pitch[];
  currency?: string;
  locale?: string;
  heading?: string;
  note?: string;
  className?: string;
}) {
  if (!pitches.length) return null;
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  return (
    <div className={cn("", className)}>
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</h2>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {pitches.map((p) => (
          <li key={p.name} className="py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-base font-medium">{p.name}</span>
              <span className="text-base font-semibold tabular-nums">{money(p.price)}<span className="text-sm font-normal text-muted-foreground"> a night</span></span>
            </div>
            {/* THE MEASUREMENTS, at weight, before anything descriptive. */}
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {p.size && (
                <div className="flex gap-1.5"><dt className="text-muted-foreground">Size</dt><dd className="font-medium tabular-nums">{p.size}</dd></div>
              )}
              {typeof p.maxLength === "number" && (
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">Fits up to</dt>
                  <dd className="font-medium tabular-nums">{p.maxLength}m</dd>
                </div>
              )}
              {typeof p.count === "number" && (
                <div className="flex gap-1.5"><dt className="text-muted-foreground">How many</dt><dd className="font-medium tabular-nums">{p.count}</dd></div>
              )}
              {/* SAID EITHER WAY. An omitted amenity gets assumed present, and
                  somebody arrives with a hookup lead and nowhere to put it. */}
              {p.electric !== undefined && (
                <div className="flex gap-1.5">
                  <dt className="sr-only">Electric hookup</dt>
                  <dd className={cn(p.electric ? "font-medium" : "text-muted-foreground")}>
                    {p.electric ? "Electric hookup" : "No electric"}
                  </dd>
                </div>
              )}
              {p.hardstanding !== undefined && (
                <div className="flex gap-1.5">
                  <dt className="sr-only">Ground</dt>
                  <dd className={cn(p.hardstanding ? "font-medium" : "text-muted-foreground")}>
                    {p.hardstanding ? "Hardstanding" : "Grass"}
                  </dd>
                </div>
              )}
            </dl>
            {p.takes && p.takes.length > 0 && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Takes {p.takes.join(", ")}
              </p>
            )}
            {p.note && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.note}</p>}
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
