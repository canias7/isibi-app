import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/** Where an order has got to. Horizontal on wide screens, vertical on a phone. */
export function OrderTracker({ stages, current, className }: {
  stages: { label: string; at?: string }[]; current: number; className?: string;
}) {
  return (
    <ol data-slot="order-tracker" className={cn("flex flex-col gap-4 sm:flex-row sm:gap-2", className)}
      aria-label={`Stage ${current + 1} of ${stages.length}`}>
      {stages.map((s, i) => {
        const done = i < current, now = i === current;
        return (
          <li key={s.label} className="flex flex-1 items-center gap-3 sm:flex-col sm:items-start">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-xs tabular-nums",
              done && "border-success bg-success text-success-foreground", now && "border-foreground font-medium")}>
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <div className="min-w-0">
              <div className={cn("text-sm", now ? "font-medium" : "text-muted-foreground")}>{s.label}</div>
              {s.at && <div className="text-xs tabular-nums text-muted-foreground">{s.at}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
