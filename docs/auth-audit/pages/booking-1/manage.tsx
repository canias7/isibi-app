import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio — every class ends on time.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
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
          To change or cancel a class, use the link in your confirmation email — it opens your booking
          directly. If you can't find it, drop us a line and we'll sort it out.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/book">Book a class</Link>
        </Button>
      </div>
    </SiteChrome>
  );
}
