import { useRef } from "react";
import { cn } from "@/lib/utils";
/**
 * The copy button's fallback: the text, selectable, when copying fails.
 *
 * `navigator.clipboard` FAILS MORE OFTEN THAN PEOPLE EXPECT — it needs a secure
 * context, so it is absent on plain HTTP, it is refused outside a user gesture,
 * and Safari rejects it after any await in the handler. A copy button that
 * silently does nothing is how somebody loses an API key or a booking reference
 * they cannot retype from memory.
 *
 * IT SELECTS THE TEXT ON MOUNT, so the reader's own copy shortcut works
 * immediately. That is the actual fallback — telling somebody "copying failed"
 * without putting the text in front of them, selected, leaves them worse off
 * than no button at all.
 *
 * `readOnly` RATHER THAN `disabled`, because a disabled input cannot be
 * selected or focused, which would defeat the entire purpose. The value stays
 * uneditable either way.
 *
 * A `<textarea>` for long values so they wrap rather than scrolling sideways
 * inside a one-line box — a truncated key looks complete and is not.
 *
 * AN EMPTY `label` RENDERS NO PARAGRAPH AT ALL. Callers that already label the
 * field themselves — `domain-verify` puts these under a `<dt>` — pass "", and
 * an empty `<p>` there is a stray gap in the middle of a definition list.
 */
export function ClipboardBlocked({ value, label = "Copying is not available here — select and copy this yourself", multiline, className }: {
  value: string;
  label?: string;
  multiline?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const select = (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    ref.current = el;
    el?.select();
  };
  return (
    <div className={cn("space-y-1", className)}>
      {label ? <p className="text-xs text-muted-foreground">{label}</p> : null}
      {multiline ? (
        <textarea ref={select} readOnly value={value} rows={3} aria-label="Value to copy"
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 font-mono text-xs" />
      ) : (
        <input ref={select} readOnly value={value} aria-label="Value to copy"
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 font-mono text-xs" />
      )}
    </div>
  );
}
