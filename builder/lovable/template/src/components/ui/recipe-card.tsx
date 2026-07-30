import { SafeImage } from "@/components/ui/safe-image";
import { ReviewStars } from "@/components/ui/review-stars";
import { Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A recipe.
 *
 * Total time is one number, not prep and cook side by side: the question is
 * "can I make this tonight", and two numbers to add up is the answer taking
 * longer than it should.
 */
export function RecipeCard({ title, image, totalTime, serves, rating, tags, href, className }: {
  title: string; image?: string | null; totalTime?: string; serves?: number;
  rating?: number; tags?: string[]; href?: string; className?: string;
}) {
  return (
    <article className={cn("overflow-hidden rounded-lg border border-border", className)}>
      <div className="aspect-[4/3] bg-muted">
        {image && <SafeImage src={image} alt="" className="size-full object-cover" />}
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="text-sm font-medium">{href ? <a href={href} className="hover:underline">{title}</a> : title}</h3>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {totalTime && <li className="flex items-center gap-1.5"><Clock className="size-3.5" />{totalTime}</li>}
          {serves != null && <li className="flex items-center gap-1.5"><Users className="size-3.5" />Serves {serves}</li>}
        </ul>
        {rating != null && <ReviewStars value={rating} />}
        {tags?.length ? <p className="text-xs text-muted-foreground">{tags.join(" · ")}</p> : null}
      </div>
    </article>
  );
}
