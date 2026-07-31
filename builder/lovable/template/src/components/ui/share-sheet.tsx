import * as React from "react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The share button, using the platform's own sheet when there is one.
 *
 * `navigator.share` IS TRIED FIRST AND FALLS BACK. On a phone the native sheet
 * is what people expect and it reaches every app they have; on a desktop the
 * API mostly does not exist, so the fallback is the real path there. Building
 * only one of the two leaves half the visitors with a worse option.
 *
 * IT MUST BE CALLED FROM A USER GESTURE — the browser refuses otherwise, and
 * the refusal is an `AbortError` indistinguishable from the person cancelling.
 * So it is invoked directly in the click handler with nothing awaited before it.
 *
 * A CANCELLED SHARE IS NOT AN ERROR. Treating `AbortError` as a failure shows
 * an error message to somebody who simply changed their mind, which is the
 * commonest thing that happens to a share sheet.
 *
 * The fallback list is plain LINKS with `noreferrer`, not SDK buttons: a
 * Facebook or X SDK loads a third-party script that tracks the visitor on a
 * page they have not shared anything from yet.
 */
export function canNativeShare() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function ShareSheet({ url, title, text, children, label = "Share", className }: {
  url: string;
  title?: string;
  text?: string;
  children?: React.ReactNode;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const share = () => {
    if (!canNativeShare()) { setOpen((v) => !v); return; }
    setError(null);
    // Directly in the handler: awaiting anything first loses the gesture.
    navigator.share({ url, title, text }).catch((e: unknown) => {
      // Changing your mind is not a failure.
      if ((e as { name?: string })?.name === "AbortError") return;
      setOpen(true);
    });
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <button type="button" onClick={share}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
        <Share2 aria-hidden className="size-3.5" />
        {label}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-1 w-64 rounded-lg border border-border bg-background p-2 shadow-lg">
          {children}
          {error ? <p className="mt-1 text-xs font-medium">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Share destinations as plain links — no third-party SDK on the page. */
export function ShareTargets({ url, title, className }: { url: string; title?: string; className?: string }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title ?? "");
  const targets = [
    { key: "email", label: "Email", href: `mailto:?subject=${t}&body=${u}` },
    { key: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}` },
    { key: "x", label: "X", href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { key: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { key: "linkedin", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  ];
  return (
    <ul className={cn("flex flex-col", className)}>
      {targets.map((s) => (
        <li key={s.key}>
          <a href={s.href} target="_blank" rel="noreferrer"
            className="block rounded px-2 py-1.5 text-sm hover:bg-muted">
            {s.label}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
