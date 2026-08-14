import * as React from "react";
import { cn, toDate } from "@/lib/utils";
/**
 * A form control whose VALUE is "when this comes back".
 *
 * OPTIONS ARE ABSOLUTE TIMES, COMPUTED AT OPEN (the snooze-menu
 * discipline as a field): "This afternoon (14:00)" not "in 3 hours",
 * because relative wording goes stale while the menu is open and the
 * person is agreeing to a TIME, not a duration. Past options are
 * DROPPED, not disabled — at 15:00, "this afternoon (14:00)" is not a
 * choice that exists.
 *
 * WHERE IT DIFFERS FROM snooze-menu: that one is menu items around a
 * notification; this VALUES a Date for a form (returns it, displays it,
 * clears it), with a custom datetime-local for the option lists never
 * cover. The custom input refuses the past too — snoozing into the past
 * is un-snoozing with extra steps.
 */
export function snoozeChoices(now: Date): { label: string; at: Date }[] {
  const at = (h: number, m: number, addDays = 0) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + addDays, h, m);
    return d;
  };
  const fmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const all = [
    { label: `This afternoon (${fmt(at(14, 0))})`, at: at(14, 0) },
    { label: `This evening (${fmt(at(18, 0))})`, at: at(18, 0) },
    { label: `Tomorrow morning (${fmt(at(9, 0, 1))})`, at: at(9, 0, 1) },
    { label: "Next week (Mon 09:00)", at: (() => { const d = at(9, 0); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d; })() },
  ];
  return all.filter((o) => o.at.getTime() > now.getTime());
}

export function SnoozeUntil({ value, onChange, className }: {
  value?: Date | null;
  onChange: (until: Date | null) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [customing, setCusting] = React.useState(false);
  const [custom, setCustom] = React.useState("");
  const choices = React.useMemo(() => (open ? snoozeChoices(new Date()) : []), [open]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-sm hover:bg-muted">
          {value
            ? <>Snoozed until <span className="tabular-nums">{value.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span></>
            : "Snooze…"}
        </button>
        {value ? (
          <button type="button" onClick={() => onChange(null)}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2">
            Wake it now
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {choices.map((c) => (
            <button key={c.label} type="button"
              onClick={() => { onChange(c.at); setOpen(false); setCusting(false); }}
              className="cursor-pointer rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted">
              {c.label}
            </button>
          ))}
          {customing ? (
            <span className="flex items-center gap-1.5">
              <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)}
                className="h-7 cursor-pointer rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <button type="button"
                disabled={!custom || toDate(custom).getTime() <= Date.now()}
                onClick={() => { onChange(toDate(custom)); setOpen(false); setCusting(false); }}
                className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40">
                Set
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setCusting(true)}
              className="cursor-pointer rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground">
              Pick a time…
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
