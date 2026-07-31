import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "You are signed in, and this is not yours."
 *
 * Distinct from a sign-in prompt, and getting that distinction right is the
 * whole job: showing a login form to somebody already signed in sends them
 * round a loop they cannot leave, because signing in again changes nothing.
 *
 * It never says WHOSE it is or that it exists — that is an enumeration
 * oracle, the same reason the API answers 404 rather than 403 for another
 * member's row.
 */
export function Forbidden({ title = "You don't have access to this", body, onBack, onSwitchAccount, className }: {
  title?: string; body?: string; onBack?: () => void; onSwitchAccount?: () => void; className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center", className)}>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        {body ?? "If you think you should, ask whoever manages the account to give you access."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {onBack && <Button variant="outline" onClick={onBack}>Go back</Button>}
        {onSwitchAccount && <Button variant="ghost" onClick={onSwitchAccount}>Sign in as someone else</Button>}
      </div>
    </div>
  );
}
