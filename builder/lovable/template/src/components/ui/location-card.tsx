import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Where the business is, and a button that opens directions.
 *
 * Deliberately NOT an embedded map: a real tile map needs a provider key, costs
 * per load, and drops a third-party tracker onto a small business's site. What a
 * customer actually wants is the address and a route, and that needs nothing.
 */
export function LocationCard({ name, address, note, className }: {
  name?: string;
  address: string;
  note?: string;
  className?: string;
}) {
  const q = encodeURIComponent([name, address].filter(Boolean).join(", "));
  return (
    <Card data-slot="location-card" className={className}>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            {name && <div className="font-medium">{name}</div>}
            <div className={cn(name && "text-muted-foreground")}>{address}</div>
            {note && <div className="mt-1 text-muted-foreground">{note}</div>}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="w-fit">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${q}`} target="_blank" rel="noreferrer">
            <Navigation className="size-4" /> Directions
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
