import { StatusBadge } from "@/components/ui/status-badge";
/**
 * How many are left.
 *
 * "Only 2 left" is a fact, not a countdown — the number comes from stock, so it
 * cannot become the fake urgency this pattern is usually used for.
 */
export function StockBadge({ quantity, lowAt = 5 }: { quantity: number; lowAt?: number }) {
  if (quantity <= 0) return <StatusBadge state="danger">Sold out</StatusBadge>;
  if (quantity <= lowAt) return <StatusBadge state="warning">Only {quantity} left</StatusBadge>;
  return <StatusBadge state="success">In stock</StatusBadge>;
}
