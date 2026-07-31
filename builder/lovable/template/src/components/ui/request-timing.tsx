import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Where a request's time actually went — DNS, connect, TLS, waiting, download.
 *
 * The phases are drawn to SCALE against the total, which is the only thing that
 * answers the question people bring here: "is this slow because of the server
 * or because of the network?". A list of five numbers makes the reader do that
 * comparison in their head.
 *
 * WAITING (time to first byte) is called out separately and named in plain
 * words, because it is almost always the dominant phase and it is the one that
 * means "the server was thinking". Lumping it into "response" hides the whole
 * answer.
 *
 * Each phase carries a LABEL and its number as well as a bar, so it is
 * readable without the chart — the bars for a 2ms DNS lookup on a 900ms request
 * is a sliver nobody can see or click.
 *
 * Zero-length phases are kept in the list with a 0. A cached connection has no
 * DNS or TLS, and showing that as absent rather than zero reads as missing data.
 */
export function RequestTiming({ phases, total, className }: {
  phases: { key: string; label: React.ReactNode; ms: number }[];
  total?: number;
  className?: string;
}) {
  const sum = phases.reduce((n, p) => n + Math.max(0, p.ms), 0);
  const whole = total ?? sum;
  const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${Math.round(n)}ms`);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">Timing</span>
        <span className="text-xs tabular-nums">{ms(whole)} total</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {phases.map((p, i) => (
          <div key={p.key}
            style={{ width: `${whole > 0 ? (Math.max(0, p.ms) / whole) * 100 : 0}%` }}
            className={cn("h-full border-r border-background last:border-0",
              i % 2 === 0 ? "bg-foreground" : "bg-muted-foreground")} />
        ))}
      </div>
      <table className="w-full border-collapse text-xs">
        <tbody>
          {phases.map((p, i) => (
            <tr key={p.key}>
              <td className="w-3 py-0.5">
                <span aria-hidden className={cn("block size-2 rounded-xs",
                  i % 2 === 0 ? "bg-foreground" : "bg-muted-foreground")} />
              </td>
              <td className="py-0.5 pl-2 text-muted-foreground">{p.label}</td>
              <td className="py-0.5 text-right tabular-nums">{ms(p.ms)}</td>
              <td className="w-12 py-0.5 text-right text-muted-foreground tabular-nums">
                {whole > 0 ? `${Math.round((Math.max(0, p.ms) / whole) * 100)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
