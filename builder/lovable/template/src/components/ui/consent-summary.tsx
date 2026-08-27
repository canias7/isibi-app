import { cn, isoAttr, toDate } from "@/lib/utils";
/**
 * What the reader has agreed to, in one place.
 *
 * IT SHOWS WHAT IS OFF AS WELL AS WHAT IS ON. A summary listing only active
 * consents cannot be checked — somebody looking for "did I ever agree to
 * marketing?" needs to see the answer, and its absence from a list is not an
 * answer. Off is stated in words beside on.
 *
 * THE DATE IS PART OF EACH CONSENT. "Agreed" with no date cannot be reconciled
 * with a policy that changed in between, which is the only reason anybody reads
 * this page.
 *
 * REQUIRED ITEMS ARE MARKED AND NOT DRESSED AS CHOICES. A toggle that cannot be
 * turned off is a lie about the reader's control; saying "needed to run the
 * site" is the honest version and takes the same space.
 *
 * A `<dl>` with a word per state, never a row of green ticks — this is the page
 * most likely to be printed or screenshotted as a record.
 */
export type ConsentItem = {
  id: string;
  label: string;
  purpose?: string;
  granted: boolean;
  required?: boolean;
  at?: string;
};

export function ConsentSummary({ items, className }: { items: ConsentItem[]; className?: string }) {
  if (!items.length) return null;
  return (
    <dl data-slot="consent-summary" className={cn("divide-y divide-border rounded-md border border-border text-sm", className)}>
      {items.map((c) => {
        const d = c.at ? toDate(c.at) : null;
        const ok = d && !Number.isNaN(d.getTime());
        return (
          <div key={c.id} className="flex items-start gap-3 px-3 py-2">
            <dt className="min-w-0 flex-1">
              {c.label}
              {c.purpose && <span className="block text-xs text-muted-foreground">{c.purpose}</span>}
            </dt>
            <dd className="shrink-0 text-end">
              <span className={cn("block", c.granted ? "font-medium" : "text-muted-foreground")}>
                {c.required ? "Always on" : c.granted ? "Agreed" : "Not agreed"}
              </span>
              {c.required && <span className="block text-xs text-muted-foreground">needed to run the site</span>}
              {ok && !c.required && (
                <time dateTime={isoAttr(d)} className="block text-xs text-muted-foreground">
                  {d!.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </time>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
