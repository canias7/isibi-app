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
function offsetOf(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch { return ""; }
}
export function TimezonePicker({ value, onChange, zones, id, className }: {
  value: string; onChange: (tz: string) => void; zones?: string[]; id?: string; className?: string;
}) {
  let guess = "";
  try { guess = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""; } catch { /* no Intl */ }
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
        return <option key={tz} value={tz}>{tz.replace(/_/g, " ")}{off ? ` (${off})` : ""}</option>;
      })}
    </NativeSelect>
  );
}
