import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The packing bench list — tick each item as it goes in the box.
 *
 * QUANTITIES ARE TICKED ONE AT A TIME, not as a single checkbox per line.
 * "3 × beard oil" ticked once is how two get packed and one gets a support
 * ticket; the count is the thing being verified, so the control counts.
 *
 * IT WILL NOT LET YOU FINISH EARLY. The complete button stays disabled with
 * the shortfall named — this is the last check before a box is sealed, and
 * a soft warning at this point is a warning that gets clicked through.
 *
 * BIG TARGETS, because this is used standing up, quickly, sometimes with
 * gloves on — a 14px checkbox is the wrong control for a warehouse.
 */
export function PackChecklist({ lines, packed, onPack, onComplete, className }: {
  lines: { key: string; label: React.ReactNode; qty: number }[];
  /** key -> how many are in the box */
  packed: Record<string, number>;
  onPack: (key: string, n: number) => void;
  onComplete?: () => void;
  className?: string;
}) {
  const short = lines.filter((l) => (packed[l.key] ?? 0) < l.qty);
  const over = lines.filter((l) => (packed[l.key] ?? 0) > l.qty);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ul className="flex flex-col gap-1">
        {lines.map((l) => {
          const n = packed[l.key] ?? 0;
          const done = n >= l.qty;
          return (
            <li key={l.key}
              className={cn("flex items-center justify-between gap-3 rounded-lg border p-2.5",
                done ? "border-foreground" : "border-border")}>
              <span className="min-w-0">
                <span className="block truncate text-sm">{l.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{n} of {l.qty} in the box</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => onPack(l.key, Math.max(0, n - 1))} disabled={n === 0}
                  aria-label={`One fewer ${String(l.label)}`}
                  className="size-9 cursor-pointer rounded-md border border-border text-lg disabled:cursor-not-allowed disabled:opacity-30">−</button>
                <button type="button" onClick={() => onPack(l.key, n + 1)}
                  aria-label={`One more ${String(l.label)}`}
                  className="size-9 cursor-pointer rounded-md border border-border text-lg">+</button>
                {done ? <Check className="size-5" aria-hidden /> : null}
              </span>
            </li>
          );
        })}
      </ul>
      {/* Hard stop: a soft warning here is a warning that gets clicked through. */}
      <button type="button" disabled={!!short.length || !!over.length} onClick={onComplete}
        className="cursor-pointer rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
        Seal the box
      </button>
      {short.length ? (
        <p className="text-xs font-medium">Still to pack: {short.map((l) => `${l.qty - (packed[l.key] ?? 0)} × ${String(l.label)}`).join(", ")}.</p>
      ) : null}
      {over.length ? (
        <p className="text-xs font-medium">Too many in the box: {over.map((l) => String(l.label)).join(", ")}.</p>
      ) : null}
    </div>
  );
}
