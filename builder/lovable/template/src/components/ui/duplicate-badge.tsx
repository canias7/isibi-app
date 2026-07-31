import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Possibly the same as…" — with the evidence, and never an auto-merge.
 *
 * THE WHY IS STATED ("same phone number"), because a bare "possible
 * duplicate" cannot be judged — the evidence is what separates two
 * customers named Ada from one customer typed twice. The other record is
 * a LINK: judging sameness needs both in view.
 *
 * MERGING IS A HUMAN'S CALL, ALWAYS. An auto-merge that guessed wrong
 * has destroyed a record and its history; "Not the same" is an equal
 * answer and is REMEMBERED by the caller, so the pair is never asked
 * about again — the outlier-flag contract.
 *
 * Merge direction is the caller's screen; this badge only raises the
 * question well.
 */
export function DuplicateBadge({ of, evidence, onMerge, onNotSame, className }: {
  of: { label: React.ReactNode; href?: string };
  evidence: React.ReactNode;
  onMerge?: () => void;
  onNotSame?: () => void;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5 rounded-md border border-dashed border-foreground/60 px-2 py-1 text-xs", className)}>
      <span>
        Possibly the same as{" "}
        {of.href
          ? <a href={of.href} className="cursor-pointer font-medium underline underline-offset-2">{of.label}</a>
          : <span className="font-medium">{of.label}</span>}
        {" "}<span className="text-muted-foreground">({evidence})</span>
      </span>
      {onMerge ? (
        <button type="button" onClick={onMerge}
          className="cursor-pointer rounded border border-border px-1.5 py-0.5 hover:bg-muted">
          Review &amp; merge
        </button>
      ) : null}
      {onNotSame ? (
        <button type="button" onClick={onNotSame}
          className="cursor-pointer text-muted-foreground underline underline-offset-2">
          Not the same
        </button>
      ) : null}
    </span>
  );
}
