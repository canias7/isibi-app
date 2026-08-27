import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Delete — Are you sure? Yes / No", in place, without a dialog.
 *
 * FOR REVERSIBLE THINGS ONLY. An inline confirm is a speed bump, and the right
 * treatment for anything genuinely destructive is a dialog naming what will be
 * lost — or better, do it and offer Undo, which is what people actually want.
 * The header says so because reaching for this on a permanent delete is the
 * mistake it invites.
 *
 * It DISARMS on a timer and on blur. An armed button left on screen is a
 * hazard: somebody comes back, sees "Yes", and confirms something they have
 * forgotten they started.
 *
 * "No" gets FOCUS when it arms, not "Yes". The whole point of the second press
 * is to interrupt momentum, and putting the confirming button under the cursor
 * defeats it.
 *
 * The armed state is announced, because otherwise the only feedback that the
 * first press did anything is visual.
 */
export function ConfirmInline({
  label, confirmLabel = "Yes", cancelLabel = "No", question, onConfirm, disarmAfter = 4000, busy, className,
}: {
  label: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  question?: React.ReactNode;
  onConfirm: () => void;
  disarmAfter?: number;
  busy?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = React.useState(false);
  const no = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!armed) return;
    no.current?.focus();
    const t = setTimeout(() => setArmed(false), disarmAfter);
    return () => clearTimeout(t);
  }, [armed, disarmAfter]);

  if (!armed) {
    return (
      <button data-slot="confirm-inline" type="button" onClick={() => setArmed(true)} disabled={busy}
        className={cn("cursor-pointer rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-50", className)}>
        {label}
      </button>
    );
  }
  return (
    <span onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setArmed(false); }}
      className={cn("inline-flex items-center gap-2 text-xs", className)}>
      <span aria-live="polite">{question ?? "Are you sure?"}</span>
      <button type="button" onClick={() => { setArmed(false); onConfirm(); }} disabled={busy}
        className="cursor-pointer rounded-md bg-foreground px-2 py-1 font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-50">
        {busy ? "Working…" : confirmLabel}
      </button>
      <button ref={no} type="button" onClick={() => setArmed(false)}
        className="cursor-pointer rounded-md border border-border px-2 py-1 hover:bg-muted">
        {cancelLabel}
      </button>
    </span>
  );
}
