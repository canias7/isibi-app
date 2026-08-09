import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a good floor, teachers who remember your name.",
  links: [
    { label: "Home", href: "/" },
    { label: "Classes", href: "/#prices" },
    { label: "The work", href: "/work" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Manage() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Manage your booking</h1>
        <p className="mt-4 text-muted-foreground">
          We can't look up or change a booking from this page yet. If you need to move or cancel a class, drop us an email or call the studio and we'll sort it straight away.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/book">Book a different class</Link>
        </Button>
      </div>
    </SiteChrome>
  );
}
