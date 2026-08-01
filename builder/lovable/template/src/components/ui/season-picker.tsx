import { useId } from "react";
import { cn } from "@/lib/utils";
/**
 * Switching between seasons — with the current one obvious.
 *
 * A SEASON SPANS TWO CALENDAR YEARS IN MOST SPORTS and is labelled as such.
 * "2026" is ambiguous where the season runs August to May, and picking the
 * wrong one produces a table that looks plausible and is a year out.
 *
 * THE CURRENT SEASON IS MARKED. Somebody landing from a search result on a
 * two-year-old table has no way to tell, and the commonest complaint about any
 * sports site is data that turns out to be historic.
 *
 * AN INCOMPLETE SEASON SAYS SO, because a table halfway through a season is not
 * a final standing, and it gets quoted as one.
 *
 * IT IS A REAL `<select>`. A season list is long, it is used rarely, and a
 * native control is faster and works with a keyboard on the first try.
 */
export type Season = { id: string; label: string; current?: boolean; complete?: boolean };

export function SeasonPicker({ seasons, value, onChange, label = "Season", className }: {
  seasons: Season[];
  value?: string;
  onChange?: (next: string) => void;
  label?: string;
  className?: string;
}) {
  const id = useId();
  const chosen = seasons.find((s) => s.id === value);
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}{s.current ? " — current" : ""}
          </option>
        ))}
      </select>
      {chosen && !chosen.current && (
        <p className="text-xs font-medium">
          You are looking at a past season, not the current one.
        </p>
      )}
      {chosen?.current && chosen.complete === false && (
        <p className="text-xs text-muted-foreground">
          This season is still being played — the table is not final.
        </p>
      )}
    </div>
  );
}
