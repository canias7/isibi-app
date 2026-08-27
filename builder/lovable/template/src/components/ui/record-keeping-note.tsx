import { cn } from "@/lib/utils";
/**
 * How long records must be kept, and who has to keep them.
 *
 * IT SAYS WHO IS RESPONSIBLE, which `retention-note` does not. That one tells a
 * customer what WE do with their data; this tells a business what THEY must
 * keep — a legal duty that survives them leaving the product, and the
 * distinction matters when somebody is about to delete an account.
 *
 * "YOU WILL NEED THESE AFTER YOU LEAVE" IS THE SENTENCE THAT PREVENTS THE
 * PROBLEM. A business closing an account is told what to export first, at the
 * moment they can still do it.
 *
 * THE CLOCK'S START IS STATED. "Six years" from the transaction, from the end
 * of the tax year, or from the end of a contract are different dates —
 * frequently a year or more apart — and the ambiguity is where records get
 * destroyed early.
 *
 * FORMAT REQUIREMENTS TOO, where they exist. Some records must be kept in a
 * form that can be produced on request, which rules out an export nobody can
 * open.
 */
export function RecordKeepingNote({ what, howLong, from, responsible = "you", format, exportHint, className }: {
  /** Which records — "invoices and receipts". */
  what: string;
  /** Free text — "6 years". */
  howLong: string;
  /** When the clock starts — "the end of the tax year they relate to". */
  from?: string;
  /** Who must keep them. */
  responsible?: string;
  /** Any form requirement. */
  format?: string;
  /** What to do before leaving. */
  exportHint?: string;
  className?: string;
}) {
  return (
    <div data-slot="record-keeping-note" className={cn("space-y-0.5 text-xs text-muted-foreground", className)}>
      <p>
        <span className="text-foreground">{what}</span> must be kept for{" "}
        <span className="text-foreground">{howLong}</span>
        {from && <span> from {from}</span>}.
        {responsible && <span> This is {responsible === "you" ? "your" : `${responsible}'s`} responsibility, not ours.</span>}
      </p>
      {format && <p>{format}</p>}
      {exportHint && <p className="text-foreground">{exportHint}</p>}
    </div>
  );
}
