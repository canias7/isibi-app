import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a good mat, classes most days.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "The work", href: "/work" },
    { label: "Members", href: "/members" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Manage() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Manage your booking</h1>
        <p className="mt-4 text-muted-foreground">
          To change or cancel a class, reply to your confirmation email or call the
          studio — this schema doesn't give us a link back into a specific booking
          yet, so we can't look one up here.
        </p>
        <Button asChild className="mt-6">
          <Link to="/book">Book another class</Link>
        </Button>
      </div>
    </SiteChrome>
  );
}
