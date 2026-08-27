import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/** One integration: what it is, whether it is on, and the one button that changes that. */
export function ConnectCard({ name, description, logo, connected, account, onConnect, onDisconnect, className }: {
  name: string; description?: string; logo?: string | null; connected?: boolean;
  account?: string | null; onConnect?: () => void; onDisconnect?: () => void; className?: string;
}) {
  return (
    <div data-slot="connect-card" className={cn("flex items-start gap-3 rounded-lg border border-border p-4", className)}>
      {logo
        ? <SafeImage src={logo} alt="" className="size-9 shrink-0 rounded object-contain" />
        : <span className="flex size-9 shrink-0 items-center justify-center rounded bg-muted text-sm font-medium">{name[0]}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{name}</span>
          {connected && <StatusDot state="on" label="Connected" />}
        </div>
        {connected && account
          ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{account}</p>
          : description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {connected
        ? <Button size="sm" variant="outline" onClick={onDisconnect}>Disconnect</Button>
        : <Button size="sm" onClick={onConnect}>Connect</Button>}
    </div>
  );
}
