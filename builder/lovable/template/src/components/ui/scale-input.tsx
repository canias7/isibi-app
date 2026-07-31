import { cn } from "@/lib/utils";
/**
 * An agree-to-disagree scale.
 *
 * BOTH ends are labelled and the labels stay visible — a row of five circles
 * with "Strongly agree" only over the last one is read backwards by about as
 * many people as read it forwards.
 *
 * A real radio group, so arrow keys work. The usual div-with-onClick version
 * of this control cannot be answered from a keyboard at all.
 */
export function ScaleInput({ name, value, onChange, points = 5, lowLabel, highLabel, className }: {
  name: string; value?: number | null; onChange: (v: number) => void;
  points?: number; lowLabel?: string; highLabel?: string; className?: string;
}) {
  return (
    // `w-full min-w-0` is load bearing: a <fieldset> sizes to min-content and
    // does NOT fill a flex parent the way a div does, so `justify-between` had
    // no room and both end labels sat together on the left — which reverses the
    // meaning of the scale for anyone reading the labels rather than the numbers.
    <fieldset className={cn("w-full min-w-0 space-y-2", className)}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{lowLabel}</span><span>{highLabel}</span>
      </div>
      <div className="flex justify-between gap-1">
        {Array.from({ length: points }, (_, i) => {
          const v = i + 1;
          const id = `${name}-${v}`;
          return (
            <label key={v} htmlFor={id}
              className={cn("flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-md border py-2 text-xs tabular-nums transition-colors",
                value === v ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
              <input id={id} type="radio" name={name} value={v} checked={value === v}
                onChange={() => onChange(v)} className="sr-only" />
              {v}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
