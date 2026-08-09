import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio, six mats to a class.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "The work", href: "#/work" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book now", href: "#/book" },
};

function Manage() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Manage your booking</h1>
        <p className="mt-4 text-muted-foreground">
          We can't look bookings up from this page yet — there's no confirmation link to open one
          by. If you need to move or cancel a class, drop us a note by email and we'll sort it by
          hand.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/book">Book a new mat instead</Link>
        </Button>
      </div>
    </SiteChrome>
  );
}
