import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, useDeleteRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export const Route = createFileRoute("/members")({ component: Members });

type Note = Row & {
  title: string;
  body: string | null;
};

const noteSchema = z.object({
  title: z.string().min(1, "Give it a title"),
  body: z.string().max(2000).optional(),
});

type NoteInput = z.infer<typeof noteSchema>;

function Members() {
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
        <h1 className="text-3xl font-semibold tracking-tight">Members area</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Sign in to keep your own practice notes here.
        </p>
        <Button asChild className="mt-6">
          <Link to="/account">Sign in</Link>
        </Button>
      </main>
    );
  }

  return <NotesPanel />;
}

function NotesPanel() {
  const notes = useRows<Note>("my_notes", { order: "id", dir: "desc" });
  const create = useCreateRow("my_notes");
  const del = useDeleteRow("my_notes");

  const form = useForm<NoteInput>({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: "", body: "" },
  });

  const onSubmit = (values: NoteInput) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Note saved.");
        form.reset();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Your notes</h1>
      <p className="mt-2 text-muted-foreground">
        Private to you — track how a class felt, poses to work on, anything at all.
      </p>

      <section className="mt-10">
        <div className="grid gap-3">
          {notes.isPending &&
            [0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}

          {notes.isError && (
            <p className="text-sm text-destructive">Couldn't load your notes right now.</p>
          )}

          {notes.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No notes yet — add your first below.</p>
          )}

          {notes.data?.map((n) => (
            <Card key={n.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{n.title}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    del.mutate(
                      { id: n.id },
                      {
                        onSuccess: () => toast.success("Note deleted."),
                        onError: (e: Error) => toast.error(e.message),
                      }
                    )
                  }
                >
                  Delete
                </Button>
              </CardHeader>
              {n.body && <CardContent className="text-sm text-muted-foreground">{n.body}</CardContent>}
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">New note</h2>
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Saving…" : "Save note"}
              </Button>
            </div>
          </form>
        </Form>
      </section>
    </main>
  );
}
