import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The video or audio would not play, and why.
 *
 * A BLACK RECTANGLE IS THE DEFAULT FAILURE and it explains nothing — the reader
 * cannot tell a broken file from a slow connection from an unsupported codec,
 * and each has a different response.
 *
 * IT NAMES A ROUTE ROUND THE PROBLEM where there is one. A codec the browser
 * cannot decode is not fixed by pressing play again; a download link or a
 * transcript is the useful answer, and offering "try again" alone wastes the
 * reader's time twice.
 *
 * `role="alert"`, because it follows an explicit press of play.
 */
export function MediaError({ reason, onRetry, downloadHref, transcriptHref, className }: {
  /** Why it failed, in words. */
  reason?: string;
  onRetry?: () => void;
  downloadHref?: string;
  transcriptHref?: string;
  className?: string;
}) {
  return (
    <div data-slot="media-error" role="alert" className={cn("flex flex-col items-start gap-2 rounded-md border border-border p-4", className)}>
      <p className="text-sm font-medium">This wouldn&apos;t play</p>
      {reason && <p className="text-sm text-muted-foreground">{reason}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
        {downloadHref && <a href={downloadHref} download className="text-sm underline underline-offset-4">Download it instead</a>}
        {transcriptHref && <a href={transcriptHref} className="text-sm underline underline-offset-4">Read the transcript</a>}
      </div>
    </div>
  );
}
