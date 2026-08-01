import { cn } from "@/lib/utils";
/**
 * "You're viewing this as a guest."
 *
 * SIGNED IN AS NOBODY IS A STATE PEOPLE FORGET THEY ARE IN, and everything that
 * follows from it — work that will not save, a cart that vanishes, a comment
 * posted as Anonymous — is discovered too late. This says it at the top.
 *
 * IT NAMES WHAT WILL BE LOST rather than just inviting a sign-in. "Your changes
 * won't be kept" is a reason; "Sign in" is a suggestion people scroll past.
 *
 * Quiet by design — a bordered line, not a banner. It sits on the page for the
 * whole visit, and anything louder becomes furniture within a minute and is then
 * unread at the moment it matters.
 */
export function GuestNote({ willLose, onSignIn, signInHref, className }: {
  /** What is at risk — "Your changes won't be kept." */
  willLose?: string;
  onSignIn?: () => void;
  signInHref?: string;
  className?: string;
}) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 rounded-md border border-border px-3 py-2 text-sm", className)}>
      <span className="font-medium">You&apos;re not signed in</span>
      {willLose && <span className="text-muted-foreground">{willLose}</span>}
      {signInHref
        ? <a href={signInHref} className="underline underline-offset-4">Sign in</a>
        : onSignIn && <button type="button" onClick={onSignIn} className="cursor-pointer underline underline-offset-4">Sign in</button>}
    </p>
  );
}
