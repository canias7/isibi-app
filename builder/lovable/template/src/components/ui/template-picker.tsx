import { cn } from "@/lib/utils";
/**
 * Choosing a starting point, with "start from nothing" kept as a real option.
 *
 * THE BLANK OPTION IS FIRST AND EXPLICIT. A picker that only offers templates
 * traps somebody whose case fits none of them into deleting their way out of
 * the closest one, which is slower than starting empty and leaves stray fields
 * behind. It is a legitimate choice, so it looks like one.
 *
 * EACH TEMPLATE SAYS WHAT IT IS FOR, not what it contains. "Weekly team update"
 * is choosable; "3 sections, 2 tables" is an inventory somebody has to
 * translate. The counts go in `detail` where they help, never instead.
 *
 * A REAL RADIO GROUP, so arrow keys move and a screen reader announces "3 of
 * 7". The universal implementation is a grid of clickable cards, unreachable
 * without a mouse.
 *
 * `usedCount` earns its place because popularity is the most reliable signal a
 * chooser has when every option is unfamiliar — but it is shown only where the
 * caller has it, never faked as "Popular".
 */
export type TemplateOption = { id: string; name: string; purpose?: string; detail?: string; usedCount?: number };

export function TemplatePicker({ templates, value, onChange, blankLabel = "Start from scratch", blankPurpose = "An empty one, nothing filled in", name = "template", className }: {
  templates: TemplateOption[];
  /** "" selects the blank option. */
  value: string;
  onChange: (id: string) => void;
  blankLabel?: string;
  blankPurpose?: string;
  name?: string;
  className?: string;
}) {
  const options: TemplateOption[] = [{ id: "", name: blankLabel, purpose: blankPurpose }, ...templates];
  return (
    <fieldset data-slot="template-picker" className={cn("space-y-1.5", className)}>
      <legend className="sr-only">Start from</legend>
      {options.map((t) => (
        <label key={t.id || "blank"}
          className={cn("flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm",
            value === t.id && "border-foreground bg-muted/40")}>
          <input type="radio" name={name} value={t.id} checked={value === t.id}
            onChange={() => onChange(t.id)} className="mt-0.5 size-4 accent-foreground" />
          <span className="min-w-0">
            <span className="block font-medium">{t.name}</span>
            {t.purpose && <span className="block text-muted-foreground">{t.purpose}</span>}
            <span className="block text-xs text-muted-foreground">
              {t.detail}
              {t.detail && t.usedCount !== undefined ? " · " : ""}
              {t.usedCount !== undefined && `used ${t.usedCount.toLocaleString()} times`}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
