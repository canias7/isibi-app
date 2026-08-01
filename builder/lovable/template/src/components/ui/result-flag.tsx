import { cn } from "@/lib/utils";
/**
 * A result marked for attention — with what kind of attention.
 *
 * "ABNORMAL" AND "URGENT" ARE DIFFERENT AND CONFLATING THEM IS DANGEROUS IN
 * BOTH DIRECTIONS. A chronically abnormal value that is stable needs no call;
 * a value inside the reference range that has halved since last week may need
 * one today. A single flag makes the second invisible.
 *
 * A CRITICAL RESULT CARRIES AN ACKNOWLEDGEMENT, because the failure mode is not
 * the flag being absent — it is the flag being present and nobody having seen
 * it. Who was told, and when, is the record that matters.
 *
 * THE DELTA IS SHOWN WHERE THERE IS A PREVIOUS VALUE. Change over time is what
 * clinicians and analysts actually read, and a single number with no history is
 * the least informative form this can take.
 *
 * FLAGS ARE WORDS, NEVER COLOUR ALONE — this is printed, faxed in some places
 * still, and read by people who cannot distinguish red from black.
 */
export type FlagKind = "high" | "low" | "critical" | "changed" | "unreliable";

const WORDS: Record<FlagKind, string> = {
  high: "Above range",
  low: "Below range",
  critical: "Critical",
  changed: "Changed markedly",
  unreliable: "Result unreliable",
};

export function ResultFlag({ kind, value, unit, previousValue, previousOn, reason, acknowledgedBy, acknowledgedAt, className }: {
  kind: FlagKind;
  value?: number | string;
  unit?: string;
  previousValue?: number;
  /** Free text — "7 July". */
  previousOn?: string;
  /** Why it is unreliable, where that is the flag. */
  reason?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  className?: string;
}) {
  const critical = kind === "critical";
  const delta = typeof value === "number" && previousValue !== undefined ? value - previousValue : undefined;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        {value !== undefined && (
          <span className={cn("tabular-nums", critical && "font-medium")}>
            {value}{unit ? ` ${unit}` : ""}
          </span>
        )}
        <span className={cn("text-xs", critical ? "font-medium" : "text-muted-foreground")}>
          {value !== undefined ? " · " : ""}{WORDS[kind]}
        </span>
      </p>
      {delta !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {/* Rounded: 4.4 − 2.1 is 2.3000000000000003 in binary floating point,
              and a laboratory result showing sixteen significant figures of
              arithmetic noise is read as an instrument fault. */}
          {Number(Math.abs(delta).toFixed(6))}{unit ? ` ${unit}` : ""} {delta > 0 ? "higher" : delta < 0 ? "lower" : "unchanged"} than {previousValue}
          {previousOn && ` on ${previousOn}`}
        </p>
      )}
      {reason && <p className="text-xs">{reason}</p>}
      {critical && (
        <p className={cn("text-xs", acknowledgedBy ? "text-muted-foreground" : "font-medium")}>
          {acknowledgedBy
            ? `Told to ${acknowledgedBy}${acknowledgedAt ? ` at ${acknowledgedAt}` : ""}.`
            : "Nobody has acknowledged this yet — a critical result that has been seen by no one is the failure."}
        </p>
      )}
    </div>
  );
}
