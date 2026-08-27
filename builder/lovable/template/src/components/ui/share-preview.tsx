import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/**
 * What this page will look like when somebody pastes the link into WhatsApp.
 *
 * Worth showing an owner, because it is the one thing about their site they
 * never see and cannot check: the preview is built from tags in the head that
 * render nowhere.
 *
 * The caps are the real ones — around 60 characters of title and 155 of
 * description before the platforms cut them off — and the text is truncated
 * here so the cut is visible rather than a surprise.
 */
export function SharePreview({ title, description, image, domain, className }: {
  title: string; description?: string; image?: string | null; domain?: string; className?: string;
}) {
  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
  return (
    <div data-slot="share-preview" className={cn("max-w-sm overflow-hidden rounded-lg border border-border", className)}>
      <div className="aspect-[1.91/1] bg-muted">
        {image
          ? <SafeImage src={image} alt="" className="size-full object-cover" />
          : <div className="grid size-full place-items-center text-xs text-muted-foreground">No preview image</div>}
      </div>
      <div className="space-y-1 p-3">
        {domain && <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{domain}</p>}
        <p className="text-sm font-medium leading-snug">{clip(title, 60)}</p>
        {description && <p className="text-xs leading-snug text-muted-foreground">{clip(description, 155)}</p>}
      </div>
    </div>
  );
}
