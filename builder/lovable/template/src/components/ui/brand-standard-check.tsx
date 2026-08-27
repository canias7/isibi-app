import { cn } from "@/lib/utils";
/**
 * An audit of a site against the standards — with evidence and a right of reply.
 *
 * A FAILED ITEM CARRIES WHAT WAS ACTUALLY OBSERVED. "Signage — fail" produces
 * an argument; "the A-board was inside the doorway at 11:40" produces a fix.
 * The observation is what makes an audit useful rather than adversarial.
 *
 * THE SITE CAN RESPOND, AND THE RESPONSE IS PART OF THE RECORD. Auditors get
 * things wrong, conditions change between visits, and an audit with no right of
 * reply is a document sites learn to game rather than act on.
 *
 * SAFETY ITEMS ARE SEPARATED FROM BRAND ITEMS. A fire door propped open and a
 * faded poster are not the same finding, and a single score lets one hide the
 * other — which is the specific failure mode of every combined audit score.
 *
 * THE SCORE IS SHOWN LAST AND WITHOUT A LEAGUE TABLE. Ranking sites on an audit
 * produces sites that prepare for audits.
 */
export type StandardItem = {
  id: string;
  what: string;
  passed: boolean;
  /** What the auditor actually saw. */
  observed?: string;
  safety?: boolean;
  /** The site's answer. */
  response?: string;
  fixBy?: string;
};

export function BrandStandardCheck({ site, visitedOn, auditor, items, score, outOf, className }: {
  site?: string;
  visitedOn?: string;
  auditor?: string;
  items: StandardItem[];
  score?: number;
  outOf?: number;
  className?: string;
}) {
  const failed = items.filter((i) => !i.passed);
  const safetyFails = failed.filter((i) => i.safety);
  return (
    <div data-slot="brand-standard-check" className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        {site && <span className="font-medium">{site}</span>}
        {(visitedOn || auditor) && (
          <span className="block text-xs text-muted-foreground">
            {[visitedOn, auditor].filter(Boolean).join(" · ")}
          </span>
        )}
      </p>
      {safetyFails.length > 0 && (
        <p className="text-sm font-medium">
          {safetyFails.length} safety {safetyFails.length === 1 ? "item" : "items"} failed. Those are not brand findings and do not wait for the next visit.
        </p>
      )}
      {failed.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing failed.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {failed.map((i) => (
            <li key={i.id} className="space-y-0.5 px-3 py-2">
              <p className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1">{i.what}</span>
                {i.safety && <span className="shrink-0 text-xs font-medium">Safety</span>}
              </p>
              <p className={cn("text-xs", i.observed ? "" : "font-medium")}>
                {i.observed ?? "Nothing was written down about what was seen, which makes this hard to act on."}
              </p>
              {i.fixBy && <p className="text-xs text-muted-foreground">To fix by {i.fixBy}.</p>}
              {i.response && <p className="text-xs">The site says: {i.response}</p>}
            </li>
          ))}
        </ul>
      )}
      {score !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {score}{outOf !== undefined ? ` of ${outOf}` : ""}. Not a ranking — a site that prepares for audits is not a better site.
        </p>
      )}
    </div>
  );
}
