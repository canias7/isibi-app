import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/**
 * Move the inputs, watch the number. A quote estimator, a savings projection,
 * a "how much would I need" panel.
 *
 * IT DOES NOT CALCULATE ANYTHING. The caller passes `result`, because the sum
 * is the one part that differs per site and a component that owns it is a
 * feature with a data model wearing a component's coat. This owns the layout,
 * the accessibility and the honesty line — which is all of the part that gets
 * rebuilt inline every time and none of the part worth arguing about.
 *
 * The result is a real `<output>` with `aria-live="polite"`. That is the whole
 * accessibility of this pattern: the visible effect of dragging a slider is a
 * number changing somewhere else on the screen, and without a live region a
 * screen-reader user gets silence and has no way to discover the thing
 * happened. Polite, not assertive, or every pixel of a drag interrupts.
 *
 * Each field is a slider AND a number box, bound together. The slider is for
 * exploring and the box is for the person who already knows they want 7. The
 * box is `inputMode="decimal"`, never `numeric` — a numeric keypad cannot type
 * 4.5, which is the `currency-input` lesson.
 *
 * `footnote` exists so an estimate can say it is one. A number this confident
 * with no qualifier is read as a quote, and then somebody is owed it.
 */
export type CalcField = {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  /** Shown after the value — "people", "months", "m²". */
  unit?: string;
};

export function CalculatorCard({
  title, fields, values, onChange, result, footnote, className,
}: {
  title?: string;
  fields: CalcField[];
  values: Record<string, number>;
  onChange: (key: string, value: number) => void;
  /** The answer. Computed by the caller. */
  result: { label: string; value: React.ReactNode; note?: string };
  footnote?: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  if (!fields.length) return null;

  return (
    <section data-slot="calculator-card" className={cn("flex flex-col gap-5 rounded-md border border-border p-6", className)}>
      {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
      <div className="flex flex-col gap-4">
        {fields.map((f) => {
          const fid = `${id}-${f.key}`;
          const value = values[f.key] ?? f.min;
          return (
            <div key={f.key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={fid}>{f.label}</Label>
                <div className="flex items-center gap-1.5">
                  <input
                    id={`${fid}-n`} type="number" inputMode="decimal"
                    min={f.min} max={f.max} step={f.step ?? 1} value={value}
                    aria-label={`${f.label}, exact value`}
                    onChange={(e) => onChange(f.key, Number(e.target.value))}
                    className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-end text-sm tabular-nums"
                  />
                  {f.unit && <span className="text-sm text-muted-foreground">{f.unit}</span>}
                </div>
              </div>
              <input
                id={fid} type="range"
                min={f.min} max={f.max} step={f.step ?? 1} value={value}
                onChange={(e) => onChange(f.key, Number(e.target.value))}
                className="w-full cursor-pointer accent-foreground"
              />
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-1 border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">{result.label}</span>
        <output htmlFor={fields.map((f) => `${id}-${f.key}`).join(" ")} aria-live="polite"
          className="text-3xl font-semibold tracking-tight tabular-nums">
          {result.value}
        </output>
        {result.note && <span className="text-sm text-muted-foreground">{result.note}</span>}
      </div>
      {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
    </section>
  );
}
