import { ExternalLink } from "@/components/ui/external-link";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Where a place is.
 *
 * Deliberately NOT an iframe by default: a map embed loads a third party's
 * script on a page a customer is giving their details to, and every visitor
 * to a barber shop's contact page ends up in someone else's analytics. The
 * address plus a link to open it in whatever maps app they already use does
 * the actual job.
 *
 * `embedSrc` is there for a site that has decided otherwise — a lazy-loaded
 * iframe, titled, so it is at least announced properly when it is used.
 */
export function MapEmbed({ address, embedSrc, label = "Open in Maps", className }: {
  address: string; embedSrc?: string | null; label?: string; className?: string;
}) {
  const href = `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
  return (
    <div className={cn("space-y-2", className)}>
      {embedSrc ? (
        <iframe src={embedSrc} title={`Map of ${address}`} loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="aspect-video w-full rounded-lg border border-border" />
      ) : null}
      <p className="flex items-start gap-2 text-sm">
        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span>
          {address}
          <ExternalLink href={href} className="ms-2">{label}</ExternalLink>
        </span>
      </p>
    </div>
  );
}
