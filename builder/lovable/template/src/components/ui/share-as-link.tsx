import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
/**
 * A link that carries the current view.
 *
 * IT SAYS WHAT THE LINK INCLUDES. A shared URL carrying filters, a date range
 * and a sort order is enormously useful and slightly alarming — the recipient
 * sees exactly what you saw, which occasionally includes more than intended.
 * Listing what travels with it is the honest version.
 *
 * IT SAYS WHETHER THE RECIPIENT NEEDS ACCESS. A link that works for you and 404s
 * for them is the commonest sharing failure, and it wastes a round trip every
 * time.
 *
 * The URL is not an editable input — a hand-edited share link is a broken link
 * that looks fine — and the copy button is the primary action because that is
 * the only thing anybody does here.
 */
export function ShareAsLink({ url, includes, needsAccess, className }: {
  url: string;
  /** What travels with it — ["the filter", "the date range"]. */
  includes?: string[];
  /** True when the recipient must already have access. */
  needsAccess?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs select-all">
          {url}
        </code>
        <CopyButton value={url} label="Copy link to this view" />
      </div>
      <p className="text-xs text-muted-foreground">
        {includes?.length ? `Includes ${includes.join(", ")}. ` : ""}
        {needsAccess ? "They'll need access to open it." : "Anyone with the link can open it."}
      </p>
    </div>
  );
}
