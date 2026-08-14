import { Clock } from "lucide-react";
import { cn, divide } from "@/lib/utils";
/**
 * How long it takes to read.
 *
 * From a word COUNT rather than from the text, so it works when the body comes
 * from a database and the page never holds the whole string. 200 wpm.
 */
export function ReadingTime({ words, wpm = 200, showIcon = true, className }: {
  words: number; wpm?: number; showIcon?: boolean; className?: string;
}) {
  const mins = Math.max(1, Math.round(divide(words, wpm)));
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm text-muted-foreground", className)}>
      {showIcon && <Clock className="size-3.5" />}{mins} min read
    </span>
  );
}
