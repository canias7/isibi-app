import { cn } from "@/lib/utils";
/**
 * The day's plan — with the times that differ per person.
 *
 * NOBODY SHARES ONE CALL TIME. Crew, cast and catering arrive at different
 * hours, and a sheet showing a single "call" is either wrong for most people or
 * makes everybody arrive at the earliest one. Per-department times are the
 * entire point of the document.
 *
 * SUNRISE AND SUNSET ARE FACTS THE DAY IS BUILT ON. An exterior scheduled after
 * last light does not happen, and the times belong at the top rather than in
 * somebody's head.
 *
 * THE NEAREST HOSPITAL IS ON EVERY CALL SHEET, AS A RULE OF THE FORM. It is
 * required on real productions, it is the field most often dropped by a
 * homemade template, and the one day it matters nobody has time to look it up.
 *
 * WEATHER IS SHOWN WITH ITS EFFECT, not as decoration. "Rain from 14:00, the
 * exterior moves to Wednesday" is a decision; an icon is not.
 */
export type DepartmentCall = { id: string; department: string; at: string; note?: string };

export function CallSheet({ production, dayNumber, totalDays, date, location, calls, sunrise, sunset, weatherNote, hospital, unitNote, className }: {
  production?: string;
  dayNumber?: number;
  totalDays?: number;
  /** Free text — "Tuesday 12 August". */
  date?: string;
  location?: string;
  calls: DepartmentCall[];
  sunrise?: string;
  sunset?: string;
  /** With its consequence, not just the forecast. */
  weatherNote?: string;
  /** Name and address of the nearest emergency department. */
  hospital?: string;
  unitNote?: string;
  className?: string;
}) {
  return (
    <div data-slot="call-sheet" className={cn("space-y-1.5 text-sm", className)}>
      <p>
        <span className="font-medium">{production ?? "Call sheet"}</span>
        {dayNumber !== undefined && (
          <span className="text-muted-foreground">
            {" "}· day {dayNumber}{totalDays !== undefined ? ` of ${totalDays}` : ""}
          </span>
        )}
        {date && <span className="block text-xs text-muted-foreground">{date}</span>}
        {location && <span className="block text-xs text-muted-foreground">{location}</span>}
      </p>
      {(sunrise || sunset) && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {sunrise && `Sunrise ${sunrise}`}
          {sunrise && sunset ? " · " : ""}
          {sunset && `last light ${sunset}`}
        </p>
      )}
      {weatherNote && <p className="text-xs">{weatherNote}</p>}
      <ul className="divide-y divide-border rounded-md border border-border">
        {calls.map((c) => (
          <li key={c.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">
              {c.department}
              {c.note && <span className="block text-xs text-muted-foreground">{c.note}</span>}
            </span>
            <span className="shrink-0 tabular-nums">{c.at}</span>
          </li>
        ))}
      </ul>
      {unitNote && <p className="text-xs text-muted-foreground">{unitNote}</p>}
      <p className={cn("text-xs", hospital ? "text-muted-foreground" : "font-medium")}>
        {hospital
          ? `Nearest emergency department: ${hospital}`
          : "No hospital listed. This goes on every call sheet, and the day it matters nobody has time to look it up."}
      </p>
    </div>
  );
}
