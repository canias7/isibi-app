import { cn } from "@/lib/utils";
/**
 * A track in a listing — with the credits that decide who gets paid.
 *
 * WRITERS AND PERFORMERS ARE DIFFERENT PEOPLE AND DIFFERENT MONEY. Publishing
 * royalties follow the writers and recording royalties the performers, and a
 * single "artist" field is the reason session players and co-writers go unpaid
 * for years.
 *
 * DURATION IS `mm:ss` IN A REAL `<time>` ELEMENT with a machine-readable
 * duration, so it can be read by anything indexing the page and by anyone using
 * a screen reader — "3:47" spoken as "three colon forty-seven" is not a length.
 *
 * AN EXPLICIT MARKER IS A FACT ABOUT THE RECORDING, not a warning. It is
 * required metadata at every store, and its absence on a track that needs it
 * gets a release rejected days before it goes out.
 *
 * THE ISRC BELONGS TO THE RECORDING, not the song. A re-recorded version needs
 * its own, and reusing one is how two different recordings collect as one.
 */
export function TrackRow({ number, title, seconds, writers = [], performers = [], isrc, explicit, version, className }: {
  number?: number;
  title: string;
  seconds?: number;
  /** Who wrote it — publishing money follows these. */
  writers?: string[];
  /** Who played on it — recording money follows these. */
  performers?: string[];
  isrc?: string;
  explicit?: boolean;
  /** "Radio edit", "Live at the Hare and Hounds". */
  version?: string;
  className?: string;
}) {
  const mmss = seconds !== undefined
    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
    : undefined;
  return (
    <li data-slot="track-row" className={cn("space-y-0.5 px-3 py-1.5 text-sm", className)}>
      <p className="flex items-baseline gap-3">
        {number !== undefined && <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{number}</span>}
        <span className="min-w-0 flex-1">
          {title}
          {version && <span className="text-muted-foreground"> ({version})</span>}
          {explicit && <span className="text-xs text-muted-foreground"> · explicit</span>}
        </span>
        {mmss && seconds !== undefined && (
          <time dateTime={`PT${Math.floor(seconds / 60)}M${seconds % 60}S`} className="shrink-0 tabular-nums text-muted-foreground">
            {mmss}
          </time>
        )}
      </p>
      {writers.length > 0 && (
        <p className="text-xs text-muted-foreground">Written by {writers.join(", ")}</p>
      )}
      {performers.length > 0 && (
        <p className="text-xs text-muted-foreground">Performed by {performers.join(", ")}</p>
      )}
      {isrc && <p className="font-mono text-xs text-muted-foreground">{isrc}</p>}
    </li>
  );
}
