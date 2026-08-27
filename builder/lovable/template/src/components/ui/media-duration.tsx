import { cn } from "@/lib/utils";
/**
 * How long a clip runs, in both forms.
 *
 * A REAL `<time datetime="PT32M">` beside the human "32 min". The machine form
 * survives translation, indexing and a search engine reading the page; the human
 * one is what anybody actually wants to see. Neither substitutes for the other.
 *
 * `remaining` flips it to a countdown for a playing item, because "18 minutes
 * left" is the number somebody deciding whether to finish it needs — and it is
 * different information from the total.
 *
 * Hours are only shown when there are any, so a three-minute clip does not read
 * "0:03:12" — the leading zero is the tell of a formatter written for the
 * longest case.
 */
function parts(seconds: number) {
  const s = Math.max(Math.round(seconds), 0);
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function MediaDuration({ seconds, remaining, style = "clock", className }: {
  seconds: number;
  /** Render as time left rather than total. */
  remaining?: boolean;
  /** "clock" gives 32:10, "words" gives 32 min. */
  style?: "clock" | "words";
  className?: string;
}) {
  const { h, m, s } = parts(seconds);
  const iso = `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
  const clock = h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
  const words = h ? `${h} hr${m ? ` ${m} min` : ""}` : `${Math.max(m, 1)} min`;
  return (
    <time data-slot="media-duration" dateTime={iso} className={cn("tabular-nums", className)}>
      {style === "clock" ? clock : words}
      {remaining ? " left" : ""}
    </time>
  );
}
