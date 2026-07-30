import { SafeImage } from "@/components/ui/safe-image";
import { Badge } from "@/components/ui/badge";
import { Bed, Bath, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A place to rent or buy.
 *
 * Price sits above the address, which is how every property portal orders it
 * and is not arbitrary — the price is the filter people are actually applying
 * as they scroll.
 */
export function PropertyCard({ price, address, beds, baths, area, image, status, href, className }: {
  price: string; address: string; beds?: number; baths?: number; area?: string;
  image?: string | null; status?: string; href?: string; className?: string;
}) {
  return (
    <article className={cn("overflow-hidden rounded-lg border border-border", className)}>
      <div className="relative aspect-[4/3] bg-muted">
        {image && <SafeImage src={image} alt="" className="size-full object-cover" />}
        {status && <Badge className="absolute left-2 top-2" variant="secondary">{status}</Badge>}
      </div>
      <div className="p-3">
        <p className="text-base font-semibold tabular-nums">{price}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {href ? <a href={href} className="hover:underline">{address}</a> : address}
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {beds != null && <li className="flex items-center gap-1.5"><Bed className="size-3.5" />{beds} bed</li>}
          {baths != null && <li className="flex items-center gap-1.5"><Bath className="size-3.5" />{baths} bath</li>}
          {area && <li className="flex items-center gap-1.5"><Ruler className="size-3.5" />{area}</li>}
        </ul>
      </div>
    </article>
  );
}
