import { cn } from "@/lib/utils";
/** Zero to ten. Real radios, and the anchors are labelled at both ends. */
export function NpsScale({ name = "nps", value, onChange,
  lowLabel = "Not likely", highLabel = "Very likely", className }: {
  name?: string; value?: number; onChange: (n: number) => void;
  lowLabel?: string; highLabel?: string; className?: string;
}) {
  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      <div className="flex gap-1">
        {Array.from({ length: 11 }, (_, n) => (
          <label key={n}
            className={cn("flex flex-1 cursor-pointer items-center justify-center rounded border py-2 text-sm tabular-nums",
              value === n ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>
            <input type="radio" name={name} value={n} checked={value === n}
              onChange={() => onChange(n)} className="sr-only" />
            {n}
          </label>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{lowLabel}</span><span>{highLabel}</span>
      </div>
    </fieldset>
  );
}
