import { cn } from "@/lib/utils";
/**
 * "You are on the new version early" — said to the people it is true of.
 *
 * BEING IN A CANARY GROUP IS INVISIBLE AND THAT CAUSES REAL CONFUSION. Somebody
 * describes a feature to a colleague who cannot find it, or reports a bug
 * nobody else can reproduce, and neither knows they are on different builds.
 * One line resolves both.
 *
 * IT SAYS WHETHER THEY CAN LEAVE. Some canary groups are opt-in and reversible,
 * some are a percentage rollout nobody chose — and offering an exit that does
 * not exist is worse than saying plainly that it will reach everyone soon.
 *
 * IT ASKS FOR THE THING CANARIES ARE FOR. Being early is a trade: they get it
 * first and we get told when it is wrong. Naming that makes the report more
 * likely and the relationship honest.
 *
 * `role="note"` — a standing fact, not an interruption, and it should sit
 * quietly rather than announcing itself on every page load.
 */
export function CanaryNote({ version, why, canLeave, onLeave, reportUrl, className }: {
  version?: string;
  /** Why they are in it — "you opted in", "a small group is trying it first". */
  why?: string;
  canLeave?: boolean;
  onLeave?: () => void;
  reportUrl?: string;
  className?: string;
}) {
  return (
    <p data-slot="canary-note" role="note" className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground", className)}>
      <span>
        <span className="text-foreground">You are trying {version ? `v${version}` : "a new version"} early.</span>
        {why && <span> {why}.</span>}
        <span className="block">
          Other people may not see the same thing yet.
          {reportUrl ? " Tell us if something looks wrong." : ""}
        </span>
      </span>
      {canLeave && onLeave && (
        <button type="button" onClick={onLeave} className="underline underline-offset-2">
          Go back to the normal version
        </button>
      )}
      {!canLeave && <span>This will reach everyone soon.</span>}
      {reportUrl && (
        <a href={reportUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          Report something
        </a>
      )}
    </p>
  );
}
