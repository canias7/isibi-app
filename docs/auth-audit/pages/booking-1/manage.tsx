import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow mornings, strong practice — a studio on the high street.",
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
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Manage your booking</h1>
        <p className="mt-4 text-muted-foreground">
          To change or cancel a class, just reply to your booking confirmation email and we'll
          sort it for you directly — it's usually quicker than doing it yourself.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/book">Book another class</Link>
        </Button>
      </div>
    </SiteChrome>
  );
}
