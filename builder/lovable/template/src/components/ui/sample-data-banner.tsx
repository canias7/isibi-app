import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "These are examples." Says so on the page rather than in a tooltip, because
 * the failure this prevents is somebody sending a customer a demo invoice.
 */
export function SampleDataBanner({ label = "This is sample data, added so the page has something to show.",
  actionLabel = "Clear samples", onAction, className }: {
  label?: string; actionLabel?: string; onAction?: () => void; className?: string;
}) {
  return (
    <div data-slot="sample-data-banner" className={cn("flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      {onAction && <Button size="sm" variant="outline" onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}
