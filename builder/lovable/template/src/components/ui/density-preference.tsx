import * as React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
/**
 * Comfortable / compact — with the difference SHOWN.
 *
 * THE PREVIEW IS THE SAME THREE ROWS AT BOTH DENSITIES, drawn live in each
 * option. "Compact" as a word means nothing measurable; two identical lists
 * where one is visibly shorter is the whole question answered before
 * choosing.
 *
 * THE VALUE IS THE CALLER'S TO APPLY — deliberately no root class written
 * from here. The reduce-motion lesson: a toggle that writes a class nothing
 * reads ships wired to nothing, and whether density is a class, a token or
 * a prop is the app's architecture, not this picker's.
 *
 * Two options only. "Cozy" between them is a third answer to a question
 * with two: is there more information or more air?
 */
const ROWS = ["Ada — Sat 14:00", "Alan — Sat 15:00", "Grace — Thu 11:00"];

export function DensityPreference({ value = "comfortable", onChange, className }: {
  value?: "comfortable" | "compact";
  onChange: (v: "comfortable" | "compact") => void;
  className?: string;
}) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as "comfortable" | "compact")}
      className={cn("flex gap-2", className)}>
      {(["comfortable", "compact"] as const).map((d) => (
        <label key={d}
          className={cn("flex w-40 cursor-pointer flex-col gap-1.5 rounded-lg border p-2.5",
            value === d ? "border-foreground" : "border-border hover:bg-muted/50",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring")}>
          <RadioGroupItem value={d} className="sr-only" />
          {/* The same rows at this density - the preview is the definition. */}
          <span aria-hidden className="overflow-hidden rounded border border-border">
            {ROWS.map((r) => (
              <span key={r} className={cn("block truncate border-b border-border px-1.5 text-[9px] last:border-0",
                d === "comfortable" ? "py-1.5" : "py-0.5")}>
                {r}
              </span>
            ))}
          </span>
          <span className={cn("text-xs capitalize", value === d ? "font-semibold" : "text-muted-foreground")}>{d}</span>
        </label>
      ))}
    </RadioGroup>
  );
}
