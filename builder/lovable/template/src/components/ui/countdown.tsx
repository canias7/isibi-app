import * as React from "react";
import { cn } from "@/lib/utils";

/** Time until something. Stops at zero rather than counting into the negative. */
export function Countdown({ to, onDone, className }: {
  to: string | number | Date;
  onDone?: () => void;
  className?: string;
}) {
  const target = React.useMemo(() => new Date(to).getTime(), [to]);
  const [left, setLeft] = React.useState(() => Math.max(0, target - Date.now()));
  React.useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => {
      const next = Math.max(0, target - Date.now());
      setLeft(next);
      if (next === 0) onDone?.();
    }, 1000);
    return () => clearInterval(t);
  }, [target, left, onDone]);

  const s = Math.floor(left / 1000);
  const parts = [
    { v: Math.floor(s / 86400), l: "days" },
    { v: Math.floor((s % 86400) / 3600), l: "hrs" },
    { v: Math.floor((s % 3600) / 60), l: "min" },
    { v: s % 60, l: "sec" },
  ];
  return (
    <div className={cn("flex gap-4", className)}>
      {parts.map((p) => (
        <div key={p.l} className="flex flex-col items-center">
          <span className="text-2xl font-semibold tabular-nums">{String(p.v).padStart(2, "0")}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{p.l}</span>
        </div>
      ))}
    </div>
  );
}
