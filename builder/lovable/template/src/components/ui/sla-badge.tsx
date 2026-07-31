import { cn } from "@/lib/utils";
/**
 * How long is left to answer — or how long it is already overdue.
 *
 * Overdue is stated as overdue rather than as a negative number. "-2h 14m"
 * is a puzzle in a column somebody is scanning for trouble; "2h 14m over" is
 * not, and it carries the word as well as the colour.
 */
export function SlaBadge({ dueAt, warnMinutes = 60, className }: {
  dueAt: string | number | Date; warnMinutes?: number; className?: string;
}) {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const mins = Math.round((due.getTime() - Date.now()) / 60000);
  const abs = Math.abs(mins);
  const text = abs >= 1440 ? `${Math.floor(abs / 1440)}d ${Math.floor((abs % 1440) / 60)}h`
    : abs >= 60 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${abs}m`;
  const tone = mins < 0 ? "text-destructive" : mins <= warnMinutes ? "text-warning" : "text-muted-foreground";
  return (
    <span className={cn("text-xs tabular-nums", tone, className)}>
      {mins < 0 ? `${text} over` : `${text} left`}
    </span>
  );
}
