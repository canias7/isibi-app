import { cn } from "@/lib/utils";
/**
 * A notice affecting a route — written out rather than left in code.
 *
 * THE PLAIN-ENGLISH LINE COMES FIRST AND THE RAW TEXT IS KEPT BELOW. These
 * notices are published in an abbreviated form that is genuinely hard to read at
 * speed, briefings are long, and the item that matters gets skimmed. The raw
 * text stays because it is the authoritative version and a paraphrase is not.
 *
 * THE ACTIVE PERIOD IS CHECKED AGAINST THE PLANNED TIME. A notice that expires
 * before you get there is noise, and one that begins mid-flight is the one
 * everybody misses. The caller supplies the comparison; the component states it.
 *
 * IT DOES NOT RANK BY IMPORTANCE. Relevance depends on the aircraft, the route
 * and the plan, and a component deciding what is critical would hide the item
 * that mattered to this particular flight.
 *
 * TIMES ARE UTC AND SAY SO. Everything in this domain is, briefings are read in
 * local time, and the mismatch is a whole class of error.
 */
export function NotamNote({ identifier, location, plainEnglish, rawText, fromUtc, toUtc, activeAtPlannedTime, permanent, className }: {
  identifier?: string;
  /** The aerodrome or airspace it affects. */
  location?: string;
  /** The one-line version. */
  plainEnglish: string;
  /** The authoritative published text. */
  rawText?: string;
  fromUtc?: string;
  toUtc?: string;
  /** Whether it bites during the planned operation. */
  activeAtPlannedTime?: boolean;
  permanent?: boolean;
  className?: string;
}) {
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("min-w-0 flex-1", activeAtPlannedTime && "font-medium")}>{plainEnglish}</span>
        {location && <span className="shrink-0 font-mono text-xs text-muted-foreground">{location}</span>}
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {permanent
          ? "Permanent"
          : [fromUtc && `from ${fromUtc}`, toUtc && `to ${toUtc}`].filter(Boolean).join(" ")}
        {!permanent && " UTC"}
        {identifier && ` · ${identifier}`}
      </p>
      {activeAtPlannedTime === true && (
        <p className="text-xs font-medium">Active during your planned operation.</p>
      )}
      {activeAtPlannedTime === false && (
        <p className="text-xs text-muted-foreground">Not active when you will be there.</p>
      )}
      {rawText && (
        <details className="text-xs">
          <summary className="cursor-pointer underline underline-offset-2">As published</summary>
          <p className="whitespace-pre-wrap pt-1 font-mono text-muted-foreground">{rawText}</p>
        </details>
      )}
    </li>
  );
}
