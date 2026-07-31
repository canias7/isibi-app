import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "2 / 3" with arrows — moving between alternative answers at the same point.
 *
 * It exists because REGENERATING SHOULD NOT DESTROY the previous answer. The
 * naive implementation replaces the message, and the person who preferred the
 * first version has no way back — a data loss with no undo, caused by pressing
 * a button labelled "try again".
 *
 * It is a `<nav>` with a spoken position, not two bare chevrons. "Previous" and
 * "Next" alone tell a listener nothing about how many there are or where they
 * are in them, which is the only thing this control conveys.
 *
 * It WRAPS at the ends rather than disabling. With two or three branches,
 * arriving at the last one and finding the button dead is a worse experience
 * than looping, and there is no risk of getting lost in a list of three.
 *
 * It renders nothing when there is only one. A "1 / 1" counter under every
 * answer is noise reporting the absence of a feature.
 */
export function ConversationBranch({ index, count, onChange, className }: {
  index: number;
  count: number;
  onChange: (index: number) => void;
  className?: string;
}) {
  if (count <= 1) return null;
  const go = (d: number) => onChange((index + d + count) % count);
  return (
    <nav aria-label="Alternative answers"
      className={cn("inline-flex items-center gap-0.5 text-xs text-muted-foreground", className)}>
      <button type="button" onClick={() => go(-1)} aria-label="Previous answer"
        className="cursor-pointer rounded p-0.5 hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-3.5" />
      </button>
      <span className="tabular-nums">
        <span aria-hidden>{index + 1} / {count}</span>
        <span className="sr-only">Answer {index + 1} of {count}</span>
      </span>
      <button type="button" onClick={() => go(1)} aria-label="Next answer"
        className="cursor-pointer rounded p-0.5 hover:bg-muted hover:text-foreground">
        <ChevronRight aria-hidden className="size-3.5" />
      </button>
    </nav>
  );
}
