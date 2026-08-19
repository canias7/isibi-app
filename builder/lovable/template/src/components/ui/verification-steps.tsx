import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The checks an account has to pass, in order, with the current one actionable.
 *
 * THE DIFFERENCE FROM `wizard-nav` IS THAT THESE WAIT. A wizard step is done
 * when you finish typing; a verification step can sit for two days with a
 * third party, so "in progress" is a real state that belongs to nobody present.
 * A step bar that only knows done and not-done reports that as not started.
 *
 * ONLY THE CURRENT STEP CARRIES AN ACTION. Showing a button on every pending
 * step invites somebody to start step 3 before step 2 has come back, which
 * either fails or produces two checks running against each other.
 *
 * A BLOCKED STEP NAMES WHAT IT IS WAITING FOR. "Waiting on your ID check" is
 * the difference between somebody waiting patiently and somebody emailing
 * support daily.
 *
 * `<ol>` with the state as a word per row — the same discipline as
 * `approver-list`, and for the same reason: this gets screenshotted.
 */
export type VerificationStep = {
  id: string;
  label: string;
  state: "done" | "current" | "waiting" | "blocked" | "todo";
  /** What it is waiting on, for blocked and waiting. */
  detail?: string;
  action?: React.ReactNode;
};

const WORD = { done: "Done", current: "Your turn", waiting: "Being checked", blocked: "Waiting", todo: "" } as const;

export function VerificationSteps({ steps, className }: { steps: VerificationStep[]; className?: string }) {
  return (
    <ol className={cn("divide-y divide-border rounded-md border border-border", className)}>
      {steps.map((s, i) => (
        <li key={s.id} className="flex items-start gap-3 px-3 py-2 text-sm">
          <span aria-hidden="true"
            className={cn("mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] tabular-nums",
              s.state === "done" || s.state === "current"
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground")}>
            {s.state === "done" ? <Check className="size-3" /> : i + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block", s.state === "current" && "font-medium",
              s.state === "todo" && "text-muted-foreground")}>
              {s.label}
            </span>
            {s.detail && <span className="block text-xs text-muted-foreground">{s.detail}</span>}
          </span>
          <span className="shrink-0 text-end">
            {WORD[s.state] && (
              <span className={cn("block text-xs", s.state === "current" ? "font-medium" : "text-muted-foreground")}>
                {WORD[s.state]}
              </span>
            )}
            {s.state === "current" && s.action}
          </span>
        </li>
      ))}
    </ol>
  );
}
