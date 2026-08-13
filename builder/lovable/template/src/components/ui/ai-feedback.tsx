import * as React from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Was that any good?
 *
 * IT ONLY ASKS FOR WORDS AFTER A NO, which is the `feedback-widget` rule applied
 * here: asking everyone for a comment gets very few, and asking the person who
 * just said it was wrong gets the useful ones.
 *
 * THE RATING IS RECORDED IMMEDIATELY, before the comment. Somebody who presses
 * thumbs-down and then abandons the box has still told you something, and a
 * design that only submits on comment throws that away.
 *
 * IT CONFIRMS AND STOPS ASKING. A feedback control that stays live after being
 * used invites double-voting and reads as though the press did nothing.
 */
export function AiFeedback({ onRate, onComment, rated, className }: {
  onRate: (good: boolean) => void;
  onComment?: (text: string) => void;
  /** Already answered. */
  rated?: "up" | "down" | null;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = React.useId();
  const [local, setLocal] = React.useState<"up" | "down" | null>(rated ?? null);
  const [text, setText] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const state = rated ?? local;

  if (sent) return <p role="status" className={cn("text-xs text-muted-foreground", className)}>Thanks — that helps.</p>;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-1">
        {(["up", "down"] as const).map((k) => {
          const Icon = k === "up" ? ThumbsUp : ThumbsDown;
          return (
            <button key={k} type="button" aria-pressed={state === k}
              aria-label={k === "up" ? "This was helpful" : "This wasn't helpful"}
              onClick={() => { setLocal(k); onRate(k === "up"); if (k === "up") setSent(true); }}
              className={cn("grid size-7 cursor-pointer place-items-center rounded border",
                state === k ? "border-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
              <Icon aria-hidden className="size-3.5" />
            </button>
          );
        })}
      </div>
      {state === "down" && onComment && (
        <div className="flex flex-col gap-1">
          <label htmlFor={uid + "-aif"} className="text-xs text-muted-foreground">What was wrong with it?</label>
          <textarea id={uid + "-aif"} rows={2} value={text} onChange={(e) => setText(e.target.value)}
            className="rounded-md border border-input bg-transparent px-2 py-1 text-sm" />
          <button type="button" onClick={() => { onComment(text.trim()); setSent(true); }}
            className="w-fit cursor-pointer text-xs underline underline-offset-2">Send</button>
        </div>
      )}
    </div>
  );
}
