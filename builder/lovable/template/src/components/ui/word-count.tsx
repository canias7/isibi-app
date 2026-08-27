import { cn } from "@/lib/utils";
/**
 * Words and reading time under a text box.
 *
 * Counts on a real word split, not `split(" ")`, which counts every double
 * space as a word and reports 40 for an empty paragraph of newlines.
 */
export function WordCount({ text, min, className }: {
  text: string; min?: number; className?: string;
}) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const mins = Math.max(1, Math.round(words / 200));
  const short = min != null && words < min;
  return (
    <p data-slot="word-count" className={cn("text-xs tabular-nums", short ? "text-destructive" : "text-muted-foreground", className)}
      aria-live="polite">
      {words.toLocaleString()} {words === 1 ? "word" : "words"}
      {words > 0 && <> · about {mins} min read</>}
      {short && <> · {min - words} more needed</>}
    </p>
  );
}
