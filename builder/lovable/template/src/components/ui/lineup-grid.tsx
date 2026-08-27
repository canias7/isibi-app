import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Acts by day and stage. The thing a festival page is FOR.
 *
 * CLASHES ARE THE WHOLE JOB. Anybody reading a lineup is deciding what to miss,
 * and a list that hides overlaps makes that decision impossible — so an act
 * whose slot overlaps another on a different stage is marked, and the count is
 * stated in words above the grid. Marked by an outline and the word "clash",
 * never by colour: two reds on a phone in daylight are one red.
 *
 * ONE DAY AT A TIME. A three-day grid at full width is unreadable on a phone
 * and unhelpful on a laptop — nobody plans two days at once. The day switcher
 * is links-shaped state, not a tablist, so it reads as navigation.
 *
 * Times are compared as MINUTES parsed once, because "09:30" < "10:00" is true
 * as strings and "9:30" < "10:00" is false, and a lineup written by hand
 * contains both.
 */
export type Act = { name: string; stage: string; start: string; end: string; billing?: "headline" | "main" | "support" };
const mins = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
/** Overlap is strict: an act ending exactly when the next starts is not a clash. */
function clashing(acts: Act[]) {
  const out = new Set<number>();
  acts.forEach((a, i) => acts.forEach((b, j) => {
    if (i >= j || a.stage === b.stage) return;
    const [as, ae, bs, be] = [mins(a.start), mins(a.end), mins(b.start), mins(b.end)];
    if ([as, ae, bs, be].some(Number.isNaN)) return;
    if (as < be && bs < ae) { out.add(i); out.add(j); }
  }));
  return out;
}
export function LineupGrid({ days, className }: {
  days: { day: string; acts: Act[] }[];
  className?: string;
}) {
  const [active, setActive] = React.useState(0);
  if (!days.length) return null;
  const day = days[Math.min(active, days.length - 1)];
  const acts = [...(day.acts ?? [])].sort((a, b) => (mins(a.start) || 0) - (mins(b.start) || 0));
  const clashes = clashing(acts);
  const stages = [...new Set(acts.map((a) => a.stage))];
  return (
    <div data-slot="lineup-grid" className={cn("", className)}>
      {days.length > 1 && (
        <nav aria-label="Which day" className="flex flex-wrap gap-2">
          {days.map((d, i) => (
            <button
              key={d.day} type="button" onClick={() => setActive(i)}
              aria-current={i === active ? "true" : undefined}
              className={cn("rounded-md border px-3 py-1.5 text-sm",
                i === active ? "border-foreground bg-foreground font-medium text-background" : "border-border")}
            >
              {d.day}
            </button>
          ))}
        </nav>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        {stages.length} stage{stages.length === 1 ? "" : "s"} · {acts.length} act{acts.length === 1 ? "" : "s"}
        {/* ACTS, not clashes. The set holds every act involved in an overlap,
            so two overlapping pairs is four entries — calling that "4 clashes"
            doubles the number a reader is being warned about. Caught on a
            render, where "3 stages · 5 acts · 4 clashes" read as nonsense. */}
        {clashes.size > 0 && <> · <span className="font-medium text-foreground">{clashes.size} of them clash</span> — you cannot see everything</>}
      </p>
      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map((stage) => (
          <div key={stage}>
            <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">{stage}</h3>
            <ul className="mt-2 divide-y divide-border border-y border-border">
              {acts.map((a, i) => a.stage !== stage ? null : (
                <li key={`${a.name}-${i}`} className="flex items-baseline gap-3 py-2.5">
                  <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                    {a.start}–{a.end}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("text-sm", a.billing === "headline" ? "text-base font-semibold"
                      : a.billing === "main" ? "font-medium" : "")}>{a.name}</span>
                    {clashes.has(i) && (
                      <span className="ms-2 rounded border border-foreground/40 px-1.5 py-0.5 align-middle text-[11px] font-medium">
                        clash
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
