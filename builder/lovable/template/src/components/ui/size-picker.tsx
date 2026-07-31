import { cn } from "@/lib/utils";
/**
 * A small set of named sizes — S/M/L, or a t-shirt size, or a spacing step.
 *
 * A SEGMENTED CONTROL, not a dropdown, because the options are few and the
 * comparison between them is the decision. A select hides four of five
 * choices behind a click.
 *
 * An unavailable option stays visible, disabled and struck through — a size
 * that vanishes when out of stock leaves somebody wondering whether it ever
 * existed, and the strike-through says "not now" rather than "not a thing".
 */
export function SizePicker({ options, value, onChange, label, className }: {
  options: { value: string; label: string; disabled?: boolean; note?: string }[];
  value?: string | null; onChange: (v: string) => void; label?: string; className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)} role="group" aria-label={label}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.value} type="button" disabled={o.disabled} aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn("min-w-11 cursor-pointer rounded-md border px-3 py-1.5 text-sm",
              o.disabled && "cursor-not-allowed border-border text-muted-foreground line-through opacity-60",
              !o.disabled && o.value === value && "border-foreground bg-foreground text-background",
              !o.disabled && o.value !== value && "border-border hover:bg-muted")}>
            {o.label}
          </button>
        ))}
      </div>
      {options.find((o) => o.value === value)?.note && (
        <p className="text-xs text-muted-foreground">{options.find((o) => o.value === value)?.note}</p>
      )}
    </div>
  );
}
