import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";
/** When it arrives. A date, not "3–5 working days", which nobody can count. */
export function DeliveryEstimate({ from, to, method = "Standard delivery", className }: {
  from: string | number | Date; to?: string | number | Date; method?: string; className?: string;
}) {
  const fmt = (d: string | number | Date) =>
    new Date(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return (
    <p className={cn("flex items-center gap-2 text-sm", className)}>
      <Truck className="size-4 shrink-0 text-muted-foreground" />
      <span>{method}: <strong className="font-medium">{fmt(from)}{to ? ` – ${fmt(to)}` : ""}</strong></span>
    </p>
  );
}
