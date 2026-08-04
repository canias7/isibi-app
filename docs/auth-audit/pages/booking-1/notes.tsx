import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/notes")({ component: Notes });

type Note = Row & { title: string | null; body: string | null };

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

const note = z.object({
  title: z.string().min(1, "Give it a title"),
  body: z.string().min(1, "Add a note"),
});

type NoteForm = z.infer<typeof note>;

function Notes() {
  const member = useMember();

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">My notes</h1>
        <p className="mt-2 text-muted-foreground">
          Track how your practice is going — sore hips, a pose that finally clicked, anything
          you want to remember for next time.
        </p>

        {member.isPending && <p className="mt-8 text-muted-foreground">Checking your sign-in…</p>}

        {!member.isPending && !member.data && (
          <div className="mt-8 rounded-xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Sign in to keep your own notes between visits.
            </p>
            <Button asChild className="mt-4">
              <Link to="/account">Sign in</Link>
            </Button>
          </div>
        )}

        {member.data && <SignedInNotes />}
      </div>
    </SiteChrome>
  );
}

function SignedInNotes() {
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
    <div className="mt-8">
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

      <div className="mt-8">
        <h2 className="text-lg font-medium">Your notes</h2>
        {notes.isPending && (
          <div className="mt-4 grid gap-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        )}
        {notes.isError && (
          <p className="mt-4 text-sm text-destructive">Couldn't load your notes. Refresh and try again.</p>
        )}
        {notes.data?.length === 0 && (
          <Empty
            className="mt-4"
            title="No notes yet"
            description="Add one above to start keeping track of your practice."
          />
        )}
        {!!notes.data?.length && (
          <ul className="mt-4 grid gap-3 motion-stagger">
            {notes.data.map((n) => (
              <li key={n.id} className="rounded-xl border bg-card p-4">
                <p className="font-medium">{n.title}</p>
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
