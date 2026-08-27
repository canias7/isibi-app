import { cn } from "@/lib/utils";
/**
 * Why this was suggested — including the parts that do not fit.
 *
 * THE MISMATCHES ARE SHOWN ALONGSIDE THE MATCHES. A list of reasons to say yes
 * is an advert, and people learn to discount it. Showing the two things that do
 * not line up is what makes the rest believable — and it saves the conversation
 * where both sides discover it in week three.
 *
 * A REASON POINTS AT SOMETHING STATED, not at an inference. "You both said
 * Tuesday evenings" is checkable; "you seem like a good fit" is not, and the
 * second is what makes people distrust matching entirely.
 *
 * IT DISTINGUISHES A HARD REQUIREMENT FROM A PREFERENCE. Missing a stated
 * must-have is not a small mismatch, and burying it among preferences is how a
 * suggestion wastes both sides' time.
 *
 * NO WEIGHTS OR SCORES PER REASON. A number beside each reason implies the
 * model measured its importance, which it did not — it was told, roughly, once.
 */
export type Reason = { id: string; text: string; kind: "match" | "mismatch"; requirement?: boolean };

export function MatchReason({ reasons, className }: { reasons: Reason[]; className?: string }) {
  const matches = reasons.filter((r) => r.kind === "match");
  const mismatches = reasons.filter((r) => r.kind === "mismatch");
  const brokenRequirements = mismatches.filter((r) => r.requirement);
  return (
    <div data-slot="match-reason" className={cn("space-y-1", className)}>
      {matches.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs font-medium">What lines up</p>
          <ul className="text-xs text-muted-foreground">
            {matches.map((r) => (
              <li key={r.id} className="flex gap-2"><span aria-hidden="true">—</span><span>{r.text}</span></li>
            ))}
          </ul>
        </div>
      )}
      {mismatches.length > 0 ? (
        <div className="space-y-0.5">
          <p className="text-xs font-medium">What does not</p>
          <ul className="text-xs">
            {mismatches.map((r) => (
              <li key={r.id} className="flex gap-2">
                <span aria-hidden="true" className="text-muted-foreground">—</span>
                <span className={cn(r.requirement && "font-medium")}>
                  {r.text}
                  {r.requirement && " — this was stated as a requirement, not a preference"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nothing was found that does not fit, which usually means we do not know enough yet.
        </p>
      )}
      {brokenRequirements.length > 0 && (
        <p className="text-xs font-medium">
          {brokenRequirements.length === 1 ? "A stated requirement is" : `${brokenRequirements.length} stated requirements are`} not met.
          Read that before the rest.
        </p>
      )}
    </div>
  );
}
