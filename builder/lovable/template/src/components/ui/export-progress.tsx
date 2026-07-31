import * as React from "react";
import { Download, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A long-running export, from "preparing" to a link.
 *
 * IT SURVIVES A CLOSED TAB, and that is the design constraint. A 40,000-row
 * export takes minutes; anybody who waits with the tab open is being asked to
 * do something unreasonable, so the finished file is a LINK that also arrives
 * by email — and the component says so, because otherwise people wait.
 *
 * THE READY FILE STATES ITS SIZE AND WHEN IT EXPIRES. A download link with no
 * expiry gets bookmarked and 404s a week later with no explanation; the date is
 * one clause and it prevents that entirely.
 *
 * A FAILURE SAYS WHICH STAGE and offers a retry. "Export failed" sends somebody
 * to support; "Failed while writing the file — try again" is often
 * self-service, and the stage is free to report.
 *
 * The row count is a RANGE while it is being counted ("about 12,000"), because
 * a precise number that then changes reads as a bug. Same honesty as
 * `token-meter` about what is an estimate.
 */
export function ExportProgress({
  state, rows, done, filename, size, href, expiresOn, stage, onRetry, onCancel, className,
}: {
  state: "preparing" | "running" | "ready" | "failed";
  rows?: number;
  done?: number;
  filename?: string;
  size?: React.ReactNode;
  href?: string;
  expiresOn?: React.ReactNode;
  stage?: React.ReactNode;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
}) {
  const pct = rows && done != null && rows > 0 ? Math.min(100, (done / rows) * 100) : null;

  return (
    <div role="status" aria-live="polite"
      className={cn("flex flex-col gap-2 rounded-lg border border-border p-3", className)}>
      <div className="flex items-start gap-2.5">
        {state === "ready" ? <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
          : state === "failed" ? <X aria-hidden className="mt-0.5 size-4 shrink-0" />
          : <Download aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {state === "preparing" ? "Preparing your export"
              : state === "running" ? "Writing the file"
              : state === "ready" ? (filename ?? "Your export is ready")
              : "The export failed"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {state === "preparing" && rows ? `About ${rows.toLocaleString()} rows` : null}
            {state === "running" && rows != null && done != null
              ? `${done.toLocaleString()} of ${rows.toLocaleString()} rows` : null}
            {state === "ready" ? (
              <>
                {size ? <>{size}</> : null}
                {size && expiresOn ? " · " : null}
                {expiresOn ? <>available until {expiresOn}</> : null}
              </>
            ) : null}
            {state === "failed" && stage ? <>Failed while {stage}.</> : null}
          </p>
        </div>
      </div>

      {state === "running" ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          {pct != null ? (
            <div className="h-full rounded-full bg-foreground transition-[width]" style={{ width: `${pct}%` }} />
          ) : (
            <div className="h-full w-1/3 rounded-full bg-foreground motion-safe:animate-[pulse_1.4s_ease-in-out_infinite]" />
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {state === "ready" && href ? (
          <a href={href} download={filename}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90">
            <Download aria-hidden className="size-3.5" /> Download
          </a>
        ) : null}
        {state === "failed" && onRetry ? (
          <button type="button" onClick={onRetry}
            className="cursor-pointer rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
            Try again
          </button>
        ) : null}
        {(state === "preparing" || state === "running") && onCancel ? (
          <button type="button" onClick={onCancel}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Cancel
          </button>
        ) : null}
      </div>

      {state === "preparing" || state === "running" ? (
        <p className="border-t border-border pt-2 text-xs text-muted-foreground">
          You can close this page &mdash; we&rsquo;ll email the file when it&rsquo;s ready.
        </p>
      ) : null}
    </div>
  );
}
