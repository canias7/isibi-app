import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Access that ends on a date.
 *
 * TIME-LIMITED ACCESS IS THE RIGHT DEFAULT for contractors, temporary cover and
 * shared links, and almost nothing offers it — which is why permissions
 * accumulate. This is the line that makes the expiry visible on the row rather
 * than buried in an audit.
 *
 * SOON IS CALLED OUT IN WORDS, because access quietly ending mid-job is
 * disruptive in a way that a date alone does not convey. The threshold is the
 * caller's, since a week's notice is right for a contractor and an hour is right
 * for a support session.
 *
 * EXPIRED KEEPS THE ROW rather than removing it — a person who vanished from the
 * list looks like they were removed by somebody, which starts the wrong
 * conversation.
 */
export function AccessExpiry({ at, soonWithinDays = 7, onExtend, className }: {
  at?: string | number | Date | null;
  soonWithinDays?: number;
  onExtend?: () => void;
  className?: string;
}) {
  if (!at) return <p className={cn("text-xs text-muted-foreground", className)}>No end date</p>;
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return null;
  const left = t - Date.now();
  const expired = left < 0;
  const soon = !expired && left <= soonWithinDays * 86_400_000;
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 text-xs", expired || soon ? "font-medium" : "text-muted-foreground", className)}>
      <span>
        {expired ? "Access ended " : "Access ends "}
        <time dateTime={new Date(t).toISOString()}><DateFormat date={t} /></time>
      </span>
      {onExtend && (
        <button type="button" onClick={onExtend} className="cursor-pointer underline underline-offset-2">Extend</button>
      )}
    </p>
  );
}
