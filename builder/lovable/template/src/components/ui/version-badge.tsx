import { cn } from "@/lib/utils";
/**
 * Which build is running, in a form somebody can quote in a bug report.
 *
 * THE COMMIT IS AS IMPORTANT AS THE VERSION. "v2.4.1" is ambiguous across
 * rebuilds and hotfixes; a short commit hash identifies exactly what is
 * deployed, which is the first question in every incident and the one nobody
 * can answer from a version number alone.
 *
 * IT IS SELECTABLE AND MONOSPACED, because its whole purpose is being copied
 * into a ticket. A version rendered in a proportional font with `user-select:
 * none` on a header is one people retype and get wrong.
 *
 * A NON-PRODUCTION ENVIRONMENT IS SAID IN WORDS. Somebody reporting a bug from
 * staging and somebody reporting from live need different responses, and the
 * usual coloured ribbon means nothing in a screenshot pasted into a chat.
 *
 * THE BUILD DATE ANSWERS "AM I ON THE OLD ONE?" — the question a version number
 * cannot answer for anybody who does not follow the release notes.
 */
export function VersionBadge({ version, commit, environment, builtAt, className }: {
  version: string;
  /** Short hash. */
  commit?: string;
  /** Omit or pass "production" for the ordinary case. */
  environment?: string;
  /** Free text — "1 August". */
  builtAt?: string;
  className?: string;
}) {
  const nonProd = environment && environment !== "production";
  return (
    <span data-slot="version-badge" className={cn("inline-flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground", className)}>
      <code className="select-all font-mono text-foreground">
        {version}{commit ? `+${commit}` : ""}
      </code>
      {nonProd && <span className="font-medium text-foreground">{environment}</span>}
      {builtAt && <span>built {builtAt}</span>}
    </span>
  );
}
