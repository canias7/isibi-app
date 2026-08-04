import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/members")({ component: Members });

type Note = Row & { title: string; body: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow down, breathe, move well.",
  links: [
    { label: "Timetable", href: "#/timetable" },
    { label: "Book", href: "#/book" },
    { label: "Members", href: "#/members" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book a class", href: "#/book" },
};

const note = z.object({
  title: z.string().min(1, "Give it a title"),
  body: z.string().max(2000).optional(),
});

type NoteForm = z.infer<typeof note>;

function Members() {
  const member = useMember();

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Your practice notes</h1>

        {member.isPending && <p className="mt-4 text-muted-foreground">Checking your sign-in…</p>}

        {!member.isPending && !member.data && (
          <div className="mt-6 motion-enter">
            <p className="text-muted-foreground">
              Sign in to keep private notes about your practice — poses to work on, how a
              class felt, reminders for next time.
            </p>
            <Button asChild className="mt-4">
              <Link to="/account">Sign in</Link>
            </Button>
          </div>
        )}

        {member.data && <NotesPanel />}
      </div>
    </SiteChrome>
  );
}

function NotesPanel() {
  const notes = useRows<Note>("my_notes", { order: "id", dir: "desc" });
  const create = useCreateRow<Note>("my_notes");

  const form = useForm<NoteForm>({
    resolver: zodResolver(note),
    defaultValues: { title: "", body: "" },
  });

  const onSubmit = (values: NoteForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Note saved");
        form.reset();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div className="mt-8 grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a note</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
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
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <Button type="submit" className="motion-press" disabled={create.isPending}>
                  {create.isPending ? "Saving…" : "Save note"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-medium">Your notes</h2>
        {notes.isPending && (
          <div className="mt-4 grid gap-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        )}
        {notes.isError && (
          <p className="mt-4 text-sm text-destructive">
            Couldn't load your notes. Refresh and try again.
          </p>
        )}
        {notes.data?.length === 0 && (
          <Empty
            className="mt-4"
            title="No notes yet"
            description="Add your first note above — it's just for you."
          />
        )}
        {!!notes.data?.length && (
          <ul className="mt-4 grid gap-3 motion-stagger">
            {notes.data.map((n) => (
              <li key={n.id} className="rounded-xl border border-border p-4">
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
