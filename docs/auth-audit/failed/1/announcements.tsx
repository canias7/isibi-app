import { createFileRoute } from "@tanstack/react-router";
import { useMember, useRows, type Row } from "@/lib/rows";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SignInPrompt from "@/components/sign-in-prompt";

export const Route = createFileRoute("/announcements")({ component: Announcements });

type Announcement = Row & { title: string; body: string | null };

function Announcements() {
  const member = useMember();

  if (member.isPending) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-40 rounded-xl" />
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-3xl font-semibold">Studio announcements</h1>
        <p className="mt-2 text-muted-foreground">Sign in to see the latest news from the studio.</p>
        <div className="mt-8">
          <SignInPrompt />
        </div>
      </main>
    );
  }

  return <Feed />;
}

function Feed() {
  const posts = useRows<Announcement>("announcements", { order: "id", dir: "desc" });

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Studio announcements</h1>
      <p className="mt-2 text-muted-foreground">News, schedule changes and anything worth knowing.</p>

      <div className="mt-8 grid gap-4">
        {posts.isPending && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}

        {posts.isError && (
          <p className="text-sm text-destructive">Couldn't load announcements. Refresh and try again.</p>
        )}

        {posts.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing posted yet.</p>
        )}

        {posts.data?.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="text-base">{a.title}</CardTitle>
            </CardHeader>
            {a.body && <CardContent className="text-sm text-muted-foreground">{a.body}</CardContent>}
          </Card>
        ))}
      </div>
    </main>
  );
}
