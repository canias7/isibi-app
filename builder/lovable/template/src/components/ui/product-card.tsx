import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
export type Product = { name: string; price: number | string; was?: number | string | null;
  image?: string | null; note?: string | null; soldOut?: boolean;
  /** See `Shot` in gallery.tsx — every picture type drawn through SafeImage carries this. */
  fallbackSeed?: string };
/** One thing for sale. The whole card is the link; the button is a separate action. */
export function ProductCard({ product, currency = "£", onAdd, href, className }: {
  product: Product; currency?: string; onAdd?: () => void; href?: string; className?: string;
}) {
  const money = (v: number | string) => (typeof v === "number" ? currency + v.toFixed(2) : v);
  return (
    <div className={cn("group flex flex-col gap-3", className)}>
      <a href={href} className="relative block">
        <SafeImage src={product.image} alt={product.name} ratio="1/1" fallbackSeed={product.fallbackSeed ?? product.name} />
        {product.soldOut && <Badge variant="secondary" className="absolute left-2 top-2">Sold out</Badge>}
      </a>
      <div className="flex flex-col gap-1">
        <a href={href} className="text-sm font-medium hover:underline">{product.name}</a>
        <div className="flex items-baseline gap-2 text-sm tabular-nums">
          <span className="font-medium">{money(product.price)}</span>
          {product.was != null && <span className="text-muted-foreground line-through">{money(product.was)}</span>}
        </div>
        {product.note && <span className="text-xs text-muted-foreground">{product.note}</span>}
      </div>
      {onAdd && <Button size="sm" variant="outline" disabled={product.soldOut} onClick={onAdd}>
        {product.soldOut ? "Sold out" : "Add to basket"}</Button>}
    </div>
  );
}
