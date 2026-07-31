import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";

/**
 * Share this page.
 *
 * Uses the native share sheet where there is one — on a phone that is the whole
 * feature, and it beats a row of network buttons nobody clicks. Falls back to
 * copying the link.
 */
export function ShareButtons({ url, title, className }: {
  url?: string;
  title?: string;
  className?: string;
}) {
  const link = url || (typeof window !== "undefined" ? window.location.href : "");
  const share = () => {
    const nav = navigator as Navigator & { share?: (d: { title?: string; url: string }) => Promise<void> };
    if (nav.share) { nav.share({ title, url: link }).catch(() => {}); return; }
    navigator.clipboard?.writeText(link).catch(() => {});
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={share} className={className}>
      <Share2 className="size-4" /> Share
    </Button>
  );
}
