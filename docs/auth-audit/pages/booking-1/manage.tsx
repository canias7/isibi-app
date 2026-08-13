import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    { label: "Home", href: "/" },
    { label: "Timetable", href: "/#timetable" },
    { label: "Studio", href: "/work" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Manage() {
  const { t: claim } = Route.useSearch();

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Manage your booking</h1>

        {!claim && (
          <p className="mt-4 text-muted-foreground">
            This page needs the link from your confirmation email.{" "}
            <Link to="/book" className="underline">
              Book a class
            </Link>{" "}
            instead.
          </p>
        )}

        {claim && (
          <Card className="mt-6 motion-enter">
            <CardHeader>
              <CardTitle>Looking up your booking</CardTitle>
              <CardDescription>
                We can't yet look this up automatically — please email the studio quoting your confirmation and we'll move or cancel it for you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Prefer to book something else instead? You're welcome to make a new booking any time.
              </p>
              <Link
                to="/book"
                className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                onClick={() => toast.message("Opening the booking form")}
              >
                Book a class
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </SiteChrome>
  );
}
