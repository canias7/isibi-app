import { Button } from "@/components/ui/button";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * What visitors see, against what you have been working on.
 *
 * The question this answers is the one everybody with a CMS asks: is my change
 * live yet? A single "Save" button cannot answer it, which is why people
 * publish twice and then check the site in a private window.
 *
 * "LIVE" COMES FIRST, and that is deliberate. The draft is where the reader's
 * attention already is; the thing they have lost track of is what the public is
 * currently being shown, so it leads.
 *
 * When there is no draft it says so and offers nothing — a publish button on an
 * unchanged page either does nothing or republishes identical content, and both
 * teach people the button is meaningless.
 *
 * Discard is an outline button rather than a link, because "throw away my
 * unpublished work" deserves the same weight as publishing it, and a text link
 * beside a solid button reads as the lesser option in a way that has nothing to
 * do with what it does.
 */
export function DraftVsLive({
  live, draft, liveAt, draftAt, onPublish, onDiscard, onPreview, busy, className,
}: {
  /** A short description of the published version. */
  live: React.ReactNode;
  /** The unpublished version. Omit when there is no draft. */
  draft?: React.ReactNode;
  liveAt?: string | number | Date;
  draftAt?: string | number | Date;
  onPublish?: () => void;
  onDiscard?: () => void;
  onPreview?: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="draft-vs-live" className={cn("flex flex-col gap-3", className)}>
      <dl className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
        <div className="bg-background p-3">
          <dt className="text-xs font-medium text-muted-foreground">
            Live{liveAt ? <> · <DateFormat date={liveAt} /></> : null}
          </dt>
          <dd className="mt-1 text-sm">{live}</dd>
        </div>
        <div className="bg-background p-3">
          <dt className="text-xs font-medium text-muted-foreground">
            Draft{draftAt ? <> · <DateFormat date={draftAt} /></> : null}
          </dt>
          <dd className="mt-1 text-sm">
            {draft ?? <span className="text-muted-foreground">No unpublished changes</span>}
          </dd>
        </div>
      </dl>
      {draft && (
        <div className="flex flex-wrap gap-2">
          {onPublish && <Button size="sm" disabled={busy} onClick={onPublish}>{busy ? "Publishing…" : "Publish"}</Button>}
          {onPreview && <Button size="sm" variant="outline" onClick={onPreview}>Preview</Button>}
          {onDiscard && <Button size="sm" variant="outline" onClick={onDiscard}>Discard draft</Button>}
        </div>
      )}
    </div>
  );
}
