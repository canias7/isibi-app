import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Proving a connection works before anything depends on it.
 *
 * IT REPORTS EACH STEP, NOT A VERDICT. "Connection failed" leaves somebody
 * changing credentials when the real problem was a firewall or a missing
 * permission. Reached-them, authenticated, permission-checked, read-a-record —
 * whichever one stops is the fix.
 *
 * THE FAILING STEP CARRIES THE ADVICE. That is the moment a suggestion is
 * useful ("the key is right but the account cannot see invoices — check its
 * role"), and it is wasted anywhere else.
 *
 * IT ALWAYS READS SOMETHING REAL. A test that stops at authentication passes on
 * connections that cannot see a single record — which is the commonest way a
 * green tick precedes an empty sync.
 *
 * `role="status"` on the list so each step is announced as it completes, and
 * the steps are words rather than ticks and crosses.
 */
export type TestStep = {
  id: string;
  label: string;
  state: "pending" | "running" | "ok" | "failed" | "skipped";
  /** Shown on the failing step. */
  detail?: string;
};

export function TestConnection({ steps, onTest, running, className }: {
  steps: TestStep[];
  onTest: () => void;
  running?: boolean;
  className?: string;
}) {
  const WORD = { pending: "", running: "Checking…", ok: "OK", failed: "Failed", skipped: "Skipped" } as const;
  const failed = steps.find((s) => s.state === "failed");
  const done = steps.length > 0 && steps.every((s) => s.state !== "pending" && s.state !== "running");
  return (
    <div data-slot="test-connection" className={cn("space-y-2", className)}>
      <Button type="button" size="sm" onClick={onTest} disabled={running}>
        {running ? "Testing…" : "Test this connection"}
      </Button>
      {steps.length > 0 && (
        <ol role="status" className="divide-y divide-border rounded-md border border-border text-sm">
          {steps.map((s) => (
            <li key={s.id} className="flex items-start gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1">
                <span className={cn(s.state === "failed" && "font-medium",
                  (s.state === "pending" || s.state === "skipped") && "text-muted-foreground")}>
                  {s.label}
                </span>
                {s.state === "failed" && s.detail && (
                  <span className="block text-xs text-muted-foreground">{s.detail}</span>
                )}
              </span>
              <span className={cn("shrink-0 text-xs", s.state === "failed" ? "font-medium" : "text-muted-foreground")}>
                {WORD[s.state]}
              </span>
            </li>
          ))}
        </ol>
      )}
      {done && !failed && (
        <p className="text-xs text-muted-foreground">Everything works — this connection can read real records.</p>
      )}
    </div>
  );
}
