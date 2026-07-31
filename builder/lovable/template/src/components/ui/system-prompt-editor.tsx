import * as React from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The instructions that sit behind every message.
 *
 * It says WHEN a change takes effect, because that is genuinely confusing:
 * saving does not change answers already given, and on most implementations it
 * does not change the conversation in progress either. Somebody who edits this
 * and sees the same behaviour concludes the setting does nothing.
 *
 * RESET TO DEFAULT is always available, and only enabled when the text
 * differs. This is the one field where a person can lock themselves out of
 * useful behaviour with a well-meant edit, and there is nothing on screen to
 * tell them the instructions are the cause.
 *
 * The length is shown against the limit, and it counts CHARACTERS while being
 * clear that the model counts tokens. A character count is honest about being
 * an approximation; a fabricated token count is not, since tokenising properly
 * needs the model's own vocabulary.
 *
 * Unsaved changes are marked. A textarea that silently keeps an edit nobody
 * saved is how somebody spends a week wondering why their instructions are
 * being ignored.
 */
export function SystemPromptEditor({
  value, onChange, onSave, onReset, defaultValue, saved, busy, max = 4000, rows = 8, className,
}: {
  value: string;
  onChange: (next: string) => void;
  onSave?: () => void;
  onReset?: () => void;
  defaultValue?: string;
  saved?: string;
  busy?: boolean;
  max?: number;
  rows?: number;
  className?: string;
}) {
  const id = React.useId();
  const dirty = saved != null && value !== saved;
  const changed = defaultValue != null && value !== defaultValue;
  const over = value.length > max;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">Instructions</label>
        {dirty ? <span className="text-xs font-medium">Unsaved</span> : null}
      </div>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-hint`}
        className={cn("resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs leading-relaxed outline-none",
          over ? "border-foreground" : "border-border focus-visible:border-ring")}
      />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p id={`${id}-hint`} className="min-w-0 flex-1 text-xs text-muted-foreground">
          Applies to new messages. Answers already given do not change.
        </p>
        <span className={cn("text-xs tabular-nums", over ? "font-medium" : "text-muted-foreground")}>
          {value.length.toLocaleString()} / {max.toLocaleString()} characters
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {onSave ? (
          <button type="button" onClick={onSave} disabled={busy || over || !dirty}
            className="cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-40">
            {busy ? "Saving…" : "Save"}
          </button>
        ) : null}
        {onReset ? (
          <button type="button" onClick={onReset} disabled={busy || !changed}
            className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:pointer-events-none disabled:opacity-40">
            <RotateCcw aria-hidden className="size-3" />
            Reset to the default
          </button>
        ) : null}
      </div>
    </div>
  );
}
