import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio — book your mat in a minute.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "The studio", href: "/work" },
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
          To change or cancel a class, reply to your confirmation email or give the studio a
          call — we'll sort it from our end.
        </p>
        <Link to="/book" className="mt-6 inline-block text-sm font-medium underline underline-offset-4">
          Book another class
        </Link>
      </div>
    </SiteChrome>
  );
}
