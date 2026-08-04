import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  useMember,
  useRows,
  useCreateRow,
  useDeleteRow,
  type Row,
} from "@/lib/rows";
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

export const Route = createFileRoute("/members")({ component: Members });

type Note = Row & { title: string; body: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow down, breathe, come back to yourself.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Timetable", href: "#/timetable" },
    { label: "Book a class", href: "#/book" },
    { label: "Members", href: "#/members" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book a class", href: "#/book" },
};

const noteSchema = z.object({
  title: z.string().min(1, "Give your note a title"),
  body: z.string().max(2000).optional(),
});

type NoteForm = z.infer<typeof noteSchema>;

function Members() {
  const member = useMember();

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Your practice notes</h1>
        <p className="mt-2 text-muted-foreground">
          A private place to jot down how a class felt, what to work on next time.
        </p>

        {member.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}

        {!member.isPending && !member.data && (
          <div className="mt-8 rounded-xl border border-border p-6 text-center motion-enter">
            <p className="text-muted-foreground">
              Sign in to keep and read your own notes.
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
  const remove = useDeleteRow("my_notes");

  const form = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
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
    <>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">New note</CardTitle>
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
                      <Input placeholder="e.g. Sunrise Flow, Monday" {...field} />
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
        {notes.isPending && <Skeleton className="h-32 rounded-xl" />}
        {notes.isError && (
          <p className="text-sm text-destructive">Couldn't load your notes. Refresh and try again.</p>
        )}
        {notes.data?.length === 0 && (
          <Empty
            title="No notes yet"
            description="Save your first note above after your next class."
          />
        )}
        {!!notes.data?.length && (
          <ul className="grid gap-3 motion-stagger">
            {notes.data.map((n) => (
              <li key={n.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{n.title}</p>
                    {n.body && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {n.body}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(
                        { id: n.id },
                        {
                          onSuccess: () => toast.success("Note deleted"),
                          onError: (e: Error) => toast.error(e.message),
                        },
                      )
                    }
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
