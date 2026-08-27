import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The moderator's list of reported things.
 *
 * ONE ROW PER ITEM, NOT PER REPORT. Forty reports of one message are one
 * decision with a count on it — presented as forty rows they get forty
 * inconsistent decisions, or thirty-nine skips.
 *
 * KEEP AND REMOVE GET EQUAL WEIGHT, side by side, same size. Emphasising
 * Remove nudges removal, and a queue that nudges is a moderation policy
 * nobody wrote down — the cookie-banner rule applied to somebody's post.
 * "Skip" exists because unsure-right-now is a real answer, and forcing a
 * decision converts unsure into whichever button is closer.
 *
 * SORTED MOST-REPORTED FIRST, OLDEST BREAKING TIES, and the rule is printed —
 * an ordering the moderator cannot see reads as arbitrary, and "why is this
 * one first?" matters when the queue is long.
 *
 * The reported content is shown AS TEXT, clamped — never rendered as markup.
 * It is the least trusted string in the whole app; that is why it is here.
 *
 * AN EMPTY QUEUE IS THE GOOD STATE and says so plainly. A moderator opening
 * an empty page needs "nothing waiting", not a blank that looks broken.
 */
export type ReportedItem = {
  id: string | number;
  excerpt: string;
  kind?: string;
  author?: string;
  reports: number;
  reasons?: string[];
  reportedAt?: string;
};

export function ModerationQueue({ items, onKeep, onRemove, onSkip, className }: {
  items: ReportedItem[];
  onKeep: (id: ReportedItem["id"]) => void;
  onRemove: (id: ReportedItem["id"]) => void;
  onSkip?: (id: ReportedItem["id"]) => void;
  className?: string;
}) {
  const sorted = [...items].sort((a, b) =>
    b.reports - a.reports || String(a.reportedAt ?? "").localeCompare(String(b.reportedAt ?? "")));

  if (!items.length) {
    return (
      <div data-slot="moderation-queue" className={cn("rounded-xl border border-border bg-card p-6 text-center", className)}>
        <p className="text-sm font-medium">Nothing waiting</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Every report has been looked at.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {sorted.map((it) => (
          <li key={it.id} className="flex flex-col gap-2 p-3">
            <p className="line-clamp-2 text-sm">{it.excerpt}</p>
            <p className="text-xs text-muted-foreground">
              {[it.author, it.kind].filter(Boolean).join(" · ")}
              {" · "}
              <span className="font-medium text-foreground">{it.reports} report{it.reports === 1 ? "" : "s"}</span>
              {it.reasons?.length ? <> · {it.reasons.join(", ")}</> : null}
              {it.reportedAt ? <> · first reported {it.reportedAt}</> : null}
            </p>
            <div className="flex items-center gap-2">
              {/* Same treatment for both verdicts, on purpose. */}
              <button type="button" onClick={() => onKeep(it.id)}
                className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                Keep it
              </button>
              <button type="button" onClick={() => onRemove(it.id)}
                className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                Remove it
              </button>
              {onSkip ? (
                <button type="button" onClick={() => onSkip(it.id)}
                  className="ms-auto cursor-pointer text-xs text-muted-foreground underline underline-offset-2">
                  Skip for now
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] text-muted-foreground">Most reported first; oldest breaks ties.</p>
    </div>
  );
}
