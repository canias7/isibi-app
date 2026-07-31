import { cn } from "@/lib/utils";
/**
 * Size or colour options.
 *
 * Real radio inputs behind the swatches, so arrow keys work and the choice is
 * submitted with the form. Unavailable options stay VISIBLE and disabled rather
 * than disappearing — a size vanishing between visits is confusing.
 */
export function VariantPicker({ name, label, options, value, onChange, className }: {
  name: string; label: string;
  options: { value: string; label: string; disabled?: boolean }[];
  value?: string; onChange: (v: string) => void; className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value}
            className={cn("cursor-pointer rounded-md border px-3 py-1.5 text-sm",
              value === o.value && "border-foreground bg-foreground text-background",
              o.disabled && "cursor-not-allowed text-muted-foreground line-through opacity-60")}>
            <input type="radio" name={name} value={o.value} checked={value === o.value}
              disabled={o.disabled} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
