import { cn } from "@/lib/utils";
/**
 * The blanks a template leaves, filled in before it is used.
 *
 * EVERY VARIABLE SHOWS ITS PLACEHOLDER TOKEN. Somebody filling in "Customer
 * name" needs to know it is `{{customer}}` when the output comes out wrong, and
 * hiding the token means the only way to debug a template is to open it.
 *
 * REQUIRED ONES ARE LISTED FIRST AND MARKED IN WORDS. A template used with a
 * required blank still empty produces a document containing the literal
 * `{{customer}}` — which gets sent, and is the single most visible failure this
 * pattern has.
 *
 * A DEFAULT IS SHOWN AS A PLACEHOLDER, NOT PRE-FILLED. Pre-filling makes
 * somebody unable to tell what they chose from what the template guessed, and
 * an unreviewed default going out as fact is the quieter version of the same
 * failure.
 *
 * Real `<label htmlFor>` per row, with the description as the field's
 * `aria-describedby` rather than loose text a screen reader never connects.
 */
export type TemplateVariable = {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
};

export function TemplateVariables({ variables, values, onChange, tokenFormat = (k) => `{{${k}}}`, className }: {
  variables: TemplateVariable[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** How the token appears in the template body. */
  tokenFormat?: (key: string) => string;
  className?: string;
}) {
  const sorted = [...variables].sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)));
  return (
    <div className={cn("space-y-3", className)}>
      {sorted.map((v) => (
        <div key={v.key} className="space-y-1">
          <label htmlFor={`tv-${v.key}`} className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
            {v.label}
            {v.required
              ? <span className="text-xs font-normal text-muted-foreground">required</span>
              : <span className="text-xs font-normal text-muted-foreground">optional</span>}
            <code className="text-xs font-normal text-muted-foreground">{tokenFormat(v.key)}</code>
          </label>
          <input id={`tv-${v.key}`} required={v.required}
            aria-describedby={v.description ? `tv-${v.key}-d` : undefined}
            value={values[v.key] ?? ""} placeholder={v.placeholder}
            onChange={(e) => onChange(v.key, e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
          {v.description && <p id={`tv-${v.key}-d`} className="text-xs text-muted-foreground">{v.description}</p>}
        </div>
      ))}
    </div>
  );
}
