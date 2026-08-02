import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/**
 * One show: title, dates, the room, and whether it is on now.
 *
 * ON NOW / UPCOMING / ENDED IS COMPUTED FROM THE DATES, never taken as a field.
 * A gallery that stores `current: true` ends up with three current exhibitions,
 * one of which closed in March, because somebody added the new show and did not
 * unset the old one — and the site says a closed show is on, which is how
 * people arrive to a locked room. One source, one answer: the same discipline
 * as the goal difference in `league-table`.
 *
 * AN ENDED SHOW IS STILL RENDERED. A card that vanishes on its closing date
 * leaves a gallery page looking abandoned between hangs, and the archive is
 * half of what an institution's site is for. It says "Ended", which is
 * information, rather than disappearing, which is not.
 *
 * "LAST WEEK" IS THE LINE THAT GETS SOMEBODY THROUGH THE DOOR, so a show about
 * to close says so. It only appears inside a fortnight — a countdown on
 * something running until November is noise, and noise is what makes the real
 * warning invisible.
 *
 * DATES GO IN REAL `<time datetime>` ELEMENTS. "Until 14 Sep" is unparseable by
 * anything but a person; the machine-readable value costs one attribute.
 *
 * ISO IS PARSED AS LOCAL. `new Date("2026-09-14")` is UTC midnight, which is
 * the 13th for every reader west of Greenwich — a show would close a day early
 * across the Americas and nobody here would ever see it.
 */
const parse = (iso: string) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const DAY = 86400000;
export function ExhibitionCard({
  title, artist, from, to, room, image, admission, blurb, href, now, locale = "en-GB", className,
}: {
  title: string;
  artist?: string | null;
  /** ISO "2026-06-01". */
  from: string;
  /** ISO, inclusive — the last day it is open. */
  to: string;
  /** "Gallery 3", "The Long Room". */
  room?: string | null;
  image?: string | null;
  /** "Free", "£8 / £5 concessions". */
  admission?: string | null;
  blurb?: string | null;
  href?: string;
  /** Injectable clock, so a test can fix "today". */
  now?: Date;
  locale?: string;
  className?: string;
}) {
  const today = now ?? new Date();
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const start = parse(from);
  const end = parse(to);
  const state = !start || !end ? "on"
    : midnight < start.getTime() ? "upcoming"
    : midnight > end.getTime() ? "ended"
    : "on";
  const daysLeft = end ? Math.round((end.getTime() - midnight) / DAY) : null;
  const fmt = (d: Date, withYear: boolean) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) }).format(d);
  const sameYear = start && end && start.getFullYear() === end.getFullYear();
  const dates = start && end
    ? <><time dateTime={from}>{fmt(start, !sameYear)}</time> — <time dateTime={to}>{fmt(end, true)}</time></>
    : null;
  const Wrap = href ? "a" : "article";

  return (
    <Wrap {...(href ? { href } : {})} className={cn("group block", className)}>
      <SafeImage src={image} alt={title} ratio="4/3" fallbackSeed={title} />
      <div className="mt-4">
        {/* STATE IN WORDS AT WEIGHT. Three coloured pills are one pill in
            greyscale, and this is the field the whole card turns on. */}
        <p className="text-xs font-medium uppercase tracking-widest">
          {state === "on" && "On now"}
          {state === "upcoming" && "Opening soon"}
          {state === "ended" && <span className="text-muted-foreground">Ended</span>}
          {room && <span className="font-normal text-muted-foreground"> · {room}</span>}
        </p>
        <h3 className={cn("mt-2 text-2xl font-semibold tracking-tight text-balance",
          href && "underline-offset-4 group-hover:underline")}>{title}</h3>
        {artist && <p className="mt-1 text-base text-muted-foreground">{artist}</p>}
        {dates && <p className="mt-2 text-sm text-muted-foreground">{dates}</p>}
        {state === "on" && daysLeft != null && daysLeft <= 14 && (
          <p className="mt-1 text-sm font-medium">
            {daysLeft <= 0 ? "Last day" : daysLeft === 1 ? "Last day tomorrow" : `${daysLeft} days left`}
          </p>
        )}
        {blurb && <p className="mt-3 max-w-prose text-base leading-relaxed text-muted-foreground">{blurb}</p>}
        {admission && <p className="mt-3 text-sm">{admission}</p>}
      </div>
    </Wrap>
  );
}
