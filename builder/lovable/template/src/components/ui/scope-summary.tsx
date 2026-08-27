import { cn } from "@/lib/utils";
/**
 * What an app or key is allowed to do, in plain language.
 *
 * PERMISSIONS TRANSLATED, not listed. `repo:write` and
 * `calendar.events.readonly` are scope names for developers; "Create and edit
 * files in your projects" is what somebody granting access needs to read. A
 * consent screen showing raw scopes is a consent screen nobody meaningfully
 * consents on.
 *
 * WRITE ACCESS IS SEPARATED FROM READ and comes first. The distinction is the
 * one people actually care about, and mixing them into one list buries the two
 * entries that matter among fifteen that do not.
 *
 * Nothing here is a colour or an icon — the grouping headings carry it, so a
 * screen reader gets the same separation as the eye.
 */
export function ScopeSummary({ canRead, canWrite, cannot, className }: {
  canRead?: string[];
  canWrite?: string[];
  /** Explicit reassurance — "Read your messages". */
  cannot?: string[];
  className?: string;
}) {
  const section = (title: string, items?: string[]) =>
    items?.length ? (
      <section key={title}>
        <h3 className="text-sm font-medium">{title}</h3>
        <ul className="flex list-disc flex-col gap-0.5 ps-5 text-sm text-muted-foreground">
          {items.map((i) => <li key={i}>{i}</li>)}
        </ul>
      </section>
    ) : null;
  if (!canRead?.length && !canWrite?.length && !cannot?.length) return null;
  return (
    <div data-slot="scope-summary" className={cn("flex flex-col gap-3", className)}>
      {section("Can change", canWrite)}
      {section("Can see", canRead)}
      {section("Cannot", cannot)}
    </div>
  );
}
