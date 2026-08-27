import { Card, CardContent } from "@/components/ui/card";
import { Mail, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Address, phone, email — each a real link.
 *
 * `tel:` and `mailto:` matter more than they look: on a phone this is the
 * difference between a customer calling and a customer copying a number.
 */
export function ContactCard({
  address, phone, email, mapUrl, className,
}: {
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Defaults to a Google Maps search for the address. */
  mapUrl?: string;
  className?: string;
}) {
  const map = mapUrl || (address ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address) : null);
  return (
    <Card data-slot="contact-card" className={className}>
      <CardContent className="flex flex-col gap-3 pt-6 text-sm">
        {address && (
          <a className="flex items-start gap-3 hover:underline" href={map ?? undefined} target="_blank" rel="noreferrer">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{address}</span>
          </a>
        )}
        {phone && (
          <a className="flex items-center gap-3 hover:underline" href={"tel:" + phone.replace(/[^+\d]/g, "")}>
            <Phone className="size-4 shrink-0 text-muted-foreground" />
            <span className="tabular-nums">{phone}</span>
          </a>
        )}
        {email && (
          <a className="flex items-center gap-3 hover:underline" href={"mailto:" + email}>
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <span>{email}</span>
          </a>
        )}
      </CardContent>
    </Card>
  );
}
