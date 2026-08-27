import { cn } from "@/lib/utils";
/**
 * A download in flight, in bytes rather than percent.
 *
 * "412 MB of 900 MB" TELLS SOMEBODY WHETHER TO WAIT. A percentage hides the
 * scale — 40% of a 3 MB file and 40% of a 3 GB one feel identical and are not —
 * and the remaining size is what decides whether to stay on the page.
 *
 * IT DOES NOT ESTIMATE A TIME unless the caller supplies one. Time-remaining
 * figures computed from an instantaneous rate swing wildly and are notorious for
 * being wrong; a stable byte count is more useful than a number that says four
 * seconds and then two minutes.
 *
 * `aria-live` on the figure only, never on the bar — announcing every frame of a
 * progress bar talks over everything else on the page.
 */
function size(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let n = Math.max(bytes, 0), i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${i === 0 ? n : n.toFixed(1)} ${units[i]}`;
}

export function DownloadProgress({ received, total, name, remaining, onCancel, className }: {
  received: number;
  /** Omit when the server sent no length. */
  total?: number;
  name?: string;
  /** "about 40 seconds" — only if the caller has a stable estimate. */
  remaining?: string;
  onCancel?: () => void;
  className?: string;
}) {
  const pct = total && total > 0 ? Math.round(Math.min(received / total, 1) * 100) : null;
  return (
    <div data-slot="download-progress" className={cn("flex flex-col gap-1", className)}>
      {name && <p className="truncate text-sm font-medium">{name}</p>}
      {pct !== null && (
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
          aria-label={name ? `Downloading ${name}` : "Downloading"}
          className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
        </div>
      )}
      <p aria-live="polite" className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground tabular-nums">
        <span>{total ? `${size(received)} of ${size(total)}` : `${size(received)} so far`}</span>
        {remaining && <span>· {remaining} left</span>}
        {onCancel && (
          <button type="button" onClick={onCancel} className="cursor-pointer underline underline-offset-2">Cancel</button>
        )}
      </p>
    </div>
  );
}
