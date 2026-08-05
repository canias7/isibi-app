import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactCard } from "@/components/ui/contact-card";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio for every level of practice.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "Manage booking", href: "#/manage" },
    { label: "Members", href: "#/account" },
  ],
  action: { label: "Book now", href: "#/book" },
};

function Manage() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Manage your booking</h1>
        <p className="mt-4 text-muted-foreground">
          To move or cancel a class, drop us a line with your name and the class time — we'll sort it by return. We're not yet able to look bookings up automatically from this page.
        </p>
        <div className="mt-8">
          <ContactCard
            address="18 Meadow Lane, Bristol BS6 5TF"
            phone="0117 946 0000"
            email="hello@aurorayoga.studio"
          />
        </div>
        <Link to="/" className="mt-8 inline-block text-sm font-medium underline underline-offset-4">
          Back to the studio
        </Link>
      </div>
    </SiteChrome>
  );
}
