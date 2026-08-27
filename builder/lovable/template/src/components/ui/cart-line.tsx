import { QuantityInput } from "@/components/ui/quantity-input";
import { SafeImage } from "@/components/ui/safe-image";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/** One row of a basket: picture, name, quantity, line total, remove. */
export function CartLine({ name, meta, image, price, quantity, currency = "£",
  onQuantity, onRemove, className }: {
  name: string; meta?: string | null; image?: string | null; price: number;
  quantity: number; currency?: string;
  onQuantity?: (n: number) => void; onRemove?: () => void; className?: string;
}) {
  return (
    <div data-slot="cart-line" className={cn("flex items-center gap-3 border-b border-border py-3 last:border-0", className)}>
      <SafeImage src={image} alt={name} ratio="1/1" className="w-14 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        {meta && <div className="truncate text-xs text-muted-foreground">{meta}</div>}
      </div>
      {onQuantity ? <QuantityInput value={quantity} onChange={onQuantity} />
        : <span className="text-sm tabular-nums text-muted-foreground">×{quantity}</span>}
      <span className="w-16 shrink-0 text-end text-sm font-medium tabular-nums">
        {currency}{(price * quantity).toFixed(2)}
      </span>
      {onRemove && (
        <button type="button" aria-label={`Remove ${name}`} onClick={onRemove}
          className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
      )}
    </div>
  );
}
