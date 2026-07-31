import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/** A strip across the top. Dismissible, because an undismissable one is an ad. */
export function AnnouncementBar({
  children, href, dismissible = true, className,
}: {
  children: React.ReactNode;
  href?: string;
  dismissible?: boolean;
  className?: string;
}) {
  const [gone, setGone] = React.useState(false);
  if (gone) return null;
  const body = <span className="text-sm">{children}</span>;
  return (
    <div className={cn("motion-enter flex items-center justify-center gap-3 border-b bg-muted px-4 py-2 text-center", className)}>
      {href ? <a href={href} className="underline underline-offset-4">{body}</a> : body}
      {dismissible && (
        <button type="button" aria-label="Dismiss" onClick={() => setGone(true)}
          className="cursor-pointer text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
