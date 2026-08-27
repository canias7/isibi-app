import { cn } from "@/lib/utils";
/**
 * What the assistant is allowed to look at, stated before it runs.
 *
 * SCOPE IS A CHOICE PEOPLE MAKE ONCE AND THEN FORGET, which is exactly why it
 * has to stay visible. "Summarise this" against one document and against an
 * entire account are different requests with different privacy consequences,
 * and a hidden default silently picks one.
 *
 * A REAL RADIO GROUP, so arrow keys move between options and a screen reader
 * announces "2 of 3". The usual implementation is a row of divs with onClick,
 * which is unreachable without a mouse.
 *
 * EACH OPTION CARRIES A COUNT where the caller has one — "This page" and "All
 * 1,240 records" are the same sentence structure carrying wildly different
 * meaning, and the number is what makes the difference land.
 *
 * The widest option is never the default the component picks; `value` is the
 * caller's, and the caller should start narrow.
 */
export type AiScope = { id: string; label: string; hint?: string; count?: number; disabled?: boolean };

export function AiScopePicker({ scopes, value, onChange, name = "ai-scope", legend = "Include", className }: {
  scopes: AiScope[];
  value: string;
  onChange: (id: string) => void;
  name?: string;
  legend?: string;
  className?: string;
}) {
  return (
    <fieldset data-slot="ai-scope-picker" className={cn("space-y-1.5", className)}>
      <legend className="mb-1 text-xs font-medium text-muted-foreground">{legend}</legend>
      {scopes.map((s) => (
        <label key={s.id}
          className={cn("flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2 text-sm",
            value === s.id && "border-foreground bg-muted/40",
            s.disabled && "cursor-not-allowed opacity-50")}>
          <input type="radio" name={name} value={s.id} checked={value === s.id} disabled={s.disabled}
            onChange={() => onChange(s.id)} className="mt-0.5 size-4 accent-foreground" />
          <span className="min-w-0">
            <span className="block">
              {s.label}
              {s.count !== undefined && (
                <span className="ms-1.5 tabular-nums text-muted-foreground">{s.count.toLocaleString()}</span>
              )}
            </span>
            {s.hint && <span className="block text-xs text-muted-foreground">{s.hint}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
