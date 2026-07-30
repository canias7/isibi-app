import { BusyButton } from "@/components/ui/busy-button";
import { QuantityInput } from "@/components/ui/quantity-input";
import { cn } from "@/lib/utils";
/** Quantity and the button together, disabled while the add is in flight. */
export function AddToCart({ quantity, onQuantity, onAdd, busy, soldOut, className }: {
  quantity: number; onQuantity: (n: number) => void; onAdd: () => void;
  busy?: boolean; soldOut?: boolean; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <QuantityInput value={quantity} onChange={onQuantity} />
      <BusyButton busy={busy} busyLabel="Adding…" disabled={soldOut} onClick={onAdd} className="flex-1">
        {soldOut ? "Sold out" : "Add to basket"}
      </BusyButton>
    </div>
  );
}
