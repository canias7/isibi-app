import { cn } from "@/lib/utils";
/**
 * A spacing scale, shown as bars with their values.
 *
 * THE STEPS ARE SHOWN NEXT TO EACH OTHER, which is the only way to judge a
 * scale. Individually every value looks reasonable; side by side it is obvious
 * when two steps are too close to be worth having — and an unused step is a
 * decision somebody makes badly, every time.
 *
 * PIXELS ARE PRINTED BESIDE THE NAME. A scale named `sm`, `md`, `lg` is
 * unusable for judging whether the jump from 12 to 16 is right, and the numbers
 * are what somebody compares against a design.
 *
 * IT MARKS THE TOUCH MINIMUM. Anything below about 44px is too small to hit
 * reliably on a phone, and a spacing scale is where somebody decides a row's
 * padding — so the line belongs here rather than being discovered in testing.
 *
 * BARS RATHER THAN NESTED BOXES, because a box model demo confuses margin with
 * padding and the question here is only about the sizes of the steps.
 */
export function SpacingPreview({ steps, touchMinimum = 44, className }: {
  steps: { name: string; px: number }[];
  touchMinimum?: number;
  className?: string;
}) {
  const max = Math.max(...steps.map((s) => s.px), 1);
  return (
    <ul data-slot="spacing-preview" className={cn("space-y-1", className)}>
      {steps.map((s) => (
        <li key={s.name} className="flex items-center gap-3 text-sm">
          <span className="w-12 shrink-0 text-xs text-muted-foreground">{s.name}</span>
          <span className="w-10 shrink-0 text-end text-xs tabular-nums">{s.px}px</span>
          <span aria-hidden="true" style={{ width: `${(s.px / max) * 100}%` }}
            className="h-3 rounded-sm bg-foreground" />
          {s.px >= touchMinimum && (
            <span className="shrink-0 text-xs text-muted-foreground">big enough to tap</span>
          )}
        </li>
      ))}
    </ul>
  );
}
