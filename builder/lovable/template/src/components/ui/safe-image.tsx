import { cn } from "@/lib/utils";

/**
 * An <img> that cannot render broken.
 *
 * A picture column is an ordinary TEXT column the OWNER fills in after the build,
 * so on a brand-new site the value is empty and `<img src="">` paints a broken
 * icon on every card. GENERATOR.md rule 7 exists entirely because of this, and it
 * asks the model to remember a guard on every image of every page. This makes
 * forgetting impossible instead.
 *
 * With no src it renders the fallback box, never an empty image.
 */
export function SafeImage({
  src, alt = "", className, ratio = "4/3", fallback,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  /** CSS aspect-ratio, e.g. "16/9". Keeps layout stable before the image loads. */
  ratio?: string;
  fallback?: React.ReactNode;
}) {
  const box = cn("overflow-hidden rounded-lg bg-muted", className);
  if (!src) {
    return (
      <div className={box} style={{ aspectRatio: ratio }}>
        {fallback ?? <div className="grid size-full place-items-center text-xs text-muted-foreground">No image yet</div>}
      </div>
    );
  }
  return (
    <div className={box} style={{ aspectRatio: ratio }}>
      <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />
    </div>
  );
}
