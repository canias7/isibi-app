import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a steady practice, every day of the week.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
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
          We don't yet have a way to look up an existing booking by link on this
          site. If you need to move or cancel a class, reply to your
          confirmation email and we'll sort it out — or book a new class below.
        </p>
        <Button asChild className="mt-6">
          <Link to="/book">Book a class</Link>
        </Button>
      </div>
    </SiteChrome>
  );
}
