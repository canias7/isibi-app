import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a steady practice.",
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
        <h1 className="text-3xl font-semibold tracking-tight">Your booking</h1>
        <p className="mt-4 text-muted-foreground">
          We email a confirmation the moment you book — that's the record to keep. If you need to
          change or cancel a class, just reply to that email or give the studio a call and we'll
          sort it for you.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/book">Book another class</Link>
        </Button>
      </div>
    </SiteChrome>
  );
}
