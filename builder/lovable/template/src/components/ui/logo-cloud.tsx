import { cn } from "@/lib/utils";

/** "As featured in" — names or logos, kept quiet on purpose. */
export function LogoCloud({ items, label, className }: {
  items: { name: string; logo?: string | null }[];
  label?: string;
  className?: string;
}) {
  return (
    <div data-slot="logo-cloud" className={cn("flex flex-col items-center gap-5", className)}>
      {label && <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>}
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
        {items.map((l, i) =>
          l.logo
            ? <img key={i} src={l.logo} alt={l.name} className="h-6 w-auto opacity-60" loading="lazy" />
            : <span key={i} className="text-sm font-medium text-muted-foreground">{l.name}</span>,
        )}
      </div>
    </div>
  );
}
