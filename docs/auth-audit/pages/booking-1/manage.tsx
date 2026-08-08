import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, six classes a day.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "Members", href: "#/account" },
  ],
  action: { label: "Book now", href: "#/book" },
};

function Manage() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-lg px-6 py-20">
        <h1 className="text-3xl font-semibold tracking-tight">Change or cancel a booking</h1>
        <p className="mt-4 text-muted-foreground">
          We can't yet look up a booking from a link on this site. If you need to move or cancel a class,
          just reply to your confirmation email or give the studio a call and we'll sort it for you straight away.
        </p>
        <Button asChild className="mt-6">
          <Link to="/book">Book a new class instead</Link>
        </Button>
      </div>
    </SiteChrome>
  );
}
