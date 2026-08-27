import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * An upload that stopped part way, and the offer to carry on.
 *
 * The number that matters is how much is ALREADY DONE, because that is what
 * makes resuming feel worth it — "412 MB of 900 MB sent" is a reason to press
 * resume where a bare "paused" is a reason to give up and start again on a
 * better connection.
 *
 * Sizes are formatted here in binary units with one decimal, so a 900 MB file
 * does not render as 943718400. `Intl` has no file-size style, which is why
 * this is nine lines of arithmetic rather than a call.
 *
 * Cancel says what it costs — the progress goes — because "cancel" next to
 * "resume" reads to plenty of people as "cancel the resuming", not "throw away
 * the 412 MB".
 */
function size(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = Math.max(bytes, 0), i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${i === 0 ? n : n.toFixed(1)} ${units[i]}`;
}

export function ResumeUpload({
  name, uploaded, total, state, onResume, onCancel, className,
}: {
  name: string;
  /** Bytes already sent. */
  uploaded: number;
  /** Bytes in the file. */
  total: number;
  state: "paused" | "uploading" | "failed";
  onResume: () => void;
  onCancel?: () => void;
  className?: string;
}) {
  const pct = total > 0 ? Math.round(Math.min(uploaded / total, 1) * 100) : 0;
  const WORD = { paused: "Paused", uploading: "Uploading", failed: "Stopped" };
  return (
    <div data-slot="resume-upload" className={cn("flex flex-col gap-2 rounded-md border border-border p-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="min-w-0 truncate font-medium">{name}</p>
        <p role="status" className="text-sm text-muted-foreground">{WORD[state]}</p>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        {size(uploaded)} of {size(total)} sent
      </p>
      {state !== "uploading" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onResume}>Resume</Button>
          {onCancel && (
            <Button size="sm" variant="outline" onClick={onCancel}>Cancel and lose progress</Button>
          )}
        </div>
      )}
    </div>
  );
}
