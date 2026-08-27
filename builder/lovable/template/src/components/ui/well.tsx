import { cn } from "@/lib/utils";
/** A recessed area — for a nested form or a quoted block of detail. */
export function Well({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div data-slot="well" className={cn("rounded-lg bg-muted/50 p-4", className)}>{children}</div>;
}
