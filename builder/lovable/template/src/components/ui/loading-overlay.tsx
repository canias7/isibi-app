import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
/**
 * Covers its container while something is in flight.
 *
 * The content stays mounted underneath rather than being swapped for a spinner,
 * so the page does not jump and scroll position survives.
 */
export function LoadingOverlay({ busy, label = "Loading…", className, children }: {
  busy: boolean; label?: string; className?: string; children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative", className)}>
      <div className={cn(busy && "pointer-events-none opacity-50")} aria-busy={busy}>{children}</div>
      {busy && (
        <div className="absolute inset-0 grid place-items-center" role="status">
          <span className="flex items-center gap-2 rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
            <Spinner /> {label}
          </span>
        </div>
      )}
    </div>
  );
}
