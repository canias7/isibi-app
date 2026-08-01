import { cn } from "@/lib/utils";
/**
 * One breaking change, as before-and-after code.
 *
 * BEFORE AND AFTER, LITERALLY. A prose description of a breaking change makes
 * every reader translate it into their own code and some of them get it wrong;
 * two snippets are unambiguous and can be diffed by eye in a second.
 *
 * IT SAYS HOW TO TELL IF YOU ARE AFFECTED. Most readers of a breaking change
 * are not — and the ones who cannot tell either upgrade blindly or not at all.
 * "You are affected if you read the `date` field" resolves it faster than any
 * amount of description.
 *
 * THE FAILURE MODE IS NAMED. Whether ignoring this produces an error or a
 * silently wrong result decides how urgent it is, and a silent one is far worse
 * — that is the sentence that gets it prioritised correctly.
 *
 * `<pre>` IN A SCROLL CONTAINER, since a wide line of code must not make the
 * page scroll sideways — the rule this kit follows everywhere.
 */
export function BreakingChangeNote({ title, affectedIf, before, after, failureMode, className }: {
  title: string;
  /** How to tell whether it matters to you. */
  affectedIf?: string;
  /** The old form. */
  before?: string;
  /** The new form. */
  after?: string;
  /** What happens if ignored. */
  failureMode?: "error" | "silent";
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm font-medium">{title}</p>
      {affectedIf && (
        <p className="text-xs text-muted-foreground">This affects you if {affectedIf}.</p>
      )}
      {failureMode && (
        <p className={cn("text-xs", failureMode === "silent" ? "font-medium" : "text-muted-foreground")}>
          {failureMode === "silent"
            ? "If you do nothing, it keeps working and gives the wrong answer."
            : "If you do nothing, it fails with an error."}
        </p>
      )}
      {(before || after) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {before && (
            <div>
              <p className="text-xs text-muted-foreground">Before</p>
              <div className="overflow-x-auto rounded-md border border-border bg-muted/30 p-2">
                <pre className="font-mono text-xs">{before}</pre>
              </div>
            </div>
          )}
          {after && (
            <div>
              <p className="text-xs text-muted-foreground">After</p>
              <div className="overflow-x-auto rounded-md border border-border bg-muted/30 p-2">
                <pre className="font-mono text-xs">{after}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
