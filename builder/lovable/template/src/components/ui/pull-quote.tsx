import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A line pulled out of the article and set large.
 *
 * ARIA-HIDDEN, BECAUSE IT IS A REPEAT. A pull quote re-states a sentence
 * the article already contains; a screen reader that reads it twice — once
 * big, once in place — is the accessibility bug this component exists to
 * prevent. It is decoration by definition, so it is hidden from AT
 * entirely.
 *
 * A `<figure>`, NOT `<blockquote>`: blockquote claims the words come from
 * somewhere else, and a pull quote quotes THIS document. (For an actual
 * quotation from elsewhere, use a real blockquote with a cite.)
 *
 * Set off by rules above and below rather than italics — long italic
 * passages are measurably harder to read, and the size change is already
 * doing the work.
 */
export function PullQuote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <figure aria-hidden
      className={cn("my-6 border-y-2 border-foreground py-4 text-center text-xl font-medium leading-snug tracking-tight text-balance", className)}>
      {children}
    </figure>
  );
}
