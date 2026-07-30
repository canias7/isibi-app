import { Button } from "@/components/ui/button";
import { AvatarName } from "@/components/ui/avatar-name";
import { cn } from "@/lib/utils";
/**
 * A sign-in method attached to an account — Google, Apple, a passkey.
 *
 * `canRemove` is passed in rather than inferred: dropping the only way into an
 * account strands somebody who still owns rows, and only the caller can count
 * the others.
 */
export function ConnectedAccount({ provider, identity, avatar, canRemove = true, onRemove, className }: {
  provider: string; identity?: string | null; avatar?: string | null;
  canRemove?: boolean; onRemove?: () => void; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 border-b border-border py-3 last:border-0", className)}>
      <AvatarName name={provider} subtitle={identity} src={avatar} size="sm" />
      <span className="flex-1" />
      {onRemove && (
        <Button size="sm" variant="ghost" disabled={!canRemove} onClick={onRemove}
          title={canRemove ? undefined : "This is the only way into the account."}>
          Remove
        </Button>
      )}
    </div>
  );
}
