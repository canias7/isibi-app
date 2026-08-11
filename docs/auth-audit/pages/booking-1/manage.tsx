import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manage")({ component: Manage });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio for every kind of practice.",
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
        <h1 className="text-3xl font-semibold tracking-tight">Manage a booking</h1>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">We can't look this up here yet</CardTitle>
            <CardDescription>
              Bookings at Aurora Yoga don't come with a self-service management link at the moment. To move or
              cancel a class, reply to your confirmation email or call the studio directly and we'll sort it out.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/book">Book another class</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </SiteChrome>
  );
}
