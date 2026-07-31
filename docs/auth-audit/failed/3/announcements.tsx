import { createFileRoute, Link } from "@tanstack/react-router";
import { useMember, useRows, type Row } from "@/lib/rows";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/announcements")({ component: Announcements });

type Announcement = Row & {
  title: string;
  body: string | null;
};

function Announcements() {
  const member = useMember();

  if (member.isPending) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-32 rounded-xl" />
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Announcements</h1>
        <p className="mt-4 text-muted-foreground">
          Sign in to see studio announcements — schedule changes, workshops, and
          special events.
        </p>
        <Button asChild className="mt-6">
          <Link to="/account">Go to sign in</Link>
        </Button>
      </main>
    );
  }

  return <AnnouncementsList />;
}

function AnnouncementsList() {
  const announcements = useRows<Announcement>("announcements", { order: "id", dir: "desc" });

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Announcements</h1>
      <p className="mt-2 text-muted-foreground">News from the studio.</p>

      <div className="mt-8 grid gap-4">
        {announcements.isPending &&
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}

        {announcements.isError && (
          <p className="text-sm text-destructive">Couldn't load announcements right now.</p>
        )}

        {announcements.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        )}

        {announcements.data?.map((a) => (
          <Card key={a.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{a.title}</CardTitle>
            </CardHeader>
            {a.body && <CardContent className="text-sm text-muted-foreground">{a.body}</CardContent>}
          </Card>
        ))}
      </div>
    </main>
  );
}
