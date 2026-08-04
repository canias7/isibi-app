import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/manage")({
  component: Manage,
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : undefined,
  }),
});

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio for a steady practice.",
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
        <Empty
          className="mt-8"
          title="Booking lookup isn't available yet"
          description="We can't retrieve a booking by link on this site yet. If you need to change or cancel a class, drop us a line and we'll sort it by hand."
        />
        <p className="mt-4 text-sm text-muted-foreground">
          Need to book a new class instead?{" "}
          <Link to="/book" className="underline">
            Book now
          </Link>
          .
        </p>
      </div>
    </SiteChrome>
  );
}
