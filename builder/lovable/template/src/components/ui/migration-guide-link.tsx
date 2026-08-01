import { cn } from "@/lib/utils";
/**
 * A link to migration instructions, with the effort stated up front.
 *
 * THE EFFORT ESTIMATE IS WHY THIS IS NOT JUST A LINK. "Migration guide" gives
 * no basis for deciding whether to start now or block out an afternoon, so it
 * gets postponed — and the estimate is something only the people who wrote the
 * change can give.
 *
 * WHETHER IT CAN BE DONE INCREMENTALLY IS THE OTHER DECIDING FACT. A migration
 * that can run alongside the old version is one somebody starts today; a
 * cut-over is scheduled, and confusing the two wastes a maintenance window.
 *
 * IT SAYS WHETHER ANYTHING IS AUTOMATED. A codemod or a script changes the
 * estimate by an order of magnitude, and it is routinely buried on page three
 * of the guide it belongs at the top of.
 *
 * `rel="noreferrer"` on the external link, consistent with `external-link` and
 * every other outbound link in this kit.
 */
export function MigrationGuideLink({ url, effort, incremental, automated, label = "How to move over", className }: {
  url: string;
  /** Free text — "about an hour". */
  effort?: string;
  /** True when old and new can run side by side. */
  incremental?: boolean;
  /** What is automated — "a codemod does most of it". */
  automated?: string;
  label?: string;
  className?: string;
}) {
  return (
    <p className={cn("space-y-0.5 text-xs text-muted-foreground", className)}>
      <a href={url} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2">
        {label}
      </a>
      <span className="block">
        {effort && <span>Usually {effort}. </span>}
        {incremental === true && <span>You can move over piece by piece — the old and new work side by side. </span>}
        {incremental === false && <span>This is a cut-over — plan a window for it. </span>}
        {automated && <span className="text-foreground">{automated}</span>}
      </span>
    </p>
  );
}
