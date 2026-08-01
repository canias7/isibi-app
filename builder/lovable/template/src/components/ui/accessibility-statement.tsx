import { cn } from "@/lib/utils";
/**
 * What is not accessible about a service — stated honestly.
 *
 * THE KNOWN PROBLEMS ARE THE CONTENT. A statement claiming full conformance and
 * listing nothing is the standard output and is almost never true; the useful
 * document names what does not work, so somebody can decide whether to attempt
 * it or ask for another route.
 *
 * EACH PROBLEM CARRIES AN ALTERNATIVE WAY TO DO THE SAME THING. That is the
 * part that actually helps: a form nobody can complete with a screen reader is
 * survivable if there is a phone number, and unusable if there is not.
 *
 * FIX DATES ARE SHOWN WHERE THEY EXIST AND ADMITTED WHERE THEY DO NOT. "No date
 * yet" is honest and common; an invented one is a promise the reader will plan
 * around.
 *
 * THE COMPLAINT ROUTE IS INCLUDED, because a statement with no way to report a
 * problem is a document written for a regulator rather than for a user.
 */
export type AccessProblem = { id: string; problem: string; alternative?: string; fixBy?: string };

export function AccessibilityStatement({ conformance, problems = [], lastReviewed, reportTo, className }: {
  /** Plain words — "partly meets the standard". */
  conformance?: string;
  problems?: AccessProblem[];
  /** Free text — "14 July 2026". */
  lastReviewed?: string;
  /** How to report a problem. */
  reportTo?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5 text-sm", className)}>
      {conformance && <p>{conformance}</p>}
      {problems.length === 0 ? (
        <p className="text-xs text-muted-foreground">No known problems are listed.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {problems.map((p) => (
            <li key={p.id} className="space-y-0.5 px-3 py-2">
              <p className="text-sm">{p.problem}</p>
              {p.alternative ? (
                <p className="text-xs">Instead: {p.alternative}</p>
              ) : (
                <p className="text-xs font-medium">There is no alternative route for this yet.</p>
              )}
              <p className="text-xs text-muted-foreground">
                {p.fixBy ? `We expect to fix this by ${p.fixBy}.` : "No fix date yet."}
              </p>
            </li>
          ))}
        </ul>
      )}
      {lastReviewed && <p className="text-xs text-muted-foreground">Last reviewed {lastReviewed}.</p>}
      {reportTo && <p className="text-xs">Found something else? {reportTo}</p>}
    </div>
  );
}
