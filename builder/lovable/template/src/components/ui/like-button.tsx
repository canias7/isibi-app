import { Button } from "@/components/ui/button";
import { ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
/** A like with a count. `aria-pressed` carries the state, not the fill. */
export function LikeButton({ count = 0, liked, onToggle, className }: {
  count?: number; liked?: boolean; onToggle: () => void; className?: string;
}) {
  return (
    <Button type="button" size="sm" variant={liked ? "secondary" : "ghost"} onClick={onToggle}
      aria-pressed={!!liked} aria-label={liked ? "Remove like" : "Like"} className={className}>
      <ThumbsUp className={cn("size-4", liked && "fill-foreground")} />
      <span className="tabular-nums">{count}</span>
    </Button>
  );
}
