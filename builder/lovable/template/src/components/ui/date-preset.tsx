import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Today / This week / Last 30 days — the ranges people actually pick.
 *
 * IT EMITS THE KEY AND THE RESOLVED DATES, BOTH. A live filter wants the
 * KEY ("last-30"), so tomorrow it still means the trailing month; a saved
 * report wants the DATES, so July's report does not quietly become
 * August's. Handing back only one forces the caller to rebuild the other
 * — the source of every "why did my saved filter drift" bug.
 *
 * RANGES ARE COMPUTED, NOT STORED: "this week" starts Monday (stated,
 * because half the world's calendars start Sunday and a silent choice
 * here misfiles weekend takings), "today" is midnight-to-now, and the
 * custom option opens two plain date inputs — the date-range-picker rule:
 * presets first, calendars only when somebody insists.
 */
export type DateRange = { key: string; from: Date; to: Date };

function ranges(now: Date): [string, string, () => { from: Date; to: Date }][] {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return [
    ["today", "Today", () => ({ from: day(now), to: now })],
    ["week", "This week", () => {
      const start = day(now);
      const dow = (start.getDay() + 6) % 7; // Monday start, stated in the header
      start.setDate(start.getDate() - dow);
      return { from: start, to: now };
    }],
    ["last-30", "Last 30 days", () => {
      const from = day(now); from.setDate(from.getDate() - 30);
      return { from, to: now };
    }],
    ["all", "All time", () => ({ from: new Date(0), to: now })],
  ];
}

export function DatePreset({ value, onChange, className }: {
  value?: string;
  onChange: (range: DateRange) => void;
  className?: string;
}) {
  const [custom, setCustom] = React.useState(false);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {ranges(new Date()).map(([key, label, make]) => (
        <button key={key} type="button"
          onClick={() => { setCustom(false); onChange({ key, ...make() }); }}
          className={cn("cursor-pointer rounded-full border px-2.5 py-1 text-xs",
            value === key && !custom ? "border-foreground bg-foreground font-medium text-background" : "border-border hover:bg-muted")}>
          {label}
        </button>
      ))}
      <button type="button" onClick={() => setCustom((v) => !v)}
        className={cn("cursor-pointer rounded-full border px-2.5 py-1 text-xs",
          custom ? "border-foreground font-medium" : "border-border hover:bg-muted")}>
        Custom…
      </button>
      {custom ? (
        <span className="flex items-center gap-1.5 text-xs">
          {/* NAMED. Two `<input type="date">` with no label announce as two
              identical date fields, and which one is the start is the only
              thing anybody needs to know about them. */}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From"
            className="h-7 cursor-pointer rounded-md border border-input bg-background px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          –
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To"
            className="h-7 cursor-pointer rounded-md border border-input bg-background px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          {/* BOTH ENDS PARSE ON THE LOCAL CLOCK. `to` already appended a time and
              `from` did not — and a bare `YYYY-MM-DD` is UTC midnight by spec —
              so west of Greenwich the range STARTED a day early while ending
              correctly. One expression, one end fixed, the asymmetry invisible
              from either half. */}
          <button type="button" disabled={!from || !to}
            onClick={() => onChange({ key: "custom", from: new Date(from + "T00:00:00"), to: new Date(to + "T23:59:59") })}
            className="cursor-pointer rounded-md border border-border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">
            Apply
          </button>
        </span>
      ) : null}
    </div>
  );
}
