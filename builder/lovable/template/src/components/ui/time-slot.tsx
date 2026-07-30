import { cn } from "@/lib/utils";
/**
 * One bookable time.
 *
 * A taken slot stays on the page, disabled and struck through, rather than
 * being removed: a grid whose slots vanish gives no sense of how busy the day
 * is, and somebody who was told "3pm" needs to see that 3pm is gone.
 */
export function TimeSlot({ time, taken, selected, onSelect, note, className }: {
  time: string; taken?: boolean; selected?: boolean;
  onSelect?: () => void; note?: string; className?: string;
}) {
  return (
    <button type="button" disabled={taken} onClick={onSelect} aria-pressed={selected}
      className={cn("flex min-w-20 cursor-pointer flex-col items-center rounded-md border px-3 py-2 text-sm tabular-nums transition-colors",
        taken && "cursor-not-allowed border-border text-muted-foreground line-through opacity-60",
        !taken && selected && "border-foreground bg-foreground text-background",
        !taken && !selected && "border-border hover:border-foreground/40 hover:bg-muted",
        className)}>
      {time}
      {note && <span className="mt-0.5 text-[10px] font-normal no-underline opacity-80">{note}</span>}
      {taken && <span className="sr-only">Unavailable</span>}
    </button>
  );
}
