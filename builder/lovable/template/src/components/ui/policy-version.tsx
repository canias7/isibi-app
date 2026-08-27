import { cn } from "@/lib/utils";
/**
 * Which version of a policy is in force, and which one you agreed to.
 *
 * IT COMPARES THE TWO VERSIONS. A policy page showing only the current version
 * cannot answer the question that matters — did this person accept THESE terms?
 * — and the answer decides whether they need re-asking. Showing both makes the
 * gap visible.
 *
 * "AGREED TO AN OLDER VERSION" IS NOT AUTOMATICALLY A PROBLEM, and the
 * component does not treat it as one. Most changes are minor; only some require
 * fresh consent. `mustReaccept` is the caller's judgement, and it is the only
 * thing that turns this from information into an action.
 *
 * THE EFFECTIVE DATE IS SHOWN, not just the version number. "v3.1" means
 * nothing to a customer; "in force since 2 June" is checkable against when they
 * signed up.
 *
 * A LINK TO THE OLDER VERSION where the caller keeps them. Somebody comparing
 * what they agreed to against what is now claimed needs the text, and products
 * that overwrite their policy pages make that impossible.
 */
export function PolicyVersion({ name, current, currentFrom, agreed, agreedAt, mustReaccept, olderUrl, className }: {
  name: string;
  /** Current version — "3.1". */
  current: string;
  /** Free text — "2 June 2026". */
  currentFrom?: string;
  /** The version this person accepted. */
  agreed?: string;
  /** Free text — "14 January 2026". */
  agreedAt?: string;
  /** True when the change requires fresh consent. */
  mustReaccept?: boolean;
  /** Link to the version they agreed to. */
  olderUrl?: string;
  className?: string;
}) {
  const behind = agreed !== undefined && agreed !== current;
  return (
    <div data-slot="policy-version" className={cn("space-y-0.5 text-xs", className)}>
      <p>
        <span className="text-foreground">{name} v{current}</span>
        {currentFrom && <span className="text-muted-foreground"> · in force since {currentFrom}</span>}
      </p>
      {agreed !== undefined && (
        <p className={cn(mustReaccept ? "font-medium" : "text-muted-foreground")}>
          {behind ? (
            <>
              You agreed to v{agreed}
              {agreedAt && ` on ${agreedAt}`}
              {mustReaccept ? " — this change needs your agreement again." : " — the changes since then were minor."}
            </>
          ) : (
            <>You agreed to this version{agreedAt && ` on ${agreedAt}`}.</>
          )}
        </p>
      )}
      {behind && olderUrl && (
        <p>
          <a href={olderUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Read v{agreed}, the version you agreed to
          </a>
        </p>
      )}
    </div>
  );
}
