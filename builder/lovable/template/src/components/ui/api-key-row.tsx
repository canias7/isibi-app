import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * A key that has already been issued.
 *
 * The value is a PREFIX, never the whole key. A list that can show every key
 * in full turns one look over a shoulder into every credential the account
 * has; the full value exists once, at creation, and never again.
 */
export function ApiKeyRow({ name, prefix, createdAt, lastUsed, onRevoke, className }: {
  name: string; prefix: string; createdAt?: string | number | Date;
  lastUsed?: string | number | Date | null; onRevoke?: () => void; className?: string;
}) {
  return (
    <div data-slot="api-key-row" className={cn("flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-0", className)}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          {prefix}<span aria-hidden="true">••••••••</span>
          <CopyButton value={prefix} label="Copy key prefix" iconOnly />
        </p>
      </div>
      <div className="text-xs text-muted-foreground">
        {createdAt && <p>Created <DateFormat date={createdAt} /></p>}
        <p>{lastUsed ? <>Last used <DateFormat date={lastUsed} /></> : "Never used"}</p>
      </div>
      {onRevoke && <Button size="sm" variant="outline" onClick={onRevoke}>Revoke</Button>}
    </div>
  );
}
