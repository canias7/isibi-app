import { SafeImage } from "@/components/ui/safe-image";
import { ClampText } from "@/components/ui/clamp-text";
import { cn } from "@/lib/utils";
/** A post in a list. The image is guarded, because most posts do not have one. */
export function ArticleCard({ title, excerpt, image, href, meta, className }: {
  title: string; excerpt?: string | null; image?: string | null;
  href?: string; meta?: React.ReactNode; className?: string;
}) {
  return (
    <article className={cn("flex flex-col gap-3", className)}>
      {image !== undefined && <a href={href}><SafeImage src={image} alt={title} ratio="16/9" /></a>}
      <div className="flex flex-col gap-1.5">
        <h3 className="font-medium leading-snug text-balance">
          <a href={href} className="hover:underline underline-offset-4">{title}</a>
        </h3>
        {excerpt && <ClampText lines={2} className="text-sm text-muted-foreground">{excerpt}</ClampText>}
        {meta}
      </div>
    </article>
  );
}
