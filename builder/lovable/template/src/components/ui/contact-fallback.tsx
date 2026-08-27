import { cn } from "@/lib/utils";
/**
 * The way to reach someone when the normal way is the thing that is broken.
 *
 * THE POINT IS THAT IT DOES NOT DEPEND ON THE APP. When sign-in is down, a
 * "contact support" link behind sign-in is useless; when the whole site is down,
 * an in-app chat widget is too. This is the plain address or number that works
 * from outside.
 *
 * PLAIN TEXT ALONGSIDE THE LINK, because `mailto:` does nothing on a machine
 * with no mail client configured — which is most shared and locked-down
 * machines, and disproportionately the ones having trouble.
 *
 * Deliberately minimal markup and no dependency on anything clever, since this
 * is the component most likely to be rendered on a page where something else has
 * already failed.
 */
export function ContactFallback({ email, phone, note, className }: {
  email?: string; phone?: string; note?: string;
  className?: string;
}) {
  if (!email && !phone) return null;
  return (
    <div data-slot="contact-fallback" className={cn("flex flex-col gap-0.5 text-sm", className)}>
      {note && <p className="text-muted-foreground">{note}</p>}
      {email && (
        <p>
          <a href={`mailto:${email}`} className="underline underline-offset-4">{email}</a>
        </p>
      )}
      {phone && (
        <p>
          <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="underline underline-offset-4">{phone}</a>
        </p>
      )}
    </div>
  );
}
