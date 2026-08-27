import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
/**
 * A textarea that says how much room is left.
 *
 * The counter is `aria-live="polite"` and only from 80% on: announcing every
 * keystroke makes a screen reader unusable, and a counter that shouts from
 * character one is noise.
 */
export function TextareaCount({ value, onChange, max = 500, id, rows = 4, placeholder, className }: {
  value: string; onChange: (v: string) => void; max?: number;
  id?: string; rows?: number; placeholder?: string; className?: string;
}) {
  const near = value.length >= max * 0.8;
  return (
    <div data-slot="textarea-count" className={cn("flex flex-col gap-1.5", className)}>
      <Textarea id={id} rows={rows} value={value} maxLength={max} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
      <span className={cn("self-end text-xs tabular-nums", near ? "text-foreground" : "text-muted-foreground")}
        aria-live={near ? "polite" : "off"}>
        {value.length} / {max}
      </span>
    </div>
  );
}
