import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";
/**
 * How much work is waiting, and whether that is getting better or worse.
 *
 * The trend is the useful half. A queue of 400 that was 900 an hour ago and a
 * queue of 400 that was 40 are opposite situations and the number alone
 * cannot tell them apart.
 */
export function QueueDepth({ label, depth, history, oldest, className }: {
  label: string; depth: number; history?: number[]; oldest?: string; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 border-b border-border py-3 last:border-0", className)}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {oldest && <p className="text-xs text-muted-foreground">Oldest waiting {oldest}</p>}
      </div>
      {history?.length ? <Sparkline values={history} className="text-muted-foreground" label={`${label} trend`} /> : null}
      <p className="w-16 text-end text-lg font-semibold tabular-nums">{depth.toLocaleString()}</p>
    </div>
  );
}
