import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/** A wide banner image with text over it, kept readable by a scrim. */
export function CoverImage({ src, alt, title, subtitle, ratio = "21/9", className }: {
  src?: string | null; alt?: string; title?: string; subtitle?: string;
  ratio?: string; className?: string;
}) {
  return (
    <div data-slot="cover-image" className={cn("relative overflow-hidden rounded-xl", className)}>
      <SafeImage src={src} alt={alt} ratio={ratio} className="rounded-none" />
      {(title || subtitle) && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            {title && <div className="text-xl font-semibold tracking-tight">{title}</div>}
            {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
          </div>
        </>
      )}
    </div>
  );
}
