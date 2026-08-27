import * as React from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The numbered marker attaching a comment thread to a spot in a document.
 *
 * IT IS A BUTTON WITH A DESCRIPTIVE NAME — "Comment 3, 2 replies, on 'Saturday
 * opening'". A numbered circle is meaningless to a screen reader, and the
 * number alone is meaningless to everybody until the thread is open.
 *
 * RESOLVED PINS ARE HOLLOW, not hidden, and not merely a lighter colour. The
 * whole reason to look at a resolved thread is to see what was decided, and
 * removing the marker means the only way back is a list somewhere else.
 *
 * Hollow means a HEAVY border and readable text, not a thin one. The first
 * version used the ordinary border colour and the resolved pin was almost
 * invisible against a light document — hollow has to stay findable, or it has
 * been hidden by another name.
 *
 * A pin ANCHORS BY FRACTION of the container, not by pixels — the same rule
 * `image-crop` follows. A document that reflows at a different width puts a
 * pixel-anchored pin somewhere unrelated to the text it was about.
 *
 * The active pin is raised in the stacking order, or an overlapping pair makes
 * the one somebody just clicked disappear behind its neighbour.
 */
export function CommentPin({ index, x, y, replies = 0, resolved, active, about, onOpen, className }: {
  index: number;
  x: number;
  y: number;
  replies?: number;
  resolved?: boolean;
  active?: boolean;
  about?: string;
  onOpen?: () => void;
  className?: string;
}) {
  const name = [
    `Comment ${index}`,
    replies ? `${replies} ${replies === 1 ? "reply" : "replies"}` : null,
    about ? `on “${about}”` : null,
    resolved ? "resolved" : null,
  ].filter(Boolean).join(", ");

  return (
    <button data-slot="comment-pin"
      type="button"
      onClick={onOpen}
      aria-label={name}
      aria-current={active ? "true" : undefined}
      // Fractions, not pixels: a document that reflows moves the text.
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, zIndex: active ? 30 : 20 }}
      className={cn("absolute grid size-6 -translate-x-1/2 -translate-y-full cursor-pointer place-items-center rounded-full rounded-es-none text-[10px] font-medium",
        resolved
          ? "border-2 border-foreground bg-background text-foreground"
          : "border border-foreground bg-foreground text-background",
        active && "ring-2 ring-ring ring-offset-1", className)}
    >
      <span aria-hidden>{index}</span>
    </button>
  );
}

export function CommentPinBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span data-slot="comment-pin-badge" className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <MessageSquare aria-hidden className="size-3" />
      <span className="tabular-nums">{count}</span>
      <span className="sr-only">{count === 1 ? "comment" : "comments"}</span>
    </span>
  );
}
