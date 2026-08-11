import { createFileRoute, Link } from "@tanstack/react-router";
import { ContactCard } from "@/components/ui/contact-card";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a steady practice.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
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
          We can't look bookings up from this page yet. If you need to move or cancel a class,
          just get in touch and we'll sort it straight away.
        </p>
        <ContactCard
          className="mt-8"
          address="18 Willow Mews, Bristol BS6 5TF"
          phone="0117 946 0000"
          email="hello@aurorayoga.studio"
        />
        <Link to="/book" className="mt-8 inline-block text-sm font-medium underline underline-offset-4">
          Book a new class instead →
        </Link>
      </div>
    </SiteChrome>
  );
}
