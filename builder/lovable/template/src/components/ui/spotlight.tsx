import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Dims the page and lifts one thing out of it.
 *
 * The highlighted child keeps its place in the layout — it is raised with
 * z-index and a ring, not moved into a portal — so nothing reflows when the
 * tour starts and the arrow pointing at it does not end up pointing at a gap.
 */
export function Spotlight({ active, onDismiss, children, className }: {
  active: boolean; onDismiss?: () => void; children?: React.ReactNode; className?: string;
}) {
  return (
    <>
      {active && (
        <div className="fixed inset-0 z-40 bg-foreground/40" onClick={onDismiss}
          role="presentation" aria-hidden="true" />
      )}
      <div className={cn("relative", active && "z-50 rounded-lg ring-4 ring-background", className)}>
        {children}
      </div>
    </>
  );
}
