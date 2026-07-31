import { Facebook, Globe, Instagram, Linkedin, Music2, Twitter, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram, facebook: Facebook, twitter: Twitter, x: Twitter,
  youtube: Youtube, linkedin: Linkedin, tiktok: Music2, website: Globe,
};

/** Icon links out. An unknown network gets the globe rather than disappearing. */
export function SocialLinks({ links, className }: {
  links: { network: string; href: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {links.map((l) => {
        const Icon = ICONS[l.network.toLowerCase()] || Globe;
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
