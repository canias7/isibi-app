import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

import { useMember, useRows, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/announcements")({ component: Announcements });

type Announcement = Row & { title: string | null; body: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet room, a good floor, classes that start on time.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "The work", href: "#/work" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book now", href: "#/book" },
};

function Announcements() {
  const member = useMember();

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Studio announcements</h1>
        <p className="mt-2 text-muted-foreground">
          Schedule changes, teacher cover, and anything else worth knowing before your next class.
        </p>

        {member.isPending && <p className="mt-8 text-muted-foreground">Checking your sign-in…</p>}

        {!member.isPending && !member.data && (
          <div className="mt-8 rounded-xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">Sign in to see studio announcements.</p>
            <Button asChild className="mt-4">
              <Link to="/account">Sign in</Link>
            </Button>
          </div>
        )}

        {member.data && <List />}
      </div>
    </SiteChrome>
  );
}

function List() {
  const announcements = useRows<Announcement>("announcements", { order: "id", dir: "desc" });

  return (
    <div className="mt-8">
      {announcements.isPending && (
        <div className="grid gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      )}
      {announcements.isError && (
        <p className="text-sm text-destructive">Couldn't load announcements. Refresh and try again.</p>
      )}
      {announcements.data?.length === 0 && (
        <Empty title="Nothing posted yet" description="Check back for schedule changes and studio news." />
      )}
      {!!announcements.data?.length && (
        <ul className="grid gap-3 motion-stagger">
          {announcements.data.map((a) => (
            <li key={a.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{a.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
