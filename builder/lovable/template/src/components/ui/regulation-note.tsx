import { cn } from "@/lib/utils";
/**
 * Why a rule exists, next to the thing it constrains.
 *
 * THE OBLIGATION IS STATED IN PLAIN WORDS AND THE CITATION IS THE FOOTNOTE. A
 * field labelled only with a regulation number is a field people fill in
 * wrongly, because they cannot tell what it is for — and the number matters
 * only to somebody who is already going to look it up.
 *
 * IT SAYS WHO THE RULE APPLIES TO. Plenty of requirements bind only businesses
 * of a certain size or in one place, and a note asserting a universal
 * obligation makes a sole trader do work they need not.
 *
 * IT LINKS TO THE SOURCE where there is one, with `rel="noreferrer"` — a
 * regulator's own page is authoritative and ours will lag, and the referrer
 * would carry which page of a customer's product they came from.
 *
 * IT MAKES NO LEGAL CLAIM ON ITS OWN. The text is the caller's; a component
 * that shipped its own interpretation of a regulation would be wrong somewhere
 * and give false comfort everywhere.
 */
export function RegulationNote({ obligation, appliesTo, citation, url, className }: {
  /** What must happen, in plain words. */
  obligation: string;
  /** Who it binds — "businesses turning over more than £90,000". */
  appliesTo?: string;
  /** The formal reference. */
  citation?: string;
  url?: string;
  className?: string;
}) {
  return (
    <p className={cn("space-y-0.5 text-xs text-muted-foreground", className)}>
      <span className="block text-foreground">{obligation}</span>
      {appliesTo && <span className="block">Applies to {appliesTo}.</span>}
      {(citation || url) && (
        <span className="block">
          {citation}
          {citation && url ? " · " : ""}
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              Read the rule
            </a>
          )}
        </span>
      )}
    </p>
  );
}
