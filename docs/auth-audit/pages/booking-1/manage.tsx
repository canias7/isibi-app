import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio — five classes a day, every level welcome.",
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
        <h1 className="text-3xl font-semibold tracking-tight">Manage a booking</h1>
        <p className="mt-4 text-muted-foreground">
          We don't yet have a way to look up an existing booking online. If you need to move
          or cancel a class, reply to your confirmation email and we'll sort it for you.
        </p>
        <Link to="/book" className="mt-6 inline-block text-sm font-medium underline underline-offset-4">
          Book a new class →
        </Link>
      </div>
    </SiteChrome>
  );
}
