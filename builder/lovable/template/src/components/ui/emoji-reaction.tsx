import { cn } from "@/lib/utils";
/** Reactions with counts. A pressed one is outlined as well as filled. */
export function EmojiReaction({ reactions, mine = [], onToggle, className }: {
  reactions: { emoji: string; count: number; label?: string }[];
  mine?: string[]; onToggle: (emoji: string) => void; className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {reactions.map((r) => {
        const on = mine.includes(r.emoji);
        return (
          <button key={r.emoji} type="button" onClick={() => onToggle(r.emoji)} aria-pressed={on}
            aria-label={`${r.label ?? r.emoji}, ${r.count}`}
            className={cn("inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-sm",
              on ? "border-foreground bg-muted font-medium" : "hover:bg-muted/60")}>
            <span aria-hidden="true">{r.emoji}</span>
            <span className="text-xs tabular-nums">{r.count}</span>
          </button>
        );
      })}
    </div>
  );
}
