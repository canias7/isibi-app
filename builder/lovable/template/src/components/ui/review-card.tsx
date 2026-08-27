import { AvatarName } from "@/components/ui/avatar-name";
import { ReviewStars } from "@/components/ui/review-stars";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeAgo } from "@/components/ui/time-ago";
import { cn } from "@/lib/utils";
/** One review. `verified` only where it is true — a badge on everything says nothing. */
export function ReviewCard({ name, rating, body, at, verified, avatar, className }: {
  name: string; rating: number; body: string; at?: string | number | Date;
  verified?: boolean; avatar?: string | null; className?: string;
}) {
  return (
    <article data-slot="review-card" className={cn("flex flex-col gap-2 border-b border-border py-4 last:border-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AvatarName name={name} src={avatar} size="sm" />
        {at && <span className="text-xs text-muted-foreground"><TimeAgo date={at} /></span>}
      </div>
      <div className="flex items-center gap-2">
        <ReviewStars value={rating} />
        {verified && <StatusBadge state="success">Verified</StatusBadge>}
      </div>
      <p className="text-sm text-balance">{body}</p>
    </article>
  );
}
