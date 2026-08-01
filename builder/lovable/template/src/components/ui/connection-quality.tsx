import { cn } from "@/lib/utils";
/**
 * How good the connection is, in bars and in a word.
 *
 * THE WORD IS NOT OPTIONAL. Signal bars are the classic example of information
 * carried by shape alone: three-of-four bars at 12px is a judgement most people
 * cannot make at a glance and nobody can make with a screen reader. The bars
 * are `aria-hidden` decoration and the label is the actual content.
 *
 * Four levels, not a percentage. Nobody acts differently on 61% versus 68%, and
 * a precise number invites a precision the measurement does not have.
 *
 * `latencyMs` is shown only when the caller passes it, and only as a round
 * number — the audience for a millisecond figure is somebody debugging, and for
 * everybody else it is noise beside a word that already said it.
 */
const WORD = ["No connection", "Poor connection", "Fair connection", "Good connection"] as const;

export function ConnectionQuality({ level, latencyMs, showLabel = true, className }: {
  /** 0 offline · 1 poor · 2 fair · 3 good. */
  level: 0 | 1 | 2 | 3;
  latencyMs?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const n = Math.min(Math.max(level, 0), 3);
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <span aria-hidden className="inline-flex items-end gap-0.5">
        {[1, 2, 3].map((bar) => (
          <span key={bar}
            className={cn("w-1 rounded-xs", bar <= n ? "bg-foreground" : "bg-muted")}
            style={{ height: `${4 + bar * 3}px` }} />
        ))}
      </span>
      <span className={cn("text-muted-foreground", !showLabel && "sr-only")}>
        {WORD[n]}
        {typeof latencyMs === "number" && n > 0 ? ` · ${Math.round(latencyMs)}ms` : ""}
      </span>
    </span>
  );
}
