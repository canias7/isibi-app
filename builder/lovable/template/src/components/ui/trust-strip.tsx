import { cn } from "@/lib/utils";
/** Three or four reassurances in a row — returns, delivery, support. */
export function TrustStrip({ items, className }: {
  items: { icon?: React.ReactNode; title: string; description?: string }[]; className?: string;
}) {
  return (
    <div className={cn("grid gap-6 border-y py-6 sm:grid-cols-3", className)}>
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-3">
          {it.icon && <span className="mt-0.5 text-muted-foreground [&_svg]:size-5">{it.icon}</span>}
          <div>
            <div className="text-sm font-medium">{it.title}</div>
            {it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
