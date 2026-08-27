import { cn } from "@/lib/utils";
/**
 * Telling somebody no — with something they can use.
 *
 * A REASON IS OFFERED, AND IT IS THE ACTUAL ONE. Generic rejection text is what
 * makes applying feel like shouting into a void, and one honest sentence —
 * "the person appointed had run this exact system before" — costs nothing and
 * is remembered.
 *
 * THE STAGE REACHED IS STATED. Being rejected after three interviews and being
 * screened out on day one are completely different pieces of information about
 * where somebody stands, and a single template flattens them.
 *
 * FEEDBACK IS OFFERED AS A CHOICE rather than attached. Not everybody wants it
 * at the moment of rejection, and sending it unasked to somebody who does not
 * is unkind in a way a template cannot judge.
 *
 * IT NEVER SAYS THE ROLE WAS FILLED INTERNALLY UNLESS IT WAS. That specific
 * lie is the standard comfort and it teaches people the whole process was
 * theatre.
 */
export function RejectionNote({ role, stageReached, reason, feedbackOffered, keepOnFile, reapplyNote, className }: {
  role?: string;
  /** How far they got — "after the second interview". */
  stageReached?: string;
  /** The real reason, in one sentence. */
  reason?: string;
  feedbackOffered?: boolean;
  /** Whether they have been asked about the talent pool. */
  keepOnFile?: boolean;
  /** "We advertise something similar most quarters." */
  reapplyNote?: string;
  className?: string;
}) {
  return (
    <div data-slot="rejection-note" className={cn("space-y-1 text-sm", className)}>
      <p>
        We are not taking your application further
        {role && <span> for {role}</span>}
        {stageReached && <span className="text-muted-foreground"> — {stageReached}</span>}.
      </p>
      <p className={cn("text-xs", reason ? "" : "font-medium")}>
        {reason ?? "No reason has been recorded, which is the thing candidates find hardest."}
      </p>
      {feedbackOffered && (
        <p className="text-xs text-muted-foreground">
          If you would like fuller feedback, ask and we will send it — we do not send it unasked.
        </p>
      )}
      {keepOnFile !== undefined && (
        <p className="text-xs text-muted-foreground">
          {keepOnFile
            ? "With your agreement we will keep your details for future roles."
            : "We will not keep your details on file."}
        </p>
      )}
      {reapplyNote && <p className="text-xs">{reapplyNote}</p>}
    </div>
  );
}
