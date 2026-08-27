import { cn } from "@/lib/utils";
/**
 * Which cards are taken.
 *
 * Names as text rather than brand logos: logos need licensed artwork, go stale,
 * and are the sort of thing that quietly ships a remote image into every page.
 */
export function PaymentMethods({ methods = ["Visa", "Mastercard", "Amex", "Apple Pay"], label = "We accept", className }: {
  methods?: string[]; label?: string; className?: string;
}) {
  return (
    <div data-slot="payment-methods" className={cn("flex flex-wrap items-center gap-2 text-xs text-muted-foreground", className)}>
      <span>{label}</span>
      {methods.map((m) => <span key={m} className="rounded border px-2 py-1">{m}</span>)}
    </div>
  );
}
