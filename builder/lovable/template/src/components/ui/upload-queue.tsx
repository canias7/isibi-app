import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Several files going up — bounded concurrency, per-file fates.
 *
 * TWO AT A TIME. Firing twenty uploads at once starves them all and the
 * progress bars crawl in lockstep; a small fixed window keeps each
 * visible transfer honest. Order is preserved — people expect the list
 * they added.
 *
 * A FAILURE IS PER FILE AND RETRYABLE PER FILE (the attachment-tray
 * rule at queue scale): one refused .exe must not take four photos down
 * with it, and "retry all" re-runs only the failed. The summary counts
 * fates separately — "3 done · 1 failed" — because a single progress
 * number averages over the one thing that needs attention.
 *
 * `send` is injected and resolves per file; the queue never interprets
 * WHY a file failed — the caller's message rides on the row.
 *
 * Where it differs from chunked-upload: this is MANY files, whole;
 * that is ONE file, in pieces. They compose (send may itself chunk).
 */
export type QueuedFile = { id: string; file: File; status: "waiting" | "uploading" | "done" | "failed"; note?: string };

export function useUploadQueue(send: (file: File) => Promise<{ ok: boolean; note?: string }>, concurrency = 2) {
  const [items, setItems] = React.useState<QueuedFile[]>([]);
  const active = React.useRef(0);
  const sendRef = React.useRef(send);
  sendRef.current = send;

  const pump = React.useCallback(() => {
    setItems((cur) => {
      const next = [...cur];
      for (const it of next) {
        if (active.current >= concurrency) break;
        if (it.status !== "waiting") continue;
        it.status = "uploading";
        active.current += 1;
        void sendRef.current(it.file).then((res) => {
          active.current -= 1;
          setItems((now) => now.map((x) => x.id === it.id
            ? { ...x, status: res.ok ? "done" : "failed", note: res.note } : x));
          pump();
        });
      }
      return next;
    });
  }, [concurrency]);

  const add = React.useCallback((files: File[]) => {
    setItems((cur) => [...cur,
      ...files.map((file) => ({ id: `${file.name}-${file.size}-${Math.floor(performance.now())}`, file, status: "waiting" as const }))]);
    queueMicrotask(pump);
  }, [pump]);

  const retry = React.useCallback((id?: string) => {
    setItems((cur) => cur.map((x) =>
      (id ? x.id === id : x.status === "failed") && x.status === "failed" ? { ...x, status: "waiting", note: undefined } : x));
    queueMicrotask(pump);
  }, [pump]);

  return { items, add, retry };
}

export function UploadQueue({ items, onRetry, className }: {
  items: QueuedFile[];
  onRetry: (id?: string) => void;
  className?: string;
}) {
  if (!items.length) return null;
  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "failed").length;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-xs tabular-nums text-muted-foreground">
        {done} of {items.length} done{failed ? <> · <b className="text-foreground">{failed} failed</b></> : null}
        {failed > 1 ? (
          <button type="button" onClick={() => onRetry()} className="ms-2 cursor-pointer underline underline-offset-2">
            Retry the failed
          </button>
        ) : null}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-sm">
            <span className="min-w-0 truncate">{it.file.name}</span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              {it.status === "uploading" ? "sending…"
                : it.status === "waiting" ? "waiting"
                : it.status === "done" ? "done"
                : (<>
                    <span className="font-medium text-foreground">{it.note ?? "failed"}</span>
                    <button type="button" onClick={() => onRetry(it.id)}
                      className="cursor-pointer underline underline-offset-2">retry</button>
                  </>)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
