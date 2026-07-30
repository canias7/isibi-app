import { SafeImage } from "@/components/ui/safe-image";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
/**
 * A course, in a catalogue or on the student's own shelf.
 *
 * `progress` switches it between those two: with it, the card shows how far
 * through somebody is instead of the price, because a course you have already
 * bought should never keep advertising itself to you.
 */
export function CourseCard({ title, teacher, lessons, duration, level, price, progress, image, href, className }: {
  title: string; teacher?: string; lessons?: number; duration?: string; level?: string;
  price?: string; progress?: number | null; image?: string | null; href?: string; className?: string;
}) {
  return (
    <article className={cn("overflow-hidden rounded-lg border border-border", className)}>
      <div className="aspect-video bg-muted">
        {image && <SafeImage src={image} alt="" className="size-full object-cover" />}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium">{href ? <a href={href} className="hover:underline">{title}</a> : title}</h3>
          {level && <Badge variant="secondary" className="shrink-0 font-normal">{level}</Badge>}
        </div>
        {teacher && <p className="text-sm text-muted-foreground">{teacher}</p>}
        <p className="text-xs text-muted-foreground">
          {[lessons != null ? `${lessons} lessons` : null, duration].filter(Boolean).join(" · ")}
        </p>
        {progress != null ? (
          <div className="space-y-1 pt-1">
            <Progress value={Math.max(0, Math.min(100, progress))} className="h-1.5" />
            <p className="text-xs tabular-nums text-muted-foreground">{Math.round(progress)}% complete</p>
          </div>
        ) : price ? <p className="pt-1 text-sm font-medium">{price}</p> : null}
      </div>
    </article>
  );
}
