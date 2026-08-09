import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow mornings, strong afternoons — a studio for every kind of practice.",
  links: [
    { label: "Home", href: "/" },
    { label: "The work", href: "/work" },
    { label: "Book", href: "/book" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Manage() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Manage a booking</h1>
        <p className="mt-4 text-muted-foreground">
          We can't look up existing bookings from this page yet. If you need to move or
          cancel a class, reply to your confirmation email and we'll sort it for you directly.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/book">Book another class</Link>
        </Button>
      </div>
    </SiteChrome>
  );
}
