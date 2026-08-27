import * as React from "react";
import { GitPullRequest, Check, X, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A proposed change awaiting review — the header of a pull request or a
 * suggested edit.
 *
 * "CHANGES REQUESTED" IS ITS OWN STATE, not a rejection. The two look similar
 * and mean opposite things: one is "no", the other is "yes, after this". A UI
 * that collapses them makes reviewers reluctant to ask for anything.
 *
 * WHAT BLOCKS THE MERGE IS LISTED, in order, each with whether it is done. "Not
 * ready" with no reason sends the author to guess between the reviewer, the
 * tests and a conflict — and every one of those has a different next step.
 *
 * The primary action is DISABLED WITH A REASON rather than hidden. A merge
 * button that vanishes leaves nothing to explain itself; a disabled one with
 * "2 checks still running" answers the question before it is asked.
 *
 * The state is carried by a glyph and a word, never colour — the same rule
 * `build-status` follows, and for the same scanning reason.
 */
export function ChangeRequest({
  title, author, at, state = "open", blockers = [], comments, onMerge, onClose, className,
}: {
  title: React.ReactNode;
  author?: React.ReactNode;
  at?: React.ReactNode;
  state?: "open" | "changes-requested" | "approved" | "merged" | "closed";
  blockers?: { key: string; label: React.ReactNode; done?: boolean }[];
  comments?: number;
  onMerge?: () => void;
  onClose?: () => void;
  className?: string;
}) {
  const words = {
    open: "Open", "changes-requested": "Changes requested", approved: "Approved",
    merged: "Merged", closed: "Closed",
  } as const;
  const Icon = state === "approved" || state === "merged" ? Check : state === "closed" ? X : GitPullRequest;
  const left = blockers.filter((b) => !b.done);

  return (
    <div data-slot="change-request" className={cn("flex flex-col gap-3 rounded-lg border border-border p-3", className)}>
      <div className="flex items-start gap-2.5">
        <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className={cn(state === "changes-requested" && "font-medium text-foreground")}>{words[state]}</span>
            {author ? <> · by {author}</> : null}
            {at ? <> · {at}</> : null}
          </p>
        </div>
        {comments ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare aria-hidden className="size-3" />
            <span className="tabular-nums">{comments}</span>
            <span className="sr-only">comments</span>
          </span>
        ) : null}
      </div>

      {blockers.length ? (
        <ul className="flex flex-col gap-1 border-t border-border pt-2">
          {blockers.map((b) => (
            <li key={b.key} className="flex items-center gap-2 text-xs">
              {b.done
                ? <Check aria-hidden className="size-3 shrink-0" />
                : <span aria-hidden className="size-3 shrink-0 rounded-full border border-muted-foreground" />}
              <span className={cn(b.done ? "text-muted-foreground" : "font-medium")}>{b.label}</span>
              <span className="sr-only">{b.done ? "done" : "still to do"}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {onMerge || onClose ? (
        <div className="flex flex-wrap items-center gap-3">
          {onMerge ? (
            <button type="button" onClick={onMerge} disabled={left.length > 0}
              title={left.length ? `${left.length} still to do` : undefined}
              className="cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-40">
              Merge
            </button>
          ) : null}
          {left.length ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {left.length} {left.length === 1 ? "thing" : "things"} still to do
            </span>
          ) : null}
          <span className="flex-1" />
          {onClose ? (
            <button type="button" onClick={onClose}
              className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Close without merging
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
