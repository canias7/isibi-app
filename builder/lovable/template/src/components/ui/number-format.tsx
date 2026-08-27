/** A number, grouped for the visitor's locale, optionally shortened to 1.2k. */
export function NumberFormat({ value, compact, decimals, className }: {
  value: number; compact?: boolean; decimals?: number; className?: string;
}) {
  const text = new Intl.NumberFormat(undefined, {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: decimals ?? (compact ? 1 : 0),
  }).format(value);
  return <span data-slot="number-format" className={className ? className + " tabular-nums" : "tabular-nums"}>{text}</span>;
}
