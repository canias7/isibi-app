import { useState , useId } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Deleting your own account and data, with what survives it stated first.
 *
 * WHAT CANNOT BE DELETED IS THE HONEST PART. Invoices have to be kept for tax,
 * and a page promising to erase everything while quietly retaining them is
 * making a claim it cannot honour. Listing the exceptions, with reasons, before
 * the confirmation is the difference between a deletion flow and a lie.
 *
 * TYPING A WORD, NOT TICKING A BOX. This is the one irreversible action in most
 * products, and a checkbox is the same gesture as every reversible one on the
 * page. The word is compared case-insensitively — testing typing accuracy is
 * not the point, deliberateness is.
 *
 * A GRACE PERIOD IS SAID PLAINLY WHERE THERE IS ONE. "You have 30 days to
 * change your mind" changes the decision entirely, and it is the thing people
 * search support for after they have already pressed the button.
 *
 * IT DOES NOT CALL ITSELF DANGEROUS OR SHOUT. The reader has decided; the job
 * is to make sure they know what happens, not to talk them out of it.
 */
export function DeleteMyData({ confirmWord = "DELETE", retained = [], graceDays, onDelete, onCancel, busy, className }: {
  confirmWord?: string;
  /** Things that survive, each with a reason. */
  retained?: { label: string; reason: string }[];
  /** Days before it is irreversible. */
  graceDays?: number;
  onDelete: () => void;
  onCancel?: () => void;
  busy?: boolean;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === confirmWord.trim().toLowerCase();
  return (
    <form className={cn("space-y-3 rounded-md border border-border p-3", className)}
      onSubmit={(e) => { e.preventDefault(); if (matches) onDelete(); }}>
      <p className="text-sm font-medium">Delete your account and data</p>
      {retained.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm">These are kept even after deletion:</p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {retained.map((r) => (
              <li key={r.label} className="flex gap-2">
                <span aria-hidden="true">·</span>
                <span><span className="text-foreground">{r.label}</span> — {r.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {graceDays
          ? `You have ${graceDays} days to change your mind. After that it cannot be undone.`
          : "This cannot be undone."}
      </p>
      <div className="space-y-1">
        <label htmlFor={uid + "-delete-confirm"} className="block text-sm">
          Type <span className="font-medium">{confirmWord}</span> to confirm
        </label>
        <input id={uid + "-delete-confirm"} value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!matches || busy}>Delete everything</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Keep my account</Button>}
      </div>
    </form>
  );
}
