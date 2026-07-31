import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Type a word, press Enter, get a chip.
 *
 * Backspace on an empty box removes the last chip, which is the behaviour
 * everybody tries first. Comma commits as well as Enter, because a list of
 * tags is something people paste. Duplicates are dropped silently rather than
 * erroring — adding a tag twice means you want it, not that you made a mistake.
 */
export function TagInput({ value, onChange, placeholder = "Add a tag…", max, id, className }: {
  value: string[]; onChange: (tags: string[]) => void;
  placeholder?: string; max?: number; id?: string; className?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const full = max != null && value.length >= max;
  const commit = (raw: string) => {
    const t = raw.trim();
    if (!t || full) return;
    if (!value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 rounded-md border border-input px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/40", className)}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded bg-muted py-0.5 pl-2 pr-1 text-sm">
          {t}
          <button type="button" onClick={() => onChange(value.filter((v) => v !== t))}
            aria-label={`Remove ${t}`} className="cursor-pointer rounded p-0.5 hover:bg-background">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input id={id} value={draft} placeholder={full ? `${max} is the limit` : placeholder} disabled={full}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(draft); }
          else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }} />
    </div>
  );
}
