import * as React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
/**
 * A statement and an agree–disagree scale.
 *
 * EVERY POINT IS LABELLED, not just the ends. An unlabelled middle circle
 * means different things to different people ("neither" vs "somewhat"), and
 * the variance that adds is invisible in the results. The default five are
 * the standard agreement labels; pass `pointLabels` matching `points` to
 * change them.
 *
 * ODD POINT COUNT, so a genuine midpoint exists. Removing the middle to
 * "force a lean" manufactures opinions people were not holding.
 *
 * NOTHING IS PRE-SELECTED — a default answer is the survey answering itself.
 *
 * A real RadioGroup underneath (arrow keys work); the visible circles are
 * styled by state, focus carried by a ring on the label.
 */
export const AGREEMENT_5 = ["Strongly disagree", "Disagree", "Neither", "Agree", "Strongly agree"];

export function LikertRow({ statement, value, onChange, points = 5, pointLabels, className }: {
  statement: React.ReactNode;
  value?: string;
  onChange: (v: string) => void;
  points?: 3 | 5 | 7;
  pointLabels?: string[];
  className?: string;
}) {
  const labels = pointLabels ?? (points === 5 ? AGREEMENT_5 : Array.from({ length: points }, (_, i) => String(i + 1)));
  return (
    <div data-slot="likert-row" className={cn("flex flex-col gap-2", className)}>
      <p className="text-sm font-medium">{statement}</p>
      <RadioGroup value={value ?? ""} onValueChange={onChange}
        className="grid gap-1" style={{ gridTemplateColumns: `repeat(${points}, minmax(0,1fr))` }}>
        {Array.from({ length: points }, (_, i) => {
          const v = String(i + 1);
          const on = value === v;
          return (
            <label key={v}
              className={cn("flex cursor-pointer flex-col items-center gap-1 rounded-md p-1.5 text-center",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring")}>
              <RadioGroupItem value={v} className="sr-only" />
              <span aria-hidden className={cn("size-4 rounded-full border border-foreground",
                on ? "bg-foreground" : "bg-transparent")} />
              <span className={cn("text-[10px] leading-tight", on ? "font-semibold" : "text-muted-foreground")}>
                {labels[i]}
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
