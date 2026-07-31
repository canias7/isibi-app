import * as React from "react";
import { GitBranch, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A branch name, with how far it has diverged.
 *
 * AHEAD AND BEHIND ARE BOTH SHOWN, separately, never as one net number. They
 * mean opposite things — ahead is work to push, behind is work to pull, and a
 * branch that is 3 ahead and 12 behind is in a completely different situation
 * from one that is 9 ahead. A single "±9" is the sum of two unrelated facts.
 *
 * Each carries an ARROW and an `sr-only` word, so it is not two identical
 * numbers that have to be told apart by position.
 *
 * A long branch name TRUNCATES FROM THE MIDDLE, keeping both ends. Generated
 * branch names share a long prefix — `claude/page-generator-build-fua1ar` — so
 * a trailing ellipsis leaves several that all read identically, and the
 * distinguishing part is the suffix.
 *
 * `default` marks the main branch, whatever it is called, because "am I on the
 * default?" is the question and it cannot be answered by matching a name.
 */
export function middleTruncate(text: string, max = 28) {
  if (text.length <= max) return text;
  const keep = Math.floor((max - 1) / 2);
  return `${text.slice(0, keep)}…${text.slice(-keep)}`;
}

export function BranchBadge({ name, ahead = 0, behind = 0, isDefault, href, max, className }: {
  name: string;
  ahead?: number;
  behind?: number;
  isDefault?: boolean;
  href?: string;
  max?: number;
  className?: string;
}) {
  const label = middleTruncate(name, max);
  const body = (
    <>
      <GitBranch aria-hidden className="size-3 shrink-0" />
      <span className="font-mono" title={label !== name ? name : undefined}>{label}</span>
      {isDefault ? <span className="text-muted-foreground">default</span> : null}
      {ahead > 0 ? (
        <span className="inline-flex items-center tabular-nums">
          <ArrowUp aria-hidden className="size-3" />{ahead}
          <span className="sr-only"> commits ahead</span>
        </span>
      ) : null}
      {behind > 0 ? (
        <span className="inline-flex items-center tabular-nums">
          <ArrowDown aria-hidden className="size-3" />{behind}
          <span className="sr-only"> commits behind</span>
        </span>
      ) : null}
    </>
  );
  const shared = cn("inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs", className);
  return href ? <a href={href} className={cn(shared, "hover:bg-muted")}>{body}</a> : <span className={shared}>{body}</span>;
}
