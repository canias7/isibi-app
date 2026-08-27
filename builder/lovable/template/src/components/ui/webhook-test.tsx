import { useId } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Sending a fake event to an endpoint, marked as a test.
 *
 * THE TEST FLAG IS IN THE PAYLOAD AND SAID HERE. A test event that looks
 * identical to a real one gets processed as real — a test "order placed" ships
 * a product. Every webhook implementation should check the flag, and this is
 * where the person setting it up learns the flag exists.
 *
 * IT SENDS A REALISTIC PAYLOAD, NOT AN EMPTY ONE. `{"test": true}` proves the
 * URL is reachable and nothing about whether their parser copes with the real
 * shape — which is the actual question, and the failure that shows up in
 * production instead.
 *
 * THE RESPONSE IS SHOWN IN FULL. This is a debugging tool used by somebody
 * looking at their own server, and the status and body are the entire output.
 *
 * `role="status"` on the result, so it is announced rather than appearing
 * quietly under a button somebody has already looked away from.
 */
export function WebhookTest({ events, value, onChange, onSend, sending, result, className }: {
  events: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  onSend: () => void;
  sending?: boolean;
  /** The endpoint's answer. */
  result?: { status?: number; ms?: number; body?: string; error?: string };
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  return (
    <div data-slot="webhook-test" className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-end gap-2">
        <span className="space-y-1">
          <label htmlFor={uid + "-wt-event"} className="block text-sm font-medium">Send a test</label>
          <NativeSelect id={uid + "-wt-event"} value={value} className="h-9 w-auto text-sm"
            onChange={(e) => onChange(e.target.value)}>
            {events.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </NativeSelect>
        </span>
        <Button type="button" size="sm" onClick={onSend} disabled={sending}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        A realistic payload with <code className="font-mono">"test": true</code> in it. Your endpoint should check that
        flag and not act on it.
      </p>
      {result && (
        <div role="status" className="space-y-1 rounded-md border border-border p-2.5">
          {result.error ? (
            <p className="text-sm font-medium">{result.error}</p>
          ) : (
            <p className="text-sm">
              <span className="font-medium tabular-nums">{result.status}</span>
              {result.ms !== undefined && <span className="text-muted-foreground tabular-nums"> · {result.ms} ms</span>}
            </p>
          )}
          {result.body && (
            <div className="overflow-x-auto">
              <pre className="font-mono text-xs text-muted-foreground">{result.body}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
