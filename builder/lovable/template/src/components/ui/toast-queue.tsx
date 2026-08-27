import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The queue behind `toast-stack` — the policy about what gets shown and what
 * gets merged.
 *
 * IDENTICAL MESSAGES COALESCE INTO A COUNT rather than repeating. A retry loop
 * that fails eight times produces one toast reading "Could not save (8)", not
 * eight stacked copies of the same sentence — which is the single most common
 * way a toast system becomes unusable.
 *
 * PRIORITY JUMPS THE QUEUE, and only errors have it. A failure behind four
 * "saved" confirmations is a failure nobody sees until the confirmations have
 * timed out.
 *
 * The queue is BOUNDED. An unbounded one accumulates for the life of the tab
 * during an outage, and then shows a hundred toasts the moment the connection
 * comes back.
 *
 * Merging is by a `dedupeKey` the caller supplies, not by comparing rendered
 * text — two different bookings failing should be two toasts, and their
 * messages may well be identical.
 */
export type QueuedToast = {
  id: string;
  title: React.ReactNode;
  detail?: React.ReactNode;
  dedupeKey?: string;
  priority?: boolean;
  count?: number;
};

export function useToastQueue(max = 20) {
  const [queue, setQueue] = React.useState<QueuedToast[]>([]);
  const next = React.useRef(0);

  const push = React.useCallback((t: Omit<QueuedToast, "id">) => {
    setQueue((prev) => {
      // Same key means the same event happening again: count it, do not repeat it.
      if (t.dedupeKey) {
        const at = prev.findIndex((p) => p.dedupeKey === t.dedupeKey);
        if (at >= 0) {
          const copy = prev.slice();
          copy[at] = { ...copy[at], count: (copy[at].count ?? 1) + 1 };
          return copy;
        }
      }
      const item = { ...t, id: `t${next.current++}` };
      // Errors go to the front; a failure behind four confirmations is unseen.
      const merged = t.priority ? [item, ...prev] : [...prev, item];
      return merged.slice(0, max);
    });
  }, [max]);

  const dismiss = React.useCallback((id: string) => setQueue((q) => q.filter((x) => x.id !== id)), []);
  const clear = React.useCallback(() => setQueue([]), []);
  return { queue, push, dismiss, clear };
}

export function ToastQueueItem({ toast, onDismiss, className }: {
  toast: QueuedToast;
  onDismiss: () => void;
  className?: string;
}) {
  return (
    <li data-slot="toast-queue-item" className={cn("flex items-start gap-3 rounded-lg border border-border bg-background p-3 shadow-lg", className)}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {toast.title}
          {toast.count && toast.count > 1 ? (
            <span className="ms-1.5 text-xs font-normal text-muted-foreground tabular-nums">({toast.count})</span>
          ) : null}
        </p>
        {toast.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{toast.detail}</p> : null}
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss"
        className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
        &times;
      </button>
    </li>
  );
}
