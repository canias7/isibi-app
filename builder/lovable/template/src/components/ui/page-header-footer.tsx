import { cn } from "@/lib/utils";
/**
 * The running header and footer on a printed page.
 *
 * PRINT ONLY. It is `hidden` on screen and revealed by the caller's print
 * stylesheet, because a document header duplicated on screen is furniture — the
 * page already has a title.
 *
 * THE PAGE NUMBER USES CSS COUNTERS, not JavaScript. Nothing in the DOM knows
 * how many printed pages there will be; `counter(page)` and `counter(pages)` are
 * the only things that do, and every attempt to compute this in script is wrong
 * at some paper size.
 *
 * A PRINTED PAGE NEEDS ITS OWN PROVENANCE. Paper leaves the system entirely, so
 * the date and the source are the only way a reader six months later knows
 * whether they are holding the current version.
 */
export function PageHeaderFooter({ title, subtitle, printedOn, source, className }: {
  title: string;
  subtitle?: string;
  /** Formatted date — printed documents outlive the screen. */
  printedOn?: string;
  /** Where it came from — a URL or a system name. */
  source?: string;
  className?: string;
}) {
  return (
    <div className={cn("hidden print:block", className)}>
      <header className="mb-4 border-b border-border pb-2">
        <p className="text-sm font-medium">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </header>
      <footer className="mt-4 flex justify-between border-t border-border pt-2 text-xs text-muted-foreground">
        <span>{[source, printedOn && `printed ${printedOn}`].filter(Boolean).join(" · ")}</span>
        <span className="[counter-increment:page]">
          Page <span className="[content:counter(page)]" /> of <span className="[content:counter(pages)]" />
        </span>
      </footer>
    </div>
  );
}
