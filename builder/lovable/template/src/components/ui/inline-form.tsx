import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Edit one value where it sits — click the text, a form appears in its place,
 * save or cancel.
 *
 * It is a real `<form>`, so Enter submits. An inline editor built from a div
 * and two buttons has to hand-wire Enter, and the version that forgets is the
 * one where every save needs a deliberate click on a small button.
 *
 * The buttons are BELOW the field, not beside it, and Cancel is a plain link
 * rather than a second button of equal weight. Side by side in a table cell
 * they fight the field for width, and two equal buttons is how somebody
 * discards an edit they meant to keep.
 *
 * Focus moves INTO the form when it opens and back to the trigger when it
 * closes — without that, cancelling drops focus onto `<body>` and a keyboard
 * user is thrown to the top of the page.
 *
 * `busy` is honoured, because the save is a network call and a second Enter
 * press submits it twice. Same reason `busy-button` exists.
 */
export function InlineForm({
  value, onSave, onCancel, open, onOpen, render, busy, error, label, className,
}: {
  value: React.ReactNode;
  onSave: () => void;
  onCancel?: () => void;
  open: boolean;
  onOpen: () => void;
  render: () => React.ReactNode;
  busy?: boolean;
  error?: React.ReactNode;
  label?: string;
  className?: string;
}) {
  const trigger = React.useRef<HTMLButtonElement>(null);
  const box = React.useRef<HTMLFormElement>(null);
  const was = React.useRef(open);

  React.useEffect(() => {
    if (open && !was.current) box.current?.querySelector<HTMLElement>("input, textarea, select")?.focus();
    if (!open && was.current) trigger.current?.focus();
    was.current = open;
  }, [open]);

  if (!open) {
    return (
      <button ref={trigger} type="button" onClick={onOpen}
        aria-label={label ? `Edit ${label}` : undefined}
        className={cn("w-full cursor-text rounded-sm px-2 py-1 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring", className)}>
        {value}
      </button>
    );
  }
  return (
    <form ref={box} className={cn("flex flex-col gap-2", className)}
      onSubmit={(e) => { e.preventDefault(); if (!busy) onSave(); }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onCancel?.(); } }}>
      {render()}
      {error ? <p role="alert" className="text-xs font-medium">{error}</p> : null}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy}
          className="cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}
          className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:pointer-events-none disabled:opacity-60">
          Cancel
        </button>
      </div>
    </form>
  );
}
