import { createFileRoute, Link } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & {
  name: string;
  bio: string | null;
  phone: string | null;
};

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Aurora Yoga</h1>
      <p className="mt-2 text-muted-foreground">
        A calm space to breathe, stretch, and reset. Meet our teachers, then book
        your spot on the mat.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/book">Book a class</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/members">Members area</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/announcements">Announcements</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/account">Account</Link>
        </Button>
      </div>

      <section className="mt-14">
        <h2 className="text-xl font-medium">Our teachers</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {teachers.isPending &&
            [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}

          {teachers.isError && (
            <p className="text-sm text-destructive sm:col-span-2">
              Couldn't load our teachers right now. Refresh and try again.
            </p>
          )}

          {teachers.data?.length === 0 && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              No teachers listed yet — check back soon.
            </p>
          )}

          {teachers.data?.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                {t.phone && <CardDescription>{t.phone}</CardDescription>}
              </CardHeader>
              {t.bio && (
                <CardContent className="text-sm text-muted-foreground">{t.bio}</CardContent>
              )}
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
