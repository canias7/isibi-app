import { SafeImage } from "@/components/ui/safe-image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
/**
 * A vehicle for sale or hire.
 *
 * The spec strip is a `<dl>`, not a paragraph of separated values: "2019 ·
 * 42,000 miles · Diesel" is unreadable to a screen reader, which announces the
 * numbers with nothing saying which is which.
 */
export function VehicleCard({ title, price, image, specs, badge, href, className }: {
  title: string; price?: string; image?: string | null;
  specs?: { label: string; value: string }[]; badge?: string; href?: string; className?: string;
}) {
  return (
    <article data-slot="vehicle-card" className={cn("overflow-hidden rounded-lg border border-border", className)}>
      <div className="relative aspect-[4/3] bg-muted">
        <SafeImage src={image} alt={title} ratio="auto" className="size-full object-cover" />
        {badge && <Badge className="absolute start-2 top-2" variant="secondary">{badge}</Badge>}
      </div>
      <div className="p-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-medium">{href ? <a href={href} className="hover:underline">{title}</a> : title}</h3>
          {price && <span className="shrink-0 text-sm font-semibold tabular-nums">{price}</span>}
        </div>
        {specs?.length ? (
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {specs.map((s) => (
              <div key={s.label} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{s.label}</dt>
                <dd className="tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </article>
  );
}
