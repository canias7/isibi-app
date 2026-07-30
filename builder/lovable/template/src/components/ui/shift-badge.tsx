import { cn } from "@/lib/utils";
/**
 * Which shift somebody is on.
 *
 * A shift that runs past midnight is written with the next day marked
 * ("22:00–06:00 +1"), because that is the one people misread on a rota — the
 * night shift ending at six looks like it starts at ten in the morning.
 */
export function ShiftBadge({ start, end, label, className }: {
  start: string; end: string; label?: string; className?: string;
}) {
  const toM = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };
  const a = toM(start), b = toM(end);
  const overnight = a != null && b != null && b <= a;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded border border-border px-2 py-0.5 text-xs tabular-nums", className)}>
      {label && <span className="font-medium">{label}</span>}
      <span>{start}–{end}</span>
      {overnight && <>
        <span aria-hidden="true" className="text-muted-foreground">+1</span>
        <span className="sr-only">ends the next day</span>
      </>}
    </span>
  );
}
