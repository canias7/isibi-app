import * as React from "react";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Says the connection went, so a failed submit reads as the network rather than
 * as the site being broken. Appears only while actually offline.
 */
export function OfflineBanner({ message = "You're offline. Some things won't work until you reconnect.", className }: {
  message?: string; className?: string;
}) {
  const [off, setOff] = React.useState(false);
  React.useEffect(() => {
    const on = () => setOff(!navigator.onLine);
    on();
    window.addEventListener("online", on); window.addEventListener("offline", on);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", on); };
  }, []);
  if (!off) return null;
  return (
    <div role="status" className={cn("flex items-center justify-center gap-2 bg-foreground px-4 py-2 text-sm text-background", className)}>
      <WifiOff className="size-4" /> {message}
    </div>
  );
}
