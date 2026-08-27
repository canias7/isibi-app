import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Type "next Tuesday 2pm" and watch it resolve.
 *
 * EVERY OTHER DATE INPUT IN THIS KIT IS A CONTROL — a grid, a select, a
 * native picker. For somebody who already knows the date, all of them are
 * slower than typing it, and the fastest tools in the world let you type it.
 *
 * THE INTERPRETATION IS ALWAYS SHOWN, AND IT IS THE CONTRACT. Parsing is a
 * guess; a guess that acts silently books the wrong day. The resolved date
 * is echoed in full underneath ("Tuesday 4 August, 14:00") and nothing is
 * emitted until it parses.
 *
 * IT PARSES A SMALL, STATED VOCABULARY and says so — today, tomorrow,
 * weekday names, "next <weekday>", "in N days/weeks", d/m, d monthname, plus
 * an optional time. A parser that pretends to understand everything fails
 * silently on the tenth phrasing; one that says what it knows can be learned
 * in a second.
 *
 * `parseNaturalDate` is exported and pure, so the vocabulary is testable
 * without rendering anything.
 */
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function parseNaturalDate(text: string, now = new Date()): Date | null {
  const s = text.trim().toLowerCase();
  if (!s) return null;
  let time: [number, number] | null = null;
  const t = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b/);
  if (t) {
    if (t[3]) {
      let h = Number(t[1]) % 12;
      if (t[3] === "pm") h += 12;
      time = [h, Number(t[2] ?? 0)];
    } else time = [Number(t[4]), Number(t[5])];
  }
  const rest = t ? s.replace(t[0], " ") : s;
  const at = (d: Date) => {
    if (time) d.setHours(time[0], time[1], 0, 0);
    else d.setHours(0, 0, 0, 0);
    return d;
  };
  const day = (n: number) => at(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n));

  if (/\btoday\b|\btonight\b/.test(rest)) return day(0);
  if (/\btomorrow\b/.test(rest)) return day(1);
  const inN = rest.match(/\bin (\d+) (day|week)s?\b/);
  if (inN) return day(Number(inN[1]) * (inN[2] === "week" ? 7 : 1));
  const wd = DAYS.findIndex((d) => new RegExp(`\\b${d}\\b`).test(rest));
  if (wd >= 0) {
    const next = /\bnext\b/.test(rest);
    let delta = (wd - now.getDay() + 7) % 7;
    if (delta === 0) delta = 7;          // "tuesday" on a Tuesday means the next one
    if (next && delta < 7) delta += 7;   // "next tuesday" is a week further out
    return day(delta);
  }
  const dm = rest.match(/\b(\d{1,2})\s*[/-]\s*(\d{1,2})\b/);
  if (dm) return at(new Date(now.getFullYear(), Number(dm[2]) - 1, Number(dm[1])));
  const dMon = rest.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/);
  if (dMon) {
    const mi = MONTHS.findIndex((m) => m.startsWith(dMon[2].slice(0, 3)));
    if (mi >= 0) return at(new Date(now.getFullYear(), mi, Number(dMon[1])));
  }
  return null;
}

export function NlDateInput({ value, onChange, placeholder = "next Tuesday 2pm", className }: {
  value?: Date | null;
  onChange: (d: Date | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = React.useState("");
  const parsed = React.useMemo(() => parseNaturalDate(text), [text]);
  React.useEffect(() => { onChange(parsed); }, [parsed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-slot="nl-date-input" className={cn("flex max-w-xs flex-col gap-1", className)}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder}
        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      {/* The interpretation is the contract - never act on a silent guess. */}
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {!text.trim()
          ? <>today · tomorrow · a weekday · “next Friday” · “in 3 days” · 14/8 · 4 Aug — plus a time</>
          : parsed
            ? <>= <b className="text-foreground">{parsed.toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</b></>
            : <>Not understood — try “tomorrow 3pm” or “14/8”.</>}
      </p>
    </div>
  );
}
