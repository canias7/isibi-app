import { cn } from "@/lib/utils";
/**
 * What changed, newest first, with the entries that matter marked.
 *
 * BREAKING CHANGES ARE PULLED OUT AND COUNTED AT THE TOP. A changelog is
 * skimmed, and the one entry that will break somebody's integration is the
 * third bullet of the second release. Anything a reader must act on is not left
 * to be found.
 *
 * ENTRIES SAY WHAT TO DO, not just what happened. "Changed the booking API" is
 * a fact; "the `date` field is now ISO — parse it with your date library" is
 * the fix, and it belongs in the entry rather than a migration guide nobody
 * opens.
 *
 * THE UNREAD MARK IS BY VERSION, not by date. Somebody who upgraded three
 * versions at once needs everything since THEIR version, and a "since you last
 * visited" mark shows them entries for releases they were never on.
 *
 * KINDS ARE WORDS. Added, changed, fixed, removed — as text rather than
 * coloured tags, since a changelog is the archetypal thing pasted into an email.
 */
export type ChangelogEntry = {
  id: string;
  version: string;
  /** Free text — "1 August 2026". */
  date?: string;
  items: { id: string; kind: "added" | "changed" | "fixed" | "removed"; text: string; breaking?: boolean }[];
};

const KIND = { added: "Added", changed: "Changed", fixed: "Fixed", removed: "Removed" } as const;

export function ChangelogFeed({ releases, sinceVersion, className }: {
  /** Newest first. */
  releases: ChangelogEntry[];
  /** The reader's current version — everything above it is new to them. */
  sinceVersion?: string;
  className?: string;
}) {
  const cut = sinceVersion ? releases.findIndex((r) => r.version === sinceVersion) : -1;
  const unseen = cut > 0 ? releases.slice(0, cut) : cut === 0 ? [] : releases;
  const breaking = unseen.flatMap((r) => r.items.filter((i) => i.breaking));
  return (
    <div data-slot="changelog-feed" className={cn("space-y-3", className)}>
      {sinceVersion && breaking.length > 0 && (
        <p className="rounded-md border border-foreground/40 bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium tabular-nums">{breaking.length}</span>{" "}
          {breaking.length === 1 ? "change needs" : "changes need"} action since v{sinceVersion}.
        </p>
      )}
      {releases.map((r, ri) => {
        const isNew = cut < 0 ? false : ri < cut;
        return (
          <section key={r.id} className="space-y-1">
            <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium">v{r.version}</span>
              {r.date && <span className="text-xs text-muted-foreground">{r.date}</span>}
              {isNew && <span className="text-xs font-medium">new to you</span>}
              {sinceVersion === r.version && <span className="text-xs text-muted-foreground">you are on this</span>}
            </h3>
            <ul className="space-y-0.5 text-sm">
              {r.items.map((i) => (
                <li key={i.id} className="flex gap-2">
                  <span aria-hidden="true" className="text-muted-foreground">·</span>
                  <span className="min-w-0">
                    <span className="text-muted-foreground">{KIND[i.kind]}: </span>
                    {i.text}
                    {i.breaking && <span className="ms-1.5 text-xs font-medium">needs action</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
