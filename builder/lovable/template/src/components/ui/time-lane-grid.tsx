import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Lanes down, time across, blocks positioned by start and duration.
 *
 * THE WEEK VIEW AND THE STAFF ROTA ARE ONE COMPONENT. Give it lanes of days
 * and it is a week; give it lanes of people and it is a rota; lanes of rooms
 * and it is a resource board. Building those three separately is the same
 * grid with the lane relabelled — which is exactly the duplication this kit
 * is trying not to accumulate.
 *
 * OVERLAPS SIT SIDE BY SIDE, and that is most of the work. Two bookings at
 * the same time must both be visible, so blocks are grouped into overlapping
 * clusters and each takes an equal share of the lane's depth. A grid that
 * stacks them hides the double-booking it exists to reveal.
 *
 * POSITION IS PERCENT OF THE DAY WINDOW, not pixels, so it reflows without
 * measuring; the window is a prop because a barber opens at 9 and a bar at 6,
 * and rendering midnight-to-midnight wastes two thirds of the screen.
 *
 * THE LANE HEIGHT IS THE CALLER'S, because the label is a ReactNode and this
 * component cannot know how tall one is. It was fixed at 48px, and a weekly
 * class timetable — name, time, teacher, places left — is four lines once the
 * block is narrow enough to wrap the name. `overflow-hidden` then clipped at
 * the PIXEL, so the last line came out sliced through the middle of the
 * letters: not truncation anybody would read as truncation, but something that
 * looks like a rendering fault.
 *
 * So `laneHeight` exists, and a clipped block now fades out at its bottom edge
 * rather than ending mid-glyph — when a caller does under-size it the result
 * reads as "there is more" instead of as broken.
 *
 * `day-schedule` is one day as a LIST — no time axis, no overlap, no lanes.
 */
export type LaneBlock = { id: string; lane: string; start: number; end: number; label: React.ReactNode };

function cluster(blocks: LaneBlock[]) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const out: LaneBlock[][] = [];
  let group: LaneBlock[] = [];
  let until = -Infinity;
  for (const b of sorted) {
    if (b.start >= until && group.length) { out.push(group); group = []; }
    group.push(b);
    until = Math.max(until, b.end);
  }
  if (group.length) out.push(group);
  return out;
}

export function TimeLaneGrid({ lanes, blocks, from = 8, to = 20, laneHeight = 48, onPick, className }: {
  lanes: { key: string; label: React.ReactNode }[];
  /** start/end in hours, e.g. 9.5 = 09:30 */
  blocks: LaneBlock[];
  from?: number;
  to?: number;
  /**
   * Pixels. 48 fits a one-line label; a three-line one in a narrow block needs
   * about 72. The label is yours, so its height has to be too.
   */
  laneHeight?: number;
  onPick?: (id: string) => void;
  className?: string;
}) {
  const span = Math.max(1, to - from);
  const hours = Array.from({ length: span + 1 }, (_, i) => from + i);
  const pct = (h: number) => ((h - from) / span) * 100;

  return (
    <div data-slot="time-lane-grid" className={cn("flex flex-col text-xs", className)}>
      <div className="flex">
        <span className="w-24 shrink-0" />
        <div className="relative flex-1">
          {hours.map((h) => (
            <span key={h} className="absolute -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ left: `${pct(h)}%` }}>{String(h).padStart(2, "0")}</span>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-1">
        {lanes.map((lane) => {
          const mine = blocks.filter((b) => b.lane === lane.key);
          const groups = cluster(mine);
          return (
            <div key={lane.key} className="flex items-stretch">
              <span className="w-24 shrink-0 truncate pe-2">{lane.label}</span>
              <div className="relative flex-1 rounded border border-border bg-muted/40"
                style={{ height: laneHeight }}>
                {hours.map((h) => (
                  <span key={h} aria-hidden className="absolute inset-y-0 border-s border-border/60"
                    style={{ left: `${pct(h)}%` }} />
                ))}
                {groups.flatMap((group) =>
                  group.map((b, i) => (
                    <button key={b.id} type="button" onClick={() => onPick?.(b.id)}
                      className={cn(
                        "absolute overflow-hidden rounded border border-foreground bg-background px-1 text-start text-[10px] leading-tight",
                        // Fades the last 5px so an under-sized lane truncates
                        // instead of slicing a line of text in half.
                        "[mask-image:linear-gradient(to_bottom,#000_calc(100%-5px),transparent)]",
                        onPick && "cursor-pointer hover:bg-muted")}
                      style={{
                        left: `${pct(b.start)}%`,
                        width: `${Math.max(2, pct(b.end) - pct(b.start))}%`,
                        // equal share of the lane's depth, so an overlap shows both
                        top: `${(i / group.length) * 100}%`,
                        height: `${100 / group.length}%`,
                      }}>
                      {b.label}
                    </button>
                  )),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
