import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

export type HeroAction = { label: string; href?: string; onClick?: () => void };

/**
 * The top of a home page: headline, one line of copy, and up to two actions.
 *
 * Prop-driven rather than children-only. A composition that only takes children
 * is decoration — the model writes the layout inline anyway and the component
 * earns nothing.
 */
export function Hero({
  title, subtitle, primary, secondary, image, align = "left", className,
}: {
  title: string;
  subtitle?: string;
  primary?: HeroAction;
  secondary?: HeroAction;
  /** Optional background image. Guarded, so an owner who has not uploaded one yet gets a clean section. */
  image?: string | null;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <section data-slot="hero" className={cn("relative overflow-hidden", className)}>
      {image ? (
        <div className="absolute inset-0">
          <SafeImage src={image} ratio="auto" className="size-full rounded-none" />
          <div className="absolute inset-0 bg-background/70" />
        </div>
      ) : null}
      <div className={cn("relative mx-auto flex max-w-4xl flex-col gap-5 px-6 py-20 sm:py-28", align === "center" && "items-center text-center")}>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h1>
        {subtitle && <p className="max-w-2xl text-lg text-muted-foreground text-balance">{subtitle}</p>}
        {(primary || secondary) && (
          <div className="mt-2 flex flex-wrap gap-3">
            {primary && (
              <Button size="lg" asChild={!!primary.href} onClick={primary.onClick}>
                {primary.href ? <a href={primary.href}>{primary.label}</a> : <span>{primary.label}</span>}
              </Button>
            )}
            {secondary && (
              <Button size="lg" variant="outline" asChild={!!secondary.href} onClick={secondary.onClick}>
                {secondary.href ? <a href={secondary.href}>{secondary.label}</a> : <span>{secondary.label}</span>}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
