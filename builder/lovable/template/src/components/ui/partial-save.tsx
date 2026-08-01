import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Some of it saved and some of it didn't.
 *
 * The worst outcome of a bulk write is silence about which half is which. A
 * plain "something went wrong" leaves somebody to either re-run everything and
 * duplicate the successes, or re-run nothing and lose the failures — and both
 * are worse than the original error.
 *
 * BOTH NUMBERS ARE STATED, saved first. Leading with the failures reads as a
 * total loss on a run where 4,998 of 5,000 were fine.
 *
 * `errors` lists the ones that did not make it, capped at ten with a count of
 * the rest — a failure list long enough to scroll is not a summary, and the
 * full set belongs in an export.
 *
 * Retry acts on the FAILURES ONLY, and the button says so. A retry that
 * re-sends everything is how the duplicates happen.
 */
export function PartialSave({ saved, failed, errors, onRetryFailed, className }: {
  saved: number;
  failed: number;
  /** What did not save, one line each. */
  errors?: string[];
  onRetryFailed?: () => void;
  className?: string;
}) {
  if (failed <= 0) return null;
  const shown = errors?.slice(0, 10) ?? [];
  return (
    <section role="alert" aria-label="Partly saved"
      className={cn("flex flex-col gap-2 rounded-md border border-border p-4", className)}>
      <p className="text-sm font-medium tabular-nums">
        {saved.toLocaleString()} saved · {failed.toLocaleString()} didn&apos;t
      </p>
      {shown.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
          {shown.map((e, i) => <li key={i}>{e}</li>)}
          {errors && errors.length > shown.length && (
            <li className="tabular-nums">and {errors.length - shown.length} more</li>
          )}
        </ul>
      )}
      {onRetryFailed && (
        <div>
          <Button size="sm" onClick={onRetryFailed}>
            Retry the {failed.toLocaleString()} that failed
          </Button>
        </div>
      )}
    </section>
  );
}
