import * as React from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Choose a timezone.
 *
 * IANA names (`Europe/London`), never a UTC offset — an offset changes twice
 * a year, so a preference stored as "+01:00" is wrong for half of it, and
 * that is precisely how a recurring meeting drifts by an hour every spring.
 *
 * Each option shows its CURRENT offset alongside the name, because "Europe/
 * Kyiv" means nothing to somebody who knows they are on GMT+3.
 *
 * The list is the caller's, defaulting to the browser's own guess plus a
 * short common set — `Intl.supportedValuesOf("timeZone")` is ~600 entries and
 * an unusable dropdown.
 */

/**
 * THE OFFSET IS COMPUTED, NOT ASKED FOR, because ICU will not give the same
 * answer twice across engines. `timeZoneName: "shortOffset"` returns "GMT+0" on
 * Node (ICU 78.2) and "GMT" on this Chromium — and `"longOffset"` diverges
 * identically, "GMT+00:00" against "GMT", so the obvious fix of asking for the
 * wider form is not one. Measured both. It is the ZERO offset specifically:
 * London, Paris, New York, Tokyo, Kolkata, Sydney and Chatham all agree.
 *
 * That matters here rather than in the abstract because "UTC" is in this
 * component's OWN default list, so every server-rendered picker carried one
 * option whose label the browser then disagreed with — a hydration mismatch
 * (#418, "text") on every page that showed it.
 *
 * Numeric parts are stable; it is the assembled patterns and the offset literal
 * that are not. So we read the wall clock in the zone and in UTC using digits
 * only, subtract, and write the string ourselves. Verified across all eight
 * zones above, including the half-hour (Kolkata) and 45-minute (Chatham) cases
 * that a naive hours-only formatter gets wrong.
 */
function zoneClock(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // `hour12: false` yields "24" for midnight on some engines; `% 24` is what
  // keeps that from reading as the next day.
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second"));
}

function offsetOf(tz: string): string {
  try {
    const at = new Date();
    const mins = Math.round((zoneClock(tz, at) - zoneClock("UTC", at)) / 60000);
    if (!Number.isFinite(mins)) return "";
    if (mins === 0) return "GMT";
    const abs = Math.abs(mins);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `GMT${mins < 0 ? "-" : "+"}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
  } catch { return ""; }
}

export function TimezonePicker({ value, onChange, zones, id, className }: {
  value: string; onChange: (tz: string) => void; zones?: string[]; id?: string; className?: string;
}) {
  // THE GUESS IS CLIENT-ONLY, and this is a structural mismatch rather than a
  // cosmetic one. `resolvedOptions().timeZone` answers with the RUNTIME's zone
  // — the server's during SSR, the visitor's at hydration — so for anybody
  // outside the server's zone the two renders produced option lists of
  // different lengths with different first entries. Empty until mounted means
  // both sides render the same list, and the visitor's own zone is prepended a
  // frame later, which for a `<select>` is invisible.
  const [guess, setGuess] = React.useState("");
  React.useEffect(() => {
    try { setGuess(Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""); } catch { /* no Intl */ }
  }, []);
  const list = zones ?? Array.from(new Set([
    guess, value,
    "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "Australia/Sydney", "Asia/Singapore", "Asia/Tokyo", "Asia/Dubai", "UTC",
  ].filter(Boolean)));
  return (
    <NativeSelect id={id} value={value} aria-label="Timezone" className={cn(className)}
      onChange={(e) => onChange(e.target.value)}>
      {list.map((tz) => {
        const off = offsetOf(tz);
        return <option data-slot="timezone-picker" key={tz} value={tz}>{tz.replace(/_/g, " ")}{off ? ` (${off})` : ""}</option>;
      })}
    </NativeSelect>
  );
}
