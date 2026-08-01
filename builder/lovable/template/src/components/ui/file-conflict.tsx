import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * A file of that name is already here.
 *
 * THREE ANSWERS, ALL OFFERED: keep both, replace, or skip. Most implementations
 * offer two and pick the dangerous one as the default — replace destroys
 * somebody's file, and it is the option a hurried reader presses.
 *
 * NOTHING IS PRESELECTED and "keep both" is listed first, because it is the only
 * choice with no consequence. It is also what people mean the majority of the
 * time.
 *
 * BOTH FILES ARE DESCRIBED — size and date — since "a file with this name
 * exists" without saying which is older is not enough to choose. That comparison
 * is the entire decision.
 */
export function FileConflict({ name, existing, incoming, onKeepBoth, onReplace, onSkip, className }: {
  name: string;
  /** The one already here — "2.4 MB · 3 August". */
  existing: string;
  /** The one being added. */
  incoming: string;
  onKeepBoth: () => void;
  onReplace: () => void;
  onSkip: () => void;
  className?: string;
}) {
  return (
    <section role="alertdialog" aria-label={`${name} already exists`}
      className={cn("flex flex-col gap-3 rounded-md border border-border p-4", className)}>
      <div>
        <p className="text-sm font-medium">{name} is already here</p>
        <dl className="mt-1 text-sm text-muted-foreground">
          <div className="flex gap-2"><dt>Here now:</dt><dd>{existing}</dd></div>
          <div className="flex gap-2"><dt>Adding:</dt><dd>{incoming}</dd></div>
        </dl>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onKeepBoth}>Keep both</Button>
        <Button size="sm" variant="outline" onClick={onSkip}>Skip this one</Button>
        <Button size="sm" variant="outline" onClick={onReplace}>Replace</Button>
      </div>
    </section>
  );
}
