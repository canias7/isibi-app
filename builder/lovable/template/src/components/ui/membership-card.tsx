import { Badge } from "@/components/ui/badge";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Somebody's membership — a gym, a club, a library.
 *
 * An expired card says so on its face rather than only in the date. A lapsed
 * date read at a desk is a sum somebody has to do; the word is not.
 */
export function MembershipCard({ name, tier, number, since, expires, expired, className }: {
  name: string; tier?: string; number?: string;
  since?: string | number | Date; expires?: string | number | Date; expired?: boolean; className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border p-4", expired && "opacity-70", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{name}</p>
          {tier && <p className="text-xs uppercase tracking-wide text-muted-foreground">{tier}</p>}
        </div>
        {expired && <Badge variant="outline">Expired</Badge>}
      </div>
      {number && <p className="mt-4 select-all font-mono text-sm tracking-widest">{number}</p>}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        {since && <p>Member since <DateFormat date={since} /></p>}
        {expires && <p>{expired ? "Expired" : "Valid until"} <DateFormat date={expires} /></p>}
      </div>
    </div>
  );
}
