import { useState } from "react";
import { cn } from "@/lib/utils";
/**
 * A badge that can say what it means and who decided.
 *
 * AN UNEXPLAINED BADGE IS WORSE THAN NONE. "Verified", "Top rated", "Pro" — the
 * reader cannot tell whether it was earned, paid for, or self-declared, so a
 * badge meant to build trust does the opposite for anybody who thinks about it.
 * The criteria and the issuer are the whole content.
 *
 * "WHO SAYS SO" IS SEPARATE FROM THE CRITERIA, because "we checked their
 * insurance" and "they told us they have insurance" can both be summarised as
 * "Insured" and are entirely different claims.
 *
 * IT IS A `<button aria-expanded>`, not a hover tooltip. Somebody who does not
 * trust a badge needs to be able to open the explanation with a keyboard and
 * keep it open while reading — and on a phone there is no hover at all, which
 * is where most of these are read.
 *
 * THE BADGE ITSELF IS TEXT, never an icon alone. A blue tick means five
 * different things across five platforms.
 */
export function BadgeExplainer({ label, meaning, issuer, since, className }: {
  label: string;
  /** What it takes to have this badge. */
  meaning: string;
  /** Who decided — "checked by us", "self-declared". */
  issuer?: string;
  /** Free text — "March 2026". */
  since?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className={cn("inline-block", className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs">
        {label}
        <span aria-hidden="true" className="text-muted-foreground">?</span>
      </button>
      {open && (
        <span className="mt-1.5 block max-w-xs rounded-md border border-border bg-muted/30 p-2 text-xs">
          <span className="block">{meaning}</span>
          {issuer && <span className="mt-0.5 block text-muted-foreground">{issuer}</span>}
          {since && <span className="block text-muted-foreground">Since {since}</span>}
        </span>
      )}
    </span>
  );
}
