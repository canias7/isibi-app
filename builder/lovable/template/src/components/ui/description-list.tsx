import { cn } from "@/lib/utils";
export type Pair = { label: string; value: React.ReactNode };
/**
 * Label and value pairs — a booking's details, an order summary, a spec.
 *
 * A real <dl>, so the pairing is in the markup rather than only in the layout.
 */
export function DescriptionList({ items, layout = "rows", className }: {
  items: Pair[]; layout?: "rows" | "grid"; className?: string;
}) {
  return (
    <dl className={cn(layout === "grid" ? "grid gap-4 sm:grid-cols-2" : "flex flex-col", className)}>
      {items.map((p, i) => (
        <div key={i} className={cn(layout === "rows" && "flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-0")}>
          <dt className="text-sm text-muted-foreground">{p.label}</dt>
          <dd className={cn("text-sm", layout === "rows" ? "text-end font-medium" : "mt-0.5 font-medium")}>{p.value}</dd>
        </div>
      ))}
    </dl>
  );
}
