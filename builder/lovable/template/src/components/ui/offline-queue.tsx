import * as React from "react";
/**
 * Queue writes while offline; flush when the network is really back.
 *
 * `navigator.onLine` IS A LIAR AND IS TREATED AS A HINT. Captive portals
 * and dead wifi report online; the only proof is a request that succeeds.
 * So the 'online' event triggers a flush ATTEMPT, and each item leaves
 * the queue only when the caller's `send` resolves true for it — failures
 * stay queued for the next attempt. The signal is advisory; the send is
 * the test.
 *
 * PERSISTED, so a closed tab does not eat the queue (the export-progress
 * rule: the person left, their work must not leave with them). try/catch
 * around storage like every stored preference here. Items must therefore
 * be JSON-serialisable — enforced by the type taking a payload, not a
 * closure.
 *
 * FLUSHES ARE SEQUENTIAL AND SINGLE-FLIGHT: parallel flushes double-send
 * the same booking (the busy-button lesson at the queue level), and order
 * is preserved because writes often depend on earlier writes. State is
 * mirrored in a ref so the flush reads what IS queued, not what was
 * queued when the callback closed over it.
 */
export function useOfflineQueue<T>(storageKey: string, send: (item: T) => Promise<boolean>) {
  const [pending, setPending] = React.useState<T[]>([]);
  const [online, setOnline] = React.useState(true);
  const queueRef = React.useRef<T[]>([]);
  const flushing = React.useRef(false);
  const sendRef = React.useRef(send);
  sendRef.current = send;

  const persist = React.useCallback((items: T[]) => {
    queueRef.current = items;
    setPending(items);
    try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch { /* best effort */ }
  }, [storageKey]);

  // Load the persisted queue + subscribe to the (advisory) signal.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) { queueRef.current = JSON.parse(raw); setPending(queueRef.current); }
    } catch { /* private mode or corrupt - start empty */ }
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, [storageKey]);

  const flush = React.useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const items = queueRef.current;
      const kept: T[] = [];
      for (const item of items) {
        let ok = false;
        try { ok = await sendRef.current(item); } catch { ok = false; }
        if (!ok) kept.push(item);
      }
      if (kept.length !== items.length) persist(kept);
    } finally { flushing.current = false; }
  }, [persist]);

  // The online event is the hint to TRY.
  React.useEffect(() => { if (online && pending.length) void flush(); }, [online, pending.length, flush]);

  const enqueue = React.useCallback((item: T) => {
    persist([...queueRef.current, item]);
  }, [persist]);

  return { enqueue, flush, pending, online };
}
