import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a good floor, six classes a week.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Timetable", href: "#/#timetable" },
    { label: "The studio", href: "#/work" },
  ],
  action: { label: "Book now", href: "#/book" },
};

function Manage() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Manage your booking</h1>
        <p className="mt-4 text-muted-foreground">
          We don't yet have a way to look up a booking from this page. If you need to change or
          cancel a class, drop us an email or call the studio and we'll sort it for you.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/book">Book another class</Link>
        </Button>
      </div>
    </SiteChrome>
  );
}
