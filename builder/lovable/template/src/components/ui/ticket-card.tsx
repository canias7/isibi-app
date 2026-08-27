import { Badge } from "@/components/ui/badge";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * A ticket somebody already holds.
 *
 * The reference is monospaced and selectable, because it gets read down a
 * phone or typed into a door scanner, and a proportional font makes 0/O and
 * 1/l a coin flip.
 */
export function TicketCard({ event, reference, at, seat, holder, used, className }: {
  event: string; reference: string; at?: string | number | Date;
  seat?: string; holder?: string; used?: boolean; className?: string;
}) {
  return (
    <article data-slot="ticket-card" className={cn("rounded-lg border border-border", used && "opacity-60", className)}>
      <div className="border-b border-dashed border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-sm font-medium">{event}</h3>
          {used && <Badge variant="outline">Used</Badge>}
        </div>
        <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
          {at && <p><DateFormat date={at} /></p>}
          {seat && <p>{seat}</p>}
          {holder && <p>{holder}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Reference</span>
        <span className="select-all font-mono text-sm tracking-wider">{reference}</span>
      </div>
    </article>
  );
}
