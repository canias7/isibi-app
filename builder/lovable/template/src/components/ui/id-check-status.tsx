import { cn } from "@/lib/utils";
/**
 * Where an identity check has got to, and what the person must do next.
 *
 * FIVE STATES, BECAUSE FOUR IS NOT ENOUGH. Not started, waiting on us, waiting
 * on you, passed, failed — and "waiting on you" is the one always folded into
 * "pending", which is why people sit for days believing a check is being
 * processed when it is actually stuck on a photo they never sent.
 *
 * EVERY STATE NAMES WHO IS BLOCKING. That is the single fact somebody wants,
 * and it is the one a status word never carries on its own.
 *
 * A FAILED CHECK SAYS WHETHER IT CAN BE RETRIED. "Could not verify" with no
 * next step is where these flows abandon people entirely — usually the answer
 * is a clearer photo, and it needs saying.
 *
 * NO GREEN TICK / RED CROSS. This is the screen somebody screenshots to send to
 * support, and it is exactly where colour-only state stops working.
 */
const STATES = {
  none: { word: "Not started", who: "" },
  pending: { word: "Being checked", who: "Nothing for you to do — we will let you know." },
  action: { word: "Waiting for you", who: "" },
  passed: { word: "Verified", who: "" },
  failed: { word: "Could not be verified", who: "" },
} as const;

export function IdCheckStatus({ state, needed, reason, canRetry, updatedAt, action, className }: {
  state: keyof typeof STATES;
  /** What you must send, for the "action" state. */
  needed?: string;
  /** Why it failed. */
  reason?: string;
  canRetry?: boolean;
  /** Free text — "2 hours ago". */
  updatedAt?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const s = STATES[state];
  const detail = state === "action" ? (needed ? `We need ${needed}.` : "We need something from you.")
    : state === "failed" ? [reason, canRetry ? "You can try again." : "Please contact us."].filter(Boolean).join(" ")
    : s.who;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border px-3 py-2 text-sm",
      (state === "action" || state === "failed") && "border-foreground/40 bg-muted/40", className)}>
      <span className="min-w-0 flex-1">
        <span className={cn("block", state !== "pending" && "font-medium")}>{s.word}</span>
        {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
        {updatedAt && <span className="block text-xs text-muted-foreground">Updated {updatedAt}</span>}
      </span>
      {action}
    </div>
  );
}
