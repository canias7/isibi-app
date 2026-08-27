import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Writing a comment, with the half-typed one not thrown away.
 *
 * A DRAFT SURVIVES CANCELLING, and that is the point. Somebody types three
 * sentences, clicks elsewhere to check a fact, comes back and finds the box
 * empty — which is the most common way a considered comment never gets posted.
 * Cancel keeps the text and says so; only discard removes it.
 *
 * ENTER DOES NOT POST. In a comment box, Enter is a paragraph break far more
 * often than it is a submit — this is not a chat line, and posting half a
 * thought because somebody pressed return is unrecoverable once it has
 * notified everybody.
 *
 * IT SAYS THE DRAFT IS PRIVATE. People genuinely worry that a half-written
 * comment is visible to whoever else is in the document, and on a live
 * collaborative page that is not an unreasonable thing to wonder.
 *
 * DISCARD CONFIRMS ONLY WHEN THERE IS SOMETHING TO LOSE, so an empty box closes
 * without a dialog.
 */
export function CommentDraft({ value, onChange, onPost, onCancel, onDiscard, busy, placeholder = "Add a comment", postLabel = "Comment", className }: {
  value: string;
  onChange: (v: string) => void;
  onPost: () => void;
  /** Keeps the text. */
  onCancel?: () => void;
  /** Throws it away. */
  onDiscard?: () => void;
  busy?: boolean;
  placeholder?: string;
  postLabel?: string;
  className?: string;
}) {
  const [touched, setTouched] = useState(false);
  const has = value.trim().length > 0;
  return (
    <div data-slot="comment-draft" className={cn("space-y-1.5", className)}>
      <textarea rows={3} value={value} placeholder={placeholder} aria-label={placeholder}
        onChange={(e) => { onChange(e.target.value); setTouched(true); }}
        className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm" />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={!has || busy} onClick={onPost}>
          {busy ? "Posting…" : postLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        )}
        {onDiscard && has && (
          <button type="button" className="text-xs underline underline-offset-2"
            onClick={() => { if (window.confirm("Throw away what you have written?")) onDiscard(); }}>
            Discard
          </button>
        )}
        {has && touched && (
          <span className="ms-auto text-xs text-muted-foreground">Only you can see this until you post it</span>
        )}
      </div>
    </div>
  );
}
