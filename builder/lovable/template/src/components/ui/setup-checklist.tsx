import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "3 of 5 done" — the setup list.
 *
 * A finished step keeps its row, struck through, rather than disappearing:
 * a list that shrinks as you work makes it impossible to see what you did.
 */
export function SetupChecklist({ steps, title = "Get set up", className }: {
  steps: { label: string; done?: boolean; action?: string; onAction?: () => void }[];
  title?: string; className?: string;
}) {
  const done = steps.filter((s) => s.done).length;
  return (
    <div data-slot="setup-checklist" className={cn("rounded-lg border border-border p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{done} of {steps.length}</span>
      </div>
      <Progress value={(done / (steps.length || 1)) * 100} className="mt-2 h-1.5"
        aria-label={`${title}: ${done} of ${steps.length} done`} />
      <ul className="mt-3 space-y-1">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 py-1.5 text-sm">
            <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border",
              s.done ? "border-transparent bg-foreground text-background" : "border-border")}>
              {s.done && <Check className="size-3" />}
            </span>
            <span className={cn("min-w-0 flex-1", s.done && "text-muted-foreground line-through")}>{s.label}</span>
            {!s.done && s.action && s.onAction && (
              <Button size="sm" variant="link" className="h-auto p-0" onClick={s.onAction}>{s.action}</Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
