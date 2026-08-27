import { Button } from "@/components/ui/button";
import { ClipboardBlocked } from "@/components/ui/clipboard-blocked";
import { cn } from "@/lib/utils";
/**
 * The DNS record somebody has to add, in a form they can paste.
 *
 * THE THREE FIELDS ARE SEPARATE AND EACH IS COPYABLE. Every registrar asks for
 * type, host and value in three boxes, and printing them as one sentence means
 * somebody retypes — which is where a trailing dot, a missing underscore or a
 * pasted space comes from. Those typos are the whole support burden of this
 * feature.
 *
 * THE HOST IS SHOWN BOTH WAYS. Some registrars want `_verify.example.com` and
 * others want just `_verify`, and getting it wrong produces
 * `_verify.example.com.example.com` — which resolves to nothing and looks
 * correct in the form.
 *
 * IT SAYS THE CHECK IS SAFE TO REPEAT. People press verify, see it fail
 * because DNS has not propagated, and assume they have to start over.
 *
 * `ClipboardBlocked`'S FIELD RATHER THAN A COPY BUTTON, because a silently
 * failing copy here produces a value typed from memory.
 */
export function DomainVerify({ recordType = "TXT", host, hostShort, value, state, onVerify, busy, className }: {
  recordType?: string;
  /** Full host — "_isibi.example.com". */
  host: string;
  /** Short form — "_isibi". */
  hostShort?: string;
  value: string;
  state?: "waiting" | "not-found" | "verified";
  onVerify: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="domain-verify" className={cn("space-y-2", className)}>
      <p className="text-sm">Add this record at your domain provider:</p>
      <dl className="space-y-1.5">
        <div>
          <dt className="text-xs text-muted-foreground">Type</dt>
          <dd><code className="font-mono text-sm">{recordType}</code></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Host</dt>
          <dd>
            <ClipboardBlocked value={host} label="" />
            {hostShort && (
              <p className="text-xs text-muted-foreground">
                Some providers want just <code className="font-mono">{hostShort}</code> here.
              </p>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Value</dt>
          <dd><ClipboardBlocked value={value} multiline label="" /></dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={onVerify} disabled={busy}>
          {busy ? "Checking…" : "Check it now"}
        </Button>
        {state === "not-found" && (
          <span role="status" className="text-xs">
            <span className="font-medium">Not there yet.</span>{" "}
            <span className="text-muted-foreground">DNS can take an hour — checking again is free.</span>
          </span>
        )}
        {state === "verified" && (
          <span role="status" className="text-xs font-medium">Found it — this domain is verified.</span>
        )}
      </div>
    </div>
  );
}
