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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import SignInPrompt from "@/components/sign-in-prompt";

export const Route = createFileRoute("/members")({ component: Members });

type Note = Row & { title: string; body: string | null };

const noteSchema = z.object({
  title: z.string().min(1, "Give it a title"),
  body: z.string().max(2000).optional(),
});

type NoteForm = z.infer<typeof noteSchema>;

function Members() {
  const member = useMember();

  if (member.isPending) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-40 rounded-xl" />
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-3xl font-semibold">Members area</h1>
        <p className="mt-2 text-muted-foreground">
          Sign in to keep your own practice notes — reminders about what to work on, poses that felt
          good, anything at all.
        </p>
        <div className="mt-8">
          <SignInPrompt />
        </div>
      </main>
    );
  }

  return <NotesArea />;
}

function NotesArea() {
  const notes = useRows<Note>("my_notes", { order: "id", dir: "desc" });
  const create = useCreateRow("my_notes");
  const remove = useDeleteRow("my_notes");

  const form = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: "", body: "" },
  });

  const onSubmit = (values: NoteForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Note saved.");
        form.reset();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const onDelete = (id: Note["id"]) => {
    remove.mutate(
      { id },
      {
        onSuccess: () => toast.success("Note deleted."),
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Your notes</h1>
      <p className="mt-2 text-muted-foreground">Only you can see these.</p>

      <section className="mt-10">
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
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Saving…" : "Add note"}
              </Button>
            </div>
          </form>
        </Form>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-medium">Saved notes</h2>
        <div className="mt-4 grid gap-3">
          {notes.isPending &&
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}

          {notes.isError && (
            <p className="text-sm text-destructive">Couldn't load your notes. Refresh and try again.</p>
          )}

          {notes.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No notes yet — add your first one above.</p>
          )}

          {notes.data?.map((n) => (
            <Card key={n.id}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <CardTitle className="text-base">{n.title}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => onDelete(n.id)}>
                  Delete
                </Button>
              </CardHeader>
              {n.body && <CardContent className="text-sm text-muted-foreground">{n.body}</CardContent>}
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
