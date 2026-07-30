import { cn } from "@/lib/utils";
/**
 * A price, with a struck-through original when there is one.
 *
 * The old price is announced as "was", not left as a bare number a screen reader
 * reads twice with no explanation.
 */
export function PriceTag({ price, was, currency = "£", size = "md", className }: {
  price: number | string; was?: number | string | null; currency?: string;
  size?: "sm" | "md" | "lg"; className?: string;
}) {
  const s = { sm: "text-sm", md: "text-base", lg: "text-2xl" }[size];
  const money = (v: number | string) => (typeof v === "number" ? currency + v.toFixed(2) : v);
  return (
    <span className={cn("inline-flex items-baseline gap-2 tabular-nums", s, className)}>
      <span className="font-semibold">{money(price)}</span>
      {was != null && (
        <span className="text-sm text-muted-foreground">
          <span className="sr-only">was </span><span className="line-through">{money(was)}</span>
        </span>
      )}
    </span>
  );
}
