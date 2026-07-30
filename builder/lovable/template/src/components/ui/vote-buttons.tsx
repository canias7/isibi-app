import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
/** Up, down, and the score between. The score is announced as a score. */
export function VoteButtons({ score = 0, vote, onVote, className }: {
  score?: number; vote?: 1 | -1 | null; onVote: (v: 1 | -1 | null) => void; className?: string;
}) {
  const press = (v: 1 | -1) => onVote(vote === v ? null : v);
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Upvote" aria-pressed={vote === 1}
        onClick={() => press(1)}><ChevronUp className={cn("size-4", vote === 1 && "text-success")} /></Button>
      <span className="min-w-6 text-center text-sm font-medium tabular-nums" aria-label={`Score ${score}`}>{score}</span>
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Downvote" aria-pressed={vote === -1}
        onClick={() => press(-1)}><ChevronDown className={cn("size-4", vote === -1 && "text-destructive")} /></Button>
    </div>
  );
}
