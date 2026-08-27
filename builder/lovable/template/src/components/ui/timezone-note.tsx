import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Which clock the times are in.
 *
 * Reads the VISITOR's zone from the browser rather than being told, and only
 * says anything when it differs from the site's — a line about time zones on a
 * local barber's page is noise.
 */
export function TimezoneNote({ siteZone, className }: { siteZone: string; className?: string }) {
  const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!here || here === siteZone) return null;
  return (
    <p data-slot="timezone-note" className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <Globe className="size-3.5" /> Times shown in {siteZone.replace(/_/g, " ")}, not your local time.
    </p>
  );
}
