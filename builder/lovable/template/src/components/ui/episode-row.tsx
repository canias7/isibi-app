import { DateFormat } from "@/components/ui/date-format";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * One episode in a list of them. A podcast, a series, a course recording.
 *
 * The play button is named WITH THE EPISODE — "Play Episode 12: the long
 * winter". A list of these renders twenty controls whose accessible name is
 * otherwise the word "Play", twenty times, in the one view where which row you
 * are on is the entire question.
 *
 * The duration goes in a real `<time datetime="PT32M">` alongside the human
 * "32 min". A crawler, a reading-time estimate and a translation layer can all
 * read the machine form; none of them can parse the one people want to see.
 *
 * PROGRESS IS SHOWN IN WORDS AS WELL AS A BAR. "Half listened" and a bar at 50%
 * say the same thing, and only one of them survives greyscale, a screen reader,
 * or a bar too thin to judge. Finished says "Played" and stops drawing a bar
 * that would sit permanently full.
 *
 * `href` makes the title a link to the episode page and leaves the play button
 * doing only the thing it says. Both, or neither, never a whole row that is
 * secretly one big button with a second button inside it.
 */
function iso(seconds: number) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.round(seconds % 60);
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
}

function human(seconds: number) {
  const h = Math.floor(seconds / 3600), m = Math.round((seconds % 3600) / 60);
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${Math.max(m, 1)} min`;
}

export function EpisodeRow({
  title, number, description, seconds, publishedAt, href,
  playing, progress, onPlay, className,
}: {
  title: string;
  /** Episode number, shown before the title. */
  number?: number;
  description?: string;
  /** Length in seconds. */
  seconds: number;
  publishedAt?: string | number | Date;
  href?: string;
  playing?: boolean;
  /** How far through, 0-1. 1 or more reads as played. */
  progress?: number;
  onPlay?: () => void;
  className?: string;
}) {
  const label = number ? `Episode ${number}: ${title}` : title;
  const done = typeof progress === "number" && progress >= 1;
  const part = typeof progress === "number" && progress > 0 && progress < 1;

  return (
    <div data-slot="episode-row" className={cn("flex items-start gap-3 py-4", className)}>
      {onPlay && (
        <button type="button" onClick={onPlay}
          aria-label={`${playing ? "Pause" : "Play"} ${label}`}
          className="mt-0.5 grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-border hover:bg-muted">
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </button>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {number ? <span className="text-muted-foreground tabular-nums">{number}. </span> : null}
          {href ? <a href={href} className="underline-offset-4 hover:underline">{title}</a> : title}
        </p>
        {description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{description}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <time dateTime={iso(seconds)}>{human(seconds)}</time>
          {publishedAt ? <>· <DateFormat date={publishedAt} /></> : null}
          {done ? <>· <span className="font-medium text-foreground">Played</span></> : null}
          {part ? <>· <span>{Math.round((progress ?? 0) * 100)}% listened</span></> : null}
        </p>
        {part && (
          <div className="mt-2 h-0.5 w-full max-w-xs overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full bg-foreground" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
