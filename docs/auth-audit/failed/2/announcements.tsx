import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export const Route = createFileRoute("/announcements")({ component: Announcements });

type Announcement = Row & {
  title: string;
  body: string | null;
};

const announcementSchema = z.object({
  title: z.string().min(1, "Give it a title"),
  body: z.string().max(2000).optional(),
});

type AnnouncementInput = z.infer<typeof announcementSchema>;

function Announcements() {
  const member = useMember();

  if (member.isPending) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="mt-6 h-40 rounded-xl" />
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Announcements</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Sign in to see studio announcements.
        </p>
        <Button asChild className="mt-6">
          <Link to="/account">Sign in</Link>
        </Button>
      </main>
    );
  }

  return <AnnouncementsPanel isAdmin={member.data.role === "admin"} />;
}

function AnnouncementsPanel({ isAdmin }: { isAdmin: boolean }) {
  const announcements = useRows<Announcement>("announcements", { order: "id", dir: "desc" });
  const create = useCreateRow("announcements");

  const form = useForm<AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: "", body: "" },
  });

  const onSubmit = (values: AnnouncementInput) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Announcement posted.");
        form.reset();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Announcements</h1>
      <p className="mt-2 text-muted-foreground">News from the studio, for members.</p>

      <section className="mt-10">
        <div className="grid gap-3">
          {announcements.isPending &&
            [0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}

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
      </section>

      {isAdmin && (
        <section className="mt-10">
          <h2 className="text-lg font-medium">Post an announcement</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 grid gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Body</FormLabel>
                    <FormControl>
                      <Textarea rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Posting…" : "Post announcement"}
                </Button>
              </div>
            </form>
          </Form>
        </section>
      )}
    </main>
  );
}
