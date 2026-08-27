import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "18 of 20 went through."
 *
 * The two counts are separate and the failures are LISTED, because the only
 * useful next step is knowing which ones to do again. A batch that reports
 * only "some failed" makes retrying the whole thing the sole option, which
 * duplicates the 18 that worked.
 */
export function PartialFailure({ succeeded, failed, failures, onRetryFailed, className }: {
  succeeded: number; failed: number;
  failures?: { label: string; reason?: string }[];
  onRetryFailed?: () => void; className?: string;
}) {
  if (failed <= 0) return null;
  return (
    <div data-slot="partial-failure" role="alert" className={cn("space-y-2 rounded-md border border-warning/40 bg-warning/10 p-3", className)}>
      <p className="text-sm">
        <strong className="font-medium tabular-nums">{succeeded}</strong> of{" "}
        <span className="tabular-nums">{succeeded + failed}</span> went through.{" "}
        <strong className="font-medium tabular-nums">{failed}</strong> did not.
      </p>
      {failures?.length ? (
        <ul className="space-y-0.5 text-sm text-muted-foreground">
          {failures.map((f) => (
            <li key={f.label}>
              <span className="text-foreground">{f.label}</span>{f.reason ? ` — ${f.reason}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {onRetryFailed && (
        <Button size="sm" variant="outline" onClick={onRetryFailed}>Retry the {failed} that failed</Button>
      )}
    </div>
  );
}
