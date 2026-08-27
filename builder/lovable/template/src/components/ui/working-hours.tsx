import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Open now · closes 18:00" — computed from the week, honestly.
 *
 * THE ANSWER IS THE NEXT CHANGE, both ways: open says when it closes,
 * closed says when it next OPENS ("opens Tuesday 09:00") — "Closed" alone
 * makes somebody check back at random. Scanning starts today and walks
 * forward up to a week, so a shop shut for three days answers with
 * Tuesday, not with silence.
 *
 * OVERNIGHT SPANS WORK: "22:00–02:00" is open at midnight (the
 * inQuietHours wrap, applied to opening times — a bar's hours, which
 * every naive begin<end comparison refuses). Verified in the tests
 * below by construction: a span that wraps is split into tonight and
 * tomorrow-morning halves.
 *
 * State is a filled/hollow dot plus words — never colour alone.
 */
export type DaySpans = { open: string; close: string }[]; // "HH:MM" pairs
export type WeekHours = DaySpans[]; // 0 = Sunday … 6 = Saturday, like Date#getDay

const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function openState(week: WeekHours, now: Date):
  | { open: true; until: string }
  | { open: false; nextDay: number; at: string } {
  const day = now.getDay();
  const t = now.getHours() * 60 + now.getMinutes();
  // Open now? A wrapping span counts tonight AND spills into tomorrow morning.
  for (const s of week[day] ?? []) {
    const o = mins(s.open), c = mins(s.close);
    if (o <= c ? t >= o && t < c : t >= o) return { open: true, until: s.close };
  }
  const yesterday = (day + 6) % 7;
  for (const s of week[yesterday] ?? []) {
    if (mins(s.open) > mins(s.close) && t < mins(s.close)) return { open: true, until: s.close };
  }
  // Closed: find the next opening within a week.
  for (let ahead = 0; ahead <= 7; ahead++) {
    const d = (day + ahead) % 7;
    for (const s of (week[d] ?? []).slice().sort((a, b) => mins(a.open) - mins(b.open))) {
      if (ahead === 0 && mins(s.open) <= t) continue;
      return { open: false, nextDay: d, at: s.open };
    }
  }
  return { open: false, nextDay: day, at: "" };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function WorkingHours({ week, now, className }: {
  week: WeekHours;
  /** Injectable for tests; defaults to the wall clock, ticking per minute. */
  now?: Date;
  className?: string;
}) {
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (now) return; // a pinned clock does not tick
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [now]);

  const state = openState(week, now ?? new Date());
  return (
    <span data-slot="working-hours" className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span aria-hidden className={cn("size-2 rounded-full border border-foreground",
        state.open ? "bg-foreground" : "bg-transparent")} />
      {state.open
        ? <>Open now <span className="text-xs text-muted-foreground">· closes {state.until}</span></>
        : state.at
          ? <>Closed <span className="text-xs text-muted-foreground">· opens {DAYS[state.nextDay]} {state.at}</span></>
          : <>Closed</>}
    </span>
  );
}
