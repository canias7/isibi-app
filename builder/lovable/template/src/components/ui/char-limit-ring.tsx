import { cn } from "@/lib/utils";
/**
 * The circular counter beside a length-limited box.
 *
 * It shows the REMAINING count only once close to the limit, and the number
 * goes negative past it rather than stopping — somebody 30 characters over
 * needs to know how much to cut, and a ring stuck at zero tells them nothing.
 *
 * Over the limit is red AND the ring is complete AND the number is shown, so
 * it does not depend on colour alone.
 */
export function CharLimitRing({ value, max, showFrom = 0.8, size = 20, className }: {
  value: number; max: number; showFrom?: number; size?: number; className?: string;
}) {
  const left = max - value;
  const ratio = max > 0 ? value / max : 0;
  const over = left < 0;
  const near = ratio >= showFrom;
  const r = (size - 3) / 2, c = 2 * Math.PI * r;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <svg width={size} height={size} className="-rotate-90 shrink-0" role="img"
        aria-label={over ? `${-left} characters over the limit` : `${left} characters left`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="2" className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="2" strokeLinecap="round"
          className={cn(over ? "stroke-destructive" : near ? "stroke-warning" : "stroke-foreground")}
          strokeDasharray={`${(c * Math.min(1, ratio)).toFixed(2)} ${c.toFixed(2)}`} />
      </svg>
      {(near || over) && (
        <span className={cn("text-xs tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>{left}</span>
      )}
    </span>
  );
}
