import { cn } from "@/lib/utils";
/**
 * A numbered marker anchored to a point on something, opening its comment.
 *
 * NUMBERED, NOT DOTTED. Identical dots on an image cannot be referred to —
 * "the comment on the left" breaks the moment the layout reflows, while
 * "number 3" survives every screen size and works when read aloud on a call.
 *
 * A REAL `<button>` WITH `aria-expanded`, so the pins are in the tab order and
 * their numbers are announced. Annotation layers are almost always divs with
 * onClick, which makes every comment on the page unreachable without a mouse.
 *
 * PERCENTAGE COORDINATES, not pixels — an annotation on a photograph has to
 * stay on the same feature when the photograph is displayed at a different
 * size, and a pixel offset does not.
 *
 * `-translate-x-1/2 -translate-y-1/2` centres the pin ON its point rather than
 * hanging it below and to the right, which is the small error that makes every
 * annotation on a page look slightly off.
 *
 * RESOLVED PINS GO HOLLOW rather than disappearing: a resolved comment still
 * marks a place somebody had a question about, and hiding it makes the same
 * question get asked again.
 */
export function AnnotationPin({ number, x, y, open, resolved, onToggle, label, className }: {
  number: number;
  /** 0–100, percentage of the container's width. */
  x: number;
  /** 0–100, percentage of the container's height. */
  y: number;
  open?: boolean;
  resolved?: boolean;
  onToggle: () => void;
  /** Accessible name — defaults to "Comment <n>". */
  label?: string;
  className?: string;
}) {
  return (
    <button data-slot="annotation-pin" type="button" onClick={onToggle} aria-expanded={open}
      aria-label={label ?? `Comment ${number}${resolved ? ", resolved" : ""}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      className={cn(
        "absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border text-[11px] font-medium tabular-nums",
        resolved
          ? "border-border bg-background text-muted-foreground"
          : "border-foreground bg-foreground text-background",
        open && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
        className,
      )}>
      {number}
    </button>
  );
}
