import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The empty state of a list nobody has used yet.
 *
 * Distinct from `Empty`, which means "your filter matched nothing": this one
 * means "there is nothing here yet, and here is how the first one gets made".
 * Telling those apart is the difference between a working search and a broken app.
 */
export function FirstRun({ title, body, action, onAction, secondary, onSecondary, icon, className }: {
  title: string; body?: string; action?: string; onAction?: () => void;
  secondary?: string; onSecondary?: () => void; icon?: React.ReactNode; className?: string;
}) {
  return (
    <div data-slot="first-run" className={cn("flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-12 text-center", className)}>
      {icon && <span className="mb-3 text-muted-foreground">{icon}</span>}
      <h3 className="text-base font-medium">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {action && onAction && <Button onClick={onAction}>{action}</Button>}
        {secondary && onSecondary && <Button variant="ghost" onClick={onSecondary}>{secondary}</Button>}
      </div>
    </div>
  );
}
