import { cn } from "@/lib/utils";
/**
 * "This is going away" — with the date and the replacement.
 *
 * THREE FACTS OR IT IS NOISE: what is going, when, and what to use instead. A
 * deprecation notice missing the replacement is a problem with no solution, and
 * one missing the date gets ignored until it breaks — both are the norm.
 *
 * THE DATE IS ABSOLUTE. "Deprecated, will be removed in a future release" is
 * unschedulable, so nobody schedules it; "removed on 1 December" goes in a
 * calendar. Where a date genuinely is not fixed, saying so is better than
 * implying one.
 *
 * "STILL WORKS UNTIL THEN" IS STATED, because half of deprecation panic is
 * people believing something has already stopped. Deprecated and removed are
 * different states and this is the first.
 *
 * PAST THE DATE IT CHANGES TENSE and becomes an alert — the same
 * before-and-after distinction `approval-deadline` and `credential-expiry`
 * make, and for the same reason: a future-tense warning about something already
 * gone is misread as time remaining.
 */
export function DeprecationNote({ what, removedOn, removed, replacement, migrationUrl, className }: {
  /** What is going — "the v1 booking endpoint". */
  what: string;
  /** Free text — "1 December 2026". */
  removedOn?: string;
  /** True once it is actually gone. */
  removed?: boolean;
  /** What to use — "the v2 endpoint". */
  replacement?: string;
  migrationUrl?: string;
  className?: string;
}) {
  return (
    <div {...(removed ? { role: "alert" as const } : {})}
      className={cn("space-y-0.5 text-xs", className)}>
      <p className={cn(removed && "font-medium")}>
        {removed
          ? <>{what} has been removed{removedOn ? ` — it went on ${removedOn}` : ""}.</>
          : <>{what} is going away{removedOn ? ` on ${removedOn}` : " at some point"}.</>}
      </p>
      {!removed && (
        <p className="text-muted-foreground">It still works until then — nothing has stopped.</p>
      )}
      <p className="text-muted-foreground">
        {replacement ? <>Use {replacement} instead.</> : "There is no direct replacement — ask us."}
        {migrationUrl && (
          <>
            {" "}
            <a href={migrationUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              How to move over
            </a>
          </>
        )}
      </p>
    </div>
  );
}
