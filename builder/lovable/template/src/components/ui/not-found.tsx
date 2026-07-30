import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The page for a URL that does not exist.
 *
 * It offers somewhere to GO — home, and a search — rather than only saying
 * what happened. A 404 whose only content is "404" is a dead end on a site
 * somebody reached by following a link that used to work.
 *
 * No jokes. A missing page is a small annoyance and a witty 404 makes it a
 * larger one for the person who needed that page.
 */
export function NotFound({ title = "We can't find that page", body, homeHref = "/", onSearch, className }: {
  title?: string; body?: string; homeHref?: string; onSearch?: () => void; className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center", className)}>
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        {body ?? "The link may be out of date, or the page may have moved."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild><a href={homeHref}>Go to the home page</a></Button>
        {onSearch && <Button variant="outline" onClick={onSearch}>Search the site</Button>}
      </div>
    </div>
  );
}
