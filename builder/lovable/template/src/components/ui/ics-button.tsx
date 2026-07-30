import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
/**
 * "Add to calendar" — builds the .ics file in the browser.
 *
 * No server and no third party, which is the whole reason to do it this way:
 * a Google Calendar link hands the event details to Google, and a generated
 * site should not do that on the customer's behalf.
 *
 * The date format is UTC with no punctuation (`20260814T190000Z`); anything
 * else is quietly ignored by half the calendar clients that read it.
 */
function stamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
export function IcsButton({ title, start, end, location, description, label = "Add to calendar", className }: {
  title: string; start: string | number | Date; end?: string | number | Date | null;
  location?: string; description?: string; label?: string; className?: string;
}) {
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return null;
  const e = end ? new Date(end) : new Date(s.getTime() + 60 * 60 * 1000);
  const download = () => {
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//site//EN", "BEGIN:VEVENT",
      `UID:${stamp(s)}-${Math.random().toString(36).slice(2, 10)}`,
      `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(s)}`, `DTEND:${stamp(e)}`,
      `SUMMARY:${esc(title)}`,
      location ? `LOCATION:${esc(location)}` : null,
      description ? `DESCRIPTION:${esc(description)}` : null,
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const url = URL.createObjectURL(new Blob([lines], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) + ".ics";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button size="sm" variant="outline" onClick={download} className={className}>
      <CalendarPlus className="size-4" />{label}
    </Button>
  );
}
