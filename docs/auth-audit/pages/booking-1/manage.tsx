import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit room. Come as you are.",
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
          We don't yet have a self-serve way to change or cancel a booking online. To move or cancel
          a class, drop us an email or give the studio a ring and we'll sort it straight away.
        </p>
        <div className="mt-6 flex gap-3">
          <Button asChild variant="outline">
            <Link to="/">Back to the studio</Link>
          </Button>
          <Button asChild>
            <Link to="/book">Book a new class</Link>
          </Button>
        </div>
      </div>
    </SiteChrome>
  );
}
