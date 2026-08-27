import * as React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
/**
 * "It was easy to get what I needed" — the customer-effort question.
 *
 * THE STATEMENT IS THE STANDARD SHAPE, agree–disagree over "it was easy",
 * because effort predicts whether people come back better than delight does,
 * and the phrasing is what makes scores comparable month to month. It is a
 * prop — but change it knowingly, since a reworded question starts a new
 * baseline.
 *
 * SEVEN NUMBERED POINTS, ENDS LABELLED. Seven is the conventional CES width;
 * numbers on every point plus words at the ends is the honest middle between
 * labelling all seven (does not fit) and labelling none (means nothing).
 *
 * Same semantics discipline as likert-row: a real RadioGroup, nothing
 * pre-selected, selected state carried by fill.
 */
export function EffortScore({ statement = "It was easy to get what I needed", value, onChange, className }: {
  statement?: React.ReactNode;
  value?: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div data-slot="effort-score" className={cn("flex flex-col gap-2", className)}>
      <p className="text-sm font-medium">{statement}</p>
      <RadioGroup value={value ?? ""} onValueChange={onChange} className="flex gap-1">
        {Array.from({ length: 7 }, (_, i) => {
          const v = String(i + 1);
          const on = value === v;
          return (
            <label key={v}
              className={cn("flex size-9 cursor-pointer items-center justify-center rounded-md border text-sm tabular-nums",
                on ? "border-foreground bg-foreground font-semibold text-background" : "border-border hover:bg-muted",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring")}>
              <RadioGroupItem value={v} className="sr-only" />
              {v}
            </label>
          );
        })}
      </RadioGroup>
      <div className="flex justify-between text-[11px] text-muted-foreground" aria-hidden>
        <span>Strongly disagree</span>
        <span>Strongly agree</span>
      </div>
    </div>
  );
}
