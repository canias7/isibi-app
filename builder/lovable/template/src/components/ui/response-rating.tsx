import * as React from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Thumbs up and down on an answer.
 *
 * IT ONLY ASKS FOR WORDS AFTER A NO. Asking everyone for a comment gets very
 * few; asking the person who just said it did not help gets the useful ones.
 * Same rule as `feedback-widget`, and it is the whole difference between
 * feedback that is read and feedback that is counted.
 *
 * The reasons are a short CLOSED list plus a free box. "Wrong" and "too long"
 * are different problems with different fixes, and a wall of free text has to
 * be read by somebody before it means anything.
 *
 * A rating can be UNDONE by pressing the same button again. People misclick,
 * and a permanent judgement on the wrong message is worse data than none.
 *
 * The buttons are `aria-pressed` toggles rather than a radio group, since
 * neither is a required answer and the third state — nothing said — is the one
 * almost everybody is in.
 */
const REASONS = ["Not correct", "Did not follow the instruction", "Too long", "Too short", "Unsafe or offensive"];

export function ResponseRating({ value, onRate, onComment, reasons = REASONS, className }: {
  value?: "up" | "down" | null;
  onRate: (value: "up" | "down" | null) => void;
  onComment?: (reason: string | null, text: string) => void;
  reasons?: string[];
  className?: string;
}) {
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");

  const press = (v: "up" | "down") => {
    const next = value === v ? null : v;
    onRate(next);
    setAsking(next === "down");
  };

  return (
    <div data-slot="response-rating" className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => press("up")} aria-pressed={value === "up"} aria-label="Good answer"
          className={cn("cursor-pointer rounded p-1.5 hover:bg-muted", value === "up" && "bg-muted")}>
          <ThumbsUp aria-hidden className={cn("size-3.5", value === "up" ? "fill-current" : "text-muted-foreground")} />
        </button>
        <button type="button" onClick={() => press("down")} aria-pressed={value === "down"} aria-label="Bad answer"
          className={cn("cursor-pointer rounded p-1.5 hover:bg-muted", value === "down" && "bg-muted")}>
          <ThumbsDown aria-hidden className={cn("size-3.5", value === "down" ? "fill-current" : "text-muted-foreground")} />
        </button>
      </div>

      {asking && onComment ? (
        <form
          onSubmit={(e) => { e.preventDefault(); onComment(reason, text.trim()); setAsking(false); setText(""); }}
          className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <p className="text-xs font-medium">What went wrong?</p>
          <div className="flex flex-wrap gap-1.5">
            {reasons.map((r) => (
              <button key={r} type="button" onClick={() => setReason((x) => (x === r ? null : r))}
                aria-pressed={reason === r}
                className={cn("cursor-pointer rounded-full border px-2 py-0.5 text-xs",
                  reason === r ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
                {r}
              </button>
            ))}
          </div>
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Anything else? (optional)" aria-label="What went wrong"
            className="resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus-visible:border-ring" />
          <div className="flex items-center gap-3">
            <button type="submit"
              className="cursor-pointer rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:opacity-90">
              Send
            </button>
            <button type="button" onClick={() => setAsking(false)}
              className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              No thanks
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
