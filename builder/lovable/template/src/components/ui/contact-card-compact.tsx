import { cn } from "@/lib/utils";
/**
 * Somebody's details in one dense block, with everything tappable.
 *
 * THE PHONE NUMBER IS A `tel:` LINK AND THE ADDRESS IS TEXT. On a phone that
 * turns a lookup into one tap; retyping eleven digits from a screen into a
 * keypad is where wrong numbers come from. The email is a `mailto:` for the
 * same reason.
 *
 * THE NUMBER IS PRINTED AS GIVEN AND LINKED AS DIGITS. Display formatting
 * varies by country and a stripped `tel:` href works everywhere — reformatting
 * the visible text would mangle numbers this component cannot parse.
 *
 * IT DOES NOT TRUNCATE THE EMAIL. A shortened address is unusable for the one
 * thing somebody does with it when the link fails, which is read it out; it
 * wraps with `break-all` instead.
 *
 * ROLE OR COMPANY SITS WITH THE NAME, because in a list of contacts that is
 * what distinguishes two people called Sam, and it is the field most often
 * dropped for space.
 */
export function ContactCardCompact({ name, role, phone, email, address, note, className }: {
  name: string;
  /** Job title or company. */
  role?: string;
  phone?: string;
  email?: string;
  /** Lines. */
  address?: string[];
  note?: React.ReactNode;
  className?: string;
}) {
  const digits = phone?.replace(/[^\d+]/g, "");
  return (
    <div data-slot="contact-card-compact" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{name}</span>
        {role && <span className="block text-xs text-muted-foreground">{role}</span>}
      </p>
      {phone && (
        <p><a href={`tel:${digits}`} className="underline underline-offset-2">{phone}</a></p>
      )}
      {email && (
        <p><a href={`mailto:${email}`} className="break-all underline underline-offset-2">{email}</a></p>
      )}
      {address && address.length > 0 && (
        <address className="not-italic text-xs text-muted-foreground">
          {address.map((l) => <span key={l} className="block">{l}</span>)}
        </address>
      )}
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}
