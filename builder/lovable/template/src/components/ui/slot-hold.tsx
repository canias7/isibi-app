import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "We're holding 2pm for another 8:32."
 *
 * The countdown is the honest version of a booking flow that reserves a slot
 * while somebody fills in their details — without it, the slot is released
 * silently and the booking fails at the last step with no explanation.
 *
 * `onExpire` fires ONCE. A timer that keeps firing at zero re-triggers
 * whatever the caller does about it every second.
 */
export function SlotHold({ until, onExpire, label, className }: {
  until: string | number | Date; onExpire?: () => void; label?: string; className?: string;
}) {
  const end = new Date(until);
  const valid = !Number.isNaN(end.getTime());
  const [left, setLeft] = React.useState(() => valid ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 1000)) : 0);
  const fired = React.useRef(false);
  React.useEffect(() => {
    if (!valid) return;
    const t = setInterval(() => {
      const n = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 1000));
      setLeft(n);
      if (n === 0 && !fired.current) { fired.current = true; onExpire?.(); }
    }, 1000);
    return () => clearInterval(t);
  }, [valid, end.getTime()]);
  if (!valid) return null;
  const text = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <p data-slot="slot-hold" className={cn("text-sm", left <= 60 ? "text-destructive" : "text-muted-foreground", className)}
      aria-live={left <= 60 ? "polite" : "off"}>
      {left > 0
        ? <>{label ?? "We're holding this slot"} for another <strong className="font-medium tabular-nums">{text}</strong></>
        : "That hold has expired — please pick a time again."}
    </p>
  );
}
