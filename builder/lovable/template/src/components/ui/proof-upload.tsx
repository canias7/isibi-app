import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Sending a document for checking, with what counts stated first.
 *
 * THE ACCEPTED LIST GOES BEFORE THE BUTTON. Somebody photographs a bank
 * statement, waits three days, and is told it had to be dated within the last
 * three months — a rejection that costs a week and was entirely preventable by
 * one line of text next to the button.
 *
 * THE REJECTION REASON IS SHOWN ON THE ROW, not in an email nobody keeps. "Too
 * blurry to read" is actionable in five seconds; "rejected" sends people to
 * support.
 *
 * IT SAYS WHAT HAPPENS TO THE DOCUMENT AFTERWARDS. Handing over a passport
 * scan is the most sensitive thing most of these flows ask for, and how long it
 * is kept is the question people would ask if there were anywhere to ask it.
 *
 * A `<label>` WRAPPING A VISUALLY-HIDDEN `<input type="file">`, so it is
 * genuinely a file input — reachable by keyboard and announced properly, unlike
 * a button that calls `.click()` on a hidden one.
 */
export function ProofUpload({ accepted = [], onFile, files = [], retention, busy, accept = "image/*,application/pdf", className }: {
  /** What counts — "a bank statement from the last 3 months". */
  accepted?: string[];
  onFile: (file: File) => void;
  /** What has been sent already. */
  files?: { id: string; name: string; state: "pending" | "accepted" | "rejected"; reason?: string }[];
  /** How long it is kept — "30 days after the check". */
  retention?: string;
  busy?: boolean;
  accept?: string;
  className?: string;
}) {
  const WORD = { pending: "Being checked", accepted: "Accepted", rejected: "Rejected" } as const;
  return (
    <div className={cn("space-y-2", className)}>
      {accepted.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Any one of these:</p>
          <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
            {accepted.map((a) => (
              <li key={a} className="flex gap-2"><span aria-hidden="true">·</span><span>{a}</span></li>
            ))}
          </ul>
        </div>
      )}
      {files.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {files.map((f) => (
            <li key={f.id} className="flex items-start gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-end">
                <span className={cn("block text-xs", f.state === "rejected" ? "font-medium" : "text-muted-foreground")}>
                  {WORD[f.state]}
                </span>
                {f.reason && <span className="block text-xs text-muted-foreground">{f.reason}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {/* `disabled` REACHES A `<label>` HERE, where it means nothing — `asChild`
          hands the Button's props to the child, and a label has no disabled
          state and no `:disabled` for the Button's own styling to match. So
          while busy the control still looked and behaved like a live button;
          only the `<input>` inside it was actually inert, which is the worst
          combination — it invites the click and then swallows it. The label now
          carries the state itself. Same shape as `cart-summary`'s disabled
          checkout link. */}
      <Button asChild variant="outline" size="sm" disabled={busy}>
        <label className={cn("cursor-pointer", busy && "pointer-events-none opacity-50")}
          aria-disabled={busy || undefined}>
          {busy ? "Sending…" : "Choose a document"}
          <input type="file" accept={accept} className="sr-only" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
      </Button>
      {retention && <p className="text-xs text-muted-foreground">We keep it {retention}.</p>}
    </div>
  );
}
