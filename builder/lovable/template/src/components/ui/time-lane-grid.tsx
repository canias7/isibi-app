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

export function TimeLaneGrid({ lanes, blocks, from = 8, to = 20, onPick, className }: {
  lanes: { key: string; label: React.ReactNode }[];
  /** start/end in hours, e.g. 9.5 = 09:30 */
  blocks: LaneBlock[];
  from?: number;
  to?: number;
  onPick?: (id: string) => void;
  className?: string;
}) {
  const span = Math.max(1, to - from);
  const hours = Array.from({ length: span + 1 }, (_, i) => from + i);
  const pct = (h: number) => ((h - from) / span) * 100;

  return (
    <div className={cn("flex flex-col text-xs", className)}>
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
              <span className="w-24 shrink-0 truncate pr-2">{lane.label}</span>
              <div className="relative h-12 flex-1 rounded border border-border bg-muted/40">
                {hours.map((h) => (
                  <span key={h} aria-hidden className="absolute inset-y-0 border-l border-border/60"
                    style={{ left: `${pct(h)}%` }} />
                ))}
                {groups.flatMap((group) =>
                  group.map((b, i) => (
                    <button key={b.id} type="button" onClick={() => onPick?.(b.id)}
                      className={cn("absolute overflow-hidden rounded border border-foreground bg-background px-1 text-left text-[10px] leading-tight",
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
