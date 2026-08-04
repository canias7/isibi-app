import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow mornings, steady evenings — a mat and a class most days.",
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
      <div className="mx-auto max-w-lg px-6 py-20">
        <Empty
          title="Booking lookup isn't available yet"
          description="To change or cancel a class, reply to your confirmation email and we'll sort it out — or book a new class below."
        />
        <div className="mt-6 text-center">
          <Link to="/book" className="text-sm font-medium underline underline-offset-4">
            Book a class
          </Link>
        </div>
      </div>
    </SiteChrome>
  );
}
