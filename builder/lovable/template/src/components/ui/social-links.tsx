import { Facebook, Globe, Instagram, Link2, Linkedin, Mail, Music2, Phone, Twitter, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram, facebook: Facebook, twitter: Twitter, x: Twitter,
  youtube: Youtube, linkedin: Linkedin, tiktok: Music2, website: Globe,
  // The two a small business puts in this row that are not social networks at
  // all. Without them `email` fell through to the fallback, which WAS the
  // globe — so "Email" and "Website" rendered as the same glyph, side by side,
  // pointing at different places. Found by looking at a render.
  email: Mail, mail: Mail, phone: Phone, tel: Phone,
};

/**
 * Icon links out. An unknown network gets a generic link icon rather than
 * disappearing.
 *
 * THE FALLBACK IS NOT A GLYPH ANY REAL ENTRY USES. It used to be the globe,
 * which `website` also uses — so an unrecognised network was indistinguishable
 * from a declared website link, and the failure was invisible: the row still
 * rendered, still had the right count, and still linked correctly. Only the
 * reader could not tell which was which.
 */
export function SocialLinks({ links, className }: {
  links: { network: string; href: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {links.map((l) => {
        const Icon = ICONS[l.network.toLowerCase()] || Link2;
        return (
          <a key={l.href} href={l.href} target="_blank" rel="noreferrer" aria-label={l.network}
            className="text-muted-foreground hover:text-foreground">
            <Icon className="size-5" />
          </a>
        );
      })}
    </div>
  );
}
