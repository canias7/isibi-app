import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * One field and Enter — add a row without opening anything.
 *
 * The field STAYS FOCUSED and empties after each add, because the whole point
 * is entering six things in a row. An implementation that closes, or that
 * leaves the text behind, turns six adds into six round trips through a dialog.
 *
 * Which is why the INPUT IS NEVER DISABLED — only the button is. Disabling it
 * while the add is in flight makes the `focus()` afterwards a no-op, because
 * focusing a disabled element does nothing, so focus lands on the body and the
 * next thing typed goes nowhere. Measured exactly that way: two items entered
 * in a row, one arrived. It also means the next item can be typed while the
 * previous one is still saving, which is what a fast entry loop actually does.
 *
 * It does not clear until the add has actually SUCCEEDED. Clearing optimistically
 * and then failing loses what somebody typed, with nothing left on screen to
 * retype it from.
 *
 * Blank and whitespace-only submissions are dropped silently rather than
 * refused. "You must enter something" in response to pressing Enter on an empty
 * box is an error message for a mistake nobody made.
 *
 * The COUNT of what has been added this sitting is shown, because in a fast
 * entry loop the rows scroll away and losing count means adding one twice.
 */
export function QuickAdd({
  onAdd, placeholder = "Add an item", label, busy, addedCount, hint, className,
}: {
  onAdd: (text: string) => void | Promise<unknown>;
  placeholder?: string;
  label?: React.ReactNode;
  busy?: boolean;
  addedCount?: number;
  hint?: React.ReactNode;
  className?: string;
}) {
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const ref = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const working = busy || pending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || working) return;
    setPending(true);
    try {
      await onAdd(t);
      setText("");
    } finally {
      setPending(false);
      ref.current?.focus();
    }
  };

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-1.5", className)}>
      {label ? <label htmlFor={id} className="text-sm font-medium">{label}</label> : null}
      <div className="flex gap-2">
        <input
          ref={ref}
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label={label ? undefined : placeholder}
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring"
        />
        <button type="submit" disabled={working || !text.trim()}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md bg-foreground px-3 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-40">
          <Plus aria-hidden className="size-3.5" />
          Add
        </button>
      </div>
      <p aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
        {addedCount ? `${addedCount} added.` : hint}
      </p>
    </form>
  );
}
