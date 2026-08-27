import { cn } from "@/lib/utils";
/**
 * One slider, two things that move against each other.
 *
 * BOTH CONSEQUENCES ARE SHOWN AT ONCE — faster delivery costs more, more cover
 * costs more, a bigger deposit lowers the monthly. A slider with a single
 * readout hides the price of the choice until a later screen, which is where
 * abandoned checkouts come from.
 *
 * A native range input, so keyboard, screen reader and OS pointer settings all
 * work. `aria-valuetext` carries the readable pair rather than the raw number,
 * because "62" is not what the reader is choosing between.
 *
 * The two labels sit at the ends, not as a legend, so the direction of the
 * trade is readable without moving the handle.
 */
export function TradeoffSlider({ value, onChange, min = 0, max = 100, step = 1, left, right, outcome, label, id, className }: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
  /** What decreasing buys. */
  left: string;
  /** What increasing buys. */
  right: string;
  /** The current consequence, computed by the caller — "3 days · £24". */
  outcome: string;
  label: string; id?: string; className?: string;
}) {
  return (
    <div data-slot="tradeoff-slider" className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <span className="text-sm tabular-nums">{outcome}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        aria-valuetext={outcome}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-foreground" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{left}</span><span>{right}</span>
      </div>
    </div>
  );
}
