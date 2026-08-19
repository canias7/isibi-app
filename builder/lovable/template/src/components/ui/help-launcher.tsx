import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The corner bubble that opens help.
 *
 * `bottom-20` on small screens, not `bottom-4`: a fixed bubble in the bottom
 * corner of a phone sits exactly on top of the browser's own toolbar and on
 * whatever the page put there — a Buy button, most often.
 */
export function HelpLauncher({ label = "Help", children, className }: {
  label?: string; children?: React.ReactNode; className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon-lg" aria-label={label}
          className={cn("fixed bottom-20 end-4 z-40 rounded-full shadow-lg md:bottom-6", className)}>
          {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80 p-0">{children}</PopoverContent>
    </Popover>
  );
}
