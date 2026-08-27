import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The chapters of a video or a recording, as a jump list.
 *
 * Each chapter shows its LENGTH, not only its start time. "12:04" tells
 * somebody where a section begins; "4 min" tells them whether they have time
 * for it, which is the question being asked by anyone scanning this list.
 * Length is derived from the next chapter's start, so the caller supplies one
 * number per chapter and cannot get the two out of step.
 *
 * The CURRENT chapter is derived from the playhead here rather than passed in,
 * because a caller computing "which chapter am I in" gets the boundary wrong —
 * exactly at a start time it belongs to the new one, and `<` versus `<=` is the
 * whole difference.
 *
 * A `<nav>` of buttons in an ordered list, so the count is announced and the
 * order is part of the structure rather than something inferred from the
 * numbers printed on screen.
 */
export function ChapterList({ chapters, at = 0, total, onSeek, className }: {
  chapters: { start: number; title: React.ReactNode }[];
  at?: number;
  total?: number;
  onSeek?: (seconds: number) => void;
  className?: string;
}) {
  const sorted = React.useMemo(() => [...chapters].sort((a, b) => a.start - b.start), [chapters]);
  const current = React.useMemo(() => {
    let i = -1;
    for (let k = 0; k < sorted.length; k++) if (at >= sorted[k].start) i = k;
    return i;
  }, [sorted, at]);

  const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const span = (i: number) => {
    const end = i + 1 < sorted.length ? sorted[i + 1].start : total;
    if (end == null) return null;
    const mins = Math.round((end - sorted[i].start) / 60);
    return mins < 1 ? "under a minute" : `${mins} min`;
  };

  return (
    <nav data-slot="chapter-list" aria-label="Chapters" className={className}>
      <ol className="flex flex-col divide-y divide-border rounded-md border border-border">
        {sorted.map((c, i) => (
          <li key={c.start}>
            <button type="button" onClick={() => onSeek?.(c.start)}
              aria-current={i === current ? "true" : undefined}
              className={cn("flex w-full cursor-pointer items-baseline gap-3 px-3 py-2 text-start text-sm hover:bg-muted",
                i === current && "bg-muted/60 font-medium")}>
              <span className="w-12 shrink-0 text-xs text-muted-foreground tabular-nums">{clock(c.start)}</span>
              <span className="min-w-0 flex-1">{c.title}</span>
              {span(i) ? <span className="shrink-0 text-xs text-muted-foreground">{span(i)}</span> : null}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
