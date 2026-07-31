import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Several toasts at once, without covering the screen.
 *
 * IT IS CAPPED, and the excess is counted rather than queued. A loop that fires
 * forty toasts — a failed save retried, a batch operation reporting each item —
 * otherwise covers the entire viewport with notices about one thing.
 *
 * A toast with an ACTION does not auto-dismiss. "Deleted — Undo" that vanishes
 * after four seconds is an undo nobody can reach, which is the failure that
 * makes people stop trusting the pattern. Anything with a button waits.
 *
 * The timer PAUSES on hover and on focus. Somebody reading a message is the one
 * person who should not have it taken away, and without the focus half a
 * keyboard user can never reach the action before it goes.
 *
 * `role="status"` with `aria-live="polite"`, never `alert`: a toast that
 * interrupts whatever is being read, for something that did not fail, is the
 * most disliked thing on any page.
 */
export type Toast = { id: string; title: React.ReactNode; detail?: React.ReactNode; action?: { label: string; onAction: () => void }; duration?: number };

export function useToasts(max = 3) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((t: Omit<Toast, "id"> & { id?: string }) => {
    const id = t.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((xs) => [...xs, { ...t, id }]);
    return id;
  }, []);
  const dismiss = React.useCallback((id: string) => setToasts((xs) => xs.filter((x) => x.id !== id)), []);
  const clear = React.useCallback(() => setToasts([]), []);
  return { toasts, push, dismiss, clear, max };
}

function Item({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [paused, setPaused] = React.useState(false);
  // Anything with an action waits for a decision.
  const ms = toast.action ? 0 : (toast.duration ?? 5000);

  React.useEffect(() => {
    if (!ms || paused) return;
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
  }, [ms, paused, onDismiss]);

  return (
    <li
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="motion-enter pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-background p-3 shadow-lg"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{toast.detail}</p> : null}
      </div>
      {toast.action ? (
        <button type="button" onClick={() => { toast.action?.onAction(); onDismiss(); }}
          className="shrink-0 cursor-pointer rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted">
          {toast.action.label}
        </button>
      ) : null}
      <button type="button" onClick={onDismiss} aria-label="Dismiss"
        className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
        <X aria-hidden className="size-3.5" />
      </button>
    </li>
  );
}

export function ToastStack({ toasts, onDismiss, onClear, max = 3, className }: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  onClear?: () => void;
  max?: number;
  className?: string;
}) {
  if (toasts.length === 0) return null;
  const shown = toasts.slice(-max);
  const extra = toasts.length - shown.length;
  return (
    <ol role="status" aria-live="polite"
      className={cn("pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2", className)}>
      {extra > 0 ? (
        <li className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs">
          <span className="flex-1">{extra} more {extra === 1 ? "notice" : "notices"}</span>
          {onClear ? (
            <button type="button" onClick={onClear}
              className="cursor-pointer underline underline-offset-2">Clear all</button>
          ) : null}
        </li>
      ) : null}
      {shown.map((t) => <Item key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />)}
    </ol>
  );
}
