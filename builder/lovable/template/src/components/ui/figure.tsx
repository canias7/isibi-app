import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/** A picture with a caption, as a real <figure>/<figcaption> pair. */
export function Figure({ src, alt, caption, credit, ratio = "16/9", className }: {
  src?: string | null; alt?: string; caption?: string;
  credit?: string; ratio?: string; className?: string;
}) {
  return (
    <figure data-slot="figure" className={cn("flex flex-col gap-2", className)}>
      <SafeImage src={src} alt={alt} ratio={ratio} />
      {(caption || credit) && (
        <figcaption className="text-sm text-muted-foreground">
          {caption}{credit && <span className="ms-2 text-xs">{credit}</span>}
        </figcaption>
      )}
    </figure>
  );
}
