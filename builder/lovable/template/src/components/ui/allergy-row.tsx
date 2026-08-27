import { cn } from "@/lib/utils";
/**
 * A recorded allergy — with the reaction, which is the part that matters.
 *
 * WHAT ACTUALLY HAPPENED IS THE FIELD, NOT A SEVERITY WORD. "Severe" means
 * different things to different people; "throat closed, needed adrenaline" and
 * "itchy rash" are both filed as allergies and are not the same clinical
 * question. The description is what a clinician reads and it is optional in most
 * systems.
 *
 * AN INTOLERANCE IS NOT AN ALLERGY AND IS MARKED AS ONE. Recording a stomach
 * upset as an allergy removes a medicine from somebody's options for life, and
 * this mislabelling is extremely common and rarely revisited.
 *
 * WHO REPORTED IT AND WHETHER IT WAS TESTED. A patient's account, a relative's
 * account and a positive test are three different weights of evidence, and a
 * single row makes them look identical.
 *
 * IT IS NEVER SILENTLY REMOVED. Something recorded wrongly is marked as
 * disputed, with who disputed it, because deleting the line loses the reason
 * anybody thought it in the first place.
 */
export function AllergyRow({ substance, reaction, kind = "allergy", reportedBy, tested, recordedOn, disputed, disputedBy, className }: {
  substance: string;
  /** What actually happened. Not a severity word. */
  reaction?: string;
  /** Marking an intolerance as an allergy removes a medicine for life. */
  kind?: "allergy" | "intolerance" | "side effect";
  reportedBy?: string;
  tested?: boolean;
  recordedOn?: string;
  /** Marked, never deleted. */
  disputed?: boolean;
  disputedBy?: string;
  className?: string;
}) {
  return (
    <li data-slot="allergy-row" className={cn("space-y-0.5 px-3 py-2 text-sm", disputed && "text-muted-foreground", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 font-medium">{substance}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {kind === "allergy" ? "Allergy" : kind === "intolerance" ? "Intolerance" : "Side effect"}
        </span>
      </p>
      {reaction ? (
        <p className="text-sm">{reaction}</p>
      ) : (
        <p className="text-xs font-medium">
          No reaction recorded. Nobody reading this can tell a rash from anaphylaxis.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {[
          reportedBy && `Reported by ${reportedBy}`,
          tested === true ? "confirmed by testing" : tested === false ? "not tested" : "",
          recordedOn,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {kind === "intolerance" && (
        <p className="text-xs text-muted-foreground">
          Recorded as an intolerance, not an allergy. It does not rule the medicine out.
        </p>
      )}
      {disputed && (
        <p className="text-xs font-medium">
          Disputed{disputedBy ? ` by ${disputedBy}` : ""}. Kept rather than deleted, so the reason it was recorded is
          not lost.
        </p>
      )}
    </li>
  );
}
