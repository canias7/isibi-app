import { cn } from "@/lib/utils";
/**
 * Get the app. Links to wherever it is downloaded.
 *
 * NAMES AS TEXT, NOT THE OFFICIAL BADGES, and this is the whole decision in the
 * component. "Download on the App Store" and "Get it on Google Play" are
 * trademarked artwork supplied under brand guidelines that dictate size, clear
 * space and wording — so shipping them means either bundling licensed assets
 * into every generated site or hotlinking a remote image from Apple and Google
 * onto pages we publish. It is the same answer `payment-methods` gives about
 * card logos, for the same reasons, and it is why this renders type instead.
 *
 * The practical version is also better here: a text link is legible at any
 * size, survives dark mode without a second asset, weighs nothing, and cannot
 * go stale when a store restyles its badge.
 *
 * Every link is external and carries `rel="noreferrer"` — with `target="_blank"`
 * the opened page can otherwise reach back through `window.opener` — plus the
 * `sr-only` note that a new tab is coming, since a link that silently replaces
 * the reader's context is disorienting when it is not announced.
 *
 * `note` is the platform requirement line ("iOS 16 or later"). It is inside the
 * link on purpose, so it is read as part of the choice rather than as loose
 * text that could belong to either.
 */
export type Store = { key: string; name: string; href: string; note?: string };

export function StoreBadges({ stores, label, className }: {
  stores: Store[];
  /** A line above — "Available for". Omitted renders just the links. */
  label?: string;
  className?: string;
}) {
  if (!stores.length) return null;
  return (
    <div data-slot="store-badges" className={cn("flex flex-col gap-2", className)}>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
      <ul className="flex flex-wrap gap-2">
        {stores.map((s) => (
          <li key={s.key}>
            <a href={s.href} target="_blank" rel="noreferrer"
              className="flex flex-col rounded-md border border-border px-4 py-2 hover:bg-muted">
              <span className="text-sm font-medium">{s.name}</span>
              {s.note && <span className="text-xs text-muted-foreground">{s.note}</span>}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
