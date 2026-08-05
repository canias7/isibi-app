import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a steady practice.",
  links: [
    { label: "Home", href: "/" },
    { label: "The work", href: "/work" },
    { label: "Book", href: "/book" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Manage() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Manage a booking</h1>
        <p className="mt-4 text-muted-foreground">
          Every booking is confirmed by email straight away. To move or cancel a class,
          reply to that confirmation email or give the studio a call — we'll sort it
          for you directly.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/book">Book a new class</Link>
        </Button>
      </div>
    </SiteChrome>
  );
}
