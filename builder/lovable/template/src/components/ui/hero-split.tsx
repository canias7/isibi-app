import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

/** Copy on one side, picture on the other. The other half of the hero decision. */
export function HeroSplit({
  title, subtitle, action, image, imageAlt, reverse, className,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  image?: string | null;
  imageAlt?: string;
  /** Picture on the left instead of the right. */
  reverse?: boolean;
  className?: string;
}) {
  return (
    <section data-slot="hero-split" className={cn("mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2", className)}>
      <div className={cn("flex flex-col gap-4", reverse && "md:order-2")}>
        <h1 className="text-4xl font-semibold tracking-tight text-balance">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-balance">{subtitle}</p>}
        {action && (
          <div className="mt-2">
            <Button size="lg" asChild={!!action.href} onClick={action.onClick}>
              {action.href ? <a href={action.href}>{action.label}</a> : <span>{action.label}</span>}
            </Button>
          </div>
        )}
      </div>
      <SafeImage src={image} alt={imageAlt} ratio="4/3" className={cn(reverse && "md:order-1")} />
    </section>
  );
}
