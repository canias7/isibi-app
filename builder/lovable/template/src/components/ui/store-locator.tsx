import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The branch list.
 *
 * A LIST, not a map — the same reasoning as `location-card`: a tile map needs
 * a provider key, bills per load and drops a third party onto a small
 * business's site, when what somebody wants is the nearest address, whether it
 * is open, and directions.
 *
 * Ordering is the caller's, because "nearest" needs a location this component
 * has no business asking for.
 */
export function StoreLocator({ stores, onDirections, className }: {
  stores: {
    id: string | number; name: string; address: string; distance?: string;
    phone?: string; open?: boolean; hoursNote?: string;
  }[];
  onDirections?: (id: string | number) => void; className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-border", className)}>
      {stores.map((s) => (
        <li key={s.id} className="flex flex-wrap items-start gap-3 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{s.name}</p>
              {s.open != null && <StatusDot state={s.open ? "on" : "off"} label={s.open ? "Open now" : "Closed"} />}
              {s.distance && <span className="text-xs text-muted-foreground">{s.distance}</span>}
            </div>
            <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />{s.address}
            </p>
            {s.hoursNote && <p className="mt-0.5 text-xs text-muted-foreground">{s.hoursNote}</p>}
          </div>
          <div className="flex gap-2">
            {s.phone && <Button size="sm" variant="ghost" asChild>
              <a href={`tel:${s.phone.replace(/[^+\d]/g, "")}`}><Phone className="size-4" />Call</a></Button>}
            {onDirections && <Button size="sm" variant="outline" onClick={() => onDirections(s.id)}>Directions</Button>}
          </div>
        </li>
      ))}
    </ul>
  );
}
