import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
/** The hamburger and its drawer, on its own so any header can use it. */
export function MobileNav({ title = "Menu", links, action, className }: {
  title?: string; links: { label: string; href: string }[];
  action?: React.ReactNode; className?: string;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" className={className} aria-label={title}><Menu /></Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetTitle>{title}</SheetTitle>
        <nav className="mt-6 flex flex-col gap-1">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-md px-2 py-2 text-sm hover:bg-muted">{l.label}</a>
          ))}
        </nav>
        {action && <div className="mt-6">{action}</div>}
      </SheetContent>
    </Sheet>
  );
}
