import { useState , useId } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/**
 * A formal declaration, made one statement at a time.
 *
 * ONE TICK PER STATEMENT, NEVER ONE FOR ALL OF THEM. A single box covering four
 * claims is a box people tick without reading, and it is worth nothing when one
 * of the four turns out to be false — nobody can say which they actually meant.
 * Separate boxes are the difference between a declaration and a formality.
 *
 * THE CONSEQUENCE OF A FALSE DECLARATION IS STATED. That is what makes somebody
 * read the statements, and it is usually already written down somewhere nobody
 * sees.
 *
 * THE DECLARER'S NAME IS TYPED, not taken from the session. A declaration made
 * on somebody else's logged-in machine is the ordinary case in a shared office,
 * and typing the name is both the friction and the record.
 *
 * IT RECORDS WHAT WAS AGREED, not just that something was. `onSubmit` returns
 * the statement ids, because a declaration is only evidence if the exact
 * wording can be reconstructed later.
 */
export function AttestationBox({ statements, consequence, signerName, onSubmit, busy, submitLabel = "Declare", className }: {
  statements: { id: string; text: string }[];
  /** What happens if it is untrue. */
  consequence?: string;
  /** Expected name — the typed one must match. */
  signerName: string;
  onSubmit: (v: { agreed: string[]; name: string }) => void;
  busy?: boolean;
  submitLabel?: string;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  const [agreed, setAgreed] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const all = statements.every((s) => agreed.includes(s.id));
  const named = norm(typed) === norm(signerName) && norm(signerName) !== "";
  return (
    <form data-slot="attestation-box" className={cn("space-y-3 rounded-md border border-border p-3", className)}
      onSubmit={(e) => { e.preventDefault(); if (all && named) onSubmit({ agreed, name: typed.trim() }); }}>
      <div className="space-y-2">
        {statements.map((s) => (
          <label key={s.id} className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={agreed.includes(s.id)}
              onCheckedChange={(v) => setAgreed((a) => v === true ? [...a, s.id] : a.filter((x) => x !== s.id))} />
            <span>{s.text}</span>
          </label>
        ))}
      </div>
      {consequence && <p className="text-xs text-muted-foreground">{consequence}</p>}
      <div className="space-y-1">
        <label htmlFor={uid + "-att-name"} className="block text-sm font-medium">Type your full name</label>
        <input id={uid + "-att-name"} value={typed} autoComplete="off" placeholder={signerName}
          onChange={(e) => setTyped(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
      </div>
      <Button type="submit" disabled={!all || !named || busy}>{submitLabel}</Button>
    </form>
  );
}
