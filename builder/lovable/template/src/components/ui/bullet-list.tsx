import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/** A list with a real marker. Ticks for benefits, dots for everything else. */
export function BulletList({ items, marker = "dot", columns = 1, className }: {
  items: React.ReactNode[]; marker?: "dot" | "check"; columns?: 1 | 2;
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-2 text-sm", columns === 2 && "sm:grid-cols-2", className)}>
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2">
          {marker === "check"
            ? <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            : <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />}
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
