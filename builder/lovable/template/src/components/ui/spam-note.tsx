import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "N messages were hidden as likely spam" — the false-positive path.
 *
 * A SPAM FILTER WITHOUT THIS LINE SILENTLY EATS REAL MESSAGES. The filter
 * will sometimes be wrong, and when it is, the only way the owner ever finds
 * the real enquiry is a visible note that hidden things exist. The note IS
 * the feature; the filter is just a sort.
 *
 * COLLAPSED BY DEFAULT, WITH THE COUNT. The common case is that they are all
 * spam, and making the owner scroll past forty pharmacy adverts daily
 * teaches them to ignore the section. One line, expandable.
 *
 * "NOT SPAM" IS PER ITEM and is the caller's restore — this component owns
 * the framing and the reveal, the caller owns what restoring means (usually:
 * move it to the inbox and remember the sender).
 *
 * Hidden content renders AS TEXT, clamped. It is spam; it does not get to
 * be markup.
 */
export type SpamItem = { id: string | number; from?: string; excerpt: string; at?: string };

export function SpamNote({ items, onNotSpam, className }: {
  items: SpamItem[];
  onNotSpam?: (id: SpamItem["id"]) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  if (!items.length) return null;
  return (
    <div className={cn("motion-enter rounded-lg border border-dashed border-border", className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-start text-xs text-muted-foreground hover:bg-muted/50">
        <span>
          {items.length} message{items.length === 1 ? " was" : "s were"} hidden as likely spam.
          The filter is sometimes wrong — anything real can be restored.
        </span>
        <span className="shrink-0 underline underline-offset-2">{open ? "Hide" : "Show them"}</span>
      </button>
      {open ? (
        <ul className="divide-y divide-border border-t border-border">
          {items.map((it) => (
            <li key={it.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {it.from ?? "Unknown sender"}{it.at ? ` · ${it.at}` : ""}
                </p>
                <p className="line-clamp-2 text-sm">{it.excerpt}</p>
              </div>
              {onNotSpam ? (
                <button type="button" onClick={() => onNotSpam(it.id)}
                  className="shrink-0 cursor-pointer rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                  Not spam
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
