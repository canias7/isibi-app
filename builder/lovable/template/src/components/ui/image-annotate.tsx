import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Pins and boxes drawn ON an image, each carrying a note.
 *
 * `comment-pin` ANCHORS TO A PAGE. This anchors to image coordinates, which
 * is what "the scratch is here" needs — a damage report, a proof mark-up, a
 * before-photo at a clinic. The coordinates travel with the annotation, so
 * the mark stays on the scratch at every size.
 *
 * COORDINATES ARE PERCENTAGES, never pixels. A pin stored in pixels lands
 * somewhere else the moment the image renders at another width, which is
 * every phone.
 *
 * EVERY MARK IS ALSO A NUMBERED LIST ITEM beside the picture. A note that
 * exists only as a dot on an image is unreadable to a screen reader and
 * unprintable; the list is the same data and it is the accessible copy.
 *
 * Adding is an explicit MODE with a visible state, so an ordinary click on
 * the picture does not scatter pins — the reading-guide rule.
 */
export type Mark = { id: string; x: number; y: number; note: string };

export function ImageAnnotate({ src, alt = "", marks, onAdd, onRemove, className }: {
  src: string;
  alt?: string;
  marks: Mark[];
  onAdd?: (x: number, y: number) => void;
  onRemove?: (id: string) => void;
  className?: string;
}) {
  const [adding, setAdding] = React.useState(false);
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row", className)}>
      <div className="relative min-w-0 flex-1">
        <button type="button" disabled={!adding}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onAdd?.(
              Math.round(((e.clientX - r.left) / r.width) * 100),
              Math.round(((e.clientY - r.top) / r.height) * 100),
            );
            setAdding(false);
          }}
          className={cn("block w-full overflow-hidden rounded-lg border",
            adding ? "cursor-crosshair border-foreground" : "cursor-default border-border")}>
          <img src={src} alt={alt} className="block w-full" />
        </button>
        {marks.map((m, i) => (
          <span key={m.id} aria-hidden
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
            className="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-background bg-foreground text-[10px] font-bold text-background ring-1 ring-foreground">
            {i + 1}
          </span>
        ))}
        {onAdd ? (
          <button type="button" onClick={() => setAdding((v) => !v)} aria-pressed={adding}
            className={cn("mt-1.5 cursor-pointer rounded-md border px-2 py-1 text-xs",
              adding ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
            {adding ? "Click the picture…" : "Add a mark"}
          </button>
        ) : null}
      </div>
      {/* The same marks as a list: the accessible and printable copy. */}
      <ol className="flex w-full flex-col gap-1 text-xs sm:w-56">
        {marks.length ? marks.map((m, i) => (
          <li key={m.id} className="flex items-start justify-between gap-2 rounded border border-border px-2 py-1">
            <span><b className="tabular-nums">{i + 1}.</b> {m.note}</span>
            {onRemove ? (
              <button type="button" onClick={() => onRemove(m.id)} aria-label={`Remove mark ${i + 1}`}
                className="cursor-pointer text-muted-foreground hover:text-foreground">×</button>
            ) : null}
          </li>
        )) : <li className="text-muted-foreground">No marks yet.</li>}
      </ol>
    </div>
  );
}
